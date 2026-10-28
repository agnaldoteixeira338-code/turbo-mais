# 8. Prazo mínimo da LCI/LCA no simulador

**Decisão registrada em:** [ADR-014](../adr/ADR-014-simulador-de-investimentos.md) · correção no PR #41

## Contexto

O simulador de investimentos compara poupança, CDB, Tesouro Selic e LCI/LCA para o valor e o prazo que a pessoa escolhe.

## O que aconteceu

A primeira versão não considerava o **prazo mínimo de resgate** da LCI e da LCA. Em prazos curtos, ela indicava a LCI/LCA (isenta de imposto) como a melhor opção justamente onde ela nem pode ser contratada.

Para a correção, o ponto de partida trazia 12 meses para a LCI e 9 meses para a LCA, com o pedido de conferir a regra na resolução vigente antes de implementar.

## Como foi resolvido

- A regra foi conferida no texto oficial, na base de normativos do Banco Central. Os prazos de 12 e 9 meses eram da Resolução CMN 5.119/2024 e já tinham sido reduzidos duas vezes. A regra vigente é a da **Resolução CMN 5.215/2025: 6 meses para as duas**, quando não há correção por índice de preços.
- Como as regras são iguais, LCI e LCA continuaram como uma modalidade só.
- Com prazo menor que 6 meses, a LCI/LCA aparece como "indisponível para este prazo" e fica fora da escolha da melhor. Com aportes mensais, o card mostra quanto pode ser resgatado e quanto ainda está em carência.
- A fonte e o histórico das resoluções foram registrados no código e no ADR-014.

## Quem fez o quê

- **Eu:** encontrei o erro na regra e exigi que o prazo fosse conferido na fonte oficial antes de qualquer código.
- **IA:** consultou a base de normativos do Banco Central, reconstruiu o histórico das resoluções e implementou a correção com testes.
