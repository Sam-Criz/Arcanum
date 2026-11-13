---
name: vercel_reviews
description: Audita componentes React 19 para evitar re-renderizações causadas pelo WebSocket e otimizar listas complexas.
---
# Vercel React 19 Auditor
## Instruções
- Inspecione arquivos `.tsx` garantindo que os dados em tempo real do WebSocket atualizem apenas os tokens ou combatentes específicos, sem remontar a tela inteira.
- Garanta que loops de renderização (ordem de iniciativa, itens do catálogo) utilizem chaves (`key`) estáveis e únicas do backend.
- Otimize hooks (`useMemo`, `useCallback`) em cálculos pesados do grid e do Fog of War vetorial.
