const {
  SimuladorDeInvestimentos, aliquotaIR, mesesParaDias, fatorPoupanca, fatorPercentualDoCdi, CARENCIA_LCI_LCA_MESES,
} = require('../../../src/domain/services/SimuladorDeInvestimentos');
const { DomainValidationError } = require('../../../src/domain/errors/DomainValidationError');

const simulador = new SimuladorDeInvestimentos();
/** Taxas redondas para conta de cabeça: CDI e Selic 12% a.a. → (1,12)^(1/12) ≈ 1,0094888 ao mês. */
const REDONDAS = { selicMeta: 0.12, cdi: 0.12, trMensal: 0 };
/** Cenário realista (outubro/2026): Selic 13,75%, CDI 13,65%, TR 0,16% a.m. */
const ATUAIS = { selicMeta: 0.1375, cdi: 0.1365, trMensal: 0.0016 };

const modalidade = (resultado, id) => resultado.modalidades.find((m) => m.id === id);

describe('IR regressivo', () => {
  it.each([
    [1, 0.225], [180, 0.225], [181, 0.2], [360, 0.2], [361, 0.175], [720, 0.175], [721, 0.15], [10_000, 0.15],
  ])('%i dias → %f', (dias, aliquota) => {
    expect(aliquotaIR(dias)).toBe(aliquota);
  });

  it('converte meses em dias corridos (6 meses ≈ 183 dias já cai em 20%)', () => {
    expect([1, 6, 12, 24].map(mesesParaDias)).toEqual([30, 183, 365, 731]);
    expect(aliquotaIR(mesesParaDias(6))).toBe(0.2);
    expect(aliquotaIR(mesesParaDias(12))).toBe(0.175);
    expect(aliquotaIR(mesesParaDias(24))).toBe(0.15);
  });
});

describe('Poupança', () => {
  it('Selic acima de 8,5%: 0,5% a.m. + TR → R$ 1.000 × 1,002 × 1,005 = R$ 1.007,01 em 1 mês, sem IR', () => {
    const r = simulador.simular({ valorInicial: 1000, prazoMeses: 1, taxas: { selicMeta: 0.1375, cdi: 0.1365, trMensal: 0.002 } });
    expect(modalidade(r, 'poupanca')).toMatchObject({ valorBruto: 1007.01, irPago: 0, valorLiquido: 1007.01, rendimentoLiquido: 7.01, isentaIR: true });
  });

  it('Selic até 8,5%: 70% da Selic mensalizada + TR → (1 + 0,7 × 8%)^(1/12) = R$ 1.004,55', () => {
    const r = simulador.simular({ valorInicial: 1000, prazoMeses: 1, taxas: { selicMeta: 0.08, cdi: 0.079, trMensal: 0 } });
    expect(modalidade(r, 'poupanca').valorLiquido).toBe(1004.55);
  });

  it('com a Selic exatamente em 8,5% vale a regra dos 70% (a lei diz "superior a 8,5%")', () => {
    expect(fatorPoupanca({ selicMeta: 0.085, trMensal: 0 })).toBeCloseTo((1 + 0.7 * 0.085) ** (1 / 12), 12);
    expect(fatorPoupanca({ selicMeta: 0.0851, trMensal: 0 })).toBe(1.005);
    const r = simulador.simular({ valorInicial: 1000, prazoMeses: 1, taxas: { selicMeta: 0.085, cdi: 0.084, trMensal: 0 } });
    expect(modalidade(r, 'poupanca').valorLiquido).toBe(1004.83);
  });
});

