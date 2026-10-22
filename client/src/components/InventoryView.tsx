import React, { useState, useEffect } from 'react';
import { 
  Campaign, Character, InventorySummary, InventoryItem, CatalogItem, 
  InventoryTransferRecord, api, User 
} from '../services/api';
import { 
  Package, ArrowRightLeft, Shield, Plus, Trash2, 
  Check, AlertCircle, History, Scale, Coins, Swords, Zap, Flame, HeartPulse, Crosshair, Wand2, Sparkles
} from 'lucide-react';

interface InventoryViewProps {
  campaign: Campaign;
  user: User;
  characters: Character[];
  selectedCharacter: Character | null;
  refreshTrigger?: number;
  onRefreshCharacter: (updatedChar?: Character) => void;
  onOpenCreateCharacter?: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  campaign,
  user,
  characters,
  selectedCharacter,
  refreshTrigger,
  onRefreshCharacter,
  onOpenCreateCharacter
}) => {
  const [inventory, setInventory] = useState<InventorySummary | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [transfers, setTransfers] = useState<InventoryTransferRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modais
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [itemToTransfer, setItemToTransfer] = useState<InventoryItem | null>(null);

  // Modal de Imbuição de Armas
  const [showImbueModal, setShowImbueModal] = useState(false);
  const [consumableToImbue, setConsumableToImbue] = useState<InventoryItem | null>(null);
  const [selectedWeaponToImbueId, setSelectedWeaponToImbueId] = useState<string>('');

  // Form states - Adicionar Item
  const [addMode, setAddMode] = useState<'catalog' | 'custom'>('catalog');
  const [selectedCatalogItemId, setSelectedCatalogItemId] = useState<string>('');
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState('geral');
  const [customWeight, setCustomWeight] = useState('0');
  const [customCost, setCustomCost] = useState('0');
  const [customQuantity, setCustomQuantity] = useState('1');

  // Form states - Transferência
  const [targetCharId, setTargetCharId] = useState('');
  const [transferQuantity, setTransferQuantity] = useState(1);

  const isMaster = campaign.role === 'owner' || campaign.role === 'master' || campaign.role === 'assistant';
  const isOwnerOfChar = selectedCharacter && selectedCharacter.user_id === user.id;
  const canEdit = isMaster || isOwnerOfChar;

  useEffect(() => {
    if (selectedCharacter) {
      loadInventory();
      loadCatalog();
      loadTransfers();
    }
  }, [selectedCharacter?.id, refreshTrigger]);

  const loadInventory = async () => {
    if (!selectedCharacter) return;
    try {
      setLoading(true);
      const res = await api.getCharacterInventory(campaign.id, selectedCharacter.id);
      setInventory(res);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar inventário');
    } finally {
      setLoading(false);
    }
  };

  const loadCatalog = async () => {
    try {
      const items = await api.getCatalogItems(campaign.id);
      setCatalog(items);
      if (items.length > 0 && !selectedCatalogItemId) {
        setSelectedCatalogItemId(items[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar catálogo:', err);
    }
  };

  const loadTransfers = async () => {
    try {
      const hist = await api.getInventoryTransfers(campaign.id);
      setTransfers(hist);
    } catch (err) {
      console.error('Erro ao carregar histórico de transferências:', err);
    }
  };

  const handleToggleEquip = async (item: InventoryItem) => {
    if (!selectedCharacter || !canEdit) return;
    try {
      const res = await api.updateCharacterInventoryItem(campaign.id, selectedCharacter.id, item.id, {
        isEquipped: !item.is_equipped
      });
      if (res.inventory) setInventory(res.inventory);
      if (res.character) onRefreshCharacter(res.character);
      else onRefreshCharacter();
      loadInventory();
    } catch (err: any) {
      alert(`Erro ao equipar/desequipar: ${err.message}`);
    }
  };

  const handleUpdateQuantity = async (item: InventoryItem, delta: number) => {
    if (!selectedCharacter || !canEdit) return;
    const newQty = item.quantity + delta;
    if (newQty < 0) return;
    try {
      const res = await api.updateCharacterInventoryItem(campaign.id, selectedCharacter.id, item.id, {
        quantity: newQty
      });
      if (res.inventory) setInventory(res.inventory);
      if (res.character) onRefreshCharacter(res.character);
      else onRefreshCharacter();
      loadInventory();
    } catch (err: any) {
      alert(`Erro ao atualizar quantidade: ${err.message}`);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!selectedCharacter || !canEdit) return;
    if (!confirm('Deseja realmente descartar este item do inventário?')) return;
    try {
      const res = await api.removeCharacterInventoryItem(campaign.id, selectedCharacter.id, itemId);
      if (res.inventory) setInventory(res.inventory);
      if (res.character) onRefreshCharacter(res.character);
      else onRefreshCharacter();
      loadInventory();
    } catch (err: any) {
      alert(`Erro ao remover item: ${err.message}`);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCharacter) return;
    setError(null);

    try {
      let res: { item: InventoryItem; inventory?: InventorySummary; character?: Character };
      if (addMode === 'catalog') {
        if (!selectedCatalogItemId) return;
        res = await api.addItemToCharacter(campaign.id, selectedCharacter.id, {
          itemId: selectedCatalogItemId,
          quantity: parseInt(customQuantity, 10) || 1
        });
      } else {
        if (!customName.trim()) return;
        res = await api.addItemToCharacter(campaign.id, selectedCharacter.id, {
          itemName: customName.trim(),
          category: customCategory,
          weight: parseFloat(customWeight) || 0,
          cost: parseFloat(customCost) || 0,
          quantity: parseInt(customQuantity, 10) || 1
        });
      }

      if (res.inventory) setInventory(res.inventory);
      if (res.character) onRefreshCharacter(res.character);
      else onRefreshCharacter();

      setShowAddItemModal(false);
      setCustomName('');
      setCustomQuantity('1');
      loadInventory();
      setSuccessMsg('Item adicionado ao inventário com sucesso!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Erro ao adicionar item');
    }
  };

  const handleUseItem = async (item: InventoryItem) => {
    if (!selectedCharacter || !canEdit) return;
    setError(null);
    try {
      const res = await api.useInventoryItem(campaign.id, selectedCharacter.id, item.id);
      setSuccessMsg(res.message);
      if ((res as any).inventory) setInventory((res as any).inventory);
      if (res.character) onRefreshCharacter(res.character);
      else onRefreshCharacter();
      loadInventory();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Erro ao utilizar item');
    }
  };

  const handleRollWeaponDamage = async (item: InventoryItem) => {
    if (!selectedCharacter) return;
    const formula = item.properties?.dano;
    if (!formula) return;

    try {
      const res = await api.rollDice(campaign.id, {
        expression: formula,
        variables: selectedCharacter.computed_data,
        isSecret: false
      });
      setSuccessMsg(`Dano rolado com ${item.item_name} (${formula}): ${res.total}`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(`Erro ao rolar dano: ${err.message}`);
    }
  };

  const openTransferModal = (item: InventoryItem) => {
    setItemToTransfer(item);
    setTransferQuantity(1);
    const otherChars = characters.filter(c => c.id !== selectedCharacter?.id);
    if (otherChars.length > 0) {
      setTargetCharId(otherChars[0].id);
    } else {
      setTargetCharId('');
    }
    setShowTransferModal(true);
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCharacter || !itemToTransfer || !targetCharId) return;
    setError(null);

    try {
      const res = await api.transferItem(campaign.id, selectedCharacter.id, {
        inventoryItemId: itemToTransfer.id,
        targetCharacterId: targetCharId,
        quantity: transferQuantity
      });

      if (res.inventory) setInventory(res.inventory);
      if (res.character) onRefreshCharacter(res.character);
      else onRefreshCharacter();

      setShowTransferModal(false);
      setItemToTransfer(null);
      loadInventory();
      loadTransfers();

      setSuccessMsg(
        `Transferência de ${res.transferred.quantity}x ${res.transferred.itemName} realizada com sucesso para ${res.transferred.toName}!`
      );
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Falha ao transferir item');
    }
  };

  const openImbueModal = (consumableItem: InventoryItem) => {
    setConsumableToImbue(consumableItem);
    const weapons = inventory?.items.filter(i => i.category === 'arma') || [];
    if (weapons.length > 0) {
      setSelectedWeaponToImbueId(weapons[0].id);
    } else {
      setSelectedWeaponToImbueId('');
    }
    setShowImbueModal(true);
  };

  const handleExecuteImbue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCharacter || !consumableToImbue || !selectedWeaponToImbueId) return;
    setError(null);

    try {
      const res = await api.imbueWeapon(campaign.id, selectedCharacter.id, {
        consumableInventoryId: consumableToImbue.id,
        weaponInventoryId: selectedWeaponToImbueId
      });

      setShowImbueModal(false);
      setConsumableToImbue(null);
      if (res.inventory) setInventory(res.inventory);
      if (res.character) onRefreshCharacter(res.character);
      else onRefreshCharacter();
      loadInventory();

      setSuccessMsg(res.message || 'Arma imbuída com sucesso!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Falha ao imbuir arma');
    }
  };

  if (!selectedCharacter) {
    const userChars = isMaster ? characters : characters.filter(c => c.user_id === user.id);
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-4">
        <Package className="w-12 h-12 text-slate-600 mx-auto" />
        <h3 className="text-lg font-bold text-white">Nenhum Personagem Selecionado</h3>
        <p className="text-sm max-w-md mx-auto text-slate-400">
          {userChars.length === 0
            ? 'Você ainda não possui um personagem nesta campanha para gerenciar o inventário.'
            : 'Selecione seu personagem na aba "Fichas & Personagens" para gerenciar o inventário.'}
        </p>
        {userChars.length === 0 && onOpenCreateCharacter && (
          <button
            onClick={onOpenCreateCharacter}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all inline-flex items-center space-x-2 shadow-lg shadow-indigo-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Meu Personagem</span>
          </button>
        )}
      </div>
    );
  }

  const otherCharacters = characters.filter(c => c.id !== selectedCharacter.id);

  if (loading && !inventory) {
    return <div className="text-slate-400 text-center py-12">Carregando inventário...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Feedback de Alertas */}
      {successMsg && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-sm rounded-xl flex items-center space-x-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-sm rounded-xl flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Resumo do Inventário / Métricas de Carga */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 shadow-xl flex items-center space-x-3 transition-all">
          <div className="w-10 h-10 rounded-xl bg-indigo-950/50 border border-indigo-800/60 flex items-center justify-center text-indigo-400">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Total de Itens</span>
            <span className="text-lg font-bold text-white">{inventory?.itemCount || 0}</span>
          </div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 shadow-xl flex items-center space-x-3 transition-all">
          <div className="w-10 h-10 rounded-xl bg-sky-950/50 border border-sky-800/60 flex items-center justify-center text-sky-400">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Carga Atual</span>
            <span className="text-lg font-bold text-white">{inventory?.totalWeight || 0} kg</span>
          </div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 shadow-xl flex items-center space-x-3 transition-all">
          <div className="w-10 h-10 rounded-xl bg-emerald-950/50 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Equipados</span>
            <span className="text-lg font-bold text-white">{inventory?.equippedCount || 0}</span>
          </div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 shadow-xl flex items-center space-x-3 transition-all">
          <div className="w-10 h-10 rounded-xl bg-amber-950/50 border border-amber-800/60 flex items-center justify-center text-amber-400">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Valor em Bens</span>
            <span className="text-lg font-bold text-amber-400 font-mono">${inventory?.totalCost || 0}</span>
          </div>
        </div>
      </div>

      {/* Lista Principal de Itens do Inventário */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 shadow-xl transition-all">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-white text-base">Mochila de {selectedCharacter.name}</h3>
            <p className="text-xs text-slate-400">Equipamentos, armas, consumíveis e recursos carregados pelo personagem.</p>
          </div>

          {canEdit && (
            <button
              onClick={() => setShowAddItemModal(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Item</span>
            </button>
          )}
        </div>

        {inventory?.items.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            A mochila está vazia. Adicione itens do catálogo oficial da campanha.
          </div>
        ) : (
          <div className="space-y-3">
            {inventory?.items.map((item) => {
              const props = item.properties || {};

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    item.is_equipped
                      ? 'bg-indigo-950/20 border-indigo-500/40'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start space-x-3.5">
                    {/* Botão de Equipar */}
                    <button
                      onClick={() => handleToggleEquip(item)}
                      disabled={!canEdit}
                      title={item.is_equipped ? 'Desequipar' : 'Equipar'}
                      className={`mt-0.5 p-2 rounded-xl transition-all border ${
                        item.is_equipped
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/40'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <Shield className="w-4 h-4" />
                    </button>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white text-sm">{item.item_name}</span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                          {item.category}
                        </span>
                        {item.is_equipped === 1 && (
                          <span className="text-[10px] bg-indigo-950/60 text-indigo-300 border border-indigo-800 px-1.5 py-0.2 rounded font-semibold">
                            Equipado
                          </span>
                        )}
                      </div>

                      {/* Medidores de Recursos da Instância */}
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {item.category === 'arma' && props.dano && (
                          <span className="text-[11px] bg-slate-900 text-rose-300 border border-rose-900/40 px-2 py-0.5 rounded font-mono flex items-center space-x-1">
                            <Swords className="w-3 h-3 text-rose-400" />
                            <span>Dano: {props.dano} ({props.tipo_dano || 'físico'})</span>
                          </span>
                        )}
                        {item.category === 'arma' && Array.isArray(props.damage_components) && props.damage_components.map((comp: any, idx: number) => (
                          <span key={`comp-${idx}`} className="text-[11px] bg-slate-900 text-amber-300 border border-amber-900/40 px-2 py-0.5 rounded font-mono flex items-center space-x-1">
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            <span>+{comp.formula || `${comp.percentage_damage}%`} {comp.damage_type}{comp.chance_percent && comp.chance_percent < 100 ? ` (${comp.chance_percent}%)` : ''}</span>
                          </span>
                        ))}
                        {item.category === 'arma' && Array.isArray(props.imbued_effects) && props.imbued_effects.map((eff: any, idx: number) => (
                          <span key={`imbue-${idx}`} className="text-[11px] bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 px-2 py-0.5 rounded font-mono flex items-center space-x-1">
                            <Wand2 className="w-3 h-3 text-indigo-400" />
                            <span>Imbuído: +{eff.damage_formula || `${eff.percentage_damage}%`} {eff.damage_type} ({eff.remaining_charges !== null && eff.remaining_charges !== undefined ? `${eff.remaining_charges} ${eff.duration_type}` : 'permanente'})</span>
                          </span>
                        ))}
                        {item.category === 'arma' && props.capacidade_municao !== undefined && (
                          <span className="text-[11px] bg-slate-900 text-amber-300 border border-amber-900/40 px-2 py-0.5 rounded font-mono flex items-center space-x-1">
                            <Crosshair className="w-3 h-3 text-amber-400" />
                            <span>Munição: {props.municao_atual ?? props.capacidade_municao}/{props.capacidade_municao}</span>
                          </span>
                        )}
                        {(item.category === 'tecnologia' || item.category === 'tecnologico') && props.bateria_max !== undefined && (
                          <span className="text-[11px] bg-slate-900 text-cyan-300 border border-cyan-900/40 px-2 py-0.5 rounded font-mono flex items-center space-x-1">
                            <Zap className="w-3 h-3 text-cyan-400" />
                            <span>Bateria: {props.bateria_atual ?? props.bateria_max}/{props.bateria_max}</span>
                          </span>
                        )}
                        {(item.category === 'ocultismo' || item.category === 'ocultista') && props.pontos_alma_max !== undefined && (
                          <span className="text-[11px] bg-slate-900 text-purple-300 border border-purple-900/40 px-2 py-0.5 rounded font-mono flex items-center space-x-1">
                            <Flame className="w-3 h-3 text-purple-400" />
                            <span>Alma: {props.pontos_alma_atual ?? props.pontos_alma_max}/{props.pontos_alma_max}</span>
                          </span>
                        )}
                        {item.category === 'consumivel' && props.cargas_max !== undefined && (
                          <span className="text-[11px] bg-slate-900 text-emerald-300 border border-emerald-900/40 px-2 py-0.5 rounded font-mono flex items-center space-x-1">
                            <HeartPulse className="w-3 h-3 text-emerald-400" />
                            <span>Cargas: {props.cargas_atual ?? props.cargas_max}/{props.cargas_max}</span>
                          </span>
                        )}
                        {Boolean(props.can_imbue || props.imbue_properties) && (
                          <span className="text-[11px] bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 px-2 py-0.5 rounded font-mono flex items-center space-x-1">
                            <Wand2 className="w-3 h-3 text-indigo-400" />
                            <span>Imbuição: {props.imbue_properties?.damage_type || 'elemental'}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
                        <span>Peso: {item.weight} kg/un</span>
                        <span>•</span>
                        <span>Valor: ${item.cost}</span>
                        <span>•</span>
                        <span>Total: {(item.weight * item.quantity).toFixed(1)} kg</span>
                      </div>
                    </div>
                  </div>

                  {/* Ações Mecânicas + Controles de Quantidade e Transferência */}
                  <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                    {/* Botão Rolar Dano para Armas */}
                    {item.category === 'arma' && props.dano && (
                      <button
                        onClick={() => handleRollWeaponDamage(item)}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 text-xs font-semibold flex items-center space-x-1 transition-all"
                        title="Rolar dano da arma no motor de regras"
                      >
                        <Swords className="w-3.5 h-3.5" />
                        <span>Rolar Dano</span>
                      </button>
                    )}

                    {/* Botão de Uso Mecânico (Disparar, Gastar Carga, Usar Consumível) */}
                    {canEdit && (
                      (item.category === 'arma' && props.capacidade_municao !== undefined) ||
                      (item.category === 'tecnologia' || item.category === 'tecnologico') ||
                      (item.category === 'ocultismo' || item.category === 'ocultista') ||
                      (item.category === 'consumivel')
                    ) && (
                      <button
                        onClick={() => handleUseItem(item)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold flex items-center space-x-1 transition-all"
                        title="Acionar ou consumir recurso do item"
                      >
                        {item.category === 'arma' && <Crosshair className="w-3.5 h-3.5 text-amber-400" />}
                        {(item.category === 'tecnologia' || item.category === 'tecnologico') && <Zap className="w-3.5 h-3.5 text-cyan-400" />}
                        {(item.category === 'ocultismo' || item.category === 'ocultista') && <Flame className="w-3.5 h-3.5 text-purple-400" />}
                        {item.category === 'consumivel' && <HeartPulse className="w-3.5 h-3.5 text-emerald-400" />}
                        <span>
                          {item.category === 'arma' ? 'Disparar' :
                           item.category === 'consumivel' ? 'Consumir' :
                           item.category === 'ocultismo' || item.category === 'ocultista' ? 'Canalizar' :
                           'Gastar Carga'}
                        </span>
                      </button>
                    )}

                    {/* Botão Imbuir Arma (para consumíveis com propriedades de imbuição) */}
                    {canEdit && Boolean(props.can_imbue || props.imbue_properties) && (
                      <button
                        onClick={() => openImbueModal(item)}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 text-xs font-semibold flex items-center space-x-1 transition-all"
                        title="Imbuir uma arma com este consumível/óleo"
                      >
                        <Wand2 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Imbuir Arma</span>
                      </button>
                    )}

                    <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                      {canEdit && (
                        <button
                          onClick={() => handleUpdateQuantity(item, -1)}
                          className="px-2.5 py-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                          -
                        </button>
                      )}
                      <span className="px-3 py-1 font-mono font-bold text-xs text-indigo-300 min-w-8 text-center">
                        x{item.quantity}
                      </span>
                      {canEdit && (
                        <button
                          onClick={() => handleUpdateQuantity(item, 1)}
                          className="px-2.5 py-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                          +
                        </button>
                      )}
                    </div>

                    {canEdit && otherCharacters.length > 0 && (
                      <button
                        onClick={() => openTransferModal(item)}
                        title="Transferir para outro personagem da mesa"
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/50 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-800/60 text-xs font-semibold transition-all"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Transferir</span>
                      </button>
                    )}

                    {canEdit && (
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        title="Descartar item"
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Histórico Recente de Transferências da Mesa */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider mb-4 flex items-center space-x-2">
          <History className="w-4 h-4 text-indigo-400" />
          <span>Auditoria de Transferências Recentes na Campanha</span>
        </h3>

        {transfers.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma transferência realizada nesta campanha ainda.</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {transfers.slice(0, 10).map((t) => (
              <div key={t.id} className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-white font-medium">{t.from_character_name}</span>
                  <span className="text-slate-500">enviou</span>
                  <span className="font-bold text-indigo-300">{t.quantity}x {t.item_name}</span>
                  <span className="text-slate-500">para</span>
                  <span className="text-white font-medium">{t.to_character_name}</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  {new Date(t.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: ADICIONAR ITEM */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-lg bg-slate-900/90 border border-slate-800/80 rounded-3xl p-8 shadow-2xl backdrop-blur-md relative">
            <h2 className="text-2xl font-bold text-white mb-2">Adicionar Item ao Inventário</h2>
            <p className="text-xs text-slate-400 mb-6">
              Adicione um item existente do catálogo oficial da campanha.
            </p>

            {/* Alternador de Modo (Customizado apenas para Mestres) */}
            {isMaster && (
              <div className="flex border-b border-slate-800 mb-6">
                <button
                  type="button"
                  onClick={() => setAddMode('catalog')}
                  className={`flex-1 py-2 text-sm font-semibold border-b-2 transition-all ${
                    addMode === 'catalog'
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Do Catálogo da Campanha ({catalog.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode('custom')}
                  className={`flex-1 py-2 text-sm font-semibold border-b-2 transition-all ${
                    addMode === 'custom'
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Item Customizado (Mestre)
                </button>
              </div>
            )}

            <form onSubmit={handleAddItem} className="space-y-4">
              {addMode === 'catalog' || !isMaster ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Selecione o Item do Catálogo
                  </label>
                  {catalog.length === 0 ? (
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-center text-xs text-slate-500">
                      Nenhum item cadastrado no catálogo desta campanha. Solicite ao mestre.
                    </div>
                  ) : (
                    <select
                      value={selectedCatalogItemId}
                      onChange={(e) => setSelectedCatalogItemId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                    >
                      {catalog.map((cat) => (
                        <option 
                          key={cat.id} 
                          value={cat.id}
                          disabled={!isMaster && cat.acquisition_mode === 'approval'}
                        >
                          {cat.name} ({cat.category}) - {cat.weight}kg - ${cat.cost}
                          {cat.acquisition_mode === 'approval' ? ' [Requer Aprovação]' : ''}
                          {cat.acquisition_mode === 'limited' ? ` [Estoque: ${cat.stock_quantity ?? 0}]` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Nome do Item
                    </label>
                    <input
                      type="text"
                      required
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Ex: Adaga Envenenada, Corda de Seda 15m..."
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Categoria</label>
                      <select
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                      >
                        <option value="geral">Geral</option>
                        <option value="arma">Arma</option>
                        <option value="armadura">Armadura</option>
                        <option value="consumivel">Consumível</option>
                        <option value="ocultismo">Ocultismo</option>
                        <option value="tecnologia">Tecnologia</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Peso (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={customWeight}
                        onChange={(e) => setCustomWeight(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Preço ($)</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={customCost}
                        onChange={(e) => setCustomCost(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Quantidade
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={customQuantity}
                  onChange={(e) => setCustomQuantity(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar à Mochila</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TRANSFERIR ITEM */}
      {showTransferModal && itemToTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900/90 border border-slate-800/80 rounded-3xl p-8 shadow-2xl backdrop-blur-md relative">
            <h2 className="text-xl font-bold text-white mb-1">Transferir Item</h2>
            <p className="text-xs text-slate-400 mb-6">
              Transfira unidades deste item de forma atômica para outro aventureiro na campanha.
            </p>

            <form onSubmit={handleExecuteTransfer} className="space-y-4">
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-500 block">Item Selecionado</span>
                <span className="font-bold text-white text-base">{itemToTransfer.item_name}</span>
                <span className="text-xs text-slate-400 block mt-0.5">
                  Disponível: {itemToTransfer.quantity} unidade(s) • {itemToTransfer.weight}kg/un
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Personagem Destinatário
                </label>
                {otherCharacters.length === 0 ? (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-500">
                    Não existem outros personagens nesta campanha para receber a transferência.
                  </div>
                ) : (
                  <select
                    value={targetCharId}
                    onChange={(e) => setTargetCharId(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                  >
                    {otherCharacters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.owner_username || 'Jogador'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Quantidade a Transferir
                </label>
                <input
                  type="number"
                  min="1"
                  max={itemToTransfer.quantity}
                  required
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={Boolean(otherCharacters.length === 0)}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all flex items-center space-x-2"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>Confirmar Transferência</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: IMBUIR ARMA COM CONSUMÍVEL */}
      {showImbueModal && consumableToImbue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900/90 border border-slate-800/80 rounded-3xl p-8 shadow-2xl backdrop-blur-md relative">
            <div className="flex items-center space-x-2 text-indigo-400 mb-1">
              <Wand2 className="w-5 h-5 text-indigo-400" />
              <h2 className="text-xl font-bold text-white">Imbuir Arma</h2>
            </div>
            <p className="text-xs text-slate-400 mb-5">
              Aplique o óleo, reagente ou essência em uma arma para conceder dano elemental e efeitos adicionais.
            </p>

            <form onSubmit={handleExecuteImbue} className="space-y-4">
              {/* Consumível Selecionado */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-indigo-950/60 space-y-1.5">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Consumível Selecionado</span>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{consumableToImbue.item_name}</span>
                  <span className="text-xs font-mono text-indigo-300">
                    {consumableToImbue.properties?.cargas_atual !== undefined
                      ? `${consumableToImbue.properties.cargas_atual} carga(s)`
                      : `${consumableToImbue.quantity} un.`}
                  </span>
                </div>
                {consumableToImbue.properties?.imbue_properties && (
                  <div className="text-xs text-amber-300 font-mono bg-slate-900/80 p-2 rounded-lg border border-slate-800 mt-2 space-y-0.5">
                    <div>
                      Elemento: <strong className="uppercase text-amber-400">{consumableToImbue.properties.imbue_properties.damage_type}</strong>
                      {consumableToImbue.properties.imbue_properties.damage_formula && ` (+${consumableToImbue.properties.imbue_properties.damage_formula})`}
                      {consumableToImbue.properties.imbue_properties.percentage_damage && ` (+${consumableToImbue.properties.imbue_properties.percentage_damage}% vida máx)`}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Duração: {consumableToImbue.properties.imbue_properties.charges} {consumableToImbue.properties.imbue_properties.duration_type || 'usos'}
                      {consumableToImbue.properties.imbue_properties.chance_percent && ` • ${consumableToImbue.properties.imbue_properties.chance_percent}% chance`}
                    </div>
                    {consumableToImbue.properties.imbue_properties.condition && (
                      <div className="text-[11px] text-rose-400">
                        Aplica condição: [{consumableToImbue.properties.imbue_properties.condition}]
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Seleção de Arma */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Selecione a Arma Destino
                </label>
                {(inventory?.items.filter(i => i.category === 'arma') || []).length === 0 ? (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-rose-400">
                    Este personagem não possui armas na mochila para receber a imbuição.
                  </div>
                ) : (
                  <select
                    value={selectedWeaponToImbueId}
                    onChange={(e) => setSelectedWeaponToImbueId(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                  >
                    {(inventory?.items.filter(i => i.category === 'arma') || []).map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.item_name} {w.properties?.dano ? `(${w.properties.dano})` : ''}
                        {w.is_equipped === 1 ? ' [Equipada]' : ''}
                        {w.properties?.imbued_effects?.length ? ' [Já Imbuída]' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <p className="text-[11px] text-slate-500">
                Uma dose/carga do consumível será consumida imediatamente de forma atômica.
              </p>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowImbueModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={Boolean((inventory?.items.filter(i => i.category === 'arma') || []).length === 0)}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all flex items-center space-x-2"
                >
                  <Wand2 className="w-4 h-4" />
                  <span>Confirmar Imbuição</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
