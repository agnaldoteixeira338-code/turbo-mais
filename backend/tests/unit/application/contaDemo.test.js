const { RestaurarContaDemo, ESTADO_DEMO } = require('../../../src/application/use-cases/demo/RestaurarContaDemo');
const { MotorDeSugestoes } = require('../../../src/domain/services/MotorDeSugestoes');
const dicionario = require('../../../src/domain/services/dicionarioSinonimos.json');
const {
  FakeUsuarioRepository, FakeFavoritoRepository, FakeAlertaRepository, FakeNotificacaoRepository,
  FakeIdeiaRepository, FakeAtivoRepository, fakeAuditLog, fakeUnitOfWork,
} = require('../../helpers/fakes');

const EMAIL_DEMO = 'demo@exemplo.com';

async function montar({ emailDemo = EMAIL_DEMO, criarDemo = true } = {}) {
  const repos = {
    usuarios: new FakeUsuarioRepository(),
    favoritos: new FakeFavoritoRepository(),
    alertas: new FakeAlertaRepository(),
    notificacoes: new FakeNotificacaoRepository(),
    ideias: new FakeIdeiaRepository(),
  };
  const auditLog = fakeAuditLog();
  const logger = { info: jest.fn(), warn: jest.fn() };
  const unitOfWork = fakeUnitOfWork(repos);
  const demo = criarDemo ? await repos.usuarios.criar({ email: EMAIL_DEMO, celular: '+5511999990000', senhaHash: 'x' }) : null;
  const outro = await repos.usuarios.criar({ email: 'ana@exemplo.com', celular: '+5511988887777', senhaHash: 'y' });
  const restaurar = new RestaurarContaDemo({
    usuarioRepository: repos.usuarios,
    ativoRepository: new FakeAtivoRepository(),
    unitOfWork,
    motorDeSugestoes: new MotorDeSugestoes(dicionario),
    auditLog,
    logger,
    emailDemo,
  });
  return { repos, auditLog, logger, unitOfWork, demo, outro, restaurar };
}

/** "Bagunça" que um visitante deixaria na conta. */
async function sujar(repos, usuarioId) {
  await repos.favoritos.adicionar({ usuarioId, ticker: 'AAPL', tipo: 'acao_global' });
  await repos.alertas.criar({ usuarioId, ticker: 'ITUB4', gatilhoPercentual: 9, direcao: 'baixa' });
  await repos.notificacoes.criarSeNaoExistir({ usuarioId, ticker: 'ITUB4', variacao: -9.5, direcao: 'baixa', preco: 30, hashIdempotencia: `h-${usuarioId}` });
  await repos.ideias.criar({ usuarioId, textoDescrito: 'texto qualquer de um visitante', palavrasChave: [] });
}

/** Retrato comparável do estado da conta (sem ids nem datas). */
function retrato(repos, usuarioId) {
  const doUsuario = (itens) => itens.filter((i) => i.usuarioId === usuarioId);
  return {
    favoritos: doUsuario(repos.favoritos.itens).map((f) => `${f.ticker}:${f.tipo}`).sort(),
    alertas: doUsuario(repos.alertas.itens).map((a) => `${a.ticker}:${a.gatilhoPercentual}:${a.direcao}:${a.ativo}`).sort(),
    notificacoes: doUsuario(repos.notificacoes.itens).length,
    ideias: doUsuario(repos.ideias.itens).map((i) => ({ texto: i.textoDescrito, palavrasChave: i.palavrasChave, sugestoes: (i.sugestoes ?? []).map((s) => s.ticker) })),
  };
}

describe('RestaurarContaDemo', () => {
  it('apaga o que o visitante criou e recria o estado de exemplo numa única transação', async () => {
    const { repos, demo, restaurar, unitOfWork, auditLog } = await montar();
    await sujar(repos, demo.id);
    demo.twoFactorAtivo = true;

    const r = await restaurar.execute();

    expect(unitOfWork.run).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ restaurada: true, removidos: { favoritos: 1, alertas: 1, notificacoes: 1, ideias: 1 } });
    const estado = retrato(repos, demo.id);
    expect(estado.favoritos).toEqual(['BTC:cripto', 'CDB-LIQ-100:cdb', 'NVDA:acao_global', 'PETR4:acao_br', 'WEGE3:acao_br']);
    expect(estado.alertas).toEqual(['BTC:3:ambas:true', 'PETR4:2:ambas:true']);
    expect(estado.notificacoes).toBe(0);
    expect(estado.ideias).toHaveLength(1);
    expect(estado.ideias[0].texto).toBe(ESTADO_DEMO.ideia);
    // sugestões geradas pelo motor real: a ideia pede baixo risco, então o CDB aparece
    expect(estado.ideias[0].sugestoes.length).toBeGreaterThan(0);
    expect(estado.ideias[0].sugestoes).toContain('CDB-LIQ-100');
    expect(demo.twoFactorAtivo).toBe(false);
    expect(auditLog.entradas).toEqual([expect.objectContaining({ acao: 'CONTA_DEMO_RESTAURADA', usuarioId: demo.id })]);
  });

  it('é idempotente: rodar duas vezes seguidas dá o mesmo resultado', async () => {
    const { repos, demo, restaurar } = await montar();
    await sujar(repos, demo.id);
    await restaurar.execute();
    const primeira = retrato(repos, demo.id);

    const segunda = await restaurar.execute();

    expect(retrato(repos, demo.id)).toEqual(primeira);
    // na 2ª vez só apaga o próprio estado de exemplo
    expect(segunda.removidos).toEqual({ favoritos: 5, alertas: 2, notificacoes: 0, ideias: 1 });
  });

  it('não mexe nos dados de nenhum outro usuário', async () => {
    const { repos, demo, outro, restaurar } = await montar();
    await sujar(repos, demo.id);
    await sujar(repos, outro.id);
    outro.twoFactorAtivo = true;
    const antes = retrato(repos, outro.id);

    await restaurar.execute();

    expect(retrato(repos, outro.id)).toEqual(antes);
    expect(outro.twoFactorAtivo).toBe(true);
  });

  it('com DEMO_USER_EMAIL vazio, não faz nada e só registra um log', async () => {
    const { repos, restaurar, unitOfWork, auditLog, logger, outro } = await montar({ emailDemo: null });
    await sujar(repos, outro.id);
    await expect(restaurar.execute()).resolves.toEqual({ restaurada: false, motivo: 'desligado' });
    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(auditLog.entradas).toHaveLength(0);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('DEMO_USER_EMAIL'));
  });

  it('se a conta demo não existir, não faz nada e só registra um log', async () => {
    const { restaurar, unitOfWork, logger } = await montar({ criarDemo: false });
    await expect(restaurar.execute()).resolves.toEqual({ restaurada: false, motivo: 'conta_inexistente' });
    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('não existe'));
  });

  it('se a transação falhar, o erro sobe (o job falha e o próximo ciclo tenta de novo) e não audita', async () => {
    const { restaurar, unitOfWork, auditLog } = await montar();
    unitOfWork.run.mockRejectedValueOnce(new Error('conexão perdida'));
    await expect(restaurar.execute()).rejects.toThrow('conexão perdida');
    expect(auditLog.entradas).toHaveLength(0);
  });
});
