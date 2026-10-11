const request = require('supertest');
const { criarAppDeTeste } = require('../helpers/app');

describe('Integração — favoritos, alertas, notificações, ativos, ideias', () => {
  let t;
  let ana;
  let bruno;
  const comToken = (u) => ({ authorization: `Bearer ${u.token}` });

  beforeAll(async () => {
    t = await criarAppDeTeste();
    ana = await t.novoUsuario();
    bruno = await t.novoUsuario();
  });
  afterAll(async () => t.fechar());

  describe('ativos', () => {
    it('lista por categoria com cotação (modo simulado) e envelope padronizado', async () => {
      const r = await request(t.app).get('/api/v1/ativos/acoes-brasileiras?limit=3').set(comToken(ana)).expect(200);
      expect(r.body).toMatchObject({ success: true, error: null, meta: { page: 1, limit: 3 } });
      expect(r.body.data).toHaveLength(3);
      expect(r.body.data.every((a) => a.tipo === 'acao_br' && a.cotacao.preco > 0)).toBe(true);
      const bancos = await request(t.app).get('/api/v1/ativos/bancos').set(comToken(ana)).expect(200);
      expect(bancos.body.data.map((a) => a.ticker)).toEqual(expect.arrayContaining(['ITUB4', 'BBAS3', 'BBDC4']));
    });

    it('busca por termo não sofre injeção via curingas do LIKE', async () => {
      const r = await request(t.app).get('/api/v1/ativos?q=%25').set(comToken(ana)).expect(200);
      expect(r.body.data).toHaveLength(0);
      const petro = await request(t.app).get('/api/v1/ativos?q=petro').set(comToken(ana)).expect(200);
      expect(petro.body.data[0].ticker).toBe('PETR4');
    });

    it('detalhe educativo com histórico e indicadores; 404 para ticker desconhecido', async () => {
      const r = await request(t.app).get('/api/v1/ativos/WEGE3?dias=15').set(comToken(ana)).expect(200);
      expect(r.body.data).toMatchObject({ ticker: 'WEGE3', setor: 'Bens Industriais', pais: 'Brasil', fundacao: 1961 });
      expect(r.body.data.oQueFaz).toMatch(/motores/);
      expect(r.body.data.historico.pontos).toHaveLength(15);
      await request(t.app).get('/api/v1/ativos/NADA3').set(comToken(ana)).expect(404);
    });

    it('rotas protegidas exigem token', async () => {
      await request(t.app).get('/api/v1/ativos').expect(401);
    });
  });

  describe('favoritos', () => {
    it('POST idempotente (201 → 200), lista enriquecida e DELETE idempotente', async () => {
      await request(t.app).post('/api/v1/favoritos').set(comToken(ana)).send({ ticker: 'petr4' }).expect(201);
      await request(t.app).post('/api/v1/favoritos').set(comToken(ana)).send({ ticker: 'PETR4' }).expect(200);
      const lista = await request(t.app).get('/api/v1/favoritos').set(comToken(ana)).expect(200);
      expect(lista.body.data).toHaveLength(1);
      expect(lista.body.data[0].ativo.cotacao.preco).toBeGreaterThan(0);
      await request(t.app).delete('/api/v1/favoritos/PETR4').set(comToken(ana)).expect(204);
      await request(t.app).delete('/api/v1/favoritos/PETR4').set(comToken(ana)).expect(204);
    });

    it('Idempotency-Key devolve a mesma resposta no retry', async () => {
      const chave = `idem-${Date.now()}`;
      const r1 = await request(t.app).post('/api/v1/favoritos').set(comToken(ana)).set('Idempotency-Key', chave).send({ ticker: 'VALE3' });
      const r2 = await request(t.app).post('/api/v1/favoritos').set(comToken(ana)).set('Idempotency-Key', chave).send({ ticker: 'VALE3' });
      expect(r1.status).toBe(201);
      expect(r2.status).toBe(201);
      expect(r2.headers['idempotent-replayed']).toBe('true');
    });

    it('favoritos são isolados por usuário', async () => {
      const r = await request(t.app).get('/api/v1/favoritos').set(comToken(bruno)).expect(200);
      expect(r.body.data).toHaveLength(0);
    });
  });

  describe('alertas', () => {
    let alertaId;

    it('CRUD completo com validação', async () => {
      const criado = await request(t.app).post('/api/v1/alertas').set(comToken(ana)).send({ ticker: 'NVDA', gatilhoPercentual: 2.5, direcao: 'ambas' }).expect(201);
      alertaId = criado.body.data.id;
      await request(t.app).post('/api/v1/alertas').set(comToken(ana)).send({ ticker: 'NVDA', gatilhoPercentual: 2.5, direcao: 'ambas' }).expect(409);
      await request(t.app).post('/api/v1/alertas').set(comToken(ana)).send({ ticker: 'CDB-LIQ-100', gatilhoPercentual: 1, direcao: 'alta' }).expect(422);
      await request(t.app).post('/api/v1/alertas').set(comToken(ana)).send({ ticker: 'NVDA', gatilhoPercentual: 500, direcao: 'alta' }).expect(400);

      const atualizado = await request(t.app).put(`/api/v1/alertas/${alertaId}`).set(comToken(ana)).send({ gatilhoPercentual: 4 }).expect(200);
      expect(atualizado.body.data).toMatchObject({ gatilhoPercentual: 4, direcao: 'ambas' });
      const lista = await request(t.app).get('/api/v1/alertas').set(comToken(ana)).expect(200);
      expect(lista.body.meta.total).toBe(1);
    });

    it('IDOR: outro usuário recebe 404 (não 403) ao mexer no alerta alheio', async () => {
      await request(t.app).put(`/api/v1/alertas/${alertaId}`).set(comToken(bruno)).send({ ativo: false }).expect(404);
      await request(t.app).delete(`/api/v1/alertas/${alertaId}`).set(comToken(bruno)).expect(404);
      await request(t.app).put('/api/v1/alertas/nao-e-uuid').set(comToken(bruno)).send({ ativo: false }).expect(400);
    });

    it('priceWatcher gera notificação UMA vez por janela (UNIQUE no banco)', async () => {
      await request(t.app).post('/api/v1/alertas').set(comToken(ana)).send({ ticker: 'BTC', gatilhoPercentual: 0.01, direcao: 'ambas' }).expect(201);
      const { processarAlerta } = t.container.useCases;
      const primeiro = await processarAlerta.execute();
      const segundo = await processarAlerta.execute();
      expect(primeiro.disparados).toBeGreaterThanOrEqual(1);
      expect(segundo.disparados).toBe(0);
      expect(segundo.duplicadosIgnorados).toBe(primeiro.disparados);

      const notifs = await request(t.app).get('/api/v1/notificacoes?naoLidas=true').set(comToken(ana)).expect(200);
      const btc = notifs.body.data.find((n) => n.ticker === 'BTC');
      expect(btc).toBeDefined();
      expect(notifs.body.meta.naoLidas).toBeGreaterThanOrEqual(1);

      await request(t.app).patch(`/api/v1/notificacoes/${btc.id}/lida`).set(comToken(bruno)).expect(404);
      const lida = await request(t.app).patch(`/api/v1/notificacoes/${btc.id}/lida`).set(comToken(ana)).expect(200);
      expect(lida.body.data.lida).toBe(true);
    });

    it('DELETE remove o alerta', async () => {
      await request(t.app).delete(`/api/v1/alertas/${alertaId}`).set(comToken(ana)).expect(204);
      await request(t.app).delete(`/api/v1/alertas/${alertaId}`).set(comToken(ana)).expect(404);
    });
  });

  describe('ideias', () => {
    it('gera sugestões ranqueadas, sanitiza o texto e persiste o histórico', async () => {
      const r = await request(t.app)
        .post('/api/v1/ideias')
        .set(comToken(ana))
        .send({ texto: '<img src=x onerror=alert(1)>Quero investir em tecnologia e inteligência artificial no exterior' })
        .expect(201);
      expect(r.body.data.texto).not.toMatch(/<|onerror/);
      expect(r.body.data.sugestoes.length).toBeGreaterThan(0);
      expect(r.body.data.sugestoes[0]).toMatchObject({ posicao: 1, justificativa: expect.stringMatching(/^Combina com você/) });
      expect(['NVDA', 'MSFT', 'GOOGL', 'AAPL']).toContain(r.body.data.sugestoes[0].ticker);

      const historico = await request(t.app).get('/api/v1/ideias').set(comToken(ana)).expect(200);
      expect(historico.body.data[0].sugestoes.length).toBe(r.body.data.sugestoes.length);
    });
  });
});

