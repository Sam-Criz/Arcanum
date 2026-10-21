import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  Item,
  CreateItemDTO,
  UpdateItemDTO,
  CharacterInventoryItem,
  AddInventoryItemDTO,
  UpdateInventoryItemDTO,
  TransferItemDTO,
  ImbueWeaponDTO,
  DamageComponent,
  ImbueProperties,
  ActiveImbuedEffect,
  InventorySummary,
  InventoryTransferRecord,
  ItemRequest,
  CreateItemRequestDTO,
  ReviewItemRequestDTO
} from './inventory.types';
import { RulesService } from '../rules-engine/rules.service';
import { CharacterService } from '../characters/character.service';

export class InventoryService {
  constructor(
    private db: DatabaseSync,
    private rulesService?: RulesService,
    private characterService?: CharacterService
  ) {}

  // ==========================================
  // VALIDAÇÕES DE REGRAS E SEGURANÇA
  // ==========================================

  private validatePropertiesFormulas(campaignId: string, properties: Record<string, any>): void {
    if (!this.rulesService) return;

    // 1. Armas: fórmula de dano e ataque
    if (properties.dano && typeof properties.dano === 'string' && properties.dano.trim()) {
      const v = this.rulesService.validateFormula(campaignId, properties.dano.trim());
      if (!v.isValid) {
        throw new Error(`Fórmula de dano inválida: ${v.error}`);
      }
    }
    if (properties.damage_formula && typeof properties.damage_formula === 'string' && properties.damage_formula.trim()) {
      const v = this.rulesService.validateFormula(campaignId, properties.damage_formula.trim());
      if (!v.isValid) {
        throw new Error(`Fórmula de dano inválida: ${v.error}`);
      }
    }
    if (properties.ataque && typeof properties.ataque === 'string' && properties.ataque.trim()) {
      const v = this.rulesService.validateFormula(campaignId, properties.ataque.trim());
      if (!v.isValid) {
        throw new Error(`Fórmula de ataque inválida: ${v.error}`);
      }
    }
    if (properties.attack_formula && typeof properties.attack_formula === 'string' && properties.attack_formula.trim()) {
      const v = this.rulesService.validateFormula(campaignId, properties.attack_formula.trim());
      if (!v.isValid) {
        throw new Error(`Fórmula de ataque inválida: ${v.error}`);
      }
    }
    if (properties.dano_adicional && typeof properties.dano_adicional === 'string' && properties.dano_adicional.trim()) {
      const v = this.rulesService.validateFormula(campaignId, properties.dano_adicional.trim());
      if (!v.isValid) {
        throw new Error(`Fórmula de dano adicional inválida: ${v.error}`);
      }
    }

    // Componentes adicionais de dano
    if (Array.isArray(properties.damage_components)) {
      for (const comp of properties.damage_components) {
        if (comp.formula && typeof comp.formula === 'string' && comp.formula.trim()) {
          const v = this.rulesService.validateFormula(campaignId, comp.formula.trim());
          if (!v.isValid) {
            throw new Error(`Fórmula de dano adicional (${comp.name || comp.damage_type || 'componente'}) inválida: ${v.error}`);
          }
        }
      }
    }

    // Propriedades de imbuição
    if (properties.imbue_properties && typeof properties.imbue_properties === 'object') {
      if (properties.imbue_properties.damage_formula && typeof properties.imbue_properties.damage_formula === 'string' && properties.imbue_properties.damage_formula.trim()) {
        const v = this.rulesService.validateFormula(campaignId, properties.imbue_properties.damage_formula.trim());
        if (!v.isValid) {
          throw new Error(`Fórmula de dano da imbuição inválida: ${v.error}`);
        }
      }
    }

    // 2. Consumíveis: fórmula de recuperação de recurso
    if (properties.recuperacao_formula && typeof properties.recuperacao_formula === 'string' && properties.recuperacao_formula.trim()) {
      const v = this.rulesService.validateFormula(campaignId, properties.recuperacao_formula.trim());
      if (!v.isValid) {
        throw new Error(`Fórmula de recuperação inválida: ${v.error}`);
      }
    }

    // 3. Campos customizados com tipo fórmula
    if (Array.isArray(properties.custom_fields)) {
      for (const field of properties.custom_fields) {
        if (field.type === 'formula' && field.value && typeof field.value === 'string' && field.value.trim()) {
          const v = this.rulesService.validateFormula(campaignId, field.value.trim());
          if (!v.isValid) {
            throw new Error(`Fórmula no campo '${field.name || field.label || 'sem rótulo'}' inválida: ${v.error}`);
          }
        }
      }
    }
  }

  // ==========================================
  // CATÁLOGO DE ITENS DA CAMPANHA
  // ==========================================

