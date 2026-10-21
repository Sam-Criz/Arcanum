import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { getDatabase, initializeSchema, runMigrations } from '../src/db/connection';
import { AuthService } from '../src/modules/auth/auth.service';
import { CampaignService } from '../src/modules/campaigns/campaign.service';
import { RulesService } from '../src/modules/rules-engine/rules.service';
import { CharacterService } from '../src/modules/characters/character.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { RbacService } from '../src/modules/permissions/rbac.service';

test('Catálogo de Itens, Inventário e Transferências Atômicas com Isolamento', () => {
  const db = getDatabase(':memory:');
  const authService = new AuthService(db);
  const rulesService = new RulesService(db);
  const campaignService = new CampaignService(db, rulesService);
  const characterService = new CharacterService(db, rulesService);
  const inventoryService = new InventoryService(db);
  const rbacService = new RbacService(db);

  // 1. Criar dois usuários e duas campanhas distintas
  const userA = authService.register({ email: 'mestreA@rpg.com', username: 'MestreA', password: 'password123' }).user;
  const userB = authService.register({ email: 'mestreB@rpg.com', username: 'MestreB', password: 'password123' }).user;
  const playerA = authService.register({ email: 'jogadorA@rpg.com', username: 'JogadorA', password: 'password123' }).user;

  const campA = campaignService.createCampaign(userA.id, { name: 'Campanha A - Ocultismo', preset: 'investigacao' });
  const campB = campaignService.createCampaign(userB.id, { name: 'Campanha B - Cyberpunk', preset: 'cyberpunk' });

  // Jogador entra na Campanha A
  const invite = campaignService.createInvite(campA.id, { role: 'player' });
  campaignService.joinCampaignByInvite(invite.code, playerA.id);

  // 2. Criar itens no catálogo da Campanha A e Campanha B
  const itemA1 = inventoryService.createCatalogItem(campA.id, {
    name: 'Poção de Cicatrizante',
    category: 'consumivel',
    weight: 0.5,
    cost: 50,
    description: 'Restaura 2d8 pontos de vida'
  });

  const itemB1 = inventoryService.createCatalogItem(campB.id, {
    name: 'Injetor Neural de Reflexo',
    category: 'cibernetico',
    weight: 0.2,
    cost: 400
  });

  // Validação de isolamento do catálogo
  const catalogA = inventoryService.getCatalogItems(campA.id);
  const catalogB = inventoryService.getCatalogItems(campB.id);

  assert.strictEqual(catalogA.length, 1);
  assert.strictEqual(catalogA[0].name, 'Poção de Cicatrizante');
  assert.strictEqual(catalogB.length, 1);
  assert.strictEqual(catalogB[0].name, 'Injetor Neural de Reflexo');

  // Campanha A não consegue buscar item da Campanha B
  const crossItem = inventoryService.getCatalogItemById(campA.id, itemB1.id);
  assert.strictEqual(crossItem, null);

  // 3. Personagens na Campanha A
  const char1 = characterService.createCharacter(campA.id, userA.id, {
    name: 'Arthur (Mestre)',
    rawData: { Forca: 2, Agilidade: 3, Vigor: 2 }
  });

  const char2 = characterService.createCharacter(campA.id, playerA.id, {
    name: 'Dante (Jogador)',
    rawData: { Forca: 1, Agilidade: 4, Vigor: 1 }
  });

  // Personagem na Campanha B (para teste de tentativa de transferência entre campanhas)
  const charB = characterService.createCharacter(campB.id, userB.id, {
    name: 'Netrunner V',
    rawData: { Cromo: 3, Reflexo: 4 }
  });

  // 4. Adicionar itens aos personagens
  const invItemChar1 = inventoryService.addItemToCharacter(campA.id, char1.id, {
    itemId: itemA1.id,
    quantity: 5
  });
  assert.strictEqual(invItemChar1.quantity, 5);
  assert.strictEqual(invItemChar1.weight, 0.5);

  const summaryBefore = inventoryService.getCharacterInventory(campA.id, char1.id);
  assert.strictEqual(summaryBefore.totalWeight, 2.5); // 5 * 0.5
  assert.strictEqual(summaryBefore.itemCount, 5);

  // 5. Transferência Atômica bem-sucedida: Arthur transfere 2 poções para Dante
  const transferRes = inventoryService.transferItem(
    campA.id,
    char1.id,
    {
      inventoryItemId: invItemChar1.id,
      targetCharacterId: char2.id,
      quantity: 2
    },
    userA.id,
    true // isMaster
  );

  assert.strictEqual(transferRes.success, true);
  assert.strictEqual(transferRes.transferred.quantity, 2);

  // Validar conservação exata de itens
  const char1Inv = inventoryService.getCharacterInventory(campA.id, char1.id);
  const char2Inv = inventoryService.getCharacterInventory(campA.id, char2.id);

  assert.strictEqual(char1Inv.items[0].quantity, 3); // 5 - 2 = 3
  assert.strictEqual(char2Inv.items[0].quantity, 2); // 0 + 2 = 2
  assert.strictEqual(char1Inv.itemCount + char2Inv.itemCount, 5); // Total preservado

  // Verificar histórico de auditoria
  const history = inventoryService.getTransferHistory(campA.id);
  assert.strictEqual(history.length, 1);
  assert.strictEqual(history[0].quantity, 2);
  assert.strictEqual(history[0].from_character_name, 'Arthur (Mestre)');
  assert.strictEqual(history[0].to_character_name, 'Dante (Jogador)');

  // 6. Testes de falha e integridade de transferências
  // Quantidade zero ou negativa
  assert.throws(() => {
    inventoryService.transferItem(campA.id, char1.id, {
      inventoryItemId: invItemChar1.id,
      targetCharacterId: char2.id,
      quantity: 0
    }, userA.id, true);
  }, /maior que zero/);

  // Quantidade superior à disponível (Arthur tem 3, tenta transferir 10)
  assert.throws(() => {
    inventoryService.transferItem(campA.id, char1.id, {
      inventoryItemId: invItemChar1.id,
      targetCharacterId: char2.id,
      quantity: 10
    }, userA.id, true);
  }, /Quantidade insuficiente/);

  // Arthur continua com 3 (nenhum item foi perdido após o erro)
  assert.strictEqual(inventoryService.getCharacterInventory(campA.id, char1.id).items[0].quantity, 3);

  // Tentativa de transferir para personagem de OUTRA campanha (CharB está na Campanha B)
  assert.throws(() => {
    inventoryService.transferItem(campA.id, char1.id, {
      inventoryItemId: invItemChar1.id,
      targetCharacterId: charB.id,
      quantity: 1
    }, userA.id, true);
  }, /Personagem de destino não encontrado nesta campanha/);

  // Jogador comum tentando transferir item de personagem alheio sem ser mestre
  assert.throws(() => {
    inventoryService.transferItem(campA.id, char1.id, {
      inventoryItemId: invItemChar1.id,
      targetCharacterId: char2.id,
      quantity: 1
    }, playerA.id, false); // playerA não é dono de char1 nem mestre
  }, /Você só pode transferir itens de seus próprios personagens/);

  db.close();
});

