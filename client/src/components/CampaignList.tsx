import React, { useState } from 'react';
import { Campaign, api } from '../services/api';
import { Skull, Cpu, ShieldAlert, ChevronRight } from 'lucide-react';

interface CampaignListProps {
  campaigns: Campaign[];
  onSelectCampaign: (campaign: Campaign) => void;
  onRefreshCampaigns: () => void;
}

export const CampaignList: React.FC<CampaignListProps> = ({
  campaigns,
  onSelectCampaign,
  onRefreshCampaigns
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
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#2c2825] text-[#c9a04e] border border-[#574e45]">Proprietário</span>;
      case 'master':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#2c2825] text-[#9a83c6] border border-[#574e45]">Mestre</span>;
      case 'assistant':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#2c2825] text-[#6f93ad] border border-[#574e45]">Auxiliar</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#2c2825] text-[#5e9b76] border border-[#574e45]">Jogador</span>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Header com botões de ação */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-serif text-[#ece3d0] tracking-normal">Suas campanhas</h1>
          <p className="text-[#aaa292] text-sm mt-1.5">
            Cada campanha tem as próprias regras, fichas e mapas, separados das outras.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowJoinModal(true)}
            className="px-4 py-2 bg-[#1a1816] hover:bg-[#2c2825] text-[#ece3d0] border border-[#2c2825] rounded font-medium text-xs transition-colors"
          >
            Entrar com código
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-[#c9a04e] hover:bg-[#c9a04e]/90 text-[#131211] font-bold rounded text-xs transition-colors shadow-sm"
          >
            Criar campanha
          </button>
        </div>
      </div>

      {/* Tabela de Campanhas em Linhas Elegantes */}
      <div className="bg-[#1a1816] border border-[#2c2825] rounded-lg overflow-hidden shadow-2xl">
        <div className="grid grid-cols-12 px-6 py-3 border-b border-[#2c2825] text-[11px] font-mono text-[#aaa292] uppercase tracking-wider">
          <span className="col-span-5">Campanha</span>
          <span className="col-span-3">Sistema de regras</span>
          <span className="col-span-2">Seu papel</span>
          <span className="col-span-2 text-right">Membros</span>
        </div>

        {campaigns.length === 0 ? (
          <div className="p-8 border-t border-dashed border-[#2c2825] bg-[#131211]">
            <h3 className="text-sm font-serif font-bold text-[#ece3d0]">Conta nova, sem campanhas</h3>
            <p className="text-xs text-[#aaa292] max-w-md mt-1 mb-4">
              Quem ainda não participa de nenhuma campanha vê só esta área. Crie a sua escolhendo as regras iniciais, ou entre com o código que o mestre enviou.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-transparent hover:bg-[#2c2825] text-[#c9a04e] border border-[#c9a04e] rounded text-xs font-medium transition-colors"
            >
              Criar primeira campanha
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#2c2825]">
            {campaigns.map((camp) => (
              <div
                key={camp.id}
                onClick={() => onSelectCampaign(camp)}
                className="grid grid-cols-12 px-6 py-4 items-center hover:bg-[#2c2825]/40 cursor-pointer transition-colors group"
              >
                <div className="col-span-5 pr-4">
                  <h3 className="font-serif text-xl text-[#ece3d0] group-hover:text-[#c9a04e] transition-colors leading-tight">
                    {camp.name}
                  </h3>
                  <p className="text-xs text-[#aaa292] mt-0.5 truncate">
                    {camp.description || 'Nenhuma descrição fornecida.'}
                  </p>
                </div>

                <div className="col-span-3 text-sm text-[#ece3d0]">
                  {camp.active_ruleset_name || 'Personalizado'}
                </div>

                <div className="col-span-2">
                  {getRoleBadge(camp.role)}
                  <div className="text-[10px] text-[#aaa292] font-mono mt-0.5">Sem personagem</div>
                </div>

                <div className="col-span-2 flex items-center justify-end space-x-3 text-sm text-[#aaa292]">
                  <span className="font-mono text-xs">{camp.member_count} membros</span>
                  <ChevronRight className="w-4 h-4 text-[#aaa292] group-hover:text-[#c9a04e] transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bloco Conta Nova Rodapé */}
      {campaigns.length > 0 && (
        <div className="mt-8 p-6 border border-dashed border-[#2c2825] rounded-lg bg-[#1a1816]/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-serif font-bold text-[#ece3d0]">Conta nova, sem campanhas</h4>
            <p className="text-xs text-[#aaa292] max-w-lg mt-0.5">
              Quem ainda não participa de nenhuma campanha vê só esta área. Crie a sua escolhendo as regras iniciais, ou entre com o código que o mestre enviou.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-transparent hover:bg-[#2c2825] text-[#c9a04e] border border-[#c9a04e] rounded text-xs font-medium transition-colors shrink-0"
          >
            Criar primeira campanha
          </button>
        </div>
      )}

      {/* Modal Criar Campanha */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-xl bg-[#1a1816] border border-[#2c2825] rounded-xl p-8 shadow-2xl relative text-[#ece3d0]">
            <h2 className="text-2xl font-bold text-white mb-2">Criar Nova Campanha</h2>
            <p className="text-sm text-[#aaa292] mb-6">
              Defina o nome da campanha e escolha o conjunto inicial de regras. Você poderá editar cada fórmula e atributo posteriormente.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-sm rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateCampaign} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-[#ece3d0] uppercase tracking-wider mb-1.5">
                  Nome da Campanha
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: O Segredo na Floresta, Crônicas de Neo-Tóquio..."
                  className="w-full px-4 py-2.5 bg-slate-950 border border-[#574e45] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#c9a04e] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#ece3d0] uppercase tracking-wider mb-1.5">
                  Descrição ou Sinopse
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Breve resumo da premissa ou universo..."
                  className="w-full px-4 py-2.5 bg-slate-950 border border-[#574e45] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#c9a04e] text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#ece3d0] uppercase tracking-wider mb-2">
                  Predefinição Inicial de Regras
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div
                    onClick={() => setPreset('investigacao')}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      preset === 'investigacao'
                        ? 'border-indigo-500 bg-indigo-950/40 text-white shadow-md shadow-indigo-500/20'
                        : 'border-[#2c2825] bg-slate-950/60 text-[#aaa292] hover:border-[#574e45]'
                    }`}
                  >
                    <Skull className="w-5 h-5 text-rose-400 mb-2" />
                    <p className="font-bold text-sm">Investigação</p>
                    <p className="text-xs text-[#aaa292] mt-1">Horror, Sanidade, Perícias e 1d20 (estilo Paranormal/C.R.I.S.)</p>
                  </div>

                  <div
                    onClick={() => setPreset('cyberpunk')}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      preset === 'cyberpunk'
                        ? 'border-indigo-500 bg-indigo-950/40 text-white shadow-md shadow-indigo-500/20'
                        : 'border-[#2c2825] bg-slate-950/60 text-[#aaa292] hover:border-[#574e45]'
                    }`}
                  >
                    <Cpu className="w-5 h-5 text-cyan-400 mb-2" />
                    <p className="font-bold text-sm">Cyberpunk</p>
                    <p className="text-xs text-[#aaa292] mt-1">Cromo, Reflexo, Bateria e paradas de 2d6</p>
                  </div>

                  <div
                    onClick={() => setPreset('fantasia_d20')}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      preset === 'fantasia_d20'
                        ? 'border-indigo-500 bg-indigo-950/40 text-white shadow-md shadow-indigo-500/20'
                        : 'border-[#2c2825] bg-slate-950/60 text-[#aaa292] hover:border-[#574e45]'
                    }`}
                  >
                    <ShieldAlert className="w-5 h-5 text-amber-400 mb-2" />
                    <p className="font-bold text-sm">Fantasia D20</p>
                    <p className="text-xs text-[#aaa292] mt-1">Atributos clássicos (FOR, DES, CON, INT, SAB, CAR)</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[#2c2825]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#574e45] text-[#ece3d0] hover:bg-slate-800 text-sm font-medium transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-[#c9a04e] hover:bg-[#c9a04e]/90 text-[#131211] text-sm font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  {loading ? 'Criando...' : 'Criar Campanha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Entrar com Código */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#1a1816] border border-[#2c2825] rounded-xl p-8 shadow-2xl relative text-[#ece3d0]">
            <h2 className="text-2xl font-bold text-white mb-2">Entrar em uma Campanha</h2>
            <p className="text-sm text-[#aaa292] mb-6">
              Digite o código alfanumérico fornecido pelo mestre da mesa.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-sm rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleJoinCampaign} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-[#ece3d0] uppercase tracking-wider mb-1.5">
                  Código de Convite
                </label>
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Ex: A4F19B82"
                  className="w-full px-4 py-3 bg-slate-950 border border-[#574e45] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#c9a04e] text-center font-mono tracking-widest text-lg"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[#2c2825]">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#574e45] text-[#ece3d0] hover:bg-slate-800 text-sm font-medium transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-[#c9a04e] hover:bg-[#c9a04e]/90 text-[#131211] text-sm font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  {loading ? 'Validando...' : 'Entrar na Mesa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
