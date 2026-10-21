import test from 'node:test';
import assert from 'node:assert';
import { getDatabase } from '../src/db/connection';
import { createApp } from '../src/app';
import { AuthService } from '../src/modules/auth/auth.service';
import { CampaignService } from '../src/modules/campaigns/campaign.service';
import { CharacterService } from '../src/modules/characters/character.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { RulesService } from '../src/modules/rules-engine/rules.service';

test('7.1 Sincronização em tempo real de inventário, peso e atributos sem recarregamento de página', async () => {
  const db = getDatabase(':memory:');
  const rulesService = new RulesService(db);
  const campaignService = new CampaignService(db, rulesService);
  const characterService = new CharacterService(db, rulesService);
  const inventoryService = new InventoryService(db, rulesService, characterService);
  const authService = new AuthService(db);

  // 1. Criar Mestre e Campanha
  const master = authService.register({ email: 'mestre@sync.com', username: 'MestreSync', password: 'password123' }).user;
  const campaign = campaignService.createCampaign(master.id, { name: 'Campanha Sincronização Real' });

  // 2. Criar Jogador e Personagem
  const player = authService.register({ email: 'jogador@sync.com', username: 'JogadorSync', password: 'password123' }).user;
  const invite = campaignService.createInvite(campaign.id, { role: 'player' });
  campaignService.joinCampaignByInvite(invite.code, player.id);

  const char = characterService.createCharacter(campaign.id, player.id, {
    name: 'Investigador Ágil',
    rawData: { forca: 2, agilidade: 3, vigor: 2, intelecto: 1, presenca: 1 }
  });

  // Peso inicial do personagem deve ser 0
  let charAfterCreation = characterService.getCharacterById(campaign.id, char.id);
  assert.strictEqual(charAfterCreation?.computed_data.carga_atual, 0);
  assert.strictEqual(charAfterCreation?.computed_data.peso_total, 0);

  // 3. Criar itens no catálogo
  const arma = inventoryService.createCatalogItem(campaign.id, {
    name: 'Espingarda Calibre 12',
    category: 'arma',
    weight: 3.5,
    cost: 450,
    properties: { dano: '3d6 + 2', capacidade_municao: 6, municao_max: 6 }
  });

  const pocao = inventoryService.createCatalogItem(campaign.id, {
    name: 'Kit de Primeiros Socorros',
    category: 'consumivel',
    weight: 1.2,
    cost: 80,
    properties: { recuperacao_atributo: 'vida', recuperacao_formula: '2d8 + 2', cargas_max: 3 }
  });

  // 4. Adicionar itens ao inventário do personagem -> Peso e itens devem ser recalculados IMEDIATAMENTE
  const itemArma = inventoryService.addItemToCharacter(campaign.id, char.id, {
    itemId: arma.id,
    quantity: 1
  }, true);

  const itemPocao = inventoryService.addItemToCharacter(campaign.id, char.id, {
    itemId: pocao.id,
    quantity: 2
  }, true);

  // Inventário retornado
  const invSummary = inventoryService.getCharacterInventory(campaign.id, char.id);
  // Peso esperado: 1 * 3.5 + 2 * 1.2 = 3.5 + 2.4 = 5.9 kg
  assert.strictEqual(invSummary.totalWeight, 5.9);
  assert.strictEqual(invSummary.itemCount, 3);

  // Ficha do personagem recalculada no banco com carga e peso sincronizados
  let updatedChar = characterService.getCharacterById(campaign.id, char.id);
  assert.strictEqual(updatedChar?.computed_data.carga_atual, 5.9);
  assert.strictEqual(updatedChar?.computed_data.peso_total, 5.9);
  assert.strictEqual(updatedChar?.computed_data.total_itens, 3);

  // 5. Alterar quantidade de item no inventário (+1 espingarda) -> Peso deve atualizar imediatamente
  inventoryService.updateCharacterInventoryItem(campaign.id, char.id, itemArma.id, {
    quantity: 2
  });

  const invSummary2 = inventoryService.getCharacterInventory(campaign.id, char.id);
  // Novo peso esperado: 2 * 3.5 + 2 * 1.2 = 7.0 + 2.4 = 9.4 kg
  assert.strictEqual(invSummary2.totalWeight, 9.4);
  assert.strictEqual(invSummary2.itemCount, 4);

  updatedChar = characterService.getCharacterById(campaign.id, char.id);
  assert.strictEqual(updatedChar?.computed_data.carga_atual, 9.4);

  // 6. Uso mecânico de consumível -> cura recurso no personagem e decrementa carga atomicamente
  // Simular personagem ferido (vida_atual = 10 de vida_max = 20)
  characterService.updateCharacter(campaign.id, char.id, {
    rawData: { ...updatedChar!.raw_data, vida_atual: 10 }
  }, player.id, false);

  const useResult = inventoryService.useInventoryItem(campaign.id, char.id, itemPocao.id, player.id, false);
  assert.strictEqual(useResult.success, true);
  assert.ok(useResult.character.computed_data.vida_atual > 10, 'Vida atual deve ter sido curada imediatamente');

  // 7. Remoção de item do inventário -> Peso deve atualizar imediatamente
  inventoryService.removeCharacterInventoryItem(campaign.id, char.id, itemArma.id);
  const invSummary3 = inventoryService.getCharacterInventory(campaign.id, char.id);
  // Peso esperado: apenas 2 kits (2.4 kg)
  assert.strictEqual(invSummary3.totalWeight, 2.4);

  updatedChar = characterService.getCharacterById(campaign.id, char.id);
  assert.strictEqual(updatedChar?.computed_data.carga_atual, 2.4);
});

