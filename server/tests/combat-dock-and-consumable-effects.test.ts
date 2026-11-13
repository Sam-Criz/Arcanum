import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { getDatabase } from '../src/db/connection';
import { createApp } from '../src/app';
import { AuthService } from '../src/modules/auth/auth.service';
import { RbacService } from '../src/modules/permissions/rbac.service';
import { RealtimeServer } from '../src/modules/realtime/ws.server';
import { CampaignService } from '../src/modules/campaigns/campaign.service';
import { CharacterService } from '../src/modules/characters/character.service';
import { RulesService } from '../src/modules/rules-engine/rules.service';
import { VttService } from '../src/modules/vtt/vtt.service';
import { CombatService } from '../src/modules/combat/combat.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';

test('TDD: Dock Tático, Seleção de Aliados/Inimigos, Ações Universais e Efeitos de Consumíveis', async () => {
  const db = getDatabase(':memory:');
  const authService = new AuthService(db);
  const rbacService = new RbacService(db);
  const rulesService = new RulesService(db);
  const campaignService = new CampaignService(db, rulesService);
  const characterService = new CharacterService(db, rulesService);
  const inventoryService = new InventoryService(db, rulesService, characterService);
  const vttService = new VttService(db, characterService);
  const combatService = new CombatService(db, rulesService, characterService, inventoryService);

  const server = http.createServer();
  const realtimeServer = new RealtimeServer(server, authService, rbacService);
  realtimeServer.setVttService(vttService);
  const { app, setRealtimeServer } = createApp(db, realtimeServer);
  setRealtimeServer(realtimeServer);
  server.on('request', app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const apiUrl = `http://127.0.0.1:${address.port}/api`;

  try {
    // 1. Setup de Usuários e Campanha
    const masterRes = authService.register({ username: 'mestre_dock', email: 'mestre_dock@arcanum.test', password: 'password123' });
    const masterUser = masterRes.user;

    const playerRes = authService.register({ username: 'player_dock', email: 'player_dock@arcanum.test', password: 'password123' });
    const playerUser = playerRes.user;

    const campaign = campaignService.createCampaign(masterUser.id, {
      name: 'Campanha Dock Tático',
      preset: 'fantasia_d20'
    });
    const invite = campaignService.createInvite(campaign.id, { role: 'player' });
    campaignService.joinCampaignByInvite(invite.code, playerUser.id);

    // Configura regras de combate com condição envenenado no ruleset
    const existingConds = rulesService.getConditions(campaign.id);
    const envenenadoDef = {
      id: 'envenenado',
      name: 'Envenenado',
      description: 'Sofre dano contínuo de veneno.',
      default_duration: { type: 'turns' as const, value: 3 },
      tick_timing: 'turn_start' as const,
      effects: {
        dot: { formula: '1d4', damage_type: 'veneno' }
      }
    };
    if (existingConds.some(c => c.id === 'envenenado')) {
      rulesService.updateConditionDefinition(campaign.id, 'envenenado', envenenadoDef);
    } else {
      rulesService.addConditionDefinition(campaign.id, envenenadoDef);
    }

    // =========================================================================
    // CENÁRIO 1: Troca de selectedToken atualizando armas e habilidades no inventário
    // =========================================================================
    const charA = characterService.createCharacter(campaign.id, playerUser.id, {
      name: 'Guerreiro Arthur',
      raw_data: {
        vida_atual: 25,
        vida_max: 25,
        forca: 4,
        agilidade: 2,
        abilities: [
          { name: 'Golpe Preciso', cost: '1 PE', roll: '1d20+4', damage: '1d8+4 Cortante' }
        ]
      }
    });

    const charB = characterService.createCharacter(campaign.id, playerUser.id, {
      name: 'Maga Elena',
      raw_data: {
        vida_atual: 18,
        vida_max: 18,
        inteligencia: 5,
        agilidade: 3,
        abilities: [
          { name: 'Míssil Arcano', cost: '2 PE', roll: 'Automático', damage: '2d4+2 Místico' }
        ]
      }
    });

    // Item equipado do Char A: Espada de Aço
    inventoryService.addItemToCharacter(campaign.id, charA.id, {
      itemName: 'Espada de Aço',
      category: 'arma',
      quantity: 1,
      isEquipped: true,
      properties: { dano: '1d8+4', tipo: 'Arma Branca' }
    }, true);

    // Item equipado do Char B: Cajado Rúnico
    inventoryService.addItemToCharacter(campaign.id, charB.id, {
      itemName: 'Cajado Rúnico',
      category: 'arma',
      quantity: 1,
      isEquipped: true,
      properties: { dano: '1d6+2', tipo: 'Foco Mágico' }
    }, true);

    // Consulta o inventário do Guerreiro Arthur
    const invA = inventoryService.getCharacterInventory(campaign.id, charA.id);
    const equippedA = invA.items.filter(i => i.is_equipped === 1);
    assert.strictEqual(equippedA.length, 1);
    assert.strictEqual(equippedA[0].item_name, 'Espada de Aço');

    // Consulta o inventário da Maga Elena
    const invB = inventoryService.getCharacterInventory(campaign.id, charB.id);
    const equippedB = invB.items.filter(i => i.is_equipped === 1);
    assert.strictEqual(equippedB.length, 1);
    assert.strictEqual(equippedB[0].item_name, 'Cajado Rúnico');

    // As habilidades refletem o personagem selecionado
    assert.strictEqual(charA.raw_data.abilities[0].name, 'Golpe Preciso');
    assert.strictEqual(charB.raw_data.abilities[0].name, 'Míssil Arcano');

    // =========================================================================
    // CENÁRIO 2: Uso de consumível negativo (Veneno) aplicando condição e deduzindo quantidade
    // =========================================================================
    // Cria encontro de combate ativo
    const encounter = combatService.startEncounter(campaign.id, { name: 'Emboscada na Cripta' });
    const combHeroA = combatService.addCombatant(campaign.id, encounter.id, {
      name: 'Guerreiro Arthur',
      character_id: charA.id,
      current_hp: 25,
      max_hp: 25,
      initiative: 20
    });

    const combHeroB = combatService.addCombatant(campaign.id, encounter.id, {
      name: 'Maga Elena',
      character_id: charB.id,
      current_hp: 18,
      max_hp: 18,
      initiative: 15
    });

    const combEnemy = combatService.addCombatant(campaign.id, encounter.id, {
      name: 'Cultista das Sombras',
      is_npc: true,
      current_hp: 20,
      max_hp: 20,
      initiative: 10,
      npc_data: { faction: 'enemy', disposition: 'hostile' }
    });

    combatService.activateCombatEncounter(campaign.id, encounter.id);

    // Adiciona 2 Frascos de Veneno ao Guerreiro
    const poisonItem = inventoryService.addItemToCharacter(campaign.id, charA.id, {
      itemName: 'Frasco de Veneno Letal',
      category: 'consumivel',
      quantity: 2,
      properties: {
        dano: 3,
        tipo_dano: 'veneno',
        condition: 'envenenado',
        chance_percent: 100,
        action_cost: 'bonus'
      }
    }, true);

    // Guerreiro Arthur consome 1x Frasco de Veneno (auto-uso/teste de consumível)
    const poisonRes = combatService.applyCombatAction(campaign.id, encounter.id, {
      actor_id: combHeroA.id,
      actor_name: combHeroA.name,
      target_id: combHeroA.id,
      action_mode: 'consumable',
      consumable_item_id: poisonItem.id,
      user_id: playerUser.id
    });

    // Verificações do Efeito de Consumível:
    assert.strictEqual(poisonRes.hit, true);
    assert.strictEqual(poisonRes.finalDamage, 3);
    
    // Vida do Guerreiro deve ter caído de 25 para 22
    const updatedHeroA = combatService.getCombatantById(campaign.id, combHeroA.id)!;
    assert.strictEqual(updatedHeroA.current_hp, 22);

    // Condição "envenenado" deve estar presente no combatente
    const condEnvenenado = updatedHeroA.conditions.find(c => c.condition_id === 'envenenado');
    assert.ok(condEnvenenado, 'Guerreiro Arthur deve ter recebido a condição envenenado');

    // Quantidade de veneno no inventário deve ter caído de 2 para 1
    const invAfterPoison = inventoryService.getCharacterInventory(campaign.id, charA.id);
    const remainingPoison = invAfterPoison.items.find(i => i.id === poisonItem.id);
    assert.strictEqual(remainingPoison?.quantity, 1);

    // =========================================================================
    // CENÁRIO 3: Validação de seleção de aliado para ação de suporte/cura
    // =========================================================================
    // Adiciona Poção de Cura no inventário do Guerreiro
    const healPotion = inventoryService.addItemToCharacter(campaign.id, charA.id, {
      itemName: 'Poção de Cura Rápida',
      category: 'consumivel',
      quantity: 2,
      properties: {
        cura: 8,
        valid_targets: ['self', 'allies'],
        action_cost: 'bonus'
      }
    }, true);

    // A: Aplica no aliado (Maga Elena) -> Deve ter sucesso
    // Reseta ações do guerreiro para permitir novo teste
    combatService.resetCombatantActions(campaign.id, combHeroA.id, { main: 0, bonus: 0, reaction: 0, free: 0 });
    const healAllyRes = combatService.applyCombatAction(campaign.id, encounter.id, {
      actor_id: combHeroA.id,
      actor_name: combHeroA.name,
      target_id: combHeroB.id,
      action_mode: 'consumable',
      consumable_item_id: healPotion.id,
      user_id: playerUser.id
    });
    assert.strictEqual(healAllyRes.hit, true);
    assert.strictEqual(healAllyRes.actionLog.action_type, 'heal');

    // B: Tenta aplicar cura restrita a aliados no INIMIGO -> Deve lançar erro de Alvo Inválido
    combatService.resetCombatantActions(campaign.id, combHeroA.id, { main: 0, bonus: 0, reaction: 0, free: 0 });
    assert.throws(() => {
      combatService.applyCombatAction(campaign.id, encounter.id, {
        actor_id: combHeroA.id,
        actor_name: combHeroA.name,
        target_id: combEnemy.id,
        action_mode: 'consumable',
        consumable_item_id: healPotion.id,
        user_id: playerUser.id
      });
    }, /Alvo inválido/i);

    // =========================================================================
    // CENÁRIO 4: Execução de Defesa/Esquiva normal debitando a ação do turno
    // =========================================================================
    combatService.resetCombatantActions(campaign.id, combHeroA.id, { main: 0, bonus: 0, reaction: 0, free: 0 });
    
    // 4.1 Defesa Normal (Postura Defensiva)
    const defendRes = combatService.applyCombatAction(campaign.id, encounter.id, {
      actor_id: combHeroA.id,
      actor_name: combHeroA.name,
      action_mode: 'defend',
      action_cost: 'main',
      user_id: playerUser.id
    });

    assert.strictEqual(defendRes.hit, true);
    const heroAfterDefend = combatService.getCombatantById(campaign.id, combHeroA.id)!;
    assert.strictEqual(heroAfterDefend.actions_used.main, 1, 'Defesa Normal deve debitar 1 ação principal');
    assert.strictEqual(heroAfterDefend.defensive_state.defense?.active, true);
    assert.strictEqual(heroAfterDefend.defensive_state.defense?.value, 2, '+2 de Redução de Dano / Defesa');

    // 4.2 Tentar defender novamente no mesmo turno deve falhar por limite de ações atingido
    assert.throws(() => {
      combatService.applyCombatAction(campaign.id, encounter.id, {
        actor_id: combHeroA.id,
        actor_name: combHeroA.name,
        action_mode: 'defend',
        action_cost: 'main',
        user_id: playerUser.id
      });
    }, /Limite de ações atingido/i);

    // 4.3 Esquiva Normal (Reação)
    combatService.resetCombatantActions(campaign.id, combHeroA.id, { main: 1, bonus: 0, reaction: 0, free: 0 });
    const dodgeRes = combatService.applyCombatAction(campaign.id, encounter.id, {
      actor_id: combHeroA.id,
      actor_name: combHeroA.name,
      action_mode: 'dodge',
      action_cost: 'reaction',
      formula: '1d20 + 2',
      user_id: playerUser.id
    });

    assert.strictEqual(dodgeRes.hit, true);
    const heroAfterDodge = combatService.getCombatantById(campaign.id, combHeroA.id)!;
    assert.strictEqual(heroAfterDodge.actions_used.reaction, 1, 'Esquiva Normal deve debitar 1 reação');
    assert.strictEqual(heroAfterDodge.defensive_state.dodge?.active, true);
    assert.ok(heroAfterDodge.defensive_state.dodge?.effective_defense >= 10);
  } catch (err) {
    console.error('TEST ERROR IN combat-dock-and-consumable-effects:', err);
    throw err;
  } finally {
    server.close();
  }
});
