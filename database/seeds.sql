-- =============================================================================
-- Turbo Mais — seeds de dados de referência (catálogo educativo)
-- -----------------------------------------------------------------------------
-- IDEMPOTENTE: pode rodar N vezes (ON CONFLICT ... DO UPDATE). Por isso o CD
-- roda este arquivo a cada deploy sem medo — ver ADR-010.
--
-- Os CDBs abaixo são EXEMPLOS DIDÁTICOS de estruturas comuns de mercado, não
-- ofertas reais de nenhuma instituição. Preços de referência servem apenas ao
-- modo simulado (MARKET_DATA_MODE=mock) e NÃO são cotações.
-- =============================================================================

INSERT INTO ativos_educativos
  (ticker, nome, tipo, o_que_faz, papel_sociedade, setor, pais, fundacao, perfil_risco, rendimento_medio, tags, codigo_externo, preco_referencia, moeda)
VALUES
-- ---------------------------------------------------------------- Ações BR --
('PETR4', 'Petrobras PN', 'acao_br',
 'Encontra, extrai e refina petróleo e gás natural, principalmente no pré-sal brasileiro. Também produz gasolina, diesel e gás de cozinha.',
 'Garante boa parte da energia que move carros, caminhões e indústrias no Brasil. Por ser estatal de capital aberto, decisões do governo podem influenciar a empresa.',
 'Petróleo e Gás', 'Brasil', 1953, 'moderado', 'Histórico de dividendos elevados, mas variáveis',
 ARRAY['energia', 'dividendos', 'commodities', 'estatal'], NULL, 37.50, 'BRL'),

('VALE3', 'Vale ON', 'acao_br',
 'Uma das maiores mineradoras do mundo: extrai minério de ferro, níquel e cobre e exporta principalmente para a China.',
 'O minério da Vale vira aço para prédios, carros e eletrodomésticos no mundo todo. Gera empregos e receita de exportação para o Brasil.',
 'Mineração', 'Brasil', 1942, 'moderado', 'Dividendos ligados ao preço do minério',
 ARRAY['commodities', 'dividendos', 'exportacao'], NULL, 60.00, 'BRL'),

('ITUB4', 'Itaú Unibanco PN', 'acao_br',
 'Maior banco privado do Brasil. Ganha dinheiro emprestando, cobrando tarifas, vendendo seguros e administrando investimentos.',
 'Faz o dinheiro circular: financia casas, empresas e o dia a dia de milhões de pessoas.',
 'Bancos', 'Brasil', 1924, 'moderado', 'Pagador recorrente de dividendos',
 ARRAY['bancos', 'dividendos', 'financeiro'], NULL, 36.00, 'BRL'),

('BBAS3', 'Banco do Brasil ON', 'acao_br',
 'Banco de economia mista (governo é o maior acionista). Forte no crédito para o agronegócio e para servidores públicos.',
 'Principal financiador do agronegócio brasileiro, setor que coloca comida na mesa e gera exportações.',
 'Bancos', 'Brasil', 1808, 'moderado', 'Historicamente bom pagador de dividendos',
 ARRAY['bancos', 'dividendos', 'financeiro', 'estatal', 'agronegocio'], NULL, 25.00, 'BRL'),

('BBDC4', 'Bradesco PN', 'acao_br',
 'Um dos maiores bancos privados do país, com forte presença em seguros e em cidades do interior.',
 'Leva serviços bancários a regiões onde há pouca concorrência, incluindo crédito e previdência.',
 'Bancos', 'Brasil', 1943, 'moderado', 'Paga dividendos mensais',
 ARRAY['bancos', 'dividendos', 'financeiro'], NULL, 15.00, 'BRL'),

('WEGE3', 'WEG ON', 'acao_br',
 'Fabrica motores elétricos, geradores, transformadores e equipamentos para energia solar e eólica. Exporta para mais de 100 países.',
 'Seus motores estão em fábricas, elevadores e bombas d''água; seus equipamentos ajudam na transição para energia limpa.',
 'Bens Industriais', 'Brasil', 1961, 'moderado', 'Foco em crescimento, dividendos menores',
 ARRAY['industria', 'sustentabilidade', 'crescimento', 'energia', 'exportacao'], NULL, 45.00, 'BRL'),

