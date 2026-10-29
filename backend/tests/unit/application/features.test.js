const { AdicionarFavorito } = require('../../../src/application/use-cases/favoritos/AdicionarFavorito');
const { RemoverFavorito } = require('../../../src/application/use-cases/favoritos/RemoverFavorito');
const { ListarFavoritos } = require('../../../src/application/use-cases/favoritos/ListarFavoritos');
const { CriarAlerta } = require('../../../src/application/use-cases/alertas/CriarAlerta');
const { AtualizarAlerta } = require('../../../src/application/use-cases/alertas/AtualizarAlerta');
const { RemoverAlerta } = require('../../../src/application/use-cases/alertas/RemoverAlerta');
const { ListarAlertas } = require('../../../src/application/use-cases/alertas/ListarAlertas');
const { ListarNotificacoes } = require('../../../src/application/use-cases/notificacoes/ListarNotificacoes');
const { MarcarComoLida } = require('../../../src/application/use-cases/notificacoes/MarcarComoLida');
const { ProcessarAlerta } = require('../../../src/application/use-cases/notificacoes/ProcessarAlerta');
const { BuscarAtivos } = require('../../../src/application/use-cases/ativos/BuscarAtivos');
const { BuscarAcoesBrasileiras } = require('../../../src/application/use-cases/ativos/BuscarAcoesBrasileiras');
const { BuscarAcoesGlobais } = require('../../../src/application/use-cases/ativos/BuscarAcoesGlobais');
const { DetalharAtivo } = require('../../../src/application/use-cases/ativos/DetalharAtivo');
const { AnalisadorDeComportamento } = require('../../../src/domain/services/AnalisadorDeComportamento');
const { GerarSugestoes } = require('../../../src/application/use-cases/ideias/GerarSugestoes');
const { ListarIdeias } = require('../../../src/application/use-cases/ideias/ListarIdeias');
const { MotorDeSugestoes } = require('../../../src/domain/services/MotorDeSugestoes');
const dicionario = require('../../../src/domain/services/dicionarioSinonimos.json');
const {
  FakeFavoritoRepository, FakeAlertaRepository, FakeNotificacaoRepository, FakeAtivoRepository, FakeIdeiaRepository,
  fakeAuditLog, fakeUnitOfWork,
} = require('../../helpers/fakes');

const U1 = 'usuario-1';
const U2 = 'usuario-2';

/** MarketData falso: cotação configurável por ticker. */
function fakeMarketData(cotacoes = {}) {
  const padrao = (a) => ({ ticker: a.ticker, preco: 10, variacaoPercentual: 0, desatualizado: false, indisponivel: false });
  return {
    obterCotacao: jest.fn(async (a) => ({ ...padrao(a), ...cotacoes[a.ticker] })),
    obterCotacoes: jest.fn(async (as) => as.map((a) => ({ ...padrao(a), ...cotacoes[a.ticker] }))),
    obterHistorico: jest.fn(async () => ({ pontos: [{ data: '2026-10-01', preco: 10 }], desatualizado: false })),
    obterIndicadores: jest.fn(async () => ({ pl: 5, dividendYield: 8, marketCap: 1e9 })),
  };
}

