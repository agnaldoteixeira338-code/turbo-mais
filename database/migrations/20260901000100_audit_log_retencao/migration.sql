-- Migration aditiva (expand): índice para a rotina de retenção do audit log.
-- Exemplo de migration "segura para rollback": só ADICIONA, nunca remove/renomeia
-- (padrão expand/contract — ver ADR-010).
CREATE INDEX IF NOT EXISTS idx_audit_criado_em ON audit_log (criado_em);
