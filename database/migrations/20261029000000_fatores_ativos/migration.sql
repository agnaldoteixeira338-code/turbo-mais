-- Migration aditiva (expand): o que costuma fazer o preço de cada ativo subir ou cair (ADR-015).
-- Só ADICIONA colunas com valor padrão: o código antigo continua funcionando (ADR-010).
ALTER TABLE ativos_educativos
  ADD COLUMN IF NOT EXISTS fatores_alta  TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fatores_baixa TEXT[] NOT NULL DEFAULT '{}';
