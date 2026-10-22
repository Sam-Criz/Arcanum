import React, { useState, useEffect } from 'react';
import { Campaign, CatalogItem, Character, ItemRequest, api, User, DamageTypeDefinition, DamageComponent, ConditionDefinition } from '../services/api';
import { 
  Package, Plus, Trash2, Edit3, Search, Gift, Sparkles, Filter, 
  Check, X, Clock, Swords, Shield, Zap, Flame, HeartPulse, Send,
  Wand2
} from 'lucide-react';

interface CatalogManagerProps {
  campaign: Campaign;
  user?: User;
  characters: Character[];
  selectedCharacter?: Character | null;
  onRefreshCampaign?: () => void;
}

export const CatalogManager: React.FC<CatalogManagerProps> = ({
  campaign,
  user,
  characters,
  selectedCharacter,
  onRefreshCampaign
}) => {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todos');

  // Tipos de dano e condições da campanha
  const [damageTypes, setDamageTypes] = useState<DamageTypeDefinition[]>([]);
  const [conditionsList, setConditionsList] = useState<ConditionDefinition[]>([]);

  // Solicitações de Itens
  const [itemRequests, setItemRequests] = useState<ItemRequest[]>([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [itemToRequest, setItemToRequest] = useState<CatalogItem | null>(null);
  const [requestCharId, setRequestCharId] = useState('');
  const [requestQuantity, setRequestQuantity] = useState(1);
  const [requestNotes, setRequestNotes] = useState('');

  // Modal Novo/Editar Item
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('geral');
  const [weight, setWeight] = useState('0');
  const [cost, setCost] = useState('0');
  const [acquisitionMode, setAcquisitionMode] = useState<'free' | 'limited' | 'approval'>('free');
  const [stockQuantity, setStockQuantity] = useState('10');

  // Propriedades Específicas por Categoria
  const [weaponDano, setWeaponDano] = useState('1d8');
  const [weaponTipoDano, setWeaponTipoDano] = useState('fisico');
  const [weaponAtaque, setWeaponAtaque] = useState('');
  const [weaponAlcance, setWeaponAlcance] = useState('corpo a corpo');
  const [weaponMunicaoTipo, setWeaponMunicaoTipo] = useState('');
  const [weaponCapacidadeMunicao, setWeaponCapacidadeMunicao] = useState('');
  const [weaponEspecial, setWeaponEspecial] = useState('');
  const [weaponComponents, setWeaponComponents] = useState<DamageComponent[]>([]);

  const [armorDefesaBonus, setArmorDefesaBonus] = useState('2');
  const [armorReducaoDano, setArmorReducaoDano] = useState('0');
  const [armorPenalidade, setArmorPenalidade] = useState('0');
  const [armorRequisitos, setArmorRequisitos] = useState('');

  const [techBateriaMax, setTechBateriaMax] = useState('20');
  const [techConsumo, setTechConsumo] = useState('1');
  const [techEfeito, setTechEfeito] = useState('');

  const [occultAlmaMax, setOccultAlmaMax] = useState('5');
  const [occultCusto, setOccultCusto] = useState('1');
  const [occultEfeito, setOccultEfeito] = useState('');

  const [consumivelCargas, setConsumivelCargas] = useState('1');
  const [consumivelAtributo, setConsumivelAtributo] = useState('vida_atual');
  const [consumivelFormula, setConsumivelFormula] = useState('2d8 + 2');
  const [consumivelDuracao, setConsumivelDuracao] = useState('Instantâneo');
  const [consumivelEfeito, setConsumivelEfeito] = useState('');
  const [consumivelCondition, setConsumivelCondition] = useState('');

  // Imbuição de Armas com Consumíveis
  const [consumivelCanImbue, setConsumivelCanImbue] = useState(false);
  const [imbueDamageType, setImbueDamageType] = useState('veneno');
  const [imbueDamageFormula, setImbueDamageFormula] = useState('1d4');
  const [imbuePercentageDamage, setImbuePercentageDamage] = useState('');
  const [imbueChancePercent, setImbueChancePercent] = useState('100');
  const [imbueDurationType, setImbueDurationType] = useState<'hits' | 'attacks' | 'turns' | 'rounds' | 'permanent'>('hits');
  const [imbueCharges, setImbueCharges] = useState('3');
  const [imbueCondition, setImbueCondition] = useState('');
  const [imbueCombineBehavior, setImbueCombineBehavior] = useState<'replace' | 'stack' | 'reject'>('replace');

  // Adição de Componente de Dano Adicional
  const [newCompType, setNewCompType] = useState('fogo');
  const [newCompFormula, setNewCompFormula] = useState('1d6');
  const [newCompPercent, setNewCompPercent] = useState('');
  const [newCompChance, setNewCompChance] = useState('100');
  const [newCompCondition, setNewCompCondition] = useState('');

  const handleAddComponent = () => {
    if (!newCompFormula.trim() && !newCompPercent.trim()) return;
    const comp: DamageComponent = {
      damage_type: newCompType || 'fogo',
      formula: newCompFormula.trim() || undefined,
      percentage_damage: newCompPercent.trim() ? parseFloat(newCompPercent) : undefined,
      chance_percent: newCompChance.trim() ? Math.min(100, Math.max(1, parseInt(newCompChance, 10))) : 100,
      condition: newCompCondition.trim() || undefined
    };
    setWeaponComponents([...weaponComponents, comp]);
    setNewCompFormula('');
    setNewCompPercent('');
    setNewCompChance('100');
    setNewCompCondition('');
  };

  const handleRemoveComponent = (idx: number) => {
    setWeaponComponents(weaponComponents.filter((_, i) => i !== idx));
  };

  // Modal Conceder Item ao Personagem (Mestre)
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [itemToGrant, setItemToGrant] = useState<CatalogItem | null>(null);
  const [grantCharId, setGrantCharId] = useState('');
  const [grantQuantity, setGrantQuantity] = useState(1);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isMaster = campaign.role === 'owner' || campaign.role === 'master' || campaign.role === 'assistant';

  useEffect(() => {
    loadCatalog();
    loadItemRequests();
    loadDamageTypesAndConditions();
  }, [selectedCategory, search]);

  const loadDamageTypesAndConditions = async () => {
    try {
      const [dTypes, conds] = await Promise.all([
        api.getRulesetDamageTypes(campaign.id).catch(() => []),
        api.getRulesetConditions(campaign.id).catch(() => [])
      ]);
      setDamageTypes(dTypes);
      setConditionsList(conds);
    } catch {}
  };

  const loadCatalog = async () => {
    try {
      setLoading(true);
      const res = await api.getCatalogItems(campaign.id, selectedCategory, search);
      setItems(res);
    } catch (err) {
      console.error('Erro ao carregar catálogo:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadItemRequests = async () => {
    try {
      const res = await api.getItemRequests(campaign.id);
      setItemRequests(res);
    } catch (err) {
      console.error('Erro ao carregar solicitações de itens:', err);
    }
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setName('');
    setDescription('');
    setCategory('geral');
    setWeight('0');
    setCost('0');
    setAcquisitionMode('free');
    setStockQuantity('10');
    setWeaponDano('1d8');
    setWeaponTipoDano(damageTypes.length > 0 ? damageTypes[0].id : 'fisico');
    setWeaponAtaque('');
    setWeaponAlcance('corpo a corpo');
    setWeaponMunicaoTipo('');
    setWeaponCapacidadeMunicao('');
    setWeaponEspecial('');
    setWeaponComponents([]);
    setArmorDefesaBonus('2');
    setArmorReducaoDano('0');
    setArmorPenalidade('0');
    setArmorRequisitos('');
    setTechBateriaMax('20');
    setTechConsumo('1');
    setTechEfeito('');
    setOccultAlmaMax('5');
    setOccultCusto('1');
    setOccultEfeito('');
    setConsumivelCargas('1');
    setConsumivelAtributo('vida_atual');
    setConsumivelFormula('2d8 + 2');
    setConsumivelDuracao('Instantâneo');
    setConsumivelEfeito('');
    setConsumivelCondition('');
    setConsumivelCanImbue(false);
    setImbueDamageType(damageTypes.length > 0 ? damageTypes[0].id : 'veneno');
    setImbueDamageFormula('1d4');
    setImbuePercentageDamage('');
    setImbueChancePercent('100');
    setImbueDurationType('hits');
    setImbueCharges('3');
    setImbueCondition('');
    setImbueCombineBehavior('replace');
    setShowItemModal(true);
  };

  const openEditModal = (item: CatalogItem) => {
    setEditingItem(item);
    setName(item.name);
    setDescription(item.description);
    setCategory(item.category);
    setWeight(String(item.weight));
    setCost(String(item.cost));
    setAcquisitionMode(item.acquisition_mode || 'free');
    setStockQuantity(item.stock_quantity !== null && item.stock_quantity !== undefined ? String(item.stock_quantity) : '10');

    const props = item.properties || {};
    setWeaponDano(props.dano || '1d8');
    setWeaponTipoDano(props.tipo_dano || (damageTypes.length > 0 ? damageTypes[0].id : 'fisico'));
    setWeaponAtaque(props.attack_formula || '');
    setWeaponAlcance(props.alcance || 'corpo a corpo');
    setWeaponMunicaoTipo(props.municao_tipo || '');
    setWeaponCapacidadeMunicao(props.capacidade_municao !== undefined ? String(props.capacidade_municao) : '');
    setWeaponEspecial(props.propriedades_especiais || '');
    setWeaponComponents(Array.isArray(props.damage_components) ? [...props.damage_components] : []);
    setArmorDefesaBonus(props.defesa_bonus !== undefined ? String(props.defesa_bonus) : '2');
    setArmorReducaoDano(props.reducao_dano !== undefined ? String(props.reducao_dano) : '0');
    setArmorPenalidade(props.penalidade !== undefined ? String(props.penalidade) : '0');
    setArmorRequisitos(props.requisitos || '');

    setTechBateriaMax(props.bateria_max !== undefined ? String(props.bateria_max) : '20');
    setTechConsumo(props.consumo_por_uso !== undefined ? String(props.consumo_por_uso) : '1');
    setTechEfeito(props.efeito || '');

    setOccultAlmaMax(props.pontos_alma_max !== undefined ? String(props.pontos_alma_max) : '5');
    setOccultCusto(props.custo_ativacao !== undefined ? String(props.custo_ativacao) : '1');
    setOccultEfeito(props.efeito || '');

    setConsumivelCargas(props.cargas_max !== undefined ? String(props.cargas_max) : '1');
    setConsumivelAtributo(props.recuperacao_atributo || 'vida_atual');
    setConsumivelFormula(props.recuperacao_formula || '2d8 + 2');
    setConsumivelDuracao(props.duracao || 'Instantâneo');
    setConsumivelEfeito(props.efeito || '');
    setConsumivelCondition(props.condition || (Array.isArray(props.apply_conditions) && props.apply_conditions.length > 0 ? (typeof props.apply_conditions[0] === 'string' ? props.apply_conditions[0] : props.apply_conditions[0].condition_id || props.apply_conditions[0].name) : ''));

    const hasImbue = Boolean(props.can_imbue || props.imbue_properties);
    setConsumivelCanImbue(hasImbue);
    const imbue = props.imbue_properties || {};
    setImbueDamageType(imbue.damage_type || (damageTypes.length > 0 ? damageTypes[0].id : 'veneno'));
    setImbueDamageFormula(imbue.damage_formula || '');
    setImbuePercentageDamage(imbue.percentage_damage !== undefined ? String(imbue.percentage_damage) : '');
    setImbueChancePercent(imbue.chance_percent !== undefined ? String(imbue.chance_percent) : '100');
    setImbueDurationType(imbue.duration_type || 'hits');
    setImbueCharges(imbue.charges !== undefined ? String(imbue.charges) : '3');
    setImbueCondition(imbue.condition || '');
    setImbueCombineBehavior(imbue.combine_behavior || 'replace');

    setShowItemModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);

    try {
      const properties: Record<string, any> = {};

      if (category === 'arma') {
        if (weaponDano.trim()) properties.dano = weaponDano.trim();
        if (weaponTipoDano.trim()) properties.tipo_dano = weaponTipoDano.trim();
        if (weaponAtaque.trim()) properties.attack_formula = weaponAtaque.trim();
        if (weaponAlcance.trim()) properties.alcance = weaponAlcance.trim();
        if (weaponMunicaoTipo.trim()) properties.municao_tipo = weaponMunicaoTipo.trim();
        if (weaponCapacidadeMunicao.trim()) properties.capacidade_municao = parseInt(weaponCapacidadeMunicao, 10);
        if (weaponEspecial.trim()) properties.propriedades_especiais = weaponEspecial.trim();
        if (weaponComponents.length > 0) {
          properties.damage_components = weaponComponents;
        }
      } else if (category === 'armadura') {
        properties.defesa_bonus = parseFloat(armorDefesaBonus) || 0;
        properties.reducao_dano = parseFloat(armorReducaoDano) || 0;
        properties.penalidade = parseFloat(armorPenalidade) || 0;
        if (armorRequisitos.trim()) properties.requisitos = armorRequisitos.trim();
      } else if (category === 'tecnologico' || category === 'tecnologia') {
        properties.bateria_max = parseInt(techBateriaMax, 10) || 10;
        properties.consumo_por_uso = parseInt(techConsumo, 10) || 1;
        if (techEfeito.trim()) properties.efeito = techEfeito.trim();
      } else if (category === 'ocultista' || category === 'ocultismo') {
        properties.pontos_alma_max = parseInt(occultAlmaMax, 10) || 5;
        properties.custo_ativacao = parseInt(occultCusto, 10) || 1;
        if (occultEfeito.trim()) properties.efeito = occultEfeito.trim();
      } else if (category === 'consumivel') {
        properties.cargas_max = parseInt(consumivelCargas, 10) || 1;
        if (consumivelAtributo.trim()) properties.recuperacao_atributo = consumivelAtributo.trim();
        if (consumivelFormula.trim()) properties.recuperacao_formula = consumivelFormula.trim();
        if (consumivelDuracao.trim()) properties.duracao = consumivelDuracao.trim();
        if (consumivelEfeito.trim()) properties.efeito = consumivelEfeito.trim();
        if (consumivelCondition.trim()) properties.condition = consumivelCondition.trim();

        if (consumivelCanImbue) {
          properties.can_imbue = true;
          properties.imbue_properties = {
            damage_type: imbueDamageType || 'veneno',
            damage_formula: imbueDamageFormula.trim() || undefined,
            percentage_damage: imbuePercentageDamage.trim() ? parseFloat(imbuePercentageDamage) : undefined,
            chance_percent: imbueChancePercent.trim() ? Math.min(100, Math.max(1, parseInt(imbueChancePercent, 10))) : 100,
            duration_type: imbueDurationType,
            charges: Math.max(1, parseInt(imbueCharges, 10) || 1),
            condition: imbueCondition.trim() || undefined,
            combine_behavior: imbueCombineBehavior
          };
        }
      }

      const payload = {
        name: name.trim(),
        description: description.trim(),
        category,
        weight: parseFloat(weight) || 0,
        cost: parseFloat(cost) || 0,
        acquisition_mode: acquisitionMode,
        stock_quantity: acquisitionMode === 'limited' ? (parseInt(stockQuantity, 10) || 0) : null,
        properties
      };

      if (editingItem) {
        await api.updateCatalogItem(campaign.id, editingItem.id, payload);
        setSuccess('Item atualizado com sucesso no catálogo!');
      } else {
        await api.createCatalogItem(campaign.id, payload);
        setSuccess('Novo item cadastrado no catálogo!');
      }

      setShowItemModal(false);
      loadCatalog();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar item');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Deseja excluir este item do catálogo da campanha?')) return;
    try {
      await api.deleteCatalogItem(campaign.id, itemId);
      loadCatalog();
    } catch (err: any) {
      alert(`Erro ao excluir: ${err.message}`);
    }
  };

  const openGrantModal = (item: CatalogItem) => {
    const userChars = isMaster ? characters : characters.filter(c => c.user_id === user?.id);
    if (!isMaster && userChars.length === 0) {
      alert('Você precisa criar um personagem nesta campanha antes de obter itens.');
      return;
    }

    setItemToGrant(item);
    setGrantQuantity(1);
    if (selectedCharacter && userChars.some(c => c.id === selectedCharacter.id)) {
      setGrantCharId(selectedCharacter.id);
    } else if (userChars.length > 0) {
      setGrantCharId(userChars[0].id);
    } else {
      setGrantCharId('');
    }
    setShowGrantModal(true);
  };

  const handleExecuteGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemToGrant || !grantCharId) return;

    try {
      await api.addItemToCharacter(campaign.id, grantCharId, {
        itemId: itemToGrant.id,
        quantity: grantQuantity
      });

      setShowGrantModal(false);
      setItemToGrant(null);
      setSuccess(`Concedido ${grantQuantity}x ${itemToGrant.name} ao personagem com sucesso!`);
      loadCatalog();
      onRefreshCampaign?.();
      setTimeout(() => setSuccess(null), 3500);
    } catch (err: any) {
      setError(err.message || 'Erro ao conceder item');
    }
  };

  const openRequestModal = (item: CatalogItem) => {
    const userChars = isMaster ? characters : characters.filter(c => c.user_id === user?.id);
    if (!isMaster && userChars.length === 0) {
      alert('Você precisa criar um personagem nesta campanha antes de solicitar itens.');
      return;
    }

    setItemToRequest(item);
    setRequestQuantity(1);
    setRequestNotes('');
    if (selectedCharacter && userChars.some(c => c.id === selectedCharacter.id)) {
      setRequestCharId(selectedCharacter.id);
    } else if (userChars.length > 0) {
      setRequestCharId(userChars[0].id);
    } else {
      setRequestCharId('');
    }
    setShowRequestModal(true);
  };

  const handleExecuteRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemToRequest || !requestCharId) return;

    try {
      await api.createItemRequest(campaign.id, {
        characterId: requestCharId,
        itemId: itemToRequest.id,
        quantity: requestQuantity,
        notes: requestNotes
      });

      setShowRequestModal(false);
      setItemToRequest(null);
      setSuccess(`Solicitação de ${requestQuantity}x ${itemToRequest.name} enviada ao mestre com sucesso!`);
      loadItemRequests();
      onRefreshCampaign?.();
      setTimeout(() => setSuccess(null), 3500);
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar solicitação');
    }
  };

  const handleReviewRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    try {
      await api.reviewItemRequest(campaign.id, requestId, { status });
      setSuccess(status === 'approved' ? 'Solicitação aprovada e item concedido!' : 'Solicitação rejeitada.');
      loadItemRequests();
      loadCatalog();
      onRefreshCampaign?.();
      setTimeout(() => setSuccess(null), 3500);
    } catch (err: any) {
      setError(err.message || 'Erro ao processar solicitação');
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedbacks de Alerta */}
      {success && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-sm rounded-xl flex items-center space-x-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-sm rounded-xl flex items-center space-x-2">
          <X className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Header do Catálogo */}
      <div className="bg-[#1a1816] border border-[#2c2825] rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all">
        <div>
          <div className="flex items-center space-x-2 text-xs text-[#c9a04e] font-semibold mb-1">
            <Sparkles className="w-4 h-4 text-[#c9a04e]" />
            <span>Biblioteca de Equipamento & Regras de Obtenção</span>
          </div>
          <h2 className="text-xl font-bold text-white">Catálogo de Itens da Campanha</h2>
          <p className="text-xs text-[#aaa292] mt-0.5">
            Itens oficiais configurados pelo mestre com atributos mecânicos, fórmulas de dano e controle de estoque.
          </p>
        </div>

        {isMaster && (
          <button
            onClick={openCreateModal}
            className="flex items-center space-x-2 px-4 py-2.5 bg-[#c9a04e] hover:bg-[#c9a04e]/90 text-[#131211] font-bold rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Item no Catálogo</span>
          </button>
        )}
      </div>

      {/* Seção de Solicitações de Itens (se houver solicitações pendentes ou ativas) */}
      {itemRequests.length > 0 && (
        <div className="bg-[#1a1816] border border-[#2c2825] rounded-2xl p-5 shadow-xl transition-all">
          <div className="flex items-center space-x-2 mb-3">
            <Clock className="w-4 h-4 text-[#c9a04e]" />
            <h3 className="font-bold text-sm text-[#ece3d0]">
              {isMaster ? 'Solicitações de Itens Pendentes (Aprovação do Mestre)' : 'Minhas Solicitações de Itens'}
            </h3>
            <span className="text-xs bg-slate-800/80 text-[#aaa292] px-2 py-0.5 rounded-full font-mono border border-[#574e45]/60">
              {itemRequests.filter(r => r.status === 'pending').length} pendente(s)
            </span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {itemRequests.map((req) => (
              <div 
                key={req.id} 
                className="p-3 bg-slate-950/80 rounded-xl border border-[#2c2825] flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white">{req.character_name}</span>
                    <span className="text-[#777064]">solicitou</span>
                    <span className="font-semibold text-[#c9a04e]">{req.quantity}x {req.item_name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                      req.status === 'pending' ? 'bg-amber-950/60 text-[#c9a04e] border border-amber-800' :
                      req.status === 'approved' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800' :
                      'bg-rose-950/60 text-[#b24a52] border border-rose-800'
                    }`}>
                      {req.status === 'pending' ? 'Pendente' : req.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                    </span>
                  </div>
                  {req.notes && <p className="text-[#aaa292] text-[11px] mt-0.5 italic">"{req.notes}"</p>}
                </div>

                {isMaster && req.status === 'pending' && (
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => handleReviewRequest(req.id, 'approved')}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Aprovar</span>
                    </button>
                    <button
                      onClick={() => handleReviewRequest(req.id, 'rejected')}
                      className="px-2.5 py-1 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg text-xs font-semibold flex items-center space-x-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Recusar</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Barra de Filtros e Busca */}
      <div className="bg-[#1a1816] border border-[#2c2825] rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-center gap-3 transition-all">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#777064]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou descrição..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-[#574e45]/80 rounded-xl text-white text-xs focus:outline-none focus:border-[#c9a04e] transition-all duration-200"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-3.5 h-3.5 text-[#777064] hidden sm:block" />
          {['todos', 'arma', 'armadura', 'consumivel', 'ocultismo', 'tecnologia', 'geral'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-950/80 text-[#aaa292] hover:text-white border border-[#2c2825]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Itens do Catálogo */}
      {loading ? (
        <div className="text-center py-16 bg-[#1a1816] border border-[#2c2825] rounded-2xl text-[#777064] text-sm">
          Carregando catálogo de itens...
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-[#1a1816] border border-[#2c2825] rounded-2xl text-[#777064] text-sm">
          <Package className="w-12 h-12 text-[#574e45] mx-auto mb-2 opacity-50" />
          Nenhum item encontrado no catálogo desta campanha com os filtros selecionados.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it) => {
            const props = it.properties || {};
            const isStockDepleted = it.acquisition_mode === 'limited' && (it.stock_quantity ?? 0) <= 0;

            return (
              <div
                key={it.id}
                className="bg-[#1a1816] border border-[#2c2825] hover:border-indigo-500/50 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all duration-200 hover:scale-[1.01] group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-white text-base group-hover:text-[#c9a04e] transition-colors">
                      {it.name}
                    </h3>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">
                        {it.category}
                      </span>
                      {it.acquisition_mode === 'approval' && (
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60">
                          Requer Aprovação
                        </span>
                      )}
                      {it.acquisition_mode === 'limited' && (
                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded ${
                          isStockDepleted
                            ? 'bg-rose-950/60 text-rose-300 border border-rose-800'
                            : 'bg-cyan-950/60 text-cyan-300 border border-cyan-800'
                        }`}>
                          {isStockDepleted ? 'Esgotado' : `Estoque: ${it.stock_quantity} un.`}
                        </span>
                      )}
                      {it.acquisition_mode === 'free' && (
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                          Obtenção Livre
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-[#aaa292] line-clamp-3 mb-3">
                    {it.description || 'Nenhuma descrição detalhada.'}
                  </p>

                  {/* Badges de Atributos Mecânicos */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {it.category === 'arma' && props.dano && (
                      <span className="text-[11px] bg-[#131211] border border-[#2c2825] px-2 py-0.5 rounded-md text-rose-300 flex items-center space-x-1 font-mono">
                        <Swords className="w-3 h-3 text-[#b24a52]" />
                        <span>{props.dano} ({props.tipo_dano || 'dano'})</span>
                      </span>
                    )}
                    {it.category === 'arma' && Array.isArray(props.damage_components) && props.damage_components.map((comp: any, idx: number) => (
                      <span key={idx} className="text-[11px] bg-slate-950 border border-amber-900/50 px-2 py-0.5 rounded-md text-amber-300 flex items-center space-x-1 font-mono">
                        <Sparkles className="w-3 h-3 text-[#c9a04e]" />
                        <span>+{comp.formula || `${comp.percentage_damage}%`} {comp.damage_type}{comp.chance_percent && comp.chance_percent < 100 ? ` (${comp.chance_percent}%)` : ''}</span>
                      </span>
                    ))}
                    {it.category === 'armadura' && props.defesa_bonus !== undefined && (
                      <span className="text-[11px] bg-[#131211] border border-[#2c2825] px-2 py-0.5 rounded-md text-sky-300 flex items-center space-x-1 font-mono">
                        <Shield className="w-3 h-3 text-sky-400" />
                        <span>Defesa +{props.defesa_bonus} {props.reducao_dano ? `(RD ${props.reducao_dano})` : ''}</span>
                      </span>
                    )}
                    {(it.category === 'tecnologia' || it.category === 'tecnologico') && props.bateria_max && (
                      <span className="text-[11px] bg-[#131211] border border-[#2c2825] px-2 py-0.5 rounded-md text-cyan-300 flex items-center space-x-1 font-mono">
                        <Zap className="w-3 h-3 text-cyan-400" />
                        <span>Bateria {props.bateria_max}</span>
                      </span>
                    )}
                    {(it.category === 'ocultismo' || it.category === 'ocultista') && props.pontos_alma_max && (
                      <span className="text-[11px] bg-[#131211] border border-[#2c2825] px-2 py-0.5 rounded-md text-purple-300 flex items-center space-x-1 font-mono">
                        <Flame className="w-3 h-3 text-purple-400" />
                        <span>Alma {props.pontos_alma_max}</span>
                      </span>
                    )}
                    {it.category === 'consumivel' && props.recuperacao_formula && (
                      <span className="text-[11px] bg-[#131211] border border-[#2c2825] px-2 py-0.5 rounded-md text-emerald-300 flex items-center space-x-1 font-mono">
                        <HeartPulse className="w-3 h-3 text-emerald-400" />
                        <span>+{props.recuperacao_formula} em {props.recuperacao_atributo}</span>
                      </span>
                    )}
                    {Boolean(props.can_imbue || props.imbue_properties) && (
                      <span className="text-[11px] bg-indigo-950/80 border border-indigo-700/60 px-2 py-0.5 rounded-md text-indigo-300 flex items-center space-x-1 font-mono">
                        <Wand2 className="w-3 h-3 text-[#c9a04e]" />
                        <span>Imbuição: {props.imbue_properties?.damage_type || 'elemental'} ({props.imbue_properties?.charges || 1} {props.imbue_properties?.duration_type || 'cargas'})</span>
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-[#aaa292] py-2.5 border-t border-[#2c2825] mb-3">
                    <span>Peso: <strong className="text-[#ece3d0]">{it.weight} kg</strong></span>
                    <span>Preço: <strong className="text-[#c9a04e] font-mono">${it.cost}</strong></span>
                  </div>

                  <div className="flex items-center justify-between pt-1 gap-2">
                    {isMaster ? (
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => openEditModal(it)}
                          className="p-1.5 text-[#aaa292] hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                          title="Editar item"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(it.id)}
                          className="p-1.5 text-[#aaa292] hover:text-[#b24a52] hover:bg-rose-950/30 rounded-lg transition-colors"
                          title="Excluir item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : <div />}

                    <div className="flex items-center space-x-2">
                      {/* Botão de Conceder Direto para Mestres */}
                      {isMaster && characters.length > 0 && (
                        <button
                          onClick={() => openGrantModal(it)}
                          disabled={Boolean(isStockDepleted)}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition-all shadow-sm"
                        >
                          <Gift className="w-3.5 h-3.5" />
                          <span>Conceder</span>
                        </button>
                      )}

                      {/* Botão de Solicitar ou Pegar para Jogadores */}
                      {!isMaster && characters.length > 0 && (
                        it.acquisition_mode === 'approval' ? (
                          <button
                            onClick={() => openRequestModal(it)}
                            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-600/80 hover:bg-amber-600 text-white text-xs font-semibold transition-all shadow-sm"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Solicitar</span>
                          </button>
                        ) : isStockDepleted ? (
                          <button
                            disabled
                            className="px-3 py-1.5 rounded-xl bg-slate-800 text-[#777064] text-xs font-semibold cursor-not-allowed"
                          >
                            Esgotado
                          </button>
                        ) : (
                          <button
                            onClick={() => openGrantModal(it)}
                            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#c9a04e] hover:bg-[#c9a04e]/90 text-[#131211] font-bold text-xs font-semibold transition-all shadow-sm"
                          >
                            <Package className="w-3.5 h-3.5" />
                            <span>Pegar Item</span>
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CRIAR/EDITAR ITEM */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl bg-[#1a1816] border border-[#2c2825] rounded-3xl p-6 sm:p-8 shadow-2xl relative my-8">
            <h2 className="text-xl font-bold text-white mb-1">
              {editingItem ? 'Editar Item do Catálogo' : 'Novo Item no Catálogo'}
            </h2>
            <p className="text-xs text-[#aaa292] mb-6">
              Configure os atributos básicos, mecânicas automatizadas e regras de estoque do item.
            </p>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#ece3d0] uppercase tracking-wider mb-1.5">
                    Nome do Item
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Fuzil de Assalto HK416, Poção de Sanidade..."
                    className="w-full px-4 py-2 bg-slate-950 border border-[#574e45] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#c9a04e] text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#ece3d0] uppercase tracking-wider mb-1.5">
                    Categoria do Item
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-950 border border-[#574e45] rounded-xl text-white text-sm focus:outline-none focus:border-[#c9a04e]"
                  >
                    <option value="geral">Geral / Equipamento</option>
                    <option value="arma">Arma (Combate)</option>
                    <option value="armadura">Armadura / Proteção</option>
                    <option value="consumivel">Consumível / Poção</option>
                    <option value="ocultismo">Item Ocultista (Alma/Energia)</option>
                    <option value="tecnologia">Tecnológico (Bateria/Cargas)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#ece3d0] uppercase tracking-wider mb-1.5">
                  Descrição e Lore
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="História, detalhes e observações narrativas..."
                  className="w-full px-4 py-2 bg-slate-950 border border-[#574e45] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#c9a04e] text-xs resize-none"
                />
              </div>

              {/* Parâmetros Básicos e Regra de Obtenção */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-950/80 rounded-xl border border-[#2c2825]">
                <div>
                  <label className="block text-[11px] text-[#aaa292] mb-1">Peso (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#aaa292] mb-1">Preço ($)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#aaa292] mb-1">Regra de Obtenção</label>
                  <select
                    value={acquisitionMode}
                    onChange={(e) => setAcquisitionMode(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white text-xs"
                  >
                    <option value="free">Livre (Qualquer um)</option>
                    <option value="limited">Estoque Limitado</option>
                    <option value="approval">Requer Aprovação</option>
                  </select>
                </div>

                {acquisitionMode === 'limited' && (
                  <div>
                    <label className="block text-[11px] text-cyan-400 mb-1">Estoque Disponível</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      required
                      value={stockQuantity}
                      onChange={(e) => setStockQuantity(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-cyan-800 rounded-lg text-white font-mono text-xs"
                    />
                  </div>
                )}
              </div>

              {/* PROPRIEDADES MECÂNICAS DA CATEGORIA */}
              {category === 'arma' && (
                <div className="p-4 bg-slate-950/90 rounded-xl border border-rose-950/60 space-y-4">
                  <div className="flex items-center space-x-2 text-[#b24a52] text-xs font-bold">
                    <Swords className="w-4 h-4" />
                    <span>Propriedades de Arma & Dano</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] text-[#aaa292] mb-1">Dano Principal (ex: 1d8, 2d6+2)</label>
                      <input
                        type="text"
                        value={weaponDano}
                        onChange={(e) => setWeaponDano(e.target.value)}
                        placeholder="1d8"
                        className="w-full px-3 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#aaa292] mb-1">Tipo de Dano Principal</label>
                      {damageTypes.length > 0 ? (
                        <select
                          value={weaponTipoDano}
                          onChange={(e) => setWeaponTipoDano(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white text-xs"
                        >
                          {damageTypes.map((dt) => (
                            <option key={dt.id} value={dt.id}>
                              {dt.name} ({dt.category})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={weaponTipoDano}
                          onChange={(e) => setWeaponTipoDano(e.target.value)}
                          placeholder="fisico, corte..."
                          className="w-full px-3 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white text-xs"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#aaa292] mb-1">Fórmula de Ataque (Opcional)</label>
                      <input
                        type="text"
                        value={weaponAtaque}
                        onChange={(e) => setWeaponAtaque(e.target.value)}
                        placeholder="Ex: 1d20 + Agilidade"
                        className="w-full px-3 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#aaa292] mb-1">Alcance</label>
                      <input
                        type="text"
                        value={weaponAlcance}
                        onChange={(e) => setWeaponAlcance(e.target.value)}
                        placeholder="Corpo a corpo, 9m..."
                        className="w-full px-3 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#aaa292] mb-1">Capacidade Munição</label>
                      <input
                        type="number"
                        min="0"
                        value={weaponCapacidadeMunicao}
                        onChange={(e) => setWeaponCapacidadeMunicao(e.target.value)}
                        placeholder="Ex: 30"
                        className="w-full px-3 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#aaa292] mb-1">Tipo de Munição</label>
                      <input
                        type="text"
                        value={weaponMunicaoTipo}
                        onChange={(e) => setWeaponMunicaoTipo(e.target.value)}
                        placeholder="9mm, Flechas..."
                        className="w-full px-3 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white text-xs"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-3">
                      <label className="block text-[10px] text-[#aaa292] mb-1">Propriedades Especiais</label>
                      <input
                        type="text"
                        value={weaponEspecial}
                        onChange={(e) => setWeaponEspecial(e.target.value)}
                        placeholder="Ágil, Duas mãos, Crítico Aumentado..."
                        className="w-full px-3 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white text-xs"
                      />
                    </div>
                  </div>

                  {/* Componentes Adicionais de Dano / Elementais */}
                  <div className="pt-3 border-t border-[#2c2825] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-amber-300 flex items-center space-x-1">
                        <Sparkles className="w-3.5 h-3.5 text-[#c9a04e]" />
                        <span>Danos Elementais Adicionais (Ex: +1d6 Fogo, 5% Elétrico)</span>
                      </span>
                    </div>

                    {weaponComponents.length > 0 && (
                      <div className="space-y-1.5">
                        {weaponComponents.map((comp, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-slate-900 rounded-lg border border-[#2c2825] text-xs">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-amber-300 font-bold">
                                {comp.formula ? `+${comp.formula}` : `+${comp.percentage_damage}% vida máx`}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-[#ece3d0] uppercase font-mono">
                                {comp.damage_type}
                              </span>
                              {comp.chance_percent && comp.chance_percent < 100 && (
                                <span className="text-[10px] text-cyan-400">
                                  ({comp.chance_percent}% chance)
                                </span>
                              )}
                              {comp.condition && (
                                <span className="text-[10px] text-[#b24a52]">
                                  aplica [{comp.condition}]
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveComponent(idx)}
                              className="p-1 text-[#777064] hover:text-[#b24a52] rounded"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Formulário para Adicionar Componente */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-2.5 bg-slate-900/60 rounded-lg border border-[#2c2825] text-xs">
                      <div>
                        <label className="block text-[9px] text-[#aaa292] mb-0.5">Tipo Elemental</label>
                        <select
                          value={newCompType}
                          onChange={(e) => setNewCompType(e.target.value)}
                          className="w-full px-2 py-1 bg-slate-950 border border-[#574e45] rounded text-white text-xs"
                        >
                          {(damageTypes.length > 0 ? damageTypes : [
                            { id: 'fogo', name: 'Fogo' },
                            { id: 'gelo', name: 'Gelo' },
                            { id: 'eletrico', name: 'Elétrico' },
                            { id: 'veneno', name: 'Veneno' },
                            { id: 'acido', name: 'Ácido' },
                            { id: 'energia', name: 'Energia' },
                            { id: 'oculto', name: 'Oculto' }
                          ]).map((dt) => (
                            <option key={dt.id} value={dt.id}>{dt.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] text-[#aaa292] mb-0.5">Fórmula (ex: 1d6)</label>
                        <input
                          type="text"
                          value={newCompFormula}
                          onChange={(e) => setNewCompFormula(e.target.value)}
                          placeholder="1d6"
                          className="w-full px-2 py-1 bg-slate-950 border border-[#574e45] rounded text-white font-mono text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] text-[#aaa292] mb-0.5">Ou % Dano (ex: 5%)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          value={newCompPercent}
                          onChange={(e) => setNewCompPercent(e.target.value)}
                          placeholder="%"
                          className="w-full px-2 py-1 bg-slate-950 border border-[#574e45] rounded text-white font-mono text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] text-[#aaa292] mb-0.5">Chance Ativação %</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={newCompChance}
                          onChange={(e) => setNewCompChance(e.target.value)}
                          className="w-full px-2 py-1 bg-slate-950 border border-[#574e45] rounded text-white font-mono text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] text-[#aaa292] mb-0.5">Condição (Opcional)</label>
                        <div className="flex space-x-1">
                          <select
                            value={newCompCondition}
                            onChange={(e) => setNewCompCondition(e.target.value)}
                            className="w-full px-1.5 py-1 bg-slate-950 border border-[#574e45] rounded text-white text-xs"
                          >
                            <option value="">Nenhuma</option>
                            {conditionsList.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={handleAddComponent}
                            className="px-2 py-1 bg-[#c9a04e] hover:bg-[#c9a04e]/90 text-[#131211] font-bold rounded font-bold text-xs shrink-0"
                            title="Adicionar componente"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {category === 'armadura' && (
                <div className="p-4 bg-slate-950/90 rounded-xl border border-sky-950/60 space-y-3">
                  <div className="flex items-center space-x-2 text-sky-400 text-xs font-bold">
                    <Shield className="w-4 h-4" />
                    <span>Propriedades de Armadura / Proteção</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] text-[#aaa292] mb-1">Bônus de Defesa (+)</label>
                      <input
                        type="number"
                        value={armorDefesaBonus}
                        onChange={(e) => setArmorDefesaBonus(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#aaa292] mb-1">Redução de Dano (RD)</label>
                      <input
                        type="number"
                        value={armorReducaoDano}
                        onChange={(e) => setArmorReducaoDano(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#aaa292] mb-1">Penalidade de Armadura</label>
                      <input
                        type="number"
                        value={armorPenalidade}
                        onChange={(e) => setArmorPenalidade(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#aaa292] mb-1">Requisitos de Uso</label>
                      <input
                        type="text"
                        value={armorRequisitos}
                        onChange={(e) => setArmorRequisitos(e.target.value)}
                        placeholder="Ex: Força 3"
                        className="w-full px-3 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {(category === 'tecnologia' || category === 'tecnologico') && (
                <div className="p-4 bg-slate-950/90 rounded-xl border border-cyan-950/60 space-y-3">
                  <div className="flex items-center space-x-2 text-cyan-400 text-xs font-bold">
                    <Zap className="w-4 h-4" />
                    <span>Propriedades Tecnológicas (Bateria)</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] text-[#aaa292] mb-1">Bateria Máxima</label>
                      <input
                        type="number"
                        min="1"
                        value={techBateriaMax}
                        onChange={(e) => setTechBateriaMax(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#aaa292] mb-1">Consumo por Uso</label>
                      <input
                        type="number"
                        min="1"
                        value={techConsumo}
                        onChange={(e) => setTechConsumo(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white font-mono text-xs"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[10px] text-[#aaa292] mb-1">Efeito ao Ativar</label>
                      <input
                        type="text"
                        value={techEfeito}
                        onChange={(e) => setTechEfeito(e.target.value)}
                        placeholder="Visão térmica por 1 cena..."
                        className="w-full px-3 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {(category === 'ocultismo' || category === 'ocultista') && (
                <div className="p-4 bg-slate-950/90 rounded-xl border border-purple-950/60 space-y-3">
                  <div className="flex items-center space-x-2 text-purple-400 text-xs font-bold">
                    <Flame className="w-4 h-4" />
                    <span>Propriedades Ocultistas (Pontos de Alma)</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] text-[#aaa292] mb-1">Pontos de Alma Máx.</label>
                      <input
                        type="number"
                        min="1"
                        value={occultAlmaMax}
                        onChange={(e) => setOccultAlmaMax(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#aaa292] mb-1">Custo de Ativação</label>
                      <input
                        type="number"
                        min="1"
                        value={occultCusto}
                        onChange={(e) => setOccultCusto(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white font-mono text-xs"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[10px] text-[#aaa292] mb-1">Efeito Ocultista</label>
                      <input
                        type="text"
                        value={occultEfeito}
                        onChange={(e) => setOccultEfeito(e.target.value)}
                        placeholder="Aura de proteção sobrenatural..."
                        className="w-full px-3 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {category === 'consumivel' && (
                <div className="p-4 bg-slate-950/90 rounded-xl border border-emerald-950/60 space-y-4">
                  <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold">
                    <HeartPulse className="w-4 h-4" />
                    <span>Propriedades de Consumível (Cargas & Recuperação Automática)</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] text-[#aaa292] mb-1">Número de Doses/Cargas</label>
                      <input
                        type="number"
                        min="1"
                        value={consumivelCargas}
                        onChange={(e) => setConsumivelCargas(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#aaa292] mb-1">Atributo Recuperado</label>
                      <input
                        type="text"
                        value={consumivelAtributo}
                        onChange={(e) => setConsumivelAtributo(e.target.value)}
                        placeholder="vida_atual, sanidade_atual..."
                        className="w-full px-3 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#aaa292] mb-1">Fórmula (ex: 2d8 + 2)</label>
                      <input
                        type="text"
                        value={consumivelFormula}
                        onChange={(e) => setConsumivelFormula(e.target.value)}
                        placeholder="2d8 + 2"
                        className="w-full px-3 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white font-mono text-xs"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-2">
                      <label className="block text-[10px] text-[#aaa292] mb-1">Efeito / Descrição do Uso</label>
                      <input
                        type="text"
                        value={consumivelEfeito}
                        onChange={(e) => setConsumivelEfeito(e.target.value)}
                        placeholder="Restaura pontos vitais imediatamente ao ingerir..."
                        className="w-full px-3 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white text-xs"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[10px] text-[#aaa292] mb-1">Condição Aplicada (Opcional)</label>
                      <select
                        value={consumivelCondition}
                        onChange={(e) => setConsumivelCondition(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white text-xs"
                      >
                        <option value="">Nenhuma</option>
                        {conditionsList.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Seção de Imbuição de Armas */}
                  <div className="pt-3 border-t border-[#2c2825] space-y-3">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={consumivelCanImbue}
                        onChange={(e) => setConsumivelCanImbue(e.target.checked)}
                        className="w-4 h-4 rounded border-[#574e45] bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs font-semibold text-indigo-300 flex items-center space-x-1.5">
                        <Wand2 className="w-4 h-4 text-[#c9a04e]" />
                        <span>Permite Imbuir em Armas (Óleo, Veneno, Reagente Elemental, Encantamento)</span>
                      </span>
                    </label>

                    {consumivelCanImbue && (
                      <div className="p-3 bg-indigo-950/30 rounded-xl border border-indigo-900/40 space-y-3">
                        <p className="text-[11px] text-[#aaa292]">
                          Ao ser usado em uma arma, concede bônus elementais e consome cargas a cada ataque ou acerto.
                        </p>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[10px] text-[#aaa292] mb-1">Tipo de Dano Imbuído</label>
                            <select
                              value={imbueDamageType}
                              onChange={(e) => setImbueDamageType(e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white text-xs"
                            >
                              {(damageTypes.length > 0 ? damageTypes : [
                                { id: 'veneno', name: 'Veneno' },
                                { id: 'fogo', name: 'Fogo' },
                                { id: 'gelo', name: 'Gelo' },
                                { id: 'eletrico', name: 'Elétrico' },
                                { id: 'acido', name: 'Ácido' },
                                { id: 'energia', name: 'Energia' },
                                { id: 'oculto', name: 'Oculto' }
                              ]).map((dt) => (
                                <option key={dt.id} value={dt.id}>{dt.name} ({dt.category})</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] text-[#aaa292] mb-1">Fórmula de Dano Adicional</label>
                            <input
                              type="text"
                              value={imbueDamageFormula}
                              onChange={(e) => setImbueDamageFormula(e.target.value)}
                              placeholder="Ex: 1d6, 2d4"
                              className="w-full px-2.5 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white font-mono text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-[#aaa292] mb-1">Ou % da Vida Máx. Alvo</label>
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max="100"
                              value={imbuePercentageDamage}
                              onChange={(e) => setImbuePercentageDamage(e.target.value)}
                              placeholder="Ex: 5 (% do HP máx)"
                              className="w-full px-2.5 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white font-mono text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-[#aaa292] mb-1">Chance de Ativação %</label>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={imbueChancePercent}
                              onChange={(e) => setImbueChancePercent(e.target.value)}
                              placeholder="100"
                              className="w-full px-2.5 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white font-mono text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-[#aaa292] mb-1">Tipo de Duração / Consumo</label>
                            <select
                              value={imbueDurationType}
                              onChange={(e) => setImbueDurationType(e.target.value as any)}
                              className="w-full px-2.5 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white text-xs"
                            >
                              <option value="hits">Por Acertos com Sucesso (Hits)</option>
                              <option value="attacks">Por Tentativas de Ataque</option>
                              <option value="turns">Por Turnos de Combate</option>
                              <option value="rounds">Por Rodadas Completas</option>
                              <option value="permanent">Permanente (Sem Expiração)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] text-[#aaa292] mb-1">Quantidade de Cargas / Doses</label>
                            <input
                              type="number"
                              min="1"
                              value={imbueCharges}
                              onChange={(e) => setImbueCharges(e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white font-mono text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-[#aaa292] mb-1">Condição Aplicada (Opcional)</label>
                            <select
                              value={imbueCondition}
                              onChange={(e) => setImbueCondition(e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white text-xs"
                            >
                              <option value="">Nenhuma Condição</option>
                              {conditionsList.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="col-span-2">
                            <label className="block text-[10px] text-[#aaa292] mb-1">Comportamento se a Arma já estiver Imbuída</label>
                            <select
                              value={imbueCombineBehavior}
                              onChange={(e) => setImbueCombineBehavior(e.target.value as any)}
                              className="w-full px-2.5 py-1.5 bg-slate-900 border border-[#574e45] rounded-lg text-white text-xs"
                            >
                              <option value="replace">Substituir Efeito Anterior (Padrão)</option>
                              <option value="stack">Acumular Cargas (se mesmo elemento)</option>
                              <option value="reject">Bloquear Aplicação se já imbuída</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[#2c2825]">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#574e45] text-[#ece3d0] hover:bg-slate-800 text-sm font-medium transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#c9a04e] hover:bg-[#c9a04e]/90 text-[#131211] font-bold text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all"
                >
                  Salvar no Catálogo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONCEDER ITEM A PERSONAGEM (MESTRE OU OBTENÇÃO LIVRE) */}
      {showGrantModal && itemToGrant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#1a1816] border border-[#2c2825] rounded-3xl p-8 shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-1">
              {isMaster ? 'Conceder Item ao Personagem' : 'Pegar Item do Catálogo'}
            </h2>
            <p className="text-xs text-[#aaa292] mb-6">
              Adiciona o item diretamente à mochila do personagem.
            </p>

            <form onSubmit={handleExecuteGrant} className="space-y-4">
              <div className="p-3.5 bg-slate-950 rounded-xl border border-[#2c2825]">
                <span className="text-xs text-[#777064] block">Item Selecionado</span>
                <span className="font-bold text-white text-base">{itemToGrant.name}</span>
                <span className="text-xs text-[#aaa292] block mt-0.5">
                  {itemToGrant.category} • {itemToGrant.weight}kg
                  {itemToGrant.acquisition_mode === 'limited' && ` • Estoque: ${itemToGrant.stock_quantity ?? 0} un.`}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#ece3d0] uppercase tracking-wider mb-1.5">
                  Personagem Destinatário
                </label>
                <select
                  value={grantCharId}
                  onChange={(e) => setGrantCharId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-[#574e45] rounded-xl text-white text-sm focus:outline-none focus:border-[#c9a04e]"
                >
                  {(isMaster ? characters : characters.filter(c => c.user_id === user?.id)).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.owner_username ? `(${c.owner_username})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#ece3d0] uppercase tracking-wider mb-1.5">
                  Quantidade
                </label>
                <input
                  type="number"
                  min="1"
                  max={itemToGrant.acquisition_mode === 'limited' ? (itemToGrant.stock_quantity ?? 1) : undefined}
                  required
                  value={grantQuantity}
                  onChange={(e) => setGrantQuantity(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-4 py-2 bg-slate-950 border border-[#574e45] rounded-xl text-white font-mono text-sm"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[#2c2825]">
                <button
                  type="button"
                  onClick={() => setShowGrantModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#574e45] text-[#ece3d0] hover:bg-slate-800 text-sm font-medium transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#c9a04e] hover:bg-[#c9a04e]/90 text-[#131211] font-bold text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all flex items-center space-x-2"
                >
                  <Gift className="w-4 h-4" />
                  <span>Confirmar e Adicionar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SOLICITAR ITEM AO MESTRE (JOGADOR) */}
      {showRequestModal && itemToRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#1a1816] border border-[#2c2825] rounded-3xl p-8 shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-1">Solicitar Item ao Mestre</h2>
            <p className="text-xs text-[#aaa292] mb-6">
              Este item requer autorização. O mestre receberá sua solicitação para aprovar ou recusar.
            </p>

            <form onSubmit={handleExecuteRequest} className="space-y-4">
              <div className="p-3.5 bg-slate-950 rounded-xl border border-[#2c2825]">
                <span className="text-xs text-[#777064] block">Item Selecionado</span>
                <span className="font-bold text-white text-base">{itemToRequest.name}</span>
                <span className="text-xs text-[#aaa292] block mt-0.5">{itemToRequest.category} • ${itemToRequest.cost}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#ece3d0] uppercase tracking-wider mb-1.5">
                  Seu Personagem
                </label>
                <select
                  value={requestCharId}
                  onChange={(e) => setRequestCharId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-[#574e45] rounded-xl text-white text-sm focus:outline-none focus:border-[#c9a04e]"
                >
                  {(isMaster ? characters : characters.filter(c => c.user_id === user?.id)).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.owner_username ? `(${c.owner_username})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#ece3d0] uppercase tracking-wider mb-1.5">
                  Quantidade Desejada
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={requestQuantity}
                  onChange={(e) => setRequestQuantity(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-4 py-2 bg-slate-950 border border-[#574e45] rounded-xl text-white font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#ece3d0] uppercase tracking-wider mb-1.5">
                  Motivo / Justificativa (Opcional)
                </label>
                <input
                  type="text"
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  placeholder="Ex: Encontrado em investigação no porão..."
                  className="w-full px-4 py-2 bg-slate-950 border border-[#574e45] rounded-xl text-white text-xs"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[#2c2825]">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#574e45] text-[#ece3d0] hover:bg-slate-800 text-sm font-medium transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#c9a04e] hover:bg-[#c9a04e]/90 text-[#131211] font-bold text-sm font-semibold shadow-lg shadow-amber-600/30 transition-all flex items-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Enviar Solicitação</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
