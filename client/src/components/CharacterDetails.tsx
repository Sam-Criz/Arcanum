import { useState } from 'react';
import { Shield, Heart, Zap, X } from 'lucide-react';
import { api } from '../services/api';
import { notify } from './NotificationProvider';

interface CharacterDetailsProps {
  character: any;
  campaignId?: string;
  onClose: () => void;
  onRoll?: (formula: string, desc: string) => void;
}

export default function CharacterDetails({ character, campaignId, onClose, onRoll }: CharacterDetailsProps) {
  const [activeTab, setActiveTab] = useState<'abilities' | 'background'>('abilities');
  const [rollingAbility, setRollingAbility] = useState<string | null>(null);

  const raw = character?.raw_data || {};
  const computed = character?.computed_data || {};

  const currentHp = Number(character?.current_hp ?? computed?.vida_atual ?? (typeof character?.hp === 'string' ? character.hp.split('/')[0]?.trim() : 20));
  const maxHp = Number(character?.max_hp ?? computed?.vida_max ?? (typeof character?.hp === 'string' ? character.hp.split('/')[1]?.trim() : 20));
  const currentPe = Number(character?.current_pe ?? computed?.pe_atual ?? raw?.pe_atual ?? 10);
  const maxPe = Number(character?.max_pe ?? computed?.pe_max ?? raw?.pe_max ?? 10);
  const defense = Number(character?.defense ?? computed?.defense ?? raw?.defense ?? 12);

  const hpPercent = maxHp > 0 ? Math.min(100, Math.max(0, Math.round((currentHp / maxHp) * 100))) : 0;
  const pePercent = maxPe > 0 ? Math.min(100, Math.max(0, Math.round((currentPe / maxPe) * 100))) : 0;

  const rawAbilities = raw.abilities || raw.habilidades || computed.abilities || [];
  const abilitiesList: Array<{ name: string; cost?: string; description?: string; roll?: string; type?: string }> = Array.isArray(rawAbilities) && rawAbilities.length > 0
    ? rawAbilities.map((ab: any) => typeof ab === 'string' ? { name: ab, description: 'Habilidade registrada na ficha' } : ab)
    : [];

  const backgroundText = raw.history || raw.antecedentes || raw.background || raw.origem || raw.notes || character?.notes || 'Nenhum histórico detalhado registrado.';
  const attributes = raw.attributes || computed.attributes || (() => {
    const known = ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma', 'vigor', 'presenca', 'intelecto', 'agilidade'];
    const found: Record<string, any> = {};
    for (const k of known) {
      if (computed[k] !== undefined) found[k] = computed[k];
      else if (raw[k] !== undefined) found[k] = raw[k];
    }
    return found;
  })();

  const handleRollAbility = async (ability: { name: string; roll?: string; description?: string }) => {
    const formula = ability.roll || '1d20';
    if (onRoll) {
      onRoll(formula, ability.name);
      return;
    }
    if (!campaignId) {
      notify.info(`Habilidade: ${ability.name}`, `Fórmula: ${formula}`);
      return;
    }

    setRollingAbility(ability.name);
    try {
      const res = await api.rollDice(campaignId, { expression: formula, characterId: character.id });
      const breakdownText = res.breakdown?.expression ? `[${res.breakdown.expression}]` : formula;
      notify.success(`Rolagem: ${ability.name}`, `Resultado: ${res.total} (${breakdownText})`);
    } catch (err: any) {
      notify.error('Erro na rolagem', err.message || 'Falha ao executar');
    } finally {
      setRollingAbility(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4 select-none animate-fade-in">
      <div className="bg-[#1a1816] rounded-xl border border-[#3a3530] w-full max-w-3xl text-[#ece3d0] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Cabeçalho do Dossiê */}
        <div className="p-6 bg-[#1a1816] border-b border-[#3a3530] flex justify-between items-start shrink-0">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#c9a04e]">
              Dossiê de Personagem • {character?.class || raw?.classe || 'Aventureiro'}
            </span>
            <h2 className="text-3xl font-serif text-[#ece3d0] font-bold tracking-tight">
              {character?.name || 'Aventureiro'}
            </h2>
            <div className="flex items-center space-x-6 pt-2 text-xs font-mono">
              <div className="flex items-center space-x-2">
                <Heart className="w-3.5 h-3.5 text-[#b24a52]" />
                <span className="text-[#8a8578]">PV:</span>
                <span className="font-bold text-[#ece3d0]">{currentHp}/{maxHp}</span>
                <div className="w-16 h-1 bg-[#131211] rounded-full overflow-hidden border border-[#3a3530]/60">
                  <div className="h-full bg-[#b24a52]" style={{ width: `${hpPercent}%` }} />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Zap className="w-3.5 h-3.5 text-[#4a7a8a]" />
                <span className="text-[#8a8578]">PE:</span>
                <span className="font-bold text-[#ece3d0]">{currentPe}/{maxPe}</span>
                <div className="w-16 h-1 bg-[#131211] rounded-full overflow-hidden border border-[#3a3530]/60">
                  <div className="h-full bg-[#4a7a8a]" style={{ width: `${pePercent}%` }} />
                </div>
              </div>

              <div className="flex items-center space-x-1.5">
                <Shield className="w-3.5 h-3.5 text-[#5a7a5a]" />
                <span className="text-[#8a8578]">Defesa:</span>
                <span className="font-bold text-[#5a7a5a]">{defense}</span>
              </div>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose} 
            className="w-8 h-8 rounded-lg bg-[#131211] text-[#8a8578] hover:text-[#ece3d0] border border-[#3a3530] flex items-center justify-center text-sm transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo em Duas Zonas Assimétricas */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col md:flex-row gap-6">
          {/* Zona 1: Habilidades & Histórico (Principal) */}
          <div className="flex-1 min-w-0 space-y-4">
            <div className="flex border-b border-[#3a3530] text-xs font-serif">
              <button
                type="button"
                onClick={() => setActiveTab('abilities')}
                className={`pb-2 px-3 font-bold transition-colors relative ${
                  activeTab === 'abilities' ? 'text-[#c9a04e]' : 'text-[#8a8578] hover:text-[#ece3d0]'
                }`}
              >
                <span>Habilidades ({abilitiesList.length})</span>
                {activeTab === 'abilities' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#c9a04e]" />}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('background')}
                className={`pb-2 px-3 font-bold transition-colors relative ${
                  activeTab === 'background' ? 'text-[#c9a04e]' : 'text-[#8a8578] hover:text-[#ece3d0]'
                }`}
              >
                <span>Histórico & Notas</span>
                {activeTab === 'background' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#c9a04e]" />}
              </button>
            </div>

            {activeTab === 'abilities' && (
              <div className="space-y-2">
                {abilitiesList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#8a8578] border border-dashed border-[#3a3530] rounded-lg">
                    Nenhuma habilidade listada.
                  </div>
                ) : (
                  <div className="divide-y divide-[#3a3530]/50 border-t border-b border-[#3a3530]/50">
                    {abilitiesList.map((ability, idx) => (
                      <div key={idx} className="py-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-serif font-bold text-sm text-[#ece3d0]">{ability.name}</span>
                            {ability.cost && (
                              <span className="text-[10px] font-mono text-[#4a7a8a]">{ability.cost}</span>
                            )}
                          </div>
                          <p className="text-xs text-[#8a8578] mt-0.5">{ability.description || 'Habilidade ativa'}</p>
                        </div>

                        <button
                          type="button"
                          disabled={rollingAbility === ability.name}
                          onClick={() => handleRollAbility(ability)}
                          className="px-3 py-1 bg-[#c9a04e] hover:bg-[#d67b5f] text-[#131211] font-bold rounded text-xs transition-all active:scale-95 disabled:opacity-50 shrink-0"
                        >
                          {rollingAbility === ability.name ? 'Rolando...' : ability.roll || 'Rolar'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'background' && (
              <div className="p-4 bg-[#131211] border border-[#3a3530] rounded-lg text-xs text-[#8a8578] leading-relaxed">
                <p className="whitespace-pre-wrap">{backgroundText}</p>
              </div>
            )}
          </div>

          {/* Zona 2: Atributos em Lista Discreta (Lateral) */}
          <div className="w-full md:w-56 shrink-0 space-y-3 pt-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#8a8578] block">
              Atributos de Ficha
            </span>
            <div className="space-y-1.5">
              {Object.entries(attributes).map(([key, val]: [string, any]) => {
                const numVal = Number(val) || 10;
                const mod = Math.floor((numVal - 10) / 2);
                const modStr = mod >= 0 ? `+${mod}` : `${mod}`;

                return (
                  <div key={key} className="p-2 bg-[#131211] border border-[#3a3530] rounded flex items-center justify-between text-xs font-mono">
                    <span className="text-[#8a8578] uppercase text-[10px]">{key}</span>
                    <div className="flex items-center space-x-2">
                      <span className="font-serif font-bold text-sm text-[#ece3d0]">{numVal}</span>
                      <span className="text-[10px] text-[#c9a04e] font-semibold">{modStr}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
