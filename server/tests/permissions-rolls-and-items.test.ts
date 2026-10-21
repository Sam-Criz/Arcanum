import test from 'node:test';
import assert from 'node:assert';
import { getDatabase } from '../src/db/connection';
import { AuthService } from '../src/modules/auth/auth.service';
import { CampaignService } from '../src/modules/campaigns/campaign.service';
import { RulesService } from '../src/modules/rules-engine/rules.service';
import { CharacterService } from '../src/modules/characters/character.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { createApp } from '../src/app';

test('1. Catálogo de Itens - Controle de Estoque Limitado, Modo de Aquisição e Solicitações', () => {
  const db = getDatabase(':memory:');
  const authService = new AuthService(db);
  const rulesService = new RulesService(db);
  const campaignService = new CampaignService(db, rulesService);
  const characterService = new CharacterService(db, rulesService);
  const inventoryService = new InventoryService(db, rulesService, characterService);

  // Criar Mestre e Jogador
  const master = authService.register({ email: 'mestre@itens.com', username: 'MestreItens', password: 'password123' }).user;
  const player = authService.register({ email: 'jogador@itens.com', username: 'JogadorItens', password: 'password123' }).user;

  const camp = campaignService.createCampaign(master.id, { name: 'Campanha Estoque Teste' });
  const invite = campaignService.createInvite(camp.id, { role: 'player' });
  campaignService.joinCampaignByInvite(invite.code, player.id);

  const char = characterService.createCharacter(camp.id, player.id, {
    name: 'Guerreiro do Jogador',
    rawData: { Forca: 3, Vigor: 2 }
  });

  // 1.1 Mestre cria item com estoque limitado (3 unidades)
  const limitedItem = inventoryService.createCatalogItem(camp.id, {
    name: 'Kit Médico Avançado',
    category: 'consumivel',
    acquisition_mode: 'limited',
    stock_quantity: 3,
    weight: 1.0,
    cost: 100
  });

  assert.strictEqual(limitedItem.acquisition_mode, 'limited');
  assert.strictEqual(limitedItem.stock_quantity, 3);

  // 1.2 Jogador obtém 2 unidades -> estoque deve cair para 1
  const added = inventoryService.addItemToCharacter(camp.id, char.id, {
    itemId: limitedItem.id,
    quantity: 2
  }, false); // isMaster = false

  assert.strictEqual(added.quantity, 2);
  const freshItem = inventoryService.getCatalogItemById(camp.id, limitedItem.id);
  assert.strictEqual(freshItem?.stock_quantity, 1);

  // 1.3 Jogador tenta obter mais 2 unidades (só há 1 disponível) -> deve falhar
  assert.throws(() => {
    inventoryService.addItemToCharacter(camp.id, char.id, {
      itemId: limitedItem.id,
      quantity: 2
    }, false);
  }, /Estoque insuficiente/);

  // 1.4 Jogador tenta obter quantidade inválida (0 ou negativa)
  assert.throws(() => {
    inventoryService.addItemToCharacter(camp.id, char.id, {
      itemId: limitedItem.id,
      quantity: 0
    }, false);
  }, /maior que zero/);

  // 1.5 Jogador comum NÃO PODE criar itens customizados sem modelo no catálogo
  assert.throws(() => {
    inventoryService.addItemToCharacter(camp.id, char.id, {
      itemName: 'Item Inventado pelo Jogador',
      category: 'arma',
      quantity: 1
    }, false); // isMaster = false
  }, /Apenas o mestre pode conceder itens customizados/);

  // 1.6 Mestre cria item que exige aprovação
  const approvalItem = inventoryService.createCatalogItem(camp.id, {
    name: 'Artefato Oculto Amaldiçoado',
    category: 'ocultista',
    acquisition_mode: 'approval',
    weight: 2.5,
    cost: 5000
  });

  // Jogador tenta pegar o item diretamente -> deve ser barrado
  assert.throws(() => {
    inventoryService.addItemToCharacter(camp.id, char.id, {
      itemId: approvalItem.id,
      quantity: 1
    }, false);
  }, /exige aprovação do mestre/);

  // 1.7 Jogador cria solicitação de obtenção do item
  const req = inventoryService.createItemRequest(camp.id, player.id, {
    characterId: char.id,
    itemId: approvalItem.id,
    quantity: 1,
    notes: 'Encontrei durante o ritual'
  });

  assert.strictEqual(req.status, 'pending');
  assert.strictEqual(req.character_name, 'Guerreiro do Jogador');

  // Mestre lista solicitações pendentes
  const pendingRequests = inventoryService.getItemRequests(camp.id, 'pending');
  assert.strictEqual(pendingRequests.length, 1);
  assert.strictEqual(pendingRequests[0].id, req.id);

  // Mestre aprova a solicitação
  const approvedReq = inventoryService.reviewItemRequest(camp.id, req.id, master.id, {
    status: 'approved',
    notes: 'Aprovado para a narrativa'
  });

  assert.strictEqual(approvedReq.status, 'approved');

  // Verifica que o item foi adicionado ao inventário do personagem após a aprovação
  const invSummary = inventoryService.getCharacterInventory(camp.id, char.id);
  const foundItem = invSummary.items.find(i => i.item_id === approvalItem.id);
  assert.ok(foundItem, 'Item aprovado deve estar presente no inventário');
  assert.strictEqual(foundItem.item_name, 'Artefato Oculto Amaldiçoado');
});

