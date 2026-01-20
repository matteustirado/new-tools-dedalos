import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../../components/Sidebar';
import axios from 'axios';
import { toast } from 'react-toastify';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function NameTagGenerator() {
    const [employees, setEmployees] = useState([]);
    const [search, setSearch] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const [loading, setLoading] = useState(true);
    
    // Estado para o Modal de Edição/Visualização
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [isWildcard, setIsWildcard] = useState(false);

    // Refs para upload de foto
    const fileInputRef = useRef(null);

    // 1. Carregar e Sincronizar Dados
    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/people/sync`);
            setEmployees(res.data);
        } catch (error) {
            console.error("Erro ao carregar colaboradores:", error);
            toast.error("Erro ao sincronizar lista de colaboradores.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEmployees();
    }, []);

    // 2. Filtros e Lógica de Exibição
    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = emp.name.toLowerCase().includes(search.toLowerCase()) || 
                              emp.cpf.includes(search);
        const matchesStatus = showArchived ? emp.status === 'archived' : emp.status === 'active';
        return matchesSearch && matchesStatus;
    });

    // 3. Verifica se o cadastro está completo (para a Aura Verde)
    const isIncomplete = (emp) => {
        return emp.is_new || !emp.role || !emp.photo_url || !emp.admission_date;
    };

    // 4. Manipuladores de Ação
    const handleCardClick = (emp) => {
        setSelectedEmployee({ ...emp }); // Cria uma cópia para edição
        setIsWildcard(false);
    };

    const handleWildcardClick = () => {
        setSelectedEmployee({
            name: "NOME DO COLABORADOR",
            role: "CARGO / FUNÇÃO",
            cpf: "000.000.000-00",
            admission_date: "",
            registration_code: "0000",
            photo_url: null,
            unit: "SP"
        });
        setIsWildcard(true);
    };

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Se for coringa, apenas preview local
        if (isWildcard) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSelectedEmployee(prev => ({ ...prev, photo_url: reader.result }));
            };
            reader.readAsDataURL(file);
            return;
        }

        // Se for funcionário real, upload para o servidor
        const formData = new FormData();
        formData.append('photo', file);

        try {
            const res = await axios.post(`${API_URL}/api/people/upload`, formData);
            setSelectedEmployee(prev => ({ ...prev, photo_url: `${API_URL}${res.data.url}` }));
        } catch (error) {
            console.error("Erro upload:", error);
            toast.error("Erro ao enviar foto.");
        }
    };

    const handleSave = async () => {
        if (isWildcard) {
            toast.info("Crachá coringa pronto para impressão (não salvo no banco).");
            return;
        }

        try {
            await axios.post(`${API_URL}/api/people/update/${selectedEmployee.id}`, selectedEmployee);
            toast.success("Dados salvos com sucesso!");
            fetchEmployees(); // Atualiza a lista de fundo
            // Não fecha o modal, para permitir imprimir logo em seguida
        } catch (error) {
            console.error("Erro ao salvar:", error);
            toast.error("Erro ao salvar dados.");
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex">
            <Sidebar activePage="nametag" headerTitle="Gestão de Pessoas" headerIcon="groups" group="people" />

            <main className="ml-64 flex-1 p-8 print:ml-0 print:p-0">
                {/* CABEÇALHO (Escondido na impressão) */}
                <div className="flex justify-between items-center mb-8 print:hidden">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-1">Gerador de Crachá</h1>
                        <p className="text-white/50">Gestão e impressão de identificação funcional.</p>
                    </div>
                    <button 
                        onClick={() => setShowArchived(!showArchived)}
                        className={`px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2 ${showArchived ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                    >
                        <span className="material-symbols-outlined">archive</span>
                        {showArchived ? 'Visualizando Arquivados' : 'Ver Arquivados'}
                    </button>
                </div>

                {/* BUSCA (Escondido na impressão) */}
                <div className="relative mb-8 print:hidden">
                    <input 
                        type="text" 
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por Nome ou CPF..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <span className="material-symbols-outlined absolute left-4 top-3 text-white/50">search</span>
                </div>

                {/* GRID DE CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 print:hidden">
                    {/* CARD CORINGA */}
                    {!showArchived && (
                        <div 
                            onClick={handleWildcardClick}
                            className="bg-white/5 border-2 border-dashed border-white/20 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 transition-all group min-h-[350px]"
                        >
                            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-3xl text-white/50">add</span>
                            </div>
                            <h3 className="text-white font-bold text-lg text-center">CRIAR NOVO<br/>"NÃO LISTADO"</h3>
                            <p className="text-white/30 text-xs mt-2 text-center">Crachá temporário sem salvar no banco.</p>
                        </div>
                    )}

                    {loading ? (
                        <p className="text-white/50 col-span-full text-center py-10">Sincronizando com RH...</p>
                    ) : (
                        filteredEmployees.map(emp => (
                            <div 
                                key={emp.id}
                                onClick={() => handleCardClick(emp)}
                                className={`relative bg-[#1a1a1a] rounded-2xl overflow-hidden cursor-pointer hover:-translate-y-1 transition-transform shadow-xl group
                                    ${isIncomplete(emp) ? 'ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'border border-white/10'}
                                `}
                            >
                                {isIncomplete(emp) && (
                                    <div className="absolute top-2 right-2 bg-emerald-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full z-10 animate-pulse">
                                        PENDENTE
                                    </div>
                                )}
                                
                                <div className="h-24 bg-gradient-to-r from-slate-800 to-slate-900 relative">
                                    <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
                                        <div className="w-20 h-20 rounded-full border-4 border-[#1a1a1a] bg-gray-700 overflow-hidden flex items-center justify-center">
                                            {emp.photo_url ? (
                                                <img src={emp.photo_url.startsWith('http') ? emp.photo_url : `${API_URL}${emp.photo_url}`} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="material-symbols-outlined text-3xl text-white/30">person</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-10 pb-6 px-4 text-center">
                                    <h3 className="text-white font-bold truncate">{emp.name}</h3>
                                    <p className="text-emerald-400 text-xs font-bold uppercase mt-1">{emp.role || 'Cargo não definido'}</p>
                                    <p className="text-white/30 text-xs mt-3">CPF: {emp.cpf}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* MODAL DE EDIÇÃO E IMPRESSÃO */}
                {selectedEmployee && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 overflow-y-auto print:static print:bg-white print:p-0 print:block">
                        
                        {/* BOTÃO FECHAR (Escondido na impressão) */}
                        <button 
                            onClick={() => setSelectedEmployee(null)}
                            className="absolute top-4 right-4 text-white/50 hover:text-white print:hidden z-50"
                        >
                            <span className="material-symbols-outlined text-4xl">close</span>
                        </button>

                        <div className="flex flex-col md:flex-row gap-8 max-w-5xl w-full print:hidden">
                            {/* LADO ESQUERDO: FORMULÁRIO */}
                            <div className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-3xl p-6">
                                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-emerald-500">edit</span>
                                    Editar Dados
                                </h2>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-white/50 uppercase font-bold ml-1">Nome Completo</label>
                                        <input 
                                            type="text" 
                                            value={selectedEmployee.name}
                                            onChange={e => setSelectedEmployee({...selectedEmployee, name: e.target.value})}
                                            className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-white/50 uppercase font-bold ml-1">CPF (Inalterável)</label>
                                            <input 
                                                type="text" 
                                                value={selectedEmployee.cpf}
                                                disabled
                                                className="w-full bg-white/5 border border-transparent rounded-lg p-3 text-white/50 cursor-not-allowed"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-white/50 uppercase font-bold ml-1">Data Admissão</label>
                                            <input 
                                                type="date" 
                                                value={selectedEmployee.admission_date ? selectedEmployee.admission_date.split('T')[0] : ''}
                                                onChange={e => setSelectedEmployee({...selectedEmployee, admission_date: e.target.value})}
                                                className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-white/50 uppercase font-bold ml-1">Cargo</label>
                                            <input 
                                                type="text" 
                                                value={selectedEmployee.role || ''}
                                                onChange={e => setSelectedEmployee({...selectedEmployee, role: e.target.value})}
                                                className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                                                placeholder="Ex: Bartender"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-white/50 uppercase font-bold ml-1">Cód. Registro</label>
                                            <input 
                                                type="text" 
                                                value={selectedEmployee.registration_code || ''}
                                                onChange={e => setSelectedEmployee({...selectedEmployee, registration_code: e.target.value})}
                                                className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                                                placeholder="Ex: 1234"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs text-white/50 uppercase font-bold ml-1">Foto</label>
                                        <input 
                                            type="file" 
                                            ref={fileInputRef}
                                            onChange={handlePhotoUpload}
                                            className="hidden"
                                            accept="image/*"
                                        />
                                        <button 
                                            onClick={() => fileInputRef.current.click()}
                                            className="w-full bg-white/5 hover:bg-white/10 border border-dashed border-white/20 rounded-lg p-4 text-white/70 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined">cloud_upload</span>
                                            {selectedEmployee.photo_url ? 'Alterar Foto' : 'Enviar Foto'}
                                        </button>
                                    </div>

                                    <div className="flex gap-3 mt-6 pt-6 border-t border-white/10">
                                        {!isWildcard && (
                                            <button 
                                                onClick={handleSave}
                                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-colors shadow-lg"
                                            >
                                                SALVAR DADOS
                                            </button>
                                        )}
                                        <button 
                                            onClick={handlePrint}
                                            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined">print</span>
                                            IMPRIMIR PDF
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* LADO DIREITO: PREVIEW (Isso será o que imprime) */}
                            <div className="flex items-center justify-center">
                                {/* ÁREA DE IMPRESSÃO EXATA */}
                                <div id="badge-print-area" className="w-[320px] h-[480px] bg-black relative overflow-hidden shadow-2xl flex flex-col text-center print:shadow-none print:m-0 print:w-full print:h-full print:absolute print:top-0 print:left-0">
                                    
                                    {/* Design do Crachá */}
                                    <div className="absolute top-0 left-0 w-full h-[140px] bg-gradient-to-b from-blue-900 to-black z-0"></div>
                                    
                                    <div className="relative z-10 pt-10 px-6 flex flex-col items-center h-full">
                                        <div className="mb-6">
                                            <h2 className="text-3xl font-black text-white tracking-[0.2em]">DEDALOS</h2>
                                            <p className="text-[10px] text-blue-300 tracking-[0.5em] uppercase mt-1">BAR</p>
                                        </div>

                                        <div className="w-40 h-40 rounded-full border-4 border-white/20 bg-gray-800 overflow-hidden mb-6 shadow-xl relative">
                                            {selectedEmployee.photo_url ? (
                                                <img 
                                                    src={selectedEmployee.photo_url.startsWith('http') || selectedEmployee.photo_url.startsWith('data:') ? selectedEmployee.photo_url : `${API_URL}${selectedEmployee.photo_url}`} 
                                                    alt="Foto" 
                                                    className="w-full h-full object-cover" 
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gray-700">
                                                    <span className="material-symbols-outlined text-6xl text-white/20">person</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="w-full">
                                            <h1 className="text-2xl font-bold text-white uppercase leading-tight mb-2 break-words">
                                                {selectedEmployee.name || "NOME"}
                                            </h1>
                                            <div className="h-1 w-12 bg-blue-500 mx-auto mb-3"></div>
                                            <p className="text-lg text-blue-200 uppercase font-medium tracking-wider">
                                                {selectedEmployee.role || "CARGO"}
                                            </p>
                                        </div>

                                        <div className="mt-auto mb-8 w-full flex justify-between px-4 text-[10px] text-white/30 uppercase tracking-widest border-t border-white/10 pt-4">
                                            <span>{selectedEmployee.unit}</span>
                                            <span>ID: {selectedEmployee.registration_code || "---"}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ESTILO DE IMPRESSÃO ESPECÍFICO */}
                        <div className="hidden print:block fixed inset-0 bg-white z-[100]">
                            <style>{`
                                @media print {
                                    @page {
                                        size: auto;
                                        margin: 0mm;
                                    }
                                    body {
                                        background: white;
                                    }
                                    body * {
                                        visibility: hidden;
                                    }
                                    #badge-print-area, #badge-print-area * {
                                        visibility: visible;
                                    }
                                    #badge-print-area {
                                        position: absolute;
                                        left: 50%;
                                        top: 50%;
                                        transform: translate(-50%, -50%);
                                        width: 85mm; /* Tamanho padrão de crachá */
                                        height: 54mm; /* Se for horizontal, ou inverta para vertical */
                                        border: 1px solid #ccc; /* Linha de corte opcional */
                                        -webkit-print-color-adjust: exact;
                                        print-color-adjust: exact;
                                    }
                                    /* Ajuste para vertical se preferir */
                                    #badge-print-area {
                                        width: 320px;
                                        height: 480px;
                                    }
                                }
                            `}</style>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}