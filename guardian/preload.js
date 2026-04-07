const { contextBridge } = require('electron');

const BASE_URL = 'https://api.dedalosbar.com';
const API_URL = `${BASE_URL}/api/blocked/sp`; 

window.addEventListener('DOMContentLoaded', () => {
    let blockedList = [];

    const style = document.createElement('style');
    style.innerHTML = `
        #dl-list-view::-webkit-scrollbar, #dl-detail-view::-webkit-scrollbar {
            width: 6px;
        }
        #dl-list-view::-webkit-scrollbar-track, #dl-detail-view::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
        }
        #dl-list-view::-webkit-scrollbar-thumb, #dl-detail-view::-webkit-scrollbar-thumb {
            background: rgba(239, 68, 68, 0.4);
            border-radius: 10px;
        }
        #dl-list-view::-webkit-scrollbar-thumb:hover, #dl-detail-view::-webkit-scrollbar-thumb:hover {
            background: rgba(239, 68, 68, 0.8);
        }
    `;
    document.head.appendChild(style);

    const widget = document.createElement('div');
    widget.id = 'dedalos-guardian-widget';
    widget.dataset.alert = 'false'; 
    widget.style.cssText = `
        position: fixed;
        bottom: 20px; 
        right: 20px;
        width: 320px;
        background: rgba(18, 18, 18, 0.95);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(74, 222, 128, 0.3);
        border-radius: 16px;
        color: white;
        font-family: system-ui, -apple-system, sans-serif;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        z-index: 999999;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        opacity: 0.15; 
        transform: translateY(10px) scale(0.95);
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    `;

    widget.addEventListener('mouseenter', () => {
        widget.style.opacity = '1';
        widget.style.transform = 'translateY(0) scale(1)';
    });

    widget.addEventListener('mouseleave', () => {
        if (widget.dataset.alert !== 'true') {
            widget.style.opacity = '0.15';
            widget.style.transform = 'translateY(10px) scale(0.95)';
        }
    });

    const header = document.createElement('div');
    header.style.cssText = `
        background: rgba(239, 68, 68, 0.1);
        padding: 15px;
        border-bottom: 1px solid rgba(239, 68, 68, 0.2);
        font-weight: 900;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #ef4444;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
    `;
    header.innerHTML = `<span>🛡️ LISTA DE BLOQUEADOS</span> <span id="dg-status" style="font-size:9px; color:#4ade80; padding-top:2px;">ONLINE</span>`;

    const mainArea = document.createElement('div');
    mainArea.style.cssText = `
        position: relative;
        display: flex;
        flex-direction: column;
    `;

    const listView = document.createElement('div');
    listView.id = 'dl-list-view';
    listView.style.cssText = `
        padding: 16px;
        max-height: 170px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
    `;

    const detailView = document.createElement('div');
    detailView.id = 'dl-detail-view';
    detailView.style.cssText = `
        padding: 16px;
        display: none;
        flex-direction: column;
        max-height: 350px;
        overflow-y: auto;
        animation: fadeIn 0.2s ease-in-out;
    `;

    const footer = document.createElement('div');
    footer.style.cssText = `
        text-align: center;
        font-size: 10px;
        color: rgba(255,255,255,0.3);
        padding: 8px 0;
        border-top: 1px solid rgba(255,255,255,0.05);
        background: rgba(0,0,0,0.2);
        flex-shrink: 0;
    `;
    footer.innerHTML = `© Developed by: <span style="color: #ef4444; font-weight: 600;">Matteus Tirado</span>`;

    mainArea.appendChild(listView);
    mainArea.appendChild(detailView);
    
    widget.appendChild(header);
    widget.appendChild(mainArea);
    widget.appendChild(footer);
    document.body.appendChild(widget);

    function resetGuardian() {
        widget.dataset.alert = 'false';
        widget.style.opacity = '0.15';
        widget.style.transform = 'translateY(10px) scale(0.95)';
        widget.style.borderColor = 'rgba(74, 222, 128, 0.3)';
        widget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
        
        detailView.style.display = 'none';
        listView.style.display = 'flex';
        listView.innerHTML = `<p style="font-size: 12px; color: rgba(255,255,255,0.4); text-align: center; margin: 0;">Monitorando Check-in...</p>`;
    }
    
    resetGuardian();

    async function fetchBlockedList() {
        try {
            const res = await fetch(API_URL);
            blockedList = await res.json();
            document.getElementById('dg-status').innerText = 'ONLINE';
            document.getElementById('dg-status').style.color = '#4ade80';
        } catch (err) {
            document.getElementById('dg-status').innerText = 'OFFLINE';
            document.getElementById('dg-status').style.color = '#ef4444';
        }
    }

    function openDetails(match) {
        listView.style.display = 'none';
        detailView.style.display = 'flex';
        
        const dataLimite = match.data_limite ? new Date(match.data_limite).toLocaleDateString('pt-BR') : 'PERMANENTE';
        const fotoSrc = match.foto_url ? `${BASE_URL}${match.foto_url}` : null;
        
        detailView.innerHTML = `
            <button id="dl-back-btn" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 6px; padding: 6px 12px; font-size: 11px; font-weight: bold; cursor: pointer; align-self: flex-start; margin-bottom: 16px; transition: all 0.2s;">
                ⬅ Voltar para a lista
            </button>
            
            <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
                <div style="width: 80px; height: 80px; border-radius: 50%; background: #222; border: 2px solid rgba(239, 68, 68, 0.5); overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px rgba(239, 68, 68, 0.2);">
                    ${fotoSrc ? `<img src="${fotoSrc}" style="width: 100%; height: 100%; object-fit: cover;" />` : `<span style="font-size: 30px; opacity: 0.3;">📷</span>`}
                </div>
                
                <h3 style="margin: 0; font-size: 16px; font-weight: 900; text-align: center; color: #fff;">${match.nome_completo}</h3>
                
                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; padding: 12px; width: 100%; box-sizing: border-box;">
                    <p style="margin: 0 0 10px 0; font-size: 12px; color: rgba(255,255,255,0.8); font-style: italic; text-align: center; line-height: 1.4;">
                        "${match.motivo || 'Motivo de bloqueio não especificado no sistema.'}"
                    </p>
                    <div style="text-align: center;">
                        <span style="font-size: 10px; background: #ef4444; color: white; display: inline-block; padding: 3px 8px; border-radius: 4px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
                            EXPIRA EM: ${dataLimite}
                        </span>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('dl-back-btn').addEventListener('click', () => {
            detailView.style.display = 'none';
            listView.style.display = 'flex';
        });
        
        const backBtn = document.getElementById('dl-back-btn');
        backBtn.addEventListener('mouseenter', () => backBtn.style.background = 'rgba(255,255,255,0.2)');
        backBtn.addEventListener('mouseleave', () => backBtn.style.background = 'rgba(255,255,255,0.1)');
    }

    function handleSearch(rawValue) {
        const fullTerm = rawValue.trim().toLowerCase();
        const firstName = fullTerm.split(' ')[0]; 
        
        if (firstName.length < 3) {
            resetGuardian();
            return;
        }

        const matches = blockedList.filter(b => b.nome_completo.toLowerCase().includes(firstName));

        if (matches.length > 0) {
            widget.dataset.alert = 'true';
            widget.style.opacity = '1';
            widget.style.transform = 'translateY(0) scale(1)';
            widget.style.borderColor = '#ef4444';
            widget.style.boxShadow = '0 0 50px rgba(239, 68, 68, 0.4)';
            
            detailView.style.display = 'none';
            listView.style.display = 'flex';
            
            listView.innerHTML = `<div style="font-size:11px; color:#ef4444; font-weight:900; margin-bottom:4px; text-transform:uppercase; flex-shrink: 0;">🚨 ${matches.length} Bloqueio(s) Localizado(s):</div>`;
            
            matches.forEach(match => {
                const card = document.createElement('div');
                card.style.cssText = `
                    background: rgba(239, 68, 68, 0.15);
                    border: 1px solid rgba(239, 68, 68, 0.4);
                    padding: 12px 14px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    flex-shrink: 0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                `;
                
                card.innerHTML = `
                    <span style="font-weight: 900; font-size: 13px; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 75%;">${match.nome_completo}</span>
                    <span style="font-size: 10px; color: #ef4444; font-weight: bold; background: rgba(239,68,68,0.1); padding: 2px 6px; border-radius: 4px;">ABRIR</span>
                `;

                card.addEventListener('mouseenter', () => card.style.background = 'rgba(239, 68, 68, 0.3)');
                card.addEventListener('mouseleave', () => card.style.background = 'rgba(239, 68, 68, 0.15)');
                
                card.addEventListener('click', () => openDetails(match));

                listView.appendChild(card);
            });
        } else {
            widget.dataset.alert = 'false';
            widget.style.opacity = '0.15';
            widget.style.transform = 'translateY(10px) scale(0.95)';
            widget.style.borderColor = '#4ade80';
            widget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
            
            detailView.style.display = 'none';
            listView.style.display = 'flex';
            listView.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; gap:8px; padding: 20px 0; opacity: 0.6;">
                <span style="font-size: 40px;">✅</span>
                <span style="font-size: 14px; font-weight: 900; color: #4ade80;">ACESSO LIVRE</span>
            </div>`;
        }
    }

    let lastInputValue = '';
    
    setInterval(() => {
        const inputElement = document.querySelector('input.checkinLayout_inputCustom__1mZnY');
        
        if (!inputElement) {
            if (lastInputValue !== '') {
                lastInputValue = '';
                resetGuardian();
            }
            return;
        }

        if (inputElement.value !== lastInputValue) {
            lastInputValue = inputElement.value;
            handleSearch(lastInputValue);
        }
    }, 300);

    fetchBlockedList();
    setInterval(fetchBlockedList, 10000); 
});