import React, { useState, useEffect } from 'react';
import { 
  CombatEncounter, Combatant, CombatLog, Character, Token, Campaign, User, api, CharacterInventoryItem,
  ConditionDefinition, AbilityDefinition, BestiaryCreature
} from '../services/api';
import { 
  Swords, Play, Square, SkipForward, SkipBack, Dices, 
  Plus, Trash2, EyeOff, 
  History, Flame, Droplets, X, User as UserIcon,
  Shield, Zap, Crosshair, Target, CheckCircle2, AlertCircle, Wind, Skull, Wand2, Sparkles,
  HeartPulse, BookOpen
} from 'lucide-react';

export const getHpStatusLabel = (status?: string | null) => {
  switch (status) {
    case 'healthy': return 'Saudável';
    case 'injured': return 'Ferido';
    case 'bloodied': return 'Ensanguentado';
    case 'critical': return 'Crítico';
    case 'defeated': return 'Derrotado';
    default: return 'Desconhecido';
  }
};

export const getHpStatusColor = (hpPercent: number, status?: string | null) => {
  if (status === 'defeated' || hpPercent <= 0) return 'bg-slate-600';
  if (status === 'critical' || hpPercent <= 25) return 'bg-rose-500';
  if (status === 'bloodied' || hpPercent <= 50) return 'bg-amber-500';
  if (status === 'injured' || hpPercent <= 75) return 'bg-teal-500';
  return 'bg-emerald-500';
};

interface CombatTrackerProps {
  campaign: Campaign;
  user: User;
  isMaster: boolean;
  encounter: CombatEncounter | null;
  characters: Character[];
  tokens?: Token[];
  onEncounterUpdated: (encounter: CombatEncounter | null) => void;
  onCharacterUpdated?: (character: Character) => void;
}

