const { AnalisadorDeComportamento, MINIMO_DE_PONTOS } = require('../../../src/domain/services/AnalisadorDeComportamento');

const analisador = new AnalisadorDeComportamento();
const DIA = 24 * 3600 * 1000;

/** Série diária (dias corridos, como cripto) a partir de uma lista de preços. */
function serie(precos, inicio = '2025-10-01') {
  const t0 = Date.parse(`${inicio}T00:00:00Z`);
  return precos.map((preco, i) => ({ data: new Date(t0 + i * DIA).toISOString().slice(0, 10), preco }));
}

/** Preços com retornos diários alternando +a e −a (ex.: a = 0,01 → +1%, −1%, +1%...). */
function alternada(n, a, inicial = 100) {
  const precos = [inicial];
  for (let i = 1; i < n; i += 1) precos.push(precos[i - 1] * (1 + (i % 2 ? a : -a)));
  return precos;
}

describe('AnalisadorDeComportamento', () => {
  it(`com menos de ${MINIMO_DE_PONTOS} pontos válidos devolve null (dado insuficiente); ignora pontos inválidos`, () => {
    expect(analisador.analisar(serie(Array(59).fill(10)))).toBeNull();
    expect(analisador.analisar([])).toBeNull();
    expect(analisador.analisar(undefined)).toBeNull();
    const comLixo = [...serie(Array(59).fill(10)), { data: '2026-01-01', preco: 0 }, { data: '2026-01-02', preco: Number.NaN }, null];
    expect(analisador.analisar(comLixo)).toBeNull();
  });

  it('alta constante de 1% ao dia: variação composta, 100% dos dias em alta, oscilação zero e nenhuma queda', () => {
    const precos = Array.from({ length: 61 }, (_, i) => 100 * 1.01 ** i);
    const r = analisador.analisar(serie(precos));
    expect(r.variacaoPercentual).toBe(Math.round((1.01 ** 60 - 1) * 10_000) / 100); // 81,67%
    expect(r.diasEmAltaPercentual).toBe(100);
    expect(r.oscilacaoDiariaPercentual).toBe(0);
    expect(r.volatilidadeAnualPercentual).toBe(0);
    expect(r.maiorQuedaPercentual).toBe(0);
    expect(r.nivel).toEqual({ codigo: 'baixa', rotulo: 'Oscila pouco' });
    expect(r.periodo).toEqual({ inicio: '2025-10-01', fim: '2025-11-30', pontos: 61 });
  });

  it('maior queda é o recuo do topo até o fundo seguinte: 120 → 90 = −25%', () => {
    const precos = [...Array(30).fill(100), 120, 110, 100, 90, ...Array(30).fill(105)];
    expect(analisador.analisar(serie(precos)).maiorQuedaPercentual).toBe(-25);
  });

  it('oscilação diária = desvio-padrão dos retornos, anualizada pelos pontos por ano da própria série', () => {
    const precos = alternada(366, 0.01); // 1 ano de dias corridos: 365 retornos
    const r = analisador.analisar(serie(precos));
    // conta à mão: retornos +1% e −1% alternados → média 0, desvio amostral = 0,01 × √(365/364)
    const desvio = 0.01 * Math.sqrt(365 / 364);
    const anos = 365 / 365.25;
    expect(r.oscilacaoDiariaPercentual).toBe(Math.round(desvio * 10_000) / 100);
    expect(r.volatilidadeAnualPercentual).toBeCloseTo(desvio * Math.sqrt(365 / anos) * 100, 1); // ≈ 19,1%
    expect(r.diasEmAltaPercentual).toBe(50.14); // 183 de 365 retornos são de alta
  });

  it('classifica a oscilação em quatro faixas pela volatilidade anual', () => {
    const nivel = (a) => analisador.analisar(serie(alternada(366, a))).nivel.codigo;
    expect(nivel(0.005)).toBe('baixa'); // ≈ 9,6% a.a.
    expect(nivel(0.012)).toBe('moderada'); // ≈ 23%
    expect(nivel(0.02)).toBe('alta'); // ≈ 38%
    expect(nivel(0.035)).toBe('muito-alta'); // ≈ 67%
  });

  it('meses: fechamento = último preço do mês; conta os meses em alta e acha o melhor e o pior', () => {
    // out/2025: 100 → 110 (+10%), nov: 110 → 99 (−10%), dez: 99 → 103,95 (+5%)
    const precos = [...Array(30).fill(100), 110, ...Array(29).fill(110), 99, ...Array(30).fill(99), 103.95];
    const r = analisador.analisar(serie(precos, '2025-10-01'));
    expect(r.mesesNoPeriodo).toBe(3);
    expect(r.mesesEmAlta).toBe(2);
    expect(r.melhorMes).toEqual({ mes: '2025-10', variacaoPercentual: 10 });
    expect(r.piorMes).toEqual({ mes: '2025-11', variacaoPercentual: -10 });
  });

  it('não depende da ordem dos pontos', () => {
    const pontos = serie(alternada(120, 0.02));
    const embaralhados = [...pontos].reverse();
    expect(analisador.analisar(embaralhados)).toEqual(analisador.analisar(pontos));
  });
});
