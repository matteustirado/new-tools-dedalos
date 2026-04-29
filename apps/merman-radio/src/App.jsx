import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import MainLayout from './components/MainLayout';

const Login = lazy(() => import('./pages/Login'));
const Library = lazy(() => import('./pages/Library'));
const OrderHistory = lazy(() => import('./pages/OrderHistory'));
const Playlists = lazy(() => import('./pages/Playlists'));
const PlaylistCreator = lazy(() => import('./pages/PlaylistCreator'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Mixer = lazy(() => import('./pages/Mixer'));
const WatchVideo = lazy(() => import('./pages/WatchVideo'));
const Jukebox = lazy(() => import('./pages/Jukebox'));

const Placeholder = ({ title }) => (
  <div className="animate-page-transition">
    <h2 className="text-2xl font-black text-cyan-400 uppercase tracking-tighter mb-2">{title}</h2>
    <div className="h-[2px] w-12 bg-cyan-500/30 mb-6" />
    <p className="text-cyan-100/40 font-medium italic">Módulo em fase de desenvolvimento...</p>
  </div>
);

function ScrollManager() {
  const location = useLocation();

  useEffect(() => {
    let timeoutId;
    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        sessionStorage.setItem(`scroll_pos_${location.pathname}`, window.scrollY.toString());
      }, 150);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timeoutId);
    };
  }, [location.pathname]);

  useEffect(() => {
    const savedPosition = sessionStorage.getItem(`scroll_pos_${location.pathname}`);
    if (savedPosition) {
      setTimeout(() => window.scrollTo(0, parseInt(savedPosition, 10)), 10);
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname]);

  return null;
}

function App() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
  }, []);

  return (
    <BrowserRouter>
      <ScrollManager />
      
      <ToastContainer
        position="top-center"
        autoClose={3000}
        hideProgressBar
        theme="dark"
        toastClassName="mx-4 mt-4 bg-[#061224]/95 text-cyan-50 font-bold border border-cyan-900/30 rounded-2xl shadow-2xl backdrop-blur-xl"
      />

      <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/live" element={<WatchVideo />} />
          <Route path="/jukebox" element={<Jukebox />} />
          <Route path="/jukebox/:unidade" element={<Jukebox />} />
          
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<Placeholder title="Dashboard Geral" />} />
            <Route path="/library" element={<Library />} />
            <Route path="/playlists" element={<Playlists />} />
            <Route path="/playlist-creator" element={<PlaylistCreator />} />
            <Route path="/playlist-creator/:playlistId" element={<PlaylistCreator />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/order-history" element={<OrderHistory />} />
            <Route path="/mixer" element={<Mixer />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;