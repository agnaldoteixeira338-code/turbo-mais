const { agendarRestauracaoDemo, ID_AGENDADOR } = require('../../../src/infrastructure/queue/workers/demoResetWorker');

const filaFalsa = () => ({ upsertJobScheduler: jest.fn(async () => {}), removeJobScheduler: jest.fn(async () => true) });

describe('agendarRestauracaoDemo', () => {
  it('registra UM agendamento repetível via upsertJobScheduler (idempotente entre réplicas)', async () => {
    const fila = filaFalsa();
    await expect(agendarRestauracaoDemo(fila, 3_600_000)).resolves.toBe(true);
    // a segunda réplica subindo usa o MESMO id: o BullMQ atualiza em vez de duplicar
    await agendarRestauracaoDemo(fila, 3_600_000);
    expect(fila.upsertJobScheduler).toHaveBeenCalledTimes(2);
    for (const chamada of fila.upsertJobScheduler.mock.calls) {
      expect(chamada).toEqual([ID_AGENDADOR, { every: 3_600_000 }, { name: ID_AGENDADOR }]);
    }
    expect(fila.removeJobScheduler).not.toHaveBeenCalled();
  });

  it('intervalo 0 desliga: remove o agendamento antigo em vez de criar', async () => {
    const fila = filaFalsa();
    await expect(agendarRestauracaoDemo(fila, 0)).resolves.toBe(false);
    expect(fila.removeJobScheduler).toHaveBeenCalledWith(ID_AGENDADOR);
    expect(fila.upsertJobScheduler).not.toHaveBeenCalled();
  });
});