test('7.2 Lógica de Seleção Automática de Personagem por Usuário e Campanha', () => {
  // Simulador puro da regra de negócio implementada no frontend (CampaignWorkspace)
  function resolveSelectedCharacter(
    allCampaignCharacters: Array<{ id: string; user_id: string; name: string }>,
    currentUserId: string,
    isMaster: boolean,
    savedCharId: string | null
  ) {
    const userChars = allCampaignCharacters.filter(c => c.user_id === currentUserId);

    if (!isMaster) {
      // Jogador comum:
      // Se possuir exatamente 1 personagem -> seleciona-o automaticamente
      if (userChars.length === 1) {
        return userChars[0];
      }
      // Se possuir vários personagens -> seleciona o último válido ou o primeiro próprio
      if (userChars.length > 1) {
        const match = userChars.find(c => c.id === savedCharId);
        return match || userChars[0];
      }
      // Se possuir 0 personagens -> NUNCA seleciona o de outro jogador
      return null;
    } else {
      // Mestre:
      if (savedCharId) {
        const match = allCampaignCharacters.find(c => c.id === savedCharId);
        if (match) return match;
      }
      if (userChars.length > 0) return userChars[0];
      return allCampaignCharacters.length > 0 ? allCampaignCharacters[0] : null;
    }
  }

  const charBob = { id: 'char-bob', user_id: 'user-bob', name: 'Guerreiro de Bob' };
  const charAlice1 = { id: 'char-alice-1', user_id: 'user-alice', name: 'Maga Alice 1' };
  const charAlice2 = { id: 'char-alice-2', user_id: 'user-alice', name: 'Ladina Alice 2' };
  const charCharlie = { id: 'char-charlie', user_id: 'user-charlie', name: 'Paladino Charlie' };

  const allChars = [charBob, charAlice1, charAlice2, charCharlie];

  // Cenário 1: Jogador (Bob) possui exatamente 1 personagem na campanha
  // Deve selecionar automaticamente o dele, mesmo que outros personagens existam
  const bobSelection = resolveSelectedCharacter(allChars, 'user-bob', false, null);
  assert.strictEqual(bobSelection?.id, 'char-bob');

  // Cenário 2: Jogador (Alice) possui vários personagens (Alice 1 e Alice 2)
  // Sem escolha prévia -> seleciona o primeiro próprio (Alice 1)
  const aliceFirstSelection = resolveSelectedCharacter(allChars, 'user-alice', false, null);
  assert.strictEqual(aliceFirstSelection?.id, 'char-alice-1');

  // Com escolha prévia salva (Alice 2) -> restaura a última escolha válida dela
  const aliceSavedSelection = resolveSelectedCharacter(allChars, 'user-alice', false, 'char-alice-2');
  assert.strictEqual(aliceSavedSelection?.id, 'char-alice-2');

  // Com escolha prévia inválida (ex: personagem que foi apagado ou pertence a outro)
  const aliceInvalidSelection = resolveSelectedCharacter(allChars, 'user-alice', false, 'char-bob');
  // NÃO pode selecionar o do Bob! Deve cair de volta para um personagem da própria Alice
  assert.strictEqual(aliceInvalidSelection?.id, 'char-alice-1');

  // Cenário 3: Jogador novo (Daniel) sem nenhum personagem criado na campanha
  // NUNCA deve auto-selecionar o personagem do Bob ou de ninguém!
  const danielSelection = resolveSelectedCharacter(allChars, 'user-daniel', false, null);
  assert.strictEqual(danielSelection, null, 'Jogador sem personagem nunca deve ter personagem de terceiros auto-selecionado');

  // Cenário 4: Mestre da campanha
  // Mestre pode selecionar qualquer personagem ou restaurar o último inspecionado
  const masterSavedSelection = resolveSelectedCharacter(allChars, 'user-master', true, 'char-charlie');
  assert.strictEqual(masterSavedSelection?.id, 'char-charlie');
});