describe('CDB, LCI/LCA e Tesouro Selic', () => {
  it('o % do CDI incide sobre a taxa DIÁRIA: 100% do CDI = (1 + CDI)^(1/12) ao mês', () => {
    expect(fatorPercentualDoCdi(0.12, 1)).toBeCloseTo(1.12 ** (1 / 12), 12);
    expect(fatorPercentualDoCdi(0.12, 1.1)).toBeGreaterThan(fatorPercentualDoCdi(0.12, 1));
  });

  it('prazo de 1 mês: CDB 100% rende R$ 9,49 bruto, paga 22,5% de IR (R$ 2,13) e fica com R$ 1.007,36', () => {
    const r = simulador.simular({ valorInicial: 1000, prazoMeses: 1, taxas: REDONDAS });
    expect(modalidade(r, 'cdb-100')).toMatchObject({ valorBruto: 1009.49, irPago: 2.13, custodia: 0, valorLiquido: 1007.36, rendimentoLiquido: 7.36, rendimentoLiquidoPercentual: 0.74 });
  });

  it('LCI/LCA 90% do CDI é isenta: R$ 1.000 × (1 + 0,9 × CDI diário)^126 = R$ 1.052,32 em 6 meses, IR zero', () => {
    const r = simulador.simular({ valorInicial: 1000, prazoMeses: 6, taxas: REDONDAS });
    expect(modalidade(r, 'lci-lca')).toMatchObject({ valorBruto: 1052.32, irPago: 0, valorLiquido: 1052.32 });
  });

  it('prazo longo (30 anos): R$ 1.000 × 1,12^30 = R$ 29.959,92 bruto, IR de 15% = R$ 4.343,99', () => {
    const r = simulador.simular({ valorInicial: 1000, prazoMeses: 360, taxas: REDONDAS });
    expect(modalidade(r, 'cdb-100')).toMatchObject({ valorBruto: 29959.92, irPago: 4343.99, valorLiquido: 25615.93 });
    expect(modalidade(r, 'cdb-100').serie).toHaveLength(361);
  });

  it('Tesouro Selic: sem custódia até R$ 10 mil; acima, 0,20% a.a. só sobre o excedente', () => {
    const pequeno = simulador.simular({ valorInicial: 5000, prazoMeses: 12, taxas: REDONDAS });
    expect(modalidade(pequeno, 'tesouro-selic').custodia).toBe(0);

    const grande = simulador.simular({ valorInicial: 110_000, prazoMeses: 12, taxas: REDONDAS });
    const custodia = modalidade(grande, 'tesouro-selic').custodia;
    // excedente médio ≈ R$ 106 mil × 0,20% ≈ R$ 212 no ano
    expect(custodia).toBeGreaterThan(200);
    expect(custodia).toBeLessThan(225);
    // mesmo rendimento bruto do CDB 100% com Selic = CDI; o líquido é menor pela custódia
    expect(modalidade(grande, 'tesouro-selic').valorBruto).toBe(modalidade(grande, 'cdb-100').valorBruto);
    expect(modalidade(grande, 'tesouro-selic').valorLiquido).toBeCloseTo(modalidade(grande, 'cdb-100').valorLiquido - custodia, 2);
  });
});

describe('Aportes e IR por lote', () => {
  it('cada aporte paga a alíquota do SEU prazo: aportes recentes pagam 22,5%, os antigos 20%', () => {
    // 7 meses: inicial (213 dias → 20%), aporte do mês 1 (6 meses = 183 dias → 20%),
    // aportes dos meses 2 a 7 (≤ 5 meses → 22,5%). Calculado lote a lote: bruto R$ 1.788,59, IR R$ 18,08
    const r = simulador.simular({ valorInicial: 1000, aporteMensal: 100, prazoMeses: 7, taxas: REDONDAS });
    const cdb = modalidade(r, 'cdb-100');
    expect(r.totalInvestido).toBe(1700);
    expect(cdb).toMatchObject({ totalInvestido: 1700, valorBruto: 1788.59, irPago: 18.08 });
    // uma alíquota única de 20% sobre o rendimento total daria IR menor que o correto
    expect(cdb.irPago).toBeGreaterThan((cdb.valorBruto - 1700) * 0.2);
  });

  it('aporte zero: total investido é só o valor inicial', () => {
    const r = simulador.simular({ valorInicial: 2500, aporteMensal: 0, prazoMeses: 24, taxas: ATUAIS });
    expect(r.totalInvestido).toBe(2500);
    for (const m of r.modalidades) expect(m.totalInvestido).toBe(2500);
  });

  it('só aporte mensal (valor inicial zero) também funciona', () => {
    const r = simulador.simular({ valorInicial: 0, aporteMensal: 300, prazoMeses: 12, taxas: ATUAIS });
    expect(r.totalInvestido).toBe(3600);
    expect(modalidade(r, 'cdb-100').serie[0]).toEqual({ mes: 0, investido: 0, liquido: 0 });
  });
});

