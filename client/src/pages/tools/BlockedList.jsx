import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import Sidebar from '../../components/Sidebar';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function BlockedList() {
  const { unidade } = useParams();
  const navigate = useNavigate();
  const activeUnit = (unidade || 'SP').toUpperCase();

  const [activeBlocked, setActiveBlocked] = useState([]);
  const [historyBlocked, setHistoryBlocked] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showFormModal, setShowFormModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [itemToRemove, setItemToRemove] = useState(null);

  const [formData, setFormData] = useState({
    id: null,
    nome: '',
    motivo: '',
    dataLimite: '',
    isPermanent: false,
    blockAllUnits: false,
    fotoFile: null,
    fotoPreview: null
  });

  const fileInputRef = useRef(null);

  const fetchBlockedData = async () => {
    setIsLoading(true);
    try {
      const [activeRes, historyRes] = await Promise.all([
        axios.get(`${API_URL}/api/blocked/${activeUnit}`),
        axios.get(`${API_URL}/api/blocked/${activeUnit}/history`)
      ]);
      setActiveBlocked(activeRes.data);
      setHistoryBlocked(historyRes.data);
    } catch (err) {
      toast.error("Erro ao sincronizar dados com o servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockedData();
  }, [activeUnit]);

  const resetForm = () => {
    setFormData({
      id: null,
      nome: '',
      motivo: '',
      dataLimite: '',
      isPermanent: false,
      blockAllUnits: false,
      fotoFile: null,
      fotoPreview: null
    });
    setShowFormModal(false);
  };

  const handleEditClick = (item) => {
    setFormData({
      id: item.id,
      nome: item.nome_completo,
      motivo: item.motivo || '',
      dataLimite: item.data_limite ? item.data_limite.split('T')[0] : '',
      isPermanent: !item.data_limite,
      blockAllUnits: false,
      fotoFile: null,
      fotoPreview: item.foto_url ? `${API_URL}${item.foto_url}` : null
    });
    setShowFormModal(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        fotoFile: file,
        fotoPreview: URL.createObjectURL(file)
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nome.trim()) return toast.warn("Nome é obrigatório.");
    if (!formData.isPermanent && !formData.dataLimite) return toast.warn("Defina uma data ou marque Permanente.");

    const data = new FormData();
    data.append('unidade', activeUnit);
    data.append('nome_completo', formData.nome);
    data.append('motivo', formData.motivo);
    data.append('data_limite', formData.isPermanent ? '' : formData.dataLimite);
    data.append('blockAllUnits', formData.blockAllUnits);
    if (formData.fotoFile) data.append('foto', formData.fotoFile);

    try {
      if (formData.id) {
        await axios.put(`${API_URL}/api/blocked/${formData.id}`, data);
        toast.success("Registro atualizado com sucesso.");
      } else {
        await axios.post(`${API_URL}/api/blocked`, data);
        toast.success(formData.blockAllUnits ? "Bloqueio aplicado em todas as unidades." : "Bloqueio registrado.");
      }
      resetForm();
      fetchBlockedData();
    } catch (err) {
      toast.error("Erro ao processar solicitação.");
    }
  };

  const confirmRemove = async () => {
    try {
      await axios.delete(`${API_URL}/api/blocked/${itemToRemove}`);
      toast.success("Bloqueio removido e arquivado.");
      fetchBlockedData();
    } catch (err) {
      toast.error("Erro ao remover.");
    } finally {
      setShowConfirmModal(false);
      setItemToRemove(null);
    }
  };

  const formatDate = (dateString, isTimestamp = false) => {
    if (!dateString) return 'Permanente';
    const date = new Date(dateString);
    if (isTimestamp) {
      return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  };

  return (
    <div className="min-h-screen bg-gradient-warm flex select-none">
      <Sidebar activePage="blocked-list" headerTitle="Segurança" headerIcon="gpp_bad" group="maintenance" unit={unidade} />

      <main className="ml-64 flex-1 p-8 relative">
        <div className="max-w-7xl mx-auto w-full">
          
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-black text-white tracking-tighter flex items-center gap-3">
                LISTA DE BLOQUEADOS
                <span className={`text-xs px-3 py-1 rounded-md border font-black tracking-widest ${activeUnit === 'SP' ? 'bg-primary/20 text-primary border-primary/30' : 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'}`}>
                  UNIDADE {activeUnit}
                </span>
              </h1>
              <p className="text-text-muted text-sm mt-1 uppercase font-bold tracking-widest opacity-60">Controle estrito de acesso e permanência</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowHistoryModal(true)}
                className="bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all border border-white/10 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-xl">history</span>
                HISTÓRICO
              </button>
              <button
                onClick={() => setShowFormModal(true)}
                className="bg-primary text-white px-8 py-3 rounded-xl font-black text-sm transition-all shadow-lg shadow-primary/20 flex items-center gap-2 hover:scale-105 active:scale-95"
              >
                <span className="material-symbols-outlined text-xl font-bold">add</span>
                NOVO BLOQUEIO
              </button>
            </div>
          </div>

          <div className="liquid-glass rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/40 text-white/40 text-[10px] uppercase tracking-[0.2em] font-black border-b border-white/5">
                  <th className="p-6">Identificação</th>
                  <th className="p-6">Motivo do Bloqueio</th>
                  <th className="p-6 text-center">Data Início</th>
                  <th className="p-6 text-center">Data Limite</th>
                  <th className="p-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoading ? (
                  <tr>
                    <td colSpan="5" className="p-20 text-center text-white/20 animate-pulse font-black tracking-widest">
                      SINCRONIZANDO COM A CENTRAL...
                    </td>
                  </tr>
                ) : activeBlocked.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-20 text-center">
                      <div className="flex flex-col items-center opacity-20">
                        <span className="material-symbols-outlined text-8xl mb-4">verified_user</span>
                        <p className="text-xl font-black tracking-tighter">NENHUMA RESTRIÇÃO ATIVA</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  activeBlocked.map((item) => (
                    <tr key={item.id} className="hover:bg-white/[0.03] transition-colors group">
                      <td className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full border-2 border-white/10 overflow-hidden bg-black/40 flex-shrink-0">
                            {item.foto_url ? (
                              <img src={`${API_URL}${item.foto_url}`} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white/20">
                                <span className="material-symbols-outlined text-2xl">person</span>
                              </div>
                            )}
                          </div>
                          <span className="text-white font-bold text-base tracking-tight">{item.nome_completo}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-white/60 text-sm line-clamp-2 max-w-xs italic">
                          {item.motivo || <span className="opacity-30">Não especificado</span>}
                        </p>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-white/40 font-mono text-xs uppercase">{formatDate(item.data_inclusao, true)}</span>
                      </td>
                      <td className="p-4 text-center">
                        {item.data_limite ? (
                          <span className="px-3 py-1 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs font-black font-mono">
                            {formatDate(item.data_limite)}
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded bg-red-600 text-white text-[10px] font-black uppercase tracking-widest">PERMANENTE</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                          <button onClick={() => handleEditClick(item)} className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white flex items-center justify-center transition-all border border-blue-500/20">
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                          <button onClick={() => { setItemToRemove(item.id); setShowConfirmModal(true); }} className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all border border-red-500/20">
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {showFormModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="liquid-glass border border-white/20 p-8 rounded-[2rem] w-full max-w-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-3xl">gpp_maybe</span>
                {formData.id ? 'EDITAR REGISTRO' : 'ADICIONAR BLOQUEIO'}
              </h2>
              <button onClick={resetForm} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-6">
              <div className="col-span-1 flex flex-col gap-4">
                <div 
                  onClick={() => fileInputRef.current.click()}
                  className="aspect-square rounded-2xl bg-black/40 border-2 border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-all overflow-hidden relative group"
                >
                  {formData.fotoPreview ? (
                    <>
                      <img src={formData.fotoPreview} className="w-full h-full object-cover" alt="" />
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-xs font-black uppercase tracking-widest">Trocar Foto</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-4xl text-white/10 mb-2">add_a_photo</span>
                      <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Carregar Foto</span>
                    </>
                  )}
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                </div>
                
                <div className="flex items-center gap-3 bg-black/20 p-4 rounded-2xl border border-white/5">
                   <div 
                      onClick={() => setFormData(p => ({...p, blockAllUnits: !p.blockAllUnits}))}
                      className={`w-6 h-6 rounded border flex items-center justify-center cursor-pointer transition-all ${formData.blockAllUnits ? 'bg-primary border-primary shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'border-white/20 bg-black/40'}`}
                    >
                      {formData.blockAllUnits && <span className="material-symbols-outlined text-[16px] text-white font-black">check</span>}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-white leading-tight">BLOQUEAR REDE</span>
                      <span className="text-[10px] text-white/40 font-bold uppercase tracking-tighter">Inclui SP e BH simultaneamente</span>
                    </div>
                </div>
              </div>

              <div className="col-span-1 flex flex-col gap-5">
                <div>
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Nome Completo</label>
                  <input type="text" value={formData.nome} onChange={e => setFormData(p => ({...p, nome: e.target.value}))} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary transition-all font-bold" />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Motivo / Incidente</label>
                  <textarea rows="3" value={formData.motivo} onChange={e => setFormData(p => ({...p, motivo: e.target.value}))} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary transition-all text-sm resize-none" placeholder="Descreva o ocorrido..."></textarea>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest">Expiração do Bloqueio</label>
                    <div onClick={() => setFormData(p => ({...p, isPermanent: !p.isPermanent}))} className="flex items-center gap-2 cursor-pointer group">
                       <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${formData.isPermanent ? 'text-red-500' : 'text-white/20 group-hover:text-white/40'}`}>Indeterminado</span>
                       <div className={`w-4 h-4 rounded border flex items-center justify-center ${formData.isPermanent ? 'bg-red-600 border-red-500' : 'border-white/10'}`}>
                         {formData.isPermanent && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                       </div>
                    </div>
                  </div>
                  <input type="date" value={formData.dataLimite} onChange={e => setFormData(p => ({...p, dataLimite: e.target.value}))} disabled={formData.isPermanent} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary transition-all font-mono [color-scheme:dark] disabled:opacity-20" />
                </div>
              </div>

              <div className="col-span-2 pt-4 border-t border-white/5 flex gap-4">
                <button type="button" onClick={resetForm} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-black py-4 rounded-2xl transition-all border border-white/10 uppercase tracking-widest text-xs">Descartar</button>
                <button type="submit" className="flex-[2] bg-primary text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 uppercase tracking-widest text-sm hover:scale-[1.02] active:scale-95 transition-all">
                  {formData.id ? 'SALVAR ALTERAÇÕES' : 'CONFIRMAR BLOQUEIO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="liquid-glass border border-white/20 p-8 rounded-[2.5rem] w-full max-w-5xl shadow-2xl flex flex-col max-h-[85vh]">
             <div className="flex justify-between items-center mb-8 shrink-0">
               <h2 className="text-3xl font-black text-white tracking-tighter">HISTÓRICO DE LIBERAÇÕES</h2>
               <button onClick={() => setShowHistoryModal(false)} className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white border border-white/10 transition-all">
                 <span className="material-symbols-outlined">close</span>
               </button>
             </div>
             
             <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 -mr-4">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-[#0a0a0a] z-10">
                    <tr className="text-white/20 text-[10px] uppercase tracking-[0.3em] font-black border-b border-white/5">
                      <th className="pb-4">Sujeito</th>
                      <th className="pb-4">Original Unit</th>
                      <th className="pb-4 text-center">Período de Bloqueio</th>
                      <th className="pb-4 text-right">Data de Remoção</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {historyBlocked.length === 0 ? (
                      <tr><td colSpan="4" className="py-20 text-center text-white/10 font-black tracking-widest">HISTÓRICO LIMPO</td></tr>
                    ) : (
                      historyBlocked.map(item => (
                        <tr key={item.id} className="hover:bg-white/[0.02]">
                          <td className="py-4">
                            <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded-full overflow-hidden bg-white/5 grayscale">
                                 {item.foto_url && <img src={`${API_URL}${item.foto_url}`} className="w-full h-full object-cover opacity-50" alt="" />}
                               </div>
                               <span className="text-white/80 font-bold">{item.nome_completo}</span>
                            </div>
                          </td>
                          <td className="py-4">
                            <span className="text-[10px] font-black text-white/30 border border-white/10 px-2 py-1 rounded">{item.unidade}</span>
                          </td>
                          <td className="py-4 text-center">
                            <p className="text-[10px] text-white/40 uppercase font-bold">Desde: {formatDate(item.data_inclusao)}</p>
                          </td>
                          <td className="py-4 text-right">
                             <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 text-[10px] font-black uppercase">LIBERADO EM {formatDate(item.data_remocao)}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
             </div>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in zoom-in duration-200">
           <div className="bg-[#121212] border border-white/10 p-10 rounded-[3rem] max-w-sm w-full text-center shadow-[0_0_100px_rgba(239,68,68,0.2)]">
              <div className="w-24 h-24 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-8 animate-pulse">
                <span className="material-symbols-outlined text-5xl text-red-600 font-bold">priority_high</span>
              </div>
              <h3 className="text-2xl font-black text-white mb-3 tracking-tighter uppercase">Remover Restrição?</h3>
              <p className="text-white/40 text-sm mb-10 font-bold leading-relaxed uppercase tracking-tighter">O indivíduo terá acesso liberado imediatamente. Este registro será arquivado no histórico.</p>
              <div className="flex gap-4">
                <button onClick={() => setShowConfirmModal(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-black py-4 rounded-2xl transition-all border border-white/10 uppercase tracking-widest text-xs">Manter</button>
                <button onClick={confirmRemove} className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-lg shadow-red-900/40 hover:scale-105 active:scale-95 transition-all">Remover</button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
}