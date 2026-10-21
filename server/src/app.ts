import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';
import { AuthService } from './modules/auth/auth.service';
import { createAuthMiddleware } from './modules/auth/auth.middleware';
import { RbacService } from './modules/permissions/rbac.service';
import { RulesService } from './modules/rules-engine/rules.service';
import { CampaignService } from './modules/campaigns/campaign.service';
import { CharacterService } from './modules/characters/character.service';
import { InventoryService } from './modules/inventory/inventory.service';
import { RealtimeServer } from './modules/realtime/ws.server';
import { VttService } from './modules/vtt/vtt.service';
import { CombatService } from './modules/combat/combat.service';
import { BestiaryService } from './modules/bestiary/bestiary.service';

export interface AppContext {
  app: Express;
  db: DatabaseSync;
  authService: AuthService;
  rbacService: RbacService;
  rulesService: RulesService;
  campaignService: CampaignService;
  characterService: CharacterService;
  inventoryService: InventoryService;
  vttService: VttService;
  combatService: CombatService;
  bestiaryService: BestiaryService;
  realtimeServer?: RealtimeServer;
  setRealtimeServer: (rt: RealtimeServer) => void;
}

export function createApp(db: DatabaseSync, realtimeServer?: RealtimeServer): AppContext {
  const app = express();

  let activeRealtimeServer = realtimeServer;
  const setRealtimeServer = (rt: RealtimeServer) => {
    activeRealtimeServer = rt;
    rt.setVttService(vttService);
    app.set('realtimeServer', rt);
  };
  const getRealtime = (): RealtimeServer | undefined => {
    return activeRealtimeServer || (app.get('realtimeServer') as RealtimeServer);
  };

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  // Serviços de domínio
  const authService = new AuthService(db);
  const rbacService = new RbacService(db);
  const rulesService = new RulesService(db);
  const campaignService = new CampaignService(db, rulesService);
  const characterService = new CharacterService(db, rulesService);
  const inventoryService = new InventoryService(db, rulesService, characterService);
  const vttService = new VttService(db, characterService);
  const combatService = new CombatService(db, rulesService, characterService, inventoryService);
  const bestiaryService = new BestiaryService(db, rulesService, characterService);

  if (activeRealtimeServer) {
    activeRealtimeServer.setVttService(vttService);
  }

  // Middlewares de autenticação e permissão
  const requireAuth = createAuthMiddleware(authService);

  // --- ROTAS DE AUTENTICAÇÃO ---
  app.post('/api/auth/register', (req: Request, res: Response) => {
    try {
      const result = authService.register(req.body);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    try {
      const result = authService.login(req.body);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(401).json({ error: err.message });
    }
  });

  app.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
    const user = authService.getUserById(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }
    res.json({ user });
  });

  // --- ROTAS DE CAMPANHAS ---
  app.post('/api/campaigns', requireAuth, (req: Request, res: Response) => {
    try {
      const campaign = campaignService.createCampaign(req.user!.userId, req.body);
      res.status(201).json({ campaign });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/campaigns', requireAuth, (req: Request, res: Response) => {
    try {
      const campaigns = campaignService.getUserCampaigns(req.user!.userId);
      res.json({ campaigns });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/campaigns/:campaignId', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    const campaign = campaignService.getCampaignById(req.params.campaignId);
    if (!campaign) {
      res.status(404).json({ error: 'Campanha não encontrada.' });
      return;
    }
    const ruleset = rulesService.getActiveRuleset(campaign.id);
    res.json({ campaign, role: req.membership!.role, ruleset });
  });

  app.patch('/api/campaigns/:campaignId', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const updated = campaignService.updateCampaign(req.params.campaignId, req.body);
      res.json({ campaign: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/campaigns/:campaignId/archive', requireAuth, rbacService.requireCampaignRole('owner'), (req: Request, res: Response) => {
    try {
      campaignService.archiveCampaign(req.params.campaignId);
      res.json({ success: true, message: 'Campanha arquivada com sucesso.' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Convites e Membros
  app.post('/api/campaigns/:campaignId/invites', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const invite = campaignService.createInvite(req.params.campaignId, req.body);
      res.status(201).json({ invite });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/campaigns/join', requireAuth, (req: Request, res: Response) => {
    try {
      const { code } = req.body;
      if (!code) {
        res.status(400).json({ error: 'Código de convite obrigatório' });
        return;
      }
      const result = campaignService.joinCampaignByInvite(code, req.user!.userId);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/campaigns/:campaignId/members', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const members = campaignService.getMembers(req.params.campaignId);
      res.json({ members });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/campaigns/:campaignId/members/:targetUserId', requireAuth, rbacService.requireCampaignRole('owner'), (req: Request, res: Response) => {
    try {
      const { role } = req.body;
      campaignService.updateMemberRole(req.params.campaignId, req.params.targetUserId, role, req.user!.userId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- ROTAS DO MOTOR DE REGRAS (ISOLADAS POR CAMPANHA) ---
  app.get('/api/campaigns/:campaignId/rules', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    const ruleset = rulesService.getActiveRuleset(req.params.campaignId);
    if (!ruleset) {
      res.status(404).json({ error: 'Nenhum conjunto de regras ativo encontrado para esta campanha.' });
      return;
    }
    res.json({ ruleset });
  });

  app.post('/api/campaigns/:campaignId/rules', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const { config, title } = req.body;
      if (!config || !config.systemName) {
        res.status(400).json({ error: 'Configuração de regras inválida: systemName é obrigatório.' });
        return;
      }
      const result = rulesService.saveRulesetVersion(req.params.campaignId, config, title);
      res.status(201).json({ result, message: 'Nova versão de regras da campanha salva com sucesso!' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- ROTAS DE CONDIÇÕES DO RULESET ---
  app.get('/api/campaigns/:campaignId/ruleset/conditions', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const conditions = rulesService.getConditions(req.params.campaignId);
      res.json({ conditions });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/campaigns/:campaignId/ruleset/conditions', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const condition = rulesService.addConditionDefinition(req.params.campaignId, req.body);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'ruleset:conditions_updated', conditions: rulesService.getConditions(req.params.campaignId) });
      }
      res.status(201).json({ condition });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/campaigns/:campaignId/ruleset/conditions/:conditionId', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const condition = rulesService.updateConditionDefinition(req.params.campaignId, req.params.conditionId, req.body);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'ruleset:conditions_updated', conditions: rulesService.getConditions(req.params.campaignId) });
      }
      res.json({ condition });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/campaigns/:campaignId/ruleset/conditions/:conditionId', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      rulesService.deleteConditionDefinition(req.params.campaignId, req.params.conditionId);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'ruleset:conditions_updated', conditions: rulesService.getConditions(req.params.campaignId) });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- ROTAS DE TIPOS DE DANO DO RULESET ---
  app.get('/api/campaigns/:campaignId/ruleset/damage-types', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const damageTypes = rulesService.getDamageTypes(req.params.campaignId);
      res.json({ damageTypes });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/campaigns/:campaignId/ruleset/damage-types', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const damageType = rulesService.addDamageType(req.params.campaignId, req.body);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'ruleset:damage_types_updated', damageTypes: rulesService.getDamageTypes(req.params.campaignId) });
      }
      res.status(201).json({ damageType });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/campaigns/:campaignId/ruleset/damage-types/:damageTypeId', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const damageType = rulesService.updateDamageType(req.params.campaignId, req.params.damageTypeId, req.body);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'ruleset:damage_types_updated', damageTypes: rulesService.getDamageTypes(req.params.campaignId) });
      }
      res.json({ damageType });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/campaigns/:campaignId/ruleset/damage-types/:damageTypeId', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      rulesService.deleteDamageType(req.params.campaignId, req.params.damageTypeId);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'ruleset:damage_types_updated', damageTypes: rulesService.getDamageTypes(req.params.campaignId) });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- ROTAS DE HABILIDADES DO RULESET ---
  app.get('/api/campaigns/:campaignId/ruleset/abilities', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const abilities = rulesService.getAbilities(req.params.campaignId);
      res.json({ abilities });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/campaigns/:campaignId/ruleset/abilities', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const ability = rulesService.addAbilityDefinition(req.params.campaignId, req.body);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'ruleset:abilities_updated', abilities: rulesService.getAbilities(req.params.campaignId) });
      }
      res.status(201).json({ ability });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/campaigns/:campaignId/ruleset/abilities/:abilityId', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const ability = rulesService.updateAbilityDefinition(req.params.campaignId, req.params.abilityId, req.body);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'ruleset:abilities_updated', abilities: rulesService.getAbilities(req.params.campaignId) });
      }
      res.json({ ability });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/campaigns/:campaignId/ruleset/abilities/:abilityId', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      rulesService.deleteAbilityDefinition(req.params.campaignId, req.params.abilityId);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'ruleset:abilities_updated', abilities: rulesService.getAbilities(req.params.campaignId) });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/campaigns/:campaignId/rules/validate', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    const { expression } = req.body;
    if (!expression) {
      res.status(400).json({ error: 'Expressão obrigatória para validação.' });
      return;
    }
    const result = rulesService.validateFormula(req.params.campaignId, expression);
    res.json(result);
  });

  app.post(['/api/campaigns/:campaignId/rules/roll', '/api/campaigns/:campaignId/dice/roll'], requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const { expression, formulaId, variables, characterId, isSecret } = req.body;
      const exprOrId = formulaId || expression;

      if (!exprOrId) {
        res.status(400).json({ error: 'Expressão ou identificador de fórmula obrigatório.' });
        return;
      }

      const rollResult = rulesService.evaluateFormula(req.params.campaignId, exprOrId, variables || {});

      // Salva a rolagem no histórico da campanha
      const rollId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO dice_rolls (id, campaign_id, user_id, character_id, expression, breakdown_json, total, context_type, is_secret)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'roll', ?)
      `).run(
        rollId,
        req.params.campaignId,
        req.user!.userId,
        characterId || null,
        exprOrId,
        JSON.stringify(rollResult.breakdown),
        rollResult.total,
        isSecret ? 1 : 0
      );

      let characterName: string | undefined = undefined;
      if (characterId) {
        const char = characterService.getCharacterById(req.params.campaignId, characterId);
        characterName = char?.name;
      }

      const now = new Date().toISOString();
      const rollPayload = {
        id: rollId,
        campaignId: req.params.campaignId,
        userId: req.user!.userId,
        username: req.user!.username,
        characterId: characterId || null,
        characterName,
        expression: exprOrId,
        total: rollResult.total,
        breakdown: rollResult.breakdown,
        isSecret: !!isSecret,
        timestamp: now,
        createdAt: now
      };

      // Transmite via WebSocket em tempo real para a sala da campanha
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(
          req.params.campaignId,
          {
            type: 'dice:rolled',
            roll: rollPayload
          },
          undefined,
          { masterOnly: !!isSecret }
        );
      }

      const isMaster = req.membership!.role === 'owner' || req.membership!.role === 'master' || req.membership!.role === 'assistant';

      if (isSecret && !isMaster) {
        // Se a rolagem for secreta e disparada por um jogador comum,
        // o jogador NÃO recebe o resultado nem o breakdown na resposta HTTP para impedir vazamento de segredos.
        res.json({
          id: rollId,
          isSecret: true,
          message: 'Rolagem secreta realizada com sucesso e enviada ao mestre.'
        });
      } else {
        res.json({
          ...rollPayload
        });
      }
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Consulta de histórico de rolagens com proteção de rolagens secretas
  app.get('/api/campaigns/:campaignId/rolls', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const isMaster = req.membership!.role === 'owner' || req.membership!.role === 'master' || req.membership!.role === 'assistant';
      const limit = req.query.limit ? Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10))) : 50;

      let sql = `
        SELECT dr.*, u.username, c.name as character_name
        FROM dice_rolls dr
        LEFT JOIN users u ON u.id = dr.user_id
        LEFT JOIN characters c ON c.id = dr.character_id
        WHERE dr.campaign_id = ?
      `;
      const params: any[] = [req.params.campaignId];

      if (!isMaster) {
        // Jogadores comuns NUNCA recebem rolagens secretas pelo histórico
        sql += ` AND dr.is_secret = 0`;
      }

      sql += ` ORDER BY dr.created_at DESC LIMIT ?`;
      params.push(limit);

      const rows = db.prepare(sql).all(...params) as any[];

      const rolls = rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        username: r.username || 'Desconhecido',
        characterId: r.character_id,
        characterName: r.character_name,
        expression: r.expression,
        total: r.total,
        breakdown: JSON.parse(r.breakdown_json || '{}'),
        isSecret: r.is_secret === 1,
        timestamp: r.created_at
      }));

      res.json({ rolls });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- ROTAS DE PERSONAGENS & FICHAS ---
  app.get('/api/campaigns/:campaignId/characters', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const isMaster = req.membership!.role === 'owner' || req.membership!.role === 'master';
      const characters = characterService.getCampaignCharacters(req.params.campaignId, req.user!.userId, isMaster);
      res.json({ characters });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/campaigns/:campaignId/characters', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const character = characterService.createCharacter(req.params.campaignId, req.user!.userId, req.body);
      
      // Notifica sala via realtime
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, {
          type: 'character:created',
          character: { id: character.id, name: character.name, userId: req.user!.userId }
        });
      }

      res.status(201).json({ character });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/campaigns/:campaignId/characters/:characterId', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    const character = characterService.getCharacterById(req.params.campaignId, req.params.characterId);
    if (!character) {
      res.status(404).json({ error: 'Personagem não encontrado nesta campanha.' });
      return;
    }
    res.json({ character });
  });

  app.patch('/api/campaigns/:campaignId/characters/:characterId', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const isMaster = req.membership!.role === 'owner' || req.membership!.role === 'master';
      const updated = characterService.updateCharacter(
        req.params.campaignId,
        req.params.characterId,
        req.body,
        req.user!.userId,
        isMaster
      );

      // Notifica em tempo real
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, {
          type: 'character:updated',
          character: updated
        });
      }

      res.json({ character: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- ROTAS DE CONDIÇÕES DO PERSONAGEM ---
  app.get('/api/campaigns/:campaignId/characters/:characterId/conditions', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const conditions = characterService.getCharacterConditions(req.params.campaignId, req.params.characterId);
      res.json({ conditions });
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.post('/api/campaigns/:campaignId/characters/:characterId/conditions', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const isMaster = req.membership!.role === 'owner' || req.membership!.role === 'master' || req.membership!.role === 'assistant';
      if (!isMaster) {
        res.status(403).json({ error: 'Apenas o Mestre pode aplicar condições manualmente por ferramenta administrativa.' });
        return;
      }
      const char = characterService.getCharacterById(req.params.campaignId, req.params.characterId);
      if (!char) {
        res.status(404).json({ error: 'Personagem não encontrado.' });
        return;
      }

      const condition = characterService.applyCondition(req.params.campaignId, req.params.characterId, req.body);
      const updatedChar = characterService.getCharacterById(req.params.campaignId, req.params.characterId);

      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, {
          type: 'character:conditions_updated',
          characterId: req.params.characterId,
          character: updatedChar
        });
      }

      res.status(201).json({ condition, character: updatedChar });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/campaigns/:campaignId/characters/:characterId/conditions/:activeConditionId', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const isMaster = req.membership!.role === 'owner' || req.membership!.role === 'master' || req.membership!.role === 'assistant';
      if (!isMaster) {
        res.status(403).json({ error: 'Apenas o Mestre pode remover condições manualmente por ferramenta administrativa.' });
        return;
      }
      const char = characterService.getCharacterById(req.params.campaignId, req.params.characterId);
      if (!char) {
        res.status(404).json({ error: 'Personagem não encontrado.' });
        return;
      }

      const success = characterService.removeCondition(req.params.campaignId, req.params.characterId, req.params.activeConditionId);
      const updatedChar = characterService.getCharacterById(req.params.campaignId, req.params.characterId);

      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, {
          type: 'character:conditions_updated',
          characterId: req.params.characterId,
          character: updatedChar
        });
      }

      res.json({ success, character: updatedChar });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- ROTAS DE MODELOS DE FICHA (TEMPLATES) ---
  app.get('/api/campaigns/:campaignId/templates', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const templates = characterService.getTemplates(req.params.campaignId);
      res.json({ templates });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/campaigns/:campaignId/templates/:templateId', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    const template = characterService.getTemplateById(req.params.campaignId, req.params.templateId);
    if (!template) {
      res.status(404).json({ error: 'Modelo de ficha não encontrado.' });
      return;
    }
    res.json({ template });
  });

  app.post('/api/campaigns/:campaignId/templates', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const { name, description, schema } = req.body;
      if (!name || !name.trim()) {
        res.status(400).json({ error: 'Nome do modelo é obrigatório.' });
        return;
      }
      if (!schema || !Array.isArray(schema.sections)) {
        res.status(400).json({ error: 'Esquema do modelo inválido. sections deve ser um array.' });
        return;
      }

      // Validar fórmulas de campos calculados do modelo contra as regras da campanha
      for (const section of schema.sections) {
        for (const field of section.fields || []) {
          if (field.isDerived && field.formula) {
            const validation = rulesService.validateFormula(req.params.campaignId, field.formula);
            if (!validation.isValid) {
              res.status(400).json({ 
                error: `Fórmula inválida no campo '${field.name}': ${validation.error}` 
              });
              return;
            }
          }
        }
      }

      const template = characterService.createTemplate(req.params.campaignId, name, description || '', schema);
      res.status(201).json({ template });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch('/api/campaigns/:campaignId/templates/:templateId', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const { name, description, schema } = req.body;
      if (schema && Array.isArray(schema.sections)) {
        for (const section of schema.sections) {
          for (const field of section.fields || []) {
            if (field.isDerived && field.formula) {
              const validation = rulesService.validateFormula(req.params.campaignId, field.formula);
              if (!validation.isValid) {
                res.status(400).json({ 
                  error: `Fórmula inválida no campo '${field.name}': ${validation.error}` 
                });
                return;
              }
            }
          }
        }
      }

      const updated = characterService.updateTemplate(req.params.campaignId, req.params.templateId, {
        name,
        description,
        schema
      });
      res.json({ template: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/campaigns/:campaignId/templates/:templateId', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      characterService.deleteTemplate(req.params.campaignId, req.params.templateId);
      res.json({ success: true, message: 'Modelo de ficha excluído com sucesso.' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- ROTAS DO CATÁLOGO DE ITENS DA CAMPANHA ---
  app.get('/api/campaigns/:campaignId/items', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const category = req.query.category as string | undefined;
      const search = req.query.search as string | undefined;
      const items = inventoryService.getCatalogItems(req.params.campaignId, category, search);
      res.json({ items });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/campaigns/:campaignId/items', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const item = inventoryService.createCatalogItem(req.params.campaignId, req.body);
      res.status(201).json({ item });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch('/api/campaigns/:campaignId/items/:itemId', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const updated = inventoryService.updateCatalogItem(req.params.campaignId, req.params.itemId, req.body);
      res.json({ item: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/campaigns/:campaignId/items/:itemId', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      inventoryService.deleteCatalogItem(req.params.campaignId, req.params.itemId);
      res.json({ success: true, message: 'Item excluído do catálogo.' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- ROTAS DE INVENTÁRIO DO PERSONAGEM ---
  app.get('/api/campaigns/:campaignId/characters/:characterId/inventory', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const inventory = inventoryService.getCharacterInventory(req.params.campaignId, req.params.characterId);
      res.json({ inventory });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/campaigns/:campaignId/characters/:characterId/inventory', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const isMaster = req.membership!.role === 'owner' || req.membership!.role === 'master';
      const char = characterService.getCharacterById(req.params.campaignId, req.params.characterId);
      if (!char) {
        res.status(404).json({ error: 'Personagem não encontrado.' });
        return;
      }
      if (char.user_id !== req.user!.userId && !isMaster) {
        res.status(403).json({ error: 'Você só pode adicionar itens aos seus próprios personagens.' });
        return;
      }

      const item = inventoryService.addItemToCharacter(req.params.campaignId, req.params.characterId, req.body, isMaster);
      const inventory = inventoryService.getCharacterInventory(req.params.campaignId, req.params.characterId);
      const character = characterService.getCharacterById(req.params.campaignId, req.params.characterId);

      // Notificação em tempo real
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, {
          type: 'inventory:updated',
          characterId: req.params.characterId,
          inventory,
          character
        });
      }

      res.status(201).json({ item, inventory, character });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch('/api/campaigns/:campaignId/characters/:characterId/inventory/:inventoryId', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const isMaster = req.membership!.role === 'owner' || req.membership!.role === 'master';
      const char = characterService.getCharacterById(req.params.campaignId, req.params.characterId);
      if (!char) {
        res.status(404).json({ error: 'Personagem não encontrado.' });
        return;
      }
      if (char.user_id !== req.user!.userId && !isMaster) {
        res.status(403).json({ error: 'Você só pode alterar o inventário de seus próprios personagens.' });
        return;
      }

      const updated = inventoryService.updateCharacterInventoryItem(
        req.params.campaignId,
        req.params.characterId,
        req.params.inventoryId,
        req.body
      );
      const inventory = inventoryService.getCharacterInventory(req.params.campaignId, req.params.characterId);
      const character = characterService.getCharacterById(req.params.campaignId, req.params.characterId);

      // Notificação em tempo real
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, {
          type: 'inventory:updated',
          characterId: req.params.characterId,
          inventory,
          character
        });
      }

      res.json({ item: updated, inventory, character });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/campaigns/:campaignId/characters/:characterId/inventory/:inventoryId', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const isMaster = req.membership!.role === 'owner' || req.membership!.role === 'master';
      const char = characterService.getCharacterById(req.params.campaignId, req.params.characterId);
      if (!char) {
        res.status(404).json({ error: 'Personagem não encontrado.' });
        return;
      }
      if (char.user_id !== req.user!.userId && !isMaster) {
        res.status(403).json({ error: 'Você só pode remover itens de seus próprios personagens.' });
        return;
      }

      inventoryService.removeCharacterInventoryItem(req.params.campaignId, req.params.characterId, req.params.inventoryId);
      const inventory = inventoryService.getCharacterInventory(req.params.campaignId, req.params.characterId);
      const character = characterService.getCharacterById(req.params.campaignId, req.params.characterId);

      // Notificação em tempo real
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, {
          type: 'inventory:updated',
          characterId: req.params.characterId,
          inventory,
          character
        });
      }

      res.json({ success: true, inventory, character });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Utilizar mecanicamente item do inventário (consumir, disparar, gastar bateria/alma)
  app.post('/api/campaigns/:campaignId/characters/:characterId/inventory/:inventoryId/use', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const isMaster = req.membership!.role === 'owner' || req.membership!.role === 'master';
      const result = inventoryService.useInventoryItem(
        req.params.campaignId,
        req.params.characterId,
        req.params.inventoryId,
        req.user!.userId,
        isMaster
      );
      const inventory = inventoryService.getCharacterInventory(req.params.campaignId, req.params.characterId);
      const character = result.character || characterService.getCharacterById(req.params.campaignId, req.params.characterId);

      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, {
          type: 'inventory:updated',
          characterId: req.params.characterId,
          inventory,
          character
        });
        if (character) {
          rt.broadcast(req.params.campaignId, {
            type: 'character:updated',
            character
          });
        }
      }

      res.json({ ...result, inventory, character });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Imbuir arma utilizando consumível do inventário
  app.post('/api/campaigns/:campaignId/characters/:characterId/inventory/imbue', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const isMaster = req.membership!.role === 'owner' || req.membership!.role === 'master';
      const result = inventoryService.imbueWeapon(
        req.params.campaignId,
        req.params.characterId,
        req.body,
        req.user!.userId,
        isMaster
      );
      const inventory = inventoryService.getCharacterInventory(req.params.campaignId, req.params.characterId);
      const character = result.character || characterService.getCharacterById(req.params.campaignId, req.params.characterId);

      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, {
          type: 'inventory:updated',
          characterId: req.params.characterId,
          inventory,
          character
        });
        if (character) {
          rt.broadcast(req.params.campaignId, {
            type: 'character:updated',
            character
          });
        }
      }

      res.json({ ...result, inventory, character });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- ROTAS DE SOLICITAÇÃO DE ITENS (ITEM REQUESTS) ---
  app.get('/api/campaigns/:campaignId/item-requests', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const isMaster = req.membership!.role === 'owner' || req.membership!.role === 'master' || req.membership!.role === 'assistant';
      const status = req.query.status as string | undefined;
      // Mestres visualizam todas as solicitações; jogadores comuns visualizam apenas as suas
      const userIdFilter = isMaster ? undefined : req.user!.userId;
      const requests = inventoryService.getItemRequests(req.params.campaignId, status, userIdFilter);
      res.json({ requests });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/campaigns/:campaignId/item-requests', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const request = inventoryService.createItemRequest(req.params.campaignId, req.user!.userId, req.body);

      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, {
          type: 'item_request:created',
          request
        }, undefined, { masterOnly: true });
      }

      res.status(201).json({ request });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/campaigns/:campaignId/item-requests/:requestId/review', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const request = inventoryService.reviewItemRequest(
        req.params.campaignId,
        req.params.requestId,
        req.user!.userId,
        req.body
      );

      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, {
          type: 'item_request:reviewed',
          request
        });
        if (request.status === 'approved') {
          const inv = inventoryService.getCharacterInventory(req.params.campaignId, request.character_id);
          const char = characterService.getCharacterById(req.params.campaignId, request.character_id);
          rt.broadcast(req.params.campaignId, {
            type: 'inventory:updated',
            characterId: request.character_id,
            inventory: inv,
            character: char
          });
        }
      }

      res.json({ request });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- TRANSFERÊNCIAS ATÔMICAS ENTRE PERSONAGENS ---
  app.post('/api/campaigns/:campaignId/characters/:characterId/inventory/transfer', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const isMaster = req.membership!.role === 'owner' || req.membership!.role === 'master';
      const result = inventoryService.transferItem(
        req.params.campaignId,
        req.params.characterId,
        req.body,
        req.user!.userId,
        isMaster
      );

      const fromInventory = inventoryService.getCharacterInventory(req.params.campaignId, req.params.characterId);
      const toInventory = inventoryService.getCharacterInventory(req.params.campaignId, req.body.targetCharacterId);
      const fromCharacter = characterService.getCharacterById(req.params.campaignId, req.params.characterId);
      const toCharacter = characterService.getCharacterById(req.params.campaignId, req.body.targetCharacterId);

      // Notificação em tempo real para a mesa
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, {
          type: 'inventory:transferred',
          transfer: result.transferred,
          fromCharacterId: req.params.characterId,
          toCharacterId: req.body.targetCharacterId,
          fromInventory,
          toInventory,
          fromCharacter,
          toCharacter
        });
        rt.broadcast(req.params.campaignId, {
          type: 'inventory:updated',
          characterId: req.params.characterId,
          inventory: fromInventory,
          character: fromCharacter
        });
        rt.broadcast(req.params.campaignId, {
          type: 'inventory:updated',
          characterId: req.body.targetCharacterId,
          inventory: toInventory,
          character: toCharacter
        });
      }

      res.json({
        ...result,
        inventory: fromInventory,
        character: fromCharacter,
        toInventory,
        toCharacter
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/campaigns/:campaignId/inventory/transfers', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const history = inventoryService.getTransferHistory(req.params.campaignId, limit);
      res.json({ history });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // --- ROTAS DA MESA VIRTUAL (VTT & CENAS) ---
  // ==========================================

  // Listar cenas e obter cena ativa da campanha
  app.get('/api/campaigns/:campaignId/scenes', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const scenes = vttService.getScenes(req.params.campaignId);
      const activeScene = vttService.getActiveScene(req.params.campaignId);
      res.json({ scenes, activeScene });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Criar nova cena (apenas Mestre)
  app.post('/api/campaigns/:campaignId/scenes', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const scene = vttService.createScene(req.params.campaignId, req.body);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'scene:created', scene });
        if (scene.is_active) {
          rt.broadcast(req.params.campaignId, { type: 'scene:active_changed', sceneId: scene.id, scene });
        }
      }
      res.status(201).json({ scene });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Atualizar configurações da cena (apenas Mestre)
  app.patch('/api/campaigns/:campaignId/scenes/:sceneId', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const scene = vttService.updateScene(req.params.campaignId, req.params.sceneId, req.body);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'scene:updated', scene });
        if (req.body.is_active) {
          rt.broadcast(req.params.campaignId, { type: 'scene:active_changed', sceneId: scene.id, scene });
        }
      }
      res.json({ scene });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Ativar cena para a mesa (apenas Mestre)
  app.post('/api/campaigns/:campaignId/scenes/:sceneId/activate', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const scene = vttService.setActiveScene(req.params.campaignId, req.params.sceneId);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'scene:active_changed', sceneId: scene.id, scene });
      }
      res.json({ scene });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Excluir cena (apenas Mestre)
  app.delete('/api/campaigns/:campaignId/scenes/:sceneId', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      vttService.deleteScene(req.params.campaignId, req.params.sceneId);
      const activeScene = vttService.getActiveScene(req.params.campaignId);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'scene:deleted', sceneId: req.params.sceneId, activeScene });
      }
      res.json({ success: true, activeScene });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Atualizar Fog of War da cena (apenas Mestre)
  app.post('/api/campaigns/:campaignId/scenes/:sceneId/fog', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const { fogData, fogEnabled } = req.body;
      const scene = vttService.updateScene(req.params.campaignId, req.params.sceneId, {
        fog_data: fogData,
        fog_enabled: fogEnabled
      });
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, {
          type: 'fog:updated',
          sceneId: scene.id,
          fogData: scene.fog_data,
          fogEnabled: scene.fog_enabled
        });
      }
      res.json({ scene });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ==========================================
  // --- ROTAS DE TOKENS DO MAPA ---
  // ==========================================

  // Listar tokens da cena (com filtragem de tokens ocultos para jogadores)
  app.get('/api/campaigns/:campaignId/scenes/:sceneId/tokens', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const isMaster = req.membership!.role === 'owner' || req.membership!.role === 'master' || req.membership!.role === 'assistant';
      const tokens = vttService.getTokens(req.params.campaignId, req.params.sceneId, isMaster, req.user!.userId);
      res.json({ tokens });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Criar token na cena
  app.post('/api/campaigns/:campaignId/scenes/:sceneId/tokens', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const isMaster = req.membership!.role === 'owner' || req.membership!.role === 'master' || req.membership!.role === 'assistant';
      
      // Se for jogador comum, só pode criar token para seu próprio personagem
      if (!isMaster) {
        if (!req.body.character_id) {
          res.status(403).json({ error: 'Jogadores comuns só podem criar tokens vinculados ao seu próprio personagem.' });
          return;
        }
        const char = characterService.getCharacterById(req.params.campaignId, req.body.character_id);
        if (!char || char.user_id !== req.user!.userId) {
          res.status(403).json({ error: 'Você não pode criar tokens para personagens de outros jogadores.' });
          return;
        }
      }

      const token = vttService.createToken(req.params.campaignId, req.params.sceneId, req.body);
      const rt = getRealtime();
      if (rt) {
        // Se o token for oculto, envia apenas para mestres
        rt.broadcast(
          req.params.campaignId,
          { type: 'token:created', token },
          undefined,
          { masterOnly: !token.is_visible }
        );
      }
      res.status(201).json({ token });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Atualizar / Mover token (com validação estrita de autorização)
  app.patch('/api/campaigns/:campaignId/tokens/:tokenId', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const isMaster = req.membership!.role === 'owner' || req.membership!.role === 'master' || req.membership!.role === 'assistant';
      const token = vttService.updateToken(
        req.params.campaignId,
        req.params.tokenId,
        req.body,
        req.user!.userId,
        isMaster
      );

      const rt = getRealtime();
      if (rt) {
        rt.broadcast(
          req.params.campaignId,
          { type: 'token:updated', token },
          undefined,
          { masterOnly: !token.is_visible }
        );
      }
      res.json({ token });
    } catch (err: any) {
      const statusCode = err.message.includes('permissão') ? 403 : 400;
      res.status(statusCode).json({ error: err.message });
    }
  });

  // Excluir token
  app.delete('/api/campaigns/:campaignId/tokens/:tokenId', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const isMaster = req.membership!.role === 'owner' || req.membership!.role === 'master' || req.membership!.role === 'assistant';
      vttService.deleteToken(req.params.campaignId, req.params.tokenId, req.user!.userId, isMaster);

      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'token:deleted', tokenId: req.params.tokenId });
      }
      res.json({ success: true });
    } catch (err: any) {
      const statusCode = err.message.includes('permissão') ? 403 : 400;
      res.status(statusCode).json({ error: err.message });
    }
  });

  // ==========================================
  // --- ROTAS DE COMBATE & INICIATIVA ---
  // ==========================================

  // Consultar encontro de combate ativo
  app.get('/api/campaigns/:campaignId/combat/active', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const isMaster = req.membership!.role === 'owner' || req.membership!.role === 'master' || req.membership!.role === 'assistant';
      const encounter = combatService.getActiveEncounter(req.params.campaignId, isMaster);
      res.json({ encounter });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Iniciar encontro de combate (apenas Mestre)
  app.post('/api/campaigns/:campaignId/combat/start', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const encounter = combatService.startEncounter(req.params.campaignId, req.body);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'combat:started', encounter });
      }
      res.status(201).json({ encounter });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Ativar combate com ordem de iniciativa validada (apenas Mestre)
  app.post('/api/campaigns/:campaignId/combat/:encounterId/activate', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const encounter = combatService.activateCombatEncounter(req.params.campaignId, req.params.encounterId);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'combat:started', encounter });
      }
      res.json({ encounter });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Atualizar encontro (rodada, status, etc.)
  app.patch('/api/campaigns/:campaignId/combat/:encounterId', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const encounter = combatService.updateEncounter(req.params.campaignId, req.params.encounterId, req.body);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'combat:updated', encounter });
      }
      res.json({ encounter });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Avançar turno de combate
  app.post('/api/campaigns/:campaignId/combat/:encounterId/next', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const encounter = combatService.nextTurn(req.params.campaignId, req.params.encounterId);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'combat:turn_advanced', encounter });
      }
      res.json({ encounter });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Encerrar turno (jogador do combatente ativo ou mestre)
  app.post('/api/campaigns/:campaignId/combat/:encounterId/end-turn', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const isMaster = req.membership!.role === 'owner' || req.membership!.role === 'master' || req.membership!.role === 'assistant';
      const encounter = combatService.endTurn(req.params.campaignId, req.params.encounterId, req.user!.userId, isMaster);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'combat:turn_advanced', encounter });
      }
      res.json({ encounter });
    } catch (err: any) {
      const status = err.message.includes('próprio personagem') || err.message.includes('não autorizado') ? 403 : 400;
      res.status(status).json({ error: err.message });
    }
  });

  // Retroceder turno de combate
  app.post('/api/campaigns/:campaignId/combat/:encounterId/prev', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const encounter = combatService.prevTurn(req.params.campaignId, req.params.encounterId);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'combat:updated', encounter });
      }
      res.json({ encounter });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Encerrar combate
  app.post('/api/campaigns/:campaignId/combat/:encounterId/end', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const encounter = combatService.endEncounter(req.params.campaignId, req.params.encounterId);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'combat:ended', encounter });
      }
      res.json({ encounter });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Listar combatentes de um encontro
  app.get('/api/campaigns/:campaignId/combat/:encounterId/combatants', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const isMaster = req.membership!.role === 'owner' || req.membership!.role === 'master' || req.membership!.role === 'assistant';
      const combatants = combatService.getCombatants(req.params.campaignId, req.params.encounterId, isMaster);
      res.json({ combatants });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Adicionar participante ao combate
  app.post('/api/campaigns/:campaignId/combat/:encounterId/combatants', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const combatant = combatService.addCombatant(req.params.campaignId, req.params.encounterId, req.body);
      const encounter = combatService.getEncounterById(req.params.campaignId, req.params.encounterId, true);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(
          req.params.campaignId,
          { type: 'combat:combatant_added', combatant, encounter },
          undefined,
          { masterOnly: combatant.is_hidden }
        );
      }
      res.status(201).json({ combatant, encounter });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Atualizar combatente
  app.patch('/api/campaigns/:campaignId/combat/:encounterId/combatants/:combatantId', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const combatant = combatService.updateCombatant(req.params.campaignId, req.params.combatantId, req.body);
      const encounter = combatService.getEncounterById(req.params.campaignId, req.params.encounterId, true);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'combat:combatant_updated', combatant, encounter });
      }
      res.json({ combatant, encounter });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Ajuste administrativo de ações usadas do combatente (apenas Mestre)
  app.patch('/api/campaigns/:campaignId/combat/:encounterId/combatants/:combatantId/actions', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const combatant = combatService.resetCombatantActions(req.params.campaignId, req.params.combatantId, req.body.actions);
      const encounter = combatService.getEncounterById(req.params.campaignId, req.params.encounterId, true);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'combat:combatant_updated', combatant, encounter });
      }
      res.json({ combatant, encounter });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Remover combatente
  app.delete('/api/campaigns/:campaignId/combat/:encounterId/combatants/:combatantId', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      combatService.removeCombatant(req.params.campaignId, req.params.combatantId);
      const encounter = combatService.getEncounterById(req.params.campaignId, req.params.encounterId, true);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'combat:combatant_removed', combatantId: req.params.combatantId, encounter });
      }
      res.json({ success: true, encounter });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- ROTAS DE CONDIÇÕES EM COMBATENTES ---
  app.get('/api/campaigns/:campaignId/combat/:encounterId/combatants/:combatantId/conditions', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const conditions = combatService.getCombatantConditions(req.params.campaignId, req.params.combatantId);
      res.json({ conditions });
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.post('/api/campaigns/:campaignId/combat/:encounterId/combatants/:combatantId/conditions', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const isMaster = req.membership!.role === 'owner' || req.membership!.role === 'master' || req.membership!.role === 'assistant';
      if (!isMaster) {
        res.status(403).json({ error: 'Apenas o Mestre pode aplicar condições manualmente por ferramenta administrativa.' });
        return;
      }
      const combatant = combatService.getCombatantById(req.params.campaignId, req.params.combatantId);
      if (!combatant) {
        res.status(404).json({ error: 'Combatente não encontrado.' });
        return;
      }

      const activeCondition = combatService.applyConditionToCombatant(
        req.params.campaignId,
        req.params.encounterId,
        req.params.combatantId,
        req.body,
        req.user?.username || 'Mestre',
        true
      );

      const updatedCombatant = combatService.getCombatantById(req.params.campaignId, req.params.combatantId);
      const encounter = combatService.getEncounterById(req.params.campaignId, req.params.encounterId, true);

      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, {
          type: 'combat:condition_applied',
          combatantId: req.params.combatantId,
          condition: activeCondition,
          combatant: updatedCombatant,
          encounter
        });
      }

      res.status(201).json({ condition: activeCondition, combatant: updatedCombatant });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/campaigns/:campaignId/combat/:encounterId/combatants/:combatantId/conditions/:activeConditionId', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const isMaster = req.membership!.role === 'owner' || req.membership!.role === 'master' || req.membership!.role === 'assistant';
      if (!isMaster) {
        res.status(403).json({ error: 'Apenas o Mestre pode remover condições manualmente por ferramenta administrativa.' });
        return;
      }
      const combatant = combatService.getCombatantById(req.params.campaignId, req.params.combatantId);
      if (!combatant) {
        res.status(404).json({ error: 'Combatente não encontrado.' });
        return;
      }

      const success = combatService.removeConditionFromCombatant(
        req.params.campaignId,
        req.params.encounterId,
        req.params.combatantId,
        req.params.activeConditionId,
        req.user?.username || 'Mestre',
        true
      );

      const updatedCombatant = combatService.getCombatantById(req.params.campaignId, req.params.combatantId);
      const encounter = combatService.getEncounterById(req.params.campaignId, req.params.encounterId, true);

      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, {
          type: 'combat:condition_removed',
          combatantId: req.params.combatantId,
          activeConditionId: req.params.activeConditionId,
          combatant: updatedCombatant,
          encounter
        });
      }

      res.json({ success, combatant: updatedCombatant });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Rolar iniciativa (para um ou todos os combatentes)
  app.post('/api/campaigns/:campaignId/combat/:encounterId/initiative', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const { combatantId } = req.body;
      if (combatantId) {
        combatService.rollCombatantInitiative(req.params.campaignId, combatantId);
      } else {
        combatService.rollAllInitiatives(req.params.campaignId, req.params.encounterId);
      }
      const encounter = combatService.getEncounterById(req.params.campaignId, req.params.encounterId, true);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'combat:initiative_rolled', encounter });
      }
      res.json({ encounter });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Executar ação de combate (dano, cura, alteração de recurso)
  app.post('/api/campaigns/:campaignId/combat/:encounterId/action', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const isMaster = req.membership!.role === 'owner' || req.membership!.role === 'master' || req.membership!.role === 'assistant';
      const actorName = req.body.actor_name || req.user!.username;

      // Bloqueio de dano manual arbitrário por jogadores comuns
      if (!isMaster && (req.body.action_mode === 'manual' || (req.body.action_type === 'damage' && req.body.amount !== undefined && !req.body.weapon_id && !req.body.formula))) {
        res.status(403).json({ error: 'Jogadores comuns não podem aplicar dano manual arbitrário. Selecione uma arma ou habilidade válida da sua ficha.' });
        return;
      }

      // Se for jogador comum executando ação em nome de outro personagem sem permissão
      if (!isMaster && req.body.actor_id) {
        const actorCombatant = combatService.getCombatantById(req.params.campaignId, req.body.actor_id);
        if (actorCombatant?.character_id) {
          const char = characterService.getCharacterById(req.params.campaignId, actorCombatant.character_id);
          if (char && char.user_id !== req.user!.userId) {
            res.status(403).json({ error: 'Você não pode realizar ações em nome do personagem de outro jogador.' });
            return;
          }
        }
      }

      const result = combatService.applyCombatAction(req.params.campaignId, req.params.encounterId, {
        ...req.body,
        actor_name: actorName,
        is_master: isMaster,
        user_id: req.user!.userId
      });

      const rt = getRealtime();
      if (rt) {
        const updatedEncounter = combatService.getEncounterById(req.params.campaignId, req.params.encounterId, true);

        // Se atualizou a ficha de um personagem, notifica a mesa
        if (result.updatedCharacter) {
          rt.broadcast(req.params.campaignId, {
            type: 'character:updated',
            character: result.updatedCharacter
          });
        }
        if (result.updatedTargetCharacter) {
          rt.broadcast(req.params.campaignId, {
            type: 'character:updated',
            character: result.updatedTargetCharacter
          });
        }
        // Notifica aplicação de condições em tempo real
        if (Array.isArray(result.appliedConditions)) {
          for (const ac of result.appliedConditions) {
            if (ac.status === 'applied' && ac.activeCondition) {
              rt.broadcast(req.params.campaignId, {
                type: 'combat:condition_applied',
                combatantId: result.targetCombatant.id,
                condition: ac.activeCondition,
                combatant: result.targetCombatant,
                encounter: updatedEncounter
              });
            }
          }
        }
        // Se o combatente possui token, notifica atualização do token
        if (result.targetCombatant.token_id) {
          const updatedToken = vttService.getTokenById(req.params.campaignId, result.targetCombatant.token_id);
          if (updatedToken) {
            rt.broadcast(req.params.campaignId, {
              type: 'token:updated',
              token: updatedToken
            });
          }
        }
        if (result.consumedItem || result.imbuedWeapon) {
          rt.broadcast(req.params.campaignId, {
            type: 'inventory:updated',
            characterId: result.actorCombatant?.character_id
          });
        }
        rt.broadcast(req.params.campaignId, {
          type: 'combat:updated',
          encounter: updatedEncounter
        });
        rt.broadcast(req.params.campaignId, {
          type: 'combat:action_logged',
          actionLog: result.actionLog,
          targetCombatant: result.targetCombatant,
          actorCombatant: result.actorCombatant,
          encounter: updatedEncounter
        });
      }

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Obter logs de ações de combate
  app.get('/api/campaigns/:campaignId/combat/:encounterId/logs', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const isMaster = req.membership!.role === 'owner' || req.membership!.role === 'master' || req.membership!.role === 'assistant';
      const logs = combatService.getCombatLogs(req.params.campaignId, req.params.encounterId, isMaster);
      res.json({ logs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // --- ROTAS DO BESTIÁRIO (CRIATURAS & NPCs) ---
  // ==========================================

  // Listar criaturas do bestiário (seguro por padrão: jogadores só veem criaturas com is_revealed = 1)
  app.get('/api/campaigns/:campaignId/bestiary', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const isMaster = req.membership!.role === 'owner' || req.membership!.role === 'master' || req.membership!.role === 'assistant';
      const category = req.query.category as string | undefined;
      const search = req.query.search as string | undefined;
      const creatures = bestiaryService.getCreatures(req.params.campaignId, { category, search }, isMaster);
      res.json({ creatures });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Obter criatura do bestiário por ID (404 para jogadores se is_revealed = 0)
  app.get('/api/campaigns/:campaignId/bestiary/:creatureId', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const isMaster = req.membership!.role === 'owner' || req.membership!.role === 'master' || req.membership!.role === 'assistant';
      const creature = bestiaryService.getCreatureById(req.params.campaignId, req.params.creatureId, isMaster);
      if (!creature) {
        res.status(404).json({ error: 'Criatura não encontrada no bestiário.' });
        return;
      }
      res.json({ creature });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Criar criatura no bestiário (apenas Mestre, padrão is_revealed = 0)
  app.post('/api/campaigns/:campaignId/bestiary', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const creature = bestiaryService.createCreature(req.params.campaignId, req.body);
      const rt = getRealtime();
      if (rt) {
        rt.broadcastFiltered(req.params.campaignId, (client) => {
          const clientIsMaster = client.role === 'owner' || client.role === 'master' || client.role === 'assistant';
          if (clientIsMaster) return { type: 'bestiary:updated', creature };
          if (creature.is_revealed) return { type: 'bestiary:updated', creature: bestiaryService.sanitizeCreatureForPlayer(creature) };
          return null;
        });
      }
      res.status(201).json({ creature });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Revelar criatura no bestiário para jogadores (apenas Mestre)
  app.post('/api/campaigns/:campaignId/bestiary/:creatureId/reveal', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const creature = bestiaryService.revealCreature(req.params.campaignId, req.params.creatureId);
      const rt = getRealtime();
      if (rt) {
        rt.broadcastFiltered(req.params.campaignId, (client) => {
          const clientIsMaster = client.role === 'owner' || client.role === 'master' || client.role === 'assistant';
          if (clientIsMaster) return { type: 'bestiary:updated', creature };
          return { type: 'bestiary:updated', creature: bestiaryService.sanitizeCreatureForPlayer(creature) };
        });
      }
      res.json({ creature });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Ocultar criatura no bestiário dos jogadores (apenas Mestre)
  app.post('/api/campaigns/:campaignId/bestiary/:creatureId/hide', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const creature = bestiaryService.hideCreature(req.params.campaignId, req.params.creatureId);
      const rt = getRealtime();
      if (rt) {
        rt.broadcastFiltered(req.params.campaignId, (client) => {
          const clientIsMaster = client.role === 'owner' || client.role === 'master' || client.role === 'assistant';
          if (clientIsMaster) return { type: 'bestiary:updated', creature };
          // Para jogadores, enviamos instrução de remoção/atualização da criatura da lista
          return { type: 'bestiary:updated', creatureId: creature.id, hidden: true };
        });
      }
      res.json({ creature });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Atualizar campos revelados progressivamente (apenas Mestre)
  app.patch('/api/campaigns/:campaignId/bestiary/:creatureId/revealed-fields', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const creature = bestiaryService.updateRevealedFields(req.params.campaignId, req.params.creatureId, req.body.revealed_fields || {});
      const rt = getRealtime();
      if (rt) {
        rt.broadcastFiltered(req.params.campaignId, (client) => {
          const clientIsMaster = client.role === 'owner' || client.role === 'master' || client.role === 'assistant';
          if (clientIsMaster) return { type: 'bestiary:updated', creature };
          if (creature.is_revealed) return { type: 'bestiary:updated', creature: bestiaryService.sanitizeCreatureForPlayer(creature) };
          return null;
        });
      }
      res.json({ creature });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Atualizar criatura do bestiário (apenas Mestre)
  app.put('/api/campaigns/:campaignId/bestiary/:creatureId', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const creature = bestiaryService.updateCreature(req.params.campaignId, req.params.creatureId, req.body);
      const rt = getRealtime();
      if (rt) {
        rt.broadcastFiltered(req.params.campaignId, (client) => {
          const clientIsMaster = client.role === 'owner' || client.role === 'master' || client.role === 'assistant';
          if (clientIsMaster) return { type: 'bestiary:updated', creature };
          if (creature.is_revealed) return { type: 'bestiary:updated', creature: bestiaryService.sanitizeCreatureForPlayer(creature) };
          return null;
        });
      }
      res.json({ creature });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Duplicar criatura / criar variante (apenas Mestre, padrão is_revealed = 0)
  app.post('/api/campaigns/:campaignId/bestiary/:creatureId/duplicate', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const creature = bestiaryService.duplicateCreature(req.params.campaignId, req.params.creatureId, req.body);
      const rt = getRealtime();
      if (rt) {
        rt.broadcastFiltered(req.params.campaignId, (client) => {
          const clientIsMaster = client.role === 'owner' || client.role === 'master' || client.role === 'assistant';
          if (clientIsMaster) return { type: 'bestiary:updated', creature };
          if (creature.is_revealed) return { type: 'bestiary:updated', creature: bestiaryService.sanitizeCreatureForPlayer(creature) };
          return null;
        });
      }
      res.status(201).json({ creature });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Excluir criatura do bestiário (apenas Mestre)
  app.delete('/api/campaigns/:campaignId/bestiary/:creatureId', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      bestiaryService.deleteCreature(req.params.campaignId, req.params.creatureId);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'bestiary:updated', creatureId: req.params.creatureId });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ==========================================
  // --- ROTAS DE GERENCIAMENTO DE ENCONTROS ---
  // ==========================================

  // Listar todos os encontros da campanha (prep, active, ended)
  app.get('/api/campaigns/:campaignId/combat/encounters', requireAuth, rbacService.requireCampaignRole('player'), (req: Request, res: Response) => {
    try {
      const isMaster = req.membership!.role === 'owner' || req.membership!.role === 'master' || req.membership!.role === 'assistant';
      const encounters = combatService.getEncounters(req.params.campaignId, isMaster);
      res.json({ encounters });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Criar encontro preparado (apenas Mestre)
  app.post('/api/campaigns/:campaignId/combat/encounters', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const encounter = combatService.createPreparedEncounter(req.params.campaignId, req.body);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'combat:encounter_created', encounter });
      }
      res.status(201).json({ encounter });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Duplicar encontro preparado (apenas Mestre)
  app.post('/api/campaigns/:campaignId/combat/encounters/:encounterId/duplicate', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const encounter = combatService.duplicateEncounter(req.params.campaignId, req.params.encounterId);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'combat:encounter_created', encounter });
      }
      res.status(201).json({ encounter });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Excluir encontro (apenas Mestre)
  app.delete('/api/campaigns/:campaignId/combat/encounters/:encounterId', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      combatService.deleteEncounter(req.params.campaignId, req.params.encounterId);
      const rt = getRealtime();
      if (rt) {
        rt.broadcast(req.params.campaignId, { type: 'combat:encounter_deleted', encounterId: req.params.encounterId });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Adicionar criaturas / reforços a partir do bestiário para o combate e mapa
  app.post('/api/campaigns/:campaignId/combat/:encounterId/spawn-creatures', requireAuth, rbacService.requireCampaignRole('master'), (req: Request, res: Response) => {
    try {
      const { creature_id, count, scene_id, x, y, name_prefix, is_hidden } = req.body;
      if (!creature_id) {
        res.status(400).json({ error: 'Identificador da criatura do bestiário é obrigatório.' });
        return;
      }
      const combatants = combatService.spawnCreaturesToEncounter(
        req.params.campaignId,
        req.params.encounterId,
        creature_id,
        count || 1,
        { scene_id, x, y, name_prefix, is_hidden }
      );
      const encounter = combatService.getEncounterById(req.params.campaignId, req.params.encounterId, true);

      const rt = getRealtime();
      if (rt) {
        for (const c of combatants) {
          if (c.token_id && (scene_id || encounter?.scene_id)) {
            const token = vttService.getTokenById(req.params.campaignId, c.token_id);
            if (token) {
              rt.broadcast(
                req.params.campaignId,
                { type: 'token:created', token },
                undefined,
                { masterOnly: !token.is_visible }
              );
            }
          }
          rt.broadcast(
            req.params.campaignId,
            { type: 'combat:combatant_added', combatant: c, encounter },
            undefined,
            { masterOnly: c.is_hidden }
          );
        }
        rt.broadcast(req.params.campaignId, {
          type: 'combat:reinforcements_added',
          combatants,
          encounter
        });
      }

      res.status(201).json({ combatants, encounter });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Servir SPA estática do frontend se compilada
  const clientDist = path.join(__dirname, '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req: Request, res: Response, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  return {
    app,
    db,
    authService,
    rbacService,
    rulesService,
    campaignService,
    characterService,
    inventoryService,
    vttService,
    combatService,
    bestiaryService,
    realtimeServer: activeRealtimeServer,
    setRealtimeServer
  };
}