test('Editor de Modelos de Ficha (Templates) e Validação de Fórmulas Customizadas', () => {
  const db = getDatabase(':memory:');
  const authService = new AuthService(db);
  const rulesService = new RulesService(db);
  const campaignService = new CampaignService(db, rulesService);
  const characterService = new CharacterService(db, rulesService);

  const master = authService.register({ email: 'mestreOculto@rpg.com', username: 'MestreOculto', password: 'password123' }).user;
  const camp = campaignService.createCampaign(master.id, { name: 'Ordem dos Investigadores', preset: 'investigacao' });

  // 1. Criar Template com campos customizados e fórmula derivada
  const template = characterService.createTemplate(camp.id, 'Ficha Ocultista Especialista', 'Modelo para conjuradores de rituais', {
    sections: [
      {
        id: 'conhecimento',
        title: 'Conhecimento & Rituais',
        fields: [
          {
            id: 'afinidade',
            name: 'Afinidade Elemental',
            type: 'text',
            defaultValue: 'Morte'
          },
          {
            id: 'potencial_ritual',
            name: 'Potencial de Ritual',
            type: 'number',
            defaultValue: 5,
            isDerived: true,
            formula: 'Intelecto * 3 + Presenca' // Usa atributos da campanha
          }
        ]
      }
    ]
  });

  assert.strictEqual(template.name, 'Ficha Ocultista Especialista');
  assert.strictEqual(template.schema.sections.length, 1);

  // 2. Criar personagem vinculado a este template
  const char = characterService.createCharacter(camp.id, master.id, {
    name: 'Kian',
    templateId: template.id,
    rawData: {
      Forca: 1,
      Agilidade: 2,
      Intelecto: 4,
      Presenca: 3,
      Vigor: 2
    }
  });

  // O campo derivado do template 'potencial_ritual' deve ser calculado automaticamente:
  // Intelecto * 3 + Presenca = 4 * 3 + 3 = 15!
  assert.strictEqual(char.computed_data.potencial_ritual, 15);
  // Campo com valor padrão do template:
  assert.strictEqual(char.computed_data.afinidade, 'Morte');
  // Atributos derivados nativos da campanha também preservados:
  // Defesa = 10 + Agilidade = 12
  assert.strictEqual(char.computed_data.defesa, 12);
  // Vida = Vigor * 5 + 10 = 20
  assert.strictEqual(char.computed_data.vida_max, 20);

  // 3. Atualizar personagem e recalcular fórmula do template
  const updatedChar = characterService.updateCharacter(camp.id, char.id, {
    rawData: { Intelecto: 5 } // Aumenta Intelecto para 5
  }, master.id, true);

  // Novo potencial: 5 * 3 + 3 = 18!
  assert.strictEqual(updatedChar.computed_data.potencial_ritual, 18);

  db.close();
});

