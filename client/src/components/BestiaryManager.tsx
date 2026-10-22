import React, { useState, useEffect } from 'react';
import { 
  Skull, Plus, Search, Copy, Edit2, Trash2, Shield, Heart, 
  Swords, Eye, EyeOff, UserPlus, Filter, X, Zap, Sliders, CheckSquare, Square
} from 'lucide-react';
import { api, BestiaryCreature, CreatureRevealedFields, CreatureEquipmentItem, CombatEncounter, Scene } from '../services/api';

interface BestiaryManagerProps {
  campaignId: string;
  isMaster: boolean;
  onSpawnToEncounter?: (creature: BestiaryCreature) => void;
}

const CATEGORIES = [
  { id: 'all', label: 'Todas as Categorias' },
  { id: 'humanoide', label: 'Humanoides' },
  { id: 'monstro', label: 'Monstros' },
  { id: 'morto-vivo', label: 'Mortos-Vivos' },
  { id: 'besta', label: 'Bestas & Feras' },
  { id: 'constructo', label: 'Constructos' },
  { id: 'aberracao', label: 'Aberrações' },
  { id: 'demonio', label: 'Demônios & Trevas' },
  { id: 'elemental', label: 'Elementais' },
  { id: 'chefe', label: 'Chefes & Lendários' }
];

const SIZE_OPTIONS = [
  { value: 0.5, label: 'Miúdo (0.5x)' },
  { value: 1, label: 'Médio (1x - 1 quadrado)' },
  { value: 2, label: 'Grande (2x - 2x2 quadrados)' },
  { value: 3, label: 'Enorme (3x - 3x3 quadrados)' },
  { value: 4, label: 'Colossal (4x - 4x4 quadrados)' }
];

const REVEAL_FIELD_DEFINITIONS: Array<{ key: keyof CreatureRevealedFields; label: string; desc: string }> = [
  { key: 'name', label: 'Nome Verdadeiro', desc: 'Se desmarcado, exibe o Nome Mascarado configurado' },
  { key: 'category', label: 'Categoria / Tipo', desc: 'Ex: Humanoide, Monstro, Morto-vivo' },
  { key: 'avatar', label: 'Imagem / Avatar', desc: 'Retrato visual da criatura' },
  { key: 'description', label: 'Descrição & Lore Pública', desc: 'Aparência e comportamento conhecidos' },
  { key: 'attributes', label: 'Atributos Mecânicos', desc: 'Força, Destreza, Agilidade, etc.' },
  { key: 'exact_hp', label: 'Pontos de Vida Exatos', desc: 'Se desmarcado, exibe apenas barra e status visual' },
  { key: 'defenses', label: 'Defesa e Redução de Dano (RD)', desc: 'Valores defensivos exatos' },
  { key: 'damage_types', label: 'Resistências & Imunidades', desc: 'Vulnerabilidades e proteções elementais' },
  { key: 'equipment', label: 'Armas & Equipamentos Equipados', desc: 'Itens empunhados e armaduras' },
  { key: 'abilities', label: 'Habilidades Especiais', desc: 'Poderes e ações especiais' },
  { key: 'formulas', label: 'Fórmulas e Bônus de Ataque', desc: 'Se desmarcado, dados secretos são ocultados nos logs' },
  { key: 'notes', label: 'Notas e Informações Públicas', desc: 'Anotações gerais e dicas narrativas' }
];

