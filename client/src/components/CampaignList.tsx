import React, { useState } from 'react';
import { Campaign, api } from '../services/api';
import { Plus, Users, Key, Sparkles, BookOpen, Skull, Cpu, ShieldAlert, ArrowRight } from 'lucide-react';

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
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">Proprietário</span>;
      case 'master':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">Mestre</span>;
      case 'assistant':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">Auxiliar</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Jogador</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Header com botões de ação */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 pb-6 border-b border-slate-800/80">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Suas Campanhas</h1>
          <p className="text-slate-400 text-sm mt-1">
            Cada campanha possui isolamento completo, com suas próprias regras, dados, fichas e universo.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowJoinModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 hover:text-white border border-slate-700/80 rounded-xl font-medium text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-sm"
          >
            <Key className="w-4 h-4 text-amber-400" />
            <span>Entrar com Código</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl font-medium text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-indigo-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Nova Campanha</span>
          </button>
        </div>
      </div>

      {/* Grid de Campanhas */}
      {campaigns.length === 0 ? (
        <div className="text-center py-20 px-6 border-2 border-dashed border-slate-800/80 rounded-3xl bg-slate-900/40 backdrop-blur-md">
          <BookOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-200">Nenhuma campanha encontrada</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto mt-1 mb-6">
            Você ainda não participa de nenhuma campanha. Crie sua própria campanha configurando as regras do zero ou entre com o código de um mestre.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              Criar Primeira Campanha
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((camp) => (
            <div
              key={camp.id}
              onClick={() => onSelectCampaign(camp)}
              className="group relative bg-slate-900/80 backdrop-blur-md border border-slate-800/80 hover:border-indigo-500/60 rounded-2xl p-6 shadow-xl hover:shadow-indigo-500/10 transition-all duration-200 hover:scale-[1.01] cursor-pointer flex flex-col justify-between overflow-hidden"
            >
              <div className="relative">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="font-bold text-xl text-white group-hover:text-indigo-400 transition-colors line-clamp-1">
                    {camp.name}
                  </h3>
                  {getRoleBadge(camp.role)}
                </div>

                <p className="text-sm text-slate-400 line-clamp-2 mb-4">
                  {camp.description || 'Nenhuma descrição fornecida.'}
                </p>

                <div className="space-y-2 mb-6">
                  <div className="flex items-center text-xs text-slate-400 space-x-2">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Sistema de Regras:</span>
                    <span className="font-medium text-slate-300">
                      {camp.active_ruleset_name || 'Regras Customizadas'}
                    </span>
                  </div>

                  <div className="flex items-center text-xs text-slate-400 space-x-2">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span>Participantes:</span>
                    <span className="font-medium text-slate-300">
                      {camp.member_count} {camp.member_count === 1 ? 'membro' : 'membros'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-indigo-400 font-semibold group-hover:translate-x-1 transition-transform">
                <span>Acessar Mesa e Fichas</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Criar Campanha */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-xl bg-slate-900/90 border border-slate-800/80 rounded-3xl p-8 shadow-2xl backdrop-blur-md relative">
            <h2 className="text-2xl font-bold text-white mb-2">Criar Nova Campanha</h2>
            <p className="text-sm text-slate-400 mb-6">
              Defina o nome da campanha e escolha o conjunto inicial de regras. Você poderá editar cada fórmula e atributo posteriormente.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-sm rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateCampaign} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Nome da Campanha
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: O Segredo na Floresta, Crônicas de Neo-Tóquio..."
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Descrição ou Sinopse
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Breve resumo da premissa ou universo..."
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Predefinição Inicial de Regras
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div
                    onClick={() => setPreset('investigacao')}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      preset === 'investigacao'
                        ? 'border-indigo-500 bg-indigo-950/40 text-white shadow-md shadow-indigo-500/20'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Skull className="w-5 h-5 text-rose-400 mb-2" />
                    <p className="font-bold text-sm">Investigação</p>
                    <p className="text-xs text-slate-400 mt-1">Horror, Sanidade, Perícias e 1d20 (estilo Paranormal/C.R.I.S.)</p>
                  </div>

                  <div
                    onClick={() => setPreset('cyberpunk')}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      preset === 'cyberpunk'
                        ? 'border-indigo-500 bg-indigo-950/40 text-white shadow-md shadow-indigo-500/20'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Cpu className="w-5 h-5 text-cyan-400 mb-2" />
                    <p className="font-bold text-sm">Cyberpunk</p>
                    <p className="text-xs text-slate-400 mt-1">Cromo, Reflexo, Bateria e paradas de 2d6</p>
                  </div>

                  <div
                    onClick={() => setPreset('fantasia_d20')}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      preset === 'fantasia_d20'
                        ? 'border-indigo-500 bg-indigo-950/40 text-white shadow-md shadow-indigo-500/20'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <ShieldAlert className="w-5 h-5 text-amber-400 mb-2" />
                    <p className="font-bold text-sm">Fantasia D20</p>
                    <p className="text-xs text-slate-400 mt-1">Atributos clássicos (FOR, DES, CON, INT, SAB, CAR)</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
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
          <div className="w-full max-w-md bg-slate-900/90 border border-slate-800/80 rounded-3xl p-8 shadow-2xl backdrop-blur-md relative">
            <h2 className="text-2xl font-bold text-white mb-2">Entrar em uma Campanha</h2>
            <p className="text-sm text-slate-400 mb-6">
              Digite o código alfanumérico fornecido pelo mestre da mesa.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-sm rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleJoinCampaign} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Código de Convite
                </label>
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Ex: A4F19B82"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-center font-mono tracking-widest text-lg"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
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
