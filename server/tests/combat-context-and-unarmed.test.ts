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

test('Combate: Resolução Dinâmica de Ataque Desarmado, Variáveis de Contexto, Acentuação e Atomicidade', async () => {
  const db = getDatabase(':memory:');
  const authService = new AuthService(db);
  const rbacService = new RbacService(db);
  const rulesService = new RulesService(db);
  const campaignService = new CampaignService(db, rulesService);
  const characterService = new CharacterService(db, rulesService);
  const vttService = new VttService(db, characterService);
  const combatService = new CombatService(db, rulesService, characterService);

  const server = http.createServer();
  const realtimeServer = new RealtimeServer(server, authService, rbacService);
  realtimeServer.setVttService(vttService);
  const { app, setRealtimeServer } = createApp(db, realtimeServer);
  setRealtimeServer(realtimeServer);
  server.on('request', app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const port = address.port;
  const apiUrl = `http://127.0.0.1:${port}/api`;

  try {
    // 1. Criar Mestre e Jogador
    const master = authService.register({ email: 'mestre_combate@rpg.com', username: 'MestreCombate', password: 'password123' });
    const player = authService.register({ email: 'player_combate@rpg.com', username: 'PlayerCombate', password: 'password123' });

    // 2. Criar Campanha e convidar jogador
    const campaign = campaignService.createCampaign(master.user.id, { name: 'Campanha Teste Combate', ruleset_id: 'investigacao' });
    const invite = campaignService.createInvite(campaign.id, { role: 'player' });
    campaignService.joinCampaignByInvite(invite.code, player.user.id);

    // 3. Criar Personagem do jogador SEM ARMAS no inventário e com atributos acentuados (Força: 4, Destreza: 2) SEM "agilidade"
    const char = characterService.createCharacter(campaign.id, player.user.id, {
      name: 'Ragnar',
      rawData: {
        vida_atual: 25,
        vida_maxima: 25,
        mana: 15,
        'Força': 4,
        'Destreza': 2,
        'Constituição': 3
      }
    });

    // 4. Iniciar combate e adicionar Ragnar e o Monstro Krug
    const encounter = combatService.startEncounter(campaign.id, { name: 'Emboscada de Krug' });

    const charCombatant = combatService.addCombatant(campaign.id, encounter.id, {
      character_id: char.id,
      name: 'Ragnar',
      current_hp: 25,
      max_hp: 25,
      initiative_formula: '1d20 + 2',
      defense: 12,
      damage_reduction: 1,
      is_npc: false
    });

    const krugCombatant = combatService.addCombatant(campaign.id, encounter.id, {
      name: 'Krug, o Ogre',
      current_hp: 40,
      max_hp: 40,
      initiative_formula: '1d20 + 1',
      defense: 10,
      damage_reduction: 2,
      npc_data: {
        forca: 5,
        destreza: 1,
        vitalidade: 4,
        defense: 10,
        damage_reduction: 2
      },
      is_npc: true
    });

    // ========================================================
    // CASO 1: Ataque Desarmado sem Armas no Inventário
    // Anteriormente falhava com: "Variável 'agilidade' não foi fornecida no contexto"
    // ========================================================
    const unarmedRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encounter.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${player.token}` },
      body: JSON.stringify({
        action_mode: 'weapon',
        action_type: 'attack',
        actor_id: charCombatant.id,
        target_id: krugCombatant.id
        // Sem weapon_id e sem fórmulas fixadas: backend deve resolver ataque desarmado dinamicamente
      })
    });

    assert.strictEqual(unarmedRes.status, 200, 'Ataque desarmado deve ser aceito sem erro de variável agilidade');
    const unarmedData = await unarmedRes.json();
    assert.ok(unarmedData.actionLog, 'Deve retornar log da ação');
    assert.strictEqual(typeof unarmedData.hit, 'boolean');
    assert.ok(unarmedData.targetCombatant, 'Deve retornar combatente alvo atualizado');

    // ========================================================
    // CASO 2: Normalização de Acentos e Casing no Contexto de Variáveis
    // Atributo 'Força' deve ser acessível tanto como 'forca' quanto 'Força'
    // ========================================================
    const accentedAbilityRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encounter.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${player.token}` },
      body: JSON.stringify({
        action_mode: 'ability',
        ability_name: 'Pancada com Força',
        actor_id: charCombatant.id,
        target_id: krugCombatant.id,
        formula: '1d6 + forca',
        attack_formula: '1d20 + forca'
      })
    });

    assert.strictEqual(accentedAbilityRes.status, 200, 'Variável "forca" deve resolver atributo "Força" da ficha');
    const accentedData = await accentedAbilityRes.json();
    assert.ok(accentedData.attackRoll, 'Deve rolar ataque com forca');

    // ========================================================
    // CASO 3: Formula com Variável Alvo (Defesa, RD, etc.)
    // ========================================================
    const targetVarRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encounter.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${player.token}` },
      body: JSON.stringify({
        action_mode: 'ability',
        ability_name: 'Golpe Penetrante',
        actor_id: charCombatant.id,
        target_id: krugCombatant.id,
        formula: '10 - alvo_rd',
        attack_formula: '20'
      })
    });
    assert.strictEqual(targetVarRes.status, 200, 'Deve resolver alvo_rd injetado no contexto');

    // ========================================================
    // CASO 4: Variável Inexistente deve Produzir Erro Explícito Descritivo (Não assume 0)
    // ========================================================
    const missingVarRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encounter.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${player.token}` },
      body: JSON.stringify({
        action_mode: 'ability',
        ability_name: 'Golpe Místico Inexistente',
        actor_id: charCombatant.id,
        target_id: krugCombatant.id,
        formula: '2d6',
        attack_formula: '1d20 + atributo_fantasma_inexistente'
      })
    });

    assert.strictEqual(missingVarRes.status, 400, 'Variável inexistente deve retornar erro 400');
    const missingVarData = await missingVarRes.json();
    assert.ok(
      missingVarData.error.includes("Variável 'atributo_fantasma_inexistente'") ||
      missingVarData.error.includes("atributo_fantasma_inexistente"),
      'Erro deve informar explicitamente o nome da variável faltante'
    );
    assert.ok(
      missingVarData.error.toLowerCase().includes('disponíveis'),
      'Erro deve listar variáveis disponíveis no contexto'
    );

    // ========================================================
    // CASO 5: Atomicidade e Rollback em Falhas de Avaliação
    // Se a fórmula falhar por erro de sintaxe ou variável ausente,
    // o recurso (mana) NÃO deve ser consumido e o PV não deve ser alterado.
    // ========================================================
    const initialCharRow = db.prepare('SELECT computed_data_json FROM characters WHERE id = ?').get(char.id) as any;
    const initialMana = JSON.parse(initialCharRow.computed_data_json).mana;
    const initialKrugHp = combatService.getCombatantById(campaign.id, krugCombatant.id)!.current_hp;

    const failedResourceActionRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encounter.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${player.token}` },
      body: JSON.stringify({
        action_mode: 'ability',
        ability_name: 'Feitiço Falho',
        actor_id: charCombatant.id,
        target_id: krugCombatant.id,
        resource_cost_name: 'mana',
        resource_cost_amount: 5,
        formula: '3d8 + variavel_que_nao_existe',
        attack_formula: '20'
      })
    });

    assert.strictEqual(failedResourceActionRes.status, 400);

    // Verificar que a mana NÃO mudou após a falha
    const checkCharRow = db.prepare('SELECT computed_data_json FROM characters WHERE id = ?').get(char.id) as any;
    const checkMana = JSON.parse(checkCharRow.computed_data_json).mana;
    assert.strictEqual(checkMana, initialMana, 'Mana não deve ser descontada quando a avaliação da fórmula falha');

    // Verificar que o PV de Krug NÃO mudou
    const checkKrug = combatService.getCombatantById(campaign.id, krugCombatant.id)!;
    assert.strictEqual(checkKrug.current_hp, initialKrugHp, 'PV do alvo não deve mudar quando a ação falha');

    // ========================================================
    // CASO 6: Campanha com outro Sistema de Regras (Fantasia d20 com Destreza)
    // ========================================================
    const d20Campaign = campaignService.createCampaign(master.user.id, { name: 'Mundo Fantasia d20', ruleset_id: 'fantasia_d20' });
    const d20Invite = campaignService.createInvite(d20Campaign.id, { role: 'player' });
    campaignService.joinCampaignByInvite(d20Invite.code, player.user.id);

    const rogue = characterService.createCharacter(d20Campaign.id, player.user.id, {
      name: 'Ladino Silas',
      rawData: {
        pontos_vida: 18,
        pontos_vida_max: 18,
        destreza: 4,
        constituicao: 2
      }
    });

    const d20Encounter = combatService.startEncounter(d20Campaign.id, { name: 'Luta no Beco' });
    const rogueCombatant = combatService.addCombatant(d20Campaign.id, d20Encounter.id, {
      character_id: rogue.id,
      name: 'Silas',
      current_hp: 18,
      max_hp: 18,
      initiative_formula: '1d20 + destreza',
      defense: 14,
      is_npc: false
    });

    const goblin = combatService.addCombatant(d20Campaign.id, d20Encounter.id, {
      name: 'Goblin Espião',
      current_hp: 12,
      max_hp: 12,
      defense: 11,
      is_npc: true
    });

    // Ladino Silas ataca sem arma: fantasia_d20 usa destreza como atributo físico se forca não existir
    const d20UnarmedRes = await fetch(`${apiUrl}/campaigns/${d20Campaign.id}/combat/${d20Encounter.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${player.token}` },
      body: JSON.stringify({
        action_mode: 'weapon',
        action_type: 'attack',
        actor_id: rogueCombatant.id,
        target_id: goblin.id
      })
    });

    assert.strictEqual(d20UnarmedRes.status, 200, 'Ataque desarmado em fantasia_d20 deve resolver com sucesso');
    const d20UnarmedData = await d20UnarmedRes.json();
    assert.ok(d20UnarmedData.actionLog, 'Deve registrar o log de combate no sistema d20');

  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
