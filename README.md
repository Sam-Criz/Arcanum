# ⚔️ Arcanum VTT — Virtual Tabletop & RPG Engine

> Plataforma web modular, reativa e em tempo real para RPGs de Mesa. Focada em combate tático integrado, motor de regras configurável sem `eval`, fichas dinâmicas, mesa virtual com Fog of War vetorial, inventário com peso, bestiário protegido e sistema completo de condições e efeitos de status.

---

## 🌟 Visão Geral

O **Arcanum VTT** é uma plataforma monolítica modular projetada para mestres e jogadores que buscam uma experiência de jogo fluida, imersiva e segura. Diferente de plataformas que apenas mascaram dados no frontend, o Arcanum implementa **segurança e autorização determinística em nível de backend**, garantindo que nenhum dado secreto (atributos de monstros, vida exata, notas confidenciais ou fórmulas internas) seja exposto a jogadores através da rede.

---

## ✨ Principais Funcionalidades

### 🗺️ 1. Mesa Virtual (VTT) & Mapas
- **Cenas Dinâmicas:** Criação e troca de cenas com imagem de fundo, detecção de resolução nativa, ajuste automático à tela (*Fit to Screen*), zoom (0.15x a 3x) e pan suave.
- **Fog of War Vetorial:** Ocultação e revelação com corte vetorial SVG (*hole-punching*). Jogadores visualizam escuridão opaca absoluta, enquanto o mestre enxerga áreas sob névoa de forma translúcida com demarcações táticas.
- **Tokens Parametrizados:** Tokens com proporção 1:1, anéis de cor e status, trava de posição, rotação e controle de escala no grid:
  - Miúdo (0.5x)
  - Médio (1x — 1 quadrado)
  - Grande (2x — 2x2 quadrados)
  - Enorme (3x — 3x3 quadrados)
  - Colossal (4x — 4x4 quadrados)
- **Barra de Vida Tática Flutuante:** Renderização visual contínua sobre os tokens com código de cores (Verde: Saudável, Âmbar: Ferido/Ensanguentado, Vermelho: Crítico/Derrotado). Funciona mesmo quando o valor numérico exato de PV está oculto dos jogadores.

### ⚔️ 2. Combate Tático & Ações Unificadas
- **Aba de Combate Centralizada:** Jogadores e mestres executam todas as suas ações sem alternar de tela:
  - Atacar com armas equipadas no inventário ou desarmado dinâmico.
  - Usar habilidades e magias com débito automático de recursos (PV, Mana, Sanidade).
  - Usar consumíveis e poções (cura, fortalecimento, ofensivos).
  - Imbuir armas com veneno, fogo, frio, eletricidade ou dano sagrado.
  - Defender (bônus de Defesa ou RD até o próximo turno).
  - Esquivar (teste dinâmico de atributos para elevar a Defesa efetiva).
  - Encerrar turno.
- **Iniciativa Obrigatória & Desempate Determinístico:**
  - Ordenação automática decrescente de iniciativa com desempate por atributo configurado na campanha (`tie_breaker_attr`: Destreza em D20, Agilidade em Paranormal, Reflexo em Cyberpunk).
- **Economia de Ações por Turno:**
  - Controle estrito de ações principais, bônus, reações e ações livres. Bloqueio no backend contra ações fora do turno ou excesso de gastos de ações.
- **Validação de Alvos Válidos:**
  - Permissão de alvos configurável por habilidade ou item (`self`, `allies`, `enemies`, `weapon`, `any`).
- **Resolução de Ataque vs Defesa e Armadura (RD):**
  - Avaliação de acerto comparando rolagem de ataque contra Defesa efetiva. Dano reduzido por Redução de Dano (RD) do alvo, fraquezas elementais (150%) e resistências (50%).

### 🩸 3. Condições, Efeitos de Status & DoT
- **Dano Contínuo Automático (DoT):** Sangramento, veneno e chamas avaliam fórmulas e debitam pontos de vida atomicamente nos momentos exatos (`turn_start`, `turn_end`, `round_end`).
- **Ciclo de Vida e Expiração:** Condições com duração em turnos, rodadas ou ações decaem de forma persistente.
- **Incapacitação Estrita:** Combatentes com 0 PV ou com a condição *Incapacitado* têm ações bloqueadas e podem ser pulados automaticamente na ordem de turnos.
- **Regras de Acúmulo:** Suporte a pilhas configuráveis (`replace`, `stack_duration`, `stack_intensity` e `ignore`).

### 🐉 4. Bestiário Seguro & Fichas de NPCs/Monstros
- **Biblioteca de Matrizes Reutilizáveis:** Criação, edição, duplicação e organização de criaturas e monstros por categoria.
- **Oculto por Padrão para Jogadores:** Toda criatura recém-criada ou duplicada nasce estritamente invisível para jogadores (`is_revealed = 0`). Jogadores recebem `404 Not Found` em consultas diretas por ID de criaturas ocultas.
- **Desacoplamento de Modelo vs Instância:**
  - Inserir um goblin no mapa cria uma instância isolada. Causar dano a um goblin não altera os outros nem o modelo no bestiário.
  - Posicionar um token visível no mapa não revela o modelo matriz do bestiário aos jogadores.
