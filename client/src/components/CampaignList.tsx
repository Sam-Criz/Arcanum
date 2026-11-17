import React, { useState } from 'react';
import { Campaign, api } from '../services/api';
import { ChevronRight, Plus, Key, Users, Feather, BookOpen } from 'lucide-react';

interface CampaignListProps {
  campaigns: Campaign[];
  onSelectCampaign: (campaign: Campaign) => void;
  onRefreshCampaigns: () => void;
  isLoading?: boolean;
}

export const CampaignList: React.FC<CampaignListProps> = ({
  campaigns,
  onSelectCampaign,
  onRefreshCampaigns,
  isLoading = false
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [preset, setPreset] = useState<'investigacao' | 'cyberpunk' | 'fantasia_d20'>('investigacao');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const newCampaign = await api.createCampaign({ name, description, preset });
      setShowCreateModal(false);
      setName('');
      setDescription('');
      onRefreshCampaigns();
      onSelectCampaign(newCampaign);
    } catch (err: any) {
      setError(err.message || 'Erro ao criar campanha');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.joinCampaign(inviteCode);
      setShowJoinModal(false);
      setInviteCode('');
      onRefreshCampaigns();
      onSelectCampaign(res.campaign);
    } catch (err: any) {
      setError(err.message || 'Código de convite inválido ou expirado');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider font-semibold bg-[#2a2218] text-[#c9a04e] border border-[#c9a04e]/40">
            Mestre Criador
          </span>
        );
      case 'master':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider font-semibold bg-[#1a2218] text-[#5a7a5a] border border-[#5a7a5a]/40">
            Co-Mestre
          </span>
        );
      case 'assistant':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider font-semibold bg-[#1a1e24] text-[#4a7a8a] border border-[#4a7a8a]/40">
            Auxiliar
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider font-semibold bg-[#1f1f1a] text-[#ece3d0] border border-[#3a3530]">
            Aventureiro
          </span>
        );
      }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 select-none text-[#ece3d0] bg-[#131211]">
      {/* Cabeçalho Editorial com Linha Fina de Separação */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#3a3530]">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-[#c9a04e] block mb-1">
            Índice Geral de Campanhas
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight text-[#ece3d0]">
            Crônicas Registradas
          </h1>
          <p className="text-xs text-[#8a8578] mt-1 max-w-xl">
            Selecione uma mesa ativa para entrar no ambiente tático ou forje novas crônicas com regras isoladas.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 shrink-0">
          <button
            onClick={() => setShowJoinModal(true)}
            className="px-3.5 py-2 bg-[#1a1816] hover:bg-[#2c2825] text-[#ece3d0] border border-[#3a3530] rounded-xl text-xs font-medium flex items-center space-x-1.5 transition-all duration-300 active:scale-95"
          >
            <Key className="w-3.5 h-3.5 text-[#8a8578]" />
            <span>Código de Convite</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-[#c9a04e] hover:bg-[#d4ad5e] text-[#131211] font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-all duration-300 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Forjar Nova Mesa</span>
          </button>
        </div>
      </div>

      {/* Lista Editorial em Formato Dossiê / Ledger */}
      <div className="mt-8">
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-[#2c2825] border-t-[#c9a04e] rounded-full animate-spin mx-auto" />
            <p className="text-xs font-mono text-[#8a8578]">Consultando arquivos de campanha...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-[#3a3530] rounded-xl p-8 bg-[#1a1816]/50 space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#1a1816] border border-[#3a3530] flex items-center justify-center text-[#c9a04e] mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif text-xl font-bold text-[#ece3d0]">Nenhuma mesa aberta</h3>
              <p className="text-xs text-[#8a8578] max-w-md mx-auto">
                Você ainda não está registrado em nenhuma campanha. Forje uma nova mesa ou solicite o código de acesso ao seu Mestre.
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 bg-[#c9a04e] hover:bg-[#d4ad5e] text-[#131211] font-bold rounded-xl text-xs transition-all duration-300 active:scale-95 inline-flex items-center space-x-2"
            >
              <Feather className="w-4 h-4" />
              <span>Forjar Primeira Campanha</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#3a3530]/60 border-t border-b border-[#3a3530]/60">
            {campaigns.map((camp) => (
              <div
                key={camp.id}
                onClick={() => onSelectCampaign(camp)}
                className="group py-5 px-3 sm:px-4 hover:bg-[#1a1816]/60 cursor-pointer transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center space-x-2.5">
                    {getRoleBadge(camp.role)}
                    <span className="text-[11px] font-mono text-[#5a7a5a] px-2 py-0.5 rounded bg-[#1a1816] border border-[#3a3530]">
                      {camp.active_ruleset_name || 'Sistema Customizado'}
                    </span>
                    <span className="text-[11px] font-mono text-[#8a8578] flex items-center space-x-1">
                      <Users className="w-3 h-3 text-[#8a8578]" />
                      <span>{camp.member_count} {camp.member_count === 1 ? 'membro' : 'membros'}</span>
                    </span>
                  </div>

                  <h2 className="font-serif text-2xl font-bold text-[#ece3d0] group-hover:text-[#c9a04e] transition-colors leading-tight">
                    {camp.name}
                  </h2>

                  <p className="text-xs text-[#8a8578] line-clamp-2 max-w-2xl leading-relaxed">
                    {camp.description || 'Nenhuma descrição detalhada anexada a esta crônica.'}
                  </p>
                </div>

                <div className="flex items-center space-x-3 shrink-0 self-end md:self-center">
                  <span className="text-xs font-mono text-[#c9a04e] group-hover:translate-x-0.5 transition-transform hidden sm:inline">
                    Abrir Crônica
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-[#1a1816] border border-[#3a3530] group-hover:border-[#c9a04e] group-hover:bg-[#c9a04e] flex items-center justify-center text-[#8a8578] group-hover:text-[#131211] transition-all duration-300">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Criar Campanha */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg bg-[#1a1816] border border-[#3a3530] rounded-2xl p-6 sm:p-8 relative text-[#ece3d0] shadow-2xl shadow-black/60">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#3a3530] mb-5">
              <div>
                <h2 className="text-2xl font-serif font-bold text-[#ece3d0]">Forjar Nova Mesa</h2>
                <p className="text-xs text-[#8a8578] mt-0.5">
                  Defina o título da campanha e selecione as diretrizes mecânicas.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-7 h-7 rounded-xl bg-[#131211] text-[#8a8578] hover:text-[#ece3d0] border border-[#3a3530] flex items-center justify-center text-xs transition-colors"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-[#1f1517] border border-[#b24a52]/60 text-[#e8b5b5] text-xs rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-mono text-[#8a8578] uppercase tracking-wider">
                  Denominação da Campanha
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: As Sombras de Eldoria"
                  className="w-full px-3.5 py-2.5 bg-[#131211] border border-[#3a3530] focus:border-[#c9a04e] rounded-xl text-sm text-[#ece3d0] placeholder-[#8a8578] focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-mono text-[#8a8578] uppercase tracking-wider">
                  Premissa / Descrição
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva a ambientação, perigos e mistérios deste mundo..."
                  className="w-full px-3.5 py-2.5 bg-[#131211] border border-[#3a3530] focus:border-[#c9a04e] rounded-xl text-sm text-[#ece3d0] placeholder-[#8a8578] focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-mono text-[#8a8578] uppercase tracking-wider">
                  Fundação de Regras (Preset)
                </label>
                <select
                  value={preset}
                  onChange={(e) => setPreset(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-[#131211] border border-[#3a3530] focus:border-[#c9a04e] rounded-xl text-sm text-[#ece3d0] focus:outline-none transition-colors"
                >
                  <option value="investigacao">Investigação Sobrenatural (D100 / Sanidade &amp; Perícias)</option>
                  <option value="cyberpunk">Cyberpunk Distópico (D10 / Sobrecarga &amp; Carga)</option>
                  <option value="fantasia_d20">Fantasia Heroica (D20 Clássico / Atributos &amp; PV)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3 border-t border-[#3a3530]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-[#131211] hover:bg-[#2c2825] text-[#8a8578] hover:text-[#ece3d0] rounded-xl text-xs font-medium border border-[#3a3530] transition-all duration-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-[#c9a04e] hover:bg-[#d4ad5e] text-[#131211] font-bold rounded-xl text-xs transition-all duration-300 active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'Instanciando...' : 'Criar Mesa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ingressar via Código */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md bg-[#1a1816] border border-[#3a3530] rounded-2xl p-6 relative text-[#ece3d0] shadow-2xl shadow-black/60">
            <div className="flex items-center justify-between pb-3 border-b border-[#3a3530] mb-4">
              <h2 className="text-xl font-serif font-bold text-[#ece3d0]">Ingressar em Mesa</h2>
              <button
                onClick={() => setShowJoinModal(false)}
                className="w-7 h-7 rounded-xl bg-[#131211] text-[#8a8578] hover:text-[#ece3d0] border border-[#3a3530] flex items-center justify-center text-xs transition-colors"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-[#1f1517] border border-[#b24a52]/60 text-[#e8b5b5] text-xs rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleJoinCampaign} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-mono text-[#8a8578] uppercase tracking-wider">
                  Código de Convite
                </label>
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Ex: ARCANUM-78A92F"
                  className="w-full px-3.5 py-2.5 bg-[#131211] border border-[#3a3530] focus:border-[#c9a04e] rounded-xl text-sm text-[#ece3d0] placeholder-[#8a8578] focus:outline-none transition-colors font-mono uppercase"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3 border-t border-[#3a3530]">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-4 py-2 bg-[#131211] hover:bg-[#2c2825] text-[#8a8578] hover:text-[#ece3d0] rounded-xl text-xs font-medium border border-[#3a3530] transition-all duration-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-[#c9a04e] hover:bg-[#d4ad5e] text-[#131211] font-bold rounded-xl text-xs transition-all duration-300 active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'Consultando...' : 'Entrar na Mesa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