export const CombatTracker: React.FC<CombatTrackerProps> = ({
  campaign,
  user,
  isMaster,
  encounter,
  characters,
  tokens = [],
  onEncounterUpdated,
  onCharacterUpdated
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showLogsDrawer, setShowLogsDrawer] = useState(false);
  const [logs, setLogs] = useState<CombatLog[]>([]);

  // Form states para Adicionar Combatente
  const [selectedTokenId, setSelectedTokenId] = useState('');
  const [newCombatantCharId, setNewCombatantCharId] = useState('');
  const [newCombatantName, setNewCombatantName] = useState('');
  const [newCombatantAvatar, setNewCombatantAvatar] = useState('');
  const [newCombatantHp, setNewCombatantHp] = useState<number>(20);
  const [newCombatantFormula, setNewCombatantFormula] = useState('1d20');
  const [newCombatantDefense, setNewCombatantDefense] = useState<number>(10);
  const [newCombatantDR, setNewCombatantDR] = useState<number>(0);
  const [newCombatantResistances, setNewCombatantResistances] = useState('');
  const [newCombatantVulnerabilities, setNewCombatantVulnerabilities] = useState('');
  const [newCombatantImmunities, setNewCombatantImmunities] = useState('');
  const [newCombatantIsNpc, setNewCombatantIsNpc] = useState(false);
  const [newCombatantIsHidden, setNewCombatantIsHidden] = useState(false);

  // Bestiário & Reforços
  const [bestiaryCreatures, setBestiaryCreatures] = useState<BestiaryCreature[]>([]);
  const [addCombatantTab, setAddCombatantTab] = useState<'bestiary' | 'custom'>('bestiary');
  const [selectedCreatureId, setSelectedCreatureId] = useState('');
  const [spawnCount, setSpawnCount] = useState(1);
  const [isSpawningCreature, setIsSpawningCreature] = useState(false);

  useEffect(() => {
    if (isMaster && campaign?.id) {
      api.getBestiary(campaign.id)
        .then((creatures: BestiaryCreature[]) => {
          setBestiaryCreatures(creatures);
          if (creatures.length > 0 && !selectedCreatureId) {
            setSelectedCreatureId(creatures[0].id);
          }
        })
        .catch(console.error);
    }
  }, [campaign?.id, isMaster]);

  // Form states para Ação de Combate Baseada em Regras
  const [selectedTarget, setSelectedTarget] = useState<Combatant | null>(null);
  const [selectedActorId, setSelectedActorId] = useState<string>('');
  const [actionMode, setActionMode] = useState<'weapon' | 'ability' | 'consumable' | 'imbue' | 'defend' | 'dodge' | 'manual'>('weapon');
  const [customDodgeFormula, setCustomDodgeFormula] = useState('');
  const [selectedWeaponId, setSelectedWeaponId] = useState<string>('');
  const [actorWeapons, setActorWeapons] = useState<CharacterInventoryItem[]>([]);
  const [actorConsumables, setActorConsumables] = useState<CharacterInventoryItem[]>([]);
  const [actorImbueItems, setActorImbueItems] = useState<CharacterInventoryItem[]>([]);
  const [selectedConsumableId, setSelectedConsumableId] = useState<string>('');
  const [selectedImbueItemId, setSelectedImbueItemId] = useState<string>('');
  const [targetWeaponForImbueId, setTargetWeaponForImbueId] = useState<string>('');
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);

  // Habilidades / Poderes do Sistema
  const [rulesetAbilities, setRulesetAbilities] = useState<AbilityDefinition[]>([]);
  const [selectedAbilityId, setSelectedAbilityId] = useState<string>('');
  const [abilityName, setAbilityName] = useState('');
  const [abilityAttackFormula, setAbilityAttackFormula] = useState('');
  const [abilityDamageFormula, setAbilityDamageFormula] = useState('2d6');
  const [abilityDamageType, setAbilityDamageType] = useState('magico');
  const [resourceCostName, setResourceCostName] = useState('mana');
  const [resourceCostAmount, setResourceCostAmount] = useState<number>(0);

  // Ajuste Manual (Mestre)
  const [manualActionType, setManualActionType] = useState<'damage' | 'heal' | 'resource_mod'>('damage');
  const [manualResourceName, setManualResourceName] = useState('vida');
  const [manualAmount, setManualAmount] = useState<number>(5);
  const [manualFormula, setManualFormula] = useState('');
  const [actionNotes, setActionNotes] = useState('');

  // Status de execução e resultado de feedback visual
  const [isApplyingAction, setIsApplyingAction] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<any>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Estados para Condições / Efeitos de Status
  const [showConditionModal, setShowConditionModal] = useState(false);
  const [selectedCombatantForCondition, setSelectedCombatantForCondition] = useState<Combatant | null>(null);
  const [rulesetConditions, setRulesetConditions] = useState<ConditionDefinition[]>([]);
  const [selectedConditionDefId, setSelectedConditionDefId] = useState<string>('');
  const [customConditionName, setCustomConditionName] = useState<string>('');
  const [customDurationType, setCustomDurationType] = useState<'turns' | 'rounds' | 'actions' | 'permanent'>('turns');
  const [customDurationValue, setCustomDurationValue] = useState<number>(3);
  const [isApplyingCondition, setIsApplyingCondition] = useState(false);

  useEffect(() => {
    api.getRulesetConditions(campaign.id).then(conds => setRulesetConditions(conds)).catch(() => {});
    api.getRulesetAbilities(campaign.id).then(abs => {
      setRulesetAbilities(abs);
      if (abs && abs.length > 0) {
        setSelectedAbilityId(abs[0].id);
      }
    }).catch(() => {});
  }, [campaign.id]);

  const handleOpenConditionModal = (combatant: Combatant) => {
    setSelectedCombatantForCondition(combatant);
    setSelectedConditionDefId(rulesetConditions.length > 0 ? rulesetConditions[0].id : '');
    setCustomConditionName('');
    setCustomDurationType('turns');
    setCustomDurationValue(3);
    setShowConditionModal(true);
  };

  const handleApplyCondition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!encounter || !selectedCombatantForCondition) return;

    try {
      setIsApplyingCondition(true);
      let payload: any = {};
      if (selectedConditionDefId) {
        const def = rulesetConditions.find(rc => rc.id === selectedConditionDefId);
        if (def) {
          payload = {
            condition_id: def.id,
            name: def.name,
            duration_type: def.default_duration.type,
            duration_remaining: def.default_duration.value,
            tick_timing: def.tick_timing,
            modifiers: def.modifiers,
            effects: def.effects,
            color: def.color,
            icon: def.icon
          };
        }
      } else if (customConditionName.trim()) {
        payload = {
          name: customConditionName.trim(),
          duration_type: customDurationType,
          duration_remaining: customDurationType === 'permanent' ? 0 : customDurationValue
        };
      } else {
        alert('Selecione uma condição ou informe o nome de uma condição personalizada.');
        setIsApplyingCondition(false);
        return;
      }

      await api.applyCombatantCondition(campaign.id, encounter.id, selectedCombatantForCondition.id, payload);
      const updated = await api.getActiveCombat(campaign.id);
      onEncounterUpdated(updated);
      setShowConditionModal(false);
    } catch (err: any) {
      alert(`Erro ao aplicar condição: ${err.message}`);
    } finally {
      setIsApplyingCondition(false);
    }
  };

  const handleRemoveCondition = async (combatantId: string, activeConditionId: string) => {
    if (!encounter) return;
    try {
      await api.removeCombatantCondition(campaign.id, encounter.id, combatantId, activeConditionId);
      const updated = await api.getActiveCombat(campaign.id);
      onEncounterUpdated(updated);
    } catch (err: any) {
      alert(`Erro ao remover condição: ${err.message}`);
    }
  };

  useEffect(() => {
    if (encounter?.id) {
      loadLogs(encounter.id);
    }
  }, [encounter?.id]);

  const loadLogs = async (encId: string) => {
    try {
      const history = await api.getCombatLogs(campaign.id, encId);
      setLogs(history);
    } catch (e) {
      console.error('Erro ao carregar logs de combate:', e);
    }
  };

  const handleStartCombat = async () => {
    try {
      const enc = await api.startCombat(campaign.id, { name: 'Encontro de Combate' });
      onEncounterUpdated(enc);
    } catch (err: any) {
      alert(`Erro ao iniciar combate: ${err.message}`);
    }
  };

  const handleActivateCombat = async () => {
    if (!encounter) return;
    try {
      const enc = await api.activateCombat(campaign.id, encounter.id);
      onEncounterUpdated(enc);
      loadLogs(encounter.id);
    } catch (err: any) {
      alert(`Erro ao ativar combate com iniciativa: ${err.message}`);
    }
  };

  const handleEndTurn = async () => {
    if (!encounter) return;
    try {
      const enc = await api.endCombatTurn(campaign.id, encounter.id);
      onEncounterUpdated(enc);
      loadLogs(encounter.id);
    } catch (err: any) {
      alert(`Erro ao encerrar turno: ${err.message}`);
    }
  };

  const handleNextTurn = async () => {
    if (!encounter) return;
    try {
      const enc = await api.nextCombatTurn(campaign.id, encounter.id);
      onEncounterUpdated(enc);
      loadLogs(encounter.id);
    } catch (err: any) {
      alert(`Erro ao avançar turno: ${err.message}`);
    }
  };

  const handlePrevTurn = async () => {
    if (!encounter) return;
    try {
      const enc = await api.prevCombatTurn(campaign.id, encounter.id);
      onEncounterUpdated(enc);
    } catch (err: any) {
      alert(`Erro ao retroceder turno: ${err.message}`);
    }
  };

  const handleEndCombat = async () => {
    if (!encounter) return;
    if (!confirm('Deseja realmente encerrar este combate?')) return;
    try {
      await api.endCombat(campaign.id, encounter.id);
      onEncounterUpdated(null);
    } catch (err: any) {
      alert(`Erro ao encerrar combate: ${err.message}`);
    }
  };

  const handleRollAllInitiative = async () => {
    if (!encounter) return;
    try {
      const enc = await api.rollCombatInitiative(campaign.id, encounter.id);
      onEncounterUpdated(enc);
      loadLogs(encounter.id);
    } catch (err: any) {
      alert(`Erro ao rolar iniciativas: ${err.message}`);
    }
  };

  // Carregar inventário (armas, consumíveis, óleos/imbuição) do atacante quando o combatente ativo muda
  useEffect(() => {
    if (selectedActorId && encounter) {
      const actor = encounter.combatants?.find(c => c.id === selectedActorId);
      if (actor?.character_id) {
        setIsLoadingInventory(true);
        api.getCharacterInventory(campaign.id, actor.character_id)
          .then(inv => {
            const weapons = inv.items.filter(i => 
              i.category === 'arma' || 
              i.properties?.dano || 
              i.properties?.damage_formula || 
              i.is_equipped
            );
            setActorWeapons(weapons);
            if (weapons.length > 0) {
              setSelectedWeaponId(weapons[0].id);
              setTargetWeaponForImbueId(weapons[0].id);
            } else {
              setSelectedWeaponId('');
              setTargetWeaponForImbueId('');
            }

            const consumables = inv.items.filter(i => 
              i.category === 'consumivel' ||
              i.category === 'pocao' ||
              i.properties?.tipo === 'pocao' ||
              i.properties?.healing_formula ||
              i.properties?.apply_conditions ||
              i.properties?.charges !== undefined
            );
            setActorConsumables(consumables);
            if (consumables.length > 0) {
              setSelectedConsumableId(consumables[0].id);
            } else {
              setSelectedConsumableId('');
            }

            const imbues = inv.items.filter(i => 
              i.properties?.can_imbue === true ||
              i.properties?.imbued_effects ||
              i.properties?.imbue_duration ||
              (i.category === 'consumivel' && (i.properties?.tipo_dano || i.properties?.damage_type || (i.item_name && /óleo|oleo|veneno|imbuição|imbuicao/i.test(i.item_name))))
            );
            const validImbues = imbues.length > 0 ? imbues : consumables;
            setActorImbueItems(validImbues);
            if (validImbues.length > 0) {
              setSelectedImbueItemId(validImbues[0].id);
            } else {
              setSelectedImbueItemId('');
            }
          })
          .catch(console.error)
          .finally(() => setIsLoadingInventory(false));
      } else if (actor?.npc_data?.actions && Array.isArray(actor.npc_data.actions) && actor.npc_data.actions.length > 0) {
        const npcActionsAsWeapons = actor.npc_data.actions.map((act: any, idx: number) => ({
          id: act.id || `npc_act_${idx}`,
          character_id: '',
          item_id: act.id || `npc_act_${idx}`,
          item_name: act.name,
          category: act.type === 'ability' ? 'habilidade' : 'arma',
          quantity: 1,
          is_equipped: true,
          properties: {
            dano: act.damage_formula,
            damage_formula: act.damage_formula,
            ataque: act.attack_formula || (act.attack_bonus ? `1d20 + ${act.attack_bonus}` : undefined),
            attack_formula: act.attack_formula || (act.attack_bonus ? `1d20 + ${act.attack_bonus}` : undefined),
            tipo_dano: act.damage_type || 'fisico',
            damage_type: act.damage_type || 'fisico',
            damage_components: act.damage_components || [],
            apply_conditions: act.conditions || []
          }
        }));
        setActorWeapons(npcActionsAsWeapons as any);
        if (npcActionsAsWeapons.length > 0) {
          setSelectedWeaponId(npcActionsAsWeapons[0].id);
        } else {
          setSelectedWeaponId('');
        }
        setActorConsumables([]);
        setSelectedConsumableId('');
        setActorImbueItems([]);
        setSelectedImbueItemId('');
        setTargetWeaponForImbueId('');
        setIsLoadingInventory(false);
      } else {
        setActorWeapons([]);
        setSelectedWeaponId('');
        setActorConsumables([]);
        setSelectedConsumableId('');
        setActorImbueItems([]);
        setSelectedImbueItemId('');
        setTargetWeaponForImbueId('');
      }
    }
  }, [selectedActorId, encounter, campaign.id]);

  const handleOpenActionModal = (target: Combatant) => {
    setSelectedTarget(target);
    setActionFeedback(null);

    // Determinar atacante padrão: combatente ativo do turno, ou personagem do jogador atual
    const combatants = encounter?.combatants || [];
    const activeCombatant = combatants[encounter?.turn_index ?? 0];
    
    // Se o combatente ativo pertencer ao usuário ou se for mestre
    const userCombatants = combatants.filter(c => isMaster || c.owner_user_id === user.id);
    const defaultActor = (activeCombatant && (isMaster || activeCombatant.owner_user_id === user.id))
      ? activeCombatant
      : (userCombatants.length > 0 ? userCombatants[0] : activeCombatant);

    if (defaultActor) {
      setSelectedActorId(defaultActor.id);
    } else if (combatants.length > 0) {
      setSelectedActorId(combatants[0].id);
    }

    setActionMode(isMaster ? 'weapon' : 'weapon');
    setActionError(null);
    setActionFeedback(null);
    setShowActionModal(true);
  };

  // Inserir combatente no encontro
  const handleAddCombatant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!encounter) return;

    if (addCombatantTab === 'bestiary') {
      if (!selectedCreatureId) {
        alert('Selecione uma criatura do Bestiário.');
        return;
      }
      setIsSpawningCreature(true);
      try {
        const res = await api.spawnCreaturesToEncounter(
          campaign.id,
          encounter.id,
          {
            creature_id: selectedCreatureId,
            count: Math.max(1, spawnCount)
          }
        );
        onEncounterUpdated(res.encounter);
        setShowAddModal(false);
      } catch (err: any) {
        alert(`Erro ao adicionar reforço do Bestiário: ${err.message}`);
      } finally {
        setIsSpawningCreature(false);
      }
      return;
    }

    try {
      const payload: Partial<Combatant> = {
        token_id: selectedTokenId || null,
        character_id: newCombatantCharId || null,
        name: newCombatantName,
        avatar_url: newCombatantAvatar || null,
        current_hp: newCombatantHp,
        max_hp: newCombatantHp,
        initiative_formula: newCombatantFormula || '1d20',
        defense: newCombatantDefense,
        damage_reduction: newCombatantDR,
        npc_data: {
          defense: newCombatantDefense,
          damage_reduction: newCombatantDR,
          resistances: newCombatantResistances ? newCombatantResistances.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [],
          vulnerabilities: newCombatantVulnerabilities ? newCombatantVulnerabilities.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [],
          immunities: newCombatantImmunities ? newCombatantImmunities.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : []
        },
        is_npc: newCombatantIsNpc,
        is_hidden: newCombatantIsHidden
      };

      const res = await api.addCombatant(campaign.id, encounter.id, payload);
      onEncounterUpdated(res.encounter);
      setShowAddModal(false);
      setSelectedTokenId('');
      setNewCombatantCharId('');
      setNewCombatantName('');
      setNewCombatantAvatar('');
    } catch (err: any) {
      alert(`Erro ao adicionar combatente: ${err.message}`);
    }
  };

  const handleRemoveCombatant = async (combatantId: string) => {
    if (!encounter) return;
    try {
      await api.removeCombatant(campaign.id, encounter.id, combatantId);
      const updatedEnc = await api.getActiveCombat(campaign.id);
      onEncounterUpdated(updatedEnc);
    } catch (err: any) {
      alert(`Erro ao remover combatente: ${err.message}`);
    }
  };

  // Validação de tipo de alvo no frontend
  const getTargetValidation = (): { valid: boolean; reason?: string } => {
    if (!selectedActorId || !selectedTarget) return { valid: true };
    const actor = encounter?.combatants?.find(c => c.id === selectedActorId);
    const target = selectedTarget;
    if (!actor || !target) return { valid: true };

    const isSelf = actor.id === target.id;
    const actorIsPC = !actor.is_npc && !actor.token_id?.startsWith('npc_');
    const targetIsPC = !target.is_npc && !target.token_id?.startsWith('npc_');
    const areAllies = isSelf || (actorIsPC === targetIsPC);
    const areEnemies = !areAllies;

    let validTargets: string[] = ['any'];
    if (actionMode === 'weapon') {
      validTargets = ['enemies', 'any'];
    } else if (actionMode === 'defend' || actionMode === 'dodge') {
      validTargets = ['self'];
    } else if (actionMode === 'ability') {
      const ab = rulesetAbilities.find(a => a.id === selectedAbilityId);
      const rawVT = ab?.valid_targets || 'enemies';
      validTargets = Array.isArray(rawVT) ? rawVT : [rawVT];
    } else if (actionMode === 'consumable') {
      const item = actorConsumables.find(c => c.id === selectedConsumableId);
      const rawVT = item?.properties?.valid_targets || (item?.properties?.healing_formula ? 'allies' : 'any');
      validTargets = Array.isArray(rawVT) ? rawVT : [rawVT];
    } else if (actionMode === 'imbue') {
      validTargets = ['self', 'allies', 'weapon'];
    }

    if (validTargets.includes('any')) return { valid: true };
    if (validTargets.includes('self') && isSelf) return { valid: true };
    if (validTargets.includes('allies') && areAllies) return { valid: true };
    if (validTargets.includes('enemies') && areEnemies) return { valid: true };

    const targetDesc = validTargets.map(t => {
      if (t === 'self') return 'o próprio combatente (Si Mesmo)';
      if (t === 'allies') return 'aliados / mesmo grupo';
      if (t === 'enemies') return 'inimigos';
      if (t === 'weapon') return 'uma arma equipada';
      return t;
    }).join(' ou ');

    return {
      valid: false,
      reason: `Esta ação requer como alvo: ${targetDesc}. O alvo selecionado (${target.name}) é considerado ${areAllies ? 'aliado' : 'inimigo'}.`
    };
  };

  // Status de economia de ação no turno atual
  const getActionEconomyStatus = () => {
    const actor = encounter?.combatants?.find(c => c.id === selectedActorId) || activeCombatant;
    if (!actor) return { isUsed: false, costType: 'main' as const, actorName: '' };

    let costType: 'main' | 'bonus' | 'reaction' | 'free' = 'main';
    if (actionMode === 'weapon' || actionMode === 'defend' || actionMode === 'dodge') {
      costType = 'main';
    } else if (actionMode === 'consumable') {
      const item = actorConsumables.find(c => c.id === selectedConsumableId);
      costType = item?.properties?.action_cost || 'bonus';
    } else if (actionMode === 'imbue') {
      const item = actorImbueItems.find(i => i.id === selectedImbueItemId);
      costType = item?.properties?.action_cost || 'bonus';
    } else if (actionMode === 'ability') {
      const ab = rulesetAbilities.find(a => a.id === selectedAbilityId);
      costType = (ab?.action_cost || ab?.action_type || 'main') as any;
    }

    const isUsed = costType === 'free' ? false : (actor.actions_used?.[costType] || 0) >= 1;
    return { isUsed, costType, actorName: actor.name };
  };

  // Executar Ação de Combate Unificada
  const handleApplyAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!encounter || !selectedTarget) return;

    setIsApplyingAction(true);
    setActionFeedback(null);
    setActionError(null);

    try {
      let payload: any = {
        actor_id: selectedActorId || null,
        target_id: selectedTarget.id,
        notes: actionNotes
      };

      if (actionMode === 'defend') {
        payload = {
          ...payload,
          action_mode: 'defend',
          action_type: 'turn_change',
          action_cost: 'main'
        };
      } else if (actionMode === 'dodge') {
        payload = {
          ...payload,
          action_mode: 'dodge',
          action_type: 'roll',
          formula: customDodgeFormula || undefined,
          action_cost: 'main'
        };
      } else if (actionMode === 'weapon') {
        const selectedWep = actorWeapons.find(w => w.id === selectedWeaponId);
        payload = {
          ...payload,
          action_mode: 'weapon',
          action_type: 'attack',
          weapon_id: selectedWeaponId || undefined,
          formula: selectedWep?.properties?.dano || selectedWep?.properties?.damage_formula || undefined,
          attack_formula: selectedWep?.properties?.ataque || selectedWep?.properties?.attack_formula || undefined,
          damage_type: selectedWep?.properties?.tipo_dano || selectedWep?.properties?.damage_type || undefined,
          apply_conditions: selectedWep?.properties?.apply_conditions || undefined,
          action_cost: 'main'
        };
      } else if (actionMode === 'consumable') {
        const item = actorConsumables.find(c => c.id === selectedConsumableId);
        payload = {
          ...payload,
          action_mode: 'consumable',
          consumable_item_id: selectedConsumableId,
          action_cost: item?.properties?.action_cost || 'bonus'
        };
      } else if (actionMode === 'imbue') {
        const item = actorImbueItems.find(i => i.id === selectedImbueItemId);
        payload = {
          ...payload,
          action_mode: 'imbue',
          consumable_item_id: selectedImbueItemId,
          target_weapon_id: targetWeaponForImbueId,
          action_cost: item?.properties?.action_cost || 'bonus'
        };
      } else if (actionMode === 'ability') {
        const ab = rulesetAbilities.find(a => a.id === selectedAbilityId);
        if (ab) {
          payload = {
            ...payload,
            action_mode: 'ability',
            ability_id: ab.id,
            ability_name: ab.name,
            formula: ab.damage_formula || ab.healing_formula || undefined,
            attack_formula: ab.attack_formula || undefined,
            damage_type: ab.damage_type || 'magico',
            action_cost: ab.action_cost || ab.action_type || 'main',
            valid_targets: ab.valid_targets || 'enemies',
            resource_cost: ab.resource_cost || undefined,
            apply_conditions: ab.apply_conditions || undefined,
            remove_conditions: ab.remove_conditions || undefined
          };
        } else {
          payload = {
            ...payload,
            action_mode: 'ability',
            action_type: 'attack',
            ability_name: abilityName || 'Habilidade Especial',
            attack_formula: abilityAttackFormula || undefined,
            formula: abilityDamageFormula || '2d6',
            damage_type: abilityDamageType || 'magico',
            action_cost: 'main',
            resource_cost: resourceCostAmount > 0 ? {
              name: resourceCostName,
              amount: resourceCostAmount
            } : undefined
          };
        }
      } else if (actionMode === 'manual') {
        if (!isMaster) {
          alert('Ajuste manual direto é restrito ao Mestre da campanha.');
          setIsApplyingAction(false);
          return;
        }
        payload = {
          ...payload,
          action_mode: 'manual',
          action_type: manualActionType,
          resource_name: manualResourceName,
          amount: manualFormula ? undefined : manualAmount,
          formula: manualFormula || undefined
        };
      }

      const res = await api.applyCombatAction(campaign.id, encounter.id, payload);

      setActionFeedback(res);

      if (res.updatedCharacter && onCharacterUpdated) {
        onCharacterUpdated(res.updatedCharacter);
      }

      const updatedEnc = await api.getActiveCombat(campaign.id);
      onEncounterUpdated(updatedEnc);
      loadLogs(encounter.id);

      // Fecha o modal após 2 segundos para o usuário ver o feedback do ataque
      setTimeout(() => {
        setShowActionModal(false);
        setActionFeedback(null);
      }, 2200);

    } catch (err: any) {
      setActionError(err.message || 'Erro desconhecido ao executar ação de combate.');
    } finally {
      setIsApplyingAction(false);
    }
  };

  const combatants = encounter?.combatants || [];
  const activeCombatant = combatants[encounter?.turn_index ?? 0];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl flex flex-col h-full max-h-[750px]">
      {/* Cabeçalho do Encontro */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Swords className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white truncate max-w-[160px]">
              {encounter ? encounter.name : 'Iniciativa & Combate'}
            </h3>
            {encounter && (
              <div className="flex items-center space-x-2 text-[10px]">
                <span className="text-indigo-400 font-semibold">Rodada {encounter.round}</span>
                <span className="text-slate-500">•</span>
                <span className={`px-1.5 py-0.2 rounded font-medium ${
                  encounter.status === 'active' 
                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                    : encounter.status === 'prep'
                      ? 'bg-amber-950/60 text-amber-300 border border-amber-800'
                      : 'bg-slate-800 text-slate-400'
                }`}>
                  {encounter.status === 'active' ? 'Ativo' : encounter.status === 'prep' ? 'Preparação' : 'Encerrado'}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-1">
          {encounter && (
            <button
              onClick={() => setShowLogsDrawer(!showLogsDrawer)}
              title="Histórico de Ações"
              className={`p-1.5 rounded-lg border transition-all ${
                showLogsDrawer 
                  ? 'bg-indigo-600 text-white border-indigo-500' 
                  : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              <History className="w-4 h-4" />
            </button>
          )}

          {isMaster && !encounter && (
            <button
              onClick={handleStartCombat}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md shadow-indigo-600/30"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Iniciar</span>
            </button>
          )}

          {isMaster && encounter && encounter.status === 'prep' && (
            <button
              onClick={handleActivateCombat}
              title="Iniciar Combate e Validar Ordem de Iniciativa"
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md shadow-emerald-600/30"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Iniciar Combate</span>
            </button>
          )}

          {isMaster && encounter && (
            <button
              onClick={() => setShowAddModal(true)}
              title="Adicionar Participante"
              className="p-1.5 bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-800/50 rounded-lg transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}

          {isMaster && encounter && encounter.status !== 'ended' && (
            <button
              onClick={handleEndCombat}
              title="Encerrar Combate"
              className="p-1.5 bg-rose-950/50 hover:bg-rose-900/60 text-rose-400 border border-rose-800/50 rounded-lg transition-all"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Controles de Turno e Ações do Mestre */}
      {isMaster && encounter && encounter.status !== 'ended' && (
        <div className="grid grid-cols-4 gap-1.5 my-3 pt-1">
          <button
            onClick={handlePrevTurn}
            title="Turno Anterior"
            className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center justify-center space-x-1 border border-slate-700 transition-all"
          >
            <SkipBack className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Anterior</span>
          </button>

          <button
            onClick={handleNextTurn}
            title="Próximo Turno"
            className="py-1.5 px-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 shadow-md shadow-emerald-700/20 transition-all col-span-2"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span>Próximo Turno</span>
          </button>

          <button
            onClick={handleRollAllInitiative}
            title="Rolar Todas as Iniciativas"
            className="py-1.5 px-2 bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-700/50 rounded-lg text-xs font-medium flex items-center justify-center transition-all"
          >
            <Dices className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Banner de Turno Ativo */}
      {encounter && encounter.status === 'active' && activeCombatant && (() => {
        const nextCombatant = combatants.length > 1
          ? combatants[(encounter.turn_index + 1) % combatants.length]
          : null;
        const canEndTurn = isMaster || (activeCombatant.owner_user_id === user.id);
        const mainActionsUsed = activeCombatant.actions_used?.main || 0;

        return (
          <div className="mb-3 p-2.5 bg-gradient-to-r from-indigo-950/80 via-slate-900 to-slate-900 border border-indigo-500/40 rounded-xl shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider block">Turno Ativo</span>
                  <p className="text-xs font-bold text-white truncate">{activeCombatant.name}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/50 border border-amber-800/50 px-2 py-0.5 rounded">
                  Init {activeCombatant.initiative}
                </span>
                {canEndTurn && (
                  <button
                    onClick={handleEndTurn}
                    title="Finalizar este turno e passar para o próximo combatente"
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1 shadow transition-all"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Encerrar Turno</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/60 pt-1.5 px-0.5">
              <div className="flex items-center space-x-1.5">
                <span>Ação Principal:</span>
                <span className={`px-1.5 py-0.2 rounded font-mono font-bold text-[10px] ${
                  mainActionsUsed >= 1 
                    ? 'bg-rose-950/60 text-rose-300 border border-rose-800' 
                    : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                }`}>
                  {mainActionsUsed}/1 usada
                </span>
              </div>
              {nextCombatant && (
                <div className="text-[10px] text-slate-400 truncate max-w-[170px]">
                  Próximo: <span className="text-slate-200 font-medium">{nextCombatant.name}</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Lista de Combatentes */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-[220px]">
        {combatants.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs">
            {encounter ? (
              <div>
                <p>Nenhum combatente no encontro.</p>
                {isMaster && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="mt-2 px-3 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg text-xs inline-flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Combatentes</span>
                  </button>
                )}
              </div>
            ) : (
              <p>Inicie um combate para gerenciar iniciativa, turnos e ações táticas em tempo real.</p>
            )}
          </div>
        ) : (
          combatants.map((c, idx) => {
            const isActive = encounter?.status === 'active' && idx === encounter?.turn_index;
            const hpPercent = (c.current_hp !== null && c.max_hp && c.max_hp > 0) 
              ? Math.max(0, Math.min(100, (c.current_hp / c.max_hp) * 100))
              : (c.hp_percent !== undefined && c.hp_percent !== null)
                ? c.hp_percent
                : 100;

            const hpColor = getHpStatusColor(hpPercent, c.hp_status);

            return (
              <div
                key={c.id}
                className={`p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                  isActive
                    ? 'bg-indigo-950/40 border-indigo-500/80 shadow-md shadow-indigo-900/30 ring-1 ring-indigo-500/50'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                  {/* Avatar / Thumbnail */}
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-800 border border-slate-700 shrink-0 flex items-center justify-center">
                    {c.avatar_url ? (
                      <img src={c.avatar_url} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-4 h-4 text-slate-400" />
                    )}
                  </div>

                  {/* Nome, Estatísticas e Barra de Vida */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-white truncate max-w-[120px]">{c.name}</span>
                      {c.is_npc && (
                        <span className="text-[9px] bg-rose-950/60 text-rose-300 border border-rose-800 px-1 rounded shrink-0">NPC</span>
                      )}
                      {c.is_hidden && (
                        <span title="Oculto para jogadores">
                          <EyeOff className="w-3 h-3 text-amber-400 shrink-0" />
                        </span>
                      )}
                      {/* Atributos Defensivos visíveis para o mestre */}
                      {isMaster && (
                        <span className="text-[9px] text-slate-400 font-mono bg-slate-900 px-1 py-0.2 rounded border border-slate-800">
                          Def: {c.defense ?? 10} {c.damage_reduction ? `• RD: ${c.damage_reduction}` : ''}
                        </span>
                      )}
                      {/* Badges de Estados Defensivos e Incapacitação */}
                      {c.defensive_state?.defense?.active && (
                        <span className="text-[9px] bg-blue-950/80 text-blue-300 border border-blue-800 px-1 py-0.5 rounded flex items-center space-x-1 font-medium">
                          <Shield className="w-2.5 h-2.5 text-blue-400" />
                          <span>{c.defensive_state.defense.description || 'Defesa'}</span>
                        </span>
                      )}
                      {c.defensive_state?.dodge?.active && (
                        <span className="text-[9px] bg-purple-950/80 text-purple-300 border border-purple-800 px-1 py-0.5 rounded flex items-center space-x-1 font-medium">
                          <Wind className="w-2.5 h-2.5 text-purple-400" />
                          <span>Esquiva (Def {c.defensive_state.dodge.effective_defense})</span>
                        </span>
                      )}
                      {c.is_incapacitated && (
                        <span className="text-[9px] bg-rose-950/80 text-rose-300 border border-rose-800 px-1 py-0.5 rounded flex items-center space-x-1 font-medium">
                          <Skull className="w-2.5 h-2.5 text-rose-400" />
                          <span>Incapacitado</span>
                        </span>
                      )}
                      {/* Badges de Condições Ativas */}
                      {c.conditions && c.conditions.length > 0 && c.conditions.map((cond: any, idx: number) => {
                        const isObj = typeof cond === 'object';
                        const name = isObj ? cond.name : cond;
                        const durType = isObj ? cond.duration_type : 'turns';
                        const durRem = isObj ? cond.duration_remaining : null;
                        const color = (isObj && cond.color) ? cond.color : '#eab308';
                        const desc = isObj ? cond.description : '';
                        const canRemove = isMaster;

                        return (
                          <span 
                            key={isObj ? cond.id : idx} 
                            title={desc || name}
                            style={{ borderColor: color, backgroundColor: `${color}20`, color }}
                            className="text-[9px] border px-1.5 py-0.5 rounded flex items-center space-x-1 font-medium"
                          >
                            <span>{name}</span>
                            {durType !== 'permanent' && durRem !== null && (
                              <span className="opacity-75 text-[8px]">({durRem}{durType === 'turns' ? 't' : durType === 'rounds' ? 'r' : 'a'})</span>
                            )}
                            {canRemove && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveCondition(c.id, isObj ? cond.id : cond);
                                }}
                                className="ml-0.5 hover:text-rose-400 opacity-60 hover:opacity-100"
                                title="Remover condição"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </span>
                        );
                      })}
                      <span className="text-[9px] font-mono text-slate-400 bg-slate-900 px-1 py-0.2 rounded border border-slate-800">
                        Ação: {c.actions_used?.main || 0}/1
                      </span>
                    </div>

                    {/* Barra de Vida */}
                    {(c.current_hp !== null || (c.hp_percent !== null && c.hp_percent !== undefined)) && (
                      <div className="w-full mt-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                          <span>{c.current_hp !== null ? 'PV' : 'Estado'}</span>
                          {c.current_hp !== null ? (
                            <span className="font-mono">{c.current_hp} / {c.max_hp ?? '?'}</span>
                          ) : (
                            <span className="font-medium text-slate-300">{getHpStatusLabel(c.hp_status)}</span>
                          )}
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${hpColor}`}
                            style={{ width: `${hpPercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Iniciativa e Botão de Ação / Ataque */}
                <div className="flex items-center space-x-1.5 pl-2 shrink-0">
                  <span className="text-xs font-mono font-bold text-slate-200 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                    {c.initiative}
                  </span>

                  {/* Botão de Ação / Ataque Tático */}
                  <button
                    onClick={() => handleOpenActionModal(c)}
                    title="Realizar Ação / Atacar Alvo"
                    className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/50 rounded-lg text-xs transition-all flex items-center space-x-1"
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                  </button>

                  {/* Botão de Aplicar Condição (Exclusivo Mestre - Intervenção Manual) */}
                  {isMaster && (
                    <button
                      onClick={() => handleOpenConditionModal(c)}
                      title="[Mestre] Intervenção Manual: Aplicar Condição"
                      className="p-1.5 bg-amber-950/40 hover:bg-amber-900/60 text-amber-400 border border-amber-800/50 rounded-lg text-xs transition-all flex items-center space-x-1"
                    >
                      <Flame className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Remover Combatente (Mestre) */}
                  {isMaster && (
                    <button
                      onClick={() => handleRemoveCombatant(c.id)}
                      title="Remover do Encontro"
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg text-xs transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: Adicionar Combatente (com Atributos Defensivos de NPCs/Monstros) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="font-bold text-base text-white flex items-center space-x-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                <span>Adicionar Participante ao Combate</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {isMaster && (
              <div className="flex border-b border-slate-800 mb-4 space-x-2">
                <button
                  type="button"
                  onClick={() => setAddCombatantTab('bestiary')}
                  className={`pb-2 px-3 text-xs font-semibold flex items-center space-x-1.5 border-b-2 transition-all ${
                    addCombatantTab === 'bestiary'
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Reforço do Bestiário</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAddCombatantTab('custom')}
                  className={`pb-2 px-3 text-xs font-semibold flex items-center space-x-1.5 border-b-2 transition-all ${
                    addCombatantTab === 'custom'
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>Customizado / Token / Personagem</span>
                </button>
              </div>
            )}

            {addCombatantTab === 'bestiary' && isMaster ? (
              <form onSubmit={handleAddCombatant} className="space-y-4">
                {bestiaryCreatures.length === 0 ? (
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl text-center text-xs text-slate-400">
                    Nenhuma criatura cadastrada no Bestiário da campanha ainda. Crie criaturas na aba Bestiário ou use a aba Customizado.
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1">
                        Criatura Modelo do Bestiário
                      </label>
                      <select
                        value={selectedCreatureId}
                        onChange={(e) => setSelectedCreatureId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium"
                      >
                        {bestiaryCreatures.map(cr => (
                          <option key={cr.id} value={cr.id}>
                            {cr.name} [{cr.category.toUpperCase()}] {cr.computed_data?.hp ? `• ${cr.computed_data.hp} PV` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1">
                        Quantidade de Instâncias (Reforços)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={spawnCount}
                        onChange={(e) => setSpawnCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        Cada criatura será instanciada de forma independente com iniciativa imediata e token no mapa.
                      </p>
                    </div>

                    {/* Preview da Criatura Selecionada */}
                    {(() => {
                      const cur = bestiaryCreatures.find(c => c.id === selectedCreatureId);
                      if (!cur) return null;
                      return (
                        <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-800 shrink-0 border border-slate-700">
                            {cur.avatar_url || cur.token_url ? (
                              <img src={cur.avatar_url || cur.token_url || undefined} alt={cur.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-500">
                                <UserIcon className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-bold text-white truncate">{cur.name}</h4>
                            <p className="text-[10px] text-slate-400">
                              Defesa: {cur.computed_data?.defense ?? 10} • RD: {cur.computed_data?.damage_reduction ?? 0} • PV: {cur.computed_data?.hp ?? 20}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}

                <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSpawningCreature || bestiaryCreatures.length === 0}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/30 flex items-center space-x-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isSpawningCreature ? 'Invocando...' : `Adicionar ${spawnCount > 1 ? `${spawnCount} Reforços` : 'Reforço'}`}</span>
                  </button>
                </div>
              </form>
            ) : (
            <form onSubmit={handleAddCombatant} className="space-y-4">
              {/* Opção 1: Vincular a Token existente no mapa */}
              {tokens.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Selecionar Token da Cena (Mapa)
                  </label>
                  <select
                    value={selectedTokenId}
                    onChange={(e) => {
                      const tId = e.target.value;
                      setSelectedTokenId(tId);
                      const tok = tokens.find(t => t.id === tId);
                      if (tok) {
                        setNewCombatantName(tok.name);
                        setNewCombatantAvatar(tok.avatar_url || '');
                        if (tok.current_hp !== null) setNewCombatantHp(tok.current_hp);
                        if (tok.npc_data) {
                          if (tok.npc_data.defense) setNewCombatantDefense(tok.npc_data.defense);
                          if (tok.npc_data.damage_reduction) setNewCombatantDR(tok.npc_data.damage_reduction);
                          if (tok.npc_data.resistances) setNewCombatantResistances(tok.npc_data.resistances.join(', '));
                          if (tok.npc_data.vulnerabilities) setNewCombatantVulnerabilities(tok.npc_data.vulnerabilities.join(', '));
                          if (tok.npc_data.immunities) setNewCombatantImmunities(tok.npc_data.immunities.join(', '));
                          if (tok.npc_data.initiative_formula) setNewCombatantFormula(tok.npc_data.initiative_formula);
                        }
                        setNewCombatantIsNpc(!tok.character_id);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Escolher Token do Mapa --</option>
                    {tokens.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} (Token no Mapa {t.current_hp !== null ? `• ${t.current_hp} PV` : ''})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Opção 2: Vincular a Personagem da Campanha */}
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Ou Vincular a Personagem da Campanha
                </label>
                <select
                  value={newCombatantCharId}
                  onChange={(e) => {
                    const cId = e.target.value;
                    setNewCombatantCharId(cId);
                    const char = characters.find(c => c.id === cId);
                    if (char) {
                      setNewCombatantName(char.name);
                      setNewCombatantAvatar(char.avatar_url || '');
                      const cd = char.computed_data || {};
                      const hp = cd.vida_atual ?? cd.pv_atual ?? cd.vida ?? cd.hp ?? 20;
                      setNewCombatantHp(Number(hp));
                      setNewCombatantDefense(cd.defesa ?? cd.ca ?? cd.armor_class ?? 10);
                      setNewCombatantDR(cd.rd ?? cd.armadura ?? cd.damage_reduction ?? 0);
                      setNewCombatantIsNpc(char.is_npc === 1);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Participante Avulso / Monstro Customizado</option>
                  {characters.map(char => (
                    <option key={char.id} value={char.id}>
                      {char.name} ({char.is_npc ? 'NPC' : 'Personagem de Jogador'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Nome do Participante</label>
                <input
                  type="text"
                  required
                  value={newCombatantName}
                  onChange={(e) => setNewCombatantName(e.target.value)}
                  placeholder="ex: Carniçal, Guarda, Jogador"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Pontos de Vida (PV)</label>
                  <input
                    type="number"
                    min="1"
                    value={newCombatantHp}
                    onChange={(e) => setNewCombatantHp(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Fórmula de Iniciativa</label>
                  <input
                    type="text"
                    value={newCombatantFormula}
                    onChange={(e) => setNewCombatantFormula(e.target.value)}
                    placeholder="1d20 + 2"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Atributos Defensivos de NPCs e Monstros */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-indigo-400 block flex items-center space-x-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Atributos Defensivos (CA, Armadura & Resistências)</span>
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 block mb-1">Defesa / CA (Dificuldade de Acerto)</label>
                    <input
                      type="number"
                      min="0"
                      value={newCombatantDefense}
                      onChange={(e) => setNewCombatantDefense(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 block mb-1">Redução de Dano / Armadura (RD)</label>
                    <input
                      type="number"
                      min="0"
                      value={newCombatantDR}
                      onChange={(e) => setNewCombatantDR(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-0.5">Resistências (Dano pela metade, ex: fogo, fisico)</label>
                  <input
                    type="text"
                    value={newCombatantResistances}
                    onChange={(e) => setNewCombatantResistances(e.target.value)}
                    placeholder="ex: fogo, cortante, fisico"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 block mb-0.5">Vulnerabilidades (Dano x2)</label>
                    <input
                      type="text"
                      value={newCombatantVulnerabilities}
                      onChange={(e) => setNewCombatantVulnerabilities(e.target.value)}
                      placeholder="ex: eletrico"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 block mb-0.5">Imunidades (Dano 0)</label>
                    <input
                      type="text"
                      value={newCombatantImmunities}
                      onChange={(e) => setNewCombatantImmunities(e.target.value)}
                      placeholder="ex: veneno"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-6 pt-1">
                <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCombatantIsNpc}
                    onChange={(e) => setNewCombatantIsNpc(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <span>É NPC / Monstro</span>
                </label>

                <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCombatantIsHidden}
                    onChange={(e) => setNewCombatantIsHidden(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <span>Ocultar dos Jogadores</span>
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/30"
                >
                  Adicionar ao Encontro
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Central de Ações Unificadas de Combate */}
      {showActionModal && selectedTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <h3 className="font-bold text-base text-white flex items-center space-x-2">
                  <Target className="w-4 h-4 text-rose-400" />
                  <span>Ação de Combate: {selectedTarget.name}</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  Alvo: {selectedTarget.current_hp !== null ? `${selectedTarget.current_hp} PV` : getHpStatusLabel(selectedTarget.hp_status)} {isMaster ? `• Defesa: ${selectedTarget.defense} • RD: ${selectedTarget.damage_reduction}` : ''}
                </span>
              </div>
              <button onClick={() => setShowActionModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Banner de Erro da Execução da Ação */}
            {actionError && (
              <div className="p-3 rounded-xl mb-4 border bg-rose-950/60 border-rose-800 text-rose-200 text-xs">
                <div className="flex items-center space-x-2 font-bold mb-1">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Falha ao Executar Ação</span>
                </div>
                <p className="text-[11px] text-slate-300 break-words whitespace-pre-wrap">
                  {actionError}
                </p>
              </div>
            )}

            {/* Banner de Feedback da Execução da Ação */}
            {actionFeedback && (
              <div className={`p-3 rounded-xl mb-4 border text-xs ${
                actionFeedback.hit === false 
                  ? 'bg-amber-950/60 border-amber-800 text-amber-200' 
                  : 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
              }`}>
                <div className="flex items-center space-x-2 font-bold mb-1">
                  {actionFeedback.hit === false ? (
                    <>
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                      <span>O Ataque Errou o Alvo!</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Ação Executada com Sucesso!</span>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-slate-300">
                  {actionFeedback.actionLog?.details?.message || actionFeedback.message}
                </p>

                {/* Discriminação de Danos Elementais e Multiplicadores */}
                {Array.isArray(actionFeedback.componentsBreakdown || actionFeedback.actionLog?.details?.componentsBreakdown) && (
                  <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex flex-wrap gap-1.5">
                    {(actionFeedback.componentsBreakdown || actionFeedback.actionLog?.details?.componentsBreakdown).map((comp: any, idx: number) => (
                      <span key={idx} className="text-[10px] bg-slate-900/90 border border-slate-700 px-2 py-0.5 rounded font-mono text-slate-200 flex items-center space-x-1">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>
                          <strong className="text-amber-300 capitalize">{comp.name || comp.type}:</strong> {comp.original} {comp.multiplier !== 1 ? `(x${comp.multiplier})` : ''} → <strong className="text-rose-300">{comp.final} PV</strong>
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleApplyAction} className="space-y-4">
              {/* Seleção do Atacante e do Alvo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Combatente Ativo (Origem)</label>
                  <select
                    value={selectedActorId}
                    onChange={(e) => setSelectedActorId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    {combatants
                      .filter(c => isMaster || c.owner_user_id === user.id)
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.id === activeCombatant?.id ? '★ (Turno Ativo)' : ''}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Alvo da Ação</label>
                  <select
                    value={selectedTarget.id}
                    onChange={(e) => {
                      const t = combatants.find(c => c.id === e.target.value);
                      if (t) setSelectedTarget(t);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    {combatants.map(c => {
                      const isSelf = c.id === selectedActorId;
                      const actor = combatants.find(a => a.id === selectedActorId);
                      const actorIsPC = actor ? (!actor.is_npc && !actor.token_id?.startsWith('npc_')) : true;
                      const cIsPC = !c.is_npc && !c.token_id?.startsWith('npc_');
                      const relation = isSelf ? 'Si Mesmo' : (actorIsPC === cIsPC ? 'Aliado' : 'Inimigo');
                      return (
                        <option key={c.id} value={c.id}>
                          {c.name} ({relation}) • {c.current_hp !== null ? `${c.current_hp} PV` : getHpStatusLabel(c.hp_status)}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Banner de Validação de Alvo */}
              {(() => {
                const tv = getTargetValidation();
                if (!tv.valid && actionMode !== 'manual') {
                  return (
                    <div className="p-2.5 bg-rose-950/60 border border-rose-800/80 rounded-xl flex items-center space-x-2 text-rose-300 text-xs">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{tv.reason}</span>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Banner de Economia de Ações */}
              {(() => {
                const ae = getActionEconomyStatus();
                if (ae.isUsed && actionMode !== 'manual') {
                  const label = ae.costType === 'bonus' ? 'ação bônus' : ae.costType === 'reaction' ? 'reação' : 'ação principal';
                  return (
                    <div className="p-2.5 bg-amber-950/60 border border-amber-800/80 rounded-xl flex items-center space-x-2 text-amber-300 text-xs">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Atenção: {ae.actorName || 'Este combatente'} já utilizou sua {label} neste turno (1/1).</span>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Abas de Ações Unificadas */}
              <div className="flex border-b border-slate-800 pb-1 gap-1.5 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActionMode('weapon')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1 whitespace-nowrap shrink-0 ${
                    actionMode === 'weapon'
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white bg-slate-800/60'
                  }`}
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Arma</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActionMode('ability')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1 whitespace-nowrap shrink-0 ${
                    actionMode === 'ability'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white bg-slate-800/60'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Habilidade</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActionMode('consumable')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1 whitespace-nowrap shrink-0 ${
                    actionMode === 'consumable'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white bg-slate-800/60'
                  }`}
                >
                  <HeartPulse className="w-3.5 h-3.5" />
                  <span>Consumível</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActionMode('imbue')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1 whitespace-nowrap shrink-0 ${
                    actionMode === 'imbue'
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white bg-slate-800/60'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Imbuir Arma</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActionMode('defend')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1 whitespace-nowrap shrink-0 ${
                    actionMode === 'defend'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white bg-slate-800/60'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Defender</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActionMode('dodge')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1 whitespace-nowrap shrink-0 ${
                    actionMode === 'dodge'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white bg-slate-800/60'
                  }`}
                >
                  <Wind className="w-3.5 h-3.5" />
                  <span>Esquivar</span>
                </button>

                {isMaster && (
                  <button
                    type="button"
                    onClick={() => setActionMode('manual')}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1 whitespace-nowrap shrink-0 ${
                      actionMode === 'manual'
                        ? 'bg-amber-700 text-white shadow-md'
                        : 'text-amber-400 hover:text-white bg-amber-950/40 border border-amber-800/40'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Mestre (Manual)</span>
                  </button>
                )}
              </div>

              {/* ABA 1: ATACAR COM ARMA */}
              {actionMode === 'weapon' && (
                <div className="space-y-3">
                  {isLoadingInventory ? (
                    <div className="text-center py-4 text-xs text-slate-500">Carregando armas do atacante...</div>
                  ) : actorWeapons.length > 0 ? (
                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1">
                        Arma Equipada no Inventário
                      </label>
                      <select
                        value={selectedWeaponId}
                        onChange={(e) => setSelectedWeaponId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium"
                      >
                        {actorWeapons.map(w => {
                          const props = w.properties || {};
                          const dano = props.dano || props.damage_formula || '1d6';
                          const atq = props.ataque || props.attack_formula || 'Padrão';
                          const tipo = props.tipo_dano || props.damage_type || 'Físico';
                          const extras: string[] = [];
                          if (Array.isArray(props.damage_components)) {
                            props.damage_components.forEach((dc: any) => {
                              extras.push(`+${dc.formula || `${dc.percentage_damage}%`} ${dc.damage_type}`);
                            });
                          }
                          if (Array.isArray(props.imbued_effects)) {
                            props.imbued_effects.forEach((ie: any) => {
                              extras.push(`[Imbuído: +${ie.damage_formula || `${ie.percentage_damage}%`} ${ie.damage_type} (${ie.remaining_charges ?? '∞'} ${ie.duration_type})]`);
                            });
                          }
                          const extraText = extras.length > 0 ? ` + ${extras.join(' ')}` : '';
                          return (
                            <option key={w.id} value={w.id}>
                              {w.item_name} [Dano: {dano} ({tipo}){extraText} | Atq: {atq}]
                            </option>
                          );
                        })}
                      </select>

                      {/* Exibir Badges da Arma Selecionada */}
                      {(() => {
                        const curWeapon = actorWeapons.find(w => w.id === selectedWeaponId);
                        const curProps = curWeapon?.properties || {};
                        const hasComponents = Array.isArray(curProps.damage_components) && curProps.damage_components.length > 0;
                        const hasImbue = Array.isArray(curProps.imbued_effects) && curProps.imbued_effects.length > 0;

                        if (!hasComponents && !hasImbue) return null;

                        return (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {hasComponents && curProps.damage_components.map((comp: any, idx: number) => (
                              <span key={`wc-${idx}`} className="text-[10px] bg-slate-950 border border-amber-800/60 text-amber-300 px-2 py-0.5 rounded font-mono flex items-center space-x-1">
                                <Sparkles className="w-3 h-3 text-amber-400" />
                                <span>+{comp.formula || `${comp.percentage_damage}%`} {comp.damage_type}</span>
                              </span>
                            ))}
                            {hasImbue && curProps.imbued_effects.map((eff: any, idx: number) => (
                              <span key={`wi-${idx}`} className="text-[10px] bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 px-2 py-0.5 rounded font-mono flex items-center space-x-1">
                                <Wand2 className="w-3 h-3 text-indigo-400" />
                                <span>Imbuído: +{eff.damage_formula || `${eff.percentage_damage}%`} {eff.damage_type} ({eff.remaining_charges ?? '∞'} {eff.duration_type})</span>
                              </span>
                            ))}
                          </div>
                        );
                      })()}

                      <span className="text-[10px] text-slate-500 mt-1 block">
                        O teste de ataque e o dano serão calculados automaticamente no servidor com os atributos reais do personagem contra a defesa do alvo.
                      </span>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400">
                      <p className="font-semibold text-white mb-0.5">Nenhuma arma equipada no inventário deste combatente.</p>
                      <p className="text-[11px] text-slate-500">Será realizado um ataque desarmado resolvido automaticamente pelas regras da campanha e atributos do combatente.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ABA 2: HABILIDADE OU PODER */}
              {actionMode === 'ability' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">Selecionar Habilidade</label>
                    <select
                      value={selectedAbilityId}
                      onChange={(e) => {
                        setSelectedAbilityId(e.target.value);
                        const ab = rulesetAbilities.find(a => a.id === e.target.value);
                        if (ab) {
                          setAbilityName(ab.name);
                          if (ab.damage_formula) setAbilityDamageFormula(ab.damage_formula);
                          if (ab.damage_type) setAbilityDamageType(ab.damage_type);
                          if (ab.attack_formula) setAbilityAttackFormula(ab.attack_formula);
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium"
                    >
                      {rulesetAbilities.map(ab => {
                        const costStr = ab.resource_cost ? `${ab.resource_cost.amount} ${ab.resource_cost.name}` : 'Sem custo';
                        const actionCostStr = ab.action_cost === 'bonus' ? 'Ação Bônus' : ab.action_cost === 'free' ? 'Ação Livre' : 'Ação Principal';
                        return (
                          <option key={ab.id} value={ab.id}>
                            {ab.name} [{actionCostStr} • {costStr}]
                          </option>
                        );
                      })}
                      <option value="custom">Habilidade / Poder Personalizado...</option>
                    </select>
                  </div>

                  {/* Detalhes da Habilidade do Ruleset Selecionada */}
                  {(() => {
                    const ab = rulesetAbilities.find(a => a.id === selectedAbilityId);
                    if (!ab) return null;

                    return (
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded font-semibold">
                            Custo: {ab.action_cost === 'bonus' ? 'Ação Bônus' : ab.action_cost === 'free' ? 'Ação Livre' : 'Ação Principal'}
                          </span>
                          <span className="text-[10px] bg-slate-900 text-slate-300 border border-slate-700 px-2 py-0.5 rounded font-semibold">
                            Alvo: {Array.isArray(ab.valid_targets) ? ab.valid_targets.join(', ') : (ab.valid_targets || 'enemies')}
                          </span>
                          {ab.resource_cost && (
                            <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded font-semibold">
                              Consome: {ab.resource_cost.amount} {ab.resource_cost.name}
                            </span>
                          )}
                          {ab.damage_formula && (
                            <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-800 px-2 py-0.5 rounded font-mono">
                              Dano: {ab.damage_formula} ({ab.damage_type || 'mágico'})
                            </span>
                          )}
                          {ab.healing_formula && (
                            <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded font-mono">
                              Cura: {ab.healing_formula}
                            </span>
                          )}
                        </div>

                        {ab.description && (
                          <p className="text-[11px] text-slate-400 leading-relaxed">{ab.description}</p>
                        )}

                        {Array.isArray(ab.apply_conditions) && ab.apply_conditions.length > 0 && (
                          <div className="flex flex-wrap gap-1 items-center pt-1">
                            <span className="text-[10px] text-slate-500">Aplica Condição:</span>
                            {ab.apply_conditions.map((ac: any, i: number) => (
                              <span key={i} className="text-[9px] bg-rose-950/80 text-rose-300 border border-rose-800 px-1.5 py-0.5 rounded">
                                {typeof ac === 'string' ? ac : ac.name}
                              </span>
                            ))}
                          </div>
                        )}

                        {Array.isArray(ab.remove_conditions) && ab.remove_conditions.length > 0 && (
                          <div className="flex flex-wrap gap-1 items-center pt-1">
                            <span className="text-[10px] text-slate-500">Cura / Remove Condição:</span>
                            {ab.remove_conditions.map((rc: string, i: number) => (
                              <span key={i} className="text-[9px] bg-emerald-950/80 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded">
                                {rc}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Campos para Habilidade Personalizada */}
                  {selectedAbilityId === 'custom' && (
                    <div className="space-y-3 pt-2 border-t border-slate-800">
                      <div>
                        <label className="text-xs font-medium text-slate-300 block mb-1">Nome da Habilidade</label>
                        <input
                          type="text"
                          required
                          value={abilityName}
                          onChange={(e) => setAbilityName(e.target.value)}
                          placeholder="ex: Rajada Mística"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-slate-300 block mb-1">Fórmula de Efeito</label>
                          <input
                            type="text"
                            required
                            value={abilityDamageFormula}
                            onChange={(e) => setAbilityDamageFormula(e.target.value)}
                            placeholder="ex: 2d6 + 3"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-300 block mb-1">Tipo de Dano</label>
                          <input
                            type="text"
                            value={abilityDamageType}
                            onChange={(e) => setAbilityDamageType(e.target.value)}
                            placeholder="fogo, magico"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-slate-300 block mb-1">Teste de Acerto (Opcional)</label>
                          <input
                            type="text"
                            value={abilityAttackFormula}
                            onChange={(e) => setAbilityAttackFormula(e.target.value)}
                            placeholder="ex: 1d20 + intelecto"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-300 block mb-1">Custo de Recurso</label>
                          <div className="flex space-x-1">
                            <input
                              type="number"
                              min="0"
                              value={resourceCostAmount}
                              onChange={(e) => setResourceCostAmount(parseInt(e.target.value, 10) || 0)}
                              className="w-16 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-sm text-white text-center"
                            />
                            <select
                              value={resourceCostName}
                              onChange={(e) => setResourceCostName(e.target.value)}
                              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-xs text-white"
                            >
                              <option value="mana">Mana / PM</option>
                              <option value="sanidade">Sanidade / SAN</option>
                              <option value="pontos_acao">Pontos de Ação</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ABA 3: USAR CONSUMÍVEL */}
              {actionMode === 'consumable' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Custo de Ação: <strong className="text-emerald-400">Ação Bônus</strong></span>
                    <span>Alvos Válidos: <strong className="text-slate-300">Aliados ou Si Mesmo</strong></span>
                  </div>

                  {actorConsumables.length > 0 ? (
                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1">
                        Consumível no Inventário
                      </label>
                      <select
                        value={selectedConsumableId}
                        onChange={(e) => setSelectedConsumableId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium"
                      >
                        {actorConsumables.map(c => {
                          const props = c.properties || {};
                          const charges = props.charges !== undefined ? ` • ${props.charges} cargas` : '';
                          const cost = props.action_cost === 'free' ? 'Livre' : props.action_cost === 'main' ? 'Principal' : 'Bônus';
                          return (
                            <option key={c.id} value={c.id}>
                              {c.item_name} (Qtd: {c.quantity}{charges} • Ação {cost})
                            </option>
                          );
                        })}
                      </select>

                      {/* Detalhes do consumível selecionado */}
                      {(() => {
                        const curItem = actorConsumables.find(c => c.id === selectedConsumableId);
                        if (!curItem) return null;
                        const props = curItem.properties || {};

                        return (
                          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 mt-2 text-xs">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded font-semibold">
                                Custo: {props.action_cost === 'free' ? 'Ação Livre' : props.action_cost === 'main' ? 'Ação Principal' : 'Ação Bônus'}
                              </span>
                              <span className="text-[10px] bg-slate-900 text-slate-300 border border-slate-700 px-2 py-0.5 rounded font-mono">
                                Quantidade: {curItem.quantity}
                              </span>
                              {props.charges !== undefined && (
                                <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded font-mono">
                                  Cargas: {props.charges}
                                </span>
                              )}
                              {props.healing_formula && (
                                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded font-mono">
                                  Cura: {props.healing_formula}
                                </span>
                              )}
                            </div>

                            {props.descricao && (
                              <p className="text-[11px] text-slate-400">{props.descricao}</p>
                            )}

                            <p className="text-[10px] text-amber-400/90 pt-1">
                              * 1 unidade ou carga deste item será consumida automaticamente do inventário ao executar.
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400">
                      <p className="font-semibold text-white mb-0.5">Nenhum consumível no inventário deste combatente.</p>
                      <p className="text-[11px] text-slate-500">Adicione poções, antídotos ou bálsamos ao inventário do personagem para utilizá-los no combate.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ABA 4: IMBUIR ARMA */}
              {actionMode === 'imbue' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Custo de Ação: <strong className="text-amber-400">Ação Bônus</strong></span>
                    <span>Alvo Válido: <strong className="text-slate-300">Arma Equipada</strong></span>
                  </div>

                  {actorImbueItems.length > 0 && actorWeapons.length > 0 ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-slate-300 block mb-1">
                          Consumível / Óleo / Veneno de Imbuição
                        </label>
                        <select
                          value={selectedImbueItemId}
                          onChange={(e) => setSelectedImbueItemId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium"
                        >
                          {actorImbueItems.map(item => (
                            <option key={item.id} value={item.id}>
                              {item.item_name} (Qtd: {item.quantity})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-slate-300 block mb-1">
                          Arma que Receberá o Efeito
                        </label>
                        <select
                          value={targetWeaponForImbueId}
                          onChange={(e) => setTargetWeaponForImbueId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium"
                        >
                          {actorWeapons.map(w => (
                            <option key={w.id} value={w.id}>
                              {w.item_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl text-xs space-y-1 text-slate-300">
                        <span className="font-semibold text-amber-300 flex items-center space-x-1">
                          <Flame className="w-3.5 h-3.5" />
                          <span>Efeito Persistente de Imbuição</span>
                        </span>
                        <p className="text-[11px] text-slate-400">
                          O consumível será aplicado à arma escolhida, conferindo dano elemental ou condições especiais nos próximos ataques do combatente. 1 unidade do item será consumida.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400">
                      <p className="font-semibold text-white mb-0.5">Armas ou consumíveis de imbuição indisponíveis.</p>
                      <p className="text-[11px] text-slate-500">O combatente precisa ter ao menos uma arma equipada e um óleo/veneno consumível no inventário.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ABA: DEFENDER */}
              {actionMode === 'defend' && (
                <div className="space-y-3 p-3 bg-blue-950/20 border border-blue-800/40 rounded-xl">
                  <div className="flex items-center space-x-2 text-blue-300 font-semibold text-xs">
                    <Shield className="w-4 h-4 text-blue-400" />
                    <span>Postura de Defesa Ativa</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    O combatente assume uma postura defensiva consumindo sua ação principal. Concede bônus de Redução de Dano (RD) ou Defesa contra os próximos ataques recebidos até o início do seu próximo turno.
                  </p>
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-[11px] text-slate-400 flex items-center space-x-2">
                    <span className="text-slate-500 font-semibold">Efeito da Campanha:</span>
                    <strong className="text-blue-300">Bônus de Defesa / RD aplicado automaticamente aos ataques recebidos</strong>
                  </div>
                </div>
              )}

              {/* ABA: ESQUIVAR */}
              {actionMode === 'dodge' && (
                <div className="space-y-3 p-3 bg-purple-950/20 border border-purple-800/40 rounded-xl">
                  <div className="flex items-center space-x-2 text-purple-300 font-semibold text-xs">
                    <Wind className="w-4 h-4 text-purple-400" />
                    <span>Preparar Esquiva</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    O combatente gasta sua ação principal para se esquivar de ataques. Uma rolagem com seus atributos reais da ficha (ex: Agilidade/Destreza/Reflexo) eleva temporariamente sua Defesa contra ataques até o seu próximo turno.
                  </p>
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Fórmula de Esquiva (Opcional - deixe vazio para usar a regra padrão da campanha)
                    </label>
                    <input
                      type="text"
                      value={customDodgeFormula}
                      onChange={(e) => setCustomDodgeFormula(e.target.value)}
                      placeholder="ex: 1d20 + agilidade"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              )}

              {/* ABA 3: AJUSTE MANUAL (EXCLUSIVO MESTRE) */}
              {actionMode === 'manual' && isMaster && (
                <div className="space-y-3 p-3 bg-amber-950/20 border border-amber-800/40 rounded-xl">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1">Tipo de Ajuste</label>
                      <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setManualActionType('damage')}
                          className={`py-1.5 text-xs rounded-lg font-semibold flex items-center justify-center space-x-1 ${
                            manualActionType === 'damage' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Flame className="w-3.5 h-3.5" />
                          <span>Dano</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setManualActionType('heal')}
                          className={`py-1.5 text-xs rounded-lg font-semibold flex items-center justify-center space-x-1 ${
                            manualActionType === 'heal' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Droplets className="w-3.5 h-3.5" />
                          <span>Cura</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1">Recurso</label>
                      <select
                        value={manualResourceName}
                        onChange={(e) => setManualResourceName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="vida">Vida (PV / HP)</option>
                        <option value="sanidade">Sanidade (SAN)</option>
                        <option value="mana">Mana (PM)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1">Valor Direto</label>
                      <input
                        type="number"
                        min="0"
                        value={manualAmount}
                        onChange={(e) => setManualAmount(parseInt(e.target.value, 10) || 0)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1">Ou Fórmula (Opcional)</label>
                      <input
                        type="text"
                        value={manualFormula}
                        onChange={(e) => setManualFormula(e.target.value)}
                        placeholder="ex: 2d6 + 3"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">Notas / Descrição da Ação (Opcional)</label>
                <input
                  type="text"
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="ex: Golpe mirando ponto fraco"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowActionModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                {(() => {
                  const targetVal = getTargetValidation();
                  const actionEcon = getActionEconomyStatus();
                  const isBlocked = isApplyingAction || 
                    (!targetVal.valid && actionMode !== 'manual') || 
                    (actionEcon.isUsed && actionMode !== 'manual');

                  return (
                    <button
                      type="submit"
                      disabled={isBlocked}
                      className={`px-5 py-2 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-1.5 ${
                        isBlocked && !isApplyingAction
                          ? 'bg-slate-700 opacity-60 cursor-not-allowed'
                          : actionMode === 'manual' && manualActionType === 'heal'
                            ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                            : actionMode === 'consumable'
                              ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                              : actionMode === 'imbue'
                                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                                : actionMode === 'defend'
                                  ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
                                  : actionMode === 'dodge'
                                    ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/30'
                                    : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                      }`}
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                      <span>
                        {isApplyingAction 
                          ? 'Executando...' 
                          : !targetVal.valid && actionMode !== 'manual'
                            ? 'Alvo Inválido'
                            : actionEcon.isUsed && actionMode !== 'manual'
                              ? `Ação Esgotada (${actionEcon.costType})`
                              : actionMode === 'defend'
                                ? 'Assumir Defesa'
                                : actionMode === 'dodge'
                                  ? 'Executar Esquiva'
                                  : actionMode === 'consumable'
                                    ? 'Usar Consumível'
                                    : actionMode === 'imbue'
                                      ? 'Imbuir Arma'
                                      : 'Confirmar e Executar'}
                      </span>
                    </button>
                  );
                })()}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Aplicar Condição / Efeito de Status */}
      {showConditionModal && selectedCombatantForCondition && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="font-bold text-base text-white flex items-center space-x-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>[Mestre] Intervenção Manual de Condição em {selectedCombatantForCondition.name}</span>
              </h3>
              <button onClick={() => setShowConditionModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyCondition} className="space-y-4">
              {/* Opção 1: Selecionar de Condições Configuradas no Ruleset */}
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Condições do Sistema de Regras
                </label>
                <select
                  value={selectedConditionDefId}
                  onChange={(e) => setSelectedConditionDefId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Personalizada (digitar abaixo) --</option>
                  {rulesetConditions.map(rc => (
                    <option key={rc.id} value={rc.id}>
                      {rc.name} ({rc.default_duration.value} {rc.default_duration.type}) {rc.description ? `— ${rc.description}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Se for personalizada, permite digitar nome e duração */}
              {!selectedConditionDefId && (
                <>
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Nome da Condição Personalizada
                    </label>
                    <input
                      type="text"
                      value={customConditionName}
                      onChange={(e) => setCustomConditionName(e.target.value)}
                      placeholder="Ex: Atordoado, Congelado, Focado..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      required={!selectedConditionDefId}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1">
                        Tipo de Duração
                      </label>
                      <select
                        value={customDurationType}
                        onChange={(e) => setCustomDurationType(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="turns">Turnos</option>
                        <option value="rounds">Rodadas</option>
                        <option value="actions">Ações</option>
                        <option value="permanent">Permanente</option>
                      </select>
                    </div>

                    {customDurationType !== 'permanent' && (
                      <div>
                        <label className="text-xs font-medium text-slate-300 block mb-1">
                          Quantidade
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={customDurationValue}
                          onChange={(e) => setCustomDurationValue(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowConditionModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isApplyingCondition}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-amber-600/30 flex items-center space-x-1.5"
                >
                  <Flame className="w-4 h-4" />
                  <span>{isApplyingCondition ? 'Aplicando...' : 'Aplicar Condição'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GAVETA / MODAL: Histórico de Ações do Combate */}
      {showLogsDrawer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-end p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md h-[90vh] flex flex-col p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="font-bold text-base text-white flex items-center space-x-2">
                <History className="w-5 h-5 text-indigo-400" />
                <span>Histórico de Combate</span>
              </h3>
              <button onClick={() => setShowLogsDrawer(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              {logs.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs">
                  Nenhuma ação registrada neste combate ainda.
                </div>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                    <div className="flex items-center justify-between text-slate-400 mb-1 text-[10px]">
                      <span className="font-semibold text-indigo-400">{log.actor_name}</span>
                      <span>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                    <p className="text-white font-medium">
                      {log.details?.message || `${log.action_type}: ${log.amount ?? ''}`}
                    </p>
                    {log.details?.attack_roll && (
                      <div className="text-[10px] text-slate-400 mt-1 font-mono bg-slate-900 p-1.5 rounded border border-slate-800">
                        Atq: {log.details.attack_roll.expression ? `${log.details.attack_roll.expression} = ` : ''}{log.details.attack_roll.total}{log.details.target_defense !== undefined ? ` vs Def ${log.details.target_defense}` : ''} ({log.details.hit ? 'ACERTO' : 'FALHA'})
                      </div>
                    )}
                    {Array.isArray(log.details?.componentsBreakdown) && log.details.componentsBreakdown.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {log.details.componentsBreakdown.map((cb: any, cidx: number) => (
                          <span key={cidx} className="text-[9px] bg-slate-900 border border-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                            <strong className="text-amber-400 capitalize">{cb.name || cb.type}:</strong> {cb.original} {cb.multiplier !== 1 ? `(x${cb.multiplier})` : ''} → {cb.final} PV
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
