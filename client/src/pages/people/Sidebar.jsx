import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Sidebar({
  activePage,
  headerTitle,
  headerIcon,
  headerExtra,
  isEditMode = false,
  group = 'radio',
  unit,
}) {
  const navigate = useNavigate();

  const handleOpenPlayer = () => {
    window.open('/radio/watch', '_blank');
  };

  const savedUnit = localStorage.getItem('dedalos_active_unit');
  const activeUnit = unit || savedUnit || 'sp';

  const menus = {
    radio: [
      { id: 'home', label: 'Home', icon: 'home', path: activeUnit === 'bh' ? '/bh' : '/' },
      { id: 'dj', label: 'Painel do DJ', icon: 'album', path: '/radio/dj' },
      { id: 'collection', label: 'Acervo', icon: 'music_video', path: '/radio/collection' },
      { id: 'playlist-creator', label: 'Criar Playlist', icon: 'playlist_add', path: '/radio/playlist-creator' },
      { id: 'library', label: 'Biblioteca', icon: 'library_music', path: '/radio/library' },
      { id: 'schedule', label: 'Agendamento', icon: 'calendar_month', path: '/radio/schedule' },
      { id: 'jukebox', label: 'Jukebox', icon: 'queue_music', path: `/radio/jukebox/${activeUnit}` },
    ],
    maintenance: [
      { id: 'home', label: 'Home', icon: 'home', path: activeUnit === 'bh' ? '/bh' : '/' },
      { type: 'label', label: 'QUINTA PREMIADA' },
      { id: 'thursday', label: 'Sorteador', icon: 'stars', path: `/tools/thursday/${activeUnit}` },
      { type: 'label', label: 'TABELA DE PREÇOS' },
      { id: 'prices-maintenance', label: 'Manutenção', icon: 'edit_note', path: `/tools/prices/maintenance/${activeUnit}` },
      { id: 'prices-view', label: 'Tabela', icon: 'table_view', path: `/tools/prices/display/${activeUnit}` },
      { type: 'label', label: 'PLACAR DEDALOS' },
      { id: 'scoreboard-maintenance', label: 'Manutenção', icon: 'settings_remote', path: `/tools/scoreboard/maintenance/${activeUnit}` },
      { id: 'scoreboard-display', label: 'Placar', icon: 'scoreboard', path: `/tools/scoreboard/display/${activeUnit}` },
      { id: 'scoreboard-game', label: 'Game', icon: 'sports_esports', path: `/tools/scoreboard/game/${activeUnit}` },
    ],
    identification: [
      { id: 'home', label: 'Home', icon: 'home', path: activeUnit === 'bh' ? '/bh' : '/' },
      { type: 'label', label: 'IDENTIFICAÇÃO (CRACHÁS)' },
      { id: 'generator', label: 'Gerador', icon: 'badge', path: '/people/nametag' },
      { id: 'models', label: 'Modelos', icon: 'style', path: '/people/models' },
      { type: 'label', label: 'BENEFÍCIOS' },
      { id: 'conference', label: 'Conferência', icon: 'assignment_turned_in', path: '/people/benefits' },
    ],
    cx: [
      { id: 'home', label: 'Home', icon: 'home', path: activeUnit === 'bh' ? '/bh' : '/' },
      { id: 'pesquisa-satisfacao', label: 'Pesquisa', icon: 'thumb_up', path: '/cx/pesquisa' },
      { id: 'avaliacoes', label: 'Avaliações', icon: 'reviews', path: '/cx/avaliacoes' },
    ],
  };

  const themeColors = {
    radio: {
      gradient: 'from-primary to-red-600',
      text: 'text-primary',
      activeBg: 'bg-primary/20',
      activeText: 'text-primary',
      activeBorder: 'border-primary/50',
    },
    maintenance: {
      gradient: 'from-blue-600 to-cyan-500',
      text: 'text-cyan-400',
      activeBg: 'bg-blue-500/20',
      activeText: 'text-cyan-400',
      activeBorder: 'border-blue-500/50',
    },
    identification: {
      gradient: 'from-emerald-600 to-green-500',
      text: 'text-emerald-400',
      activeBg: 'bg-emerald-500/20',
      activeText: 'text-emerald-400',
      activeBorder: 'border-emerald-500/50',
    },
    people: {
      gradient: 'from-emerald-600 to-green-500',
      text: 'text-emerald-400',
      activeBg: 'bg-emerald-500/20',
      activeText: 'text-emerald-400',
      activeBorder: 'border-emerald-500/50',
    },
    cx: {
      gradient: 'from-purple-600 to-pink-500',
      text: 'text-pink-400',
      activeBg: 'bg-purple-500/20',
      activeText: 'text-pink-400',
      activeBorder: 'border-purple-500/50',
    },
  };

  const currentMenu = menus[group] || menus[group === 'people' ? 'identification' : 'radio'] || menus.radio;
  const theme = themeColors[group] || themeColors.radio;

  const getGroupSubtitle = () => {
    switch (group) {
      case 'maintenance':
        return `Unidade ${activeUnit.toUpperCase()}`;
      case 'identification':
      case 'people':
        return 'Gestão de Pessoas';
      case 'cx':
        return 'Experiência do Cliente';
      default:
        return 'Rádio Dedalos';
    }
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-bg-dark-primary/50 backdrop-blur-sm border-r border-white/10 p-4 flex flex-col justify-between z-10 shadow-2xl">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${theme.gradient} flex items-center justify-center shadow-lg`}>
              <span className="material-symbols-outlined text-white text-2xl">
                {headerIcon}
              </span>
            </div>
            {headerExtra}
          </div>
          <div className="flex flex-col">
            <h1 className="text-white text-lg font-bold leading-tight">
              {headerTitle}
            </h1>
            <p className="text-text-muted text-xs uppercase tracking-wider font-semibold opacity-70">
              {getGroupSubtitle()}
            </p>
          </div>
        </div>

        <nav className="flex flex-col gap-1 overflow-y-auto pr-2 custom-scrollbar max-h-[calc(100vh-200px)]">
          {currentMenu.map((item, idx) => {
            if (item.type === 'label') {
              return (
                <div key={`label-${idx}`} className="mt-4 mb-2 px-2 border-b border-white/5 pb-1">
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${theme.text} opacity-80`}>
                    {item.label}
                  </p>
                </div>
              );
            }

            if (item.id === 'playlist-creator' && isEditMode) {
              return (
                <div key={item.id} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/20 border border-primary/50 relative mb-1">
                  <button
                    onClick={() => navigate('/radio/playlist-creator')}
                    className="p-2 rounded-md hover:bg-white/10 text-primary transition-colors"
                    title="Voltar para Criação"
                  >
                    <span className="material-symbols-outlined text-lg">
                      arrow_back_ios_new
                    </span>
                  </button>
                  <div className="flex items-center gap-3 px-2 py-1 text-primary flex-1 justify-center">
                    <span className="material-symbols-outlined">playlist_add</span>
                    <p className="text-sm font-semibold">Editando</p>
                  </div>
                </div>
              );
            }

            const isActive = activePage === item.id;
            const activeStyles = `${theme.activeBg} ${theme.activeText} ${theme.activeBorder} shadow-md`;
            const inactiveStyles = 'hover:bg-white/10 text-white/80 hover:text-white';

            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 border border-transparent group ${
                  isActive ? activeStyles : inactiveStyles
                }`}
              >
                <span className={`material-symbols-outlined transition-transform group-hover:scale-110 ${isActive ? '' : 'opacity-70'}`}>
                  {item.icon}
                </span>
                <p className={`text-base ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {item.label}
                </p>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex flex-col gap-3">
        {group === 'radio' && (
          <button
            onClick={handleOpenPlayer}
            className="flex w-full items-center justify-center gap-2 rounded-lg h-12 px-4 text-white text-base font-bold bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 transition-all shadow-lg hover:shadow-red-900/40 transform hover:-translate-y-0.5"
          >
            <span className="material-symbols-outlined animate-pulse">sensors</span>
            <span className="truncate">Ao Vivo</span>
          </button>
        )}
        <div className="text-center text-xs text-text-muted pb-2 pt-4 border-t border-white/5">
          <p>
            © Developed by:{' '}
            <span className={`${theme.text} font-semibold`}>Matteus Tirado</span>
          </p>
        </div>
      </div>
    </aside>
  );
}