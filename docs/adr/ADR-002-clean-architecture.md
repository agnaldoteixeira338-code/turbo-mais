# ADR-002 — Clean Architecture com DI manual

- **Status:** Aceita
- **Data:** 2026-09-01

## Contexto

O backend integra muitas peças voláteis: três APIs de mercado (que mudam contrato e cota), dois provedores de e-mail, Redis, BullMQ, Socket.IO, Postgres. As **regras de negócio**, por outro lado, são estáveis: quando um alerta dispara, o que conta como notificação duplicada, como ranquear sugestões, a política de senha, a rotação de tokens.

Queremos testar essas regras em milissegundos, sem subir infraestrutura, e trocar qualquer peça externa sem tocar nelas.

## Decisão

Quatro camadas, com a **regra de dependência** apontando sempre para dentro:

```
interfaces  ──▶  application  ──▶  domain
     │                ▲
     └──▶ infrastructure (implementa as portas da application/domain)
```

- **domain/**: entidades (`Alerta.avaliar`), value objects (`Email`, `Celular`, `Senha`, `Ticker`), serviço de domínio puro (`MotorDeSugestoes`) e **interfaces** de repositório. Não importa nada de fora — nem os erros da aplicação (tem seu próprio `DomainValidationError`).
- **application/**: casos de uso (um por arquivo, método `execute`), DTOs (schemas Zod), erros HTTP-agnósticos e **portas** (`PasswordHasher`, `TokenService`, `EmailQueue`, `MarketDataGateway`, `Notificador`, `UnitOfWork`...).
- **infrastructure/**: adaptadores concretos (Postgres, Redis, BullMQ, Resend/Nodemailer, brapi/CoinGecko/Alpha Vantage, opossum, Pino, prom-client).
- **interfaces/**: HTTP (Express: rotas, controllers finos, middlewares, presenters) — traduz HTTP ↔ caso de uso.

A **composição** acontece em um único lugar: `config/container.js` (composition root), com **DI manual** — sem framework de injeção.

## Por que DI manual

São ~40 objetos. Um arquivo explícito é legível de cima a baixo, depurável com breakpoint e não tem mágica de resolução por nome. Testes de integração trocam só o que precisam via `overrides` (ex.: fila de e-mail que captura em memória para "ler" o código 2FA).

## Alternativas consideradas

- **MVC "rotas → services → models"**: mais rápido de começar, mas as regras vazam para controllers e o teste unitário passa a exigir mocks de Express e do banco.
- **Container de DI (awilix/inversify)**: útil em centenas de dependências; aqui só adicionaria indireção.
- **Hexagonal "pura" com módulos por feature**: considerada; preferimos camadas horizontais porque o enunciado do projeto pede essa estrutura e o domínio é pequeno.

## Consequências

**Positivas**
- Mais de 200 testes unitários rodam sem I/O; a cobertura do núcleo fica acima de 95%.
- Trocar o provedor de ações globais = escrever um adaptador com `buscarCotacao/buscarHistorico/buscarIndicadores` e registrar no container. Aconteceu de verdade: a Alpha Vantage virou reserva e os BDRs via brapi viraram a fonte principal sem tocar em domínio nem casos de uso ([ADR-012](ADR-012-acoes-globais-via-bdr.md)).
- Erros de domínio viram 422, de validação 400, de infraestrutura 500 — o mapeamento é **um** arquivo (`errorHandler`).

**Negativas**
- Mais arquivos e alguma cerimônia (interfaces que, em JS, são classes-base que lançam "não implementado").
- Risco de "camadas anêmicas" se tudo virar passa-repasse. Mitigação: regras ficam nas entidades/serviço de domínio (ex.: `Alerta.avaliar`, `Notificacao.gerarHashIdempotencia`), não nos use cases.

## Quando revisitar

Se o projeto migrar para TypeScript, as interfaces viram `interface` de verdade e as classes-base podem sair.
