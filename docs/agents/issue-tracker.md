# Issue Tracker Configuration

## Type
`local-markdown`

## Location
`.scratch/issues/`

## Format
Cada issue/ticket é gravado como um arquivo markdown individual em `.scratch/issues/<id>-<slug>.md` contendo:
- Metadados no topo (Status, Priority, Labels, Created At)
- Descrição da tarefa / Acceptance Criteria
- Tasks / Sub-tasks com caixas de seleção `[ ]`
- Histórico de execução do agente

## Statuses válidos
- `backlog`: Tarefa mapeada aguardando refinamento ou priorização
- `ready-for-agent`: Especificada e pronta para execução via `/implement` ou subagente
- `in-progress`: Em andamento
- `ready-for-human`: Depende de validação humana ou testes manuais
- `done`: Concluída e testada
- `wontfix`: Cancelada / Descartada
