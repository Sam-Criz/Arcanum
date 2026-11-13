# Triage Labels & Workflow

## Canonical Roles
As skills de engenharia do Matt Pocock operam com os seguintes papéis canônicos de triagem:

| Canonical Role | Label / Status | Descrição |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | Nova solicitação ou bug sem especificação técnica formal |
| `needs-info` | `needs-info` | Bloqueado aguardando esclarecimento do usuário |
| `ready-for-agent`| `ready-for-agent` | Pronto para o agente implementar com TDD |
| `ready-for-human`| `ready-for-human` | Implementado; requer revisão/aprovação visual humana |
| `wontfix` | `wontfix` | Não será implementado |

## Transições Comuns
- `needs-triage` → `/grill-with-docs` ou `/to-spec` → `ready-for-agent`
- `ready-for-agent` → `/implement` (TDD) → `ready-for-human`
- `ready-for-human` → Revisão aprovada → `done`
