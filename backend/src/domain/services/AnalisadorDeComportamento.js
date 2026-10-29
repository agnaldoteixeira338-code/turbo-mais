/**
 * "Como esse ativo se comportou no último ano?" — estatísticas DESCRITIVAS
 * calculadas do histórico real de preços. Serviço de domínio puro (sem I/O),
 * como o MotorDeSugestoes e o SimuladorDeInvestimentos.
 *
 * Por que NÃO existe "probabilidade de subir ou cair" (ADR-015): ninguém
 * consegue prever preço, e um número como "70% de chance de subir" pareceria
 * uma previsão confiável. Aqui só se descreve o PASSADO: quantos meses fecharam
 * em alta, quanto o preço costuma oscilar, qual foi a maior queda. A tela
 * repete que o passado não garante o futuro.
 *
 * Convenções:
 *  - Retornos diários entre pontos consecutivos (pregões na B3; dias corridos
 *    em cripto, que negocia todo dia).
 *  - Volatilidade anualizada = desvio-padrão dos retornos diários × √(pontos
 *    por ano), com os pontos por ano medidos na própria série — funciona igual
 *    para 252 pregões e para 365 dias de cripto.
 *  - Meses: fechamento = último preço de cada mês; o 1º mês compara com o
 *    primeiro ponto da série (mês parcial).
 *  - Maior queda = maior recuo entre um topo e um fundo posterior (drawdown).
 */

const MINIMO_DE_PONTOS = 60;

/**
 * Faixas de oscilação pela volatilidade anualizada (%). Referências típicas:
 * grandes bancos e empresas maduras ~20–30%; petróleo e mineração ~30–40%;
 * tecnologia de crescimento e cripto acima de 50%.
 */
const NIVEIS_DE_OSCILACAO = Object.freeze([
  Object.freeze({ ate: 15, codigo: 'baixa', rotulo: 'Oscila pouco' }),
  Object.freeze({ ate: 30, codigo: 'moderada', rotulo: 'Oscila de forma moderada' }),
  Object.freeze({ ate: 50, codigo: 'alta', rotulo: 'Oscila bastante' }),
  Object.freeze({ ate: Infinity, codigo: 'muito-alta', rotulo: 'Oscila muito' }),
]);

const DIA_MS = 24 * 3600 * 1000;
const duasCasas = (n) => Math.round(n * 100) / 100;

function desvioPadrao(valores) {
  const media = valores.reduce((s, v) => s + v, 0) / valores.length;
  const variancia = valores.reduce((s, v) => s + (v - media) ** 2, 0) / (valores.length - 1);
  return Math.sqrt(variancia);
}

function maiorQueda(precos) {
  let topo = precos[0];
  let pior = 0;
  for (const p of precos) {
    if (p > topo) topo = p;
    pior = Math.min(pior, p / topo - 1);
  }
  return pior;
}

function retornosMensais(pontos) {
  const fechamentos = new Map(); // "AAAA-MM" → último preço do mês (pontos em ordem)
  for (const p of pontos) fechamentos.set(p.data.slice(0, 7), p.preco);
  let base = pontos[0].preco;
  return [...fechamentos.entries()].map(([mes, fechamento]) => {
    const retorno = fechamento / base - 1;
    base = fechamento;
    return { mes, retorno };
  });
}

function nivelPara(volatilidadeAnual) {
  return NIVEIS_DE_OSCILACAO.find((n) => volatilidadeAnual < n.ate);
}

class AnalisadorDeComportamento {
  /**
   * @param {{data: string, preco: number}[]} pontos série diária (AAAA-MM-DD), qualquer ordem
   * @returns {object|null} null quando há menos de 60 pontos válidos (dado insuficiente)
   */
  analisar(pontos) {
    const serie = (pontos ?? [])
      .filter((p) => p && typeof p.data === 'string' && Number.isFinite(p.preco) && p.preco > 0)
      .sort((a, b) => a.data.localeCompare(b.data));
    if (serie.length < MINIMO_DE_PONTOS) return null;

    const precos = serie.map((p) => p.preco);
    const retornosDiarios = precos.slice(1).map((p, i) => p / precos[i] - 1);
    const anos = (Date.parse(serie.at(-1).data) - Date.parse(serie[0].data)) / DIA_MS / 365.25;
    const pontosPorAno = retornosDiarios.length / anos;
    const oscilacaoDiaria = desvioPadrao(retornosDiarios);
    const volatilidadeAnual = oscilacaoDiaria * Math.sqrt(pontosPorAno) * 100;
    const meses = retornosMensais(serie);
    const piorMes = meses.reduce((a, b) => (b.retorno < a.retorno ? b : a));
    const melhorMes = meses.reduce((a, b) => (b.retorno > a.retorno ? b : a));
    const nivel = nivelPara(volatilidadeAnual);

    return {
      periodo: { inicio: serie[0].data, fim: serie.at(-1).data, pontos: serie.length },
      variacaoPercentual: duasCasas((precos.at(-1) / precos[0] - 1) * 100),
      mesesEmAlta: meses.filter((m) => m.retorno > 0).length,
      mesesNoPeriodo: meses.length,
      diasEmAltaPercentual: duasCasas((retornosDiarios.filter((r) => r > 0).length / retornosDiarios.length) * 100),
      oscilacaoDiariaPercentual: duasCasas(oscilacaoDiaria * 100),
      volatilidadeAnualPercentual: duasCasas(volatilidadeAnual),
      maiorQuedaPercentual: duasCasas(maiorQueda(precos) * 100),
      melhorMes: { mes: melhorMes.mes, variacaoPercentual: duasCasas(melhorMes.retorno * 100) },
      piorMes: { mes: piorMes.mes, variacaoPercentual: duasCasas(piorMes.retorno * 100) },
      nivel: { codigo: nivel.codigo, rotulo: nivel.rotulo },
    };
  }
}

module.exports = { AnalisadorDeComportamento, NIVEIS_DE_OSCILACAO, MINIMO_DE_PONTOS };