- **Proteção Rigorosa de Segredos:**
  - **Nome Mascarado:** Nome real protegido; jogadores visualizam apenas a identidade mascarada (ex: *"Figura Encapuzada"*).
  - **Vida Exata Oculta:** `current_hp: null` e `max_hp: null` enviados aos jogadores, mantendo apenas percentual e estado visual (`healthy`, `injured`, `bloodied`, `critical`, `defeated`).
  - **Defesas e Atributos Protegidos:** Estatísticas mecânicas (Defesa, RD, atributos) e fórmulas de iniciativa e dados censuradas nos payloads HTTP, eventos WebSocket e logs de combate, com eliminação de fallbacks fictícios na interface.
  - **Notas Privadas:** Anotações confidenciais do mestre são 100% expurgadas antes de qualquer transmissão.
- **Revelação Progressiva Granular:** O mestre pode selecionar pontualmente quais campos deseja revelar aos jogadores conforme testes narrativos (Nome, Categoria, Imagem, Descrição, Atributos, PV Exato, Defesas, Tipos de Dano, Equipamentos, Habilidades, Fórmulas ou Notas).
- **Ocultação & Revelação Dinâmica em Combate:**
  - Instanciação de criaturas com a opção *"Oculto para os jogadores (Invisível na iniciativa e mapa)"*, garantindo que nem o token nem o combatente apareçam para os jogadores antes da hora narrativa.
  - Sincronização bidirecional em tempo real entre iniciativa e mapa: alternar a visibilidade no combate sincroniza o token no mapa, e alternar o token no mapa sincroniza a iniciativa.
  - Controles explícitos no painel do mestre para revelar ou ocultar participantes com preservação integral de PV, iniciativas, condições e ordem de turnos.
  - Proteção de turno ativo: quando a vez é de uma criatura oculta, os jogadores recebem notificação descritiva de *"Turno Oculto"*, sem apontar indevidamente para outro participante visível.
- **Blindagem Contra Vazamento de Nomes em Validações:**
  - Validações de turno rejeitadas no backend (`applyCombatAction`, `imbueWeaponWithConsumable`) nunca expõem nomes verdadeiros de criaturas ocultas ou protegidas.
  - Para criaturas ocultas, entrega mensagem genérica: *"Não é seu turno de agir."*
  - Para criaturas com identidade mascarada, utiliza o nome público autorizado (`display_name_players`), enquanto o mestre continua com acesso integral aos nomes reais.

### 📐 5. Motor de Regras Configurável (Sem `eval`)
- Parser matemático léxico e semântico construído do zero, gerando árvore sintática (AST) segura:
  - Operadores aritméticos: `+`, `-`, `*`, `/`, `%`, `^`.
  - Dados poliédricos: `1d20`, `3d6 + 2`, `2d8`, `d100`.
  - Funções matemáticas autorizadas: `max`, `min`, `floor`, `ceil`, `round`, `abs`, `clamp`, `sqrt`.
  - Variáveis contextuais dinâmicas com suporte a caracteres acentuados (`força`, `agilidade`, `destreza`, `nível`).
- Presets prontos para:
  - **Fantasia D20:** Sistema tradicional com Força, Destreza, Constituição, Inteligência, Sabedoria e Carisma.
  - **Investigação Paranormal:** Sistema no estilo C.R.I.S. com Agilidade, Força, Intelecto, Presença e Vigor.
  - **Cyberpunk Neon:** Sistema futurista com Reflexos, Tecnologia, Físico, Sangue-Frio e Interface.

### 🎒 6. Catálogo & Inventário Reativo
- Controle de peso atual e capacidade máxima de carga por personagem.
- Transações atômicas de transferência e empréstimo de itens entre jogadores e mestre.
- Catálogo de itens com controle de estoque limitado, compra por jogadores e aprovação pelo mestre.
- Imbuição de armas com consumíveis e rastreamento de cargas de uso.

### 🎨 7. Design Moderno & Experiência Imersiva (Apple-inspired UI)
- **Visual Glassmorphism & Imersão:**
  - Painéis semitransparentes com desfoque de fundo inteligente (`backdrop-blur-md` e `bg-slate-900/80`), integrando o mapa, cartas e fichas sem poluição visual.
- **Micro-interações Fluídas:**
  - Animações refinadas e táteis em botões e controles (`hover:scale-[1.02] active:scale-[0.98] transition-all`).
  - Cantos arredondados orgânicos e harmônicos (`rounded-xl`, `rounded-2xl` e `rounded-3xl`).
- **Otimizações com React 19:**
  - Auditoria estrita de renderização sob tráfego WebSocket de combate e movimentação em tempo real.
  - Chaves (`key`) únicas e determinísticas em todas as listas de combatentes, itens, rolagens e tokens.

---

## 🛠️ Arquitetura Técnica

