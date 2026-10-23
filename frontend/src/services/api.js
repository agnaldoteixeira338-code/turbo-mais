import { API_URL } from '../config/env';

/**
 * Cliente HTTP da API.
 *
 * Decisões de segurança (ver docs/SECURITY.md):
 *  - Access token SÓ EM MEMÓRIA (variável de módulo). Nada de localStorage:
 *    um XSS não consegue ler um token que não está em storage persistente.
 *  - Refresh token em cookie httpOnly (o JS nunca o vê).
 *  - CSRF: o valor do cookie csrf é repetido no header X-CSRF-Token.
 *
 * Resiliência:
 *  - 401 → tenta renovar a sessão UMA vez e repete a requisição.
 *  - Renovação "single-flight": 10 requisições que expiram juntas disparam
 *    UM refresh (senão o 2º refresh usaria um token já rotacionado e a
 *    detecção de reuso derrubaria a sessão inteira).
 *  - POSTs que criam recursos levam Idempotency-Key, mantida no retry.
 *  - Requisição que passa de LIMIAR_LENTO_MS avisa os observadores: no plano
 *    gratuito a API "dorme" e a primeira chamada pode levar ~1 min.
 */
let accessToken = null;
let aoExpirarSessao = () => {};
let refreshEmVoo = null;

export const LIMIAR_LENTO_MS = 4000;
let requisicoesLentas = 0;
const observadoresLentidao = new Set();
const avisarLentidao = () => observadoresLentidao.forEach((fn) => fn(requisicoesLentas > 0));

/** Inscreve `fn(lento: boolean)`; devolve a função para cancelar a inscrição. */
export function observarLentidao(fn) {
  observadoresLentidao.add(fn);
  fn(requisicoesLentas > 0);
  return () => observadoresLentidao.delete(fn);
}

async function fetchMonitorado(url, opcoes) {
  let lenta = false;
  const timer = setTimeout(() => {
    lenta = true;
    requisicoesLentas += 1;
    avisarLentidao();
  }, LIMIAR_LENTO_MS);
  try {
    return await fetch(url, opcoes);
  } finally {
    clearTimeout(timer);
    if (lenta) {
      requisicoesLentas -= 1;
      avisarLentidao();
    }
  }
}

export class ApiError extends Error {
  constructor({ status, code = 'ERRO', message = 'Algo deu errado. Tente novamente.', details, requestId, retryAfter } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
    this.retryAfter = retryAfter;
  }
}

export const definirAccessToken = (token) => {
  accessToken = token;
};
export const obterAccessToken = () => accessToken;
export const registrarAoExpirarSessao = (fn) => {
  aoExpirarSessao = fn;
};

function lerCookie(nome) {
  const par = document.cookie.split('; ').find((c) => c.startsWith(`${nome}=`));
  return par ? decodeURIComponent(par.slice(nome.length + 1)) : undefined;
}
const tokenCsrf = () => lerCookie('__Host-csrf') ?? lerCookie('csrf_token') ?? '';

/**
 * O cookie CSRF é emitido junto com o de refresh (que é httpOnly e invisível ao JS).
 * Sem ele, não existe sessão para renovar — evita um 403 a cada primeira visita.
 */
export const possivelSessaoAtiva = () => tokenCsrf() !== '';

export function gerarChaveIdempotencia() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `k-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

async function lerCorpo(resposta) {
  try {
    return await resposta.json();
  } catch {
    return null;
  }
}

function erroDe(resposta, corpo) {
  return new ApiError({
    status: resposta.status,
    ...(corpo?.error ?? {}),
    retryAfter: Number(resposta.headers.get('retry-after')) || undefined,
  });
}

/**
 * Dispara um ping sem esperar resposta: se a API estiver dormindo, ela começa a
 * acordar enquanto a pessoa ainda lê a tela. Fora do monitor de lentidão de
 * propósito (o aviso só aparece quando a pessoa realmente espera por algo).
 */
export function acordarServidor() {
  fetch(`${API_URL}/api/v1/ping`, { credentials: 'omit' }).catch(() => {});
}

/** Renova a sessão com o cookie de refresh. Compartilhado entre chamadas simultâneas. */
export function renovarSessao() {
  refreshEmVoo ??= fetchMonitorado(`${API_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json', 'X-CSRF-Token': tokenCsrf() },
  })
    .then(async (resposta) => {
      const corpo = await lerCorpo(resposta);
      if (!resposta.ok) throw erroDe(resposta, corpo);
      definirAccessToken(corpo.data.accessToken);
      return corpo.data;
    })
    .finally(() => {
      refreshEmVoo = null;
    });
  return refreshEmVoo;
}

/**
 * @param {string} caminho relativo a /api/v1 (ex.: '/favoritos')
 * @param {{method?: string, body?: unknown, idempotente?: boolean, csrf?: boolean, signal?: AbortSignal}} [opcoes]
 * @returns {Promise<{data: any, meta: any}>}
 */
export async function api(caminho, { method = 'GET', body, idempotente = false, csrf = false, signal, _chave, _renovou = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (csrf) headers['X-CSRF-Token'] = tokenCsrf();
  const chave = idempotente ? (_chave ?? gerarChaveIdempotencia()) : undefined;
  if (chave) headers['Idempotency-Key'] = chave;

  let resposta;
  try {
    resposta = await fetchMonitorado(`${API_URL}/api/v1${caminho}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include',
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError({ status: 0, code: 'SEM_CONEXAO', message: 'Sem conexão com o servidor. Verifique sua internet.' });
  }

  if (resposta.status === 401 && accessToken && !_renovou) {
    try {
      await renovarSessao();
    } catch {
      definirAccessToken(null);
      aoExpirarSessao();
      throw new ApiError({ status: 401, code: 'SESSAO_EXPIRADA', message: 'Sua sessão expirou. Entre novamente.' });
    }
    return api(caminho, { method, body, idempotente, csrf, signal, _chave: chave, _renovou: true });
  }

  if (resposta.status === 204) return { data: null, meta: null };
  const corpo = await lerCorpo(resposta);
  if (!resposta.ok || !corpo?.success) throw erroDe(resposta, corpo);
  return { data: corpo.data, meta: corpo.meta };
}
