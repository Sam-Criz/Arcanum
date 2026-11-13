# AGENTS.md — Arcanum VTT

Guia de diretrizes operacionais e automações para agentes de IA neste repositório.

## Stack Técnica
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide React
- **Backend:** Node.js 24, Express, TypeScript (`tsx`), WebSockets nativos (`ws`)
- **Banco de Dados:** SQLite nativo com WAL mode e transações atômicas
- **Testes:** Test runner nativo do Node.js 24 (`node --test --import tsx`)

## Comandos Essenciais
- Iniciar ambiente dev completo: `npm run dev:all`
- Executar testes backend: `npm --prefix server test`
- Build frontend: `npm --prefix client run build`

## Design System Obrigatório
- Paleta: `#131211` (Tinta), `#1a1816` (Papel), `#c9a04e` (Latão), `#ece3d0` (Osso), `#b24a52` (Vinho).
- Proibido fundos arroxeados/azulados genéricos de IA e popups nativos (`alert`, `confirm`).
- Viewport em tela cheia estritamente com `100dvh` e `overflow-hidden`.

---

## Agent skills (Matt Pocock Skills Configuration)

Configurações geradas via `/setup-matt-pocock-skills`:

- **Issue Tracker:** [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md) (`local-markdown` em `.scratch/issues/`)
- **Triage Labels:** [docs/agents/triage-labels.md](docs/agents/triage-labels.md)
- **Domain Context:** [docs/agents/domain.md](docs/agents/domain.md)

### Skills Disponíveis no Workflow:
- `/grill-with-docs`: Entrevista interativa de refinamento de escopo antes de codificar.
- `/to-spec`: Gera especificação técnica formal para nova funcionalidade.
- `/to-tickets`: Decompõe a spec em tarefas atômicas em `.scratch/issues/`.
- `/implement`: Execução estrita orientada a TDD (Test-Driven Development).
- `/code-review`: Auditoria de diffs contra regressões e boas práticas.
