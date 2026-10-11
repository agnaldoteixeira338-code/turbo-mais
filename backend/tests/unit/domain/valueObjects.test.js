const { Email } = require('../../../src/domain/value-objects/Email');
const { Celular } = require('../../../src/domain/value-objects/Celular');
const { Senha } = require('../../../src/domain/value-objects/Senha');
const { Ticker } = require('../../../src/domain/value-objects/Ticker');
const { DomainValidationError } = require('../../../src/domain/errors/DomainValidationError');

describe('Value Object: Email', () => {
  it('normaliza para minúsculas e remove espaços', () => {
    expect(Email.criar('  Ana.Souza@Gmail.COM ').valor).toBe('ana.souza@gmail.com');
  });

  it.each(['', 'sem-arroba', 'a@b', 'a@b.c', '@dominio.com', 'a b@c.com', null, 42])('rejeita %p', (entrada) => {
    expect(() => Email.criar(entrada)).toThrow(DomainValidationError);
  });

  it('rejeita e-mails acima de 254 caracteres', () => {
    expect(() => Email.criar(`${'a'.repeat(250)}@x.com`)).toThrow('E-mail inválido');
  });

  it('mascara para logs e compara por valor', () => {
    const email = Email.criar('ana@gmail.com');
    expect(email.mascarado()).toBe('an***@gmail.com');
    expect(email.equals(Email.criar('ANA@gmail.com'))).toBe(true);
    expect(email.equals('ana@gmail.com')).toBe(false);
    expect(String(email)).toBe('ana@gmail.com');
  });

  it('é imutável', () => {
    const email = Email.criar('ana@gmail.com');
    expect(() => {
      'use strict';
      email.valor = 'outro@x.com';
    }).toThrow(TypeError);
  });
});

describe('Value Object: Celular', () => {
  it.each([
    ['(11) 98765-4321', '+5511987654321'],
    ['11987654321', '+5511987654321'],
    ['+55 21 99876-5432', '+5521998765432'],
    [11987654321, '+5511987654321'],
  ])('normaliza %p para E.164', (entrada, esperado) => {
    expect(Celular.criar(entrada).valor).toBe(esperado);
  });

  it.each(['1187654321', '(01) 98765-4321', '11 88765-4321', 'abc', '', undefined])('rejeita %p', (entrada) => {
    expect(() => Celular.criar(entrada)).toThrow(DomainValidationError);
  });

  it('mascara o número', () => {
    expect(Celular.criar('11987654321').mascarado()).toBe('+55 (11) 9****-4321');
    expect(String(Celular.criar('11987654321'))).toBe('+5511987654321');
  });
});

describe('Value Object: Senha', () => {
  it('aceita senha forte', () => {
    expect(Senha.criar('Senha@Forte123').valor).toBe('Senha@Forte123');
  });

  it('lista todos os requisitos não atendidos', () => {
    expect(Senha.verificarPolitica('abc')).toEqual(
      expect.arrayContaining(['mínimo de 8 caracteres', 'uma letra maiúscula', 'um número', 'um caractere especial']),
    );
  });

  it('rejeita senha acima de 72 bytes (limite do bcrypt)', () => {
    expect(() => Senha.criar(`Aa1@${'x'.repeat(70)}`)).toThrow(/72 bytes/);
  });

  it.each(['', null, 'semmaiuscula1!', 'SEMMINUSCULA1!', 'SemNumero!!', 'SemEspecial123'])('rejeita %p', (entrada) => {
    expect(() => Senha.criar(entrada)).toThrow(DomainValidationError);
  });

  it('nunca se revela em serialização', () => {
    const senha = Senha.criar('Senha@Forte123');
    expect(JSON.stringify({ senha })).toBe('{"senha":"[REDACTED]"}');
    expect(`${senha}`).toBe('[REDACTED]');
  });
});

describe('Value Object: Ticker', () => {
  it.each(['petr4', ' AAPL ', 'BRK.B', 'CDB-LIQ-100', 'SANB11'])('aceita %p', (entrada) => {
    expect(Ticker.criar(entrada).valor).toBe(entrada.trim().toUpperCase());
  });

  it.each(['', '-PETR4', 'PETR 4', 'A'.repeat(21), "PETR4'; DROP TABLE", 123])('rejeita %p', (entrada) => {
    expect(() => Ticker.criar(entrada)).toThrow(DomainValidationError);
  });

  it('ehValido não lança e equals compara por valor', () => {
    expect(Ticker.ehValido('vale3')).toBe(true);
    expect(Ticker.ehValido(null)).toBe(false);
    expect(Ticker.criar('vale3').equals(Ticker.criar('VALE3'))).toBe(true);
    expect(String(Ticker.criar('vale3'))).toBe('VALE3');
  });
});
