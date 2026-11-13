import test from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { getDatabase } from '../src/db/connection';
import { createApp } from '../src/app';

test('Arcanum Core — Habilidades (CRUD e Teto), Chat Persistente, Gestão de Membros e Classificação', async (t) => {
  const db = getDatabase(':memory:');
  const server = http.createServer();
  const { app, campaignService, characterService, inventoryService } = createApp(db);
  server.on('request', app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  try {
    // 1. Cadastrar Mestre e Jogadores
    const masterRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'mestre_skills@test.com', username: 'MestreSkills', password: 'Password123!' })
    });
    const masterData = await masterRes.json();
    const masterToken = masterData.token;
    const masterId = masterData.user.id;

    const player1Res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'player1_skills@test.com', username: 'Player1Skills', password: 'Password123!' })
    });
    const player1Data = await player1Res.json();
    const player1Token = player1Data.token;
    const player1Id = player1Data.user.id;

    const player2Res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'player2_skills@test.com', username: 'Player2Skills', password: 'Password123!' })
    });
    const player2Data = await player2Res.json();
    const player2Token = player2Data.token;
    const player2Id = player2Data.user.id;

    // 2. Mestre cria campanha com teto configurado de 3 habilidades
    const campRes = await fetch(`${baseUrl}/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${masterToken}`
      },
      body: JSON.stringify({
        name: 'Campanha Teto Habilidades',
        description: 'Testando teto e chat',
        max_skills_per_character: 3
      })
    });
    const campJson = await campRes.json();
    const campData = campJson.campaign || campJson;
    const campaignId = campData.id;
    assert.strictEqual(campData.max_skills_per_character, 3);

    // Mestre convida Player 1 e Player 2
    const inviteRes = await fetch(`${baseUrl}/campaigns/${campaignId}/invites`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${masterToken}` }
    });
    const inviteJson = await inviteRes.json();
    const inviteCode = inviteJson.invite?.code || inviteJson.code;
    assert.ok(inviteCode, 'Código de convite deve ser gerado');

    const join1Res = await fetch(`${baseUrl}/campaigns/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${player1Token}`
      },
      body: JSON.stringify({ code: inviteCode })
    });
    assert.strictEqual(join1Res.status, 200);

    const join2Res = await fetch(`${baseUrl}/campaigns/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${player2Token}`
      },
      body: JSON.stringify({ code: inviteCode })
    });
    assert.strictEqual(join2Res.status, 200);

    // Mestre cria personagem atribuído ao Player 1
    const charRes = await fetch(`${baseUrl}/campaigns/${campaignId}/characters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${masterToken}`
      },
      body: JSON.stringify({
        name: 'Guerreiro Arcanum',
        userId: player1Id,
        rawData: { Forca: 16, Destreza: 14, Inteligencia: 10, abilities: [] }
      })
    });
    assert.strictEqual(charRes.status, 201);
    const charJson = await charRes.json();
    const character = charJson.character || charJson;
    const characterId = character.id;
    assert.ok(characterId, 'Character ID deve existir');

    // ----------------------------------------------------
    // CENÁRIO 1: CRUD de Habilidades e Trava de Teto (max_skills_per_character)
    // ----------------------------------------------------
    await t.test('1. Adição de habilidades respeita o teto e bloqueia excesso com 400', async () => {
      // Adicionar Habilidade 1
      const s1Res = await fetch(`${baseUrl}/campaigns/${campaignId}/characters/${characterId}/skills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${player1Token}`
        },
        body: JSON.stringify({
          name: 'Golpe Fulminante',
          type: 'main',
          resource_cost: { name: 'Vigor', amount: 2 },
          attack_formula: '1d20 + 4',
          damage_formula: '1d8 + 3 Cortante'
        })
      });
      assert.strictEqual(s1Res.status, 201);
      const s1Data = await s1Res.json();
      assert.strictEqual(s1Data.character.raw_data.abilities.length, 1);
      const skill1Id = s1Data.skill.id;
      assert.ok(skill1Id);

      // Adicionar Habilidade 2
      const s2Res = await fetch(`${baseUrl}/campaigns/${campaignId}/characters/${characterId}/skills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${player1Token}`
        },
        body: JSON.stringify({
          name: 'Postura de Aço',
          type: 'bonus',
          damage_formula: '+2 Defesa'
        })
      });
      assert.strictEqual(s2Res.status, 201);

      // Adicionar Habilidade 3 (atinge o teto de 3)
      const s3Res = await fetch(`${baseUrl}/campaigns/${campaignId}/characters/${characterId}/skills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${player1Token}`
        },
        body: JSON.stringify({
          name: 'Corte Duplo',
          type: 'main',
          damage_formula: '2d6 Cortante'
        })
      });
      assert.strictEqual(s3Res.status, 201);

      // Tentar adicionar Habilidade 4 (ultrapassa teto 3) -> 400 Bad Request
      const s4Res = await fetch(`${baseUrl}/campaigns/${campaignId}/characters/${characterId}/skills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${player1Token}`
        },
        body: JSON.stringify({
          name: 'Fúria Proibida',
          type: 'reaction'
        })
      });
      assert.strictEqual(s4Res.status, 400);
      const s4Data = await s4Res.json();
      assert.ok(s4Data.error.includes('limite máximo') || s4Data.error.includes('3'));

      // Remover Habilidade 1
      const delRes = await fetch(`${baseUrl}/campaigns/${campaignId}/characters/${characterId}/skills/${skill1Id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${player1Token}` }
      });
      assert.strictEqual(delRes.status, 200);
      const delData = await delRes.json();
      assert.strictEqual(delData.character.raw_data.abilities.length, 2);

      // Agora que temos 2/3, adicionar uma nova habilidade deve ser permitido com 201
      const s5Res = await fetch(`${baseUrl}/campaigns/${campaignId}/characters/${characterId}/skills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${player1Token}`
        },
        body: JSON.stringify({
          name: 'Investida Audaz',
          type: 'main'
        })
      });
      assert.strictEqual(s5Res.status, 201);
      const s5Data = await s5Res.json();
      assert.strictEqual(s5Data.character.raw_data.abilities.length, 3);
    });

    // ----------------------------------------------------
    // CENÁRIO 2: Chat de Combate Persistente no SQLite
    // ----------------------------------------------------
    await t.test('2. Chat de combate persistido no SQLite e recuperado cronologicamente via GET', async () => {
      // Enviar mensagem 1
      const m1Res = await fetch(`${baseUrl}/campaigns/${campaignId}/chat/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${player1Token}`
        },
        body: JSON.stringify({
          content: 'Avanço pela ala leste e saco a espada!',
          type: 'chat'
        })
      });
      assert.strictEqual(m1Res.status, 201);
      const m1Json = await m1Res.json();
      const m1Data = m1Json.message || m1Json;
      assert.strictEqual(m1Data.content, 'Avanço pela ala leste e saco a espada!');
      assert.strictEqual(m1Data.sender_name, 'Player1Skills');

      // Enviar mensagem 2 pelo Mestre
      const m2Res = await fetch(`${baseUrl}/campaigns/${campaignId}/chat/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${masterToken}`
        },
        body: JSON.stringify({
          content: 'Um som metálico ecoa nas catacumbas.',
          type: 'narration'
        })
      });
      assert.strictEqual(m2Res.status, 201);

      // Listar mensagens via GET
      const listRes = await fetch(`${baseUrl}/campaigns/${campaignId}/chat/messages`, {
        headers: { Authorization: `Bearer ${player2Token}` }
      });
      assert.strictEqual(listRes.status, 200);
      const listJson = await listRes.json();
      const chatList = listJson.messages || listJson;
      assert.ok(Array.isArray(chatList));
      assert.ok(chatList.length >= 2);
      assert.strictEqual(chatList[0].content, 'Avanço pela ala leste e saco a espada!');
      assert.strictEqual(chatList[1].content, 'Um som metálico ecoa nas catacumbas.');
    });

    // ----------------------------------------------------
    // CENÁRIO 3: Gestão de Membros (Kick com ID Válido, ID Inexistente e Trava)
    // ----------------------------------------------------
    await t.test('3. Gestão de Membros: Trava 403, ID inexistente com 400 sem crash, e expulsão autorizada com ID válido', async () => {
      // Listar membros antes do kick
      const membersBeforeRes = await fetch(`${baseUrl}/campaigns/${campaignId}/members`, {
        headers: { Authorization: `Bearer ${masterToken}` }
      });
      const membersBeforeJson = await membersBeforeRes.json();
      const membersBefore = membersBeforeJson.members || membersBeforeJson;
      assert.strictEqual(membersBefore.length, 3); // Mestre, Player1, Player2

      // Verificar que getMembers retorna userId, user_id e id de forma compatível
      const p2Member = membersBefore.find((m: any) => m.username === 'Player2Skills');
      assert.ok(p2Member);
      assert.strictEqual(p2Member.userId, player2Id);
      assert.strictEqual(p2Member.user_id, player2Id);
      assert.strictEqual(p2Member.id, player2Id);

      // 3.1 Tentativa de remoção por ID inexistente -> 400 com erro amigável sem derrubar o servidor
      const notFoundKick = await fetch(`${baseUrl}/campaigns/${campaignId}/members/invalid-uuid-12345`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${masterToken}` }
      });
      assert.strictEqual(notFoundKick.status, 400);
      const notFoundData = await notFoundKick.json();
      assert.strictEqual(notFoundData.error, 'Jogador não é membro desta campanha.');

      // 3.2 Player 1 tenta expulsar Player 2 -> 403 Forbidden
      const unauthKick = await fetch(`${baseUrl}/campaigns/${campaignId}/members/${player2Id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${player1Token}` }
      });
      assert.strictEqual(unauthKick.status, 403);

      // 3.3 Mestre expulsa Player 2 passando member.user_id válido -> 200 OK
      const authKick = await fetch(`${baseUrl}/campaigns/${campaignId}/members/${p2Member.user_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${masterToken}` }
      });
      assert.strictEqual(authKick.status, 200);
      const kickResult = await authKick.json();
      assert.strictEqual(kickResult.success, true);

      // Listar membros após o kick
      const membersAfterRes = await fetch(`${baseUrl}/campaigns/${campaignId}/members`, {
        headers: { Authorization: `Bearer ${masterToken}` }
      });
      const membersAfterJson = await membersAfterRes.json();
      const membersAfter = membersAfterJson.members || membersAfterJson;
      assert.strictEqual(membersAfter.length, 2);
      assert.ok(!membersAfter.some((m: any) => (m.userId || m.user_id) === player2Id));

      // Player 2 expulso tenta acessar chat da campanha -> 403 Forbidden
      const player2ChatRes = await fetch(`${baseUrl}/campaigns/${campaignId}/chat/messages`, {
        headers: { Authorization: `Bearer ${player2Token}` }
      });
      assert.strictEqual(player2ChatRes.status, 403);
    });

    // ----------------------------------------------------
    // CENÁRIO 4: Armas do Inventário, Equipar/Desequipar e Imbuição
    // ----------------------------------------------------
    await t.test('4. Armas na mochila vs equipadas e alternância de equipamento via API', async () => {
      // Adicionar arma "adaguinha" no inventário (inicialmente desequipada)
      const daggerItem = inventoryService.addItemToCharacter(campaignId, characterId, {
        itemName: 'Adaguinha',
        category: 'arma',
        weight: 1,
        quantity: 1,
        properties: {
          dano: '1d4',
          tipo_dano: 'Perfurante'
        }
      });
      assert.strictEqual(daggerItem.category, 'arma');
      assert.strictEqual(daggerItem.is_equipped, 0);

      // Alternar estado para equipada via PATCH API
      const patchRes = await fetch(`${baseUrl}/campaigns/${campaignId}/characters/${characterId}/inventory/${daggerItem.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${player1Token}`
        },
        body: JSON.stringify({ isEquipped: true })
      });
      assert.strictEqual(patchRes.status, 200);
      const patchData = await patchRes.json();
      assert.strictEqual(patchData.item.is_equipped, 1);

      // Adicionar óleo de veneno com dano
      const poisonOil = inventoryService.addItemToCharacter(campaignId, characterId, {
        itemName: 'Óleo de Veneno Letal',
        category: 'oleo',
        weight: 0.2,
        quantity: 2,
        properties: {
          dano: '1d6',
          damage_formula: '1d6',
          tipo_dano: 'Veneno',
          imbue_properties: {
            damage_type: 'veneno',
            damage_formula: '1d6',
            charges: 3
          }
        }
      });

      // Imbuir adaguinha com o óleo
      const imbueResult = inventoryService.imbueWeapon(
        campaignId,
        characterId,
        {
          weaponInventoryId: daggerItem.id,
          consumableInventoryId: poisonOil.id
        },
        player1Id,
        true
      );

      const imbuedWeapon = imbueResult.weapon;
      assert.ok(imbuedWeapon.properties.imbued_effects);
      assert.strictEqual(imbuedWeapon.properties.imbued_effects.length, 1);
      const eff = imbuedWeapon.properties.imbued_effects[0];
      assert.strictEqual(eff.damage_type, 'veneno');
      assert.strictEqual(eff.damage_formula, '1d6');
      assert.strictEqual(eff.charges_remaining, 3);
      const label = `+${eff.damage_formula || (eff.percentage_damage ? `${eff.percentage_damage}%` : '1d6')} ${eff.damage_type}`;
      assert.ok(!label.includes('undefined'), 'Label de imbuição não pode conter undefined');
    });

    // ----------------------------------------------------
    // CENÁRIO 5: Dashboard e Ocultação Condicional do Card "Conta Nova"
    // ----------------------------------------------------
    await t.test('5. Campanhas ativas no dashboard: usuário com campanhas recebe lista não-vazia', async () => {
      const userCampaigns = campaignService.getUserCampaigns(player1Id);
      assert.ok(userCampaigns.length > 0, 'Usuário possui campanha ativa');
      assert.strictEqual(userCampaigns[0].id, campaignId);
      // Regra de UI: Se userCampaigns.length > 0, o bloco "Conta nova, sem campanhas" é estritamente ocultado
      const shouldRenderWelcomeCard = userCampaigns.length === 0;
      assert.strictEqual(shouldRenderWelcomeCard, false, 'Card de boas-vindas deve ser falso quando há campanhas');
    });

  } finally {
    server.close();
  }
});
