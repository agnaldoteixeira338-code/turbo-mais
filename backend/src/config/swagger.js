/**
 * Documento OpenAPI 3.0 da API v1 (servido em /api/docs e /api/docs.json).
 *
 * Escrito como objeto JS (e não gerado de comentários JSDoc espalhados) para
 * ficar revisável em um lugar só. A extensão `x-rate-limit` documenta o
 * perfil de rate limit de cada rota.
 */
const RL = {
  global: '300 req / 15 min por IP',
  auth: '10 req / 15 min por IP',
  sensivel: '5 req / 60 min por IP',
  usuario: '120 req / min por usuário',
};

const ref = (nome) => ({ $ref: `#/components/schemas/${nome}` });
const json = (schema) => ({ 'application/json': { schema } });
const envelope = (dataSchema, comMeta = false) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: dataSchema,
    error: { type: 'object', nullable: true, example: null },
    meta: comMeta ? ref('MetaPaginacao') : { type: 'object', nullable: true, example: null },
  },
});
const ok = (descricao, dataSchema, comMeta) => ({ description: descricao, content: json(envelope(dataSchema, comMeta)) });
const erro = (descricao) => ({ description: descricao, content: json(ref('Erro')) });

const ERROS_COMUNS = {
  400: erro('Dados inválidos (validação Zod)'),
  401: erro('Não autenticado / token inválido'),
  429: erro('Rate limit excedido (header Retry-After)'),
  500: erro('Erro interno (mensagem genérica, sem stack trace)'),
};

const paginacao = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
];
const idempotencyKey = {
  name: 'Idempotency-Key',
  in: 'header',
  required: false,
  description: 'Chave única por operação (8-128 chars). Retries com a mesma chave devolvem a mesma resposta.',
  schema: { type: 'string', example: '2f1c8a9e-6c1b-4f7e-9a51-7f0e4b3f2d11' },
};
const seguro = [{ bearerAuth: [] }];

function rotaLista(resumo, tag) {
  return {
    get: {
      tags: [tag],
      summary: resumo,
      security: seguro,
      'x-rate-limit': RL.usuario,
      parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }, ...paginacao],
      responses: { 200: ok('Lista paginada com cotações', { type: 'array', items: ref('AtivoResumo') }, true), ...ERROS_COMUNS },
    },
  };
}

