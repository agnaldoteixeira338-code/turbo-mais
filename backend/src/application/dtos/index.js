const { z } = require('zod');
const { TIPOS_ATIVO } = require('../../domain/entities/AtivoEducativo');
const { DIRECOES } = require('../../domain/entities/Alerta');
const { TICKER_REGEX } = require('../../domain/value-objects/Ticker');

/**
 * Schemas Zod = contrato de ENTRADA da API.
 *
 * Duas camadas de validação, com papéis diferentes:
 *   - Zod (aqui): formato/tipo/tamanho → 400. Barato, roda antes de tudo.
 *   - Value Objects/Entidades (domínio): regra de negócio → 422.
 * `.strict()` rejeita campos desconhecidos (mass assignment, OWASP API6).
 */

const ticker = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .transform((v) => v.toUpperCase())
  .refine((v) => TICKER_REGEX.test(v), 'Ticker inválido');

const uuid = z.string().uuid('ID inválido');

const paginacao = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const auth = {
  cadastro: z
    .object({
      email: z.string().trim().max(254),
      celular: z.string().trim().max(25),
      senha: z.string().min(1).max(128),
    })
    .strict(),
  login: z
    .object({
      email: z.string().trim().max(254),
      senha: z.string().min(1).max(128),
    })
    .strict(),
  esqueciSenha: z.object({ email: z.string().trim().max(254) }).strict(),
  resetarSenha: z
    .object({
      token: z.string().min(20).max(2048),
      novaSenha: z.string().min(1).max(128),
    })
    .strict(),
  ativar2FA: z.object({ codigo: z.string().regex(/^\d{6}$/, 'Código deve ter 6 dígitos').optional() }).strict(),
  validar2FA: z
    .object({
      desafioToken: z.string().min(20).max(2048),
      codigo: z.string().regex(/^\d{6}$/, 'Código deve ter 6 dígitos'),
    })
    .strict(),
};

const favoritos = {
  adicionar: z.object({ ticker }).strict(),
  params: z.object({ ticker }),
  listar: paginacao.extend({ tipo: z.enum(TIPOS_ATIVO).optional() }),
};

const alertas = {
  criar: z
    .object({
      ticker,
      gatilhoPercentual: z.coerce.number().positive().max(100),
      direcao: z.enum(DIRECOES),
    })
    .strict(),
  atualizar: z
    .object({
      gatilhoPercentual: z.coerce.number().positive().max(100).optional(),
      direcao: z.enum(DIRECOES).optional(),
      ativo: z.boolean().optional(),
    })
    .strict()
    .refine((v) => Object.keys(v).length > 0, 'Informe ao menos um campo para atualizar'),
  params: z.object({ id: uuid }),
  listar: paginacao,
};

const notificacoes = {
  listar: paginacao.extend({
    naoLidas: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v === 'true'),
  }),
  params: z.object({ id: uuid }),
};

const ativos = {
  buscar: paginacao.extend({
    q: z.string().trim().max(60).optional(),
    tipo: z.enum(TIPOS_ATIVO).optional(),
    setor: z.string().trim().max(60).optional(),
  }),
  params: z.object({ ticker }),
  detalhe: z.object({ dias: z.coerce.number().int().min(7).max(365).default(30) }),
};

const ideias = {
  criar: z.object({ texto: z.string().trim().min(3, 'Descreva sua ideia com pelo menos 3 caracteres').max(1000) }).strict(),
  listar: paginacao,
};

module.exports = { paginacao, auth, favoritos, alertas, notificacoes, ativos, ideias };
