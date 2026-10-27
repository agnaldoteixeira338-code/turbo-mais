# ADR-013: Conta demo restaurada periodicamente para um estado de exemplo

- **Status:** Aceita
- **Data:** 2026-10-23

## Contexto

O botão **"Entrar como visitante"** abre uma sessão na conta definida em `DEMO_USER_EMAIL`, sem senha. Todos os visitantes usam **a mesma conta**. Por isso:

- favoritos, alertas, notificações e, principalmente, os **textos livres da tela "Ideia"** deixados por um visitante aparecem para o próximo, que pode ser um recrutador;
- um visitante podia pedir para **ativar o 2FA** ou **"esqueci a senha"** na conta demo. Nos dois casos o app mandava e-mail para um endereço que não existe, e cada envio desses prejudica a reputação de envio do domínio no provedor (Brevo).

Queremos que quem entra como visitante veja sempre uma conta **bonita e previsível**, sem depender de moderação manual.

## Decisão

1. **Caso de uso `RestaurarContaDemo`** (camada application), em **uma transação** (`UnitOfWork`):
   - apaga favoritos, alertas, notificações e ideias da conta demo (as sugestões vão junto por `ON DELETE CASCADE`);
   - recria o estado de exemplo: 5 favoritos (PETR4, WEGE3, NVDA, BTC, CDB-LIQ-100), 2 alertas (PETR4 ±2%, BTC ±3%) e 1 ideia com sugestões geradas pelo **`MotorDeSugestoes` de verdade**;
   - garante o 2FA desligado;
   - não toca no `audit_log`, nas sessões abertas nem em nenhum outro usuário (todo `DELETE` filtra por `usuario_id`);
   - registra `CONTA_DEMO_RESTAURADA` no audit log;
   - se `DEMO_USER_EMAIL` estiver vazio ou a conta não existir, não faz nada e só registra um log.
2. **Agendamento no BullMQ** (fila `demo-reset`), no mesmo padrão do priceWatcher ([ADR-004](ADR-004-bullmq-vs-cron.md)):
   - `upsertJobScheduler('restaurar-conta-demo', { every })`: com N réplicas continua existindo **um** agendamento;
   - `attempts: 1` (o próximo ciclo corrige) e `concurrency: 1`; falha permanente vai para a DLQ;
   - roda no processo de workers e também com `RUN_WORKERS_IN_PROCESS=true` (plano gratuito);
   - intervalo em `DEMO_RESET_INTERVAL_MINUTES` (padrão **60**; `0` desliga e **remove** o agendamento do Redis).
3. **Proteções da conta demo:**
   - **Ativar 2FA** responde `403 CONTA_DEMO_PROTEGIDA`, sem enviar e-mail; o frontend explica e oferece "Sair e criar minha conta";
   - **Esqueci a senha** não gera token nem e-mail, mas devolve a **mesma resposta 202** de sempre (sem permitir descobrir contas);
   - as duas tentativas ficam no audit log como `CONTA_DEMO_ACAO_BLOQUEADA`.

## Por que de hora em hora

| Intervalo | Efeito |
|---|---|
| A cada poucos minutos | Um visitante perderia o que acabou de criar enquanto ainda explora o app. |
| **1 hora** | Tempo de sobra para uma visita completa (um recrutador costuma ficar de 2 a 10 min). O pior caso é o próximo visitante ver, por até 1 h, o que o anterior criou. Custo desprezível: uma transação pequena por hora. |
| 1 vez por dia | Conteúdo indevido ficaria visível por até 24 h. |

O valor é configurável sem mudar código.

## Alternativas consideradas

| Opção | Por que não |
|---|---|
| **Uma conta demo por visitante** (criada no clique, apagada depois) | Isolamento perfeito, mas cada clique cria um usuário: precisa de limpeza de contas órfãs, o rate limit vira a única barreira contra encher o banco e o seed de exemplo roda a cada clique. Mais complexidade para um projeto de portfólio. Fica como evolução se o tráfego crescer. |
| **Conta demo somente leitura** (bloquear escrita) | Previsível, mas o visitante não consegue testar favoritar, criar alerta nem gerar ideia, que são justamente as funcionalidades que queremos mostrar. |
| **Restaurar no momento do login do visitante** | Dois visitantes simultâneos apagariam o que o outro está usando, e o login ficaria mais lento. |
| **Cron do sistema / `setInterval`** | Com N réplicas rodaria N vezes, sem retry, sem DLQ e sem visibilidade (mesmos motivos da ADR-004). |
| **Apagar com `TRUNCATE` ou recriar o usuário** | Afetaria outros usuários ou o audit log, e quebraria as sessões abertas dos visitantes. |

## Consequências

**Positivas**
- O visitante sempre encontra uma conta coerente, com um exemplo de cada funcionalidade.
- A transação garante que ninguém veja a conta vazia ou pela metade: ou vê o estado antigo, ou o novo.
- Idempotente: rodar duas vezes (ou em duas réplicas) dá o mesmo resultado.
- Os envios para o endereço inexistente acabam, o que protege a reputação de e-mail.

**Negativas**
- Dois visitantes **ao mesmo tempo** ainda compartilham a conta e veem as ações um do outro.
- A cada restauração, quem estiver na tela perde o que criou. Com intervalo de 1 h isso é raro; a tela recarrega os dados na próxima navegação.
- Uma linha `CONTA_DEMO_RESTAURADA` por hora no audit log (~8.800/ano), coberta pela política de retenção do audit log.
- No plano gratuito, a restauração só acontece enquanto a API está acordada (os workers rodam dentro dela). Com a API dormindo não há visitantes, então não há o que limpar; o primeiro ciclo após acordar corrige.
