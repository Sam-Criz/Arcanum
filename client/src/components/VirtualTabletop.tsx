import { notify } from './NotificationProvider';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Scene, Token, CombatEncounter, Character, Campaign, User, EnvironmentalCondition, api 
} from '../services/api';
import { CombatTracker } from './CombatTracker';
import CharacterDetails from './CharacterDetails';
import { 
  ZoomIn, ZoomOut, RotateCcw, Grid, Eye, EyeOff, Lock, Unlock, 
  Plus, Settings, Trash2, Swords, Layers, X, Maximize2, Undo, Sparkles, Shield, Zap,
  CloudRain, Flame, Wind, Sun, Moon, Skull, ChevronLeft, Map as MapIcon
} from 'lucide-react';

interface VirtualTabletopProps {
  campaign: Campaign;
  user: User;
  isMaster: boolean;
  selectedCharacter: Character | null;
  characters: Character[];
  onCharacterUpdated?: (char: Character) => void;
  wsRef?: React.MutableRefObject<WebSocket | null>;
  lastVttEvent?: any;
  subscribeVtt?: (listener: (msg: any) => void) => () => void;
}

export const VirtualTabletop: React.FC<VirtualTabletopProps> = ({
  campaign,
  user,
  isMaster,
  selectedCharacter,
  characters,
  onCharacterUpdated,
  wsRef,
  lastVttEvent,
  subscribeVtt
}) => {
  // Estado das cenas
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeScene, setActiveScene] = useState<Scene | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [combatEncounter, setCombatEncounter] = useState<CombatEncounter | null>(null);
  const [environmentalConditions, setEnvironmentalConditions] = useState<EnvironmentalCondition[]>([]);
  const [imageError, setImageError] = useState(false);

  // Controles de Visualização (Pan & Zoom)
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const hasAutoFittedRef = useRef(false);

  // Painéis e Modais
  const [showCombatDock, setShowCombatDock] = useState(false);
  const [quickActionTab, setQuickActionTab] = useState<'attack' | 'ability' | 'consumable' | 'defense'>('attack');
  const [quickSelectedTargetId, setQuickSelectedTargetId] = useState<string>('');
  const [selectedQuickActionId, setSelectedQuickActionId] = useState<string>('');
  const [isExecutingQuickAction, setIsExecutingQuickAction] = useState<boolean>(false);
  const [quickActionFeedback, setQuickActionFeedback] = useState<string | null>(null);
  const [showTargetModal, setShowTargetModal] = useState<boolean>(false);
  const [showImbueModal, setShowImbueModal] = useState<boolean>(false);
  const [selectedWeaponForImbue, setSelectedWeaponForImbue] = useState<any | null>(null);
  const [selectedOilForImbue, setSelectedOilForImbue] = useState<string>('');
  const [isExecutingImbue, setIsExecutingImbue] = useState<boolean>(false);
  const [dockInventory, setDockInventory] = useState<any[]>([]);
  const [dockInventoryTrigger, setDockInventoryTrigger] = useState<number>(0);
  const [showSceneModal, setShowSceneModal] = useState(false);
  const [showAddTokenModal, setShowAddTokenModal] = useState(false);
  const [showEditTokenModal, setShowEditTokenModal] = useState(false);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [selectedCharacterDetails, setSelectedCharacterDetails] = useState<any | null>(null);
  const [isEditingScene, setIsEditingScene] = useState(false);
  const [isSceneIslandCollapsed, setIsSceneIslandCollapsed] = useState(false);
  const [isToolsIslandCollapsed, setIsToolsIslandCollapsed] = useState(false);

  // Fog of war mode (GM only)
  const [fogMode, setFogMode] = useState<'view' | 'hide' | 'reveal'>('view');
  const [fogDragStart, setFogDragStart] = useState<{ x: number; y: number } | null>(null);
  const [currentFogRect, setCurrentFogRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Vínculo Reativo do Dock Tático ao Personagem/Token Ativo
  const activeTurnCombatant = combatEncounter?.combatants?.[combatEncounter.turn_index];
  const selectedTokenCombatant = selectedToken ? combatEncounter?.combatants?.find(c => c.token_id === selectedToken.id || (selectedToken.character_id && c.character_id === selectedToken.character_id)) : null;
  const dockCombatant = (isMaster && selectedTokenCombatant) ? selectedTokenCombatant : (activeTurnCombatant || selectedTokenCombatant);
  const dockCharId = dockCombatant?.character_id || selectedToken?.character_id || selectedCharacter?.id || (characters.find(c => c.user_id === user.id)?.id);

  useEffect(() => {
    if (dockCharId && campaign?.id) {
      api.getCharacterInventory(campaign.id, dockCharId)
        .then((res: any) => {
          const items = Array.isArray(res) ? res : (res?.items || []);
          setDockInventory(items);
        })
        .catch(() => setDockInventory([]));
    } else {
      setDockInventory([]);
    }
  }, [dockCharId, campaign?.id, dockInventoryTrigger]);

  // Arraste de Tokens
  const [draggingTokenId, setDraggingTokenId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Formulário de Cena (GM)
  const [sceneForm, setSceneForm] = useState<{
    name: string;
    image_url: string;
    grid_size: number;
    grid_scale: number;
    grid_scale_unit: string;
    grid_color: string;
    grid_opacity: number;
    width: number;
    height: number;
    fog_enabled: boolean;
  }>({
    name: '',
    image_url: '',
    grid_size: 50,
    grid_scale: 1.5,
    grid_scale_unit: 'm',
    grid_color: '#ffffff',
    grid_opacity: 0.25,
    width: 2000,
    height: 2000,
    fog_enabled: false
  });

  // Formulário de Criação de Token / NPC
  const [tokenFormCharId, setTokenFormCharId] = useState('');
  const [tokenFormName, setTokenFormName] = useState('');
  const [tokenFormAvatar, setTokenFormAvatar] = useState('');
  const [tokenFormSize, setTokenFormSize] = useState<number>(1);
  const [tokenFormColor, setTokenFormColor] = useState('#c9a04e');
  const [tokenNpcDefense, setTokenNpcDefense] = useState<number>(10);
  const [tokenNpcDR, setTokenNpcDR] = useState<number>(0);
  const [tokenNpcResistances, setTokenNpcResistances] = useState('');
  const [tokenNpcVulnerabilities, setTokenNpcVulnerabilities] = useState('');
  const [tokenNpcImmunities, setTokenNpcImmunities] = useState('');
  const [tokenNpcInitiativeFormula, setTokenNpcInitiativeFormula] = useState('1d20');
  const [tokenNpcHp, setTokenNpcHp] = useState<number>(20);
  const [tokenNpcMaxHp, setTokenNpcMaxHp] = useState<number>(20);

  // Formulário de Edição de Token / NPC (Mestre)
  const [editTokenForm, setEditTokenForm] = useState<{
    id: string;
    name: string;
    size: number;
    color: string;
    current_hp: number;
    max_hp: number;
    defense: number;
    damage_reduction: number;
    resistances: string;
    vulnerabilities: string;
    immunities: string;
    initiative_formula: string;
  }>({
    id: '',
    name: '',
    size: 1,
    color: '#c9a04e',
    current_hp: 20,
    max_hp: 20,
    defense: 10,
    damage_reduction: 0,
    resistances: '',
    vulnerabilities: '',
    immunities: '',
    initiative_formula: '1d20'
  });

  const viewportRef = useRef<HTMLDivElement | null>(null);

  // ==========================================
  // CARREGAMENTO INICIAL E RESTAURAÇÃO DE CENA
  // ==========================================
  useEffect(() => {
    loadVttData();
  }, [campaign.id]);

  const loadVttData = async () => {
    try {
      const res = await api.getScenes(campaign.id);
      setScenes(res.scenes);

      // Restauração de cena ativa do localStorage
      const storageKey = `arcanum_active_scene_${campaign.id}`;
      const savedSceneId = localStorage.getItem(storageKey);
      let targetScene: Scene | null = null;

      if (savedSceneId) {
        targetScene = res.scenes.find(s => s.id === savedSceneId) || null;
      }
      if (!targetScene) {
        targetScene = res.activeScene || (res.scenes.length > 0 ? res.scenes[0] : null);
      }

      if (targetScene) {
        setActiveScene(targetScene);
        localStorage.setItem(storageKey, targetScene.id);
      }

      const activeCombat = await api.getActiveCombat(campaign.id);
      setCombatEncounter(activeCombat);
      if (activeCombat && activeCombat.status !== 'ended') {
        setShowCombatDock(true);
      }
    } catch (e) {
      console.error('Erro ao carregar dados do VTT:', e);
    }
  };

  // Carregar tokens sempre que a cena ativa mudar
  useEffect(() => {
    if (activeScene?.id) {
      setImageError(false);
      localStorage.setItem(`arcanum_active_scene_${campaign.id}`, activeScene.id);
      loadTokens(activeScene.id);

      // Auto-fit na primeira renderização da cena
      if (!hasAutoFittedRef.current) {
        setTimeout(() => {
          fitToScreen();
          hasAutoFittedRef.current = true;
        }, 120);
      }
    }
  }, [activeScene?.id]);

  const loadTokens = async (sceneId: string) => {
    try {
      const sceneTokens = await api.getTokens(campaign.id, sceneId);
      setTokens(sceneTokens);
    } catch (e) {
      console.error('Erro ao carregar tokens da cena:', e);
    }
  };

  const loadConditions = useCallback(async (sceneId?: string | null) => {
    try {
      const conds = await api.getEnvironmentalConditions(campaign.id, sceneId);
      if (!isMasterRef.current) {
        setEnvironmentalConditions(conds.filter(c => Number(c.is_active) === 1 && Number(c.is_visible_to_players) === 1));
      } else {
        setEnvironmentalConditions(conds);
      }
    } catch (e) {
      console.error('Erro ao carregar condições ambientais:', e);
    }
  }, [campaign.id]);

  useEffect(() => {
    loadConditions(activeScene?.id || null);
  }, [campaign.id, activeScene?.id, loadConditions]);

  // ==========================================
  // SINCRONIZAÇÃO EM TEMPO REAL VIA WEBSOCKET
  // ==========================================
  const activeSceneRef = useRef<Scene | null>(activeScene);
  useEffect(() => {
    activeSceneRef.current = activeScene;
  }, [activeScene]);

  const isMasterRef = useRef<boolean>(isMaster);
  useEffect(() => {
    isMasterRef.current = isMaster;
  }, [isMaster]);

  const handleVttMessage = useCallback((msg: any) => {
    if (!msg || !msg.type) return;
    const { type } = msg;

    if (type === 'vtt:resync') {
      loadVttData();
      if (activeSceneRef.current?.id) {
        loadTokens(activeSceneRef.current.id);
      }
      loadConditions(activeSceneRef.current?.id || null);
      return;
    }

    // 1. Movimentação e atualização de tokens
    if (type === 'token:moved') {
      setTokens(prev => prev.map(t => 
        t.id === msg.tokenId 
          ? { ...t, x: msg.x, y: msg.y } 
          : t
      ));
      setSelectedToken(prev => {
        if (!prev || prev.id !== msg.tokenId) return prev;
        return { ...prev, x: msg.x, y: msg.y };
      });
    } else if (type === 'token:created') {
      if (msg.token && (!activeSceneRef.current || msg.token.scene_id === activeSceneRef.current.id)) {
        setTokens(prev => {
          if (prev.some(t => t.id === msg.token.id)) return prev;
          return [...prev, msg.token];
        });
      }
    } else if (type === 'token:updated') {
      if (msg.token) {
        setTokens(prev => {
          const exists = prev.some(t => t.id === msg.token.id);
          if (!exists) {
            if (!activeSceneRef.current || msg.token.scene_id === activeSceneRef.current.id) {
              return [...prev, msg.token];
            }
            return prev;
          }
          return prev.map(t => t.id === msg.token.id ? msg.token : t);
        });
        setSelectedToken(prev => prev?.id === msg.token.id ? msg.token : prev);
      }
    } else if (type === 'token:deleted') {
      setTokens(prev => prev.filter(t => t.id !== msg.tokenId));
      setSelectedToken(prev => prev?.id === msg.tokenId ? null : prev);
    }

    // 2. Criação, atualização e ativação de cenas
    else if (type === 'scene:created') {
      if (msg.scene) {
        setScenes(prev => {
          if (prev.some(s => s.id === msg.scene.id)) return prev;
          return [...prev, msg.scene];
        });
      }
    } else if (type === 'scene:updated') {
      if (msg.scene) {
        setScenes(prev => prev.map(s => s.id === msg.scene.id ? msg.scene : s));
        if (activeSceneRef.current?.id === msg.scene.id) {
          setActiveScene(msg.scene);
        }
      }
    } else if (type === 'scene:active_changed') {
      if (msg.scene) {
        setScenes(prev => prev.map(s => ({ ...s, is_active: s.id === msg.scene.id })));
        if (!isMasterRef.current) {
          setActiveScene(msg.scene);
        }
      }
    } else if (type === 'scene:deleted') {
      setScenes(prev => prev.filter(s => s.id !== msg.sceneId));
      if (activeSceneRef.current?.id === msg.sceneId) {
        setActiveScene(msg.activeScene || null);
      }
    }

    // 3. Atualização de Fog of War
    else if (type === 'fog:updated') {
      if (activeSceneRef.current && activeSceneRef.current.id === msg.sceneId) {
        setActiveScene(prev => prev ? {
          ...prev,
          fog_data: msg.fogData,
          fog_enabled: msg.fogEnabled
        } : prev);
      }
      setScenes(prev => prev.map(s => s.id === msg.sceneId ? {
        ...s,
        fog_data: msg.fogData,
        fog_enabled: msg.fogEnabled
      } : s));
    }

    if (type === 'inventory:updated') {
      setDockInventoryTrigger(prev => prev + 1);
    }

    // 4. Combate
    else if (type.startsWith('combat:')) {
      setDockInventoryTrigger(prev => prev + 1);
      if (type === 'combat:ended') {
        setCombatEncounter(null);
        setShowCombatDock(false);
      } else if (msg.encounter) {
        setCombatEncounter(msg.encounter);
        if (msg.encounter.status === 'active') {
          setShowCombatDock(true);
        }
      }
    }

    // 5. Condições Ambientais da Cena / Campanha
    else if (
      type === 'scene:condition_updated' ||
      type === 'environment:change' ||
      type === 'environmental:updated' ||
      type === 'environmental:created'
    ) {
      if (msg.removed && (msg.conditionId || msg.condition?.id)) {
        const targetId = msg.conditionId || msg.condition?.id;
        setEnvironmentalConditions(prev => prev.filter(c => c.id !== targetId));
      } else if (msg.condition) {
        const cond: EnvironmentalCondition = msg.condition;
        const currentSceneId = activeSceneRef.current?.id;
        const belongsToScene = !cond.scene_id || (currentSceneId && cond.scene_id === currentSceneId);

        if (!belongsToScene) {
          setEnvironmentalConditions(prev => prev.filter(c => c.id !== cond.id));
          return;
        }

        if (!isMasterRef.current && (Number(cond.is_active) !== 1 || Number(cond.is_visible_to_players) !== 1)) {
          setEnvironmentalConditions(prev => prev.filter(c => c.id !== cond.id));
        } else {
          setEnvironmentalConditions(prev => {
            const exists = prev.some(c => c.id === cond.id);
            if (exists) {
              return prev.map(c => c.id === cond.id ? cond : c);
            }
            return [...prev, cond];
          });
        }
      }
    } else if (type === 'environmental:deleted') {
      const targetId = msg.conditionId;
      setEnvironmentalConditions(prev => prev.filter(c => c.id !== targetId));
    }
  }, [loadConditions]);

  const renderConditionIcon = (iconName?: string | null) => {
    const norm = (iconName || '').toLowerCase();
    if (norm.includes('rain') || norm.includes('chuva')) return <CloudRain className="w-3.5 h-3.5 text-[#4a7a8a]" />;
    if (norm.includes('skull') || norm.includes('gas') || norm.includes('veneno')) return <Skull className="w-3.5 h-3.5 text-emerald-400" />;
    if (norm.includes('zap') || norm.includes('raio') || norm.includes('tempestade')) return <Zap className="w-3.5 h-3.5 text-amber-400" />;
    if (norm.includes('fog') || norm.includes('nevoa') || norm.includes('wind') || norm.includes('vento')) return <Wind className="w-3.5 h-3.5 text-slate-300" />;
    if (norm.includes('fire') || norm.includes('fogo') || norm.includes('flame') || norm.includes('calor')) return <Flame className="w-3.5 h-3.5 text-orange-400" />;
    if (norm.includes('sun') || norm.includes('sol') || norm.includes('luz')) return <Sun className="w-3.5 h-3.5 text-yellow-400" />;
    if (norm.includes('moon') || norm.includes('lua') || norm.includes('escuridao') || norm.includes('noite')) return <Moon className="w-3.5 h-3.5 text-[#ece3d0]" />;
    return <Sparkles className="w-3.5 h-3.5 text-[#c9a04e]" />;
  };

  useEffect(() => {
    if (subscribeVtt) {
      const unsubscribe = subscribeVtt(handleVttMessage);
      return unsubscribe;
    }
  }, [subscribeVtt, handleVttMessage]);

  useEffect(() => {
    if (!subscribeVtt && lastVttEvent) {
      handleVttMessage(lastVttEvent);
    }
  }, [lastVttEvent, subscribeVtt, handleVttMessage]);

  // ==========================================
  // CONTROLE DE NAVEGAÇÃO, ZOOM E ENQUADRAMENTO
  // ==========================================
  const activeConditionsToDisplay = environmentalConditions.filter(c => {
    if (isMaster) return true;
    return Number(c.is_active) === 1 && Number(c.is_visible_to_players) === 1;
  });

  const handleZoom = (delta: number) => {
    setZoom(prev => Math.max(0.15, Math.min(3, Math.round((prev + delta) * 10) / 10)));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const fitToScreen = useCallback(() => {
    if (!viewportRef.current || !activeScene) return;
    const viewW = viewportRef.current.clientWidth || 800;
    const viewH = viewportRef.current.clientHeight || 700;
    const margin = 40;
    const mapW = activeScene.width || 2000;
    const mapH = activeScene.height || 2000;

    const scaleX = (viewW - margin) / mapW;
    const scaleY = (viewH - margin) / mapH;
    const fitZoom = Math.max(0.15, Math.min(2.5, Math.min(scaleX, scaleY)));
    const scaledW = mapW * fitZoom;
    const scaledH = mapH * fitZoom;
    const centerX = Math.round((viewW - scaledW) / 2);
    const centerY = Math.round((viewH - scaledH) / 2);

    setZoom(Math.round(fitZoom * 100) / 100);
    setPan({ x: centerX, y: centerY });
  }, [activeScene]);

  // Detector de dimensões naturais de imagem
  const detectImageDimensions = (url: string) => {
    if (!url) return;
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setSceneForm(prev => ({
          ...prev,
          width: img.naturalWidth,
          height: img.naturalHeight
        }));
      }
    };
    img.src = url;
  };

  // Eventos de Mouse do Viewport
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && fogMode === 'view') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    } else if (e.button === 0 && fogMode !== 'view' && isMaster && activeScene) {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = (e.clientX - rect.left - pan.x) / zoom;
      const mouseY = (e.clientY - rect.top - pan.y) / zoom;
      setFogDragStart({ x: mouseX, y: mouseY });
      setCurrentFogRect({ x: mouseX, y: mouseY, width: 0, height: 0 });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && !draggingTokenId) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    } else if (fogDragStart && currentFogRect && activeScene) {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const currentX = (e.clientX - rect.left - pan.x) / zoom;
      const currentY = (e.clientY - rect.top - pan.y) / zoom;

      const rawX = Math.min(fogDragStart.x, currentX);
      const rawY = Math.min(fogDragStart.y, currentY);
      const rawW = Math.abs(currentX - fogDragStart.x);
      const rawH = Math.abs(currentY - fogDragStart.y);

      // Limita ao tamanho real do mapa
      const mapW = activeScene.width || 2000;
      const mapH = activeScene.height || 2000;
      const clampedX = Math.max(0, Math.min(mapW, rawX));
      const clampedY = Math.max(0, Math.min(mapH, rawY));
      const clampedW = Math.max(0, Math.min(mapW - clampedX, rawW));
      const clampedH = Math.max(0, Math.min(mapH - clampedY, rawH));

      setCurrentFogRect({ x: clampedX, y: clampedY, width: clampedW, height: clampedH });
    } else if (draggingTokenId && activeScene) {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = (e.clientX - rect.left - pan.x) / zoom;
      const mouseY = (e.clientY - rect.top - pan.y) / zoom;

      setTokens(prev => prev.map(t => {
        if (t.id === draggingTokenId) {
          return {
            ...t,
            x: Math.max(0, mouseX - dragOffset.x),
            y: Math.max(0, mouseY - dragOffset.y)
          };
        }
        return t;
      }));
    }
  };

  const handleMouseUp = async () => {
    if (isPanning) {
      setIsPanning(false);
    }

    // Finalizar desenho de Fog of War (Mestre)
    if (fogDragStart && currentFogRect && activeScene && isMaster) {
      if (currentFogRect.width > 5 && currentFogRect.height > 5) {
        const isHide = fogMode === 'hide';
        const newRect = {
          type: isHide ? 'hide' : 'reveal',
          hidden: isHide,
          x: Math.round(currentFogRect.x),
          y: Math.round(currentFogRect.y),
          width: Math.round(currentFogRect.width),
          height: Math.round(currentFogRect.height)
        };
        const updatedFog = [...(activeScene.fog_data || []), newRect];
        try {
          const res = await api.updateSceneFog(campaign.id, activeScene.id, updatedFog, true);
          setActiveScene(res);
        } catch (e) {
          console.error('Erro ao atualizar fog of war:', e);
        }
      }
      setFogDragStart(null);
      setCurrentFogRect(null);
    }

    // Finalizar arrasto de token
    if (draggingTokenId && activeScene) {
      const token = tokens.find(t => t.id === draggingTokenId);
      if (token) {
        const gridSize = activeScene.grid_size || 50;
        const snappedX = Math.round(token.x / gridSize) * gridSize;
        const snappedY = Math.round(token.y / gridSize) * gridSize;

        setTokens(prev => prev.map(t => t.id === token.id ? { ...t, x: snappedX, y: snappedY } : t));

        try {
          await api.updateToken(campaign.id, token.id, { x: snappedX, y: snappedY });
          if (wsRef?.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'token:move',
              tokenId: token.id,
              x: snappedX,
              y: snappedY
            }));
          }
        } catch (err: any) {
          notify.error('Movimentação Bloqueada', err.message);
          loadTokens(activeScene.id);
        }
      }
      setDraggingTokenId(null);
    }
  };

  // Iniciar arrasto de um token específico
  const handleTokenMouseDown = (e: React.MouseEvent, token: Token) => {
    e.stopPropagation();

    const isOwner = token.owner_user_id === user.id;
    if (!isMaster && !isOwner) {
      notify.warning('Acesso Negado', 'Você não tem permissão para mover o token de outro participante.');
      return;
    }
    if (token.is_locked && !isMaster) {
      notify.warning('Token Bloqueado', 'Este token está bloqueado pelo mestre.');
      return;
    }

    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;

    setDraggingTokenId(token.id);
    setDragOffset({
      x: mouseX - token.x,
      y: mouseY - token.y
    });
    setSelectedToken(token);
  };

  // ==========================================
  // AÇÕES DE FOG OF WAR (MESTRE)
  // ==========================================
  const handleFogHideAll = async () => {
    if (!activeScene || !isMaster) return;
    const mapW = activeScene.width || 2000;
    const mapH = activeScene.height || 2000;
    const hideAllRect = {
      type: 'hide',
      hidden: true,
      x: 0,
      y: 0,
      width: mapW,
      height: mapH
    };
    try {
      const res = await api.updateSceneFog(campaign.id, activeScene.id, [hideAllRect], true);
      setActiveScene(res);
    } catch (e) {
      console.error('Erro ao ocultar todo o mapa:', e);
    }
  };

  const handleFogRevealAll = async () => {
    if (!activeScene || !isMaster) return;
    const mapW = activeScene.width || 2000;
    const mapH = activeScene.height || 2000;
    const revealAllRect = {
      type: 'reveal',
      hidden: false,
      x: 0,
      y: 0,
      width: mapW,
      height: mapH
    };
    try {
      const res = await api.updateSceneFog(campaign.id, activeScene.id, [revealAllRect], true);
      setActiveScene(res);
    } catch (e) {
      console.error('Erro ao revelar todo o mapa:', e);
    }
  };

  const handleFogUndo = async () => {
    if (!activeScene || !isMaster || !activeScene.fog_data?.length) return;
    const updatedFog = activeScene.fog_data.slice(0, -1);
    try {
      const res = await api.updateSceneFog(campaign.id, activeScene.id, updatedFog, activeScene.fog_enabled);
      setActiveScene(res);
    } catch (e) {
      console.error('Erro ao desfazer fog:', e);
    }
  };

  // ==========================================
  // GESTÃO DE CENAS (MESTRE)
  // ==========================================
  const handleOpenCreateScene = () => {
    setIsEditingScene(false);
    setSceneForm({
      name: 'Nova Cena',
      image_url: '',
      grid_size: 50,
      grid_scale: 1.5,
      grid_scale_unit: 'm',
      grid_color: '#ffffff',
      grid_opacity: 0.25,
      width: 2000,
      height: 2000,
      fog_enabled: false
    });
    setShowSceneModal(true);
  };

  const handleOpenEditScene = (scene: Scene) => {
    setIsEditingScene(true);
    setSceneForm({
      name: scene.name,
      image_url: scene.image_url || '',
      grid_size: scene.grid_size,
      grid_scale: scene.grid_scale,
      grid_scale_unit: scene.grid_scale_unit,
      grid_color: scene.grid_color,
      grid_opacity: scene.grid_opacity,
      width: scene.width,
      height: scene.height,
      fog_enabled: scene.fog_enabled
    });
    setShowSceneModal(true);
  };

  const handleSaveScene = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditingScene && activeScene) {
        const updated = await api.updateScene(campaign.id, activeScene.id, sceneForm);
        setActiveScene(updated);
        setScenes(prev => prev.map(s => s.id === updated.id ? updated : s));
      } else {
        const created = await api.createScene(campaign.id, sceneForm);
        setScenes(prev => [...prev, created]);
        setActiveScene(created);
      }
      setShowSceneModal(false);
    } catch (err: any) {
      notify.error('Erro ao Salvar Cena', err.message);
    }
  };

  const handleActivateScene = async (sceneId: string) => {
    try {
      const activated = await api.setActiveScene(campaign.id, sceneId);
      setActiveScene(activated);
      setScenes(prev => prev.map(s => ({ ...s, is_active: s.id === sceneId })));
    } catch (err: any) {
      notify.error('Erro ao Ativar Cena', err.message);
    }
  };

  const handleDeleteScene = async (sceneId: string) => {
    notify.confirm('Deseja excluir permanentemente esta cena e todos os seus tokens?', async () => {
      try {
        await api.deleteScene(campaign.id, sceneId);
        const res = await api.getScenes(campaign.id);
        setScenes(res.scenes);
        setActiveScene(res.activeScene);
        notify.success('Cena Excluída');
      } catch (err: any) {
        notify.error('Erro ao excluir cena', err.message);
      }
    });
  };

  // ==========================================
  // GESTÃO DE TOKENS & AJUSTE DE TAMANHO
  // ==========================================
  const handleAddToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeScene) return;

    try {
      const npc_data = {
        defense: tokenNpcDefense,
        damage_reduction: tokenNpcDR,
        resistances: tokenNpcResistances.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
        vulnerabilities: tokenNpcVulnerabilities.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
        immunities: tokenNpcImmunities.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
        initiative_formula: tokenNpcInitiativeFormula,
        current_hp: tokenNpcHp,
        max_hp: tokenNpcMaxHp
      };

      const payload: Partial<Token> = {
        character_id: tokenFormCharId || null,
        name: tokenFormName || undefined,
        avatar_url: tokenFormAvatar || null,
        size: tokenFormSize,
        color: tokenFormColor,
        x: 100,
        y: 100,
        current_hp: tokenNpcHp,
        max_hp: tokenNpcMaxHp,
        npc_data
      };

      const token = await api.createToken(campaign.id, activeScene.id, payload);
      setTokens(prev => {
        if (prev.some(t => t.id === token.id)) return prev;
        return [...prev, token];
      });
      setShowAddTokenModal(false);
      setTokenFormCharId('');
      setTokenFormName('');
      setTokenFormAvatar('');
      setTokenNpcDefense(10);
      setTokenNpcDR(0);
      setTokenNpcResistances('');
      setTokenNpcVulnerabilities('');
      setTokenNpcImmunities('');
      setTokenNpcInitiativeFormula('1d20');
      setTokenNpcHp(20);
      setTokenNpcMaxHp(20);
    } catch (err: any) {
      notify.error('Erro ao Adicionar Token', err.message);
    }
  };

  const openEditTokenModal = (token: Token) => {
    const npc = token.npc_data || {};
    setEditTokenForm({
      id: token.id,
      name: token.name,
      size: token.size,
      color: token.color || '#c9a04e',
      current_hp: token.current_hp ?? npc.current_hp ?? 20,
      max_hp: token.max_hp ?? npc.max_hp ?? 20,
      defense: npc.defense ?? 10,
      damage_reduction: npc.damage_reduction ?? 0,
      resistances: Array.isArray(npc.resistances) ? npc.resistances.join(', ') : '',
      vulnerabilities: Array.isArray(npc.vulnerabilities) ? npc.vulnerabilities.join(', ') : '',
      immunities: Array.isArray(npc.immunities) ? npc.immunities.join(', ') : '',
      initiative_formula: npc.initiative_formula || '1d20'
    });
    setShowEditTokenModal(true);
  };

  const handleSaveEditToken = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const npc_data = {
        defense: editTokenForm.defense,
        damage_reduction: editTokenForm.damage_reduction,
        resistances: editTokenForm.resistances.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
        vulnerabilities: editTokenForm.vulnerabilities.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
        immunities: editTokenForm.immunities.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
        initiative_formula: editTokenForm.initiative_formula,
        current_hp: editTokenForm.current_hp,
        max_hp: editTokenForm.max_hp
      };

      const updated = await api.updateToken(campaign.id, editTokenForm.id, {
        name: editTokenForm.name,
        size: editTokenForm.size,
        color: editTokenForm.color,
        current_hp: editTokenForm.current_hp,
        max_hp: editTokenForm.max_hp,
        npc_data
      });

      setTokens(prev => prev.map(t => t.id === updated.id ? updated : t));
      if (selectedToken?.id === updated.id) {
        setSelectedToken(updated);
      }
      setShowEditTokenModal(false);
    } catch (err: any) {
      notify.error('Erro ao Atualizar Token', err.message);
    }
  };

  const handleDeleteToken = async (tokenId: string) => {
    notify.confirm('Remover token do mapa?', async () => {
      try {
        await api.deleteToken(campaign.id, tokenId);
        setTokens(prev => prev.filter(t => t.id !== tokenId));
        if (selectedToken?.id === tokenId) setSelectedToken(null);
        notify.success('Token Removido');
      } catch (err: any) {
        notify.error('Erro ao remover token', err.message);
      }
    });
  };

  const handleToggleTokenVisibility = async (token: Token) => {
    try {
      const updated = await api.updateToken(campaign.id, token.id, { is_visible: !token.is_visible });
      setTokens(prev => prev.map(t => t.id === token.id ? updated : t));
      setSelectedToken(updated);
      if (combatEncounter) {
        try {
          const enc = await api.getActiveCombat(campaign.id);
          setCombatEncounter(enc);
        } catch {}
      }
    } catch (err: any) {
      notify.error('Erro ao Alterar Visibilidade', err.message);
    }
  };

  const handleToggleTokenLock = async (token: Token) => {
    try {
      const updated = await api.updateToken(campaign.id, token.id, { is_locked: !token.is_locked });
      setTokens(prev => prev.map(t => t.id === token.id ? updated : t));
      setSelectedToken(updated);
    } catch (err: any) {
      notify.error('Erro ao Alterar Travamento', err.message);
    }
  };

  const handleResizeToken = async (token: Token, delta: number) => {
    const newSize = Math.max(0.5, Math.min(4, Math.round((token.size + delta) * 10) / 10));
    if (newSize === token.size) return;
    try {
      const updated = await api.updateToken(campaign.id, token.id, { size: newSize });
      setTokens(prev => prev.map(t => t.id === token.id ? updated : t));
      setSelectedToken(updated);
    } catch (err: any) {
      notify.error('Erro ao Alterar Tamanho', err.message);
    }
  };

  const gridSize = activeScene?.grid_size || 50;
  const mapWidth = activeScene?.width || 2000;
  const mapHeight = activeScene?.height || 2000;

  return (
    <div className="relative w-full h-[100dvh] min-h-0 bg-[#131211] overflow-hidden select-none">
      {/* 
        NOVA ARQUITETURA EDITORIAL DO VTT: MAPA EM 100% DA JANELA
        Ilhas flutuantes retráteis (backdrop-blur-md) sem barras fixas ocupando espaço.
      */}

      {/* ÁREA CENTRAL: MAPA / VIEWPORT INTERATIVO (100% DA TELA) */}
      <div 
        ref={viewportRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={(e) => {
          e.preventDefault();
          const delta = e.deltaY > 0 ? -0.1 : 0.1;
          handleZoom(delta);
        }}
        className={`absolute inset-0 w-full h-full overflow-hidden bg-[#131211] ${
          fogMode !== 'view' ? 'cursor-crosshair' : isPanning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {/* ======================================================== */}
        {/* ILHA 1 FLUTUANTE: CENAS & VISUALIZAÇÃO (TOP-LEFT)        */}
        {/* ======================================================== */}
        <div className="absolute top-3 left-3 z-40 pointer-events-auto flex items-center space-x-1.5 bg-[#1a1816]/90 backdrop-blur-md border border-[#3a3530] rounded-xl p-1.5 shadow-xl text-xs">
          {isSceneIslandCollapsed ? (
            <button
              onClick={() => setIsSceneIslandCollapsed(false)}
              title="Expandir visualização do mapa"
              className="p-1.5 text-[#c9a04e] hover:text-[#ece3d0] transition-colors flex items-center space-x-1.5"
            >
              <MapIcon className="w-4 h-4 text-[#c9a04e]" />
              <span className="font-serif font-bold text-xs truncate max-w-[120px]">{activeScene?.name || 'Cena'}</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => setIsSceneIslandCollapsed(true)}
                title="Minimizar barra"
                className="p-1 text-[#8a8578] hover:text-[#ece3d0] rounded"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center space-x-1.5 pr-2 border-r border-[#3a3530]">
                <span className="font-serif font-bold text-xs text-[#ece3d0] max-w-[120px] truncate">
                  {activeScene?.name || 'Mesa Principal'}
                </span>
                {isMaster && (
                  <>
                    {scenes.length > 1 && (
                      <select
                        value={activeScene?.id || ''}
                        onChange={(e) => {
                          const match = scenes.find(s => s.id === e.target.value);
                          if (match) {
                            setActiveScene(match);
                            localStorage.setItem(`arcanum_active_scene_${campaign.id}`, match.id);
                          }
                        }}
                        className="bg-[#131211] border border-[#3a3530] rounded px-1.5 py-0.5 text-[11px] font-mono text-[#ece3d0]"
                      >
                        {scenes.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={handleOpenCreateScene}
                      title="Nova Cena"
                      className="p-1 text-[#c9a04e] hover:bg-[#2c2825] rounded"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    {activeScene && (
                      <>
                        <button
                          onClick={() => handleOpenEditScene(activeScene)}
                          title="Configurar Cena"
                          className="p-1 text-[#8a8578] hover:text-[#ece3d0] rounded"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        {!activeScene.is_active && (
                          <button
                            onClick={() => handleActivateScene(activeScene.id)}
                            title="Ativar para Jogadores"
                            className="px-1.5 py-0.5 text-[10px] font-mono text-[#5a7a5a] hover:bg-[#2c2825] rounded"
                          >
                            Ativar
                          </button>
                        )}
                        {scenes.length > 1 && (
                          <button
                            onClick={() => handleDeleteScene(activeScene.id)}
                            title="Excluir Cena"
                            className="p-1 text-[#b24a52] hover:bg-[#2c2825] rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Controles de Zoom & Grade */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setShowGrid(!showGrid)}
                  title="Alternar Grade"
                  className={`p-1 rounded ${showGrid ? 'text-[#c9a04e]' : 'text-[#8a8578]'}`}
                >
                  <Grid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleZoom(-0.1)}
                  title="Diminuir Zoom"
                  className="p-1 text-[#8a8578] hover:text-[#ece3d0]"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-mono text-[#8a8578] w-7 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => handleZoom(0.1)}
                  title="Aumentar Zoom"
                  className="p-1 text-[#8a8578] hover:text-[#ece3d0]"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={resetView}
                  title="Redefinir Visão (100%)"
                  className="p-1 text-[#8a8578] hover:text-[#ece3d0]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={fitToScreen}
                  title="Enquadrar Mapa"
                  className="p-1 text-[#8a8578] hover:text-[#c9a04e]"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* ======================================================== */}
        {/* ILHA 2 FLUTUANTE: FERRAMENTAS & COMBATE (TOP-RIGHT)      */}
        {/* ======================================================== */}
        <div className="absolute top-3 right-3 z-40 pointer-events-auto flex items-center space-x-1.5 bg-[#1a1816]/90 backdrop-blur-md border border-[#3a3530] rounded-xl p-1.5 shadow-xl text-xs">
          {isToolsIslandCollapsed ? (
            <button
              onClick={() => setIsToolsIslandCollapsed(false)}
              title="Expandir Ferramentas"
              className="p-1.5 text-[#c9a04e] hover:text-[#ece3d0] transition-colors"
            >
              <Swords className="w-4 h-4 text-[#c9a04e]" />
            </button>
          ) : (
            <>
              {isMaster && activeScene && (
                <div className="flex items-center space-x-1 pr-2 border-r border-[#3a3530]">
                  <button
                    onClick={() => setFogMode('view')}
                    className={`px-2 py-0.5 rounded text-[11px] ${fogMode === 'view' ? 'bg-[#2c2825] text-white font-bold' : 'text-[#8a8578]'}`}
                  >
                    Mover
                  </button>
                  <button
                    onClick={() => setFogMode('hide')}
                    className={`px-2 py-0.5 rounded text-[11px] ${fogMode === 'hide' ? 'bg-[#b24a52] text-white font-bold' : 'text-[#8a8578]'}`}
                  >
                    Ocultar
                  </button>
                  <button
                    onClick={() => setFogMode('reveal')}
                    className={`px-2 py-0.5 rounded text-[11px] ${fogMode === 'reveal' ? 'bg-emerald-600 text-white font-bold' : 'text-[#8a8578]'}`}
                  >
                    Revelar
                  </button>
                  <button
                    onClick={handleFogHideAll}
                    title="Ocultar todo o mapa"
                    className="px-1 text-[10px] text-[#8a8578] hover:text-[#b24a52]"
                  >
                    Ocultar Tudo
                  </button>
                  <button
                    onClick={handleFogRevealAll}
                    title="Revelar todo o mapa"
                    className="px-1 text-[10px] text-[#8a8578] hover:text-[#5a7a5a]"
                  >
                    Revelar Tudo
                  </button>
                  {activeScene.fog_data && activeScene.fog_data.length > 0 && (
                    <button onClick={handleFogUndo} title="Desfazer" className="p-1 text-[#8a8578] hover:text-[#c9a04e]">
                      <Undo className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {activeScene && (
                <button
                  onClick={() => {
                    if (selectedCharacter) {
                      setTokenFormCharId(selectedCharacter.id);
                      setTokenFormName(selectedCharacter.name);
                      setTokenFormAvatar(selectedCharacter.avatar_url || '');
                    }
                    setShowAddTokenModal(true);
                  }}
                  className="px-2.5 py-1 bg-[#c9a04e] hover:bg-[#d67b5f] text-[#131211] font-bold rounded-lg text-xs flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Token</span>
                </button>
              )}

              <button
                onClick={() => setShowCombatDock(!showCombatDock)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 border ${
                  showCombatDock
                    ? 'bg-[#c9a04e] text-[#131211] font-bold border-transparent'
                    : 'bg-[#131211] text-[#ece3d0] border-[#3a3530] hover:border-[#c9a04e]'
                }`}
              >
                <Swords className="w-3.5 h-3.5 text-[#c9a04e]" />
                <span>Combate</span>
                {combatEncounter && combatEncounter.status === 'active' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                )}
              </button>

              <button
                onClick={() => setIsToolsIslandCollapsed(true)}
                title="Minimizar ferramentas"
                className="p-1 text-[#8a8578] hover:text-[#ece3d0] rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        {/* ======================================================== */}
        {/* ILHA 3 FLUTUANTE: FITA DE INICIATIVA (TOP-CENTER)        */}
        {/* ======================================================== */}
        {combatEncounter && combatEncounter.status === 'active' && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 pointer-events-auto flex items-center space-x-2 bg-[#1a1816]/95 backdrop-blur-md border border-[#3a3530] rounded-full px-4 py-1.5 shadow-2xl max-w-[90vw] overflow-x-auto">
            <span className="font-serif font-bold text-xs text-[#c9a04e] shrink-0 pr-2 border-r border-[#3a3530]">
              Rodada {combatEncounter.round}
            </span>

            <div className="flex items-center space-x-1.5 overflow-x-auto py-0.5">
              {combatEncounter.combatants?.map((c, idx) => {
                const isActive = idx === combatEncounter.turn_index;
                const hpPercent = c.hp_percent ?? (c.max_hp ? Math.round(((c.current_hp || 0) / c.max_hp) * 100) : 100);
                return (
                  <div
                    key={c.id}
                    onClick={() => setShowCombatDock(true)}
                    className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-full border text-xs cursor-pointer whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-[#2c2825] border-[#c9a04e] text-[#ece3d0] font-bold'
                        : 'bg-[#131211] border-[#3a3530] text-[#8a8578] hover:text-[#ece3d0]'
                    }`}
                  >
                    <span className="font-mono text-[10px] text-[#c9a04e]">{c.initiative}</span>
                    <span className="truncate max-w-[90px]">{c.name}</span>
                    <div className="w-5 h-1 bg-[#131211] rounded-full overflow-hidden border border-[#3a3530]">
                      <div className="h-full bg-[#b24a52]" style={{ width: `${Math.max(0, Math.min(100, hpPercent))}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {(() => {
              const activeCombatant = combatEncounter.combatants?.[combatEncounter.turn_index];
              const canEndTurn = isMaster || (activeCombatant && activeCombatant.owner_user_id === user.id);
              if (canEndTurn) {
                return (
                  <button
                    onClick={async () => {
                      try {
                        const updated = await api.nextCombatTurn(campaign.id, combatEncounter.id);
                        setCombatEncounter(updated);
                      } catch (e) {
                        console.error('Erro ao passar turno:', e);
                      }
                    }}
                    className="px-2.5 py-0.5 bg-[#c9a04e] hover:bg-[#d67b5f] text-[#131211] rounded-full text-[11px] font-bold shrink-0 ml-1 transition-all active:scale-95"
                  >
                    Passar Turno →
                  </button>
                );
              }
              return null;
            })()}
          </div>
        )}

        {/* SOBREPOSIÇÃO DE CONDIÇÕES AMBIENTAIS ATIVAS (ActiveConditionsOverlay) */}
        {activeConditionsToDisplay.length > 0 && (
          <div className="absolute top-16 left-3 z-30 flex flex-wrap items-center gap-2 max-w-[calc(100%-120px)] pointer-events-auto select-none">
            {activeConditionsToDisplay.map((cond) => {
              const isActive = Number(cond.is_active) === 1;
              const isVisible = Number(cond.is_visible_to_players) === 1;

              return (
                <div
                  key={cond.id}
                  className={`group relative flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border backdrop-blur-md shadow-lg transition-all duration-200 cursor-help ${
                    isActive
                      ? 'bg-[#131211]/85 border-[#c9a04e]/60 hover:border-[#c9a04e]'
                      : 'bg-[#131211]/60 border-[#2c2825] opacity-60'
                  }`}
                >
                  {renderConditionIcon(cond.icon)}
                  <span className={`text-xs font-serif font-semibold ${isActive ? 'text-[#ece3d0]' : 'text-[#8a8578]'}`}>
                    {cond.name}
                  </span>

                  {isMaster && (
                    <span className="text-[10px] text-[#8a8578]" title={isVisible ? 'Visível para os jogadores' : 'Oculto para os jogadores'}>
                      {isVisible ? <Eye className="w-3 h-3 text-[#c9a04e]" /> : <EyeOff className="w-3 h-3 text-[#b24a52]" />}
                    </span>
                  )}

                  {cond.duration_rounds !== null && cond.duration_rounds !== undefined && (
                    <span className="text-[10px] font-mono px-1 py-0.2 bg-[#2c2825] text-[#c9a04e] rounded border border-[#3a3530]/50">
                      {cond.duration_rounds}r
                    </span>
                  )}

                  {/* Tooltip Descritivo Flutuante */}
                  <div className="absolute top-full left-0 mt-2 hidden group-hover:flex flex-col w-64 p-3 bg-[#1a1816]/95 backdrop-blur-md border border-[#c9a04e]/40 rounded-lg shadow-sm text-left z-50 pointer-events-none transition-all">
                    <div className="flex items-center justify-between border-b border-[#2c2825] pb-1.5 mb-1.5">
                      <span className="font-serif font-bold text-xs text-[#c9a04e]">{cond.name}</span>
                      <div className="flex items-center space-x-1">
                        {!isActive && (
                          <span className="text-[9px] font-mono px-1 py-0.2 bg-[#b24a52]/30 text-[#b24a52] rounded">
                            Inativa
                          </span>
                        )}
                        {cond.duration_rounds && (
                          <span className="text-[10px] font-mono text-[#8a8578]">
                            {cond.duration_rounds} rodadas
                          </span>
                        )}
                      </div>
                    </div>

                    {cond.description ? (
                      <p className="text-xs text-[#ece3d0] leading-relaxed mb-1">{cond.description}</p>
                    ) : (
                      <p className="text-xs text-[#8a8578] italic mb-1">Sem descrição detalhada.</p>
                    )}

                    {cond.effect_payload?.formula && (
                      <div className="text-[10px] font-mono text-emerald-400 mt-1 pt-1 border-t border-[#2c2825] flex items-center justify-between">
                        <span>Fórmula: {cond.effect_payload.formula}</span>
                        <span>{cond.effect_payload.damage_type || 'efeito'}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {activeScene ? (
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              width: `${mapWidth}px`,
              height: `${mapHeight}px`
            }}
            className="absolute top-0 left-0 transition-transform duration-75"
          >
            {/* Imagem de Fundo do Mapa (Respeita Proporção Natural) */}
            {activeScene.image_url && !imageError ? (
              <img
                src={activeScene.image_url}
                alt={activeScene.name}
                style={{
                  width: `${mapWidth}px`,
                  height: `${mapHeight}px`
                }}
                className="w-full h-full object-fill pointer-events-none"
                onLoad={(e) => {
                  const img = e.currentTarget;
                  // Se a cena ainda estiver com dimensões 2000x2000 default, sincroniza automaticamente
                  if (isMaster && img.naturalWidth && img.naturalHeight) {
                    if (activeScene.width === 2000 && activeScene.height === 2000 && 
                       (img.naturalWidth !== 2000 || img.naturalHeight !== 2000)) {
                      api.updateScene(campaign.id, activeScene.id, {
                        width: img.naturalWidth,
                        height: img.naturalHeight
                      }).then(updated => {
                        setActiveScene(updated);
                        fitToScreen();
                      }).catch(console.error);
                    }
                  }
                }}
                onError={() => setImageError(true)}
              />
            ) : imageError ? (
              <div className="w-full h-full bg-[#131211] border-2 border-dashed border-[#3a3530] flex flex-col items-center justify-center p-6 text-center pointer-events-none">
                <Layers className="w-12 h-12 text-[#b24a52]/60 mb-2" />
                <p className="text-[#ece3d0] font-bold text-sm">Não foi possível carregar a imagem de fundo.</p>
                <p className="text-[#8a8578] text-xs mt-1">Verifique a URL ou substitua a imagem nas configurações da cena.</p>
              </div>
            ) : (
              <div className="w-full h-full bg-[#131211] border-2 border-[#2c2825] flex items-center justify-center pointer-events-none">
                <span className="text-[#3a3530] text-sm font-bold tracking-wider uppercase">
                  Área do Mapa ({mapWidth}x{mapHeight}px)
                </span>
              </div>
            )}

            {/* GRADE QUADRADA (GRID OVERLAY) */}
            {showGrid && activeScene.grid_type === 'square' && (
              <svg
                width={mapWidth}
                height={mapHeight}
                className="absolute inset-0 pointer-events-none"
              >
                <defs>
                  <pattern
                    id={`vtt-grid-pattern-${activeScene.id}`}
                    width={gridSize}
                    height={gridSize}
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
                      fill="none"
                      stroke={activeScene.grid_color || '#ffffff'}
                      strokeWidth="1"
                      strokeOpacity={activeScene.grid_opacity ?? 0.25}
                    />
                  </pattern>
                </defs>
                <rect width={mapWidth} height={mapHeight} fill={`url(#vtt-grid-pattern-${activeScene.id})`} />
              </svg>
            )}

            {/* TOKENS VISÍVEIS NO MAPA */}
            {tokens.map((token) => {
              const tokenPxSize = gridSize * token.size;
              const isOwner = token.owner_user_id === user.id;
              const isSelected = selectedToken?.id === token.id;
              const isCombatTurn = combatEncounter?.status === 'active' && 
                combatEncounter.combatants?.[combatEncounter.turn_index]?.token_id === token.id;

              return (
                <div
                  key={token.id}
                  onMouseDown={(e) => handleTokenMouseDown(e, token)}
                  style={{
                    left: `${token.x}px`,
                    top: `${token.y}px`,
                    width: `${tokenPxSize}px`,
                    height: `${tokenPxSize}px`
                  }}
                  className={`absolute cursor-pointer transition-shadow rounded-full flex flex-col items-center justify-center ${
                    isSelected ? 'ring-2 ring-[#c9a04e] z-20' : isOwner ? 'ring-1 ring-emerald-400/80 z-10' : 'z-10'
                  } ${isCombatTurn ? 'ring-4 ring-amber-400 animate-pulse z-20' : ''}`}
                >
                  {/* Token Body / Ring com proporção 1:1 rigorosa sem distorção */}
                  <div 
                    style={{ borderColor: token.color || '#c9a04e' }}
                    className={`w-full h-full rounded-full border-2 overflow-hidden shadow-sm relative bg-[#131211] flex items-center justify-center transition-transform ${
                      !token.is_visible ? 'opacity-50' : 'opacity-100'
                    }`}
                  >
                    {token.avatar_url ? (
                      <img 
                        src={token.avatar_url} 
                        alt={token.name} 
                        className="w-full h-full object-cover rounded-full pointer-events-none select-none" 
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#131211] font-bold text-white text-xs select-none">
                        {token.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    {/* Status icons: Bloqueado / Oculto */}
                    {token.is_locked && (
                      <div className="absolute top-1 right-1 bg-black/80 p-0.5 rounded-full text-[#c9a04e] shadow">
                        <Lock className="w-2.5 h-2.5" />
                      </div>
                    )}
                    {!token.is_visible && (
                      <div className="absolute bottom-1 right-1 bg-black/80 p-0.5 rounded-full text-[#b24a52] shadow">
                        <EyeOff className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>

                  {/* Barra de Vida Flutuante sobre o Token */}
                  {((token.current_hp !== null && token.max_hp && token.max_hp > 0) || (token.hp_percent !== undefined && token.hp_percent !== null)) && (
                    <div className="absolute -top-3 w-full px-1 pointer-events-none">
                      <div className="w-full h-1.5 bg-[#131211] rounded-full overflow-hidden border border-[#3a3530] shadow">
                        {(() => {
                          const pct = token.hp_percent ?? Math.round(((token.current_hp || 0) / (token.max_hp || 1)) * 100);
                          const barColor = pct <= 25 ? 'bg-[#b24a52]' : pct <= 50 ? 'bg-amber-500' : 'bg-emerald-500';
                          return (
                            <div 
                              className={`h-full transition-all duration-300 ${barColor}`} 
                              style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                            />
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Nome do Token abaixo com contraste e legibilidade */}
                  <div className="absolute -bottom-4 bg-[#131211] text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-[#2c2825] whitespace-nowrap pointer-events-none shadow-md max-w-[120px] truncate">
                    {token.name}
                  </div>
                </div>
              );
            })}

            {/* CAMADA DE FOG OF WAR (MÁSCARA SVG DE OCULTAÇÃO E REVELAÇÃO) */}
            {activeScene.fog_enabled && (
              <svg
                width={mapWidth}
                height={mapHeight}
                className="absolute inset-0 pointer-events-none z-10"
              >
                <defs>
                  <mask id={`vtt-fog-mask-${activeScene.id}`}>
                    {/* Base da máscara: preto (revelado/transparente por padrão se vazio) */}
                    <rect width={mapWidth} height={mapHeight} fill="black" />
                    {/* Aplica operações de ocultar/revelar sequencialmente */}
                    {activeScene.fog_data?.map((fog: any, idx: number) => {
                      const isHide = fog.hidden !== false && fog.type !== 'reveal';
                      return (
                        <rect
                          key={`fog-op-${idx}`}
                          x={fog.x}
                          y={fog.y}
                          width={fog.width}
                          height={fog.height}
                          fill={isHide ? 'white' : 'black'}
                        />
                      );
                    })}
                  </mask>
                </defs>

                {/* Camada de Névoa: 100% opaca preta para jogadores; semi-transparente para o Mestre */}
                <rect
                  width={mapWidth}
                  height={mapHeight}
                  fill={isMaster ? 'rgba(20, 23, 22, 0.72)' : '#131211'}
                  mask={`url(#vtt-fog-mask-${activeScene.id})`}
                />

                {/* Linhas de contorno informativas para o Mestre (Vermelho = Oculto, Verde = Revelado) */}
                {isMaster && (
                  <g opacity="0.65">
                    {activeScene.fog_data?.map((fog: any, idx: number) => {
                      const isHide = fog.hidden !== false && fog.type !== 'reveal';
                      return (
                        <rect
                          key={`fog-outline-${idx}`}
                          x={fog.x}
                          y={fog.y}
                          width={fog.width}
                          height={fog.height}
                          fill="none"
                          stroke={isHide ? '#b24a52' : '#5a7a5a'}
                          strokeWidth="1.5"
                          strokeDasharray="4 4"
                        />
                      );
                    })}
                  </g>
                )}
              </svg>
            )}

            {/* Retângulo de seleção de Fog sendo desenhado */}
            {currentFogRect && (
              <div
                style={{
                  left: `${currentFogRect.x}px`,
                  top: `${currentFogRect.y}px`,
                  width: `${currentFogRect.width}px`,
                  height: `${currentFogRect.height}px`
                }}
                className={`absolute border-2 pointer-events-none z-30 ${
                  fogMode === 'hide'
                    ? 'border-[#b24a52] bg-[#2c2825]'
                    : 'border-emerald-500 bg-emerald-950/40'
                }`}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[#8a8578] text-sm">
            <Layers className="w-12 h-12 text-slate-700 mb-3" />
            <p className="font-semibold text-[#8a8578]">Nenhuma cena criada nesta campanha.</p>
            {isMaster && (
              <button
                onClick={handleOpenCreateScene}
                className="mt-3 px-4 py-2 bg-[#c9a04e] hover:bg-[#c9a04e]/90 text-[#131211] font-bold rounded-xl text-xs font-semibold shadow-lg"
              >
                + Criar Primeira Cena
              </button>
            )}
          </div>
        )}

        {/* POPOVER DE TOKEN SELECIONADO COM CONTROLES DE TAMANHO */}
        {selectedToken && (
          <div className="absolute bottom-4 left-4 z-40 bg-[#1a1816]/90 backdrop-blur-md border border-[#2c2825] rounded-2xl p-3 shadow-sm backdrop-blur-md flex items-center space-x-3 max-w-md transition-all duration-300">
            <div className="w-11 h-11 rounded-xl overflow-hidden bg-[#2c2825] border border-[#3a3530] shrink-0 flex items-center justify-center">
              {selectedToken.avatar_url ? (
                <img src={selectedToken.avatar_url} alt={selectedToken.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white bg-[#131211]">
                  {selectedToken.name.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-white truncate">{selectedToken.name}</h4>
              <p className="text-[10px] text-[#8a8578] truncate">
                Pos: ({Math.round(selectedToken.x)}, {Math.round(selectedToken.y)})
                {selectedToken.current_hp !== null 
                  ? ` • PV: ${selectedToken.current_hp}${selectedToken.max_hp ? `/${selectedToken.max_hp}` : ''}`
                  : (selectedToken as any).hp_status 
                    ? ` • Saúde: ${
                        (selectedToken as any).hp_status === 'healthy' ? 'Saudável' :
                        (selectedToken as any).hp_status === 'injured' ? 'Ferido' :
                        (selectedToken as any).hp_status === 'bloodied' ? 'Ensanguentado' :
                        (selectedToken as any).hp_status === 'critical' ? 'Crítico' : 'Derrotado'
                      }`
                    : ''
                }
              </p>

              {/* Controle de Tamanho do Token (Mestre) */}
              {isMaster && (
                <div className="flex items-center space-x-1.5 mt-1">
                  <span className="text-[10px] text-[#8a8578] font-semibold">Tamanho:</span>
                  <div className="flex items-center bg-[#131211] border border-[#3a3530] rounded-lg overflow-hidden">
                    <button
                      onClick={() => handleResizeToken(selectedToken, -0.5)}
                      disabled={selectedToken.size <= 0.5}
                      title="Diminuir tamanho do token"
                      className="px-1.5 py-0.5 text-xs text-[#ece3d0] hover:text-white hover:bg-[#2c2825] disabled:opacity-40 transition-colors"
                    >
                      -
                    </button>
                    <span className="px-1.5 text-[11px] font-mono font-bold text-[#c9a04e]">
                      {selectedToken.size}x
                    </span>
                    <button
                      onClick={() => handleResizeToken(selectedToken, 0.5)}
                      disabled={selectedToken.size >= 4}
                      title="Aumentar tamanho do token"
                      className="px-1.5 py-0.5 text-xs text-[#ece3d0] hover:text-white hover:bg-[#2c2825] disabled:opacity-40 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Ações do Mestre */}
            {isMaster && (
              <div className="flex items-center space-x-1 shrink-0">
                <button
                  onClick={() => openEditTokenModal(selectedToken)}
                  title="Configurar Atributos e Estatísticas do Token / NPC"
                  className="p-1.5 bg-[#2c2825] hover:bg-[#3a3530] text-[#ece3d0] border border-[#3a3530] rounded text-xs transition-all duration-200 hover:scale-[1.05] active:scale-[0.95]"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleToggleTokenVisibility(selectedToken)}
                  title={selectedToken.is_visible ? "Ocultar dos Jogadores" : "Revelar aos Jogadores"}
                  className="p-1.5 bg-[#2c2825]/90 hover:bg-[#3a3530]/90 text-[#ece3d0] rounded-xl text-xs transition-all duration-200 hover:scale-[1.05] active:scale-[0.95]"
                >
                  {selectedToken.is_visible ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-[#b24a52]" />}
                </button>
                <button
                  onClick={() => handleToggleTokenLock(selectedToken)}
                  title={selectedToken.is_locked ? "Destravar Movimentação" : "Travar Movimentação"}
                  className="p-1.5 bg-[#2c2825]/90 hover:bg-[#3a3530]/90 text-[#ece3d0] rounded-xl text-xs transition-all duration-200 hover:scale-[1.05] active:scale-[0.95]"
                >
                  {selectedToken.is_locked ? <Lock className="w-3.5 h-3.5 text-[#c9a04e]" /> : <Unlock className="w-3.5 h-3.5 text-[#8a8578]" />}
                </button>
                <button
                  onClick={() => handleDeleteToken(selectedToken.id)}
                  title="Remover do Mapa"
                  className="p-1.5 bg-[#b24a52]/30 hover:bg-[#b24a52] text-[#ece3d0] border border-[#b24a52] rounded text-xs transition-all duration-200 hover:scale-[1.05] active:scale-[0.95]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <button
              onClick={() => setSelectedToken(null)}
              className="text-[#8a8578] hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* BARRA INFERIOR DE AÇÕES TÁTICAS (Design Arcanum V2 - Fidelidade Imagem 5) */}
        {combatEncounter && combatEncounter.status === 'active' && (() => {
          const activeTurnCombatant = combatEncounter.combatants?.[combatEncounter.turn_index];
          const selectedTokenCombatant = selectedToken ? combatEncounter.combatants?.find(c => c.token_id === selectedToken.id || (selectedToken.character_id && c.character_id === selectedToken.character_id)) : null;
          const currentActor = (isMaster && selectedTokenCombatant) ? selectedTokenCombatant : (activeTurnCombatant || selectedTokenCombatant);
          if (!currentActor) return null;

          const actorChar = characters.find(c => c.id === currentActor.character_id || c.id === selectedToken?.character_id);
          const isMyControl = isMaster || (currentActor.owner_user_id === user.id) || (actorChar?.user_id === user.id);
          if (!isMyControl) return null;

          // ==========================================
          // 1. Catálogo Dinâmico Conectado à Ficha Real
          // ==========================================
          const isWeaponItem = (i: any) => {
            const cat = String(i.category || '').toLowerCase();
            const type = String(i.type || '').toLowerCase();
            return (
              cat === 'arma' || cat === 'weapon' ||
              type === 'weapon' || type === 'arma' ||
              i.is_weapon === 1 ||
              Boolean(i.properties?.dano) ||
              Boolean(i.properties?.damage_formula)
            );
          };

          // Todas as armas do inventário (equipadas e na mochila)
          const allWeapons = dockInventory.filter(isWeaponItem);

          // Armas equipadas aparecem primeiro, seguidas pelas armas na mochila
          const sortedWeapons = [...allWeapons].sort((a, b) => {
            const aEq = (a.is_equipped === 1 || a.is_equipped === true) ? 1 : 0;
            const bEq = (b.is_equipped === 1 || b.is_equipped === true) ? 1 : 0;
            return bEq - aEq;
          });

          const weaponActions = sortedWeapons.map((w, idx) => {
            const props = w.properties || {};
            const dmgFormula = props.dano || props.damage_formula || '1d8';
            const dmgType = props.tipo_dano || props.damage_type || 'Cortante';
            const atqFormula = props.ataque || props.attack_formula || '1d20 + 4';
            const reach = props.alcance || '1.5m';
            const imbuedList = props.imbued_effects || [];
            const isEquipped = w.is_equipped === 1 || w.is_equipped === true;

            return {
              id: w.id || `wep-${idx}`,
              weapon_id: w.id,
              title: w.item_name || w.name,
              subtitle: isEquipped ? (props.tipo || w.category || 'Arma equipada') : 'Na mochila (desequipada)',
              attackFormula: atqFormula,
              damageFormula: `${dmgFormula} ${dmgType}`,
              rawDamageFormula: dmgFormula,
              damageType: dmgType.toLowerCase(),
              costLabel: 'Ação principal 0/1 usada',
              reach,
              status: 'available' as const,
              statusLabel: isEquipped ? (imbuedList.length > 0 ? `Imbuída (${imbuedList.length})` : 'Equipada') : 'Na mochila',
              isEquipped,
              imbuedEffects: imbuedList,
              rawItem: w
            };
          });

          const unarmedAction = {
            id: 'unarmed-strike',
            weapon_id: undefined,
            title: 'Ataque Desarmado',
            subtitle: 'Golpe físico padrão desarmado',
            attackFormula: '1d20 + 2',
            damageFormula: '1d4 + 2 Impacto',
            rawDamageFormula: '1d4 + 2',
            damageType: 'impacto',
            costLabel: 'Ação principal 0/1 usada',
            reach: '1.5m',
            status: 'available' as const,
            statusLabel: 'Desarmado',
            isEquipped: false,
            imbuedEffects: [],
            rawItem: null
          };

          // Lista de Ataque: armas reais disponíveis na ficha + golpe desarmado padrão
          const attackActions = weaponActions.length > 0 ? [...weaponActions, unarmedAction] : [unarmedAction];

          // Aba HABILIDADES: Habilidades reais associadas ao personagem
          const rawAbilities = actorChar?.raw_data?.abilities || actorChar?.raw_data?.habilidades || actorChar?.computed_data?.abilities || currentActor.npc_data?.actions || [];
          const hasAbilities = Array.isArray(rawAbilities) && rawAbilities.length > 0;
          const abilityActions = hasAbilities ? rawAbilities.map((ab: any, idx: number) => {
            const name = typeof ab === 'string' ? ab : (ab.name || ab.title || `Habilidade ${idx+1}`);
            const atq = typeof ab === 'object' && ab.roll ? ab.roll : (ab.attack_formula || '1d20 + 3');
            const dmg = typeof ab === 'object' && ab.damage ? ab.damage : (ab.damage_formula || ab.effect || 'Efeito tático');
            const cost = typeof ab === 'object' && ab.cost ? ab.cost : 'Ação principal';
            const desc = typeof ab === 'object' && ab.description ? ab.description : 'Técnica de combate';
            const vt = typeof ab === 'object' && ab.valid_targets ? ab.valid_targets : (ab.type === 'heal' ? ['self', 'allies'] : ['enemies', 'any']);

            return {
              id: ab.id || `ab-${idx}`,
              title: name,
              subtitle: desc,
              attackFormula: atq,
              damageFormula: dmg,
              rawDamageFormula: String(dmg).split(' ')[0],
              costLabel: cost,
              reach: ab.reach || ab.range || '1.5m',
              status: 'available' as const,
              statusLabel: 'Pronta',
              validTargets: vt
            };
          }) : [
            {
              id: 'no-abilities',
              title: 'Nenhuma Habilidade',
              subtitle: 'Este combatente não possui habilidades registradas',
              attackFormula: '—',
              damageFormula: '—',
              rawDamageFormula: '0',
              costLabel: '—',
              reach: '—',
              status: 'unavailable' as const,
              statusLabel: '0 disp.',
              validTargets: ['self']
            }
          ];

          // Aba CONSUMÍVEIS: Itens com quantidade > 0 do inventário (exclui armas estritamente)
          const isConsumableItem = (i: any) => {
            if (isWeaponItem(i)) return false;
            const cat = String(i.category || '').toLowerCase();
            const type = String(i.type || '').toLowerCase();
            const p = i.properties || {};
            return (
              cat === 'consumivel' || cat === 'consumable' || cat === 'pocao' || cat === 'oleo' ||
              type === 'consumable' || type === 'potion' || type === 'oil' ||
              p.cura !== undefined || p.heal_formula !== undefined ||
              p.condition !== undefined || p.imbue_properties !== undefined ||
              p.status !== undefined || p.is_consumable === true
            ) && (i.quantity > 0);
          };

          const consumableItems = dockInventory.filter(isConsumableItem);

          const consumableActions = consumableItems.length > 0 ? consumableItems.map((c, idx) => {
            const p = c.properties || {};
            let dmgLabel = 'Efeito ao consumir';
            if (p.cura) dmgLabel = `Recupera ${p.cura} PV`;
            else if (p.heal_formula) dmgLabel = `Cura ${p.heal_formula}`;
            else if (p.dano) dmgLabel = `Causa ${p.dano} ${p.tipo_dano || 'dano'}`;
            else if (p.damage_formula) dmgLabel = `Dano ${p.damage_formula} ${p.tipo_dano || ''}`;
            else if (p.condition || p.status) dmgLabel = `Aplica ${p.condition || p.status}`;
            else if (p.imbue_properties) dmgLabel = `Encanta arma (${p.imbue_properties.damage_type || 'mágico'})`;

            const isImbue = !!p.imbue_properties || c.category === 'oleo' || (c.item_name && c.item_name.toLowerCase().includes('óleo'));

            return {
              id: c.id || `cons-${idx}`,
              consumable_item_id: c.id,
              title: c.item_name || c.name,
              subtitle: p.descricao || p.description || (p.cura ? 'Restaura vitalidade' : isImbue ? 'Óleo de encantamento' : 'Item consumível'),
              attackFormula: 'Automático',
              damageFormula: dmgLabel,
              rawDamageFormula: String(p.cura || p.dano || '0'),
              costLabel: p.action_cost === 'main' ? 'Ação principal' : 'Ação bônus 0/1 usada',
              reach: p.alcance || (p.cura ? 'Pessoal / Aliado' : isImbue ? 'Arma equipada' : 'Pessoal'),
              status: 'available' as const,
              statusLabel: `${c.quantity} disp.`,
              isImbue,
              rawItem: c,
              validTargets: p.valid_targets || (p.cura ? ['self', 'allies'] : ['self', 'allies', 'enemies', 'any'])
            };
          }) : [
            {
              id: 'no-consumables',
              consumable_item_id: undefined,
              title: 'Mochila sem consumíveis',
              subtitle: 'Nenhum consumível com unidades disponíveis',
              attackFormula: '—',
              damageFormula: '0',
              rawDamageFormula: '0',
              costLabel: '—',
              reach: 'Pessoal',
              status: 'unavailable' as const,
              statusLabel: '0 disp.',
              isImbue: false,
              rawItem: null,
              validTargets: ['self']
            }
          ];

          // Aba DEFESA E ESQUIVA: Ações base universais para TODOS os personagens
          const defenseActions = [
            {
              id: 'universal-defend',
              actionMode: 'defend' as const,
              title: 'Defesa Normal',
              subtitle: 'Ergue a guarda ou escudo (+2 RD / Defesa)',
              attackFormula: 'Automático',
              damageFormula: '+2 RD até próximo turno',
              rawDamageFormula: '0',
              costLabel: 'Ação principal 0/1 usada',
              reach: 'Pessoal',
              status: 'available' as const,
              statusLabel: 'Pronta',
              validTargets: ['self']
            },
            {
              id: 'universal-dodge',
              actionMode: 'dodge' as const,
              title: 'Esquiva Normal',
              subtitle: 'Reação ágil: rola 1d20 + Agilidade (eleva defesa se maior)',
              attackFormula: 'Automático',
              formula: `1d20 + ${(actorChar?.raw_data?.agilidade ?? actorChar?.computed_data?.agilidade ?? 2)}`,
              damageFormula: `1d20 + ${(actorChar?.raw_data?.agilidade ?? actorChar?.computed_data?.agilidade ?? 2)} (Defesa)`,
              rawDamageFormula: '0',
              costLabel: 'Ação principal / reação',
              reach: 'Pessoal',
              status: 'available' as const,
              statusLabel: 'Pronta',
              validTargets: ['self']
            }
          ];

          const currentList = quickActionTab === 'attack' 
            ? attackActions 
            : quickActionTab === 'ability' 
            ? abilityActions 
            : quickActionTab === 'consumable' 
            ? consumableActions 
            : defenseActions;

          const activeAction = currentList.find(a => a.id === selectedQuickActionId) || currentList[0];

          // ==========================================
          // 2. Seleção de Alvos (Aliados, Inimigos e Self)
          // ==========================================
          const allCombatants = combatEncounter.combatants || [];
          
          const getFaction = (c: any): 'ally' | 'enemy' => {
            if (!c.is_npc) return 'ally';
            const disp = (c.npc_data?.disposition || c.npc_data?.faction || (c.npc_data?.is_ally ? 'friendly' : 'hostile')).toLowerCase();
            return (disp === 'friendly' || disp === 'ally') ? 'ally' : 'enemy';
          };
          const actorFaction = getFaction(currentActor);
          const isCombatantAlly = (c: any) => getFaction(c) === actorFaction;
          const isCombatantEnemy = (c: any) => getFaction(c) !== actorFaction;
          const isCombatantSelf = (c: any) => c.id === currentActor.id;

          // Validador de compatibilidade para a ação em foco
          const isTargetCompatible = (c: any) => {
            if (quickActionTab === 'defense') return isCombatantSelf(c);
            if (quickActionTab === 'consumable') return true;
            if (quickActionTab === 'ability') {
              const vt = (activeAction as any).validTargets || ['enemies', 'any'];
              if (vt.includes('any')) return true;
              if (vt.includes('self') && isCombatantSelf(c)) return true;
              if (vt.includes('allies') && isCombatantAlly(c)) return true;
              if (vt.includes('enemies') && isCombatantEnemy(c)) return true;
              return false;
            }
            return isCombatantEnemy(c);
          };

          // Define o alvo atual
          const currentTarget = allCombatants.find(c => c.id === quickSelectedTargetId) || (
            quickActionTab === 'defense' ? currentActor :
            (allCombatants.find(c => c.id !== currentActor.id && isTargetCompatible(c)) || allCombatants[0] || null)
          );

          // Ciclar Alvos
          const handleCycleTarget = () => {
            if (allCombatants.length === 0) return;
            const currentIndex = allCombatants.findIndex(t => t.id === currentTarget?.id);
            const nextIndex = (currentIndex + 1) % allCombatants.length;
            setQuickSelectedTargetId(allCombatants[nextIndex].id);
          };

          // ==========================================
          // 3. Execução das Ações de Combate
          // ==========================================
          const handleExecuteCombatAction = async () => {
            if (activeAction.status === 'unavailable') {
              notify.warning('Ação Indisponível', activeAction.statusLabel);
              return;
            }

            setIsExecutingQuickAction(true);
            setQuickActionFeedback(null);

            try {
              let payload: any = {
                actor_id: currentActor.id,
                target_id: currentTarget ? currentTarget.id : currentActor.id
              };

              if (quickActionTab === 'attack') {
                payload = {
                  ...payload,
                  action_mode: 'weapon',
                  action_type: 'attack',
                  weapon_id: (activeAction as any).weapon_id,
                  attack_formula: activeAction.attackFormula,
                  formula: (activeAction as any).rawDamageFormula || activeAction.damageFormula.split(' ')[0],
                  damage_type: (activeAction as any).damageType || 'cortante',
                  action_cost: 'main'
                };
              } else if (quickActionTab === 'ability') {
                payload = {
                  ...payload,
                  action_mode: 'ability',
                  ability_name: activeAction.title,
                  attack_formula: activeAction.attackFormula.includes('d') ? activeAction.attackFormula : undefined,
                  formula: (activeAction as any).rawDamageFormula !== '0' ? (activeAction as any).rawDamageFormula : undefined,
                  action_cost: 'main'
                };
              } else if (quickActionTab === 'consumable') {
                if (!(activeAction as any).consumable_item_id) {
                  notify.warning('Sem Item', 'Selecione um consumível disponível.');
                  setIsExecutingQuickAction(false);
                  return;
                }
                payload = {
                  ...payload,
                  action_mode: 'consumable',
                  consumable_item_id: (activeAction as any).consumable_item_id,
                  notes: activeAction.title,
                  action_cost: 'bonus'
                };
              } else {
                // Defesa ou Esquiva Normal
                payload = {
                  ...payload,
                  action_mode: (activeAction as any).actionMode || 'defend',
                  formula: (activeAction as any).formula,
                  action_cost: (activeAction as any).actionMode === 'dodge' ? 'reaction' : 'main'
                };
              }

              const res = await api.applyCombatAction(campaign.id, combatEncounter.id, payload);
              const updatedEnc = await api.getActiveCombat(campaign.id);
              setCombatEncounter(updatedEnc);
              setDockInventoryTrigger(prev => prev + 1);

              const hitInfo = res.hit !== undefined ? (res.hit ? 'Acertou!' : 'Errou o golpe!') : 'Ação aplicada!';
              const dmgInfo = res.finalDamage !== undefined ? ` Dano: ${res.finalDamage}` : '';
              setQuickActionFeedback(`${hitInfo}${dmgInfo}`);
              notify.success('Ação Realizada', `${activeAction.title}: ${hitInfo}${dmgInfo}`);
              setTimeout(() => setQuickActionFeedback(null), 3500);
            } catch (err: any) {
              setQuickActionFeedback(`Falha: ${err.message}`);
              notify.error('Erro na Ação', err.message);
              setTimeout(() => setQuickActionFeedback(null), 3500);
            } finally {
              setIsExecutingQuickAction(false);
            }
          };

          return (
            <div className="absolute bottom-3 inset-x-0 z-30 flex justify-center items-center mx-auto px-4 pointer-events-none">
              <div className="w-full max-w-4xl bg-[#1a1816]/75 border border-[#3a3530] rounded-2xl shadow-xl shadow-black/50 backdrop-blur-md overflow-hidden pointer-events-auto transition-all duration-300 ease-in-out">
                {/* Abas Superiores Estilizadas com Contadores Reais */}
                <div className="flex items-center justify-between border-b border-[#3a3530] bg-[#131211]/85 px-4 py-2">
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setQuickActionTab('attack');
                        if (attackActions.length > 0) setSelectedQuickActionId(attackActions[0].id);
                      }}
                      className={`px-3 py-1 rounded-xl text-xs font-serif font-bold transition-all flex items-center space-x-1.5 ${
                        quickActionTab === 'attack'
                          ? 'bg-[#2c2825] text-[#c9a04e] border border-[#c9a04e]/60 shadow-md'
                          : 'text-[#8a8578] hover:text-[#ece3d0] border border-transparent'
                      }`}
                    >
                      <Swords className="w-3.5 h-3.5" />
                      <span>Ataque</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-[#131211] text-[#c9a04e] rounded-md font-mono font-normal border border-[#3a3530]">
                        {attackActions.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickActionTab('ability');
                        if (abilityActions.length > 0) setSelectedQuickActionId(abilityActions[0].id);
                      }}
                      className={`px-3 py-1 rounded-xl text-xs font-serif font-bold transition-all flex items-center space-x-1.5 ${
                        quickActionTab === 'ability'
                          ? 'bg-[#2c2825] text-[#4a7a8a] border border-[#4a7a8a]/60 shadow-md'
                          : 'text-[#8a8578] hover:text-[#ece3d0] border border-transparent'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Habilidades</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-[#131211] text-[#4a7a8a] rounded-md font-mono font-normal border border-[#3a3530]">
                        {hasAbilities ? abilityActions.length : 0}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickActionTab('consumable');
                        if (consumableActions.length > 0) setSelectedQuickActionId(consumableActions[0].id);
                      }}
                      className={`px-3 py-1 rounded-xl text-xs font-serif font-bold transition-all flex items-center space-x-1.5 ${
                        quickActionTab === 'consumable'
                          ? 'bg-[#2c2825] text-[#5a7a5a] border border-[#5a7a5a]/60 shadow-md'
                          : 'text-[#8a8578] hover:text-[#ece3d0] border border-transparent'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Consumíveis</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-[#131211] text-[#5a7a5a] rounded-md font-mono font-normal border border-[#2c2825]">
                        {consumableItems.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickActionTab('defense');
                        setSelectedQuickActionId(defenseActions[0].id);
                      }}
                      className={`px-3 py-1 rounded-xl text-xs font-serif font-bold transition-all flex items-center space-x-1.5 ${
                        quickActionTab === 'defense'
                          ? 'bg-[#2c2825] text-[#c9a04e] border border-[#c9a04e]/60 shadow-md'
                          : 'text-[#8a8578] hover:text-[#ece3d0] border border-transparent'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>Defesa e Esquiva</span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    {quickActionFeedback && (
                      <span className="text-xs font-mono font-bold text-[#c9a04e] bg-[#2c2825] px-2.5 py-0.5 rounded-lg border border-[#c9a04e]/60 animate-pulse">
                        {quickActionFeedback}
                      </span>
                    )}
                    <span className="text-[11px] text-[#8a8578] font-mono hidden sm:inline">
                      Turno: <strong className="text-[#ece3d0]">{currentActor.name}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCombatDock(prev => !prev)}
                      title="Alternar Visão Completa de Combate"
                      className="text-xs font-serif text-[#c9a04e] hover:text-[#c9a04e] px-2 py-1 rounded-lg bg-[#2c2825] border border-[#3a3530] transition-colors"
                    >
                      HUD Detalhado
                    </button>
                  </div>
                </div>

                {/* Corpo de Duas Colunas da Imagem 5 */}
                <div className="p-2.5 grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch">
                  {/* Coluna Esquerda: Lista de Opções */}
                  <div className="md:col-span-5 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {currentList.map((item) => {
                      const isSelected = item.id === activeAction.id;
                      const isUnavailable = item.status === 'unavailable';
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedQuickActionId(item.id)}
                          className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-[#2c2825] border-[#c9a04e] ring-1 ring-[#c9a04e] shadow-sm'
                              : 'bg-[#131211] border-[#2c2825] hover:border-[#3a3530]'
                          } ${isUnavailable ? 'opacity-60' : ''}`}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <h5 className={`font-serif text-xs font-bold truncate ${isSelected ? 'text-[#c9a04e]' : 'text-[#ece3d0]'}`}>
                              {item.title}
                            </h5>
                            <span className="text-[10px] text-[#8a8578] font-mono truncate block">
                              {item.subtitle}
                            </span>
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono shrink-0 whitespace-nowrap ${
                            isUnavailable
                              ? 'bg-[#b24a52]/20 text-[#b24a52] border-[#b24a52]/40'
                              : 'bg-[#5a7a5a]/20 text-[#5a7a5a] border-[#5a7a5a]/40'
                          }`}>
                            {item.statusLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Coluna Direita: Card de Resolução e Confirmação */}
                  <div className="md:col-span-7 bg-[#131211] border border-[#2c2825] rounded-lg p-2.5 flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-serif font-bold text-xs text-[#ece3d0]">
                          {activeAction.title}
                        </h4>
                        <span className="text-[10px] text-[#8a8578] font-mono">
                          • {activeAction.reach}
                        </span>
                      </div>

                      {/* Botões contextuais da aba Ataque (Equipar/Desequipar e Imbuir) */}
                      {quickActionTab === 'attack' && (activeAction as any).weapon_id && (
                        <div className="flex items-center space-x-1.5">
                          {dockCharId && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const item = (activeAction as any).rawItem;
                                  const isEquipped = (activeAction as any).isEquipped;
                                  const nextState = !isEquipped;
                                  await api.updateCharacterInventoryItem(campaign.id, dockCharId, item.id, {
                                    isEquipped: nextState
                                  });
                                  setDockInventoryTrigger(prev => prev + 1);
                                  notify.success(
                                    nextState ? 'Arma Equipada' : 'Arma Desequipada',
                                    `${item.item_name || item.name} agora está ${nextState ? 'equipada para combate' : 'na mochila'}.`
                                  );
                                } catch (e: any) {
                                  notify.error('Erro ao alternar equipamento', e.message);
                                }
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors flex items-center space-x-1 ${
                                (activeAction as any).isEquipped
                                  ? 'bg-[#5a7a5a]/20 text-[#5a7a5a] border-[#5a7a5a]/40 hover:bg-[#5a7a5a]/30'
                                  : 'bg-[#c9a04e]/20 text-[#c9a04e] border-[#c9a04e]/40 hover:bg-[#c9a04e]/30'
                              }`}
                            >
                              <span>{(activeAction as any).isEquipped ? '✓ Equipada' : '+ Equipar'}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedWeaponForImbue((activeAction as any).rawItem);
                              setShowImbueModal(true);
                            }}
                            className="px-2 py-0.5 rounded bg-[#1a1816] hover:bg-[#c9a04e] hover:text-[#131211] text-[#c9a04e] border border-[#c9a04e]/60 text-[10px] font-mono transition-colors flex items-center space-x-1"
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>Imbuir</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Três Métricas em Caixas (Imagem 5) */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-[#1a1816] border border-[#2c2825] rounded p-1.5 text-center">
                        <span className="text-[9px] text-[#8a8578] block">Teste de ataque</span>
                        <span className="font-mono text-xs font-bold text-[#c9a04e]">
                          {activeAction.attackFormula}
                        </span>
                      </div>
                      <div className="bg-[#1a1816] border border-[#2c2825] rounded p-1.5 text-center">
                        <span className="text-[9px] text-[#8a8578] block">Dano / Efeito</span>
                        <span className="font-mono text-xs font-bold text-[#ece3d0] truncate block">
                          {activeAction.damageFormula}
                        </span>
                      </div>
                      <div className="bg-[#1a1816] border border-[#2c2825] rounded p-1.5 text-center">
                        <span className="text-[9px] text-[#8a8578] block">Custo da ação</span>
                        <span className="font-mono text-[10px] text-[#8a8578] truncate block">
                          {activeAction.costLabel}
                        </span>
                      </div>
                    </div>

                    {/* Linha de Alvo e Botões */}
                    <div className="flex items-center justify-between pt-1 border-t border-[#2c2825] gap-2">
                      {/* Alvo e Validação com Distinção Visual Aliado/Inimigo/Self */}
                      <div className="flex items-center space-x-1.5 min-w-0">
                        {currentTarget ? (
                          <>
                            <div className={`w-2 h-2 rounded-full shrink-0 ${
                              isCombatantSelf(currentTarget) ? 'bg-[#c9a04e]' :
                              isCombatantAlly(currentTarget) ? 'bg-[#5a7a5a]' :
                              'bg-[#b24a52]'
                            }`} />
                            <span className="text-xs font-serif text-[#ece3d0] font-semibold truncate">
                              {currentTarget.name}
                            </span>
                            <span className={`text-[9px] font-mono px-1 py-0.2 rounded ${
                              isCombatantSelf(currentTarget) ? 'text-[#c9a04e] bg-[#c9a04e]/10' :
                              isCombatantAlly(currentTarget) ? 'text-[#5a7a5a] bg-[#5a7a5a]/10' :
                              'text-[#b24a52] bg-[#b24a52]/10'
                            }`}>
                              {isCombatantSelf(currentTarget) ? 'Você' : isCombatantAlly(currentTarget) ? 'Aliado' : 'Inimigo'}
                            </span>
                            <span className={`text-[10px] font-mono hidden sm:inline ${isTargetCompatible(currentTarget) ? 'text-[#5a7a5a]' : 'text-[#b24a52]'}`}>
                              {isTargetCompatible(currentTarget) ? '(Alvo válido)' : '(Incompatível)'}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-[#8a8578] font-mono">Nenhum alvo selecionado</span>
                        )}

                        <div className="flex items-center space-x-1 ml-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setShowTargetModal(true)}
                            className="px-2 py-0.5 rounded bg-[#2c2825] hover:bg-[#3a3530] text-[#ece3d0] text-[10px] font-mono border border-[#3a3530] transition-colors"
                          >
                            Trocar alvo
                          </button>
                          {allCombatants.length > 1 && (
                            <button
                              type="button"
                              onClick={handleCycleTarget}
                              title="Ciclar próximo alvo"
                              className="px-1.5 py-0.5 rounded bg-[#131211] hover:bg-[#2c2825] text-[#8a8578] hover:text-[#ece3d0] text-[10px] font-mono border border-[#2c2825] transition-colors"
                            >
                              ⟳
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Botão de Confirmação em Vinho Oficial */}
                      <button
                        type="button"
                        onClick={handleExecuteCombatAction}
                        disabled={isExecutingQuickAction || activeAction.status === 'unavailable'}
                        className="px-4 py-1.5 bg-[#b24a52] hover:bg-[#b24a52] disabled:opacity-50 text-[#ece3d0] rounded text-xs font-serif font-bold transition-all shadow-md flex items-center space-x-1.5 shrink-0"
                      >
                        <Swords className="w-3.5 h-3.5 text-[#ece3d0]" />
                        <span>
                          {isExecutingQuickAction 
                            ? 'Executando...' 
                            : quickActionTab === 'attack' 
                            ? 'Confirmar ataque' 
                            : quickActionTab === 'ability' 
                            ? 'Usar habilidade' 
                            : quickActionTab === 'consumable' 
                            ? 'Consumir' 
                            : 'Assumir postura'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* MODAL: SELETOR DE ALVOS (Aliados, Inimigos e Self) */}
        {showTargetModal && combatEncounter && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#1a1816] border border-[#2c2825] rounded-xl w-full max-w-md p-4 shadow-sm text-[#ece3d0]">
              <div className="flex items-center justify-between pb-2 border-b border-[#2c2825] mb-3">
                <h3 className="font-serif font-bold text-sm text-[#c9a04e]">
                  Selecionar Alvo da Ação
                </h3>
                <button
                  type="button"
                  onClick={() => setShowTargetModal(false)}
                  className="text-[#8a8578] hover:text-white text-xs font-mono"
                >
                  ✕ Fechar
                </button>
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {(combatEncounter.combatants || []).map((cb) => {
                  const isSel = cb.id === quickSelectedTargetId;
                  const isSelf = dockCombatant ? cb.id === dockCombatant.id : false;
                  const isAlly = dockCombatant ? (!cb.is_npc || cb.npc_data?.disposition === 'friendly') : false;

                  return (
                    <div
                      key={cb.id}
                      onClick={() => {
                        setQuickSelectedTargetId(cb.id);
                        setShowTargetModal(false);
                      }}
                      className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                        isSel
                          ? 'bg-[#2c2825] border-[#c9a04e]'
                          : 'bg-[#131211] border-[#2c2825] hover:border-[#3a3530]'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          isSelf ? 'bg-[#c9a04e]' : isAlly ? 'bg-[#5a7a5a]' : 'bg-[#b24a52]'
                        }`} />
                        <div>
                          <div className="font-serif font-bold text-xs text-[#ece3d0] leading-tight">
                            {cb.name}
                          </div>
                          <div className="text-[10px] text-[#8a8578] font-mono mt-0.5">
                            PV: {cb.current_hp ?? '—'} / {cb.max_hp ?? '—'}
                          </div>
                        </div>
                      </div>

                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        isSelf
                          ? 'bg-[#c9a04e]/20 text-[#c9a04e] border-[#c9a04e]/40'
                          : isAlly
                          ? 'bg-[#5a7a5a]/20 text-[#5a7a5a] border-[#5a7a5a]/40'
                          : 'bg-[#b24a52]/20 text-[#b24a52] border-[#b24a52]/40'
                      }`}>
                        {isSelf ? 'Você' : isAlly ? 'Aliado' : 'Inimigo'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* MODAL: IMBUIR ARMA */}
        {showImbueModal && selectedWeaponForImbue && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#1a1816] border border-[#2c2825] rounded-xl w-full max-w-md p-4 shadow-sm text-[#ece3d0]">
              <div className="flex items-center justify-between pb-2 border-b border-[#2c2825] mb-3">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-[#c9a04e]" />
                  <h3 className="font-serif font-bold text-sm text-[#c9a04e]">
                    Encantar / Imbuir Arma
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowImbueModal(false)}
                  className="text-[#8a8578] hover:text-white text-xs font-mono"
                >
                  ✕ Fechar
                </button>
              </div>

              <p className="text-xs text-[#8a8578] mb-3 font-sans">
                Selecione um óleo ou consumível da sua mochila para encantar <strong className="text-[#ece3d0]">{selectedWeaponForImbue.item_name}</strong>:
              </p>

              {dockInventory.filter(i => (i.category === 'oleo' || !!i.properties?.imbue_properties || (i.item_name && i.item_name.toLowerCase().includes('óleo'))) && i.quantity > 0).length === 0 ? (
                <div className="p-4 bg-[#131211] rounded-lg border border-[#2c2825] text-center text-xs text-[#8a8578]">
                  Nenhum óleo ou reagente de encantamento disponível nesta ficha.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto mb-4 pr-1">
                  {dockInventory.filter(i => (i.category === 'oleo' || !!i.properties?.imbue_properties || (i.item_name && i.item_name.toLowerCase().includes('óleo'))) && i.quantity > 0).map(oil => {
                    const isSelected = selectedOilForImbue === oil.id;
                    const p = oil.properties || {};
                    const imbueProp = p.imbue_properties || {};
                    const dmgType = imbueProp.damage_type || p.tipo_dano || 'Elemental';

                    return (
                      <div
                        key={oil.id}
                        onClick={() => setSelectedOilForImbue(oil.id)}
                        className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#2c2825] border-[#c9a04e] ring-1 ring-[#c9a04e]'
                            : 'bg-[#131211] border-[#2c2825] hover:border-[#3a3530]'
                        }`}
                      >
                        <div>
                          <div className="font-serif font-bold text-xs text-[#c9a04e]">
                            {oil.item_name}
                          </div>
                          <div className="text-[10px] text-[#8a8578] font-mono mt-0.5">
                            {p.descricao || `Adiciona dano de ${dmgType} e efeitos aos ataques`}
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-[#5a7a5a] bg-[#5a7a5a]/10 px-2 py-0.5 rounded border border-[#5a7a5a]/30">
                          {oil.quantity} disp.
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2 border-t border-[#2c2825]">
                <button
                  type="button"
                  onClick={() => setShowImbueModal(false)}
                  className="px-3 py-1.5 rounded text-xs font-mono text-[#8a8578] hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!selectedOilForImbue || isExecutingImbue}
                  onClick={async () => {
                    if (!combatEncounter || !selectedWeaponForImbue || !selectedOilForImbue) return;
                    setIsExecutingImbue(true);
                    try {
                      const actorId = dockCombatant?.id;
                      if (!actorId) throw new Error('Combatente não encontrado.');
                      await api.applyCombatAction(campaign.id, combatEncounter.id, {
                        actor_id: actorId,
                        action_mode: 'imbue',
                        consumable_item_id: selectedOilForImbue,
                        target_weapon_id: selectedWeaponForImbue.id,
                        action_cost: 'bonus'
                      });
                      notify.success('✨ Arma Encantada!', 'O dano elemental foi imbuído com sucesso.');
                      setShowImbueModal(false);
                      setSelectedOilForImbue('');
                      setDockInventoryTrigger(prev => prev + 1);
                      const updatedEnc = await api.getActiveCombat(campaign.id);
                      setCombatEncounter(updatedEnc);
                    } catch (err: any) {
                      notify.error('Erro ao Imbuir', err.message);
                    } finally {
                      setIsExecutingImbue(false);
                    }
                  }}
                  className="px-4 py-1.5 rounded text-xs font-serif font-bold bg-[#b24a52] hover:bg-[#b24a52] disabled:opacity-50 text-[#ece3d0] transition-colors"
                >
                  {isExecutingImbue ? 'Imbuindo...' : 'Confirmar Encantamento'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DOCK LATERAL DO TRACKER DE COMBATE */}
        {showCombatDock && (
          <div className="absolute top-2 right-2 bottom-2 w-80 sm:w-96 z-40 transition-all">
            <CombatTracker
              campaign={campaign}
              user={user}
              isMaster={isMaster}
              encounter={combatEncounter}
              characters={characters}
              tokens={tokens}
              onEncounterUpdated={(enc) => setCombatEncounter(enc)}
              onCharacterUpdated={onCharacterUpdated}
              lastChatMessage={lastVttEvent?.type === 'chat:message' ? lastVttEvent : undefined}
              wsRef={wsRef}
            />
          </div>
        )}
      </div>

      {/* MODAL DE DETALHES E HABILIDADES DO PERSONAGEM (CLIQUE NO TOKEN) */}
      {selectedCharacterDetails && (
        <CharacterDetails
          character={selectedCharacterDetails}
          campaignId={campaign.id}
          onClose={() => setSelectedCharacterDetails(null)}
        />
      )}

      {/* MODAL: Criar / Editar Cena */}
      {showSceneModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1a1816] border border-[#2c2825] rounded-xl w-full max-w-lg p-6 shadow-sm backdrop-blur-md">
            <div className="flex items-center justify-between pb-3 border-b border-[#2c2825] mb-4">
              <h3 className="font-bold text-base text-white">
                {isEditingScene ? 'Configurações da Cena' : 'Nova Cena do Mapa'}
              </h3>
              <button onClick={() => setShowSceneModal(false)} className="text-[#8a8578] hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveScene} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[#ece3d0] block mb-1">Nome da Cena</label>
                <input
                  type="text"
                  required
                  value={sceneForm.name}
                  onChange={(e) => setSceneForm({ ...sceneForm, name: e.target.value })}
                  className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a04e]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#ece3d0] block mb-1">URL da Imagem de Fundo</label>
                <div className="flex space-x-2">
                  <input
                    type="url"
                    placeholder="https://exemplo.com/mapa.jpg"
                    value={sceneForm.image_url}
                    onChange={(e) => {
                      setSceneForm({ ...sceneForm, image_url: e.target.value });
                      detectImageDimensions(e.target.value);
                    }}
                    className="flex-1 bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a04e]"
                  />
                  <button
                    type="button"
                    onClick={() => detectImageDimensions(sceneForm.image_url)}
                    className="px-3 py-2 bg-[#2c2825] hover:bg-[#3a3530] text-[#ece3d0] hover:text-white rounded-xl text-xs font-semibold whitespace-nowrap"
                    title="Detectar resolução nativa da imagem"
                  >
                    Detectar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#ece3d0] block mb-1">Tamanho da Grade (px)</label>
                  <input
                    type="number"
                    min="20"
                    max="200"
                    value={sceneForm.grid_size}
                    onChange={(e) => setSceneForm({ ...sceneForm, grid_size: parseInt(e.target.value, 10) || 50 })}
                    className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a04e]"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-[#ece3d0] block mb-1">Escala da Grade (m / ft)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={sceneForm.grid_scale}
                    onChange={(e) => setSceneForm({ ...sceneForm, grid_scale: parseFloat(e.target.value) || 1.5 })}
                    className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a04e]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#ece3d0] block mb-1">Largura do Mapa (px)</label>
                  <input
                    type="number"
                    min="500"
                    max="10000"
                    value={sceneForm.width}
                    onChange={(e) => setSceneForm({ ...sceneForm, width: parseInt(e.target.value, 10) || 2000 })}
                    className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a04e]"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-[#ece3d0] block mb-1">Altura do Mapa (px)</label>
                  <input
                    type="number"
                    min="500"
                    max="10000"
                    value={sceneForm.height}
                    onChange={(e) => setSceneForm({ ...sceneForm, height: parseInt(e.target.value, 10) || 2000 })}
                    className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a04e]"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-6 pt-1">
                <label className="flex items-center space-x-2 text-xs text-[#ece3d0] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sceneForm.fog_enabled}
                    onChange={(e) => setSceneForm({ ...sceneForm, fog_enabled: e.target.checked })}
                    className="rounded bg-[#131211] border-[#3a3530] text-[#c9a04e] focus:ring-0"
                  />
                  <span>Ativar Camada de Fog of War (Áreas Ocultas)</span>
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#2c2825]">
                <button
                  type="button"
                  onClick={() => setShowSceneModal(false)}
                  className="px-4 py-2 bg-[#2c2825] hover:bg-[#3a3530] text-[#ece3d0] border border-[#3a3530] rounded text-xs font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#c9a04e] hover:bg-[#c9a04e]/90 text-[#131211] font-bold rounded-xl text-xs font-semibold shadow-md shadow-black/50 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isEditingScene ? 'Salvar Alterações' : 'Criar Cena'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Adicionar Token no Mapa */}
      {showAddTokenModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1a1816] border border-[#2c2825] rounded-xl w-full max-w-md p-6 shadow-sm backdrop-blur-md">
            <div className="flex items-center justify-between pb-3 border-b border-[#2c2825] mb-4">
              <h3 className="font-bold text-base text-white">Posicionar Token no Mapa</h3>
              <button onClick={() => setShowAddTokenModal(false)} className="text-[#8a8578] hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddToken} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[#ece3d0] block mb-1">
                  Vincular a Personagem da Campanha
                </label>
                <select
                  value={tokenFormCharId}
                  onChange={(e) => {
                    setTokenFormCharId(e.target.value);
                    const match = characters.find(c => c.id === e.target.value);
                    if (match) {
                      setTokenFormName(match.name);
                      setTokenFormAvatar(match.avatar_url || '');
                    }
                  }}
                  className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a04e]"
                >
                  <option value="">Token Avulso (Monstro / NPC)</option>
                  {characters
                    .filter(c => isMaster || c.user_id === user.id)
                    .map(char => (
                      <option key={char.id} value={char.id}>
                        {char.name} ({char.is_npc ? 'NPC' : 'Personagem'})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[#ece3d0] block mb-1">Nome do Token</label>
                <input
                  type="text"
                  required
                  value={tokenFormName}
                  onChange={(e) => setTokenFormName(e.target.value)}
                  placeholder="Nome do Token"
                  className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a04e]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#ece3d0] block mb-1">URL do Avatar / Token (Opcional)</label>
                <input
                  type="url"
                  value={tokenFormAvatar}
                  onChange={(e) => setTokenFormAvatar(e.target.value)}
                  placeholder="https://exemplo.com/avatar.png"
                  className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a04e]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#ece3d0] block mb-1">Tamanho (Quadrados)</label>
                  <select
                    value={tokenFormSize}
                    onChange={(e) => setTokenFormSize(parseFloat(e.target.value))}
                    className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a04e]"
                  >
                    <option value="0.5">0.5x0.5 (Miúdo / 0.5x)</option>
                    <option value="1">1x1 (Médio / Padrão - 1x)</option>
                    <option value="1.5">1.5x1.5 (Grande Leve - 1.5x)</option>
                    <option value="2">2x2 (Grande / 2x)</option>
                    <option value="3">3x3 (Enorme / 3x)</option>
                    <option value="4">4x4 (Colossal / 4x)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-[#ece3d0] block mb-1">Cor do Anel</label>
                  <input
                    type="color"
                    value={tokenFormColor}
                    onChange={(e) => setTokenFormColor(e.target.value)}
                    className="w-full h-10 bg-[#131211] border border-[#2c2825] rounded-xl px-2 py-1 cursor-pointer"
                  />
                </div>
              </div>

              {/* Atributos Mecânicos e Defensivos do Token / NPC */}
              <div className="pt-2 border-t border-[#2c2825] space-y-3">
                <h4 className="text-xs font-bold text-[#c9a04e] uppercase tracking-wider">
                  Estatísticas de Combate e Defesas
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-[#ece3d0] block mb-1">Defesa (CA)</label>
                    <input
                      type="number"
                      value={tokenNpcDefense}
                      onChange={(e) => setTokenNpcDefense(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a04e]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#ece3d0] block mb-1">Redução de Dano (RD)</label>
                    <input
                      type="number"
                      value={tokenNpcDR}
                      onChange={(e) => setTokenNpcDR(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a04e]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-[#ece3d0] block mb-1">PV Atual</label>
                    <input
                      type="number"
                      value={tokenNpcHp}
                      onChange={(e) => setTokenNpcHp(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a04e]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#ece3d0] block mb-1">PV Máximo</label>
                    <input
                      type="number"
                      value={tokenNpcMaxHp}
                      onChange={(e) => setTokenNpcMaxHp(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a04e]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-[#ece3d0] block mb-1">Fórmula de Iniciativa</label>
                  <input
                    type="text"
                    value={tokenNpcInitiativeFormula}
                    onChange={(e) => setTokenNpcInitiativeFormula(e.target.value)}
                    placeholder="ex: 1d20+2"
                    className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a04e]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#8a8578] block mb-0.5">Resistências (50%)</label>
                    <input
                      type="text"
                      value={tokenNpcResistances}
                      onChange={(e) => setTokenNpcResistances(e.target.value)}
                      placeholder="fogo, corte"
                      className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#c9a04e]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-[#8a8578] block mb-0.5">Vulnerabilidades (2x)</label>
                    <input
                      type="text"
                      value={tokenNpcVulnerabilities}
                      onChange={(e) => setTokenNpcVulnerabilities(e.target.value)}
                      placeholder="frio"
                      className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#c9a04e]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-[#8a8578] block mb-0.5">Imunidades (0)</label>
                    <input
                      type="text"
                      value={tokenNpcImmunities}
                      onChange={(e) => setTokenNpcImmunities(e.target.value)}
                      placeholder="veneno"
                      className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#c9a04e]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#2c2825]">
                <button
                  type="button"
                  onClick={() => setShowAddTokenModal(false)}
                  className="px-4 py-2 bg-[#2c2825] hover:bg-[#3a3530] text-[#ece3d0] border border-[#3a3530] rounded text-xs font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#c9a04e] hover:bg-[#c9a04e]/90 text-[#131211] font-bold rounded-xl text-xs font-semibold shadow-md shadow-black/50 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Posicionar no Mapa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Configurar / Editar Token & Defesas do NPC */}
      {showEditTokenModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1a1816] border border-[#2c2825] rounded-xl w-full max-w-md p-6 shadow-sm backdrop-blur-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#2c2825] mb-4">
              <h3 className="font-bold text-base text-white">Configurar Token / Estatísticas do NPC</h3>
              <button onClick={() => setShowEditTokenModal(false)} className="text-[#8a8578] hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditToken} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[#ece3d0] block mb-1">Nome do Token</label>
                <input
                  type="text"
                  required
                  value={editTokenForm.name}
                  onChange={(e) => setEditTokenForm({ ...editTokenForm, name: e.target.value })}
                  className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a04e]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#ece3d0] block mb-1">Tamanho (Quadrados)</label>
                  <select
                    value={editTokenForm.size}
                    onChange={(e) => setEditTokenForm({ ...editTokenForm, size: parseFloat(e.target.value) })}
                    className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a04e]"
                  >
                    <option value="0.5">0.5x0.5 (Miúdo / 0.5x)</option>
                    <option value="1">1x1 (Médio / Padrão - 1x)</option>
                    <option value="1.5">1.5x1.5 (Grande Leve - 1.5x)</option>
                    <option value="2">2x2 (Grande / 2x)</option>
                    <option value="3">3x3 (Enorme / 3x)</option>
                    <option value="4">4x4 (Colossal / 4x)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-[#ece3d0] block mb-1">Cor do Anel</label>
                  <input
                    type="color"
                    value={editTokenForm.color}
                    onChange={(e) => setEditTokenForm({ ...editTokenForm, color: e.target.value })}
                    className="w-full h-10 bg-[#131211] border border-[#2c2825] rounded-xl px-2 py-1 cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-[#2c2825] space-y-3">
                <h4 className="text-xs font-bold text-[#c9a04e] uppercase tracking-wider">
                  Estatísticas de Combate e Defesas
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-[#ece3d0] block mb-1">Defesa (CA)</label>
                    <input
                      type="number"
                      value={editTokenForm.defense}
                      onChange={(e) => setEditTokenForm({ ...editTokenForm, defense: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a04e]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#ece3d0] block mb-1">Redução de Dano (RD)</label>
                    <input
                      type="number"
                      value={editTokenForm.damage_reduction}
                      onChange={(e) => setEditTokenForm({ ...editTokenForm, damage_reduction: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a04e]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-[#ece3d0] block mb-1">PV Atual</label>
                    <input
                      type="number"
                      value={editTokenForm.current_hp}
                      onChange={(e) => setEditTokenForm({ ...editTokenForm, current_hp: parseInt(e.target.value, 10) || 0 })}
                      className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a04e]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#ece3d0] block mb-1">PV Máximo</label>
                    <input
                      type="number"
                      value={editTokenForm.max_hp}
                      onChange={(e) => setEditTokenForm({ ...editTokenForm, max_hp: parseInt(e.target.value, 10) || 0 })}
                      className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a04e]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-[#ece3d0] block mb-1">Fórmula de Iniciativa</label>
                  <input
                    type="text"
                    value={editTokenForm.initiative_formula}
                    onChange={(e) => setEditTokenForm({ ...editTokenForm, initiative_formula: e.target.value })}
                    placeholder="ex: 1d20+2"
                    className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a04e]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-[#8a8578] block mb-0.5">Resistências (50%)</label>
                    <input
                      type="text"
                      value={editTokenForm.resistances}
                      onChange={(e) => setEditTokenForm({ ...editTokenForm, resistances: e.target.value })}
                      placeholder="fogo, corte"
                      className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#c9a04e]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-[#8a8578] block mb-0.5">Vulnerabilidades (2x)</label>
                    <input
                      type="text"
                      value={editTokenForm.vulnerabilities}
                      onChange={(e) => setEditTokenForm({ ...editTokenForm, vulnerabilities: e.target.value })}
                      placeholder="frio"
                      className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#c9a04e]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-[#8a8578] block mb-0.5">Imunidades (0)</label>
                    <input
                      type="text"
                      value={editTokenForm.immunities}
                      onChange={(e) => setEditTokenForm({ ...editTokenForm, immunities: e.target.value })}
                      placeholder="veneno"
                      className="w-full bg-[#131211] border border-[#2c2825] rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#c9a04e]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#2c2825]">
                <button
                  type="button"
                  onClick={() => setShowEditTokenModal(false)}
                  className="px-4 py-2 bg-[#2c2825] hover:bg-[#3a3530] text-[#ece3d0] border border-[#3a3530] rounded text-xs font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#c9a04e] hover:bg-[#c9a04e]/90 text-[#131211] font-bold rounded-xl text-xs font-semibold shadow-md shadow-black/50 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
