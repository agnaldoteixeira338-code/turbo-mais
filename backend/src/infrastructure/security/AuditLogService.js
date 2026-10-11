/**
 * Implementação da porta AuditLog.
 *
 * Regra de ouro: auditoria NUNCA derruba a operação principal. Se o INSERT
 * falhar, o evento vai para o log estruturado (nível error, com marcador
 * `auditoria: true`) — que é coletado e retido à parte — e a requisição segue.
 */
class AuditLogService {
  constructor({ auditLogRepository, logger }) {
    this.auditLogRepository = auditLogRepository;
    this.logger = logger;
  }

  async registrar(entrada) {
    try {
      await this.auditLogRepository.registrar(entrada);
    } catch (err) {
      this.logger?.error({ err, auditoria: true, acao: entrada.acao, usuarioId: entrada.usuarioId }, 'falha ao gravar audit log');
    }
  }
}

module.exports = { AuditLogService };
