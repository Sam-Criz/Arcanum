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

test('Combate: Sistema de Turnos, Iniciativa Obrigatória, Economia de Ações, Defender e Esquivar', async () => {
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

  let masterClient: any = null;
  let p1Client: any = null;
  let p2Client: any = null;

  try {
    // 1. Criar Mestre e Jogadores
    const master = authService.register({ email: 'gm_turns@test.com', username: 'MestreTurns', password: 'password123' });
    const p1 = authService.register({ email: 'p1_turns@test.com', username: 'PlayerUm', password: 'password123' });
    const p2 = authService.register({ email: 'p2_turns@test.com', username: 'PlayerDois', password: 'password123' });

    // 2. Criar Campanha Fantasia D20 (tie_breaker: destreza, defense_effect: bonus_defense, skip_incapacitated: true)
    const campaign = campaignService.createCampaign(master.user.id, { name: 'Guerra dos Turnos', preset: 'fantasia_d20' });
    const invite = campaignService.createInvite(campaign.id, { role: 'player' });
    campaignService.joinCampaignByInvite(invite.code, p1.user.id);
    campaignService.joinCampaignByInvite(invite.code, p2.user.id);

    // Conectar WebSockets para validar sincronização em tempo real
    masterClient = await connectWsClient(master.token, campaign.id);
    p1Client = await connectWsClient(p1.token, campaign.id);
    p2Client = await connectWsClient(p2.token, campaign.id);

    masterClient.messages.length = 0;
    p1Client.messages.length = 0;
    p2Client.messages.length = 0;

    // 3. Criar Personagens
    // Valente (P1): Destreza 16 (+3), Força 14 (+2), HP 30
    const char1 = characterService.createCharacter(campaign.id, p1.user.id, {
      name: 'Valente',
      rawData: { vida_atual: 30, vida_maxima: 30, forca: 14, destreza: 16, constituicao: 12, sabedoria: 10, inteligencia: 10, carisma: 10 }
    });
    // Arqueira (P2): Destreza 18 (+4), HP 25
    const char2 = characterService.createCharacter(campaign.id, p2.user.id, {
      name: 'Arqueira',
      rawData: { vida_atual: 25, vida_maxima: 25, forca: 10, destreza: 18, constituicao: 10, sabedoria: 12, inteligencia: 12, carisma: 10 }
    });

    // 4. Iniciar Encontro de Combate em status 'prep'
    const startRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({ name: 'Emboscada na Floresta' })
    });
    assert.strictEqual(startRes.status, 201);
    const { encounter: encPrep } = await startRes.json();
    assert.strictEqual(encPrep.status, 'prep');
    assert.strictEqual(encPrep.round, 1);

    // 5. Adicionar Combatentes sem iniciativa inicial
    const addValenteRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encPrep.id}/combatants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({ character_id: char1.id, name: 'Valente' })
    });
    assert.strictEqual(addValenteRes.status, 201);
    const { combatant: cbValente } = await addValenteRes.json();

    const addArqueiraRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encPrep.id}/combatants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({ character_id: char2.id, name: 'Arqueira' })
    });
    assert.strictEqual(addArqueiraRes.status, 201);
    const { combatant: cbArqueira } = await addArqueiraRes.json();

    const addGoblinRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encPrep.id}/combatants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({
        name: 'Goblin Xamã',
        is_npc: true,
        current_hp: 15,
        max_hp: 15,
        defense: 12,
        damage_reduction: 1,
        npc_data: { destreza: 12, forca: 8 }
      })
    });
    assert.strictEqual(addGoblinRes.status, 201);
    const { combatant: cbGoblin } = await addGoblinRes.json();

    // ========================================================
    // 1. INICIATIVA OBRIGATÓRIA E DESEMPATE DETERMINÍSTICO (TIE-BREAKER)
    // ========================================================
    // Forçar empate de iniciativa para testar desempate determinístico por atributo
    // Valente: iniciativa 15, destreza 16 (tie_breaker = 16)
    // Goblin: iniciativa 15, destreza 12 (tie_breaker = 12)
    // Arqueira: iniciativa 20, destreza 18 (tie_breaker = 18)
    db.prepare('UPDATE combatants SET initiative = 15 WHERE id = ?').run(cbValente.id);
    db.prepare('UPDATE combatants SET initiative = 15 WHERE id = ?').run(cbGoblin.id);
    db.prepare('UPDATE combatants SET initiative = 20 WHERE id = ?').run(cbArqueira.id);

    // Ativação do combate pelo Mestre
    const activateRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encPrep.id}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({})
    });
    assert.strictEqual(activateRes.status, 200);
    const { encounter: encActive } = await activateRes.json();
    assert.strictEqual(encActive.status, 'active');
    assert.strictEqual(encActive.round, 1);
    assert.strictEqual(encActive.turn_index, 0);

    // Ordem deve ser estrita:
    // 1º Arqueira (init 20)
    // 2º Valente (init 15, tie 16)
    // 3º Goblin (init 15, tie 12)
    assert.strictEqual(encActive.combatants[0].name, 'Arqueira');
    assert.strictEqual(encActive.combatants[1].name, 'Valente');
    assert.strictEqual(encActive.combatants[2].name, 'Goblin Xamã');

    // Verificar tie_breaker calculado corretamente no banco de dados SQLite
    const valenteRow = db.prepare('SELECT tie_breaker FROM combatants WHERE id = ?').get(cbValente.id) as any;
    const goblinRow = db.prepare('SELECT tie_breaker FROM combatants WHERE id = ?').get(cbGoblin.id) as any;
    assert.strictEqual(Number(valenteRow.tie_breaker), 16);
    assert.strictEqual(Number(goblinRow.tie_breaker), 12);

    // Combatente inserido APÓS início de combate deve receber iniciativa válida imediatamente
    const addLateNpcRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encPrep.id}/combatants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({ name: 'Lobo Selvagem', is_npc: true, current_hp: 20, max_hp: 20 })
    });
    assert.strictEqual(addLateNpcRes.status, 201);
    const { combatant: cbLobo } = await addLateNpcRes.json();
    assert.ok(cbLobo.initiative > 0, 'Combatente inserido em combate ativo deve receber iniciativa válida imediatamente');
    assert.ok(cbLobo.tie_breaker !== undefined, 'Deve possuir tie_breaker calculado');

    // Limpar lobo para simplificar os testes de ciclo
    db.prepare('DELETE FROM combatants WHERE id = ?').run(cbLobo.id);

    // ========================================================
    // 2. ECONOMIA DE AÇÕES: AÇÃO FORA DO TURNO REJEITADA COM 400
    // ========================================================
    // O turno atual (índice 0) é de Arqueira.
    // Valente (Jogador 1) tenta atacar fora do seu turno: deve ser rejeitado com 400
    const outOfTurnRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encPrep.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p1.token}` },
      body: JSON.stringify({
        action_mode: 'ability',
        ability_name: 'Investida Precoce',
        actor_id: cbValente.id,
        target_id: cbGoblin.id,
        formula: '1d6 + 2'
      })
    });
    assert.strictEqual(outOfTurnRes.status, 400, 'Ação fora do turno deve ser rejeitada com 400');
    const outOfTurnData = await outOfTurnRes.json();
    assert.ok(outOfTurnData.error.includes('Não é o turno de Valente'));

    // Garantir que PV do Goblin não sofreu nenhuma alteração
    const checkGoblinHp = db.prepare('SELECT current_hp FROM combatants WHERE id = ?').get(cbGoblin.id) as any;
    assert.strictEqual(checkGoblinHp.current_hp, 15, 'Nenhum recurso deve ser consumido em ação rejeitada');

    // ========================================================
    // 3. AÇÃO DEFENSIVA: ESQUIVAR (DODGE)
    // ========================================================
    // Arqueira está no seu turno. Ela escolhe Esquivar.
    // Rolagem de Esquiva: 1d20 + Destreza (18 -> +4 ou valor 18)
    const dodgeRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encPrep.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p2.token}` },
      body: JSON.stringify({
        action_mode: 'dodge',
        actor_id: cbArqueira.id
      })
    });
    assert.strictEqual(dodgeRes.status, 200, 'Ação de esquiva deve ser aceita');
    const dodgeData = await dodgeRes.json();
    assert.ok(dodgeData.actorCombatant.defensive_state.dodge.active, 'Estado de esquiva deve estar ativo');
    assert.ok(dodgeData.actorCombatant.defensive_state.dodge.effective_defense >= 10, 'Defesa efetiva de esquiva deve ser >= 10');
    assert.strictEqual(dodgeData.actorCombatant.actions_used.main, 1, 'Esquiva deve consumir a ação principal');

    // ========================================================
    // 4. LIMITE DE AÇÕES: 2ª AÇÃO NO MESMO TURNO REJEITADA COM 400
    // ========================================================
    // Arqueira tenta realizar um ataque após já ter usado sua ação principal neste turno
    const secondActionRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encPrep.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p2.token}` },
      body: JSON.stringify({
        action_mode: 'ability',
        ability_name: 'Tiro Rápido Ilegal',
        actor_id: cbArqueira.id,
        target_id: cbGoblin.id,
        formula: '1d8'
      })
    });
    assert.strictEqual(secondActionRes.status, 400, 'Segunda ação principal no mesmo turno deve ser rejeitada com 400');
    const secondActionData = await secondActionRes.json();
    assert.ok(secondActionData.error.includes('Limite de ações atingido'));

    // ========================================================
    // 5. AVANÇO DE TURNO (END-TURN PELO JOGADOR DO TURNO)
    // ========================================================
    // Arqueira encerra seu turno via POST /end-turn
    const endTurnRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encPrep.id}/end-turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p2.token}` },
      body: JSON.stringify({})
    });
    assert.strictEqual(endTurnRes.status, 200);
    const { encounter: encTurnValente } = await endTurnRes.json();
    assert.strictEqual(encTurnValente.turn_index, 1, 'Turno deve avançar para o 2º combatente (Valente)');
    assert.strictEqual(encTurnValente.combatants[1].name, 'Valente');
    assert.strictEqual(encTurnValente.combatants[1].actions_used.main, 0, 'Novo combatente ativo deve ter ações restauradas');

    // Jogador NÃO autorizado (P2) NÃO pode avançar o turno de Valente
    const unauthorizedEndTurnRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encPrep.id}/end-turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p2.token}` },
      body: JSON.stringify({})
    });
    assert.strictEqual(unauthorizedEndTurnRes.status, 403, 'Apenas o combatente ativo ou o Mestre pode encerrar o turno');

    // ========================================================
    // 6. AÇÃO DEFENSIVA: DEFENDER (DEFENSE STANCE)
    // ========================================================
    // Valente escolhe Defender no seu turno.
    // Em Fantasia D20, defender concede bonus_defense (+2 na Defesa)
    const defendRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encPrep.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p1.token}` },
      body: JSON.stringify({
        action_mode: 'defend',
        actor_id: cbValente.id
      })
    });
    assert.strictEqual(defendRes.status, 200, 'Ação de defender deve ser aceita');
    const defendData = await defendRes.json();
    assert.ok(defendData.actorCombatant.defensive_state.defense.active, 'Estado defensivo deve estar ativo');
    assert.strictEqual(defendData.actorCombatant.defensive_state.defense.value, 2, 'Bônus defensivo deve ser 2');
    assert.strictEqual(defendData.actorCombatant.actions_used.main, 1, 'Defender deve consumir ação principal');

    // Valente encerra seu turno
    await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encPrep.id}/end-turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p1.token}` },
      body: JSON.stringify({})
    });

    // ========================================================
    // 7. EFICÁCIA DE ESQUIVA E DEFESA CONTRA ATAQUES INCOMING
    // ========================================================
    // Agora é o turno do Goblin (índice 2). Mestre controla o NPC.
    const encGoblinTurn = combatService.getEncounterById(campaign.id, encPrep.id, true)!;
    assert.strictEqual(encGoblinTurn.turn_index, 2);
    assert.strictEqual(encGoblinTurn.combatants[2].name, 'Goblin Xamã');

    // Goblin ataca Valente (que está em Postura Defensiva: +2 Defesa)
    // Defesa base de Valente: 10. Com +2 de defesa por postura defensiva = 12.
    // Um ataque com total 11 (que acertaria a Defesa 10 base) agora deve ERRAR contra Defesa 12!
    const goblinAtkRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encPrep.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({
        action_mode: 'ability',
        ability_name: 'Lança Rústica',
        actor_id: cbGoblin.id,
        target_id: cbValente.id,
        attack_formula: '11', // 11 vs (10 base + 2 postura = 12) -> ERROU!
        formula: '10'
      })
    });
    assert.strictEqual(goblinAtkRes.status, 200);
    const goblinAtkData = await goblinAtkRes.json();
    assert.strictEqual(goblinAtkData.hit, false, 'Ataque 11 contra Defesa 10+2 deve errar');
    assert.strictEqual(goblinAtkData.targetCombatant.current_hp, 30, 'PV de Valente deve permanecer intacto');

    // ========================================================
    // 8. PULAR COMBATENTES INCAPACITADOS E INCREMENTO DE RODADA
    // ========================================================
    // Reduzir PV do Goblin para 0 para marcá-lo como incapacitado
    db.prepare('UPDATE combatants SET current_hp = 0 WHERE id = ?').run(cbGoblin.id);

    // Mestre avança o turno a partir do Goblin (índice 2)
    // O próximo na lista seria índice 0 (Arqueira), concluindo o ciclo da rodada 1 -> Rodada 2!
    const advanceToRound2Res = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encPrep.id}/next`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({})
    });
    assert.strictEqual(advanceToRound2Res.status, 200);
    const { encounter: encRound2 } = await advanceToRound2Res.json();
    assert.strictEqual(encRound2.round, 2, 'Rodada deve incrementar ao completar o ciclo');
    assert.strictEqual(encRound2.turn_index, 0, 'Turno deve retornar ao primeiro combatente (Arqueira)');

    // Expirar esquiva: ao iniciar novamente o turno de Arqueira, sua esquiva anterior expira
    assert.strictEqual(encRound2.combatants[0].defensive_state.dodge, undefined, 'Esquiva deve expirar no início do novo turno da Arqueira');

    // Avançar de Arqueira (0) para Valente (1)
    await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encPrep.id}/next`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({})
    });

    // Agora de Valente (1): o próximo seria Goblin (2, com HP 0).
    // Como skip_incapacitated está ativo, o turno deve PULAR o Goblin e ir direto para Arqueira (0), na Rodada 3!
    const skipIncapacitatedRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encPrep.id}/next`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({})
    });
    assert.strictEqual(skipIncapacitatedRes.status, 200);
    const { encounter: encSkip } = await skipIncapacitatedRes.json();
    assert.strictEqual(encSkip.turn_index, 0, 'Combatente com HP 0 deve ser pulado automaticamente');
    assert.strictEqual(encSkip.round, 3, 'Com o pulo para Arqueira, deve incrementar para Rodada 3');

    // ========================================================
    // 9. RETROCESSO DE TURNO (PREV-TURN) PELO MESTRE
    // ========================================================
    const prevTurnRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encPrep.id}/prev`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({})
    });
    assert.strictEqual(prevTurnRes.status, 200);
    const { encounter: encPrev } = await prevTurnRes.json();
    assert.strictEqual(encPrev.round, 2, 'Voltar turno deve retornar à rodada anterior quando aplicável');

    // ========================================================
    // 10. REINÍCIO MANUAL DE AÇÕES PELO MESTRE (PATCH ACTIONS)
    // ========================================================
    const resetActionRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encPrep.id}/combatants/${cbValente.id}/actions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({ actions: { main: 0, bonus: 0 } })
    });
    assert.strictEqual(resetActionRes.status, 200);
    const { combatant: cbValenteReset } = await resetActionRes.json();
    assert.strictEqual(cbValenteReset.actions_used.main, 0);

    // ========================================================
    // 11. MULTI-SISTEMA: INVESTIGAÇÃO (RD) E CYBERPUNK (REFLEXO)
    // ========================================================
    // Campanha de Investigação: Defender aplica +2 RD
    const campInvestigacao = campaignService.createCampaign(master.user.id, { name: 'Horror Arcano', preset: 'investigacao' });
    const investCfg = rulesService.getCombatRulesConfig(campInvestigacao.id);
    assert.strictEqual(investCfg.defense_effect.type, 'bonus_rd');
    assert.strictEqual(investCfg.tie_breaker_attr, 'agilidade');

    // Campanha Cyberpunk: tie_breaker reflexo
    const campCyber = campaignService.createCampaign(master.user.id, { name: 'Neon Shadows', preset: 'cyberpunk' });
    const cyberCfg = rulesService.getCombatRulesConfig(campCyber.id);
    assert.strictEqual(cyberCfg.tie_breaker_attr, 'reflexo');

    // ========================================================
    // 12. SINCRONIZAÇÃO EM TEMPO REAL VIA WEBSOCKETS (SEM F5)
    // ========================================================
    assert.ok(masterClient.messages.some((m: any) => m.type === 'combat:turn_advanced'), 'Mestre deve receber evento combat:turn_advanced');
    assert.ok(p1Client.messages.some((m: any) => m.type === 'combat:turn_advanced'), 'Jogador 1 deve receber evento combat:turn_advanced');
    assert.ok(p2Client.messages.some((m: any) => m.type === 'combat:turn_advanced'), 'Jogador 2 deve receber evento combat:turn_advanced');
    assert.ok(p1Client.messages.some((m: any) => m.type === 'combat:action_logged'), 'Jogador 1 deve receber evento combat:action_logged');

    // ========================================================
    // 13. PERSISTÊNCIA REAL NO BANCO DE DADOS SQLITE
    // ========================================================
    const finalEncRow = db.prepare('SELECT status, round, turn_index FROM combat_encounters WHERE id = ?').get(encPrep.id) as any;
    assert.strictEqual(finalEncRow.status, 'active');
    assert.strictEqual(typeof finalEncRow.round, 'number');
    assert.strictEqual(typeof finalEncRow.turn_index, 'number');

    const cbRows = db.prepare('SELECT actions_used_json, defensive_state_json, tie_breaker FROM combatants WHERE encounter_id = ?').all(encPrep.id) as any[];
    assert.ok(cbRows.length >= 3);
    for (const r of cbRows) {
      assert.ok(JSON.parse(r.actions_used_json));
      assert.ok(JSON.parse(r.defensive_state_json));
      assert.strictEqual(typeof r.tie_breaker, 'number');
    }

  } finally {
    if (masterClient?.ws) masterClient.ws.terminate();
    if (p1Client?.ws) p1Client.ws.terminate();
    if (p2Client?.ws) p2Client.ws.terminate();
    await realtimeServer.close();
    (server as any).closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  }
});
