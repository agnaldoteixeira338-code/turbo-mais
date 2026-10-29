# ADR-014: Simulador de investimentos calculado no backend com taxas do Banco Central

- **Status:** Aceita
- **Data:** 2026-10-26

## Contexto

O Turbo Mais é educativo. Faltava a funcionalidade que qualquer pessoa entende em segundos: **"se eu aplicar R$ X por N meses, quanto vou ter em cada aplicação, já descontado o imposto?"**. Ela também é a mais fácil de testar para quem não é técnico, como um recrutador. Como o resto do app, o simulador **só informa**: não existe ação de compra.

Comparamos cinco modalidades: poupança, CDB a 100% e a 110% do CDI, Tesouro Selic e LCI/LCA a 90% do CDI.

## Decisão

### 1. A regra fica no domínio, e o cálculo roda no backend

- `SimuladorDeInvestimentos` é um **serviço de domínio puro** (sem I/O), como o `MotorDeSugestoes`: recebe valores, prazo e taxas, e devolve a comparação com a série mês a mês.
- `POST /api/v1/simulador` valida com Zod `.strict()` (limites: até R$ 10 milhões iniciais, R$ 1 milhão por mês, 1 a 360 meses) e **não grava nada**. `GET /api/v1/simulador/taxas` expõe as taxas usadas. As duas rotas são autenticadas e usam o rate limit por usuário.

### 2. Regras de cada modalidade

