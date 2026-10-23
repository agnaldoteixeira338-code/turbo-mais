const { DomainValidationError } = require('../errors/DomainValidationError');

/**
 * Simulador de investimentos: "quanto renderia R$ X por N meses em cada
 * aplicação, já descontado o imposto". Serviço de domínio PURO (sem I/O,
 * determinístico): recebe as taxas por parâmetro, como o MotorDeSugestoes
 * recebe o catálogo. Só informa; não existe ação de compra (ADR-014).
 *
 * ── Convenções do cálculo ─────────────────────────────────────────────────
 *  - Mês 0: o valor inicial é aplicado. O aporte mensal cai no FIM de cada
 *    mês 1..N (o último aporte ainda não rendeu nada no resgate).
 *  - Capitalização mensal com taxas CONSTANTES durante todo o prazo.
 *  - Ano de 252 dias úteis e mês de 21 (252/12), como no mercado de renda fixa.
 *
 * ── IR regressivo por aporte ──────────────────────────────────────────────
 * Cada aporte é um "lote" com a sua data de entrada, e o IR de renda fixa é
 * cobrado lote a lote, pelo prazo DAQUELE lote: o valor inicial resgatado
 * após 2 anos paga 15%, mas o aporte feito no mês passado paga 22,5%. Somar
 * tudo e aplicar uma alíquota só superestimaria (ou subestimaria) o imposto.
 * Prazo em dias corridos = meses × 365,25/12 (6 meses ≈ 183 dias → 20%;
 * 12 meses ≈ 365 dias → 17,5%; 24 meses ≈ 731 dias → 15%).
 *
 * ── Aritmética ────────────────────────────────────────────────────────────
 * Entradas e somas de aportes viram CENTAVOS INTEIROS (exatos). Os juros
 * compostos usam potências fracionárias (ex.: (1 + CDI)^(1/252)), que não têm
 * representação exata em nenhum formato; por isso a capitalização roda em
 * ponto flutuante de dupla precisão (~15 dígitos significativos, erro muito
 * abaixo de 1 centavo até para R$ 10 milhões em 30 anos) e arredondamos para
 * centavos UMA vez, só na saída. O líquido é derivado dos valores já
 * arredondados (bruto − IR − custódia), então os números exibidos sempre fecham.
 *
 * ── Simplificações assumidas ──────────────────────────────────────────────
 *  - IOF ignorado: só incide em resgates com menos de 30 dias.
 *  - Taxas constantes (Selic, CDI e TR de hoje valendo pelo prazo inteiro).
 *  - Tesouro Selic rende a Selic meta (a Selic efetiva costuma ficar ~0,10 p.p.
 *    abaixo) e o IR incide sobre o rendimento bruto (na prática a custódia é
 *    deduzida da base do IR: diferença de centavos). A isenção de custódia de
 *    R$ 10 mil considera que este é o único Tesouro Selic do CPF.
 */

const LIMITES_SIMULACAO = Object.freeze({
  prazoMinimoMeses: 1,
  prazoMaximoMeses: 360,
  valorInicialMaximo: 10_000_000,
  aporteMensalMaximo: 1_000_000,
});

const DIAS_UTEIS_ANO = 252;
const DIAS_UTEIS_MES = DIAS_UTEIS_ANO / 12;
const DIAS_CORRIDOS_POR_MES = 365.25 / 12;

/** IR regressivo da renda fixa (Lei 11.033/2004, art. 1º): dias corridos → alíquota. */
const FAIXAS_IR = Object.freeze([
  Object.freeze({ ateDias: 180, aliquota: 0.225 }),
  Object.freeze({ ateDias: 360, aliquota: 0.2 }),
  Object.freeze({ ateDias: 720, aliquota: 0.175 }),
  Object.freeze({ ateDias: Infinity, aliquota: 0.15 }),
]);

/**
 * Poupança (Lei 8.177/1991, art. 12, com a redação da Lei 12.703/2012):
 * meta Selic ACIMA de 8,5% a.a. → 0,5% a.m. + TR; caso contrário → 70% da
 * meta Selic (ao ano, mensalizada) + TR.
 */
const POUPANCA = Object.freeze({ selicLimite: 0.085, jurosMensais: 0.005, fracaoDaSelic: 0.7 });

