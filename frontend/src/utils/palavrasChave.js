import dicionario from '../data/dicionarioSinonimos.json';

/**
 * Prévia, NO NAVEGADOR, dos interesses detectados enquanto o usuário digita.
 * É só feedback de UX: o ranqueamento real roda no backend, com o MESMO
 * dicionário (o CI falha se as duas cópias divergirem).
 */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const CONCEITOS = dicionario.conceitos.map((c) => ({ rotulo: c.rotulo, termos: c.termos.map(normalizar) }));

export function detectarInteresses(texto) {
  const alvo = ` ${normalizar(texto)} `;
  return CONCEITOS.filter((c) => c.termos.some((t) => alvo.includes(` ${t} `))).map((c) => c.rotulo);
}
