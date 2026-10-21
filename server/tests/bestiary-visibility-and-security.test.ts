import test from 'node:test';
import assert from 'node:assert';
import http from 'http';
import WebSocket from 'ws';
import { getDatabase } from '../src/db/connection';
import { createApp } from '../src/app';
import { RealtimeServer } from '../src/modules/realtime/ws.server';
import { AuthService } from '../src/modules/auth/auth.service';
import { RbacService } from '../src/modules/permissions/rbac.service';

test('Segurança do Bestiário, Visibilidade e Proteção de Segredos (18 Cenários Obrigatórios)', async () => {
  const db = getDatabase(':memory:');
  const server = http.createServer();
  const authService = new AuthService(db);
  const rbacService = new RbacService(db);
  const realtimeServer = new RealtimeServer(server, authService, rbacService);
  const { app, bestiaryService, combatService } = createApp(db, realtimeServer);

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
    // SETUP: Autenticação de Mestre e Jogador
    // -------------------------------------------------------------
    const masterReg = await fetch(`${apiUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'mestre_sec@teste.com', username: 'MestreSeguro', password: 'Password123!' })
    });
    const master = await masterReg.json();

    const playerReg = await fetch(`${apiUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'jogador_sec@teste.com', username: 'JogadorCurioso', password: 'Password123!' })
    });
    const player = await playerReg.json();

    // Criação da Campanha pelo Mestre
    const campRes = await fetch(`${apiUrl}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({ name: 'Campanha de Sombras & Segredos' })
    });
    const { campaign } = await campRes.json();

    // Adiciona Jogador à Campanha via Invite
    const inviteRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({ maxUses: 5 })
    });
    const { invite } = await inviteRes.json();

    const joinRes = await fetch(`${apiUrl}/campaigns/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${player.token}` },
      body: JSON.stringify({ code: invite.code })
    });
    assert.strictEqual(joinRes.status, 200, 'Jogador deve ingressar na campanha com sucesso');

    // Conexões WebSocket
    masterClient = await connectWsClient(master.token, campaign.id);
    playerClient = await connectWsClient(player.token, campaign.id);

    // =============================================================
    // CENÁRIO 1: Criatura criada nasce oculta para jogadores por padrão
    // =============================================================
    console.log('--- CENÁRIO 1 ---');
    const createRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({
        name: 'Vampiro Ancião Lorde Malakar',
        display_name_players: 'Figura Encapuzada',
        category: 'morto-vivo',
        race: 'Vampiro',
        size: 1,
        description: 'Um nobre antigo corrompido pelas trevas.',
        public_notes: 'Diz a lenda que ele teme o fogo sagrado.',
        private_notes: 'Fraqueza secreta: estaca de espinheiro no coração.',
        raw_data: {
          vida: 85,
          pv_maximo: 85,
          defesa: 16,
          rd: 3,
          forca: 18,
          destreza: 16,
          resistances: ['frio', 'necrotico'],
          vulnerabilities: ['radiante', 'fogo'],
          immunities: ['veneno']
        },
        actions: [
          { name: 'Drenar Vida', formula: '2d8 + 4', damage_type: 'necrotico', cost: 'main', action_mode: 'attack' }
        ],
        equipment: [
          { name: 'Lâmina Vampírica', item_type: 'weapon', damage_formula: '1d10 + 4', damage_type: 'cortante' }
        ]
      })
    });
    assert.strictEqual(createRes.status, 201, 'Criatura deve ser criada com sucesso pelo mestre');
    const { creature: createdCreature } = await createRes.json();
    assert.strictEqual(Boolean(createdCreature.is_revealed), false, 'Cenário 1: Criatura criada deve ter is_revealed = 0');

    // =============================================================
    // CENÁRIO 2: Jogador não vê criatura oculta na lista do bestiário
    // =============================================================
    console.log('--- CENÁRIO 2 ---');
    const listPlayerRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary`, {
      headers: { 'Authorization': `Bearer ${player.token}` }
    });
    const listPlayer = await listPlayerRes.json();
    assert.strictEqual(listPlayer.creatures.length, 0, 'Cenário 2: Lista do bestiário para jogador deve estar vazia');

    const listMasterRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary`, {
      headers: { 'Authorization': `Bearer ${master.token}` }
    });
    const listMaster = await listMasterRes.json();
    assert.strictEqual(listMaster.creatures.length, 1, 'Mestre deve ver a criatura normalmente');

    // =============================================================
    // CENÁRIO 3: Jogador não consegue abrir ficha de criatura oculta (404)
    // =============================================================
    console.log('--- CENÁRIO 3 ---');
    const getPlayerRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary/${createdCreature.id}`, {
      headers: { 'Authorization': `Bearer ${player.token}` }
    });
    assert.strictEqual(getPlayerRes.status, 404, 'Cenário 3: Jogador deve receber 404 ao tentar abrir criatura oculta');

    // =============================================================
    // CENÁRIO 4: Mestre revela criatura e jogador passa a vê-la
    // =============================================================
    console.log('--- CENÁRIO 4 ---');
    const revealRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary/${createdCreature.id}/reveal`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${master.token}` }
    });
    assert.strictEqual(revealRes.status, 200, 'Mestre deve conseguir revelar criatura');
    const { creature: revealedCreature } = await revealRes.json();
    assert.strictEqual(Boolean(revealedCreature.is_revealed), true);

    const listPlayerAfterReveal = await (await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary`, {
      headers: { 'Authorization': `Bearer ${player.token}` }
    })).json();
    assert.strictEqual(listPlayerAfterReveal.creatures.length, 1, 'Cenário 4: Jogador agora vê a criatura revelada');
    assert.strictEqual(listPlayerAfterReveal.creatures[0].id, createdCreature.id);

    // =============================================================
    // CENÁRIO 5: Mestre oculta criatura novamente e jogador perde o acesso
    // =============================================================
    console.log('--- CENÁRIO 5 ---');
    const hideRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary/${createdCreature.id}/hide`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${master.token}` }
    });
    assert.strictEqual(hideRes.status, 200);

    const listPlayerAfterHide = await (await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary`, {
      headers: { 'Authorization': `Bearer ${player.token}` }
    })).json();
    assert.strictEqual(listPlayerAfterHide.creatures.length, 0, 'Cenário 5: Jogador perdeu acesso à lista');

    const getPlayerAfterHide = await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary/${createdCreature.id}`, {
      headers: { 'Authorization': `Bearer ${player.token}` }
    });
    assert.strictEqual(getPlayerAfterHide.status, 404, 'Cenário 5: Jogador recebe 404 após monstro ser ocultado novamente');

    // =============================================================
    // CENÁRIO 6: Criatura duplicada nasce oculta, mesmo se a original estiver revelada
    // =============================================================
    console.log('--- CENÁRIO 6 ---');
    // Primeiro revela a original
    await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary/${createdCreature.id}/reveal`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${master.token}` }
    });

    const dupRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary/${createdCreature.id}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({ name: 'Variante: Vampiro Superior' })
    });
    assert.strictEqual(dupRes.status, 201);
    const { creature: duplicatedCreature } = await dupRes.json();
    assert.strictEqual(Boolean(duplicatedCreature.is_revealed), false, 'Cenário 6: Criatura duplicada nasce com is_revealed = 0');

    // Jogador só vê 1 (a original revelada), mas não a variante duplicada
    const listPlayerDup = await (await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary`, {
      headers: { 'Authorization': `Bearer ${player.token}` }
    })).json();
    assert.strictEqual(listPlayerDup.creatures.length, 1, 'Cenário 6: Jogador não vê variante recém-duplicada');

    // =============================================================
    // CENÁRIO 7: Instância no mapa com token visível não revela o modelo do bestiário
    // =============================================================
    console.log('--- CENÁRIO 7 ---');
    // Oculta novamente a criatura original no bestiário
    await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary/${createdCreature.id}/hide`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${master.token}` }
    });

    // Cria cena para o mapa
    const sceneRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/scenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({ name: 'Cripta Sombria', width: 2000, height: 2000, grid_size: 50, is_active: true })
    });
    const { scene } = await sceneRes.json();

    // Mestre cria encontro e instancia a criatura na cena com token visível
    const encRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({ name: 'Batalha na Cripta', scene_id: scene.id })
    });
    const { encounter } = await encRes.json();

    const spawnRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encounter.id}/spawn-creatures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({
        creature_id: createdCreature.id,
        count: 1,
        scene_id: scene.id,
        x: 100,
        y: 100,
        name_prefix: 'Lorde Malakar',
        is_hidden: false
      })
    });
    assert.strictEqual(spawnRes.status, 201);
    const { combatants: spawnedCombatants } = await spawnRes.json();
    const instCombatant = spawnedCombatants[0];

    // Verifica que o modelo do bestiário CONTINUA estritamente oculto para jogadores!
    const bestiaryCheck = await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary/${createdCreature.id}`, {
      headers: { 'Authorization': `Bearer ${player.token}` }
    });
    assert.strictEqual(bestiaryCheck.status, 404, 'Cenário 7: Modelo do bestiário permanece 404 após instanciar token');

    // =============================================================
    // CENÁRIO 8: Instância colocada no mapa com token invisível não aparece para jogadores
    // =============================================================
    console.log('--- CENÁRIO 8 ---');
    const spawnHiddenRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encounter.id}/spawn-creatures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({
        creature_id: createdCreature.id,
        count: 1,
        scene_id: scene.id,
        x: 300,
        y: 300,
        name_prefix: 'Assassino Invisível',
        is_hidden: true
      })
    });
    assert.strictEqual(spawnHiddenRes.status, 201);
    const { combatants: hiddenCombatants } = await spawnHiddenRes.json();
    const hiddenComb = hiddenCombatants[0];

    // Jogador busca tokens da cena
    const tokensPlayerRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/scenes/${scene.id}/tokens`, {
      headers: { 'Authorization': `Bearer ${player.token}` }
    });
    const tokensPlayer = await tokensPlayerRes.json();
    const foundHiddenToken = (tokensPlayer.tokens || tokensPlayer).find((t: any) => t.id === hiddenComb.token_id);
    assert.strictEqual(foundHiddenToken, undefined, 'Cenário 8: Token invisível não é retornado na lista de tokens do jogador');

    // Jogador busca o token diretamente por ID
    const directTokenRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/scenes/${scene.id}/tokens/${hiddenComb.token_id}`, {
      headers: { 'Authorization': `Bearer ${player.token}` }
    });
    assert.strictEqual(directTokenRes.status, 404, 'Cenário 8: Consulta direta ao token invisível retorna 404 para jogador');

    // =============================================================
    // CENÁRIO 9: Nome mascarado é exibido aos jogadores e nome real é protegido
    // =============================================================
    console.log('--- CENÁRIO 9 ---');
    const combatantsPlayer = await (await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encounter.id}/combatants`, {
      headers: { 'Authorization': `Bearer ${player.token}` }
    })).json();
    const targetInCombat = combatantsPlayer.combatants.find((c: any) => c.id === instCombatant.id);
    assert.ok(targetInCombat, 'Combatente visível deve constar na iniciativa');
    assert.strictEqual(targetInCombat.name, 'Figura Encapuzada', 'Cenário 9: Jogador vê Nome Mascarado no combate');
    assert.notStrictEqual(targetInCombat.name, 'Vampiro Ancião Lorde Malakar', 'Cenário 9: Nome real protegido');

    // =============================================================
    // CENÁRIO 10: Vida exata é ocultada quando configurado, mantendo barra proporcional
    // =============================================================
    console.log('--- CENÁRIO 10 ---');
    assert.strictEqual(targetInCombat.current_hp, null, 'Cenário 10: current_hp deve ser null para jogador');
    assert.strictEqual(targetInCombat.max_hp, null, 'Cenário 10: max_hp deve ser null para jogador');
    assert.strictEqual(targetInCombat.hp_percent, 100, 'Cenário 10: hp_percent deve ser 100');
    assert.strictEqual(targetInCombat.hp_status, 'healthy', 'Cenário 10: hp_status deve ser healthy');

    // =============================================================
    // CENÁRIO 11: Atributos ocultos não são enviados no payload do jogador
    // =============================================================
    console.log('--- CENÁRIO 11 ---');
    assert.strictEqual(targetInCombat.npc_data.attributes, undefined, 'Cenário 11: npc_data.attributes não deve existir para jogador');
    assert.strictEqual(targetInCombat.npc_data.forca, undefined, 'Cenário 11: atributos de força não devem existir');

    // =============================================================
    // CENÁRIO 12: Fórmulas de dano ocultas não são enviadas no payload do jogador
    // =============================================================
    console.log('--- CENÁRIO 12 ---');
    assert.strictEqual(targetInCombat.initiative_formula, '---', 'Cenário 12: initiative_formula deve ser mascarada como ---');
    assert.strictEqual(targetInCombat.npc_data.damage_components, undefined, 'Cenário 12: componentes de dano não expostos');

    // =============================================================
    // CENÁRIO 13: Notas privadas do mestre nunca são enviadas aos jogadores
    // =============================================================
    console.log('--- CENÁRIO 13 ---');
    assert.strictEqual(targetInCombat.npc_data.gm_notes, undefined, 'Cenário 13: gm_notes omitido');
    assert.strictEqual(targetInCombat.npc_data.private_notes, undefined, 'Cenário 13: private_notes omitido');

    // =============================================================
    // CENÁRIO 14: Revelação progressiva libera apenas os campos explicitamente marcados
    // =============================================================
    console.log('--- CENÁRIO 14 ---');
    // Mestre libera apenas o nome real e a descrição
    const progRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary/${createdCreature.id}/revealed-fields`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({
        revealed_fields: {
          name: true,
          description: true,
          exact_hp: false,
          defenses: false
        }
      })
    });
    assert.strictEqual(progRes.status, 200);

    // Revela criatura no bestiário
    await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary/${createdCreature.id}/reveal`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${master.token}` }
    });

    const bestiaryProg = await (await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary/${createdCreature.id}`, {
      headers: { 'Authorization': `Bearer ${player.token}` }
    })).json();
    assert.strictEqual(bestiaryProg.creature.name, 'Vampiro Ancião Lorde Malakar', 'Cenário 14: Nome verdadeiro agora liberado');
    assert.strictEqual(bestiaryProg.creature.description, 'Um nobre antigo corrompido pelas trevas.');
    assert.strictEqual(bestiaryProg.creature.raw_data.defesa, undefined, 'Cenário 14: Defesa continua protegida');
    assert.strictEqual(bestiaryProg.creature.raw_data.vida, undefined, 'Cenário 14: Vida continua protegida');

    // =============================================================
    // CENÁRIO 15: Editor de criaturas salva corretamente tipo de dano, armas e equipamentos
    // =============================================================
    console.log('--- CENÁRIO 15 ---');
    const updateRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary/${createdCreature.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({
        name: 'Vampiro Ancião Lorde Malakar',
        category: 'morto-vivo',
        equipment: [
          { name: 'Espada do Crepúsculo', item_type: 'weapon', damage_formula: '1d8 + 3', damage_type: 'necrotico' },
          { name: 'Cota de Malha Sombria', item_type: 'armor', defense_bonus: 4, damage_reduction: 2 }
        ],
        raw_data: {
          vida: 100,
          defesa: 18,
          rd: 4,
          resistances: ['fogo', 'frio']
        }
      })
    });
    assert.strictEqual(updateRes.status, 200);
    const { creature: updatedCreature } = await updateRes.json();
    assert.strictEqual(updatedCreature.equipment.length, 2, 'Cenário 15: 2 equipamentos persistidos');
    assert.strictEqual(updatedCreature.equipment[0].damage_type, 'necrotico');

    // =============================================================
    // CENÁRIO 16: Ataques de criaturas com múltiplos tipos de dano funcionam no combate
    // =============================================================
    console.log('--- CENÁRIO 16 ---');
    // Adiciona personagem herói como alvo no combate
    const heroChar = await (await fetch(`${apiUrl}/campaigns/${campaign.id}/characters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({
        name: 'Guerreiro da Luz',
        raw_data: { vida_atual: 50, pv_maximo: 50, defesa: 10, rd: 0 }
      })
    })).json();

    const heroCombatantRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encounter.id}/combatants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({
        character_id: heroChar.character.id,
        name: 'Guerreiro da Luz',
        current_hp: 50,
        max_hp: 50,
        defense: 10,
        initiative: 20
      })
    });
    const { combatant: heroCombatant } = await heroCombatantRes.json();

    // Ativa combate
    await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encounter.id}/activate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${master.token}` }
    });

    // Monstro ataca o herói com sua ação
    const attackRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encounter.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${master.token}` },
      body: JSON.stringify({
        actor_id: instCombatant.id,
        actor_name: instCombatant.name,
        target_id: heroCombatant.id,
        action_mode: 'weapon',
        action_type: 'attack',
        weapon_id: 'npc_act_0', // Drenar Vida
        attack_formula: '1d20 + 10',
        formula: '2d8 + 4',
        damage_type: 'necrotico'
      })
    });
    assert.strictEqual(attackRes.status, 200, 'Cenário 16: Ataque de criatura executado com sucesso');
    const attackData = await attackRes.json();
    assert.strictEqual(attackData.hit, true, 'Ataque deve acertar');
    assert.ok(attackData.finalDamage > 0, 'Dano deve ser aplicado');

    // =============================================================
    // CENÁRIO 17: Nenhum segredo vaza via WebSocket ou log de combate
    // =============================================================
    console.log('--- CENÁRIO 17 ---');
    const logsRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encounter.id}/logs`, {
      headers: { 'Authorization': `Bearer ${player.token}` }
    });
    const { logs } = await logsRes.json();
    assert.ok(logs.length > 0, 'Logs devem existir');
    const attackLog = logs.find((l: any) => l.target_id === heroCombatant.id);
    assert.ok(attackLog, 'Log do ataque deve estar presente');
    // Fórmulas de dados e rolagens detalhadas devem ser mascaradas para jogadores
    assert.strictEqual(attackLog.details.formula, undefined, 'Cenário 17: Formula secreta removida do log para jogador');
    if (attackLog.details.attack_roll) {
      assert.strictEqual(attackLog.details.attack_roll.expression, undefined, 'Cenário 17: Expressão de rolagem removida');
    }

    // Testa que jogador no WebSocket não recebeu mensagens de criaturas ocultas
    const hiddenCreatureWsMsg = playerClient.messages.find(
      (m: any) => m.type === 'bestiary:updated' && m.creature && !m.creature.is_revealed
    );
    assert.strictEqual(hiddenCreatureWsMsg, undefined, 'Cenário 17: WebSocket nunca envia criatura oculta para jogadores');

    // =============================================================
    // CENÁRIO 18: Caso Real - Mascaramento total ("luix", PV, Defesa, RD e Iniciativa ocultos)
    // =============================================================
    console.log('--- CENÁRIO 18 ---');
    // Mestre cria criatura com dados reais e nome mascarado
    const luixCreature = bestiaryService.createCreature(campaign.id, {
      name: 'Luix o Imortal',
      display_name_players: 'luix',
      description: 'Um chefe lendário e perigoso.',
      category: 'chefe',
      is_revealed: true, // Revelado no bestiário porém com campos mascarados
      revealed_fields: {
        name: false,
        exact_hp: false,
        defenses: false,
        formulas: false,
        attributes: false,
        damage_types: false,
        equipment: false,
        abilities: false,
        notes: false
      },
      raw_data: {
        vida: 150,
        pv_maximo: 150,
        defesa: 18,
        rd: 5,
        forca: 20,
        iniciativa_formula: '1d20 + 8'
      },
      computed_data: {
        vida: 150,
        max_hp: 150,
        defesa: 18,
        rd: 5,
        iniciativa_formula: '1d20 + 8'
      },
      properties: {
        iniciativa_formula: '1d20 + 8',
        gm_notes: 'Ponto fraco no coração'
      }
    });

    // 1. Jogador requisita a criatura pelo Bestiário
    const playerLuixRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/bestiary/${luixCreature.id}`, {
      headers: { 'Authorization': `Bearer ${player.token}` }
    });
    assert.strictEqual(playerLuixRes.status, 200);
    const { creature: playerLuix } = await playerLuixRes.json();

    // Nome deve ser "luix" e "Luix o Imortal" não pode aparecer
    assert.strictEqual(playerLuix.name, 'luix', 'Cenário 18: Nome mascarado deve ser exibido como luix');
    assert.strictEqual(JSON.stringify(playerLuix).includes('Luix o Imortal'), false, 'Cenário 18: Nome real não pode vazar');
    assert.strictEqual(JSON.stringify(playerLuix).includes('Ponto fraco no coração'), false, 'Cenário 18: Notas do mestre não vazam');

    // Estatísticas secretas não podem estar em raw_data nem em computed_data
    assert.strictEqual(playerLuix.raw_data.vida, undefined, 'Cenário 18: Vida removida de raw_data');
    assert.strictEqual(playerLuix.raw_data.defesa, undefined, 'Cenário 18: Defesa removida de raw_data');
    assert.strictEqual(playerLuix.raw_data.rd, undefined, 'Cenário 18: RD removido de raw_data');
    assert.strictEqual(playerLuix.raw_data.iniciativa_formula, undefined, 'Cenário 18: Formula removida de raw_data');
    assert.strictEqual(playerLuix.computed_data.vida, undefined, 'Cenário 18: Vida removida de computed_data');
    assert.strictEqual(playerLuix.computed_data.defesa, undefined, 'Cenário 18: Defesa removida de computed_data');
    assert.strictEqual(playerLuix.computed_data.rd, undefined, 'Cenário 18: RD removido de computed_data');
    assert.strictEqual(playerLuix.computed_data.iniciativa_formula, undefined, 'Cenário 18: Formula removida de computed_data');

    // 2. Mestre instancia "luix" no combate e no mapa
    const spawnedLuix = combatService.spawnCreaturesToEncounter(campaign.id, encounter.id, luixCreature.id, 1, {
      scene_id: scene.id,
      name_prefix: luixCreature.name
    });
    assert.strictEqual(spawnedLuix.length, 1);
    const luixCombatantId = spawnedLuix[0].id;

    // 3. Jogador inspeciona a lista de combatentes
    const combatantsRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encounter.id}/combatants`, {
      headers: { 'Authorization': `Bearer ${player.token}` }
    });
    const { combatants: playerCombatants } = await combatantsRes.json();
    const playerLuixCombatant = playerCombatants.find((c: any) => c.id === luixCombatantId);
    assert.ok(playerLuixCombatant, 'Combatente deve existir');
    assert.strictEqual(playerLuixCombatant.name, 'luix', 'Cenário 18: Nome mascarado no combate');
    assert.strictEqual(playerLuixCombatant.current_hp, null, 'Cenário 18: PV exato oculto no combate');
    assert.strictEqual(playerLuixCombatant.max_hp, null, 'Cenário 18: Max PV oculto no combate');
    assert.strictEqual(playerLuixCombatant.defense, 0, 'Cenário 18: Defesa sanitizada para 0 no combate');
    assert.strictEqual(playerLuixCombatant.damage_reduction, 0, 'Cenário 18: RD sanitizado para 0 no combate');
    assert.strictEqual(playerLuixCombatant.initiative_formula, '---', 'Cenário 18: Formula de iniciativa sanitizada');

    // 4. Jogador inspeciona os tokens da cena no mapa
    const tokensRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/scenes/${scene.id}/tokens`, {
      headers: { 'Authorization': `Bearer ${player.token}` }
    });
    const { tokens: playerTokens } = await tokensRes.json();
    const playerLuixToken = playerTokens.find((t: any) => t.id === playerLuixCombatant.token_id);
    assert.ok(playerLuixToken, 'Token do luix deve existir');
    assert.strictEqual(playerLuixToken.name, 'luix', 'Cenário 18: Nome do token mascarado');
    assert.strictEqual(playerLuixToken.current_hp, null, 'Cenário 18: PV do token mascarado');
    assert.strictEqual(playerLuixToken.max_hp, null, 'Cenário 18: Max HP do token mascarado');
    assert.strictEqual(playerLuixToken.npc_data.defense, undefined, 'Cenário 18: Defesa do token removida');
    assert.strictEqual(playerLuixToken.npc_data.damage_reduction, undefined, 'Cenário 18: RD do token removido');
    assert.strictEqual(playerLuixToken.npc_data.iniciativa_formula, undefined, 'Cenário 18: Formula do token removida');

  } finally {
    if (masterClient?.ws) masterClient.ws.close();
    if (playerClient?.ws) playerClient.ws.close();
    await realtimeServer.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  }
});