test('2. Rolagens Secretas - Sigilo do Jogador, Entrega ao Mestre e Histórico Persistente', async () => {
  const db = getDatabase(':memory:');
  const appCtx = createApp(db);
  const authService = new AuthService(db);
  const campaignService = new CampaignService(db, appCtx.rulesService);

  // Criar Mestre e Jogador da Campanha A
  const masterRes = authService.register({ email: 'mestreA@dice.com', username: 'MestreDiceA', password: 'password123' });
  const playerRes = authService.register({ email: 'jogadorA@dice.com', username: 'JogadorDiceA', password: 'password123' });

  // Criar Usuário da Campanha B (estranho)
  const outsiderRes = authService.register({ email: 'estranho@dice.com', username: 'OutsiderDice', password: 'password123' });

  const campA = campaignService.createCampaign(masterRes.user.id, { name: 'Campanha de Investigação A' });
  const invite = campaignService.createInvite(campA.id, { role: 'player' });
  campaignService.joinCampaignByInvite(invite.code, playerRes.user.id);

  const campB = campaignService.createCampaign(outsiderRes.user.id, { name: 'Campanha Desconhecida B' });

  // 2.1 Jogador realiza uma rolagem secreta via HTTP
  const server = appCtx.app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;

  try {
    const rollReq = await fetch(`${baseUrl}/api/campaigns/${campA.id}/dice/roll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${playerRes.token}`
      },
      body: JSON.stringify({
        expression: '1d20 + 5',
        isSecret: true
      })
    });

    const rollData = await rollReq.json();
    assert.strictEqual(rollReq.status, 200);

    // O jogador NÃO deve ver o total nem o breakdown na resposta HTTP!
    assert.strictEqual(rollData.isSecret, true);
    assert.strictEqual(rollData.total, undefined, 'Total não pode ser revelado ao jogador em rolagem secreta');
    assert.strictEqual(rollData.breakdown, undefined, 'Breakdown não pode ser revelado ao jogador em rolagem secreta');
    assert.ok(rollData.message.includes('enviada ao mestre'));

    // 2.2 Jogador consulta histórico de rolagens -> rolagens secretas são OBRIGATORIAMENTE ocultadas no servidor
    const playerHistReq = await fetch(`${baseUrl}/api/campaigns/${campA.id}/rolls`, {
      headers: { 'Authorization': `Bearer ${playerRes.token}` }
    });
    const playerHistData = await playerHistReq.json();
    assert.strictEqual(playerHistReq.status, 200);
    const secretInPlayerList = playerHistData.rolls.some((r: any) => r.isSecret === true);
    assert.strictEqual(secretInPlayerList, false, 'Jogador comum não pode ver rolagens secretas no histórico');

    // 2.3 Mestre consulta histórico de rolagens -> Mestre DEVE visualizar a rolagem secreta com total e breakdown
    const masterHistReq = await fetch(`${baseUrl}/api/campaigns/${campA.id}/rolls`, {
      headers: { 'Authorization': `Bearer ${masterRes.token}` }
    });
    const masterHistData = await masterHistReq.json();
    assert.strictEqual(masterHistReq.status, 200);
    const secretRoll = masterHistData.rolls.find((r: any) => r.isSecret === true);
    assert.ok(secretRoll, 'Mestre deve encontrar a rolagem secreta no histórico');
    assert.strictEqual(typeof secretRoll.total, 'number');
    assert.strictEqual(secretRoll.username, 'JogadorDiceA');
    assert.strictEqual(secretRoll.expression, '1d20 + 5');
    assert.ok(secretRoll.breakdown.diceRolls.length > 0);

    // 2.4 Usuário de outra campanha tenta acessar o histórico -> 403 Forbidden
    const outsiderReq = await fetch(`${baseUrl}/api/campaigns/${campA.id}/rolls`, {
      headers: { 'Authorization': `Bearer ${outsiderRes.token}` }
    });
    assert.strictEqual(outsiderReq.status, 403, 'Usuário de fora da campanha deve receber 403 Forbidden');
  } finally {
    server.close();
  }
});