test('Persistência em Disco após Reinicialização do Banco de Dados', () => {
  const testDbDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(testDbDir)) fs.mkdirSync(testDbDir, { recursive: true });
  const testDbPath = path.join(testDbDir, 'test_persistence.db');

  // Remove arquivo antigo se existir
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  // SESSÃO 1: Gravar dados no arquivo físico
  {
    const db1 = getDatabase(testDbPath);
    const auth1 = new AuthService(db1);
    const rules1 = new RulesService(db1);
    const camp1 = new CampaignService(db1, rules1);
    const inv1 = new InventoryService(db1);
    const char1 = new CharacterService(db1, rules1);

    const user = auth1.register({ email: 'persist@rpg.com', username: 'PersistUser', password: 'password123' }).user;
    const camp = camp1.createCampaign(user.id, { name: 'Campanha Persistente' });
    const item = inv1.createCatalogItem(camp.id, { name: 'Relíquia Antiga', cost: 1000, weight: 1.5 });
    const char = char1.createCharacter(camp.id, user.id, { name: 'Guardião', rawData: { Forca: 4, Agilidade: 2, Vigor: 3 } });
    inv1.addItemToCharacter(camp.id, char.id, { itemId: item.id, quantity: 1 });

    db1.close(); // Fecha banco simulando restart
  }

  // SESSÃO 2: Reabrir banco e validar que tudo foi preservado
  {
    const db2 = getDatabase(testDbPath);
    const auth2 = new AuthService(db2);
    const rules2 = new RulesService(db2);
    const camp2 = new CampaignService(db2, rules2);
    const inv2 = new InventoryService(db2);
    const char2 = new CharacterService(db2, rules2);

    const loginRes = auth2.login({ login: 'persist@rpg.com', password: 'password123' });
    assert.strictEqual(loginRes.user.username, 'PersistUser');

    const camps = camp2.getUserCampaigns(loginRes.user.id);
    assert.strictEqual(camps.length, 1);
    assert.strictEqual(camps[0].name, 'Campanha Persistente');

    const items = inv2.getCatalogItems(camps[0].id);
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].name, 'Relíquia Antiga');
    assert.strictEqual(items[0].cost, 1000);

    const chars = char2.getCampaignCharacters(camps[0].id, loginRes.user.id, true);
    assert.strictEqual(chars.length, 1);
    assert.strictEqual(chars[0].name, 'Guardião');
    assert.strictEqual(chars[0].computed_data.vida_max, 25); // Vigor (3) * 5 + 10 = 25

    const inv = inv2.getCharacterInventory(camps[0].id, chars[0].id);
    assert.strictEqual(inv.items.length, 1);
    assert.strictEqual(inv.items[0].item_name, 'Relíquia Antiga');
    assert.strictEqual(inv.totalWeight, 1.5);

    db2.close();
  }

  // Limpar arquivo de teste
  try {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  } catch {}
});

