import test from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { getDatabase } from '../src/db/connection';
import { createApp } from '../src/app';

test('Fase 6 — Transações Atômicas no SQLite e Rollback de Recursos (atomic_transactions)', async () => {
  const db = getDatabase(':memory:');
  const server = http.createServer();
  const { app, inventoryService, characterService } = createApp(db);
  server.on('request', app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  try {
    // 1. Cadastrar Mestre e Jogadores
    const registerUser = async (email: string, username: string) => {
      const res = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password: 'Password123!' })
      });
      return (await res.json()).token;
    };

    const tokenMaster = await registerUser('master_atom@test.com', 'MasterAtom');
    const tokenPlayer = await registerUser('player_atom@test.com', 'PlayerAtom');

    const me = await (await fetch(`${baseUrl}/auth/me`, { headers: { Authorization: `Bearer ${tokenPlayer}` } })).json();
    const playerId = me.user.id;

    // Criar Campanha
    const campRes = await fetch(`${baseUrl}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenMaster}` },
      body: JSON.stringify({ name: 'Mesa de Transações Atômicas' })
    });
    const camp = (await campRes.json()).campaign;

    // Jogador entra na Campanha
    const invRes = await fetch(`${baseUrl}/campaigns/${camp.id}/invites`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenMaster}` }
    });
    const invCode = (await invRes.json()).invite.code;

    await fetch(`${baseUrl}/campaigns/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPlayer}` },
      body: JSON.stringify({ code: invCode })
    });

    // Criar Personagem com saldo inicial de 50 moedas
    const char = characterService.createCharacter(camp.id, playerId, {
      name: 'Aldous Mercador',
      rawData: { moedas: 50, vida_atual: 10, vida_max: 20 }
    });

    // Mestre cadastra 2 itens no catálogo:
    // Item A: "Amuleto Lendário" - Custa 100 po (estoque limitado: 1)
    const amulet = inventoryService.createCatalogItem(camp.id, {
      name: 'Amuleto Lendário',
      cost: 100,
      weight: 1,
      category: 'item',
      acquisition_mode: 'limited',
      stock_quantity: 1,
      is_visible_to_players: true
    });

    // Item B: "Poção de Vida Menor" - Custa 20 po (estoque limitado: 5)
    const potion = inventoryService.createCatalogItem(camp.id, {
      name: 'Poção de Vida Menor',
      cost: 20,
      weight: 0.5,
      category: 'consumivel',
      acquisition_mode: 'limited',
      stock_quantity: 5,
      is_visible_to_players: true,
      properties: { heal_formula: '10', is_consumable: true }
    });

    // =========================================================================
    // CENÁRIO 1: Tentativa de compra com saldo insuficiente -> ROLLBACK ESTREITO
    // =========================================================================
    assert.throws(() => {
      inventoryService.purchaseItem(camp.id, playerId, {
        characterId: char.id,
        itemId: amulet.id,
        quantity: 1
      });
    }, /Saldo insuficiente/);

    // Validação pós-rollback:
    // 1. O saldo do personagem permanece exatamente 50
    const charAfterFail = characterService.getCharacterById(camp.id, char.id)!;
    assert.strictEqual(charAfterFail.raw_data.moedas, 50, 'Saldo deve permanecer inalterado após falha na compra');

    // 2. O estoque do item continua 1
    const amuletAfterFail = inventoryService.getCatalogItemById(camp.id, amulet.id)!;
    assert.strictEqual(amuletAfterFail.stock_quantity, 1, 'Estoque deve permanecer intacto após rollback');

    // 3. O inventário do personagem não possui o item
    const invAfterFail = inventoryService.getCharacterInventory(camp.id, char.id);
    assert.strictEqual(invAfterFail.items.length, 0, 'Nenhum item pode ser adicionado ao inventário em caso de rollback');

    // =========================================================================
    // CENÁRIO 2: Compra bem-sucedida -> COMMIT ATÔMICO
    // =========================================================================
    const purchaseResult = inventoryService.purchaseItem(camp.id, playerId, {
      characterId: char.id,
      itemId: potion.id,
      quantity: 1
    });

    assert.strictEqual(purchaseResult.success, true);
    assert.strictEqual(purchaseResult.transaction.totalCost, 20);
    assert.strictEqual(purchaseResult.transaction.newBalance, 30);

    // Validação pós-commit:
    const charAfterSuccess = characterService.getCharacterById(camp.id, char.id)!;
    assert.strictEqual(charAfterSuccess.raw_data.moedas, 30, 'Saldo deve ser debitado atomicamente');

    const potionAfterSuccess = inventoryService.getCatalogItemById(camp.id, potion.id)!;
    assert.strictEqual(potionAfterSuccess.stock_quantity, 4, 'Estoque deve ser decrementado');

    const invAfterSuccess = inventoryService.getCharacterInventory(camp.id, char.id);
    assert.strictEqual(invAfterSuccess.items.length, 1);
    assert.strictEqual(invAfterSuccess.items[0].item_name, 'Poção de Vida Menor');
    assert.strictEqual(invAfterSuccess.items[0].quantity, 1);

    // =========================================================================
    // CENÁRIO 3: Consumo Atômico de Consumível
    // =========================================================================
    const inventoryItemId = invAfterSuccess.items[0].id;

    // Consome a poção
    const useResult = inventoryService.useInventoryItem(camp.id, char.id, inventoryItemId, playerId, false);
    assert.strictEqual(useResult.success, true, 'Uso do item deve ser bem sucedido');
    assert.strictEqual(useResult.item, null, 'Item totalmente consumido deve retornar null');

    // Inventário do personagem agora deve estar vazio (poção tinha quantidade 1)
    const invAfterUse = inventoryService.getCharacterInventory(camp.id, char.id);
    assert.strictEqual(invAfterUse.items.length, 0, 'Item consumido deve ser expurgado do inventário');

    // Tentativa de consumir novamente o mesmo item (que não existe mais) -> Falha atômica
    assert.throws(() => {
      inventoryService.useInventoryItem(camp.id, char.id, inventoryItemId, playerId, false);
    }, /Item não encontrado/);

    // =========================================================================
    // CENÁRIO 4: Concorrência e Transferência Atômica com Quantidade Insuficiente
    // =========================================================================
    // Cria segundo personagem para o jogador
    const char2 = characterService.createCharacter(camp.id, playerId, {
      name: 'Boris Companheiro',
      rawData: { po: 0 }
    });

    // Mestre dá 2 adagas para Aldous
    inventoryService.addItemToCharacter(camp.id, char.id, {
      itemName: 'Adaga de Prata',
      category: 'arma',
      quantity: 2,
      weight: 1,
      cost: 10
    }, true);

    const invDaggers = inventoryService.getCharacterInventory(camp.id, char.id);
    const daggerId = invDaggers.items[0].id;
    assert.strictEqual(invDaggers.items[0].quantity, 2);

    // Tentativa de transferir 5 adagas (quantidade > 2) -> deve falhar e dar rollback
    assert.throws(() => {
      inventoryService.transferItem(camp.id, char.id, {
        inventoryItemId: daggerId,
        targetCharacterId: char2.id,
        quantity: 5
      }, playerId, false);
    }, /Quantidade insuficiente/);

    // Validação pós-rollback:
    // Personagem 1 ainda tem as 2 adagas
    const daggersAfterFail = inventoryService.getCharacterInventory(camp.id, char.id);
    assert.strictEqual(daggersAfterFail.items[0].quantity, 2, 'Quantidade do remetente permanece intacta');

    // Personagem 2 não recebeu nada
    const char2Inv = inventoryService.getCharacterInventory(camp.id, char2.id);
    assert.strictEqual(char2Inv.items.length, 0, 'Destinatário não deve receber itens após rollback de transferência');

  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
