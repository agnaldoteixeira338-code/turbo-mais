/** Registra duração e contagem por rota (padrão da rota, não a URL real). */
function httpMetrics(metrics) {
  return (req, res, next) => {
    const inicio = process.hrtime.bigint();
    res.on('finish', () => {
      const rota = req.route ? `${req.baseUrl}${req.route.path}` : 'nao_mapeada';
      const labels = { metodo: req.method, rota, status: String(res.statusCode) };
      const segundos = Number(process.hrtime.bigint() - inicio) / 1e9;
      metrics.httpDuracao.observe(labels, segundos);
      metrics.httpTotal.inc(labels);
    });
    next();
  };
}

module.exports = { httpMetrics };