function criarDocumentoOpenApi() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Turbo Mais API',
      version: '1.0.0',
      description:
        'Acelere suas decisões de investimento.\n\n**O Turbo Mais NÃO compra, NÃO vende e NÃO move dinheiro.** ' +
        'É um painel de consulta, watchlist, alertas e sugestões educativas.\n\n' +
        'Todas as respostas seguem o envelope `{ success, data, error, meta }`. ' +
        'Rate limits estão na extensão `x-rate-limit` de cada operação.',
      license: { name: 'MIT' },
    },
    servers: [{ url: '/', description: 'Servidor atual' }],
    tags: [
      { name: 'Auth' }, { name: 'Ativos' }, { name: 'Favoritos' }, { name: 'Alertas' },
      { name: 'Notificações' }, { name: 'Ideias' }, { name: 'Simulador' }, { name: 'Observabilidade' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Access token (15 min)' },
        csrf: { type: 'apiKey', in: 'header', name: 'X-CSRF-Token', description: 'Valor do cookie csrf_token / __Host-csrf' },
      },
      schemas: {
        Erro: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            data: { nullable: true, example: null },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'DADOS_INVALIDOS' },
                message: { type: 'string', example: 'Dados inválidos' },
                details: { type: 'array', items: { type: 'object' } },
                requestId: { type: 'string', example: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed' },
              },
            },
            meta: { nullable: true, example: null },
          },
        },
        MetaPaginacao: {
          type: 'object',
          properties: { page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' } },
        },
        Usuario: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            celular: { type: 'string', example: '+5511987654321' },
            twoFactorAtivo: { type: 'boolean' },
            criadoEm: { type: 'string', format: 'date-time' },
          },
        },
        Sessao: {
          type: 'object',
          properties: { usuario: ref('Usuario'), accessToken: { type: 'string' }, expiresIn: { type: 'integer', example: 900 } },
        },
        TaxasSimulador: {
          type: 'object',
          properties: {
            selicMeta: { type: 'number', example: 13.75, description: '% a.a. (SGS 432)' },
            cdi: { type: 'number', example: 13.65, description: '% a.a. (SGS 4389)' },
            trMensal: { type: 'number', example: 0.1616, description: '% a.m. (SGS 7811)' },
            dataReferencia: { type: 'string', format: 'date', nullable: true, example: '2026-10-23' },
            origem: { type: 'string', enum: ['banco-central', 'cache', 'padrao'] },
            referencia: { type: 'boolean', description: 'true = Banco Central indisponível e sem cache: taxas padrão configuradas' },
            desatualizado: { type: 'boolean', description: 'true = último valor conhecido após falha do Banco Central' },
          },
        },
        ModalidadeSimulada: {
          type: 'object',
          properties: {
            id: { type: 'string', enum: ['poupanca', 'cdb-100', 'cdb-110', 'tesouro-selic', 'lci-lca'] },
            nome: { type: 'string', example: 'CDB 110% do CDI' },
            isentaIR: { type: 'boolean' },
            disponivel: { type: 'boolean', description: 'false = prazo menor que a carência (LCI/LCA: 6 meses); os valores vêm null' },
            motivoIndisponivel: { type: 'string', nullable: true, example: 'LCI e LCA têm prazo mínimo de 6 meses (Resolução CMN 5.215/2025). Escolha um prazo de pelo menos 6 meses.' },
            carenciaMeses: { type: 'integer', example: 0, description: 'prazo mínimo de cada aporte (LCI/LCA: 6)' },
            taxaMensalPercentual: { type: 'number', nullable: true, example: 1.18 },
            totalInvestido: { type: 'number', nullable: true, example: 10000 },
            valorBruto: { type: 'number', nullable: true, example: 11508.12 },
            irPago: { type: 'number', nullable: true, example: 263.92 },
            custodia: { type: 'number', nullable: true, example: 0, description: 'custódia B3 (só Tesouro Selic, acima de R$ 10 mil)' },
            valorLiquido: { type: 'number', nullable: true, example: 11244.2, description: 'valorResgatavel + valorEmCarencia' },
            valorResgatavel: { type: 'number', nullable: true, example: 11244.2, description: 'o que pode ser resgatado no fim do prazo' },
            valorEmCarencia: { type: 'number', nullable: true, example: 0, description: 'aportes que ainda não cumpriram a carência no fim do prazo' },
            rendimentoLiquido: { type: 'number', nullable: true, example: 1244.2 },
            rendimentoLiquidoPercentual: { type: 'number', nullable: true, example: 12.44 },
            serie: {
              type: 'array',
              items: { type: 'object', properties: { mes: { type: 'integer' }, investido: { type: 'number' }, liquido: { type: 'number' } } },
            },
          },
        },
        Cotacao: {
          type: 'object',
          nullable: true,
          properties: {
            preco: { type: 'number', nullable: true, example: 37.95 },
            variacaoPercentual: { type: 'number', nullable: true, example: -1.23 },
            moeda: { type: 'string', example: 'BRL' },
            rendimento: { type: 'string', nullable: true, example: '100% do CDI' },
            atualizadoEm: { type: 'string', format: 'date-time', nullable: true },
            fonte: { type: 'string', example: 'brapi' },
            desatualizado: { type: 'boolean', description: 'true = servido do cache após falha da API' },
            indisponivel: { type: 'boolean' },
            simulado: { type: 'boolean', description: 'true = dado simulado (modo demo)' },
          },
        },
        AtivoResumo: {
          type: 'object',
          properties: {
            ticker: { type: 'string', example: 'PETR4' },
            nome: { type: 'string' },
            tipo: { type: 'string', enum: ['acao_br', 'acao_global', 'cripto', 'cdb'] },
            setor: { type: 'string' },
            pais: { type: 'string' },
            perfilRisco: { type: 'string', enum: ['conservador', 'moderado', 'arrojado'] },
            rendimentoMedio: { type: 'string', nullable: true },
            cotacao: ref('Cotacao'),
          },
        },
        AtivoDetalhe: {
          allOf: [
            ref('AtivoResumo'),
            {
              type: 'object',
              properties: {
                oQueFaz: { type: 'string' },
                papelSociedade: { type: 'string' },
                fundacao: { type: 'integer', nullable: true },
                tags: { type: 'array', items: { type: 'string' } },
                fatores: {
                  type: 'object',
                  description: 'O que costuma fazer o preço subir/cair (renda fixa: render mais/menos). Educativo, não é previsão (ADR-015).',
                  properties: {
                    alta: { type: 'array', items: { type: 'string' }, example: ['Petróleo caro no mercado internacional'] },
                    baixa: { type: 'array', items: { type: 'string' }, example: ['Petróleo em queda'] },
                  },
                },
                comportamento: {
                  type: 'object',
                  nullable: true,
                  description: 'Estatísticas do último ano de preços (null para renda fixa ou com menos de 60 pontos). Descreve o passado; não é probabilidade (ADR-015).',
                  properties: {
                    periodo: { type: 'object', properties: { inicio: { type: 'string', format: 'date' }, fim: { type: 'string', format: 'date' }, pontos: { type: 'integer' } } },
                    variacaoPercentual: { type: 'number', example: 12.3 },
                    mesesEmAlta: { type: 'integer', example: 7 },
                    mesesNoPeriodo: { type: 'integer', example: 13 },
                    diasEmAltaPercentual: { type: 'number', example: 51.2 },
                    oscilacaoDiariaPercentual: { type: 'number', example: 1.9 },
                    volatilidadeAnualPercentual: { type: 'number', example: 30.1 },
                    maiorQuedaPercentual: { type: 'number', example: -18.4 },
                    melhorMes: { type: 'object', properties: { mes: { type: 'string', example: '2026-03' }, variacaoPercentual: { type: 'number' } } },
                    piorMes: { type: 'object', properties: { mes: { type: 'string', example: '2026-07' }, variacaoPercentual: { type: 'number' } } },
                    nivel: { type: 'object', properties: { codigo: { type: 'string', enum: ['baixa', 'moderada', 'alta', 'muito-alta'] }, rotulo: { type: 'string' } } },
                  },
                },
                historico: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    pontos: { type: 'array', items: { type: 'object', properties: { data: { type: 'string' }, preco: { type: 'number' } } } },
                    desatualizado: { type: 'boolean' },
                  },
                },
                indicadores: {
                  type: 'object',
                  nullable: true,
                  properties: { pl: { type: 'number', nullable: true }, dividendYield: { type: 'number', nullable: true }, marketCap: { type: 'number', nullable: true } },
                },
              },
            },
          ],
        },
        Alerta: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            ticker: { type: 'string' },
            gatilhoPercentual: { type: 'number', example: 3 },
            direcao: { type: 'string', enum: ['alta', 'baixa', 'ambas'] },
            ativo: { type: 'boolean' },
            criadoEm: { type: 'string', format: 'date-time' },
          },
        },
        Notificacao: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            ticker: { type: 'string' },
            variacao: { type: 'number', example: -3.4 },
            direcao: { type: 'string', enum: ['alta', 'baixa'] },
            preco: { type: 'number', nullable: true },
            lida: { type: 'boolean' },
            criadoEm: { type: 'string', format: 'date-time' },
          },
        },
        Ideia: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            texto: { type: 'string' },
            palavrasChave: { type: 'array', items: { type: 'string' } },
            sugestoes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  ticker: { type: 'string' }, nome: { type: 'string' }, tipo: { type: 'string' },
                  score: { type: 'number' }, posicao: { type: 'integer' },
                  justificativa: { type: 'string', example: 'Combina com você porque você mencionou "dividendos"...' },
                },
              },
            },
          },
        },
      },
    },
    paths: {
      '/api/v1/auth/cadastro': {
        post: {
          tags: ['Auth'], summary: 'Cadastro (e-mail, celular, senha)', 'x-rate-limit': RL.auth,
          requestBody: { required: true, content: json({ type: 'object', required: ['email', 'celular', 'senha'], properties: { email: { type: 'string', example: 'ana@exemplo.com' }, celular: { type: 'string', example: '(11) 98765-4321' }, senha: { type: 'string', example: 'Senha@Forte123' } } }) },
          responses: { 201: ok('Usuário criado', { type: 'object', properties: { usuario: ref('Usuario') } }), 409: erro('E-mail já cadastrado'), 422: erro('Senha fraca / celular inválido'), ...ERROS_COMUNS },
        },
      },
      '/api/v1/auth/login': {
        post: {
          tags: ['Auth'], summary: 'Login. Se 2FA ativo, retorna desafioToken em vez da sessão', 'x-rate-limit': RL.auth,
          description: 'Bloqueia a conta por 15 min após 5 falhas. Define cookies httpOnly `refresh_token` e `csrf_token`.',
          requestBody: { required: true, content: json({ type: 'object', properties: { email: { type: 'string' }, senha: { type: 'string' } } }) },
          responses: { 200: ok('Sessão criada ou desafio 2FA', { oneOf: [ref('Sessao'), { type: 'object', properties: { requer2FA: { type: 'boolean' }, desafioToken: { type: 'string' } } }] }), ...ERROS_COMUNS },
        },
      },
      '/api/v1/auth/visitante': {
        post: {
          tags: ['Auth'], summary: 'Entra na conta de demonstração sem senha ("Entrar como visitante")', 'x-rate-limit': RL.auth,
          description: 'Só abre sessão na conta definida em `DEMO_USER_EMAIL`; sem 2FA e sem passar pelo bloqueio por senha errada. Define os mesmos cookies do login.',
          responses: { 200: ok('Sessão criada', ref('Sessao')), 404: erro('Acesso de visitante desligado ou conta demo inexistente'), 429: erro('Limite de tentativas') },
        },
      },
      '/api/v1/auth/refresh': {
        post: {
          tags: ['Auth'], summary: 'Rotaciona o refresh token (cookie) e emite novo access token', security: [{ csrf: [] }], 'x-rate-limit': RL.global,
          description: 'Reuso de um refresh token já rotacionado revoga toda a família de sessões (detecção de roubo).',
          responses: { 200: ok('Nova sessão', ref('Sessao')), 401: erro('Sessão expirada/revogada'), 403: erro('CSRF inválido') },
        },
      },
      '/api/v1/auth/logout': {
        post: { tags: ['Auth'], summary: 'Revoga o refresh token atual (idempotente)', security: [{ csrf: [] }], 'x-rate-limit': RL.global, responses: { 204: { description: 'Sessão encerrada' }, 403: erro('CSRF inválido') } },
      },
      '/api/v1/auth/esqueci-senha': {
        post: {
          tags: ['Auth'], summary: 'Envia link de redefinição (resposta idêntica exista ou não a conta)', 'x-rate-limit': RL.sensivel,
          description: 'Para a conta de demonstração nenhum e-mail é enviado, mas a resposta é a mesma (sem enumeração).',
          requestBody: { required: true, content: json({ type: 'object', properties: { email: { type: 'string' } } }) },
          responses: { 202: ok('Pedido aceito', { type: 'object', properties: { mensagem: { type: 'string' } } }), ...ERROS_COMUNS },
        },
      },
      '/api/v1/auth/resetar-senha': {
        post: {
          tags: ['Auth'], summary: 'Define nova senha com o token do e-mail (uso único, 15 min)', 'x-rate-limit': RL.sensivel,
          requestBody: { required: true, content: json({ type: 'object', properties: { token: { type: 'string' }, novaSenha: { type: 'string' } } }) },
          responses: { 200: ok('Senha redefinida; todas as sessões revogadas', { type: 'object' }), ...ERROS_COMUNS },
        },
      },
      '/api/v1/auth/2fa/ativar': {
        post: {
          tags: ['Auth'], summary: 'Ativa 2FA: sem código envia e-mail (202); com código confirma (200)', security: seguro, 'x-rate-limit': RL.usuario,
          requestBody: { content: json({ type: 'object', properties: { codigo: { type: 'string', example: '123456' } } }) },
          responses: { 200: ok('2FA ativado', { type: 'object' }), 202: ok('Código enviado', { type: 'object' }), 403: erro('CONTA_DEMO_PROTEGIDA: a conta de demonstração não pode ativar o 2FA'), 409: erro('2FA já ativo'), ...ERROS_COMUNS },
        },
      },
      '/api/v1/auth/2fa/validar': {
        post: {
          tags: ['Auth'], summary: 'Segunda etapa do login com 2FA', 'x-rate-limit': RL.auth,
          requestBody: { required: true, content: json({ type: 'object', properties: { desafioToken: { type: 'string' }, codigo: { type: 'string' } } }) },
          responses: { 200: ok('Sessão criada', ref('Sessao')), ...ERROS_COMUNS },
        },
      },
      '/api/v1/auth/me': {
        get: { tags: ['Auth'], summary: 'Usuário autenticado', security: seguro, 'x-rate-limit': RL.usuario, responses: { 200: ok('Usuário', { type: 'object', properties: { usuario: ref('Usuario') } }), ...ERROS_COMUNS } },
      },
      '/api/v1/ativos': {
        get: {
          tags: ['Ativos'], summary: 'Busca no catálogo com cotações', security: seguro, 'x-rate-limit': RL.usuario,
          parameters: [
            { name: 'q', in: 'query', schema: { type: 'string' } },
            { name: 'tipo', in: 'query', schema: { type: 'string', enum: ['acao_br', 'acao_global', 'cripto', 'cdb'] } },
            { name: 'setor', in: 'query', schema: { type: 'string' } },
            ...paginacao,
          ],
          responses: { 200: ok('Lista paginada', { type: 'array', items: ref('AtivoResumo') }, true), ...ERROS_COMUNS },
        },
      },
      '/api/v1/ativos/acoes-brasileiras': rotaLista('Ações da B3', 'Ativos'),
      '/api/v1/ativos/acoes-globais': rotaLista('Ações globais (EUA)', 'Ativos'),
      '/api/v1/ativos/criptomoedas': rotaLista('Criptomoedas', 'Ativos'),
      '/api/v1/ativos/cdbs': rotaLista('CDBs (exemplos didáticos)', 'Ativos'),
      '/api/v1/ativos/bancos': rotaLista('Bancos (setor financeiro)', 'Ativos'),
      '/api/v1/ativos/{ticker}': {
        get: {
          tags: ['Ativos'], summary: 'Detalhe educativo + cotação + histórico + indicadores + comportamento no último ano + fatores de alta/baixa', security: seguro, 'x-rate-limit': RL.usuario,
          parameters: [
            { name: 'ticker', in: 'path', required: true, schema: { type: 'string', example: 'PETR4' } },
            { name: 'dias', in: 'query', schema: { type: 'integer', minimum: 7, maximum: 365, default: 30 } },
          ],
          responses: { 200: ok('Detalhe do ativo', ref('AtivoDetalhe')), 404: erro('Ativo não encontrado'), ...ERROS_COMUNS },
        },
      },
      '/api/v1/favoritos': {
        get: {
          tags: ['Favoritos'], summary: 'Watchlist com cotações', security: seguro, 'x-rate-limit': RL.usuario,
          parameters: [{ name: 'tipo', in: 'query', schema: { type: 'string', enum: ['acao_br', 'acao_global', 'cripto', 'cdb'] } }, ...paginacao],
          responses: { 200: ok('Favoritos', { type: 'array', items: { type: 'object' } }, true), ...ERROS_COMUNS },
        },
        post: {
          tags: ['Favoritos'], summary: 'Favoritar (idempotente: 201 na 1ª vez, 200 depois)', security: seguro, 'x-rate-limit': RL.usuario,
          parameters: [idempotencyKey],
          requestBody: { required: true, content: json({ type: 'object', properties: { ticker: { type: 'string', example: 'WEGE3' } } }) },
          responses: { 201: ok('Favoritado', { type: 'object' }), 200: ok('Já era favorito', { type: 'object' }), 404: erro('Ativo não existe'), ...ERROS_COMUNS },
        },
      },
      '/api/v1/favoritos/{ticker}': {
        delete: {
          tags: ['Favoritos'], summary: 'Remove dos favoritos (idempotente)', security: seguro, 'x-rate-limit': RL.usuario,
          parameters: [{ name: 'ticker', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 204: { description: 'Removido (ou já não existia)' }, ...ERROS_COMUNS },
        },
      },
      '/api/v1/alertas': {
        get: { tags: ['Alertas'], summary: 'Lista alertas', security: seguro, 'x-rate-limit': RL.usuario, parameters: paginacao, responses: { 200: ok('Alertas', { type: 'array', items: ref('Alerta') }, true), ...ERROS_COMUNS } },
        post: {
          tags: ['Alertas'], summary: 'Cria alerta de variação diária', security: seguro, 'x-rate-limit': RL.usuario,
          parameters: [idempotencyKey],
          requestBody: { required: true, content: json({ type: 'object', properties: { ticker: { type: 'string' }, gatilhoPercentual: { type: 'number', example: 3 }, direcao: { type: 'string', enum: ['alta', 'baixa', 'ambas'] } } }) },
          responses: { 201: ok('Criado', ref('Alerta')), 409: erro('Alerta idêntico já existe'), 422: erro('Limite de alertas / renda fixa'), ...ERROS_COMUNS },
        },
      },
      '/api/v1/alertas/{id}': {
        put: {
          tags: ['Alertas'], summary: 'Atualiza alerta', security: seguro, 'x-rate-limit': RL.usuario,
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: { required: true, content: json({ type: 'object', properties: { gatilhoPercentual: { type: 'number' }, direcao: { type: 'string' }, ativo: { type: 'boolean' } } }) },
          responses: { 200: ok('Atualizado', ref('Alerta')), 404: erro('Não encontrado'), ...ERROS_COMUNS },
        },
        delete: {
          tags: ['Alertas'], summary: 'Remove alerta', security: seguro, 'x-rate-limit': RL.usuario,
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 204: { description: 'Removido' }, 404: erro('Não encontrado'), ...ERROS_COMUNS },
        },
      },
      '/api/v1/notificacoes': {
        get: {
          tags: ['Notificações'], summary: 'Histórico de notificações (meta.naoLidas)', security: seguro, 'x-rate-limit': RL.usuario,
          parameters: [{ name: 'naoLidas', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } }, ...paginacao],
          responses: { 200: ok('Notificações', { type: 'array', items: ref('Notificacao') }, true), ...ERROS_COMUNS },
        },
      },
      '/api/v1/notificacoes/{id}/lida': {
        patch: {
          tags: ['Notificações'], summary: 'Marca como lida (idempotente)', security: seguro, 'x-rate-limit': RL.usuario,
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: ok('Notificação', ref('Notificacao')), 404: erro('Não encontrada'), ...ERROS_COMUNS },
        },
      },
      '/api/v1/ideias': {
        get: { tags: ['Ideias'], summary: 'Histórico de ideias com sugestões', security: seguro, 'x-rate-limit': RL.usuario, parameters: paginacao, responses: { 200: ok('Ideias', { type: 'array', items: ref('Ideia') }, true), ...ERROS_COMUNS } },
        post: {
          tags: ['Ideias'], summary: 'Gera até 10 sugestões a partir de texto livre (sem botão de compra)', security: seguro, 'x-rate-limit': RL.usuario,
          parameters: [idempotencyKey],
          requestBody: { required: true, content: json({ type: 'object', properties: { texto: { type: 'string', example: 'Quero renda passiva com dividendos e pouco risco' } } }) },
          responses: { 201: ok('Ideia com sugestões', ref('Ideia')), ...ERROS_COMUNS },
        },
      },
      '/api/v1/simulador/taxas': {
        get: {
          tags: ['Simulador'], summary: 'Taxas vigentes (Selic meta, CDI, TR) com data de referência e origem', security: seguro, 'x-rate-limit': RL.usuario,
          description: 'Banco Central (SGS) com cache de 12 h; se ele cair, último valor conhecido; sem isso, taxas padrão marcadas como de referência.',
          responses: { 200: ok('Taxas', ref('TaxasSimulador')), ...ERROS_COMUNS },
        },
      },
      '/api/v1/simulador': {
        post: {
          tags: ['Simulador'], summary: 'Compara poupança, CDB 100%/110%, Tesouro Selic e LCI/LCA já descontado o IR (não grava nada)', security: seguro, 'x-rate-limit': RL.usuario,
          description: 'IR regressivo por aporte, custódia B3 do Tesouro Selic acima de R$ 10 mil e prazo mínimo de 6 meses por aporte na LCI/LCA (Resolução CMN 5.215/2025): com prazo menor, a LCI/LCA vem com disponivel=false e fica fora de `melhor`. IOF ignorado e taxas constantes (ADR-014). Valor inicial e aporte zerados → 422.',
          requestBody: {
            required: true,
            content: json({
              type: 'object',
              required: ['valorInicial', 'prazoMeses'],
              properties: {
                valorInicial: { type: 'number', minimum: 0, maximum: 10_000_000, example: 10000 },
                aporteMensal: { type: 'number', minimum: 0, maximum: 1_000_000, default: 0, example: 500 },
                prazoMeses: { type: 'integer', minimum: 1, maximum: 360, example: 24 },
              },
            }),
          },
          responses: {
            200: ok('Comparação', {
              type: 'object',
              properties: {
                parametros: { type: 'object' },
                totalInvestido: { type: 'number', example: 22000 },
                melhor: { type: 'string', example: 'cdb-110' },
                modalidades: { type: 'array', items: ref('ModalidadeSimulada') },
                taxas: ref('TaxasSimulador'),
              },
            }),
            422: erro('Valor inicial e aporte mensal zerados'),
            ...ERROS_COMUNS,
          },
        },
      },
      '/live': { get: { tags: ['Observabilidade'], summary: 'Liveness (processo vivo)', responses: { 200: { description: 'ok' } } } },
      '/ready': { get: { tags: ['Observabilidade'], summary: 'Readiness (Postgres + Redis)', responses: { 200: { description: 'pronto' }, 503: { description: 'indisponível/encerrando' } } } },
      '/api/v1/ping': { get: { tags: ['Observabilidade'], summary: 'Acorda a API sem tocar no banco (chamado pelo SPA ao abrir)', 'x-rate-limit': RL.global, responses: { 204: { description: 'API acordada' } } } },
      '/health': { get: { tags: ['Observabilidade'], summary: 'Diagnóstico: Postgres, Redis, BullMQ, circuit breakers', responses: { 200: { description: 'ok/degradado' }, 503: { description: 'falha crítica' } } } },
      '/metrics': { get: { tags: ['Observabilidade'], summary: 'Métricas Prometheus (Bearer METRICS_TOKEN em produção)', responses: { 200: { description: 'text/plain; version=0.0.4' } } } },
    },
  };
}

module.exports = { criarDocumentoOpenApi };
