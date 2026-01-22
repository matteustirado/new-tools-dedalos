import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../../components/Sidebar';
import BadgeTemplate from '../../components/BadgeTemplate';
import axios from 'axios';
import { toast } from 'react-toastify';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function BadgeModelEditor() {
    const [templates, setTemplates] = useState([]);
    const [selectedRole, setSelectedRole] = useState('PADRAO');
    const [isCreating, setIsCreating] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');
    const logoInputRef = useRef(null);

    const [config, setConfig] = useState({
        headerHeight: 30,
        photoShape: 'circle',
        nameSize: 24,
        roleSize: 14,
        textures: [],
        logoUrl: null,
        logoSize: 80,
        contentY: 0,
        photoY: 0
    });

    const previewData = {
        name: "MATEUS TIRADO",
        role: selectedRole === 'PADRAO' ? "CARGO EXEMPLO" : selectedRole,
        photo_url: null,
        admission_date: new Date().toISOString()
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/badges/templates`);
            setTemplates(res.data);
            const def = res.data.find(t => t.role_name === 'PADRAO');
            if (def) {
                let parsedConfig = typeof def.config === 'string' ? JSON.parse(def.config) : def.config;
                if (!Array.isArray(parsedConfig.textures)) {
                    parsedConfig.textures = parsedConfig.texture && parsedConfig.texture !== 'none' ? [parsedConfig.texture] : [];
                }
                setConfig(parsedConfig);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleRoleChange = (roleName) => {
        setSelectedRole(roleName);
        const template = templates.find(t => t.role_name === roleName);
        if (template) {
            let parsedConfig = typeof template.config === 'string' ? JSON.parse(template.config) : template.config;
            if (!Array.isArray(parsedConfig.textures)) {
                parsedConfig.textures = parsedConfig.texture && parsedConfig.texture !== 'none' ? [parsedConfig.texture] : [];
            }
            setConfig(parsedConfig);
        }
        setIsCreating(false);
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('logo', file);
        try {
            const res = await axios.post(`${API_URL}/api/badges/upload-logo`, formData);
            setConfig({ ...config, logoUrl: res.data.url });
            toast.success("Logo atualizado!");
        } catch (error) {
            toast.error("Erro ao enviar logo");
        }
    };

    const toggleTexture = (textureKey) => {
        setConfig(prev => {
            const current = prev.textures || [];
            if (current.includes(textureKey)) {
                return { ...prev, textures: current.filter(t => t !== textureKey) };
            } else {
                return { ...prev, textures: [...current, textureKey] };
            }
        });
    };

    const handleSave = async () => {
        const roleToSave = isCreating ? newRoleName.toUpperCase() : selectedRole;
        if (!roleToSave) return toast.error("Nome do cargo inválido");
        try {
            await axios.post(`${API_URL}/api/badges/templates`, {
                role_name: roleToSave,
                config,
                is_default: roleToSave === 'PADRAO'
            });
            toast.success("Modelo salvo!");
            setIsCreating(false);
            setNewRoleName('');
            fetchTemplates();
            setSelectedRole(roleToSave);
        } catch (error) {
            toast.error("Erro ao salvar.");
        }
    };

    const handleDelete = async () => {
        if (selectedRole === 'PADRAO') return toast.error("O modelo PADRAO não pode ser excluído.");
        if (!window.confirm(`Apagar modelo para ${selectedRole}?`)) return;
        try {
            await axios.delete(`${API_URL}/api/badges/templates/${selectedRole}`);
            toast.success("Modelo excluído");
            fetchTemplates();
            handleRoleChange('PADRAO');
        } catch (error) {
            toast.error("Erro ao excluir.");
        }
    };

    return (
        <div className="h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex overflow-hidden">
            <Sidebar activePage="models" headerTitle="Modelos de Crachá" headerIcon="style" group="identification" />

            <main className="ml-64 flex-1 p-8 flex gap-8 h-full overflow-hidden">
                <div className="w-1/3 bg-[#1a1a1a] rounded-2xl p-6 border border-white/10 flex flex-col h-full shadow-2xl">
                    <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/10 sticky top-0 bg-[#1a1a1a] z-10">
                        <h2 className="text-xl font-bold text-white flex-1 flex items-center gap-2">
                            <span className="material-symbols-outlined text-orange-500">tune</span>
                            Editor
                        </h2>
                    </div>

                    <div className="overflow-y-auto custom-scrollbar pr-2 flex-1 space-y-6 pb-4">
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                            <label className="text-xs text-white/50 uppercase font-bold block mb-2">Modelo Ativo</label>
                            {!isCreating ? (
                                <div className="flex gap-2">
                                    <select value={selectedRole} onChange={(e) => handleRoleChange(e.target.value)} className="flex-1 bg-black/30 border border-white/10 rounded-lg p-2 text-white font-bold text-sm">
                                        {templates.map(t => <option key={t.id} value={t.role_name}>{t.role_name}</option>)}
                                    </select>
                                    <button onClick={() => setIsCreating(true)} className="bg-emerald-600 hover:bg-emerald-500 p-2 rounded text-white"><span className="material-symbols-outlined text-sm">add</span></button>
                                    {selectedRole !== 'PADRAO' && <button onClick={handleDelete} className="bg-red-600 hover:bg-red-500 p-2 rounded text-white"><span className="material-symbols-outlined text-sm">delete</span></button>}
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <input type="text" value={newRoleName} onChange={e => setNewRoleName(e.target.value.toUpperCase())} placeholder="NOME..." className="flex-1 bg-black/30 border border-white/10 rounded-lg p-2 text-white" />
                                    <button onClick={() => setIsCreating(false)} className="text-white/50 text-xs">Cancelar</button>
                                </div>
                            )}
                        </div>

                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                            <label className="text-xs text-orange-400 uppercase font-bold mb-3 block">Cabeçalho</label>
                            <div className="mb-4">
                                <div className="flex justify-between mb-1"><label className="text-xs text-white/70">Altura</label><span className="text-xs text-orange-400 font-bold">{config.headerHeight}%</span></div>
                                <input type="range" min="15" max="60" value={config.headerHeight} onChange={e => setConfig({...config, headerHeight: parseInt(e.target.value)})} className="w-full accent-orange-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" />
                            </div>
                            <div className="mb-4">
                                <label className="text-xs text-white/70 block mb-2">Logo</label>
                                <div className="flex gap-2 items-center">
                                    <div className="w-10 h-10 bg-black/50 border border-white/10 rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                                        {config.logoUrl ? <img src={config.logoUrl.startsWith('http') ? config.logoUrl : `${API_URL}${config.logoUrl}`} alt="" className="w-full h-full object-contain" /> : <span className="material-symbols-outlined text-white/20 text-sm">image</span>}
                                    </div>
                                    <button onClick={() => logoInputRef.current.click()} className="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded py-2 text-[10px] uppercase font-bold text-white transition-colors">Trocar Imagem</button>
                                    <input type="file" ref={logoInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between mb-1"><label className="text-xs text-white/70">Tam. Logo</label><span className="text-xs text-orange-400 font-bold">{config.logoSize || 80}%</span></div>
                                <input type="range" min="20" max="150" value={config.logoSize || 80} onChange={e => setConfig({...config, logoSize: parseInt(e.target.value)})} className="w-full accent-orange-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" />
                            </div>
                        </div>

                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                            <label className="text-xs text-purple-400 uppercase font-bold mb-3 block">Texturas de Fundo</label>
                            <div className="space-y-2">
                                <label className="flex items-center gap-3 cursor-pointer group select-none">
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${config.textures?.includes('marca_dagua') ? 'bg-purple-600 border-purple-600' : 'border-white/20 bg-black/20 group-hover:border-purple-500'}`}>
                                        {config.textures?.includes('marca_dagua') && <span className="material-symbols-outlined text-xs text-white">check</span>}
                                    </div>
                                    <span className="text-sm text-white/80 group-hover:text-white transition-colors">Marca D'água (Logo)</span>
                                    <input type="checkbox" className="hidden" checked={config.textures?.includes('marca_dagua') || false} onChange={() => toggleTexture('marca_dagua')} />
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer group select-none">
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${config.textures?.includes('pontilhado') ? 'bg-purple-600 border-purple-600' : 'border-white/20 bg-black/20 group-hover:border-purple-500'}`}>
                                        {config.textures?.includes('pontilhado') && <span className="material-symbols-outlined text-xs text-white">check</span>}
                                    </div>
                                    <span className="text-sm text-white/80 group-hover:text-white transition-colors">Pontilhado</span>
                                    <input type="checkbox" className="hidden" checked={config.textures?.includes('pontilhado') || false} onChange={() => toggleTexture('pontilhado')} />
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer group select-none">
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${config.textures?.includes('direcionais') ? 'bg-purple-600 border-purple-600' : 'border-white/20 bg-black/20 group-hover:border-purple-500'}`}>
                                        {config.textures?.includes('direcionais') && <span className="material-symbols-outlined text-xs text-white">check</span>}
                                    </div>
                                    <span className="text-sm text-white/80 group-hover:text-white transition-colors">Direcionais (Gamer)</span>
                                    <input type="checkbox" className="hidden" checked={config.textures?.includes('direcionais') || false} onChange={() => toggleTexture('direcionais')} />
                                </label>
                            </div>
                        </div>

                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                            <label className="text-xs text-blue-400 uppercase font-bold mb-3 block">Detalhes</label>
                            <div className="mb-4">
                                <label className="text-xs text-white/70 block mb-2">Formato Foto</label>
                                <div className="flex gap-2">
                                    {['circle', 'rounded', 'square'].map(shape => (
                                        <button key={shape} onClick={() => setConfig({...config, photoShape: shape})} className={`flex-1 py-2 text-[10px] uppercase font-bold border border-white/10 rounded ${config.photoShape === shape ? 'bg-blue-600 text-white border-blue-500' : 'bg-white/5 text-white/50'}`}>{shape}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="mb-2">
                                <div className="flex justify-between mb-1"><label className="text-xs text-white/70">Pos. Foto</label><span className="text-xs text-blue-400 font-bold">{config.photoY || 0}px</span></div>
                                <input type="range" min="-100" max="100" step="2" value={config.photoY || 0} onChange={e => setConfig({...config, photoY: parseInt(e.target.value)})} className="w-full accent-blue-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" />
                            </div>
                            <div>
                                <div className="flex justify-between mb-1"><label className="text-xs text-white/70">Pos. Texto</label><span className="text-xs text-blue-400 font-bold">{config.contentY}px</span></div>
                                <input type="range" min="-80" max="80" step="2" value={config.contentY} onChange={e => setConfig({...config, contentY: parseInt(e.target.value)})} className="w-full accent-blue-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-xs text-white/50 block mb-1">Tam. Nome</label><input type="number" value={config.nameSize} onChange={e => setConfig({...config, nameSize: parseInt(e.target.value)})} className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-white text-sm" /></div>
                            <div><label className="text-xs text-white/50 block mb-1">Tam. Cargo</label><input type="number" value={config.roleSize} onChange={e => setConfig({...config, roleSize: parseInt(e.target.value)})} className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-white text-sm" /></div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/10 mt-auto">
                        <button onClick={handleSave} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl shadow-lg transition-transform hover:scale-[1.02]">
                            SALVAR MODELO
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center bg-black/40 rounded-3xl border border-white/5 relative overflow-hidden">
                    <div className="absolute top-10 left-0 w-full text-center pointer-events-none">
                        <h2 className="text-white/20 font-black text-4xl uppercase tracking-[0.2em] drop-shadow-lg mb-2">
                            Visualização
                        </h2>
                        <p className="text-white/10 text-xs uppercase tracking-widest">Tempo Real (16:9)</p>
                    </div>
                    
                    <div className="transform scale-150 origin-center shadow-[0_20px_50px_rgba(0,0,0,0.6)] rounded-lg transition-all duration-300 mt-10">
                        <BadgeTemplate data={previewData} config={config} />
                    </div>
                </div>
            </main>
        </div>
    );
}