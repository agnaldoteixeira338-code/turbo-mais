const request = require('supertest');
const { criarAppDeTeste, cookie } = require('../helpers/app');

/**
 * Jornada completa de um usuário real, ponta a ponta, pela API HTTP:
 *   cadastro → login → buscar → favoritar → criar alerta → (priceWatcher)
 *   → notificação → gerar ideia → refresh de sessão → logout
 * Usa Postgres e Redis reais e o provedor de mercado simulado (determinístico).
 */
describe('E2E — jornada do investidor no Turbo Mais', () => {
  let t;
  beforeAll(async () => { t = await criarAppDeTeste(); });
  afterAll(async () => t.fechar());

  it('percorre o fluxo principal sem nenhum passo de compra/venda', async () => {
    const agente = request.agent(t.app);
    const email = `jornada${Date.now()}@teste.com`;

    // 1. cadastro (sem nome, sem CPF)
    await agente.post('/api/v1/auth/cadastro').send({ email, celular: '21998765432', senha: 'Jornada@2026' }).expect(201);

    // 2. login
    const login = await agente.post('/api/v1/auth/login').send({ email, senha: 'Jornada@2026' }).expect(200);
    const auth = { authorization: `Bearer ${login.body.data.accessToken}` };
    let csrf = cookie(login, 'csrf_token');

    // 3. buscar investimento (aba Cripto) e abrir detalhe educativo
    const cripto = await agente.get('/api/v1/ativos/criptomoedas').set(auth).expect(200);
    expect(cripto.body.data.map((a) => a.ticker)).toEqual(expect.arrayContaining(['BTC', 'ETH', 'SOL']));
    const detalhe = await agente.get('/api/v1/ativos/ETH').set(auth).expect(200);
    expect(detalhe.body.data.papelSociedade).toEqual(expect.any(String));

    // 4. favoritar
    await agente.post('/api/v1/favoritos').set(auth).send({ ticker: 'ETH' }).expect(201);

    // 5. criar alerta (gatilho mínimo para garantir disparo no modo simulado)
    await agente.post('/api/v1/alertas').set(auth).send({ ticker: 'ETH', gatilhoPercentual: 0.01, direcao: 'ambas' }).expect(201);

    // 6. ciclo do priceWatcher (o worker faz isso a cada 60s)
    await t.container.useCases.processarAlerta.execute();
    const notificacoes = await agente.get('/api/v1/notificacoes').set(auth).expect(200);
    expect(notificacoes.body.data.some((n) => n.ticker === 'ETH')).toBe(true);

    // 7. gerar ideia
    const ideia = await agente.post('/api/v1/ideias').set(auth).send({ texto: 'Quero algo seguro para minha reserva de emergência' }).expect(201);
    expect(ideia.body.data.sugestoes[0].tipo).toBe('cdb');
    expect(JSON.stringify(ideia.body)).not.toMatch(/comprar|compra/i);

    // 8. Minha Carteira = favoritos agrupados por tipo
    const carteira = await agente.get('/api/v1/favoritos?tipo=cripto').set(auth).expect(200);
    expect(carteira.body.data[0].ativo.ticker).toBe('ETH');

    // 9. sessão renovada silenciosamente (como o front faz ao recarregar a página)
    const refresh = await agente.post('/api/v1/auth/refresh').set('x-csrf-token', csrf).expect(200);
    csrf = cookie(refresh, 'csrf_token');
    expect(refresh.body.data.usuario.email).toBe(email);

    // 10. logout
    await agente.post('/api/v1/auth/logout').set('x-csrf-token', csrf).expect(204);
    await agente.post('/api/v1/auth/refresh').set('x-csrf-token', csrf).expect(401);
  });
});
