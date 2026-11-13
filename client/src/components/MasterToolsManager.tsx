import React, { useState, useEffect } from 'react';
import { 
  CloudRain, Zap, Eye, EyeOff, Lock, Unlock, Share2, 
  Trash2, Plus, Play, Calendar, 
  Sparkles, RefreshCw
} from 'lucide-react';
import { 
  EnvironmentalCondition, CampaignEvent, MasterNote, 
  EntityRevelation, api, Campaign, User 
} from '../services/api';
import { useNotification } from './NotificationProvider';

interface MasterToolsManagerProps {
  campaign: Campaign;
  user: User;
  isMaster: boolean;
  activeSceneId?: string | null;
}

export const MasterToolsManager: React.FC<MasterToolsManagerProps> = ({
  campaign,
  user: _user,
  isMaster,
  activeSceneId
}) => {
  const notify = useNotification();
  const [subTab, setSubTab] = useState<'environmental' | 'events' | 'notes' | 'revelations'>('environmental');

  // Estados de dados
  const [conditions, setConditions] = useState<EnvironmentalCondition[]>([]);
  const [events, setEvents] = useState<CampaignEvent[]>([]);
  const [notes, setNotes] = useState<MasterNote[]>([]);
  const [revelations, setRevelations] = useState<EntityRevelation[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [creatures, setCreatures] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Estados de modais
  const [showConditionModal, setShowConditionModal] = useState(false);
  const [conditionForm, setConditionForm] = useState({
    name: '',
    description: '',
    icon: 'cloud-rain',
    is_active: true,
    is_visible_to_players: true,
    duration_rounds: 3,
    formula: ''
  });

  const [showEventModal, setShowEventModal] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    event_type: 'manual' as 'manual' | 'scheduled' | 'trigger',
    visibility: 'master_only' as 'master_only' | 'public' | 'targeted',
    target_user_id: '',
    scheduled_at: '',
    action_type: 'none',
    action_message: '',
    action_condition_id: ''
  });

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteForm, setNoteForm] = useState({
    title: '',
    content: '',
    category: 'enredo',
    tags: '',
    is_private: true
  });

  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedNote, setSelectedNote] = useState<MasterNote | null>(null);
  const [sharedUsersList, setSharedUsersList] = useState<string[]>([]);

  const [showRevelationModal, setShowRevelationModal] = useState(false);
  const [revForm, setRevForm] = useState({
    entity_id: '',
    entity_type: 'monster' as 'monster' | 'npc' | 'clue' | 'note',
    target_user_id: '', // vazio = todos
    fields: {
      true_name: true,
      stats: false,
      weakness: false,
      description: true
    }
  });

  // Carregar dados da aba
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [conds, evs, nts, revs] = await Promise.all([
        api.getEnvironmentalConditions(campaign.id, activeSceneId),
        api.getCampaignEvents(campaign.id, activeSceneId),
        api.getMasterNotes(campaign.id),
        isMaster ? api.getEntityRevelations(campaign.id) : Promise.resolve([])
      ]);
      setConditions(conds);
      setEvents(evs);
      setNotes(nts);
      setRevelations(revs);

      if (isMaster) {
        try {
          const [mems, crts] = await Promise.all([
            api.getCampaignMembers(campaign.id),
            api.getBestiary(campaign.id)
          ]);
          setMembers(Array.isArray(mems) ? mems : (mems as any)?.members || []);
          setCreatures(crts);
        } catch {}
      }
    } catch (err: any) {
      notify.error('Erro ao carregar dados', err.message || 'Falha ao buscar ferramentas');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [campaign.id, activeSceneId, isMaster]);

  // Handlers de Condições Ambientais
  const handleCreateCondition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conditionForm.name.trim()) return;

    try {
      const newCond = await api.createEnvironmentalCondition(campaign.id, {
        name: conditionForm.name.trim(),
        description: conditionForm.description.trim(),
        icon: conditionForm.icon,
        is_active: conditionForm.is_active ? 1 : 0,
        is_visible_to_players: conditionForm.is_visible_to_players ? 1 : 0,
        duration_rounds: conditionForm.duration_rounds || null,
        effect_payload: conditionForm.formula.trim() ? { formula: conditionForm.formula.trim() } : null,
        scene_id: activeSceneId || null
      });
      setConditions(prev => [...prev, newCond]);
      setShowConditionModal(false);
      setConditionForm({ name: '', description: '', icon: 'cloud-rain', is_active: true, is_visible_to_players: true, duration_rounds: 3, formula: '' });
      notify.success('Condição criada', `Condição "${newCond.name}" registrada.`);
    } catch (err: any) {
      notify.error('Erro ao criar condição', err.message);
    }
  };

  const handleToggleCondition = async (condId: string, currentActive: number) => {
    try {
      const updated = await api.toggleEnvironmentalCondition(campaign.id, condId, currentActive !== 1);
      setConditions(prev => prev.map(c => c.id === condId ? updated : c));
      notify.info('Condição alterada', `"${updated.name}" agora está ${updated.is_active ? 'Ativa' : 'Inativa'}.`);
    } catch (err: any) {
      notify.error('Erro ao alternar condição', err.message);
    }
  };

  const handleDeleteCondition = (condId: string, name: string) => {
    notify.confirm(`Remover permanentemente a condição ambiental "${name}"?`, async () => {
      try {
        await api.deleteEnvironmentalCondition(campaign.id, condId);
        setConditions(prev => prev.filter(c => c.id !== condId));
        notify.success('Condição removida', `"${name}" excluída.`);
      } catch (err: any) {
        notify.error('Erro ao excluir condição', err.message);
      }
    });
  };

  // Handlers de Eventos
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm.title.trim()) return;

    try {
      const payload: any = {};
      if (eventForm.action_type === 'chat' && eventForm.action_message) {
        payload.action = 'system_chat';
        payload.message = eventForm.action_message;
      } else if (eventForm.action_type === 'condition' && eventForm.action_condition_id) {
        payload.action = 'activate_condition';
        payload.condition_id = eventForm.action_condition_id;
        payload.message = eventForm.action_message;
      }

      const newEv = await api.createCampaignEvent(campaign.id, {
        title: eventForm.title.trim(),
        description: eventForm.description.trim(),
        event_type: eventForm.event_type,
        visibility: eventForm.visibility,
        target_user_ids: eventForm.target_user_id ? [eventForm.target_user_id] : [],
        scheduled_at: eventForm.scheduled_at || null,
        action_payload: Object.keys(payload).length > 0 ? payload : null,
        scene_id: activeSceneId || null
      });

      setEvents(prev => [newEv, ...prev]);
      setShowEventModal(false);
      setEventForm({
        title: '',
        description: '',
        event_type: 'manual',
        visibility: 'master_only',
        target_user_id: '',
        scheduled_at: '',
        action_type: 'none',
        action_message: '',
        action_condition_id: ''
      });
      notify.success('Evento criado', `Evento "${newEv.title}" agendado/preparado.`);
    } catch (err: any) {
      notify.error('Erro ao criar evento', err.message);
    }
  };

  const handleTriggerEvent = async (eventId: string, title: string) => {
    try {
      const res = await api.triggerCampaignEvent(campaign.id, eventId);
      setEvents(prev => prev.map(e => e.id === eventId ? res.event : e));
      notify.success('Evento Disparado!', `"${title}" foi executado com sucesso.`);
      // Se ativou condição, recarrega condições
      if (res.executionResult?.activatedConditionId) {
        const updatedConds = await api.getEnvironmentalConditions(campaign.id, activeSceneId);
        setConditions(updatedConds);
      }
    } catch (err: any) {
      notify.error('Erro ao disparar evento', err.message);
    }
  };

  // Handlers de Notas
  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteForm.title.trim()) return;

    try {
      const tagList = noteForm.tags.split(',').map(t => t.trim()).filter(Boolean);
      const newNote = await api.createMasterNote(campaign.id, {
        title: noteForm.title.trim(),
        content: noteForm.content,
        category: noteForm.category,
        tags: tagList,
        is_private: noteForm.is_private ? 1 : 0,
        scene_id: activeSceneId || null
      });
      setNotes(prev => [newNote, ...prev]);
      setShowNoteModal(false);
      setNoteForm({ title: '', content: '', category: 'enredo', tags: '', is_private: true });
      notify.success('Nota criada', `"${newNote.title}" salva com sucesso.`);
    } catch (err: any) {
      notify.error('Erro ao salvar nota', err.message);
    }
  };

  const handleOpenShareModal = (note: MasterNote) => {
    setSelectedNote(note);
    setSharedUsersList([...note.shared_with_user_ids]);
    setShowShareModal(true);
  };

  const handleSaveShare = async () => {
    if (!selectedNote) return;
    try {
      const updated = await api.shareMasterNote(campaign.id, selectedNote.id, sharedUsersList);
      setNotes(prev => prev.map(n => n.id === selectedNote.id ? updated : n));
      setShowShareModal(false);
      notify.success('Permissões da nota salvas', `Compartilhada com ${sharedUsersList.length} jogador(es).`);
    } catch (err: any) {
      notify.error('Erro ao compartilhar nota', err.message);
    }
  };

  // Handlers de Revelação (Entity Revelations)
  const handleSaveRevelation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revForm.entity_id) return;

    const fieldsList: string[] = [];
    if (revForm.fields.true_name) fieldsList.push('true_name');
    if (revForm.fields.stats) fieldsList.push('stats');
    if (revForm.fields.weakness) fieldsList.push('weakness');
    if (revForm.fields.description) fieldsList.push('description');

    try {
      const rev = await api.revealEntity(campaign.id, {
        entity_type: revForm.entity_type,
        entity_id: revForm.entity_id,
        revealed_to_user_id: revForm.target_user_id || null,
        revealed_fields: fieldsList
      });
      setRevelations(prev => {
        const filtered = prev.filter(r => !(r.entity_id === rev.entity_id && r.revealed_to_user_id === rev.revealed_to_user_id));
        return [...filtered, rev];
      });
      setShowRevelationModal(false);
      notify.success('Revelação Atualizada', 'Informações propagadas instantaneamente via WebSocket.');
    } catch (err: any) {
      notify.error('Erro ao revelar entidade', err.message);
    }
  };

  const handleRevokeRevelation = async (entityType: string, entityId: string, userId?: string | null) => {
    try {
      await api.unrevealEntity(campaign.id, {
        entity_type: entityType,
        entity_id: entityId,
        revealed_to_user_id: userId
      });
      setRevelations(prev => prev.filter(r => !(r.entity_id === entityId && r.revealed_to_user_id === (userId || null))));
      notify.info('Revelação Revogada', 'Dados ocultados novamente.');
    } catch (err: any) {
      notify.error('Erro ao revogar revelação', err.message);
    }
  };

  return (
    <div className="flex-1 bg-[#141716] text-[#ebe7de] flex flex-col h-full overflow-hidden">
      {/* TopBar do Painel do Mestre */}
      <div className="p-4 bg-[#1c201e] border-b border-[#252a27] flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#c86d51]/10 border border-[#c86d51]/30 flex items-center justify-center text-[#c86d51]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-serif text-xl font-bold text-[#ebe7de] flex items-center space-x-2">
              <span>Ferramentas do Mestre</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#c86d51]/20 text-[#c86d51] border border-[#c86d51]/40 uppercase">
                Fase 5
              </span>
            </h2>
            <p className="text-xs text-[#9b9689] font-mono">
              Condições ambientais, agendamento de eventos, notas secretas e matriz de revelação
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="p-2 bg-[#252a27] hover:bg-[#343b37] text-[#ebe7de] rounded-lg transition-colors flex items-center space-x-1.5 text-xs font-mono"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Navegação Secundária da Fase 5 */}
      <div className="flex border-b border-[#252a27] bg-[#1c201e]/60 px-4 shrink-0 text-xs font-mono">
        <button
          onClick={() => setSubTab('environmental')}
          className={`py-3 px-4 font-bold border-b-2 transition-all flex items-center space-x-2 ${
            subTab === 'environmental'
              ? 'border-[#c86d51] text-[#c86d51] bg-[#252a27]/40'
              : 'border-transparent text-[#9b9689] hover:text-[#ebe7de]'
          }`}
        >
          <CloudRain className="w-4 h-4" />
          <span>Condições Ambientais</span>
          <span className="text-[10px] bg-[#252a27] px-1.5 py-0.2 rounded text-[#c86d51]">
            {conditions.length}
          </span>
        </button>

        <button
          onClick={() => setSubTab('events')}
          className={`py-3 px-4 font-bold border-b-2 transition-all flex items-center space-x-2 ${
            subTab === 'events'
              ? 'border-[#c86d51] text-[#c86d51] bg-[#252a27]/40'
              : 'border-transparent text-[#9b9689] hover:text-[#ebe7de]'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Eventos de Cena</span>
          <span className="text-[10px] bg-[#252a27] px-1.5 py-0.2 rounded text-[#c86d51]">
            {events.length}
          </span>
        </button>

        <button
          onClick={() => setSubTab('notes')}
          className={`py-3 px-4 font-bold border-b-2 transition-all flex items-center space-x-2 ${
            subTab === 'notes'
              ? 'border-[#c86d51] text-[#c86d51] bg-[#252a27]/40'
              : 'border-transparent text-[#9b9689] hover:text-[#ebe7de]'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Notas Secretas</span>
          <span className="text-[10px] bg-[#252a27] px-1.5 py-0.2 rounded text-[#c86d51]">
            {notes.length}
          </span>
        </button>

        {isMaster && (
          <button
            onClick={() => setSubTab('revelations')}
            className={`py-3 px-4 font-bold border-b-2 transition-all flex items-center space-x-2 ${
              subTab === 'revelations'
                ? 'border-[#c86d51] text-[#c86d51] bg-[#252a27]/40'
                : 'border-transparent text-[#9b9689] hover:text-[#ebe7de]'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Matriz de Revelação</span>
            <span className="text-[10px] bg-[#252a27] px-1.5 py-0.2 rounded text-[#c86d51]">
              {revelations.length}
            </span>
          </button>
        )}
      </div>

      {/* Conteúdo Scrollável */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* ABA 1: CONDIÇÕES AMBIENTAIS */}
        {subTab === 'environmental' && (
          <div className="space-y-4 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg text-[#ebe7de] font-bold">Condições Ativas no Cenário</h3>
                <p className="text-xs text-[#9b9689] font-mono">
                  Clima, iluminação, terrenos mágicos ou venenos da cena
                </p>
              </div>
              {isMaster && (
                <button
                  onClick={() => setShowConditionModal(true)}
                  className="px-3 py-2 bg-[#c86d51] hover:bg-[#c86d51]/90 text-[#141716] rounded-xl text-xs font-serif font-bold transition-all flex items-center space-x-1.5 shadow-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nova Condição</span>
                </button>
              )}
            </div>

            {conditions.length === 0 ? (
              <div className="p-8 text-center bg-[#1c201e] rounded-xl border border-[#252a27] text-[#9b9689] text-xs">
                Nenhuma condição ambiental ativa ou registrada neste cenário.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {conditions.map(c => {
                  const isMechanical = !!(c.rule_modifier_id || c.effect_payload?.formula);
                  return (
                    <div
                      key={c.id}
                      className={`p-4 rounded-xl border transition-all ${
                        c.is_active
                          ? 'bg-[#1c201e] border-[#c86d51]/40 shadow-lg'
                          : 'bg-[#141716] border-[#252a27] opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-serif text-base font-bold text-[#ebe7de]">
                              {c.name}
                            </span>
                            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                              isMechanical
                                ? 'bg-[#b84a48]/20 text-[#b84a48] border-[#b84a48]/40'
                                : 'bg-[#6d9775]/20 text-[#6d9775] border-[#6d9775]/40'
                            }`}>
                              {isMechanical ? 'Mecânica' : 'Narrativa'}
                            </span>
                          </div>
                          {c.description && (
                            <p className="text-xs text-[#9b9689] mt-1 leading-relaxed">{c.description}</p>
                          )}
                        </div>

                        {isMaster && (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleToggleCondition(c.id, c.is_active)}
                              className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all ${
                                c.is_active
                                  ? 'bg-[#6d9775] text-[#141716]'
                                  : 'bg-[#252a27] text-[#9b9689] hover:text-[#ebe7de]'
                              }`}
                            >
                              {c.is_active ? 'Ativa' : 'Inativa'}
                            </button>
                            <button
                              onClick={() => handleDeleteCondition(c.id, c.name)}
                              className="p-1.5 text-[#9b9689] hover:text-[#b84a48] hover:bg-[#b84a48]/10 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-3 border-t border-[#252a27] flex items-center justify-between text-[11px] font-mono text-[#9b9689]">
                        <span className="flex items-center space-x-1">
                          {c.is_visible_to_players ? (
                            <><Eye className="w-3 h-3 text-[#6d9775]" /><span>Visível a jogadores</span></>
                          ) : (
                            <><EyeOff className="w-3 h-3 text-[#b84a48]" /><span>Oculto do grupo</span></>
                          )}
                        </span>
                        {c.duration_rounds && (
                          <span>Duração: {c.duration_rounds} rodadas</span>
                        )}
                        {c.effect_payload?.formula && (
                          <span className="text-[#c86d51]">Fórmula: {c.effect_payload.formula}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ABA 2: EVENTOS DE CENA */}
        {subTab === 'events' && (
          <div className="space-y-4 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg text-[#ebe7de] font-bold">Eventos e Gatilhos de Campanha</h3>
                <p className="text-xs text-[#9b9689] font-mono">
                  Gatilhos automáticos, armadilhas, desabamentos e revelações
                </p>
              </div>
              {isMaster && (
                <button
                  onClick={() => setShowEventModal(true)}
                  className="px-3 py-2 bg-[#c86d51] hover:bg-[#c86d51]/90 text-[#141716] rounded-xl text-xs font-serif font-bold transition-all flex items-center space-x-1.5 shadow-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novo Evento</span>
                </button>
              )}
            </div>

            {events.length === 0 ? (
              <div className="p-8 text-center bg-[#1c201e] rounded-xl border border-[#252a27] text-[#9b9689] text-xs">
                Nenhum evento registrado nesta campanha.
              </div>
            ) : (
              <div className="space-y-3">
                {events.map(ev => {
                  const isPending = ev.status === 'pending';
                  return (
                    <div
                      key={ev.id}
                      className="p-4 bg-[#1c201e] border border-[#252a27] rounded-xl hover:border-[#343b37] transition-all flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-serif text-base font-bold text-[#c86d51] truncate">{ev.title}</h4>
                          <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                            ev.status === 'triggered'
                              ? 'bg-[#6d9775]/20 text-[#6d9775] border-[#6d9775]/40'
                              : 'bg-[#9b9689]/20 text-[#9b9689] border-[#9b9689]/40'
                          }`}>
                            {ev.status === 'triggered' ? 'Disparado' : 'Pendente'}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#252a27] text-[#ebe7de]">
                            {ev.visibility === 'master_only' ? 'Somente Mestre' : ev.visibility === 'public' ? 'Público' : 'Direcionado'}
                          </span>
                        </div>
                        {ev.description && (
                          <p className="text-xs text-[#9b9689] leading-relaxed truncate">{ev.description}</p>
                        )}
                        {ev.scheduled_at && (
                          <div className="flex items-center space-x-1 text-[11px] font-mono text-[#9b9689]">
                            <Calendar className="w-3 h-3 text-[#c86d51]" />
                            <span>Agendado para: {new Date(ev.scheduled_at).toLocaleString()}</span>
                          </div>
                        )}
                      </div>

                      {isMaster && (
                        <div className="flex items-center space-x-2 shrink-0">
                          {isPending && (
                            <button
                              onClick={() => handleTriggerEvent(ev.id, ev.title)}
                              className="px-3 py-1.5 bg-[#b84a48] hover:bg-[#b84a48]/90 text-[#ebe7de] rounded-lg text-xs font-mono font-bold transition-all flex items-center space-x-1.5 shadow-sm"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Disparar</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ABA 3: NOTAS SECRETAS */}
        {subTab === 'notes' && (
          <div className="space-y-4 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg text-[#ebe7de] font-bold">Anotações e Revelações do Enredo</h3>
                <p className="text-xs text-[#9b9689] font-mono">
                  Pistas, reviravoltas secretas e notas compartilháveis
                </p>
              </div>
              <button
                onClick={() => setShowNoteModal(true)}
                className="px-3 py-2 bg-[#c86d51] hover:bg-[#c86d51]/90 text-[#141716] rounded-xl text-xs font-serif font-bold transition-all flex items-center space-x-1.5 shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova Nota</span>
              </button>
            </div>

            {notes.length === 0 ? (
              <div className="p-8 text-center bg-[#1c201e] rounded-xl border border-[#252a27] text-[#9b9689] text-xs">
                Nenhuma nota confidencial disponível.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {notes.map(n => {
                  return (
                    <div key={n.id} className="p-4 bg-[#1c201e] border border-[#252a27] hover:border-[#343b37] rounded-xl transition-all space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-serif text-base font-bold text-[#c86d51]">{n.title}</h4>
                          <span className="text-[10px] font-mono uppercase text-[#9b9689] block mt-0.5">
                            Categoria: {n.category}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border flex items-center space-x-1 ${
                            n.is_private
                              ? 'bg-[#b84a48]/20 text-[#b84a48] border-[#b84a48]/40'
                              : 'bg-[#6d9775]/20 text-[#6d9775] border-[#6d9775]/40'
                          }`}>
                            {n.is_private ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                            <span>{n.is_private ? 'Privada' : 'Pública'}</span>
                          </span>

                          {isMaster && (
                            <button
                              onClick={() => handleOpenShareModal(n)}
                              title="Compartilhar com jogadores"
                              className="p-1.5 text-[#9b9689] hover:text-[#c86d51] hover:bg-[#c86d51]/10 rounded transition-colors"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-[#ebe7de] font-sans leading-relaxed whitespace-pre-line bg-[#141716] p-3 rounded-lg border border-[#252a27]">
                        {n.content}
                      </p>

                      {n.tags && n.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {n.tags.map((t, i) => (
                            <span key={i} className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#252a27] text-[#9b9689]">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}

                      {n.shared_with_user_ids && n.shared_with_user_ids.length > 0 && (
                        <div className="text-[11px] font-mono text-[#c86d51] pt-2 border-t border-[#252a27]">
                          Compartilhada com {n.shared_with_user_ids.length} jogador(es) específico(s)
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ABA 4: MATRIZ DE REVELAÇÃO (APENAS MESTRE) */}
        {subTab === 'revelations' && isMaster && (
          <div className="space-y-4 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg text-[#ebe7de] font-bold">Matriz de Acesso e Revelação Granular</h3>
                <p className="text-xs text-[#9b9689] font-mono">
                  Controle exatamente quais campos (nome, ficha, fraquezas) cada jogador pode ver
                </p>
              </div>
              <button
                onClick={() => setShowRevelationModal(true)}
                className="px-3 py-2 bg-[#c86d51] hover:bg-[#c86d51]/90 text-[#141716] rounded-xl text-xs font-serif font-bold transition-all flex items-center space-x-1.5 shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova Revelação</span>
              </button>
            </div>

            {revelations.length === 0 ? (
              <div className="p-8 text-center bg-[#1c201e] rounded-xl border border-[#252a27] text-[#9b9689] text-xs">
                Nenhuma revelação granular configurada. Entidades seguem o padrão público ou oculto.
              </div>
            ) : (
              <div className="space-y-3">
                {revelations.map(rev => {
                  const targetUser = members.find(m => (m.userId || m.user_id || m.id) === rev.revealed_to_user_id);
                  const creature = creatures.find(c => c.id === rev.entity_id);
                  return (
                    <div
                      key={rev.id}
                      className="p-4 bg-[#1c201e] border border-[#252a27] rounded-xl flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-serif text-base font-bold text-[#c86d51]">
                            {creature ? creature.name : `Entidade ${rev.entity_id.slice(0, 8)}`}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#252a27] text-[#ebe7de] uppercase">
                            {rev.entity_type}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[#c86d51]/40 text-[#c86d51]">
                            {targetUser ? `Para: ${targetUser.username}` : 'Público para todos'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 text-[11px] font-mono text-[#9b9689] pt-1">
                          <span>Campos revelados:</span>
                          {rev.revealed_fields.map((f, i) => (
                            <span key={i} className="px-1.5 py-0.2 rounded bg-[#252a27] text-[#6d9775] font-bold">
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => handleRevokeRevelation(rev.entity_type, rev.entity_id, rev.revealed_to_user_id)}
                        className="px-2.5 py-1.5 bg-[#b84a48]/20 hover:bg-[#b84a48] text-[#b84a48] hover:text-[#ebe7de] border border-[#b84a48]/40 rounded-lg text-xs font-mono transition-all"
                      >
                        Revogar
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL: NOVA CONDIÇÃO */}
      {showConditionModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleCreateCondition} className="bg-[#1c201e] border border-[#252a27] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-sm">
            <h3 className="font-serif text-lg font-bold text-[#c86d51]">Criar Condição Ambiental</h3>
            <div>
              <label className="text-xs font-mono text-[#9b9689] block mb-1">Nome da Condição</label>
              <input
                type="text"
                required
                value={conditionForm.name}
                onChange={e => setConditionForm({ ...conditionForm, name: e.target.value })}
                placeholder="Ex: Chuva Ácida, Terreno Difícil"
                className="w-full bg-[#141716] border border-[#252a27] rounded-xl px-3 py-2 text-sm text-[#ebe7de] focus:border-[#c86d51] outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-[#9b9689] block mb-1">Descrição</label>
              <textarea
                value={conditionForm.description}
                onChange={e => setConditionForm({ ...conditionForm, description: e.target.value })}
                placeholder="Efeitos sensoriais ou narrativos..."
                className="w-full bg-[#141716] border border-[#252a27] rounded-xl px-3 py-2 text-sm text-[#ebe7de] focus:border-[#c86d51] outline-none h-20 resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-[#9b9689] block mb-1">Fórmula Mecânica (opcional)</label>
              <input
                type="text"
                value={conditionForm.formula}
                onChange={e => setConditionForm({ ...conditionForm, formula: e.target.value })}
                placeholder="Ex: 1d6 + 2 ou 4"
                className="w-full bg-[#141716] border border-[#252a27] rounded-xl px-3 py-2 text-sm text-[#ebe7de] focus:border-[#c86d51] outline-none font-mono"
              />
            </div>
            <div className="flex items-center space-x-4 pt-2">
              <label className="flex items-center space-x-2 text-xs font-mono text-[#ebe7de] cursor-pointer">
                <input
                  type="checkbox"
                  checked={conditionForm.is_visible_to_players}
                  onChange={e => setConditionForm({ ...conditionForm, is_visible_to_players: e.target.checked })}
                  className="rounded accent-[#c86d51]"
                />
                <span>Visível aos jogadores</span>
              </label>
            </div>
            <div className="flex justify-end space-x-2 pt-4 border-t border-[#252a27]">
              <button
                type="button"
                onClick={() => setShowConditionModal(false)}
                className="px-4 py-2 bg-[#252a27] text-[#9b9689] rounded-xl text-xs font-mono hover:text-[#ebe7de]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#c86d51] text-[#141716] rounded-xl text-xs font-serif font-bold hover:bg-[#c86d51]/90"
              >
                Criar Condição
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: NOVO EVENTO */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleCreateEvent} className="bg-[#1c201e] border border-[#252a27] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-sm">
            <h3 className="font-serif text-lg font-bold text-[#c86d51]">Criar Evento de Cena</h3>
            <div>
              <label className="text-xs font-mono text-[#9b9689] block mb-1">Título do Evento</label>
              <input
                type="text"
                required
                value={eventForm.title}
                onChange={e => setEventForm({ ...eventForm, title: e.target.value })}
                placeholder="Ex: Emboscada dos Orcs, Alarme Soando"
                className="w-full bg-[#141716] border border-[#252a27] rounded-xl px-3 py-2 text-sm text-[#ebe7de] focus:border-[#c86d51] outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-[#9b9689] block mb-1">Descrição</label>
              <textarea
                value={eventForm.description}
                onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
                placeholder="O que acontece quando o evento for disparado..."
                className="w-full bg-[#141716] border border-[#252a27] rounded-xl px-3 py-2 text-sm text-[#ebe7de] focus:border-[#c86d51] outline-none h-16 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-mono text-[#9b9689] block mb-1">Tipo</label>
                <select
                  value={eventForm.event_type}
                  onChange={e => setEventForm({ ...eventForm, event_type: e.target.value as any })}
                  className="w-full bg-[#141716] border border-[#252a27] rounded-xl px-3 py-2 text-xs text-[#ebe7de] outline-none"
                >
                  <option value="manual">Manual</option>
                  <option value="scheduled">Agendado</option>
                  <option value="trigger">Gatilho</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-mono text-[#9b9689] block mb-1">Visibilidade</label>
                <select
                  value={eventForm.visibility}
                  onChange={e => setEventForm({ ...eventForm, visibility: e.target.value as any })}
                  className="w-full bg-[#141716] border border-[#252a27] rounded-xl px-3 py-2 text-xs text-[#ebe7de] outline-none"
                >
                  <option value="master_only">Somente Mestre</option>
                  <option value="public">Público</option>
                  <option value="targeted">Direcionado</option>
                </select>
              </div>
            </div>

            {eventForm.event_type === 'scheduled' && (
              <div>
                <label className="text-xs font-mono text-[#9b9689] block mb-1">Data/Hora Agendada</label>
                <input
                  type="datetime-local"
                  value={eventForm.scheduled_at}
                  onChange={e => setEventForm({ ...eventForm, scheduled_at: e.target.value })}
                  className="w-full bg-[#141716] border border-[#252a27] rounded-xl px-3 py-2 text-xs text-[#ebe7de] outline-none"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-mono text-[#9b9689] block mb-1">Ação Conectada</label>
              <select
                value={eventForm.action_type}
                onChange={e => setEventForm({ ...eventForm, action_type: e.target.value })}
                className="w-full bg-[#141716] border border-[#252a27] rounded-xl px-3 py-2 text-xs text-[#ebe7de] outline-none"
              >
                <option value="none">Nenhuma</option>
                <option value="chat">Mensagem no Chat do Sistema</option>
                <option value="condition">Ativar Condição Ambiental</option>
              </select>
            </div>

            {eventForm.action_type !== 'none' && (
              <div>
                <label className="text-xs font-mono text-[#9b9689] block mb-1">Mensagem do Chat ao Disparar</label>
                <input
                  type="text"
                  value={eventForm.action_message}
                  onChange={e => setEventForm({ ...eventForm, action_message: e.target.value })}
                  placeholder="Ex: O chão desaba em um estrondo ensurdecedor!"
                  className="w-full bg-[#141716] border border-[#252a27] rounded-xl px-3 py-2 text-xs text-[#ebe7de] outline-none"
                />
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4 border-t border-[#252a27]">
              <button
                type="button"
                onClick={() => setShowEventModal(false)}
                className="px-4 py-2 bg-[#252a27] text-[#9b9689] rounded-xl text-xs font-mono hover:text-[#ebe7de]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#c86d51] text-[#141716] rounded-xl text-xs font-serif font-bold hover:bg-[#c86d51]/90"
              >
                Criar Evento
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: NOVA NOTA */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleCreateNote} className="bg-[#1c201e] border border-[#252a27] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-sm">
            <h3 className="font-serif text-lg font-bold text-[#c86d51]">Criar Nota Confidencial</h3>
            <div>
              <label className="text-xs font-mono text-[#9b9689] block mb-1">Título</label>
              <input
                type="text"
                required
                value={noteForm.title}
                onChange={e => setNoteForm({ ...noteForm, title: e.target.value })}
                placeholder="Ex: Pista do Assassinato, Fraqueza do Vilão"
                className="w-full bg-[#141716] border border-[#252a27] rounded-xl px-3 py-2 text-sm text-[#ebe7de] outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-[#9b9689] block mb-1">Conteúdo</label>
              <textarea
                required
                value={noteForm.content}
                onChange={e => setNoteForm({ ...noteForm, content: e.target.value })}
                placeholder="Detalhes confidenciais..."
                className="w-full bg-[#141716] border border-[#252a27] rounded-xl px-3 py-2 text-sm text-[#ebe7de] outline-none h-28 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-mono text-[#9b9689] block mb-1">Categoria</label>
                <select
                  value={noteForm.category}
                  onChange={e => setNoteForm({ ...noteForm, category: e.target.value })}
                  className="w-full bg-[#141716] border border-[#252a27] rounded-xl px-3 py-2 text-xs text-[#ebe7de] outline-none"
                >
                  <option value="enredo">Enredo</option>
                  <option value="npcs">NPCs</option>
                  <option value="pistas">Pistas</option>
                  <option value="locais">Locais</option>
                  <option value="regras">Regras</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-mono text-[#9b9689] block mb-1">Tags (separadas por vírgula)</label>
                <input
                  type="text"
                  value={noteForm.tags}
                  onChange={e => setNoteForm({ ...noteForm, tags: e.target.value })}
                  placeholder="segredo, pista, boss"
                  className="w-full bg-[#141716] border border-[#252a27] rounded-xl px-3 py-2 text-xs text-[#ebe7de] outline-none"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="isPrivateCheck"
                checked={noteForm.is_private}
                onChange={e => setNoteForm({ ...noteForm, is_private: e.target.checked })}
                className="rounded accent-[#c86d51]"
              />
              <label htmlFor="isPrivateCheck" className="text-xs font-mono text-[#ebe7de] cursor-pointer">
                Nota estritamente privada (invisível aos jogadores)
              </label>
            </div>
            <div className="flex justify-end space-x-2 pt-4 border-t border-[#252a27]">
              <button
                type="button"
                onClick={() => setShowNoteModal(false)}
                className="px-4 py-2 bg-[#252a27] text-[#9b9689] rounded-xl text-xs font-mono hover:text-[#ebe7de]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#c86d51] text-[#141716] rounded-xl text-xs font-serif font-bold hover:bg-[#c86d51]/90"
              >
                Salvar Nota
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: COMPARTILHAR NOTA */}
      {showShareModal && selectedNote && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1c201e] border border-[#252a27] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-sm">
            <h3 className="font-serif text-lg font-bold text-[#c86d51]">Compartilhar Nota com Jogadores</h3>
            <p className="text-xs text-[#9b9689] font-mono">
              Selecione os jogadores que terão permissão para visualizar "{selectedNote.title}"
            </p>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {members.map(m => {
                const memId = m.userId || m.user_id || m.id;
                const isChecked = sharedUsersList.includes(memId);
                return (
                  <label key={memId} className="flex items-center space-x-3 p-2 bg-[#141716] rounded-lg border border-[#252a27] cursor-pointer hover:border-[#c86d51]/50">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={e => {
                        if (e.target.checked) setSharedUsersList([...sharedUsersList, memId]);
                        else setSharedUsersList(sharedUsersList.filter(id => id !== memId));
                      }}
                      className="rounded accent-[#c86d51]"
                    />
                    <span className="text-xs font-serif text-[#ebe7de] font-bold">{m.username || 'Jogador'}</span>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t border-[#252a27]">
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 bg-[#252a27] text-[#9b9689] rounded-xl text-xs font-mono hover:text-[#ebe7de]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveShare}
                className="px-4 py-2 bg-[#c86d51] text-[#141716] rounded-xl text-xs font-serif font-bold hover:bg-[#c86d51]/90"
              >
                Confirmar Compartilhamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVA REVELAÇÃO GRANULAR */}
      {showRevelationModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSaveRevelation} className="bg-[#1c201e] border border-[#252a27] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-sm">
            <h3 className="font-serif text-lg font-bold text-[#c86d51]">Revelação Granular de Entidade</h3>
            <div>
              <label className="text-xs font-mono text-[#9b9689] block mb-1">Criatura / Entidade</label>
              <select
                required
                value={revForm.entity_id}
                onChange={e => setRevForm({ ...revForm, entity_id: e.target.value })}
                className="w-full bg-[#141716] border border-[#252a27] rounded-xl px-3 py-2 text-xs text-[#ebe7de] outline-none"
              >
                <option value="">Selecione a Criatura</option>
                {creatures.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-mono text-[#9b9689] block mb-1">Destinatário</label>
              <select
                value={revForm.target_user_id}
                onChange={e => setRevForm({ ...revForm, target_user_id: e.target.value })}
                className="w-full bg-[#141716] border border-[#252a27] rounded-xl px-3 py-2 text-xs text-[#ebe7de] outline-none"
              >
                <option value="">Público para todos os jogadores</option>
                {members.map(m => {
                  const mId = m.userId || m.user_id || m.id;
                  return <option key={mId} value={mId}>{m.username}</option>;
                })}
              </select>
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-xs font-mono text-[#9b9689] block">Campos Revelados</label>
              <label className="flex items-center space-x-2 text-xs font-mono text-[#ebe7de] cursor-pointer">
                <input
                  type="checkbox"
                  checked={revForm.fields.true_name}
                  onChange={e => setRevForm({ ...revForm, fields: { ...revForm.fields, true_name: e.target.checked } })}
                  className="rounded accent-[#c86d51]"
                />
                <span>Nome Verdadeiro (vs Vulto Desconhecido)</span>
              </label>
              <label className="flex items-center space-x-2 text-xs font-mono text-[#ebe7de] cursor-pointer">
                <input
                  type="checkbox"
                  checked={revForm.fields.stats}
                  onChange={e => setRevForm({ ...revForm, fields: { ...revForm.fields, stats: e.target.checked } })}
                  className="rounded accent-[#c86d51]"
                />
                <span>Ficha e Atributos Numéricos</span>
              </label>
              <label className="flex items-center space-x-2 text-xs font-mono text-[#ebe7de] cursor-pointer">
                <input
                  type="checkbox"
                  checked={revForm.fields.weakness}
                  onChange={e => setRevForm({ ...revForm, fields: { ...revForm.fields, weakness: e.target.checked } })}
                  className="rounded accent-[#c86d51]"
                />
                <span>Fraquezas e Imunidades</span>
              </label>
              <label className="flex items-center space-x-2 text-xs font-mono text-[#ebe7de] cursor-pointer">
                <input
                  type="checkbox"
                  checked={revForm.fields.description}
                  onChange={e => setRevForm({ ...revForm, fields: { ...revForm.fields, description: e.target.checked } })}
                  className="rounded accent-[#c86d51]"
                />
                <span>Descrição Completa</span>
              </label>
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t border-[#252a27]">
              <button
                type="button"
                onClick={() => setShowRevelationModal(false)}
                className="px-4 py-2 bg-[#252a27] text-[#9b9689] rounded-xl text-xs font-mono hover:text-[#ebe7de]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#c86d51] text-[#141716] rounded-xl text-xs font-serif font-bold hover:bg-[#c86d51]/90"
              >
                Salvar Revelação
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