```
┌────────────────────────────────────────────────────────┐
│               Frontend (React 19 + Vite)               │
│  Tailwind CSS • Lucide Icons • Reatividade WebSocket   │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP / REST & WebSocket (/ws)
┌──────────────────────────▼─────────────────────────────┐
│                 Backend (Node.js 24 + Express)         │
│  - RBAC Multi-Tenant: Owner, Master, Assistant, Player │
│  - Rules Engine: AST Lexer/Parser Seguro (sem eval)    │
│  - Combat Engine: Turnos, Iniciativa, Ações, DoT       │
│  - Bestiary Service: Revelação Progressiva & Sanitizer │
│  - Realtime WS Server: Broadcast Filtrado por Papel    │
└──────────────────────────┬─────────────────────────────┘
                           │ SQLite Nativo (node:sqlite)
┌──────────────────────────▼─────────────────────────────┐
│         Banco de Dados Relacional Local com WAL        │
│   Transações ACID Atômicas • 9 Migrações Idempotentes  │
└────────────────────────────────────────────────────────┘
```

---

## 📁 Estrutura do Repositório

```text
├── client/                      # Frontend React 19 + TypeScript + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── BestiaryManager.tsx   # Gerenciador de Bestiário, Editor e Revelação
│   │   │   ├── CombatTracker.tsx     # Rastreador de Combate e Ações Unificadas
│   │   │   ├── VirtualTabletop.tsx   # Mesa Virtual, Fog of War e Tokens
│   │   │   ├── InventoryView.tsx     # Inventário, Peso e Capacidade
│   │   │   ├── CatalogManager.tsx    # Catálogo de Itens da Campanha
│   │   │   ├── TemplateEditor.tsx    # Modelos de Fichas Customizados
│   │   │   └── CampaignWorkspace.tsx # Área de Trabalho Integrada da Campanha
│   │   └── services/
│   │       └── api.ts                # Cliente REST e Tipagens TypeScript
├── server/                      # Backend Node.js v24 + Express + SQLite
│   ├── src/
│   │   ├── db/
│   │   │   └── connection.ts         # Conexão SQLite nativa e Migrações (1 a 9)
│   │   ├── modules/
│   │   │   ├── auth/                 # Registro, Login e JWT
│   │   │   ├── bestiary/             # Matrizes, Instâncias e Revelação Progressiva
│   │   │   ├── combat/               # Motor de Combate, Turnos, DoT e Ações
│   │   │   ├── inventory/            # Inventário, Imbuição e Transferências
│   │   │   ├── permissions/          # RBAC Multi-tenant e Políticas de Acesso
│   │   │   ├── realtime/             # Servidor WebSocket com broadcastFiltered
│   │   │   ├── rules-engine/         # Parser Léxico, AST e Avaliador Matemático
│   │   │   └── vtt/                  # Cenas, Tokens e Camadas de Fog of War
│   │   └── app.ts                    # Definição e montagem das rotas REST
│   └── tests/                        # 29 Suítes de Testes Automatizados
│       ├── bestiary-visibility-and-security.test.ts # 17 Cenários de Segurança
│       ├── combat-unified-actions-and-abilities.test.ts
│       ├── combat-condition-application-and-status.test.ts
│       └── ...
└── STATUS.md                    # Histórico e documentação técnica de versões
```

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- **Node.js**: Versão 22 ou 24 (suporte nativo ao `node:sqlite`).
- **npm**: Versão 10+.

### 1. Clonar o Repositório
```bash
git clone https://github.com/Sam-Criz/Arcanum.git
cd Arcanum
```

### 2. Instalar Dependências
```bash
# Na raiz do projeto:
npm install

# No backend e frontend:
npm --prefix server install
npm --prefix client install
```

### 3. Executar em Modo de Desenvolvimento
```bash
# Inicia servidor backend e frontend simultaneamente:
npm run dev
```
- **Backend API & WebSockets:** `http://localhost:3000`
- **Frontend Web:** `http://localhost:5173`

### 4. Executar os Testes Automatizados
O projeto conta com uma suíte de testes ponta a ponta e unitários via runner nativo do Node.js:
```bash
npm --prefix server test
```

### 5. Compilar para Produção
```bash
npm run build
```

---

## 🛡️ Segurança e Proteção de Dados

- **Sem `eval()`:** Todas as fórmulas de dano, atributos e testes são avaliadas por parser AST próprio e determinístico.
- **Isolamento de Campanhas:** Acesso a recursos de outras campanhas é bloqueado com `403 Forbidden` no backend.
- **Transações ACID:** Débito de vida, consumo de itens, mana e criação de instâncias utilizam transações atômicas no SQLite.
- **Sanitização em Duas Vias:** Clientes não autorizados recebem payloads filtrados tanto em respostas HTTP quanto em eventos WebSocket em tempo real.

---

## 📝 Licença

Distribuído sob a licença **MIT**. Consulte `LICENSE` para mais informações.

Desenvolvido para revolucionar a forma como mestres e jogadores vivenciam suas campanhas de RPG de Mesa.
