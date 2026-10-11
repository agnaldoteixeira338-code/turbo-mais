const { Alerta } = require('../../../src/domain/entities/Alerta');
const { Notificacao } = require('../../../src/domain/entities/Notificacao');
const { Usuario } = require('../../../src/domain/entities/Usuario');
const { AtivoEducativo } = require('../../../src/domain/entities/AtivoEducativo');
const { Sugestao } = require('../../../src/domain/entities/Sugestao');
const { DomainValidationError } = require('../../../src/domain/errors/DomainValidationError');

const alerta = (over = {}) => new Alerta({ id: 'a1', usuarioId: 'u1', ticker: 'PETR4', gatilhoPercentual: 3, direcao: 'ambas', ...over });

describe('Entidade Alerta', () => {
  it.each([
    ['ambas', 3.0, 'alta'],
    ['ambas', 5.2, 'alta'],
    ['ambas', -3.0, 'baixa'],
    ['ambas', 2.99, null],
    ['ambas', -2.99, null],
    ['alta', -10, null],
    ['alta', 3.1, 'alta'],
    ['baixa', 10, null],
    ['baixa', -4, 'baixa'],
  ])('direção %s com variação %p → %p', (direcao, variacao, esperado) => {
    expect(alerta({ direcao }).avaliar(variacao)).toBe(esperado);
  });

  it('não dispara se inativo ou com variação inválida', () => {
    expect(alerta({ ativo: false }).avaliar(50)).toBeNull();
    expect(alerta().avaliar(NaN)).toBeNull();
    expect(alerta().avaliar(undefined)).toBeNull();
  });

  it.each([0, -1, 100.01, 'abc', null])('rejeita gatilho %p', (gatilhoPercentual) => {
    expect(() => alerta({ gatilhoPercentual })).toThrow(DomainValidationError);
  });

  it('rejeita direção desconhecida', () => {
    expect(() => alerta({ direcao: 'lateral' })).toThrow(/Direção/);
  });
});

describe('Entidade Notificacao — hash de idempotência', () => {
  const base = { alertaId: 'a1', direcao: 'alta', janelaMinutos: 60 };

  it('é igual dentro da mesma janela (dedup de retries/réplicas)', () => {
    const h1 = Notificacao.gerarHashIdempotencia({ ...base, momento: new Date('2026-10-08T14:05:00Z') });
    const h2 = Notificacao.gerarHashIdempotencia({ ...base, momento: new Date('2026-10-08T14:59:59Z') });
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('muda na janela seguinte, com outra direção ou outro alerta', () => {
    const momento = new Date('2026-10-08T14:05:00Z');
    const h = Notificacao.gerarHashIdempotencia({ ...base, momento });
    expect(Notificacao.gerarHashIdempotencia({ ...base, momento: new Date('2026-10-08T15:00:00Z') })).not.toBe(h);
    expect(Notificacao.gerarHashIdempotencia({ ...base, direcao: 'baixa', momento })).not.toBe(h);
    expect(Notificacao.gerarHashIdempotencia({ ...base, alertaId: 'a2', momento })).not.toBe(h);
  });

  it('normaliza tipos numéricos vindos do banco', () => {
    const n = new Notificacao({ id: 'n1', variacao: '-3.40', preco: '37.10', hashIdempotencia: 'x' });
    expect(n.variacao).toBe(-3.4);
    expect(n.preco).toBe(37.1);
    expect(new Notificacao({ id: 'n2', variacao: 1, preco: null }).preco).toBeNull();
  });
});

describe('Demais entidades', () => {
  it('Usuario indica exigência de 2FA', () => {
    expect(new Usuario({ id: 'u', email: 'a@b.com', twoFactorAtivo: true }).exigeSegundoFator()).toBe(true);
    expect(new Usuario({ id: 'u', email: 'a@b.com' }).exigeSegundoFator()).toBe(false);
  });

  it('AtivoEducativo identifica renda fixa e converte preço', () => {
    const cdb = new AtivoEducativo({ ticker: 'CDB-X', tipo: 'cdb', precoReferencia: '100.5' });
    expect(cdb.ehRendaFixa()).toBe(true);
    expect(cdb.precoReferencia).toBe(100.5);
    expect(new AtivoEducativo({ ticker: 'PETR4', tipo: 'acao_br' }).ehRendaFixa()).toBe(false);
  });

  it('Sugestao converte score para número', () => {
    expect(new Sugestao({ ticker: 'X', score: '7.00' }).score).toBe(7);
  });
});
