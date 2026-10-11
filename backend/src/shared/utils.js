const crypto = require('node:crypto');

/** sha256 em hex — usado para armazenar tokens (nunca em texto puro). */
function sha256(valor) {
  return crypto.createHash('sha256').update(String(valor)).digest('hex');
}

/** HMAC-SHA256 em hex — para segredos de baixa entropia (códigos 2FA). */
function hmacSha256(segredo, valor) {
  return crypto.createHmac('sha256', segredo).update(String(valor)).digest('hex');
}

/** Comparação em tempo constante (evita timing attacks). */
function compararSeguro(a, b) {
  const bufA = Buffer.from(String(a ?? ''));
  const bufB = Buffer.from(String(b ?? ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** page/limit → offset, e meta padronizado para respostas paginadas. */
function paginar({ page = 1, limit = 20 } = {}) {
  return { page, limit, offset: (page - 1) * limit };
}

function metaPaginacao({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/** "ana.souza@gmail.com" → "an***@gmail.com" */
function mascararEmail(email) {
  if (typeof email !== 'string' || !email.includes('@')) return '[REDACTED]';
  const [local, dominio] = email.split('@');
  return `${local.slice(0, 2)}***@${dominio}`;
}

/** Promise com prazo: rejeita se `promessa` não resolver em `ms`. */
function comTimeout(promessa, ms, mensagem = 'timeout') {
  let timer;
  const limite = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(mensagem)), ms);
  });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(timer));
}

module.exports = { sha256, hmacSha256, compararSeguro, paginar, metaPaginacao, mascararEmail, comTimeout };