export const BestiaryManager: React.FC<BestiaryManagerProps> = ({ campaignId, isMaster, onSpawnToEncounter: _onSpawnToEncounter }) => {
  const [creatures, setCreatures] = useState<BestiaryCreature[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Modais
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editingCreature, setEditingCreature] = useState<BestiaryCreature | null>(null);
  
  const [showSpawnModal, setShowSpawnModal] = useState(false);
  const [creatureToSpawn, setCreatureToSpawn] = useState<BestiaryCreature | null>(null);
  const [spawnCount, setSpawnCount] = useState(1);
  const [spawnNamePrefix, setSpawnNamePrefix] = useState('');
  const [spawnIsHidden, setSpawnIsHidden] = useState(false);
  const [encounters, setEncounters] = useState<CombatEncounter[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string>('');
  const [selectedSceneId, setSelectedSceneId] = useState<string>('');

  // Modal Revelação Progressiva
  const [showRevealFieldsModal, setShowRevealFieldsModal] = useState(false);
  const [creatureForReveal, setCreatureForReveal] = useState<BestiaryCreature | null>(null);
  const [draftRevealedFields, setDraftRevealedFields] = useState<CreatureRevealedFields>({});

  // Form State
  const [formName, setFormName] = useState('');
  const [formDisplayNamePlayers, setFormDisplayNamePlayers] = useState('');
  const [formRace, setFormRace] = useState('');
  const [formCategory, setFormCategory] = useState('monstro');
  const [formSize, setFormSize] = useState(1);
  const [formDescription, setFormDescription] = useState('');
  const [formAvatarUrl, setFormAvatarUrl] = useState('');
  const [formTokenUrl, setFormTokenUrl] = useState('');
  const [formHp, setFormHp] = useState(20);
  const [formDefense, setFormDefense] = useState(12);
  const [formRd, setFormRd] = useState(0);
  const [formInitiativeFormula, setFormInitiativeFormula] = useState('1d20 + 2');
  const [formPublicNotes, setFormPublicNotes] = useState('');
  const [formPrivateNotes, setFormPrivateNotes] = useState('');
  const [formIsRevealed, setFormIsRevealed] = useState(false);
  const [formResistances, setFormResistances] = useState('');
  const [formVulnerabilities, setFormVulnerabilities] = useState('');
  const [formImmunities, setFormImmunities] = useState('');
  const [formActions, setFormActions] = useState<any[]>([]);
  const [formEquipment, setFormEquipment] = useState<CreatureEquipmentItem[]>([]);

  // Action builder inside modal
  const [actionName, setActionName] = useState('');
  const [actionFormula, setActionFormula] = useState('1d8 + 2');
  const [actionDamageType, setActionDamageType] = useState('físico');
  const [actionCost, setActionCost] = useState('main');

  // Equipment builder inside modal
  const [eqName, setEqName] = useState('');
  const [eqType, setEqType] = useState<'weapon' | 'armor' | 'shield' | 'accessory' | 'consumable' | 'other'>('weapon');
  const [eqDmgFormula, setEqDmgFormula] = useState('1d8');
  const [eqAtkFormula, setEqAtkFormula] = useState('');
  const [eqDamageType, setEqDamageType] = useState('físico');
  const [eqDefBonus, setEqDefBonus] = useState(0);
  const [eqRd, setEqRd] = useState(0);

  useEffect(() => {
    loadBestiary();
  }, [campaignId, selectedCategory, search]);

  const loadBestiary = async () => {
    try {
      setLoading(true);
      const data = await api.getBestiary(campaignId, {
        category: selectedCategory,
        search
      });
      setCreatures(data);
    } catch (err: any) {
      console.error('Erro ao carregar bestiário:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingCreature(null);
    setFormName('');
    setFormDisplayNamePlayers('');
    setFormRace('');
    setFormCategory('monstro');
    setFormSize(1);
    setFormDescription('');
    setFormAvatarUrl('');
    setFormTokenUrl('');
    setFormHp(20);
    setFormDefense(12);
    setFormRd(0);
    setFormInitiativeFormula('1d20 + 2');
    setFormPublicNotes('');
    setFormPrivateNotes('');
    setFormIsRevealed(false); // Oculto por padrão para jogadores!
    setFormResistances('');
    setFormVulnerabilities('');
    setFormImmunities('');
    setFormActions([
      {
        name: 'Ataque Padrão',
        formula: '1d6 + 2',
        damage_type: 'físico',
        cost: 'main',
        action_mode: 'attack'
      }
    ]);
    setFormEquipment([]);
    setShowEditorModal(true);
  };

  const handleOpenEditModal = (creature: BestiaryCreature) => {
    setEditingCreature(creature);
    setFormName(creature.name);
    setFormDisplayNamePlayers(creature.display_name_players || creature.properties?.display_name_players || '');
    setFormRace(creature.race || creature.properties?.race || '');
    setFormCategory(creature.category || 'monstro');
    setFormSize(creature.size || 1);
    setFormDescription(creature.description || '');
    setFormAvatarUrl(creature.avatar_url || '');
    setFormTokenUrl(creature.token_url || '');
    
    const stats = { ...creature.raw_data, ...creature.computed_data, ...creature.properties };
    setFormHp(stats.vida ?? stats.pv ?? stats.hp ?? stats.max_hp ?? 20);
    setFormDefense(stats.defesa ?? stats.ca ?? stats.defense ?? 12);
    setFormRd(stats.rd ?? stats.armadura ?? stats.damage_reduction ?? 0);
    setFormInitiativeFormula(stats.iniciativa_formula || stats.initiative_formula || '1d20 + 2');

    setFormPublicNotes(creature.public_notes || creature.properties?.public_notes || '');
    setFormPrivateNotes(creature.private_notes || creature.properties?.private_notes || creature.properties?.gm_notes || '');
    setFormIsRevealed(Boolean(creature.is_revealed));
    
    const resList = stats.resistances || [];
    setFormResistances(Array.isArray(resList) ? resList.join(', ') : String(resList));
    const vulList = stats.vulnerabilities || [];
    setFormVulnerabilities(Array.isArray(vulList) ? vulList.join(', ') : String(vulList));
    const immList = stats.immunities || [];
    setFormImmunities(Array.isArray(immList) ? immList.join(', ') : String(immList));

    setFormActions(creature.actions || []);
    setFormEquipment(creature.equipment || []);
    setShowEditorModal(true);
  };

  const handleSaveCreature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const parseList = (str: string) => str.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

    const payload: Partial<BestiaryCreature> = {
      name: formName.trim(),
      display_name_players: formDisplayNamePlayers.trim() || undefined,
      race: formRace.trim() || undefined,
      category: formCategory,
      size: formSize,
      description: formDescription.trim(),
      avatar_url: formAvatarUrl.trim() || null,
      token_url: formTokenUrl.trim() || formAvatarUrl.trim() || null,
      public_notes: formPublicNotes.trim(),
      private_notes: formPrivateNotes.trim(),
      is_revealed: formIsRevealed ? 1 : 0,
      equipment: formEquipment,
      raw_data: {
        vida: formHp,
        pv_maximo: formHp,
        defesa: formDefense,
        rd: formRd,
        resistances: parseList(formResistances),
        vulnerabilities: parseList(formVulnerabilities),
        immunities: parseList(formImmunities)
      },
      computed_data: {
        vida_maxima: formHp,
        defesa: formDefense,
        rd: formRd
      },
      actions: formActions,
      properties: {
        hide_exact_hp: !formIsRevealed,
        display_name_players: formDisplayNamePlayers.trim() || null,
        hide_stats: !formIsRevealed,
        gm_notes: formPrivateNotes.trim(),
        private_notes: formPrivateNotes.trim(),
        public_notes: formPublicNotes.trim(),
        iniciativa_formula: formInitiativeFormula.trim()
      }
    };

    try {
      if (editingCreature) {
        await api.updateBestiaryCreature(campaignId, editingCreature.id, payload);
      } else {
        await api.createBestiaryCreature(campaignId, payload);
      }
      setShowEditorModal(false);
      loadBestiary();
    } catch (err: any) {
      alert(`Erro ao salvar criatura: ${err.message}`);
    }
  };

  const handleToggleReveal = async (creature: BestiaryCreature) => {
    try {
      if (creature.is_revealed) {
        if (!confirm(`Deseja ocultar "${creature.name}" dos jogadores? Eles não terão mais acesso à sua ficha nem listagem.`)) return;
        await api.hideBestiaryCreature(campaignId, creature.id);
      } else {
        await api.revealBestiaryCreature(campaignId, creature.id);
      }
      loadBestiary();
    } catch (err: any) {
      alert(`Erro ao alterar visibilidade: ${err.message}`);
    }
  };

  const handleOpenRevealFieldsModal = (creature: BestiaryCreature) => {
    setCreatureForReveal(creature);
    setDraftRevealedFields({
      name: true,
      category: true,
      avatar: true,
      description: true,
      ...(creature.revealed_fields || {})
    });
    setShowRevealFieldsModal(true);
  };

  const handleSaveRevealedFields = async () => {
    if (!creatureForReveal) return;
    try {
      await api.updateBestiaryRevealedFields(campaignId, creatureForReveal.id, draftRevealedFields);
      setShowRevealFieldsModal(false);
      loadBestiary();
    } catch (err: any) {
      alert(`Erro ao atualizar revelação progressiva: ${err.message}`);
    }
  };

  const handleDuplicate = async (creature: BestiaryCreature) => {
    try {
      await api.duplicateBestiaryCreature(campaignId, creature.id);
      loadBestiary();
    } catch (err: any) {
      alert(`Erro ao duplicar criatura: ${err.message}`);
    }
  };

  const handleDelete = async (creature: BestiaryCreature) => {
    if (!confirm(`Deseja realmente excluir "${creature.name}" do bestiário? Os combatentes já instanciados não serão apagados.`)) return;
    try {
      await api.deleteBestiaryCreature(campaignId, creature.id);
      loadBestiary();
    } catch (err: any) {
      alert(`Erro ao excluir criatura: ${err.message}`);
    }
  };

  const handleOpenSpawnModal = async (creature: BestiaryCreature) => {
    setCreatureToSpawn(creature);
    setSpawnCount(1);
    setSpawnNamePrefix(creature.name);
    setSpawnIsHidden(false);

    try {
      const [encs, scsData] = await Promise.all([
        api.getEncounters(campaignId),
        api.getScenes(campaignId)
      ]);
      const scsList = Array.isArray(scsData) ? scsData : (scsData?.scenes || []);
      setEncounters(encs);
      setScenes(scsList);

      const activeEnc = encs.find(e => e.status === 'active' || e.status === 'prep') || encs[0];
      if (activeEnc) setSelectedEncounterId(activeEnc.id);

      const activeScene = (!Array.isArray(scsData) && scsData?.activeScene) ? scsData.activeScene : (scsList.find(s => s.is_active) || scsList[0]);
      if (activeScene) setSelectedSceneId(activeScene.id);

      setShowSpawnModal(true);
    } catch (err: any) {
      alert(`Erro ao carregar dados do encontro: ${err.message}`);
    }
  };

  const handleExecuteSpawn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatureToSpawn || !selectedEncounterId) return;

    try {
      await api.spawnCreaturesToEncounter(campaignId, selectedEncounterId, {
        creature_id: creatureToSpawn.id,
        count: spawnCount,
        scene_id: selectedSceneId || null,
        name_prefix: spawnNamePrefix.trim() || creatureToSpawn.name,
        is_hidden: spawnIsHidden
      });

      setShowSpawnModal(false);
      alert(`${spawnCount}x "${spawnNamePrefix || creatureToSpawn.name}" adicionado(s) com sucesso ao combate e mapa!`);
    } catch (err: any) {
      alert(`Erro ao instanciar criatura: ${err.message}`);
    }
  };

  const handleAddActionToForm = () => {
    if (!actionName.trim()) return;
    setFormActions([
      ...formActions,
      {
        name: actionName.trim(),
        formula: actionFormula.trim() || '1d6',
        damage_type: actionDamageType.trim() || 'físico',
        cost: actionCost,
        action_mode: 'attack'
      }
    ]);
    setActionName('');
    setActionFormula('1d8 + 2');
  };

  const handleRemoveActionFromForm = (index: number) => {
    setFormActions(formActions.filter((_, i) => i !== index));
  };

  const handleAddEquipmentToForm = () => {
    if (!eqName.trim()) return;
    const newItem: CreatureEquipmentItem = {
      name: eqName.trim(),
      item_type: eqType,
      damage_formula: eqType === 'weapon' ? (eqDmgFormula.trim() || '1d6') : undefined,
      attack_formula: eqType === 'weapon' ? (eqAtkFormula.trim() || undefined) : undefined,
      damage_type: eqType === 'weapon' ? (eqDamageType.trim() || 'físico') : undefined,
      defense_bonus: eqDefBonus > 0 ? eqDefBonus : undefined,
      damage_reduction: eqRd > 0 ? eqRd : undefined
    };
    setFormEquipment([...formEquipment, newItem]);
    setEqName('');
    setEqDmgFormula('1d8');
    setEqAtkFormula('');
    setEqDefBonus(0);
    setEqRd(0);
  };

  const handleRemoveEquipmentFromForm = (index: number) => {
    setFormEquipment(formEquipment.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Top Header / Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-[#2c2825] shadow-xl transition-all">
        <div>
          <div className="flex items-center space-x-2">
            <Skull className="w-6 h-6 text-rose-500" />
            <h2 className="text-xl font-bold text-white">Bestiário & Biblioteca de Criaturas</h2>
          </div>
          <p className="text-xs text-[#aaa292] mt-1">
            Biblioteca de matrizes e modelos reutilizáveis. Todas as criaturas começam <strong>ocultas por padrão</strong>. O mestre decide quando e o que revelar.
          </p>
        </div>

        {isMaster && (
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center space-x-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-rose-600/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Criatura</span>
          </button>
        )}
      </div>

      {/* Filtros e Busca */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Barra de Busca */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#aaa292] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, raça, categoria ou descrição..."
            className="w-full bg-slate-900/80 backdrop-blur-sm border border-[#2c2825] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-all duration-200"
          />
        </div>

        {/* Categoria */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 md:pb-0">
          <Filter className="w-4 h-4 text-[#aaa292] shrink-0" />
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                  : 'bg-slate-900/80 text-[#aaa292] hover:text-white border border-[#2c2825]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Criaturas */}
      {loading ? (
        <div className="p-12 text-center text-[#aaa292] text-sm">Carregando criaturas do bestiário...</div>
      ) : creatures.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/50 rounded-2xl border border-[#2c2825]">
          <Skull className="w-12 h-12 text-[#574e45] mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">Nenhuma criatura disponível</h3>
          <p className="text-xs text-[#aaa292] mt-1">
            {isMaster 
              ? 'Crie sua primeira criatura no bestiário. Ela nascerá protegida e oculta dos jogadores até você decidir revelá-la.'
              : 'Nenhuma criatura foi revelada pelo mestre nesta campanha até o momento.'}
          </p>
          {isMaster && (
            <button
              onClick={handleOpenCreateModal}
              className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold inline-flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Criatura</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {creatures.map((creature) => {
            const stats = { ...creature.raw_data, ...creature.computed_data, ...creature.properties };
            const revealed = creature.revealed_fields || {};
            const isRevealed = Boolean(creature.is_revealed);

            // Permissões de visualização por campo
            const showExactHp = isMaster || revealed.exact_hp;
            const showDef = isMaster || revealed.defenses;
            const showRd = isMaster || revealed.defenses;
            const showInit = isMaster || revealed.formulas;

            const rawHp = stats.vida ?? stats.pv ?? stats.hp ?? stats.max_hp;
            const hpDisplay = showExactHp
              ? (rawHp !== undefined ? rawHp : (isMaster ? 20 : '??'))
              : (stats.hp_status ? (stats.hp_status === 'healthy' ? 'Saudável' : stats.hp_status) : '??');

            const rawDef = stats.defesa ?? stats.ca ?? stats.defense;
            const defDisplay = showDef
              ? (rawDef !== undefined ? rawDef : (isMaster ? 12 : '??'))
              : '??';

            const rawRd = stats.rd ?? stats.armadura ?? stats.damage_reduction;
            const rdDisplay = showRd
              ? (rawRd !== undefined ? rawRd : (isMaster ? 0 : '??'))
              : '??';

            const rawInit = stats.iniciativa_formula || stats.initiative_formula;
            const initDisplay = showInit
              ? (rawInit || (isMaster ? '1d20 + 2' : '---'))
              : '---';

            return (
              <div 
                key={creature.id}
                className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-[#2c2825] hover:border-[#574e45]/80 transition-all duration-200 hover:scale-[1.01] p-4 flex flex-col justify-between group shadow-xl"
              >
                <div>
                  {/* Cabeçalho do Card */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-800 border border-[#574e45] overflow-hidden flex items-center justify-center shrink-0">
                        {creature.avatar_url || creature.token_url ? (
                          <img 
                            src={creature.avatar_url || creature.token_url!} 
                            alt={creature.name} 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <Skull className="w-6 h-6 text-[#b24a52]" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm leading-tight flex items-center space-x-2">
                          <span>{creature.name}</span>
                          {!isRevealed && (
                            <span title="Oculto para jogadores no bestiário">
                              <EyeOff className="w-3.5 h-3.5 text-[#c9a04e]" />
                            </span>
                          )}
                        </h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/40 text-[10px] uppercase font-semibold">
                            {creature.category}
                          </span>
                          {creature.race && (
                            <span className="text-[10px] text-[#aaa292]">
                              {creature.race}
                            </span>
                          )}
                          <span className="text-[10px] text-[#777064]">
                            {creature.size}x
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Badge de Visibilidade do Modelo */}
                    {isMaster && (
                      <div className="shrink-0">
                        {isRevealed ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                            <Eye className="w-3 h-3" />
                            <span>Revelado</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-950/80 text-rose-300 border border-rose-800/60">
                            <EyeOff className="w-3 h-3" />
                            <span>Oculto</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Nome Mascarado se houver (visível apenas para o mestre para conferência) */}
                  {isMaster && creature.display_name_players && (
                    <div className="bg-slate-950/80 border border-[#2c2825] rounded-lg px-2.5 py-1 mb-2.5 text-[11px] text-[#aaa292]">
                      Nome visto pelos jogadores: <strong className="text-amber-300">"{creature.display_name_players}"</strong>
                    </div>
                  )}

                  {/* Descrição */}
                  {creature.description && (
                    <p className="text-xs text-[#aaa292] line-clamp-2 mb-3">
                      {creature.description}
                    </p>
                  )}

                  {/* Atributos Mecânicos */}
                  <div className="grid grid-cols-4 gap-1.5 bg-slate-950/60 p-2.5 rounded-xl border border-[#2c2825]/60 text-center mb-3">
                    <div>
                      <span className="text-[10px] text-[#aaa292] flex items-center justify-center space-x-0.5">
                        <Heart className="w-3 h-3 text-rose-500" />
                        <span>PV</span>
                      </span>
                      <span className="text-xs font-bold text-white mt-0.5 block">{hpDisplay}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#aaa292] flex items-center justify-center space-x-0.5">
                        <Shield className="w-3 h-3 text-[#c9a04e]" />
                        <span>Defesa</span>
                      </span>
                      <span className="text-xs font-bold text-white mt-0.5 block">{defDisplay}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#aaa292] flex items-center justify-center space-x-0.5">
                        <Shield className="w-3 h-3 text-[#c9a04e]" />
                        <span>RD</span>
                      </span>
                      <span className="text-xs font-bold text-white mt-0.5 block">{rdDisplay}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#aaa292] flex items-center justify-center space-x-0.5">
                        <Zap className="w-3 h-3 text-emerald-400" />
                        <span>Inic.</span>
                      </span>
                      <span className="text-[11px] font-bold text-emerald-300 mt-0.5 block truncate" title={String(initDisplay)}>{initDisplay}</span>
                    </div>
                  </div>

                  {/* Equipamentos & Armas */}
                  {creature.equipment && creature.equipment.length > 0 && (isMaster || revealed.equipment) && (
                    <div className="space-y-1 mb-3">
                      <span className="text-[10px] font-bold text-[#777064] uppercase tracking-wider">Armas & Equipamentos ({creature.equipment.length})</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {creature.equipment.map((eq, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-[#ece3d0] border border-[#574e45]/60 flex items-center space-x-1">
                            <Swords className="w-3 h-3 text-[#c9a04e]" />
                            <span>{eq.name}</span>
                            {showInit && eq.damage_formula && <span className="text-[#777064] font-mono text-[10px]">({eq.damage_formula})</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Lista de Ações / Habilidades da Criatura */}
                  {creature.actions && creature.actions.length > 0 && (isMaster || revealed.abilities) && (
                    <div className="space-y-1 mb-3">
                      <span className="text-[10px] font-bold text-[#777064] uppercase tracking-wider">Ações ({creature.actions.length})</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {creature.actions.slice(0, 3).map((act, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-[#ece3d0] border border-[#574e45]/60 flex items-center space-x-1">
                            <Swords className="w-3 h-3 text-[#b24a52]" />
                            <span>{act.name}</span>
                            {showInit && act.formula && <span className="text-[#777064] font-mono text-[10px]">({act.formula})</span>}
                          </span>
                        ))}
                        {creature.actions.length > 3 && (
                          <span className="px-1.5 py-0.5 text-[10px] text-[#777064]">+{creature.actions.length - 3}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notas Privadas do Mestre */}
                  {isMaster && creature.private_notes && (
                    <div className="bg-slate-950/60 border border-[#2c2825] rounded-lg p-2 mb-3 text-[11px] text-[#aaa292]">
                      <strong className="text-[#b24a52] block mb-0.5">Notas do Mestre (Confidencial):</strong>
                      <span className="line-clamp-2">{creature.private_notes}</span>
                    </div>
                  )}
                </div>

                {/* Ações / Botões do Card */}
                {isMaster && (
                  <div className="pt-3 border-t border-[#2c2825] space-y-2">
                    {/* Botões de Visibilidade e Revelação */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleReveal(creature)}
                        className={`flex-1 py-1 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors ${
                          isRevealed 
                            ? 'bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-900/40' 
                            : 'bg-emerald-600/90 hover:bg-emerald-500 text-white shadow-sm'
                        }`}
                        title={isRevealed ? 'Ocultar criatura no bestiário dos jogadores' : 'Revelar criatura no bestiário dos jogadores'}
                      >
                        {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{isRevealed ? 'Ocultar' : 'Revelar aos Jogadores'}</span>
                      </button>

                      <button
                        onClick={() => handleOpenRevealFieldsModal(creature)}
                        className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg text-xs font-semibold flex items-center space-x-1 border border-[#574e45]"
                        title="Configurar quais campos são visíveis progressivamente aos jogadores"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Revelação</span>
                      </button>
                    </div>

                    {/* Botões de Gerenciamento da Criatura */}
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleOpenSpawnModal(creature)}
                        className="flex-1 py-1.5 px-3 bg-rose-600/90 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-rose-600/20"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Instanciar</span>
                      </button>

                      <button
                        onClick={() => handleDuplicate(creature)}
                        className="p-1.5 text-[#aaa292] hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-[#574e45]"
                        title="Duplicar para Criar Variante"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleOpenEditModal(creature)}
                        className="p-1.5 text-[#aaa292] hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-[#574e45]"
                        title="Editar Modelo Completo"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDelete(creature)}
                        className="p-1.5 text-[#aaa292] hover:text-[#b24a52] bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-[#574e45]"
                        title="Excluir do Bestiário"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: CONFIGURAÇÃO DE REVELAÇÃO PROGRESSIVA */}
      {showRevealFieldsModal && creatureForReveal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#1a1816] border border-[#2c2825] rounded-2xl w-full max-w-lg p-6 shadow-2xl backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2c2825]">
              <div className="flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-[#c9a04e]" />
                <h3 className="text-base font-bold text-white">
                  Revelação Progressiva: {creatureForReveal.name}
                </h3>
              </div>
              <button 
                onClick={() => setShowRevealFieldsModal(false)}
                className="p-1 text-[#aaa292] hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#aaa292]">
              Controle granularmente quais informações os jogadores podem visualizar na ficha desta criatura. Campos desmarcados permanecem estritamente mascarados pelo backend.
            </p>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {REVEAL_FIELD_DEFINITIONS.map(def => {
                const isChecked = Boolean(draftRevealedFields[def.key]);
                return (
                  <div 
                    key={def.key}
                    onClick={() => setDraftRevealedFields({ ...draftRevealedFields, [def.key]: !isChecked })}
                    className="flex items-start space-x-3 p-2.5 bg-slate-950/60 rounded-xl border border-[#2c2825] hover:border-[#574e45] cursor-pointer transition-colors"
                  >
                    <div className="mt-0.5 text-[#c9a04e]">
                      {isChecked ? <CheckSquare className="w-4 h-4 text-indigo-500" /> : <Square className="w-4 h-4 text-[#574e45]" />}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-white">{def.label}</div>
                      <div className="text-[11px] text-[#aaa292]">{def.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#2c2825]">
              <button
                type="button"
                onClick={() => setShowRevealFieldsModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-[#ece3d0] rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveRevealedFields}
                className="px-5 py-2 bg-[#c9a04e] hover:bg-[#c9a04e]/90 text-[#131211] font-bold rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30"
              >
                Salvar Preferências
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR / EDITAR CRIATURA COMPLETA */}
      {showEditorModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#1a1816] border border-[#2c2825] rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between pb-4 border-b border-[#2c2825] mb-4">
              <div className="flex items-center space-x-2">
                <Skull className="w-5 h-5 text-rose-500" />
                <h3 className="text-base font-bold text-white">
                  {editingCreature ? `Editar Criatura: ${editingCreature.name}` : 'Criar Nova Criatura / Modelo de NPC'}
                </h3>
              </div>
              <button 
                onClick={() => setShowEditorModal(false)}
                className="p-1 text-[#aaa292] hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCreature} className="space-y-4">
              {/* Linha 1: Nome Verdadeiro, Nome Mascarado e Raça */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#aaa292] mb-1">Nome Real (Mestre) *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex: Vampiro Ancião Lorde Malakar"
                    className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#aaa292] mb-1">Nome Mascarado (Jogadores)</label>
                  <input
                    type="text"
                    value={formDisplayNamePlayers}
                    onChange={(e) => setFormDisplayNamePlayers(e.target.value)}
                    placeholder="Ex: Figura Encapuzada, Sombra Misteriosa"
                    className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#aaa292] mb-1">Raça / Espécie</label>
                  <input
                    type="text"
                    value={formRace}
                    onChange={(e) => setFormRace(e.target.value)}
                    placeholder="Ex: Morto-Vivo, Dracônico, Elfo Corrompido"
                    className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Linha 2: Categoria, Tamanho e Visibilidade Inicial */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#aaa292] mb-1">Categoria</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#aaa292] mb-1">Tamanho da Criatura (Grid)</label>
                  <select
                    value={formSize}
                    onChange={(e) => setFormSize(Number(e.target.value))}
                    className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    {SIZE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center space-x-2 text-xs text-[#ece3d0] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsRevealed}
                      onChange={(e) => setFormIsRevealed(e.target.checked)}
                      className="rounded bg-slate-950 border-[#2c2825] text-rose-500 focus:ring-0"
                    />
                    <span>Revelado aos jogadores no bestiário</span>
                  </label>
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-medium text-[#aaa292] mb-1">Descrição & Lore</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Comportamento, táticas, ecologia..."
                  className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Imagens / URLs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#aaa292] mb-1">Avatar / Imagem (URL)</label>
                  <input
                    type="text"
                    value={formAvatarUrl}
                    onChange={(e) => setFormAvatarUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#aaa292] mb-1">Token para Mapa (URL)</label>
                  <input
                    type="text"
                    value={formTokenUrl}
                    onChange={(e) => setFormTokenUrl(e.target.value)}
                    placeholder="https://... (ou vazio para usar avatar)"
                    className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Estatísticas de Combate */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-[#2c2825]">
                <span className="text-xs font-bold text-[#b24a52] block mb-2">Estatísticas de Combate & Vida</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#aaa292] mb-1">Pontos de Vida (PV)</label>
                    <input
                      type="number"
                      min={1}
                      value={formHp}
                      onChange={(e) => setFormHp(Number(e.target.value))}
                      className="w-full bg-[#1a1816] border border-[#2c2825] rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#aaa292] mb-1">Defesa (CA)</label>
                    <input
                      type="number"
                      min={0}
                      value={formDefense}
                      onChange={(e) => setFormDefense(Number(e.target.value))}
                      className="w-full bg-[#1a1816] border border-[#2c2825] rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#aaa292] mb-1">Redução de Dano (RD)</label>
                    <input
                      type="number"
                      min={0}
                      value={formRd}
                      onChange={(e) => setFormRd(Number(e.target.value))}
                      className="w-full bg-[#1a1816] border border-[#2c2825] rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#aaa292] mb-1">Fórmula Iniciativa</label>
                    <input
                      type="text"
                      value={formInitiativeFormula}
                      onChange={(e) => setFormInitiativeFormula(e.target.value)}
                      placeholder="1d20 + 2"
                      className="w-full bg-[#1a1816] border border-[#2c2825] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Tipos de Dano: Resistências, Vulnerabilidades e Imunidades */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-[#2c2825] space-y-2">
                <span className="text-xs font-bold text-[#c9a04e] block">Resistências, Vulnerabilidades & Imunidades</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#aaa292] mb-1">Resistências (Dano 50%)</label>
                    <input
                      type="text"
                      value={formResistances}
                      onChange={(e) => setFormResistances(e.target.value)}
                      placeholder="fogo, frio, corte, perfuracao..."
                      className="w-full bg-[#1a1816] border border-[#2c2825] rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#aaa292] mb-1">Vulnerabilidades (Dano 150%)</label>
                    <input
                      type="text"
                      value={formVulnerabilities}
                      onChange={(e) => setFormVulnerabilities(e.target.value)}
                      placeholder="sagrado, radiante, fogo..."
                      className="w-full bg-[#1a1816] border border-[#2c2825] rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#aaa292] mb-1">Imunidades (Dano 0%)</label>
                    <input
                      type="text"
                      value={formImmunities}
                      onChange={(e) => setFormImmunities(e.target.value)}
                      placeholder="veneno, eletrico, psiquico..."
                      className="w-full bg-[#1a1816] border border-[#2c2825] rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Armas & Equipamentos Equipados */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-[#2c2825] space-y-2">
                <span className="text-xs font-bold text-[#c9a04e] block">Armas & Equipamentos Equipados</span>
                
                {formEquipment.map((eq, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-900 p-2 rounded-lg border border-[#2c2825] text-xs">
                    <div className="flex items-center space-x-2">
                      <Swords className="w-3.5 h-3.5 text-[#c9a04e]" />
                      <strong className="text-white">{eq.name}</strong>
                      <span className="text-[#aaa292] text-[10px] uppercase">({eq.item_type || 'item'})</span>
                      {eq.damage_formula && <span className="text-rose-300 font-mono text-[10px]">Dano: {eq.damage_formula} ({eq.damage_type || 'físico'})</span>}
                      {eq.defense_bonus ? <span className="text-emerald-400 text-[10px]">+{eq.defense_bonus} Def</span> : null}
                      {eq.damage_reduction ? <span className="text-[#c9a04e] text-[10px]">+{eq.damage_reduction} RD</span> : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveEquipmentFromForm(idx)}
                      className="text-[#777064] hover:text-[#b24a52] p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* Adicionar Equipamento */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2 border-t border-[#2c2825]">
                  <input
                    type="text"
                    value={eqName}
                    onChange={(e) => setEqName(e.target.value)}
                    placeholder="Nome do item / arma"
                    className="sm:col-span-2 bg-[#1a1816] border border-[#2c2825] rounded-lg px-2 py-1.5 text-xs text-white"
                  />
                  <select
                    value={eqType}
                    onChange={(e) => setEqType(e.target.value as any)}
                    className="bg-[#1a1816] border border-[#2c2825] rounded-lg px-2 py-1.5 text-xs text-white"
                  >
                    <option value="weapon">Arma</option>
                    <option value="armor">Armadura</option>
                    <option value="shield">Escudo</option>
                    <option value="accessory">Acessório</option>
                  </select>
                  <input
                    type="text"
                    value={eqDmgFormula}
                    onChange={(e) => setEqDmgFormula(e.target.value)}
                    placeholder="Dano (ex: 2d6+4)"
                    className="bg-[#1a1816] border border-[#2c2825] rounded-lg px-2 py-1.5 text-xs text-white font-mono"
                  />
                  <input
                    type="text"
                    value={eqDamageType}
                    onChange={(e) => setEqDamageType(e.target.value)}
                    placeholder="Tipo de Dano"
                    className="bg-[#1a1816] border border-[#2c2825] rounded-lg px-2 py-1.5 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddEquipmentToForm}
                    className="bg-[#c9a04e] hover:bg-[#c9a04e]/90 text-[#131211] font-bold rounded-lg text-xs font-semibold py-1.5"
                  >
                    + Equipar
                  </button>
                </div>
              </div>

              {/* Ações e Ataques Adicionais */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-[#2c2825] space-y-2">
                <span className="text-xs font-bold text-[#b24a52] block">Ações Especiais do Monstro</span>
                
                {formActions.map((act, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-900 p-2 rounded-lg border border-[#2c2825] text-xs">
                    <div className="flex items-center space-x-2">
                      <Swords className="w-3.5 h-3.5 text-[#b24a52]" />
                      <strong className="text-white">{act.name}</strong>
                      <span className="text-[#aaa292] font-mono">({act.formula})</span>
                      <span className="text-[10px] uppercase text-indigo-300 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800/40">
                        {act.damage_type || 'físico'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveActionFromForm(idx)}
                      className="text-[#777064] hover:text-[#b24a52] p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* Adicionar nova ação */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t border-[#2c2825]">
                  <input
                    type="text"
                    value={actionName}
                    onChange={(e) => setActionName(e.target.value)}
                    placeholder="Nome da ação (ex: Mordida)"
                    className="bg-[#1a1816] border border-[#2c2825] rounded-lg px-2 py-1.5 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={actionFormula}
                    onChange={(e) => setActionFormula(e.target.value)}
                    placeholder="Dano (ex: 2d6 + 3)"
                    className="bg-[#1a1816] border border-[#2c2825] rounded-lg px-2 py-1.5 text-xs text-white font-mono"
                  />
                  <input
                    type="text"
                    value={actionDamageType}
                    onChange={(e) => setActionDamageType(e.target.value)}
                    placeholder="Tipo (físico, fogo, etc.)"
                    className="bg-[#1a1816] border border-[#2c2825] rounded-lg px-2 py-1.5 text-xs text-white"
                  />
                  <select
                    value={actionCost}
                    onChange={(e) => setActionCost(e.target.value)}
                    className="bg-[#1a1816] border border-[#2c2825] rounded-lg px-2 py-1.5 text-xs text-white"
                  >
                    <option value="main">Principal</option>
                    <option value="bonus">Bônus / Livre</option>
                    <option value="reaction">Reação</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddActionToForm}
                    className="bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold py-1.5"
                  >
                    + Ação
                  </button>
                </div>
              </div>

              {/* Notas Públicas e Notas Privadas do Mestre */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#aaa292] mb-1">Notas Públicas (Lore / Visível a jogadores quando revelado)</label>
                  <textarea
                    rows={2}
                    value={formPublicNotes}
                    onChange={(e) => setFormPublicNotes(e.target.value)}
                    placeholder="Comportamento público, fraquezas conhecidas pelos estudiosos..."
                    className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#b24a52] mb-1">Notas Privadas do Mestre (100% Confidencial)</label>
                  <textarea
                    rows={2}
                    value={formPrivateNotes}
                    onChange={(e) => setFormPrivateNotes(e.target.value)}
                    placeholder="Objetivos de cena, táticas sujas, tesouro oculto..."
                    className="w-full bg-slate-950 border border-rose-950/60 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Botões do Modal */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#2c2825]">
                <button
                  type="button"
                  onClick={() => setShowEditorModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-[#ece3d0] rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-rose-600/30"
                >
                  Salvar Criatura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INSTANCIAR CRIATURA NO COMBATE E MAPA */}
      {showSpawnModal && creatureToSpawn && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1a1816] border border-[#2c2825] rounded-2xl w-full max-w-md p-6 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between pb-3 border-b border-[#2c2825] mb-4">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-rose-500" />
                <h3 className="text-base font-bold text-white">Instanciar Criatura</h3>
              </div>
              <button 
                onClick={() => setShowSpawnModal(false)}
                className="p-1 text-[#aaa292] hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteSpawn} className="space-y-4">
              <div className="bg-slate-950 p-3 rounded-xl border border-[#2c2825] flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                  {creatureToSpawn.avatar_url ? (
                    <img src={creatureToSpawn.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Skull className="w-5 h-5 text-[#b24a52]" />
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs">{creatureToSpawn.name}</h4>
                  <span className="text-[10px] text-[#aaa292]">Modelo: {creatureToSpawn.category}</span>
                </div>
              </div>

              {/* Quantidade */}
              <div>
                <label className="block text-xs font-medium text-[#aaa292] mb-1">Quantidade de Instâncias Independentes</label>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setSpawnCount(Math.max(1, spawnCount - 1))}
                    className="w-8 h-8 rounded-lg bg-slate-800 text-white font-bold flex items-center justify-center hover:bg-slate-700"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={spawnCount}
                    onChange={(e) => setSpawnCount(Math.max(1, Math.min(20, Number(e.target.value))))}
                    className="w-16 text-center bg-[#131211] border border-[#2c2825] rounded-lg py-1 text-xs text-white font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setSpawnCount(Math.min(20, spawnCount + 1))}
                    className="w-8 h-8 rounded-lg bg-slate-800 text-white font-bold flex items-center justify-center hover:bg-slate-700"
                  >
                    +
                  </button>
                  <span className="text-xs text-[#aaa292] ml-2">
                    {spawnCount > 1 ? `Criará: ${spawnNamePrefix} 1, 2, ... ${spawnCount}` : 'Instância única'}
                  </span>
                </div>
              </div>

              {/* Prefixo de Nome */}
              <div>
                <label className="block text-xs font-medium text-[#aaa292] mb-1">Nome / Prefixo da Instância</label>
                <input
                  type="text"
                  value={spawnNamePrefix}
                  onChange={(e) => setSpawnNamePrefix(e.target.value)}
                  className="w-full bg-[#131211] border border-[#2c2825] rounded-lg px-3 py-1.5 text-xs text-white"
                />
              </div>

              {/* Seleção do Encontro */}
              <div>
                <label className="block text-xs font-medium text-[#aaa292] mb-1">Encontro de Combate Alvo</label>
                <select
                  value={selectedEncounterId}
                  onChange={(e) => setSelectedEncounterId(e.target.value)}
                  className="w-full bg-[#131211] border border-[#2c2825] rounded-lg px-3 py-1.5 text-xs text-white"
                >
                  {encounters.map(enc => (
                    <option key={enc.id} value={enc.id}>
                      {enc.name} ({enc.status === 'active' ? '⚡ Ativo' : enc.status === 'prep' ? '📝 Preparação' : 'Encerrado'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Seleção de Cena / Mapa */}
              <div>
                <label className="block text-xs font-medium text-[#aaa292] mb-1">Posicionar Token no Mapa (Opcional)</label>
                <select
                  value={selectedSceneId}
                  onChange={(e) => setSelectedSceneId(e.target.value)}
                  className="w-full bg-[#131211] border border-[#2c2825] rounded-lg px-3 py-1.5 text-xs text-white"
                >
                  <option value="">Nenhum (apenas na iniciativa)</option>
                  {scenes.map(sc => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name} {sc.is_active ? '(Cena Ativa)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Oculto / Reforço Surpresa */}
              <label className="flex items-center space-x-2 text-xs text-[#ece3d0] cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={spawnIsHidden}
                  onChange={(e) => setSpawnIsHidden(e.target.checked)}
                  className="rounded bg-slate-950 border-[#2c2825] text-rose-500"
                />
                <span>Oculto para os jogadores (Invisível na iniciativa e mapa)</span>
              </label>

              {/* Botões */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#2c2825]">
                <button
                  type="button"
                  onClick={() => setShowSpawnModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-[#ece3d0] rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-rose-600/30"
                >
                  Instanciar no Encontro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
