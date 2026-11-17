import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, Shield, Lock, User as UserIcon } from 'lucide-react';
import { api, CampaignWhisper, WhisperContact, User } from '../services/api';

interface WhisperDockProps {
  campaignId: string;
  currentUser: User;
  isMaster: boolean;
  activeWhisperEvent?: CampaignWhisper | null;
}

export const WhisperDock: React.FC<WhisperDockProps> = ({
  campaignId,
  currentUser,
  isMaster,
  activeWhisperEvent
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [whispers, setWhispers] = useState<CampaignWhisper[]>([]);
  const [contacts, setContacts] = useState<WhisperContact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Carregar sussurros da API
  const loadWhispers = async (contactId?: string) => {
    try {
      const data = await api.getWhispers(campaignId, contactId);
      setWhispers(data.whispers || []);
      if (data.contacts) {
        setContacts(data.contacts);
        const sumUnread = data.contacts.reduce((acc, c) => acc + (c.unread_count || 0), 0);
        setTotalUnread(sumUnread);
      } else {
        // Para jogador comum, conta as não lidas recebidas
        const unreadForPlayer = (data.whispers || []).filter(
          w => w.recipient_id === currentUser.id && w.is_read === 0
        ).length;
        setTotalUnread(unreadForPlayer);
      }
    } catch (err) {
      console.error('Erro ao carregar sussurros:', err);
    }
  };

  useEffect(() => {
    loadWhispers(selectedContactId || undefined);
  }, [campaignId, selectedContactId]);

  // Listener para evento em tempo real via WebSocket
  useEffect(() => {
    if (!activeWhisperEvent) return;
    const w = activeWhisperEvent;

    // Se a mensagem for relevante para esta janela
    const isCurrentConversation = isMaster
      ? selectedContactId && (w.sender_id === selectedContactId || w.recipient_id === selectedContactId)
      : true;

    if (isCurrentConversation) {
      setWhispers(prev => {
        if (prev.some(m => m.id === w.id)) return prev;
        return [...prev, w];
      });
      // Se a janela estiver aberta, marca como lido
      if (isOpen && w.recipient_id === currentUser.id) {
        api.markWhispersAsRead(campaignId, w.sender_id).catch(() => {});
      }
    } else {
      // Se não for a conversa atual, atualiza contatos e unread
      loadWhispers(selectedContactId || undefined);
    }

    if (!isOpen && w.recipient_id === currentUser.id) {
      setTotalUnread(prev => prev + 1);
    }
  }, [activeWhisperEvent]);

  // Auto-scroll ao receber novas mensagens
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [whispers, isOpen]);

  // Marcar como lido ao abrir conversa
  useEffect(() => {
    if (isOpen) {
      const otherUser = isMaster ? selectedContactId : undefined;
      if (otherUser) {
        api.markWhispersAsRead(campaignId, otherUser).then(() => {
          setContacts(prev => prev.map(c => c.user_id === otherUser ? { ...c, unread_count: 0 } : c));
        }).catch(() => {});
      } else if (!isMaster && whispers.some(w => w.recipient_id === currentUser.id && w.is_read === 0)) {
        // Encontra o remetente (o Mestre)
        const masterMsg = whispers.find(w => w.recipient_id === currentUser.id);
        if (masterMsg) {
          api.markWhispersAsRead(campaignId, masterMsg.sender_id).then(() => {
            setTotalUnread(0);
          }).catch(() => {});
        }
      }
    }
  }, [isOpen, selectedContactId, whispers.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || loading) return;

    const content = messageText.trim();
    setMessageText('');
    setLoading(true);

    try {
      const targetId = isMaster ? selectedContactId || undefined : undefined;
      const res = await api.sendWhisper(campaignId, {
        recipient_id: targetId,
        content
      });

      setWhispers(prev => [...prev, res.whisper]);
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar sussurro.');
    } finally {
      setLoading(false);
    }
  };

  const selectedContact = contacts.find(c => c.user_id === selectedContactId);

  return (
    <>
      {/* Botão Flutuante Discreto no Canto Inferior Direito */}
      <div className="fixed bottom-4 right-4 z-40">
        {!isOpen && (
          <button
            onClick={() => {
              setIsOpen(true);
              if (isMaster && contacts.length > 0 && !selectedContactId) {
                setSelectedContactId(contacts[0].user_id);
              }
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-[#1a1816]/90 hover:bg-[#2c2825] text-[#ece3d0] border border-[#3a3530] rounded-full shadow-lg backdrop-blur-md transition-all hover:scale-105 group"
            title="Sussurro Privado com o Mestre"
          >
            <div className="relative">
              <MessageSquare className="w-4 h-4 text-[#c9a04e] group-hover:text-[#5a7a5a] transition-colors" />
              {totalUnread > 0 && (
                <span className="absolute -top-1.5 -right-2 px-1.5 py-0.2 min-w-[16px] h-4 text-[10px] font-mono font-bold bg-[#b24a52] text-white rounded-full flex items-center justify-center animate-pulse">
                  {totalUnread}
                </span>
              )}
            </div>
            <span className="text-xs font-serif tracking-wide hidden sm:inline">
              {isMaster ? 'Sussurros da Mesa' : 'Sussurrar ao Mestre'}
            </span>
          </button>
        )}
      </div>

      {/* Popover Compacto de Chat Privado */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-80 sm:w-96 h-[480px] bg-[#1a1816] border border-[#3a3530] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#131211] border-b border-[#3a3530]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#2c2825] flex items-center justify-center text-[#c9a04e] border border-[#3a3530]">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-serif font-bold text-[#ece3d0] tracking-wide">
                  {isMaster ? 'Sussurros do Mestre' : 'Canal Secreto com o Mestre'}
                </h3>
                <p className="text-[10px] font-mono text-[#8a8578]">
                  {isMaster
                    ? (selectedContact ? `Com: ${selectedContact.username}` : 'Selecione um jogador')
                    : 'Apenas você e o Mestre veem esta conversa'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-[#8a8578] hover:text-[#ece3d0] hover:bg-[#2c2825] rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Abas de Contatos para o Mestre */}
          {isMaster && (
            <div className="flex items-center gap-1 px-2 py-1.5 bg-[#131211]/60 border-b border-[#3a3530] overflow-x-auto">
              {contacts.length === 0 ? (
                <span className="text-[11px] text-[#8a8578] italic px-2 py-1">Nenhum jogador na campanha</span>
              ) : (
                contacts.map(c => {
                  const isSelected = selectedContactId === c.user_id;
                  return (
                    <button
                      key={c.user_id}
                      onClick={() => setSelectedContactId(c.user_id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-sans transition-all whitespace-nowrap ${
                        isSelected
                          ? 'bg-[#c9a04e] text-[#131211] font-semibold'
                          : 'bg-[#2c2825] text-[#8a8578] hover:text-[#ece3d0] hover:bg-[#3a3530]'
                      }`}
                    >
                      <UserIcon className="w-3 h-3" />
                      <span>{c.username}</span>
                      {c.unread_count > 0 && (
                        <span className="px-1 text-[9px] font-mono font-bold bg-[#b24a52] text-white rounded-full">
                          {c.unread_count}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* Área de Mensagens */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2.5 bg-[#131211]/40 text-xs">
            {whispers.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-[#8a8578] px-4">
                <Shield className="w-8 h-8 text-[#3a3530] mb-2" />
                <p className="font-serif text-[#ece3d0] text-xs">Canal Criptografado de Sussurro</p>
                <p className="text-[11px] mt-1 text-[#8a8578]">
                  {isMaster
                    ? 'Inicie um diálogo privado com este jogador. Nenhum outro jogador na mesa terá acesso a estas mensagens.'
                    : 'Envie perguntas confidenciais, intenções de traição ou ações secretas diretamente para o Mestre.'}
                </p>
              </div>
            ) : (
              whispers.map(w => {
                const isMine = w.sender_id === currentUser.id;
                return (
                  <div
                    key={w.id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1 text-[10px] text-[#8a8578] mb-0.5 px-1">
                      <span className="font-serif">{isMine ? 'Você' : w.sender_username}</span>
                      <span>•</span>
                      <span className="font-mono">
                        {new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed ${
                        isMine
                          ? 'bg-[#c9a04e]/20 text-[#ece3d0] border border-[#c9a04e]/40 rounded-br-none'
                          : 'bg-[#2c2825] text-[#ece3d0] border border-[#3a3530] rounded-bl-none'
                      }`}
                    >
                      {w.content}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Formulário de Envio */}
          <form
            onSubmit={handleSend}
            className="p-2 bg-[#131211] border-t border-[#3a3530] flex items-center gap-1.5"
          >
            <input
              type="text"
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              placeholder={
                isMaster
                  ? (selectedContact ? `Sussurrar para ${selectedContact.username}...` : 'Selecione um jogador...')
                  : 'Sussurrar para o Mestre...'
              }
              disabled={isMaster && !selectedContactId}
              className="flex-1 bg-[#1a1816] text-[#ece3d0] text-xs px-3 py-2 rounded-lg border border-[#3a3530] focus:outline-none focus:border-[#c9a04e] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!messageText.trim() || loading || (isMaster && !selectedContactId)}
              className="p-2 bg-[#c9a04e] hover:bg-[#b0583e] disabled:opacity-50 text-[#131211] font-bold rounded-lg transition-colors flex items-center justify-center"
              title="Enviar sussurro"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
