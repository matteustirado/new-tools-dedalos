import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Calendar from 'react-calendar';
import { toast } from 'react-toastify';
import Sidebar from '../../components/Sidebar';
import 'react-calendar/dist/Calendar.css';

const SLOTS_PER_DAY = 144;
const SLOT_DURATION_SECONDS = 600;
const SLOT_HEIGHT = 20;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const SlotScheduleList = ({ scheduleData, onDropPlaylist, onRemovePlaylist, loadingSchedule }) => {
  const slots = Array.from({ length: SLOTS_PER_DAY }, (_, i) => i);
  const [dragOverSlot, setDragOverSlot] = useState(null);

  const handleDragOver = (e, slot) => {
    e.preventDefault();
    setDragOverSlot(slot);
  };

  const handleDragLeave = () => {
    setDragOverSlot(null);
  };

  const handleDrop = (e, slot) => {
    e.preventDefault();
    setDragOverSlot(null);
    onDropPlaylist(slot, e.dataTransfer.getData('playlistData'));
  };

  const formatSlotTime = (slotIndex) => {
    const totalMinutes = slotIndex * 10;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const formatDuration = (totalSeconds) => {
    if (typeof totalSeconds !== 'number' || totalSeconds <= 0) return '';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    let result = '';
    
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0) result += `${minutes}m `;
    
    return result.trim();
  };

  if (loadingSchedule) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-text-muted">Carregando grade...</span>
      </div>
    );
  }

  const activeSlots = scheduleData 
    ? Object.keys(scheduleData).map(Number).sort((a, b) => a - b) 
    : [];

  return (
    <div className="relative space-y-0">
      {slots.map((slot) => {
        const scheduledItem = scheduleData ? scheduleData[slot] : null;
        const timeString = formatSlotTime(slot);
        const isDragOver = dragOverSlot === slot;
        const isTopOfHour = slot % 6 === 0;

        let playlistHeight = SLOT_HEIGHT;
        let slotsOccupied = 0;
        let isCut = false;

        if (scheduledItem) {
          const durationInSlots = Math.ceil((scheduledItem.duration_seconds || 0) / SLOT_DURATION_SECONDS);
          const currentIndex = activeSlots.indexOf(slot);
          
          const nextSlot = (currentIndex !== -1 && currentIndex < activeSlots.length - 1) 
            ? activeSlots[currentIndex + 1] 
            : SLOTS_PER_DAY; 
          
          slotsOccupied = nextSlot - slot;
          playlistHeight = Math.max(slotsOccupied * SLOT_HEIGHT, SLOT_HEIGHT);
          isCut = durationInSlots > slotsOccupied;
        }

        const durationString = scheduledItem ? formatDuration(scheduledItem.duration_seconds) : '';

        return (
          <div
            key={slot}
            onDragOver={(e) => handleDragOver(e, slot)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, slot)}
            className={`flex items-start border-white/10 relative ${
              isDragOver ? 'bg-primary/10' : ''
            } ${isTopOfHour ? 'border-t-2' : 'border-t'}`}
            style={{ height: `${SLOT_HEIGHT}px` }}
          >
            <span className={`text-[10px] font-mono w-10 text-right flex-shrink-0 pt-0.5 pr-1 z-0 ${isTopOfHour ? 'text-white font-bold' : 'text-text-muted/50'}`}>
              {timeString}
            </span>

            {!scheduledItem && (
              <div className={`flex-1 text-center text-[10px] h-full border-r border-white/5 transition-colors z-0 ${
                isDragOver ? 'bg-primary/20' : ''
              }`}>
              </div>
            )}

            {scheduledItem && (
              <div
                className={`absolute left-[44px] right-0 top-0 z-10 p-1 pl-2 bg-primary/30 border-l-[3px] border-l-primary/70 rounded-r-md text-sm group overflow-hidden shadow-lg backdrop-blur-sm transition-all hover:bg-primary/40 hover:z-30 ${
                  isCut ? 'border-b-2 border-b-red-500/80 border-dashed rounded-br-none' : ''
                }`}
                style={{
                  height: `${playlistHeight - 2}px`,
                  marginTop: '1px'
                }}
                title={`${scheduledItem.playlist_nome} (Duração original: ${durationString})`}
              >
                {isCut && (
                  <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-red-500/20 to-transparent pointer-events-none"></div>
                )}
                
                <div className="flex justify-between items-start h-full relative z-10">
                  <div className="min-w-0 flex-1 -mt-1">
                    <p className="text-white font-bold text-xs truncate leading-tight drop-shadow-md">
                      {scheduledItem.playlist_nome}
                    </p>
                    {slotsOccupied > 2 && (
                      <p className="text-[10px] font-semibold text-primary/80 truncate leading-none mt-1">
                        Toca até {formatSlotTime(slot + slotsOccupied)}
                      </p>
                    )}
                    {isCut && slotsOccupied > 3 && (
                      <p className="text-[9px] text-red-300 font-bold uppercase tracking-wider mt-1 flex items-center gap-1 drop-shadow-md">
                        <span className="material-symbols-outlined text-[10px]">content_cut</span>
                        Cortada pela próxima
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onRemovePlaylist(slot)}
                    className="p-1 rounded bg-red-500/20 opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all flex-shrink-0 -mt-1 border border-red-500/30"
                    title="Remover playlist"
                  >
                    <span className="material-symbols-outlined text-sm leading-none">close</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <div className="border-t border-white/10" style={{ height: '0px' }}></div>
    </div>
  );
};

const formatTotalDuration = (totalSeconds) => {
  if (typeof totalSeconds !== 'number' || totalSeconds <= 0) return '0m';
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  let result = '';
  
  if (hours > 0) result += `${hours}h `;
  if (minutes > 0) result += `${minutes}m `;
  
  return result.trim() || '0m';
};

const formatDateToYYYYMMDD = (date) => {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const calculateDurationStringToSeconds = (durationString) => {
  if (!durationString || typeof durationString !== 'string') return 0;
  
  let totalSeconds = 0;
  const hourMatch = durationString.match(/(\d+)\s*h/);
  const minMatch = durationString.match(/(\d+)\s*m/);
  const secMatch = durationString.match(/(\d+)\s*s/);
  
  if (hourMatch) totalSeconds += parseInt(hourMatch[1], 10) * 3600;
  if (minMatch) totalSeconds += parseInt(minMatch[1], 10) * 60;
  if (secMatch) totalSeconds += parseInt(secMatch[1], 10);
  
  return totalSeconds;
};

const getTodayAtMidnightLocal = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const getDatesForDayOfWeekInMonth = (year, month, dayOfWeek) => {
  const dates = [];
  const date = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  while (date.getDay() !== dayOfWeek) {
    date.setDate(date.getDate() + 1);
    if (date.getMonth() !== month) break;
  }

  while (date.getMonth() === month && date.getDate() <= daysInMonth) {
    dates.push(new Date(date.getTime()));
    date.setDate(date.getDate() + 7);
  }
  
  return dates;
};

export default function Schedule() {
  const navigate = useNavigate();
  
  const [playlists, setPlaylists] = useState([]);
  const [allTracks, setAllTracks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  
  const [originalClickedDate, setOriginalClickedDate] = useState(getTodayAtMidnightLocal());
  const [viewMode, setViewMode] = useState('selectingDays');
  const [selectedDates, setSelectedDates] = useState([getTodayAtMidnightLocal()]);
  
  const [currentSchedule, setCurrentSchedule] = useState({});
  const [repeatRule, setRepeatRule] = useState('NENHUMA');
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  
  const [activeStartDate, setActiveStartDate] = useState(new Date());
  const [scheduledDatesInMonth, setScheduledDatesInMonth] = useState([]);
  const [loadingMonthSummary, setLoadingMonthSummary] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [targetPlaylist, setTargetPlaylist] = useState(null);
  const [modalTime, setModalTime] = useState('12:00');

  useEffect(() => {
    const fetchData = async () => {
      setLoadingPlaylists(true);
      try {
        const [playlistsRes, tracksRes] = await Promise.all([
          axios.get(`${API_URL}/api/playlists`),
          axios.get(`${API_URL}/api/tracks`)
        ]);
        setPlaylists(playlistsRes.data || []);
        setAllTracks(tracksRes.data || []);
      } catch (err) {
        console.error("Erro ao buscar dados para agendamento", err);
        toast.error("Não foi possível carregar dados de playlists/músicas.");
      } finally {
        setLoadingPlaylists(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const queryDate = new Date(activeStartDate.getTime());
    queryDate.setDate(15);

    const fetchMonthSummary = async () => {
      setLoadingMonthSummary(true);
      const year = queryDate.getFullYear();
      const month = queryDate.getMonth() + 1;
      try {
        const response = await axios.get(`${API_URL}/api/agendamentos/summary/${year}/${month}`);
        setScheduledDatesInMonth(response.data || []);
      } catch (err) {
        console.error(`Erro ao buscar resumo para ${year}-${month}:`, err);
      } finally {
        setLoadingMonthSummary(false);
      }
    };
    
    const timer = setTimeout(fetchMonthSummary, 100);
    return () => clearTimeout(timer);
  }, [activeStartDate]);

  const getPlaylistDetails = (playlist) => {
    if (!allTracks || allTracks.length === 0) {
      return { count: 0, duration: '0m' };
    }
    const trackIds = Array.isArray(playlist.tracks_ids) ? playlist.tracks_ids : [];
    let totalDurationSeconds = 0;
    
    trackIds.forEach((id) => {
      const track = allTracks.find(t => t.id === Number(id));
      if (track) {
        const end = track.end_segundos ?? track.duracao_segundos;
        const start = track.start_segundos ?? 0;
        totalDurationSeconds += Math.max(0, end - start);
      }
    });

    return {
      count: trackIds.length,
      duration: formatTotalDuration(totalDurationSeconds)
    };
  };

  const filteredPlaylists = useMemo(() => {
    if (!searchTerm) return playlists;
    const lowerQuery = searchTerm.toLowerCase();
    return playlists.filter(p => p.nome.toLowerCase().includes(lowerQuery));
  }, [playlists, searchTerm]);

  const handleDateSelect = (value) => {
    const newDate = new Date(value);
    newDate.setHours(0, 0, 0, 0);
    setSelectedDates([newDate]);
    setOriginalClickedDate(newDate);
    setRepeatRule('NENHUMA');
  };

  const handleRepeatToggle = (e) => {
    const isChecking = e.target.checked;
    if (isChecking && originalClickedDate) {
      setRepeatRule('DIA_SEMANA_MES');
      const dates = getDatesForDayOfWeekInMonth(
        originalClickedDate.getFullYear(), 
        originalClickedDate.getMonth(), 
        originalClickedDate.getDay()
      );
      setSelectedDates(dates.filter(d => d.getDate() >= originalClickedDate.getDate()));
    } else {
      setRepeatRule('NENHUMA');
      if (originalClickedDate) setSelectedDates([originalClickedDate]);
    }
  };

  const handleConfirmSelection = async () => {
    if (selectedDates.length === 0) {
      toast.warn("Por favor, selecione pelo menos um dia.");
      return;
    }

    if (selectedDates.length === 1 && repeatRule === 'NENHUMA') {
      setLoadingSchedule(true);
      const dateString = formatDateToYYYYMMDD(selectedDates[0]);
      try {
        const response = await axios.get(`${API_URL}/api/agendamentos/${dateString}`);
        setCurrentSchedule(response.data || {});
      } catch (err) {
        toast.error("Não foi possível carregar o agendamento.");
        setCurrentSchedule({});
      } finally {
        setLoadingSchedule(false);
      }
    } else {
      setCurrentSchedule({});
    }
    setViewMode('editingGrade');
  };

  const handlePlaylistDragStart = (e, playlist) => {
    const data = JSON.stringify({ playlist_id: playlist.id, playlist_nome: playlist.nome });
    e.dataTransfer.setData("playlistData", data);
  };

  const handleDropPlaylistToSlot = (targetSlot, playlistDataString) => {
    if (selectedDates.length === 0) return;
    try {
      const playlistData = JSON.parse(playlistDataString);
      const droppedPlaylist = playlists.find(p => p.id === playlistData.playlist_id);
      if (!droppedPlaylist) return;

      const details = getPlaylistDetails(droppedPlaylist);
      const durationSeconds = calculateDurationStringToSeconds(details.duration);
      if (durationSeconds <= 0) return;

      setCurrentSchedule((prev) => ({
        ...prev,
        [targetSlot]: {
          playlist_id: playlistData.playlist_id,
          playlist_nome: playlistData.playlist_nome,
          duration_seconds: durationSeconds
        }
      }));
    } catch (e) {
      toast.error(`Erro: ${e.message}`);
    }
  };

  const handleRemovePlaylistFromSlot = (slot) => {
    setCurrentSchedule((prev) => {
      const newSchedule = { ...prev };
      delete newSchedule[slot];
      return newSchedule;
    });
  };

  const openAddModal = (playlist) => {
    if (viewMode !== 'editingGrade') {
      toast.warn("Por favor, selecione um dia no calendário e clique em 'Gerenciar Agendamento' antes de adicionar.");
      return;
    }
    setTargetPlaylist(playlist);
    setModalTime('12:00');
    setShowAddModal(true);
  };

  const confirmModalAdd = () => {
    if (!targetPlaylist) return;
    
    const [hours, minutes] = modalTime.split(':').map(Number);
    const targetSlot = (hours * 6) + Math.floor(minutes / 10);
    
    const playlistDataString = JSON.stringify({ 
      playlist_id: targetPlaylist.id, 
      playlist_nome: targetPlaylist.nome 
    });
    
    handleDropPlaylistToSlot(targetSlot, playlistDataString);
    setShowAddModal(false);
  };

  const handleSaveSchedule = async (exitOnSave = true) => {
    if (selectedDates.length === 0) return;

    setSavingSchedule(true);
    try {
      const scheduleToSend = {};
      Object.keys(currentSchedule).forEach((slot) => {
        if (currentSchedule[slot]?.playlist_id) {
          scheduleToSend[slot] = { playlist_id: currentSchedule[slot].playlist_id };
        }
      });

      const formattedDates = (repeatRule === 'DIA_SEMANA_MES')
        ? [formatDateToYYYYMMDD(selectedDates[0])]
        : selectedDates.map(date => formatDateToYYYYMMDD(date));

      await axios.post(`${API_URL}/api/agendamentos`, {
        dates: formattedDates,
        schedule: scheduleToSend,
        regra_repeticao: repeatRule === 'DIA_SEMANA_MES' ? 'DIA_SEMANA_MES' : 'NENHUMA'
      });

      toast.success('Agendamento salvo na base de dados!');
      
      const summaryResponse = await axios.get(`${API_URL}/api/agendamentos/summary/${activeStartDate.getFullYear()}/${activeStartDate.getMonth() + 1}`);
      setScheduledDatesInMonth(summaryResponse.data || []);

      if (exitOnSave) {
        setViewMode('selectingDays');
        setCurrentSchedule({});
        setRepeatRule('NENHUMA');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Falha ao salvar.");
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDownloadReport = () => {
    if (selectedDates.length !== 1) return;
    const dateString = formatDateToYYYYMMDD(selectedDates[0]);
    window.open(`${API_URL}/api/agendamentos/relatorio/${dateString}`, '_blank');
  };

  const handleClearSchedule = () => {
    if (window.confirm("Isso irá remover toda a programação visual desta grade. Continuar?")) {
      setCurrentSchedule({});
    }
  };

  const handleActiveStartDateChange = ({ activeStartDate }) => setActiveStartDate(activeStartDate);

  const tileClassName = ({ date, view }) => {
    if (view !== 'month') return null;
    const dateString = formatDateToYYYYMMDD(date);
    const classes = [];
    if (scheduledDatesInMonth.includes(dateString)) classes.push('scheduled-day');
    if (selectedDates.some(d => formatDateToYYYYMMDD(d) === dateString)) classes.push('react-calendar__tile--active');
    return classes.join(' ');
  };

  const showRepeatCheckbox = viewMode === 'selectingDays' && (selectedDates.length === 1 || repeatRule === 'DIA_SEMANA_MES');
  const showScheduleButton = viewMode === 'selectingDays' && selectedDates.length > 0;
  const isPastDateSelected = selectedDates.length === 1 && selectedDates[0] < getTodayAtMidnightLocal();

  const repeatLabel = useMemo(() => {
    if (!showRepeatCheckbox || !originalClickedDate) return "Repetir dia da semana no mês";
    const diaSemana = originalClickedDate.toLocaleDateString('pt-BR', { weekday: 'long' });
    const mes = originalClickedDate.toLocaleDateString('pt-BR', { month: 'long' });
    return `Repetir nas próximas ${diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)}s do mês de ${mes}`;
  }, [originalClickedDate, showRepeatCheckbox]);

  return (
    <div className="min-h-screen bg-gradient-warm flex">
      <Sidebar activePage="schedule" headerTitle="Agendamento" headerIcon="calendar_month" />

      <main className="ml-64 flex-1 p-8 relative">
        <div className="max-w-7xl mx-auto w-full">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">Agendamento de Transmissão</h1>
              <p className="text-text-muted text-sm">
                {viewMode === 'selectingDays' ? 'Selecione os dias para agendar a grade' : 'A rádio cortará a playlist anterior quando o horário da próxima bater.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 items-start">
            <div className="col-span-1 liquid-glass rounded-xl p-4 flex flex-col max-h-[calc(100vh-240px)]">
              <h2 className="text-lg font-bold text-white mb-3">Playlists Disponíveis</h2>
              <input
                type="text"
                placeholder="Buscar playlist..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm mb-3 placeholder:text-text-muted focus:ring-1 focus:ring-primary flex-shrink-0"
              />
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 -mr-2 scrollbar-thin scrollbar-thumb-primary/60 scrollbar-track-white/5">
                {loadingPlaylists ? (
                  <p className="text-xs text-text-muted text-center py-4">Carregando playlists...</p>
                ) : filteredPlaylists.length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-4">Nenhuma playlist encontrada.</p>
                ) : (
                  filteredPlaylists.map((playlist) => {
                    const details = getPlaylistDetails(playlist);
                    return (
                      <div
                        key={playlist.id}
                        draggable
                        onDragStart={(e) => handlePlaylistDragStart(e, playlist)}
                        className="flex items-center gap-3 p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-grab group border border-transparent hover:border-white/10"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm truncate">{playlist.nome}</p>
                          <p className="text-text-muted text-xs">{details.count} músicas • {details.duration}</p>
                        </div>
                        <button 
                          onClick={() => openAddModal(playlist)}
                          className="w-8 h-8 rounded-full bg-primary/20 text-primary hover:bg-primary hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all border border-primary/30 shrink-0"
                          title="Agendar horário manual"
                        >
                          <span className="material-symbols-outlined text-sm">add</span>
                        </button>
                        <span className="material-symbols-outlined text-text-muted/30 text-lg group-hover:text-primary transition-colors cursor-grab active:cursor-grabbing">drag_indicator</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="col-span-2 space-y-6">
              {viewMode === 'selectingDays' && (
                <div className="liquid-glass rounded-xl p-6 shadow-2xl">
                  <div className="mb-4 calendar-container max-w-md mx-auto">
                    <label className="block text-sm font-medium text-text-muted mb-1 text-center">Selecione as datas de transmissão</label>
                    <Calendar
                      onChange={handleDateSelect}
                      value={null}
                      onActiveStartDateChange={handleActiveStartDateChange}
                      activeStartDate={activeStartDate}
                      tileClassName={tileClassName}
                      locale="pt-BR"
                      className="bg-white/5 border border-white/10 rounded-lg p-2 text-text w-full shadow-inner"
                    />
                    {loadingMonthSummary && <div className="text-xs text-text-muted text-center mt-2 animate-pulse">Sincronizando calendário...</div>}
                  </div>

                  <div className="mt-6 flex flex-col items-center gap-4 p-4 bg-black/20 rounded-xl border border-white/5">
                    {showRepeatCheckbox && (
                      <div className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          id="repeat-schedule"
                          checked={repeatRule === 'DIA_SEMANA_MES'}
                          onChange={handleRepeatToggle}
                          className="w-5 h-5 rounded bg-black/40 border-white/30 text-primary focus:ring-primary cursor-pointer"
                        />
                        <label htmlFor="repeat-schedule" className="text-sm font-medium text-white cursor-pointer select-none">
                          {repeatLabel}
                        </label>
                      </div>
                    )}
                    {isPastDateSelected && (
                      <button onClick={handleDownloadReport} className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 bg-blue-400/10 px-4 py-2 rounded-lg border border-blue-400/20">
                        <span className="material-symbols-outlined text-base">download</span>
                        Baixar Relatório ({selectedDates[0].toLocaleDateString('pt-BR', { timeZone: 'UTC' })})
                      </button>
                    )}
                    {showScheduleButton && (
                      <button onClick={handleConfirmSelection} className="w-full max-w-sm bg-primary text-white px-6 py-3 rounded-lg font-bold hover:bg-primary/80 transition-all shadow-lg hover:shadow-primary/30 mt-2">
                        Abrir Grade de Horários
                      </button>
                    )}
                  </div>
                </div>
              )}

              {viewMode === 'editingGrade' && (
                <div className="liquid-glass rounded-xl p-6 shadow-2xl flex flex-col max-h-[calc(100vh-140px)]">
                  <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-4 shrink-0">
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-widest text-primary drop-shadow-md">Grade de Programação</h3>
                      <p className="text-sm font-semibold text-text-muted mt-1">
                        {selectedDates.length === 1
                          ? selectedDates[0].toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                          : `${selectedDates.length} dias selecionados`}
                        {repeatRule === 'DIA_SEMANA_MES' && " (Repetindo no mês)"}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setViewMode('selectingDays');
                        setCurrentSchedule({});
                        setRepeatRule('NENHUMA');
                        setSelectedDates([originalClickedDate || getTodayAtMidnightLocal()]);
                      }}
                      className="bg-white/5 border border-white/10 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white/10 transition-colors flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm">calendar_month</span>
                      Voltar ao Calendário
                    </button>
                  </div>

                  <div className="flex justify-end gap-3 mb-4 shrink-0">
                    <button
                      onClick={handleClearSchedule}
                      disabled={loadingSchedule || savingSchedule || Object.keys(currentSchedule).length === 0}
                      className="bg-white/5 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-500/10 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      Limpar
                    </button>
                    <button
                      onClick={() => handleSaveSchedule(false)}
                      disabled={savingSchedule}
                      className="bg-primary/20 border border-primary/50 text-primary px-6 py-2 rounded-lg text-sm font-bold hover:bg-primary hover:text-white transition-colors disabled:opacity-50"
                    >
                      {savingSchedule ? 'Salvando...' : 'Salvar Grade'}
                    </button>
                    <button
                      onClick={() => handleSaveSchedule(true)}
                      disabled={savingSchedule || loadingSchedule}
                      className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-primary/80 transition-all shadow-lg shadow-primary/30 disabled:opacity-50"
                    >
                      {savingSchedule ? 'Salvando...' : 'Salvar e Concluir'}
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 -mr-2 scrollbar-thin scrollbar-thumb-primary/60 scrollbar-track-white/5 border border-white/5 rounded-lg bg-black/20">
                    <SlotScheduleList
                      scheduleData={currentSchedule}
                      onDropPlaylist={handleDropPlaylistToSlot}
                      onRemovePlaylist={handleRemovePlaylistFromSlot}
                      loadingSchedule={loadingSchedule}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="liquid-glass bg-[#121212]/95 border border-white/20 rounded-3xl p-8 max-w-sm w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">schedule</span>
                Definir Horário
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-text-muted hover:text-white transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="bg-black/30 rounded-xl p-4 mb-6 border border-white/5">
              <p className="text-white font-bold truncate text-sm">{targetPlaylist?.nome}</p>
              <p className="text-text-muted text-xs mt-1">A playlist entrará no ar neste momento exato.</p>
            </div>

            <div className="mb-8">
              <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2 ml-1">Hora de Início</label>
              <input 
                type="time" 
                step="600"
                className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-white text-xl text-center font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                value={modalTime}
                onChange={(e) => setModalTime(e.target.value)}
              />
              <p className="text-[10px] text-text-muted text-center mt-2">A grade é dividida em blocos de 10 minutos.</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl transition-colors border border-white/10">
                Cancelar
              </button>
              <button onClick={confirmModalAdd} className="flex-1 bg-primary hover:bg-primary/80 shadow-lg shadow-primary/30 text-white font-bold py-3 rounded-xl transition-all">
                Injetar na Grade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}