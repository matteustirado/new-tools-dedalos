import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import Sidebar from '../../components/Sidebar';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const calcularDistanciaMetros = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    
    const R = 6371e3; 
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const deltaP = (lat2 - lat1) * Math.PI / 180;
    const deltaLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(deltaP / 2) * Math.sin(deltaP / 2) + 
              Math.cos(p1) * Math.cos(p2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return Math.round(R * c);
};

export default function GymControl() {
    const [pending, setPending] = useState([]);
    const [users, setUsers] = useState([]);
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);

    const [photoModal, setPhotoModal] = useState(null);
    const [locationModal, setLocationModal] = useState(null);
    const [newGymName, setNewGymName] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [pendRes, usersRes, locRes] = await Promise.all([
                axios.get(`${API_URL}/api/gym/pending`),
                axios.get(`${API_URL}/api/gym/users`),
                axios.get(`${API_URL}/api/gym/locations`)
            ]);
            
            setPending(pendRes.data);
            setUsers(usersRes.data);
            setLocations(locRes.data);
        } catch (err) {
            toast.error("Erro ao carregar dados do painel.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleModerate = async (id, field, value) => {
        try {
            await axios.put(`${API_URL}/api/gym/moderate/${id}`, { [field]: value });
            toast.success("Opção registada.");
            
            setPending(prev => prev.map(p => {
                if (p.id === id) {
                    const updated = { ...p, [field]: value };
                    if (updated.imagem_valida !== null && updated.localizacao_valida !== null) {
                        return null;
                    }
                    return updated;
                }
                return p;
            }).filter(Boolean));
        } catch (err) {
            toast.error("Erro ao moderar check-in.");
        }
    };

    const handleLinkExistingLocation = async (checkin, locationId) => {
        try {
            await axios.put(`${API_URL}/api/gym/moderate/${checkin.id}`, { 
                localizacao_valida: 1, 
                gym_location_id: locationId 
            });
            toast.success("Academia vinculada com sucesso!");
            setLocationModal(null);
            fetchData();
        } catch (err) {
            toast.error("Erro ao vincular academia.");
        }
    };

    const handleCreateNewLocation = async (checkin) => {
        if (!newGymName) return toast.warning("Digite o nome da academia.");
        
        try {
            const res = await axios.post(`${API_URL}/api/gym/locations`, {
                nome: newGymName,
                latitude: checkin.latitude,
                longitude: checkin.longitude,
                raio_metros: 100
            });
            
            await handleLinkExistingLocation(checkin, res.data.location_id);
            setNewGymName('');
        } catch (err) {
            toast.error("Erro ao criar nova academia.");
        }
    };

    const handleSyncUsers = async () => {
        try {
            const res = await axios.post(`${API_URL}/api/gym/sync-users`);
            toast.success(res.data.message);
            fetchData();
        } catch (err) {
            toast.error("Erro ao sincronizar colaboradores.");
        }
    };

    const handleToggleBlock = async (cpf, currentStatus) => {
        try {
            const newStatus = !currentStatus;
            await axios.put(`${API_URL}/api/gym/users/${cpf}/toggle-block`, { is_blocked: newStatus });
            toast.info(newStatus ? "Utilizador bloqueado." : "Utilizador desbloqueado.");
            setUsers(users.map(u => u.cpf === cpf ? { ...u, is_blocked: newStatus } : u));
        } catch (err) {
            toast.error("Erro ao alterar bloqueio.");
        }
    };

    const handleResetPassword = async (cpf) => {
        if (!window.confirm("Deseja repor a palavra-passe para o padrão (Nome + 5 dígitos do CPF)?")) return;
        
        try {
            const res = await axios.put(`${API_URL}/api/gym/users/${cpf}/reset-password`);
            toast.success(`Palavra-passe reposta! Nova: ${res.data.defaultPassword}`);
            setUsers(users.map(u => u.cpf === cpf ? { ...u, must_change_password: 1 } : u));
        } catch (err) {
            toast.error("Erro ao repor a palavra-passe.");
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] flex selection:bg-emerald-500/30">
            <Sidebar activePage="gym-control" group="people" />

            {photoModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in duration-300" onClick={() => setPhotoModal(null)}>
                    <div className="relative max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden border border-white/20 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setPhotoModal(null)} className="absolute top-4 right-4 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center border border-white/10 hover:bg-red-500 transition-colors z-10">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                        <img src={`${API_URL}${photoModal}`} className="w-full h-full object-contain" alt="Treino Expandido" />
                    </div>
                </div>
            )}

            {locationModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in duration-300">
                    <div className="liquid-glass w-full max-w-2xl bg-bg-dark-primary/90 rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden relative">
                        <div className="p-6 border-b border-white/10 bg-gradient-to-r from-blue-900/40 to-transparent flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-blue-400">pin_drop</span>
                                    Mapear Localização
                                </h2>
                                <p className="text-xs text-text-muted mt-1">Coordenadas atuais: {locationModal.latitude}, {locationModal.longitude}</p>
                            </div>
                            <button onClick={() => setLocationModal(null)} className="text-white/50 hover:text-white"><span className="material-symbols-outlined">close</span></button>
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6">
                            <div>
                                <h3 className="text-sm font-bold text-white mb-3 uppercase tracking-widest opacity-70">Academias Oficiais Conhecidas</h3>
                                <div className="space-y-2">
                                    {locations.map(loc => {
                                        const dist = calcularDistanciaMetros(locationModal.latitude, locationModal.longitude, loc.latitude, loc.longitude);
                                        return (
                                            <div key={loc.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/20 transition-colors">
                                                <div>
                                                    <p className="text-white font-bold">{loc.nome}</p>
                                                    <p className={`text-xs ${dist < 200 ? 'text-emerald-400' : 'text-red-400'}`}>A {dist} metros de distância</p>
                                                </div>
                                                <button onClick={() => handleLinkExistingLocation(locationModal, loc.id)} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors">
                                                    Vincular a este local
                                                </button>
                                            </div>
                                        );
                                    })}
                                    {locations.length === 0 && <p className="text-text-muted text-sm italic">Nenhuma academia cadastrada no sistema.</p>}
                                </div>
                            </div>

                            <div className="pt-4 border-t border-white/10">
                                <h3 className="text-sm font-bold text-white mb-3 uppercase tracking-widest opacity-70">Cadastrar Nova Academia</h3>
                                <div className="flex gap-3">
                                    <input 
                                        type="text" 
                                        value={newGymName}
                                        onChange={(e) => setNewGymName(e.target.value)}
                                        placeholder="Ex: Smart Fit - Paulista" 
                                        className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                    <button onClick={() => handleCreateNewLocation(locationModal)} className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-2 transition-colors">
                                        <span className="material-symbols-outlined">add_location</span>
                                        Salvar e Vincular
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <main className="ml-64 flex-1 flex flex-col h-screen overflow-hidden relative z-10">
                <header className="shrink-0 bg-black/40 backdrop-blur-xl p-8 border-b border-white/10 shadow-lg">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg">
                            <span className="material-symbols-outlined text-white text-2xl">admin_panel_settings</span>
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white tracking-tight">Gym Control</h1>
                            <p className="text-text-muted text-sm font-medium">Moderação de check-ins e gestão de contas do PWA.</p>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-12">
                    <section>
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-orange-500">pending_actions</span>
                            Aprovação Pendente ({pending.length})
                        </h2>

                        {loading && pending.length === 0 ? (
                            <div className="animate-pulse space-y-4"><div className="h-32 bg-white/5 rounded-2xl"></div></div>
                        ) : pending.length === 0 ? (
                            <div className="liquid-glass p-10 rounded-3xl border border-white/5 text-center bg-white/5">
                                <span className="material-symbols-outlined text-5xl text-white/20 mb-3">check_circle</span>
                                <p className="text-white/50 font-medium">Todos os check-ins foram moderados. Trabalho limpo!</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
                                {pending.map(item => (
                                    <div key={item.id} className="liquid-glass flex flex-col md:flex-row bg-black/40 rounded-3xl border border-white/10 overflow-hidden shadow-xl">
                                        
                                        <div className="flex items-center p-6 border-b md:border-b-0 md:border-r border-white/10 w-full md:w-1/3 shrink-0 gap-4">
                                            <div 
                                                className="w-20 h-20 rounded-xl bg-black overflow-hidden border-2 border-white/10 cursor-pointer relative group flex-shrink-0"
                                                onClick={() => setPhotoModal(item.foto_treino_url)}
                                            >
                                                <img src={`${API_URL}${item.foto_treino_url}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <span className="material-symbols-outlined text-white">zoom_in</span>
                                                </div>
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="text-white font-bold truncate" title={item.colaborador_nome}>{item.colaborador_nome}</p>
                                                <p className="text-text-muted text-xs mb-2">{new Date(item.created_at).toLocaleDateString('pt-BR')}</p>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 rounded-full bg-black/50 overflow-hidden border border-white/20">
                                                        {item.colaborador_foto ? <img src={`${API_URL}${item.colaborador_foto}`} className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-white/30 text-[10px] m-1">person</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex-1 p-6 flex flex-col justify-center gap-4">
                                            
                                            <div className={`flex items-center justify-between p-3 rounded-xl border ${item.imagem_valida !== null ? 'border-white/5 bg-white/5' : 'border-blue-500/30 bg-blue-500/10'}`}>
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-white/50">image</span>
                                                    <span className="text-sm text-white font-medium">A imagem é válida?</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleModerate(item.id, 'imagem_valida', 1)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${item.imagem_valida === 1 ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/50 hover:bg-emerald-500/50'}`}>SIM</button>
                                                    <button onClick={() => handleModerate(item.id, 'imagem_valida', 0)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${item.imagem_valida === 0 ? 'bg-red-500 text-white' : 'bg-white/10 text-white/50 hover:bg-red-500/50'}`}>NÃO</button>
                                                </div>
                                            </div>

                                            <div className={`flex items-center justify-between p-3 rounded-xl border ${item.localizacao_valida !== null ? 'border-white/5 bg-white/5' : 'border-blue-500/30 bg-blue-500/10'}`}>
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-white/50">pin_drop</span>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm text-white font-medium">Localização válida?</span>
                                                        {(item.latitude && item.localizacao_valida === null) && (
                                                            <button onClick={() => setLocationModal(item)} className="text-[10px] text-blue-400 font-bold hover:underline flex items-center gap-1 mt-0.5">
                                                                <span className="material-symbols-outlined text-[12px]">map</span> Mapear Local
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleModerate(item.id, 'localizacao_valida', 1)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${item.localizacao_valida === 1 ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/50 hover:bg-emerald-500/50'}`}>SIM</button>
                                                    <button onClick={() => handleModerate(item.id, 'localizacao_valida', 0)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${item.localizacao_valida === 0 ? 'bg-red-500 text-white' : 'bg-white/10 text-white/50 hover:bg-red-500/50'}`}>NÃO</button>
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <section>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-blue-400">group_manage</span>
                                Gestão de Contas (PWA)
                            </h2>
                            <button onClick={handleSyncUsers} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-600/50 hover:bg-blue-600 hover:text-white transition-colors text-sm font-bold shadow-lg">
                                <span className="material-symbols-outlined">sync</span>
                                Sincronizar RH
                            </button>
                        </div>

                        <div className="liquid-glass rounded-3xl border border-white/10 overflow-hidden bg-black/40 shadow-2xl">
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-[#0d0d0d]/90 border-b border-white/10">
                                        <tr className="text-xs text-text-muted font-black uppercase tracking-widest">
                                            <th className="p-4 pl-6">Colaborador</th>
                                            <th className="p-4">CPF (Login)</th>
                                            <th className="p-4 text-center">Estado da Conta</th>
                                            <th className="p-4 text-right pr-6">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map((user) => (
                                            <tr key={user.cpf} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                <td className="p-4 pl-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-black/50 overflow-hidden border border-white/10 shadow-inner shrink-0">
                                                            {user.foto_perfil ? <img src={`${API_URL}${user.foto_perfil}`} className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-white/30 flex items-center justify-center w-full h-full">person</span>}
                                                        </div>
                                                        <div>
                                                            <span className={`font-bold text-sm block ${user.is_blocked ? 'text-text-muted line-through' : 'text-white'}`}>{user.nome}</span>
                                                            {user.must_change_password === 1 && <span className="text-[9px] font-black uppercase tracking-widest text-orange-400">Pendente de 1º Login</span>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 font-mono text-sm text-white/70">
                                                    {user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <button 
                                                        onClick={() => handleToggleBlock(user.cpf, user.is_blocked)}
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/20 ${user.is_blocked ? 'bg-red-500' : 'bg-emerald-500'}`}
                                                    >
                                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${user.is_blocked ? 'translate-x-6' : 'translate-x-1'}`}/>
                                                    </button>
                                                    <p className="text-[10px] text-text-muted font-bold mt-1 uppercase">
                                                        {user.is_blocked ? 'Bloqueado' : 'Ativo'}
                                                    </p>
                                                </td>
                                                <td className="p-4 text-right pr-6">
                                                    <button 
                                                        onClick={() => handleResetPassword(user.cpf)}
                                                        className="px-4 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/30 transition-all text-xs font-bold uppercase tracking-wider flex items-center gap-2 ml-auto"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">lock_reset</span>
                                                        Reset Senha
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {users.length === 0 && (
                                            <tr><td colSpan="4" className="text-center p-12 text-text-muted">Nenhum utilizador encontrado. Clique em "Sincronizar RH".</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}