import test from 'node:test';
import assert from 'node:assert';
import http from 'http';
import WebSocket from 'ws';
import { getDatabase } from '../src/db/connection';
import { createApp } from '../src/app';
import { RealtimeServer } from '../src/modules/realtime/ws.server';
import { AuthService } from '../src/modules/auth/auth.service';
import { RbacService } from '../src/modules/permissions/rbac.service';

test('Bestiário, NPCs e Gerenciamento de Encontros (13 Cenários Obrigatórios)', async () => {
  const db = getDatabase(':memory:');
  const server = http.createServer();
  const authService = new AuthService(db);
  const rbacService = new RbacService(db);
  const realtimeServer = new RealtimeServer(server, authService, rbacService);
  const { app } = createApp(db, realtimeServer);

  server.on('request', app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

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

  let masterClient: any;
  let playerClient: any;

  try {
    // -------------------------------------------------------------
    // SETUP: Autenticação de Usuários e Criação de Campanha
    // -------------------------------------------------------------
    const masterReg = await fetch(`${apiUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'mestre_bestiario@teste.com', username: 'MestreBestiario', password: 'Password123!' })
    });
    const master = await masterReg.json();

    const playerReg = await fetch(`${apiUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'jogador_bestiario@teste.com', username: 'JogadorBestiario', password: 'Password123!' })
    });
    const player = await playerReg.json();

    // Campanha 1 (Principal)
    const campRes = await fetch(`${apiUrl}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({ name: 'Crônicas do Bestiário' })
    });
    const { campaign } = await campRes.json();

    // Adiciona jogador à Campanha 1
    const inviteRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({ maxUses: 5 })
    });
    const { invite } = await inviteRes.json();

    await fetch(`${apiUrl}/campaigns/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${player.token}` },
      body: JSON.stringify({ code: invite.code })
    });

    // Campanha 2 (Isolamento Multi-tenant)
    const camp2Res = await fetch(`${apiUrl}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({ name: 'Outro Reino Isolado' })
    });
    const { campaign: campaign2 } = await camp2Res.json();

    // Conectar WebSocket
    masterClient = await connectWsClient(master.token, campaign.id);
    playerClient = await connectWsClient(player.token, campaign.id);

    // Criar cena de mapa
    const sceneRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/scenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({ name: 'Covil dos Goblins', is_active: true, width: 2000, height: 2000 })
    });
    const { scene } = await sceneRes.json();

    // =============================================================
    // CENÁRIO 1: Criar e editar uma criatura no Bestiário
    // =============================================================
    const createGoblinRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({
        name: 'Goblin Espreitador',
        description: 'Pequena criatura traiçoeira armada com adaga envenenada.',
        category: 'humanoide',
        size: 1,
        avatar_url: 'https://img.rpg/goblin.png',
        raw_data: { forca: 10, destreza: 14, vida: 15, defesa: 13, rd: 1 },
        actions: [
          {
            name: 'Golpe Sorrateiro',
            description: 'Ataque rápido com adaga.',
            action_mode: 'attack',
            cost: 'main',
            formula: '1d6 + 2',
            damage_type: 'físico',
            damage_components: [{ formula: '1d6 + 2', damage_type: 'físico' }]
          }
        ],
        properties: {
          iniciativa_formula: '1d20 + 2',
          resistances: ['veneno']
        }
      })
    });
    assert.strictEqual(createGoblinRes.status, 201, 'Mestre deve conseguir criar criatura');
    const { creature: goblinModel } = await createGoblinRes.json();
    assert.strictEqual(goblinModel.name, 'Goblin Espreitador');
    assert.strictEqual(goblinModel.category, 'humanoide');
    assert.strictEqual(goblinModel.raw_data.vida, 15);
    assert.strictEqual(goblinModel.actions.length, 1);

    // Editar a criatura
    const editGoblinRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary/${goblinModel.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({
        description: 'Pequena criatura traiçoeira com adaga e flechas envenenadas.',
        raw_data: { forca: 10, destreza: 15, vida: 18, defesa: 14, rd: 1 }
      })
    });
    assert.strictEqual(editGoblinRes.status, 200, 'Mestre deve conseguir editar criatura');
    const { creature: updatedGoblin } = await editGoblinRes.json();
    assert.strictEqual(updatedGoblin.description, 'Pequena criatura traiçoeira com adaga e flechas envenenadas.');
    assert.strictEqual(updatedGoblin.raw_data.vida, 18);
    assert.strictEqual(updatedGoblin.raw_data.defesa, 14);

    // =============================================================
    // CENÁRIO 2: Duplicar uma criatura para criar uma variante sem alterar a original
    // =============================================================
    const duplicateRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary/${goblinModel.id}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({
        name: 'Goblin Arqueiro de Elite',
        description: 'Variante com mira aprimorada.'
      })
    });
    assert.strictEqual(duplicateRes.status, 201, 'Mestre deve conseguir duplicar criatura');
    const { creature: goblinVariant } = await duplicateRes.json();
    assert.notStrictEqual(goblinVariant.id, goblinModel.id, 'Variante deve ter identificador único');
    assert.strictEqual(goblinVariant.name, 'Goblin Arqueiro de Elite');

    // Modificar a variante e verificar que a original não foi alterada
    await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary/${goblinVariant.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({
        raw_data: { forca: 12, destreza: 18, vida: 25, defesa: 16, rd: 2 }
      })
    });

    const checkOriginalRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary/${goblinModel.id}`, {
      headers: { 'Authorization': `Bearer ${master.token}` }
    });
    const { creature: originalRefetched } = await checkOriginalRes.json();
    assert.strictEqual(originalRefetched.name, 'Goblin Espreitador', 'Modelo original não pode ser modificado pela variante');
    assert.strictEqual(originalRefetched.raw_data.vida, 18, 'Vida do modelo original deve permanecer inalterada');

    // =============================================================
    // CENÁRIO 5: Salvar e carregar um encontro preparado (prep state)
    // =============================================================
    const createEncounterRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/encounters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({
        name: 'Emboscada na Caverna Sombria',
        scene_id: scene.id,
        notes: 'Os goblins estão escondidos atrás das estalagmites. Seus chefes possuem poções de fogo.',
        planned_creatures: [
          { creature_id: goblinModel.id, count: 2, name: 'Goblin', x: 200, y: 300 },
          { creature_id: goblinVariant.id, count: 1, name: 'Líder Arqueiro', x: 400, y: 300 }
        ]
      })
    });
    assert.strictEqual(createEncounterRes.status, 201, 'Mestre deve salvar encontro');
    const { encounter: preparedEncounter } = await createEncounterRes.json();
    assert.strictEqual(preparedEncounter.status, 'prep');
    assert.strictEqual(preparedEncounter.name, 'Emboscada na Caverna Sombria');
    assert.strictEqual(preparedEncounter.notes, 'Os goblins estão escondidos atrás das estalagmites. Seus chefes possuem poções de fogo.');
    assert.strictEqual(preparedEncounter.planned_creatures.length, 2);

    // Carregar encontros da campanha
    const getEncountersRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/encounters`, {
      headers: { 'Authorization': `Bearer ${master.token}` }
    });
    const { encounters } = await getEncountersRes.json();
    const loadedEncounter = encounters.find((e: any) => e.id === preparedEncounter.id);
    assert.ok(loadedEncounter, 'Encontro preparado deve ser recuperado com sucesso');
    assert.strictEqual(loadedEncounter.status, 'prep');

    // Duplicar encontro
    const duplicateEncounterRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/encounters/${preparedEncounter.id}/duplicate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${master.token}` }
    });
    assert.strictEqual(duplicateEncounterRes.status, 201);
    const { encounter: encCopy } = await duplicateEncounterRes.json();
    assert.strictEqual(encCopy.name, 'Emboscada na Caverna Sombria (Cópia)');
    assert.strictEqual(encCopy.status, 'prep');

    // =============================================================
    // CENÁRIO 3: Criar múltiplas instâncias independentes a partir do modelo
    // CENÁRIO 8: Integrar criaturas à iniciativa existente
    // =============================================================
    // Criar um personagem herói para participar do combate
    const charRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/characters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${player.token}` },
      body: JSON.stringify({
        name: 'Guerreiro Arthur',
        raw_data: { forca: 16, agilidade: 14, vida: 30, pv_atual: 30, pv_maximo: 30, defesa: 15, rd: 2 }
      })
    });
    const { character: heroChar } = await charRes.json();

    // Adiciona o herói aos combatentes do encontro preparado
    const addHeroRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${preparedEncounter.id}/combatants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({
        character_id: heroChar.id,
        name: 'Guerreiro Arthur',
        initiative_formula: '1d20 + 2'
      })
    });
    assert.strictEqual(addHeroRes.status, 201);
    const { combatant: heroCombatant } = await addHeroRes.json();

    // Instancia 3 goblins a partir do modelo do bestiário
    const spawnRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${preparedEncounter.id}/spawn-creatures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({
        creature_id: goblinModel.id,
        count: 3,
        scene_id: scene.id,
        x: 100,
        y: 150,
        name_prefix: 'Goblin Ladino'
      })
    });
    assert.strictEqual(spawnRes.status, 201, 'Instanciação de múltiplas criaturas deve ter sucesso');
    const { combatants: spawnedGoblins } = await spawnRes.json();
    assert.strictEqual(spawnedGoblins.length, 3, 'Devem ser geradas 3 instâncias independentes');
    assert.strictEqual(spawnedGoblins[0].name, 'Goblin Ladino 1');
    assert.strictEqual(spawnedGoblins[1].name, 'Goblin Ladino 2');
    assert.strictEqual(spawnedGoblins[2].name, 'Goblin Ladino 3');

    // Cada instância possui identificador único e referência à criatura original
    assert.notStrictEqual(spawnedGoblins[0].id, spawnedGoblins[1].id);
    assert.strictEqual(spawnedGoblins[0].source_creature_id, goblinModel.id);
    assert.strictEqual(spawnedGoblins[1].source_creature_id, goblinModel.id);
    assert.strictEqual(spawnedGoblins[2].source_creature_id, goblinModel.id);

    // =============================================================
    // CENÁRIO 6: Iniciar um encontro sem duplicar combatentes
    // =============================================================
    const activateRes1 = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${preparedEncounter.id}/activate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${master.token}` }
    });
    assert.strictEqual(activateRes1.status, 200);
    const { encounter: activeEnc1 } = await activateRes1.json();
    assert.strictEqual(activeEnc1.status, 'active');
    const countCombatants1 = activeEnc1.combatants.length;
    assert.strictEqual(countCombatants1, 4, 'Deve conter 1 herói + 3 goblins');

    // Chamar ativação novamente não deve duplicar combatentes nem reiniciar dados
    const activateRes2 = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${preparedEncounter.id}/activate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${master.token}` }
    });
    assert.strictEqual(activateRes2.status, 200);
    const { encounter: activeEnc2 } = await activateRes2.json();
    assert.strictEqual(activeEnc2.combatants.length, countCombatants1, 'Reativação não deve duplicar combatentes');

    // Todas as criaturas possuem iniciativa válida e desempate
    for (const c of activeEnc2.combatants) {
      assert.ok(typeof c.initiative === 'number' && c.initiative > 0, `Iniciativa de ${c.name} deve ser válida`);
      assert.ok(typeof c.tie_breaker === 'number', `Tie breaker de ${c.name} deve ser numérico`);
    }

    // =============================================================
    // CENÁRIO 4: Aplicar dano e condições a apenas uma instância
    // =============================================================
    const goblin1 = spawnedGoblins[0];
    const goblin2 = spawnedGoblins[1];
    const initialHpG1 = goblin1.current_hp;
    const initialHpG2 = goblin2.current_hp;

    // Aplicar 10 de dano e condição "Envenenado" exclusivamente ao Goblin 1
    const damageActionRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${preparedEncounter.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({
        action_type: 'damage',
        action_mode: 'manual',
        actor_id: heroCombatant.id,
        target_id: goblin1.id,
        amount: 10
      })
    });
    assert.strictEqual(damageActionRes.status, 200);

    const conditionRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${preparedEncounter.id}/combatants/${goblin1.id}/conditions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({
        name: 'Envenenado',
        duration_type: 'turns',
        duration_remaining: 3
      })
    });
    assert.strictEqual(conditionRes.status, 201);

    // Consulta estado atualizado de todos os combatentes
    const checkEncRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/active`, {
      headers: { 'Authorization': `Bearer ${master.token}` }
    });
    const { encounter: checkEnc } = await checkEncRes.json();
    const g1Refetched = checkEnc.combatants.find((c: any) => c.id === goblin1.id);
    const g2Refetched = checkEnc.combatants.find((c: any) => c.id === goblin2.id);

    // Goblin 1 sofreu dano e recebeu condição (10 dano bruto - 1 RD do goblin = 9 dano efetivo)
    assert.strictEqual(g1Refetched.current_hp, initialHpG1 - 9, 'Goblin 1 deve ter perdido 9 PV (10 dano - 1 RD)');
    assert.ok(g1Refetched.conditions.some((c: any) => c.name === 'Envenenado'), 'Goblin 1 deve ter recebido a condição');

    // Goblin 2 permaneceu com vida intacta e sem condições
    assert.strictEqual(g2Refetched.current_hp, initialHpG2, 'Goblin 2 NÃO deve ter sido afetado pelo dano em Goblin 1');
    assert.strictEqual(g2Refetched.conditions.length, 0, 'Goblin 2 NÃO deve ter recebido condição');

    // O modelo do bestiário também NÃO foi modificado
    const checkModelRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary/${goblinModel.id}`, {
      headers: { 'Authorization': `Bearer ${master.token}` }
    });
    const { creature: modelAfterDamage } = await checkModelRes.json();
    assert.strictEqual(modelAfterDamage.raw_data.vida, 18, 'Modelo no bestiário deve permanecer inalterado');

    // =============================================================
    // CENÁRIO 7: Adicionar reforços durante o combate ativo
    // =============================================================
    const reinforcementsRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${preparedEncounter.id}/spawn-creatures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({
        creature_id: goblinVariant.id,
        count: 1,
        scene_id: scene.id,
        x: 600,
        y: 600,
        name_prefix: 'Reforço Arqueiro'
      })
    });
    assert.strictEqual(reinforcementsRes.status, 201, 'Reforço deve ser adicionado durante combate ativo');
    const { combatants: reinforcements } = await reinforcementsRes.json();
    assert.strictEqual(reinforcements.length, 1);
    const spawnedReinforcement = reinforcements[0];

    // Iniciativa do reforço é calculada no mesmo instante pelo servidor
    assert.ok(typeof spawnedReinforcement.initiative === 'number' && spawnedReinforcement.initiative > 0, 'Reforço deve receber iniciativa imediatamente');
    assert.strictEqual(spawnedReinforcement.source_creature_id, goblinVariant.id);

    // Total de combatentes agora é 5
    const encWithReinforcements = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/active`, {
      headers: { 'Authorization': `Bearer ${master.token}` }
    });
    const { encounter: encWithReinfData } = await encWithReinforcements.json();
    assert.strictEqual(encWithReinfData.combatants.length, 5, 'Combate ativo deve conter os 5 combatentes');

    // =============================================================
    // CENÁRIO 11: Proteger informações secretas (Backend Protection)
    // =============================================================
    // 1. Criar criatura com nome secreto e vida oculta
    const secretNpcRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({
        name: 'Vampiro Ancião Lorde Malakar',
        category: 'morto-vivo',
        raw_data: { vida: 80, defesa: 18, rd: 5 },
        properties: {
          is_secret: false, // criatura no bestiário visível se mestre quiser
          hide_exact_hp: true,
          display_name_players: 'Figura Encapuzada Misteriosa',
          hide_stats: true,
          gm_notes: 'Vulnerável apenas a prata sagrada.'
        }
      })
    });
    const { creature: secretNpcModel } = await secretNpcRes.json();

    // Spawna o NPC secreto no combate
    const spawnSecretRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${preparedEncounter.id}/spawn-creatures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({
        creature_id: secretNpcModel.id,
        count: 1,
        name_prefix: 'Vampiro Ancião Lorde Malakar'
      })
    });
    const { combatants: secretCombatants } = await spawnSecretRes.json();
    const secretCombatantId = secretCombatants[0].id;

    // Aplica condição secreta ao NPC (visível apenas ao mestre)
    await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${preparedEncounter.id}/combatants/${secretCombatantId}/conditions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({
        name: 'Plano Secreto do Mestre',
        duration_type: 'permanent',
        is_visible_to_players: false
      })
    });

    // MESTRE consulta o combate: vê nome real, vida exata e condição secreta
    const masterCombatViewRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/active`, {
      headers: { 'Authorization': `Bearer ${master.token}` }
    });
    const { encounter: masterView } = await masterCombatViewRes.json();
    const masterSecretCb = masterView.combatants.find((c: any) => c.id === secretCombatantId);
    assert.strictEqual(masterSecretCb.name, 'Vampiro Ancião Lorde Malakar', 'Mestre vê nome real');
    assert.strictEqual(masterSecretCb.current_hp, 80, 'Mestre vê vida exata');
    assert.ok(masterSecretCb.conditions.some((c: any) => c.name === 'Plano Secreto do Mestre'), 'Mestre vê condição secreta');
    assert.ok(masterView.notes.includes('estalagmites'), 'Mestre vê notas privadas do encontro');

    // JOGADOR consulta o combate: nome mascarado, vida exata ocultada (apenas percentual/status) e condição secreta removida
    const playerCombatViewRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/active`, {
      headers: { 'Authorization': `Bearer ${player.token}` }
    });
    const { encounter: playerView } = await playerCombatViewRes.json();
    const playerSecretCb = playerView.combatants.find((c: any) => c.id === secretCombatantId);

    assert.strictEqual(playerSecretCb.name, 'Figura Encapuzada Misteriosa', 'Jogador recebe nome mascarado');
    assert.strictEqual(playerSecretCb.current_hp, null, 'Vida exata deve ser estritamente oculta (null) para jogador');
    assert.strictEqual(playerSecretCb.max_hp, null, 'Vida máxima exata deve ser estritamente oculta (null) para jogador');
    assert.strictEqual(playerSecretCb.hp_percent, 100, 'Jogador recebe percentual visual');
    assert.strictEqual(playerSecretCb.hp_status, 'healthy', 'Jogador recebe estado descritivo saudável');
    assert.strictEqual(
      playerSecretCb.conditions.some((c: any) => c.name === 'Plano Secreto do Mestre'),
      false,
      'Jogador NUNCA deve receber condições com is_visible_to_players = false'
    );
    assert.strictEqual(playerView.notes, '', 'Notas privadas do mestre devem ser filtradas para jogadores');

    // =============================================================
    // CENÁRIO 12: Validar permissões e isolamento entre campanhas
    // =============================================================
    // Jogador não pode criar criaturas no bestiário (apenas mestre: 403 Forbidden)
    const unauthorizedCreate = await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${player.token}` },
      body: JSON.stringify({ name: 'Criatura Hack' })
    });
    assert.strictEqual(unauthorizedCreate.status, 403, 'Jogador comum não pode criar criatura no bestiário');

    // Acesso ao bestiário de outra campanha da qual o jogador não é membro (Campanha 2: 403 Forbidden)
    const unauthorizedCrossCamp = await fetch(`${apiUrl}/campaigns/${campaign2.id}/bestiary`, {
      headers: { 'Authorization': `Bearer ${player.token}` }
    });
    assert.strictEqual(unauthorizedCrossCamp.status, 403, 'Acesso cross-campaign deve ser bloqueado com 403');

    // =============================================================
    // CENÁRIO 10: Sincronizar mapa e combate entre mestre e jogadores via WebSocket
    // =============================================================
    // Aguarda processamento de mensagens WebSocket
    await new Promise(r => setTimeout(r, 200));

    // Verifica se mensagens WebSocket de combatant_added e reinforcements_added foram recebidas
    const reinfMsg = masterClient.messages.find((m: any) => m.type === 'combat:reinforcements_added');
    assert.ok(reinfMsg, 'Mestre deve receber evento combat:reinforcements_added via WebSocket');
    assert.ok(reinfMsg.combatants.length >= 1, 'Evento deve conter combatentes instanciados');

    const playerCombatantMsg = playerClient.messages.find((m: any) => m.type === 'combat:combatant_added');
    assert.ok(playerCombatantMsg, 'Jogador deve receber evento de combatente adicionado via WebSocket');

    // =============================================================
    // CENÁRIO 9: Preservar estados após F5 e reinicialização
    // =============================================================
    // Simula F5 lendo diretamente do SQLite com novas instâncias de consulta
    const freshDbEncounter = db.prepare('SELECT * FROM combat_encounters WHERE id = ?').get(preparedEncounter.id) as any;
    assert.strictEqual(freshDbEncounter.status, 'active');
    assert.strictEqual(freshDbEncounter.round, 1);

    const freshDbCombatants = db.prepare('SELECT * FROM combatants WHERE encounter_id = ?').all(preparedEncounter.id) as any[];
    assert.strictEqual(freshDbCombatants.length, 6, 'Todos os 6 combatentes persistem intactos no SQLite');

    // Remover um combatente NÃO apaga o modelo original do bestiário nem outros combatentes
    const deleteCombatantRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${preparedEncounter.id}/combatants/${goblin1.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${master.token}` }
    });
    assert.strictEqual(deleteCombatantRes.status, 200, 'Exclusão de combatente deve ter sucesso');

    const checkModelStillExists = await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary/${goblinModel.id}`, {
      headers: { 'Authorization': `Bearer ${master.token}` }
    });
    assert.strictEqual(checkModelStillExists.status, 200, 'Modelo do bestiário DEVE continuar existindo');

    const checkOtherGoblinStillExists = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/active`, {
      headers: { 'Authorization': `Bearer ${master.token}` }
    });
    const { encounter: encAfterDelete } = await checkOtherGoblinStillExists.json();
    assert.ok(encAfterDelete.combatants.some((c: any) => c.id === goblin2.id), 'Goblin 2 deve continuar no combate');
    assert.strictEqual(encAfterDelete.combatants.some((c: any) => c.id === goblin1.id), false, 'Goblin 1 foi removido');

    // =============================================================
    // CENÁRIO 13: Preservar funcionalidades existentes de combate, habilidades e inventário
    // =============================================================
    // O NPC pode executar uma ação de ataque através do resolvedor unificado applyCombatAction
    const npcActionRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${preparedEncounter.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({
        action_mode: 'manual',
        actor_id: goblin2.id,
        target_id: heroCombatant.id,
        manual_damage: 5
      })
    });
    assert.strictEqual(npcActionRes.status, 200, 'Mestre deve conseguir conduzir ações de NPCs com o motor de combate');

    // Encerrar encontro
    const endRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${preparedEncounter.id}/end`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${master.token}` }
    });
    assert.strictEqual(endRes.status, 200);
    const { encounter: endedEnc } = await endRes.json();
    assert.strictEqual(endedEnc.status, 'ended', 'Encontro deve transicionar corretamente para ended');

    console.log('✔ Todos os 13 cenários de Bestiário, NPCs e Gerenciamento de Encontros foram validados com sucesso!');
  } finally {
    try { masterClient?.ws?.terminate(); } catch {}
    try { playerClient?.ws?.terminate(); } catch {}
    await realtimeServer.close();
    (server as any).closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  }
});
