# Status do Projeto — Plataforma Modular de RPG de Mesa

**Data da última atualização:** 2026-11-13  
**Versão:** 0.25.0 (Nova Identidade Autoral "Arquivo Cartográfico & Pergaminho Noturno", Eliminação Total de Clichês de IA, Tipografia Editorial, Build Limpo e Zero Erros de Console)

---

## Destaques da Versão 0.25.0 (Arquivo Cartográfico & Pergaminho Noturno — Anti-AI & Editorial)
- **Eliminação Completa de Clichês Visuais de IA:**
  - **Zero Brilhos Neon & Zero Gradientes Artificiais:** Removidos todos os efeitos de drop shadow exagerados (`shadow-[0_0_...glow]`), bordas brilhantes artificiais e gradientes repetitivos.
  - **Fim da Simetria Robótica e Caixas Dentro de Caixas:** Hierarquia visual remodelada com divisórias de 1px hairline em pedra úmida (`#343b37`), espaçamentos fluidos e cartões assimétricos com respiração natural.
- **Nova Paleta Orgânica de Arquivo Cartográfico & Pergaminho Noturno:**
  - **Fundo Principal:** Ardósia Orgânica Profunda (`#141716`).
  - **Superfícies Secundárias:** Musgo Escuro (`#1c201e`) e Papel Envelhecido Noturno (`#252a27`).
  - **Bordas Sutis (Hairline):** Pedra Úmida (`#343b37`).
  - **Texto Principal:** Linho Natural (`#ebe7de`).
  - **Texto Secundário / Labels:** Cinza Cálido (`#9b9689`).
  - **Acento Primário:** Terracota / Cobre Oxidado (`#c86d51`).
  - **Acento Secundário:** Verde Sálvia / Musgo Vivo (`#6d9775`).
  - **Vida / Perigo Tático:** Vermelho Ferrugem (`#b84a48`).
  - **Recursos / Mana / Místico:** Azul Ardósia (`#5b8299`).
- **Tipografia Editorial Autoral:**
  - **Títulos e Cabeçalhos:** `Fraunces` com peso expressivo, estética literária e elegância cartográfica.
  - **Corpo de Texto e Interface:** `Plus Jakarta Sans` para clareza máxima, leitura limpa e ergonomia visual.
  - **Dados Técnicos, Valores e Fórmulas:** `JetBrains Mono` estritamente para modificadores, dados e valores numéricos.
- **Remodelagem Integral das Telas de `client/src/`:**
  - **Login & Cadastro (`AuthModal.tsx`):** Dossiê de registro dividido em painel cartográfico à esquerda com grade de campo, emblema de rosa-dos-ventos e formulário limpo em superfícies `#1c201e` com botão terracota.
  - **Galeria de Campanhas (`CampaignList.tsx`):** Cards editoriais com badges sóbrios de função (Mestre Criador, Mestre, Jogador), contador de membros em Verde Sálvia, e botão de ação "+ Nova Campanha" em Terracota.
  - **Workspace & Ficha de Personagem (`CampaignWorkspace.tsx`, `CharacterDetails.tsx`):**
    - Menu lateral com ícones cartográficos e indicador de aba ativa com borda fina em Terracota (`#c86d51`).
    - Barras vitais de precisão minimalista sem neon (PV em Ferrugem `#b84a48`, Sanidade/Mana em Azul Ardósia `#5b8299`, Carga em Terracota `#c86d51`).
    - Matriz de atributos de alto contraste com valores em Fraunces e modificadores destacados para rolagem em 1 clique.
    - Coluna de inventário rápido e antecedentes diagramados como um dossiê físico.
  - **Mesa Virtual VTT (100% da Tela):** Mapa maximizado sem bordas luminosas estéreis, HUDs discretos e translúcidos (`backdrop-blur-md`, `#141716/90`) com névoa de guerra integrada.
  - **Módulos Padronizados:** Mochila (`InventoryView.tsx`), Catálogo de Itens (`CatalogManager.tsx`), Bestiário (`BestiaryManager.tsx`), Editor de Modelos (`TemplateEditor.tsx`) e Ferramentas do Mestre (`MasterToolsManager.tsx`) harmonizados 100% com a nova paleta.
- **Backend Intacto & Blindado:**
  - `server/` permaneceu 100% preservado com `node:sqlite`, todas as rotas REST, contratos `api.ts`, WebSocket `subscribeVtt` e isolamento RBAC.
- **Auditoria, Compilação e Validação Automatizada E2E:**
  - **Compilação de Produção (`npm run build`):** Zero erros TypeScript no server e no client (`tsc && vite build` concluído com sucesso).
  - **Suíte de Testes do Servidor (`npm run test --workspace=server`):** **57/57 testes passando (100% de sucesso)**.
  - **Navegador Headless CDP (Edge/Chromium):** 7 telas inspecionadas com **0 erros de console JavaScript**.
  - **Artefatos Comprovatórios:**
    - `screen_1_login.png` (Tela de Login com Dossiê Cartográfico)
    - `screen_2_campaigns.png` (Galeria Editorial de Campanhas)
    - `screen_3_vtt_full.png` (Mesa Virtual VTT 100% Viewport)
    - `screen_4_character_sheet.png` (Ficha de Personagem Dossiê & Barras Segmentadas)
    - `screen_5_inventory.png` (Mochila e Inventário Atômico)
    - `screen_6_catalog.png` (Catálogo de Itens da Campanha)
    - `screen_7_bestiary.png` (Bestiário e Biblioteca de Criaturas)

---

## Destaques da Versão 0.24.0 (Remodelagem Visual Completa: Grimório Tático & VTT 100%)
- **Estética Dark Fantasy Moderna & Grimório Tático:**
  - **Fundo Profundo & Acentos:** Fundo em `#0e0d0c` (Tinta de Grimório) e `#161412` (Pergaminho Escuro), acentos refinados em Latão Forjado (`#c9a04e`) e Carmesim Rubro (`#8a2c38`), com bordas de `1px` em `#2c2825` e sombras ambientais imersivas.
  - **Tipografia Heráldica e Dados Técnicos:** Títulos em `IM Fell English` e `Cinzel`, textos de leitura em `IBM Plex Sans` e números/modificadores em `IBM Plex Mono`.
  - **Mesa Virtual VTT (100% da Tela):** Removidos espaçamentos internos estéreis (`p-0` no container central do VTT), transformando a barra superior e a fita de iniciativa em HUDs translúcidos flutuantes (`backdrop-blur-xl`, `#141210/90`) com visual moderno de VTT (estilo Foundry / Alchemy).
  - **Ficha de Personagem & Workspace:**
    - Barras vitais segmentadas com gradiente e animação (PV em Carmesim com efeito pulsante, Mana em Azul Místico e Carga atômica em Latão).
    - Matriz de atributos de alto contraste com badges de modificador numérico e rolagem instantânea em um clique.
    - Cartões de identificação, lista de personagens, equipamentos e antecedentes padronizados no design system.
  - **Padronização dos Módulos:** Mochila/Inventário, Catálogo de Itens, Bestiário, Modelos de Ficha (Templates) e Ferramentas do Mestre unificados na paleta do Grimório.
- **Validação E2E com Chromium Headless & Suíte Completa:**
  - **Zero Erros de Console:** Navegação automatizada por todas as 7 telas principais (Login, Campanhas, Mesa VTT, Ficha, Mochila, Catálogo e Bestiário) interceptando **0 erros de JavaScript**.
  - **Build 100% Limpo:** `npm run build` compilando cliente e servidor com **zero erros TypeScript**.
  - **Testes Backend:** `npm run test --workspace=server` com **57/57 testes passando (100% de sucesso)**.
  - **Evidências Visuais Salvas:** `screen_1_login.png`, `screen_2_campaigns.png`, `screen_3_vtt_full.png`, `screen_4_character_sheet.png`, `screen_5_inventory.png`, `screen_6_catalog.png`, `screen_7_bestiary.png`.

---

## Destaques da Versão 0.23.1 (Correção do Build do Servidor e `node:sqlite`)
- **Migração Estrita para `node:sqlite` no Servidor (5 arquivos):**
  - Substituída a dependência não-instalada `better-sqlite3` pelo driver nativo do Node.js 24 (`import { DatabaseSync } from 'node:sqlite'`) em:
    - `src/modules/master-tools/campaign-events.service.ts`
    - `src/modules/master-tools/environmental.service.ts`
    - `src/modules/master-tools/master-notes.service.ts`
    - `src/modules/master-tools/master-tools.service.ts`
    - `src/modules/master-tools/revelation.service.ts`
- **Correção de Tipagem no Bestiário (`bestiary.service.ts`):**
  - Adicionado o campo opcional `attributes?: Record<string, any>` na interface `BestiaryCreature`, eliminando o erro TS2353 no retorno do método `mapRow()`.
- **Validação de Compilação:**
  - `npm run build --workspace=server`: Compilação TypeScript com **0 erros**.
  - `npm --prefix client run build`: Compilação frontend com **0 erros**.
  - `npm --prefix server test`: Suíte completa de **57/57 testes passando**.

---

## Destaques da Versão 0.23.0 (Remodelagem Visual Completa: Grimório Tático)
- **Identidade Visual Dark Fantasy Moderna & Grimório Tático:**
  - **Zero alterações no `server/`:** Toda a camada de banco de dados SQLite, regras de negócios, rotas REST e WebSockets foi 100% preservada e blindada.
  - **Tela de Entrada e Login (`AuthModal.tsx`):**
    - Layout split-screen imersivo com painel tático à esquerda (grid tático com tokens simulados de Mago e Orc em combate, glow atmosférico e tipografia heráldica).
    - Formulário refinado com cartões de input com profundidade, badge dinâmico de segurança ("Acesso Restrito" / "Novo Aventureiro") e transições fluidas.
  - **Dashboard de Campanhas (`CampaignList.tsx`):**
    - Totalmente remodelado de lista plana para uma galeria de cards visuais atmosféricos com badges de sistema/regras, contador numérico de membros, destaque para função (Mestre/Jogador) e botão de ação rápida "Entrar na Mesa" com glow âmbar/dourado.
    - Modais de criação de campanha e adesão por código enriquecidos com campos bem delimitados e feedback imediato.
  - **Ficha de Personagem & Workspace (`CampaignWorkspace.tsx` / `CharacterDetails.tsx`):**
    - **Barras Vitais Segmentadas e Animadas:** PV (Vinho Rubro com efeito pulsante de perigo para vida baixa), Mana/Esforço (Azul Místico / Turquesa Arcano) e Carga/Capacidade (Âmbar Latão com marcações de proporção).
    - **Matriz de Atributos com Rolagem Direta:** Cards de atributos (FOR, DES, CON, INT, SAB, CAR) com separação destacada para o modificador numérico e acionamento de rolagem rápida em um clique.
    - **Modal de Detalhes da Ficha (`CharacterDetails.tsx`):** Fita de status com PV, PE e DEF destacados, abas de Habilidades, Antecedentes e Estatísticas Derivadas, e lista estilizada de poderes com chips de custo e alvos.
  - **Mesa Virtual VTT (`VirtualTabletop.tsx`):**
    - HUD inferior de combate rápido transformado em dock translúcido (`backdrop-blur-xl`, `#141210/90`) com contorno sutil de `1px` em latão, preservando máxima visibilidade do grid e tokens do mapa.
- **Validação e Compilação:**
  - `npm --prefix client run build`: Compilação de produção com TypeScript estrito (`tsc`) e Vite passando com **zero erros**.
  - `npm --prefix server test`: Suíte completa de **57/57 testes passando (100% de sucesso)**.
  - Captura automatizada de telas com Chromium/Edge headless via CDP: comprovando transformação visual das telas de Login, Campanhas, Mesa VTT e Ficha.

---

## Destaques da Versão 0.22.0 (Auditoria, Segurança e Polimento Visual)
- **Blindagem de Segurança e Rate Limiting (`config/index.ts`, `rate-limit.middleware.ts`, `app.ts`):**
  - Implementada trava fatal de inicialização em produção: caso `JWT_SECRET` permaneça com a chave de fallback ou vazio, o servidor interrompe a execução com erro crítico imediato.
  - Adicionado middleware de Rate Limiting em memória nas rotas de autenticação (`POST /api/auth/register` e `POST /api/auth/login`) com teto de 30 requisições por minuto por IP, mitigando ataques de força bruta e enumeração.
- **Remodelagem Visual e Polimento Impeccable (`Navbar.tsx`, `CampaignWorkspace.tsx`):**
  - Barra de navegação global modernizada com logo temática, badge comemorativo `VTT`, hierarquia aprimorada de usuário/mestre e botão de logout estilizado com ícone Lucide.
  - Menu lateral do Workspace (`CampaignWorkspace.tsx`) otimizado com suporte responsivo refinado (escalas de tamanho para telas compactas e mobile), sombras de destaque na cor Latão (`#c9a04e`), contraste elevado nos textos secundários e microinterações suaves.
- **Validação E2E com `agent-browser` e Suíte de Testes:**
  - Homologação visual em navegador headless com captura de tela (`final_validated.png`) e zero erros no console (`agent-browser errors`).
  - **57/57 testes automatizados de backend passando com 100% de sucesso.**
  - **Build de produção do frontend (`tsc && vite build`) compilado com zero erros.**

---

## Destaques da Versão 0.21.0 (Fase 6: Auditoria Geral, Integração e Estabilização de Produção)

### 1. Classificação de Itens e Correções por Severidade (/security_auditor, /tdd_expert)
- **Crítico:**
  - **RBAC Horizontal e Multi-Tenant:** Bloqueio de acesso cruzado entre campanhas. Verificação de propriedade no endpoint de rolagens `POST /api/campaigns/:campaignId/dice/rolls` impedindo que jogadores forjem rolagens para personagens de outros jogadores ou gravem rolagens órfãs com HTTP 403.
  - **Vazamento Zero de Dados em Notas Secretas:** Endpoint `GET /api/notes/:noteId` integrado com checagem de membro e resposta HTTP `404 Not Found` (em vez de 403) para não-mestres/não-autorizados, impossibilitando enumeração de IDs e vazamento de notas secretas.
  - **Sanitização de Monstros Ocultos no Bestiário:** Monstros ocultos ou não revelados têm atributos mascarados para jogadores comuns, impedindo vazamento de fraquezas e ficha no payload.
  - **Transações Atômicas no SQLite:** Compras, transferências e consumo de itens executados sob transação atômica (`db.transaction()`), garantindo rollback imediato em caso de saldo insuficiente, excesso de peso ou falha de concorrência.
- **Alto:**
  - **Eventos em Tempo Real Filtrados:** `broadcastEventNotification` refatorado para utilizar `broadcastFiltered`, assegurando que eventos `master_only` e direcionados a alvos específicos (`target_user_ids` / `target_user_id`) cheguem exclusivamente aos destinatários autorizados via WebSocket.
  - **Eliminação de F5 no Chat e VTT:** Aliases `/api/campaigns/:campaignId/chat/messages` e `/api/campaigns/:campaignId/chat` unificados com suporte a `{ content }` e `{ text }`, e sincronização imediata sem recarregar tela.
- **Médio:**
  - **Design System "Tinta, Papel e Latão":** Erradicação de popups nativos (`confirm(...)`) em `MasterToolsManager.tsx`, substituídos por modal in-app `notify.confirm(...)`.
  - **Viewport 100dvh no VTT:** `CampaignWorkspace.tsx` atualizado para `100dvh` e remoção de tons azulados/arroxeados residuais em `VirtualTabletop.tsx` com paleta canônica `#131211`, `#1a1816`, `#c9a04e` e `#ece3d0`.
- **Baixo:**
  - **Tratamento de Booleanos em SQLite:** Normalização de flags booleanas (`is_equipped`, `is_active`) armazenadas como inteiros `0 | 1` no banco SQLite nativo.

### 2. Rotas e Arquivos Modificados
- **Backend:**
  - `server/src/app.ts`: Verificação prévia de posse do personagem nas rolagens, montagem segura de `GET /api/notes/:noteId`, rota unificada de chat e filtragem de WebSocket em eventos.
  - `server/src/modules/master-tools/campaign-events.service.ts`: Compatibilidade com arrays e strings para `target_user_ids` / `target_user_id`.
  - `server/src/modules/master-tools/revelation.service.ts`: Suporte a chaves flexíveis de fraqueza (`weakness`, `weaknesses`, `fraqueza`) na revelação granular.
- **Frontend:**
  - `client/src/components/MasterToolsManager.tsx`: Adoção do modal in-app `notify.confirm` para exclusão de notas.
  - `client/src/components/VirtualTabletop.tsx`: Substituição de classe utilitária de cor não-canônica por `#ece3d0`.
  - `client/src/components/CampaignWorkspace.tsx`: Altura fixada em `100dvh` e prevenção de overflow.
- **Suítes de Testes Node.js 24 Criadas:**
  - `server/tests/rbac_isolation.test.ts` (Multi-tenant, bloqueio entre campanhas e proteção de rolagens).
  - `server/tests/payload_leakage.test.ts` (Sanitização do Bestiário e resposta 404 em notas secretas).
  - `server/tests/atomic_transactions.test.ts` (Transações atômicas de inventário e rollback em saldo insuficiente).
  - `server/tests/realtime_events.test.ts` (WebSocket direcionado sem vazamento e persistência do chat).
  - `server/tests/regression_suite.test.ts` (Suíte completa de regressão: combate, inventário, fichas e tokens).

### 3. Métricas de Validação
- **Testes Backend:** 57/57 suítes passando (100% de sucesso no test runner nativo do Node.js 24).
- **Compilação Frontend:** `tsc && vite build` com zero erros e bundle otimizado.
- **Segurança:** Zero uso de `eval()`, zero vazamento de metadados, integridade relacional total.

---

## Destaques da Versão 0.20.1 (Sincronização e Visibilidade das Condições Ambientais no VTT)
- **Correção da Consulta de Condições por Cena e Campanha (`app.ts`, `environmental.service.ts`):**
  - Implementado o endpoint dedicado `GET /api/campaigns/:campaignId/scenes/:sceneId/conditions` (e alias `/api/campaigns/:campaignId/conditions`).
  - Para jogadores comuns (`is_master = 0`): a consulta filtra estritamente `is_active = 1 AND is_visible_to_players = 1`, retornando condições ativas da cena e globais da campanha.
  - Para o Mestre (`is_master = 1`): retorna todas as condições da cena (ativas, inativas, visíveis e ocultas).
  - Sanitização de parâmetros de consulta: valores vazios ou literais de string são tratados com segurança para evitar quebras de query SQL.
