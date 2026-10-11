/**
 * Teste de CARGA (k6) — 1000 usuários virtuais simultâneos.
 *
 *   k6 run tests/load/load-test.js
 *   k6 run -e BASE_URL=https://api.turbomais.dev tests/load/load-test.js
 *
 * Pré-requisitos do ambiente sob teste (ver README §Testes de carga):
 *   - MARKET_DATA_MODE=mock  → não queimar cota de APIs reais
 *   - RATE_LIMIT_ENABLED=false → senão o limite por IP do próprio gerador
 *     de carga é que seria medido (todos os VUs saem do mesmo IP)
 *   - usuário demo semeado (SEED_DEMO_USER=true)
 *
 * Cenário que imita o uso real: a maioria LÊ (lista, detalhe, favoritos);
 * uma fração ESCREVE (favoritar, gerar ideia). Os thresholds são o SLO:
 * se o p95 passar de 500ms ou a taxa de erro de 1%, o k6 sai com código ≠ 0
 * e o pipeline falha.
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3333';
const EMAIL = __ENV.DEMO_EMAIL || 'demo@turbomais.dev';
const SENHA = __ENV.DEMO_PASSWORD || 'Demo@12345';

const errosNegocio = new Rate('erros_negocio');
const latenciaDetalhe = new Trend('latencia_detalhe_ativo', true);

export const options = {
  scenarios: {
    rampa_ate_1000: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 200 },
        { duration: '1m', target: 1000 },
        { duration: '2m', target: 1000 }, // platô: 1000 usuários simultâneos
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    latencia_detalhe_ativo: ['p(95)<400'],
    erros_negocio: ['rate<0.01'],
  },
};

const TICKERS = ['PETR4', 'VALE3', 'ITUB4', 'WEGE3', 'AAPL', 'NVDA', 'MSFT', 'BTC', 'ETH'];
const ABAS = ['acoes-brasileiras', 'acoes-globais', 'criptomoedas', 'cdbs', 'bancos'];
const IDEIAS = ['quero dividendos com pouco risco', 'tecnologia e inteligência artificial', 'reserva de emergência segura', 'cripto e crescimento'];

/** Executado UMA vez: faz login e compartilha o token com os VUs. */
export function setup() {
  const r = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({ email: EMAIL, senha: SENHA }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(r, { 'login do setup ok': (res) => res.status === 200 });
  return { token: r.json('data.accessToken') };
}

const escolher = (lista) => lista[Math.floor(Math.random() * lista.length)];

export default function (dados) {
  const params = { headers: { Authorization: `Bearer ${dados.token}`, 'Content-Type': 'application/json' } };

  group('navegar no catálogo', () => {
    const lista = http.get(`${BASE_URL}/api/v1/ativos/${escolher(ABAS)}`, params);
    errosNegocio.add(!check(lista, { 'lista 200': (r) => r.status === 200, 'envelope ok': (r) => r.json('success') === true }));

    const detalhe = http.get(`${BASE_URL}/api/v1/ativos/${escolher(TICKERS)}`, params);
    latenciaDetalhe.add(detalhe.timings.duration);
    errosNegocio.add(!check(detalhe, { 'detalhe 200': (r) => r.status === 200 }));
  });

  group('watchlist e notificações', () => {
    const fav = http.get(`${BASE_URL}/api/v1/favoritos`, params);
    const notif = http.get(`${BASE_URL}/api/v1/notificacoes?limit=10`, params);
    errosNegocio.add(!check(fav, { 'favoritos 200': (r) => r.status === 200 }));
    errosNegocio.add(!check(notif, { 'notificações 200': (r) => r.status === 200 }));
  });

  // ~10% das iterações escrevem (favoritar é idempotente: não incha o banco)
  if (Math.random() < 0.1) {
    group('escritas', () => {
      const r = http.post(`${BASE_URL}/api/v1/favoritos`, JSON.stringify({ ticker: escolher(TICKERS) }), params);
      errosNegocio.add(!check(r, { 'favoritar 200/201': (res) => res.status === 200 || res.status === 201 }));
      if (Math.random() < 0.3) {
        const ideia = http.post(`${BASE_URL}/api/v1/ideias`, JSON.stringify({ texto: escolher(IDEIAS) }), params);
        errosNegocio.add(!check(ideia, { 'ideia 201': (res) => res.status === 201 }));
      }
    });
  }

  sleep(1 + Math.random() * 2); // "think time" de um humano real
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data),
    'tests/load/resultado.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data) {
  const m = data.metrics;
  const linha = (nome, valor) => `  ${nome.padEnd(28)} ${valor}\n`;
  return (
    '\n📊 Turbo Mais — resultado do teste de carga\n' +
    linha('requisições', m.http_reqs?.values.count) +
    linha('throughput (req/s)', m.http_reqs?.values.rate.toFixed(1)) +
    linha('p95 (ms)', m.http_req_duration?.values['p(95)'].toFixed(1)) +
    linha('p99 (ms)', m.http_req_duration?.values['p(99)'].toFixed(1)) +
    linha('taxa de erro HTTP', `${(m.http_req_failed?.values.rate * 100).toFixed(2)}%`) +
    linha('VUs máximos', m.vus_max?.values.max)
  );
}