describe('Consistência da saída', () => {
  it('líquido = bruto − IR − custódia, centavo por centavo, e a série termina no líquido final', () => {
    const r = simulador.simular({ valorInicial: 12_345.67, aporteMensal: 432.1, prazoMeses: 37, taxas: ATUAIS });
    for (const m of r.modalidades) {
      expect(Math.round((m.valorBruto - m.irPago - m.custodia) * 100)).toBe(Math.round(m.valorLiquido * 100));
      expect(m.serie).toHaveLength(38);
      expect(m.serie.at(-1)).toMatchObject({ mes: 37, liquido: m.valorLiquido, investido: m.totalInvestido });
      expect(Math.round((m.valorLiquido - m.totalInvestido) * 100)).toBe(Math.round(m.rendimentoLiquido * 100));
      expect(Math.round((m.valorResgatavel + m.valorEmCarencia) * 100)).toBe(Math.round(m.valorLiquido * 100));
    }
  });

  it('indica a modalidade que rendeu mais', () => {
    const r = simulador.simular({ valorInicial: 10_000, prazoMeses: 12, taxas: ATUAIS });
    const maior = Math.max(...r.modalidades.map((m) => m.valorLiquido));
    expect(modalidade(r, r.melhor).valorLiquido).toBe(maior);
  });
});

describe('Ordem entre as modalidades em cenários conhecidos', () => {
  it('Selic alta, 1 ano: a poupança fica em último; CDB 110% e LCI 90% (isenta) passam o CDB 100%', () => {
    const r = simulador.simular({ valorInicial: 10_000, prazoMeses: 12, taxas: ATUAIS });
    const liquido = Object.fromEntries(r.modalidades.map((m) => [m.id, m.valorLiquido]));
    expect(Math.min(...Object.values(liquido))).toBe(liquido.poupanca);
    expect(liquido['cdb-110']).toBeGreaterThan(liquido['cdb-100']);
    expect(liquido['lci-lca']).toBeGreaterThan(liquido['cdb-100']);
    // Selic meta um pouco acima do CDI: Tesouro Selic passa o CDB 100%
    expect(liquido['tesouro-selic']).toBeGreaterThan(liquido['cdb-100']);
  });

  it('prazo curto (6 meses, o mínimo da LCI/LCA): o IR de 20% faz a LCI isenta passar até o CDB 110%', () => {
    const r = simulador.simular({ valorInicial: 10_000, prazoMeses: 6, taxas: ATUAIS });
    expect(modalidade(r, 'lci-lca').valorLiquido).toBeGreaterThan(modalidade(r, 'cdb-110').valorLiquido);
    expect(r.melhor).toBe('lci-lca');
  });

  it('prazo longo (5 anos): com IR de 15%, o CDB 110% passa a LCI 90%', () => {
    const r = simulador.simular({ valorInicial: 10_000, prazoMeses: 60, taxas: ATUAIS });
    expect(modalidade(r, 'cdb-110').valorLiquido).toBeGreaterThan(modalidade(r, 'lci-lca').valorLiquido);
    expect(r.melhor).toBe('cdb-110');
  });
});