/**
 * Custódia da B3 no Tesouro Selic (regulamento do Tesouro Direto,
 * tesourodireto.com.br/sobre-o-tesouro/regras-e-regulamento): 0,20% a.a.,
 * pro rata, isenta até R$ 10.000 por CPF e cobrada só sobre o excedente.
 * Desde 2025 é provisionada diariamente e cobrada no resgate.
 */
const CUSTODIA_TESOURO_SELIC = Object.freeze({ taxaAnual: 0.002, isencaoCentavos: 10_000 * 100 });

function aliquotaIR(dias) {
  return FAIXAS_IR.find((f) => dias <= f.ateDias).aliquota;
}

function mesesParaDias(meses) {
  return Math.round(meses * DIAS_CORRIDOS_POR_MES);
}

/** Fator mensal de um título que paga `percentual` do CDI (o % incide sobre a taxa DIÁRIA). */
function fatorPercentualDoCdi(cdi, percentual) {
  const taxaDiaria = (1 + cdi) ** (1 / DIAS_UTEIS_ANO) - 1;
  return (1 + percentual * taxaDiaria) ** DIAS_UTEIS_MES;
}

function fatorPoupanca({ selicMeta, trMensal }) {
  const juros = selicMeta > POUPANCA.selicLimite ? POUPANCA.jurosMensais : (1 + POUPANCA.fracaoDaSelic * selicMeta) ** (1 / 12) - 1;
  return (1 + trMensal) * (1 + juros);
}

function fatorSelic(selicMeta) {
  return (1 + selicMeta) ** (1 / 12);
}

/** Modalidades comparadas, na ordem em que são exibidas. */
const MODALIDADES = Object.freeze([
  Object.freeze({ id: 'poupanca', nome: 'Poupança', isentaIR: true, custodia: false, fatorMensal: (t) => fatorPoupanca(t) }),
  Object.freeze({ id: 'cdb-100', nome: 'CDB 100% do CDI', isentaIR: false, custodia: false, fatorMensal: (t) => fatorPercentualDoCdi(t.cdi, 1) }),
  Object.freeze({ id: 'cdb-110', nome: 'CDB 110% do CDI', isentaIR: false, custodia: false, fatorMensal: (t) => fatorPercentualDoCdi(t.cdi, 1.1) }),
  Object.freeze({ id: 'tesouro-selic', nome: 'Tesouro Selic', isentaIR: false, custodia: true, fatorMensal: (t) => fatorSelic(t.selicMeta) }),
  Object.freeze({ id: 'lci-lca', nome: 'LCI/LCA 90% do CDI', isentaIR: true, custodia: false, fatorMensal: (t) => fatorPercentualDoCdi(t.cdi, 0.9) }),
]);

const paraReais = (centavos) => centavos / 100;
const duasCasas = (n) => Math.round(n * 100) / 100;

function validarValor(valor, campo, maximo, rotulo) {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0 || valor > maximo) {
    throw new DomainValidationError(`${rotulo} deve estar entre R$ 0 e R$ ${maximo.toLocaleString('pt-BR')}`, campo);
  }
}

function validarTaxas(taxas) {
  const { selicMeta, cdi, trMensal } = taxas ?? {};
  const ok = (v, max) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < max;
  if (!ok(selicMeta, 1) || !ok(cdi, 1) || !ok(trMensal, 0.05)) {
    throw new DomainValidationError('Taxas de juros inválidas para a simulação', 'taxas');
  }
}

