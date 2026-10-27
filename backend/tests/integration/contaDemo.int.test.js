const request = require('supertest');
const { criarAppDeTeste } = require('../helpers/app');
const { ESTADO_DEMO } = require('../../src/application/use-cases/demo/RestaurarContaDemo');

/**
 * Restauração da conta demo contra o Postgres REAL: transação, idempotência,
 * isolamento entre usuários e as proteções de 2FA / esqueci-senha.
 * A "conta demo" é um usuário criado no teste; apontamos os casos de uso para
 * ele (sem subir outro container).
 */
describe('Integração — conta demo (Postgres + Redis reais)', () => {
  let t;
  let demo;
  let outro;
  const casosDeUso = ['restaurarContaDemo', 'ativar2FA', 'esqueciSenha'];
  const originais = {};

  beforeAll(async () => {
    t = await criarAppDeTeste();
    demo = await t.novoUsuario();
    outro = await t.novoUsuario();
    for (const nome of casosDeUso) {
      originais[nome] = t.container.useCases[nome].emailDemo;
      t.container.useCases[nome].emailDemo = demo.email;
    }
  });
  afterAll(async () => {
    for (const nome of casosDeUso) t.container.useCases[nome].emailDemo = originais[nome];
    await t.fechar();
  });

  const sql = (texto, params) => t.container.pool.query(texto, params).then((r) => r.rows);

  /** Bagunça que um visitante deixaria (direto no banco). */
  async function sujar(usuarioId) {
    await sql(`INSERT INTO favoritos (usuario_id, ticker, tipo) VALUES ($1, 'AAPL', 'acao_global') ON CONFLICT DO NOTHING`, [usuarioId]);
    await sql(`INSERT INTO alertas (usuario_id, ticker, gatilho_percentual, direcao) VALUES ($1, 'ITUB4', 9, 'baixa') ON CONFLICT DO NOTHING`, [usuarioId]);
    await sql(
      `INSERT INTO notificacoes (usuario_id, ticker, variacao, direcao, preco, hash_idempotencia)
       VALUES ($1, 'ITUB4', -9.5, 'baixa', 30, $2) ON CONFLICT DO NOTHING`,
      [usuarioId, `teste-${usuarioId}-${Date.now()}`],
    );
    const [ideia] = await sql(`INSERT INTO ideias (usuario_id, texto_descrito, palavras_chave) VALUES ($1, 'texto <b>qualquer</b> de um visitante', '{}') RETURNING id`, [usuarioId]);
    await sql(`INSERT INTO sugestoes (ideia_id, ticker, score, posicao, justificativa) VALUES ($1, 'AAPL', 1, 1, 'x')`, [ideia.id]);
  }

  /** Estado comparável da conta (sem ids nem datas). */
  async function retrato(usuarioId) {
    const favoritos = (await sql('SELECT ticker, tipo FROM favoritos WHERE usuario_id = $1 ORDER BY ticker', [usuarioId])).map((f) => `${f.ticker}:${f.tipo}`);
    const alertas = (await sql('SELECT ticker, gatilho_percentual, direcao, ativo FROM alertas WHERE usuario_id = $1 ORDER BY ticker', [usuarioId])).map(
      (a) => `${a.ticker}:${Number(a.gatilho_percentual)}:${a.direcao}:${a.ativo}`,
    );
    const [{ n: notificacoes }] = await sql('SELECT COUNT(*)::int AS n FROM notificacoes WHERE usuario_id = $1', [usuarioId]);
    const ideias = await sql(
      `SELECT i.texto_descrito, i.palavras_chave,
              COALESCE((SELECT array_agg(s.ticker ORDER BY s.posicao) FROM sugestoes s WHERE s.ideia_id = i.id), '{}') AS sugestoes
         FROM ideias i WHERE i.usuario_id = $1 ORDER BY i.criado_em`,
      [usuarioId],
    );
    const [{ two_factor_ativo: doisFatores }] = await sql('SELECT two_factor_ativo FROM usuarios WHERE id = $1', [usuarioId]);
    return { favoritos, alertas, notificacoes, ideias, doisFatores };
  }

  const auditoriasDe = async (usuarioId) => (await sql('SELECT COUNT(*)::int AS n FROM audit_log WHERE usuario_id = $1', [usuarioId]))[0].n;

  it('restaura o estado de exemplo, desliga o 2FA e mantém o audit_log', async () => {
    await sujar(demo.usuario.id);
    await sql('UPDATE usuarios SET two_factor_ativo = TRUE WHERE id = $1', [demo.usuario.id]);
    const auditoriasAntes = await auditoriasDe(demo.usuario.id);

    const r = await t.container.useCases.restaurarContaDemo.execute();

    expect(r.restaurada).toBe(true);
    const estado = await retrato(demo.usuario.id);
    expect(estado.favoritos).toEqual(['BTC:cripto', 'CDB-LIQ-100:cdb', 'NVDA:acao_global', 'PETR4:acao_br', 'WEGE3:acao_br']);
    expect(estado.alertas).toEqual(['BTC:3:ambas:true', 'PETR4:2:ambas:true']);
    expect(estado.notificacoes).toBe(0);
    expect(estado.ideias).toHaveLength(1);
    expect(estado.ideias[0].texto_descrito).toBe(ESTADO_DEMO.ideia);
    expect(estado.ideias[0].sugestoes.length).toBeGreaterThan(0);
    expect(estado.doisFatores).toBe(false);
    // sugestões da ideia antiga foram junto (ON DELETE CASCADE): nenhuma órfã
    expect(await sql('SELECT 1 FROM sugestoes s LEFT JOIN ideias i ON i.id = s.ideia_id WHERE i.id IS NULL')).toHaveLength(0);
    // audit_log nunca é apagado, só cresce (+1 CONTA_DEMO_RESTAURADA)
    expect(await auditoriasDe(demo.usuario.id)).toBe(auditoriasAntes + 1);
  });

  it('é idempotente: duas execuções seguidas deixam o mesmo estado', async () => {
    await t.container.useCases.restaurarContaDemo.execute();
    const primeira = await retrato(demo.usuario.id);
    await t.container.useCases.restaurarContaDemo.execute();
    expect(await retrato(demo.usuario.id)).toEqual(primeira);
  });

  it('não mexe em nenhum outro usuário', async () => {
    await sujar(outro.usuario.id);
    await sql('UPDATE usuarios SET two_factor_ativo = TRUE WHERE id = $1', [outro.usuario.id]);
    const antes = await retrato(outro.usuario.id);

    await t.container.useCases.restaurarContaDemo.execute();

    expect(await retrato(outro.usuario.id)).toEqual(antes);
    await sql('UPDATE usuarios SET two_factor_ativo = FALSE WHERE id = $1', [outro.usuario.id]);
  });

  it('é atômica: se algo falhar no meio, nada muda (ROLLBACK)', async () => {
    await sujar(demo.usuario.id);
    const antes = await retrato(demo.usuario.id);
    const uc = t.container.useCases.restaurarContaDemo;
    const uowReal = uc.unitOfWork;
    // executa todas as escritas e falha no último instante, ainda dentro da transação
    uc.unitOfWork = {
      run: (fn) =>
        uowReal.run(async (repos) => {
          await fn(repos);
          throw new Error('falha simulada no fim da transação');
        }),
    };
    try {
      await expect(uc.execute()).rejects.toThrow('falha simulada');
    } finally {
      uc.unitOfWork = uowReal;
    }
    expect(await retrato(demo.usuario.id)).toEqual(antes);
  });

  it('Ativar 2FA na conta demo responde 403 CONTA_DEMO_PROTEGIDA e não enfileira e-mail', async () => {
    const enviadosAntes = t.emails.length;
    const r = await request(t.app).post('/api/v1/auth/2fa/ativar').set('authorization', `Bearer ${demo.token}`).send({});
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('CONTA_DEMO_PROTEGIDA');
    expect(t.emails.length).toBe(enviadosAntes);
  });

  it('Esqueci a senha da conta demo responde 202 igual às outras, sem enfileirar e-mail', async () => {
    const enviadosAntes = t.emails.length;
    const paraDemo = await request(t.app).post('/api/v1/auth/esqueci-senha').send({ email: demo.email });
    const paraInexistente = await request(t.app).post('/api/v1/auth/esqueci-senha').send({ email: `ninguem${Date.now()}@teste.com` });
    expect(paraDemo.status).toBe(202);
    expect(paraDemo.body).toEqual(paraInexistente.body);
    expect(t.emails.length).toBe(enviadosAntes);
    // e para uma conta comum continua enviando
    await request(t.app).post('/api/v1/auth/esqueci-senha').send({ email: outro.email }).expect(202);
    expect(t.ultimoEmail('reset-senha')).toMatchObject({ para: outro.email });
  });
});
