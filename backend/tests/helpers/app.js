/**
 * Sobe o app REAL (Postgres + Redis de teste) para integração/e2e.
 * Só a fila de e-mail é trocada por uma captura em memória — assim o teste
 * consegue "ler o e-mail" (link de reset, código 2FA) sem provedor externo.
 */
const request = require('supertest');
const { carregarEnv } = require('../../src/config/env');
const { criarContainer } = require('../../src/config/container');
const { criarApp } = require('../../src/interfaces/http/app');
const { criarLogger } = require('../../src/infrastructure/logger/pinoLogger');

const SENHA = 'Senha@Forte123';

async function criarAppDeTeste(overridesEnv = {}) {
  const env = carregarEnv({ ...process.env, ...overridesEnv });
  const emails = [];
  const container = criarContainer({
    env,
    logger: criarLogger({ level: 'silent' }),
    overrides: { emailQueue: { enfileirar: async (job) => emails.push(job) } },
  });
  await container.redis.flushdb();
  const app = criarApp(container);

  let contador = 0;
  /** Cadastra + loga um usuário novo; devolve o agente (com cookies) e o token. */
  async function novoUsuario() {
    contador += 1;
    const email = `user${Date.now()}${contador}@teste.com`;
    const agente = request.agent(app);
    await agente.post('/api/v1/auth/cadastro').send({ email, celular: '11987654321', senha: SENHA }).expect(201);
    const login = await agente.post('/api/v1/auth/login').send({ email, senha: SENHA }).expect(200);
    return {
      email,
      agente,
      token: login.body.data.accessToken,
      usuario: login.body.data.usuario,
      csrf: cookie(login, 'csrf_token'),
      refresh: cookie(login, 'refresh_token'),
    };
  }

  const ultimoEmail = (tipo) => [...emails].reverse().find((e) => e.tipo === tipo);
  const fechar = () => container.encerrar();
  return { app, container, emails, ultimoEmail, novoUsuario, fechar };
}

/** Lê o valor de um cookie a partir dos headers Set-Cookie. */
function cookie(resposta, nome) {
  const linha = (resposta.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${nome}=`));
  return linha ? decodeURIComponent(linha.split(';')[0].split('=')[1]) : undefined;
}

module.exports = { criarAppDeTeste, cookie, SENHA };
