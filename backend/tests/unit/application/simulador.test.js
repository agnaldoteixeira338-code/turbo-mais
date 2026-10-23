const { SimularInvestimento } = require('../../../src/application/use-cases/simulador/SimularInvestimento');
const { ObterTaxasDoSimulador } = require('../../../src/application/use-cases/simulador/ObterTaxasDoSimulador');
const { SimuladorDeInvestimentos } = require('../../../src/domain/services/SimuladorDeInvestimentos');
const { DomainValidationError } = require('../../../src/domain/errors/DomainValidationError');

const TAXAS = { selicMeta: 12, cdi: 12, trMensal: 0, dataReferencia: '2026-10-23', origem: 'banco-central', referencia: false, desatualizado: false };
const gatewayCom = (taxas = TAXAS) => ({ obterTaxas: jest.fn().mockResolvedValue(taxas) });

describe('SimularInvestimento', () => {
  it('converte as taxas de % para fração na fronteira e devolve a comparação com as taxas usadas', async () => {
    const simulador = new SimuladorDeInvestimentos();
    const spy = jest.spyOn(simulador, 'simular');
    const uc = new SimularInvestimento({ taxasGateway: gatewayCom(), simulador });

    const r = await uc.execute({ valorInicial: 1000, prazoMeses: 1 });

    expect(spy).toHaveBeenCalledWith({ valorInicial: 1000, aporteMensal: 0, prazoMeses: 1, taxas: { selicMeta: 0.12, cdi: 0.12, trMensal: 0 } });
    expect(r.taxas).toEqual(TAXAS);
    expect(r.modalidades.map((m) => m.id)).toEqual(['poupanca', 'cdb-100', 'cdb-110', 'tesouro-selic', 'lci-lca']);
    expect(r.modalidades.find((m) => m.id === 'cdb-100').valorLiquido).toBe(1007.36);
  });

  it('com taxas de referência (Banco Central fora), calcula do mesmo jeito e repassa a marcação', async () => {
    const referencia = { ...TAXAS, origem: 'padrao', referencia: true, dataReferencia: null };
    const r = await new SimularInvestimento({ taxasGateway: gatewayCom(referencia), simulador: new SimuladorDeInvestimentos() }).execute({ valorInicial: 500, aporteMensal: 100, prazoMeses: 6 });
    expect(r.taxas).toMatchObject({ origem: 'padrao', referencia: true });
    expect(r.totalInvestido).toBe(1100);
  });

  it('regra de negócio violada sobe como DomainValidationError (422)', async () => {
    const uc = new SimularInvestimento({ taxasGateway: gatewayCom(), simulador: new SimuladorDeInvestimentos() });
    await expect(uc.execute({ valorInicial: 0, aporteMensal: 0, prazoMeses: 12 })).rejects.toBeInstanceOf(DomainValidationError);
  });
});

describe('ObterTaxasDoSimulador', () => {
  it('repassa as taxas do gateway', async () => {
    await expect(new ObterTaxasDoSimulador({ taxasGateway: gatewayCom() }).execute()).resolves.toEqual(TAXAS);
  });
});