test('7.3 Validação de segurança no backend para operações em personagens alheios', async () => {
  const db = getDatabase(':memory:');
  const appCtx = createApp(db);
  const authService = new AuthService(db);
  const campaignService = new CampaignService(db, appCtx.rulesService);
  const characterService = new CharacterService(db, appCtx.rulesService);
  const inventoryService = new InventoryService(db, appCtx.rulesService, characterService);

  // 1. Criar Mestre e Jogadores
  const master = authService.register({ email: 'mestre@sec.com', username: 'MestreSec', password: 'password123' });
  const playerA = authService.register({ email: 'playerA@sec.com', username: 'PlayerA', password: 'password123' });
  const playerB = authService.register({ email: 'playerB@sec.com', username: 'PlayerB', password: 'password123' });

  const camp = campaignService.createCampaign(master.user.id, { name: 'Campanha de Segurança' });
  const invite = campaignService.createInvite(camp.id, { role: 'player' });
  campaignService.joinCampaignByInvite(invite.code, playerA.user.id);
  campaignService.joinCampaignByInvite(invite.code, playerB.user.id);

  // Personagem do Player A
  const charA = characterService.createCharacter(camp.id, playerA.user.id, { name: 'Personagem de A' });
  // Personagem do Player B
  const charB = characterService.createCharacter(camp.id, playerB.user.id, { name: 'Personagem de B' });

  // Adicionar item legítimo para A
  const itemA = inventoryService.addItemToCharacter(camp.id, charA.id, {
    itemName: 'Diário de A',
    category: 'geral',
    quantity: 1,
    weight: 0.5
  }, true);

  const server = appCtx.app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // 1. Player B tenta adicionar item no inventário de Player A -> 403 Forbidden
    const addRes = await fetch(`${baseUrl}/api/campaigns/${camp.id}/characters/${charA.id}/inventory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${playerB.token}`
      },
      body: JSON.stringify({ itemName: 'Veneno Injetado', category: 'geral', quantity: 1 })
    });
    assert.strictEqual(addRes.status, 403);

    // 2. Player B tenta alterar item de Player A -> 403 Forbidden
    const patchRes = await fetch(`${baseUrl}/api/campaigns/${camp.id}/characters/${charA.id}/inventory/${itemA.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${playerB.token}`
      },
      body: JSON.stringify({ quantity: 10 })
    });
    assert.strictEqual(patchRes.status, 403);

    // 3. Player B tenta remover item de Player A -> 403 Forbidden
    const delRes = await fetch(`${baseUrl}/api/campaigns/${camp.id}/characters/${charA.id}/inventory/${itemA.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${playerB.token}`
      }
    });
    assert.strictEqual(delRes.status, 403);

    // 4. Player B tenta transferir item de Player A para ele mesmo -> 400 ou 403 (deve ser rejeitado)
    const transferRes = await fetch(`${baseUrl}/api/campaigns/${camp.id}/characters/${charA.id}/inventory/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${playerB.token}`
      },
      body: JSON.stringify({
        inventoryItemId: itemA.id,
        targetCharacterId: charB.id,
        quantity: 1
      })
    });
    assert.strictEqual(transferRes.status, 400);
    const transferData = await transferRes.json();
    assert.ok(transferData.error.includes('seus próprios personagens'));
  } finally {
    server.close();
  }
});
