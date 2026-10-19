/**
 * Compõe provedores de dados em ordem de preferência: cada método tenta o
 * primeiro e, se ele falhar, passa para o próximo. Cada provedor mantém o seu
 * próprio circuit breaker, então um reserva fora do ar falha rápido.
 *
 * Uso atual (ADR-012): ações globais = BDR na B3 via brapi → Alpha Vantage.
 */
function criarProvedorComFallback(provedores, { logger } = {}) {
  if (!provedores.length) throw new Error('Informe ao menos um provedor');

  const tentar = (metodo) => async (...args) => {
    let ultimoErro;
    for (const provedor of provedores) {
      try {
        return await provedor[metodo](...args);
      } catch (err) {
        ultimoErro = err;
        logger?.warn({ provedor: provedor.nome, metodo, erro: err.message }, 'provedor falhou; tentando o reserva');
      }
    }
    throw ultimoErro;
  };

  return {
    nome: provedores.map((p) => p.nome).join('+'),
    buscarCotacao: tentar('buscarCotacao'),
    buscarHistorico: tentar('buscarHistorico'),
    buscarIndicadores: tentar('buscarIndicadores'),
  };
}

module.exports = { criarProvedorComFallback };
