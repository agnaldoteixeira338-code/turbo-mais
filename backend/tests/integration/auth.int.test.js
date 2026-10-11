const request = require('supertest');
const { criarAppDeTeste, cookie, SENHA } = require('../helpers/app');

describe('Integração — autenticação (Postgres + Redis reais)', () => {
  let t;
  beforeAll(async () => { t = await criarAppDeTeste(); });
  afterAll(async () => t.fechar());

  it('cadastro: 201 sem vazar senha_hash; 409 para e-mail repetido (case-insensitive)', async () => {
    const email = `ana${Date.now()}@teste.com`;
    const r = await request(t.app).post('/api/v1/auth/cadastro').send({ email, celular: '(11) 98765-4321', senha: SENHA }).expect(201);
    expect(r.body.data.usuario).toMatchObject({ email, celular: '+5511987654321', twoFactorAtivo: false });
    expect(JSON.stringify(r.body)).not.toMatch(/senha|hash/i);
    const dup = await request(t.app).post('/api/v1/auth/cadastro').send({ email: email.toUpperCase(), celular: '11987654321', senha: SENHA });
    expect(dup.status).toBe(409);
  });

  it('cadastro: 422 para senha fraca e 400 para campo desconhecido', async () => {
    const fraca = await request(t.app).post('/api/v1/auth/cadastro').send({ email: 'x@teste.com', celular: '11987654321', senha: '123' });
    expect(fraca.status).toBe(422);
    const extra = await request(t.app).post('/api/v1/auth/cadastro').send({ email: 'x@teste.com', celular: '11987654321', senha: SENHA, admin: true });
    expect(extra.status).toBe(400);
  });

  it('login define refresh httpOnly (path restrito) + cookie CSRF e devolve access token', async () => {
    const { email } = await t.novoUsuario();
    const r = await request(t.app).post('/api/v1/auth/login').send({ email, senha: SENHA }).expect(200);
    const setCookie = r.headers['set-cookie'].join('\n');
    expect(setCookie).toMatch(/refresh_token=.*HttpOnly/);
    expect(setCookie).toMatch(/refresh_token=.*Path=\/api\/v1\/auth/);
    expect(setCookie).toMatch(/SameSite=Strict/);
    expect(cookie(r, 'csrf_token')).toBeDefined();
    const me = await request(t.app).get('/api/v1/auth/me').set('authorization', `Bearer ${r.body.data.accessToken}`).expect(200);
    expect(me.body.data.usuario.email).toBe(email);
  });

  it('refresh exige CSRF, rotaciona o cookie e detecta REUSO do token antigo', async () => {
    const { agente, csrf, refresh: antigo } = await t.novoUsuario();
    expect((await agente.post('/api/v1/auth/refresh')).status).toBe(403);
    expect((await agente.post('/api/v1/auth/refresh').set('x-csrf-token', 'errado')).status).toBe(403);

    const r1 = await agente.post('/api/v1/auth/refresh').set('x-csrf-token', csrf).expect(200);
    expect(cookie(r1, 'refresh_token')).not.toBe(antigo);

    // atacante reapresenta o refresh antigo (copiado antes da rotação) → família revogada
    const reuso = await request(t.app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${encodeURIComponent(antigo)}; csrf_token=${csrf}`)
      .set('x-csrf-token', csrf);
    expect(reuso.status).toBe(401);
    expect(reuso.body.error.code).toBe('SESSAO_REVOGADA');

    const novoCsrf = cookie(r1, 'csrf_token');
    const legitimo = await agente.post('/api/v1/auth/refresh').set('x-csrf-token', novoCsrf);
    expect(legitimo.status).toBe(401);
  });

  it('bloqueia a conta após 5 falhas (429 + Retry-After) e audita', async () => {
    const { email } = await t.novoUsuario();
    for (let i = 0; i < 4; i += 1) {
      await request(t.app).post('/api/v1/auth/login').send({ email, senha: 'Errada@123' }).expect(401);
    }
    const quinta = await request(t.app).post('/api/v1/auth/login').send({ email, senha: 'Errada@123' });
    expect(quinta.status).toBe(429);
    expect(Number(quinta.headers['retry-after'])).toBeGreaterThan(0);
    const certa = await request(t.app).post('/api/v1/auth/login').send({ email, senha: SENHA });
    expect(certa.status).toBe(429);

    const { rows } = await t.container.pool.query(
      `SELECT acao FROM audit_log a JOIN usuarios u ON u.id = a.usuario_id WHERE lower(u.email) = $1 AND acao = 'LOGIN_FALHOU'`,
      [email],
    );
    expect(rows.length).toBe(5);
  });

  it('esqueci-senha → resetar-senha: token de uso único e sessões revogadas', async () => {
    const { email } = await t.novoUsuario();
    const pedido = await request(t.app).post('/api/v1/auth/esqueci-senha').send({ email }).expect(202);
    const inexistente = await request(t.app).post('/api/v1/auth/esqueci-senha').send({ email: 'ninguem@teste.com' }).expect(202);
    expect(inexistente.body).toEqual(pedido.body); // anti-enumeração

    const token = decodeURIComponent(t.ultimoEmail('reset-senha').dados.link.split('#token=')[1]);
    await request(t.app).post('/api/v1/auth/resetar-senha').send({ token, novaSenha: 'Nova@Senha456' }).expect(200);
    expect((await request(t.app).post('/api/v1/auth/resetar-senha').send({ token, novaSenha: 'Outra@Senha789' })).status).toBe(401);

    await request(t.app).post('/api/v1/auth/login').send({ email, senha: 'Nova@Senha456' }).expect(200);
    const { rows } = await t.container.pool.query(
      `SELECT bool_and(revogado) AS todos FROM refresh_tokens r JOIN usuarios u ON u.id = r.usuario_id
        WHERE lower(u.email) = $1 AND r.criado_em < (SELECT max(criado_em) FROM refresh_tokens WHERE usuario_id = u.id)`,
      [email],
    );
    expect(rows[0].todos).toBe(true);
  });

  it('2FA: ativa por código e passa a exigir o segundo fator no login', async () => {
    const { email, token } = await t.novoUsuario();
    const auth = { authorization: `Bearer ${token}` };
    await request(t.app).post('/api/v1/auth/2fa/ativar').set(auth).send({}).expect(202);
    const codigoAtivacao = t.ultimoEmail('2fa').dados.codigo;
    await request(t.app).post('/api/v1/auth/2fa/ativar').set(auth).send({ codigo: codigoAtivacao }).expect(200);

    const login = await request(t.app).post('/api/v1/auth/login').send({ email, senha: SENHA }).expect(200);
    expect(login.body.data).toEqual({ requer2FA: true, desafioToken: expect.any(String) });
    expect(login.headers['set-cookie']).toBeUndefined(); // nenhuma sessão antes do 2º fator

    const codigo = t.ultimoEmail('2fa').dados.codigo;
    const validado = await request(t.app).post('/api/v1/auth/2fa/validar').send({ desafioToken: login.body.data.desafioToken, codigo }).expect(200);
    expect(validado.body.data.accessToken).toEqual(expect.any(String));
  });

  it('logout revoga a sessão (refresh posterior falha)', async () => {
    const { agente, csrf } = await t.novoUsuario();
    await agente.post('/api/v1/auth/logout').set('x-csrf-token', csrf).expect(204);
    expect((await agente.post('/api/v1/auth/refresh').set('x-csrf-token', csrf)).status).toBe(401);
  });
});
