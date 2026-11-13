import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNotification } from './NotificationProvider';
import { 
  Campaign, User, Ruleset, CharacterTemplate, Character, 
  RollResult, api 
} from '../services/api';
import { 
  Dices, Shield, Sparkles, UserPlus, 
  Send, Copy, Check, Terminal, Plus, 
  Package, LayoutTemplate, Skull,
  Users, Trash2, Crown, ChevronLeft, ChevronDown,
  Heart, Zap, Weight, LogOut, Music, BookOpen
} from 'lucide-react';
import { InventoryView } from './InventoryView';
import { CatalogManager } from './CatalogManager';
import { TemplateEditor } from './TemplateEditor';
import { VirtualTabletop } from './VirtualTabletop';
import { BestiaryManager } from './BestiaryManager';
import { MasterToolsManager } from './MasterToolsManager';
import { AudioManager } from './AudioManager';
import { CharacterLoreView } from './CharacterLoreView';
import { WhisperDock } from './WhisperDock';

interface CampaignWorkspaceProps {
  campaign: Campaign;
  user: User;
  onBack: () => void;
  onLogout?: () => void;
}

export const CampaignWorkspace: React.FC<CampaignWorkspaceProps> = ({
  campaign,
  user,
  onBack,
  onLogout
}) => {
  const [activeTab, setActiveTabState] = useState<'vtt' | 'sheets' | 'inventory' | 'catalog' | 'bestiary' | 'masterTools' | 'templates' | 'rules' | 'roller' | 'chat'>(() => {
    const hashMatch = window.location.hash.match(/tab=([^&]+)/);
    const hashTab = hashMatch ? (hashMatch[1] as any) : null;
    const saved = hashTab || localStorage.getItem(`arcanum_active_tab_${campaign.id}`);
    const validTabs = ['vtt', 'sheets', 'inventory', 'catalog', 'bestiary', 'masterTools', 'templates', 'rules', 'roller', 'chat'];
    return (saved && validTabs.includes(saved)) ? (saved as any) : 'vtt';
  });

  const setActiveTab = (tab: 'vtt' | 'sheets' | 'inventory' | 'catalog' | 'bestiary' | 'masterTools' | 'templates' | 'rules' | 'roller' | 'chat') => {
    setActiveTabState(tab);
    localStorage.setItem(`arcanum_active_tab_${campaign.id}`, tab);
    window.location.hash = `campaign=${campaign.id}&tab=${tab}`;
  };

  useEffect(() => {
    (window as any).__setActiveWorkspaceTab = (t: any) => setActiveTab(t);
    const handleHash = () => {
      const hashMatch = window.location.hash.match(/tab=([^&]+)/);
      const hashTab = hashMatch ? (hashMatch[1] as any) : null;
      const validTabs = ['vtt', 'sheets', 'inventory', 'catalog', 'bestiary', 'masterTools', 'templates', 'rules', 'roller', 'chat'];
      if (hashTab && validTabs.includes(hashTab)) {
        setActiveTabState(hashTab);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => {
      window.removeEventListener('hashchange', handleHash);
      delete (window as any).__setActiveWorkspaceTab;
    };
  }, [campaign.id]);

  const [ruleset, setRuleset] = useState<Ruleset | null>(null);
  const [templates, setTemplates] = useState<CharacterTemplate[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [characterRequests, setCharacterRequests] = useState<any[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [lastVttEvent, setLastVttEvent] = useState<any>(null);
  const toast = useNotification();
  const [equippedItems, setEquippedItems] = useState<any[]>([]);
  const [characterInventory, setCharacterInventory] = useState<any[]>([]);
  const [sheetInnerTab, setSheetInnerTab] = useState<'abilities' | 'equipment' | 'lore' | 'background'>('abilities');
  const [showAudioDrawer, setShowAudioDrawer] = useState(false);
  const [latestAudioEvent, setLatestAudioEvent] = useState<any>(null);
  const [latestWhisperEvent, setLatestWhisperEvent] = useState<any>(null);

  // Menu Dropdown do Compêndio
  const [showCompendiumMenu, setShowCompendiumMenu] = useState(false);
  const compendiumMenuRef = useRef<HTMLDivElement | null>(null);

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
  const [, setUnreadRollCount] = useState<number>(0);
  const [, setSecretRollToast] = useState<{ author: string; characterName?: string; expression: string; total: number; id: string } | null>(null);

  // Sincronização em tempo real de inventário
  const [inventoryRefreshTrigger, setInventoryRefreshTrigger] = useState<number>(0);

  // Gestão de Membros
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [campaignMembers, setCampaignMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<any | null>(null);

  // CRUD de Habilidades
  const [showAddSkillModal, setShowAddSkillModal] = useState(false);
  const [skillForm, setSkillForm] = useState({
    name: '',
    type: 'main',
    cost_name: 'Mana',
    cost_amount: 1,
    attack_formula: '',
    damage_formula: '',
    description: ''
  });
  const [isSubmittingSkill, setIsSubmittingSkill] = useState(false);

  // Create character modal
  const [showCreateCharModal, setShowCreateCharModal] = useState(false);
  const [newCharName, setNewCharName] = useState('');
  const [newCharAttributes, setNewCharAttributes] = useState<Record<string, number>>({});

  // Chat & WebSocket state
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const vttListenersRef = useRef<Set<(msg: any) => void>>(new Set());

  // Fechar dropdown do compêndio ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (compendiumMenuRef.current && !compendiumMenuRef.current.contains(e.target as Node)) {
        setShowCompendiumMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

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

      // Lógica de seleção automática de personagem
      setSelectedCharacter(prev => {
        const userChars = chars.filter(c => c.user_id === user.id);
        const storageKey = `arcanum_selected_char_${user.id}_${campaign.id}`;
        const savedCharId = localStorage.getItem(storageKey);

        if (prev) {
          const fresh = chars.find(c => c.id === prev.id);
          if (fresh) {
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

        if (!isMaster) {
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
        } else {
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

      try {
        const chatRes: any = await api.getChatMessages(campaign.id);
        const list = Array.isArray(chatRes) ? chatRes : (chatRes?.messages || []);
        if (list.length > 0) {
          setMessages(list.map((m: any) => ({
            id: m.id,
            sender: m.sender_name || m.sender || 'Membro',
            text: m.content || m.text || '',
            timestamp: m.created_at || new Date().toISOString()
          })));
        }
      } catch (e) {
        console.error('Erro ao carregar histórico de chat:', e);
      }

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

  const loadMembers = async () => {
    try {
      setLoadingMembers(true);
      const res = await api.getCampaignMembers(campaign.id);
      setCampaignMembers(Array.isArray(res) ? res : []);
    } catch (err: any) {
      console.error('Erro ao listar membros:', err);
      toast.error('Erro ao listar membros', err.message || 'Falha na requisição.');
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleKickMember = async (targetUserId: string, targetName: string) => {
    try {
      await api.removeCampaignMember(campaign.id, targetUserId);
      toast.success('Membro Removido', `${targetName} foi removido da campanha.`);
      setMemberToRemove(null);
      setCampaignMembers(prev => prev.filter(m => (m.userId || m.user_id || m.id) !== targetUserId));
      loadMembers();
      loadCampaignData();
    } catch (err: any) {
      toast.error('Falha ao remover membro', err.response?.data?.error || err.message);
    }
  };

  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCharacter || !skillForm.name.trim()) return;
    try {
      setIsSubmittingSkill(true);
      const skillPayload = {
        name: skillForm.name.trim(),
        type: skillForm.type,
        resource_cost: skillForm.cost_name ? { name: skillForm.cost_name, amount: Number(skillForm.cost_amount) || 0 } : undefined,
        attack_formula: skillForm.attack_formula.trim() || undefined,
        damage_formula: skillForm.damage_formula.trim() || undefined,
        description: skillForm.description.trim() || 'Habilidade customizada'
      };
      const res: any = await api.addCharacterSkill(campaign.id, selectedCharacter.id, skillPayload);
      toast.success('Habilidade Adicionada', `${skillForm.name} foi adicionada com sucesso.`);
      setShowAddSkillModal(false);
      setSkillForm({
        name: '',
        type: 'main',
        cost_name: 'Mana',
        cost_amount: 1,
        attack_formula: '',
        damage_formula: '',
        description: ''
      });
      if (res?.character) {
        setCharacters(prev => prev.map(c => c.id === res.character.id ? res.character : c));
        setSelectedCharacter(res.character);
      } else {
        loadCampaignData();
      }
    } catch (err: any) {
      toast.error('Erro ao adicionar habilidade', err.response?.data?.error || err.message);
    } finally {
      setIsSubmittingSkill(false);
    }
  };

  const handleDeleteSkill = async (skillId: string, skillName: string) => {
    if (!selectedCharacter) return;
    try {
      const res: any = await api.deleteCharacterSkill(campaign.id, selectedCharacter.id, skillId);
      toast.success('Habilidade Removida', `${skillName} foi removida da ficha.`);
      if (res?.character) {
        setCharacters(prev => prev.map(c => c.id === res.character.id ? res.character : c));
        setSelectedCharacter(res.character);
      } else {
        loadCampaignData();
      }
    } catch (err: any) {
      toast.error('Erro ao remover habilidade', err.response?.data?.error || err.message);
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
        if (msg.type === 'campaign:kicked') {
          toast.error('Você foi removido da campanha', 'O Mestre encerrou sua participação nesta mesa.');
          setTimeout(() => {
            window.location.href = '/campaigns';
          }, 1500);
        } else if (msg.type === 'campaign:member_removed') {
          loadCampaignData();
          if (showMembersModal) loadMembers();
        } else if (msg.type === 'chat:message') {
          const raw = msg.message || msg;
          const normalized = {
            type: 'chat:message',
            id: raw.id || `msg-${Date.now()}-${Math.random()}`,
            sender: raw.sender_name || raw.sender || 'Membro',
            sender_name: raw.sender_name || raw.sender || 'Membro',
            text: raw.content || raw.text || '',
            content: raw.content || raw.text || '',
            timestamp: raw.created_at || raw.timestamp || new Date().toISOString(),
            created_at: raw.created_at || raw.timestamp || new Date().toISOString()
          };
          setMessages(prev => {
            if (normalized.id && prev.some(m => m.id === normalized.id)) return prev;
            return [...prev, normalized];
          });
          setLastVttEvent(normalized);
          vttListenersRef.current.forEach(listener => {
            try { listener(normalized); } catch (e) { console.error(e); }
          });
        } else if (msg.type === 'dice:rolled') {
          setRollHistory(prev => {
            const exists = prev.some(r => r.id === msg.roll.id);
            if (exists) {
              return prev.map(r => r.id === msg.roll.id ? { ...r, ...msg.roll } : r);
            }
            return [msg.roll, ...prev];
          });

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
        } else if (msg.type?.startsWith('audio:')) {
          setLatestAudioEvent(msg);
        } else if (msg.type === 'whisper:new') {
          setLatestWhisperEvent(msg.whisper || msg);
        } else if (msg.type === 'vtt:event' || msg.type?.startsWith('token:') || msg.type?.startsWith('scene:')) {
          setLastVttEvent(msg);
          vttListenersRef.current.forEach(listener => {
            try { listener(msg); } catch (e) { console.error(e); }
          });
        }
      } catch (err) {
        console.error('Erro ao processar mensagem WebSocket:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('Erro na conexão WebSocket:', err);
    };

    ws.onclose = () => {
      if (isMountedRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          setupWebSocket();
        }, 3000);
      }
    };
  };

  const handleGenerateInvite = async () => {
    try {
      const res = await api.createInvite(campaign.id);
      setInviteCode(res.invite.code);
      setCopiedInvite(false);
      toast.success('Convite Gerado', `Código ${res.invite.code} copiado.`);
    } catch (err: any) {
      toast.error('Erro ao gerar convite', err.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedInvite(true);
    toast.info('Copiado', 'Código transferido para a área de transferência.');
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
    } catch {
      setValidationResult({ isValid: false, error: 'Falha na validação', variables: [] });
    }
  };

  const handleExecuteTestRoll = async () => {
    if (!testFormula.trim()) return;
    try {
      const vars: Record<string, number> = {};
      if (selectedCharacter) {
        for (const [k, v] of Object.entries(selectedCharacter.computed_data)) {
          if (typeof v === 'number') vars[k] = v;
        }
      }
      const res = await api.rollDice(campaign.id, {
        expression: testFormula,
        variables: vars,
        characterId: (selectedCharacter && (selectedCharacter.user_id === user.id || isMaster)) ? selectedCharacter.id : undefined,
        isSecret: isSecretRoll
      });
      setTestRollResult(res);

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
      toast.error('Erro na rolagem', err.message);
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
        characterId: (selectedCharacter && (selectedCharacter.user_id === user.id || isMaster)) ? selectedCharacter.id : undefined,
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
      toast.error('Erro na rolagem', err.message);
    }
  };

  const handleAttributeRoll = (attrName: string) => {
    if (!ruleset) return;
    const defaultDice = ruleset.config.defaultDice || '1d20';
    handleQuickRoll(`${defaultDice} + ${attrName}`);
  };

  // Carrega inventário e itens equipados do personagem selecionado em tempo real
  useEffect(() => {
    if (selectedCharacter?.id && campaign?.id) {
      api.getCharacterInventory(campaign.id, selectedCharacter.id)
        .then((res: any) => {
          const itemsList = Array.isArray(res) ? res : (res?.items || []);
          setCharacterInventory(itemsList);
          setEquippedItems(itemsList.filter((item: any) => item.is_equipped === 1 || item.is_equipped === true));
        })
        .catch(() => {
          setCharacterInventory([]);
          setEquippedItems([]);
        });
    } else {
      setCharacterInventory([]);
      setEquippedItems([]);
    }
  }, [selectedCharacter?.id, campaign?.id, inventoryRefreshTrigger]);

  const loadCharacterRequests = async () => {
    try {
      const reqs = await api.getCharacterRequests(campaign.id);
      setCharacterRequests(reqs);
    } catch {}
  };

  useEffect(() => {
    if (activeTab === 'sheets') {
      loadCharacterRequests();
    }
  }, [activeTab, campaign.id]);

  const handleCreateCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCharName.trim()) return;

    try {
      const res = await api.createCharacter(campaign.id, {
        name: newCharName.trim(),
        templateId: selectedTemplateId || undefined,
        rawData: newCharAttributes
      });

      if (res.status === 'pending_approval') {
        toast.info('Solicitação Enviada', 'Seu personagem foi enviado para aprovação do Mestre.');
        setShowCreateCharModal(false);
        setNewCharName('');
        loadCharacterRequests();
        return;
      }

      const newChar = res;
      setCharacters(prev => [...prev, newChar]);
      setSelectedCharacter(newChar);
      const storageKey = `arcanum_selected_char_${user.id}_${campaign.id}`;
      localStorage.setItem(storageKey, newChar.id);
      setShowCreateCharModal(false);
      setNewCharName('');
    } catch (err: any) {
      toast.error('Erro ao criar personagem', err.message);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput('');

    try {
      const saved: any = await api.sendChatMessage(campaign.id, text);
      setMessages(prev => {
        if (saved?.id && prev.some(m => m.id === saved.id)) return prev;
        return [
          ...prev,
          {
            id: saved?.id,
            sender: user.username,
            text,
            timestamp: saved?.created_at || new Date().toISOString()
          }
        ];
      });
    } catch (err) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'chat:send',
          text
        }));
      }
    }
  };

  const characterSkills: any[] = Array.isArray(selectedCharacter?.raw_data?.abilities) ? selectedCharacter.raw_data.abilities : [];
  const maxSkills: number = (campaign as any).max_skills_per_character || 6;
  const canManageSkills: boolean = !!selectedCharacter && (selectedCharacter.user_id === user.id || isMaster);

  // Recursos recomputados estritamente com base no selectedCharacter e ruleset
  const characterResources = useMemo(() => {
    if (!selectedCharacter) {
      return {
        currentHp: 0,
        maxHp: 0,
        hpPercent: 0,
        hpFormulaLabel: '10 + CON × 2',
        manaLabel: 'Mana',
        currentMana: 0,
        maxMana: 0,
        manaPercent: 0,
        manaFormulaLabel: '10 + INT',
        currentWeight: 0,
        maxWeight: 0,
        weightPercent: 0
      };
    }

    const raw = selectedCharacter.raw_data || {};
    const comp = selectedCharacter.computed_data || {};

    const con = Number(comp.constituicao ?? comp.vigor ?? comp.Constituicao ?? comp.Vigor ?? raw.constituicao ?? raw.vigor ?? 10);
    const intelecto = Number(comp.inteligencia ?? comp.intelecto ?? comp.Inteligencia ?? comp.Intelecto ?? raw.inteligencia ?? raw.intelecto ?? 10);
    const forca = Number(comp.forca ?? comp.Forca ?? raw.forca ?? 10);

    const maxHp = Number(selectedCharacter.max_hp ?? comp.vida_max ?? comp.hp_max ?? raw.vida_max ?? raw.hp_max ?? (10 + con * 2));
    const currentHp = Number(selectedCharacter.current_hp ?? comp.vida_atual ?? comp.hp_atual ?? raw.vida_atual ?? raw.hp_atual ?? maxHp);
    const hpPercent = maxHp > 0 ? Math.min(100, Math.max(0, Math.round((currentHp / maxHp) * 100))) : 0;

    const secRes = ruleset?.config?.resources?.find((r: any) => r.id === 'mana' || r.id === 'esforco' || r.id === 'pe' || r.id === 'sanidade' || r.id === 'bateria') || ruleset?.config?.resources?.[1];
    const secResId = secRes?.id || 'mana';
    const manaLabel = secRes?.name || (secResId === 'esforco' || secResId === 'pe' ? 'Pontos de Esforço' : 'Mana');
    const maxMana = Number(selectedCharacter.max_mana ?? selectedCharacter.max_pe ?? comp[`${secResId}_max`] ?? comp.mana_max ?? comp.pe_max ?? raw[`${secResId}_max`] ?? raw.mana_max ?? raw.pe_max ?? (10 + intelecto));
    const currentMana = Number(selectedCharacter.current_mana ?? selectedCharacter.current_pe ?? comp[`${secResId}_atual`] ?? comp.mana_atual ?? comp.pe_atual ?? raw[`${secResId}_atual`] ?? raw.mana_atual ?? raw.pe_atual ?? maxMana);
    const manaPercent = maxMana > 0 ? Math.min(100, Math.max(0, Math.round((currentMana / maxMana) * 100))) : 0;

    const totalInvWeight = characterInventory.reduce((acc: number, item: any) => {
      const w = Number(item.weight) || 0;
      const q = Number(item.quantity) || 1;
      return acc + (w * q);
    }, 0);
    const currentWeight = comp.carga_atual !== undefined ? Number(comp.carga_atual) : Math.round(totalInvWeight * 10) / 10;
    const maxWeight = Number(comp.carga_max ?? comp.capacidade_carga ?? raw.carga_max ?? (10 + forca * 2));
    const weightPercent = maxWeight > 0 ? Math.min(100, Math.max(0, Math.round((currentWeight / maxWeight) * 100))) : 0;

    const hpResource = ruleset?.config?.resources?.find((r: any) => r.id === 'vida' || r.id === 'hp');
    const hpFormulaLabel = hpResource?.maxFormula ? `${hpResource.maxFormula}` : '10 + CON × 2';
    const manaFormulaLabel = secRes?.maxFormula ? `${secRes.maxFormula}` : '10 + INT';

    return {
      currentHp,
      maxHp,
      hpPercent,
      hpFormulaLabel,
      manaLabel,
      currentMana,
      maxMana,
      manaPercent,
      manaFormulaLabel,
      currentWeight,
      maxWeight,
      weightPercent
    };
  }, [selectedCharacter, ruleset, characterInventory]);

  // Estatísticas derivadas
  const derivedStats = useMemo(() => {
    if (!selectedCharacter) {
      return { defense: 10, initiative: 0, damageReduction: 0 };
    }

    const raw = selectedCharacter.raw_data || {};
    const comp = selectedCharacter.computed_data || {};

    const des = Number(comp.destreza ?? comp.agilidade ?? comp.Destreza ?? comp.Agilidade ?? raw.destreza ?? raw.agilidade ?? 10);
    const isD20 = ruleset?.config?.defaultDice === '1d20' || (ruleset?.config?.attributes?.find((a: any) => a.id === 'destreza')?.defaultValue ?? 10) >= 10;
    const modDes = isD20 ? Math.floor((des - 10) / 2) : des;

    const itemDefenseBonus = equippedItems.reduce((acc: number, it: any) => {
      return acc + (Number(it.properties?.defesa || it.properties?.defense || it.properties?.ac_bonus) || 0);
    }, 0);
    const itemRdBonus = equippedItems.reduce((acc: number, it: any) => {
      return acc + (Number(it.properties?.rd || it.properties?.damage_reduction || it.properties?.reducao_dano) || 0);
    }, 0);

    const baseDefense = comp.defesa !== undefined ? Number(comp.defesa) : (10 + modDes);
    const defense = baseDefense + itemDefenseBonus;
    const initiative = comp.iniciativa !== undefined ? Number(comp.iniciativa) : modDes;
    const charRd = Number(comp.rd ?? comp.reducao_dano ?? raw.rd ?? raw.reducao_dano ?? 0);
    const damageReduction = charRd + itemRdBonus;

    return {
      defense,
      initiative,
      damageReduction
    };
  }, [selectedCharacter, ruleset, equippedItems]);

  const characterBackground = useMemo(() => {
    if (!selectedCharacter) {
      return { origin: '—', profession: '—', languages: '—' };
    }

    const raw = selectedCharacter.raw_data || {};
    const origin = raw.origem || raw.origin || raw.background || raw.historia || raw.historico || '—';
    const profession = raw.oficio || raw.profession || raw.classe || raw.class || raw.profissao || raw.ocupacao || '—';

    const rawLangs = raw.idiomas || raw.languages || raw.linguas;
    let languages = '—';
    if (Array.isArray(rawLangs)) {
      languages = rawLangs.length > 0 ? rawLangs.join(', ') : '—';
    } else if (typeof rawLangs === 'string' && rawLangs.trim()) {
      languages = rawLangs.trim();
    }

    return {
      origin,
      profession,
      languages
    };
  }, [selectedCharacter]);

  const isSecondaryTab = ['inventory', 'catalog', 'bestiary', 'masterTools', 'templates', 'rules', 'roller'].includes(activeTab);
  const secondaryTabNames: Record<string, string> = {
    inventory: 'Mochila',
    catalog: 'Catálogo',
    bestiary: 'Bestiário',
    masterTools: 'Mestre',
    templates: 'Modelos',
    rules: 'Regras',
    roller: 'Rolagens'
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#141716] text-[#ebe7de] select-none">
      {/* 
        NOVA ARQUITETURA EDITORIAL: BARRA SUPERIOR DE CONTEXTO DE 1 LINHA
        Substitui integralmente a barra lateral de 11 ícones, liberando 90-100% da tela para o conteúdo.
      */}
      <header className="border-b border-[#343b37]/70 bg-[#181c1a] px-4 sm:px-6 py-2 flex items-center justify-between gap-3 shrink-0 z-40">
        {/* Esquerda: Identificação e Voltar */}
        <div className="flex items-center space-x-3 min-w-0">
          <button
            onClick={onBack}
            title="Voltar ao Arquivo de Campanhas"
            className="p-1.5 rounded-lg bg-[#141716] hover:bg-[#252a27] text-[#9b9689] hover:text-[#ebe7de] border border-[#343b37] transition-colors flex items-center space-x-1"
          >
            <ChevronLeft className="w-4 h-4 text-[#c86d51]" />
            <span className="hidden md:inline font-mono text-[11px]">Mesas</span>
          </button>

          <div className="flex items-center space-x-2 truncate">
            <h1 className="font-serif font-bold text-lg text-[#ebe7de] truncate leading-none">
              {campaign.name}
            </h1>
            <span className="hidden sm:inline text-[10px] font-mono px-2 py-0.5 rounded bg-[#141716] text-[#6d9775] border border-[#343b37]">
              {ruleset?.config.systemName || 'D20'}
            </span>
          </div>
        </div>

        {/* Centro: Navegação Primária Editorial + Compêndio Sob Demanda */}
        <nav className="flex items-center space-x-1 bg-[#141716] border border-[#343b37] rounded-lg p-1">
          <button
            onClick={() => setActiveTab('vtt')}
            className={`px-3 py-1 rounded text-xs font-serif font-medium transition-all ${
              activeTab === 'vtt'
                ? 'bg-[#c86d51] text-[#141716] font-bold shadow-sm'
                : 'text-[#9b9689] hover:text-[#ebe7de]'
            }`}
          >
            Mesa Virtual
          </button>

          <button
            onClick={() => setActiveTab('sheets')}
            className={`px-3 py-1 rounded text-xs font-serif font-medium transition-all ${
              activeTab === 'sheets'
                ? 'bg-[#c86d51] text-[#141716] font-bold shadow-sm'
                : 'text-[#9b9689] hover:text-[#ebe7de]'
            }`}
          >
            Ficha
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-1 rounded text-xs font-serif font-medium transition-all ${
              activeTab === 'chat'
                ? 'bg-[#c86d51] text-[#141716] font-bold shadow-sm'
                : 'text-[#9b9689] hover:text-[#ebe7de]'
            }`}
          >
            Chat
          </button>

          {/* Menu Dropdown do Compêndio / Ferramentas Secundárias */}
          <div className="relative" ref={compendiumMenuRef}>
            <button
              onClick={() => setShowCompendiumMenu(!showCompendiumMenu)}
              className={`px-2.5 py-1 rounded text-xs font-serif font-medium transition-all flex items-center space-x-1 ${
                isSecondaryTab
                  ? 'bg-[#252a27] text-[#c86d51] border border-[#c86d51]/50 font-bold'
                  : 'text-[#9b9689] hover:text-[#ebe7de]'
              }`}
            >
              <span>{isSecondaryTab ? secondaryTabNames[activeTab] || 'Compêndio' : 'Compêndio'}</span>
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>

            {showCompendiumMenu && (
              <div className="absolute top-full right-0 mt-1.5 w-56 bg-[#1c201e] border border-[#343b37] rounded-xl shadow-2xl py-1 z-50 animate-fade-in text-xs font-serif divide-y divide-[#343b37]/50">
                <div className="p-1">
                  <button
                    onClick={() => { setActiveTab('inventory'); setShowCompendiumMenu(false); }}
                    className="w-full px-3 py-2 text-left hover:bg-[#252a27] text-[#ebe7de] rounded-lg flex items-center justify-between"
                  >
                    <span>Mochila / Inventário</span>
                    <Package className="w-3.5 h-3.5 text-[#9b9689]" />
                  </button>
                  <button
                    onClick={() => { setActiveTab('catalog'); setShowCompendiumMenu(false); }}
                    className="w-full px-3 py-2 text-left hover:bg-[#252a27] text-[#ebe7de] rounded-lg flex items-center justify-between"
                  >
                    <span>Catálogo de Itens</span>
                    <Sparkles className="w-3.5 h-3.5 text-[#9b9689]" />
                  </button>
                  <button
                    onClick={() => { setActiveTab('bestiary'); setShowCompendiumMenu(false); }}
                    className="w-full px-3 py-2 text-left hover:bg-[#252a27] text-[#ebe7de] rounded-lg flex items-center justify-between"
                  >
                    <span>Bestiário & Ameaças</span>
                    <Skull className="w-3.5 h-3.5 text-[#9b9689]" />
                  </button>
                  <button
                    onClick={() => { setActiveTab('templates'); setShowCompendiumMenu(false); }}
                    className="w-full px-3 py-2 text-left hover:bg-[#252a27] text-[#ebe7de] rounded-lg flex items-center justify-between"
                  >
                    <span>Modelos de Ficha</span>
                    <LayoutTemplate className="w-3.5 h-3.5 text-[#9b9689]" />
                  </button>
                  <button
                    onClick={() => { setActiveTab('rules'); setShowCompendiumMenu(false); }}
                    className="w-full px-3 py-2 text-left hover:bg-[#252a27] text-[#ebe7de] rounded-lg flex items-center justify-between"
                  >
                    <span>Motor de Regras</span>
                    <Terminal className="w-3.5 h-3.5 text-[#9b9689]" />
                  </button>
                  <button
                    onClick={() => { setActiveTab('roller'); setShowCompendiumMenu(false); }}
                    className="w-full px-3 py-2 text-left hover:bg-[#252a27] text-[#ebe7de] rounded-lg flex items-center justify-between"
                  >
                    <span>Rolador de Dados</span>
                    <Dices className="w-3.5 h-3.5 text-[#9b9689]" />
                  </button>
                </div>

                {isMaster && (
                  <div className="p-1 bg-[#141716]/60">
                    <button
                      onClick={() => { setActiveTab('masterTools'); setShowCompendiumMenu(false); }}
                      className="w-full px-3 py-2 text-left hover:bg-[#252a27] text-[#c86d51] font-bold rounded-lg flex items-center justify-between"
                    >
                      <span>Ferramentas do Mestre</span>
                      <Crown className="w-3.5 h-3.5 text-[#c86d51]" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </nav>

        {/* Direita: Ações Rápidas (Membros, Áudio, Convite, Novo Personagem) */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => setShowAudioDrawer(true)}
            title="Trilha Sonora & Ambientação (YouTube)"
            className="p-1.5 rounded-lg bg-[#141716] hover:bg-[#252a27] text-[#c86d51] hover:text-[#ebe7de] border border-[#343b37] transition-colors flex items-center gap-1.5"
          >
            <Music className="w-4 h-4" />
            <span className="text-xs font-serif hidden lg:inline">Áudio</span>
          </button>

          <button
            onClick={() => { setShowMembersModal(true); loadMembers(); }}
            title="Membros da Mesa"
            className="p-1.5 rounded-lg bg-[#141716] hover:bg-[#252a27] text-[#9b9689] hover:text-[#ebe7de] border border-[#343b37] transition-colors"
          >
            <Users className="w-4 h-4" />
          </button>

          {inviteCode ? (
            <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 bg-[#141716] border border-[#c86d51]/50 rounded-lg text-xs font-mono">
              <span className="text-[#c86d51] font-bold">{inviteCode}</span>
              <button onClick={() => copyToClipboard(inviteCode)} className="text-[#9b9689] hover:text-[#ebe7de]">
                {copiedInvite ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerateInvite}
              title="Gerar Convite"
              className="p-1.5 rounded-lg bg-[#141716] hover:bg-[#252a27] text-[#9b9689] hover:text-[#ebe7de] border border-[#343b37] transition-colors hidden sm:block"
            >
              <UserPlus className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setShowCreateCharModal(true)}
            className="px-3 py-1.5 bg-[#c86d51] hover:bg-[#d67b5f] text-[#141716] font-bold rounded-lg text-xs flex items-center space-x-1.5 transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Personagem</span>
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              title="Encerrar Sessão"
              className="p-1.5 rounded-lg bg-[#141716] hover:bg-[#252a27] text-[#9b9689] hover:text-[#b84a48] border border-[#343b37] transition-colors ml-1"
            >
              <LogOut className="w-4 h-4 text-[#b84a48]" />
            </button>
          )}
        </div>
      </header>

      {/* ÁREA PRINCIPAL DO CONTEÚDO (90% a 100% DA JANELA) */}
      <main className="flex-1 overflow-y-auto relative">
        {/* ======================================================== */}
        {/* 1. MESA VIRTUAL (VTT): 100% DA TELA */}
        {/* ======================================================== */}
        {activeTab === 'vtt' && (
          <div className="w-full h-full min-h-0 overflow-hidden flex flex-col">
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

        {/* ======================================================== */}
        {/* 2. FICHA DE PERSONAGEM: DOSSIÊ ASSIMÉTRICO EM 2 ZONAS */}
        {/* ======================================================== */}
        {activeTab === 'sheets' && (
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 w-full">
            {selectedCharacter ? (
              <div className="flex flex-col lg:flex-row items-start gap-8">
                {/* ZONA 1: COLUNA PRINCIPAL AMPLA (ESTILO FOLHA DE DOSSIÊ EDITORIAL) */}
                <div className="flex-1 min-w-0 space-y-6 w-full">
                  {/* Seletor Rápido de Personagens (Strip Superior Elegante) */}
                  {characters.length > 1 && (
                    <div className="flex items-center space-x-2 pb-3 border-b border-[#343b37]/50 overflow-x-auto">
                      <span className="text-[10px] font-mono text-[#9b9689] uppercase tracking-wider shrink-0 mr-1">
                        Dossiê:
                      </span>
                      {characters.map((c) => {
                        const isCur = selectedCharacter.id === c.id;
                        return (
                          <button
                            key={c.id}
                            onClick={() => {
                              setSelectedCharacter(c);
                              localStorage.setItem(`arcanum_selected_char_${user.id}_${campaign.id}`, c.id);
                            }}
                            className={`px-3 py-1 rounded-md text-xs font-serif transition-colors whitespace-nowrap flex items-center space-x-1.5 ${
                              isCur
                                ? 'bg-[#252a27] text-[#c86d51] border border-[#c86d51]/50 font-bold'
                                : 'text-[#9b9689] hover:text-[#ebe7de]'
                            }`}
                          >
                            <span>{c.name}</span>
                            {c.user_id === user.id && <span className="w-1.5 h-1.5 rounded-full bg-[#6d9775]" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Painel de Solicitações Pendentes (se houver) */}
                  {characterRequests.filter(r => r.status === 'pending').length > 0 && (
                    <div className="p-3 bg-[#1c201e] border border-[#c86d51]/50 rounded-lg flex items-center justify-between text-xs">
                      <span className="font-serif font-bold text-[#c86d51]">
                        Solicitações de Personagens Pendentes ({characterRequests.filter(r => r.status === 'pending').length})
                      </span>
                      {isMaster && (
                        <button
                          onClick={async () => {
                            const req = characterRequests.find(r => r.status === 'pending');
                            if (req) {
                              try {
                                await api.approveCharacterRequest(campaign.id, req.id);
                                toast.success('Aprovado', 'Personagem instanciado na mesa.');
                                loadCharacterRequests();
                                loadCampaignData();
                              } catch (err: any) {
                                toast.error('Erro ao aprovar', err.message);
                              }
                            }
                          }}
                          className="px-2.5 py-1 bg-[#6d9775] hover:bg-[#6d9775]/90 text-[#141716] font-bold rounded text-xs"
                        >
                          Aprovar Pendência
                        </button>
                      )}
                    </div>
                  )}

                  {/* Cabeçalho do Dossiê */}
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2.5">
                      <span className="text-xs font-mono uppercase tracking-widest text-[#c86d51]">
                        {selectedCharacter.raw_data?.classe || (selectedCharacter as any).class || 'Aventureiro'}
                      </span>
                      <span className="text-[#343b37]">•</span>
                      <span className="text-xs font-mono text-[#9b9689]">
                        Jogador: <strong className="text-[#ebe7de] font-normal">{selectedCharacter.owner_username || user.username}</strong>
                      </span>
                    </div>

                    <h1 className="text-4xl sm:text-5xl font-serif font-bold text-[#ebe7de] tracking-tight leading-none">
                      {selectedCharacter.name}
                    </h1>

                    <p className="text-xs text-[#9b9689] leading-relaxed pt-1">
                      {characterBackground.origin !== '—' ? `${characterBackground.origin} • ` : ''}
                      {characterBackground.profession !== '—' ? `${characterBackground.profession} • ` : ''}
                      Idiomas: {characterBackground.languages}
                    </p>
                  </div>

                  {/* Barras Finas de Precisão (Vida, Mana, Carga) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 border-y border-[#343b37]/70">
                    {/* Vida */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-baseline text-xs font-mono">
                        <span className="text-[#b84a48] font-semibold flex items-center space-x-1">
                          <Heart className="w-3.5 h-3.5" />
                          <span>Pontos de Vida</span>
                        </span>
                        <span className="text-[#ebe7de] font-bold">
                          {characterResources.currentHp} <span className="text-[#9b9689] font-normal">/ {characterResources.maxHp}</span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#1c201e] rounded-full overflow-hidden border border-[#343b37]/60">
                        <div
                          className="h-full bg-[#b84a48] transition-all duration-300"
                          style={{ width: `${characterResources.hpPercent}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-[#9b9689] block">{characterResources.hpFormulaLabel}</span>
                    </div>

                    {/* Mana / Recurso Secundário */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-baseline text-xs font-mono">
                        <span className="text-[#5b8299] font-semibold flex items-center space-x-1">
                          <Zap className="w-3.5 h-3.5" />
                          <span>{characterResources.manaLabel}</span>
                        </span>
                        <span className="text-[#ebe7de] font-bold">
                          {characterResources.currentMana} <span className="text-[#9b9689] font-normal">/ {characterResources.maxMana}</span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#1c201e] rounded-full overflow-hidden border border-[#343b37]/60">
                        <div
                          className="h-full bg-[#5b8299] transition-all duration-300"
                          style={{ width: `${characterResources.manaPercent}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-[#9b9689] block">{characterResources.manaFormulaLabel}</span>
                    </div>

                    {/* Carga */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-baseline text-xs font-mono">
                        <span className="text-[#c86d51] font-semibold flex items-center space-x-1">
                          <Weight className="w-3.5 h-3.5" />
                          <span>Capacidade de Carga</span>
                        </span>
                        <span className="text-[#ebe7de] font-bold">
                          {characterResources.currentWeight} <span className="text-[#9b9689] font-normal">/ {characterResources.maxWeight} kg</span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#1c201e] rounded-full overflow-hidden border border-[#343b37]/60">
                        <div
                          className="h-full bg-[#c86d51] transition-all duration-300"
                          style={{ width: `${characterResources.weightPercent}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-[#9b9689] block">Atomicamente calculada</span>
                    </div>
                  </div>

                  {/* Faixa Horizontal Limpa de Atributos (Sem Caixas Repetitivas) */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#9b9689] block">
                      Matriz de Atributos (Clique para rolar teste)
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {ruleset?.config.attributes.map((attr) => {
                        const val = selectedCharacter.computed_data[attr.id] !== undefined
                          ? selectedCharacter.computed_data[attr.id]
                          : selectedCharacter.computed_data[attr.name] || attr.defaultValue;
                        const mod = Math.floor((Number(val) - 10) / 2);
                        const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
                        const canRoll = selectedCharacter.user_id === user.id || isMaster;

                        return (
                          <div
                            key={attr.id}
                            onClick={() => {
                              if (!canRoll) return;
                              handleAttributeRoll(attr.name);
                            }}
                            className={`p-3 bg-[#1c201e] border border-[#343b37] rounded-lg text-center transition-all ${
                              canRoll ? 'hover:border-[#c86d51] cursor-pointer active:scale-95' : 'opacity-60'
                            }`}
                          >
                            <span className="text-[10px] font-mono uppercase tracking-wider text-[#9b9689] block truncate">
                              {attr.abbr || attr.name.slice(0, 3)}
                            </span>
                            <span className="font-serif text-2xl font-bold text-[#ebe7de] my-0.5 block">
                              {val}
                            </span>
                            <span className="text-[10px] font-mono text-[#c86d51] font-semibold">
                              {modStr}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Abas Internas da Ficha (Habilidades, Equipamento, Antecedentes) */}
                  <div className="pt-4">
                    <div className="flex border-b border-[#343b37] text-xs font-serif mb-4">
                      <button
                        type="button"
                        onClick={() => setSheetInnerTab('abilities')}
                        className={`pb-2.5 px-4 font-bold transition-colors relative ${
                          sheetInnerTab === 'abilities'
                            ? 'text-[#c86d51]'
                            : 'text-[#9b9689] hover:text-[#ebe7de]'
                        }`}
                      >
                        <span>Habilidades</span>
                        <span className="ml-1.5 font-mono text-[10px] text-[#9b9689] font-normal">
                          ({characterSkills.length}/{maxSkills})
                        </span>
                        {sheetInnerTab === 'abilities' && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#c86d51]" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSheetInnerTab('equipment')}
                        className={`pb-2.5 px-4 font-bold transition-colors relative ${
                          sheetInnerTab === 'equipment'
                            ? 'text-[#c86d51]'
                            : 'text-[#9b9689] hover:text-[#ebe7de]'
                        }`}
                      >
                        <span>Equipamento Empunhado</span>
                        <span className="ml-1.5 font-mono text-[10px] text-[#9b9689] font-normal">
                          ({equippedItems.length})
                        </span>
                        {sheetInnerTab === 'equipment' && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#c86d51]" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSheetInnerTab('lore')}
                        className={`pb-2.5 px-4 font-bold transition-colors relative ${
                          sheetInnerTab === 'lore'
                            ? 'text-[#c86d51]'
                            : 'text-[#9b9689] hover:text-[#ebe7de]'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Lore & Crônicas</span>
                        </span>
                        {sheetInnerTab === 'lore' && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#c86d51]" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSheetInnerTab('background')}
                        className={`pb-2.5 px-4 font-bold transition-colors relative ${
                          sheetInnerTab === 'background'
                            ? 'text-[#c86d51]'
                            : 'text-[#9b9689] hover:text-[#ebe7de]'
                        }`}
                      >
                        <span>Crônica & Notas</span>
                        {sheetInnerTab === 'background' && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#c86d51]" />
                        )}
                      </button>
                    </div>

                    {/* Conteúdo Aba Habilidades */}
                    {sheetInnerTab === 'abilities' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pb-2">
                          <span className="text-xs text-[#9b9689]">
                            Habilidades ativas e capacidades mágicas ou técnicas.
                          </span>
                          {canManageSkills && (
                            <button
                              type="button"
                              disabled={characterSkills.length >= maxSkills}
                              onClick={() => setShowAddSkillModal(true)}
                              className="px-3 py-1 bg-[#1c201e] hover:bg-[#252a27] text-[#c86d51] border border-[#343b37] hover:border-[#c86d51] rounded-lg text-xs font-serif font-bold transition-all flex items-center space-x-1"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Nova Habilidade</span>
                            </button>
                          )}
                        </div>

                        {characterSkills.length === 0 ? (
                          <div className="py-8 text-center text-xs text-[#9b9689] border border-dashed border-[#343b37] rounded-lg">
                            Nenhuma habilidade cadastrada nesta ficha.
                          </div>
                        ) : (
                          <div className="divide-y divide-[#343b37]/50 border-t border-b border-[#343b37]/50">
                            {characterSkills.map((ab: any, idx: number) => (
                              <div key={ab.id || idx} className="py-3 flex items-start justify-between gap-4">
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center space-x-2">
                                    <h4 className="font-serif font-bold text-base text-[#ebe7de]">
                                      {ab.name}
                                    </h4>
                                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-[#1c201e] text-[#6d9775] border border-[#343b37]">
                                      {ab.type || 'Ação'}
                                    </span>
                                    {ab.resource_cost && (
                                      <span className="text-[11px] font-mono text-[#5b8299]">
                                        Custo: {ab.resource_cost.amount} {ab.resource_cost.name}
                                      </span>
                                    )}
                                  </div>
                                  {ab.description && (
                                    <p className="text-xs text-[#9b9689] leading-relaxed">
                                      {ab.description}
                                    </p>
                                  )}
                                  {(ab.attack_formula || ab.damage_formula) && (
                                    <div className="text-[11px] font-mono text-[#c86d51]">
                                      {ab.attack_formula ? `Ataque: ${ab.attack_formula} ` : ''}
                                      {ab.damage_formula ? `• Dano: ${ab.damage_formula}` : ''}
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center space-x-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const formula = ab.attack_formula || ab.damage_formula || '1d20';
                                      handleQuickRoll(formula);
                                    }}
                                    className="px-3 py-1 bg-[#c86d51] hover:bg-[#d67b5f] text-[#141716] font-bold rounded text-xs transition-all active:scale-95"
                                  >
                                    Executar
                                  </button>
                                  {canManageSkills && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSkill(ab.id, ab.name)}
                                      className="p-1 text-[#9b9689] hover:text-[#b84a48] transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Conteúdo Aba Equipamento */}
                    {sheetInnerTab === 'equipment' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pb-2">
                          <span className="text-xs text-[#9b9689]">
                            Armas e proteções em uso imediato pelo personagem.
                          </span>
                          <button
                            onClick={() => setActiveTab('inventory')}
                            className="text-xs text-[#c86d51] hover:underline font-mono"
                          >
                            Abrir Mochila Completa →
                          </button>
                        </div>

                        {equippedItems.length === 0 ? (
                          <div className="py-8 text-center text-xs text-[#9b9689] border border-dashed border-[#343b37] rounded-lg">
                            Nenhum item empunhado no momento.
                          </div>
                        ) : (
                          <div className="divide-y divide-[#343b37]/50 border-t border-b border-[#343b37]/50">
                            {equippedItems.map((item: any) => (
                              <div key={item.id} className="py-2.5 flex items-center justify-between">
                                <div>
                                  <span className="text-[#ebe7de] font-serif font-bold text-sm block">{item.item_name}</span>
                                  <span className="text-[10px] text-[#9b9689] font-mono">{item.category} • {item.weight}kg</span>
                                </div>
                                <span className="font-mono text-xs text-[#c86d51] font-semibold">
                                  {item.properties?.dano || item.properties?.damage_formula || item.properties?.defesa ? `+ ${item.properties?.defesa || item.properties?.dano}` : 'Equipado'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Conteúdo Aba Lore & Crônicas com Privacidade Granular */}
                    {sheetInnerTab === 'lore' && selectedCharacter && (
                      <CharacterLoreView
                        campaignId={campaign.id}
                        character={selectedCharacter}
                        currentUser={user}
                        isMaster={isMaster}
                      />
                    )}

                    {/* Conteúdo Aba Antecedentes */}
                    {sheetInnerTab === 'background' && (
                      <div className="space-y-4 text-xs leading-relaxed text-[#ebe7de]">
                        <div className="p-4 bg-[#1c201e] border border-[#343b37] rounded-lg space-y-2">
                          <h4 className="font-serif font-bold text-sm text-[#c86d51]">Origem & Histórico</h4>
                          <p className="text-[#9b9689]">
                            {selectedCharacter.raw_data?.history || selectedCharacter.raw_data?.origem || 'Nenhum histórico pregresso registrado no dossiê.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ZONA 2: COLUNA LATERAL ESTREITA E DISCRETA (AÇÕES RÁPIDAS & ROLAGENS) */}
                <div className="w-full lg:w-72 shrink-0 space-y-6 pt-2">
                  {/* Bloco de Defesas Passivas */}
                  <div className="p-4 bg-[#1c201e] border border-[#343b37] rounded-lg space-y-3">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#9b9689] block">
                      Prontidão de Combate
                    </span>
                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex justify-between items-center py-1 border-b border-[#343b37]/60">
                        <span className="text-[#9b9689]">Classe de Armadura:</span>
                        <span className="font-bold text-[#c86d51] text-base">{derivedStats.defense}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-[#343b37]/60">
                        <span className="text-[#9b9689]">Iniciativa Tática:</span>
                        <span className="font-bold text-[#ebe7de] text-base">
                          {derivedStats.initiative >= 0 ? `+${derivedStats.initiative}` : derivedStats.initiative}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-[#9b9689]">Redução de Dano (RD):</span>
                        <span className="font-bold text-[#ebe7de] text-base">{derivedStats.damageReduction}</span>
                      </div>
                    </div>
                  </div>

                  {/* Ações Rápidas de Teste */}
                  <div className="p-4 bg-[#1c201e] border border-[#343b37] rounded-lg space-y-2.5">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#9b9689] block">
                      Ações Imediatas
                    </span>
                    <div className="space-y-1.5">
                      <button
                        onClick={() => handleQuickRoll('1d20 + floor((Forca - 10) / 2)')}
                        className="w-full py-2 px-3 bg-[#141716] hover:bg-[#252a27] border border-[#343b37] hover:border-[#c86d51] text-left rounded text-xs font-serif flex items-center justify-between transition-colors"
                      >
                        <span>Ataque Corpo a Corpo</span>
                        <span className="font-mono text-[10px] text-[#9b9689]">1d20+FOR</span>
                      </button>
                      <button
                        onClick={() => handleQuickRoll('1d20 + floor((Destreza - 10) / 2)')}
                        className="w-full py-2 px-3 bg-[#141716] hover:bg-[#252a27] border border-[#343b37] hover:border-[#c86d51] text-left rounded text-xs font-serif flex items-center justify-between transition-colors"
                      >
                        <span>Esquiva Tática</span>
                        <span className="font-mono text-[10px] text-[#9b9689]">1d20+DES</span>
                      </button>
                      <button
                        onClick={() => handleQuickRoll('1d20')}
                        className="w-full py-2 px-3 bg-[#141716] hover:bg-[#252a27] border border-[#343b37] hover:border-[#c86d51] text-left rounded text-xs font-serif flex items-center justify-between transition-colors"
                      >
                        <span>Teste Puro de D20</span>
                        <span className="font-mono text-[10px] text-[#9b9689]">1d20</span>
                      </button>
                    </div>
                  </div>

                  {/* Histórico Recente de Dados */}
                  <div className="p-4 bg-[#1c201e] border border-[#343b37] rounded-lg space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[#9b9689]">
                        Rolagens Recentes
                      </span>
                      <Dices className="w-3.5 h-3.5 text-[#c86d51]" />
                    </div>

                    <div className="space-y-2 text-xs font-mono max-h-56 overflow-y-auto">
                      {rollHistory.length === 0 ? (
                        <p className="text-[#9b9689] italic py-2">Sem rolagens recentes.</p>
                      ) : (
                        rollHistory.slice(0, 5).map((roll, i) => (
                          <div key={roll.id || i} className="py-1.5 border-b border-[#343b37]/50 last:border-b-0 flex items-center justify-between">
                            <div>
                              <span className="text-[#ebe7de] block truncate text-[11px]">{roll.expression}</span>
                              <span className="text-[9px] text-[#9b9689]">{roll.characterName || roll.username}</span>
                            </div>
                            <span className="text-[#c86d51] font-bold text-sm">{roll.total}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-20 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-[#1c201e] border border-[#343b37] flex items-center justify-center text-[#c86d51] mx-auto">
                  <Shield className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-serif text-xl font-bold text-[#ebe7de]">Nenhum personagem selecionado</h3>
                  <p className="text-xs text-[#9b9689] max-w-sm mx-auto">
                    Crie um novo personagem para ingressar na crônica ou selecione uma ficha existente.
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateCharModal(true)}
                  className="px-4 py-2 bg-[#c86d51] hover:bg-[#d67b5f] text-[#141716] font-bold rounded-lg text-xs"
                >
                  + Forjar Personagem
                </button>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. MÓDULOS DO COMPÊNDIO (INVENTÁRIO, CATÁLOGO, ETC.) */}
        {/* ======================================================== */}
        {activeTab === 'inventory' && (
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 w-full">
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
          </div>
        )}

        {activeTab === 'catalog' && (
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 w-full">
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
          </div>
        )}

        {activeTab === 'bestiary' && (
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 w-full">
            <BestiaryManager
              campaignId={campaign.id}
              isMaster={isMaster}
            />
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 w-full">
            <TemplateEditor
              campaign={campaign}
              user={user}
              onRefreshCampaign={loadCampaignData}
            />
          </div>
        )}

        {activeTab === 'rules' && ruleset && (
          <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 w-full space-y-6">
            <div className="border-b border-[#343b37] pb-4">
              <span className="text-xs font-mono uppercase tracking-widest text-[#c86d51]">Motor de Regras</span>
              <h2 className="text-3xl font-serif font-bold text-[#ebe7de] mt-1">
                {ruleset.config.systemName}
              </h2>
              <p className="text-xs text-[#9b9689] mt-0.5">
                Dado base: <span className="font-mono text-[#c86d51]">{ruleset.config.defaultDice}</span> · Versão {ruleset.version}
              </p>
            </div>

            {/* Testador de Fórmulas */}
            <div className="p-5 bg-[#1c201e] border border-[#343b37] rounded-xl space-y-3">
              <span className="text-xs font-mono uppercase tracking-wider text-[#ebe7de] block">
                Sandbox de Fórmulas Aritméticas (Sem eval)
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testFormula}
                  onChange={(e) => handleValidateFormula(e.target.value)}
                  placeholder="Ex: 1d20 + Forca, max(0, Dano - Armadura)"
                  className="flex-1 px-3.5 py-2.5 bg-[#141716] border border-[#343b37] focus:border-[#c86d51] rounded-lg text-sm text-[#ebe7de] font-mono focus:outline-none"
                />
                <button
                  onClick={handleExecuteTestRoll}
                  disabled={Boolean(validationResult && !validationResult.isValid)}
                  className="px-4 py-2.5 bg-[#c86d51] hover:bg-[#d67b5f] text-[#141716] font-bold rounded-lg text-xs"
                >
                  Executar
                </button>
              </div>

              {testRollResult && (
                <div className="p-3 bg-[#141716] border border-[#343b37] rounded-lg flex items-center justify-between text-xs font-mono">
                  <span className="text-[#9b9689]">Resultado: <strong className="text-[#ebe7de]">{testRollResult.breakdown?.expression}</strong></span>
                  <span className="text-2xl font-bold text-[#c86d51]">{testRollResult.total}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'roller' && (
          <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 w-full space-y-6">
            <div className="border-b border-[#343b37] pb-4">
              <span className="text-xs font-mono uppercase tracking-widest text-[#c86d51]">Arquivo de Dados</span>
              <h2 className="text-3xl font-serif font-bold text-[#ebe7de] mt-1">Rolador & Histórico</h2>
            </div>

            <div className="p-5 bg-[#1c201e] border border-[#343b37] rounded-xl space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={diceExpr}
                  onChange={(e) => setDiceExpr(e.target.value)}
                  placeholder="1d20 + 3, 2d6, 1d100..."
                  className="flex-1 px-3.5 py-2.5 bg-[#141716] border border-[#343b37] focus:border-[#c86d51] rounded-lg text-sm text-[#ebe7de] font-mono focus:outline-none"
                />
                <button
                  onClick={() => handleQuickRoll(diceExpr)}
                  className="px-5 py-2.5 bg-[#c86d51] hover:bg-[#d67b5f] text-[#141716] font-bold rounded-lg text-xs"
                >
                  Rolar
                </button>
              </div>

              <div className="flex items-center space-x-2 text-xs font-mono text-[#9b9689]">
                <input
                  type="checkbox"
                  id="secretRoll"
                  checked={isSecretRoll}
                  onChange={(e) => setIsSecretRoll(e.target.checked)}
                  className="rounded border-[#343b37]"
                />
                <label htmlFor="secretRoll" className="cursor-pointer">
                  Rolagem Secreta (Somente Mestre vê)
                </label>
              </div>
            </div>

            <div className="divide-y divide-[#343b37]/50 border-t border-b border-[#343b37]/50">
              {rollHistory.map((r, i) => (
                <div key={r.id || i} className="py-3 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-[#ebe7de] font-bold">{r.username || 'Jogador'}</span>
                    {r.characterName && <span className="text-[#9b9689] ml-1.5">({r.characterName})</span>}
                    <span className="text-[#9b9689] ml-2">{r.expression}</span>
                  </div>
                  <span className="text-xl font-bold text-[#c86d51]">{r.total}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 w-full h-full flex flex-col justify-between">
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
              <div className="text-xs font-mono text-[#9b9689] text-center py-2 border-b border-[#343b37]/60">
                Crônica ao vivo via WebSockets da campanha
              </div>
              {messages.map((m, i) => (
                <div key={m.id || i} className="p-3 bg-[#1c201e] border border-[#343b37] rounded-lg space-y-1">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-[#c86d51] font-bold">{m.sender}</span>
                    <span className="text-[#9b9689] text-[10px]">
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-[#ebe7de] leading-relaxed">{m.text}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendChat} className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Enviar mensagem para os aventureiros..."
                className="flex-1 px-3.5 py-2.5 bg-[#141716] border border-[#343b37] focus:border-[#c86d51] rounded-lg text-sm text-[#ebe7de] focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-[#c86d51] hover:bg-[#d67b5f] text-[#141716] font-bold rounded-lg text-xs flex items-center space-x-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar</span>
              </button>
            </form>
          </div>
        )}

        {activeTab === 'masterTools' && isMaster && (
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 w-full">
            <MasterToolsManager
              campaign={campaign}
              user={user}
              isMaster={isMaster}
            />
          </div>
        )}
      </main>

      {/* MODAIS (CRIAR PERSONAGEM, MEMBROS, HABILIDADE) */}
      {showCreateCharModal && ruleset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-[#1c201e] border border-[#343b37] rounded-xl p-6 sm:p-8 relative text-[#ebe7de] shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#343b37] mb-4">
              <h2 className="text-xl font-serif font-bold text-[#ebe7de]">Forjar Personagem</h2>
              <button onClick={() => setShowCreateCharModal(false)} className="text-[#9b9689] hover:text-[#ebe7de]">✕</button>
            </div>
            <form onSubmit={handleCreateCharacter} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-mono text-[#9b9689] uppercase">Nome</label>
                <input
                  type="text"
                  required
                  value={newCharName}
                  onChange={(e) => setNewCharName(e.target.value)}
                  placeholder="Ex: Kaelen, Lyra..."
                  className="w-full px-3.5 py-2.5 bg-[#141716] border border-[#343b37] focus:border-[#c86d51] rounded-lg text-sm text-[#ebe7de] focus:outline-none"
                />
              </div>

              {templates.length > 0 && (
                <div className="space-y-1">
                  <label className="block text-xs font-mono text-[#9b9689] uppercase">Modelo de Ficha</label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#141716] border border-[#343b37] rounded-lg text-sm text-[#ebe7de]"
                  >
                    <option value="">Ficha Padrão da Campanha</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-mono text-[#9b9689] uppercase">Atributos Iniciais</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {ruleset.config.attributes.filter(a => !a.isDerived).map((attr) => (
                    <div key={attr.id} className="p-2 bg-[#141716] border border-[#343b37] rounded flex items-center justify-between">
                      <span className="text-xs font-mono text-[#9b9689]">{attr.name}</span>
                      <input
                        type="number"
                        min={attr.min ?? 0}
                        max={attr.max ?? 100}
                        value={newCharAttributes[attr.name] ?? attr.defaultValue}
                        onChange={(e) => setNewCharAttributes({ ...newCharAttributes, [attr.name]: parseInt(e.target.value, 10) || 0 })}
                        className="w-16 px-2 py-1 bg-[#1c201e] border border-[#343b37] rounded text-right text-xs font-mono text-[#ebe7de]"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#343b37]">
                <button
                  type="button"
                  onClick={() => setShowCreateCharModal(false)}
                  className="px-4 py-2 bg-[#141716] text-[#9b9689] hover:text-[#ebe7de] rounded-lg text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#c86d51] hover:bg-[#d67b5f] text-[#141716] font-bold rounded-lg text-xs"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Membros */}
      {showMembersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-[#1c201e] border border-[#343b37] rounded-xl p-6 relative text-[#ebe7de] shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#343b37] mb-4">
              <h3 className="font-serif text-xl font-bold">Membros da Campanha</h3>
              <button onClick={() => setShowMembersModal(false)} className="text-[#9b9689] hover:text-[#ebe7de]">✕</button>
            </div>
            {loadingMembers ? (
              <div className="py-8 text-center text-xs text-[#9b9689]">Carregando membros...</div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {campaignMembers.map((m) => {
                  const memberId = m.userId || m.user_id || m.id;
                  const canKick = isMaster && m.role !== 'owner' && memberId !== user.id;
                  const isPending = memberToRemove === memberId;
                  return (
                    <div key={memberId} className="p-3 bg-[#141716] border border-[#343b37] rounded-lg flex items-center justify-between">
                      <div>
                        <span className="font-serif font-bold text-sm block">{m.username}</span>
                        <span className="text-[10px] font-mono text-[#9b9689]">{m.role}</span>
                      </div>
                      {canKick && (
                        isPending ? (
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleKickMember(memberId, m.username)}
                              className="px-2 py-1 bg-[#b84a48] text-white rounded text-xs font-bold"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => setMemberToRemove(null)}
                              className="px-2 py-1 bg-[#252a27] text-[#ebe7de] rounded text-xs"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setMemberToRemove(memberId)}
                            className="px-3 py-1 bg-[#b84a48]/20 hover:bg-[#b84a48] text-[#b84a48] hover:text-white border border-[#b84a48]/40 rounded text-xs transition-colors"
                          >
                            Remover
                          </button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Adicionar Habilidade */}
      {showAddSkillModal && selectedCharacter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-[#1c201e] border border-[#343b37] rounded-xl p-6 relative text-[#ebe7de] shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#343b37] mb-4">
              <h3 className="font-serif text-xl font-bold">Nova Habilidade</h3>
              <button onClick={() => setShowAddSkillModal(false)} className="text-[#9b9689] hover:text-[#ebe7de]">✕</button>
            </div>
            <form onSubmit={handleAddSkill} className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-[#9b9689] uppercase mb-1">Nome da Habilidade</label>
                <input
                  type="text"
                  required
                  value={skillForm.name}
                  onChange={(e) => setSkillForm({ ...skillForm, name: e.target.value })}
                  placeholder="Ex: Golpe Flamejante, Rajada Mística..."
                  className="w-full px-3 py-2 bg-[#141716] border border-[#343b37] rounded-lg text-sm text-[#ebe7de] focus:outline-none focus:border-[#c86d51]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-mono text-[#9b9689] uppercase mb-1">Fórmula de Ataque</label>
                  <input
                    type="text"
                    value={skillForm.attack_formula}
                    onChange={(e) => setSkillForm({ ...skillForm, attack_formula: e.target.value })}
                    placeholder="1d20 + 4"
                    className="w-full px-3 py-2 bg-[#141716] border border-[#343b37] rounded-lg text-sm text-[#ebe7de] font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#9b9689] uppercase mb-1">Fórmula de Dano</label>
                  <input
                    type="text"
                    value={skillForm.damage_formula}
                    onChange={(e) => setSkillForm({ ...skillForm, damage_formula: e.target.value })}
                    placeholder="2d6 + 3"
                    className="w-full px-3 py-2 bg-[#141716] border border-[#343b37] rounded-lg text-sm text-[#ebe7de] font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-[#9b9689] uppercase mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={skillForm.description}
                  onChange={(e) => setSkillForm({ ...skillForm, description: e.target.value })}
                  placeholder="Efeitos, alcance, condições..."
                  className="w-full px-3 py-2 bg-[#141716] border border-[#343b37] rounded-lg text-sm text-[#ebe7de] focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#343b37]">
                <button
                  type="button"
                  onClick={() => setShowAddSkillModal(false)}
                  className="px-4 py-2 bg-[#141716] text-[#9b9689] hover:text-[#ebe7de] rounded-lg text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSkill}
                  className="px-5 py-2 bg-[#c86d51] hover:bg-[#d67b5f] text-[#141716] font-bold rounded-lg text-xs"
                >
                  {isSubmittingSkill ? 'Gravando...' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 1. Player de Áudio e Ambientação da Sessão (YouTube) */}
      <AudioManager
        campaignId={campaign.id}
        isMaster={isMaster}
        isOpen={showAudioDrawer}
        onClose={() => setShowAudioDrawer(false)}
        activeAudioEvent={latestAudioEvent}
      />

      {/* 2. Botão Flutuante de Sussurro Privado com o Mestre (Canto Inferior Direito) */}
      <WhisperDock
        campaignId={campaign.id}
        currentUser={user}
        isMaster={isMaster}
        activeWhisperEvent={latestWhisperEvent}
      />
    </div>
  );
};