('SANB11', 'Santander Brasil Unit', 'acao_br',
 'Braço brasileiro do grupo espanhol Santander. Atua em crédito, cartões, financiamento de veículos e investimentos.',
 'Oferece crédito para pessoas e empresas e financia boa parte dos carros vendidos no país.',
 'Bancos', 'Brasil', 1982, 'moderado', 'Pagador recorrente de dividendos',
 ARRAY['bancos', 'dividendos', 'financeiro', 'automotivo'], NULL, 28.00, 'BRL'),

-- ----------------------------------------------------------- Ações Globais --
-- Empresas americanas cotadas pelo BDR negociado na B3 (codigo_externo), em R$.
-- Motivo: a Alpha Vantage gratuita não responde a partir de IPs de nuvem (ADR-012).
('AAPL', 'Apple Inc. · BDR AAPL34', 'acao_global',
 'Cria o iPhone, o Mac, o iPad e o Apple Watch, além de serviços como App Store, iCloud e Apple Music.',
 'Popularizou o smartphone e mudou a forma como o mundo se comunica, trabalha e consome conteúdo.',
 'Tecnologia', 'EUA', 1976, 'moderado', 'Dividendos baixos + recompra de ações',
 ARRAY['tecnologia', 'inovacao', 'consumo'], 'AAPL34', 86.80, 'BRL'),

('MSFT', 'Microsoft Corp. · BDR MSFT34', 'acao_global',
 'Faz o Windows, o Office, a nuvem Azure, o LinkedIn e o Xbox. É uma das líderes em inteligência artificial corporativa.',
 'Seus programas rodam em escolas, hospitais e empresas do mundo todo; a nuvem Azure hospeda serviços essenciais.',
 'Tecnologia', 'EUA', 1975, 'moderado', 'Dividendos crescentes e modestos',
 ARRAY['tecnologia', 'inovacao', 'nuvem', 'games'], 'MSFT34', 112.30, 'BRL'),

('TSLA', 'Tesla Inc. · BDR TSLA34', 'acao_global',
 'Fabrica carros elétricos, baterias para casas e empresas e investe em direção autônoma e robôs.',
 'Acelerou a troca de carros a combustão por elétricos no mundo, reduzindo emissões de poluentes.',
 'Automotivo', 'EUA', 2003, 'arrojado', 'Não paga dividendos; ação muito volátil',
 ARRAY['automotivo', 'sustentabilidade', 'inovacao', 'crescimento', 'energia'], 'TSLA34', 58.00, 'BRL'),

('NVDA', 'NVIDIA Corp. · BDR NVDC34', 'acao_global',
 'Projeta chips gráficos (GPUs) usados em games e, principalmente, para treinar e rodar inteligência artificial em data centers.',
 'Seus chips são a base da revolução da IA, da pesquisa científica a carros autônomos.',
 'Tecnologia', 'EUA', 1993, 'arrojado', 'Dividendos simbólicos; foco total em crescimento',
 ARRAY['tecnologia', 'inovacao', 'crescimento', 'games', 'chips'], 'NVDC34', 22.90, 'BRL'),

('GOOGL', 'Alphabet Inc. (Google) · BDR GOGL34', 'acao_global',
 'Dona do Google, YouTube, Android e Google Cloud. Ganha dinheiro principalmente com anúncios on-line.',
 'Organiza a informação do mundo: buscas, mapas, vídeos e e-mail usados por bilhões de pessoas.',
 'Tecnologia', 'EUA', 1998, 'moderado', 'Dividendos iniciados recentemente + recompras',
 ARRAY['tecnologia', 'inovacao', 'nuvem'], 'GOGL34', 145.00, 'BRL'),

('AMZN', 'Amazon.com Inc. · BDR AMZO34', 'acao_global',
 'Maior varejista on-line do mundo e dona da AWS, a maior plataforma de computação em nuvem.',
 'Mudou a forma como compramos e entregamos produtos; a AWS sustenta milhares de sites e apps.',
 'Consumo', 'EUA', 1994, 'moderado', 'Não paga dividendos',
 ARRAY['consumo', 'nuvem', 'tecnologia', 'ecommerce'], 'AMZO34', 66.10, 'BRL'),

('NU', 'Nu Holdings (Nubank) · BDR ROXO34', 'acao_global',
 'Controladora do Nubank, banco digital com dezenas de milhões de clientes no Brasil, México e Colômbia. Ações negociadas na Bolsa de Nova York.',
 'Ampliou o acesso a conta e cartão sem tarifa para milhões de pessoas antes fora do sistema bancário.',
 'Bancos', 'Brasil', 2013, 'arrojado', 'Não paga dividendos; foco em crescimento',
 ARRAY['bancos', 'fintech', 'tecnologia', 'crescimento'], 'ROXO34', 12.20, 'BRL'),

