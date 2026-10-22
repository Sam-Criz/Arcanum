import React, { useState, useEffect } from 'react';
import { Campaign, CharacterTemplate, TemplateSection, TemplateField, api, User } from '../services/api';
import { LayoutTemplate, Plus, Trash2, Edit3, Check, AlertCircle, Calculator } from 'lucide-react';

interface TemplateEditorProps {
  campaign: Campaign;
  user: User;
  onRefreshCampaign?: () => void;
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  campaign,
  onRefreshCampaign
}) => {
  const [templates, setTemplates] = useState<CharacterTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<CharacterTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form states do Template
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [formulaErrors, setFormulaErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isMaster = campaign.role === 'owner' || campaign.role === 'master';

  useEffect(() => {
    loadTemplates();
  }, [campaign.id]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const res = await api.getTemplates(campaign.id);
      setTemplates(res);
      if (res.length > 0 && !selectedTemplate) {
        setSelectedTemplate(res[0]);
      }
    } catch (err) {
      console.error('Erro ao carregar modelos de ficha:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartCreate = () => {
    setSelectedTemplate(null);
    setName('');
    setDescription('');
    setSections([
      {
        id: 'secao_geral',
        title: 'Informações Gerais',
        fields: [
          {
            id: 'conceito',
            name: 'Conceito do Personagem',
            type: 'text',
            defaultValue: '',
            width: 'full'
          }
        ]
      },
      {
        id: 'secao_poderes',
        title: 'Habilidades & Estatísticas Especiais',
        fields: [
          {
            id: 'poder_especial',
            name: 'Poder Especial',
            type: 'number',
            defaultValue: 10,
            isDerived: true,
            formula: 'Intelecto * 2 + Forca',
            width: 'half'
          }
        ]
      }
    ]);
    setIsEditing(true);
  };

  const handleStartEdit = (tmpl: CharacterTemplate) => {
    setSelectedTemplate(tmpl);
    setName(tmpl.name);
    setDescription(tmpl.description);
    setSections(JSON.parse(JSON.stringify(tmpl.schema.sections || [])));
    setIsEditing(true);
  };

  const handleAddSection = () => {
    const secId = `secao_${Date.now()}`;
    setSections([
      ...sections,
      {
        id: secId,
        title: 'Nova Seção da Ficha',
        fields: []
      }
    ]);
  };

  const handleRemoveSection = (secIdx: number) => {
    const updated = [...sections];
    updated.splice(secIdx, 1);
    setSections(updated);
  };

  const handleSectionTitleChange = (secIdx: number, newTitle: string) => {
    const updated = [...sections];
    updated[secIdx].title = newTitle;
    setSections(updated);
  };

  const handleAddField = (secIdx: number) => {
    const fId = `campo_${Date.now()}`;
    const updated = [...sections];
    updated[secIdx].fields.push({
      id: fId,
      name: 'Novo Campo',
      type: 'text',
      defaultValue: '',
      width: 'half'
    });
    setSections(updated);
  };

  const handleRemoveField = (secIdx: number, fIdx: number) => {
    const updated = [...sections];
    updated[secIdx].fields.splice(fIdx, 1);
    setSections(updated);
  };

  const handleFieldChange = async (secIdx: number, fIdx: number, patch: Partial<TemplateField>) => {
    const updated = [...sections];
    const field = { ...updated[secIdx].fields[fIdx], ...patch };
    updated[secIdx].fields[fIdx] = field;
    setSections(updated);

    // Se alterou a fórmula, valida contra as regras da campanha
    if (patch.formula !== undefined && field.isDerived) {
      if (patch.formula.trim()) {
        try {
          const valRes = await api.validateFormula(campaign.id, patch.formula);
          if (!valRes.isValid) {
            setFormulaErrors(prev => ({ ...prev, [field.id]: valRes.error || 'Fórmula inválida' }));
          } else {
            setFormulaErrors(prev => {
              const cp = { ...prev };
              delete cp[field.id];
              return cp;
            });
          }
        } catch (err: any) {
          setFormulaErrors(prev => ({ ...prev, [field.id]: err.message }));
        }
      } else {
        setFormulaErrors(prev => {
          const cp = { ...prev };
          delete cp[field.id];
          return cp;
        });
      }
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);

    // Validar se há erros pendentes de fórmula
    if (Object.keys(formulaErrors).length > 0) {
      setError('Corrija os erros nas fórmulas antes de salvar o modelo de ficha.');
      return;
    }

    try {
      if (selectedTemplate) {
        const updated = await api.updateTemplate(campaign.id, selectedTemplate.id, {
          name: name.trim(),
          description: description.trim(),
          schema: { sections }
        });
        setSelectedTemplate(updated);
        setSuccess('Modelo de ficha atualizado com sucesso!');
      } else {
        const created = await api.createTemplate(campaign.id, {
          name: name.trim(),
          description: description.trim(),
          schema: { sections }
        });
        setSelectedTemplate(created);
        setSuccess('Novo modelo de ficha criado com sucesso!');
      }

      setIsEditing(false);
      loadTemplates();
      if (onRefreshCampaign) onRefreshCampaign();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar modelo');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Deseja realmente excluir este modelo de ficha?')) return;
    try {
      await api.deleteTemplate(campaign.id, templateId);
      setSelectedTemplate(null);
      loadTemplates();
    } catch (err: any) {
      alert(`Erro ao excluir modelo: ${err.message}`);
    }
  };

  if (loading && templates.length === 0) {
    return <div className="text-[#aaa292] text-center py-12">Carregando modelos de ficha...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Alertas */}
      {success && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-sm rounded-xl flex items-center space-x-2">
          <Check className="w-4 h-4" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-sm rounded-xl flex items-center space-x-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Header do Módulo de Templates */}
      <div className="bg-[#1a1816] border border-[#2c2825] rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all">
        <div>
          <div className="flex items-center space-x-2 text-xs text-[#c9a04e] font-semibold mb-1">
            <LayoutTemplate className="w-4 h-4" />
            <span>Configuração Estrutural da Campanha</span>
          </div>
          <h2 className="text-xl font-bold text-white">Modelos de Ficha Personalizados (Templates)</h2>
          <p className="text-xs text-[#aaa292] mt-0.5">
            Crie e personalize seções, campos de texto, números, seleções e atributos calculados por fórmula para os jogadores.
          </p>
        </div>

        {isMaster && !isEditing && (
          <button
            onClick={handleStartCreate}
            className="flex items-center space-x-2 px-4 py-2.5 bg-[#c9a04e] hover:bg-[#c9a04e]/90 text-[#131211] font-bold rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Modelo de Ficha</span>
          </button>
        )}
      </div>

      {isEditing ? (
        /* FORMULÁRIO DO VISUAL BUILDER */
        <form onSubmit={handleSaveTemplate} className="bg-[#1a1816] border border-[#2c2825] rounded-2xl p-6 shadow-xl space-y-6 transition-all">
          <div className="flex items-center justify-between pb-4 border-b border-[#2c2825]">
            <div>
              <h3 className="font-bold text-lg text-white">
                {selectedTemplate ? 'Editando Modelo de Ficha' : 'Criando Novo Modelo de Ficha'}
              </h3>
              <p className="text-xs text-[#aaa292]">Configure as seções e os campos dinâmicos da ficha.</p>
            </div>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl border border-[#574e45]/80 text-[#ece3d0] hover:bg-slate-800/80 hover:text-white text-xs font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#c9a04e] hover:bg-[#c9a04e]/90 text-[#131211] font-bold text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                Salvar Modelo
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#ece3d0] uppercase tracking-wider mb-1.5">
                Nome do Modelo
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Ficha Ocultista Especialista, Mercenário Cyberpunk..."
                className="w-full px-4 py-2.5 bg-slate-950 border border-[#574e45] rounded-xl text-white text-sm focus:outline-none focus:border-[#c9a04e]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#ece3d0] uppercase tracking-wider mb-1.5">
                Descrição do Modelo
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Ficha com foco em rituais e afinidade elemental..."
                className="w-full px-4 py-2.5 bg-slate-950 border border-[#574e45] rounded-xl text-white text-sm focus:outline-none focus:border-[#c9a04e]"
              />
            </div>
          </div>

          {/* Seções e Campos */}
          <div className="space-y-6 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#ece3d0] uppercase tracking-wider">
                Estrutura de Seções e Campos da Ficha
              </h4>
              <button
                type="button"
                onClick={handleAddSection}
                className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-[#c9a04e] rounded-lg text-xs font-semibold transition-all border border-[#574e45]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Seção</span>
              </button>
            </div>

            {sections.map((sec, secIdx) => (
              <div key={sec.id || secIdx} className="bg-[#131211] border border-[#2c2825] rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#2c2825]">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={sec.title}
                      onChange={(e) => handleSectionTitleChange(secIdx, e.target.value)}
                      placeholder="Título da Seção (Ex: Perícias, Antecedentes, etc.)"
                      className="bg-transparent font-bold text-base text-white border-b border-transparent hover:border-[#574e45] focus:border-[#c9a04e] focus:outline-none w-full"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveSection(secIdx)}
                    className="p-1.5 text-[#777064] hover:text-[#b24a52] transition-colors"
                    title="Remover Seção"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Campos dentro da seção */}
                <div className="space-y-3">
                  {sec.fields.map((f, fIdx) => (
                    <div key={f.id || fIdx} className="bg-[#1a1816] border border-[#2c2825] rounded-xl p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] text-[#aaa292] mb-1">Rótulo / Nome do Campo</label>
                          <input
                            type="text"
                            value={f.name}
                            onChange={(e) => handleFieldChange(secIdx, fIdx, { name: e.target.value })}
                            placeholder="Ex: Afinidade Elemental"
                            className="w-full px-3 py-1.5 bg-slate-950 border border-[#574e45] rounded-lg text-white text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-[#aaa292] mb-1">Identificador (ID)</label>
                          <input
                            type="text"
                            value={f.id}
                            onChange={(e) => handleFieldChange(secIdx, fIdx, { id: e.target.value })}
                            placeholder="afinidade_elemental"
                            className="w-full px-3 py-1.5 bg-slate-950 border border-[#574e45] rounded-lg text-[#ece3d0] font-mono text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-[#aaa292] mb-1">Tipo de Dado</label>
                          <select
                            value={f.type}
                            onChange={(e) => handleFieldChange(secIdx, fIdx, { type: e.target.value as any })}
                            className="w-full px-3 py-1.5 bg-slate-950 border border-[#574e45] rounded-lg text-white text-xs"
                          >
                            <option value="text">Texto Curto</option>
                            <option value="textarea">Texto Longo</option>
                            <option value="number">Número</option>
                            <option value="select">Seleção (Dropdown)</option>
                            <option value="boolean">Verdadeiro/Falso</option>
                          </select>
                        </div>
                      </div>

                      {/* Configurações adicionais de campo */}
                      <div className="flex flex-wrap items-center gap-4 pt-1">
                        <label className="flex items-center space-x-2 text-xs text-[#ece3d0] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!f.isDerived}
                            onChange={(e) => handleFieldChange(secIdx, fIdx, { 
                              isDerived: e.target.checked,
                              formula: e.target.checked ? (f.formula || '') : undefined
                            })}
                            className="rounded border-[#574e45] text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="flex items-center space-x-1">
                            <Calculator className="w-3.5 h-3.5 text-purple-400" />
                            <span>Calculado por Fórmula?</span>
                          </span>
                        </label>

                        {f.type === 'number' && !f.isDerived && (
                          <div className="flex items-center space-x-2 text-xs text-[#aaa292]">
                            <span>Valor Padrão:</span>
                            <input
                              type="number"
                              value={f.defaultValue ?? 0}
                              onChange={(e) => handleFieldChange(secIdx, fIdx, { defaultValue: parseFloat(e.target.value) || 0 })}
                              className="w-20 px-2 py-1 bg-slate-950 border border-[#574e45] rounded text-white font-mono text-xs"
                            />
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveField(secIdx, fIdx)}
                          className="ml-auto text-xs text-[#777064] hover:text-[#b24a52] transition-colors"
                        >
                          Excluir Campo
                        </button>
                      </div>

                      {/* Input de Fórmula com Validador de Regras em Tempo Real */}
                      {f.isDerived && (
                        <div className="p-3 bg-purple-950/20 border border-purple-800/40 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-purple-300">Fórmula de RPG (Motor de Regras)</span>
                            <span className="text-[10px] text-[#777064] font-mono">Ex: Intelecto * 2 + Forca</span>
                          </div>
                          <input
                            type="text"
                            value={f.formula || ''}
                            onChange={(e) => handleFieldChange(secIdx, fIdx, { formula: e.target.value })}
                            placeholder="Ex: Intelecto * 3 + Presenca"
                            className="w-full px-3 py-1.5 bg-slate-950 border border-purple-700/60 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                          />
                          {formulaErrors[f.id] ? (
                            <p className="text-[11px] text-[#b24a52]">{formulaErrors[f.id]}</p>
                          ) : (
                            <p className="text-[11px] text-emerald-400">✓ Fórmula compatível com os atributos da campanha</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => handleAddField(secIdx)}
                    className="w-full py-2.5 rounded-xl border border-dashed border-[#2c2825] hover:border-[#574e45] text-[#aaa292] hover:text-white text-xs font-semibold transition-all flex items-center justify-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Campo nesta Seção</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </form>
      ) : (
        /* VISUALIZAÇÃO DOS MODELOS EXISTENTES */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-[#1a1816] border border-[#2c2825] rounded-2xl p-5 shadow-xl h-fit space-y-2 transition-all">
            <h3 className="font-bold text-xs text-[#aaa292] uppercase tracking-wider mb-3">Modelos Disponíveis</h3>

            {templates.length === 0 ? (
              <p className="text-xs text-[#777064] py-4 text-center">Nenhum modelo criado ainda.</p>
            ) : (
              templates.map((tmpl) => (
                <div
                  key={tmpl.id}
                  onClick={() => setSelectedTemplate(tmpl)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] ${
                    selectedTemplate?.id === tmpl.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                      : 'bg-slate-950/80 border-[#2c2825] text-[#ece3d0] hover:border-[#574e45]'
                  }`}
                >
                  <p className="font-bold text-sm truncate">{tmpl.name}</p>
                  <p className="text-xs text-[#aaa292] truncate mt-0.5">{tmpl.description || 'Sem descrição'}</p>
                  <span className="text-[10px] text-[#c9a04e] mt-2 block font-mono">
                    {tmpl.schema?.sections?.length || 0} seções configuradas
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="lg:col-span-2">
            {selectedTemplate ? (
              <div className="bg-[#1a1816] border border-[#2c2825] rounded-2xl p-6 shadow-xl space-y-6 transition-all">
                <div className="flex items-center justify-between pb-4 border-b border-[#2c2825]">
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedTemplate.name}</h3>
                    <p className="text-xs text-[#aaa292] mt-0.5">{selectedTemplate.description || 'Modelo de ficha ativo'}</p>
                  </div>
                  {isMaster && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleStartEdit(selectedTemplate)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-[#ece3d0] hover:text-white border border-[#574e45]/80 text-xs font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar Estrutura</span>
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(selectedTemplate.id)}
                        className="p-1.5 text-[#777064] hover:text-[#b24a52] hover:bg-rose-950/30 rounded-xl transition-colors"
                        title="Excluir Modelo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Pré-visualização da Estrutura do Modelo */}
                <div className="space-y-4">
                  {selectedTemplate.schema?.sections?.map((sec, sIdx) => (
                    <div key={sec.id || sIdx} className="bg-[#131211] border border-[#2c2825] rounded-xl p-4">
                      <h4 className="font-bold text-sm text-indigo-300 mb-3">{sec.title}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {sec.fields?.map((f, fIdx) => (
                          <div key={f.id || fIdx} className="p-2.5 bg-slate-900 rounded-lg border border-[#2c2825] text-xs">
                            <span className="text-[#aaa292] block text-[10px] uppercase font-bold">{f.name} ({f.type})</span>
                            {f.isDerived ? (
                              <span className="font-mono text-purple-400 text-xs mt-1 block">
                                f(x): {f.formula}
                              </span>
                            ) : (
                              <span className="text-[#ece3d0] text-xs mt-1 block">
                                Padrão: {String(f.defaultValue || '—')}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-[#1a1816] border border-[#2c2825] rounded-2xl p-12 text-center text-[#777064]">
                Selecione um modelo à esquerda ou crie um novo para customizar as fichas.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