test('3. Sistema de Itens - Categorias, Validação de Fórmulas e Uso Mecânico (Dano, Bateria, Recuperação)', () => {
  const db = getDatabase(':memory:');
  const authService = new AuthService(db);
  const rulesService = new RulesService(db);
  const campaignService = new CampaignService(db, rulesService);
  const characterService = new CharacterService(db, rulesService);
  const inventoryService = new InventoryService(db, rulesService, characterService);

  const master = authService.register({ email: 'mestre@mechanics.com', username: 'MestreMech', password: 'password123' }).user;
  const camp = campaignService.createCampaign(master.id, { name: 'Campanha Mecânicas' });

  // 3.1 Validação de Fórmulas no Catálogo: Fórmulas inválidas devem ser REJEITADAS
  assert.throws(() => {
    inventoryService.createCatalogItem(camp.id, {
      name: 'Arma com Fórmula Insegura',
      category: 'arma',
      properties: { dano: '1d20 + eval("bad")' }
    });
  }, /inválida/);

  // 3.2 Criação com fórmulas legítimas aprovadas pelo motor de regras
  const fuzil = inventoryService.createCatalogItem(camp.id, {
    name: 'Fuzil de Combate M4',
    category: 'arma',
    properties: {
      dano: '2d8 + 2',
      tipo_dano: 'balístico',
      alcance: '30m',
      capacidade_municao: 30
    }
  });
  assert.strictEqual(fuzil.properties.dano, '2d8 + 2');

  const pocao = inventoryService.createCatalogItem(camp.id, {
    name: 'Estimulante Celular',
    category: 'consumivel',
    properties: {
      cargas_max: 2,
      recuperacao_atributo: 'vida_atual',
      recuperacao_formula: '1d8 + 3'
    }
  });

  const exoesqueleto = inventoryService.createCatalogItem(camp.id, {
    name: 'Bateria de Exoesqueleto',
    category: 'tecnologico',
    properties: {
      bateria_max: 20,
      consumo_por_uso: 5,
      efeito: 'Força aumentada por 1 rodada'
    }
  });

  // 3.3 Conceder ao personagem
  const char = characterService.createCharacter(camp.id, master.id, {
    name: 'Cyborg Teste',
    rawData: { vida_atual: 10, vida_max: 30 }
  });

  const invFuzil = inventoryService.addItemToCharacter(camp.id, char.id, { itemId: fuzil.id, quantity: 1 }, true);
  const invPocao = inventoryService.addItemToCharacter(camp.id, char.id, { itemId: pocao.id, quantity: 1 }, true);
  const invExo = inventoryService.addItemToCharacter(camp.id, char.id, { itemId: exoesqueleto.id, quantity: 1 }, true);

  // 3.4 Disparar arma -> decrementa munição
  assert.strictEqual(invFuzil.properties.municao_atual, 30);
  const shotRes = inventoryService.useInventoryItem(camp.id, char.id, invFuzil.id, master.id, true);
  assert.strictEqual(shotRes.item?.properties.municao_atual, 29);
  assert.ok(shotRes.rollResult.total >= 4 && shotRes.rollResult.total <= 18); // 2d8 + 2

  // 3.5 Consumir bateria tecnológica -> consome 5 cargas
  const techRes = inventoryService.useInventoryItem(camp.id, char.id, invExo.id, master.id, true);
  assert.strictEqual(techRes.item?.properties.bateria_atual, 15); // 20 - 5 = 15

  // 3.6 Consumir poção -> cura o atributo 'vida_atual'
  assert.strictEqual(char.raw_data.vida_atual, 10);
  const healRes = inventoryService.useInventoryItem(camp.id, char.id, invPocao.id, master.id, true);
  assert.strictEqual(healRes.item?.properties.cargas_atual, 1); // 2 - 1 = 1 carga restante
  assert.ok(healRes.character.raw_data.vida_atual > 10, 'A vida atual deve ter sido aumentada pela fórmula');
});
