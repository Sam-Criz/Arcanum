# Status do Projeto — Plataforma Modular de RPG de Mesa

**Data da última atualização:** 2026-10-21  
**Versão:** 0.15.0 (Controle Bidirecional de Visibilidade, Sincronização em Tempo Real e Revelação Narrativa de Monstros em Combate e VTT)

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