describe('Favoritos', () => {
  const montar = () => {
    const favoritos = new FakeFavoritoRepository();
    const ativos = new FakeAtivoRepository();
    const marketData = fakeMarketData({ PETR4: { preco: 37.9, variacaoPercentual: 1.2 } });
    return {
      favoritos,
      adicionar: new AdicionarFavorito({ favoritoRepository: favoritos, ativoRepository: ativos }),
      remover: new RemoverFavorito({ favoritoRepository: favoritos }),
      listar: new ListarFavoritos({ favoritoRepository: favoritos, ativoRepository: ativos, marketData }),
    };
  };

  it('adicionar é idempotente: criado=true na 1ª vez, false depois, sem duplicar', async () => {
    const s = montar();
    expect((await s.adicionar.execute({ usuarioId: U1, ticker: 'petr4' })).criado).toBe(true);
    const segunda = await s.adicionar.execute({ usuarioId: U1, ticker: 'PETR4' });
    expect(segunda.criado).toBe(false);
    expect(segunda.favorito).toMatchObject({ ticker: 'PETR4', tipo: 'acao_br' });
    expect(s.favoritos.itens).toHaveLength(1);
  });

  it('rejeita ativo fora do catálogo', async () => {
    await expect(montar().adicionar.execute({ usuarioId: U1, ticker: 'XPTO3' })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('remover é idempotente e isolado por usuário', async () => {
    const s = montar();
    await s.adicionar.execute({ usuarioId: U1, ticker: 'PETR4' });
    await s.adicionar.execute({ usuarioId: U2, ticker: 'PETR4' });
    expect(await s.remover.execute({ usuarioId: U1, ticker: 'PETR4' })).toEqual({ removido: true });
    expect(await s.remover.execute({ usuarioId: U1, ticker: 'PETR4' })).toEqual({ removido: false });
    expect(s.favoritos.itens).toHaveLength(1);
  });

  it('lista com cotação, filtro por tipo e meta de paginação', async () => {
    const s = montar();
    for (const t of ['PETR4', 'NVDA', 'BTC']) await s.adicionar.execute({ usuarioId: U1, ticker: t });
    const { itens, meta } = await s.listar.execute({ usuarioId: U1, page: 1, limit: 2 });
    expect(itens).toHaveLength(2);
    expect(meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    const petr = (await s.listar.execute({ usuarioId: U1, tipo: 'acao_br', page: 1, limit: 20 })).itens;
    expect(petr).toHaveLength(1);
    expect(petr[0]).toMatchObject({ ativo: { ticker: 'PETR4' }, cotacao: { preco: 37.9 } });
  });
});

describe('Alertas', () => {
  const montar = (limite) => {
    const alertas = new FakeAlertaRepository();
    const auditLog = fakeAuditLog();
    const ativos = new FakeAtivoRepository();
    return {
      alertas, auditLog,
      criar: new CriarAlerta({ alertaRepository: alertas, ativoRepository: ativos, auditLog, ...(limite ? { limitePorUsuario: limite } : {}) }),
      atualizar: new AtualizarAlerta({ alertaRepository: alertas, auditLog }),
      remover: new RemoverAlerta({ alertaRepository: alertas, auditLog }),
      listar: new ListarAlertas({ alertaRepository: alertas }),
    };
  };

  it('cria alerta e audita com metadados', async () => {
    const s = montar();
    const a = await s.criar.execute({ usuarioId: U1, ticker: 'petr4', gatilhoPercentual: '3', direcao: 'baixa' });
    expect(a).toMatchObject({ ticker: 'PETR4', gatilhoPercentual: 3, direcao: 'baixa', ativo: true });
    expect(s.auditLog.entradas[0]).toMatchObject({ acao: 'ALERTA_CRIADO', metadados: { ticker: 'PETR4' } });
  });

  it('regras: ativo inexistente 404, renda fixa 422, limite por usuário 422, gatilho inválido', async () => {
    const s = montar(1);
    await expect(s.criar.execute({ usuarioId: U1, ticker: 'NADA3', gatilhoPercentual: 3, direcao: 'alta' })).rejects.toMatchObject({ statusCode: 404 });
    await expect(s.criar.execute({ usuarioId: U1, ticker: 'CDB-LIQ-100', gatilhoPercentual: 3, direcao: 'alta' })).rejects.toMatchObject({ code: 'ALERTA_NAO_SUPORTADO' });
    await s.criar.execute({ usuarioId: U1, ticker: 'PETR4', gatilhoPercentual: 3, direcao: 'alta' });
    await expect(s.criar.execute({ usuarioId: U1, ticker: 'VALE3', gatilhoPercentual: 3, direcao: 'alta' })).rejects.toMatchObject({ statusCode: 404 });
    await expect(s.criar.execute({ usuarioId: U1, ticker: 'ITUB4', gatilhoPercentual: 3, direcao: 'alta' })).rejects.toMatchObject({ code: 'LIMITE_ALERTAS' });
    await expect(s.criar.execute({ usuarioId: U2, ticker: 'ITUB4', gatilhoPercentual: 0, direcao: 'alta' })).rejects.toThrow(/Gatilho/);
  });

  it('atualiza apenas alertas do próprio usuário (404 para o dos outros)', async () => {
    const s = montar();
    const a = await s.criar.execute({ usuarioId: U1, ticker: 'PETR4', gatilhoPercentual: 3, direcao: 'alta' });
    await expect(s.atualizar.execute({ id: a.id, usuarioId: U2, campos: { ativo: false } })).rejects.toMatchObject({ statusCode: 404 });
    const atualizado = await s.atualizar.execute({ id: a.id, usuarioId: U1, campos: { ativo: false, gatilhoPercentual: 5 } });
    expect(atualizado).toMatchObject({ ativo: false, gatilhoPercentual: 5, direcao: 'alta' });
    await expect(s.atualizar.execute({ id: a.id, usuarioId: U1, campos: { direcao: 'x' } })).rejects.toThrow(/Direção/);
  });

  it('remove (404 se não existir) e lista paginado', async () => {
    const s = montar();
    const a = await s.criar.execute({ usuarioId: U1, ticker: 'PETR4', gatilhoPercentual: 3, direcao: 'alta' });
    expect((await s.listar.execute({ usuarioId: U1, page: 1, limit: 10 })).meta.total).toBe(1);
    await s.remover.execute({ id: a.id, usuarioId: U1 });
    await expect(s.remover.execute({ id: a.id, usuarioId: U1 })).rejects.toMatchObject({ statusCode: 404 });
    expect(s.auditLog.entradas.map((e) => e.acao)).toContain('ALERTA_REMOVIDO');
  });
});

describe('Notificações', () => {
  it('lista com contagem de não lidas e marca como lida (isolado por usuário)', async () => {
    const repo = new FakeNotificacaoRepository();
    const n1 = await repo.criarSeNaoExistir({ usuarioId: U1, ticker: 'PETR4', variacao: 3, direcao: 'alta', hashIdempotencia: 'h1' });
    await repo.criarSeNaoExistir({ usuarioId: U1, ticker: 'VALE3', variacao: -4, direcao: 'baixa', hashIdempotencia: 'h2' });
    const listar = new ListarNotificacoes({ notificacaoRepository: repo });
    const marcar = new MarcarComoLida({ notificacaoRepository: repo });

    await expect(marcar.execute({ id: n1.id, usuarioId: U2 })).rejects.toMatchObject({ statusCode: 404 });
    await marcar.execute({ id: n1.id, usuarioId: U1 });
    const { itens, meta } = await listar.execute({ usuarioId: U1, apenasNaoLidas: true, page: 1, limit: 20 });
    expect(itens.map((n) => n.ticker)).toEqual(['VALE3']);
    expect(meta.naoLidas).toBe(1);
  });
});

describe('ProcessarAlerta (priceWatcher)', () => {
  const momento = new Date('2026-10-08T14:00:00Z');

  async function montar(cotacoes) {
    const alertas = new FakeAlertaRepository();
    const notificacoes = new FakeNotificacaoRepository();
    const notificador = { emitirCotacao: jest.fn(), notificarUsuario: jest.fn() };
    await alertas.criar({ usuarioId: U1, ticker: 'PETR4', gatilhoPercentual: 3, direcao: 'baixa' });
    await alertas.criar({ usuarioId: U2, ticker: 'PETR4', gatilhoPercentual: 10, direcao: 'baixa' });
    await alertas.criar({ usuarioId: U1, ticker: 'NVDA', gatilhoPercentual: 2, direcao: 'ambas' });
    const uc = new ProcessarAlerta({
      alertaRepository: alertas,
      notificacaoRepository: notificacoes,
      ativoRepository: new FakeAtivoRepository(),
      marketData: fakeMarketData(cotacoes),
      notificador,
      janelaMinutos: 60,
      clock: () => momento,
    });
    return { uc, notificacoes, notificador };
  }

  it('dispara só os alertas cujo gatilho foi atingido e notifica o dono', async () => {
    const s = await montar({ PETR4: { variacaoPercentual: -4.256, preco: 35 }, NVDA: { variacaoPercentual: 1 } });
    const resumo = await s.uc.execute();
    expect(resumo).toMatchObject({ tickers: 2, alertasAvaliados: 3, disparados: 1 });
    expect(s.notificacoes.itens[0]).toMatchObject({ usuarioId: U1, ticker: 'PETR4', direcao: 'baixa', variacao: -4.26 });
    expect(s.notificador.notificarUsuario).toHaveBeenCalledWith(U1, expect.objectContaining({ ticker: 'PETR4' }));
    expect(s.notificador.emitirCotacao).toHaveBeenCalledTimes(2);
  });

  it('é IDEMPOTENTE: rodar de novo na mesma janela não duplica nem renotifica', async () => {
    const s = await montar({ PETR4: { variacaoPercentual: -5 } });
    await s.uc.execute();
    const segunda = await s.uc.execute();
    expect(segunda).toMatchObject({ disparados: 0, duplicadosIgnorados: 1 });
    expect(s.notificacoes.itens).toHaveLength(1);
    expect(s.notificador.notificarUsuario).toHaveBeenCalledTimes(1);
  });

  it('NÃO dispara com dado desatualizado ou indisponível', async () => {
    const s = await montar({ PETR4: { variacaoPercentual: -9, desatualizado: true }, NVDA: { variacaoPercentual: null, indisponivel: true } });
    const resumo = await s.uc.execute();
    expect(resumo).toMatchObject({ disparados: 0, ignoradosPorDadoRuim: 2 });
    expect(s.notificador.emitirCotacao).not.toHaveBeenCalled();
  });

  it('falha no tempo real não derruba o ciclo (best-effort)', async () => {
    const s = await montar({ PETR4: { variacaoPercentual: -5 } });
    s.notificador.notificarUsuario.mockImplementation(() => { throw new Error('redis fora'); });
    s.notificador.emitirCotacao.mockImplementation(() => { throw new Error('redis fora'); });
    await expect(s.uc.execute()).resolves.toMatchObject({ disparados: 1 });
  });

  it('sem alertas ativos não consulta o mercado', async () => {
    const marketData = fakeMarketData();
    const uc = new ProcessarAlerta({ alertaRepository: new FakeAlertaRepository(), notificacaoRepository: new FakeNotificacaoRepository(), ativoRepository: new FakeAtivoRepository(), marketData, notificador: {}, janelaMinutos: 60 });
    expect((await uc.execute()).tickers).toBe(0);
    expect(marketData.obterCotacoes).not.toHaveBeenCalled();
  });
});

describe('Ativos', () => {
  const ativos = new FakeAtivoRepository();

  it('busca por termo/tipo com cotações e categorias especializadas', async () => {
    const marketData = fakeMarketData({ NVDA: { preco: 180 } });
    const buscarAtivos = new BuscarAtivos({ ativoRepository: ativos, marketData });
    const r = await buscarAtivos.execute({ termo: 'nvidia', page: 1, limit: 10 });
    expect(r.itens).toEqual([expect.objectContaining({ ativo: expect.objectContaining({ ticker: 'NVDA' }), cotacao: expect.objectContaining({ preco: 180 }) })]);

    const br = await new BuscarAcoesBrasileiras({ buscarAtivos }).execute({ page: 1, limit: 20 });
    expect(br.itens.every((i) => i.ativo.tipo === 'acao_br')).toBe(true);
    const gl = await new BuscarAcoesGlobais({ buscarAtivos }).execute({ page: 1, limit: 20 });
    expect(gl.itens.every((i) => i.ativo.tipo === 'acao_global')).toBe(true);
    expect((await buscarAtivos.execute()).meta.page).toBe(1);
  });

  it('detalhe degrada por partes: histórico falhou, o resto aparece', async () => {
    const marketData = fakeMarketData();
    marketData.obterHistorico.mockRejectedValue(new Error('api fora'));
    const logger = { warn: jest.fn() };
    const r = await new DetalharAtivo({ ativoRepository: ativos, marketData, logger }).execute({ ticker: 'petr4' });
    expect(r.ativo.ticker).toBe('PETR4');
    expect(r.cotacao).not.toBeNull();
    expect(r.historico).toBeNull();
    expect(r.indicadores).toMatchObject({ pl: 5 });
    expect(logger.warn).toHaveBeenCalled();
  });

  describe('comportamento no último ano', () => {
    /** 1 ano de pontos diários com alta suave: suficiente para o analisador. */
    const umAno = () => ({
      pontos: Array.from({ length: 366 }, (_, i) => ({ data: new Date(Date.UTC(2025, 9, 29) + i * 86_400_000).toISOString().slice(0, 10), preco: 10 * 1.001 ** i })),
      desatualizado: false,
    });
    const curto = () => ({ pontos: [{ data: '2026-10-01', preco: 10 }], desatualizado: false });
    const montar = () => {
      const marketData = fakeMarketData();
      marketData.obterHistorico.mockImplementation(async (_a, dias) => (dias === 365 ? umAno() : curto()));
      const uc = new DetalharAtivo({ ativoRepository: ativos, marketData, analisadorDeComportamento: new AnalisadorDeComportamento(), logger: { warn: jest.fn() } });
      return { marketData, uc };
    };

    it('busca 1 ano de histórico à parte do gráfico e devolve as estatísticas', async () => {
      const { marketData, uc } = montar();
      const r = await uc.execute({ ticker: 'PETR4', dias: 30 });
      expect(marketData.obterHistorico.mock.calls.map(([, dias]) => dias).sort()).toEqual([30, 365]);
      expect(r.historico.pontos).toHaveLength(1); // o gráfico continua com o período pedido
      expect(r.comportamento).toMatchObject({ mesesNoPeriodo: expect.any(Number), nivel: expect.objectContaining({ codigo: 'baixa' }) });
      expect(r.comportamento.periodo.pontos).toBe(366);
    });

    it('com o gráfico já em 1 ano, reaproveita a mesma série (uma chamada só)', async () => {
      const { marketData, uc } = montar();
      const r = await uc.execute({ ticker: 'PETR4', dias: 365 });
      expect(marketData.obterHistorico).toHaveBeenCalledTimes(1);
      expect(r.comportamento).not.toBeNull();
    });

    it('renda fixa não tem comportamento de preço (e nem pede o histórico de 1 ano)', async () => {
      const { marketData, uc } = montar();
      const r = await uc.execute({ ticker: 'CDB-LIQ-100', dias: 30 });
      expect(r.comportamento).toBeNull();
      expect(marketData.obterHistorico.mock.calls.map(([, dias]) => dias)).toEqual([30]);
    });

    it('histórico de 1 ano indisponível ou curto demais: comportamento null, o resto da página segue', async () => {
      const { marketData, uc } = montar();
      marketData.obterHistorico.mockImplementation(async (_a, dias) => {
        if (dias === 365) throw new Error('api fora');
        return curto();
      });
      const r = await uc.execute({ ticker: 'PETR4', dias: 30 });
      expect(r.comportamento).toBeNull();
      expect(r.historico).not.toBeNull();

      marketData.obterHistorico.mockImplementation(async () => curto());
      expect((await uc.execute({ ticker: 'PETR4', dias: 30 })).comportamento).toBeNull();
    });
  });

  it('detalhe de ativo inexistente → 404', async () => {
    await expect(new DetalharAtivo({ ativoRepository: ativos, marketData: fakeMarketData() }).execute({ ticker: 'NADA3' })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('Ideias', () => {
  const montar = () => {
    const ideias = new FakeIdeiaRepository();
    return {
      ideias,
      gerar: new GerarSugestoes({ ativoRepository: new FakeAtivoRepository(), unitOfWork: fakeUnitOfWork({ ideias }), motorDeSugestoes: new MotorDeSugestoes(dicionario) }),
      listar: new ListarIdeias({ ideiaRepository: ideias }),
    };
  };

  it('sanitiza o texto (XSS), persiste a ideia e as sugestões na mesma unidade', async () => {
    const s = montar();
    const ideia = await s.gerar.execute({ usuarioId: U1, texto: '<script>alert(1)</script>Quero <b>dividendos</b> e segurança' });
    expect(ideia.textoDescrito).toBe('Quero dividendos e segurança');
    expect(ideia.palavrasChave).toEqual(expect.arrayContaining(['Renda passiva', 'Baixo risco']));
    expect(ideia.sugestoes.length).toBeGreaterThan(0);
    expect(ideia.sugestoes.length).toBeLessThanOrEqual(10);
    expect((await s.listar.execute({ usuarioId: U1, page: 1, limit: 10 })).meta.total).toBe(1);
  });

  it('texto que vira vazio após sanitização é rejeitado', async () => {
    await expect(montar().gerar.execute({ usuarioId: U1, texto: '<script>x</script>' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('ideia sem conceitos reconhecidos é salva com zero sugestões', async () => {
    const ideia = await montar().gerar.execute({ usuarioId: U1, texto: 'xyzzy plugh' });
    expect(ideia.sugestoes).toEqual([]);
  });
});
