const { MotorDeSugestoes, normalizar } = require('../../../src/domain/services/MotorDeSugestoes');
const dicionario = require('../../../src/domain/services/dicionarioSinonimos.json');
const { CATALOGO } = require('../../helpers/fakes');

describe('MotorDeSugestoes', () => {
  const motor = new MotorDeSugestoes(dicionario);
  const catalogo = CATALOGO();

  it('normaliza acentos, caixa e pontuação', () => {
    expect(normalizar('  Inovação, É-COMMERCE!!  Ação ')).toBe('inovacao e commerce acao');
    expect(normalizar(null)).toBe('');
  });

  it('casa palavras INTEIRAS (não casa "ia" dentro de "família")', () => {
    const conceitos = motor.extrairConceitos('quero proteger minha família').map((c) => c.conceito.id);
    expect(conceitos).toContain('seguranca');
    expect(conceitos).not.toContain('tecnologia');
  });

  it('casa frases com várias palavras', () => {
    const ids = motor.extrairConceitos('Quero montar minha reserva de emergência').map((c) => c.conceito.id);
    expect(ids).toEqual(expect.arrayContaining(['reserva']));
  });

  it('ranqueia tecnologia arrojada no topo para "tecnologia e crescimento"', () => {
    const { palavrasChave, sugestoes } = motor.sugerir('Quero investir em tecnologia com alto potencial de crescimento', catalogo);
    expect(palavrasChave).toEqual(expect.arrayContaining(['Tecnologia', 'Crescimento']));
    expect(sugestoes[0].ticker).toBe('NVDA');
    expect(sugestoes[0].justificativa).toMatch(/^Combina com você porque/);
    expect(sugestoes.map((s) => s.posicao)).toEqual(sugestoes.map((_, i) => i + 1));
  });

  it('para perfil conservador prioriza renda fixa e PENALIZA ativos arrojados', () => {
    const { sugestoes } = motor.sugerir('quero algo seguro, sem risco, para minha reserva', catalogo);
    expect(sugestoes[0].ticker).toBe('CDB-LIQ-100');
    expect(sugestoes.map((s) => s.ticker)).not.toContain('BTC');
    expect(sugestoes.map((s) => s.ticker)).not.toContain('NVDA');
  });

  it('dividendos sugere bancos e Petrobras', () => {
    const tickers = motor.sugerir('busco renda passiva com dividendos', catalogo).sugestoes.map((s) => s.ticker);
    expect(tickers).toEqual(expect.arrayContaining(['ITUB4', 'PETR4']));
    expect(tickers).not.toContain('AAPL');
  });

  it('desempata de forma estável (score desc, ticker asc) e respeita o limite', () => {
    const { sugestoes } = motor.sugerir('tecnologia', catalogo, { limite: 1 });
    expect(sugestoes).toHaveLength(1);
    const todas = motor.sugerir('tecnologia', catalogo).sugestoes;
    for (let i = 1; i < todas.length; i += 1) {
      const [a, b] = [todas[i - 1], todas[i]];
      expect(a.score > b.score || (a.score === b.score && a.ticker < b.ticker)).toBe(true);
    }
  });

  it('sem conceitos reconhecidos devolve lista vazia', () => {
    expect(motor.sugerir('xyzzy plugh', catalogo)).toEqual({ palavrasChave: [], sugestoes: [] });
  });

  it('valida o dicionário na construção (fail fast)', () => {
    expect(() => new MotorDeSugestoes({})).toThrow('Dicionário');
    expect(() => new MotorDeSugestoes(null)).toThrow('Dicionário');
  });

  it('dicionário não tem termos duplicados entre conceitos do mesmo id', () => {
    const ids = dicionario.conceitos.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
