import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Play, Pause, Plus, Trash2, Music, ExternalLink } from 'lucide-react';
import { api, AudioTrack } from '../services/api';

interface AudioManagerProps {
  campaignId: string;
  isMaster: boolean;
  isOpen: boolean;
  onClose: () => void;
  activeAudioEvent?: any;
}

export const AudioManager: React.FC<AudioManagerProps> = ({
  campaignId,
  isMaster,
  isOpen,
  onClose,
  activeAudioEvent
}) => {
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('arcanum_audio_volume');
    return saved !== null ? Number(saved) : 70;
  });
  const [isMuted, setIsMuted] = useState(false);
  const [isLoop, setIsLoop] = useState(true);

  // Modal para adicionar trilha
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const loadAudio = async () => {
    try {
      const data = await api.getAudioTracks(campaignId);
      setTracks(data.tracks || []);
      setCurrentTrack(data.currentTrack || null);
      setIsPlaying(data.currentTrack !== null);
    } catch (err) {
      console.error('Erro ao carregar trilhas:', err);
    }
  };

  useEffect(() => {
    loadAudio();
  }, [campaignId]);

  // Sincronização em tempo real via WebSocket
  useEffect(() => {
    if (!activeAudioEvent) return;
    const { type, track, trackId } = activeAudioEvent;

    if (type === 'audio:play' && track) {
      setCurrentTrack(track);
      setIsPlaying(true);
      setTracks(prev => prev.map(t => ({
        ...t,
        is_playing: t.id === track.id ? 1 : 0
      })));
    } else if (type === 'audio:pause') {
      setIsPlaying(false);
      setCurrentTrack(null);
      setTracks(prev => prev.map(t => ({ ...t, is_playing: 0 })));
    } else if (type === 'audio:track_added' && track) {
      setTracks(prev => {
        if (prev.some(t => t.id === track.id)) return prev;
        return [...prev, track];
      });
    } else if (type === 'audio:track_deleted' && trackId) {
      setTracks(prev => prev.filter(t => t.id !== trackId));
      if (currentTrack?.id === trackId) {
        setCurrentTrack(null);
        setIsPlaying(false);
      }
    }
  }, [activeAudioEvent]);

  // Salvar volume local
  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    localStorage.setItem('arcanum_audio_volume', String(newVol));
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const handlePlay = async (track: AudioTrack) => {
    if (!isMaster) return;
    try {
      const res = await api.playAudioTrack(campaignId, track.id);
      setCurrentTrack(res.track);
      setIsPlaying(true);
      setTracks(prev => prev.map(t => ({
        ...t,
        is_playing: t.id === track.id ? 1 : 0
      })));
    } catch (err: any) {
      alert(err.message || 'Erro ao iniciar reprodução.');
    }
  };

  const handlePause = async () => {
    if (!isMaster) return;
    try {
      await api.pauseAudioTrack(campaignId);
      setIsPlaying(false);
      setCurrentTrack(null);
      setTracks(prev => prev.map(t => ({ ...t, is_playing: 0 })));
    } catch (err: any) {
      alert(err.message || 'Erro ao pausar áudio.');
    }
  };

  const handleDelete = async (trackId: string) => {
    if (!isMaster) return;
    if (!confirm('Deseja remover esta trilha da biblioteca?')) return;
    try {
      await api.deleteAudioTrack(campaignId, trackId);
      setTracks(prev => prev.filter(t => t.id !== trackId));
      if (currentTrack?.id === trackId) {
        setCurrentTrack(null);
        setIsPlaying(false);
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir trilha.');
    }
  };

  const handleAddTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await api.addAudioTrack(campaignId, {
        title: newTitle.trim(),
        youtube_url: newUrl.trim()
      });
      setTracks(prev => [...prev, res.track]);
      setShowAddModal(false);
      setNewTitle('');
      setNewUrl('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Link inválido do YouTube.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Iframe do YouTube oculto que reproduz áudio sincronizado para todos
  const effectiveVolume = isMuted ? 0 : volume;
  const youtubeEmbedUrl = currentTrack && isPlaying && effectiveVolume > 0
    ? `https://www.youtube.com/embed/${currentTrack.youtube_video_id}?autoplay=1&controls=0&disablekb=1&fs=0&rel=0&loop=${isLoop ? 1 : 0}&playlist=${currentTrack.youtube_video_id}`
    : '';

  return (
    <>
      {/* Player de Áudio IFrame Oculto (Background) */}
      {youtubeEmbedUrl && (
        <div className="sr-only pointer-events-none" aria-hidden="true">
          <iframe
            ref={iframeRef}
            src={youtubeEmbedUrl}
            title="Arcanum Background Audio"
            allow="autoplay"
            className="w-1 h-1 opacity-0 pointer-events-none"
          />
        </div>
      )}

      {/* Drawer / Painel Lateral de Controle de Áudio */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-80 sm:w-96 bg-[#1a1816] border-l border-[#3a3530] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#131211] border-b border-[#3a3530]">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-[#2c2825] border border-[#3a3530] text-[#c9a04e]">
                <Music className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-serif font-bold text-[#ece3d0]">Trilha Sonora & Clima</h3>
                <p className="text-[10px] font-mono text-[#8a8578]">Áudio YouTube Sincronizado</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="px-2 py-1 text-xs font-mono text-[#8a8578] hover:text-[#ece3d0] hover:bg-[#2c2825] rounded transition-colors"
            >
              Fechar ✕
            </button>
          </div>

          {/* Player Ativo / Em Execução */}
          <div className="p-4 bg-[#131211]/60 border-b border-[#3a3530]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#8a8578]">
                {isPlaying ? '● Tocando Agora na Mesa' : '○ Nenhum Áudio Ativo'}
              </span>
              <button
                onClick={() => setIsLoop(!isLoop)}
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors ${
                  isLoop ? 'text-[#5a7a5a] bg-[#5a7a5a]/10 hover:bg-[#5a7a5a]/20' : 'text-[#8a8578] bg-[#2c2825] hover:text-[#ece3d0]'
                }`}
                title="Alternar repetição contínua"
              >
                {isLoop ? 'Repetição Contínua: Sim' : 'Repetição: Não'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0 pr-3">
                <p className="font-serif font-semibold text-sm text-[#ece3d0] truncate">
                  {currentTrack ? currentTrack.title : 'Silêncio na Mesa'}
                </p>
                {currentTrack && (
                  <p className="text-[11px] font-mono text-[#8a8578] flex items-center gap-1 mt-0.5">
                    Sugestão: {currentTrack.added_by_username || 'Aventureiro'}
                  </p>
                )}
              </div>

              {isMaster && (
                <div>
                  {isPlaying ? (
                    <button
                      onClick={handlePause}
                      className="p-2.5 bg-[#b24a52]/20 hover:bg-[#b24a52]/30 border border-[#b24a52]/40 text-[#b24a52] rounded-full transition-all"
                      title="Pausar Áudio na Mesa"
                    >
                      <Pause className="w-4 h-4" />
                    </button>
                  ) : (
                    currentTrack && (
                      <button
                        onClick={() => handlePlay(currentTrack)}
                        className="p-2.5 bg-[#5a7a5a]/20 hover:bg-[#5a7a5a]/30 border border-[#5a7a5a]/40 text-[#5a7a5a] rounded-full transition-all"
                        title="Retomar Reprodução"
                      >
                        <Play className="w-4 h-4 ml-0.5" />
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Controle de Volume Individual do Jogador */}
            <div className="mt-4 pt-3 border-t border-[#3a3530]/60">
              <div className="flex items-center justify-between text-xs text-[#8a8578] mb-1.5 font-mono">
                <span className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="hover:text-[#ece3d0] transition-colors"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-[#b24a52]" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-[#c9a04e]" />
                    )}
                  </button>
                  <span>Volume Pessoal:</span>
                </span>
                <span>{isMuted ? 'Mudo' : `${volume}%`}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={e => handleVolumeChange(Number(e.target.value))}
                className="w-full accent-[#c9a04e] bg-[#2c2825] h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* Lista de Trilhas da Campanha */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-mono text-[#8a8578] uppercase tracking-wider">
                Biblioteca de Trilhas ({tracks.length})
              </span>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-serif bg-[#c9a04e]/15 hover:bg-[#c9a04e]/25 text-[#c9a04e] border border-[#c9a04e]/30 rounded transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Sugerir Trilha</span>
              </button>
            </div>

            {tracks.length === 0 ? (
              <div className="py-12 text-center text-[#8a8578] border border-dashed border-[#3a3530] rounded-lg p-4">
                <Music className="w-8 h-8 text-[#3a3530] mx-auto mb-2" />
                <p className="font-serif text-[#ece3d0] text-xs">Nenhuma trilha cadastrada</p>
                <p className="text-[11px] text-[#8a8578] mt-1">
                  Adicione links de taverna, combate ou suspense do YouTube para criar a atmosfera da sessão.
                </p>
              </div>
            ) : (
              tracks.map(t => {
                const isThisPlaying = isPlaying && currentTrack?.id === t.id;
                return (
                  <div
                    key={t.id}
                    className={`p-3 rounded-lg border transition-all flex items-center justify-between gap-3 ${
                      isThisPlaying
                        ? 'bg-[#c9a04e]/10 border-[#c9a04e]/40 shadow-sm'
                        : 'bg-[#131211]/40 border-[#3a3530] hover:border-[#3a3530]/80'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-serif text-xs font-semibold text-[#ece3d0] truncate">
                          {t.title}
                        </span>
                        {isThisPlaying && (
                          <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#5a7a5a] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#5a7a5a]"></span>
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-[#8a8578] mt-0.5 truncate">
                        Por: {t.added_by_username || 'Mesa'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={t.youtube_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 text-[#8a8578] hover:text-[#ece3d0] transition-colors"
                        title="Abrir no YouTube"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      {isMaster && (
                        <>
                          {isThisPlaying ? (
                            <button
                              onClick={handlePause}
                              className="p-1.5 bg-[#b24a52]/20 hover:bg-[#b24a52]/30 text-[#b24a52] rounded border border-[#b24a52]/30 transition-colors"
                              title="Pausar"
                            >
                              <Pause className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handlePlay(t)}
                              className="p-1.5 bg-[#5a7a5a]/20 hover:bg-[#5a7a5a]/30 text-[#5a7a5a] rounded border border-[#5a7a5a]/30 transition-colors"
                              title="Tocar na Mesa"
                            >
                              <Play className="w-3.5 h-3.5 ml-0.5" />
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(t.id)}
                            className="p-1.5 text-[#8a8578] hover:text-[#b24a52] hover:bg-[#2c2825] rounded transition-colors"
                            title="Excluir Trilha"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Modal de Adicionar/Sugerir Trilha */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#1a1816] border border-[#3a3530] rounded-xl shadow-2xl p-5">
            <h3 className="font-serif text-base font-bold text-[#ece3d0] mb-1">
              Adicionar Trilha de Áudio (YouTube)
            </h3>
            <p className="text-xs text-[#8a8578] mb-4">
              Cole o link do YouTube com a trilha sonora ou efeito sonoro que deseja disponibilizar para a sessão.
            </p>

            {errorMsg && (
              <div className="mb-3 p-2.5 bg-[#b24a52]/15 border border-[#b24a52]/30 rounded text-xs text-[#b24a52]">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddTrack} className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-[#8a8578] mb-1 uppercase tracking-wider">
                  Título da Trilha
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Ex: Combate Épico no Fosso, Taverna Chuvosa"
                  required
                  className="w-full bg-[#131211] border border-[#3a3530] rounded px-3 py-2 text-xs text-[#ece3d0] focus:outline-none focus:border-[#c9a04e]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[#8a8578] mb-1 uppercase tracking-wider">
                  Link do YouTube
                </label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  required
                  className="w-full bg-[#131211] border border-[#3a3530] rounded px-3 py-2 text-xs text-[#ece3d0] focus:outline-none focus:border-[#c9a04e]"
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
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold bg-[#c9a04e] hover:bg-[#b0583e] text-[#131211] rounded transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Adicionando...' : 'Salvar Trilha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
