# 6. Manter a API acordada sem estourar o plano gratuito

**Onde está documentado:** [DEPLOY.md](../DEPLOY.md) (seção "Manter a API acordada") e [ADR-011](../adr/ADR-011-hospedagem-vercel-render.md) · PRs #32 e #33

## Contexto

No plano gratuito, a Render coloca a API para dormir depois de 15 minutos sem acesso, e o primeiro acesso seguinte leva cerca de 1 minuto. A ideia inicial era um monitor (UptimeRobot e um agendamento no GitHub) chamando a API a cada 10 minutos.

## O que aconteceu

Antes de criar o monitor, apareceu um limite que mudava o plano: as **750 horas gratuitas por mês são da conta inteira da Render**, não de cada serviço. A conta tinha outros serviços gratuitos, e um deles já era mantido acordado 24 horas, gastando quase todo o limite. Manter o Turbo Mais acordado, mesmo só em horário de pico, faria as horas acabarem no meio do mês, e a Render suspenderia **todos** os serviços.

## Como foi resolvido

- Apaguei dois serviços que não usava mais. O outro serviço que ficava acordado foi mantido como estava, por decisão minha.
- O agendamento do Turbo Mais ficou **desativado** (configurado para horário de pico, pronto para religar quando houver horas sobrando).
- Em vez de manter a API acordada, o site **começa a acordá-la assim que alguém abre a página** (`GET /api/v1/ping`) e mostra o aviso "Acordando o servidor" se ela demorar.

## Quem fez o quê

- **Eu:** decidi o que apagar, o que manter e que o Turbo Mais não poderia prejudicar os outros serviços.
- **IA:** encontrou o limite compartilhado ao listar os serviços da conta, calculou o consumo de horas e implementou o ping ao abrir e o aviso.