describe('Integração — observabilidade', () => {
  let t;
  beforeAll(async () => { t = await criarAppDeTeste(); });
  afterAll(async () => t.fechar());

  it('/live, /ready e /health reportam dependências reais', async () => {
    await request(t.app).get('/live').expect(200);
    const ready = await request(t.app).get('/ready').expect(200);
    expect(ready.body.status).toBe('pronto');
    const health = await request(t.app).get('/health').expect(200);
    expect(health.body.dependencias.postgres.status).toBe('ok');
    expect(health.body.dependencias.redis.status).toBe('ok');
    expect(health.body.dependencias.filas.detalhes).toHaveProperty('email');
  });

  it('/ready responde 503 durante o shutdown (LB tira a réplica do pool)', async () => {
    t.container.estado.encerrando = true;
    await request(t.app).get('/ready').expect(503);
    t.container.estado.encerrando = false;
  });

  it('/metrics expõe métricas HTTP, de fila e de circuit breaker', async () => {
    await request(t.app).get('/live');
    const r = await request(t.app).get('/metrics').expect(200);
    expect(r.text).toContain('turbo_mais_http_request_duration_seconds');
    expect(r.text).toContain('turbo_mais_queue_jobs');
    expect(r.text).toContain('turbo_mais_circuit_breaker_state');
  });

  it('/metrics exige token quando METRICS_TOKEN está definido', async () => {
    const protegido = await criarAppDeTeste({ METRICS_TOKEN: 'segredo-das-metricas' });
    await request(protegido.app).get('/metrics').expect(401);
    await request(protegido.app).get('/metrics').set('authorization', 'Bearer segredo-das-metricas').expect(200);
    await protegido.fechar();
  });

  it('CORS só libera origens da whitelist', async () => {
    const ok = await request(t.app).get('/live').set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const bloqueado = await request(t.app).get('/live').set('Origin', 'https://site-malicioso.com');
    expect(bloqueado.headers['access-control-allow-origin']).toBeUndefined();
  });
});