-- ----------------------------------------------------------- Criptomoedas --
('BTC', 'Bitcoin', 'cripto',
 'Primeira criptomoeda: um dinheiro digital sem banco central, com oferta máxima de 21 milhões de unidades.',
 'Mostrou que é possível transferir valor pela internet sem intermediários; muitos o veem como "ouro digital".',
 'Criptoativos', 'Global', 2009, 'arrojado', 'Sem rendimento; preço extremamente volátil',
 ARRAY['cripto', 'inovacao', 'crescimento'], 'bitcoin', 600000.00, 'BRL'),

('ETH', 'Ethereum', 'cripto',
 'Plataforma de contratos inteligentes: programas que rodam na blockchain e permitem criar aplicativos descentralizados (DeFi, NFTs).',
 'Base de boa parte das finanças descentralizadas e de novos modelos de propriedade digital.',
 'Criptoativos', 'Global', 2015, 'arrojado', 'Possível rendimento via staking; muito volátil',
 ARRAY['cripto', 'inovacao', 'tecnologia', 'crescimento'], 'ethereum', 22000.00, 'BRL'),

('SOL', 'Solana', 'cripto',
 'Blockchain focada em velocidade e taxas baixas, usada para pagamentos, games e aplicativos descentralizados.',
 'Tenta tornar aplicações em blockchain rápidas e baratas o suficiente para uso no dia a dia.',
 'Criptoativos', 'Global', 2020, 'arrojado', 'Possível rendimento via staking; muito volátil',
 ARRAY['cripto', 'inovacao', 'crescimento', 'games'], 'solana', 1100.00, 'BRL'),

-- ----------------------------------------------------- CDBs (didáticos) --
('CDB-LIQ-100', 'CDB Liquidez Diária 100% do CDI', 'cdb',
 'Você empresta dinheiro a um banco e ele devolve corrigido pelo CDI (taxa próxima à Selic). Pode resgatar quando quiser.',
 'Financia o crédito que o banco oferece a pessoas e empresas. Protegido pelo FGC até R$ 250 mil por CPF e instituição.',
 'Renda Fixa', 'Brasil', NULL, 'conservador', '100% do CDI',
 ARRAY['renda_fixa', 'liquidez', 'reserva', 'fgc'], NULL, 100.00, 'BRL'),

('CDB-120-2A', 'CDB 120% do CDI — 2 anos', 'cdb',
 'Rende mais que o CDI em troca de deixar o dinheiro parado até o vencimento (2 anos), sem resgate antecipado.',
 'Dá ao banco recursos de prazo mais longo para emprestar. Protegido pelo FGC até R$ 250 mil.',
 'Renda Fixa', 'Brasil', NULL, 'conservador', '120% do CDI',
 ARRAY['renda_fixa', 'fgc', 'medio_prazo'], NULL, 120.00, 'BRL'),

('CDB-IPCA-5A', 'CDB IPCA + 6% — 5 anos', 'cdb',
 'Paga a inflação (IPCA) mais 6% ao ano. Protege o poder de compra no longo prazo; o dinheiro fica preso até o vencimento.',
 'Ajuda quem planeja objetivos de longo prazo, como aposentadoria, a não perder para a inflação.',
 'Renda Fixa', 'Brasil', NULL, 'conservador', 'IPCA + 6% a.a.',
 ARRAY['renda_fixa', 'fgc', 'inflacao', 'longo_prazo'], NULL, 6.00, 'BRL')

ON CONFLICT (ticker) DO UPDATE SET
  nome             = EXCLUDED.nome,
  tipo             = EXCLUDED.tipo,
  o_que_faz        = EXCLUDED.o_que_faz,
  papel_sociedade  = EXCLUDED.papel_sociedade,
  setor            = EXCLUDED.setor,
  pais             = EXCLUDED.pais,
  fundacao         = EXCLUDED.fundacao,
  perfil_risco     = EXCLUDED.perfil_risco,
  rendimento_medio = EXCLUDED.rendimento_medio,
  tags             = EXCLUDED.tags,
  codigo_externo   = EXCLUDED.codigo_externo,
  preco_referencia = EXCLUDED.preco_referencia,
  moeda            = EXCLUDED.moeda;