test('Migração Segura e Idempotente - Banco legado sem coluna item_id', () => {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');

  // 1. Simular schema pré-Fase 2 (onde character_inventory NÃO possuía item_id)
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE characters (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Tabela de inventário SEM item_id como existia antes da Fase 2
    CREATE TABLE character_inventory (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      category TEXT DEFAULT 'geral',
      quantity INTEGER NOT NULL DEFAULT 1,
      weight REAL NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      is_equipped INTEGER NOT NULL DEFAULT 0,
      properties_json TEXT NOT NULL DEFAULT '{}'
    );
  `);

  // 2. Inserir dados legados de usuário, campanha, personagem e inventário antigo
  db.prepare(`INSERT INTO users (id, email, username, password_hash) VALUES (?, ?, ?, ?)`).run(
    'u-1', 'legado@rpg.com', 'LegadoUser', 'hash'
  );
  db.prepare(`INSERT INTO campaigns (id, name, owner_id) VALUES (?, ?, ?)`).run(
    'c-1', 'Campanha Legada', 'u-1'
  );
  db.prepare(`INSERT INTO characters (id, campaign_id, user_id, name) VALUES (?, ?, ?, ?)`).run(
    'char-1', 'c-1', 'u-1', 'Detetive Legado'
  );
  db.prepare(`
    INSERT INTO character_inventory (id, character_id, item_name, category, quantity, weight, cost, is_equipped)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('inv-1', 'char-1', 'Lanterna Velha', 'equipamento', 1, 1.0, 15, 1);

  // 3. Comprovar que consultar/inserir com item_id FALHA antes da migração
  assert.throws(() => {
    db.prepare('SELECT item_id FROM character_inventory').all();
  }, /no such column: item_id/);

  // 4. Executar initializeSchema e runMigrations (como o getDatabase faz na inicialização)
  initializeSchema(db);
  runMigrations(db);

  // 5. Validar que a coluna item_id foi criada na tabela existente
  const cols = db.prepare(`PRAGMA table_info(character_inventory)`).all() as any[];
  const hasItemId = cols.some((c: any) => c.name === 'item_id');
  assert.strictEqual(hasItemId, true, 'A coluna item_id deve existir após a migração');

  // 6. Validar que os dados legados existentes FORAM PRESERVADOS intactos
  const legacyRows = db.prepare(`SELECT * FROM character_inventory WHERE id = 'inv-1'`).all() as any[];
  assert.strictEqual(legacyRows.length, 1);
  assert.strictEqual(legacyRows[0].item_name, 'Lanterna Velha');
  assert.strictEqual(legacyRows[0].quantity, 1);
  assert.strictEqual(legacyRows[0].item_id, null, 'Itens pré-existentes devem ter item_id nulo');

  // 7. Validar que as novas operações com catálogo e inventário agora funcionam perfeitamente
  const invService = new InventoryService(db);
  const newItem = invService.createCatalogItem('c-1', {
    name: 'Revólver .38',
    category: 'arma',
    weight: 1.2,
    cost: 250,
    description: 'Arma de fogo padrão'
  });
  assert.strictEqual(newItem.name, 'Revólver .38');

  // Adicionar item do catálogo ao inventário do personagem legado
  const added = invService.addItemToCharacter('c-1', 'char-1', {
    itemId: newItem.id,
    quantity: 1
  });
  assert.strictEqual(added.item_id, newItem.id);
  assert.strictEqual(added.item_name, 'Revólver .38');

  // Consultar inventário completo
  const summary = invService.getCharacterInventory('c-1', 'char-1');
  assert.strictEqual(summary.items.length, 2); // Lanterna Velha + Revólver .38
  assert.strictEqual(summary.itemCount, 2);

  // 8. Testar IDEMPOTÊNCIA: Executar a migração novamente não causa erro nem duplica
  assert.doesNotThrow(() => {
    runMigrations(db);
  }, 'A migração deve ser estritamente idempotente');

  db.close();
});