  createCatalogItem(campaignId: string, data: CreateItemDTO): Item {
    if (!data.name || !data.name.trim()) {
      throw new Error('O nome do item é obrigatório.');
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const category = data.category?.trim() || 'geral';
    const weight = data.weight !== undefined ? Math.max(0, Number(data.weight)) : 0;
    const cost = data.cost !== undefined ? Math.max(0, Number(data.cost)) : 0;
    const acquisition_mode = (data.acquisition_mode === 'limited' || data.acquisition_mode === 'approval')
      ? data.acquisition_mode
      : 'free';
    const stock_quantity = acquisition_mode === 'limited'
      ? Math.max(0, Math.floor(Number(data.stock_quantity ?? 0)))
      : null;
    const properties = data.properties || {};

    this.validatePropertiesFormulas(campaignId, properties);

    this.db.prepare(`
      INSERT INTO items (id, campaign_id, name, description, category, weight, cost, acquisition_mode, stock_quantity, properties_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      campaignId,
      data.name.trim(),
      data.description?.trim() || '',
      category,
      weight,
      cost,
      acquisition_mode,
      stock_quantity,
      JSON.stringify(properties),
      now
    );

    return {
      id,
      campaign_id: campaignId,
      name: data.name.trim(),
      description: data.description?.trim() || '',
      category,
      weight,
      cost,
      acquisition_mode,
      stock_quantity,
      properties,
      created_at: now
    };
  }

  getCatalogItems(campaignId: string, category?: string, search?: string): Item[] {
    let sql = `SELECT * FROM items WHERE campaign_id = ?`;
    const params: any[] = [campaignId];

    if (category && category !== 'todos') {
      sql += ` AND LOWER(category) = LOWER(?)`;
      params.push(category.trim());
    }

    if (search && search.trim()) {
      sql += ` AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ?)`;
      const term = `%${search.trim().toLowerCase()}%`;
      params.push(term, term);
    }

    sql += ` ORDER BY name ASC`;

    const rows = this.db.prepare(sql).all(...params) as any[];

    return rows.map(r => ({
      id: r.id,
      campaign_id: r.campaign_id,
      name: r.name,
      description: r.description,
      category: r.category,
      weight: r.weight,
      cost: r.cost,
      acquisition_mode: r.acquisition_mode || 'free',
      stock_quantity: r.stock_quantity !== null && r.stock_quantity !== undefined ? Number(r.stock_quantity) : null,
      properties: JSON.parse(r.properties_json || '{}'),
      created_at: r.created_at
    }));
  }

  getCatalogItemById(campaignId: string, itemId: string): Item | null {
    const row = this.db.prepare(`
      SELECT * FROM items WHERE campaign_id = ? AND id = ?
    `).get(campaignId, itemId) as any;

    if (!row) return null;

    return {
      id: row.id,
      campaign_id: row.campaign_id,
      name: row.name,
      description: row.description,
      category: row.category,
      weight: row.weight,
      cost: row.cost,
      acquisition_mode: row.acquisition_mode || 'free',
      stock_quantity: row.stock_quantity !== null && row.stock_quantity !== undefined ? Number(row.stock_quantity) : null,
      properties: JSON.parse(row.properties_json || '{}'),
      created_at: row.created_at
    };
  }

  updateCatalogItem(campaignId: string, itemId: string, data: UpdateItemDTO): Item {
    const existing = this.getCatalogItemById(campaignId, itemId);
    if (!existing) {
      throw new Error('Item não encontrado no catálogo desta campanha.');
    }

    const name = data.name !== undefined ? data.name.trim() : existing.name;
    const description = data.description !== undefined ? data.description.trim() : existing.description;
    const category = data.category !== undefined ? data.category.trim() : existing.category;
    const weight = data.weight !== undefined ? Math.max(0, Number(data.weight)) : existing.weight;
    const cost = data.cost !== undefined ? Math.max(0, Number(data.cost)) : existing.cost;
    const acquisition_mode = data.acquisition_mode !== undefined
      ? (data.acquisition_mode === 'limited' || data.acquisition_mode === 'approval' ? data.acquisition_mode : 'free')
      : existing.acquisition_mode;
    const stock_quantity = acquisition_mode === 'limited'
      ? (data.stock_quantity !== undefined ? Math.max(0, Math.floor(Number(data.stock_quantity ?? 0))) : existing.stock_quantity)
      : null;
    const properties = data.properties !== undefined ? data.properties : existing.properties;

    if (data.properties) {
      this.validatePropertiesFormulas(campaignId, properties);
    }

    this.db.prepare(`
      UPDATE items
      SET name = ?, description = ?, category = ?, weight = ?, cost = ?, acquisition_mode = ?, stock_quantity = ?, properties_json = ?
      WHERE id = ? AND campaign_id = ?
    `).run(name, description, category, weight, cost, acquisition_mode, stock_quantity, JSON.stringify(properties), itemId, campaignId);

    return {
      ...existing,
      name,
      description,
      category,
      weight,
      cost,
      acquisition_mode,
      stock_quantity,
      properties
    };
  }

  deleteCatalogItem(campaignId: string, itemId: string): void {
    this.db.prepare(`
      DELETE FROM items WHERE id = ? AND campaign_id = ?
    `).run(itemId, campaignId);
  }

  // ==========================================
  // INVENTÁRIO DO PERSONAGEM
  // ==========================================

  getCharacterInventory(campaignId: string, characterId: string): InventorySummary {
    // Validar se o personagem pertence à campanha
    const char = this.db.prepare(`
      SELECT id FROM characters WHERE id = ? AND campaign_id = ?
    `).get(characterId, campaignId);

    if (!char) {
      throw new Error('Personagem não encontrado nesta campanha.');
    }

    const rows = this.db.prepare(`
      SELECT * FROM character_inventory
      WHERE character_id = ?
      ORDER BY is_equipped DESC, item_name ASC
    `).all(characterId) as any[];

    const items: CharacterInventoryItem[] = rows.map(r => ({
      id: r.id,
      character_id: r.character_id,
      item_id: r.item_id,
      item_name: r.item_name,
      category: r.category,
      quantity: r.quantity,
      weight: r.weight,
      cost: r.cost,
      is_equipped: r.is_equipped,
      properties: JSON.parse(r.properties_json || '{}')
    }));

    let totalWeight = 0;
    let totalCost = 0;
    let equippedCount = 0;

    for (const item of items) {
      totalWeight += item.weight * item.quantity;
      totalCost += item.cost * item.quantity;
      if (item.is_equipped) equippedCount++;
    }

    return {
      items,
      totalWeight: Math.round(totalWeight * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      equippedCount,
      itemCount: items.reduce((acc, it) => acc + it.quantity, 0)
    };
  }

  addItemToCharacter(
    campaignId: string,
    characterId: string,
    data: AddInventoryItemDTO,
    isMaster: boolean = false
  ): CharacterInventoryItem {
    // Valida pertinência do personagem à campanha
    const char = this.db.prepare(`
      SELECT id FROM characters WHERE id = ? AND campaign_id = ?
    `).get(characterId, campaignId);

    if (!char) {
      throw new Error('Personagem não encontrado nesta campanha.');
    }

    const rawQuantity = data.quantity !== undefined ? Number(data.quantity) : 1;
    const quantity = Math.floor(rawQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      throw new Error('A quantidade deve ser um número inteiro positivo maior que zero.');
    }

    let itemName = data.itemName?.trim();
    let category = data.category?.trim() || 'geral';
    let weight = data.weight !== undefined ? Math.max(0, Number(data.weight)) : 0;
    let cost = data.cost !== undefined ? Math.max(0, Number(data.cost)) : 0;
    let properties = data.properties || {};
    let itemId = data.itemId || null;

    if (!itemId) {
      // Criação de item customizado sem catálogo
      if (!isMaster) {
        throw new Error('Apenas o mestre pode conceder itens customizados sem modelo no catálogo da campanha.');
      }
    } else {
      // Obtenção a partir do catálogo oficial da campanha
      const catalogItem = this.getCatalogItemById(campaignId, itemId);
      if (!catalogItem) {
        throw new Error('Item do catálogo não encontrado para esta campanha.');
      }

      // Regra 1: Itens que exigem aprovação não podem ser pegos diretamente por jogadores
      if (catalogItem.acquisition_mode === 'approval' && !isMaster) {
        throw new Error('Este item exige aprovação do mestre para ser obtido. Envie uma solicitação.');
      }

      // Regra 2: Itens com estoque limitado decrementam atomicamente
      if (catalogItem.acquisition_mode === 'limited') {
        const updateRes = this.db.prepare(`
          UPDATE items
          SET stock_quantity = stock_quantity - ?
          WHERE id = ? AND campaign_id = ? AND stock_quantity >= ?
        `).run(quantity, catalogItem.id, campaignId, quantity);

        if (updateRes.changes === 0) {
          const fresh = this.getCatalogItemById(campaignId, catalogItem.id);
          throw new Error(`Estoque insuficiente no catálogo da campanha (Disponível: ${fresh?.stock_quantity ?? 0}, Solicitado: ${quantity}).`);
        }
      }

      itemName = catalogItem.name;
      category = catalogItem.category;
      weight = catalogItem.weight;
      cost = catalogItem.cost;
      properties = { ...catalogItem.properties, ...properties };
    }

    if (!itemName) {
      throw new Error('O nome do item é obrigatório.');
    }

    // Inicialização de instâncias de recursos se aplicável
    if (category === 'arma' && properties.capacidade_municao !== undefined && properties.municao_atual === undefined) {
      properties.municao_atual = properties.capacidade_municao;
    }
    if (category === 'tecnologico' && properties.bateria_max !== undefined && properties.bateria_atual === undefined) {
      properties.bateria_atual = properties.bateria_max;
    }
    if (category === 'ocultista' && properties.pontos_alma_max !== undefined && properties.pontos_alma_atual === undefined) {
      properties.pontos_alma_atual = properties.pontos_alma_max;
    }
    if (category === 'consumivel' && properties.cargas_max !== undefined && properties.cargas_atual === undefined) {
      properties.cargas_atual = properties.cargas_max;
    }

    // Verificar se o personagem já possui esse item no inventário (mesmo itemId ou mesmo nome e categoria)
    const existing = this.db.prepare(`
      SELECT id, quantity, properties_json FROM character_inventory 
      WHERE character_id = ? AND (
        (item_id IS NOT NULL AND item_id = ?) OR 
        (LOWER(item_name) = LOWER(?) AND LOWER(category) = LOWER(?))
      )
    `).get(characterId, itemId, itemName, category) as any;

    if (existing) {
      const newQuantity = existing.quantity + quantity;
      const existingProps = JSON.parse(existing.properties_json || '{}');
      const mergedProps = { ...properties, ...existingProps };

      this.db.prepare(`
        UPDATE character_inventory SET quantity = ?, properties_json = ? WHERE id = ?
      `).run(newQuantity, JSON.stringify(mergedProps), existing.id);

      this.characterService?.recomputeCharacter(campaignId, characterId);

      return {
        id: existing.id,
        character_id: characterId,
        item_id: itemId,
        item_name: itemName,
        category,
        quantity: newQuantity,
        weight,
        cost,
        is_equipped: 0,
        properties: mergedProps
      };
    }

    const id = crypto.randomUUID();
    const isEquipped = data.isEquipped ? 1 : 0;

    this.db.prepare(`
      INSERT INTO character_inventory (id, character_id, item_id, item_name, category, quantity, weight, cost, is_equipped, properties_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, characterId, itemId, itemName, category, quantity, weight, cost, isEquipped, JSON.stringify(properties));

    this.characterService?.recomputeCharacter(campaignId, characterId);

    return {
      id,
      character_id: characterId,
      item_id: itemId,
      item_name: itemName,
      category,
      quantity,
      weight,
      cost,
      is_equipped: isEquipped,
      properties
    };
  }

  updateCharacterInventoryItem(
    campaignId: string,
    characterId: string,
    inventoryItemId: string,
    data: UpdateInventoryItemDTO
  ): CharacterInventoryItem {
    const existing = this.db.prepare(`
      SELECT ci.* FROM character_inventory ci
      INNER JOIN characters c ON c.id = ci.character_id
      WHERE ci.id = ? AND ci.character_id = ? AND c.campaign_id = ?
    `).get(inventoryItemId, characterId, campaignId) as any;

    if (!existing) {
      throw new Error('Item de inventário não encontrado neste personagem.');
    }

    const quantity = data.quantity !== undefined ? Math.max(0, Math.floor(Number(data.quantity))) : existing.quantity;

    if (quantity === 0) {
      // Quantidade zero remove o item do inventário
      this.db.prepare(`DELETE FROM character_inventory WHERE id = ?`).run(inventoryItemId);
      this.characterService?.recomputeCharacter(campaignId, characterId);
      return {
        id: inventoryItemId,
        character_id: characterId,
        item_id: existing.item_id,
        item_name: existing.item_name,
        category: existing.category,
        quantity: 0,
        weight: existing.weight,
        cost: existing.cost,
        is_equipped: 0,
        properties: JSON.parse(existing.properties_json || '{}')
      };
    }

    const isEquipped = data.isEquipped !== undefined ? (data.isEquipped ? 1 : 0) : existing.is_equipped;
    const properties = data.properties !== undefined ? data.properties : JSON.parse(existing.properties_json || '{}');

    this.db.prepare(`
      UPDATE character_inventory
      SET quantity = ?, is_equipped = ?, properties_json = ?
      WHERE id = ?
    `).run(quantity, isEquipped, JSON.stringify(properties), inventoryItemId);

    this.characterService?.recomputeCharacter(campaignId, characterId);

    return {
      id: inventoryItemId,
      character_id: characterId,
      item_id: existing.item_id,
      item_name: existing.item_name,
      category: existing.category,
      quantity,
      weight: existing.weight,
      cost: existing.cost,
      is_equipped: isEquipped,
      properties
    };
  }

  removeCharacterInventoryItem(campaignId: string, characterId: string, inventoryItemId: string): void {
    const res = this.db.prepare(`
      DELETE FROM character_inventory
      WHERE id = ? AND character_id = (
        SELECT id FROM characters WHERE id = ? AND campaign_id = ?
      )
    `).run(inventoryItemId, characterId, campaignId);

    if (res.changes === 0) {
      throw new Error('Item não encontrado para remoção.');
    }

    this.characterService?.recomputeCharacter(campaignId, characterId);
  }

  // ==========================================
  // TRANSFERÊNCIAS ATÔMICAS ENTRE PERSONAGENS
  // ==========================================

  transferItem(
    campaignId: string,
    fromCharacterId: string,
    data: TransferItemDTO,
    requesterUserId: string,
    isMaster: boolean
  ): { success: boolean; transferred: { itemName: string; quantity: number; fromName: string; toName: string } } {
    const qtyToTransfer = Math.floor(Number(data.quantity));
    if (isNaN(qtyToTransfer) || qtyToTransfer <= 0) {
      throw new Error('A quantidade a transferir deve ser um número inteiro positivo maior que zero.');
    }

    if (fromCharacterId === data.targetCharacterId) {
      throw new Error('Não é possível transferir um item para o mesmo personagem.');
    }

    // 1. Validar personagem de origem e permissão do usuário
    const fromChar = this.db.prepare(`
      SELECT id, name, user_id FROM characters WHERE id = ? AND campaign_id = ?
    `).get(fromCharacterId, campaignId) as any;

    if (!fromChar) {
      throw new Error('Personagem de origem não encontrado nesta campanha.');
    }

    if (fromChar.user_id !== requesterUserId && !isMaster) {
      throw new Error('Você só pode transferir itens de seus próprios personagens.');
    }

    // 2. Validar personagem de destino (deve pertencer à MESMA campanha)
    const toChar = this.db.prepare(`
      SELECT id, name FROM characters WHERE id = ? AND campaign_id = ?
    `).get(data.targetCharacterId, campaignId) as any;

    if (!toChar) {
      throw new Error('Personagem de destino não encontrado nesta campanha.');
    }

    // 3. Buscar o item no inventário de origem
    const sourceItem = this.db.prepare(`
      SELECT * FROM character_inventory WHERE id = ? AND character_id = ?
    `).get(data.inventoryItemId, fromCharacterId) as any;

    if (!sourceItem) {
      throw new Error('Item não encontrado no inventário do personagem de origem.');
    }

    if (sourceItem.quantity < qtyToTransfer) {
      throw new Error(`Quantidade insuficiente. O personagem possui apenas ${sourceItem.quantity} unidade(s).`);
    }

    // 4. Execução transacional atômica
    this.db.exec('BEGIN TRANSACTION;');
    try {
      // Subtrai do personagem de origem
      const remainingQty = sourceItem.quantity - qtyToTransfer;
      if (remainingQty === 0) {
        this.db.prepare(`DELETE FROM character_inventory WHERE id = ?`).run(sourceItem.id);
      } else {
        this.db.prepare(`UPDATE character_inventory SET quantity = ? WHERE id = ?`).run(remainingQty, sourceItem.id);
      }

      // Adiciona ao personagem de destino (agrega se já possui o mesmo item)
      const existingInTarget = this.db.prepare(`
        SELECT id, quantity FROM character_inventory
        WHERE character_id = ? AND (
          (item_id IS NOT NULL AND item_id = ?) OR
          (LOWER(item_name) = LOWER(?) AND LOWER(category) = LOWER(?))
        )
      `).get(toChar.id, sourceItem.item_id, sourceItem.item_name, sourceItem.category) as any;

      if (existingInTarget) {
        this.db.prepare(`
          UPDATE character_inventory SET quantity = quantity + ? WHERE id = ?
        `).run(qtyToTransfer, existingInTarget.id);
      } else {
        const newInvId = crypto.randomUUID();
        this.db.prepare(`
          INSERT INTO character_inventory (id, character_id, item_id, item_name, category, quantity, weight, cost, is_equipped, properties_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
        `).run(
          newInvId,
          toChar.id,
          sourceItem.item_id,
          sourceItem.item_name,
          sourceItem.category,
          qtyToTransfer,
          sourceItem.weight,
          sourceItem.cost,
          sourceItem.properties_json || '{}'
        );
      }

      // Registro de auditoria da transferência
      const transferId = crypto.randomUUID();
      this.db.prepare(`
        INSERT INTO inventory_transfers (id, campaign_id, from_character_id, to_character_id, item_name, quantity, transferred_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(transferId, campaignId, fromChar.id, toChar.id, sourceItem.item_name, qtyToTransfer, requesterUserId);

      this.db.exec('COMMIT;');

      this.characterService?.recomputeCharacter(campaignId, fromChar.id);
      this.characterService?.recomputeCharacter(campaignId, toChar.id);

      return {
        success: true,
        transferred: {
          itemName: sourceItem.item_name,
          quantity: qtyToTransfer,
          fromName: fromChar.name,
          toName: toChar.name
        }
      };
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  getTransferHistory(campaignId: string, limit = 50): InventoryTransferRecord[] {
    const rows = this.db.prepare(`
      SELECT 
        it.*,
        fc.name as from_character_name,
        tc.name as to_character_name,
        u.username as transferred_by_username
      FROM inventory_transfers it
      INNER JOIN characters fc ON fc.id = it.from_character_id
      INNER JOIN characters tc ON tc.id = it.to_character_id
      INNER JOIN users u ON u.id = it.transferred_by_user_id
      WHERE it.campaign_id = ?
      ORDER BY it.created_at DESC
      LIMIT ?
    `).all(campaignId, limit) as any[];

    return rows.map(r => ({
      id: r.id,
      campaign_id: r.campaign_id,
      from_character_id: r.from_character_id,
      to_character_id: r.to_character_id,
      from_character_name: r.from_character_name,
      to_character_name: r.to_character_name,
      item_name: r.item_name,
      quantity: r.quantity,
      transferred_by_user_id: r.transferred_by_user_id,
      transferred_by_username: r.transferred_by_username,
      created_at: r.created_at
    }));
  }

  // ==========================================
  // USO MECÂNICO DE ITENS & RECURSOS
  // ==========================================

  useInventoryItem(
    campaignId: string,
    characterId: string,
    inventoryItemId: string,
    requesterUserId: string,
    isMaster: boolean
  ): {
    success: boolean;
    item: CharacterInventoryItem | null;
    character?: any;
    message: string;
    rollResult?: any;
  } {
    const char = this.db.prepare(`
      SELECT * FROM characters WHERE id = ? AND campaign_id = ?
    `).get(characterId, campaignId) as any;

    if (!char) {
      throw new Error('Personagem não encontrado nesta campanha.');
    }

    if (char.user_id !== requesterUserId && !isMaster) {
      throw new Error('Você só pode utilizar itens do seu próprio personagem.');
    }

    const invRow = this.db.prepare(`
      SELECT * FROM character_inventory WHERE id = ? AND character_id = ?
    `).get(inventoryItemId, characterId) as any;

    if (!invRow) {
      throw new Error('Item não encontrado no inventário do personagem.');
    }

    const props = JSON.parse(invRow.properties_json || '{}');
    const category = invRow.category;
    let message = '';
    let rollResult: any = undefined;
    let updatedChar: any = undefined;
    let itemRemoved = false;

    if (category === 'arma') {
      if (props.capacidade_municao !== undefined) {
        const currentAmmo = Number(props.municao_atual ?? props.capacidade_municao);
        if (currentAmmo <= 0) {
          throw new Error('Arma sem munição! Recarregue antes de disparar.');
        }
        props.municao_atual = currentAmmo - 1;
        message = `Disparou 1 tiro de ${invRow.item_name}. Munição restante: ${props.municao_atual}/${props.capacidade_municao}.`;
      } else {
        message = `Utilizou a arma ${invRow.item_name}.`;
      }
      if (props.dano && this.rulesService) {
        rollResult = this.rulesService.evaluateFormula(campaignId, props.dano, JSON.parse(char.computed_data_json || '{}'));
      }
    } else if (category === 'tecnologico') {
      const consumption = Math.max(1, Number(props.consumo_por_uso ?? 1));
      const currentBattery = Number(props.bateria_atual ?? props.bateria_max ?? 0);
      if (currentBattery < consumption) {
        throw new Error(`Bateria insuficiente (${currentBattery}/${props.bateria_max ?? 0}). Necessário: ${consumption}.`);
      }
      props.bateria_atual = currentBattery - consumption;
      message = `Ativou ${invRow.item_name} consumindo ${consumption} carga(s). Bateria restante: ${props.bateria_atual}/${props.bateria_max}.`;
    } else if (category === 'ocultista') {
      const cost = Math.max(1, Number(props.custo_ativacao ?? 1));
      const currentSoul = Number(props.pontos_alma_atual ?? props.pontos_alma_max ?? 0);
      if (currentSoul < cost) {
        throw new Error(`Pontos de alma insuficientes (${currentSoul}/${props.pontos_alma_max ?? 0}). Necessário: ${cost}.`);
      }
      props.pontos_alma_atual = currentSoul - cost;
      message = `Canalizou ${invRow.item_name} consumindo ${cost} ponto(s) de alma. Restante: ${props.pontos_alma_atual}/${props.pontos_alma_max}.`;
    } else if (category === 'consumivel') {
      if (props.cargas_max !== undefined && Number(props.cargas_atual ?? props.cargas_max) > 1) {
        props.cargas_atual = Number(props.cargas_atual ?? props.cargas_max) - 1;
        message = `Consumiu 1 carga de ${invRow.item_name}. Cargas restantes: ${props.cargas_atual}/${props.cargas_max}.`;
      } else {
        const remainingQty = invRow.quantity - 1;
        if (remainingQty <= 0) {
          this.db.prepare(`DELETE FROM character_inventory WHERE id = ?`).run(invRow.id);
          itemRemoved = true;
          message = `Consumiu a última unidade de ${invRow.item_name}.`;
        } else {
          invRow.quantity = remainingQty;
          if (props.cargas_max !== undefined) {
            props.cargas_atual = props.cargas_max;
          }
          message = `Consumiu 1 unidade de ${invRow.item_name}. Restam ${remainingQty}.`;
        }
      }

      // Efeito de recuperação se configurado
      if (props.recuperacao_atributo && props.recuperacao_formula && this.rulesService && this.characterService) {
        const rawData = JSON.parse(char.raw_data_json || '{}');
        const computed = JSON.parse(char.computed_data_json || '{}');
        const roll = this.rulesService.evaluateFormula(campaignId, props.recuperacao_formula, computed);
        rollResult = roll;

        const targetAttr = props.recuperacao_atributo.trim();
        const attrKey = (rawData[`${targetAttr}_atual`] !== undefined || computed[`${targetAttr}_atual`] !== undefined)
          ? `${targetAttr}_atual`
          : targetAttr;

        const currentVal = Number(rawData[attrKey] ?? computed[attrKey] ?? 0);
        const maxVal = Number(computed[`${targetAttr}_max`] ?? Infinity);
        const newVal = Math.min(maxVal, currentVal + roll.total);
        rawData[attrKey] = newVal;

        updatedChar = this.characterService.updateCharacter(
          campaignId,
          characterId,
          { rawData },
          requesterUserId,
          isMaster
        );
        message += ` Recuperou +${roll.total} em ${targetAttr}! (Novo valor: ${newVal})`;
      }
    } else {
      message = `Item ${invRow.item_name} acionado com sucesso.`;
    }

    let returnedItem: CharacterInventoryItem | null = null;
    if (!itemRemoved) {
      this.db.prepare(`
        UPDATE character_inventory
        SET quantity = ?, properties_json = ?
        WHERE id = ?
      `).run(invRow.quantity, JSON.stringify(props), invRow.id);

      returnedItem = {
        id: invRow.id,
        character_id: characterId,
        item_id: invRow.item_id,
        item_name: invRow.item_name,
        category: invRow.category,
        quantity: invRow.quantity,
        weight: invRow.weight,
        cost: invRow.cost,
        is_equipped: invRow.is_equipped,
        properties: props
      };
    }

    const freshChar = this.characterService?.recomputeCharacter(campaignId, characterId) || updatedChar;

    return {
      success: true,
      item: returnedItem,
      character: freshChar,
      message,
      rollResult
    };
  }

  // ==========================================
  // IMBUIÇÃO DE ARMAS COM CONSUMÍVEIS
  // ==========================================

  imbueWeapon(
    campaignId: string,
    characterId: string,
    data: ImbueWeaponDTO,
    requesterUserId: string,
    isMaster: boolean
  ): {
    success: boolean;
    weapon: CharacterInventoryItem;
    consumedItem: CharacterInventoryItem | null;
    character?: any;
    imbuedEffect: ActiveImbuedEffect;
    message: string;
  } {
    const char = this.db.prepare(`
      SELECT * FROM characters WHERE id = ? AND campaign_id = ?
    `).get(characterId, campaignId) as any;

    if (!char) {
      throw new Error('Personagem não encontrado nesta campanha.');
    }

    if (char.user_id !== requesterUserId && !isMaster) {
      throw new Error('Você só pode imbuir armas do seu próprio personagem.');
    }

    if (!data.consumableInventoryId || !data.weaponInventoryId) {
      throw new Error('Identificadores do consumível e da arma são obrigatórios.');
    }

    if (data.consumableInventoryId === data.weaponInventoryId) {
      throw new Error('Um item não pode ser usado para imbuir a si mesmo.');
    }

    // 1. Obter consumível
    const consumableRow = this.db.prepare(`
      SELECT * FROM character_inventory WHERE id = ? AND character_id = ?
    `).get(data.consumableInventoryId, characterId) as any;

    if (!consumableRow) {
      throw new Error('Item consumível não encontrado no inventário do personagem.');
    }

    if (consumableRow.quantity <= 0) {
      throw new Error('Quantidade insuficiente do consumível para imbuir arma.');
    }

    const consumableProps = JSON.parse(consumableRow.properties_json || '{}');

    // 2. Obter arma
    const weaponRow = this.db.prepare(`
      SELECT * FROM character_inventory WHERE id = ? AND character_id = ?
    `).get(data.weaponInventoryId, characterId) as any;

    if (!weaponRow) {
      throw new Error('Arma não encontrada no inventário do personagem.');
    }

    const weaponCategory = (weaponRow.category || '').toLowerCase();
    const isWeaponLike = weaponCategory.includes('arma') || weaponCategory === 'weapon';
    const weaponProps = JSON.parse(weaponRow.properties_json || '{}');

    // 3. Extrair e validar configurações de imbuição do consumível
    const imbueProps: Partial<ImbueProperties> = consumableProps.imbue_properties || {};
    const canImbue = consumableProps.can_imbue === true ||
      imbueProps.can_imbue === true ||
      !!consumableProps.tipo_dano_imbuicao ||
      !!consumableProps.dano_adicional_imbuicao ||
      (consumableRow.category === 'consumivel' && (!!consumableProps.tipo_dano || !!consumableProps.dano_adicional || !!consumableProps.condicao_aplicada));

    if (!canImbue) {
      throw new Error(`O item '${consumableRow.item_name}' não pode ser utilizado para imbuir armas.`);
    }

    const compatibleCategories: string[] = imbueProps.compatible_categories ||
      consumableProps.compatible_categories ||
      ['arma'];

    const isCompatible = compatibleCategories.some(cat => {
      const c = cat.toLowerCase();
      if (c === 'arma' || c === 'weapon') return isWeaponLike;
      return weaponCategory === c;
    });

    if (!isCompatible) {
      throw new Error(`A arma '${weaponRow.item_name}' (${weaponRow.category}) não é compatível com este consumível. Categorias compatíveis: ${compatibleCategories.join(', ')}.`);
    }

    const damageType = imbueProps.damage_type ||
      consumableProps.tipo_dano_imbuicao ||
      consumableProps.tipo_dano ||
      consumableProps.damage_type ||
      'magico';

    const damageFormula = imbueProps.damage_formula ||
      consumableProps.dano_adicional_imbuicao ||
      consumableProps.dano_adicional ||
      consumableProps.damage_formula ||
      undefined;

    const percentageDamage = imbueProps.percentage_damage !== undefined
      ? Number(imbueProps.percentage_damage)
      : (consumableProps.percentage_damage !== undefined ? Number(consumableProps.percentage_damage) : undefined);

    const percentageDamageTarget = imbueProps.percentage_damage_target ||
      consumableProps.percentage_damage_target ||
      'max_hp';

    let rawChance = imbueProps.chance_percent !== undefined
      ? imbueProps.chance_percent
      : (consumableProps.chance_percent !== undefined ? consumableProps.chance_percent : 100);
    let parsedChance = Number(String(rawChance).replace('%', ''));
    if (isNaN(parsedChance)) parsedChance = 100;
    else if (parsedChance > 0 && parsedChance <= 1) parsedChance = Math.round(parsedChance * 100);
    else if (parsedChance >= 100) parsedChance = 100;
    else if (parsedChance < 0) parsedChance = 0;
    const chancePercent = parsedChance;

    const applyConditions: any[] = [];
    if (Array.isArray(imbueProps.apply_conditions)) {
      applyConditions.push(...imbueProps.apply_conditions);
    } else if (imbueProps.apply_conditions) {
      applyConditions.push(imbueProps.apply_conditions);
    }
    if (imbueProps.condition) {
      applyConditions.push(imbueProps.condition);
    }
    if (imbueProps.conditions) {
      if (Array.isArray(imbueProps.conditions)) applyConditions.push(...imbueProps.conditions);
      else applyConditions.push(imbueProps.conditions);
    }
    if (Array.isArray(consumableProps.apply_conditions)) {
      applyConditions.push(...consumableProps.apply_conditions);
    } else if (consumableProps.apply_conditions) {
      applyConditions.push(consumableProps.apply_conditions);
    }
    if (consumableProps.condition) {
      applyConditions.push(consumableProps.condition);
    }
    if (consumableProps.conditions) {
      if (Array.isArray(consumableProps.conditions)) applyConditions.push(...consumableProps.conditions);
      else applyConditions.push(consumableProps.conditions);
    }
    if (consumableProps.condicao_aplicada) {
      applyConditions.push(consumableProps.condicao_aplicada);
    }

    const durationType = imbueProps.duration_type ||
      consumableProps.duration_type ||
      (consumableProps.cargas_imbuicao || imbueProps.charges ? 'hits' : 'turns');

    const charges = imbueProps.charges !== undefined
      ? Number(imbueProps.charges)
      : (consumableProps.cargas_imbuicao !== undefined ? Number(consumableProps.cargas_imbuicao) : (consumableProps.charges !== undefined ? Number(consumableProps.charges) : 3));

    const maxCharges = imbueProps.max_charges !== undefined
      ? Number(imbueProps.max_charges)
      : charges;

    const durationValue = imbueProps.duration_value !== undefined
      ? Number(imbueProps.duration_value)
      : (consumableProps.duration_value !== undefined ? Number(consumableProps.duration_value) : (durationType === 'turns' || durationType === 'rounds' ? 3 : undefined));

    const combineBehavior = imbueProps.combine_behavior ||
      consumableProps.combine_behavior ||
      'replace';

    // 4. Regras de acúmulo / combinação com efeitos já ativos
    let existingEffects: ActiveImbuedEffect[] = Array.isArray(weaponProps.imbued_effects)
      ? [...weaponProps.imbued_effects]
      : [];

    if (combineBehavior === 'reject' && existingEffects.length > 0) {
      throw new Error(`A arma '${weaponRow.item_name}' já possui encantamento ativo e não permite novos efeitos.`);
    }

    const newEffectId = crypto.randomUUID();
    const activeEffect: ActiveImbuedEffect = {
      id: newEffectId,
      source_item_id: consumableRow.item_id || consumableRow.id,
      source_item_name: consumableRow.item_name,
      damage_type: damageType,
      damage_formula: damageFormula,
      percentage_damage: percentageDamage,
      percentage_damage_target: percentageDamageTarget,
      chance_percent: chancePercent,
      apply_conditions: applyConditions,
      duration_type: durationType as any,
      charges_remaining: durationType === 'hits' || durationType === 'attacks' ? charges : undefined,
      max_charges: durationType === 'hits' || durationType === 'attacks' ? maxCharges : undefined,
      duration_remaining: durationType === 'turns' || durationType === 'rounds' ? durationValue : undefined,
      combine_behavior: combineBehavior as any,
      created_at: new Date().toISOString()
    };

    if (combineBehavior === 'replace') {
      existingEffects = [activeEffect];
    } else {
      existingEffects.push(activeEffect);
    }
    weaponProps.imbued_effects = existingEffects;

    // 5. Persistência atômica
    let consumedItem: CharacterInventoryItem | null = null;
    this.db.exec('BEGIN TRANSACTION;');
    try {
      // Consumir 1 carga ou 1 unidade do consumível
      if (consumableProps.cargas_max !== undefined && Number(consumableProps.cargas_atual ?? consumableProps.cargas_max) > 1) {
        consumableProps.cargas_atual = Number(consumableProps.cargas_atual ?? consumableProps.cargas_max) - 1;
        this.db.prepare(`
          UPDATE character_inventory SET properties_json = ? WHERE id = ?
        `).run(JSON.stringify(consumableProps), consumableRow.id);

        consumedItem = {
          id: consumableRow.id,
          character_id: characterId,
          item_id: consumableRow.item_id,
          item_name: consumableRow.item_name,
          category: consumableRow.category,
          quantity: consumableRow.quantity,
          weight: consumableRow.weight,
          cost: consumableRow.cost,
          is_equipped: consumableRow.is_equipped,
          properties: consumableProps
        };
      } else {
        const remainingQty = consumableRow.quantity - 1;
        if (remainingQty <= 0) {
          this.db.prepare(`DELETE FROM character_inventory WHERE id = ?`).run(consumableRow.id);
          consumedItem = null;
        } else {
          this.db.prepare(`
            UPDATE character_inventory SET quantity = ? WHERE id = ?
          `).run(remainingQty, consumableRow.id);

          consumedItem = {
            id: consumableRow.id,
            character_id: characterId,
            item_id: consumableRow.item_id,
            item_name: consumableRow.item_name,
            category: consumableRow.category,
            quantity: remainingQty,
            weight: consumableRow.weight,
            cost: consumableRow.cost,
            is_equipped: consumableRow.is_equipped,
            properties: consumableProps
          };
        }
      }

      // Atualizar a arma com os efeitos imbuídos
      this.db.prepare(`
        UPDATE character_inventory SET properties_json = ? WHERE id = ?
      `).run(JSON.stringify(weaponProps), weaponRow.id);

      this.db.exec('COMMIT;');
    } catch (dbErr) {
      this.db.exec('ROLLBACK;');
      throw dbErr;
    }

    const updatedWeapon: CharacterInventoryItem = {
      id: weaponRow.id,
      character_id: characterId,
      item_id: weaponRow.item_id,
      item_name: weaponRow.item_name,
      category: weaponRow.category,
      quantity: weaponRow.quantity,
      weight: weaponRow.weight,
      cost: weaponRow.cost,
      is_equipped: weaponRow.is_equipped,
      properties: weaponProps
    };

    const freshChar = this.characterService?.recomputeCharacter(campaignId, characterId);

    const effectSummary = [
      damageType ? `tipo: ${damageType}` : '',
      damageFormula ? `+${damageFormula}` : '',
      percentageDamage !== undefined ? `+${percentageDamage}% vida` : '',
      chancePercent < 100 ? `${chancePercent}% chance` : '',
      durationType === 'hits' ? `${charges} acerto(s)` : durationType === 'attacks' ? `${charges} ataque(s)` : `${durationValue} ${durationType}`
    ].filter(Boolean).join(', ');

    return {
      success: true,
      weapon: updatedWeapon,
      consumedItem,
      character: freshChar,
      imbuedEffect: activeEffect,
      message: `A arma '${weaponRow.item_name}' foi imbuída com sucesso usando '${consumableRow.item_name}' (${effectSummary})!`
    };
  }

  // ==========================================
  // SOLICITAÇÕES DE ITENS DO CATÁLOGO
  // ==========================================

  createItemRequest(campaignId: string, userId: string, data: CreateItemRequestDTO): ItemRequest {
    const char = this.db.prepare(`
      SELECT id, name, user_id FROM characters WHERE id = ? AND campaign_id = ?
    `).get(data.characterId, campaignId) as any;

    if (!char) {
      throw new Error('Personagem não encontrado nesta campanha.');
    }

    if (char.user_id !== userId) {
      throw new Error('Você só pode solicitar itens para personagens sob seu controle.');
    }

    const item = this.getCatalogItemById(campaignId, data.itemId);
    if (!item) {
      throw new Error('Item do catálogo não encontrado nesta campanha.');
    }

    const quantity = Math.max(1, Math.floor(Number(data.quantity || 1)));

    if (item.acquisition_mode === 'limited' && item.stock_quantity !== null && item.stock_quantity < quantity) {
      throw new Error(`Estoque insuficiente no catálogo da campanha (Disponível: ${item.stock_quantity}).`);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO item_requests (id, campaign_id, character_id, user_id, item_id, quantity, status, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `).run(id, campaignId, data.characterId, userId, data.itemId, quantity, data.notes?.trim() || '', now, now);

    return {
      id,
      campaign_id: campaignId,
      character_id: data.characterId,
      character_name: char.name,
      user_id: userId,
      item_id: data.itemId,
      item_name: item.name,
      quantity,
      status: 'pending',
      notes: data.notes?.trim() || '',
      reviewed_by_user_id: null,
      created_at: now,
      updated_at: now
    };
  }

  getItemRequests(campaignId: string, status?: string, userId?: string): ItemRequest[] {
    let sql = `
      SELECT ir.*, c.name as character_name, u.username, it.name as item_name, ru.username as reviewed_by_username
      FROM item_requests ir
      INNER JOIN characters c ON c.id = ir.character_id
      INNER JOIN users u ON u.id = ir.user_id
      INNER JOIN items it ON it.id = ir.item_id
      LEFT JOIN users ru ON ru.id = ir.reviewed_by_user_id
      WHERE ir.campaign_id = ?
    `;
    const params: any[] = [campaignId];

    if (status) {
      sql += ` AND ir.status = ?`;
      params.push(status);
    }

    if (userId) {
      sql += ` AND ir.user_id = ?`;
      params.push(userId);
    }

    sql += ` ORDER BY ir.created_at DESC`;

    const rows = this.db.prepare(sql).all(...params) as any[];

    return rows.map(r => ({
      id: r.id,
      campaign_id: r.campaign_id,
      character_id: r.character_id,
      character_name: r.character_name,
      user_id: r.user_id,
      username: r.username,
      item_id: r.item_id,
      item_name: r.item_name,
      quantity: r.quantity,
      status: r.status,
      notes: r.notes,
      reviewed_by_user_id: r.reviewed_by_user_id,
      reviewed_by_username: r.reviewed_by_username,
      created_at: r.created_at,
      updated_at: r.updated_at
    }));
  }

  reviewItemRequest(
    campaignId: string,
    requestId: string,
    reviewerUserId: string,
    data: ReviewItemRequestDTO
  ): ItemRequest {
    const req = this.db.prepare(`
      SELECT ir.*, c.name as character_name, u.username, it.name as item_name
      FROM item_requests ir
      INNER JOIN characters c ON c.id = ir.character_id
      INNER JOIN users u ON u.id = ir.user_id
      INNER JOIN items it ON it.id = ir.item_id
      WHERE ir.id = ? AND ir.campaign_id = ?
    `).get(requestId, campaignId) as any;

    if (!req) {
      throw new Error('Solicitação de item não encontrada.');
    }

    if (req.status !== 'pending') {
      throw new Error(`Esta solicitação já foi finalizada com status '${req.status}'.`);
    }

    const now = new Date().toISOString();

    if (data.status === 'approved') {
      this.db.exec('BEGIN TRANSACTION;');
      try {
        this.addItemToCharacter(campaignId, req.character_id, {
          itemId: req.item_id,
          quantity: req.quantity
        }, true);

        this.db.prepare(`
          UPDATE item_requests
          SET status = 'approved', reviewed_by_user_id = ?, notes = ?, updated_at = ?
          WHERE id = ?
        `).run(reviewerUserId, data.notes?.trim() || req.notes || '', now, requestId);

        this.db.exec('COMMIT;');
      } catch (err) {
        this.db.exec('ROLLBACK;');
        throw err;
      }
    } else {
      this.db.prepare(`
        UPDATE item_requests
        SET status = 'rejected', reviewed_by_user_id = ?, notes = ?, updated_at = ?
        WHERE id = ?
      `).run(reviewerUserId, data.notes?.trim() || req.notes || '', now, requestId);
    }

    return {
      id: req.id,
      campaign_id: campaignId,
      character_id: req.character_id,
      character_name: req.character_name,
      user_id: req.user_id,
      username: req.username,
      item_id: req.item_id,
      item_name: req.item_name,
      quantity: req.quantity,
      status: data.status,
      notes: data.notes?.trim() || req.notes || '',
      reviewed_by_user_id: reviewerUserId,
      created_at: req.created_at,
      updated_at: now
    };
  }
}
