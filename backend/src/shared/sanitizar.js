const { FilterXSS } = require('xss');

/**
 * Sanitização de TEXTO LIVRE (defesa em profundidade contra XSS armazenado).
 *
 * A defesa principal contra XSS é o React escapar tudo na renderização. Mas o
 * texto da Ideia é persistido e pode ser consumido por outros clientes no
 * futuro (e-mail, app nativo, painel admin) — então removemos HTML na entrada.
 * Nenhuma tag é permitida: o conteúdo de <script>/<style> é descartado.
 */
const filtro = new FilterXSS({
  whiteList: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style', 'iframe', 'object'],
});

function sanitizarTexto(texto) {
  if (typeof texto !== 'string') return '';
  return filtro
    .process(texto)
    // remove caracteres de controle (exceto \n e \t) — intencional, daí o disable
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

module.exports = { sanitizarTexto };
