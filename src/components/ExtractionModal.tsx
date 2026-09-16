import React, { useState } from 'react';
import { Article, BibliographicInfo, StudyCharacteristics, InterventionDetails, MetaAnalysisData, AdvancedOutcome } from '../types';
import { XCircle, Plus, Trash2, Check, Sparkles, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ExtractionModalProps {
  article: Article;
  onSave: (articleId: string, updates: Partial<Article>) => void;
  onClose: () => void;
  reviewType: 'Scoping Review';
}

export const ExtractionModal: React.FC<ExtractionModalProps> = ({ article, onSave, onClose, reviewType }) => {
  const [activeTab, setActiveTab] = useState<'bibliographic' | 'study' | 'intervention' | 'outcomes'>('bibliographic');
  const [bib, setBib] = useState<BibliographicInfo>(article.bibliographic || {});
  const [study, setStudy] = useState<StudyCharacteristics>(article.studyCharacteristics || {});
  const [interv, setInterv] = useState<InterventionDetails>(article.interventionDetails || {});
  const [ma, setMa] = useState<MetaAnalysisData>(article.metaAnalysisData || { effectSize: '', lowerCI: '', upperCI: '', weight: '', outcomes: [] });
  const [isExtracting, setIsExtracting] = useState(false);

  const handleSave = () => {
    onSave(article.id, {
      bibliographic: bib,
      studyCharacteristics: study,
      interventionDetails: interv,
      metaAnalysisData: ma
    });
    onClose();
  };

  const handleAutoExtract = async () => {
    setIsExtracting(true);
    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: article.title,
          abstract: article.abstract,
          reviewType: reviewType
        })
      });
      const data = await response.json();
      if (data.studyCharacteristics) {
        setStudy(prev => ({ ...prev, ...data.studyCharacteristics }));
      }
      if (data.interventionDetails) {
        setInterv(prev => ({ ...prev, ...data.interventionDetails }));
      }
    } catch (e) {
      console.error("Auto extraction failed:", e);
      alert("Auto extraction failed. Make sure the Gemini API key is configured.");
    } finally {
      setIsExtracting(false);
    }
  };

  const addOutcome = () => {
    setMa(prev => ({
      ...prev,
      outcomes: [
        ...(prev.outcomes || []),
        { id: Date.now().toString(), outcomeName: '', outcomeType: '' }
      ]
    }));
  };

  const updateOutcome = (id: string, field: keyof AdvancedOutcome, value: string) => {
    setMa(prev => ({
      ...prev,
      outcomes: (prev.outcomes || []).map(o => o.id === id ? { ...o, [field]: value } : o)
    }));
  };

  const removeOutcome = (id: string) => {
    setMa(prev => ({
      ...prev,
      outcomes: (prev.outcomes || []).map(o => o.id === id ? null : o).filter(Boolean) as AdvancedOutcome[]
    }));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/60 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 p-6 flex justify-between items-start">
          <div className="pr-10">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white leading-tight mb-2">{article.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{article.authors} ({article.year}) &bull; {article.journal}</p>
            <button 
              onClick={handleAutoExtract} 
              disabled={isExtracting}
              className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-4 py-2 rounded-lg font-medium text-sm flex items-center transition disabled:opacity-50"
            >
              {isExtracting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Extracting with AI...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Auto-Extract Data</>
              )}
            </button>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 p-2 rounded-full transition">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-slate-700 px-6 bg-white dark:bg-slate-900 overflow-x-auto hide-scrollbar">
          {(['bibliographic', 'study', 'intervention', 'outcomes'] as const).map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400 dark:border-indigo-500' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-slate-600'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)} {tab === 'study' ? 'Characteristics' : ''} {tab === 'intervention' ? 'Details' : ''}
            </button>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 dark:bg-slate-900/50">
          
          {activeTab === 'bibliographic' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { key: 'pmcid', label: 'PMCID' },
                { key: 'publisher', label: 'Publisher' },
                { key: 'volume', label: 'Volume' },
                { key: 'issue', label: 'Issue' },
                { key: 'pages', label: 'Pages' },
                { key: 'country', label: 'Country' },
                { key: 'institution', label: 'Institution' },
                { key: 'funding', label: 'Funding' },
                { key: 'conflictsOfInterest', label: 'Conflicts of Interest' }
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{field.label}</label>
                  <input type="text" className="w-full bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded-lg text-sm p-2.5 focus:ring-slate-500 focus:border-slate-500" 
                    value={(bib as any)[field.key] || ''} 
                    onChange={e => setBib({...bib, [field.key]: e.target.value})} 
                  />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'study' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { key: 'population', label: 'Population' },
                { key: 'age', label: 'Age (Mean/Range)' },
                { key: 'sex', label: 'Sex/Gender Distribution' },
                { key: 'inclusionCriteria', label: 'Inclusion Criteria' },
                { key: 'exclusionCriteria', label: 'Exclusion Criteria' },
                { key: 'followUpPeriod', label: 'Follow-up Period' },
                { key: 'setting', label: 'Setting (e.g. Hospital, Community)' },
                { key: 'randomization', label: 'Randomization Details' },
                { key: 'blinding', label: 'Blinding (Single, Double, etc.)' }
              ].map(field => (
                <div key={field.key} className={field.key.includes('Criteria') ? "md:col-span-2" : ""}>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{field.label}</label>
                  {field.key.includes('Criteria') ? (
                    <textarea rows={3} className="w-full bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded-lg text-sm p-2.5 focus:ring-slate-500 focus:border-slate-500" value={(study as any)[field.key] || ''} onChange={e => setStudy({...study, [field.key]: e.target.value})} />
                  ) : (
                    <input type="text" className="w-full bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded-lg text-sm p-2.5 focus:ring-slate-500 focus:border-slate-500" value={(study as any)[field.key] || ''} onChange={e => setStudy({...study, [field.key]: e.target.value})} />
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'intervention' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { key: 'intervention', label: 'Intervention / Exposure' },
                { key: 'comparator', label: 'Comparator / Control' },
                { key: 'dose', label: 'Dose' },
                { key: 'frequency', label: 'Frequency' },
                { key: 'duration', label: 'Duration' },
                { key: 'route', label: 'Route of Administration' },
                { key: 'treatmentProtocol', label: 'Treatment Protocol' }
              ].map(field => (
                <div key={field.key} className={field.key === 'treatmentProtocol' ? "md:col-span-2" : ""}>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{field.label}</label>
                  {field.key === 'treatmentProtocol' ? (
                     <textarea rows={3} className="w-full bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded-lg text-sm p-2.5 focus:ring-slate-500 focus:border-slate-500" value={(interv as any)[field.key] || ''} onChange={e => setInterv({...interv, [field.key]: e.target.value})} />
                  ) : (
                    <input type="text" className="w-full bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded-lg text-sm p-2.5 focus:ring-slate-500 focus:border-slate-500" value={(interv as any)[field.key] || ''} onChange={e => setInterv({...interv, [field.key]: e.target.value})} />
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'outcomes' && (
            <div className="space-y-8">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-gray-900 dark:text-white">Reported Outcomes</h4>
                  <button onClick={addOutcome} className="text-sm bg-slate-900 dark:bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-slate-800 dark:hover:bg-indigo-700 flex items-center transition">
                    <Plus className="w-4 h-4 mr-1" /> Add Outcome
                  </button>
                </div>
                
                {(ma.outcomes || []).length === 0 ? (
                  <div className="text-center py-10 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 border-dashed rounded-xl text-gray-500 dark:text-gray-400">
                    No outcomes extracted yet. Click "Add Outcome" to structure effect sizes, means, SDs, and event counts.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(ma.outcomes || []).map((o, idx) => (
                      <div key={o.id} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 relative shadow-sm">
                        <button onClick={() => removeOutcome(o.id)} className="absolute top-4 right-4 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 bg-gray-50 dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-red-900/30 p-1.5 rounded-md transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 pr-10">
                          <div className="col-span-2">
                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Outcome Name</label>
                            <input type="text" className="w-full bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded text-sm p-2 focus:ring-slate-500" value={o.outcomeName} onChange={e => updateOutcome(o.id, 'outcomeName', e.target.value)} placeholder="e.g. Mortality at 30 days" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Data Type</label>
                            <select className="w-full bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded text-sm p-2 focus:ring-slate-500" value={o.outcomeType} onChange={e => updateOutcome(o.id, 'outcomeType', e.target.value)}>
                              <option value="">Select...</option>
                              <option value="Binary">Binary (Events)</option>
                              <option value="Continuous">Continuous (Mean/SD)</option>
                              <option value="Time-to-event">Time-to-event (HR)</option>
                            </select>
                          </div>
                        </div>

                        {/* Type specific fields */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700/50">
                          {/* Sample Sizes */}
                          <div className="space-y-3">
                            <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sample Sizes (N)</h5>
                            <div className="flex space-x-3">
                              <div className="flex-1">
                                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Intervention</label>
                                <input type="text" className="w-full bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded text-sm p-1.5" value={o.nIntervention || ''} onChange={e => updateOutcome(o.id, 'nIntervention', e.target.value)} />
                              </div>
                              <div className="flex-1">
                                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Comparator</label>
                                <input type="text" className="w-full bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded text-sm p-1.5" value={o.nComparator || ''} onChange={e => updateOutcome(o.id, 'nComparator', e.target.value)} />
                              </div>
                            </div>
                          </div>

                          {o.outcomeType === 'Binary' && (
                            <div className="space-y-3">
                              <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Events</h5>
                              <div className="flex space-x-3">
                                <div className="flex-1">
                                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Intervention Events</label>
                                  <input type="text" className="w-full bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded text-sm p-1.5" value={o.eventsIntervention || ''} onChange={e => updateOutcome(o.id, 'eventsIntervention', e.target.value)} />
                                </div>
                                <div className="flex-1">
                                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Comparator Events</label>
                                  <input type="text" className="w-full bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded text-sm p-1.5" value={o.eventsComparator || ''} onChange={e => updateOutcome(o.id, 'eventsComparator', e.target.value)} />
                                </div>
                              </div>
                            </div>
                          )}

                          {o.outcomeType === 'Continuous' && (
                            <div className="space-y-3 lg:col-span-2">
                              <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Continuous Data</h5>
                              <div className="grid grid-cols-4 gap-3">
                                <div><label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Mean (Int)</label><input type="text" className="w-full bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded text-sm p-1.5" value={o.meanIntervention || ''} onChange={e => updateOutcome(o.id, 'meanIntervention', e.target.value)} /></div>
                                <div><label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">SD (Int)</label><input type="text" className="w-full bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded text-sm p-1.5" value={o.sdIntervention || ''} onChange={e => updateOutcome(o.id, 'sdIntervention', e.target.value)} /></div>
                                <div><label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Mean (Comp)</label><input type="text" className="w-full bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded text-sm p-1.5" value={o.meanComparator || ''} onChange={e => updateOutcome(o.id, 'meanComparator', e.target.value)} /></div>
                                <div><label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">SD (Comp)</label><input type="text" className="w-full bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded text-sm p-1.5" value={o.sdComparator || ''} onChange={e => updateOutcome(o.id, 'sdComparator', e.target.value)} /></div>
                              </div>
                            </div>
                          )}
                          
                          {/* Common Effect Size fields for all types */}
                          <div className="space-y-3 lg:col-span-2 pt-2 border-t border-slate-200 dark:border-slate-700/50 mt-2">
                            <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Effect Estimates (if reported)</h5>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                              <div>
                                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Measure</label>
                                <select className="w-full bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded text-sm p-1.5" value={o.effectMeasure || ''} onChange={e => updateOutcome(o.id, 'effectMeasure', e.target.value)}>
                                  <option value="">...</option>
                                  <option value="OR">OR</option>
                                  <option value="RR">RR</option>
                                  <option value="HR">HR</option>
                                  <option value="MD">MD</option>
                                  <option value="SMD">SMD</option>
                                </select>
                              </div>
                              <div><label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Effect Size</label><input type="text" className="w-full bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded text-sm p-1.5" value={o.effectSize || ''} onChange={e => updateOutcome(o.id, 'effectSize', e.target.value)} /></div>
                              <div><label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Lower CI</label><input type="text" className="w-full bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded text-sm p-1.5" value={o.lowerCI || ''} onChange={e => updateOutcome(o.id, 'lowerCI', e.target.value)} /></div>
                              <div><label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Upper CI</label><input type="text" className="w-full bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded text-sm p-1.5" value={o.upperCI || ''} onChange={e => updateOutcome(o.id, 'upperCI', e.target.value)} /></div>
                              <div><label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">p-value</label><input type="text" className="w-full bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded text-sm p-1.5" value={o.pValue || ''} onChange={e => updateOutcome(o.id, 'pValue', e.target.value)} /></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 p-6 flex justify-end items-center">
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 font-medium px-4 py-2 hover:text-gray-800 dark:hover:text-gray-200 transition mr-2">Cancel</button>
          <button onClick={handleSave} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition flex items-center shadow-sm">
            <Check className="w-4 h-4 mr-2" /> Save Extraction
          </button>
        </div>
      </motion.div>
    </div>
  );
};