describe('Prazo mínimo (carência) de LCI/LCA — Resolução CMN 5.215/2025', () => {
  /** Fator mensal da LCI/LCA com CDI de 12%: (1 + 0,9 × taxa diária)^21. */
  const f = fatorPercentualDoCdi(0.12, 0.9);
  const centavos = (v) => Math.round(v * 100) / 100;

  it('a carência vigente é de 6 meses', () => {
    expect(CARENCIA_LCI_LCA_MESES).toBe(6);
  });

  it('prazo MENOR que a carência (5 meses): indisponível, com o motivo, sem valores e fora da "melhor"', () => {
    const r = simulador.simular({ valorInicial: 10_000, prazoMeses: 5, taxas: ATUAIS });
    const lci = modalidade(r, 'lci-lca');
    expect(lci).toMatchObject({ disponivel: false, carenciaMeses: 6, valorLiquido: null, valorBruto: null, valorResgatavel: null, valorEmCarencia: null, rendimentoLiquido: null, serie: [] });
    expect(lci.motivoIndisponivel).toMatch(/prazo mínimo de 6 meses.*Resolução CMN 5\.215/);
    // sem a carência, a LCI isenta venceria em 5 meses (IR de 22,5% nas outras); agora não concorre
    expect(r.melhor).not.toBe('lci-lca');
    expect(r.melhor).toBe('cdb-110');
    // as outras modalidades continuam normais
    for (const m of r.modalidades.filter((x) => x.id !== 'lci-lca')) expect(m).toMatchObject({ disponivel: true, motivoIndisponivel: null });
  });

  it('prazo IGUAL à carência (6 meses), sem aportes: disponível e tudo resgatável', () => {
    const r = simulador.simular({ valorInicial: 1000, prazoMeses: 6, taxas: REDONDAS });
    expect(modalidade(r, 'lci-lca')).toMatchObject({
      disponivel: true, valorLiquido: centavos(1000 * f ** 6), valorResgatavel: centavos(1000 * f ** 6), valorEmCarencia: 0,
    });
  });

  it('prazo MAIOR que a carência (12 meses), sem aportes: disponível, nada em carência', () => {
    const r = simulador.simular({ valorInicial: 1000, prazoMeses: 12, taxas: REDONDAS });
    expect(modalidade(r, 'lci-lca')).toMatchObject({ disponivel: true, valorLiquido: centavos(1000 * f ** 12), valorEmCarencia: 0 });
  });

  it('aportes dentro da carência no fim do prazo não podem ser resgatados', () => {
    // 7 meses, R$ 1.000 + R$ 100/mês (aporte no fim de cada mês 1..7). No fim:
    //  livres: inicial (7 meses) e aporte do mês 1 (6 meses)
    //  em carência: aportes dos meses 2 a 7 (5, 4, 3, 2, 1 e 0 meses)
    const r = simulador.simular({ valorInicial: 1000, aporteMensal: 100, prazoMeses: 7, taxas: REDONDAS });
    const lci = modalidade(r, 'lci-lca');
    const livre = 1000 * f ** 7 + 100 * f ** 6;
    const preso = [0, 1, 2, 3, 4, 5].reduce((soma, k) => soma + 100 * f ** k, 0);
    expect(lci.valorResgatavel).toBe(centavos(livre)); // R$ 1.166,54
    expect(lci.valorEmCarencia).toBe(centavos(preso)); // R$ 612,95
    expect(lci.valorLiquido).toBe(centavos(livre + preso));
    // nas modalidades sem carência, tudo pode ser resgatado
    expect(modalidade(r, 'cdb-100')).toMatchObject({ valorEmCarencia: 0, carenciaMeses: 0 });
    expect(modalidade(r, 'cdb-100').valorResgatavel).toBe(modalidade(r, 'cdb-100').valorLiquido);
  });

  it('com aporte mensal, sempre sobram os últimos 6 aportes em carência; com só aportes e prazo de 6 meses, nada é resgatável ainda', () => {
    const longo = modalidade(simulador.simular({ valorInicial: 0, aporteMensal: 500, prazoMeses: 24, taxas: REDONDAS }), 'lci-lca');
    const ultimosSeis = [0, 1, 2, 3, 4, 5].reduce((soma, k) => soma + 500 * f ** k, 0);
    expect(longo.valorEmCarencia).toBe(centavos(ultimosSeis));

    const curto = modalidade(simulador.simular({ valorInicial: 0, aporteMensal: 500, prazoMeses: 6, taxas: REDONDAS }), 'lci-lca');
    // o 1º aporte entra no fim do mês 1: no mês 6 ele tem só 5 meses
    expect(curto).toMatchObject({ disponivel: true, valorResgatavel: 0 });
    expect(curto.valorEmCarencia).toBe(curto.valorLiquido);
  });
});

describe('Validação', () => {
  it.each([
    [{ valorInicial: 1000, prazoMeses: 0 }, 'prazoMeses'],
    [{ valorInicial: 1000, prazoMeses: 361 }, 'prazoMeses'],
    [{ valorInicial: 1000, prazoMeses: 1.5 }, 'prazoMeses'],
    [{ valorInicial: -1, prazoMeses: 12 }, 'valorInicial'],
    [{ valorInicial: 0, aporteMensal: 0, prazoMeses: 12 }, 'valorInicial'],
    [{ valorInicial: 20_000_000, prazoMeses: 12 }, 'valorInicial'],
    [{ valorInicial: 1000, aporteMensal: 2_000_000, prazoMeses: 12 }, 'aporteMensal'],
  ])('rejeita %j (campo %s)', (entrada, campo) => {
    expect(() => simulador.simular({ ...entrada, taxas: ATUAIS })).toThrow(expect.objectContaining({ campo }));
  });

  it('rejeita taxas ausentes ou absurdas', () => {
    expect(() => simulador.simular({ valorInicial: 1000, prazoMeses: 12 })).toThrow(DomainValidationError);
    expect(() => simulador.simular({ valorInicial: 1000, prazoMeses: 12, taxas: { selicMeta: 13.75, cdi: 0.13, trMensal: 0 } })).toThrow(/Taxas/);
  });
});
