# ADR-015: Comportamento histórico e fatores de alta e baixa, em vez de "probabilidade de subir"

- **Status:** Aceita
- **Data:** 2026-10-29

## Contexto

O pedido foi mostrar, no detalhe de cada ativo, **a probabilidade de ele subir ou cair** e **o que faz o preço subir**, para a pessoa ter uma visão mais ampla do que está olhando.

A segunda parte é conteúdo educativo legítimo. A primeira tem três problemas:

1. **Não existe forma honesta de calcular.** Preço de ação ou de cripto não tem probabilidade conhecida de subir amanhã. Um número como "70% de chance de alta" pareceria uma previsão confiável e induziria decisões com base em algo inventado.
2. **Na prática, seria recomendação de investimento**, atividade regulada pela CVM. O Turbo Mais é educativo e diz isso em toda tela.
3. **Credibilidade técnica:** quem entende de mercado percebe na hora um número sem base.

## Decisão

No lugar da "probabilidade", três blocos que respondem à mesma necessidade (entender o ativo) com dados reais e linguagem honesta:

### 1. Comportamento no último ano (calculado)

`AnalisadorDeComportamento`, serviço de domínio puro, calcula sobre **1 ano de preços reais** (brapi para ações e BDRs, CoinGecko para cripto):

| Estatística | Como |
|---|---|
| Resultado no período | último preço ÷ primeiro − 1 |
| Meses em alta | fechamento de cada mês (último preço) contra o anterior; o 1º mês compara com o primeiro ponto |
| Dias em alta | % de retornos diários positivos |
| Oscilação típica por dia | desvio-padrão dos retornos diários |
| Volatilidade anual | oscilação diária × √(pontos por ano), com os pontos por ano medidos na própria série (252 pregões na B3, 365 dias em cripto) |
| Maior queda | maior recuo de um topo até um fundo posterior (*drawdown*) |
| Melhor e pior mês | maior e menor retorno mensal |

**Nível de oscilação** pela volatilidade anual: até 20% "oscila pouco", até 35% "moderada", até 60% "bastante" e acima disso "muito". As faixas foram calibradas com dados reais de 2025–2026: Itaú e Petrobras ficaram perto de 30% ("moderada") e o Bitcoin perto de 45% ("bastante"). Com menos de 40 pontos, o resultado é `null` ("ainda não há histórico suficiente"). Renda fixa não tem esse bloco.

**Limitação real da fonte:** testando a API, o plano gratuito da brapi só entrega mais de 3 meses de histórico para **PETR4, VALE3 e ITUB4**; para as demais ações e para todos os BDRs, pedir 6 meses ou 1 ano responde **HTTP 400**. O cliente da brapi passou a pedir, nesse caso, o maior período liberado (3 meses), **dentro da mesma chamada protegida**, para o circuit breaker das cotações não contar como falha algo que é só limite do plano. A tela diz o período real ("nos últimos 3 meses"). Isso corrigiu também o botão "1A" do gráfico dessas ações, que antes mostrava "Histórico indisponível". CoinGecko entrega 1 ano para as criptos.

A tela sempre avisa: **descreve o passado e não é previsão.**

### 2. O que costuma fazer subir e cair (conteúdo)

Duas colunas novas no catálogo (`fatores_alta` e `fatores_baixa`), criadas por uma **migration aditiva** com valor padrão vazio (segura para rollback, [ADR-010](ADR-010-estrategia-rollback.md)) e preenchidas no `seeds.sql` para os 20 ativos. São **generalizações educativas** sobre os fatores mais conhecidos de cada ativo (ex.: petróleo para a Petrobras, minério de ferro e China para a Vale, inadimplência para os bancos, halving e juros dos EUA para o bitcoin). Nos BDRs e nas criptos, cotados em reais, o dólar entra como fator. Nos CDBs, o bloco vira "o que faz render mais ou menos" e mostra os riscos (prazo, FGC).

### 3. Nível de risco explicado

O nível de oscilação aparece em palavras e numa frase ("em 13 meses, fechou em alta em 7; no pior mês, chegou a cair 9,4%"). É a forma mais direta de mostrar o risco sem prometer nada.

### Onde roda

`DetalharAtivo` busca 1 ano de histórico **à parte do gráfico** (o gráfico continua no período escolhido). Quando o gráfico já é de 1 ano, reaproveita a mesma série. O histórico fica **6 horas em cache** (ADR-003), então o bloco não multiplica as chamadas às APIs. Se esse histórico falhar, o resto da página aparece normalmente (`allSettled`, ADR-007).

O bloco fica **só no detalhe**, não na lista da busca: calcular 1 ano de histórico para todos os ativos de uma vez consumiria a cota das APIs gratuitas a cada busca.

## Alternativas consideradas

| Opção | Por que não |
|---|---|
| **Probabilidade de alta por frequência histórica** ("subiu em 54% dos dias → 54% de chance") | Confunde frequência passada com probabilidade futura. É exatamente o erro que o produto não pode ensinar. A frequência aparece, mas como fato do passado ("dias em alta"). |
| **Modelos de previsão** (médias móveis, regressão, IA) | Sem validação séria, dariam uma falsa sensação de precisão, e ainda seriam recomendação. Fora do escopo de um app educativo. |
| **Recomendação de analistas ou "preço-alvo"** | Exige fonte paga e licenciada; também seria recomendação. |
| **Fatores gerados por IA a cada acesso** | Texto mudando a cada visita, sem revisão e sem controle de erro. O conteúdo fixo no catálogo é revisado em pull request como código. |

## Consequências

**Positivas**
- A pessoa entende **o risco** (quanto oscila, quanto já caiu) e **os motivos** (o que move o preço), que é a "visão mais ampla" pedida.
- Tudo calculado com dados reais ou escrito de forma verificável; nada de número inventado.
- O domínio fica testado com séries de resultado conhecido (alta constante, queda de 25%, oscilação alternada).

**Negativas**
- Os fatores são generalizações: não cobrem notícias do dia e precisam de revisão quando o negócio de uma empresa mudar.
- Para a maioria das ações e dos BDRs, a janela é de só 3 meses (limite do plano gratuito). O texto do bloco sempre diz o período usado, e com um provedor pago a janela passa a ser de 1 ano sem mudar o domínio.
- Mais uma chamada de histórico por ativo a cada 6 horas (coberta pelo cache).
