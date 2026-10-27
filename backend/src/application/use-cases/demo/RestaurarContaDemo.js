const { ACOES_AUDITORIA, LIMITES } = require('../../../shared/constants');
const { auditar } = require('../auditar');
const { normalizarEmailDemo } = require('../contaDemo');

/**
 * Estado de exemplo da conta demo: o que um recrutador vê ao clicar em
 * "Entrar como visitante". Um ativo de cada tipo, dois alertas e uma ideia.
 */
const ESTADO_DEMO = Object.freeze({
  favoritos: Object.freeze(['PETR4', 'WEGE3', 'NVDA', 'BTC', 'CDB-LIQ-100']),
  alertas: Object.freeze([
    Object.freeze({ ticker: 'PETR4', gatilhoPercentual: 2, direcao: 'ambas' }),
    Object.freeze({ ticker: 'BTC', gatilhoPercentual: 3, direcao: 'ambas' }),
  ]),
  ideia: 'Quero renda passiva com dividendos e pouco risco, pensando no longo prazo',
});

/**
 * Restaura a conta demo para o ESTADO_DEMO (ADR-013). Chamado pelo job
 * agendado `restaurar-conta-demo`.
 *
 * - Tudo numa transação: quem entrar durante a restauração vê o estado antigo
 *   ou o novo, nunca a conta vazia ou pela metade. Se algo falhar, nada muda.
 * - Idempotente: apaga e recria sempre o mesmo conteúdo, então rodar duas
 *   vezes (ou em duas réplicas) dá o mesmo resultado.
 * - Só toca nas linhas da conta demo (todo DELETE filtra por usuario_id).
 *   Não apaga o audit_log nem as sessões abertas dos visitantes.
 * - As sugestões vêm do MotorDeSugestoes de verdade, com o catálogo atual.
 */
class RestaurarContaDemo {
  constructor({ usuarioRepository, ativoRepository, unitOfWork, motorDeSugestoes, auditLog, logger, emailDemo }) {
    this.usuarioRepository = usuarioRepository;
    this.ativoRepository = ativoRepository;
    this.unitOfWork = unitOfWork;
    this.motorDeSugestoes = motorDeSugestoes;
    this.auditLog = auditLog;
    this.logger = logger;
    this.emailDemo = normalizarEmailDemo(emailDemo);
  }

  async execute() {
    if (!this.emailDemo) {
      this.logger?.info('restauração da conta demo ignorada: DEMO_USER_EMAIL vazio');
      return { restaurada: false, motivo: 'desligado' };
    }
    const usuario = await this.usuarioRepository.buscarPorEmail(this.emailDemo);
    if (!usuario) {
      this.logger?.warn('restauração da conta demo ignorada: conta demo não existe');
      return { restaurada: false, motivo: 'conta_inexistente' };
    }

    // Leituras e o motor ficam FORA da transação: ela segura só as escritas
    const catalogo = await this.ativoRepository.listarTodos();
    const tipoPorTicker = new Map(catalogo.map((a) => [a.ticker, a.tipo]));
    const favoritos = ESTADO_DEMO.favoritos.filter((t) => tipoPorTicker.has(t));
    const alertas = ESTADO_DEMO.alertas.filter((a) => tipoPorTicker.has(a.ticker));
    const ausentes = ESTADO_DEMO.favoritos.length - favoritos.length;
    if (ausentes > 0) this.logger?.warn({ ausentes }, 'conta demo: tickers de exemplo fora do catálogo foram ignorados');
    const { palavrasChave, sugestoes } = this.motorDeSugestoes.sugerir(ESTADO_DEMO.ideia, catalogo, { limite: LIMITES.SUGESTOES_POR_IDEIA });

    const removidos = await this.unitOfWork.run(async (repos) => {
      const apagados = {
        notificacoes: await repos.notificacoes.removerTodasDoUsuario(usuario.id),
        alertas: await repos.alertas.removerTodosDoUsuario(usuario.id),
        favoritos: await repos.favoritos.removerTodosDoUsuario(usuario.id),
        ideias: await repos.ideias.removerTodasDoUsuario(usuario.id),
      };
      for (const ticker of favoritos) {
        await repos.favoritos.adicionar({ usuarioId: usuario.id, ticker, tipo: tipoPorTicker.get(ticker) });
      }
      for (const alerta of alertas) {
        await repos.alertas.criar({ usuarioId: usuario.id, ...alerta });
      }
      const ideia = await repos.ideias.criar({ usuarioId: usuario.id, textoDescrito: ESTADO_DEMO.ideia, palavrasChave });
      if (sugestoes.length > 0) await repos.ideias.adicionarSugestoes(ideia.id, sugestoes);
      await repos.usuarios.atualizarDoisFatores(usuario.id, false);
      return apagados;
    });

    const resumo = { restaurada: true, removidos, criados: { favoritos: favoritos.length, alertas: alertas.length, ideias: 1, sugestoes: sugestoes.length } };
    await auditar(this.auditLog, ACOES_AUDITORIA.CONTA_DEMO_RESTAURADA, {}, { usuarioId: usuario.id, metadados: { removidos } });
    this.logger?.info({ removidos, criados: resumo.criados }, 'conta demo restaurada');
    return resumo;
  }
}

module.exports = { RestaurarContaDemo, ESTADO_DEMO };
