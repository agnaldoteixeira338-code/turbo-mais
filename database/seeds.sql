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

-- =============================================================================
-- O que costuma fazer o preço SUBIR e CAIR (ADR-015). Generalizações educativas
-- sobre os fatores mais conhecidos de cada ativo, em linguagem simples. NÃO são
-- previsões. Nas ações americanas (BDR) e nas criptomoedas, cotadas em reais, o
-- dólar também pesa. Nos CDBs, "alta" = o que faz render mais e "baixa" = o que
-- faz render menos ou os riscos.
-- =============================================================================
UPDATE ativos_educativos AS a
   SET fatores_alta = v.alta, fatores_baixa = v.baixa
  FROM (VALUES
  ('PETR4',
   ARRAY['Petróleo caro no mercado internacional', 'Produção crescente no pré-sal', 'Dividendos altos e preços dos combustíveis alinhados ao mercado', 'Dólar em alta (parte das receitas é em dólar)'],
   ARRAY['Petróleo em queda', 'Interferência do governo nos preços dos combustíveis ou na gestão', 'Mudanças que reduzam os dividendos', 'Investimentos grandes com retorno incerto']),
  ('VALE3',
   ARRAY['Minério de ferro caro', 'Economia da China aquecida (construção e aço)', 'Dólar em alta (vende em dólar)', 'Dividendos elevados'],
   ARRAY['Minério de ferro em queda ou desaceleração da China', 'Acidentes ambientais e processos na Justiça', 'Problemas de produção nas minas', 'Dólar em queda']),
  ('ITUB4',
   ARRAY['Lucro e rentabilidade acima do esperado', 'Inadimplência baixa', 'Economia crescendo, com mais crédito', 'Dividendos e recompra de ações'],
   ARRAY['Inadimplência em alta com a economia fraca', 'Concorrência de bancos digitais', 'Mais impostos ou regras mais duras para bancos', 'Crise econômica']),
  ('BBAS3',
   ARRAY['Agronegócio forte, com boas safras', 'Lucro e dividendos altos', 'Inadimplência controlada', 'Gestão focada em rentabilidade'],
   ARRAY['Interferência do governo (maior acionista) na gestão ou nos juros cobrados', 'Problemas no agronegócio: quebra de safra ou produtores endividados', 'Inadimplência em alta', 'Mudanças nas regras dos bancos públicos']),
  ('BBDC4',
   ARRAY['Recuperação da rentabilidade', 'Inadimplência em queda', 'Bons resultados na área de seguros', 'Economia crescendo, com mais crédito'],
   ARRAY['Inadimplência alta de pessoas e pequenas empresas', 'Lucro abaixo do esperado', 'Concorrência de bancos digitais', 'Crise econômica']),
  ('WEGE3',
   ARRAY['Demanda por energia limpa (solar, eólica e transmissão)', 'Exportações fortes e dólar em alta', 'Indústria aquecida no Brasil e no exterior', 'Crescimento e margens consistentes'],
   ARRAY['Desaceleração da indústria no mundo', 'Dólar em queda', 'Ação já cara: resultados que decepcionam pesam mais', 'Cobre e aço mais caros']),
  ('SANB11',
   ARRAY['Lucro e rentabilidade melhores', 'Inadimplência baixa', 'Crédito ao consumo e de veículos crescendo', 'Dividendos'],
   ARRAY['Inadimplência em alta', 'Decisões da matriz espanhola', 'Concorrência', 'Crise econômica']),
  ('AAPL',
   ARRAY['Lançamentos bem-sucedidos, como novos iPhones', 'Crescimento dos serviços (App Store, assinaturas)', 'Recompra de ações', 'Dólar em alta frente ao real (o BDR é cotado em reais)'],
   ARRAY['Vendas fracas de iPhone', 'Tensões entre EUA e China (fábricas e vendas)', 'Processos e regras contra a App Store', 'Dólar em queda frente ao real']),
  ('MSFT',
   ARRAY['Crescimento da nuvem Azure', 'Adoção de inteligência artificial pelas empresas', 'Contratos corporativos fortes', 'Dólar em alta frente ao real (o BDR é cotado em reais)'],
   ARRAY['Desaceleração da nuvem', 'Gastos altos com IA sem retorno visível', 'Processos e regulação antitruste', 'Dólar em queda frente ao real']),
  ('TSLA',
   ARRAY['Entregas de carros acima do esperado', 'Avanços em direção autônoma, robôs e baterias', 'Incentivos a carros elétricos', 'Dólar em alta frente ao real (o BDR é cotado em reais)'],
   ARRAY['Concorrência, principalmente de fabricantes chineses', 'Cortes de preço que reduzem a margem', 'Polêmicas envolvendo a liderança da empresa', 'Fim de incentivos e dólar em queda']),
  ('NVDA',
   ARRAY['Demanda por chips de IA em data centers', 'Novas gerações de chips', 'Receita e lucro acima das previsões', 'Dólar em alta frente ao real (o BDR é cotado em reais)'],
   ARRAY['Grandes clientes reduzindo gastos com IA', 'Restrições à venda de chips para a China', 'Concorrência e chips próprios das big techs', 'Expectativas muito altas: qualquer decepção derruba o preço']),
  ('GOOGL',
   ARRAY['Publicidade on-line forte (buscas e YouTube)', 'Crescimento do Google Cloud', 'Avanços em inteligência artificial', 'Dólar em alta frente ao real (o BDR é cotado em reais)'],
   ARRAY['Assistentes de IA concorrendo com as buscas', 'Processos antitruste nos EUA e na Europa', 'Empresas cortando publicidade em crises', 'Dólar em queda frente ao real']),
  ('AMZN',
   ARRAY['Crescimento da nuvem AWS', 'Consumo forte e varejo mais lucrativo', 'Receita com publicidade', 'Dólar em alta frente ao real (o BDR é cotado em reais)'],
   ARRAY['Consumo fraco ou recessão', 'Custos de logística e salários em alta', 'Desaceleração da AWS', 'Dólar em queda frente ao real']),
  ('NU',
   ARRAY['Crescimento de clientes no Brasil, México e Colômbia', 'Lucro crescente com inadimplência controlada', 'Novos produtos de crédito e investimento', 'Dólar em alta frente ao real (o BDR é cotado em reais)'],
   ARRAY['Inadimplência em alta no cartão e no crédito', 'Juros altos no Brasil', 'Concorrência e mudanças na regulação', 'Dólar em queda frente ao real']),
  ('BTC',
   ARRAY['Entrada de grandes investidores (fundos e empresas comprando)', 'Juros caindo nos EUA (mais apetite por risco)', 'Halving: a emissão de novos bitcoins cai pela metade a cada cerca de 4 anos', 'Dólar em alta frente ao real (cotado em reais)'],
   ARRAY['Regulação mais dura ou proibições', 'Juros altos e medo de risco nos mercados', 'Ataques hackers ou falência de corretoras de cripto', 'Vendas grandes de quem tem muito bitcoin']),
  ('ETH',
   ARRAY['Mais uso da rede: finanças descentralizadas, stablecoins e NFTs', 'Entrada de investidores institucionais', 'Atualizações que melhoram a rede', 'Mercado cripto em alta (costuma acompanhar o bitcoin)'],
   ARRAY['Concorrência de outras blockchains', 'Regulação mais dura', 'Falhas de segurança em aplicativos da rede', 'Queda geral das criptomoedas']),
  ('SOL',
   ARRAY['Crescimento de aplicativos, pagamentos e games na rede', 'Taxas baixas e velocidade atraindo usuários', 'Interesse de investidores institucionais', 'Mercado cripto em alta'],
   ARRAY['Instabilidades e paradas da rede (já aconteceram)', 'Concorrência de outras blockchains', 'Regulação mais dura', 'Queda geral das criptomoedas, que costuma ser mais forte nas menores']),
  ('CDB-LIQ-100',
   ARRAY['Selic e CDI em alta: rende mais', 'Quanto mais tempo aplicado, menor o imposto de renda'],
   ARRAY['Selic e CDI em queda: rende menos', 'Resgates nos primeiros meses pagam IR maior (22,5%)', 'Problemas no banco emissor (o FGC cobre até R$ 250 mil por CPF e instituição)']),
  ('CDB-120-2A',
   ARRAY['Selic e CDI em alta: rende mais', 'Paga 120% do CDI como prêmio por deixar o dinheiro parado 2 anos'],
   ARRAY['Selic e CDI em queda: rende menos', 'Dinheiro preso até o vencimento, sem resgate antecipado', 'Problemas no banco emissor (o FGC cobre até R$ 250 mil por CPF e instituição)']),
  ('CDB-IPCA-5A',
   ARRAY['Inflação (IPCA) em alta: o valor é corrigido e rende mais', 'Garante 6% ao ano acima da inflação até o vencimento'],
   ARRAY['Inflação baixa: rende menos em reais', 'Dinheiro preso por 5 anos, até o vencimento', 'Problemas no banco emissor (o FGC cobre até R$ 250 mil por CPF e instituição)'])
  ) AS v(ticker, alta, baixa)
 WHERE a.ticker = v.ticker;