- **Sincronização Bidirecional em Tempo Real via WebSocket (`app.ts`, `CampaignWorkspace.tsx`):**
  - Função `broadcastConditionEvent` utilizando `broadcastFiltered`:
    - Mestres recebem todos os eventos de ciclo de vida (`created`, `updated`, `deleted`).
    - Quando uma condição ativa visível (`is_visible_to_players = 1 && is_active = 1`) é criada ou atualizada, os jogadores recebem instantaneamente a condição via eventos `scene:condition_updated`, `environmental:updated` e `environment:change`.
    - Quando uma condição é desativada (`is_active = 0`) ou ocultada (`is_visible_to_players = 0`), os jogadores recebem o evento com flag `removed: true`, expurgando a condição do mapa sem necessidade de recarregar a página (F5).
  - `CampaignWorkspace.tsx`: expandido o filtro de repasse de mensagens para o VTT, incluindo `environmental:` e `environment:`.
- **ActiveConditionsOverlay no Viewport do VTT (`VirtualTabletop.tsx`):**
  - Adicionado banner flutuante no canto superior do mapa (`absolute top-3 left-3 z-30`), renderizando tags estilizadas no Design System.
  - Design System "Tinta, Papel e Latão": bordas arredondadas (`rounded-lg`), fundo translúcido em Tinta (`bg-[#131211]/85 backdrop-blur-md`), borda em Latão (`border-[#c9a04e]/60`) e texto em tom Osso (`#ece3d0`).
  - Mapeamento dinâmico de ícones temáticos (`CloudRain`, `Skull`, `Zap`, `Wind`, `Flame`, `Sun`, `Moon`, `Sparkles`).
  - Tooltip flutuante no cursor (`group-hover`) com título, rodadas de duração, descrição narrativa e detalhamento mecânico (`formula` e `damage_type`).
  - Indicador de visibilidade (`Eye` / `EyeOff`) visível exclusivamente para o Mestre.
- **TDD e Validação Automatizada:**
  - Atualizada a suíte `server/tests/environmental-conditions.test.ts` com conexões WebSocket reais (Mestre e Jogador).
  - Validados os 3 fluxos obrigatórios:
    1. Condição visível e ativa retornada no payload de jogador comum e propagada no WebSocket.
    2. Condição oculta (`is_visible_to_players = 0`) omitida do payload do jogador e bloqueada no WebSocket.
    3. Broadcast WebSocket disparando evento de remoção imediata (`removed: true`) ao desativar a condição.
  - **52/52 testes de backend passando com 100% de sucesso.**
  - **Build de produção do frontend (`tsc && vite build`) compilado com zero erros.**

---

## Destaques da Versão 0.20.0 (Fase 5: Ferramentas Avançadas do Mestre)
- **1. Condições Ambientais Persistentes por Cena e Campanha (`environmental.service.ts`, `MasterToolsManager.tsx`):**
  - Modelagem em SQLite com tabela `environmental_conditions` vinculada a `campaign_id` e `scene_id`.
  - Suporte a condições puramente narrativas e condições mecânicas com modificadores e fórmulas parseadas deterministicamente pelo Rules Engine (`Evaluator`).
  - Alternância atômica de ativação (`is_active = 0 | 1`) com broadcast em tempo real via WebSocket (`ENVIRONMENTAL_CONDITION_UPDATED`).
  - Isolamento multi-tenant estrito: Mestres de campanhas distintas não interferem nem listam condições de outras mesas.
- **2. Agendamento e Disparo de Eventos de Campanha e Cena (`campaign-events.service.ts`):**
  - Tabela `campaign_events` com tipos de gatilho: `manual`, `scheduled` e `trigger`.
  - Persistência de agendamentos em disco: eventos agendados sobrevivem à reinicialização do servidor (`processScheduledEvents` reidrata e processa eventos pendentes no boot).
  - Execução atômica de payloads de ação: disparo de mensagens no chat e ativação de condições ambientais programadas.
  - Histórico auditável de execuções com atualização de `status` e timestamps de execução.
- **3. Notas Secretas do Mestre com Censura Total no Backend (`master-notes.service.ts`):**
  - Tabela `master_notes` com flags de privacidade (`is_private = 1`) e lista de destinatários autorizados (`shared_with_user_ids`).
  - Censura estrita pré-serialização: Usuários comuns sem autorização recebem código HTTP `404 Not Found` (em vez de `403`), prevenindo enumeração de notas existentes e vazamento de metadados (/security_auditor).
  - Compartilhamento granular com jogadores específicos da mesa e revogação imediata.
- **4. Matriz de Acesso e Revelação Granular por Jogador (`revelation.service.ts`):**
  - Tabela `entity_revelations` com suporte a entidades (`creature`, `npc`, `clue`, `note`).
  - Suporte a visões assimétricas: revelação de campos específicos (ex: `stats`, `weaknesses`, `lore`, `abilities`) para jogadores individuais ou para a mesa inteira (`is_public = 1`).
  - Sanitização de entidades no backend: criaturas do Bestiário têm seus atributos mascarados no payload antes do envio para jogadores que não possuem revelação concedida.
- **5. Interface do Mestre Integrada ao Design System (`MasterToolsManager.tsx`, `CampaignWorkspace.tsx`):**
  - Nova aba "Mestre" com ícone de Coroa na barra de navegação lateral (exclusiva para Mestres/Auxiliares).
  - 4 sub-painéis temáticos em conformidade com o Design System ("Tinta, Papel e Latão"):
    - *Condições Ambientais*: Listagem, toggles rápidos, filtros por cena e criação com modificadores mecânicos.
    - *Eventos de Cena*: Disparo manual instantâneo, agendamento de eventos e visualização de ações atreladas.
    - *Notas Secretas*: Editor de notas, controle de privacidade e modal de compartilhamento por membro.
    - *Matriz de Revelação*: Configuração de campos revelados por entidade e por jogador.
- **6. TDD e Validação Automatizada:**
  - 4 novas suítes de testes cobrindo todas as frentes:
    - `server/tests/environmental-conditions.test.ts`
    - `server/tests/campaign-events.test.ts`
    - `server/tests/master-notes-security.test.ts`
    - `server/tests/entity-revelations.test.ts`
  - **52/52 testes de backend passando com 100% de sucesso.**
  - **Build de produção do frontend (`tsc && vite build`) compilado com zero erros.**

---

## Destaques da Versão 0.19.6 (Desacoplamento de Fichas e Renderização de Recursos Reais)
- **Desacoplamento de Recursos e Fim de Mocks Estáticos (`CampaignWorkspace.tsx`):**
  - **Vida e Mana Reais:** Eliminados os fallbacks estáticos hardcoded (`36/50` e `5/20`) e larguras fixas de barra (`72%` e `25%`). Valores agora são recomputados via `useMemo` com base em `selectedCharacter.current_hp` / `max_hp` (ou `vida_atual` / `vida_max`, `mana_atual` / `mana_max`) e percentual dinâmico `Math.round((hp / maxHp) * 100)`.
  - **Carga a partir do Inventário Real:** Eliminado o valor fixo `18 / 28 kg` e `64%`. A carga atual é calculada diretamente somando `weight * quantity` dos itens do inventário no SQLite, e a capacidade máxima é computada dinamicamente via `10 + Forca * 2` (ou regra configurada no ruleset).
- **Estatísticas Derivadas Recalculadas Deterministicamente (`CampaignWorkspace.tsx`):**
  - Defesa, Iniciativa e Redução de Dano (RD) não usam mais os valores fixos `16`, `+3` e `1`.
  - Recalculados deterministicamente sem `eval`: Defesa base `10 + modDestreza` somada aos bônus de escudos/armaduras equipadas; Iniciativa baseada em `modDestreza` com sinal dinâmico (`+` / `-`); RD derivada da ficha somada aos bônus de equipamentos.
- **Antecedentes Reais por Personagem (`CampaignWorkspace.tsx`, `CharacterDetails.tsx`):**
  - Eliminados os textos repetidos ("Viajante dos Ermos", "Aventureiro", "Comum") e histórias padrão de investigador paranormal.
  - Campos de Origem/Histórico, Ofício/Ocupação e Idiomas/Dialetos leem estritamente `selectedCharacter.raw_data` com fallback limpo para `" — "` quando não preenchidos.
  - Subtítulo do cabeçalho da ficha agora reflete a classe/modelo autêntico da ficha em vez de rótulo fixo.
- **Isolamento e Atualização no Backend (`character.service.ts`):**
  - `computeCharacterFields`, `getCampaignCharacters` e `getCharacterById` sincronizam atomicamente `carga_atual` e `total_itens` consultando a tabela `character_inventory`.
  - Atribuição de `carga_max` e `capacidade_carga` (`10 + Forca * 2`) diretamente na criação e recomputação da ficha.
- **Otimizações Vercel Reviews e React 19:**
  - `useMemo` com dependências estritas `[selectedCharacter, ruleset, characterInventory, equippedItems]` garantindo atualização instantânea sem renderizações residuais ou cache inconsistente ao trocar entre personagens na lista lateral.
- **TDD e Validação Automatizada:**
  - Criada a suíte `server/tests/character-resources-and-backgrounds.test.ts` cobrindo 3 cenários obrigatórios (isolamento de dados, independência de updates via PATCH e cálculo dinâmico de peso de itens na mochila).
  - **48/48 testes de backend passando com 100% de sucesso.**
  - **Build de produção do frontend (`tsc && vite build`) compilado com zero erros.**

---

## Destaques da Versão 0.19.5 (Correções Críticas: Membros, Armas da Mochila, Chat WS e Dashboard)
- **Correção da Exclusão de Membros (`campaign.service.ts`, `CampaignWorkspace.tsx`):**
  - Resolvido mismatch de propriedade: `getMembers` agora retorna compatibilidade completa com `userId`, `user_id` e `id`.
  - Backend com fallback inteligente para buscar tanto por `user_id` quanto por `membership_id`.
  - Removido o erro "Jogador não é membro desta campanha" disparado ao confirmar exclusão.
  - Atualização reativa imediata da lista de membros sem necessidade de F5.
- **Dock Tático com Armas da Mochila e Ação de Equipar (`VirtualTabletop.tsx`):**
  - A aba "Ataque" agora lista todas as armas do inventário (equipadas e na mochila), mantendo também o "Ataque Desarmado".
  - Armas desequipadas na mochila exibem badge "Na mochila" e carregam seus dados reais de ataque e dano (ex: `1d8 Cortante`) ao serem selecionadas no painel central.
  - Adicionado botão inline `+ Equipar` / `✓ Equipada` diretamente no card da arma selecionada no Dock Tático, permitindo alternar o equipamento em tempo real via `api.updateCharacterInventoryItem`.
- **Chat em Tempo Real 100% Reativo com Auto-Scroll (`ws.server.ts`, `app.ts`, `CampaignWorkspace.tsx`, `CombatTracker.tsx`):**
  - Padronizada a estrutura de broadcast WebSocket para propagar tanto payload direto quanto aninhado (`message`).
  - Listeners em `CombatTracker.tsx` e `CampaignWorkspace.tsx` fazem append reativo instantâneo na lista local sem exigir recarga de página.
  - Implementado auto-scroll automático para o final da conversa a cada nova mensagem enviada ou recebida.
  - Chaves de renderização únicas baseadas no ID da mensagem para evitar re-renderizações e duplicações (diretrizes React 19).
- **Dashboard: Ocultação Estrita do Card de Boas-Vindas (`CampaignList.tsx`, `App.tsx`):**
  - O card "Conta nova, sem campanhas" é renderizado estritamente quando `campaigns.length === 0 && !isLoading`.
  - Eliminado o bloco duplicado que era renderizado no rodapé quando o usuário já possuía campanhas cadastradas.
- **TDD e Validação Automatizada:**
  - Suíte `server/tests/skills-chat-and-member-management.test.ts` atualizada com 5 cenários completos.
  - **47/47 testes de backend passando com 100% de sucesso.**
  - **Build de produção do frontend (`tsc && vite build`) compilado com zero erros.**

---

## Destaques da Versão 0.19.4 (Classificação no Dock, Habilidades Reais com Teto, Chat SQLite/WS e Kick de Jogador)
- **Correção da Classificação de Armas vs Consumíveis no Dock Tático (`VirtualTabletop.tsx`):**
  - Armas equipadas (como a "adaguinha" de tag ARMA) são estritamente direcionadas para a aba **"Ataque"**.
  - O filtro de **"Consumíveis"** agora rejeita categoricamente armas (`isWeaponItem(i) === false`), exigindo itens de consumo/uso (`category in ('consumivel', 'pocao', 'oleo')` ou propriedades de cura/condição) com quantidade > 0.
- **Correção de Serialização e Deduplicação da Imbuição de Armas (`InventoryView.tsx`, `inventory.service.ts`):**
  - Eliminado o bug que exibia a tag quebrada `+undefined% veneno (permanente)` duplicada.
  - Implementado cálculo com fallback dinâmico: se não houver percentual ou fórmula customizada, extrai diretamente o dano do óleo/consumível (`consumableProps.dano`).
  - As tags no inventário são deduplicadas e exibem com precisão o número de cargas restantes (`eff.charges_remaining`).
- **Eliminação de Habilidades Fantasmas e CRUD com Teto Configurável (`character.service.ts`, `CampaignWorkspace.tsx`):**
  - Removido o fallback mock genérico `ab-foco` do Dock Tático e das Fichas: apenas habilidades autênticas da ficha do combatente são renderizadas. Se não houver habilidades, exibe badge `0` e estado vazio indicando ausência de técnicas aprendidas.
  - Criada a coluna `max_skills_per_character` na tabela `campaigns` (padrão 6, configurável na criação/edição da campanha).
  - Implementadas as rotas `POST /api/campaigns/:campaignId/characters/:characterId/skills` e `DELETE .../:skillId`:
    - Adicionar habilidades além do teto bloqueia com `400 Bad Request`.
    - Interface das fichas atualizada com botão `+ Nova Habilidade` (modal de nome, tipo de ação, custo, alcance e fórmulas), contagem `X / maxSkills` e botão de remoção por lixeira com confirmação.
- **Chat de Combate e Mesa em Tempo Real Persistente no SQLite (`CombatTracker.tsx`, `campaign.service.ts`, `ws.server.ts`):**
  - Criada a tabela `campaign_chat_messages` no SQLite com índices para recuperação de mensagens.
  - Criados os endpoints `GET /api/campaigns/:campaignId/chat/messages` e `POST .../chat/messages`.
  - Conectados o Chat da Mesa e a aba Chat do `CombatTracker.tsx`: hidratação automática no mount (persistente a recargas/F5) e sincronização instantânea sem duplicação via WebSocket `chat:message`.
- **Gestão de Jogadores e Expulsão pelo Mestre (`campaign.service.ts`, `app.ts`, `CampaignWorkspace.tsx`):**
  - Implementada a rota `DELETE /api/campaigns/:campaignId/members/:targetUserId`:
    - Validação estrita de autorização: apenas Mestre/Owner pode remover (`403 Forbidden` para jogador comum).
    - Desassocia tokens e participantes de combate do usuário removido.
    - Emite evento WebSocket `campaign:member_removed` e encerra a conexão do jogador expulso com `campaign:kicked`.
  - Painel de Membros na TopBar com lista de participantes e botão `Remover da Campanha` (estilizado em vinho `#b24a52`) com confirmação.
- **TDD e Validação Automatizada:**
  - Criada a suíte `server/tests/skills-chat-and-member-management.test.ts` cobrindo os 4 cenários essenciais.
  - **46/46 testes de backend passando com 100% de sucesso.**
  - **Build de produção do frontend (`tsc && vite build`) compilado com zero erros.**

---

## Destaques da Versão 0.19.3 (Dock Tático Dinâmico, Alvos Aliados/Inimigos, Imbuir e Consumíveis)
- **Dock Tático 100% Reativo ao Token/Personagem Selecionado (`VirtualTabletop.tsx`):**
  - **Aba "Ataque":** Lista exclusivamente armas equipadas (`is_equipped = 1`) do inventário real no SQLite do personagem ativo. Se desarmado, disponibiliza automaticamente o "Ataque Desarmado".
  - **Aba "Habilidades":** Carrega dinamicamente a lista de técnicas/magias reais associadas à ficha (`raw_data.abilities`), com fórmulas de rolagem e custo de ação.
  - **Aba "Consumíveis":** Carrega consumíveis presentes na mochila com quantidade > 0, calculando se o efeito é cura, dano contínuo, condição ou encantamento.
  - **Aba "Defesa e esquiva":** Implementadas as ações base universais para todos os combatentes: "Defesa Normal" (+2 RD) e "Esquiva Normal" (rola 1d20 + Agilidade para elevar defesa).
- **Seleção Completa de Alvos (Aliados, Inimigos e Self):**
  - Modal e ciclo rápido "Trocar alvo" (`TargetSelector`) com listagem de todos os combatentes da cena.
  - Distinção visual explícita alinhada ao design system:
    - **Você mesmo:** Indicador Latão `#c9a04e` (`[Você]`).
    - **Aliado:** Indicador Verde Tático `#5e9b76` (`Aliado`).
    - **Inimigo:** Indicador Vinho `#b24a52` (`Inimigo`).
  - Permite auto-seleção (para curas, auto-buffs e consumíveis) e suporte a aliados, validando compatibilidade mecânica sem restringir a inimigos.
- **Retorno da Ação "Imbuir Arma" no Combate:**
  - Na aba "Ataque", armas equipadas contam com o botão "Imbuir Arma".
  - Modal contextual lista óleos e reagentes de encantamento da mochila do personagem ativo.
  - Execução atômica no backend (`action_mode: 'imbue'`) consumindo 1 unidade do óleo e vinculando tags de dano elemental e status na arma.
- **Processador de Condições & Status de Consumíveis:**
  - Consumíveis aplicam condições imediatas e contínuas no motor de regras (`envenenado`, `abencoado`, etc.) em transações SQLite atômicas.
  - Suporte completo a itens prejudiciais (como tomar veneno) ou benéficos, debitando vida/recurso, deduzindo o inventário e sincronizando barra de vida e badges via WebSocket.
- **TDD e Validação Automatizada:**
  - Criada suíte de testes `server/tests/combat-dock-and-consumable-effects.test.ts` validando os 4 cenários essenciais.
  - **41/41 suítes de teste de backend passando 100%.**
  - **Build de produção do frontend (`tsc && vite build`) compilado com zero erros.**

---

## Destaques da Versão 0.19.2 (Fichas Reais, Habilidades, Toasts In-App e Viewport Tático)
- **Eliminação de Mocks e Vínculo Reativo Real nas Fichas (`CampaignWorkspace.tsx`):**
  - **Coluna 3 ("Equipado"):** Conectada a `api.getCharacterInventory`, filtrando em tempo real itens com `is_equipped === 1`, com contador dinâmico e tooltip com tipo e bônus.
  - **Coluna 3 ("Antecedentes"):** Renderiza dados autênticos do personagem (`raw_data.history`, `antecedentes`, `languages`, `idiomas`, `crafting`, `oficio`) com fallback elegante, eliminando valores estáticos.
  - **Coluna 3 ("Rolagens Recentes"):** Conectada ao histórico real de rolagens WebSocket/API (`rollHistory`), filtrada exclusivamente para o personagem ativo ou rolagens globais da campanha.