class SimuladorDeInvestimentos {
  /**
   * @param {{valorInicial: number, aporteMensal?: number, prazoMeses: number,
   *          taxas: {selicMeta: number, cdi: number, trMensal: number}}} entrada
   *        valores em R$; taxas em fração (13,75% a.a. = 0.1375; TR em fração AO MÊS)
   */
  simular({ valorInicial, aporteMensal = 0, prazoMeses, taxas }) {
    validarValor(valorInicial, 'valorInicial', LIMITES_SIMULACAO.valorInicialMaximo, 'O valor inicial');
    validarValor(aporteMensal, 'aporteMensal', LIMITES_SIMULACAO.aporteMensalMaximo, 'O aporte mensal');
    if (!Number.isInteger(prazoMeses) || prazoMeses < LIMITES_SIMULACAO.prazoMinimoMeses || prazoMeses > LIMITES_SIMULACAO.prazoMaximoMeses) {
      throw new DomainValidationError('O prazo deve ser de 1 a 360 meses', 'prazoMeses');
    }
    validarTaxas(taxas);

    const inicialCentavos = Math.round(valorInicial * 100);
    const aporteCentavos = Math.round(aporteMensal * 100);
    if (inicialCentavos === 0 && aporteCentavos === 0) {
      throw new DomainValidationError('Informe um valor inicial ou um aporte mensal', 'valorInicial');
    }

    const modalidades = MODALIDADES.map((m) => this.#simularModalidade(m, { inicialCentavos, aporteCentavos, prazoMeses, taxas }));
    const melhor = modalidades.reduce((a, b) => (b.valorLiquido > a.valorLiquido ? b : a));
    return {
      parametros: { valorInicial: paraReais(inicialCentavos), aporteMensal: paraReais(aporteCentavos), prazoMeses },
      totalInvestido: paraReais(inicialCentavos + aporteCentavos * prazoMeses),
      melhor: melhor.id,
      modalidades,
    };
  }

  #simularModalidade(modalidade, { inicialCentavos, aporteCentavos, prazoMeses, taxas }) {
    const fator = modalidade.fatorMensal(taxas);
    // potencias[k] = fator^k: cada lote com k meses de idade cresce por potencias[k]
    const potencias = [1];
    for (let k = 1; k <= prazoMeses; k += 1) potencias.push(potencias[k - 1] * fator);
    const custodiaMensal = (1 + CUSTODIA_TESOURO_SELIC.taxaAnual) ** (1 / 12) - 1;

    const lotes = inicialCentavos > 0 ? [{ mes: 0, principal: inicialCentavos }] : [];
    let custodiaAcumulada = 0;
    let bruto = inicialCentavos;
    let ir = 0;
    const serie = [{ mes: 0, investido: paraReais(inicialCentavos), liquido: paraReais(inicialCentavos) }];

    for (let mes = 1; mes <= prazoMeses; mes += 1) {
      if (aporteCentavos > 0) lotes.push({ mes, principal: aporteCentavos });
      bruto = 0;
      ir = 0;
      for (const lote of lotes) {
        const idade = mes - lote.mes;
        const valor = lote.principal * potencias[idade];
        bruto += valor;
        if (!modalidade.isentaIR) ir += Math.max(0, valor - lote.principal) * aliquotaIR(mesesParaDias(idade));
      }
      if (modalidade.custodia) {
        custodiaAcumulada += Math.max(0, bruto - CUSTODIA_TESOURO_SELIC.isencaoCentavos) * custodiaMensal;
      }
      serie.push({
        mes,
        investido: paraReais(inicialCentavos + aporteCentavos * mes),
        liquido: paraReais(Math.round(bruto - ir - custodiaAcumulada)),
      });
    }

    const investidoCentavos = inicialCentavos + aporteCentavos * prazoMeses;
    const brutoCentavos = Math.round(bruto);
    const irCentavos = Math.round(ir);
    const custodiaCentavos = Math.round(custodiaAcumulada);
    const liquidoCentavos = brutoCentavos - irCentavos - custodiaCentavos;
    const rendimentoCentavos = liquidoCentavos - investidoCentavos;

    return {
      id: modalidade.id,
      nome: modalidade.nome,
      isentaIR: modalidade.isentaIR,
      taxaMensalPercentual: duasCasas((fator - 1) * 10_000) / 100,
      totalInvestido: paraReais(investidoCentavos),
      valorBruto: paraReais(brutoCentavos),
      irPago: paraReais(irCentavos),
      custodia: paraReais(custodiaCentavos),
      valorLiquido: paraReais(liquidoCentavos),
      rendimentoLiquido: paraReais(rendimentoCentavos),
      rendimentoLiquidoPercentual: duasCasas((rendimentoCentavos / investidoCentavos) * 100),
      serie,
    };
  }
}

module.exports = {
  SimuladorDeInvestimentos,
  MODALIDADES,
  LIMITES_SIMULACAO,
  FAIXAS_IR,
  aliquotaIR,
  mesesParaDias,
  fatorPercentualDoCdi,
  fatorPoupanca,
  fatorSelic,
};
