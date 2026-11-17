import React, { useState, useEffect } from 'react';
import { Lock, Globe, Plus, Trash2, Edit3, BookOpen } from 'lucide-react';
import { api, CharacterLoreEntry, Character, User } from '../services/api';

interface CharacterLoreViewProps {
  campaignId: string;
  character: Character;
  currentUser: User;
  isMaster: boolean;
}

export const CharacterLoreView: React.FC<CharacterLoreViewProps> = ({
  campaignId,
  character,
  currentUser,
  isMaster
}) => {
  const [entries, setEntries] = useState<CharacterLoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<'private_gm' | 'public'>('private_gm');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const isOwner = character.user_id === currentUser.id;
  const canManage = isMaster || isOwner;

  const loadLore = async () => {
    try {
      setLoading(true);
      const res = await api.getCharacterLore(campaignId, character.id);
      setEntries(res.entries || []);
    } catch (err) {
      console.error('Erro ao carregar lore do personagem:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLore();
  }, [campaignId, character.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || submitting) return;

    setSubmitting(true);
    try {
      if (editingId) {
        const res = await api.updateCharacterLore(campaignId, character.id, editingId, {
          title: title.trim(),
          content,
          visibility
        });
        setEntries(prev => prev.map(item => item.id === editingId ? res.entry : item));
      } else {
        const res = await api.createCharacterLore(campaignId, character.id, {
          title: title.trim(),
          content,
          visibility
        });
        setEntries(prev => [res.entry, ...prev]);
      }
      setShowAddModal(false);
      setTitle('');
      setContent('');
      setVisibility('private_gm');
      setEditingId(null);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar registro de lore.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (entry: CharacterLoreEntry) => {
    setTitle(entry.title);
    setContent(entry.content);
    setVisibility(entry.visibility);
    setEditingId(entry.id);
    setShowAddModal(true);
  };

  const handleDelete = async (loreId: string) => {
    if (!confirm('Deseja excluir permanentemente este registro de lore?')) return;
    try {
      await api.deleteCharacterLore(campaignId, character.id, loreId);
      setEntries(prev => prev.filter(e => e.id !== loreId));
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir registro de lore.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header com Ação */}
      <div className="flex items-center justify-between pb-3 border-b border-[#3a3530]/60">
        <div>
          <h3 className="font-serif text-base font-bold text-[#ece3d0] flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#c9a04e]" />
            Crônicas, Origem & Lore
          </h3>
          <p className="text-xs font-mono text-[#8a8578] mt-0.5">
            Documentação de passado, pactos e segredos com privacidade estrita no banco de dados
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => {
              setEditingId(null);
              setTitle('');
              setContent('');
              setVisibility(isOwner ? 'private_gm' : 'public');
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-serif bg-[#c9a04e] hover:bg-[#b0583e] text-[#131211] font-semibold rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Crônica</span>
          </button>
        )}
      </div>

      {/* Lista de Registros */}
      {loading ? (
        <div className="py-12 text-center text-xs font-mono text-[#8a8578]">
          Consultando registros criptografados da crônica...
        </div>
      ) : entries.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-[#3a3530] rounded-lg p-6">
          <BookOpen className="w-8 h-8 text-[#3a3530] mx-auto mb-2" />
          <p className="font-serif text-sm text-[#ece3d0]">Nenhuma crônica registrada</p>
          <p className="text-xs text-[#8a8578] max-w-md mx-auto mt-1">
            {canManage
              ? 'Registre fatos do passado, segredos de linhagem ou acordos selados com o Mestre. Entradas marcadas como privadas são invisíveis para os outros jogadores.'
              : 'O passado deste personagem ainda não foi revelado publicamente à mesa.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => {
            const isPrivate = entry.visibility === 'private_gm';
            const canModifyThis = isMaster || isOwner || entry.author_user_id === currentUser.id;

            return (
              <div
                key={entry.id}
                className={`p-4 rounded-lg border transition-all ${
                  isPrivate
                    ? 'bg-[#1a1816]/80 border-[#c9a04e]/30 hover:border-[#c9a04e]/50'
                    : 'bg-[#1a1816]/40 border-[#3a3530] hover:border-[#3a3530]/80'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-serif font-bold text-sm text-[#ece3d0]">
                        {entry.title}
                      </h4>
                      {isPrivate ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[#c9a04e]/15 text-[#c9a04e] border border-[#c9a04e]/30">
                          <Lock className="w-3 h-3" />
                          Privado (Você e o Mestre)
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[#5a7a5a]/15 text-[#5a7a5a] border border-[#5a7a5a]/30">
                          <Globe className="w-3 h-3" />
                          Público (Toda a Mesa)
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-[#8a8578] mt-0.5">
                      Registrado por {entry.author_username || 'Aventureiro'} em{' '}
                      {new Date(entry.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {canModifyThis && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(entry)}
                        className="p-1.5 text-[#8a8578] hover:text-[#ece3d0] hover:bg-[#2c2825] rounded transition-colors"
                        title="Editar"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="p-1.5 text-[#8a8578] hover:text-[#b24a52] hover:bg-[#2c2825] rounded transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="text-xs leading-relaxed text-[#ece3d0]/90 font-sans whitespace-pre-wrap pl-2 border-l-2 border-[#3a3530]">
                  {entry.content}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Criação / Edição de Lore */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-[#1a1816] border border-[#3a3530] rounded-xl shadow-2xl p-5">
            <h3 className="font-serif text-base font-bold text-[#ece3d0] mb-1">
              {editingId ? 'Editar Crônica / Lore' : 'Novo Registro de Lore'}
            </h3>
            <p className="text-xs text-[#8a8578] mb-4">
              Defina o nível de privacidade: notas privadas jamais serão enviadas aos outros jogadores.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-[#8a8578] mb-1 uppercase tracking-wider">
                  Título da Crônica / Segredo
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ex: O Pacto com a Sombra, Antepassado Amaldiçoado"
                  required
                  className="w-full bg-[#131211] border border-[#3a3530] rounded px-3 py-2 text-xs text-[#ece3d0] focus:outline-none focus:border-[#c9a04e]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[#8a8578] mb-1 uppercase tracking-wider">
                  Nível de Visibilidade
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVisibility('private_gm')}
                    className={`flex items-start gap-2 p-2.5 rounded border text-left transition-all ${
                      visibility === 'private_gm'
                        ? 'bg-[#c9a04e]/20 border-[#c9a04e] text-[#ece3d0]'
                        : 'bg-[#131211] border-[#3a3530] text-[#8a8578] hover:border-[#3a3530]/80'
                    }`}
                  >
                    <Lock className="w-4 h-4 text-[#c9a04e] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-serif font-bold text-[#ece3d0]">Privado</p>
                      <p className="text-[10px] text-[#8a8578]">Apenas você e o Mestre</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVisibility('public')}
                    className={`flex items-start gap-2 p-2.5 rounded border text-left transition-all ${
                      visibility === 'public'
                        ? 'bg-[#5a7a5a]/20 border-[#5a7a5a] text-[#ece3d0]'
                        : 'bg-[#131211] border-[#3a3530] text-[#8a8578] hover:border-[#3a3530]/80'
                    }`}
                  >
                    <Globe className="w-4 h-4 text-[#5a7a5a] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-serif font-bold text-[#ece3d0]">Público</p>
                      <p className="text-[10px] text-[#8a8578]">Visível para toda a mesa</p>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-[#8a8578] mb-1 uppercase tracking-wider">
                  Conteúdo da Narrativa
                </label>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Escreva os detalhes, nomes, pistas e eventos..."
                  rows={6}
                  className="w-full bg-[#131211] border border-[#3a3530] rounded px-3 py-2 text-xs text-[#ece3d0] focus:outline-none focus:border-[#c9a04e] leading-relaxed resize-y"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#3a3530]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-[#8a8578] hover:text-[#ece3d0]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold bg-[#c9a04e] hover:bg-[#b0583e] text-[#131211] rounded transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : 'Salvar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