| Modalidade | Rendimento | Imposto |
|---|---|---|
| Poupança | Selic meta > 8,5% a.a.: 0,5% a.m. + TR; caso contrário: 70% da Selic mensalizada + TR (Lei 8.177/1991, art. 12, redação da Lei 12.703/2012) | isenta |
| CDB 100% e 110% do CDI | o percentual incide sobre a taxa **diária** do CDI (252 dias úteis), 21 dias úteis por mês | IR regressivo |
| Tesouro Selic | Selic meta | IR regressivo + **custódia B3 de 0,20% a.a.**, isenta até R$ 10 mil por CPF e cobrada só sobre o excedente ([regulamento do Tesouro Direto](https://www.tesourodireto.com.br/sobre-o-tesouro/regras-e-regulamento)) |
| LCI/LCA 90% do CDI | como o CDB; **prazo mínimo de 6 meses por aporte** (ver 2.1) | isenta (pessoa física) |

**IR regressivo** (Lei 11.033/2004): 22,5% até 180 dias, 20% até 360, 17,5% até 720 e 15% acima. É calculado **por aporte**: cada aporte é um lote com a sua própria idade, então o valor inicial pode pagar 15% enquanto o aporte do mês passado paga 22,5%. Aplicar uma alíquota única ao rendimento total erraria o imposto. Meses viram dias corridos com 365,25/12 (6 meses ≈ 183 dias → 20%).

### 2.1 Prazo mínimo (carência) da LCI e da LCA

*Adendo de 2026-10-27.* Desde 2024, o CMN exige prazo mínimo de vencimento para LCI e LCA. A regra mudou três vezes, e a vigente vem da **Resolução CMN nº 5.215, de 22/05/2025**, que alterou o art. 4º, II, da Resolução nº 4.410/2015 (LCI) e o art. 2º, II, da Resolução CMN nº 5.006/2022 (LCA). Fonte: [texto da resolução no Banco Central](https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?tipo=Resolução%20CMN&numero=5215).

| Norma | LCI sem índice de preços | LCA sem índice de preços |
|---|---|---|
| Res. CMN 5.119 (01/02/2024) | 12 meses | 9 meses |
| Res. CMN 5.168 (22/08/2024) | 9 meses | 9 meses |
| **Res. CMN 5.215 (22/05/2025), vigente** | **6 meses** | **6 meses** |

Conferido em 2026-10-27 na busca de normativos do Banco Central: nenhuma resolução posterior altera a 4.410 ou a 5.006 nesse ponto. Títulos atualizados por índice de preços têm prazos maiores, mas o simulador só usa LCI/LCA atrelada ao CDI.

**Decisões:**

- **Uma modalidade, não duas.** Com as regras iguais (6 meses), separar LCI de LCA só duplicaria um card com os mesmos números. O prazo fica num único lugar do domínio (`CARENCIA_LCI_LCA_MESES`); se o CMN voltar a diferenciar, a modalidade é desmembrada ali.
- **Prazo da simulação menor que a carência:** a modalidade volta com `disponivel: false`, o motivo (`motivoIndisponivel`), **sem valores** e **fora da escolha da melhor**. Antes desta regra, em prazos de 1 a 5 meses a LCI isenta "vencia" justamente onde ela não pode ser contratada.
- **Cada aporte tem a sua própria carência.** Cada aporte mensal é um título novo, que só pode ser resgatado 6 meses depois de aplicado. No fim do prazo, os aportes com menos de 6 meses ainda estão presos. A resposta separa `valorResgatavel` (o que dá para sacar no fim do prazo) de `valorEmCarencia` (o que ainda está preso), e `valorLiquido` é a soma dos dois.
- **A comparação usa o `valorLiquido` (resgatável + em carência).** O dinheiro em carência não se perde: continua rendendo e é liberado em no máximo 6 meses. Comparar só o resgatável faria a LCI/LCA perder em quase todo cenário com aporte mensal (os últimos 6 aportes estão sempre presos), o que distorceria a comparação no sentido oposto. A tela mostra as duas partes no card, para a pessoa ver a restrição de liquidez sem que ela vire perda.

**Alternativas consideradas:** (a) comparar só o valor resgatável: descartado pelo motivo acima; (b) considerar a carência só do valor inicial: simples, mas errado, porque cada aporte é um título com prazo próprio; (c) exibir a LCI/LCA normalmente com um aviso em prazos curtos: descartado, porque mostraria um valor que não existe na prática.

### 3. Aritmética

Entradas e somas de aportes em **centavos inteiros** (exatos). Os juros compostos usam potências fracionárias, que não têm representação exata em nenhum formato, então a capitalização roda em ponto flutuante de dupla precisão (erro muito abaixo de 1 centavo nos limites aceitos) e o arredondamento para centavos acontece **uma vez, só na saída**. O líquido é derivado dos valores já arredondados (bruto − IR − custódia), então os números exibidos sempre fecham.

### 4. Taxas reais do Banco Central (SGS)

API pública e sem chave do Banco Central, séries conferidas no SGS:

| Série | Código | Unidade |
|---|---|---|
| Meta Selic (Copom) | 432 | % a.a. |
| CDI anualizado base 252 | 4389 | % a.a. |
| TR do mês | 7811 | % a.m. |

Consultamos por **intervalo de datas** (últimos 60 dias até hoje), não por "últimos N pontos": a série da meta Selic é publicada com **datas futuras** (vale até a próxima reunião do Copom), e a API não garante a ordem dos pontos. Os dois comportamentos apareceram ao inspecionar a API real e estão cobertos por testes.

Resiliência igual à das cotações ([ADR-007](ADR-007-falha-apis-externas.md)): `breaker(retry(fetch com timeout))` + validação Zod, e cache no Redis ([ADR-003](ADR-003-redis-cache.md)) **longo**, porque as taxas mudam raramente:

```
cache fresco (12 h) → stale (+12 h, revalida em 2º plano) → Banco Central
  → falhou? último valor conhecido (90 dias), marcado "desatualizado"
  → nada? TAXA_SELIC_PADRAO / TAXA_CDI_PADRAO / TAXA_TR_MENSAL_PADRAO (env.js), marcadas como "taxas de referência"
```

O gateway **nunca lança**: o simulador sempre calcula, e a resposta diz a origem (`banco-central`, `cache` ou `padrao`) para o front avisar. O teste de contrato diário inclui o SGS.

### 5. Simplificações assumidas (documentadas na tela)

- **IOF ignorado**: só incide em resgates com menos de 30 dias.
- **Taxas constantes** durante todo o prazo.
- Tesouro Selic rende a **Selic meta** (a Selic efetiva fica ~0,10 p.p. abaixo); o IR incide sobre o rendimento bruto (na prática, a custódia é deduzida da base: diferença de centavos); a isenção de R$ 10 mil supõe que este é o único Tesouro Selic do CPF.
- Aportes no fim de cada mês; capitalização mensal.
- Carência da LCI/LCA contada em meses inteiros da simulação (6 meses = 6 ciclos mensais), sem considerar dias úteis nem a data exata de vencimento de cada título.

## Alternativas consideradas

| Opção | Por que não |
|---|---|
| **Calcular no navegador** | Resposta instantânea e sem servidor, mas a regra ficaria duplicada (ou só no front, sem testes de domínio), as taxas precisariam vir do backend de qualquer jeito e uma mudança de regra exigiria novo deploy do front. No backend, a regra fica num lugar só, testada com casos calculados à mão, e serve também a um futuro app mobile. O custo (uma requisição) é coberto pelo debounce de 400 ms. |
| **Taxas fixas no código** | Simples, mas ficariam erradas a cada reunião do Copom, e "quanto rende hoje" é justamente o que a pessoa quer saber. |
| **APIs de mercado (brapi, etc.)** | Exigem chave, têm cota e não são a fonte oficial. O Banco Central é a fonte primária dessas taxas, gratuita e sem cadastro. |
| **Taxas de corretoras ou produtos reais** | Cada banco paga um % diferente e as ofertas mudam todo dia. Usar percentuais típicos (100%, 110%, 90% do CDI) mantém o simulador educativo e neutro, sem parecer recomendação de um produto. |
| **Curva de juros futura (taxas variando no tempo)** | Mais realista para prazos longos, mas exige projeções (Focus/DI futuro) e complica a explicação. Fica como evolução. |
| **Gravar as simulações** | Não agrega ao objetivo educativo e criaria dados pessoais sem necessidade. |

## Consequências

**Positivas**
- Funcionalidade que qualquer pessoa entende, com números reais do dia e explicação dos termos.
- Regra pura e testável: IR de cada faixa, poupança nas duas regras, aporte zero, prazo de 1 mês e de 30 anos e a ordem entre modalidades em cenários conhecidos.
- Banco Central fora do ar não derruba a tela: cache, último valor conhecido e, por fim, taxas de referência bem sinalizadas.

**Negativas**
- Taxas constantes simplificam prazos longos: em 10 ou 30 anos a Selic certamente vai mudar. O aviso na tela deixa isso claro.
- Cada mudança de digitação (após o debounce) é uma requisição. Coberta pelo rate limit por usuário e pelo cálculo leve (prazo máximo de 360 meses × 5 modalidades).
