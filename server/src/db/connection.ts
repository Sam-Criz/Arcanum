import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

let dbInstance: DatabaseSync | null = null;

export function getDatabase(customPath?: string): DatabaseSync {
  if (dbInstance && !customPath) {
    return dbInstance;
  }

  const dbPath = customPath || config.dbPath;

  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(dbPath);

  // Garantir modo WAL para alta concorrência e integridade referencial ativa
  db.exec('PRAGMA foreign_keys = ON;');
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }

  initializeSchema(db);
  runMigrations(db);

  if (!customPath) {
    dbInstance = db;
  }

  return db;
}

export function initializeSchema(db: DatabaseSync): void {
  db.exec(`
    -- Usuários da plataforma
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Campanhas (cada campanha é um ambiente isolado com suas próprias regras)
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      cover_image TEXT,
      owner_id TEXT NOT NULL,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Membros e papéis na campanha (RBAC: owner, master, assistant, player)
    CREATE TABLE IF NOT EXISTS campaign_memberships (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('owner', 'master', 'assistant', 'player')),
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE (campaign_id, user_id)
    );

    -- Códigos de convite para campanhas
    CREATE TABLE IF NOT EXISTS campaign_invites (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('master', 'assistant', 'player')),
      expires_at TEXT,
      max_uses INTEGER DEFAULT NULL,
      used_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    -- Configuração versionada de regras da campanha (atributos, fórmulas, recursos, etc.)
    CREATE TABLE IF NOT EXISTS ruleset_versions (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      title TEXT NOT NULL DEFAULT 'Regras Iniciais',
      config_json TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      UNIQUE (campaign_id, version_number)
    );

    -- Modelos de ficha dinâmicos configurados pelo mestre para a campanha
    CREATE TABLE IF NOT EXISTS character_templates (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      schema_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    -- Personagens vinculados à campanha e ao usuário
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      template_id TEXT,
      name TEXT NOT NULL,
      avatar_url TEXT,
      is_npc INTEGER NOT NULL DEFAULT 0,
      raw_data_json TEXT NOT NULL DEFAULT '{}',
      computed_data_json TEXT NOT NULL DEFAULT '{}',
      conditions_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES character_templates(id) ON DELETE SET NULL
    );

    -- Catálogo de itens da campanha
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT DEFAULT 'geral',
      weight REAL NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      acquisition_mode TEXT NOT NULL DEFAULT 'free' CHECK (acquisition_mode IN ('free', 'limited', 'approval')),
      stock_quantity INTEGER DEFAULT NULL,
      is_hidden INTEGER NOT NULL DEFAULT 0,
      is_purchasable INTEGER NOT NULL DEFAULT 1,
      properties_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    -- Solicitações de obtenção de itens por jogadores
    CREATE TABLE IF NOT EXISTS item_requests (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      notes TEXT DEFAULT '',
      reviewed_by_user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Inventário de personagens
    CREATE TABLE IF NOT EXISTS character_inventory (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      item_id TEXT,
      item_name TEXT NOT NULL,
      category TEXT DEFAULT 'geral',
      quantity INTEGER NOT NULL DEFAULT 1,
      weight REAL NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      is_equipped INTEGER NOT NULL DEFAULT 0,
      properties_json TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL
    );

    -- Registro e auditoria de transferências de itens entre personagens
    CREATE TABLE IF NOT EXISTS inventory_transfers (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      from_character_id TEXT NOT NULL,
      to_character_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      transferred_by_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (from_character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (to_character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (transferred_by_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Histórico de rolagens de dados
    CREATE TABLE IF NOT EXISTS dice_rolls (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      character_id TEXT,
      expression TEXT NOT NULL,
      breakdown_json TEXT NOT NULL,
      total REAL NOT NULL,
      context_type TEXT DEFAULT 'general',
      is_secret INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL
    );

    -- Encontros e combate
    CREATE TABLE IF NOT EXISTS combat_encounters (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      scene_id TEXT,
      name TEXT NOT NULL DEFAULT 'Combate',
      status TEXT NOT NULL DEFAULT 'prep' CHECK (status IN ('prep', 'active', 'paused', 'ended')),
      round INTEGER NOT NULL DEFAULT 1,
      turn_index INTEGER NOT NULL DEFAULT 0,
      turn_timer_seconds INTEGER NOT NULL DEFAULT 60,
      turn_started_at TEXT,
      notes TEXT DEFAULT '',
      planned_creatures_json TEXT NOT NULL DEFAULT '[]',
      data_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE SET NULL
    );

    -- Cenas e mapas da mesa virtual (VTT)
    CREATE TABLE IF NOT EXISTS scenes (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      name TEXT NOT NULL,
      image_url TEXT,
      grid_type TEXT NOT NULL DEFAULT 'square' CHECK (grid_type IN ('square', 'none', 'hex')),
      grid_size INTEGER NOT NULL DEFAULT 50,
      grid_scale REAL NOT NULL DEFAULT 1.5,
      grid_scale_unit TEXT NOT NULL DEFAULT 'm',
      grid_color TEXT NOT NULL DEFAULT '#ffffff',
      grid_opacity REAL NOT NULL DEFAULT 0.3,
      width INTEGER NOT NULL DEFAULT 2000,
      height INTEGER NOT NULL DEFAULT 2000,
      is_active INTEGER NOT NULL DEFAULT 0,
      fog_enabled INTEGER NOT NULL DEFAULT 0,
      fog_data_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    -- Tokens posicionados na cena
    CREATE TABLE IF NOT EXISTS tokens (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      scene_id TEXT NOT NULL,
      character_id TEXT,
      name TEXT NOT NULL,
      avatar_url TEXT,
      x REAL NOT NULL DEFAULT 0,
      y REAL NOT NULL DEFAULT 0,
      size REAL NOT NULL DEFAULT 1,
      rotation REAL NOT NULL DEFAULT 0,
      is_visible INTEGER NOT NULL DEFAULT 1,
      is_locked INTEGER NOT NULL DEFAULT 0,
      color TEXT NOT NULL DEFAULT '#4f46e5',
      current_hp REAL,
      max_hp REAL,
      notes TEXT DEFAULT '',
      source_creature_id TEXT,
      npc_data_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL
    );

    -- Participantes do combate / iniciativa
    CREATE TABLE IF NOT EXISTS combatants (
      id TEXT PRIMARY KEY,
      encounter_id TEXT NOT NULL,
      campaign_id TEXT NOT NULL,
      character_id TEXT,
      token_id TEXT,
      source_creature_id TEXT,
      name TEXT NOT NULL,
      avatar_url TEXT,
      initiative REAL NOT NULL DEFAULT 0,
      initiative_formula TEXT NOT NULL DEFAULT '1d20',
      is_npc INTEGER NOT NULL DEFAULT 0,
      is_hidden INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      current_hp REAL,
      max_hp REAL,
      conditions_json TEXT NOT NULL DEFAULT '[]',
      defense REAL NOT NULL DEFAULT 10,
      damage_reduction REAL NOT NULL DEFAULT 0,
      npc_data_json TEXT NOT NULL DEFAULT '{}',
      actions_used_json TEXT NOT NULL DEFAULT '{}',
      defensive_state_json TEXT NOT NULL DEFAULT '{}',
      tie_breaker REAL NOT NULL DEFAULT 0,
      is_incapacitated INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (encounter_id) REFERENCES combat_encounters(id) ON DELETE CASCADE,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL,
      FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE SET NULL
    );

    -- Histórico de ações de combate (dano, cura, modificações)
    CREATE TABLE IF NOT EXISTS combat_logs (
      id TEXT PRIMARY KEY,
      encounter_id TEXT NOT NULL,
      campaign_id TEXT NOT NULL,
      actor_id TEXT,
      actor_name TEXT NOT NULL,
      target_id TEXT,
      target_name TEXT,
      action_type TEXT NOT NULL,
      resource_name TEXT,
      amount REAL,
      details_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (encounter_id) REFERENCES combat_encounters(id) ON DELETE CASCADE,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    -- Auditoria e logs de alterações críticas
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    -- Índices para performance e consultas multi-tenant frequentes
    CREATE INDEX IF NOT EXISTS idx_memberships_user ON campaign_memberships(user_id);
    CREATE INDEX IF NOT EXISTS idx_memberships_campaign ON campaign_memberships(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_characters_campaign ON characters(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id);
    CREATE INDEX IF NOT EXISTS idx_ruleset_campaign ON ruleset_versions(campaign_id, is_active);
    CREATE INDEX IF NOT EXISTS idx_rolls_campaign ON dice_rolls(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_items_campaign ON items(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_char ON character_inventory(character_id);
    CREATE INDEX IF NOT EXISTS idx_transfers_campaign ON inventory_transfers(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_item_requests_campaign ON item_requests(campaign_id, status);
    CREATE INDEX IF NOT EXISTS idx_scenes_campaign ON scenes(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_tokens_scene ON tokens(scene_id);
    CREATE INDEX IF NOT EXISTS idx_tokens_campaign ON tokens(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_combatants_encounter ON combatants(encounter_id);
    CREATE INDEX IF NOT EXISTS idx_combat_logs_encounter ON combat_logs(encounter_id);
    -- Bestiário e biblioteca de criaturas reutilizáveis
    CREATE TABLE IF NOT EXISTS bestiary_creatures (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      template_id TEXT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT DEFAULT 'monstro',
      size REAL NOT NULL DEFAULT 1,
      avatar_url TEXT,
      token_url TEXT,
      raw_data_json TEXT NOT NULL DEFAULT '{}',
      computed_data_json TEXT NOT NULL DEFAULT '{}',
      actions_json TEXT NOT NULL DEFAULT '[]',
      properties_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES character_templates(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bestiary_campaign ON bestiary_creatures(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_bestiary_category ON bestiary_creatures(campaign_id, category);
  `);
}

