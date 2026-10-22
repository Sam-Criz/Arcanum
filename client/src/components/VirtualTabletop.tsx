import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Scene, Token, CombatEncounter, Character, Campaign, User, api 
} from '../services/api';
import { CombatTracker } from './CombatTracker';
import { 
  ZoomIn, ZoomOut, RotateCcw, Grid, Eye, EyeOff, Lock, Unlock, 
  Plus, Settings, Trash2, Swords, Layers, X, Maximize2, Undo
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
  const [showSceneModal, setShowSceneModal] = useState(false);
  const [showAddTokenModal, setShowAddTokenModal] = useState(false);
  const [showEditTokenModal, setShowEditTokenModal] = useState(false);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [isEditingScene, setIsEditingScene] = useState(false);

  // Fog of war mode (GM only)
  const [fogMode, setFogMode] = useState<'view' | 'hide' | 'reveal'>('view');
  const [fogDragStart, setFogDragStart] = useState<{ x: number; y: number } | null>(null);
  const [currentFogRect, setCurrentFogRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

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
  const [tokenFormColor, setTokenFormColor] = useState('#4f46e5');
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
    color: '#4f46e5',
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

    // 4. Combate
    else if (type.startsWith('combat:')) {
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
  }, []);

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
          alert(`Não foi possível mover o token: ${err.message}`);
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
      alert('Você não tem permissão para mover o token de outro participante.');
      return;
    }
    if (token.is_locked && !isMaster) {
      alert('Este token está bloqueado pelo mestre.');
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
      alert(`Erro ao salvar cena: ${err.message}`);
    }
  };

  const handleActivateScene = async (sceneId: string) => {
    try {
      const activated = await api.setActiveScene(campaign.id, sceneId);
      setActiveScene(activated);
      setScenes(prev => prev.map(s => ({ ...s, is_active: s.id === sceneId })));
    } catch (err: any) {
      alert(`Erro ao ativar cena: ${err.message}`);
    }
  };

  const handleDeleteScene = async (sceneId: string) => {
    if (!confirm('Deseja excluir permanentemente esta cena e todos os seus tokens?')) return;
    try {
      await api.deleteScene(campaign.id, sceneId);
      const res = await api.getScenes(campaign.id);
      setScenes(res.scenes);
      setActiveScene(res.activeScene);
    } catch (err: any) {
      alert(`Erro ao excluir cena: ${err.message}`);
    }
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
      alert(`Erro ao adicionar token: ${err.message}`);
    }
  };

  const openEditTokenModal = (token: Token) => {
    const npc = token.npc_data || {};
    setEditTokenForm({
      id: token.id,
      name: token.name,
      size: token.size,
      color: token.color || '#4f46e5',
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
      alert(`Erro ao atualizar token: ${err.message}`);
    }
  };

  const handleDeleteToken = async (tokenId: string) => {
    if (!confirm('Remover token do mapa?')) return;
    try {
      await api.deleteToken(campaign.id, tokenId);
      setTokens(prev => prev.filter(t => t.id !== tokenId));
      if (selectedToken?.id === tokenId) setSelectedToken(null);
    } catch (err: any) {
      alert(`Erro ao remover token: ${err.message}`);
    }
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
      alert(`Erro ao alterar visibilidade: ${err.message}`);
    }
  };

  const handleToggleTokenLock = async (token: Token) => {
    try {
      const updated = await api.updateToken(campaign.id, token.id, { is_locked: !token.is_locked });
      setTokens(prev => prev.map(t => t.id === token.id ? updated : t));
      setSelectedToken(updated);
    } catch (err: any) {
      alert(`Erro ao alterar travamento: ${err.message}`);
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
      alert(`Erro ao alterar tamanho do token: ${err.message}`);
    }
  };

  const gridSize = activeScene?.grid_size || 50;
  const mapWidth = activeScene?.width || 2000;
  const mapHeight = activeScene?.height || 2000;

  return (
    <div className="relative w-full h-[760px] bg-slate-950/80 backdrop-blur-md border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col select-none">
      {/* BARRA SUPERIOR DE FERRAMENTAS DO VTT */}
      <div className="h-14 bg-slate-900/70 border-b border-slate-800/80 px-4 flex items-center justify-between z-20 backdrop-blur-md">
        {/* Seletor de Cenas */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            {isMaster ? (
              <select
                value={activeScene?.id || ''}
                onChange={(e) => {
                  const match = scenes.find(s => s.id === e.target.value);
                  if (match) {
                    setActiveScene(match);
                    localStorage.setItem(`arcanum_active_scene_${campaign.id}`, match.id);
                  }
                }}
                className="bg-slate-950/90 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500 transition-all duration-200"
              >
                {scenes.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.is_active ? '★ (Ativa)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs font-bold text-white bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-700/80">
                {activeScene ? activeScene.name : 'Nenhuma Cena Ativa'}
              </span>
            )}
          </div>

          {/* Botões administrativos do Mestre */}
          {isMaster && (
            <div className="flex items-center space-x-1 pl-2 border-l border-slate-800/80">
              <button
                onClick={handleOpenCreateScene}
                title="Nova Cena"
                className="p-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-xl text-xs transition-all duration-200 hover:scale-[1.05] active:scale-[0.95]"
              >
                <Plus className="w-4 h-4" />
              </button>

              {activeScene && (
                <>
                  <button
                    onClick={() => handleOpenEditScene(activeScene)}
                    title="Configurar Cena"
                    className="p-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-xl text-xs transition-all duration-200 hover:scale-[1.05] active:scale-[0.95]"
                  >
                    <Settings className="w-4 h-4" />
                  </button>

                  {!activeScene.is_active && (
                    <button
                      onClick={() => handleActivateScene(activeScene.id)}
                      title="Ativar para Jogadores"
                      className="px-2.5 py-1 bg-amber-600/90 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      Ativar Mesa
                    </button>
                  )}

                  {scenes.length > 1 && (
                    <button
                      onClick={() => handleDeleteScene(activeScene.id)}
                      title="Excluir Cena"
                      className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 rounded-xl text-xs transition-all duration-200 hover:scale-[1.05] active:scale-[0.95]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Ferramentas de Visualização e Modos */}
        <div className="flex items-center space-x-2">
          {/* Toggle de Fog of War (Mestre) */}
          {isMaster && activeScene && (
            <div className="flex items-center bg-slate-950/80 rounded-xl border border-slate-800/80 p-0.5 space-x-0.5 backdrop-blur-sm">
              <button
                onClick={() => setFogMode('view')}
                className={`px-2 py-1 text-xs rounded-lg font-medium transition-all duration-200 ${
                  fogMode === 'view' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Modo Navegação e Mover"
              >
                Mover
              </button>
              <button
                onClick={() => setFogMode('hide')}
                className={`px-2 py-1 text-xs rounded-lg font-medium transition-all duration-200 ${
                  fogMode === 'hide' ? 'bg-rose-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-rose-300'
                }`}
                title="Arrastar no mapa para ocultar área com névoa"
              >
                + Ocultar
              </button>
              <button
                onClick={() => setFogMode('reveal')}
                className={`px-2 py-1 text-xs rounded-lg font-medium transition-all duration-200 ${
                  fogMode === 'reveal' ? 'bg-emerald-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-emerald-300'
                }`}
                title="Arrastar no mapa para revelar área (abrir buraco na névoa)"
              >
                - Revelar
              </button>
              <button
                onClick={handleFogHideAll}
                className="px-1.5 py-1 text-[11px] text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded-lg transition-all duration-150"
                title="Ocultar todo o mapa de uma vez"
              >
                Ocultar Tudo
              </button>
              <button
                onClick={handleFogRevealAll}
                className="px-1.5 py-1 text-[11px] text-slate-400 hover:text-emerald-400 hover:bg-slate-900 rounded-lg transition-all duration-150"
                title="Revelar todo o mapa para os jogadores"
              >
                Revelar Tudo
              </button>
              {activeScene.fog_data && activeScene.fog_data.length > 0 && (
                <button
                  onClick={handleFogUndo}
                  className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-900 rounded"
                  title="Desfazer última alteração de névoa"
                >
                  <Undo className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Botão Adicionar Token */}
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
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-indigo-600/30"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Token</span>
            </button>
          )}

          {/* Toggle Grade */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            title="Alternar Grade"
            className={`p-1.5 rounded-xl border transition-all duration-200 hover:scale-[1.05] active:scale-[0.95] ${
              showGrid 
                ? 'bg-indigo-950/60 text-indigo-400 border-indigo-600/50' 
                : 'bg-slate-800/80 text-slate-400 border-slate-700/80 hover:text-white'
            }`}
          >
            <Grid className="w-4 h-4" />
          </button>

          {/* Botão Enquadrar Mapa (Fit to Screen) */}
          <button
            onClick={fitToScreen}
            title="Enquadrar Mapa (Centralizar e Ajustar Visão)"
            className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center space-x-1 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Enquadrar</span>
          </button>

          {/* Controles de Zoom */}
          <div className="flex items-center space-x-1 bg-slate-950/80 border border-slate-800/80 rounded-xl p-0.5 backdrop-blur-sm">
            <button
              onClick={() => handleZoom(-0.1)}
              title="Diminuir Zoom"
              className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-slate-300 w-10 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => handleZoom(0.1)}
              title="Aumentar Zoom"
              className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={resetView}
              title="Redefinir Visão (100%)"
              className="p-1 text-slate-400 hover:text-white rounded-lg border-l border-slate-800/80 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Botão de Alternar Painel de Combate */}
          <button
            onClick={() => setShowCombatDock(!showCombatDock)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border ${
              showCombatDock
                ? 'bg-gradient-to-r from-rose-600 to-indigo-600 text-white border-transparent shadow-md'
                : 'bg-slate-800/80 text-slate-300 border-slate-700/80 hover:text-white'
            }`}
          >
            <Swords className="w-4 h-4 text-amber-400" />
            <span>Combate</span>
            {combatEncounter && combatEncounter.status === 'active' && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
            )}
          </button>
        </div>
      </div>

      {/* ÁREA CENTRAL: MAPA / VIEWPORT INTERATIVO */}
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
        className={`flex-1 relative overflow-hidden bg-slate-950 ${
          fogMode !== 'view' ? 'cursor-crosshair' : isPanning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
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
              <div className="w-full h-full bg-slate-900 border-2 border-dashed border-rose-800/60 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
                <Layers className="w-12 h-12 text-rose-500/60 mb-2" />
                <p className="text-slate-300 font-bold text-sm">Não foi possível carregar a imagem de fundo.</p>
                <p className="text-slate-500 text-xs mt-1">Verifique a URL ou substitua a imagem nas configurações da cena.</p>
              </div>
            ) : (
              <div className="w-full h-full bg-slate-900 border-2 border-slate-800 flex items-center justify-center pointer-events-none">
                <span className="text-slate-600 text-sm font-bold tracking-wider uppercase">
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
                    isSelected ? 'ring-2 ring-indigo-400 z-20' : isOwner ? 'ring-1 ring-emerald-400/80 z-10' : 'z-10'
                  } ${isCombatTurn ? 'ring-4 ring-amber-400 animate-pulse z-20' : ''}`}
                >
                  {/* Token Body / Ring com proporção 1:1 rigorosa sem distorção */}
                  <div 
                    style={{ borderColor: token.color || '#4f46e5' }}
                    className={`w-full h-full rounded-full border-2 overflow-hidden shadow-2xl relative bg-slate-900 flex items-center justify-center transition-transform ${
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
                      <div className="w-full h-full flex items-center justify-center bg-indigo-950 font-bold text-white text-xs select-none">
                        {token.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    {/* Status icons: Bloqueado / Oculto */}
                    {token.is_locked && (
                      <div className="absolute top-1 right-1 bg-black/80 p-0.5 rounded-full text-amber-400 shadow">
                        <Lock className="w-2.5 h-2.5" />
                      </div>
                    )}
                    {!token.is_visible && (
                      <div className="absolute bottom-1 right-1 bg-black/80 p-0.5 rounded-full text-rose-400 shadow">
                        <EyeOff className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>

                  {/* Barra de Vida Flutuante sobre o Token */}
                  {((token.current_hp !== null && token.max_hp && token.max_hp > 0) || (token.hp_percent !== undefined && token.hp_percent !== null)) && (
                    <div className="absolute -top-3 w-full px-1 pointer-events-none">
                      <div className="w-full h-1.5 bg-slate-950/90 rounded-full overflow-hidden border border-slate-700 shadow">
                        {(() => {
                          const pct = token.hp_percent ?? Math.round(((token.current_hp || 0) / (token.max_hp || 1)) * 100);
                          const barColor = pct <= 25 ? 'bg-rose-500' : pct <= 50 ? 'bg-amber-500' : 'bg-emerald-500';
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
                  <div className="absolute -bottom-4 bg-slate-950/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-800 whitespace-nowrap pointer-events-none shadow-md max-w-[120px] truncate">
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
                  fill={isMaster ? 'rgba(5, 8, 22, 0.72)' : '#050816'}
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
                          stroke={isHide ? '#f43f5e' : '#10b981'}
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
                    ? 'border-rose-500 bg-rose-950/40'
                    : 'border-emerald-500 bg-emerald-950/40'
                }`}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm">
            <Layers className="w-12 h-12 text-slate-700 mb-3" />
            <p className="font-semibold text-slate-400">Nenhuma cena criada nesta campanha.</p>
            {isMaster && (
              <button
                onClick={handleOpenCreateScene}
                className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg"
              >
                + Criar Primeira Cena
              </button>
            )}
          </div>
        )}

        {/* POPOVER DE TOKEN SELECIONADO COM CONTROLES DE TAMANHO */}
        {selectedToken && (
          <div className="absolute bottom-4 left-4 z-40 bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3 shadow-2xl backdrop-blur-md flex items-center space-x-3 max-w-md transition-all duration-300">
            <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-800 border border-slate-700/80 shrink-0 flex items-center justify-center">
              {selectedToken.avatar_url ? (
                <img src={selectedToken.avatar_url} alt={selectedToken.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white bg-indigo-950">
                  {selectedToken.name.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-white truncate">{selectedToken.name}</h4>
              <p className="text-[10px] text-slate-400 truncate">
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
                  <span className="text-[10px] text-slate-400 font-semibold">Tamanho:</span>
                  <div className="flex items-center bg-slate-950/80 border border-slate-700/80 rounded-lg overflow-hidden">
                    <button
                      onClick={() => handleResizeToken(selectedToken, -0.5)}
                      disabled={selectedToken.size <= 0.5}
                      title="Diminuir tamanho do token"
                      className="px-1.5 py-0.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 transition-colors"
                    >
                      -
                    </button>
                    <span className="px-1.5 text-[11px] font-mono font-bold text-indigo-400">
                      {selectedToken.size}x
                    </span>
                    <button
                      onClick={() => handleResizeToken(selectedToken, 0.5)}
                      disabled={selectedToken.size >= 4}
                      title="Aumentar tamanho do token"
                      className="px-1.5 py-0.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 transition-colors"
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
                  className="p-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-xl text-xs transition-all duration-200 hover:scale-[1.05] active:scale-[0.95]"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleToggleTokenVisibility(selectedToken)}
                  title={selectedToken.is_visible ? "Ocultar dos Jogadores" : "Revelar aos Jogadores"}
                  className="p-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 rounded-xl text-xs transition-all duration-200 hover:scale-[1.05] active:scale-[0.95]"
                >
                  {selectedToken.is_visible ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-rose-400" />}
                </button>
                <button
                  onClick={() => handleToggleTokenLock(selectedToken)}
                  title={selectedToken.is_locked ? "Destravar Movimentação" : "Travar Movimentação"}
                  className="p-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 rounded-xl text-xs transition-all duration-200 hover:scale-[1.05] active:scale-[0.95]"
                >
                  {selectedToken.is_locked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5 text-slate-400" />}
                </button>
                <button
                  onClick={() => handleDeleteToken(selectedToken.id)}
                  title="Remover do Mapa"
                  className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 rounded-xl text-xs transition-all duration-200 hover:scale-[1.05] active:scale-[0.95]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <button
              onClick={() => setSelectedToken(null)}
              className="text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
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
            />
          </div>
        )}
      </div>

      {/* MODAL: Criar / Editar Cena */}
      {showSceneModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl w-full max-w-lg p-6 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
              <h3 className="font-bold text-base text-white">
                {isEditingScene ? 'Configurações da Cena' : 'Nova Cena do Mapa'}
              </h3>
              <button onClick={() => setShowSceneModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveScene} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Nome da Cena</label>
                <input
                  type="text"
                  required
                  value={sceneForm.name}
                  onChange={(e) => setSceneForm({ ...sceneForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">URL da Imagem de Fundo</label>
                <div className="flex space-x-2">
                  <input
                    type="url"
                    placeholder="https://exemplo.com/mapa.jpg"
                    value={sceneForm.image_url}
                    onChange={(e) => {
                      setSceneForm({ ...sceneForm, image_url: e.target.value });
                      detectImageDimensions(e.target.value);
                    }}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => detectImageDimensions(sceneForm.image_url)}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold whitespace-nowrap"
                    title="Detectar resolução nativa da imagem"
                  >
                    Detectar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Tamanho da Grade (px)</label>
                  <input
                    type="number"
                    min="20"
                    max="200"
                    value={sceneForm.grid_size}
                    onChange={(e) => setSceneForm({ ...sceneForm, grid_size: parseInt(e.target.value, 10) || 50 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Escala da Grade (m / ft)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={sceneForm.grid_scale}
                    onChange={(e) => setSceneForm({ ...sceneForm, grid_scale: parseFloat(e.target.value) || 1.5 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Largura do Mapa (px)</label>
                  <input
                    type="number"
                    min="500"
                    max="10000"
                    value={sceneForm.width}
                    onChange={(e) => setSceneForm({ ...sceneForm, width: parseInt(e.target.value, 10) || 2000 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Altura do Mapa (px)</label>
                  <input
                    type="number"
                    min="500"
                    max="10000"
                    value={sceneForm.height}
                    onChange={(e) => setSceneForm({ ...sceneForm, height: parseInt(e.target.value, 10) || 2000 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-6 pt-1">
                <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sceneForm.fog_enabled}
                    onChange={(e) => setSceneForm({ ...sceneForm, fog_enabled: e.target.checked })}
                    className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <span>Ativar Camada de Fog of War (Áreas Ocultas)</span>
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowSceneModal(false)}
                  className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
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
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl w-full max-w-md p-6 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
              <h3 className="font-bold text-base text-white">Posicionar Token no Mapa</h3>
              <button onClick={() => setShowAddTokenModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddToken} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
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
                <label className="text-xs font-medium text-slate-300 block mb-1">Nome do Token</label>
                <input
                  type="text"
                  required
                  value={tokenFormName}
                  onChange={(e) => setTokenFormName(e.target.value)}
                  placeholder="Nome do Token"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">URL do Avatar / Token (Opcional)</label>
                <input
                  type="url"
                  value={tokenFormAvatar}
                  onChange={(e) => setTokenFormAvatar(e.target.value)}
                  placeholder="https://exemplo.com/avatar.png"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Tamanho (Quadrados)</label>
                  <select
                    value={tokenFormSize}
                    onChange={(e) => setTokenFormSize(parseFloat(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
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
                  <label className="text-xs font-medium text-slate-300 block mb-1">Cor do Anel</label>
                  <input
                    type="color"
                    value={tokenFormColor}
                    onChange={(e) => setTokenFormColor(e.target.value)}
                    className="w-full h-10 bg-slate-950 border border-slate-800 rounded-xl px-2 py-1 cursor-pointer"
                  />
                </div>
              </div>

              {/* Atributos Mecânicos e Defensivos do Token / NPC */}
              <div className="pt-2 border-t border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                  Estatísticas de Combate e Defesas
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">Defesa (CA)</label>
                    <input
                      type="number"
                      value={tokenNpcDefense}
                      onChange={(e) => setTokenNpcDefense(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">Redução de Dano (RD)</label>
                    <input
                      type="number"
                      value={tokenNpcDR}
                      onChange={(e) => setTokenNpcDR(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">PV Atual</label>
                    <input
                      type="number"
                      value={tokenNpcHp}
                      onChange={(e) => setTokenNpcHp(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">PV Máximo</label>
                    <input
                      type="number"
                      value={tokenNpcMaxHp}
                      onChange={(e) => setTokenNpcMaxHp(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Fórmula de Iniciativa</label>
                  <input
                    type="text"
                    value={tokenNpcInitiativeFormula}
                    onChange={(e) => setTokenNpcInitiativeFormula(e.target.value)}
                    placeholder="ex: 1d20+2"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 block mb-0.5">Resistências (50%)</label>
                    <input
                      type="text"
                      value={tokenNpcResistances}
                      onChange={(e) => setTokenNpcResistances(e.target.value)}
                      placeholder="fogo, corte"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 block mb-0.5">Vulnerabilidades (2x)</label>
                    <input
                      type="text"
                      value={tokenNpcVulnerabilities}
                      onChange={(e) => setTokenNpcVulnerabilities(e.target.value)}
                      placeholder="frio"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 block mb-0.5">Imunidades (0)</label>
                    <input
                      type="text"
                      value={tokenNpcImmunities}
                      onChange={(e) => setTokenNpcImmunities(e.target.value)}
                      placeholder="veneno"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowAddTokenModal(false)}
                  className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
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
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl w-full max-w-md p-6 shadow-2xl backdrop-blur-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
              <h3 className="font-bold text-base text-white">Configurar Token / Estatísticas do NPC</h3>
              <button onClick={() => setShowEditTokenModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditToken} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Nome do Token</label>
                <input
                  type="text"
                  required
                  value={editTokenForm.name}
                  onChange={(e) => setEditTokenForm({ ...editTokenForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Tamanho (Quadrados)</label>
                  <select
                    value={editTokenForm.size}
                    onChange={(e) => setEditTokenForm({ ...editTokenForm, size: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
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
                  <label className="text-xs font-medium text-slate-300 block mb-1">Cor do Anel</label>
                  <input
                    type="color"
                    value={editTokenForm.color}
                    onChange={(e) => setEditTokenForm({ ...editTokenForm, color: e.target.value })}
                    className="w-full h-10 bg-slate-950 border border-slate-800 rounded-xl px-2 py-1 cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                  Estatísticas de Combate e Defesas
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">Defesa (CA)</label>
                    <input
                      type="number"
                      value={editTokenForm.defense}
                      onChange={(e) => setEditTokenForm({ ...editTokenForm, defense: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">Redução de Dano (RD)</label>
                    <input
                      type="number"
                      value={editTokenForm.damage_reduction}
                      onChange={(e) => setEditTokenForm({ ...editTokenForm, damage_reduction: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">PV Atual</label>
                    <input
                      type="number"
                      value={editTokenForm.current_hp}
                      onChange={(e) => setEditTokenForm({ ...editTokenForm, current_hp: parseInt(e.target.value, 10) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">PV Máximo</label>
                    <input
                      type="number"
                      value={editTokenForm.max_hp}
                      onChange={(e) => setEditTokenForm({ ...editTokenForm, max_hp: parseInt(e.target.value, 10) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Fórmula de Iniciativa</label>
                  <input
                    type="text"
                    value={editTokenForm.initiative_formula}
                    onChange={(e) => setEditTokenForm({ ...editTokenForm, initiative_formula: e.target.value })}
                    placeholder="ex: 1d20+2"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 block mb-0.5">Resistências (50%)</label>
                    <input
                      type="text"
                      value={editTokenForm.resistances}
                      onChange={(e) => setEditTokenForm({ ...editTokenForm, resistances: e.target.value })}
                      placeholder="fogo, corte"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 block mb-0.5">Vulnerabilidades (2x)</label>
                    <input
                      type="text"
                      value={editTokenForm.vulnerabilities}
                      onChange={(e) => setEditTokenForm({ ...editTokenForm, vulnerabilities: e.target.value })}
                      placeholder="frio"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 block mb-0.5">Imunidades (0)</label>
                    <input
                      type="text"
                      value={editTokenForm.immunities}
                      onChange={(e) => setEditTokenForm({ ...editTokenForm, immunities: e.target.value })}
                      placeholder="veneno"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowEditTokenModal(false)}
                  className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
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
