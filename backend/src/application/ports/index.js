/**
 * PORTAS (Ports & Adapters) que os casos de uso exigem do mundo externo.
 *
 * Os use cases dependem destes contratos — nunca de bcrypt, jsonwebtoken,
 * BullMQ ou Redis diretamente (Dependency Inversion). As implementações
 * concretas vivem em /infrastructure e são ligadas em config/container.js.
 *
 * Documentado em JSDoc (typedef) porque são contratos de forma, não de herança.
 *
 * @typedef {object} PasswordHasher
 * @property {(senha: string) => Promise<string>} hash
 * @property {(senha: string, hash: string) => Promise<boolean>} compare
 *
 * @typedef {object} TokenService
 * @property {(usuario: {id: string}) => {token: string, expiresIn: number}} gerarAccessToken
 * @property {(token: string) => {sub: string, exp: number}} verificarAccessToken
 * @property {(usuarioId: string) => {token: string, jti: string, expiraEm: Date}} gerarTokenRecuperacao
 * @property {(token: string) => {sub: string, jti: string}} verificarTokenRecuperacao
 * @property {(usuarioId: string) => string} gerarDesafio2FA
 * @property {(token: string) => {sub: string}} verificarDesafio2FA
 * @property {() => string} gerarTokenOpaco refresh token aleatório (não-JWT)
 * @property {(valor: string) => string} hashToken sha256 para armazenar tokens
 * @property {(codigo: string) => string} hashCodigo HMAC para códigos 2FA
 *
 * @typedef {object} EmailQueue
 * @property {(job: {tipo: 'reset-senha'|'2fa', para: string, dados: object, chaveIdempotencia: string}) => Promise<void>} enfileirar
 *
 * @typedef {object} LoginAttemptTracker
 * @property {(chave: string) => Promise<{bloqueado: boolean, retryAfterSeconds: number}>} verificarBloqueio
 * @property {(chave: string) => Promise<{tentativas: number, bloqueado: boolean, retryAfterSeconds: number}>} registrarFalha
 * @property {(chave: string) => Promise<void>} limpar
 *
 * @typedef {object} MarketDataGateway
 * @property {(ativo: object) => Promise<object>} obterCotacao nunca lança: devolve cotação marcada como indisponível
 * @property {(ativos: object[]) => Promise<object[]>} obterCotacoes
 * @property {(ativo: object, dias?: number) => Promise<object>} obterHistorico
 * @property {(ativo: object) => Promise<object>} obterIndicadores
 *
 * @typedef {object} TaxasDeJurosGateway taxas vigentes para o simulador (ADR-014)
 * @property {() => Promise<{selicMeta: number, cdi: number, trMensal: number, dataReferencia: string|null,
 *   origem: 'banco-central'|'cache'|'padrao', referencia: boolean, desatualizado: boolean}>} obterTaxas
 *   nunca lança: sem Banco Central nem cache, devolve as taxas de referência (em %)
 *
 * @typedef {object} Notificador tempo real (WebSocket), best-effort
 * @property {(cotacao: object) => void} emitirCotacao
 * @property {(usuarioId: string, notificacao: object) => void} notificarUsuario
 *
 * @typedef {object} AuditLog nunca deve derrubar o fluxo principal
 * @property {(entrada: {usuarioId?: string, acao: string, ip?: string, userAgent?: string, requestId?: string, metadados?: object}) => Promise<void>} registrar
 *
 * @typedef {object} UnitOfWork
 * @property {<T>(fn: (repos: object) => Promise<T>) => Promise<T>} run executa fn numa transação
 */

module.exports = {};
