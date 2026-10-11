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
 */
let accessToken = null;
let aoExpirarSessao = () => {};
let refreshEmVoo = null;

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

/** Renova a sessão com o cookie de refresh. Compartilhado entre chamadas simultâneas. */
export function renovarSessao() {
  refreshEmVoo ??= fetch(`${API_URL}/api/v1/auth/refresh`, {
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
    resposta = await fetch(`${API_URL}/api/v1${caminho}`, {
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