/**
 * Migrations idempotentes — aplicadas após a criação do schema base.
 * Cada operação verifica se a alteração já existe antes de aplicá-la,
 * tornando-a segura para bancos criados em qualquer versão anterior.
 */
export function runMigrations(db: DatabaseSync): void {
  // -----------------------------------------------------------------------
  // Migração 1: adicionar coluna item_id à character_inventory
  // Necessária para bancos criados antes da Fase 2, onde a tabela existia
  // sem a coluna de referência ao catálogo de itens.
  // -----------------------------------------------------------------------
  const inventoryCols = db.prepare(`PRAGMA table_info(character_inventory)`).all() as any[];
  const hasItemId = inventoryCols.some((c: any) => c.name === 'item_id');
  if (!hasItemId) {
    db.exec(`
      ALTER TABLE character_inventory
      ADD COLUMN item_id TEXT REFERENCES items(id) ON DELETE SET NULL;
    `);
  }

  // -----------------------------------------------------------------------
  // Migração 2: colunas de controle de estoque e modo de aquisição em items
  // -----------------------------------------------------------------------
  const itemCols = db.prepare(`PRAGMA table_info(items)`).all() as any[];
  const hasAcquisitionMode = itemCols.some((c: any) => c.name === 'acquisition_mode');
  if (!hasAcquisitionMode) {
    db.exec(`
      ALTER TABLE items
      ADD COLUMN acquisition_mode TEXT NOT NULL DEFAULT 'free';
    `);
  }

  const hasStockQuantity = itemCols.some((c: any) => c.name === 'stock_quantity');
  if (!hasStockQuantity) {
    db.exec(`
      ALTER TABLE items
      ADD COLUMN stock_quantity INTEGER DEFAULT NULL;
    `);
  }

  // -----------------------------------------------------------------------
  // Migração 3: tabela de solicitações de itens por jogadores (item_requests)
  // -----------------------------------------------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS item_requests (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      notes TEXT DEFAULT '',
      reviewed_by_user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_item_requests_campaign ON item_requests(campaign_id, status);
  `);

  // -----------------------------------------------------------------------
  // Migração 4: VTT — Cenas, Tokens, Encontros, Combatentes e Logs de Combate
  // -----------------------------------------------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS scenes (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      name TEXT NOT NULL,
      image_url TEXT,
      grid_type TEXT NOT NULL DEFAULT 'square' CHECK (grid_type IN ('square', 'none', 'hex')),
      grid_size INTEGER NOT NULL DEFAULT 50,
      grid_scale REAL NOT NULL DEFAULT 1.5,
      grid_scale_unit TEXT NOT NULL DEFAULT 'm',
      grid_color TEXT NOT NULL DEFAULT '#ffffff',
      grid_opacity REAL NOT NULL DEFAULT 0.3,
      width INTEGER NOT NULL DEFAULT 2000,
      height INTEGER NOT NULL DEFAULT 2000,
      is_active INTEGER NOT NULL DEFAULT 0,
      fog_enabled INTEGER NOT NULL DEFAULT 0,
      fog_data_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tokens (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      scene_id TEXT NOT NULL,
      character_id TEXT,
      name TEXT NOT NULL,
      avatar_url TEXT,
      x REAL NOT NULL DEFAULT 0,
      y REAL NOT NULL DEFAULT 0,
      size REAL NOT NULL DEFAULT 1,
      rotation REAL NOT NULL DEFAULT 0,
      is_visible INTEGER NOT NULL DEFAULT 1,
      is_locked INTEGER NOT NULL DEFAULT 0,
      color TEXT NOT NULL DEFAULT '#4f46e5',
      current_hp REAL,
      max_hp REAL,
      notes TEXT DEFAULT '',
      source_creature_id TEXT,
      npc_data_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS combatants (
      id TEXT PRIMARY KEY,
      encounter_id TEXT NOT NULL,
      campaign_id TEXT NOT NULL,
      character_id TEXT,
      token_id TEXT,
      source_creature_id TEXT,
      name TEXT NOT NULL,
      avatar_url TEXT,
      initiative REAL NOT NULL DEFAULT 0,
      initiative_formula TEXT NOT NULL DEFAULT '1d20',
      is_npc INTEGER NOT NULL DEFAULT 0,
      is_hidden INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      current_hp REAL,
      max_hp REAL,
      conditions_json TEXT NOT NULL DEFAULT '[]',
      defense REAL NOT NULL DEFAULT 10,
      damage_reduction REAL NOT NULL DEFAULT 0,
      npc_data_json TEXT NOT NULL DEFAULT '{}',
      actions_used_json TEXT NOT NULL DEFAULT '{}',
      defensive_state_json TEXT NOT NULL DEFAULT '{}',
      tie_breaker REAL NOT NULL DEFAULT 0,
      is_incapacitated INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (encounter_id) REFERENCES combat_encounters(id) ON DELETE CASCADE,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL,
      FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS combat_logs (
      id TEXT PRIMARY KEY,
      encounter_id TEXT NOT NULL,
      campaign_id TEXT NOT NULL,
      actor_id TEXT,
      actor_name TEXT NOT NULL,
      target_id TEXT,
      target_name TEXT,
      action_type TEXT NOT NULL,
      resource_name TEXT,
      amount REAL,
      details_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (encounter_id) REFERENCES combat_encounters(id) ON DELETE CASCADE,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_scenes_campaign ON scenes(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_tokens_scene ON tokens(scene_id);
    CREATE INDEX IF NOT EXISTS idx_tokens_campaign ON tokens(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_combatants_encounter ON combatants(encounter_id);
    CREATE INDEX IF NOT EXISTS idx_combat_logs_encounter ON combat_logs(encounter_id);
  `);

  const encounterCols = db.prepare(`PRAGMA table_info(combat_encounters)`).all() as any[];
  const hasSceneId = encounterCols.some((c: any) => c.name === 'scene_id');
  if (!hasSceneId) {
    db.exec(`ALTER TABLE combat_encounters ADD COLUMN scene_id TEXT;`);
  }
  const hasName = encounterCols.some((c: any) => c.name === 'name');
  if (!hasName) {
    db.exec(`ALTER TABLE combat_encounters ADD COLUMN name TEXT NOT NULL DEFAULT 'Combate';`);
  }

  // -----------------------------------------------------------------------
  // Migração 5: Atributos defensivos de NPCs e monstros em tokens e combatants
  // -----------------------------------------------------------------------
  const tokenCols = db.prepare(`PRAGMA table_info(tokens)`).all() as any[];
  const hasTokenNpcData = tokenCols.some((c: any) => c.name === 'npc_data_json');
  if (!hasTokenNpcData) {
    db.exec(`ALTER TABLE tokens ADD COLUMN npc_data_json TEXT NOT NULL DEFAULT '{}';`);
  }

  const combatantCols = db.prepare(`PRAGMA table_info(combatants)`).all() as any[];
  const hasCombatantNpcData = combatantCols.some((c: any) => c.name === 'npc_data_json');
  if (!hasCombatantNpcData) {
    db.exec(`ALTER TABLE combatants ADD COLUMN npc_data_json TEXT NOT NULL DEFAULT '{}';`);
  }
  const hasDefense = combatantCols.some((c: any) => c.name === 'defense');
  if (!hasDefense) {
    db.exec(`ALTER TABLE combatants ADD COLUMN defense REAL NOT NULL DEFAULT 10;`);
  }
  const hasDR = combatantCols.some((c: any) => c.name === 'damage_reduction');
  if (!hasDR) {
    db.exec(`ALTER TABLE combatants ADD COLUMN damage_reduction REAL NOT NULL DEFAULT 0;`);
  }

  // -----------------------------------------------------------------------
  // Migração 6: Ações por turno, estados defensivos, desempate e incapacitação
  // -----------------------------------------------------------------------
  const hasActionsUsed = combatantCols.some((c: any) => c.name === 'actions_used_json');
  if (!hasActionsUsed) {
    db.exec(`ALTER TABLE combatants ADD COLUMN actions_used_json TEXT NOT NULL DEFAULT '{}';`);
  }
  const hasDefensiveState = combatantCols.some((c: any) => c.name === 'defensive_state_json');
  if (!hasDefensiveState) {
    db.exec(`ALTER TABLE combatants ADD COLUMN defensive_state_json TEXT NOT NULL DEFAULT '{}';`);
  }
  const hasTieBreaker = combatantCols.some((c: any) => c.name === 'tie_breaker');
  if (!hasTieBreaker) {
    db.exec(`ALTER TABLE combatants ADD COLUMN tie_breaker REAL NOT NULL DEFAULT 0;`);
  }
  const hasIsIncapacitated = combatantCols.some((c: any) => c.name === 'is_incapacitated');
  if (!hasIsIncapacitated) {
    db.exec(`ALTER TABLE combatants ADD COLUMN is_incapacitated INTEGER NOT NULL DEFAULT 0;`);
  }

  // -----------------------------------------------------------------------
  // Migração 7: Condições e efeitos de status em personagens
  // -----------------------------------------------------------------------
  const characterCols = db.prepare(`PRAGMA table_info(characters)`).all() as any[];
  const hasCharConditions = characterCols.some((c: any) => c.name === 'conditions_json');
  if (!hasCharConditions) {
    db.exec(`ALTER TABLE characters ADD COLUMN conditions_json TEXT NOT NULL DEFAULT '[]';`);
  }

  // -----------------------------------------------------------------------
  // Migração 8: Bestiário, modelos vs instâncias, e preparação de encontros
  // -----------------------------------------------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS bestiary_creatures (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      template_id TEXT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT DEFAULT 'monstro',
      size REAL NOT NULL DEFAULT 1,
      avatar_url TEXT,
      token_url TEXT,
      raw_data_json TEXT NOT NULL DEFAULT '{}',
      computed_data_json TEXT NOT NULL DEFAULT '{}',
      actions_json TEXT NOT NULL DEFAULT '[]',
      properties_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES character_templates(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bestiary_campaign ON bestiary_creatures(campaign_id);
  `);

  const combatantColsAfterM7 = db.prepare(`PRAGMA table_info(combatants)`).all() as any[];
  const hasCombatantSourceCreature = combatantColsAfterM7.some((c: any) => c.name === 'source_creature_id');
  if (!hasCombatantSourceCreature) {
    db.exec(`ALTER TABLE combatants ADD COLUMN source_creature_id TEXT;`);
  }

  const tokenColsAfterM7 = db.prepare(`PRAGMA table_info(tokens)`).all() as any[];
  const hasTokenSourceCreature = tokenColsAfterM7.some((c: any) => c.name === 'source_creature_id');
  if (!hasTokenSourceCreature) {
    db.exec(`ALTER TABLE tokens ADD COLUMN source_creature_id TEXT;`);
  }

  const encounterColsAfterM7 = db.prepare(`PRAGMA table_info(combat_encounters)`).all() as any[];
  const hasEncounterNotes = encounterColsAfterM7.some((c: any) => c.name === 'notes');
  if (!hasEncounterNotes) {
    db.exec(`ALTER TABLE combat_encounters ADD COLUMN notes TEXT DEFAULT '';`);
  }
  const hasPlannedCreatures = encounterColsAfterM7.some((c: any) => c.name === 'planned_creatures_json');
  if (!hasPlannedCreatures) {
    db.exec(`ALTER TABLE combat_encounters ADD COLUMN planned_creatures_json TEXT NOT NULL DEFAULT '[]';`);
  }

  // -----------------------------------------------------------------------
  // Migração 9: Bestiário oculto por padrão, revelação progressiva e equipamentos
  // -----------------------------------------------------------------------
  const bestiaryCols = db.prepare(`PRAGMA table_info(bestiary_creatures)`).all() as any[];
  const hasIsRevealed = bestiaryCols.some((c: any) => c.name === 'is_revealed');
  if (!hasIsRevealed) {
    db.exec(`ALTER TABLE bestiary_creatures ADD COLUMN is_revealed INTEGER NOT NULL DEFAULT 0;`);
  }
  const hasDisplayNamePlayers = bestiaryCols.some((c: any) => c.name === 'display_name_players');
  if (!hasDisplayNamePlayers) {
    db.exec(`ALTER TABLE bestiary_creatures ADD COLUMN display_name_players TEXT;`);
  }
  const hasRevealedFields = bestiaryCols.some((c: any) => c.name === 'revealed_fields_json');
  if (!hasRevealedFields) {
    db.exec(`ALTER TABLE bestiary_creatures ADD COLUMN revealed_fields_json TEXT NOT NULL DEFAULT '{}';`);
  }
  const hasEquipment = bestiaryCols.some((c: any) => c.name === 'equipment_json');
  if (!hasEquipment) {
    db.exec(`ALTER TABLE bestiary_creatures ADD COLUMN equipment_json TEXT NOT NULL DEFAULT '[]';`);
  }
  const hasRace = bestiaryCols.some((c: any) => c.name === 'race');
  if (!hasRace) {
    db.exec(`ALTER TABLE bestiary_creatures ADD COLUMN race TEXT DEFAULT '';`);
  }
  const hasPublicNotes = bestiaryCols.some((c: any) => c.name === 'public_notes');
  if (!hasPublicNotes) {
    db.exec(`ALTER TABLE bestiary_creatures ADD COLUMN public_notes TEXT DEFAULT '';`);
  }
  const hasPrivateNotes = bestiaryCols.some((c: any) => c.name === 'private_notes');
  if (!hasPrivateNotes) {
    db.exec(`ALTER TABLE bestiary_creatures ADD COLUMN private_notes TEXT DEFAULT '';`);
  }
  // -----------------------------------------------------------------------
  // Migração 10: Segurança do Catálogo - Itens Ocultos e Controle de Comprabilidade
  // -----------------------------------------------------------------------
  const itemColsMigration10 = db.prepare(`PRAGMA table_info(items)`).all() as any[];
  const hasIsHidden = itemColsMigration10.some((c: any) => c.name === 'is_hidden');
  if (!hasIsHidden) {
    db.exec(`ALTER TABLE items ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0;`);
  }
  const hasIsPurchasable = itemColsMigration10.some((c: any) => c.name === 'is_purchasable');
  if (!hasIsPurchasable) {
    db.exec(`ALTER TABLE items ADD COLUMN is_purchasable INTEGER NOT NULL DEFAULT 1;`);
  }
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
