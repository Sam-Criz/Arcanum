# Domain & Architecture Context

## Projeto
**Arcanum VTT** — Plataforma modular de RPG de Mesa Virtual (React 19, TypeScript, Node.js 24 nativo, SQLite, WebSockets).

## Documentação do Domínio
- **Registro de Status e Histórico:** [STATUS.md](../../STATUS.md)
- **ADRs / Decisões Arquiteturais:** `docs/adr/`
- **Glossário e Contexto:** `docs/agents/domain.md`

## Glossário do Domínio
- **VTT (Virtual Tabletop):** Tabuleiro tático interativo com grid, tokens, fog of war, iluminação e medição de distâncias.
- **Ruleset:** Motor de regras modular configurável (`rules-engine.ts`) com cálculo determinístico de fórmulas de dados e atributos (sem `eval`).
- **Dock Tático:** Barra de ações inferior rápida do combate (Ataque, Habilidades, Consumíveis, Defesa/Esquiva).
- **Design System ("Tinta, Papel e Latão"):** Paleta canônica `#131211` (Tinta), `#1a1816` (Papel), `#c9a04e` (Latão), `#ece3d0` (Osso) e `#b24a52` (Vinho).
- **RBAC & Multi-tenant:** Isolamento estrito entre campanhas e permissões granulares de mestre (`is_master`, `co_master`, `player`).
