import { getIO } from '../socket.js';
import pool from '../config/db.js';

let estadoRadio = {
    musicaAtual: null,
    tempoAtualSegundos: 0,
    playlistAtiva: [],
    playlistAgendadaAtual: null,
    playlistAtualId: null,
    filaComercialManual: [],
    filaDePedidos: [],
    contadorComercial: 0,
    isCrossfading: false,
    playerAtivo: 'A',
    overlayUrl: null
};

let cacheComerciais = [];
let cacheFallbacks = {};
let clientesConectados = 0;

const TICK_INTERVAL_MS = 250;
let ticker = null;
let ultimoSlotVerificado = -1;

const formatDateToYYYYMMDD = (date) => {
    if (!date) return null;

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

const safeJsonParse = (input) => {
    if (Array.isArray(input)) {
        return input;
    }

    if (!input || typeof input !== 'string') {
        return [];
    }

    try {
        const parsed = JSON.parse(input);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.error("safeJsonParse - Erro no parse:", e);
        return [];
    }
};

const buscarDetalhesTrack = async (trackId) => {
    try {
        const [rows] = await pool.query('SELECT * FROM tracks WHERE id = ?', [trackId]);

        if (rows.length > 0) {
            rows[0].artistas_participantes = safeJsonParse(rows[0].artistas_participantes);
            rows[0].dias_semana = safeJsonParse(rows[0].dias_semana);
            return rows[0];
        }

        return null;
    } catch (err) {
        console.error(`Erro ao buscar detalhes da track ${trackId}:`, err);
        return null;
    }
};

const buscarTracksDaPlaylist = async (playlistId) => {
    try {
        const [rows] = await pool.query('SELECT tracks_ids FROM playlists WHERE id = ?', [playlistId]);

        if (rows.length > 0) {
            return safeJsonParse(rows[0].tracks_ids);
        }

        return [];
    } catch (err) {
        console.error(`[Maestro] Erro ao buscar tracks da playlist ${playlistId}:`, err);
        return [];
    }
};

const atualizarStatusPedido = async (pedidoDbId, status) => {
    try {
        await pool.query(
            "UPDATE jukebox_pedidos SET status = ?, tocado_em = NOW() WHERE id = ?",
            [status, pedidoDbId]
        );
    } catch (err) {
        console.error(`[Maestro] Erro ao atualizar status do pedido ${pedidoDbId}:`, err);
    }
};

const carregarCacheConfig = async () => {
    try {
        const [rows] = await pool.query("SELECT * FROM radio_config");

        const fallbackRow = rows.find(r => r.config_key === 'fallback_playlist_ids');
        if (fallbackRow && fallbackRow.config_value) {
            cacheFallbacks = Array.isArray(fallbackRow.config_value) ? {} : fallbackRow.config_value;
        }

        const [commercialRows] = await pool.query("SELECT id FROM tracks WHERE is_commercial = 1");
        cacheComerciais = commercialRows.map(r => r.id);

        await pool.query(
            "UPDATE radio_config SET config_value = ? WHERE config_key = 'commercial_track_ids'",
            [JSON.stringify(cacheComerciais)]
        );
    } catch (err) {
        console.error("[Maestro] Erro fatal ao carregar cache de configuração:", err);
    }
};

const carregarPlaylist = async (playlistId, isAgendada = true) => {
    const trackIds = await buscarTracksDaPlaylist(playlistId);

    if (trackIds.length > 0) {
        estadoRadio.playlistAtiva = trackIds;
        estadoRadio.playlistAgendadaAtual = isAgendada ? playlistId : null;
        estadoRadio.playlistAtualId = playlistId;

        getIO().emit('maestro:playlistAtualizada', playlistId);
        return true;
    }

    if (isAgendada) {
        estadoRadio.playlistAgendadaAtual = null;
    }

    estadoRadio.playlistAtualId = null;
    getIO().emit('maestro:playlistAtualizada', null);

    return false;
};

const obterProximoId = async () => {
    if (estadoRadio.filaComercialManual.length > 0) {
        return {
            id: estadoRadio.filaComercialManual[0],
            origem: 'COMERCIAL_MANUAL'
        };
    }

    if (estadoRadio.contadorComercial >= 10 && cacheComerciais.length > 0) {
        const randomId = cacheComerciais[Math.floor(Math.random() * cacheComerciais.length)];
        return {
            id: randomId,
            origem: 'COMERCIAL_AUTO'
        };
    }

    if (estadoRadio.filaDePedidos.length > 0) {
        return {
            id: estadoRadio.filaDePedidos[0].trackId,
            origem: 'PEDIDO',
            info: estadoRadio.filaDePedidos[0]
        };
    }

    if (estadoRadio.playlistAtiva.length > 0) {
        return {
            id: estadoRadio.playlistAtiva[0],
            origem: 'PLAYLIST'
        };
    }

    const diasSemana = ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"];
    const diaSemana = diasSemana[new Date().getUTCDay()];
    const fallbackPlaylistId = cacheFallbacks[diaSemana];

    if (fallbackPlaylistId) {
        const carregou = await carregarPlaylist(fallbackPlaylistId, false);
        if (carregou && estadoRadio.playlistAtiva.length > 0) {
            return {
                id: estadoRadio.playlistAtiva[0],
                origem: 'FALLBACK_DIA'
            };
        }
    }

    try {
        const [rows] = await pool.query("SELECT id FROM playlists ORDER BY RAND() LIMIT 1");
        if (rows.length > 0) {
            const carregou = await carregarPlaylist(rows[0].id, false);
            if (carregou && estadoRadio.playlistAtiva.length > 0) {
                return {
                    id: estadoRadio.playlistAtiva[0],
                    origem: 'FALLBACK_RANDOM'
                };
            }
        }
    } catch (e) {
        console.error("Erro no fallback random:", e);
    }

    return null;
};

const tocarProximaMusica = async () => {
    estadoRadio.isCrossfading = false;

    const proximo = await obterProximoId();

    if (!proximo) {
        estadoRadio.musicaAtual = null;
        estadoRadio.tempoAtualSegundos = 0;
        getIO().emit('maestro:pararTudo');

        const filaVisual = await comporFilaVisual();
        getIO().emit('maestro:filaAtualizada', filaVisual);
        return;
    }

    if (proximo.origem === 'COMERCIAL_MANUAL') {
        estadoRadio.filaComercialManual.shift();
        estadoRadio.contadorComercial = 0;
    } else if (proximo.origem === 'COMERCIAL_AUTO') {
        estadoRadio.contadorComercial = 0;
    } else if (proximo.origem === 'PEDIDO') {
        estadoRadio.filaDePedidos.shift();
        estadoRadio.contadorComercial++;
    } else if (proximo.origem === 'PLAYLIST' || proximo.origem.startsWith('FALLBACK')) {
        estadoRadio.playlistAtiva.shift();
        estadoRadio.contadorComercial++;
    }

    const trackInfo = await buscarDetalhesTrack(proximo.id);

    if (trackInfo) {
        estadoRadio.musicaAtual = trackInfo;
        estadoRadio.playerAtivo = estadoRadio.playerAtivo === 'A' ? 'B' : 'A';
        estadoRadio.tempoAtualSegundos = trackInfo.start_segundos || 0;

        getIO().emit('maestro:tocarAgora', {
            player: estadoRadio.playerAtivo,
            musicaInfo: estadoRadio.musicaAtual
        });

        if (proximo.origem === 'PEDIDO' && proximo.info && proximo.info.id) {
            const idStr = String(proximo.info.id);
            if (!idStr.startsWith('dj_')) {
                atualizarStatusPedido(proximo.info.id, 'TOCADO');
            }
        }
    } else {
        tocarProximaMusica();
        return;
    }

    const filaVisual = await comporFilaVisual();
    getIO().emit('maestro:filaAtualizada', filaVisual);
};

const verificarAgendamento = async (slotAtual) => {
    if (clientesConectados === 0) return;

    const agora = new Date();
    const dataString = formatDateToYYYYMMDD(agora);

    try {
        const [rows] = await pool.query(
            "SELECT playlist_id FROM agendamentos WHERE data_agendamento = ? AND slot_index = ?",
            [dataString, slotAtual]
        );

        if (rows.length > 0) {
            const playlistIdAgendada = rows[0].playlist_id;

            if (playlistIdAgendada === null) {
                if (estadoRadio.playlistAgendadaAtual !== null) {
                    estadoRadio.playlistAtiva = [];
                    estadoRadio.playlistAgendadaAtual = null;
                    estadoRadio.playlistAtualId = null;
                    getIO().emit('maestro:playlistAtualizada', null);
                }
            } else if (playlistIdAgendada !== estadoRadio.playlistAgendadaAtual) {
                const sucesso = await carregarPlaylist(playlistIdAgendada, true);

                if (sucesso && !estadoRadio.musicaAtual) {
                    tocarProximaMusica();
                }
            }
        }
    } catch (err) {
        console.error("[Maestro] Erro ao verificar agendamento:", err);
    }
};

const iniciarTicker = () => {
    if (ticker) clearInterval(ticker);

    ticker = setInterval(async () => {
        if (clientesConectados === 0) return;

        const agora = new Date();
        const hora = agora.getUTCHours();
        const minutos = agora.getUTCMinutes();
        const slotAtual = (hora * 6) + Math.floor(minutos / 10);

        if (slotAtual !== ultimoSlotVerificado) {
            ultimoSlotVerificado = slotAtual;
            await verificarAgendamento(slotAtual);
        }

        if (!estadoRadio.musicaAtual) return;

        estadoRadio.tempoAtualSegundos += (TICK_INTERVAL_MS / 1000);
        const fimMusicaSegundos = estadoRadio.musicaAtual.end_segundos ?? estadoRadio.musicaAtual.duracao_segundos;

        getIO().emit('maestro:progresso', {
            tempoAtual: estadoRadio.tempoAtualSegundos,
            tempoTotal: fimMusicaSegundos
        });

        const tempoCrossfade = 4;
        if (!estadoRadio.isCrossfading && estadoRadio.tempoAtualSegundos >= (fimMusicaSegundos - tempoCrossfade)) {
            estadoRadio.isCrossfading = true;

            const proximo = await obterProximoId();
            if (proximo) {
                const infoProxima = await buscarDetalhesTrack(proximo.id);
                if (infoProxima) {
                    getIO().emit('maestro:iniciarCrossfade', {
                        playerAtivo: estadoRadio.playerAtivo,
                        proximoPlayer: estadoRadio.playerAtivo === 'A' ? 'B' : 'A',
                        proximaMusica: infoProxima
                    });
                }
            }
        }

        if (estadoRadio.tempoAtualSegundos >= fimMusicaSegundos) {
            await tocarProximaMusica();
        }

    }, TICK_INTERVAL_MS);
};

export const verificarDisponibilidadeTrack = (trackId) => {
    const idToCheck = String(trackId);

    if (estadoRadio.musicaAtual && String(estadoRadio.musicaAtual.id) === idToCheck) {
        return { allowed: false, motivo: 'Esta música já está tocando agora!' };
    }

    const proximas5 = estadoRadio.filaDePedidos.slice(0, 5);
    if (proximas5.some(p => String(p.trackId) === idToCheck)) {
        return { allowed: false, motivo: 'Esta música já vai tocar em breve!' };
    }

    return { allowed: true };
};

export const adicionarPedidoNaFila = (pedidoObjeto) => {
    if (!pedidoObjeto.id) {
        pedidoObjeto.id = `dj_${Math.random().toString(36).substring(2, 9)}`;
    }

    estadoRadio.filaDePedidos.push(pedidoObjeto);
    const posicao = estadoRadio.filaComercialManual.length + estadoRadio.filaDePedidos.length;

    if (!estadoRadio.musicaAtual) {
        tocarProximaMusica();
    } else {
        comporFilaVisual().then(fila => getIO().emit('maestro:filaAtualizada', fila));
    }

    return posicao;
};

export const comporFilaVisual = async () => {
    const proximas5 = [];

    const addVisual = async (id, tipo, unidade, objInfo) => {
        if (proximas5.length >= 5) return;

        const info = await buscarDetalhesTrack(id);
        proximas5.push({
            id: objInfo ? `pedido_${objInfo.id}` : `auto_${id}_${Math.random()}`,
            titulo: info ? info.titulo : "Carregando...",
            artista: info ? info.artista : "",
            tipo: tipo,
            unidade: unidade || ''
        });
    };

    for (const id of estadoRadio.filaComercialManual) {
        await addVisual(id, 'COMERCIAL_MANUAL', 'DJ');
    }

    for (const pedido of estadoRadio.filaDePedidos) {
        await addVisual(pedido.trackId, pedido.tipo, pedido.unidade, pedido);
    }

    for (const id of estadoRadio.playlistAtiva) {
        await addVisual(id, 'PLAYLIST', '');
    }

    return proximas5;
};

export const iniciarMaestro = async () => {
    await carregarCacheConfig();
    iniciarTicker();

    getIO().on('connection', (socket) => {
        clientesConectados++;

        if (clientesConectados === 1) {
            const agora = new Date();
            const slot = (agora.getUTCHours() * 6) + Math.floor(agora.getUTCMinutes() / 10);
            verificarAgendamento(slot).then(() => {
                if (!estadoRadio.musicaAtual) tocarProximaMusica();
            });
        }

        socket.emit('maestro:estadoCompleto', estadoRadio);
        comporFilaVisual().then(fila => socket.emit('maestro:filaAtualizada', fila));

        socket.on('disconnect', () => {
            clientesConectados = Math.max(0, clientesConectados - 1);
        });

        socket.on('dj:pularMusica', () => tocarProximaMusica());

        socket.on('dj:tocarComercialAgora', async () => {
            if (cacheComerciais.length === 0) return;
            const comercialId = cacheComerciais[Math.floor(Math.random() * cacheComerciais.length)];
            estadoRadio.filaComercialManual.push(comercialId);

            if (!estadoRadio.musicaAtual) {
                tocarProximaMusica();
            } else {
                comporFilaVisual().then(f => getIO().emit('maestro:filaAtualizada', f));
            }
        });

        socket.on('dj:carregarPlaylistManual', async (playlistId) => {
            await carregarPlaylist(playlistId, false);
            if (!estadoRadio.musicaAtual) {
                tocarProximaMusica();
            } else {
                getIO().emit('maestro:filaAtualizada', await comporFilaVisual());
            }
        });

        socket.on('dj:vetarPedido', async (itemId) => {});

        socket.on('dj:adicionarPedido', (trackId) => {
            const pedido = {
                trackId,
                pulseiraId: 'DJ',
                unidade: 'DJ',
                tipo: 'DJ'
            };
            adicionarPedidoNaFila(pedido);
        });
    });
};

export const getEstadoRadio = () => estadoRadio;