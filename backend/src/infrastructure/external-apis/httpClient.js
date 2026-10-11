/**
 * Cliente HTTP mínimo sobre o fetch nativo (Node 20+), sem dependências.
 *
 * Toda chamada externa tem TIMEOUT explícito (AbortSignal). Sem isso, uma
 * API que aceita a conexão e nunca responde prende recursos indefinidamente.
 */
class ExternalApiError extends Error {
  constructor(message, { status, dependencia, retryable } = {}) {
    super(message);
    this.name = 'ExternalApiError';
    this.status = status;
    this.dependencia = dependencia;
    // rede/timeout (sem status), 5xx e 429 valem retry; o resto é determinístico
    this.retryable = retryable ?? (status === undefined || status >= 500 || status === 429);
  }
}

async function obterJson(url, { dependencia, timeoutMs = 4000, headers = {} } = {}) {
  let resposta;
  try {
    resposta = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': 'turbo-mais/1.0', ...headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const motivo = err.name === 'TimeoutError' ? `timeout após ${timeoutMs}ms` : err.message;
    throw new ExternalApiError(`${dependencia}: falha de rede (${motivo})`, { dependencia });
  }

  if (!resposta.ok) {
    throw new ExternalApiError(`${dependencia}: HTTP ${resposta.status}`, { status: resposta.status, dependencia });
  }
  try {
    return await resposta.json();
  } catch {
    throw new ExternalApiError(`${dependencia}: resposta não é JSON válido`, { status: resposta.status, dependencia, retryable: false });
  }
}

/**
 * Valida a resposta contra o CONTRATO esperado (schema Zod). Se a API mudar
 * o formato, falhamos de forma explícita e não-retentável — em vez de
 * propagar `undefined` silenciosamente até a tela. Os mesmos schemas são
 * usados nos testes de contrato (tests/contract).
 */
function validarContrato(schema, dados, dependencia) {
  const resultado = schema.safeParse(dados);
  if (!resultado.success) {
    const detalhe = resultado.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new ExternalApiError(`${dependencia}: contrato quebrado (${detalhe})`, { dependencia, status: 502, retryable: false });
  }
  return resultado.data;
}

module.exports = { obterJson, validarContrato, ExternalApiError };
