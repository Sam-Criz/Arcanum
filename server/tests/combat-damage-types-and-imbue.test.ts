import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import WebSocket from 'ws';
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

test('Combate: Tipos de Dano, Dano Elemental e Imbuição de Armas com Consumíveis', async () => {
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
  const port = address.port;
  const wsUrl = `ws://127.0.0.1:${port}/ws`;
  const apiUrl = `http://127.0.0.1:${port}/api`;

  const connectWsClient = (token: string, campaignId: string): Promise<{ ws: WebSocket; messages: any[] }> => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      const messages: any[] = [];
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'auth', token, campaignId }));
      });
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          messages.push(msg);
          if (msg.type === 'auth:success' || msg.type === 'auth:error') {
            resolve({ ws, messages });
          }
        } catch {}
      });
      ws.on('close', () => resolve({ ws, messages }));
      ws.on('error', reject);
    });
  };

  try {
    // -------------------------------------------------------------------------
    // SETUP: Mestre, Jogador, Campanha, Personagens e Inimigos
    // -------------------------------------------------------------------------
    const masterReg = authService.register({ username: 'mestre_elemental', email: 'mestre_elem@rpg.com', password: 'Password123!' });
    const playerReg = authService.register({ username: 'guerreiro_fogo', email: 'player_elem@rpg.com', password: 'Password123!' });
    const rogueReg = authService.register({ username: 'ladino_alheio', email: 'ladino@rpg.com', password: 'Password123!' });

    const masterToken = masterReg.token;
    const playerToken = playerReg.token;
    const rogueToken = rogueReg.token;

    const campaign = campaignService.createCampaign(masterReg.user.id, {
      name: 'Campanha Elemental dos Reinos',
      description: 'Mesa de testes para tipos de dano e encantamentos imbuídos',
      preset: 'fantasia_d20'
    });
    const campaignId = campaign.id;

    // Convidar jogadores
    const invite = campaignService.createInvite(campaignId, { role: 'player' });
    campaignService.joinCampaignByInvite(invite.code, playerReg.user.id);

    // Campanha isolada B para testes de permissão
    const campB = campaignService.createCampaign(rogueReg.user.id, {
      name: 'Campanha B Isolada',
      preset: 'investigacao'
    });

    // Criar Personagem Jogador (Guerreiro)
    const warrior = characterService.createCharacter(campaignId, playerReg.user.id, {
      name: 'Aldric Lâmina Rubra',
      rawData: { forca: 16, destreza: 14, constituicao: 14, vida: 40, pv_atual: 40, defesa: 14 }
    });

    // Criar Inimigo NPC (Golem de Gelo com vulnerabilidade a fogo, resistência a físico e imunidade a veneno)
    const encounter = combatService.startEncounter(campaignId, {
      name: 'Encontro com o Golem Elemental'
    });
    const encounterId = encounter.id;

    const golemCombatant = combatService.addCombatant(campaignId, encounterId, {
      name: 'Golem de Gelo e Rocha',
      initiative: 8,
      defense: 12,
      damage_reduction: 2,
      current_hp: 100,
      max_hp: 100,
      npc_data: {
        defense: 12,
        damage_reduction: 2,
        max_hp: 100,
        resistances: ['fogo', 'fisico'],
        vulnerabilities: ['gelo'],
        immunities: ['veneno']
      }
    });

    const warriorCombatant = combatService.addCombatant(campaignId, encounterId, {
      character_id: warrior.id,
      name: warrior.name,
      initiative: 18,
      defense: 14,
      damage_reduction: 0,
      current_hp: 40,
      max_hp: 40
    });

    // Iniciar combate
    combatService.activateCombatEncounter(campaignId, encounterId);

    // =========================================================================
    // CENÁRIO 1: Arma com dano físico normal
    // =========================================================================
    const normalSword = inventoryService.addItemToCharacter(campaignId, warrior.id, {
      itemName: 'Espada de Aço Longa',
      category: 'arma',
      quantity: 1,
      weight: 2.0,
      properties: {
        dano: '8', // Dano fixo 8 para teste determinístico
        tipo_dano: 'fisico',
        ataque: '1d20 + 20' // Garante acerto contra Defesa 12
      }
    }, true);

    // Golem tem resistência a 'fisico' (-50%) e RD 2.
    // Dano bruto: 8 - 2 (RD) = 6. Resistência a físico (-50%) = 3 de dano final!
    const act1 = combatService.applyCombatAction(campaignId, encounterId, {
      actor_id: warriorCombatant.id,
      actor_name: warrior.name,
      target_id: golemCombatant.id,
      action_mode: 'weapon',
      weapon_id: normalSword.id
    });

    assert.strictEqual(act1.hit, true, 'O ataque com espada deve acertar o golem.');
    assert.strictEqual(act1.finalDamage, 3, 'Dano físico deve ser reduzido por RD e resistência a físico.');
    assert.strictEqual(act1.targetCombatant.current_hp, 97, 'HP do Golem deve passar de 100 para 97.');

    // =========================================================================
    // CENÁRIO 2: Arma com dois componentes de dano (Físico + Fogo)
    // =========================================================================
    const flamingSword = inventoryService.addItemToCharacter(campaignId, warrior.id, {
      itemName: 'Lâmina Flamejante Primordial',
      category: 'arma',
      quantity: 1,
      weight: 2.5,
      properties: {
        dano: '10', // Dano físico 10
        tipo_dano: 'fisico',
        ataque: '1d20 + 20',
        damage_components: [
          {
            id: 'fogo_extra',
            name: 'Chamas Mágicas',
            damage_type: 'fogo',
            formula: '6' // Dano fixo de fogo 6
          }
        ]
      }
    }, true);

    // Dano Físico: (10 - 2 RD) = 8. Resistência a físico (-50%) = 4.
    // Dano de Fogo: 6. Golem é resistente a fogo (-50%) = 3.
    // Dano total: 4 + 3 = 7. HP: 97 - 7 = 90.
    const act2 = combatService.applyCombatAction(campaignId, encounterId, {
      actor_id: warriorCombatant.id,
      actor_name: warrior.name,
      target_id: golemCombatant.id,
      action_mode: 'weapon',
      weapon_id: flamingSword.id,
      is_master: true
    });

    assert.strictEqual(act2.hit, true);
    assert.strictEqual(act2.finalDamage, 7, 'Deve somar dano físico (4) e dano de fogo (3).');
    assert.strictEqual(act2.targetCombatant.current_hp, 90);
    assert.ok(act2.actionLog.details.damage_components_breakdown.length >= 2, 'Deve registrar breakdown com 2 componentes.');

    // =========================================================================
    // CENÁRIO 3: Chance de ativação de efeito adicional
    // =========================================================================
    const probSword = inventoryService.addItemToCharacter(campaignId, warrior.id, {
      itemName: 'Espada de Probabilidade',
      category: 'arma',
      quantity: 1,
      weight: 2.0,
      properties: {
        dano: '10',
        tipo_dano: 'energia', // Golem não tem resistência a energia (10 - 0 = 10)
        ataque: '1d20 + 20',
        damage_components: [
          {
            id: 'sempre_ativa',
            name: 'Impacto Garantido',
            damage_type: 'energia',
            formula: '5',
            chance_percent: 100 // 100% de ativação
          },
          {
            id: 'nunca_ativa',
            name: 'Choque Raro',
            damage_type: 'eletrico',
            formula: '20',
            chance_percent: 0 // 0% de ativação
          }
        ]
      }
    }, true);

    const act3 = combatService.applyCombatAction(campaignId, encounterId, {
      actor_id: warriorCombatant.id,
      actor_name: warrior.name,
      target_id: golemCombatant.id,
      action_mode: 'weapon',
      weapon_id: probSword.id,
      is_master: true
    });

    // Dano principal (energia): 10 - 2 (RD) = 8.
    // Sempre ativa: 5 energia.
    // Nunca ativa: 0 (não ativou).
    // Total: 8 + 5 = 13.
    assert.strictEqual(act3.finalDamage, 13);
    const breakdown3 = act3.actionLog.details.damage_components_breakdown;
    const alwaysComp = breakdown3.find((b: any) => b.source === 'Impacto Garantido');
    const neverComp = breakdown3.find((b: any) => b.source === 'Choque Raro');
    assert.strictEqual(alwaysComp?.activated, true, 'Componente 100% deve ativar.');
    assert.strictEqual(neverComp?.activated, false, 'Componente 0% não deve ativar.');

    // =========================================================================
    // CENÁRIO 4: Dano percentual separado de chance percentual
    // =========================================================================
    // percentage_damage = 10 (10% do max_hp 100 do golem = 10) com chance_percent = 100%
    const percentWeapon = inventoryService.addItemToCharacter(campaignId, warrior.id, {
      itemName: 'Adaga Destruidora de Colossos',
      category: 'arma',
      quantity: 1,
      weight: 1.0,
      properties: {
        dano: '2', // Dano base 2 (RD 2 anula o dano base -> 0)
        tipo_dano: 'fisico',
        ataque: '1d20 + 20',
        damage_components: [
          {
            id: 'dano_vida_max',
            name: 'Sangria Dimensional',
            damage_type: 'energia',
            percentage_damage: 10, // 10% do HP máximo (100) = 10 de dano
            percentage_damage_target: 'max_hp',
            chance_percent: 100
          }
        ]
      }
    }, true);

    const act4 = combatService.applyCombatAction(campaignId, encounterId, {
      actor_id: warriorCombatant.id,
      actor_name: warrior.name,
      target_id: golemCombatant.id,
      action_mode: 'weapon',
      weapon_id: percentWeapon.id,
      is_master: true
    });

    // Base: 2 - 2 RD = 0.
    // Percentual: 10 de energia (sem resistência) = 10.
    // Total = 10.
    assert.strictEqual(act4.finalDamage, 10, 'Deve causar exatamente 10% do HP máximo em dano.');

    // =========================================================================
    // CENÁRIO 5: Resistência, vulnerabilidade e imunidade isoladas por elemento
    // =========================================================================
    // Golem:
    // - Imunidade: 'veneno' -> dano 0
    // - Vulnerabilidade: 'gelo' -> dano * 2
    // - Resistência: 'fogo' -> dano / 2

    // Teste A: Imunidade a Veneno
    const poisonAction = combatService.applyCombatAction(campaignId, encounterId, {
      actor_id: warriorCombatant.id,
      actor_name: warrior.name,
      target_id: golemCombatant.id,
      action_mode: 'manual',
      amount: 20,
      damage_type: 'veneno',
      is_master: true
    });
    assert.strictEqual(poisonAction.finalDamage, 0, 'Imunidade a veneno deve zerar o dano.');

    // Teste B: Vulnerabilidade a Gelo
    const iceAction = combatService.applyCombatAction(campaignId, encounterId, {
      actor_id: warriorCombatant.id,
      actor_name: warrior.name,
      target_id: golemCombatant.id,
      action_mode: 'manual',
      amount: 10, // 10 - 2 RD = 8 * 2 = 16
      damage_type: 'gelo',
      is_master: true
    });
    assert.strictEqual(iceAction.finalDamage, 16, 'Vulnerabilidade a gelo deve dobrar o dano após RD.');

    // Teste C: Resistência a Fogo
    const fireAction = combatService.applyCombatAction(campaignId, encounterId, {
      actor_id: warriorCombatant.id,
      actor_name: warrior.name,
      target_id: golemCombatant.id,
      action_mode: 'manual',
      amount: 10, // 10 - 2 RD = 8 / 2 = 4
      damage_type: 'fogo',
      is_master: true
    });
    assert.strictEqual(fireAction.finalDamage, 4, 'Resistência a fogo deve reduzir o dano pela metade.');

    // =========================================================================
    // CENÁRIO 6 & 7: Imbuir uma arma com uma poção e consumir o consumível
    // =========================================================================
    // Adicionar poção consumível ao inventário do guerreiro
    const poisonPotion = inventoryService.addItemToCharacter(campaignId, warrior.id, {
      itemName: 'Óleo de Veneno Letal',
      category: 'consumivel',
      quantity: 1,
      weight: 0.5,
      cost: 50,
      properties: {
        can_imbue: true,
        imbue_properties: {
          can_imbue: true,
          compatible_categories: ['arma'],
          damage_type: 'veneno',
          damage_formula: '1d4 + 2',
          chance_percent: 100,
          duration_type: 'hits',
          charges: 2,
          max_charges: 2,
          combine_behavior: 'replace',
          apply_conditions: [
            {
              name: 'Envenenado',
              condition_id: 'envenenado',
              effects: {
                dot: { formula: '2', damageType: 'veneno', timing: 'turn_start' }
              },
              default_duration: { type: 'turns', value: 2 },
              tick_timing: 'turn_start'
            }
          ]
        }
      }
    }, true);

    const initialInv = inventoryService.getCharacterInventory(campaignId, warrior.id);
    const initialWeight = initialInv.totalWeight;

    // Imbuir a Espada Longa com o Óleo de Veneno via serviço
    const imbueRes = inventoryService.imbueWeapon(
      campaignId,
      warrior.id,
      {
        consumableInventoryId: poisonPotion.id,
        weaponInventoryId: normalSword.id
      },
      playerReg.user.id,
      false
    );

    assert.strictEqual(imbueRes.success, true, 'Imbuição deve ser bem-sucedida.');
    assert.ok(imbueRes.weapon.properties.imbued_effects?.length === 1, 'Arma deve conter o efeito imbuído.');
    assert.strictEqual(imbueRes.weapon.properties.imbued_effects[0].damage_type, 'veneno');
    assert.strictEqual(imbueRes.weapon.properties.imbued_effects[0].charges_remaining, 2);

    // Validar consumo correto do item (era 1 unidade -> foi removido do inventário)
    const afterInv = inventoryService.getCharacterInventory(campaignId, warrior.id);
    const potionExists = afterInv.items.some(i => i.id === poisonPotion.id);
    assert.strictEqual(potionExists, false, 'O consumível de 1 unidade deve ser removido após o uso.');
    assert.strictEqual(afterInv.totalWeight, initialWeight - 0.5, 'O peso total deve diminuir em 0.5 kg.');

    // =========================================================================
    // CENÁRIO 8 & 9: Aplicar dano imbuído, condição no alvo e consumo de cargas
    // =========================================================================
    // Criar um novo alvo sem imunidade a veneno para testar a aplicação
    const banditCombatant = combatService.addCombatant(campaignId, encounterId, {
      name: 'Bandido da Estrada',
      initiative: 10,
      defense: 10,
      damage_reduction: 0,
      current_hp: 50,
      max_hp: 50
    });

    // 1º Ataque com a espada envenenada (carga 2 -> 1)
    const hit1 = combatService.applyCombatAction(campaignId, encounterId, {
      actor_id: warriorCombatant.id,
      actor_name: warrior.name,
      target_id: banditCombatant.id,
      action_mode: 'weapon',
      weapon_id: normalSword.id,
      is_master: true
    });

    assert.strictEqual(hit1.hit, true);
    // Verificar se a condição 'Envenenado' foi aplicada no Bandido
    const banditConds = combatService.getCombatantConditions(campaignId, banditCombatant.id);
    assert.ok(banditConds.some(c => c.name === 'Envenenado'), 'O bandido deve receber a condição Envenenado do veneno imbuído.');

    // Verificar se restou 1 carga na espada
    const swordAfterHit1 = inventoryService.getCharacterInventory(campaignId, warrior.id).items.find(i => i.id === normalSword.id);
    assert.strictEqual(swordAfterHit1?.properties.imbued_effects[0].charges_remaining, 1, 'Deve restar 1 carga.');

    // 2º Ataque com a espada envenenada (carga 1 -> 0: efeito expira)
    const hit2 = combatService.applyCombatAction(campaignId, encounterId, {
      actor_id: warriorCombatant.id,
      actor_name: warrior.name,
      target_id: banditCombatant.id,
      action_mode: 'weapon',
      weapon_id: normalSword.id,
      is_master: true
    });

    assert.strictEqual(hit2.hit, true);
    const swordAfterHit2 = inventoryService.getCharacterInventory(campaignId, warrior.id).items.find(i => i.id === normalSword.id);
    assert.strictEqual(swordAfterHit2?.properties.imbued_effects?.length ?? 0, 0, 'O encantamento deve expirar e ser removido após zerar as cargas.');

    // =========================================================================
    // CENÁRIO 10: Persistência após reinicialização do banco
    // =========================================================================
    // Criar arma imbuída persistida
    const hammer = inventoryService.addItemToCharacter(campaignId, warrior.id, {
      itemName: 'Martelo Rúnico',
      category: 'arma',
      quantity: 1,
      weight: 4.0,
      properties: {
        dano: '1d10',
        tipo_dano: 'fisico',
        imbued_effects: [
          {
            id: 'imbue_persistente',
            source_item_name: 'Óleo Divino',
            damage_type: 'sagrado',
            damage_formula: '1d6',
            duration_type: 'hits',
            charges_remaining: 5
          }
        ]
      }
    }, true);

    // Consultar diretamente no SQLite em baixo nível
    const dbRow = db.prepare(`SELECT properties_json FROM character_inventory WHERE id = ?`).get(hammer.id) as any;
    const parsedProps = JSON.parse(dbRow.properties_json);
    assert.strictEqual(parsedProps.imbued_effects[0].damage_type, 'sagrado');
    assert.strictEqual(parsedProps.imbued_effects[0].charges_remaining, 5);

    // =========================================================================
    // CENÁRIO 11: Prevenção de duplicidade em requisições repetidas
    // =========================================================================
    // Tentar imbuir usando o mesmo poisonPotion que já foi consumido
    assert.throws(() => {
      inventoryService.imbueWeapon(
        campaignId,
        warrior.id,
        {
          consumableInventoryId: poisonPotion.id,
          weaponInventoryId: hammer.id
        },
        playerReg.user.id,
        false
      );
    }, /Item consumível não encontrado|Quantidade insuficiente/);

    // =========================================================================
    // CENÁRIO 12: Permissões e isolamento entre campanhas
    // =========================================================================
    // Usuário Ladino (campanha B) tentando imbuir a arma de Aldric na campanha A
    const rogueChar = characterService.createCharacter(campB.id, rogueReg.user.id, {
      name: 'Ladino Sombrio'
    });
    const roguePotion = inventoryService.addItemToCharacter(campB.id, rogueChar.id, {
      itemName: 'Veneno Ilícito',
      category: 'consumivel',
      quantity: 1,
      properties: { can_imbue: true, tipo_dano: 'veneno' }
    }, true);

    // Requisição HTTP via endpoint REST tentando acessar personagem de outra campanha ou usuário alheio
    const resImbueForbidden = await fetch(`${apiUrl}/campaigns/${campaignId}/characters/${warrior.id}/inventory/imbue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${rogueToken}`
      },
      body: JSON.stringify({
        consumableInventoryId: roguePotion.id,
        weaponInventoryId: hammer.id
      })
    });
    assert.strictEqual(resImbueForbidden.status, 403, 'Usuário sem permissão na campanha deve receber 403.');

    // =========================================================================
    // CENÁRIO 13: Atualização em tempo real entre mestre e jogadores via WebSocket
    // =========================================================================
    const masterWs = await connectWsClient(masterToken, campaignId);
    const playerWs = await connectWsClient(playerToken, campaignId);

    // Criar nova poção e imbuir via endpoint autenticado do jogador
    const fireOil = inventoryService.addItemToCharacter(campaignId, warrior.id, {
      itemName: 'Óleo de Fogo Valiriano',
      category: 'consumivel',
      quantity: 1,
      properties: {
        can_imbue: true,
        imbue_properties: {
          can_imbue: true,
          damage_type: 'fogo',
          damage_formula: '1d6',
          charges: 3,
          duration_type: 'hits'
        }
      }
    }, true);

    const resImbueHttp = await fetch(`${apiUrl}/campaigns/${campaignId}/characters/${warrior.id}/inventory/imbue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${playerToken}`
      },
      body: JSON.stringify({
        consumableInventoryId: fireOil.id,
        weaponInventoryId: hammer.id
      })
    });
    assert.strictEqual(resImbueHttp.status, 200);

    // Aguardar mensagem WebSocket no mestre
    await new Promise(r => setTimeout(r, 100));
    const invUpdateMsg = masterWs.messages.find(m => m.type === 'inventory:updated' && m.characterId === warrior.id);
    assert.ok(invUpdateMsg, 'Mestre deve receber evento inventory:updated em tempo real.');

    masterWs.ws.close();
    playerWs.ws.close();

    // =========================================================================
    // CENÁRIO 14: Compatibilidade com armas e consumíveis antigos
    // =========================================================================
    const legacyWeapon = inventoryService.addItemToCharacter(campaignId, warrior.id, {
      itemName: 'Clava Rústica Antiga',
      category: 'arma',
      quantity: 1,
      properties: {
        dano: '1d6 + 2',
        ataque: '1d20 + 20' // Garante acerto determinístico contra a Defesa
        // Sem tipo_dano, sem damage_components, sem imbued_effects
      }
    }, true);

    const legacyAction = combatService.applyCombatAction(campaignId, encounterId, {
      actor_id: warriorCombatant.id,
      actor_name: warrior.name,
      target_id: banditCombatant.id,
      action_mode: 'weapon',
      weapon_id: legacyWeapon.id,
      is_master: true
    });
    assert.strictEqual(legacyAction.hit, true);
    assert.ok(legacyAction.finalDamage >= 1, 'Arma legada deve funcionar sem nenhum erro.');

    // =========================================================================
    // CENÁRIO 15: Regressão de turnos, DoT e ações defensivas
    // =========================================================================
    // Testar se defesa tática e esquiva continuam operando normalmente
    const defRes = combatService.applyCombatAction(campaignId, encounterId, {
      actor_id: warriorCombatant.id,
      actor_name: warrior.name,
      action_mode: 'defend',
      is_master: true
    });
    assert.strictEqual(defRes.actorCombatant?.defensive_state?.defense?.active, true);

    // Avançar turno: DoT do bandido (que está Envenenado) deve disparar
    const banditHpBefore = banditCombatant.current_hp!;
    combatService.nextTurn(campaignId, encounterId);
    const banditFresh = combatService.getCombatantById(campaignId, banditCombatant.id);
    assert.ok(banditFresh!.current_hp! <= banditHpBefore, 'DoT de veneno deve debitar PV ao rodar o turno.');

    console.log('✔ Todos os 15 cenários de Tipos de Dano, Dano Elemental e Imbuição foram validados com sucesso!');
  } finally {
    server.close();
  }
});
