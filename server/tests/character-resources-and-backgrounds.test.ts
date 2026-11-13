import test from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { getDatabase } from '../src/db/connection';
import { createApp } from '../src/app';

test('Arcanum Core — Desacoplamento de Fichas, Isolamento de Recursos e Carga por Personagem', async (t) => {
  const db = getDatabase(':memory:');
  const server = http.createServer();
  const { app, characterService, inventoryService } = createApp(db);
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
      body: JSON.stringify({ email: 'mestre_resources@test.com', username: 'MestreResources', password: 'Password123!' })
    });
    const masterData = await masterRes.json();
    const masterToken = masterData.token;

    const player1Res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'player1_resources@test.com', username: 'Player1Resources', password: 'Password123!' })
    });
    const player1Data = await player1Res.json();
    const player1Token = player1Data.token;
    const player1Id = player1Data.user.id;

    const player2Res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'player2_resources@test.com', username: 'Player2Resources', password: 'Password123!' })
    });
    const player2Data = await player2Res.json();
    const player2Token = player2Data.token;
    const player2Id = player2Data.user.id;

    // 2. Mestre cria Campanha
    const campRes = await fetch(`${baseUrl}/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${masterToken}`
      },
      body: JSON.stringify({
        name: 'Campanha Desacoplamento de Fichas',
        description: 'Testando isolamento de recursos e carga'
      })
    });
    const campData = await campRes.json();
    const campaignId = campData.campaign.id;

    // Mestre cria convite para a campanha
    const inviteRes = await fetch(`${baseUrl}/campaigns/${campaignId}/invites`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${masterToken}` }
    });
    const inviteJson = await inviteRes.json();
    const inviteCode = inviteJson.invite?.code || inviteJson.code;
    assert.ok(inviteCode, 'Código de convite deve ser gerado');

    // Jogadores entram na campanha
    await fetch(`${baseUrl}/campaigns/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${player1Token}`
      },
      body: JSON.stringify({ code: inviteCode })
    });

    await fetch(`${baseUrl}/campaigns/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${player2Token}`
      },
      body: JSON.stringify({ code: inviteCode })
    });

    // =========================================================================
    // CENÁRIO 1: Isolamento de Recursos e Antecedentes entre Personagens
    // =========================================================================
    // Criar Personagem A (Guerreiro Arthus do Player 1)
    const charA = characterService.createCharacter(campaignId, player1Id, {
      name: 'Arthus',
      rawData: {
        forca: 16,
        destreza: 12,
        constituicao: 14,
        inteligencia: 10,
        vida_atual: 45,
        vida_max: 45,
        mana_atual: 12,
        mana_max: 12,
        origem: 'Nobre Decadente',
        oficio: 'Cavaleiro Andante',
        idiomas: ['Comum', 'Élfico']
      }
    });

    // Criar Personagem B (Ladina Sylas do Player 2)
    const charB = characterService.createCharacter(campaignId, player2Id, {
      name: 'Sylas',
      rawData: {
        forca: 10,
        destreza: 18,
        constituicao: 12,
        inteligencia: 14,
        vida_atual: 28,
        vida_max: 28,
        mana_atual: 20,
        mana_max: 20,
        origem: 'Gueto Subterrâneo',
        oficio: 'Gatuna',
        idiomas: ['Comum', 'Gíria das Sombras']
      }
    });

    // Consulta individual via API
    const resGetA = await fetch(`${baseUrl}/campaigns/${campaignId}/characters/${charA.id}`, {
      headers: { Authorization: `Bearer ${masterToken}` }
    });
    const dataA = await resGetA.json();
    assert.strictEqual(resGetA.status, 200);
    assert.strictEqual(dataA.character.name, 'Arthus');
    assert.strictEqual(dataA.character.raw_data.vida_atual, 45);
    assert.strictEqual(dataA.character.raw_data.origem, 'Nobre Decadente');
    assert.strictEqual(dataA.character.raw_data.oficio, 'Cavaleiro Andante');
    assert.deepStrictEqual(dataA.character.raw_data.idiomas, ['Comum', 'Élfico']);

    const resGetB = await fetch(`${baseUrl}/campaigns/${campaignId}/characters/${charB.id}`, {
      headers: { Authorization: `Bearer ${masterToken}` }
    });
    const dataB = await resGetB.json();
    assert.strictEqual(resGetB.status, 200);
    assert.strictEqual(dataB.character.name, 'Sylas');
    assert.strictEqual(dataB.character.raw_data.vida_atual, 28);
    assert.strictEqual(dataB.character.raw_data.origem, 'Gueto Subterrâneo');
    assert.strictEqual(dataB.character.raw_data.oficio, 'Gatuna');
    assert.deepStrictEqual(dataB.character.raw_data.idiomas, ['Comum', 'Gíria das Sombras']);

    // Assegurar que os recursos são estritamente independentes e não compartilhados
    assert.notStrictEqual(dataA.character.raw_data.vida_atual, dataB.character.raw_data.vida_atual);
    assert.notStrictEqual(dataA.character.raw_data.origem, dataB.character.raw_data.origem);
    assert.notStrictEqual(dataA.character.raw_data.oficio, dataB.character.raw_data.oficio);

    // =========================================================================
    // CENÁRIO 2: Independência de Updates (Atualizar A não afeta B)
    // =========================================================================
    // Atualizar Arthus (Player 1 toma 15 de dano e sobe de patente)
    const resPatchA = await fetch(`${baseUrl}/campaigns/${campaignId}/characters/${charA.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${player1Token}`
      },
      body: JSON.stringify({
        rawData: {
          vida_atual: 30,
          oficio: 'Capitão da Ordem'
        }
      })
    });
    const dataPatchA = await resPatchA.json();
    assert.strictEqual(resPatchA.status, 200);
    assert.strictEqual(dataPatchA.character.raw_data.vida_atual, 30);
    assert.strictEqual(dataPatchA.character.raw_data.oficio, 'Capitão da Ordem');
    assert.strictEqual(dataPatchA.character.raw_data.origem, 'Nobre Decadente'); // Preservado

    // Sylas deve permanecer 100% inalterada
    const resCheckB = await fetch(`${baseUrl}/campaigns/${campaignId}/characters/${charB.id}`, {
      headers: { Authorization: `Bearer ${player2Token}` }
    });
    const dataCheckB = await resCheckB.json();
    assert.strictEqual(dataCheckB.character.raw_data.vida_atual, 28);
    assert.strictEqual(dataCheckB.character.raw_data.oficio, 'Gatuna');
    assert.strictEqual(dataCheckB.character.raw_data.origem, 'Gueto Subterrâneo');

    // =========================================================================
    // CENÁRIO 3: Cálculo Dinâmico de Carga a partir da Mochila (Inventário)
    // =========================================================================
    // Inicialmente, sem itens na mochila, carga_atual de ambos é 0
    assert.strictEqual(dataPatchA.character.computed_data.carga_atual, 0);
    assert.strictEqual(dataCheckB.character.computed_data.carga_atual, 0);

    // Capacidade de carga máxima deve ser proporcional à força (10 + Forca * 2)
    // Arthus: Força 16 -> 10 + 16 * 2 = 42 kg
    // Sylas: Força 10 -> 10 + 10 * 2 = 30 kg
    assert.strictEqual(dataPatchA.character.computed_data.carga_max, 42);
    assert.strictEqual(dataCheckB.character.computed_data.carga_max, 30);

    // Adiciona itens pesados ao inventário de Arthus
    // Item 1: Montante Pesado (peso 4.5kg, qtd 1 = 4.5kg)
    inventoryService.addItemToCharacter(campaignId, charA.id, {
      itemName: 'Montante Pesado',
      category: 'arma',
      quantity: 1,
      weight: 4.5
    });

    // Item 2: Ração de Viagem (peso 0.5kg, qtd 6 = 3.0kg)
    inventoryService.addItemToCharacter(campaignId, charA.id, {
      itemName: 'Ração de Viagem',
      category: 'consumivel',
      quantity: 6,
      weight: 0.5
    });

    // Consulta Arthus novamente após adicionar itens
    const resGetAfterItemsA = await fetch(`${baseUrl}/campaigns/${campaignId}/characters/${charA.id}`, {
      headers: { Authorization: `Bearer ${masterToken}` }
    });
    const dataAfterItemsA = await resGetAfterItemsA.json();

    // Peso total esperado: 4.5 + (0.5 * 6) = 7.5 kg
    assert.strictEqual(dataAfterItemsA.character.computed_data.carga_atual, 7.5);
    assert.strictEqual(dataAfterItemsA.character.computed_data.total_itens, 7);

    // Sylas NÃO deve ter sua carga alterada
    const resGetAfterItemsB = await fetch(`${baseUrl}/campaigns/${campaignId}/characters/${charB.id}`, {
      headers: { Authorization: `Bearer ${masterToken}` }
    });
    const dataAfterItemsB = await resGetAfterItemsB.json();
    assert.strictEqual(dataAfterItemsB.character.computed_data.carga_atual, 0);
    assert.strictEqual(dataAfterItemsB.character.computed_data.total_itens, 0);

    // Também no endpoint de lista geral de personagens:
    const resListAll = await fetch(`${baseUrl}/campaigns/${campaignId}/characters`, {
      headers: { Authorization: `Bearer ${masterToken}` }
    });
    const dataListAll = await resListAll.json();
    const listCharA = dataListAll.characters.find((c: any) => c.id === charA.id);
    const listCharB = dataListAll.characters.find((c: any) => c.id === charB.id);

    assert.strictEqual(listCharA.computed_data.carga_atual, 7.5);
    assert.strictEqual(listCharB.computed_data.carga_atual, 0);

  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