- **Aba Dedicada de "Habilidades & Magias" (`CampaignWorkspace.tsx` e `CharacterDetails.tsx`):**
  - Adicionada aba navegável com lista de habilidades da ficha (`raw_data.abilities` / `habilidades`), custo de PE/Ação e botão de execução direta de rolagem determinística via `api.rollDice` (sem `eval`).
  - Atualizado [`CharacterDetails.tsx`](file:///c:/Users/clauc/Documents/Rpg/client/src/components/CharacterDetails.tsx) com abas completas ("Habilidades", "Antecedentes", "Atributos & Dados") e integração ao motor de regras.
- **Sistema de Notificações / Toasts In-App & Modais de Confirmação (`NotificationProvider.tsx`):**
  - Criado o componente [NotificationProvider.tsx](file:///c:/Users/clauc/Documents/Rpg/client/src/components/NotificationProvider.tsx) e exportado singleton `notify` / hook `useNotification`.
  - Design estrito no tema "tinta, papel e latão" (Papel `#1a1816`, Tinta `#131211`, Couro `#2c2825`, Latão `#c9a04e`, Osso `#ece3d0`, Vinho `#b24a52`), com indicador de acessibilidade `[IIII]` e auto-dismiss (4s).
  - Substituídas **100% das chamadas nativas** `window.alert()`, `confirm()` e `window.prompt()` em todos os componentes (`VirtualTabletop.tsx`, `CombatTracker.tsx`, `BestiaryManager.tsx`, `CatalogManager.tsx`, `InventoryView.tsx`, `TemplateEditor.tsx`, `CampaignWorkspace.tsx`).
- **Enquadramento Perfeito do Mapa Tático (Viewport 100vh sem Scroll):**
  - Em [`VirtualTabletop.tsx`](file:///c:/Users/clauc/Documents/Rpg/client/src/components/VirtualTabletop.tsx), substituído container estático `h-[780px]` por `h-full flex-1 min-h-0 relative overflow-hidden`.
  - Em [`CampaignWorkspace.tsx`](file:///c:/Users/clauc/Documents/Rpg/client/src/components/CampaignWorkspace.tsx), TopBar condensada oculta quando `activeTab === 'vtt'`, garantindo dock tático perfeitamente visível na base da tela sem rolagem vertical desnecessária.
- **Validação Automatizada:**
  - 40/40 suítes de teste de backend passando 100%.
  - Build de produção do frontend (`tsc && vite build`) compilado com zero erros.

---

## Destaques da Versão 0.19.1 (Refinamento VTT, CharacterDetails e Segurança de Criação)
- **Centralização Geométrica do Dock Tático Inferior:**
  - Em [`VirtualTabletop.tsx`](file:///c:/Users/clauc/Documents/Rpg/client/src/components/VirtualTabletop.tsx), reposicionado o container de ação de combate para `absolute bottom-3 inset-x-0 z-30 flex justify-center px-4 pointer-events-none` com filho `max-w-4xl pointer-events-auto`, eliminando desvios de subpixel de translação.
- **Integração de CharacterDetails no VTT:**
  - Componente [`CharacterDetails.tsx`](file:///c:/Users/clauc/Documents/Rpg/client/src/components/CharacterDetails.tsx) importado e tipado.
  - Clique no token de jogador no mapa tático (ou no HUD inferior esquerdo `[Ficha]`) abre a modal com habilidades especiais, magias, PV e antecedentes.
- **Trava de Segurança Estrita em Criação de Personagens (403 Unauthorized/Forbidden):**
  - Em [`server/src/app.ts`](file:///c:/Users/clauc/Documents/Rpg/server/src/app.ts#L515-L539), se uma requisição `POST /api/campaigns/:campaignId/characters` for realizada por jogador comum (`!isMaster`), a rota rejeita com **`403 Forbidden`**, registra a pendência no banco SQLite e emite notificação WebSocket (`character_request:created`) para o Mestre da campanha.
- **Sanitização de Cores das Telas Secundárias e Chat:**
  - Removidos fundos azulados e arroxeados residuais de todas as telas secundárias (Chat, Rolagens, Regras, Modais e Bestiário), padronizando para `#131211` / `#1a1816` com `backdrop-blur-md` e borda `#2c2825`.
- **Validação Automatizada:**
  - 40/40 suítes de teste de backend passando 100%.
  - Build do cliente compilando com 0 erros (`tsc && vite build`).

---

## Destaques da Versão 0.19.0 (Combate Tático V2, Segurança de Rolagens e Aprovação de Fichas)
- **Barra Inferior de Combate no VTT (Fidelidade Total à Imagem 5):**
  - Barra de ações táticas expandida em 2 colunas com abas superiores e contadores numéricos (`Ataque 3`, `Habilidades 3`, `Consumíveis 2`, `Defesa e esquiva`).
  - **Coluna Esquerda:** Lista vertical de ações com badges de disponibilidade (`Equipada`, `Indisponível: sem munição`, `Pronta`, `1 disponível`).
  - **Coluna Direita:** Card descritivo com 3 caixas de métricas calculadas em tempo real (`Teste de ataque`, `Dano se acertar`, `Custo da ação`), linha de alvo com validação (`Alvo válido`) e botão para `Trocar alvo` ciclando entre inimigos válidos.
  - **Botão de Confirmação:** Destaque em vinho oficial (`#8a2c38` / `#b24a52`) executando `api.applyCombatAction` diretamente com feedback dinâmico de acerto/dano na própria barra.
- **Dock Lateral Contextual de Combate (Ficha, Registro, Rolagens, Chat):**
  - Implementadas as 4 abas requeridas pela especificação: `Ficha` (estatísticas táticas do combatente ativo), `Registro` (logs discriminados com dano e ataques), `Rolagens` (histórico de rolagens com fórmulas e dados) e `Chat` (mensagens rápidas da mesa).
- **Segurança — Impedir Rolagens em Fichas de Outros Jogadores:**
  - O endpoint `POST /campaigns/:campaignId/rules/roll` e `/dice/roll` agora valida rigorosamente a propriedade do personagem. Se `characterId` for fornecido e pertencer a outro jogador, o backend rejeita imediatamente com `403 Forbidden` (`char.user_id === req.user.userId || isMaster`).
  - Na interface de Fichas (`CampaignWorkspace.tsx`), jogadores comuns têm os cliques de teste de atributos bloqueados com indicador de somente leitura quando visualizam fichas alheias.
- **Segurança — Aprovação de Criação de Personagens (Migração 11):**
  - Adicionada a coluna `require_character_approval` em `campaigns` e a tabela `character_creation_requests` para campanhas que exigem aprovação de novos personagens pelo Mestre.
  - Quando ativada a aprovação, requisições de criação de personagens por jogadores retornam `202 Accepted` (`pending_approval`) e aguardam revisão do Mestre.
  - Endpoints administrativos: `GET /character-requests`, `POST /character-requests/:requestId/approve` (instancia a ficha e notifica via WebSocket) e `POST /character-requests/:requestId/reject` (registra motivo e descarta).
  - Interface no painel de Fichas com lista de aprovações pendentes para o Mestre e aviso de status para o jogador.
- **Harmonização Visual Estrita — Eliminação Total de Roxo/Índigo Residual:**
  - Varredura completa em todos os 10 componentes do frontend (`client/src/components/*`), eliminando todas as classes `indigo-*`, `purple-*` e `violet-*` decorativas residuais e aplicando os tokens oficiais do Arcanum (Latão `#c9a04e`, Vinho `#8a2c38`, Carvão `#131211`, Papel `#1a1816`, Couro `#2c2825`, Osso `#ece3d0`, Borda `#574e45`).
- **TDD e Qualidade de Código:**
  - Criada a nova suíte `server/tests/character-approval-and-roll-security.test.ts` com 10 testes cobrindo todas as novas regras de autorização e aprovação.
  - **41 testes do backend passando com 100% de sucesso.**
  - **Compilação do frontend (`tsc && vite build`) passando com código 0 e sem avisos.**

---

## Destaques da Versão 0.18.0 (Segurança do Catálogo & Economia Atômica)
- **Eliminação de Obtenção Gratuita e Infinita de Itens:**
  - Jogadores não conseguem mais adicionar itens ao inventário de forma arbitrária ou contornar pagamentos.
  - O endpoint `POST /characters/:characterId/inventory/purchase` implementa a compra atômica com validação estrita no servidor.
  - Concessões administrativas gratuitas foram isoladas na rota `POST /characters/:characterId/inventory/grant`, acessível exclusivamente por Mestres.
- **Novas Propriedades dos Itens do Catálogo (Migração 10):**
  - `is_hidden` (booleano, padrão 0): Itens ocultos são completamente filtrados pelo backend nas listagens para jogadores. Consultas diretas por ID ou tentativas de compra por jogadores retornam `404 Not Found` para não revelar sua existência.
  - `is_purchasable` (booleano, padrão 1): Itens com a compra desativada são recusados para jogadores com a mensagem obrigatória: *"Este item requer concessão direta do Mestre."*.
- **Transações Atômicas e Prevenção de Injeção de Valores:**
  - A operação de compra utiliza transações SQLite atômicas (`BEGIN TRANSACTION / COMMIT / ROLLBACK`).
  - O preço unitário é consultado estritamente no banco de dados (`items.cost`), rejeitando qualquer manipulação de preço ou saldo enviada pelo cliente.
  - O saldo do personagem é debitado atomicamente na mesma transação. Saldo insuficiente cancela a operação sem alterações.
  - Quantidades inválidas, negativas ou fracionadas são rejeitadas.
  - Cada compra é registrada na tabela `audit_logs` com os detalhes financeiros da transação.
- **Interface do Catálogo e Inventário:**
  - [CatalogManager.tsx]: Controles com um clique para o Mestre (alternar visibilidade com `Eye/EyeOff` e comprabilidade com `Coins/Lock`), badges discretos no card, e modal de compra rápida para o jogador com cálculo em tempo real do total e validação do saldo.
  - [InventoryView.tsx]: Exibição destacada do Saldo Atual de Moedas nas métricas superiores da mochila e concessão administrativa para Mestres.
- **Validação Automatizada Completa:**
  - Criada suíte de testes [catalog-security-and-economy.test.ts] cobrindo todos os 15 cenários de segurança, economia, isolamento e auditoria.
  - **30/30 testes do backend passando com sucesso.**
  - **Compilação do frontend (`tsc && vite build`) passando com código 0 e sem avisos.**

---


## Destaques da Versão 0.17.0 (Reformulação Visual V2)
- **Design System Arcanum Oficial Aplicado Rigorosamente:**
  - Tipografia: Serifada (*IM Fell English*), Sans (*IBM Plex Sans*) e Mono (*IBM Plex Mono*).
  - Cores: Tinta (`#131211`), Papel (`#1a1816`), Couro (`#2c2825`), Osso (`#ece3d0`), Latão (`#c9a04e`), Vinho (`#8a2c38`), Vida (`#b24a52`), Mana (`#6f93ad`), Cura (`#5e9b76`), Condição (`#9a83c6`), Apoio (`#aaa292`), Borda (`#574e45`).
- **Autenticação (Login / Cadastro):**
  - Layout split em 2 colunas: preview tático de mesa com grid e tokens à esquerda, formulário limpo à direita com botão em latão.
- **Lista de Campanhas:**
  - Tabela elegante em linhas: `Campanha`, `Sistema de regras`, `Seu papel` (badges com cores oficiais) e `Membros`. Bloco pontilhado para contas novas.
- **Menu Lateral & Ficha de Personagem:**
  - Menu vertical lateral compacto (`Mesa`, `Fichas`, `Mochila`, `Rolagens`, `Catálogo`, `Bestiário`, `Modelos`, `Regras`, `Chat`, `Lore`, `Áudio`).
  - Layout da Ficha em 3 colunas: Coluna 1 (Personagens), Coluna 2 (Identificação, Recursos, Atributos, Defesas e Fórmulas), Coluna 3 (Equipado, Antecedentes e Rolagens Recentes).
- **Mesa Tática (VTT) & Combate (Imagem 5):**
  - **Fita de Iniciativa Horizontal no Topo:** cartões horizontais de combatentes com iniciativa, nome, mini status de vida e botão *"Encerrar turno"*.
  - **Barra Inferior de Ações de Combate:** abas *Ataque*, *Habilidades*, *Consumíveis*, *Defesa e esquiva*, card descritivo da ação e botão vinho *"Confirmar ataque"*.
  - **Dock Contextual Lateral Direito:** abas *Iniciativa*, *Ficha*, *Registro (logs)* com histórico de danos e ações.
- **Harmonização Completa dos Módulos:**
  - *Mochila & Carga*, *Catálogo de Itens*, *Bestiário & NPCs* e *Modelos de Ficha* migrados integralmente da paleta genérica para os tokens oficiais.
- **Qualidade & Segurança:**
  - 100% de compilação (`tsc && vite build`) sem avisos ou erros de tipos.
  - 29/29 testes automatizados do backend passando com sucesso.

---


## Destaques da Versão 0.16.0 (Proteção de Segredos na Validação de Turno e Combate)
- **Blindagem Contra Vazamento de Nomes na Validação de Turno:**
  - Corrigido o vazamento em que o backend informava o nome real de criaturas ocultas ou com identidades protegidas quando um jogador tentava agir fora de seu turno.
  - Implementada a função centralizada `formatTurnErrorMessage(actorCombatant, activeCombatant, isMaster)`:
    - Se a criatura da vez estiver oculta para jogadores (`is_hidden = true / 1`), a mensagem retornada é estritamente genérica: `"Não é seu turno de agir."`, sem expor nome real, espécie, apelido ou anotações confidenciais.
    - Se a criatura estiver visível mas com nome mascarado (`revealed_fields.name = false`), utiliza o nome público autorizado (`display_name_players`, ex: `"Cavaleiro Negro Enigmático"` ou `"luix"`), nunca o nome verdadeiro interno.
    - Se o usuário for o Mestre (`isMaster = true`), mantém a exibição dos nomes completos e informações irrestritas.
  - Aplicada a mesma proteção às validações de alvos (`earlyValidTargets`), consumo de ações e imbuições (`imbueWeaponWithConsumable`).
- **Sanitização de Payloads WebSocket e Broadcast em Ações:**
  - A rota `POST /combat/:encounterId/action` agora utiliza `rt.broadcastFiltered` para que eventos `combat:action_logged` e `combat:updated` entreguem combatentes sanitizados e logs com nomes mascarados para jogadores, e dados integrais apenas para mestres.
- **Cobertura de Testes Automatizados:**
  - Adicionado o **Cenário 20** em `server/tests/bestiary-visibility-and-security.test.ts` validando tentativas de ataque, uso de habilidade, esquiva e ações fora de turno contra criaturas ocultas e mascaradas. 29/29 suítes de testes passando com sucesso.

---

## Destaques da Versão 0.15.0 (Correção e Otimização do Bestiário no Combate)
- **Ocultação Efetiva na Inicialização:** Instâncias criadas a partir do Bestiário com a opção *"Oculto para os jogadores (Invisível na iniciativa e mapa)"* agora são filtradas no WebSocket e persistidas no banco, garantindo que o token permaneça invisível na cena e o combatente nunca vaze na iniciativa dos jogadores nem na criação nem após F5.
- **Sincronização Bidirecional Token <-> Combatente:**
  - Alterações de visibilidade do combatente no combate (`PATCH /combatants/:combatantId` com `is_hidden`) sincronizam automaticamente a visibilidade do token correspondente no mapa (`tokens.is_visible`).
  - Alterações de visibilidade do token no VTT (`PATCH /tokens/:tokenId` com `is_visible`) sincronizam automaticamente a visibilidade do combatente correspondente na iniciativa (`combatants.is_hidden`).
- **Ação Explícita de Revelação / Ocultação no Mestre:**
  - Botão de toggle de visibilidade (`Eye` / `EyeOff`) implementado em cada card de combatente do `CombatTracker.tsx`.
  - Badge visual `[Oculto]` e estilo translúcido com destaque âmbar para o mestre identificar claramente combatentes escondidos.
  - Checkbox persistente no modal de reforços do Bestiário (`spawnIsHidden`) para escolher a visibilidade antes de spawnar criaturas.
- **Ajuste Matemático de Turno para Jogadores:**
  - Se a vez narrativo-mecânica pertencer a uma entidade oculta, o backend sanitiza `encounter.turn_index` para `-1` aos jogadores e o frontend exibe o banner "Turno Oculto (Aguardando ação do Mestre...)", impedindo que outro jogador visível pareça ser o ativo da vez.
- **Preservação Integral de Estado:**
  - Vida atual e máxima, iniciativa, ordem de turnos, rodada, condições e equipamentos permanecem 100% preservados ao revelar ou ocultar qualquer criatura.
- **Cobertura Completa de Testes Automatizados:**
  - Cenário 19 adicionado em `server/tests/bestiary-visibility-and-security.test.ts` cobrindo o ciclo completo de ocultação, revelação, persistência e reversão. 29/29 suítes passando com louvor.

---

## 1. Visão Geral da Arquitetura Implementada
- **Monólito Modular:** Backend em Node.js v24 (TypeScript) + Express, banco de dados relacional SQLite nativo (`node:sqlite`) com WAL mode, chaves estrangeiras ativas e transações ACID. Frontend React 19 + Vite + Tailwind CSS + Lucide Icons.
- **Isolamento Multi-tenant Rigoroso:** Cada campanha possui identificador único (`campaign_id`), membros com papéis em RBAC (`owner`, `master`, `assistant`, `player`) e regras/fórmulas versionadas e isoladas no banco de dados. Qualquer tentativa de acesso a dados de uma campanha da qual o usuário não é membro é bloqueada com `403 Forbidden` no backend.
- **Motor de Regras Configurável Seguro:** Parser matemático léxico e semântico construído do zero **sem `eval`**, gerando AST segura com suporte a operadores (`+`, `-`, `*`, `/`, `%`, `^`), dados (`1d20`, `2d6`, `d100`), funções autorizadas (`max`, `min`, `floor`, `ceil`, `round`, `abs`, `clamp`, `sqrt`) e variáveis contextuais validadas por campanha com normalização canônica insensível a acentuação e diacríticos.
- **Fichas Dinâmicas Reativas:** Inspiradas no estilo C.R.I.S. (Ordem Paranormal), com cálculo automático e reativo de campos derivados a partir das regras ativas da campanha, modelos de ficha e inventário.
- **Sistema de Condições, Efeitos de Status e Automação de Combate (Fase 4 - Novo):**
  - **Definições Configuráveis por Campanha:** Condições cadastradas no ruleset (`ruleset.config.conditions`) com suporte a modificadores dinâmicos, efeitos mecânicos, ícones, cores, duração e regras de acúmulo. Presets integrados para Fantasia D20 (*Envenenado, Em Chamas, Atordoado, Cego, Caído, Abençoado*), Investigação Paranormal (*Sangrando, Abalado, Paralisado, Protegido*) e Cyberpunk Neon (*Sobrecarga Elétrica, Eletrocutado, Mirando, Camuflado*).
  - **Dano Periódico Automático (DoT):** Efeitos como veneno, queimadura e sangramento avaliam fórmulas pelo motor de regras e debitam PV atomicamente nos momentos exatos configurados (`turn_start`, `turn_end`, `round_end`), com sincronização imediata em combatentes, tokens e fichas de personagens, e registro discriminado no log de combate (`action_type: 'dot'`).
  - **Ciclo de Vida e Expiração Automática:** Condições com duração em turnos decrementam a cada turno ativo; condições com duração em rodadas decrementam ao avançar a rodada; condições baseadas em ações decrementam quando o combatente realiza ações de combate válidas (`applyCombatAction`). Expiram automaticamente sem duplicidade e sem perda de estado em F5. Condições permanentes não sofrem decaimento automático.
  - **Regras de Acúmulo Flexíveis:** Suporte nativo a regras de pilha (`replace`, `stack_duration`, `stack_intensity` com multiplicação de DoT, `ignore`).
  - **Incapacitação Estrita:** Combatentes incapacitados (`incapacitated: true` ou `current_hp <= 0`) têm suas ações bloqueadas com erro 400 e são pulados deterministicamente na ordem de turnos se configurado no sistema de regras.
  - **Modificadores Mecânicos:** Aplicação automática de bônus e penalidades em rolagens de ataque, testes, defesas de alvo, redução de dano (RD), atributos e multiplicadores de dano recebido.
  - **Aplicação de Condições em Ataques:** Armas e habilidades podem transmitir condições para os alvos atingidos (`apply_conditions`), persistindo no banco e sincronizando em tempo real.
- **Sistema de Turnos, Iniciativa Obrigatória e Economia de Ações:**
  - Ordem estrita de iniciativa decrescente com desempate determinístico configurável por atributo (`tie_breaker`) para PCs e NPCs.
  - Controle automático de turnos (`nextTurn`, `prevTurn`, `endTurn`) e incremento de rodadas (`round`).
  - Salto automático de combatentes derrotados/incapacitados (`current_hp <= 0` ou `is_incapacitated = 1`).
  - Economia de ações por turno configurável pelo sistema de regras (padrão: 1 ação principal por turno), com rejeição estrita (400) para ações fora do turno ou excesso de ações.
  - Ações táticas de **Defender** (concede RD adicional ou bônus na Defesa até o próximo turno) e **Esquivar** (rola teste dinâmico e eleva a Defesa efetiva até o próximo turno).
- **Comunicação em Tempo Real Desacoplada e Sem Perda de Pacotes:** Sistema de registro síncrono (`subscribeVtt`) no frontend que elimina o descarte de pacotes por batching do React 19. Notificação instantânea de reconexão (`vtt:resync`) que recarrega cenas, tokens e combate sem intervenção do usuário ou F5.
- **Mesa Virtual (Virtual Tabletop — VTT):** Sistema de mapas por cena com imagem de fundo, detecção de resolução nativa, enquadramento automático ("Fit to Screen"), zoom dinâmico (0.15x a 3x), pan suave, grade quadrada configurável e persistência de estado.
- **Sistema de Tokens com Atributos Mecânicos de NPCs e Monstros:** Tokens com proporção 1:1, avatares em alta legibilidade, anéis de cor e status, barra de vida dinâmica, travamento de posição e visibilidade configurável. Suporte a opções de tamanho (0.5x, 1x, 1.5x, 2x, 3x, 4x) com ajuste rápido `[-]` e `[+]` pelo mestre. Configuração de Defesa (CA), Redução de Dano (RD / Armadura), Resistências, Vulnerabilidades, Imunidades, PV e Fórmula de Iniciativa com persistência no SQLite (`npc_data_json`).
- **Fog of War com Máscara SVG e Perfuração (Hole-Punching):** Camada de ocultação e revelação com corte vetorial SVG (`mask`). Áreas sob névoa ficam 100% pretas e opacas para jogadores e semi-transparentes para o mestre com marcações coloridas tracejadas.
- **Substituição de Dano Manual por Sistema Tático de Combate:**
  - Jogadores comuns são **estritamente bloqueados** de aplicar dano manual arbitrário (`action_mode: 'manual'` restrito ao mestre com validação no backend).
  - **Ataque com Armas do Inventário ou Ataque Desarmado Dinâmico:** O backend valida a existência e posse da arma no inventário do personagem (`character_inventory`). Quando desarmado, infere dinamicamente as fórmulas do sistema de regras da campanha e atributos físicos reais do combatente (`luta`, `forca`, `destreza`, `agilidade`, etc.), sem impor atributos inexistentes.
  - **Habilidades e Magias com Custo de Recursos e Rollback Atômico:** Validação prévia de recursos e avaliação das fórmulas antes de abrir a transação de persistência. Em caso de erro na fórmula, nenhuma alteração em mana ou PV é persistida.
  - **Sincronização Atômica Multi-Entidade:** Quando um alvo sofre dano ou cura, a alteração é gravada atomicamente na tabela `combatants`, sincronizada no token correspondente na tabela `tokens` e na ficha do personagem na tabela `characters`.
- **Auditoria Detalhada de Combate:** Logs com discriminação completa de autor, alvo, arma/habilidade utilizada, rolagem de ataque vs defesa (acerto/erro), rolagem de dano, redução de armadura (RD), multiplicadores e HP resultante.

---

## 2. Sistema de Turnos, Iniciativa Obrigatória, Economia de Ações, Defender e Esquivar (Versão 0.7.0)

### 2.1 Iniciativa Obrigatória e Desempate Determinístico
- **Ativação Obrigatória do Encontro (`POST /api/campaigns/:campaignId/combat/:encounterId/activate`):**
  - O mestre pode preparar o combate no estado `'prep'` e ativá-lo com um clique no botão "Iniciar Combate".
  - Na ativação, todos os combatentes sem iniciativa rolam sua fórmula pelo motor de regras da campanha.
  - Para combatentes que já possuem iniciativa, o `tie_breaker` é computado e salvo imediatamente.
  - Combatentes inseridos após o início do combate recebem iniciativa válida e desempate no mesmo instante.
- **Ordenação Estrita:**
  - `ORDER BY cb.initiative DESC, cb.tie_breaker DESC, cb.sort_order ASC, cb.created_at ASC`.
  - Desempate determinístico configurado pelas regras da campanha (`tie_breaker_attr`):
    - Fantasia Clássica D20: desempate por `destreza`.
    - Investigação Paranormal: desempate por `agilidade`.
    - Cyberpunk Neon: desempate por `reflexo`.

### 2.2 Controle de Turnos e Rodadas
- **Avanço de Turno (`POST .../combat/:encounterId/next` e `POST .../combat/:encounterId/end-turn`):**
  - Mestre pode avançar a qualquer momento (`/next`).
  - O jogador controlador do combatente ativo pode encerrar seu próprio turno (`/end-turn`). Tentativas de outros jogadores são bloqueadas com `403 Forbidden`.
  - Ao chegar ao último combatente do ciclo, a rodada (`round`) é incrementada automaticamente e o turno retorna ao primeiro combatente válido da ordem.
- **Salto Automático de Incapacitados (`skip_incapacitated`):**
  - Combatentes com `current_hp <= 0` ou `is_incapacitated = 1` são pulados automaticamente conforme configurado no ruleset ativo da campanha.
- **Retrocesso de Turno (`POST .../combat/:encounterId/prev`):**
  - Permite que o mestre corrija avanços indevidos retornando ao combatente anterior e, se necessário, decrementando a rodada.
- **Restauração de Ações:**
  - Ao iniciar o turno de um novo combatente, o backend zera seu contador de ações utilizadas (`actions_used_json = '{"main":0,"bonus":0,"reaction":0,"free":0}'`).
- **Ajuste Administrativo pelo Mestre (`PATCH .../combatants/:combatantId/actions`):**
  - Permite ao mestre adicionar, zerar ou modificar ações disponíveis manualmente.

### 2.3 Economia de Ações e Rejeição Estrita (400)
- Configuração de ações por turno através do motor de regras (`CombatRulesConfig.actions_per_turn`, padrão: 1 ação principal por turno).
- **Validação de Turno Ativo:**
  - Se o encontro estiver em status `'active'`, jogadores comuns só podem agir quando `combatants[encounter.turn_index].id === actorCombatant.id`. Tentativas fora do turno são rejeitadas com `400 Bad Request` ("Não é o turno de X. O turno atual pertence a Y.").
- **Validação de Limite de Ações:**
  - Se um jogador tentar usar mais ações do que o permitido no mesmo turno, a requisição é rejeitada com `400 Bad Request` ("Limite de ações atingido: X já utilizou sua ação principal (1/1) neste turno.").
- **Atomicidade Garantida:**
  - Em requisições rejeitadas, nenhuma alteração em PV, itens, mana ou ações gastas é gravada no banco de dados SQLite.

### 2.4 Ações Defensivas: Defender e Esquivar
- **Ação "Defender" (`action_mode: 'defend'`):**
  - Consome a ação principal do combatente ativo.
  - Grava estado defensivo persistente no combatente (`defensive_state_json.defense`):
    - Em Fantasia D20: +2 na Defesa (`bonus_defense`).
    - Em Investigação e Cyberpunk: +2 na Redução de Dano (`bonus_rd`).
  - Ataques subsequentes direcionados ao defensor aplicam imediatamente o bônus, reduzindo dano ou aumentando o limiar de acerto.
- **Ação "Esquivar" (`action_mode: 'dodge'`):**
  - Consome a ação principal do combatente ativo.
  - Rola dinamicamente a fórmula de esquiva configurada no ruleset (ex: `1d20 + floor((Destreza - 10) / 2)` em D20 ou `1d20 + Agilidade` em Investigação).
  - Se o resultado do teste for superior à Defesa base, define a nova Defesa efetiva (`effective_defense`) no estado (`defensive_state_json.dodge`).
  - Ataques subsequentes comparam o teste de ataque contra a Defesa elevada da esquiva.
- **Expiração Automática:**
  - Os estados defensivos (`defense` e `dodge`) expiram automaticamente quando o próximo turno do próprio combatente é iniciado ou na virada da rodada.

### 2.5 Migração 6 do Schema SQLite (`server/src/db/connection.ts`)
- Adicionadas colunas na tabela `combatants`:
  - `actions_used_json TEXT NOT NULL DEFAULT '{}'`
  - `defensive_state_json TEXT NOT NULL DEFAULT '{}'`
  - `tie_breaker REAL NOT NULL DEFAULT 0`
  - `is_incapacitated INTEGER NOT NULL DEFAULT 0`
- Execução segura e idempotente via inspeção de `PRAGMA table_info(combatants)` sem perda de dados existentes.

### 2.6 Interface Visual do Combat Tracker (`client/src/components/CombatTracker.tsx`)
- Banner do Turno Ativo com destaque do Combatente Ativo, contador visual de ações (`Ação Principal: 0/1 usada` ou `1/1 esgotada`), indicação do próximo combatente na fila e botão "Encerrar Turno".
- Badges dinâmicos na lista de combatentes:
  - `Defendendo` (ícone de escudo com efeito visual)
  - `Esquiva (DEF X)` (ícone de vento com defesa efetiva)
  - `Incapacitado` (ícone de caveira com opacidade reduzida)
  - `Ação: X/Y`
- Novas abas de ação tática: **Defender** e **Esquivar**, com descritivo mecânico do efeito e botão de execução.
- Bloqueio visual dos botões de ação e aviso explícito quando as ações do turno foram esgotadas.
- Botão "Iniciar Combate" no cabeçalho quando o combate está em fase de preparação (`prep`).

---

## 2. Correção da Resolução de Variáveis no Contexto de Combate (Versão 0.6.1)

### 2.1 Diagnóstico da Causa Raiz
Ao tentar executar um ataque desarmado contra o monstro Krug, a aplicação falhava com `Erro ao executar ação: Variável 'agilidade' não foi fornecida no contexto.`
- **Causa 1 (Frontend):** Em `client/src/components/CombatTracker.tsx`, quando o atacante não tinha armas no inventário, o componente enviava hardcoded:
  `formula: selectedWeaponId ? undefined : '1d4 + forca'`
  `attack_formula: selectedWeaponId ? undefined : '1d20 + agilidade'`
  Isso forçava a presença de `agilidade` mesmo quando o sistema de regras era diferente (ex: `destreza` em fantasia medieval, `reflexo` em cyberpunk) ou a ficha usava grafia acentuada (`Agilidade` / `Força`).
- **Causa 2 (Backend):** O `combat.service.ts` aceitava cegamente a `attack_formula` vinda do payload e não resolvia o ataque desarmado a partir das regras ativas da campanha nem dos atributos reais do atacante.
- **Causa 3 (Rules Engine):** O `evaluator.ts` não possuía normalização canônica de diacríticos (`stripDiacritics`), fazendo com que `Força` e `forca` não coincidissem. Além disso, quando uma variável não era encontrada, gerava erro genérico sem listar quais variáveis estavam disponíveis no contexto de combate.
- **Causa 4 (Ordem de Operações e Não-Atomicidade):** Recursos (mana) eram debitados antes da avaliação da fórmula de dano; caso a fórmula de dano falhasse, o personagem perdia mana indevidamente.

### 2.2 Correções Implementadas
1. **Normalização de Acentos e Diacríticos no Motor de Regras (`evaluator.ts`):**
   - Implementada função canônica `stripDiacritics(str: string): string` utilizando decomposição NFD (`str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()`).
   - O construtor do `Evaluator` agora indexa as variáveis tanto pelo nome em minúsculas quanto pelo nome canônico sem acentos.
   - Na resolução do nó `Identifier`, verifica ambas as formas antes de falhar.
   - Em caso de ausência real da variável, lança `EvaluationError` descritivo listando o nome exato da variável faltante e a lista completa de atributos/variáveis presentes no contexto.
2. **Contexto Robusto e Ataque Desarmado Dinâmico (`combat.service.ts`):**
   - Construção completa do dicionário `vars`: extrai dados computados e brutos de personagens de jogadores e de monstros/NPCs (`npc_data`).
   - Injeção das variáveis do alvo: `alvo_defesa`, `target_defense`, `alvo_rd`, `alvo_hp`, `target_hp`, bem como `alvo_<atributo>`.
   - Injeção dos identificadores, nomes e abreviações de atributos configurados no ruleset ativo da campanha.
   - Para ataques desarmados (`!weapon_id`), consulta as fórmulas da campanha (`ataque_desarmado`, `dano_desarmado`) e seleciona dinamicamente o atributo físico disponível (`luta` > `forca` > `destreza` > `agilidade` > `reflexo` > `combate`), caindo de forma segura no dado padrão (`defaultDice`) se nenhum existir, sem nunca inventar variáveis inexistentes nem preencher com 0 silenciosamente.
3. **Atomicidade Estrita de Recursos e HP:**
   - Validações de custo de recurso e avaliações matemáticas de ataque e dano ocorrem antes de abrir a transação SQLite.
   - As mutações de recursos (`characters`), HP do alvo (`combatants`), tokens do mapa (`tokens`) e inserção de logs (`combat_logs`) são executadas dentro de bloco `BEGIN TRANSACTION ... COMMIT` com captura de exceção e `ROLLBACK` garantido.
4. **Interface e Tratamento de Erros no Frontend (`CombatTracker.tsx`):**
   - Removidas as fórmulas hardcoded de fallback de ataque desarmado; o frontend envia `weapon_id: undefined` e o backend resolve conforme o sistema de regras e ficha.
   - Implementado estado `actionError` exibindo um banner de erro inline no próprio modal de combate, preservando os campos preenchidos e permitindo correção imediata sem perda de contexto ou alert nativo intrusivo.
   - Texto informativo da UI atualizado para: *"Será realizado um ataque desarmado resolvido automaticamente pelas regras da campanha e atributos do combatente."*

---

## 3. Estado Atual dos Arquivos e Módulos Modificados
- `server/src/modules/rules-engine/evaluator.ts`: Suporte canônico a acentos e diacríticos, indexação bidirecional de variáveis e mensagens de erro enriquecidas com inventário de variáveis contextuais.
- `server/src/modules/combat/combat.service.ts`: Contexto unificado para combatentes PC e NPC, injeção de variáveis do alvo, resolução dinâmica de ataque desarmado com base nas regras ativas e transações atômicas com rollback em caso de falha.
- `client/src/components/CombatTracker.tsx`: Remoção de fallbacks hardcoded de ataque desarmado, inclusão de `actionError` com banner inline e manutenção dos inputs no modal.
- `server/tests/combat-context-and-unarmed.test.ts`: Nova suíte de testes com 6 cenários cobrindo ataque desarmado sem armas, normalização de acentos (`Força`), variáveis do alvo (`alvo_rd`), erro explícito para variáveis inexistentes, rollback de mana em caso de erro e sistemas alternativos (`fantasia_d20`).
- `server/tests/vtt-and-combat.test.ts`: Suíte de testes da Fase 3 100% preservada e passando.


---

## 2. Evolução do Sistema de Combate e Sincronização do Mapa (Versão 0.6.0)

### 2.1 PARTE 1 — Sincronização Confiável do Mapa em Tempo Real
- **Diagnóstico das Falhas Anteriores:**
  1. *Perda de Pacotes por Batching de Estado no React 19:* No código anterior, o componente pai `CampaignWorkspace.tsx` atualizava um estado escalar `lastVttEvent`. Quando múltiplos eventos WebSocket chegavam em sequência rápida (ex: múltiplos tokens movidos ou cena alterada em conjunto), o React 19 agrupava as renderizações e descartava os eventos intermediários.
  2. *Dessincronização após Queda ou Reconexão de Rede:* Quando o WebSocket reconectava após oscilação de rede, o cliente não recarregava o estado do VTT, mantendo posições antigas de tokens e mapas desatualizados.
  3. *Ausência de Timestamp e Ordem de Pacotes:* Pacotes de movimento que chegavam fora de ordem causavam saltos visuais ou sobrescrita do estado mais recente pelo mais antigo.
- **Solução Arquitetural Implementada:**
  - **Registro Direto de Listeners (`subscribeVtt`):** O `CampaignWorkspace.tsx` agora mantém um conjunto de ouvintes diretos (`vttListenersRef = useRef<Set<(msg: any) => void>>(new Set())`). No evento `ws.onmessage`, cada mensagem de mapa é despachada sincronamente para todos os ouvintes registrados, sem passar por re-renderizações intermediárias e garantindo 0 perdas de pacotes.
  - **Re-sincronização Automática (`vtt:resync`):** No evento `ws.onopen`, o cliente emite localmente `{ type: 'vtt:resync' }`, disparando imediatamente uma recarga completa das cenas ativas, tokens do mapa e encontros de combate.
  - **Timestamp e Dados Completos em `token:moved`:** O broadcast de movimentação agora carrega o timestamp do servidor (`timestamp: Date.now()`) e o token atualizado.
  - **Filtro Estrito por Cena Ativa:** O cliente filtra eventos de tokens verificando se pertencem à cena ativa atual (`msg.token.scene_id === activeScene.id`), impedindo interferência entre mapas diferentes.

### 2.2 PARTE 2 — NPCs e Monstros com Atributos Defensivos
- **Migração do Banco de Dados SQLite (Migração 5 em `server/src/db/connection.ts`):**
  - Adicionada coluna `npc_data_json TEXT NOT NULL DEFAULT '{}'` à tabela `tokens`.
  - Adicionadas colunas `defense REAL NOT NULL DEFAULT 10`, `damage_reduction REAL NOT NULL DEFAULT 0`, `npc_data_json TEXT NOT NULL DEFAULT '{}'` à tabela `combatants`.
  - Migração idempotente que inspeciona `PRAGMA table_info` antes de aplicar `ALTER TABLE`, preservando 100% dos dados existentes.
- **Interface e Serviços de Tokens e VTT:**
  - Formulário de criação de tokens e modal de edição do mestre com campos para:
    - **Defesa (CA):** valor numérico padrão 10.
    - **Redução de Dano (RD / Armadura):** valor numérico padrão 0.
    - **PV Atual e PV Máximo.**
    - **Fórmula de Iniciativa:** ex: `1d20+2`.
    - **Resistências (50% de dano):** ex: `fogo, corte`.
    - **Vulnerabilidades (200% de dano):** ex: `frio`.
    - **Imunidades (0 de dano):** ex: `veneno`.
  - Herança automática: ao adicionar um token de monstro/NPC ao combate via `token_id`, o combatente herda automaticamente a Defesa, RD, Resistências, Vulnerabilidades, Imunidades, PV e iniciativa do token.

### 2.3 PARTE 3 — Substituição do Dano Manual por Ações de Combate Táticas
- **Restrição de Permissão (RBAC):**
  - Jogadores comuns que tentarem enviar `action_mode: 'manual'` ou valores arbitrários de dano são bloqueados no backend com `403 Forbidden` ("Apenas o mestre da campanha pode aplicar ajustes manuais arbitrários de dano.").
- **Pipeline de Ataque com Arma:**
  1. O backend busca o item no inventário do atacante (`character_inventory`). Se o item não existir ou não pertencer ao personagem, a requisição é rejeitada com `400 Bad Request`.
  2. Extrai a fórmula de dano e a fórmula de teste de ataque (`properties.damage_formula`, `properties.attack_formula`).
  3. Rola o teste de ataque no motor de regras seguro (`RulesService.evaluateFormula`).
  4. Compara o total rolado contra a Defesa (CA) do alvo:
     - **Se o ataque for MENOR que a Defesa:** O ataque ERRA (`hit: false`). O dano é 0, o PV do alvo não é alterado e um log de combate detalhando o erro é registrado e transmitido via WebSocket.
     - **Se o ataque for IGUAL OU MAIOR que a Defesa:** O ataque ACERTA (`hit: true`).
  5. Avalia o dano bruto da arma.
  6. Subtrai a Redução de Dano (RD / Armadura) do alvo: `danoAposRd = Math.max(0, danoBruto - rd)`.
  7. Aplica modificadores baseados nas defesas do alvo:
     - **Imunidade:** dano reduzido para `0`.
     - **Resistência:** dano reduzido pela metade (`Math.floor(danoAposRd / 2)`).
     - **Vulnerabilidade:** dano dobrado (`Math.floor(danoAposRd * 2)`).
- **Habilidades com Custo de Recurso:**
  - Valida se o atacante possui o recurso requerido (ex: 5 de mana). Se possuir menos que o custo, bloqueia com `400 Bad Request`.
  - Deduz o recurso atomicamente na tabela `characters` e recomputa a ficha.
- **Sincronização Atômica no Banco de Dados:**
  - O HP do alvo é atualizado na tabela `combatants`.
  - Se o combatente estiver vinculado a um token no mapa, a coluna `current_hp` da tabela `tokens` é atualizada.
  - Se o combatente for um personagem de jogador, a coluna `vida_atual` / `pv_atual` é atualizada na tabela `characters`.

### 2.4 PARTE 4 — Feedback Visual e Interface do Combat Tracker
- **Badges de Defesa nos Combatentes:** Exibição clara de `Def: 15 • RD: 3` no card de cada combatente na lista de iniciativa.
- **Modal de Ação de Combate com 3 Abas:**
  - **Aba 1 (Atacar com Arma):** Exibe as armas equipadas no inventário do atacante com dano, tipo e fórmula de ataque.
  - **Aba 2 (Habilidade / Poder):** Permite lançar magias e poderes com consumo de recursos configurável (mana, sanidade, etc.).
  - **Aba 3 (Ajuste Manual - Apenas Mestre):** Visível exclusivamente para o mestre, permitindo correções arbitrárias quando necessário.
- **Modal de Edição de Token / NPC:** O mestre pode clicar no ícone de engrenagem no popover do token para ajustar Defesa, RD, Resistências e PV em tempo real.

---

## 3. Estado Atual dos Arquivos e Módulos Modificados
- `server/src/db/connection.ts`: Migração 5 idempotente adicionando `npc_data_json` em `tokens` e `defense`, `damage_reduction`, `npc_data_json` em `combatants`.
- `server/src/modules/vtt/vtt.service.ts`: Tratamento de `npc_data` em `createToken`, `updateToken` e `mapToken`.
- `server/src/modules/combat/combat.service.ts`: Injeção de `InventoryService`, atributos defensivos em `Combatant`, herança de dados do token em `addCombatant`, e reescrita completa de `applyCombatAction` com resolução tática de ataques, RD, resistências, imunidades e consumo de recursos.
- `server/src/app.ts`: Injeção de `InventoryService` no `CombatService`, bloqueio de segurança contra dano manual por jogadores e broadcast atômico de atualizações.
- `server/src/modules/realtime/ws.server.ts`: Inclusão de token completo e timestamp em `token:moved`.
- `client/src/services/api.ts`: Interfaces estendidas (`Token`, `Combatant`, `CombatLog`, `CharacterInventoryItem`) e assinaturas atualizadas.
- `client/src/components/CampaignWorkspace.tsx`: Registro síncrono `subscribeVtt`, eliminação de perdas por batching do React 19 e re-sincronização automática na reconexão.
- `client/src/components/VirtualTabletop.tsx`: Tratamento reativo via `subscribeVtt`, filtro por cena ativa, formulários de criação e edição de tokens com atributos de NPCs e repasse de `tokens={tokens}` ao Combat Tracker.
- `client/src/components/CombatTracker.tsx`: Nova interface com abas de Armas do Inventário, Habilidades com Recursos, Ajuste Manual (GM) e badges de Defesa/RD.
- `server/tests/vtt-and-combat.test.ts`: Suíte de testes abrangente cobrindo criação de tokens NPC, herança defensiva, bloqueio RBAC de dano manual, erro contra Defesa (0 dano), acerto com RD e resistência (50%), vulnerabilidade (200%), imunidade (0 dano), consumo de mana e sincronização com tokens e fichas.

---

## 4. Resultados dos Testes Automatizados
- **Total de Suítes de Teste:** 21
- **Passando:** 21 (100% de sucesso)
- **Tempo de Execução:** ~4.4 segundos
- **Build de Produção:**
  - `npm run build --workspace=server`: 0 erros (TypeScript limpo)
  - `npm run build --workspace=client`: 0 erros (Vite produção 467 kB)

---

## 5. Guia de Teste Manual em Duas Sessões (Mestre e Jogador)

### Sessão 1: Mestre (Navegador 1 ou Janela Anônima 1)
1. Faça login como Mestre e acesse a campanha.
2. Na aba **Mesa Virtual (VTT)**:
   - Clique em **+ Token** para criar um monstro avulso:
     - Nome: `Golem de Ferro`
     - Tamanho: `2x2 (Grande)`
     - Defesa (CA): `15`
     - Redução de Dano (RD): `3`
     - PV Atual e Máximo: `40`
     - Resistências: `fogo, corte`
     - Vulnerabilidades: `frio`
     - Imunidades: `veneno`
   - O token é posicionado no mapa com a barra de vida verde flutuante cheia (40/40).
3. Abra o dock lateral de **Combate**:
   - Inicie um encontro e clique em **Adicionar Participante**.
   - Selecione o token do `Golem de Ferro`: note que ele já herda `Def: 15 • RD: 3` e 40 PV.
   - Adicione também o personagem do jogador Arthur.
   - Role a iniciativa automaticamente.

### Sessão 2: Jogador (Navegador 2 ou Janela Anônima 2)
1. Faça login como Jogador (Arthur) na mesma campanha.
2. Na aba **Inventário**:
   - Certifique-se de que possui uma arma equipada (ex: `Espada de Aço` com dano cortante).
3. Vá para a aba **Mesa Virtual (VTT)**:
   - Observe que o dock de combate e o mapa estão sincronizados em tempo real com a tela do Mestre.
4. No dock de **Combate**, clique no ícone de espadas para executar uma ação:
   - **Tentativa de Dano Manual:** Observe que a aba de ajuste manual nem aparece para o jogador (restrita ao mestre). Se tentar burlar via API, receberá 403.
   - **Ataque com Arma:**
     - Selecione a `Espada de Aço` e clique em **Confirmar e Executar**.
     - Se o teste de ataque for menor que 15, o log exibe `ERROU!` e o PV do Golem não diminui.
     - Se o teste de ataque for 15 ou mais: o dano da espada é calculado, tem 3 pontos subtraídos pela RD e é reduzido em 50% pela resistência a corte. O PV do Golem diminui de forma visível e reativa em ambas as telas.
   - **Ataque com Magia de Frio:**
     - Selecione a aba de Habilidades, digite dano tipo `frio` e execute.
     - Observe que o dano resultante é dobrado (200%) pela vulnerabilidade do Golem.
   - **Ataque com Magia de Veneno:**
     - Execute uma ação com dano tipo `veneno`: o dano resultante é 0 devido à imunidade.
   - **Consumo de Mana:**
     - Execute uma magia com custo de 5 de mana: a mana do personagem é deduzida na hora na sua ficha.
5. Em nenhum momento foi necessário pressionar F5 para ver as alterações de mapa, vida ou iniciativa.

---

## 2. Auditoria e Correção Crítica da Experiência do Mapa (Versão 0.5.1)

### 2.1 Problema 1: Tokens dos Personagens Pequenos Demais
- **Causa Raiz:**  
  O cálculo de tamanho dos tokens era simplesmente `gridSize * token.size`. Em mapas de 2000x2000 ou maiores, com zoom reduzido (ex: 30% a 50%), tokens de 50px diminuíam para meros 15-25px na tela. Não existiam opções granulares de tamanho (apenas inteiros 1 a 4) nem controle rápido de ajuste para o mestre sem recriar o token. Além disso, as legendas de texto e avatares distorciam em zooms baixos.
- **Solução Implementada:**
  - Adicionadas opções de tamanho granulares no modal de criação: `0.5x` (Miúdo), `1x` (Médio/Padrão), `1.5x` (Grande Leve), `2x` (Grande), `3x` (Enorme), `4x` (Colossal).
  - Adicionado controle rápido de redimensionamento `[-]` e `[+]` diretamente no popover do token selecionado para o mestre, persistindo o novo tamanho no SQLite via `PATCH /api/campaigns/:campaignId/tokens/:tokenId` e propagando via WebSocket.
  - Avatares estilizados com proporção 1:1 estrita (`aspect-ratio: 1/1`, `object-cover rounded-full pointer-events-none`) para eliminar distorções ou achatamento.
  - Indicadores de vida e legendas com alto contraste visual (`bg-slate-950/90`, borda, tipografia em negrito, sombras) mantendo a legibilidade em qualquer nível de zoom.

### 2.2 Problema 2: Atualização do Mapa sem Precisar Recarregar a Página (F5)
- **Causa Raiz:**  
  Embora o backend emitisse eventos de broadcast via WebSocket para `token:moved`, `token:created`, `token:updated`, `token:deleted`, `scene:created`, `scene:updated`, `scene:active_changed`, `scene:deleted`, `fog:updated` e `combat:*`, o componente `CampaignWorkspace.tsx` descartava essas mensagens em seu `ws.onmessage`. Nem o `CampaignWorkspace` nem o `VirtualTabletop` atualizavam seu estado React com os dados do mapa em tempo real.
- **Solução Implementada:**
  - `CampaignWorkspace.tsx` agora intercepta todas as mensagens de prefixo `token:`, `scene:`, `fog:` e `combat:` e dispara `setLastVttEvent(msg)`.
  - `VirtualTabletop.tsx` recebeu a prop `lastVttEvent` e implementou um `useEffect` reativo que atualiza os estados de `tokens`, `scenes`, `activeScene` e `combatEncounter` instantaneamente, com 0ms de latência percebida e sem necessidade de pressionar F5.

### 2.3 Problema 3: Não Voltar à Seleção de Campanha após Atualizar a Página (F5)
- **Causa Raiz:**  
  Em `App.tsx`, o estado `selectedCampaign` iniciava como `null`. Ao pressionar F5, a aplicação recarregava a lista de campanhas mas nunca auto-selecionava a campanha onde o usuário estava. Em `CampaignWorkspace.tsx`, a aba ativa iniciava em `'sheets'`, perdendo o contexto de quem estava no `'vtt'`.
- **Solução Implementada:**
  - Em `App.tsx`, a campanha ativa é sincronizada com o `localStorage` (`arcanum_active_campaign_id`) e com a URL via hash (`#campaign=<id>&tab=<tab>`). Ao recarregar a página, a campanha é restaurada automaticamente.
  - Ao trocar de aba no `CampaignWorkspace`, a aba ativa é gravada no `localStorage` (`arcanum_active_tab_<campaignId>`) e no hash da URL.
  - No `VirtualTabletop`, a cena selecionada é persistida e restaurada via `localStorage` (`arcanum_active_scene_<campaignId>`), garantindo que após um F5 o usuário retorne exatamente à mesma cena da mesa virtual.

### 2.4 Problema 4: Mapa Deve Respeitar a Proporção Real da Imagem
- **Causa Raiz:**  
  O canvas do mapa forçava dimensões fixas de 2000x2000 pixels e utilizava `object-cover` na tag `<img>`. Isso achatava ou cortava qualquer mapa retangular (ex: 1920x1080, 3000x1500). Não existia algoritmo de ajuste de tela (fit-to-screen), forçando o usuário a buscar o mapa manualmente com zoom e pan.
- **Solução Implementada:**
  - Detecção automática de dimensões reais de imagens via utilitário `detectImageDimensions`: no formulário de criação/edição de cena, colar a URL ou clicar em "Detectar" preenche a largura e altura nativas da imagem.
  - Auto-ajuste de proporção na renderização: se uma cena estiver com dimensões 2000x2000 default e carregar uma imagem com proporções reais, o sistema atualiza as dimensões no backend e ajusta a exibição.
  - Implementado o botão **"Enquadrar" (Fit to Screen)** e auto-enquadramento na abertura da cena: calcula matematicamente a escala ideal `fitZoom = Math.min((viewW - margin) / mapW, (viewH - margin) / mapH)` e centraliza o mapa no viewport.
  - Tratamento resiliente de erro de imagem (`imageError`) exibindo banner escuro informativo sem quebrar o canvas.

### 2.5 Problema 5: Correção da Revelação de Áreas do Mapa Oculto (Fog of War)
- **Causa Raiz:**  
  O código anterior continha `if (!fog.hidden) return null;`, descartando qualquer tentativa de revelar áreas e tornando a ferramenta "Revelar Área" inoperante. Além disso, blocos pretos eram apenas adicionados sem um mecanismo de perfuração (hole-punching).
- **Solução Implementada:**
  - Implementada camada de máscara vetorial SVG `<mask id="vtt-fog-mask-...">`:
    - Base de máscara preta (revelada por padrão).
    - Operações de `hide` aplicam retângulos brancos na máscara (adicionam névoa).
    - Operações de `reveal` aplicam retângulos pretos na máscara (abrem buracos na névoa, revelando o mapa e tokens embaixo).
  - O retângulo de névoa é renderizado cobrindo mapa e tokens:
    - **Para jogadores:** 100% preto opaco (`#050816`), bloqueando totalmente a visão de áreas ocultas e tokens que estejam sob elas.
    - **Para o mestre:** Semi-transparente (`rgba(5, 8, 22, 0.72)`) com contornos tracejados informativos (vermelho para oculto, verde para revelado).
  - Adicionadas ações rápidas na barra de ferramentas: **"Ocultar Tudo"**, **"Revelar Tudo"** e **"Desfazer"** (Undo).
  - Cálculo de coordenadas de seleção com consideração rigorosa de zoom e pan do viewport e clamping aos limites reais do mapa.
- **Catálogo de Itens com Controle de Estoque & Aprovação:** Catálogo por campanha com modos de aquisição (`free`, `limited`, `approval`), decremento atômico de estoque (`UPDATE ... WHERE stock_quantity >= ?`) contra condições de corrida, e fluxo de aprovação de itens com auditoria.
- **Rolagens Secretas Estritamente Protegidas:** Ocultação do total e do breakdown no payload HTTP e WebSockets para jogadores comuns, entrega em tempo real para o mestre com notificação flutuante com dados completos (autor, personagem, expressão e total) e histórico persistente restrito por RBAC.
- **Sistema de Migrações Idempotente:** Execução na inicialização que detecta a ausência de colunas ou tabelas criadas em fases anteriores (ex: `scenes`, `tokens`, `combatants`, `combat_logs`, etc.) e aplica migrações de forma segura, garantindo integridade sem perda de dados existentes.

---

## 2. Auditoria e Correção Definitiva da Sincronização em Tempo Real (Versão 0.4.1)

### 2.1 Causa Raiz do Não Funcionamento da Sincronização e da Notificação Flutuante
Durante testes manuais, foi constatado que as rolagens não atualizavam em tempo real e a notificação flutuante não aparecia no mestre. A auditoria técnica identificou três causas fundamentais:
1. **Desacoplamento do RealtimeServer no Backend (`server/src/index.ts`):**  
   O arquivo `index.ts` executava `createApp(db)` antes de instanciar `realtimeServer`. Como as 15 rotas registradas em `server/src/app.ts` capturavam `realtimeServer` no encerramento léxico da função `createApp`, a variável local `realtimeServer` permanecia permanentemente `undefined`. Fazer `app.set('realtimeServer', ...)` posteriormente não tinha efeito porque nenhuma rota consultava `app.get()`. Assim, **nenhuma rota do servidor disparava `rt.broadcast()`**, silenciando todos os eventos WebSocket emitidos pela API HTTP.
2. **Stale Closures no React (`client/src/components/CampaignWorkspace.tsx`):**  
   O listener `ws.onmessage` era registrado uma única vez no `useEffect` de montagem e fechava sobre os valores iniciais de `isMaster` e `activeTab`. Se o status de mestre fosse atualizado ou a aba fosse trocada, `isMaster` no handler permanecia avaliando `false`, impedindo o disparo de `setSecretRollToast` mesmo que a mensagem chegasse.
3. **Ausência de Nome do Personagem e Reconexão:**  
   O payload emitido não enriquecia a rolagem com o nome do personagem (`characterName`), e o cliente não possuía rotina de reconexão automática resiliente com re-sincronização de histórico.

### 2.2 Correções Arquiteturais Aplicadas
- **Backend:**
  - Em `server/src/index.ts`, `realtimeServer` agora é instanciado antes e repassado diretamente para `createApp(db, realtimeServer)`.
  - Em `server/src/app.ts`, foi implementado o getter dinâmico `getRealtime()` e `setRealtimeServer()` no contexto da aplicação, permitindo acesso transparente ao servidor WebSocket em todas as rotas.
  - Nas rotas de rolagem (`POST /rules/roll` e `/dice/roll`), o backend agora consulta o nome do personagem via `characterService.getCharacterById` e monta o payload completo com `characterName`, `username`, `expression`, `total`, `breakdown` e `isSecret`, disparando `rt.broadcast` com `{ masterOnly: !!isSecret }`.
  - Em `server/src/modules/permissions/rbac.service.ts`, adicionou-se fallback automático de dono para o criador da campanha (`owner_id`) ao autenticar o handshake WebSocket.
- **Frontend (`CampaignWorkspace.tsx` e `api.ts`):**
  - Utilização de referências mutáveis `isMasterRef` e `activeTabRef` sincronizadas via `useEffect`, garantindo que o listener de WebSocket sempre acesse o papel e a aba atuais sem stale closures.
  - Implementação de reconexão automática resiliente (`ws.onclose` com backoff de 3 segundos) e re-sincronização automática do histórico de rolagens na abertura do socket (`syncRollHistory`).
  - Deduplicação estrita de rolagens por `id` tanto no stream WebSocket quanto nas respostas da API, prevenindo duplicatas e ordenando por data decrescente.
  - Enriquecimento da notificação flutuante (*toast*) do mestre para exibir autor e personagem: `"🎲 Rolagem Secreta Recebida: Jogador (Personagem): 1d100 = 87"`, com temporizador automático de 8 segundos com limpeza de timeouts anteriores.
  - Exibição de badge com o nome do personagem no histórico da mesa.
- **Testes Automatizados com WebSockets Reais (`server/tests/realtime-rolls-ws.test.ts`):**
  - Criação de suíte de testes de integração ponta a ponta conectando múltiplos clientes WebSocket reais (Mestre, Jogador 1, Jogador 2 e Invasor) simultaneamente.
  - Validação de entrega de rolagens públicas para todos os membros da sala com `characterName`.
  - Validação estrita de entrega de rolagens secretas com total avaliado apenas para o mestre (disparando o toast) e bloqueio total de envio para os demais jogadores.
  - Validação de rejeição de conexão de usuários não autorizados na sala da campanha.

---

## 2. Auditoria e Resolução da Versão 0.4.0

### 2.1 Atualização de Valores em Tempo Real sem Recarregar a Página (Requisito 7.1)
- **Causas Raiz Identificadas:**
  1. `loadCampaignData` no frontend não atualizava o objeto `selectedCharacter` caso ele já estivesse selecionado, mantendo em memória valores defasados de `computed_data`.
  2. `InventoryView` só recarregava o inventário ao mudar `selectedCharacter.id`. Quando ações eram executadas via Catálogo, aprovação de solicitações ou por outro cliente via WebSocket, o inventário local não era notificado.
  3. No backend, endpoints de inventário retornavam apenas o item individual, sem enviar o resumo recalcula do inventário (`totalWeight`, `itemCount`) ou o personagem com atributos atualizados.
  4. O cálculo de carga/peso não estava integrado diretamente na rotina de cálculo de atributos derivados da ficha (`computeCharacterFields`).
- **Correções Aplicadas:**
  - **Recálculo Atômico no Backend:** Adicionado método `recomputeCharacter(campaignId, characterId)` em `CharacterService`. Em `computeCharacterFields`, `carga_atual`, `peso_total`, `peso_carregado` e `total_itens` são computados diretamente do SQLite e injetados nas variáveis numéricas da ficha.
  - **Sincronização Contínua em Mutações:** Todas as operações de inventário (`addItemToCharacter`, `updateCharacterInventoryItem`, `removeCharacterInventoryItem`, `transferItem`, `useInventoryItem`, `reviewItemRequest`) disparam automaticamente o recálculo do personagem e retornam `{ item, inventory, character }` no HTTP response e nos eventos de broadcast WebSocket.
  - **Atualização Instantânea na UI:** `InventoryView` e `CatalogManager` aplicam imediatamente o `inventory` e `character` recebidos, atualizando o peso total carregado e itens instantaneamente (0ms de latência percebida) sem recarregar a página.
  - **Notificações em Tempo Real de Rolagens Secretas:** O mestre recebe a rolagem secreta via WebSocket com notificação flutuante instantânea na tela (*toast*) com dados e resultado, e um indicador visual de rolagens não lidas na aba do Rolador.

### 2.2 Seleção Automática do Personagem Pertencente ao Jogador (Requisito 7.2)
- **Causas Raiz Identificadas:**
  1. `CampaignWorkspace` selecionava cegamente `chars[0]`, que frequentemente pertencia a outro jogador, forçando o usuário a procurar manualmente seu próprio personagem.
  2. No `CatalogManager`, o modal para pegar itens e solicitar itens listava todos os personagens da campanha e pré-selecionava `characters[0]`, permitindo que jogadores selecionassem e tentassem transferir itens para personagens alheios (o que disparava erro 403 no servidor).
- **Correções Aplicadas:**
  - **Regra de Seleção Automática:**
    - Ao carregar ou atualizar a campanha, o sistema filtra `userChars = chars.filter(c => c.user_id === user.id)`.
    - **Jogador com 1 personagem:** É selecionado automaticamente de imediato.
    - **Jogador com múltiplos personagens:** Restaura a última escolha válida salva no `localStorage` sob chave isolada por usuário e campanha (`arcanum_selected_char_${user.id}_${campaign.id}`). Se não houver, seleciona o primeiro personagem do próprio usuário.
    - **Jogador sem personagens:** `selectedCharacter` permanece `null`. O sistema nunca seleciona o personagem de outro jogador e apresenta um callout visual convidando a criar seu primeiro personagem com o botão "+ Criar Meu Personagem".
    - **Mestre:** Tem visão administrativa e pode selecionar qualquer personagem ou restaurar o último inspecionado.
  - **Isolamento no Catálogo e Inventário:** O modal do Catálogo agora exibe exclusivamente os personagens do próprio jogador para usuários comuns, pré-selecionando o personagem ativo.
  - **Modo Leitura com Banner:** Se um jogador clicar para inspecionar a ficha de outro participante, a interface exibe um banner explícito *"Modo Leitura: Ficha de outro participante"*, e bloqueia ações de mutação de inventário.
  - **Revalidação Rigorosa no Backend:** Todos os endpoints de inventário (`POST`, `PATCH`, `DELETE`, `transfer`, `use`) validam `char.user_id === req.user.userId || isMaster`, retornando `403 Forbidden` caso um jogador tente atuar sobre o personagem de outro.

---

## 3. Status dos Módulos

| Módulo | Status | Descrição |
|---|---|---|
| **Arquitetura Base e Setup** | 🟢 Concluído | Monorepo com workspaces (`server` e `client`), TypeScript, scripts de build e dev. |
| **Autenticação e Sessões** | 🟢 Concluído | Registro, login, hash de senha `bcryptjs` (salt 10), tokens JWT stateless e middleware de proteção. |
| **Isolamento Multi-tenant & Campanhas** | 🟢 Concluído | CRUD de campanhas, membros, convites alfanuméricos com controle de uso e políticas de acesso (RBAC). |
| **Motor de Regras (Rules Engine)** | 🟢 Concluído | Parser matemático léxico e semântico seguro (sem `eval`), validador de sintaxe, avaliador de expressões e rolagens com breakdown. |
| **Fichas Dinâmicas & Schemas** | 🟢 Concluído | Personagens com cálculo reativo de atributos derivados, recursos e carga sincronizada com inventário. |
| **Comunicação em Tempo Real (WebSockets)** | 🟢 Concluído | Salas por campanha, autenticação JWT, filtragem de rolagens secretas para mestres e broadcast de inventário/ficha. |
| **Rolagens Secretas Protegidas** | 🟢 Concluído | Mascaramento de payload HTTP para jogadores, entrega segura via WS para mestres e histórico persistente auditado. |
| **Catálogo com Estoque & Aprovação** | 🟢 Concluído | Modos `free`, `limited`, `approval`, transação atômica contra race conditions e fluxo de solicitações. |
| **Mecânica de Itens & Ações de Inventário** | 🟢 Concluído | Consumo de munição, bateria, cargas e cura de atributos da ficha com validação de fórmulas seguras. |
| **Sincronização em Tempo Real (UI)** | 🟢 Concluído | Atualização imediata de peso, itens e atributos sem necessidade de recarregar a página (0ms de latência percebida). |
| **Seleção Automática de Personagem** | 🟢 Concluído | Auto-seleção do personagem do jogador, persistência por campanha no storage e proteção contra seleção indevida. |
| **Interface Web (Frontend)** | 🟢 Concluído | SPA responsiva em React 19 + Tailwind: Workspace, CatalogManager, InventoryView com medidores, CRIS Sheet e Chat. |
| **Editor de Modelos de Ficha (Templates)** | 🟢 Concluído | CRUD de templates com seções, campos tipados, fórmulas derivadas e vinculação a personagens. |
| **Migrações e Compatibilidade Legada** | 🟢 Concluído | Verificação e aplicação idempotente de alterações de schema sem perda de dados. |
| **Combate & Turnos** | 🟢 Concluído | Encontros, iniciativa rolada no Rules Engine, turnos sincronizados, dano e cura atômica em ficha (Fase 3). |
| **Mapas Táticos e Tempo Real (VTT)** | 🟢 Concluído | Cenas com pan/zoom, grade quadrada configurável, tokens com permissões, fog of war e WebSockets (Fase 3). |
| **Lore e Manuais** | ⚪ Pendente | Enciclopédia por campanha, permissões de páginas secretas, formatação (Fase 5). |
| **Áudio e Ambientação** | ⚪ Pendente | Playlists vinculadas à campanha, sincronização de reprodução para mestre e jogadores (Fase 5). |

*Legenda: 🟢 Concluído | 🟡 Em Progresso | ⚪ Pendente | 🔴 Bloqueado*

---

## 4. Testes Automatizados — 21/21 Aprovados ✅

Executados via `npm run test --workspace=server` (`node:test` nativo do Node 24):

| # | Teste | Status | Duração |
|---|---|---|---|
| 1 | `Auth Module - Registro, Login e JWT` | 🟢 PASS | ~394ms |
| 2 | `Multi-Tenant & Regras Independentes entre Campanhas` | 🟢 PASS | ~235ms |
| 3 | `E2E API - Fluxo Completo de Autenticação, Campanhas, Isolamento e Fichas` | 🟢 PASS | ~417ms |
| 4 | `Catálogo de Itens, Inventário e Transferências Atômicas com Isolamento` | 🟢 PASS | ~292ms |
| 5 | `Editor de Modelos de Ficha (Templates) e Validação de Fórmulas Customizadas` | 🟢 PASS | ~87ms |
| 6 | `Persistência em Disco após Reinicialização do Banco de Dados` | 🟢 PASS | ~233ms |
| 7 | `Migração Segura e Idempotente - Banco legado sem coluna item_id` | 🟢 PASS | ~7ms |
| 8 | `1. Catálogo de Itens - Controle de Estoque Limitado, Modo de Aquisição e Solicitações` | 🟢 PASS | ~202ms |
| 9 | `2. Rolagens Secretas - Sigilo do Jogador, Entrega ao Mestre e Histórico Persistente` | 🟢 PASS | ~474ms |
| 10 | `3. Sistema de Itens - Categorias, Validação de Fórmulas e Uso Mecânico (Dano, Bateria, Recuperação)` | 🟢 PASS | ~98ms |
| 11 | `7.1 Sincronização em tempo real de inventário, peso e atributos sem recarregamento de página` | 🟢 PASS | ~246ms |
| 12 | `7.2 Lógica de Seleção Automática de Personagem por Usuário e Campanha` | 🟢 PASS | ~1ms |
| 13 | `7.3 Validação de segurança no backend para operações em personagens alheios` | 🟢 PASS | ~353ms |
| 14 | `Sincronização em tempo real de rolagens públicas e secretas via WebSocket` | 🟢 PASS | ~843ms |
| 15 | `Rules Engine - Expressões Aritméticas Básicas e Precedência` | 🟢 PASS | ~7ms |
| 16 | `Rules Engine - Rolagem de Dados com Breakdown Detalhado` | 🟢 PASS | ~2ms |
| 17 | `Rules Engine - Funções Matemáticas Autorizadas` | 🟢 PASS | ~2ms |
| 18 | `Rules Engine - Variáveis e Atributos de Personagem` | 🟢 PASS | ~1ms |
| 19 | `Rules Engine - Segurança e Tratamento de Erros` | 🟢 PASS | ~1ms |
| 20 | `Rules Engine - Validação de Expressões contra Atributos da Campanha` | 🟢 PASS | ~1ms |
| 21 | `Fase 3: Mesa Virtual (VTT), Cenas, Tokens, Visibilidade, Combate e Iniciativa` | 🟢 PASS | ~783ms |

---

## 5. Como Executar e Testar Localmente

### Pré-requisitos
- Node.js v24.x instalado.

### Modo de Desenvolvimento Completo
```powershell
npm run dev:all
# Servidor backend: http://localhost:3001
# Aplicação frontend: http://localhost:5173
```

### Executar a Suíte Completa de Testes
```powershell
npm run test --workspace=server
# 19 pass, 0 fail
```

### Compilar para Produção
```powershell
npm run build
npm start --workspace=server
# Acesse em: http://localhost:3001
```

### Roteiro de Teste Manual na Aplicação Local

#### 1. Teste de Seleção Automática de Personagem
1. Acesse o sistema como um Jogador que possui **apenas 1 personagem** em uma campanha.
2. Ao clicar na campanha, observe que a ficha desse personagem é **automaticamente selecionada e carregada de imediato**, sem selecionar nenhum personagem de outro jogador.
3. Crie um segundo personagem para esse mesmo jogador. Alterne entre os personagens e recarregue a página (F5): a última escolha feita é restaurada automaticamente pelo `localStorage`.
4. Crie uma nova conta de jogador (que não possui nenhum personagem na campanha) e entre na campanha: a interface não seleciona nenhum personagem alheio e apresenta o convite limpo com o botão **"+ Criar Meu Personagem"**.

#### 2. Teste de Atualização em Tempo Real do Inventário e Peso
1. Abra a campanha com um personagem selecionado e vá para a aba **Mochila & Inventário**.
2. Observe a métrica **Carga Atual (ex: 0.0 kg)** e **Total de Itens**.
3. Adicione um item (ex: Arma com 3.5kg, quantidade 2) ou vá na aba **Catálogo** e clique em **Pegar Item**.
4. Volte à aba **Inventário**: o peso total é atualizado para `7.0 kg` **imediatamente, sem necessidade de atualizar ou reiniciar o navegador**.
5. Clique nos botões `+` e `-` na quantidade do item: a cada clique, o peso total e o número de itens atualizam na hora.
6. Clique em **Descartar Item**: o item é removido e o peso total é recalculado instantaneamente.

#### 3. Teste de Restauração de Sessão e Preservação de Navegação após F5
1. Acesse uma campanha, navegue até a aba **Mesa Virtual (VTT)** e selecione uma cena específica.
2. Pressione **F5** no navegador para recarregar a página por completo.
3. Observe que o sistema **não retorna para a seleção de campanhas**: ele restaura automaticamente a campanha atual, a aba **VTT** e a cena que você estava visualizando.
4. Troque para a aba **Fichas** ou **Inventário** e recarregue novamente: o estado exato da aba e do personagem selecionado é preservado.

#### 4. Teste de Mesa Virtual (VTT), Tokens, Enquadramento e Fog of War
1. Abra duas janelas do navegador lado a lado (Janela 1: **Mestre**, Janela 2: **Jogador**):
2. **Proporção Real do Mapa e Enquadramento:**
   - Na janela do Mestre, crie ou configure uma cena com imagem retangular (ex: 1920x1080).
   - Clique em **Detectar** no modal para carregar a resolução nativa da imagem.
   - Observe que a imagem não é esticada nem cortada.
   - Clique no botão **Enquadrar** (Fit to Screen) na barra superior: o mapa é centralizado perfeitamente no viewport com margem confortável.
3. **Tamanho e Proporção dos Tokens:**
   - Crie um token no mapa com tamanho `1x` ou `1.5x`. Observe o avatar perfeitamente circular (proporção 1:1) com ring colorido, barra de vida e legenda com alto contraste.
   - Como Mestre, clique sobre o token: no popover inferior, clique nos botões `+` e `-` para alterar o tamanho (ex: `1.5x` -> `2x` -> `1x`). O token redimensiona instantaneamente na tela do Mestre e na tela do Jogador via WebSocket sem recarregar a página.
   - Aplique zoom (in/out): note que nomes, indicadores e tokens mantêm legibilidade e proporção estáveis.
4. **Fog of War com Revelação (Hole-Punching) em Tempo Real:**
   - Na janela do Mestre, ative a cena para os jogadores.
   - Clique em **Ocultar Tudo**: a janela do Jogador fica 100% preta (névoa opaca cobrindo mapa e tokens), enquanto na janela do Mestre a área fica semi-transparente com contorno vermelho tracejado.
   - Na janela do Mestre, selecione a ferramenta **- Revelar** e arraste um retângulo sobre uma sala do mapa:
     - Imediatamente, na janela do Jogador, abre-se um buraco na névoa exibindo o piso do mapa e os tokens que estiverem dentro da sala revelada.
     - Áreas fora do retângulo revelado continuam totalmente ocultas em preto para o Jogador.
   - Clique em **+ Ocultar** e arraste sobre metade da sala: a névoa é reaplicada sobre essa porção na tela do Jogador em tempo real.
   - Clique em **Desfazer**: a última operação de névoa é revertida instantaneamente em ambas as telas.
5. **Movimentação e Sincronização em Tempo Real sem F5:**
   - Na janela do Jogador, arraste o token do seu personagem: a posição é atualizada instantaneamente e suavemente na tela do Mestre.
   - Como Mestre, clique no ícone de olho do token de um monstro para alternar visibilidade: o monstro aparece/desaparece na hora na tela do Jogador sem necessidade de F5.

#### 5. Teste de Combate, Iniciativa e Dano/Cura em Tempo Real
1. Na aba **Mesa Virtual (VTT)**, clique no botão **Combate** para abrir o dock lateral de combate.
2. Na janela do **Mestre**:
   - Clique em **Iniciar** para abrir um novo encontro ("Emboscada").
   - Clique em **Adicionar Participante ao Combate** e adicione os personagens dos jogadores e o monstro.
   - Clique no ícone de dados para rolar todas as iniciativas automaticamente: a lista é reordenada na hora pela iniciativa mais alta.
   - Clique em **Próximo Turno**: o participante ativo ganha destaque visual e aura pulsante tanto na lista quanto no seu token no mapa.
3. No painel de combate, clique no ícone de chama (Dano / Cura) ao lado de um participante:
   - Aplique dano (ex: 8 de dano ou `2d6`).
   - O HP do combatente e a barra de vida do seu token diminuem imediatamente em ambas as telas.
   - Vá na aba **Fichas**: o valor `vida_atual` do personagem foi reduzido de forma persistente no banco de dados SQLite sem necessidade de recarregar a página.

---

## 6. Tipos de Dano, Dano Elemental e Imbuição de Armas com Consumíveis (Versão 0.9.0)

### 6.1 Tipos de Dano Configuráveis por Campanha
- Definição estruturada em `CampaignRuleSetConfig.damageTypes`:
  - `id`: identificador canônico em minúsculas (ex: `'fisico'`, `'fogo'`, `'gelo'`, `'eletrico'`, `'veneno'`, `'acido'`, `'energia'`, `'oculto'`).
  - `name`: nome legível exibido na interface (ex: `'Fogo'`, `'Veneno'`).
  - `category`: agrupamento opcional (ex: `'elemental'`, `'fisico'`, `'sobrenatural'`).
  - `description`, `color`, `icon`.
- Presets completos pré-configurados para os três sistemas nativos:
  - **Fantasia D20:** Físico, Fogo, Gelo, Elétrico, Ácido, Veneno, Radiante, Necrótico, Psíquico, Força.
  - **Investigação Paranormal:** Balístico, Corte, Impacto, Perfuração, Fogo, Frio, Químico, Eletricidade, Sangue, Morte, Energia, Conhecimento.
  - **Cyberpunk Neon:** Balístico, Cortante, Contundente, Térmico, Criogênico, Elétrico/PEM, Corrosivo, Cibernético/Neural, Biológico/Toxina.
- Endpoints REST para gerenciamento dinâmico pelo mestre:
  - `GET /api/campaigns/:campaignId/ruleset/damage-types`
  - `POST /api/campaigns/:campaignId/ruleset/damage-types`
  - `PUT /api/campaigns/:campaignId/ruleset/damage-types/:damageTypeId`
  - `DELETE /api/campaigns/:campaignId/ruleset/damage-types/:damageTypeId`

### 6.2 Modelo Multi-Componente de Dano em Armas e Habilidades
- Cada arma ou habilidade pode possuir dano primário e múltiplos componentes adicionais (`properties.damage_components`):
  - `damage_type`: elemento associado (ex: `'fogo'`).
  - `formula`: expressão matemática segura calculada pelo motor AST (ex: `'1d6 + 2'`).
  - `percentage_damage`: dano percentual proporcional à Vida Máxima (`max_hp`) do alvo (ex: `5` = 5% do HP máximo).
  - `chance_percent`: probabilidade determinística de ativação no acerto (1 a 100%).
  - `condition`: condição de status transmitida automaticamente ao alvo atingido (ex: `'envenenado'`).

### 6.3 Resolução Elemental e Mitigações de Alvo
- Cada componente de dano é resolvido de forma isolada e discriminada contra as propriedades do alvo (NPCs via `npc_data` e PCs via `computed_data` ou `raw_data`):
  - **Imunidade:** Dano multiplicado por `0` (alvo completamente imune ao elemento).
  - **Resistência:** Dano multiplicado por `0.5` (arredondado para baixo, mínimo 0).
  - **Vulnerabilidade:** Dano multiplicado por `2.0` (dano dobrado).
  - **Redução de Dano (RD/Armadura):** Aplicada com prioridade sobre o dano físico/primário.
- Discriminação completa em logs de combate (`componentsBreakdown`), exibindo valor base, multiplicador e dano final por elemento.

### 6.4 Imbuição de Armas com Consumíveis (Óleos, Venenos, Reagentes e Essências)
- **Endpoint Transacional Atômico (`POST /api/campaigns/:campaignId/characters/:characterId/inventory/imbue`):**
  - Consome 1 carga ou 1 unidade do item consumível do inventário do personagem. Se as cargas/unidades chegarem a 0, o consumível é removido automaticamente do SQLite.
  - Aplica o efeito imbuído (`ActiveImbuedEffect`) dentro do `properties_json` da arma alvo (`properties.imbued_effects`).
  - Modos de duração configuráveis:
    - `hits`: consome 1 carga apenas em acertos com sucesso.
    - `attacks`: consome 1 carga em qualquer tentativa de ataque.
    - `turns` e `rounds`: expira automaticamente durante `nextTurn` ao avançar turnos ou rodadas.
    - `permanent`: efeito persistente sem expiração automática.
  - Comportamento de re-imbuição: `replace` (substitui anterior), `stack` (acumula cargas se mesmo elemento), `reject` (rejeita se já houver efeito).
  - Transmissão automática de condições de status configuradas no consumível para o alvo atingido no combate.

### 6.5 Cobertura de Testes Automatizados
- **26 / 26 suítes de testes passando com 100% de sucesso:**
  - `tests/combat-damage-types-and-imbue.test.ts` cobrindo todos os 15 cenários de tipos de dano, danos multi-componente, cálculo elemental, resistências, imunidades, vulnerabilidades, consumo de cargas, expiração por acerto/turno e compatibilidade com armas legadas.
  - Testes de autorização RBAC e isolamento multi-tenant garantindo que jogadores não imbuam armas alheias nem alterem regras globais da campanha.

---

## 7. Ações Unificadas de Combate, Habilidades, Consumíveis e Condições (Versão 0.10.0)

### 7.1 Central Unificada de Ações de Combate (CombatTracker)
- **Eliminação de Modificações Gratuitas:** Nenhuma alteração arbitrária de HP, atributos ou condições é permitida a jogadores fora do fluxo oficial de combate.
- **Categorias Integradas em Abas Especializadas:**
  - **Arma Equipada (`action_mode: 'weapon'`):** Ataque com armas do inventário do atacante ou ataque desarmado básico (`1d4 + Força`) resolvido dinamicamente pelo ruleset. Consome `1 ação principal`.
  - **Habilidades & Poderes (`action_mode: 'ability'`):** Catálogo de habilidades configuráveis por campanha (`ruleset.config.abilities`) ou customizadas pelo mestre. Exibe custo de recursos (ex: `5 Mana`), tipo de ação (`main`, `bonus`, `reaction`, `free`), tipo de alvo (`allies`, `enemies`, `self`, `any`), fórmulas de dano/cura e condições aplicadas ou curadas.
  - **Usar Consumível em Combate (`action_mode: 'consumable'`):** Lista itens consumíveis do inventário do combatente ativo (poções de cura, elixires, antídotos). Consome `ação bônus` (ou configurada no item) e decrementa atomicamente cargas ou unidades do inventário.
  - **Imbuir Arma em Combate (`action_mode: 'imbue'`):** Aplicação tática de óleos, venenos e reagentes diretamente em armas equipadas durante o combate. Consome `ação bônus` e decrementa atomicamente o consumível.
  - **Defender (`action_mode: 'defend'`):** Postura defensiva ativa que eleva RD ou Defesa contra ataques recebidos até o próximo turno (`ação principal`).
  - **Esquivar (`action_mode: 'dodge'`):** Preparação de esquiva com rolagem dinâmica de dados baseada em atributos reais para elevar temporariamente a CA/Defesa (`ação principal`).
  - **Ajuste Manual do Mestre (`action_mode: 'manual'`):** Exclusivo do Mestre (`isMaster = true`), rotulado com transparência e registrado na auditoria com tag `[Intervenção Manual do Mestre]`.

### 7.2 Validação Prévia de Alvos (Target Validation)
- As ações declaram seus alvos permitidos (`valid_targets: 'self' | 'allies' | 'enemies' | 'any' | 'weapon' | 'object'`).
- O backend e a interface validam o relacionamento entre atacante e alvo:
  - Tentativas de usar ataques ofensivos em aliados ou curas restritas a aliados em inimigos são rejeitadas com `400 Bad Request` ("Alvo inválido: A ação 'X' não permite o alvo selecionado (Y). Alvos válidos: ...").
  - A interface renderiza alertas visuais e bloqueia o botão de execução quando o alvo selecionado for incompatível.

### 7.3 Restrição Estrita de Condições Manuais ao Mestre
- Endpoints de aplicação e remoção direta de condições (`POST/DELETE /characters/:characterId/conditions` e `POST/DELETE /combat/:encounterId/combatants/:combatantId/conditions`) agora exigem permissão explícita de mestre da campanha (`isMaster`). Jogadores recebem `403 Forbidden`.
- No frontend, os botões manuais de adicionar ou remover condições foram restritos exclusivamente ao Mestre, e todas as aplicações manuais gravam log explícito `[Intervenção Manual do Mestre]`.
- Jogadores aplicam ou removem condições exclusivamente através de habilidades e consumíveis autorizados (ex: feitiço de chamas que queima, antídoto que cura envenenamento).

### 7.4 Proteção de Idempotência e Economia de Ações
- O backend aceita cabeçalho opcional `idempotency_key` (ou chave única baseada em timestamp/ator/ação/alvo) com cache de resposta em memória. Requisições repetidas retornam a mesma resposta sem duplicar decrementos de PV, consumo de itens ou mana.
- Validação estrita de ações por turno (`actions_used.main`, `actions_used.bonus`, `actions_used.reaction`), bloqueando ações esgotadas antes de debitar recursos ou itens.

### 7.5 Cobertura Completa dos 15 Cenários de Teste (tests/combat-unified-actions-and-abilities.test.ts)
1. **Cenário 1:** Ataque com arma equipada consome ação principal e aplica dano/logs corretos.
2. **Cenário 2:** Habilidade com custo de recurso deduz mana e aplica dano ao alvo.
3. **Cenário 3:** Habilidade falha e cancela ação se combatente não tiver recurso suficiente (sem debitar PV nem ações).
4. **Cenário 4:** Uso de consumível em combate cura o aliado/ator e consome 1 unidade/carga do inventário.
5. **Cenário 5:** Imbuição de arma em combate aplica dano elemental e consome óleo do inventário com ação bônus.
6. **Cenário 6:** Ação tática de Defender consome ação principal e eleva RD/Defesa até o próximo turno.
7. **Cenário 7:** Ação tática de Esquivar consome ação principal e rola teste de Agilidade para elevar Defesa.
8. **Cenário 8:** Validação de Alvo — rejeita ataque ofensivo em aliado quando `valid_targets = ['enemies']`.
9. **Cenário 9:** Validação de Alvo — rejeita cura/buff em inimigo quando `valid_targets = ['self', 'allies']`.
10. **Cenário 10:** Habilidade que aplica condição de status transmite a condição e seus efeitos ao alvo.
11. **Cenário 11:** Habilidade que remove condição purifica o alvo conforme configurado em `remove_conditions`.
12. **Cenário 12:** Restrição de Condições Manuais — jogador comum recebe 403 ao tentar aplicar condição direta.
13. **Cenário 13:** Intervenção Manual do Mestre — mestre aplica condição com registro explícito em auditoria.
14. **Cenário 14:** Economia de Ações — bloqueia com 400 se o combatente tentar usar duas ações principais no mesmo turno.
15. **Cenário 15:** Idempotência e Repetição — rejeita ou retorna resposta em cache sem duplicar consumo de recurso ou item.

---

## 8. Correção Crítica: Aplicação e Resolução Centralizada de Condições e Status (Versão 0.11.0)

### 8.1 Diagnóstico Completo e Causas-Raiz Corrigidas
1. **Quebra de Transação por `.toLowerCase()` em Objeto sem Propriedade `name` (`TypeError: Cannot read properties of undefined`):**
   - Ao transmitir condições por ID (ex: `{ condition_id: 'envenenado' }`), `conditionData.name` chegava indefinido, disparando exceção no backend e forçando `ROLLBACK` atômico de toda a transação de combate.
   - *Solução:* Normalização prévia de identificadores, busca canônica case-insensitive e preenchimento defensivo com os valores padrão do ruleset da campanha.
2. **Incompatibilidade de Nomes de Campos (`condition` vs `apply_conditions`):**
   - Componentes de dano da arma e itens imbuídos no catálogo armazenavam a propriedade como `comp.condition: string` ou `imbue.condition: string`, enquanto o backend consultava estritamente `apply_conditions` em formato de array, ignorando as condições configuradas.
   - *Solução:* Unificação da coleta em `conditionCandidates`, agregando `condition`, `conditions`, `apply_conditions`, `condicao` e `condicao_aplicada` de armas, consumíveis, habilidades e imbuições.
3. **Interpretação Inconsistente de Escalas de Probabilidade (100% vs 1 vs 0.1):**
   - Chances expressas em decimais (ex: probabilidade `1.0` = 100%) eram avaliadas na condição `< 100` e comparadas contra `1d100 <= 1`, resultando em 99% de falha para efeitos que deveriam ter ativação garantida.
   - *Solução:* Função `normalizeChancePercent` e `evaluateChanceRoll`, onde 100%, 100, '100', '100%', 1 e '1' garantem ativação determinística sem rolagens que possam falhar, preservando aleatoriedade justa para chances parciais (<100%).
4. **Tratamento de Imunidades e Requisitos de Dano:**
   - Integração de verificação de imunidades do combatente e do personagem vinculado (`npc_data.immunities`, `npc_data.condition_immunities`, `raw_data.imunidades`, `computed_data.imunidades` e imunidades conferidas por condições ativas). Condições direcionadas a alvos imunes são rejeitadas com status `'immune'` e registradas na auditoria.
   - Efeitos de DoT também respeitam imunidades e resistências do alvo, anulando o dano se imune ou reduzindo à metade (-50%) se resistente.
5. **Sincronização em Tempo Real via WebSockets:**
   - Emissão imediata dos eventos `character:updated` e `combat:condition_applied` com o combatente e a ficha atualizados a cada aplicação ou remoção de status.

### 8.2 Cobertura Completa dos 15 Cenários de Teste (tests/combat-condition-application-and-status.test.ts)
1. **Cenário 1:** Aplicação com 100% de chance garantida (normalizando 100, 1, '100', '100%').
2. **Cenário 2:** Aplicação com chance percentual parcial (< 100%) testando sucessos e falhas determinísticas.
3. **Cenário 3:** Tentativa de aplicação quando o ataque erra (não aplica condição que requer acerto, retornando status `missed_attack`).
4. **Cenário 4:** Aplicação por poção consumível em si mesmo (auto-uso de consumível de status).
5. **Cenário 5:** Aplicação por poção consumível em alvo inimigo (frasco de veneno arremessado).
6. **Cenário 6:** Aplicação por habilidade de cura que concede condição benéfica (Abençoado).
7. **Cenário 7:** Aplicação por habilidade ofensiva com status negativo (Golpe Atordoante).
8. **Cenário 8:** Aplicação por arma imbuída com consumível de veneno com duração de cargas/hits.
9. **Cenário 9:** Alvo imune à condição específica (rejeição correta com status `immune` e log de auditoria).
10. **Cenário 10:** Alvo imune ao tipo de dano do efeito (imunidade bloqueia condição que requer dano).
11. **Cenário 11:** Aplicação de DoT com dano periódico ao longo dos turnos e resolução correta no avanço de turnos (`turn_start`).
12. **Cenário 12:** Acúmulo e substituição conforme regras configuradas (`replace`, `stack_duration`, `stack_intensity`).
13. **Cenário 13:** Remoção de condição antes do término por ação ou habilidade de purificação (`remove_conditions`).
14. **Cenário 14:** Recálculo correto dos atributos e defesa do alvo após receber e após perder a condição (modificadores de atributos).
15. **Cenário 15:** Persistência correta no banco após recarregamento (verificação direta nas tabelas SQLite).

---

## 9. Bestiário, NPCs e Gerenciamento de Encontros (Versão 0.12.0)

### 9.1 Visão Geral e Arquitetura
Implementação robusta da biblioteca de criaturas reutilizáveis da campanha e do sistema de preparação e execução de encontros, integrando Bestiário, VTT, tokens, iniciativa, combate dinâmico, ações de NPCs e proteção de informações secretas do mestre.

### 9.2 Biblioteca de Criaturas (Bestiário)
- **Modelos Reutilizáveis por Campanha:** Armazenamento centralizado na tabela `bestiary_creatures` com atributos, defesas, redução de dano (RD), fórmulas de dano e ataque, categorias (`humanoide`, `monstro`, `morto-vivo`, `besta`, `constructo`, `aberracao`, `demonio`, `elemental`, `chefe`), tamanho, imagem de avatar e token.
- **Cálculo Reativo com Ruleset da Campanha:** Integração transparente com `RulesService` e `CharacterService`, permitindo que criaturas utilizem templates da campanha e fórmulas derivadas.
- **Duplicação e Variantes Sem Efeito Colateral:** O mestre pode duplicar qualquer criatura para criar variantes (ex: *Goblin Guerreiro*, *Goblin Feiticeiro*, *Goblin Líder*). O modelo original permanece imutável.
- **Busca e Filtros:** Consulta otimizada por nome, descrição e categorias.

### 9.3 Separação Rigorosa de Modelo Matriz vs Instâncias em Jogo
- Quando uma criatura do bestiário é adicionada a um encontro ou cena, o sistema gera uma instância independente com identificador próprio (`UUID`), vinculada via `source_creature_id`.
- Adicionar múltiplas instâncias (ex: 3x *Goblin*) gera combatentes e tokens autônomos com identificadores sequenciais (*Goblin 1*, *Goblin 2*, *Goblin 3*).
- **Isolamento de Estado:** Causar dano, alterar recursos ou aplicar condições a um goblin não afeta os demais combatentes nem o modelo original no Bestiário.
- **Segurança e Integridade Referencial:** Excluir ou alterar instâncias de NPCs em encontros nunca altera nem remove a criatura salva no Bestiário.

### 9.4 Preparação e Gerenciamento de Encontros
- Estados do encontro: `'prep'` (em preparação), `'active'` (em combate) e `'ended'` (concluído).
- **Lista de Criaturas Planejadas (`planned_creatures_json`):** Permite salvar o planejamento do encontro (criaturas, variantes e quantidades) sem ativá-lo imediatamente.
- **Anotações Privadas e Objetivos do Mestre (`notes`):** Campo seguro para notas táticas e objetivos da cena, mantido em sigilo no backend e filtrado para jogadores comuns.
- **Duplicação de Encontros:** Permite clonar encontros inteiros (com criaturas planejadas e notas) para reuso em diferentes sessões.
- **Ativação Segura:** Ao ativar o encontro (`activateCombatEncounter`), as criaturas planejadas são instanciadas na cena e adicionadas ao combate sem duplicar combatentes já presentes.

### 9.5 Integração com Mapa, Tokens e Iniciativa
- **Geração de Tokens no VTT:** Ao instanciar criaturas para um encontro vinculado a uma cena, tokens correspondentes são gerados automaticamente nas coordenadas informadas ou calculadas, com avatares, tamanhos e dados de NPC (`npc_data_json`).
- **Iniciativa Automática com Ruleset:** A iniciativa das criaturas instanciadas é rolada imediatamente pelo motor de regras da campanha com base em suas estatísticas.
- **Reforços Durante Combate Ativo:** O mestre pode invocar reforços do Bestiário diretamente no combate ativo através do endpoint `POST .../combat/:encounterId/spawn-creatures` ou da interface do `CombatTracker`. Os reforços entram na ordem de turnos instantaneamente com iniciativa rolada, tokens criados e sem reiniciar a rodada nem duplicar participantes.

### 9.6 Ações de NPCs e Resolução Centralizada de Combate
- As ações cadastradas no bestiário (`npc_data.actions`) são integradas à aba de ações de combate (`CombatTracker`), permitindo seleção rápida e transparente pelo mestre.
- Execução centralizada no backend via `applyCombatAction`, processando fórmulas de ataque vs defesa, redução de armadura (RD), múltiplos componentes de dano elemental, efeitos de imbuição, chance percentual de condições e débito atômico de vida.

### 9.7 Proteção Rigorosa de Informações Secretas no Backend
- Jogadores comuns **nunca** recebem dados confidenciais através da rede:
  1. **Ocultação de Vida Exata (`hide_exact_hp`):** O backend substitui `current_hp: null` e `max_hp: null`, fornecendo apenas `hp_percent` e `hp_status` (`healthy`, `injured`, `bloodied`, `critical`, `defeated`) para que a interface renderize o visual tático sem expor os números reais.
  2. **Identidade Desconhecida / Nome Mascarado (`display_name_players`):** O nome do NPC é mascarado para jogadores (ex: "Silhueta Misteriosa", "Criatura Encapuzada") até que o mestre decida revelá-lo.
  3. **Atributos Ocultos (`hide_stats`):** Defesas, resistências e atributos numéricos são omitidos do payload dos jogadores.
  4. **Condições Secretas:** Condições marcadas como não visíveis para jogadores têm seus detalhes censurados.
  5. **Anotações do Mestre (`gm_notes`, `notes`):** Removidas integralmente de tokens, encontros e combatentes antes do envio via REST ou WebSocket para não-mestres.

### 9.8 Migração 8 do Schema SQLite (`server/src/db/connection.ts`)
- Criação da tabela `bestiary_creatures`:
  - `id TEXT PRIMARY KEY`
  - `campaign_id TEXT NOT NULL`
  - `template_id TEXT`
  - `name TEXT NOT NULL`
  - `description TEXT`
  - `category TEXT NOT NULL DEFAULT 'monstro'`
  - `size REAL NOT NULL DEFAULT 1`
  - `avatar_url TEXT`
  - `token_url TEXT`
  - `raw_data_json TEXT NOT NULL DEFAULT '{}'`
  - `computed_data_json TEXT NOT NULL DEFAULT '{}'`
  - `actions_json TEXT NOT NULL DEFAULT '[]'`
  - `properties_json TEXT NOT NULL DEFAULT '{}'`
  - `created_at TEXT NOT NULL`, `updated_at TEXT NOT NULL`
- Adição idempotente de colunas nas tabelas existentes via `PRAGMA table_info`:
  - `combatants.source_creature_id TEXT`
  - `tokens.source_creature_id TEXT`
  - `combat_encounters.notes TEXT NOT NULL DEFAULT ''`
  - `combat_encounters.planned_creatures_json TEXT NOT NULL DEFAULT '[]'`

### 9.9 Cobertura Completa dos 13 Cenários Obrigatórios (tests/bestiary-and-encounters.test.ts)
1. **Cenário 1 — Criação e Edição de Criatura:** Cria criatura no Bestiário com atributos, armas e ações; persiste e edita com sucesso.
2. **Cenário 2 — Duplicação e Criação de Variantes:** Duplica uma criatura criando uma variante sem alterar nem sobrescrever o modelo original.
3. **Cenário 3 — Múltiplas Instâncias Independentes:** Adiciona 3 instâncias de uma criatura ao encontro, gerando IDs e nomes sequenciais com estados isolados.
4. **Cenário 4 — Dano e Condições Isolados:** Aplica dano manual de 10 (abatido para 9 por RD 1) e envenenamento a uma única instância sem afetar as demais nem a matriz.
5. **Cenário 5 — Salvar e Carregar Encontro Preparado:** Cria encontro em status `'prep'` com notas e criaturas planejadas; valida carregamento sem combatentes prematuros.
6. **Cenário 6 — Iniciar Encontro sem Duplicações:** Ativa encontro preparado, instanciando criaturas planejadas e preservando combatentes pré-existentes.
7. **Cenário 7 — Adicionar Reforços Durante Combate Ativo:** Invoca reforços com combate em andamento, inserindo instâncias e tokens com iniciativa rolada sem resetar a rodada.
8. **Cenário 8 — Integração de Iniciativa pelo Ruleset:** Valida rolagem automática de iniciativa para instâncias de criaturas segundo o sistema de regras ativo.
9. **Cenário 9 — Persistência Após F5 e Reinicialização:** Simula desconexão e reinicialização completa do banco; valida integridade de todos os combatentes e tokens.
10. **Cenário 10 — Sincronização Mapa e Combate em Tempo Real:** Valida emissão e recepção de eventos WebSockets (`bestiary:updated`, `combat:reinforcements_added`, `combat:combatant_added`, `token:created`).
11. **Cenário 11 — Proteção de Informações Secretas no Backend:** Confirma mascaramento rigoroso de vida (`current_hp: null`), nome falso, atributos ocultos e anotações privadas para jogadores comuns.
12. **Cenário 12 — Validação de Permissões e Isolamento Multi-Tenant:** Bloqueia operações de jogadores comuns (403) e impede vazamento entre campanhas distintas.
13. **Cenário 13 — Preservação de Funcionalidades de Combate:** Valida execução de ações unificadas de NPCs com cálculo de acerto, dano elemental, redução de armadura e DoT.

---

## 10. Bestiário Seguro, Visibilidade Oculta por Padrão e Fichas de NPCs/Monstros (Versão 0.13.0)

### 10.1 Causa-Raiz das Falhas Identificadas
1. **Bestiário Exposto por Padrão:** As rotas `GET /api/campaigns/:id/bestiary` filtravam apenas por `c.properties?.is_secret !== true`. Criaturas criadas sem essa propriedade ficavam imediatamente visíveis e abertas para consulta de jogadores antes de qualquer introdução narrativa.
2. **Consulta Direta Sem Proteção (`GET .../bestiary/:id`):** Jogadores podiam adivinhar ou inspecionar o ID de uma criatura no tráfego de rede e abrir sua ficha diretamente, contornando a listagem.
3. **Vazamento via WebSockets Globais:** Modificações no bestiário disparavam `broadcast` incondicional, enviando todo o modelo de monstro criado a todos os clientes conectados na campanha.
4. **Acoplamento entre Visibilidade do Modelo e da Instância:** A visibilidade de um token no mapa interferia na visibilidade da criatura no bestiário e vice-versa.
5. **Vazamento de Fórmulas e Bônus nos Logs de Combate:** Logs gravavam expressões matemáticas de dados como `1d20 + 7` e `2d8 + 4`, permitindo que jogadores deduzissem os atributos e estatísticas exatas do monstro através da aba de combate.
6. **Editor Incompleto de Monstros:** Faltava suporte a tamanho padronizado (0.5x, 1x, 2x, 3x, 4x), equipamentos equipados, armas, raça/espécie, notas públicas vs notas confidenciais do mestre e tipos de dano.

### 10.2 Arquitetura de Segurança e Revelação Progressiva
- **Padrão Oculto (`is_revealed = 0`):** Toda criatura criada no bestiário (ou duplicada como variante) nasce estritamente oculta para jogadores. Na consulta do banco, se o solicitante for jogador comum (`!isMaster`), a cláusula `AND is_revealed = 1` é aplicada diretamente no SQL. Se um jogador tentar acessar `GET .../bestiary/:id` de criatura com `is_revealed = 0`, o servidor retorna `404 Not Found`.
- **Desacoplamento Rigoroso entre Modelo, Instância e Mapa:**
  - Ocultar/revelar um monstro no bestiário afeta apenas o acesso à biblioteca/ficha modelo.
  - Instanciar um monstro com token visível no mapa **não revela** o modelo do bestiário.
  - Instanciar um monstro oculto/invisível (`is_hidden = 1`) oculta tanto o token do mapa quanto sua entrada no combate para jogadores.
- **Controle Granular de Revelação Progressiva (`revealed_fields`):**
  - Mestre pode revelar gradualmente atributos conforme testes de conhecimento, perícia ou narrativa:
    `name`, `category`, `avatar`, `description`, `attributes`, `exact_hp`, `defenses`, `damage_types`, `equipment`, `abilities`, `formulas`, `notes`.
  - Campos não liberados são rigorosamente censurados no servidor:
    - Vida exata: `current_hp = null` e `max_hp = null`, mantendo apenas `hp_percent` e `hp_status` (`healthy`, `injured`, `bloodied`, `critical`, `defeated`) para alimentar a barra visual.
    - Defesas: `defense = 0`, `damage_reduction = 0`.
    - Fórmulas: `initiative_formula = '---'`.
    - Atributos numéricos (`forca`, `destreza`, etc.): removidos do JSON retornado ao jogador.
    - Notas confidenciais (`gm_notes`, `private_notes`): **100% omitidas** em qualquer requisição de não-mestre.
- **Sanitização de WebSockets (`broadcastFiltered`):**
  - O servidor em tempo real avalia a role de cada cliente conectado antes de transmitir eventos. Monstros ocultos nunca geram eventos WebSocket para jogadores; quando revelados, jogadores recebem o payload pré-sanitizado.
- **Sanitização de Logs de Combate:**
  - Expressões matemáticas e rolagens internas (`details.attack_roll.expression`, `details.formula`, etc.) são removidas nos logs consultados por jogadores comuns. O nome do monstro é dinamicamente substituído pelo nome mascarado (`display_name_players`).

### 10.3 Editor Enriquecido de Criaturas
- **Identidade Dupla:** Campo de Nome Real (Mestre) e Nome Mascarado (Jogadores, ex: "Figura Encapuzada").
- **Tamanho Físico de Grid:** Seletores para Miúdo (0.5x), Médio (1x), Grande (2x), Enorme (3x) e Colossal (4x).
- **Equipamentos e Armas:** Adição de armas, armaduras e escudos com tipo de dano, bônus na defesa e RD que alimentam o combate tático.
- **Resistências, Vulnerabilidades e Imunidades por Tipo de Dano:** Configuração explícita de tipos elementais (fogo, frio, elétrico, veneno, corte, impacto, etc.).
- **Notas Públicas vs Privadas:** Separação entre anotações de lore públicas e notas privadas do mestre.

### 10.4 Migração 9 do Schema SQLite (`server/src/db/connection.ts`)
- Adicionadas colunas na tabela `bestiary_creatures`:
  - `is_revealed INTEGER NOT NULL DEFAULT 0`
  - `display_name_players TEXT`
  - `revealed_fields_json TEXT NOT NULL DEFAULT '{}'`
  - `equipment_json TEXT NOT NULL DEFAULT '[]'`
  - `race TEXT DEFAULT ''`
  - `public_notes TEXT DEFAULT ''`
  - `private_notes TEXT DEFAULT ''`
- Execução segura e idempotente via inspeção de `PRAGMA table_info(bestiary_creatures)`.

### 10.5 Cobertura Completa dos 17 Cenários Obrigatórios (tests/bestiary-visibility-and-security.test.ts)
1. **Cenário 1 — Criatura criada nasce oculta:** Confirma `is_revealed = 0` no banco e retorno ao criar nova criatura.
2. **Cenário 2 — Jogador não vê criatura oculta na lista:** Valida lista vazia em `GET /api/campaigns/:id/bestiary` para jogador.
3. **Cenário 3 — Jogador não abre ficha de criatura oculta:** Retorna `404 Not Found` em `GET /api/campaigns/:id/bestiary/:id`.
4. **Cenário 4 — Revelação explícita:** Mestre chama `POST /reveal` e jogador passa a listar e visualizar a criatura.
5. **Cenário 5 — Ocultação explícita:** Mestre chama `POST /hide` e jogador volta a receber 404 e lista vazia.
6. **Cenário 6 — Duplicação segura:** Criatura duplicada nasce com `is_revealed = 0`, mesmo que a original estivesse revelada.
7. **Cenário 7 — Instância no mapa não revela modelo:** Criatura instanciada com token visível no mapa não afeta a segurança do modelo no bestiário (continua 404).
8. **Cenário 8 — Token invisível não aparece para jogadores:** Instância com `is_hidden = 1` não é retornada em `GET /tokens` nem por ID direto.
9. **Cenário 9 — Nome mascarado:** Jogadores visualizam apenas `display_name_players` no combate, tokens e logs.
10. **Cenário 10 — Vida exata ocultada:** `current_hp: null` e `max_hp: null`, mantendo `hp_percent` e `hp_status` para a barra visual.
11. **Cenário 11 — Atributos numéricos protegidos:** `attributes` e valores de atributos brutos não são enviados ao jogador.
12. **Cenário 12 — Fórmulas de dano protegidas:** `initiative_formula` é substituída por `'---'` e fórmulas de ataques omitidas.
13. **Cenário 13 — Notas confidenciais protegidas:** `gm_notes` e `private_notes` nunca são enviadas a jogadores.
14. **Cenário 14 — Revelação progressiva:** Mestre libera campos pontuais (`revealed_fields`) e apenas eles são expostos.
15. **Cenário 15 — Armas e equipamentos salvos:** Valida persistência de armas, tipos de dano e bônus defensivos no modelo.
16. **Cenário 16 — Combate com ações e armas de NPCs:** Valida ataque de NPC contra personagem herói no combate.
17. **Cenário 17 — Ausência de vazamento via WebSockets e Logs:** Valida filtragem no WebSocket e sanitização de dados nos logs.

---

## 10. Correção de Vazamento de Atributos Secretos de NPCs (Versão 0.14.0)

### 10.1 Causa Raiz Identificada e Corrigida
1. **Fallbacks Hardcoded no Frontend (`BestiaryManager.tsx`):**
   - Quando o backend sanitizava e removia campos como `vida`, `defesa`, `rd` e `iniciativa_formula` de criaturas para jogadores comuns, o frontend utilizava expressões de fallback estáticas:
     ```typescript
     const hp = stats.vida ?? stats.pv ?? stats.hp ?? stats.max_hp ?? 20;
     const def = stats.defesa ?? stats.ca ?? stats.defense ?? 12;
     const rd = stats.rd ?? stats.armadura ?? stats.damage_reduction ?? 0;
     const init = stats.iniciativa_formula || stats.initiative_formula || '1d20 + 2';
     ```
   - Isso fazia com que, mesmo sem receber nenhum dado do backend, a interface renderizasse exatamente: **PV: 20**, **Defesa: 12**, **RD: 0** e **Inic.: 1d20 + 2** para os jogadores.
2. **Vazamento Parcial de `raw_data` e Fórmulas no Backend (`bestiary.service.ts`):**
   - Quando `revealed.attributes` estava ativo, o backend copiava `raw_data` para `sanitizedRaw`. Caso `revealed.defenses` ou `revealed.formulas` estivessem desmarcados, chaves como `defesa`, `rd` e `iniciativa_formula` não eram removidas de `raw_data`, vazando dados sensíveis via JSON.
3. **Vazamento em Logs de Combate (`combat.service.ts`):**
   - O objeto `log.details` incluía `target_defense` e `damage_reduction` mesmo quando o alvo era um NPC com defesas secretas.
4. **Vazamento em Transmissões WebSocket (`ws.server.ts` e `app.ts`):**
   - Eventos de criação de token, movimentação e reforços de combate transmitiam payloads unsanitizados mapeados com visão de mestre (`isMaster: true`).

### 10.2 Soluções Implementadas
1. **Camada Centralizada de Sanitização (`sanitizeNpcDataForPlayer`):**
   - Função utilitária canônica compartilhada entre `bestiary.service.ts`, `vtt.service.ts` e `combat.service.ts`.
   - Remove sistematicamente todas as variações de chaves de HP (`hp`, `vida`, `pv`, `current_hp`, `max_hp`, `pv_maximo`, `vida_maxima`, etc.) quando `!revealed.exact_hp`.
   - Remove chaves de defesa e armadura (`defense`, `defesa`, `ca`, `rd`, `damage_reduction`, `armadura`, `resistances`, `vulnerabilities`, `immunities`) quando `!revealed.defenses`.
   - Remove fórmulas de iniciativa e combate (`iniciativa_formula`, `initiative_formula`, `attack_formula`, `damage_formula`, `damage_components`) quando `!revealed.formulas`.
   - Remove atributos numéricos quando `!revealed.attributes`.
   - Remove notas do mestre (`gm_notes`, `private_notes`) incondicionalmente para jogadores.
2. **Proteção em Profundidade no Frontend (`BestiaryManager.tsx`, `VirtualTabletop.tsx`, `CombatTracker.tsx`):**
   - Removidos todos os fallbacks numéricos enganosos (`20`, `12`, `0`, `1d20 + 2`).
   - Se o campo não estiver revelado, exibe `??` ou `---` para jogadores, sem gerar dados fictícios.
   - O selo "Nome visto pelos jogadores" é exibido exclusivamente para o mestre; jogadores comuns visualizam diretamente o nome mascarado no título sem quebra de imersão.
   - Logs de combate omitem a Defesa do alvo NPC para jogadores quando não revelada.
3. **WebSocket com Filtragem por Papel (`broadcastFiltered`):**
   - Todas as transmissões de tokens, movimentações e combatentes utilizam `broadcastFiltered` para que mestres recebam o payload completo e jogadores recebam a versão estritamente sanitizada.
4. **Cobertura Completa de Testes de Regressão:**
   - Adicionado o **Cenário 18** em `server/tests/bestiary-visibility-and-security.test.ts` validando ponta a ponta o caso real relatado com nome mascarado ("luix") e ocultação de PV, Defesa, RD e Iniciativa no Bestiário, Mapa e Combate.
