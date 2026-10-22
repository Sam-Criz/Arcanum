import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Campaign, Ruleset, Character, CharacterTemplate, RollResult, api, User } from '../services/api';
import { 
  Dices, Shield, Sparkles, UserPlus, 
  Send, Copy, Check, MessageSquare, Terminal, Eye, EyeOff, Plus, ChevronRight,
  Package, LayoutTemplate, Map as MapIcon, Flame, Skull
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
  const [activeTab, setActiveTabState] = useState<'sheets' | 'vtt' | 'inventory' | 'catalog' | 'bestiary' | 'templates' | 'rules' | 'roller' | 'chat'>(() => {
    const hashMatch = window.location.hash.match(/tab=([^&]+)/);
    const hashTab = hashMatch ? (hashMatch[1] as any) : null;
    const saved = hashTab || localStorage.getItem(`arcanum_active_tab_${campaign.id}`);
    const validTabs = ['sheets', 'vtt', 'inventory', 'catalog', 'bestiary', 'templates', 'rules', 'roller', 'chat'];
    return (saved && validTabs.includes(saved)) ? (saved as any) : 'sheets';
  });

  const setActiveTab = (tab: 'sheets' | 'vtt' | 'inventory' | 'catalog' | 'bestiary' | 'templates' | 'rules' | 'roller' | 'chat') => {
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

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Notificação Flutuante de Rolagem Secreta para o Mestre */}
      {secretRollToast && (
        <div className="fixed top-5 right-5 z-50 bg-amber-950/95 border-2 border-amber-500 rounded-2xl p-4 shadow-2xl backdrop-blur-md flex items-center space-x-3 max-w-sm animate-bounce-short">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0">
            <Dices className="w-5 h-5 animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">🎲 Rolagem Secreta Recebida</span>
            <p className="text-xs text-white font-medium truncate">
              <strong>{secretRollToast.author}</strong>
              {secretRollToast.characterName ? ` (${secretRollToast.characterName})` : ''}: {secretRollToast.expression} = <span className="font-bold text-amber-300 text-sm">{secretRollToast.total}</span>
            </p>
          </div>
          <button
            onClick={() => {
              setActiveTab('roller');
              setUnreadRollCount(0);
              setSecretRollToast(null);
            }}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold shrink-0 transition-all shadow-md"
          >
            Ver
          </button>
        </div>
      )}

      {/* Top Bar da Campanha */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 mb-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <button
              onClick={onBack}
              className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/80 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              ← Voltar às Campanhas
            </button>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {ruleset?.config.systemName || 'Sistema Customizado'}
            </span>
          </div>
          <h1 className="text-2xl font-black text-white">{campaign.name}</h1>
          <p className="text-xs text-slate-400 mt-0.5">{campaign.description || 'Ambiente ativo com isolamento de regras.'}</p>
        </div>

        {/* Ações de Mestre / Convite */}
        <div className="flex items-center space-x-3">
          {inviteCode ? (
            <div className="flex items-center space-x-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-indigo-500/50 backdrop-blur-sm">
              <span className="text-xs text-slate-400">Código:</span>
              <span className="font-mono text-sm font-bold text-indigo-300">{inviteCode}</span>
              <button
                onClick={() => copyToClipboard(inviteCode)}
                className="p-1 text-slate-400 hover:text-white transition-colors"
                title="Copiar código"
              >
                {copiedInvite ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerateInvite}
              className="flex items-center space-x-2 px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/80 rounded-xl text-xs font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <UserPlus className="w-4 h-4 text-amber-400" />
              <span>Gerar Convite</span>
            </button>
          )}

          <button
            onClick={() => setShowCreateCharModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Personagem</span>
          </button>
        </div>
      </div>

      {/* Tabs de Navegação */}
      <div className="flex space-x-2 border-b border-slate-800 mb-6 overflow-x-auto pb-1 sm:pb-0">
        <button
          onClick={() => setActiveTab('sheets')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-semibold text-sm transition-all whitespace-nowrap ${
            activeTab === 'sheets'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Fichas</span>
        </button>

        <button
          onClick={() => setActiveTab('vtt')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-semibold text-sm transition-all whitespace-nowrap ${
            activeTab === 'vtt'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapIcon className="w-4 h-4 text-emerald-400" />
          <span>Mesa Virtual (VTT)</span>
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-semibold text-sm transition-all whitespace-nowrap ${
            activeTab === 'inventory'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Package className="w-4 h-4 text-amber-400" />
          <span>Mochila & Inventário</span>
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-semibold text-sm transition-all whitespace-nowrap ${
            activeTab === 'catalog'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>Catálogo da Campanha</span>
        </button>

        <button
          onClick={() => setActiveTab('bestiary')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-semibold text-sm transition-all whitespace-nowrap ${
            activeTab === 'bestiary'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Skull className="w-4 h-4 text-rose-500" />
          <span>Bestiário & Criaturas</span>
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-semibold text-sm transition-all whitespace-nowrap ${
            activeTab === 'templates'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutTemplate className="w-4 h-4 text-purple-400" />
          <span>Modelos de Ficha ({templates.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-semibold text-sm transition-all whitespace-nowrap ${
            activeTab === 'rules'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Regras da Campanha</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('roller');
            setUnreadRollCount(0);
          }}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-semibold text-sm transition-all whitespace-nowrap relative ${
            activeTab === 'roller'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Dices className="w-4 h-4" />
          <span>Rolador de Dados</span>
          {unreadRollCount > 0 && activeTab !== 'roller' && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-1" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-semibold text-sm transition-all whitespace-nowrap ${
            activeTab === 'chat'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Mesa em Tempo Real ({messages.length})</span>
        </button>
      </div>

      {/* CONTEÚDO DA TAB 1: FICHAS & PERSONAGENS (ESTILO C.R.I.S.) */}
      {activeTab === 'sheets' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Coluna da Esquerda: Lista de Personagens */}
          <div className="lg:col-span-1 bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 h-fit shadow-xl transition-all">
            <div className="flex items-center justify-between mb-3 px-2">
              <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider">Personagens</h3>
              <span className="text-xs bg-slate-800/80 px-2.5 py-0.5 rounded-full text-slate-400 border border-slate-700/60 font-mono">{characters.length}</span>
            </div>

            {characters.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                Nenhum personagem criado ainda. Clique em "Novo Personagem" acima.
              </div>
            ) : (
              <div className="space-y-2">
                {characters.map((char) => {
                  const isMine = char.user_id === user.id;
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
                      className={`flex items-center space-x-3 p-2.5 rounded-xl cursor-pointer transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] ${
                        selectedCharacter?.id === char.id
                          ? 'bg-indigo-600/20 border border-indigo-500/60 text-white shadow-sm'
                          : 'hover:bg-slate-800/60 border border-transparent text-slate-300'
                      }`}
                    >
                      <img
                        src={char.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${char.name}`}
                        alt={char.name}
                        className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <p className="font-semibold text-sm truncate">{char.name}</p>
                          {isMine && (
                            <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded font-medium">
                              Seu
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate">Por: {isMine ? 'Você' : (char.owner_username || 'Jogador')}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Coluna Central/Direita: Ficha Detalhada (Estilo C.R.I.S.) */}
          <div className="lg:col-span-3">
            {selectedCharacter ? (
              <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 shadow-2xl relative overflow-hidden transition-all">
                {/* Banner de Leitura para Ficha de Terceiros */}
                {selectedCharacter.user_id !== user.id && !isMaster && (
                  <div className="mb-4 p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl flex items-center space-x-2 text-xs text-amber-300">
                    <Eye className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>
                      Modo Leitura: Ficha de outro participante ({selectedCharacter.owner_username || 'Jogador'}). Suas ações e rolagens continuam associadas à sua conta.
                    </span>
                  </div>
                )}

                {/* Cabeçalho da Ficha */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
                  <div className="flex items-center space-x-4">
                    <img
                      src={selectedCharacter.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${selectedCharacter.name}`}
                      alt={selectedCharacter.name}
                      className="w-16 h-16 rounded-2xl border-2 border-indigo-500/40 bg-slate-800 shadow-lg"
                    />
                    <div>
                      <h2 className="text-2xl font-black text-white">{selectedCharacter.name}</h2>
                      <p className="text-xs text-slate-400">
                        Jogador: <span className="text-indigo-400 font-medium">{selectedCharacter.owner_username || user.username}</span> • Campanha: {campaign.name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 font-mono">
                      ID: {selectedCharacter.id.slice(0, 8)}
                    </span>
                  </div>
                </div>

                {/* Condições e Efeitos de Status Ativos na Ficha */}
                {selectedCharacter.conditions && selectedCharacter.conditions.length > 0 && (
                  <div className="my-4 p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      <span>Condições e Efeitos de Status Ativos</span>
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedCharacter.conditions.map((cond: any) => {
                        const isObj = typeof cond === 'object';
                        const name = isObj ? cond.name : cond;
                        const durType = isObj ? cond.duration_type : 'turns';
                        const durRem = isObj ? cond.duration_remaining : null;
                        const color = (isObj && cond.color) ? cond.color : '#eab308';
                        const desc = isObj ? cond.description : '';

                        return (
                          <div 
                            key={isObj ? cond.id : name} 
                            style={{ borderColor: color, backgroundColor: `${color}15` }}
                            className="text-xs border px-2.5 py-1.5 rounded-lg flex items-center space-x-2"
                          >
                            <span className="font-semibold" style={{ color }}>{name}</span>
                            {durType !== 'permanent' && durRem !== null && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({durRem} {durType === 'turns' ? 'turnos' : durType === 'rounds' ? 'rodadas' : 'ações'})
                              </span>
                            )}
                            {desc && (
                              <span className="text-[10px] text-slate-300 italic max-w-xs truncate">
                                — {desc}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Barras de Recursos (Vida, Sanidade, Esforço, Bateria) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
                  {ruleset?.config.resources.map((res) => {
                    const maxVal = selectedCharacter.computed_data[`${res.id}_max`] || 10;
                    const curVal = selectedCharacter.computed_data[`${res.id}_atual`] !== undefined
                      ? selectedCharacter.computed_data[`${res.id}_atual`]
                      : maxVal;
                    const percent = Math.min(100, Math.max(0, (curVal / maxVal) * 100));

                    return (
                      <div key={res.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3.5">
                        <div className="flex items-center justify-between mb-1.5 text-xs font-semibold">
                          <span className="text-slate-300">{res.name}</span>
                          <span className="font-mono text-white">{curVal} / {maxVal}</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${percent}%`,
                              backgroundColor: res.color || '#6366f1'
                            }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 truncate">
                          Fórmula: {res.maxFormula}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Grid de Atributos Principais (C.R.I.S. Style Cards) */}
                <div className="mb-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Atributos da Ficha (Clique para Rolar Teste)
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    {ruleset?.config.attributes.map((attr) => {
                      const val = selectedCharacter.computed_data[attr.id] !== undefined
                        ? selectedCharacter.computed_data[attr.id]
                        : selectedCharacter.computed_data[attr.name] || attr.defaultValue;

                      return (
                        <div
                          key={attr.id}
                          onClick={() => handleAttributeRoll(attr.name)}
                          className={`group p-3 rounded-2xl border text-center transition-all cursor-pointer relative ${
                            attr.isDerived
                              ? 'bg-purple-950/20 border-purple-800/40 hover:border-purple-500'
                              : 'bg-slate-950 border-slate-800 hover:border-indigo-500 hover:bg-indigo-950/20'
                          }`}
                        >
                          {attr.isDerived && (
                            <span className="absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0.2 rounded bg-purple-900/60 text-purple-300 font-mono">
                              auto
                            </span>
                          )}
                          <p className="text-xs font-bold text-slate-400 group-hover:text-indigo-300 transition-colors">
                            {attr.abbr || attr.name.slice(0, 3).toUpperCase()}
                          </p>
                          <p className="text-2xl font-black text-white my-1 group-hover:scale-110 transition-transform">
                            {val}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {attr.name}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Ações Rápidas de Combate Configuradas nas Regras */}
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Ações & Fórmulas da Campanha
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {ruleset?.config.formulas.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => handleQuickRoll(f.expression)}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500 hover:bg-slate-800/60 text-left transition-all group"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-200 group-hover:text-indigo-400">{f.name}</p>
                          <p className="text-[11px] font-mono text-slate-400 mt-0.5">{f.expression}</p>
                        </div>
                        <Dices className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Seções e Campos Personalizados do Modelo de Ficha (Template) */}
                {(() => {
                  const activeTemplate = templates.find(t => t.id === selectedCharacter.template_id);
                  if (!activeTemplate || !activeTemplate.schema?.sections) return null;

                  return (
                    <div className="mt-6 pt-6 border-t border-slate-800 space-y-4">
                      <div className="flex items-center space-x-2">
                        <LayoutTemplate className="w-4 h-4 text-purple-400" />
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                          Campos Customizados ({activeTemplate.name})
                        </h3>
                      </div>

                      {activeTemplate.schema.sections.map((sec, sIdx) => (
                        <div key={sec.id || sIdx} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                          <h4 className="text-xs font-bold text-indigo-300 mb-2.5">{sec.title}</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {sec.fields.map((f, fIdx) => {
                              const val = selectedCharacter.computed_data[f.id] !== undefined
                                ? selectedCharacter.computed_data[f.id]
                                : selectedCharacter.raw_data[f.id] ?? f.defaultValue ?? '—';

                              return (
                                <div key={f.id || fIdx} className="p-2.5 bg-slate-900 rounded-lg border border-slate-800/80">
                                  <span className="text-[10px] text-slate-400 uppercase font-bold block">{f.name}</span>
                                  <span className="text-sm font-semibold text-white mt-0.5 block truncate">
                                    {String(val)}
                                  </span>
                                  {f.isDerived && (
                                    <span className="text-[9px] text-purple-400 font-mono mt-0.5 block truncate">
                                      f(x): {f.formula}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-4">
                <Shield className="w-12 h-12 text-indigo-400 mx-auto" />
                <h3 className="text-xl font-bold text-white">Nenhum Personagem Selecionado</h3>
                <p className="text-sm max-w-md mx-auto text-slate-400">
                  {!isMaster && characters.filter(c => c.user_id === user.id).length === 0
                    ? 'Você ainda não possui um personagem nesta campanha. Crie seu primeiro personagem para começar a jogar!'
                    : 'Selecione um personagem na coluna ao lado para visualizar a ficha completa.'}
                </p>
                {!isMaster && characters.filter(c => c.user_id === user.id).length === 0 && (
                  <button
                    onClick={() => setShowCreateCharModal(true)}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all inline-flex items-center space-x-2 shadow-lg shadow-indigo-600/30"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Criar Meu Personagem</span>
                  </button>
                )}
              </div>
            )}
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
  );
};
