// O jsdom não expõe TextEncoder/TextDecoder, que o react-router 7 usa ao ser
// importado. Navegadores reais têm ambos — isto existe só para o Jest.
const { TextEncoder, TextDecoder } = require('node:util');

if (typeof globalThis.TextEncoder === 'undefined') globalThis.TextEncoder = TextEncoder;
if (typeof globalThis.TextDecoder === 'undefined') globalThis.TextDecoder = TextDecoder;
