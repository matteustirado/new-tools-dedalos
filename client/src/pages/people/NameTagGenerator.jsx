import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../../components/Sidebar';
import BadgeTemplate from '../../components/BadgeTemplate';
import axios from 'axios';
import { toast } from 'react-toastify';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function NameTagGenerator() {
    const [employees, setEmployees] = useState([]);
    const [search, setSearch] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [isWildcard, setIsWildcard] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [currentConfig, setCurrentConfig] = useState({});

    const fileInputRef = useRef(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const activeUnit = localStorage.getItem('dedalos_active_unit') || 'sp';
            const [empRes, templRes] = await Promise.all([
                axios.get(`${API_URL}/api/people/list?unit=${activeUnit}`),
                axios.get(`${API_URL}/api/badges/templates`)
            ]);
            
            setEmployees(Array.isArray(empRes.data) ? empRes.data : []);
            setTemplates(Array.isArray(templRes.data) ? templRes.data : []);
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
            toast.error("Erro de conexão com o servidor.");
            setEmployees([]); 
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        const toastId = toast.loading("Sincronizando com o RH...");
        
        try {
            const activeUnit = localStorage.getItem('dedalos_active_unit') || 'sp';
            const res = await axios.get(`${API_URL}/api/people/sync?unit=${activeUnit}`);
            
            if (Array.isArray(res.data)) {
                setEmployees(res.data);
                toast.update(toastId, { render: "Sincronização concluída!", type: "success", isLoading: false, autoClose: 3000 });
            }
        } catch (error) {
            console.error(error);
            toast.update(toastId, { render: "Erro na sincronização.", type: "error", isLoading: false, autoClose: 3000 });
        } finally {
            setSyncing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (!selectedEmployee) return;
        const role = selectedEmployee.role ? selectedEmployee.role.toUpperCase() : '';
        const template = templates.find(t => t.role_name === role) || templates.find(t => t.role_name === 'PADRAO');
        
        if (template) {
            const cfg = typeof template.config === 'string' ? JSON.parse(template.config) : template.config;
            setCurrentConfig(cfg);
        } else {
            setCurrentConfig({});
        }
    }, [selectedEmployee?.role, templates]);

    const fixDateForDisplay = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() + userTimezoneOffset).toISOString();
    };

    const isComplete = (emp) => {
        return emp.role && emp.photo_url && emp.admission_date && emp.cpf;
    };

    const filteredEmployees = employees.filter(emp => {
        const lowerSearch = search.toLowerCase();
        const matchesSearch = (emp.name && emp.name.toLowerCase().includes(lowerSearch)) || 
                              (emp.cpf && emp.cpf.includes(lowerSearch));
        
        const status = emp.status || 'active'; 
        const matchesStatus = showArchived ? status === 'archived' : status !== 'archived';
        
        return matchesSearch && matchesStatus;
    });

    const generatePDF = async (elementId, fileName) => {
        const element = document.getElementById(elementId);
        if (!element) {
            toast.error("Erro: Elemento visual não encontrado.");
            return;
        }

        const toastId = toast.loading("Gerando PDF...");

        try {
            const canvas = await html2canvas(element, {
                scale: 4, 
                useCORS: true, 
                backgroundColor: null,
                logging: false
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('l', 'mm', [85.6, 54]);
            pdf.addImage(imgData, 'PNG', 0, 0, 85.6, 54);
            pdf.save(`${fileName}.pdf`);
            
            toast.update(toastId, { render: "PDF Baixado com sucesso!", type: "success", isLoading: false, autoClose: 3000 });
        } catch (error) {
            console.error(error);
            toast.update(toastId, { render: "Falha ao gerar PDF.", type: "error", isLoading: false, autoClose: 3000 });
        }
    };

    const handleCardClick = (emp) => {
        let admissionDate = '';
        if (emp.admission_date) {
             admissionDate = new Date(emp.admission_date).toISOString().split('T')[0];
        }
        
        setSelectedEmployee({ 
            ...emp, 
            admission_date: admissionDate,
            photo_scale: emp.photo_scale || 1,
            photo_x: emp.photo_x || 0,
            photo_y: emp.photo_y || 0
        });
        setIsWildcard(false);
    };

    const handleWildcardClick = () => {
        const activeUnit = localStorage.getItem('dedalos_active_unit') || 'sp';
        
        setSelectedEmployee({
            name: "NOME SOBRENOME",
            role: "CARGO / FUNÇÃO",
            cpf: "000.000.000-00",
            admission_date: new Date().toISOString().split('T')[0],
            photo_url: null,
            unit: activeUnit,
            status: 'active',
            photo_scale: 1,
            photo_x: 0,
            photo_y: 0
        });
        setIsWildcard(true);
    };

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (isWildcard) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSelectedEmployee(prev => ({ ...prev, photo_url: reader.result }));
            };
            reader.readAsDataURL(file);
            return;
        }

        const formData = new FormData();
        formData.append('photo', file);

        try {
            const res = await axios.post(`${API_URL}/api/people/upload`, formData);
            setSelectedEmployee(prev => ({ ...prev, photo_url: `${API_URL}${res.data.url}` }));
        } catch (error) {
            toast.error("Erro no upload da imagem.");
        }
    };

    const handleSave = async () => {
        if (isWildcard) {
            generatePDF('badge-modal-preview', `CRACHA_CORINGA`);
            return;
        }
        try {
            const statusToSave = selectedEmployee.status || 'active';
            await axios.post(`${API_URL}/api/people/update/${selectedEmployee.id}`, { 
                ...selectedEmployee, 
                status: statusToSave 
            });
            toast.success("Dados salvos!");
            fetchData();
        } catch (error) {
            toast.error("Erro ao salvar.");
        }
    };

    const handleArchive = async (e, emp) => {
        e.stopPropagation();
        const currentStatus = emp.status || 'active';
        const newStatus = currentStatus === 'active' ? 'archived' : 'active';
        
        try {
            await axios.post(`${API_URL}/api/people/update/${emp.id}`, { ...emp, status: newStatus });
            
            toast.info(
                <div>
                    <span className="font-bold">{emp.name}</span> foi {newStatus === 'archived' ? 'arquivado' : 'ativado'}.
                </div>,
                { icon: newStatus === 'archived' ? '📁' : '✅', autoClose: 2000 }
            );
            
            setEmployees(prev => prev.map(p => p.id === emp.id ? { ...p, status: newStatus } : p));
        } catch (error) {
            toast.error("Erro ao alterar status.");
        }
    };

    const handleQuickPrint = (e, emp) => {
        e.stopPropagation();
        const safeName = emp.name.replace(/\s+/g, '_').toUpperCase();
        generatePDF(`badge-card-${emp.id}`, `CRACHA_${safeName}`);
    };

    const handleEdit = (e, emp) => {
        e.stopPropagation();
        handleCardClick(emp);
    }

    const handleModalPrint = () => {
        const name = selectedEmployee.name ? selectedEmployee.name.replace(/\s+/g, '_').toUpperCase() : 'CRACHA';
        generatePDF('badge-modal-preview', `CRACHA_${name}`);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex">
            <Sidebar activePage="generator" headerTitle="Gerador de Crachá" headerIcon="badge" group="identification" />

            <main className="ml-64 flex-1 p-8">
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-1">Gerador de Crachá</h1>
                            <p className="text-white/50">Modelo Oficial Dédalos Bar</p>
                        </div>
                        
                        <button 
                            onClick={handleSync}
                            disabled={syncing}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${syncing ? 'bg-blue-600/50 cursor-wait' : 'bg-blue-600 hover:bg-blue-500'} text-white shadow-lg`}
                        >
                            <span className={`material-symbols-outlined ${syncing ? 'animate-spin' : ''}`}>sync</span>
                            {syncing ? 'Sincronizando...' : 'Sincronizar RH'}
                        </button>
                    </div>

                    <button 
                        onClick={() => setShowArchived(!showArchived)}
                        className={`px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 ${showArchived ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                    >
                        <span className="material-symbols-outlined">{showArchived ? 'inventory_2' : 'archive'}</span>
                        {showArchived ? 'Voltar para Ativos' : 'Ver Arquivados'}
                    </button>
                </div>

                <div className="relative mb-8">
                    <input 
                        type="text" 
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por Nome ou CPF..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-colors placeholder-white/30"
                    />
                    <span className="material-symbols-outlined absolute left-4 top-3 text-white/50">search</span>
                </div>

                {!loading && filteredEmployees.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-white/30 border-2 border-dashed border-white/5 rounded-3xl">
                        <span className="material-symbols-outlined text-6xl mb-4">
                            {showArchived ? 'folder_off' : 'search_off'}
                        </span>
                        <p className="text-xl font-medium">
                            {showArchived ? 'Nenhum colaborador arquivado.' : 'Nenhum colaborador encontrado.'}
                        </p>
                        {showArchived && (
                            <button onClick={() => setShowArchived(false)} className="mt-4 text-orange-400 hover:underline">
                                Voltar para lista ativa
                            </button>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                    {!showArchived && !search && (
                        <div 
                            onClick={handleWildcardClick}
                            className="bg-white/5 border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 transition-all group relative aspect-[1.7/1]"
                        >
                            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-2xl text-white/50">add</span>
                            </div>
                            <h3 className="text-white font-bold text-sm text-center leading-tight">CRIAR NOVO<br/>"NÃO LISTADO"</h3>
                        </div>
                    )}

                    {filteredEmployees.map(emp => {
                        const role = emp.role ? emp.role.toUpperCase() : '';
                        const t = templates.find(x => x.role_name === role) || templates.find(x => x.role_name === 'PADRAO');
                        const cfg = t ? (typeof t.config === 'string' ? JSON.parse(t.config) : t.config) : {};
                        const displayEmp = { ...emp, admission_date: fixDateForDisplay(emp.admission_date) };

                        return (
                            <div 
                                key={emp.id}
                                className={`relative rounded-xl overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform shadow-2xl group aspect-[1.7/1]
                                    ${!isComplete(emp) ? 'ring-2 ring-emerald-500' : 'border border-white/10'}
                                    ${emp.status === 'archived' ? 'opacity-75 grayscale-[0.5]' : ''}
                                `}
                            >
                                {!isComplete(emp) && emp.status !== 'archived' && (
                                    <div className="absolute top-2 right-2 bg-emerald-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full z-50 animate-pulse pointer-events-none">
                                        PENDENTE
                                    </div>
                                )}

                                {emp.status === 'archived' && (
                                    <div className="absolute top-2 right-2 bg-orange-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full z-50 pointer-events-none flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[10px]">inventory_2</span> ARQUIVADO
                                    </div>
                                )}
                                
                                <div id={`badge-card-${emp.id}`} className="w-full h-full flex items-center justify-center bg-black/80">
                                    <div style={{ transform: 'scale(0.45)', transformOrigin: 'center' }}>
                                        <BadgeTemplate data={displayEmp} config={cfg} />
                                    </div>
                                </div>
                                
                                <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 z-50 backdrop-blur-sm"
                                     onClick={() => handleCardClick(emp)}>
                                    <button onClick={(e) => handleEdit(e, emp)} className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform" title="Editar Dados"><span className="material-symbols-outlined text-lg">edit</span></button>
                                    <button onClick={(e) => handleQuickPrint(e, emp)} className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform" title="Baixar PDF"><span className="material-symbols-outlined text-lg">download</span></button>
                                    <button onClick={(e) => handleArchive(e, emp)} className={`w-10 h-10 rounded-full text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform ${showArchived ? 'bg-green-600 hover:bg-green-500' : 'bg-orange-600 hover:bg-orange-500'}`} title={showArchived ? "Ativar" : "Arquivar"}><span className="material-symbols-outlined text-lg">{showArchived ? 'unarchive' : 'archive'}</span></button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {selectedEmployee && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
                        <button onClick={() => setSelectedEmployee(null)} className="absolute top-4 right-4 text-white/50 hover:text-white z-50"><span className="material-symbols-outlined text-4xl">close</span></button>

                        <div className="flex flex-col md:flex-row gap-8 max-w-7xl w-full h-[90vh]">
                            <div className="w-1/3 bg-[#1a1a1a] border border-white/10 rounded-3xl p-6 overflow-y-auto custom-scrollbar">
                                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[#FF6600]">edit_square</span> Editar Dados
                                </h2>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-white/50 uppercase font-bold ml-1">Nome Completo</label>
                                        <input type="text" value={selectedEmployee.name} onChange={e => setSelectedEmployee({...selectedEmployee, name: e.target.value.toUpperCase()})} className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-[#FF6600] outline-none uppercase font-bold" />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-white/50 uppercase font-bold ml-1">Cargo</label>
                                            <input type="text" list="roles-list" value={selectedEmployee.role || ''} onChange={e => setSelectedEmployee({...selectedEmployee, role: e.target.value.toUpperCase()})} className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-[#FF6600] outline-none uppercase" />
                                            <datalist id="roles-list">{templates.filter(t => t.role_name !== 'PADRAO').map(t => (<option key={t.id} value={t.role_name} />))}</datalist>
                                        </div>
                                        <div>
                                            <label className="text-xs text-white/50 uppercase font-bold ml-1">Admissão</label>
                                            <input type="date" value={selectedEmployee.admission_date} onChange={e => setSelectedEmployee({...selectedEmployee, admission_date: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-[#FF6600] outline-none" />
                                        </div>
                                    </div>

                                    <div className="w-full">
                                        <label className="text-xs text-white/50 uppercase font-bold ml-1">Cód. Registro</label>
                                        <input 
                                            type="text" 
                                            value={selectedEmployee.cpf} 
                                            disabled={!isWildcard} 
                                            onChange={isWildcard ? (e) => setSelectedEmployee({...selectedEmployee, cpf: e.target.value}) : undefined}
                                            className={`w-full border border-white/10 rounded-lg p-3 text-white focus:border-[#FF6600] outline-none font-mono ${!isWildcard ? 'bg-white/5 text-white/50 cursor-not-allowed' : 'bg-black/30'}`} 
                                        />
                                    </div>

                                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 mt-4">
                                        <label className="text-xs text-orange-400 uppercase font-bold mb-3 block flex items-center gap-1"><span className="material-symbols-outlined text-sm">tune</span> Ajustar Foto</label>
                                        
                                        <div className="flex gap-3 items-center mb-4">
                                            <div className="w-12 h-12 bg-black/50 rounded-lg overflow-hidden border border-white/10 flex-shrink-0">
                                                {selectedEmployee.photo_url ? (
                                                    <img src={selectedEmployee.photo_url.startsWith('http') || selectedEmployee.photo_url.startsWith('data:') ? selectedEmployee.photo_url : `${API_URL}${selectedEmployee.photo_url}`} className="w-full h-full object-cover" />
                                                ) : <div className="w-full h-full flex items-center justify-center text-white/20"><span className="material-symbols-outlined">person</span></div>}
                                            </div>
                                            <button onClick={() => fileInputRef.current.click()} className="flex-1 bg-white/5 hover:bg-white/10 border border-dashed border-white/20 rounded-lg p-2 text-xs text-white transition-colors">Trocar Imagem</button>
                                            <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} className="hidden" accept="image/*" />
                                        </div>

                                        <div className="space-y-3">
                                            <div>
                                                <div className="flex justify-between mb-1"><label className="text-[10px] text-white/50">Zoom</label><span className="text-[10px] text-white">{selectedEmployee.photo_scale || 1}x</span></div>
                                                <input type="range" min="1" max="3" step="0.1" value={selectedEmployee.photo_scale || 1} onChange={e => setSelectedEmployee({...selectedEmployee, photo_scale: parseFloat(e.target.value)})} className="w-full accent-orange-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" />
                                            </div>
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <label className="text-[10px] text-white/50 block mb-1">Posição X</label>
                                                    <input type="range" min="-100" max="100" value={selectedEmployee.photo_x || 0} onChange={e => setSelectedEmployee({...selectedEmployee, photo_x: parseInt(e.target.value)})} className="w-full accent-blue-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-[10px] text-white/50 block mb-1">Posição Y</label>
                                                    <input type="range" min="-100" max="100" value={selectedEmployee.photo_y || 0} onChange={e => setSelectedEmployee({...selectedEmployee, photo_y: parseInt(e.target.value)})} className="w-full accent-blue-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-3 mt-6 pt-6 border-t border-white/10">
                                        {!isWildcard && <button onClick={handleSave} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg transition-transform hover:scale-[1.02]">SALVAR DADOS</button>}
                                        <button onClick={handleModalPrint} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]"><span className="material-symbols-outlined">download</span> BAIXAR PDF</button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col items-center justify-center bg-black/20 rounded-3xl border-2 border-dashed border-white/10 relative p-8">
                                <h3 className="absolute top-6 left-0 w-full text-center text-white/20 font-bold uppercase tracking-[0.3em]">Preview Final</h3>
                                <div id="badge-modal-preview" className="transform scale-125 origin-center shadow-2xl">
                                    <BadgeTemplate data={{...selectedEmployee, admission_date: fixDateForDisplay(selectedEmployee.admission_date)}} config={currentConfig} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}