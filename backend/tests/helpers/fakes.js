/**
 * Implementações EM MEMÓRIA das portas/repositórios, para testes unitários.
 * Estendem as mesmas classes-base dos adaptadores Postgres — se o contrato
 * mudar, os fakes quebram junto (e o teste avisa).
 */
const crypto = require('node:crypto');
const { UsuarioRepository } = require('../../src/domain/repositories/UsuarioRepository');
const { RefreshTokenRepository, TokenRecuperacaoRepository, Token2faRepository } = require('../../src/domain/repositories/TokenRepositories');
const { FavoritoRepository } = require('../../src/domain/repositories/FavoritoRepository');
const { AlertaRepository } = require('../../src/domain/repositories/AlertaRepository');
const { NotificacaoRepository } = require('../../src/domain/repositories/NotificacaoRepository');
const { AtivoEducativoRepository } = require('../../src/domain/repositories/AtivoEducativoRepository');
const { IdeiaRepository } = require('../../src/domain/repositories/IdeiaRepository');
const { Usuario } = require('../../src/domain/entities/Usuario');
const { Favorito } = require('../../src/domain/entities/Favorito');
const { Alerta } = require('../../src/domain/entities/Alerta');
const { Notificacao } = require('../../src/domain/entities/Notificacao');
const { AtivoEducativo } = require('../../src/domain/entities/AtivoEducativo');
const { Ideia } = require('../../src/domain/entities/Ideia');
const { Sugestao } = require('../../src/domain/entities/Sugestao');
const { ConflictError } = require('../../src/application/errors');

const id = () => crypto.randomUUID();

class FakeUsuarioRepository extends UsuarioRepository {
  constructor() { super(); this.itens = []; }
  async criar({ email, celular, senhaHash }) {
    if (this.itens.some((u) => u.email === email)) throw new ConflictError('E-mail já cadastrado', 'EMAIL_JA_CADASTRADO');
    const u = new Usuario({ id: id(), email, celular, senhaHash });
    this.itens.push(u);
    return u;
  }
  async buscarPorEmail(email) { return this.itens.find((u) => u.email === email.toLowerCase()) ?? null; }
  async buscarPorId(i) { return this.itens.find((u) => u.id === i) ?? null; }
  async atualizarSenha(i, senhaHash) { (await this.buscarPorId(i)).senhaHash = senhaHash; }
  async atualizarDoisFatores(i, ativo) { (await this.buscarPorId(i)).twoFactorAtivo = ativo; }
}

class FakeRefreshTokenRepository extends RefreshTokenRepository {
  constructor() { super(); this.itens = []; }
  async criar(dados) { const t = { id: id(), revogado: false, ...dados }; this.itens.push(t); return t; }
  async buscarPorHashParaAtualizacao(h) { return this.itens.find((t) => t.tokenHash === h) ?? null; }
  async revogar(i, { substituidoPor } = {}) { Object.assign(this.itens.find((t) => t.id === i), { revogado: true, substituidoPor }); }
  async revogarPorHash(h) { this.itens.filter((t) => t.tokenHash === h).forEach((t) => { t.revogado = true; }); }
  async revogarFamilia(f) { this.itens.filter((t) => t.familiaId === f).forEach((t) => { t.revogado = true; }); }
  async revogarTodosDoUsuario(u) { this.itens.filter((t) => t.usuarioId === u).forEach((t) => { t.revogado = true; }); }
}

class FakeTokenRecuperacaoRepository extends TokenRecuperacaoRepository {
  constructor() { super(); this.itens = []; }
  async criar(dados) { this.itens.push({ ...dados, usado: false }); }
  async invalidarPendentes(u) { this.itens.filter((t) => t.usuarioId === u).forEach((t) => { t.usado = true; }); }
  async consumir(h) {
    const t = this.itens.find((x) => x.tokenHash === h && !x.usado && x.expiraEm > new Date());
    if (!t) return null;
    t.usado = true;
    return { usuarioId: t.usuarioId };
  }
}

class FakeToken2faRepository extends Token2faRepository {
  constructor() { super(); this.itens = []; }
  async criar(dados) { const t = { id: id(), tentativas: 0, usado: false, criadoEm: Date.now(), ...dados }; this.itens.push(t); return { id: t.id }; }
  async invalidarPendentes(u, f) { this.itens.filter((t) => t.usuarioId === u && t.finalidade === f).forEach((t) => { t.usado = true; }); }
  async buscarPendente(u, f) { return [...this.itens].reverse().find((t) => t.usuarioId === u && t.finalidade === f && !t.usado) ?? null; }
  async incrementarTentativas(i) { this.itens.find((t) => t.id === i).tentativas += 1; }
  async consumir(i) { const t = this.itens.find((x) => x.id === i && !x.usado); if (!t) return false; t.usado = true; return true; }
}

