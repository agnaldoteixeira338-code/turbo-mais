-- =============================================================================
-- Turbo Mais — schema canônico (PostgreSQL 16)
-- -----------------------------------------------------------------------------
-- Este arquivo é a "foto" completa do schema atual, útil para leitura e revisão.
-- A FONTE DE VERDADE para evolução do banco são as migrations versionadas em
-- /database/migrations (aplicadas com `prisma migrate deploy`). Ver ADR-001.
--
-- Convenções:
--   * UUID v4 como PK (gen_random_uuid() é nativo desde o PG 13)
--   * TIMESTAMPTZ sempre (nunca TIMESTAMP sem fuso)
--   * CHECK constraints para regras que o banco consegue garantir sozinho
--   * Hashes de tokens armazenados (NUNCA o token em texto puro)
-- =============================================================================

-- Função utilitária: mantém atualizado_em em dia sem depender da aplicação
CREATE OR REPLACE FUNCTION set_atualizado_em() RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- Usuários
-- -----------------------------------------------------------------------------
CREATE TABLE usuarios (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             VARCHAR(254) NOT NULL,
  celular           VARCHAR(20)  NOT NULL,
  senha_hash        VARCHAR(100) NOT NULL,
  two_factor_ativo  BOOLEAN      NOT NULL DEFAULT FALSE,
  criado_em         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  atualizado_em     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT usuarios_email_formato CHECK (position('@' IN email) > 1)
);
-- Unicidade case-insensitive (Ana@x.com == ana@x.com)
CREATE UNIQUE INDEX usuarios_email_unique ON usuarios (lower(email));
CREATE TRIGGER trg_usuarios_atualizado_em BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- -----------------------------------------------------------------------------
-- Refresh tokens (rotação + detecção de reuso por "família")
-- -----------------------------------------------------------------------------
CREATE TABLE refresh_tokens (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id       UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash       CHAR(64)    NOT NULL UNIQUE,
  familia_id       UUID        NOT NULL,
  expira_em        TIMESTAMPTZ NOT NULL,
  revogado         BOOLEAN     NOT NULL DEFAULT FALSE,
  revogado_em      TIMESTAMPTZ,
  substituido_por  UUID,
  ip               VARCHAR(45),
  user_agent       VARCHAR(255),
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_usuario ON refresh_tokens (usuario_id);
CREATE INDEX idx_refresh_tokens_familia ON refresh_tokens (familia_id);
CREATE INDEX idx_refresh_tokens_expira  ON refresh_tokens (expira_em);

-- -----------------------------------------------------------------------------
-- Tokens de recuperação de senha (uso único)
-- -----------------------------------------------------------------------------
CREATE TABLE tokens_recuperacao (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash  CHAR(64)    NOT NULL UNIQUE,
  expira_em   TIMESTAMPTZ NOT NULL,
  usado       BOOLEAN     NOT NULL DEFAULT FALSE,
  usado_em    TIMESTAMPTZ,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tokens_recuperacao_usuario ON tokens_recuperacao (usuario_id) WHERE usado = FALSE;

-- -----------------------------------------------------------------------------
-- Códigos 2FA por e-mail (HMAC do código, nunca o código)
-- -----------------------------------------------------------------------------
CREATE TABLE tokens_2fa (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  codigo_hash  CHAR(64)    NOT NULL,
  finalidade   VARCHAR(20) NOT NULL CHECK (finalidade IN ('login', 'ativacao')),
  tentativas   SMALLINT    NOT NULL DEFAULT 0,
  expira_em    TIMESTAMPTZ NOT NULL,
  usado        BOOLEAN     NOT NULL DEFAULT FALSE,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tokens_2fa_pendentes ON tokens_2fa (usuario_id, finalidade, criado_em DESC) WHERE usado = FALSE;

-- -----------------------------------------------------------------------------
-- Catálogo educativo de ativos (dados de referência — vêm dos seeds)
-- -----------------------------------------------------------------------------
CREATE TABLE ativos_educativos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker            VARCHAR(20)  NOT NULL UNIQUE,
  nome              VARCHAR(120) NOT NULL,
  tipo              VARCHAR(20)  NOT NULL CHECK (tipo IN ('acao_br', 'acao_global', 'cripto', 'cdb')),
  o_que_faz         TEXT         NOT NULL,
  papel_sociedade   TEXT         NOT NULL,
  setor             VARCHAR(60)  NOT NULL,
  pais              VARCHAR(60)  NOT NULL,
  fundacao          SMALLINT     CHECK (fundacao BETWEEN 1500 AND 2100),
  perfil_risco      VARCHAR(20)  NOT NULL CHECK (perfil_risco IN ('conservador', 'moderado', 'arrojado')),
  rendimento_medio  VARCHAR(60),
  tags              TEXT[]       NOT NULL DEFAULT '{}',
  codigo_externo    VARCHAR(60),           -- ex.: id do CoinGecko ("bitcoin")
  preco_referencia  NUMERIC(18, 6),        -- base para o modo simulado (MARKET_DATA_MODE=mock)
  moeda             CHAR(3)      NOT NULL DEFAULT 'BRL',
  criado_em         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  atualizado_em     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_ativos_tipo  ON ativos_educativos (tipo);
CREATE INDEX idx_ativos_setor ON ativos_educativos (setor);
CREATE INDEX idx_ativos_tags  ON ativos_educativos USING GIN (tags);
CREATE TRIGGER trg_ativos_atualizado_em BEFORE UPDATE ON ativos_educativos
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- -----------------------------------------------------------------------------
-- Favoritos (watchlist)
-- -----------------------------------------------------------------------------
CREATE TABLE favoritos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  ticker      VARCHAR(20) NOT NULL REFERENCES ativos_educativos(ticker) ON UPDATE CASCADE,
  tipo        VARCHAR(20) NOT NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT favoritos_usuario_ticker_unique UNIQUE (usuario_id, ticker)
);
CREATE INDEX idx_favoritos_usuario_criado ON favoritos (usuario_id, criado_em DESC);

-- -----------------------------------------------------------------------------
-- Alertas de variação de preço
-- -----------------------------------------------------------------------------
CREATE TABLE alertas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id          UUID          NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  ticker              VARCHAR(20)   NOT NULL REFERENCES ativos_educativos(ticker) ON UPDATE CASCADE,
  gatilho_percentual  NUMERIC(6, 2) NOT NULL CHECK (gatilho_percentual > 0 AND gatilho_percentual <= 100),
  direcao             VARCHAR(10)   NOT NULL CHECK (direcao IN ('alta', 'baixa', 'ambas')),
  ativo               BOOLEAN       NOT NULL DEFAULT TRUE,
  criado_em           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  atualizado_em       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT alertas_unicos UNIQUE (usuario_id, ticker, direcao, gatilho_percentual)
);
CREATE INDEX idx_alertas_usuario ON alertas (usuario_id, criado_em DESC);
-- Índice parcial usado a cada 60s pelo priceWatcher: só alertas ativos importam
CREATE INDEX idx_alertas_ticker_ativos ON alertas (ticker) WHERE ativo = TRUE;
CREATE TRIGGER trg_alertas_atualizado_em BEFORE UPDATE ON alertas
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- -----------------------------------------------------------------------------
-- Notificações (idempotentes via hash_idempotencia UNIQUE — ver ADR-008)
-- -----------------------------------------------------------------------------
CREATE TABLE notificacoes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id         UUID          NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  alerta_id          UUID          REFERENCES alertas(id) ON DELETE SET NULL,
  ticker             VARCHAR(20)   NOT NULL,
  variacao           NUMERIC(8, 2) NOT NULL,
  direcao            VARCHAR(10)   NOT NULL CHECK (direcao IN ('alta', 'baixa')),
  preco              NUMERIC(18, 6),
  lida               BOOLEAN       NOT NULL DEFAULT FALSE,
  hash_idempotencia  CHAR(64)      NOT NULL UNIQUE,
  criado_em          TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_notificacoes_usuario_criado ON notificacoes (usuario_id, criado_em DESC);
CREATE INDEX idx_notificacoes_nao_lidas ON notificacoes (usuario_id) WHERE lida = FALSE;

-- -----------------------------------------------------------------------------
-- Ideias (texto livre do usuário) e sugestões geradas
-- -----------------------------------------------------------------------------
CREATE TABLE ideias (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  texto_descrito  TEXT        NOT NULL CHECK (char_length(texto_descrito) BETWEEN 3 AND 1000),
  palavras_chave  TEXT[]      NOT NULL DEFAULT '{}',
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ideias_usuario_criado ON ideias (usuario_id, criado_em DESC);

CREATE TABLE sugestoes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ideia_id       UUID          NOT NULL REFERENCES ideias(id) ON DELETE CASCADE,
  ticker         VARCHAR(20)   NOT NULL,
  score          NUMERIC(6, 2) NOT NULL,
  posicao        SMALLINT      NOT NULL CHECK (posicao BETWEEN 1 AND 10),
  justificativa  TEXT          NOT NULL,
  criado_em      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT sugestoes_posicao_unica UNIQUE (ideia_id, posicao)
);

-- -----------------------------------------------------------------------------
-- Audit log (append-only). ON DELETE SET NULL de propósito: a trilha de
-- auditoria precisa sobreviver à exclusão da conta (ver SECURITY.md).
-- -----------------------------------------------------------------------------
CREATE TABLE audit_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id  UUID         REFERENCES usuarios(id) ON DELETE SET NULL,
  acao        VARCHAR(60)  NOT NULL,
  ip          VARCHAR(45),
  user_agent  VARCHAR(255),
  request_id  VARCHAR(64),
  metadados   JSONB        NOT NULL DEFAULT '{}'::jsonb,
  criado_em   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_usuario_criado ON audit_log (usuario_id, criado_em DESC);
CREATE INDEX idx_audit_acao_criado    ON audit_log (acao, criado_em DESC);
