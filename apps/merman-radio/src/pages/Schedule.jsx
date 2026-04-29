import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import { toast } from 'react-toastify';
import { Clock, X, Plus, GripVertical, Scissors, Calendar as CalendarIcon, Download, Search, Check, ListMusic, ArrowLeft, Loader2 } from 'lucide-react';
import api from '../services/api';

const SLOTS_PER_DAY = 144;
const SLOT_DURATION_SECONDS = 600;
const SLOT_HEIGHT = 22;

const SlotScheduleList = ({ scheduleData, onDropPlaylist, onRemovePlaylist, loadingSchedule, onSlotClick }) => {
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
    const data = e.dataTransfer.getData('playlistData');
    if (data) onDropPlaylist(slot, data);
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
    if (minutes > 0) result += `${minutes}m`;
    return result.trim();
  };

  if (loadingSchedule) {
    return (
      <div className="flex flex-col justify-center items-center h-full text-cyan-500 min-h-[300px]">
        <Loader2 size={32} className="animate-spin mb-3" />
        <span className="text-xs font-bold tracking-widest uppercase">Carregando grade...</span>
      </div>
    );
  }

  const activeSlots = scheduleData ? Object.keys(scheduleData).map(Number).sort((a, b) => a - b) : [];

  return (
    <div className="relative">
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
          const nextSlot = (currentIndex !== -1 && currentIndex < activeSlots.length - 1) ? activeSlots[currentIndex + 1] : SLOTS_PER_DAY;
          
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
            onClick={() => !scheduledItem && onSlotClick && onSlotClick(slot)}
            className={`flex items-start border-white/5 relative group cursor-pointer lg:cursor-default transition-colors ${
              isDragOver ? 'bg-cyan-500/10' : 'hover:bg-white/[0.02]'
            } ${isTopOfHour ? 'border-t border-white/20' : 'border-t'}`}
            style={{ height: `${SLOT_HEIGHT}px` }}
          >
            <span className={`text-[10px] font-mono w-12 text-right flex-shrink-0 pt-[2px] pr-2 z-0 ${isTopOfHour ? 'text-white font-bold' : 'text-white/30'}`}>
              {timeString}
            </span>

            {!scheduledItem && (
              <div className={`flex-1 flex items-center justify-center text-[10px] h-full border-l border-white/5 transition-colors z-0 ${isDragOver ? 'bg-cyan-500/20 border-l-cyan-500/50' : ''}`}>
                <Plus size={14} className="text-cyan-500/0 lg:hidden group-hover:text-cyan-500/50 transition-colors" />
              </div>
            )}

            {scheduledItem && (
              <div
                className={`absolute left-[48px] right-0 top-0 z-10 p-1 pl-3 bg-cyan-900/60 border-l-4 border-l-cyan-400 rounded-r-lg text-sm flex flex-col justify-start overflow-hidden shadow-lg backdrop-blur-md transition-all hover:bg-cyan-800/80 hover:z-30 cursor-default ${
                  isCut ? 'border-b border-b-red-500/80 border-dashed rounded-br-none' : ''
                }`}
                style={{ height: `${playlistHeight - 1}px`, marginTop: '1px' }}
                title={`${scheduledItem.playlist_nome} (Duração original: ${durationString})`}
              >
                {isCut && <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-red-500/20 to-transparent pointer-events-none" />}
                
                <div className="flex justify-between items-start h-full relative z-10 w-full">
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-black text-xs truncate leading-tight drop-shadow-md">
                      {scheduledItem.playlist_nome}
                    </p>
                    {slotsOccupied > 2 && (
                      <p className="text-[9px] font-black text-cyan-300 truncate leading-none mt-1 tracking-widest uppercase">
                        ATÉ {formatSlotTime(slot + slotsOccupied)}
                      </p>
                    )}
                    {isCut && slotsOccupied > 3 && (
                      <p className="text-[9px] text-red-400 font-black uppercase tracking-widest mt-1 flex items-center gap-1 drop-shadow-md">
                        <Scissors size={10} /> Cortada
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemovePlaylist(slot); }}
                    className="p-1 rounded-md bg-red-500/20 text-red-400 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all flex-shrink-0 -mt-0.5 border border-red-500/30"
                    title="Remover playlist"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
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

  const [mobilePickerSlot, setMobilePickerSlot] = useState(null);
  const [showMobilePicker, setShowMobilePicker] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      setLoadingPlaylists(true);
      try {
        const [playlistsRes, tracksRes] = await Promise.all([
          api.get('/api/playlists'),
          api.get('/api/tracks')
        ]);
        if (!mounted) return;
        setPlaylists(playlistsRes.data || []);
        setAllTracks(tracksRes.data || []);
      } catch (error) {
        if (!mounted) return;
        console.error("Usando mocks na página de agendamento:", error);
        setPlaylists([
          { id: 1, nome: "Pop Hits 2026", descricao: "As mais pedidas.", tracks_ids: [1, 2] },
          { id: 2, nome: "Esquenta Fim de Semana", descricao: "Anima a pista.", tracks_ids: [1, 2, 3, 4] },
          { id: 3, nome: "Comerciais e Avisos", descricao: "Chamadas.", tracks_ids: [1] }
        ]);
        setAllTracks([
          { id: 1, duracao_segundos: 3600 }, { id: 2, duracao_segundos: 1800 }, 
          { id: 3, duracao_segundos: 2400 }, { id: 4, duracao_segundos: 2000 }
        ]);
      } finally {
        if (mounted) setLoadingPlaylists(false);
      }
    };
    fetchData();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    const queryDate = new Date(activeStartDate.getTime());
    queryDate.setDate(15);

    const fetchMonthSummary = async () => {
      setLoadingMonthSummary(true);
      const year = queryDate.getFullYear();
      const month = queryDate.getMonth() + 1;
      try {
        const response = await api.get(`/api/agendamentos/summary/${year}/${month}`);
        if (mounted) setScheduledDatesInMonth(response.data || []);
      } catch (error) {
        console.error("Usando mock para resumo do mês:", error);
        if (mounted) setScheduledDatesInMonth(['2026-04-15', '2026-04-20']);
      } finally {
        if (mounted) setLoadingMonthSummary(false);
      }
    };
    
    const timer = setTimeout(fetchMonthSummary, 300);
    return () => { mounted = false; clearTimeout(timer); };
  }, [activeStartDate]);

  const getPlaylistDetails = (playlist) => {
    if (!allTracks || allTracks.length === 0) return { count: 0, duration: '0m' };
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
    return { count: trackIds.length, duration: formatTotalDuration(totalDurationSeconds), seconds: totalDurationSeconds };
  };

  const filteredPlaylists = useMemo(() => {
    if (!searchTerm) return playlists;
    const lowerQuery = searchTerm.toLowerCase();
    return playlists.filter(p => p.nome.toLowerCase().includes(lowerQuery));
  }, [playlists, searchTerm]);

  const handleActiveStartDateChange = ({ activeStartDate }) => setActiveStartDate(activeStartDate);

  const handleDateSelect = (value) => {
    const newDate = new Date(value);
    newDate.setHours(0, 0, 0, 0);
    setSelectedDates([newDate]);
    setOriginalClickedDate(newDate);
    setRepeatRule('NENHUMA');
  };

  const handleRepeatToggle = () => {
    const isChecking = repeatRule === 'NENHUMA';
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
        const response = await api.get(`/api/agendamentos/${dateString}`);
        setCurrentSchedule(response.data || {});
      } catch (error) {
        console.error("Usando mock para a grade de um dia:", error);
        setCurrentSchedule({ 72: { playlist_id: 1, playlist_nome: "Pop Hits 2026", duration_seconds: 5400 } });
      } finally {
        setLoadingSchedule(false);
      }
    } else {
      setCurrentSchedule({});
    }
    setViewMode('editingGrade');
    window.scrollTo(0,0);
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
      if (details.seconds <= 0) return;

      setCurrentSchedule((prev) => ({
        ...prev,
        [targetSlot]: {
          playlist_id: playlistData.playlist_id,
          playlist_nome: playlistData.playlist_nome,
          duration_seconds: details.seconds
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
      toast.warn("Selecione um dia no calendário antes de adicionar.");
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
    const playlistDataString = JSON.stringify({ playlist_id: targetPlaylist.id, playlist_nome: targetPlaylist.nome });
    handleDropPlaylistToSlot(targetSlot, playlistDataString);
    setShowAddModal(false);
  };

  const handleSlotClick = (slot) => {
    setMobilePickerSlot(slot);
    setShowMobilePicker(true);
  };

  const confirmMobilePickerAdd = (playlist) => {
    const playlistDataString = JSON.stringify({ playlist_id: playlist.id, playlist_nome: playlist.nome });
    handleDropPlaylistToSlot(mobilePickerSlot, playlistDataString);
    setShowMobilePicker(false);
    setMobilePickerSlot(null);
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

      await api.post('/api/agendamentos', {
        dates: formattedDates,
        schedule: scheduleToSend,
        regra_repeticao: repeatRule === 'DIA_SEMANA_MES' ? 'DIA_SEMANA_MES' : 'NENHUMA'
      });

      toast.success('Agendamento salvo na base de dados!');
      
      const summaryResponse = await api.get(`/api/agendamentos/summary/${activeStartDate.getFullYear()}/${activeStartDate.getMonth() + 1}`);
      setScheduledDatesInMonth(summaryResponse.data || []);

      if (exitOnSave) {
        setViewMode('selectingDays');
        setCurrentSchedule({});
        setRepeatRule('NENHUMA');
      }
    } catch (error) {
      console.error("Mock - Falha de rede capturada:", error);
      toast.success("Salvo! (Simulação MOCK)");
      if (exitOnSave) {
        setViewMode('selectingDays');
        setCurrentSchedule({});
      }
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDownloadReport = () => {
    if (selectedDates.length !== 1) return;
    const dateString = formatDateToYYYYMMDD(selectedDates[0]);
    window.open(`${api.defaults.baseURL}/api/agendamentos/relatorio/${dateString}`, '_blank');
  };

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
    return `Repetir nas próximas ${diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)}s de ${mes}`;
  }, [originalClickedDate, showRepeatCheckbox]);

  return (
    <>
      <style>{`
        /* CSS do React Calendar */
        .react-calendar { background: transparent; border: none; font-family: inherit; color: white; width: 100%; max-width: 100%; margin: 0 auto; padding: 0; line-height: 1.125em; }
        .react-calendar__navigation { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; gap: 8px; }
        .react-calendar__navigation button { color: white; min-width: 44px; height: 44px; background: rgba(255,255,255,0.05); font-size: 16px; border-radius: 12px; font-weight: 900; transition: 0.2s; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.05); }
        .react-calendar__navigation button:hover { background: rgba(6,182,212,0.2); color: #22d3ee; border-color: rgba(6,182,212,0.4); }
        .react-calendar__navigation button:disabled { opacity: 0.2; cursor: not-allowed; }
        .react-calendar__navigation__label { flex-grow: 1 !important; font-size: 16px !important; text-transform: uppercase; letter-spacing: 0.1em; background: transparent !important; margin: 0 8px !important; pointer-events: none; border: none !important; }
        .react-calendar__month-view__weekdays { text-align: center; text-transform: uppercase; font-size: 11px; font-weight: 900; color: rgba(255,255,255,0.4); padding-bottom: 16px; }
        .react-calendar__month-view__weekdays__weekday abbr { text-decoration: none; border-bottom: none; cursor: default; }
        .react-calendar__month-view__days { display: grid !important; grid-template-columns: repeat(7, 1fr); gap: 6px; }
        .react-calendar__month-view__days__day { color: white; aspect-ratio: 1; border-radius: 14px; font-weight: 700; font-size: 15px; transition: 0.2s; border: 2px solid transparent !important; background: rgba(255,255,255,0.02); display: flex; align-items: center; justify-content: center; padding: 0 !important; max-width: 100%; overflow: hidden; }
        .react-calendar__tile:enabled:hover, .react-calendar__tile:enabled:focus { background: rgba(6,182,212,0.1) !important; color: #22d3ee; border-color: rgba(6,182,212,0.3) !important; }
        .react-calendar__tile--active { background: #0891b2 !important; color: white !important; font-weight: 900; box-shadow: 0 0 15px rgba(6,182,212,0.4); border: 2px solid #22d3ee !important; }
        .react-calendar__tile--now { background: rgba(255,255,255,0.08); color: #22d3ee; border: 2px solid rgba(255,255,255,0.15) !important; }
        .react-calendar__month-view__days__day--neighboringMonth { color: rgba(255,255,255,0.1) !important; background: transparent; pointer-events: none; border-color: transparent !important; }
        .scheduled-day { position: relative; }
        .scheduled-day::after { content: ''; position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%); width: 4px; height: 4px; background-color: #22d3ee; border-radius: 50%; box-shadow: 0 0 5px #22d3ee; }

        /* Custom Scrollbar */
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(2, 8, 19, 0.5); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 10px; border: 2px solid rgba(2, 8, 19, 1); }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(6, 182, 212, 0.5); }
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.15) rgba(2, 8, 19, 0.5); }
      `}</style>

      <div className="max-w-7xl mx-auto w-full animate-fade-in mt-4 md:mt-0">
        <div className="flex flex-row items-center md:items-end justify-between gap-4 mb-6 md:mb-8">
          <h1 className="text-xl md:text-3xl font-black text-white tracking-tight">Agendamentos</h1>
          
          <div className="flex gap-2 md:gap-3">
            {viewMode === 'editingGrade' && (
              <button
                onClick={() => {
                  setViewMode('selectingDays');
                  setCurrentSchedule({});
                  setRepeatRule('NENHUMA');
                  setSelectedDates([originalClickedDate || getTodayAtMidnightLocal()]);
                }}
                className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white w-10 h-10 md:w-auto md:h-auto md:px-4 md:py-2.5 rounded-xl border border-white/10 transition-colors font-bold text-xs uppercase tracking-wider"
                title="Voltar ao Calendário"
              >
                <ArrowLeft size={18} />
                <span className="hidden md:inline">Voltar</span>
              </button>
            )}
            <button
              onClick={() => navigate('/playlists')}
              className="flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white w-10 h-10 md:w-auto md:h-auto md:px-4 md:py-2.5 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all font-bold text-xs uppercase tracking-wider active:scale-95"
              title="Playlists"
            >
              <ListMusic size={18} strokeWidth={3} />
              <span className="hidden md:inline">Playlists</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="hidden lg:flex col-span-1 bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-xl flex-col h-[750px]">
            <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-widest mb-4">Playlists Disponíveis</h2>
            <div className="relative mb-4 shrink-0">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Buscar playlist..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-11 bg-[#020813] border border-white/10 rounded-xl pl-9 pr-4 text-white text-sm font-medium placeholder:text-white/20 focus:border-cyan-500 outline-none transition-all"
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {loadingPlaylists ? (
                <div className="flex flex-col items-center justify-center h-full text-cyan-500">
                  <Loader2 size={32} className="animate-spin mb-3" />
                  <span className="text-xs font-bold tracking-widest uppercase">Carregando...</span>
                </div>
              ) : filteredPlaylists.length === 0 ? (
                <p className="text-white/40 text-center text-xs font-medium mt-10">Nenhuma playlist.</p>
              ) : (
                filteredPlaylists.map((playlist) => {
                  const details = getPlaylistDetails(playlist);
                  return (
                    <div
                      key={playlist.id}
                      draggable
                      onDragStart={(e) => handlePlaylistDragStart(e, playlist)}
                      className="flex items-center gap-3 p-3 bg-[#020813]/60 border border-white/5 rounded-xl hover:bg-cyan-500/10 hover:border-cyan-500/30 transition-all cursor-grab active:cursor-grabbing group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0 border border-white/10 group-hover:bg-cyan-500/20 transition-colors">
                        <ListMusic size={18} className="text-white/40 group-hover:text-cyan-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm truncate group-hover:text-cyan-400 transition-colors">{playlist.nome}</p>
                        <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mt-0.5">{details.count} Músicas • {details.duration}</p>
                      </div>
                      <button 
                        onClick={() => openAddModal(playlist)}
                        className="w-8 h-8 rounded-lg bg-white/5 text-white/40 hover:bg-cyan-500 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shrink-0"
                        title="Agendar manual"
                      >
                        <Plus size={16} />
                      </button>
                      <GripVertical size={16} className="text-white/20 shrink-0" />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="col-span-1 lg:col-span-2">
            {viewMode === 'selectingDays' ? (
              <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-6 lg:p-10 shadow-xl flex flex-col items-center h-auto lg:h-[750px] justify-start lg:justify-center relative">
                <div className="w-full max-w-md mb-6 lg:mb-10">
                  <Calendar
                    onChange={handleDateSelect}
                    value={null}
                    onActiveStartDateChange={handleActiveStartDateChange}
                    activeStartDate={activeStartDate}
                    tileClassName={tileClassName}
                    locale="pt-BR"
                  />
                  {loadingMonthSummary && <div className="text-[10px] text-cyan-500 font-bold uppercase tracking-widest text-center mt-4 animate-pulse">Sincronizando...</div>}
                </div>

                <div className="w-full flex flex-col items-center gap-3 mt-2 lg:mt-6 pt-6 border-t border-white/10 max-w-md">
                  {showRepeatCheckbox && (
                    <button 
                      onClick={handleRepeatToggle}
                      className="flex items-center gap-3 bg-[#020813] border border-white/10 hover:border-cyan-500/50 px-4 py-3.5 rounded-xl transition-all w-full"
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${repeatRule === 'DIA_SEMANA_MES' ? 'bg-cyan-500 border-cyan-500' : 'bg-black/40 border-white/20'}`}>
                        {repeatRule === 'DIA_SEMANA_MES' && <Check size={14} className="text-white" strokeWidth={3} />}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/80">{repeatLabel}</span>
                    </button>
                  )}

                  {isPastDateSelected && (
                    <button onClick={handleDownloadReport} className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 px-6 py-3.5 rounded-xl border border-cyan-500/20 w-full transition-all">
                      <Download size={16} /> Relatório de Transmissão
                    </button>
                  )}

                  {showScheduleButton && (
                    <button onClick={handleConfirmSelection} className="flex items-center justify-center gap-2 w-full bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] active:scale-95">
                      <CalendarIcon size={18} /> Abrir Grade de Horários
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-4 md:p-6 shadow-xl flex flex-col h-[750px]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-white/10 pb-4 shrink-0">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                      Grade <span className="text-cyan-500">{selectedDates.length === 1 ? selectedDates[0].toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : `${selectedDates.length} dias`}</span>
                    </h3>
                    {repeatRule === 'DIA_SEMANA_MES' && <p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mt-1">Repetindo no mês</p>}
                  </div>
                  <div className="flex justify-end gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => { if (window.confirm("Remover tudo desta grade?")) setCurrentSchedule({}); }}
                      disabled={loadingSchedule || savingSchedule || Object.keys(currentSchedule).length === 0}
                      className="bg-red-500/10 text-red-400 px-4 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50"
                    >
                      Limpar
                    </button>
                    <button
                      onClick={() => handleSaveSchedule(true)}
                      disabled={savingSchedule || loadingSchedule}
                      className="bg-cyan-600 text-white px-6 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-cyan-500 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-50 flex items-center justify-center min-w-[140px] flex-1 sm:flex-none"
                    >
                      {savingSchedule ? <Loader2 size={14} className="animate-spin" /> : 'Salvar Grade'}
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar bg-[#020813]/60 rounded-xl border border-white/5 relative">
                  <SlotScheduleList
                    scheduleData={currentSchedule}
                    onDropPlaylist={handleDropPlaylistToSlot}
                    onRemovePlaylist={handleRemovePlaylistFromSlot}
                    loadingSchedule={loadingSchedule}
                    onSlotClick={handleSlotClick}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020813]/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[#061224] border border-cyan-500/30 rounded-3xl p-8 max-w-sm w-full shadow-[0_0_50px_rgba(6,182,212,0.15)]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Clock size={20} className="text-cyan-500" /> Horário
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-white/40 hover:text-red-500 transition-colors bg-white/5 p-1.5 rounded-lg">
                <X size={16} strokeWidth={3} />
              </button>
            </div>
            
            <div className="bg-[#020813] rounded-xl p-4 mb-6 border border-white/10">
              <p className="text-white font-bold truncate text-sm">{targetPlaylist?.nome}</p>
              <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mt-1">A playlist entrará neste horário</p>
            </div>

            <div className="mb-8">
              <input 
                type="time" 
                step="600"
                className="w-full bg-[#020813] border border-white/20 rounded-xl px-4 py-4 text-white text-3xl text-center font-black outline-none focus:border-cyan-500 transition-all"
                value={modalTime}
                onChange={(e) => setModalTime(e.target.value)}
              />
              <p className="text-[10px] text-cyan-500/60 font-bold text-center mt-3 uppercase tracking-widest">Blocos de 10 minutos</p>
            </div>

            <button onClick={confirmModalAdd} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase tracking-widest text-xs py-4 rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] active:scale-95">
              Inserir na Grade
            </button>
          </div>
        </div>
      )}

      {showMobilePicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#020813]/80 backdrop-blur-md lg:hidden animate-fade-in">
          <div className="bg-[#061224] border-t border-cyan-500/30 rounded-t-3xl p-6 w-full max-h-[85vh] flex flex-col shadow-[0_-10px_40px_rgba(6,182,212,0.15)] animate-slide-up">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-widest">Selecionar Playlist</h2>
                <p className="text-[10px] font-black text-cyan-500 uppercase tracking-widest mt-1">
                  Horário: {Math.floor((mobilePickerSlot * 10) / 60).toString().padStart(2, '0')}:{(mobilePickerSlot * 10) % 60 === 0 ? '00' : (mobilePickerSlot * 10) % 60}
                </p>
              </div>
              <button onClick={() => setShowMobilePicker(false)} className="text-white/40 hover:text-red-500 transition-colors bg-white/5 p-2 rounded-xl">
                <X size={20} strokeWidth={3} />
              </button>
            </div>

            <div className="relative mb-4 shrink-0">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-11 bg-[#020813] border border-white/10 rounded-xl pl-9 pr-4 text-white text-sm font-medium placeholder:text-white/20 focus:border-cyan-500 outline-none transition-all"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {filteredPlaylists.length === 0 ? (
                <p className="text-white/40 text-center text-xs font-medium mt-10">Nenhuma playlist.</p>
              ) : (
                filteredPlaylists.map((playlist) => {
                  const details = getPlaylistDetails(playlist);
                  return (
                    <button
                      key={playlist.id}
                      onClick={() => confirmMobilePickerAdd(playlist)}
                      className="w-full flex items-center gap-3 p-3 bg-[#020813]/60 border border-white/5 rounded-xl hover:bg-cyan-500/10 hover:border-cyan-500/30 transition-all text-left group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
                        <ListMusic size={18} className="text-cyan-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm truncate">{playlist.nome}</p>
                        <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mt-0.5">{details.count} Músicas • {details.duration}</p>
                      </div>
                      <Plus size={16} className="text-white/20 group-hover:text-cyan-400" />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}