class FakeFavoritoRepository extends FavoritoRepository {
  constructor() { super(); this.itens = []; }
  async adicionar({ usuarioId, ticker, tipo }) {
    const existente = this.itens.find((f) => f.usuarioId === usuarioId && f.ticker === ticker);
    if (existente) return { favorito: existente, criado: false };
    const f = new Favorito({ id: id(), usuarioId, ticker, tipo });
    this.itens.push(f);
    return { favorito: f, criado: true };
  }
  async remover(u, t) { const antes = this.itens.length; this.itens = this.itens.filter((f) => !(f.usuarioId === u && f.ticker === t)); return this.itens.length < antes; }
  async listar(u, { tipo, limit, offset }) {
    const todos = this.itens.filter((f) => f.usuarioId === u && (!tipo || f.tipo === tipo));
    return { itens: todos.slice(offset, offset + limit), total: todos.length };
  }
  async removerTodosDoUsuario(u) { const antes = this.itens.length; this.itens = this.itens.filter((f) => f.usuarioId !== u); return antes - this.itens.length; }
}

class FakeAlertaRepository extends AlertaRepository {
  constructor() { super(); this.itens = []; }
  async criar(dados) {
    if (this.itens.some((a) => a.usuarioId === dados.usuarioId && a.ticker === dados.ticker && a.direcao === dados.direcao && a.gatilhoPercentual === dados.gatilhoPercentual)) {
      throw new ConflictError('duplicado', 'ALERTA_DUPLICADO');
    }
    const a = new Alerta({ id: id(), ...dados });
    this.itens.push(a);
    return a;
  }
  async buscarPorId(i, u) { return this.itens.find((a) => a.id === i && a.usuarioId === u) ?? null; }
  async atualizar(i, u, campos) { const a = await this.buscarPorId(i, u); Object.assign(a, campos); return a; }
  async remover(i, u) { const antes = this.itens.length; this.itens = this.itens.filter((a) => !(a.id === i && a.usuarioId === u)); return this.itens.length < antes; }
  async listar(u, { limit, offset }) { const todos = this.itens.filter((a) => a.usuarioId === u); return { itens: todos.slice(offset, offset + limit), total: todos.length }; }
  async contarPorUsuario(u) { return this.itens.filter((a) => a.usuarioId === u).length; }
  async listarTickersComAlertasAtivos() { return [...new Set(this.itens.filter((a) => a.ativo).map((a) => a.ticker))]; }
  async listarAtivosPorTicker(t) { return this.itens.filter((a) => a.ticker === t && a.ativo); }
  async removerTodosDoUsuario(u) { const antes = this.itens.length; this.itens = this.itens.filter((a) => a.usuarioId !== u); return antes - this.itens.length; }
}

class FakeNotificacaoRepository extends NotificacaoRepository {
  constructor() { super(); this.itens = []; }
  async criarSeNaoExistir(dados) {
    if (this.itens.some((n) => n.hashIdempotencia === dados.hashIdempotencia)) return null;
    const n = new Notificacao({ id: id(), ...dados });
    this.itens.push(n);
    return n;
  }
  async listar(u, { apenasNaoLidas, limit, offset }) {
    const doUsuario = this.itens.filter((n) => n.usuarioId === u);
    const filtrados = doUsuario.filter((n) => !apenasNaoLidas || !n.lida);
    return { itens: filtrados.slice(offset, offset + limit), total: filtrados.length, naoLidas: doUsuario.filter((n) => !n.lida).length };
  }
  async marcarComoLida(i, u) { const n = this.itens.find((x) => x.id === i && x.usuarioId === u); if (!n) return null; n.lida = true; return n; }
  async removerTodasDoUsuario(u) { const antes = this.itens.length; this.itens = this.itens.filter((n) => n.usuarioId !== u); return antes - this.itens.length; }
}

class FakeAtivoRepository extends AtivoEducativoRepository {
  constructor(ativos = CATALOGO()) { super(); this.itens = ativos; }
  async buscarPorTicker(t) { return this.itens.find((a) => a.ticker === t) ?? null; }
  async buscarPorTickers(ts) { return this.itens.filter((a) => ts.includes(a.ticker)); }
  async buscar({ termo, tipo, setor, limit, offset }) {
    const t = termo?.toLowerCase();
    const todos = this.itens.filter((a) => (!t || a.ticker.toLowerCase().includes(t) || a.nome.toLowerCase().includes(t)) && (!tipo || a.tipo === tipo) && (!setor || a.setor === setor));
    return { itens: todos.slice(offset, offset + limit), total: todos.length };
  }
  async listarTodos() { return this.itens; }
}

