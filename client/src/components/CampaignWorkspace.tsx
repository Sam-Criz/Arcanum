import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Campaign, User, Ruleset, CharacterTemplate, Character, 
  RollResult, api 
} from '../services/api';
import { 
  Dices, Shield, Sparkles, UserPlus, 
  Send, Copy, Check, MessageSquare, Terminal, Eye, EyeOff, Plus, 
  Package, LayoutTemplate, Map as MapIcon, Skull, BookOpen, Headphones
} from 'lucide-react';
import { InventoryView } from './InventoryView';
import { CatalogManager } from './CatalogManager';
import { TemplateEditor } from './TemplateEditor';
import { VirtualTabletop } from './VirtualTabletop';
import { BestiaryManager } from './BestiaryManager';

interface CampaignWorkspaceProps {
  campaign: Campaign;
  user: User;
  onBack: () => void;
}

export const CampaignWorkspace: React.FC<CampaignWorkspaceProps> = ({
  campaign,
  user,
  onBack
}) => {
  const [activeTab, setActiveTabState] = useState<'vtt' | 'sheets' | 'inventory' | 'catalog' | 'bestiary' | 'templates' | 'rules' | 'roller' | 'chat'>(() => {
    const hashMatch = window.location.hash.match(/tab=([^&]+)/);
    const hashTab = hashMatch ? (hashMatch[1] as any) : null;
    const saved = hashTab || localStorage.getItem(`arcanum_active_tab_${campaign.id}`);
    const validTabs = ['vtt', 'sheets', 'inventory', 'catalog', 'bestiary', 'templates', 'rules', 'roller', 'chat'];
    return (saved && validTabs.includes(saved)) ? (saved as any) : 'vtt';
  });

  const setActiveTab = (tab: 'vtt' | 'sheets' | 'inventory' | 'catalog' | 'bestiary' | 'templates' | 'rules' | 'roller' | 'chat') => {
    setActiveTabState(tab);
    localStorage.setItem(`arcanum_active_tab_${campaign.id}`, tab);
    window.location.hash = `campaign=${campaign.id}&tab=${tab}`;
  };

  const [ruleset, setRuleset] = useState<Ruleset | null>(null);
  const [templates, setTemplates] = useState<CharacterTemplate[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [lastVttEvent, setLastVttEvent] = useState<any>(null);

  const [currentRole, setCurrentRole] = useState<string>(campaign.role || 'player');
  const isMaster = currentRole === 'owner' || currentRole === 'master' || currentRole === 'assistant';
  const isMasterRef = useRef(isMaster);
  useEffect(() => {
    isMasterRef.current = isMaster;
  }, [isMaster]);

  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const isMountedRef = useRef(true);
  const toastTimerRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  // Invite states
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Formula test state
  const [testFormula, setTestFormula] = useState('');
  const [validationResult, setValidationResult] = useState<{ isValid: boolean; error?: string; variables: string[] } | null>(null);
  const [testRollResult, setTestRollResult] = useState<RollResult | null>(null);

  // Quick dice roller state
  const [diceExpr, setDiceExpr] = useState('1d20');
  const [isSecretRoll, setIsSecretRoll] = useState(false);
  const [rollHistory, setRollHistory] = useState<any[]>([]);
  const [unreadRollCount, setUnreadRollCount] = useState<number>(0);
  const [secretRollToast, setSecretRollToast] = useState<{ author: string; characterName?: string; expression: string; total: number; id: string } | null>(null);

  // Sincronização em tempo real de inventário
  const [inventoryRefreshTrigger, setInventoryRefreshTrigger] = useState<number>(0);

  // Create character modal
  const [showCreateCharModal, setShowCreateCharModal] = useState(false);
  const [newCharName, setNewCharName] = useState('');
  const [newCharAttributes, setNewCharAttributes] = useState<Record<string, number>>({});

  // Chat & WebSocket state
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const vttListenersRef = useRef<Set<(msg: any) => void>>(new Set());
  const subscribeVtt = useCallback((listener: (msg: any) => void) => {
    vttListenersRef.current.add(listener);
    return () => {
      vttListenersRef.current.delete(listener);
    };
  }, []);

  // Carregar dados da campanha
  useEffect(() => {
    isMountedRef.current = true;
    loadCampaignData();
    setupWebSocket();

    return () => {
      isMountedRef.current = false;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [campaign.id]);

  const loadCampaignData = async () => {
    try {
      const details = await api.getCampaignDetails(campaign.id);
      if (details.role) {
        setCurrentRole(details.role);
      }
      setRuleset(details.ruleset);

      const chars = await api.getCharacters(campaign.id);
      setCharacters(chars);

      // LÓGICA DE SELEÇÃO AUTOMÁTICA DE PERSONAGEM (Requisito 7.2)
      setSelectedCharacter(prev => {
        const userChars = chars.filter(c => c.user_id === user.id);
        const storageKey = `arcanum_selected_char_${user.id}_${campaign.id}`;
        const savedCharId = localStorage.getItem(storageKey);

        // Se já havia um personagem selecionado previamente
        if (prev) {
          const fresh = chars.find(c => c.id === prev.id);
          if (fresh) {
            // Se o usuário for jogador comum e o personagem não pertencer a ele
            if (!isMaster && fresh.user_id !== user.id) {
              if (userChars.length === 1) {
                localStorage.setItem(storageKey, userChars[0].id);
                return userChars[0];
              }
              if (userChars.length > 1) {
                const match = userChars.find(c => c.id === savedCharId) || userChars[0];
                localStorage.setItem(storageKey, match.id);
                return match;
              }
              return null;
            }
            return fresh;
          }
        }

        // Seleção inicial ou após atualização
        if (!isMaster) {
          // 1. Jogador comum com 1 personagem -> seleciona automaticamente
          if (userChars.length === 1) {
            localStorage.setItem(storageKey, userChars[0].id);
            return userChars[0];
          }
          // 2. Jogador com múltiplos personagens -> restaura última escolha válida ou primeiro próprio
          if (userChars.length > 1) {
            const match = userChars.find(c => c.id === savedCharId) || userChars[0];
            localStorage.setItem(storageKey, match.id);
            return match;
          }
          // 3. Jogador com 0 personagens -> NUNCA seleciona o de outro jogador
          return null;
        } else {
          // Mestre: pode inspecionar qualquer personagem
          if (savedCharId) {
            const match = chars.find(c => c.id === savedCharId);
            if (match) return match;
          }
          if (userChars.length > 0) return userChars[0];
          return chars.length > 0 ? chars[0] : null;
        }
      });

      const tmpls = await api.getTemplates(campaign.id);
      setTemplates(tmpls);

      try {
        const rolls = await api.getRollHistory(campaign.id);
        setRollHistory(rolls);
      } catch (e) {
        console.error('Erro ao carregar histórico de rolagens:', e);
      }

      // Inicializar atributos padrão para o modal de criação
      if (details.ruleset) {
        const defaults: Record<string, number> = {};
        for (const attr of details.ruleset.config.attributes) {
          if (!attr.isDerived) {
            defaults[attr.name] = attr.defaultValue;
          }
        }
        setNewCharAttributes(defaults);
      }
    } catch (err) {
      console.error('Erro ao carregar dados da campanha:', err);
    }
  };

  const syncRollHistory = async () => {
    try {
      const rolls = await api.getRollHistory(campaign.id);
      if (!isMountedRef.current) return;
      setRollHistory(prev => {
        const map = new window.Map<string, any>();
        rolls.forEach(r => map.set(r.id, r));
        prev.forEach(r => {
          if (!map.has(r.id)) map.set(r.id, r);
        });
        return Array.from(map.values()).sort((a: any, b: any) => {
          const timeA = new Date(a.createdAt || a.timestamp || a.created_at || 0).getTime();
          const timeB = new Date(b.createdAt || b.timestamp || b.created_at || 0).getTime();
          return timeB - timeA;
        });
      });
    } catch (e) {
      console.error('Erro ao sincronizar histórico de rolagens:', e);
    }
  };

  const setupWebSocket = () => {
    if (!isMountedRef.current) return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Handshake autenticado na sala da campanha
      const token = api.getToken();
      if (token) {
        ws.send(JSON.stringify({
          type: 'auth',
          token,
          campaignId: campaign.id
        }));
      }
      syncRollHistory();
      vttListenersRef.current.forEach(listener => {
        try { listener({ type: 'vtt:resync' }); } catch (e) { console.error(e); }
      });
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'chat:message') {
          setMessages(prev => [...prev, msg]);
        } else if (msg.type === 'dice:rolled') {
          // Deduplicação estrita e atualização de rolagens
          setRollHistory(prev => {
            const exists = prev.some(r => r.id === msg.roll.id);
            if (exists) {
              return prev.map(r => r.id === msg.roll.id ? { ...r, ...msg.roll } : r);
            }
            return [msg.roll, ...prev];
          });

          // Notificação em tempo real de rolagem secreta para mestre autorizado
          // Utiliza isMasterRef para evitar stale closures
          if (msg.roll?.isSecret && isMasterRef.current) {
            setSecretRollToast({
              author: msg.roll.username || 'Jogador',
              characterName: msg.roll.characterName,
              expression: msg.roll.expression,
              total: msg.roll.total,
              id: msg.roll.id
            });
            if (toastTimerRef.current) {
              clearTimeout(toastTimerRef.current);
            }
            toastTimerRef.current = setTimeout(() => {
              setSecretRollToast(null);
            }, 8000);
          }

          if (activeTabRef.current !== 'roller') {
            setUnreadRollCount(prev => prev + 1);
          }
        } else if (msg.type === 'character:updated') {
          if (msg.character) {
            setCharacters(prev => prev.map(c => c.id === msg.character.id ? msg.character : c));
            setSelectedCharacter(prev => prev?.id === msg.character.id ? msg.character : prev);
          }
        } else if (msg.type === 'character:created') {
          loadCampaignData();
        } else if (msg.type === 'inventory:updated') {
          if (msg.character) {
            setCharacters(prev => prev.map(c => c.id === msg.character.id ? msg.character : c));
            setSelectedCharacter(prev => prev?.id === msg.character.id ? msg.character : prev);
          }
          // Aciona atualização reativa imediata no inventário
          setInventoryRefreshTrigger(prev => prev + 1);
        } else if (msg.type === 'inventory:transferred') {
          setInventoryRefreshTrigger(prev => prev + 1);
          loadCampaignData();
        } else if (
          msg.type.startsWith('scene:') ||
          msg.type.startsWith('token:') ||
          msg.type.startsWith('fog:') ||
          msg.type.startsWith('combat:')
        ) {
          setLastVttEvent(msg);
          vttListenersRef.current.forEach(listener => {
            try { listener(msg); } catch (e) { console.error(e); }
          });
        }
      } catch (err) {
        console.error('Erro ao processar mensagem do websocket:', err);
      }
    };

    ws.onclose = () => {
      if (isMountedRef.current) {
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setupWebSocket();
          }
        }, 3000);
      }
    };
  };

  const handleGenerateInvite = async () => {
    try {
      const res = await api.createInvite(campaign.id, 'player');
      setInviteCode(res.invite.code);
    } catch (err) {
      console.error('Erro ao gerar convite:', err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const handleValidateFormula = async (expr: string) => {
    setTestFormula(expr);
    if (!expr.trim()) {
      setValidationResult(null);
      return;
    }
    try {
      const res = await api.validateFormula(campaign.id, expr);
      setValidationResult(res);
    } catch (err: any) {
      setValidationResult({ isValid: false, error: err.message, variables: [] });
    }
  };

  const handleExecuteTestRoll = async () => {
    if (!testFormula.trim()) return;
    try {
      // Coletar variáveis da ficha selecionada, se houver
      const vars: Record<string, number> = {};
      if (selectedCharacter) {
        for (const [k, v] of Object.entries(selectedCharacter.computed_data)) {
          if (typeof v === 'number') vars[k] = v;
        }
      }
      const res = await api.rollDice(campaign.id, {
        expression: testFormula,
        variables: vars,
        characterId: selectedCharacter?.id,
        isSecret: isSecretRoll
      });
      if (res.isSecret && !isMaster) {
        setTestRollResult({
          id: res.id,
          total: '?' as any,
          breakdown: { expression: testFormula, diceRolls: [], variablesUsed: {} },
          isSecret: true
        });
      } else {
        setTestRollResult(res);
      }

      setRollHistory(prev => {
        const entry = (res.isSecret && !isMaster) ? {
          id: res.id,
          username: user.username,
          characterName: selectedCharacter?.name,
          expression: testFormula,
          isSecret: true,
          total: '?',
          message: 'Rolagem Secreta enviada ao Mestre',
          createdAt: new Date().toISOString()
        } : {
          ...res,
          characterName: selectedCharacter?.name || res.characterName
        };

        if (prev.some(r => r.id === res.id)) {
          return prev.map(r => r.id === res.id ? { ...r, ...entry } : r);
        }
        return [entry, ...prev];
      });
    } catch (err: any) {
      alert(`Erro na rolagem: ${err.message}`);
    }
  };

  const handleQuickRoll = async (expr: string) => {
    try {
      const vars: Record<string, number> = {};
      if (selectedCharacter) {
        for (const [k, v] of Object.entries(selectedCharacter.computed_data)) {
          if (typeof v === 'number') vars[k] = v;
        }
      }
      const res = await api.rollDice(campaign.id, {
        expression: expr,
        variables: vars,
        characterId: selectedCharacter?.id,
        isSecret: isSecretRoll
      });
      if (res.isSecret && !isMaster) {
        const secretEntry = {
          id: res.id,
          username: user.username,
          characterName: selectedCharacter?.name,
          expression: expr,
          isSecret: true,
          total: '?',
          message: 'Rolagem Secreta enviada ao Mestre',
          createdAt: new Date().toISOString()
        };
        setRollHistory(prev => {
          if (prev.some(r => r.id === res.id)) {
            return prev.map(r => r.id === res.id ? { ...r, ...secretEntry } : r);
          }
          return [secretEntry, ...prev];
        });
      } else {
        const entry = {
          ...res,
          characterName: selectedCharacter?.name || res.characterName
        };
        setRollHistory(prev => {
          if (prev.some(r => r.id === res.id)) {
            return prev.map(r => r.id === res.id ? { ...r, ...entry } : r);
          }
          return [entry, ...prev];
        });
      }
    } catch (err: any) {
      alert(`Erro na rolagem: ${err.message}`);
    }
  };

  const handleAttributeRoll = (attrName: string) => {
    if (!ruleset) return;
    const defaultDice = ruleset.config.defaultDice || '1d20';
    handleQuickRoll(`${defaultDice} + ${attrName}`);
  };

  const handleCreateCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCharName.trim()) return;

    try {
      const newChar = await api.createCharacter(campaign.id, {
        name: newCharName.trim(),
        templateId: selectedTemplateId || undefined,
        rawData: newCharAttributes
      });
      setCharacters(prev => [...prev, newChar]);
      setSelectedCharacter(newChar);
      const storageKey = `arcanum_selected_char_${user.id}_${campaign.id}`;
      localStorage.setItem(storageKey, newChar.id);
      setShowCreateCharModal(false);
      setNewCharName('');
    } catch (err: any) {
      alert(`Erro ao criar personagem: ${err.message}`);
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !wsRef.current) return;

    wsRef.current.send(JSON.stringify({
      type: 'chat:send',
      text: chatInput.trim()
    }));
    setChatInput('');
  };

  const navItems = [
    { id: 'vtt', label: 'Mesa', icon: MapIcon },
    { id: 'sheets', label: 'Fichas', icon: Shield },
    { id: 'inventory', label: 'Mochila', icon: Package },
    { id: 'roller', label: 'Rolagens', icon: Dices, badge: unreadRollCount > 0 ? unreadRollCount : undefined },
    { id: 'catalog', label: 'Catálogo', icon: Sparkles },
    { id: 'bestiary', label: 'Bestiário', icon: Skull },
    { id: 'templates', label: 'Modelos', icon: LayoutTemplate, count: templates.length },
    { id: 'rules', label: 'Regras', icon: Terminal },
    { id: 'chat', label: 'Chat', icon: MessageSquare, count: messages.length },
    { id: 'lore', label: 'Lore', icon: BookOpen, disabled: true, sublabel: 'em breve' },
    { id: 'audio', label: 'Áudio', icon: Headphones, disabled: true, sublabel: 'em breve' },
  ];

  return (
    <div className="flex h-[calc(100vh-65px)] overflow-hidden bg-[#131211] text-[#ece3d0]">
      {/* Menu Lateral Estilo Arcanum / Apple Glass */}
      <aside className="w-20 md:w-24 shrink-0 bg-[#1a1816]/95 border-r border-[#2c2825] flex flex-col items-center py-4 space-y-1.5 overflow-y-auto z-30 select-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isDisabled = item.disabled;

          return (
            <button
              key={item.id}
              disabled={isDisabled}
              onClick={() => {
                if (!isDisabled) {
                  setActiveTab(item.id as any);
                  if (item.id === 'roller') setUnreadRollCount(0);
                }
              }}
              className={`w-16 md:w-20 py-2.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all duration-200 group relative ${
                isDisabled
                  ? 'opacity-40 cursor-not-allowed text-[#a89984]'
                  : isActive
                    ? 'bg-[#2c2825] text-[#c9a04e] border-l-2 border-[#c9a04e] shadow-sm'
                    : 'text-[#a89984] hover:text-[#ece3d0] hover:bg-[#2c2825]/60 hover:scale-[1.03] active:scale-[0.97]'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 mb-1 transition-colors ${
                  isActive ? 'text-[#c9a04e]' : 'text-[#a89984] group-hover:text-[#ece3d0]'
                }`} />
                {item.badge && (
                  <span className="absolute -top-1 -right-2 px-1.5 py-0.2 bg-[#b24a52] text-white text-[9px] font-bold rounded-full font-mono animate-pulse">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] font-medium tracking-tight text-center truncate w-full ${
                isActive ? 'text-[#c9a04e] font-semibold' : 'text-[#a89984] group-hover:text-[#ece3d0]'
              }`}>
                {item.label}
              </span>
              {item.sublabel && (
                <span className="text-[9px] text-[#a89984]/70 leading-none">
                  {item.sublabel}
                </span>
              )}
            </button>
          );
        })}
      </aside>

      {/* Área Central / Conteúdo Reativo */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        {/* Notificação Flutuante de Rolagem Secreta para o Mestre */}
        {secretRollToast && (
          <div className="fixed top-5 right-5 z-50 bg-[#1a1816]/95 border-2 border-[#c9a04e] rounded-2xl p-4 shadow-2xl backdrop-blur-md flex items-center space-x-3 max-w-sm animate-bounce-short">
            <div className="w-10 h-10 rounded-xl bg-[#c9a04e]/20 border border-[#c9a04e]/50 flex items-center justify-center text-[#c9a04e] shrink-0">
              <Dices className="w-5 h-5 animate-spin" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold text-[#c9a04e] uppercase tracking-wider block">🎲 Rolagem Secreta Recebida</span>
              <p className="text-xs text-[#ece3d0] font-medium truncate">
                <strong>{secretRollToast.author}</strong>
                {secretRollToast.characterName ? ` (${secretRollToast.characterName})` : ''}: {secretRollToast.expression} = <span className="font-bold text-[#c9a04e] text-sm">{secretRollToast.total}</span>
              </p>
            </div>
            <button
              onClick={() => {
                setActiveTab('roller');
                setUnreadRollCount(0);
                setSecretRollToast(null);
              }}
              className="px-3 py-1.5 bg-[#c9a04e] hover:bg-[#c9a04e]/90 text-[#131211] font-bold rounded-xl text-xs shrink-0 transition-all shadow-md"
            >
              Ver
            </button>
          </div>
        )}

        {/* Top Bar da Campanha */}
        <div className="bg-[#1a1816]/90 backdrop-blur-md border border-[#2c2825] rounded-2xl p-5 mb-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <button
                onClick={onBack}
                className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-[#2c2825] hover:bg-[#2c2825]/80 text-[#ece3d0] border border-[#2c2825] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                ← Voltar às Campanhas
              </button>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#c9a04e]/15 text-[#c9a04e] border border-[#c9a04e]/30">
                {ruleset?.config.systemName || 'Sistema Customizado'}
              </span>
            </div>
            <h1 className="text-2xl font-black text-[#ece3d0] font-serif">{campaign.name}</h1>
            <p className="text-xs text-[#a89984] mt-0.5">{campaign.description || 'Ambiente ativo com isolamento de regras.'}</p>
          </div>

          {/* Ações de Mestre / Convite */}
          <div className="flex items-center space-x-3">
            {inviteCode ? (
              <div className="flex items-center space-x-2 bg-[#131211] px-3 py-1.5 rounded-xl border border-[#c9a04e]/50 backdrop-blur-sm">
                <span className="text-xs text-[#a89984]">Código:</span>
                <span className="font-mono text-sm font-bold text-[#c9a04e]">{inviteCode}</span>
                <button
                  onClick={() => copyToClipboard(inviteCode)}
                  className="p-1 text-[#a89984] hover:text-[#ece3d0] transition-colors"
                  title="Copiar código"
                >
                  {copiedInvite ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            ) : (
              <button
                onClick={handleGenerateInvite}
                className="flex items-center space-x-2 px-3.5 py-2 bg-[#2c2825] hover:bg-[#2c2825]/80 text-[#ece3d0] border border-[#2c2825] rounded-xl text-xs font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                <UserPlus className="w-4 h-4 text-[#c9a04e]" />
                <span>Gerar Convite</span>
              </button>
            )}

            <button
              onClick={() => setShowCreateCharModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-[#c9a04e] hover:bg-[#c9a04e]/90 text-[#131211] font-bold rounded-xl text-xs shadow-lg shadow-[#c9a04e]/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Personagem</span>
            </button>
          </div>
        </div>

      {/* CONTEÚDO DA TAB 1: FICHAS & PERSONAGENS (SEGUNDA DIREÇÃO VISUAL ARCANUM) */}
      {activeTab === 'sheets' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Coluna 1 (Esquerda): Lista de Personagens */}
          <div className="lg:col-span-3 bg-[#1a1816] border border-[#2c2825] rounded-lg p-4 h-fit shadow-xl">
            <div className="flex items-center justify-between mb-3 px-1 border-b border-[#2c2825] pb-2">
              <h3 className="font-serif text-lg font-bold text-[#ece3d0]">Personagens</h3>
              <span className="text-xs bg-[#2c2825] px-2 py-0.5 rounded text-[#aaa292] font-mono">{characters.length}</span>
            </div>

            {characters.length === 0 ? (
              <div className="text-center py-8 text-[#aaa292] text-xs">
                Nenhum personagem criado ainda.
              </div>
            ) : (
              <div className="space-y-1.5">
                {characters.map((char) => {
                  const isMine = char.user_id === user.id;
                  const isSelected = selectedCharacter?.id === char.id;
                  const initial = char.name.charAt(0).toUpperCase();

                  return (
                    <div
                      key={char.id}
                      onClick={() => {
                        setSelectedCharacter(char);
                        if (isMaster || isMine) {
                          const storageKey = `arcanum_selected_char_${user.id}_${campaign.id}`;
                          localStorage.setItem(storageKey, char.id);
                        }
                      }}
                      className={`flex items-center space-x-3 p-2.5 rounded cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#2c2825] border-l-2 border-[#c9a04e] text-[#ece3d0]'
                          : 'hover:bg-[#2c2825]/50 text-[#aaa292] hover:text-[#ece3d0]'
                      }`}
                    >
                      <div className="w-9 h-9 rounded border border-[#574e45] bg-[#131211] flex items-center justify-center font-serif text-lg font-bold text-[#c9a04e] shrink-0">
                        {initial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-serif text-base leading-snug truncate ${isSelected ? 'text-[#ece3d0] font-bold' : 'text-[#ece3d0]'}`}>
                          {char.name}
                        </p>
                        <p className="text-[11px] text-[#aaa292] truncate font-mono">
                          {isMine ? 'Seu personagem' : `De ${char.owner_username || 'Jogador'}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => setShowCreateCharModal(true)}
              className="w-full mt-4 py-2 border border-[#574e45] hover:border-[#c9a04e] text-xs font-serif text-[#ece3d0] hover:text-[#c9a04e] rounded transition-colors text-center"
            >
              Novo personagem
            </button>
          </div>

          {/* Coluna 2 (Centro): Ficha Principal */}
          <div className="lg:col-span-6 space-y-6">
            {selectedCharacter ? (
              <>
                {/* Cartão de Identificação do Personagem */}
                <div className="bg-[#1a1816] border border-[#2c2825] rounded-lg p-6 shadow-xl relative">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-14 h-14 rounded border border-[#574e45] bg-[#131211] flex items-center justify-center font-serif text-2xl font-bold text-[#c9a04e] shrink-0">
                        {selectedCharacter.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-3xl font-serif font-bold text-[#ece3d0] leading-tight">
                          {selectedCharacter.name}
                        </h2>
                        <p className="text-xs text-[#aaa292] mt-0.5">
                          Jogador: <span className="text-[#ece3d0]">{selectedCharacter.owner_username || user.username}</span> · Modelo: {ruleset?.config.systemName || 'Aventureiro'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => setActiveTab('inventory')}
                        className="px-3.5 py-1.5 bg-[#c9a04e] hover:bg-[#c9a04e]/90 text-[#131211] font-bold rounded text-xs transition-colors shadow-sm"
                      >
                        Abrir mochila
                      </button>
                    </div>
                  </div>

                  {/* Banner de Condições Ativas */}
                  {selectedCharacter.conditions && selectedCharacter.conditions.length > 0 && (
                    <div className="mt-4 p-2.5 bg-[#2c2825] border border-[#9a83c6]/40 rounded flex items-center space-x-2 text-xs">
                      <span className="font-serif font-bold text-[#9a83c6]">
                        {typeof selectedCharacter.conditions[0] === 'object' ? selectedCharacter.conditions[0].name : selectedCharacter.conditions[0]}
                      </span>
                      <span className="text-[#aaa292] text-[11px]">
                        2 turnos restantes. Causa dano no início de cada turno.
                      </span>
                    </div>
                  )}
                </div>

                {/* Bloco de Recursos (Vida, Mana, Carga) */}
                <div className="bg-[#1a1816] border border-[#2c2825] rounded-lg p-6 shadow-xl">
                  <h3 className="font-serif text-lg text-[#ece3d0] mb-3">Recursos</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Vida */}
                    <div className="bg-[#131211] border border-[#2c2825] p-3 rounded">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-xs text-[#aaa292] font-mono">Vida</span>
                        <span className="font-mono text-lg font-bold text-[#ece3d0]">
                          {selectedCharacter.computed_data.vida_atual ?? 36} <span className="text-xs text-[#aaa292]">/ {selectedCharacter.computed_data.vida_max ?? 50}</span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#2c2825] rounded-full overflow-hidden mb-1">
                        <div className="h-full bg-[#b24a52] rounded-full" style={{ width: '72%' }} />
                      </div>
                      <span className="text-[10px] text-[#aaa292]">Máximo = 10 + Constituição × 2</span>
                    </div>

                    {/* Mana */}
                    <div className="bg-[#131211] border border-[#2c2825] p-3 rounded">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-xs text-[#aaa292] font-mono">Mana</span>
                        <span className="font-mono text-lg font-bold text-[#ece3d0]">
                          {selectedCharacter.computed_data.mana_atual ?? 5} <span className="text-xs text-[#aaa292]">/ {selectedCharacter.computed_data.mana_max ?? 20}</span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#2c2825] rounded-full overflow-hidden mb-1">
                        <div className="h-full bg-[#6f93ad] rounded-full" style={{ width: '25%' }} />
                      </div>
                      <span className="text-[10px] text-[#aaa292]">Máximo = 10 + Inteligência</span>
                    </div>

                    {/* Carga */}
                    <div className="bg-[#131211] border border-[#2c2825] p-3 rounded">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-xs text-[#aaa292] font-mono">Carga</span>
                        <span className="font-mono text-lg font-bold text-[#ece3d0]">
                          18 <span className="text-xs text-[#aaa292]">/ 28 kg</span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#2c2825] rounded-full overflow-hidden mb-1">
                        <div className="h-full bg-[#c9a04e] rounded-full" style={{ width: '64%' }} />
                      </div>
                      <span className="text-[10px] text-[#aaa292]">Calculada a partir da mochila</span>
                    </div>
                  </div>
                </div>

                {/* Bloco de Atributos */}
                <div className="bg-[#1a1816] border border-[#2c2825] rounded-lg p-6 shadow-xl">
                  <h3 className="font-serif text-lg text-[#ece3d0] mb-3">Atributos</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {ruleset?.config.attributes.map((attr) => {
                      const val = selectedCharacter.computed_data[attr.id] !== undefined
                        ? selectedCharacter.computed_data[attr.id]
                        : selectedCharacter.computed_data[attr.name] || attr.defaultValue;
                      const mod = Math.floor((Number(val) - 10) / 2);

                      return (
                        <div
                          key={attr.id}
                          onClick={() => handleAttributeRoll(attr.name)}
                          className="bg-[#131211] border border-[#2c2825] hover:border-[#c9a04e] p-3 rounded text-center cursor-pointer transition-colors group"
                        >
                          <span className="text-xs text-[#aaa292] block">{attr.name}</span>
                          <span className="font-serif text-3xl font-bold text-[#ece3d0] group-hover:text-[#c9a04e] my-0.5 block">
                            {val}
                          </span>
                          <span className="text-[10px] font-mono text-[#aaa292] block">
                            mod {mod >= 0 ? `+${mod}` : mod}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Defesas Calculadas */}
                  <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[#2c2825]">
                    <div className="p-2.5 bg-[#131211] border border-dashed border-[#574e45] rounded flex items-center justify-between">
                      <span className="text-xs text-[#aaa292]">Defesa, calculada</span>
                      <span className="font-mono text-lg font-bold text-[#ece3d0]">16</span>
                    </div>
                    <div className="p-2.5 bg-[#131211] border border-dashed border-[#574e45] rounded flex items-center justify-between">
                      <span className="text-xs text-[#aaa292]">Iniciativa, calculada</span>
                      <span className="font-mono text-lg font-bold text-[#ece3d0]">+3</span>
                    </div>
                    <div className="p-2.5 bg-[#131211] border border-dashed border-[#574e45] rounded flex items-center justify-between">
                      <span className="text-xs text-[#aaa292]">Redução de dano</span>
                      <span className="font-mono text-lg font-bold text-[#ece3d0]">1</span>
                    </div>
                  </div>
                </div>

                {/* Fórmulas da Campanha */}
                <div className="bg-[#1a1816] border border-[#2c2825] rounded-lg p-6 shadow-xl">
                  <h3 className="font-serif text-lg text-[#ece3d0] mb-3">Fórmulas da campanha</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div 
                      onClick={() => handleQuickRoll('1d20 + floor((Forca - 10) / 2)')}
                      className="p-3 bg-[#131211] border border-[#2c2825] hover:border-[#c9a04e] rounded cursor-pointer transition-colors"
                    >
                      <span className="font-bold text-xs text-[#ece3d0] block">Ataque corpo a corpo</span>
                      <span className="font-mono text-[11px] text-[#aaa292]">1d20 + floor((Forca - 10) / 2)</span>
                    </div>
                    <div 
                      onClick={() => handleQuickRoll('1d20 + floor((Destreza - 10) / 2)')}
                      className="p-3 bg-[#131211] border border-[#2c2825] hover:border-[#c9a04e] rounded cursor-pointer transition-colors"
                    >
                      <span className="font-bold text-xs text-[#ece3d0] block">Esquiva</span>
                      <span className="font-mono text-[11px] text-[#aaa292]">1d20 + floor((Destreza - 10) / 2)</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-[#1a1816] border border-[#2c2825] rounded-lg p-12 text-center text-[#aaa292]">
                <p className="font-serif text-xl text-[#ece3d0] mb-2">Nenhum personagem selecionado</p>
                <p className="text-xs">Selecione um personagem na coluna ao lado para visualizar a ficha completa.</p>
              </div>
            )}
          </div>

          {/* Coluna 3 (Direita): Equipado, Antecedentes e Rolagens Recentes */}
          <div className="lg:col-span-3 space-y-6">
            {/* Equipado */}
            <div className="bg-[#1a1816] border border-[#2c2825] rounded-lg p-5 shadow-xl">
              <h3 className="font-serif text-lg text-[#ece3d0] mb-3">Equipado</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-[#2c2825]">
                  <span className="text-[#ece3d0]">Espada de Aço</span>
                  <span className="font-mono text-[#aaa292]">1d8 cortante</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#2c2825]">
                  <span className="text-[#ece3d0]">Armadura de Couro</span>
                  <span className="font-mono text-[#aaa292]">RD 1</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#ece3d0]">Poção de Cura</span>
                  <span className="font-mono text-[#aaa292]">2 unidades</span>
                </div>
              </div>
            </div>

            {/* Antecedentes */}
            <div className="bg-[#1a1816] border border-[#2c2825] rounded-lg p-5 shadow-xl">
              <h3 className="font-serif text-lg text-[#ece3d0] mb-3">Antecedentes</h3>
              <div className="space-y-2.5 text-xs">
                <div>
                  <span className="text-[#aaa292] text-[10px] block">Origem</span>
                  <span className="text-[#ece3d0] font-medium">Guarda da muralha de Vessmark</span>
                </div>
                <div>
                  <span className="text-[#aaa292] text-[10px] block">Ofício</span>
                  <span className="text-[#ece3d0] font-medium">Soldado</span>
                </div>
                <div>
                  <span className="text-[#aaa292] text-[10px] block">Idiomas</span>
                  <span className="text-[#ece3d0] font-medium">Comum, Anão</span>
                </div>
              </div>
            </div>

            {/* Rolagens Recentes */}
            <div className="bg-[#1a1816] border border-[#2c2825] rounded-lg p-5 shadow-xl">
              <h3 className="font-serif text-lg text-[#ece3d0] mb-3">Rolagens recentes</h3>
              <div className="space-y-3 font-mono text-xs">
                <div className="py-1 border-b border-[#2c2825]">
                  <div className="flex justify-between">
                    <span className="text-[#c9a04e] font-bold">1d20 + 3 = 17</span>
                  </div>
                  <span className="text-[10px] text-[#aaa292]">Esquiva, rodada 2</span>
                </div>
                <div className="py-1 border-b border-[#2c2825]">
                  <div className="flex justify-between">
                    <span className="text-[#b24a52] font-bold">1d8 + 2 = 9</span>
                  </div>
                  <span className="text-[10px] text-[#aaa292]">Dano da Espada de Aço, rodada 2</span>
                </div>
                <div className="py-1">
                  <div className="flex justify-between">
                    <span className="text-[#c9a04e] font-bold">1d20 + 2 = 14</span>
                  </div>
                  <span className="text-[10px] text-[#aaa292]">Teste de Força</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA TAB: MESA VIRTUAL & MAPA (VTT) */}
      {activeTab === 'vtt' && (
        <div className="mb-6">
          <VirtualTabletop
            campaign={campaign}
            user={user}
            isMaster={isMaster}
            selectedCharacter={selectedCharacter}
            characters={characters}
            onCharacterUpdated={(updatedChar) => {
              setCharacters(prev => prev.map(c => c.id === updatedChar.id ? updatedChar : c));
              setSelectedCharacter(prev => prev?.id === updatedChar.id ? updatedChar : prev);
            }}
            wsRef={wsRef}
            lastVttEvent={lastVttEvent}
            subscribeVtt={subscribeVtt}
          />
        </div>
      )}

      {/* CONTEÚDO DA TAB: INVENTÁRIO DO PERSONAGEM */}
      {activeTab === 'inventory' && (
        <InventoryView
          campaign={campaign}
          user={user}
          characters={characters}
          selectedCharacter={selectedCharacter}
          refreshTrigger={inventoryRefreshTrigger}
          onRefreshCharacter={(updatedChar) => {
            if (updatedChar) {
              setSelectedCharacter(updatedChar);
              setCharacters(prev => prev.map(c => c.id === updatedChar.id ? updatedChar : c));
            }
            loadCampaignData();
          }}
          onOpenCreateCharacter={() => setShowCreateCharModal(true)}
        />
      )}

      {/* CONTEÚDO DA TAB: CATÁLOGO DA CAMPANHA */}
      {activeTab === 'catalog' && (
        <CatalogManager
          campaign={campaign}
          user={user}
          characters={characters}
          selectedCharacter={selectedCharacter}
          onRefreshCampaign={() => {
            loadCampaignData();
            setInventoryRefreshTrigger(prev => prev + 1);
          }}
        />
      )}

      {/* CONTEÚDO DA TAB: BESTIÁRIO & CRIATURAS */}
      {activeTab === 'bestiary' && (
        <BestiaryManager
          campaignId={campaign.id}
          isMaster={isMaster}
        />
      )}

      {/* CONTEÚDO DA TAB: MODELOS DE FICHA (TEMPLATES) */}
      {activeTab === 'templates' && (
        <TemplateEditor
          campaign={campaign}
          user={user}
          onRefreshCampaign={loadCampaignData}
        />
      )}

      {/* CONTEÚDO DA TAB 2: MOTOR DE REGRAS CONFIGURÁVEL */}
      {activeTab === 'rules' && ruleset && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">Configuração Ativa: {ruleset.config.systemName}</h2>
                <p className="text-xs text-slate-400">
                  Versão {ruleset.version} • Dado padrão: <span className="font-mono text-indigo-400">{ruleset.config.defaultDice}</span>
                </p>
              </div>
            </div>

            {/* Testador Interativo de Fórmulas com Validação em Tempo Real */}
            <div className="p-4 bg-slate-950 border border-indigo-500/30 rounded-2xl my-4">
              <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2 flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Testador de Fórmulas do Motor de Regras (Seguro, Sem eval)</span>
              </h3>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={testFormula}
                  onChange={(e) => handleValidateFormula(e.target.value)}
                  placeholder="Ex: 1d20 + Agilidade, max(0, Dano - Armadura), floor(Agilidade / 2) + 10"
                  className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleExecuteTestRoll}
                  disabled={Boolean(validationResult && !validationResult.isValid)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                >
                  Executar Teste
                </button>
              </div>

              {/* Feedback de Validação */}
              {validationResult && (
                <div className={`mt-3 text-xs p-2.5 rounded-lg border ${
                  validationResult.isValid 
                    ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' 
                    : 'bg-rose-950/40 border-rose-800 text-rose-300'
                }`}>
                  {validationResult.isValid ? (
                    <span>
                      ✓ Sintaxe Válida! Variáveis reconhecidas: <strong>{validationResult.variables.join(', ') || 'nenhuma (apenas constantes/dados)'}</strong>
                    </span>
                  ) : (
                    <span>✕ Erro de Validação: {validationResult.error}</span>
                  )}
                </div>
              )}

              {/* Resultado do Teste */}
              {testRollResult && (
                <div className="mt-3 p-3 bg-indigo-950/30 border border-indigo-800 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs text-indigo-300">Total Calculado:</span>
                    <span className="text-2xl font-black text-white ml-2">{testRollResult.total}</span>
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    Expressão: {testRollResult.breakdown.expression}
                  </div>
                </div>
              )}
            </div>

            {/* Listagem de Atributos e Recursos Cadastrados nesta Campanha */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Atributos desta Campanha ({ruleset.config.attributes.length})
                </h4>
                <div className="space-y-2">
                  {ruleset.config.attributes.map((a) => (
                    <div key={a.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-200">{a.name}</span>
                        <span className="text-slate-500 ml-2">({a.abbr})</span>
                        {a.formula && <p className="text-[10px] text-purple-400 font-mono mt-0.5">Fórmula: {a.formula}</p>}
                      </div>
                      <span className="font-mono text-indigo-400">Padrão: {a.defaultValue}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Fórmulas Registradas ({ruleset.config.formulas.length})
                </h4>
                <div className="space-y-2">
                  {ruleset.config.formulas.map((f) => (
                    <div key={f.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-200">{f.name}</span>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{f.expression}</p>
                      </div>
                      <button
                        onClick={() => handleValidateFormula(f.expression)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
                      >
                        Carregar no Testador
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA TAB 3: ROLADOR DE DADOS & HISTÓRICO */}
      {activeTab === 'roller' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl h-fit">
            <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider mb-4">Rolador de Dados Rápido</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Expressão de Rolagem</label>
                <input
                  type="text"
                  value={diceExpr}
                  onChange={(e) => setDiceExpr(e.target.value)}
                  placeholder="Ex: 1d20 + 3, 2d6, 1d100"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Botões de atalho para dados clássicos */}
              <div className="grid grid-cols-4 gap-2">
                {['1d4', '1d6', '1d8', '1d10', '1d12', '1d20', '1d100', '2d6'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDiceExpr(d)}
                    className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500 text-xs font-mono text-slate-300 transition-colors"
                  >
                    {d}
                  </button>
                ))}
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="secretRoll"
                  checked={isSecretRoll}
                  onChange={(e) => setIsSecretRoll(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="secretRoll" className="text-xs text-slate-400 flex items-center space-x-1 cursor-pointer">
                  {isSecretRoll ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>Rolagem Secreta (visível apenas para o mestre)</span>
                </label>
              </div>

              <button
                onClick={() => handleQuickRoll(diceExpr)}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center space-x-2"
              >
                <Dices className="w-5 h-5" />
                <span>Rolar Dados</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider mb-4">Histórico de Rolagens da Mesa</h3>

            {rollHistory.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-sm">
                Nenhuma rolagem realizada ainda. Role um dado ao lado ou clique em um atributo da ficha.
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {rollHistory.map((roll, i) => (
                  <div key={roll.id || i} className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-indigo-400">{roll.username || 'Você'}</span>
                        {roll.characterName && (
                          <span className="text-xs bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                            {roll.characterName}
                          </span>
                        )}
                        <span className="text-xs font-mono text-slate-400">{roll.expression}</span>
                        {roll.isSecret ? (
                          <span className="text-[10px] bg-amber-950/60 text-amber-300 border border-amber-800 px-1.5 py-0.2 rounded">
                            Secreta
                          </span>
                        ) : null}
                      </div>

                      {roll.message && (
                        <div className="text-xs text-amber-400/80 italic mt-1">
                          {roll.message}
                        </div>
                      )}

                      {/* Dados individuais rolados */}
                      {roll.breakdown?.diceRolls?.map((dr: any, dIdx: number) => (
                        <div key={dIdx} className="text-xs text-slate-400 mt-1">
                          {dr.dice}: [{dr.rolls.join(', ')}] = {dr.subtotal}
                        </div>
                      ))}
                    </div>

                    <div className="text-right">
                      <span className="text-2xl font-black text-white">{roll.total}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTEÚDO DA TAB 4: MESA EM TEMPO REAL & CHAT */}
      {activeTab === 'chat' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl h-[600px] flex flex-col justify-between">
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 mb-4">
            <div className="text-xs text-slate-500 text-center py-2 border-b border-slate-800">
              Conectado ao canal seguro da campanha em tempo real via WebSockets.
            </div>

            {messages.map((m, i) => (
              <div key={i} className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-indigo-400">{m.sender}</span>
                  <span className="text-[10px] text-slate-500">{new Date(m.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="text-sm text-slate-200">{m.text}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendChat} className="flex gap-3">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Digite uma mensagem para os participantes da mesa..."
              className="flex-1 px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all flex items-center space-x-2"
            >
              <Send className="w-4 h-4" />
              <span>Enviar</span>
            </button>
          </form>
        </div>
      )}

      {/* MODAL NOVO PERSONAGEM */}
      {showCreateCharModal && ruleset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative">
            <h2 className="text-2xl font-bold text-white mb-1">Criar Personagem</h2>
            <p className="text-xs text-slate-400 mb-6">
              Os atributos derivados e recursos serão calculados automaticamente pelas regras da campanha ({ruleset.config.systemName}).
            </p>

            <form onSubmit={handleCreateCharacter} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Nome do Personagem
                </label>
                <input
                  type="text"
                  required
                  value={newCharName}
                  onChange={(e) => setNewCharName(e.target.value)}
                  placeholder="Ex: Arthur Cervero, Netrunner V, Kaelen..."
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>

              {templates.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Modelo de Ficha (Template)
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Ficha Padrão da Campanha</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Atributos Iniciais
                </label>
                <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                  {ruleset.config.attributes.filter(a => !a.isDerived).map((attr) => (
                    <div key={attr.id} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <label className="block text-xs text-slate-400 mb-1">{attr.name}</label>
                      <input
                        type="number"
                        min={attr.min ?? 0}
                        max={attr.max ?? 100}
                        value={newCharAttributes[attr.name] ?? attr.defaultValue}
                        onChange={(e) => setNewCharAttributes({
                          ...newCharAttributes,
                          [attr.name]: parseInt(e.target.value, 10) || 0
                        })}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateCharModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all"
                >
                  Salvar Personagem
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
