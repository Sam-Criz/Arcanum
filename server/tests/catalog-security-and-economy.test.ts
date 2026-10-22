import test from 'node:test';
import assert from 'node:assert';
import { getDatabase } from '../src/db/connection';
import { AuthService } from '../src/modules/auth/auth.service';
import { CampaignService } from '../src/modules/campaigns/campaign.service';
import { RulesService } from '../src/modules/rules-engine/rules.service';
import { CharacterService } from '../src/modules/characters/character.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { createApp } from '../src/app';

test('Segurança do Catálogo, Economia e Compras Atômicas (15 Cenários Obrigatórios)', async (t) => {
  const db = getDatabase(':memory:');
  const authService = new AuthService(db);
  const rulesService = new RulesService(db);
  const campaignService = new CampaignService(db, rulesService);
  const characterService = new CharacterService(db, rulesService);
  const inventoryService = new InventoryService(db, rulesService, characterService);

  // Setup: Mestre e Jogadores em duas campanhas isoladas
  const masterA = authService.register({ email: 'mestre@arcanum.com', username: 'MestreArcanum', password: 'password123' }).user;
  const playerA = authService.register({ email: 'jogador@arcanum.com', username: 'JogadorArcanum', password: 'password123' }).user;
  const playerB = authService.register({ email: 'estranho@arcanum.com', username: 'Estranho', password: 'password123' }).user;
  const masterB = authService.register({ email: 'mestre2@arcanum.com', username: 'Mestre2', password: 'password123' }).user;

  const campA = campaignService.createCampaign(masterA.id, { name: 'Campanha A' });
  const campB = campaignService.createCampaign(masterB.id, { name: 'Campanha B' });

  // Convite Campanha A
  const inviteA = campaignService.createInvite(campA.id, { role: 'player' });
  campaignService.joinCampaignByInvite(inviteA.code, playerA.id);

  // Personagem do jogador com 100 moedas de ouro
  const charA = characterService.createCharacter(campA.id, playerA.id, {
    name: 'Valerius',
    rawData: { dinheiro: 100, Forca: 2, Vigor: 3 }
  });

  // Itens do Catálogo
  const swordItem = inventoryService.createCatalogItem(campA.id, {
    name: 'Espada Longa de Aço',
    category: 'arma',
    weight: 2.0,
    cost: 30,
    is_hidden: false,
    is_purchasable: true
  });

  const secretRelic = inventoryService.createCatalogItem(campA.id, {
    name: 'Amuleto Proibido dos Antigos',
    category: 'ocultista',
    weight: 0.5,
    cost: 500,
    is_hidden: true,
    is_purchasable: true
  });

  const questArtifact = inventoryService.createCatalogItem(campA.id, {
    name: 'Chave dos Abismos',
    category: 'chave',
    weight: 0.1,
    cost: 0,
    is_hidden: false,
    is_purchasable: false // Apenas concessão do mestre!
  });

  // Item da Campanha B
  const alienTech = inventoryService.createCatalogItem(campB.id, {
    name: 'Implante Subdérmico',
    category: 'cibernetico',
    cost: 80,
    is_hidden: false,
    is_purchasable: true
  });

  // -------------------------------------------------------------------------
  // CENÁRIO 1: Jogador não recebe itens ocultos nas listagens
  // -------------------------------------------------------------------------
  const playerCatalog = inventoryService.getCatalogItems(campA.id, undefined, undefined, false); // isMaster = false
  assert.strictEqual(playerCatalog.some(i => i.id === secretRelic.id), false, 'Item oculto não deve aparecer na listagem de jogadores');
  assert.strictEqual(playerCatalog.some(i => i.id === swordItem.id), true, 'Item público deve aparecer');
  assert.strictEqual(playerCatalog.some(i => i.id === questArtifact.id), true, 'Item não comprável visível deve aparecer');

  // Mestre visualiza tudo, inclusive os ocultos
  const masterCatalog = inventoryService.getCatalogItems(campA.id, undefined, undefined, true);
  assert.strictEqual(masterCatalog.some(i => i.id === secretRelic.id), true, 'Mestre deve ver itens ocultos');

  // -------------------------------------------------------------------------
  // CENÁRIO 2: Jogador não consegue obter detalhes de um item oculto por ID
  // -------------------------------------------------------------------------
  const playerFetchSecret = inventoryService.getCatalogItemById(campA.id, secretRelic.id, false); // isMaster = false
  assert.strictEqual(playerFetchSecret, null, 'Consulta por ID de item oculto por jogador deve retornar null (404)');

  const masterFetchSecret = inventoryService.getCatalogItemById(campA.id, secretRelic.id, true);
  assert.notStrictEqual(masterFetchSecret, null, 'Mestre deve conseguir consultar item oculto por ID');
  assert.strictEqual(masterFetchSecret?.is_hidden, true);

  // -------------------------------------------------------------------------
  // CENÁRIO 3: Jogador não consegue adquirir item oculto por chamada direta
  // -------------------------------------------------------------------------
  assert.throws(() => {
    inventoryService.purchaseItem(campA.id, playerA.id, {
      characterId: charA.id,
      itemId: secretRelic.id,
      quantity: 1
    }, false);
  }, /não encontrado/i, 'Tentativa de comprar item oculto deve falhar com erro de não encontrado');

  // -------------------------------------------------------------------------
  // CENÁRIO 4: Item comprável pode ser adquirido com saldo suficiente
  // -------------------------------------------------------------------------
  const purchaseRes = inventoryService.purchaseItem(campA.id, playerA.id, {
    characterId: charA.id,
    itemId: swordItem.id,
    quantity: 2 // 2 * 30 = 60 moedas
  }, false);

  assert.strictEqual(purchaseRes.success, true);
  assert.strictEqual(purchaseRes.transaction.totalCost, 60);

  // -------------------------------------------------------------------------
  // CENÁRIO 5: O saldo é debitado corretamente e o inventário recebe a quantidade correta
  // -------------------------------------------------------------------------
  assert.strictEqual(purchaseRes.transaction.previousBalance, 100);
  assert.strictEqual(purchaseRes.transaction.newBalance, 40); // 100 - 60 = 40
  assert.strictEqual(purchaseRes.character.raw_data.dinheiro, 40);

  const charInv = inventoryService.getCharacterInventory(campA.id, charA.id);
  const swordInInv = charInv.items.find(i => i.item_id === swordItem.id);
  assert.notStrictEqual(swordInInv, undefined);
  assert.strictEqual(swordInInv?.quantity, 2);

  // -------------------------------------------------------------------------
  // CENÁRIO 6: Saldo insuficiente impede a compra sem alterar o inventário ou o dinheiro
  // -------------------------------------------------------------------------
  // Valerius agora tem 40 moedas. Tentar comprar 2 espadas (60 moedas) deve falhar!
  assert.throws(() => {
    inventoryService.purchaseItem(campA.id, playerA.id, {
      characterId: charA.id,
      itemId: swordItem.id,
      quantity: 2
    }, false);
  }, /Saldo insuficiente/i);

  // Saldo e inventário devem permanecer absolutamente intocados
  const charAfterFail = characterService.getCharacterById(campA.id, charA.id);
  assert.strictEqual(charAfterFail?.raw_data.dinheiro, 40, 'Saldo deve permanecer 40 após recusa');
  const invAfterFail = inventoryService.getCharacterInventory(campA.id, charA.id);
  const swordAfterFail = invAfterFail.items.find(i => i.item_id === swordItem.id);
  assert.strictEqual(swordAfterFail?.quantity, 2, 'Quantidade no inventário não deve mudar');

  // -------------------------------------------------------------------------
  // CENÁRIO 7: Item não comprável é recusado com a mensagem exata prevista
  // -------------------------------------------------------------------------
  assert.throws(() => {
    inventoryService.purchaseItem(campA.id, playerA.id, {
      characterId: charA.id,
      itemId: questArtifact.id,
      quantity: 1
    }, false);
  }, /Este item requer concessão direta do Mestre\./);

  // -------------------------------------------------------------------------
  // CENÁRIO 8: Mestre pode conceder item não comprável por operação administrativa
  // -------------------------------------------------------------------------
  const granted = inventoryService.grantItem(campA.id, charA.id, {
    itemId: questArtifact.id,
    quantity: 1
  });

  assert.strictEqual(granted.item_name, 'Chave dos Abismos');
  assert.strictEqual(granted.quantity, 1);
  // Concessão não deve mexer no dinheiro do personagem
  const charAfterGrant = characterService.getCharacterById(campA.id, charA.id);
  assert.strictEqual(charAfterGrant?.raw_data.dinheiro, 40);

  // -------------------------------------------------------------------------
  // CENÁRIO 9: Jogador não consegue executar uma concessão administrativa
  // -------------------------------------------------------------------------
  assert.throws(() => {
    inventoryService.addItemToCharacter(campA.id, charA.id, {
      itemId: questArtifact.id,
      quantity: 1
    }, false); // isMaster = false
  }, /requer concessão direta do Mestre/);

  // E não pode criar itens inventados
  assert.throws(() => {
    inventoryService.addItemToCharacter(campA.id, charA.id, {
      itemName: 'Espada do Deus do Trovão',
      quantity: 1
    }, false);
  }, /Apenas o mestre pode conceder itens customizados/);

  // -------------------------------------------------------------------------
  // CENÁRIO 10: Preço ou saldo enviados pelo cliente não substituem valores do servidor
  // -------------------------------------------------------------------------
  // Tentar passar cost: 1 ou preço adulterado no payload não surte efeito (preço vem de items.cost = 30)
  const buySingle = inventoryService.purchaseItem(campA.id, playerA.id, {
    characterId: charA.id,
    itemId: swordItem.id,
    quantity: 1,
    ...({ cost: 1, unitCost: 1, totalCost: 1 } as any) // injeção maliciosa ignorada
  }, false);

  assert.strictEqual(buySingle.transaction.unitCost, 30, 'Preço deve ser 30 do servidor');
  assert.strictEqual(buySingle.transaction.totalCost, 30);
  assert.strictEqual(buySingle.transaction.newBalance, 10); // 40 - 30 = 10

  // -------------------------------------------------------------------------
  // CENÁRIO 11: Quantidades inválidas e valores negativos são rejeitados
  // -------------------------------------------------------------------------
  assert.throws(() => {
    inventoryService.purchaseItem(campA.id, playerA.id, {
      characterId: charA.id,
      itemId: swordItem.id,
      quantity: -5 // negativo para tentar ganhar dinheiro
    }, false);
  }, /maior que zero/);

  assert.throws(() => {
    inventoryService.purchaseItem(campA.id, playerA.id, {
      characterId: charA.id,
      itemId: swordItem.id,
      quantity: 0
    }, false);
  }, /maior que zero/);

  assert.throws(() => {
    inventoryService.purchaseItem(campA.id, playerA.id, {
      characterId: charA.id,
      itemId: swordItem.id,
      quantity: 1.5 // fracionado
    }, false);
  }, /fracionada/);

  // -------------------------------------------------------------------------
  // CENÁRIO 12: Atomicidade e prevenção de saldo negativo
  // -------------------------------------------------------------------------
  // Saldo atual = 10. Tentar comprar 1 espada (custa 30)
  assert.throws(() => {
    inventoryService.purchaseItem(campA.id, playerA.id, {
      characterId: charA.id,
      itemId: swordItem.id,
      quantity: 1
    }, false);
  }, /Saldo insuficiente/);

  const charCheck12 = characterService.getCharacterById(campA.id, charA.id);
  assert.strictEqual(charCheck12?.raw_data.dinheiro, 10, 'Saldo jamais pode ficar negativo');

  // -------------------------------------------------------------------------
  // CENÁRIO 13: Repetir compra só produz nova aquisição com novo pagamento
  // -------------------------------------------------------------------------
  // Dá mais 30 moedas legitimamente para o personagem
  const rawUpdated = { ...charCheck12?.raw_data, dinheiro: 40 };
  db.prepare(`UPDATE characters SET raw_data_json = ? WHERE id = ?`).run(JSON.stringify(rawUpdated), charA.id);

  // Compra válida 1
  const validBuy1 = inventoryService.purchaseItem(campA.id, playerA.id, {
    characterId: charA.id,
    itemId: swordItem.id,
    quantity: 1
  }, false);
  assert.strictEqual(validBuy1.transaction.newBalance, 10);

  // Segunda tentativa imediata com saldo esgotado falha
  assert.throws(() => {
    inventoryService.purchaseItem(campA.id, playerA.id, {
      characterId: charA.id,
      itemId: swordItem.id,
      quantity: 1
    }, false);
  }, /Saldo insuficiente/);

  // -------------------------------------------------------------------------
  // CENÁRIO 14: Permissões e isolamento entre campanhas
  // -------------------------------------------------------------------------
  // Jogador de Campanha A tenta comprar item da Campanha B
  assert.throws(() => {
    inventoryService.purchaseItem(campA.id, playerA.id, {
      characterId: charA.id,
      itemId: alienTech.id, // item da Camp B
      quantity: 1
    }, false);
  }, /não encontrado/);

  // Usuário de fora tenta comprar para o personagem do Jogador A
  assert.throws(() => {
    inventoryService.purchaseItem(campA.id, playerB.id, {
      characterId: charA.id,
      itemId: swordItem.id,
      quantity: 1
    }, false);
  }, /seus próprios personagens/);

  // -------------------------------------------------------------------------
  // CENÁRIO 15: Transferências, auditoria e uso continuam funcionando normalmente
  // -------------------------------------------------------------------------
  // Cria personagem 2 na Campanha A para receber transferência
  const charA2 = characterService.createCharacter(campA.id, playerA.id, {
    name: 'Escudeiro',
    rawData: { dinheiro: 0 }
  });

  const invA1 = inventoryService.getCharacterInventory(campA.id, charA.id);
  const swordItemInInv = invA1.items.find(i => i.item_id === swordItem.id);
  assert.notStrictEqual(swordItemInInv, undefined);

  // Transfere 1 espada de Valerius para Escudeiro
  const transfer = inventoryService.transferItem(
    campA.id,
    charA.id,
    {
      inventoryItemId: swordItemInInv!.id,
      targetCharacterId: charA2.id,
      quantity: 1
    },
    playerA.id,
    false
  );

  assert.strictEqual(transfer.transferred.quantity, 1);
  const invA2 = inventoryService.getCharacterInventory(campA.id, charA2.id);
  assert.strictEqual(invA2.items.some(i => i.item_name === 'Espada Longa de Aço'), true);

  // Auditoria registrada
  const auditLogs = db.prepare(`SELECT * FROM audit_logs WHERE campaign_id = ? AND action = 'inventory:purchase'`).all(campA.id);
  assert.strictEqual(auditLogs.length >= 2, true, 'Compras devem gerar logs de auditoria atômicos');
});