class FakeIdeiaRepository extends IdeiaRepository {
  constructor() { super(); this.itens = []; }
  async criar(dados) { const i = new Ideia({ id: id(), ...dados }); this.itens.push(i); return i; }
  async adicionarSugestoes(ideiaId, sugestoes) {
    const criadas = sugestoes.map((s) => new Sugestao({ id: id(), ideiaId, ...s }));
    this.itens.find((i) => i.id === ideiaId).sugestoes = criadas;
    return criadas;
  }
  async listar(u, { limit, offset }) { const todos = this.itens.filter((i) => i.usuarioId === u); return { itens: todos.slice(offset, offset + limit), total: todos.length }; }
  async removerTodasDoUsuario(u) { const antes = this.itens.length; this.itens = this.itens.filter((i) => i.usuarioId !== u); return antes - this.itens.length; }
}

/** Hasher rápido e determinístico (bcrypt real fica para a integração). */
const fakeHasher = {
  hash: jest.fn(async (s) => `hash:${s}`),
  compare: jest.fn(async (s, h) => h === `hash:${s}`),
};

function fakeLoginTracker({ max = 5 } = {}) {
  const falhas = new Map();
  return {
    falhas,
    verificarBloqueio: jest.fn(async (k) => ({ bloqueado: (falhas.get(k) ?? 0) >= max, retryAfterSeconds: 900 })),
    registrarFalha: jest.fn(async (k) => {
      const n = (falhas.get(k) ?? 0) + 1;
      falhas.set(k, n);
      return { tentativas: n, bloqueado: n >= max, retryAfterSeconds: 900 };
    }),
    limpar: jest.fn(async (k) => falhas.delete(k)),
  };
}

const fakeAuditLog = () => ({ entradas: [], registrar: jest.fn(async function registrar(e) { this.entradas.push(e); }) });
const fakeEmailQueue = () => ({ jobs: [], enfileirar: jest.fn(async function enfileirar(j) { this.jobs.push(j); }) });
const fakeUnitOfWork = (repos) => ({ run: jest.fn((fn) => fn(repos)) });

function CATALOGO() {
  const base = { oQueFaz: '...', papelSociedade: '...', fundacao: 2000, rendimentoMedio: null, codigoExterno: null, moeda: 'BRL' };
  return [
    new AtivoEducativo({ ...base, id: id(), ticker: 'PETR4', nome: 'Petrobras PN', tipo: 'acao_br', setor: 'Petróleo e Gás', pais: 'Brasil', perfilRisco: 'moderado', tags: ['energia', 'dividendos', 'commodities'], precoReferencia: 37.5 }),
    new AtivoEducativo({ ...base, id: id(), ticker: 'ITUB4', nome: 'Itaú Unibanco PN', tipo: 'acao_br', setor: 'Bancos', pais: 'Brasil', perfilRisco: 'moderado', tags: ['bancos', 'dividendos'], precoReferencia: 36 }),
    new AtivoEducativo({ ...base, id: id(), ticker: 'WEGE3', nome: 'WEG ON', tipo: 'acao_br', setor: 'Bens Industriais', pais: 'Brasil', perfilRisco: 'moderado', tags: ['industria', 'sustentabilidade', 'crescimento'], precoReferencia: 45 }),
    new AtivoEducativo({ ...base, id: id(), ticker: 'NVDA', nome: 'NVIDIA Corp.', tipo: 'acao_global', setor: 'Tecnologia', pais: 'EUA', perfilRisco: 'arrojado', tags: ['tecnologia', 'inovacao', 'crescimento', 'chips'], precoReferencia: 180, moeda: 'USD' }),
    new AtivoEducativo({ ...base, id: id(), ticker: 'AAPL', nome: 'Apple Inc.', tipo: 'acao_global', setor: 'Tecnologia', pais: 'EUA', perfilRisco: 'moderado', tags: ['tecnologia', 'inovacao'], precoReferencia: 230, moeda: 'USD' }),
    new AtivoEducativo({ ...base, id: id(), ticker: 'BTC', nome: 'Bitcoin', tipo: 'cripto', setor: 'Criptoativos', pais: 'Global', perfilRisco: 'arrojado', tags: ['cripto', 'crescimento'], codigoExterno: 'bitcoin', precoReferencia: 600000 }),
    new AtivoEducativo({ ...base, id: id(), ticker: 'CDB-LIQ-100', nome: 'CDB Liquidez Diária 100% do CDI', tipo: 'cdb', setor: 'Renda Fixa', pais: 'Brasil', perfilRisco: 'conservador', tags: ['renda_fixa', 'liquidez', 'reserva'], rendimentoMedio: '100% do CDI', fundacao: null, precoReferencia: 100 }),
  ];
}

module.exports = {
  FakeUsuarioRepository,
  FakeRefreshTokenRepository,
  FakeTokenRecuperacaoRepository,
  FakeToken2faRepository,
  FakeFavoritoRepository,
  FakeAlertaRepository,
  FakeNotificacaoRepository,
  FakeAtivoRepository,
  FakeIdeiaRepository,
  fakeHasher,
  fakeLoginTracker,
  fakeAuditLog,
  fakeEmailQueue,
  fakeUnitOfWork,
  CATALOGO,
};
