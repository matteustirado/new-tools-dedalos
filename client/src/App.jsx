import React, { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import ConnectionGuardian from './components/ConnectionGuardian';
import Home from './pages/Home';
import DJController from './pages/radio/DJController';
import MusicCollection from './pages/radio/MusicCollection';
import PlaylistCreator from './pages/radio/PlaylistCreator';
import Library from './pages/radio/Library';
import Schedule from './pages/radio/Schedule';
import WatchVideo from './pages/radio/WatchVideo';
import Jukebox from './pages/radio/Jukebox';
import GoldenThursday from './pages/tools/GoldenThursday';
import ScoreboardEdit from './pages/tools/ScoreboardEdit';
import ScoreboardGame from './pages/tools/ScoreboardGame';
import ScoreboardDisplay from './pages/tools/ScoreboardDisplay';
import PricesEdit from './pages/tools/PricesEdit';
import PricesDisplay from './pages/tools/PricesDisplay';

function App() {
  const [appVersion, setAppVersion] = useState(0);

  const handleSystemReset = useCallback(() => {
    console.log("🔄 Realizando Soft Reload do Sistema...");
    setAppVersion(prev => prev + 1);
  }, []);

  return (
    <BrowserRouter>
      <ConnectionGuardian onConnectionRestored={handleSystemReset} />

      <ToastContainer 
        position="top-right" 
        autoClose={3000} 
        hideProgressBar={false} 
        newestOnTop={false} 
        closeOnClick 
        rtl={false} 
        pauseOnFocusLoss 
        draggable 
        pauseOnHover 
        theme="dark" 
      />
      
      <Routes key={appVersion}>
        <Route path="/" element={<Home unit="sp" />} />
        <Route path="/bh" element={<Home unit="bh" />} />

        <Route path="/radio/dj" element={<DJController />} />
        <Route path="/radio/collection" element={<MusicCollection />} />
        <Route path="/radio/playlist-creator" element={<PlaylistCreator />} />
        <Route path="/radio/library" element={<Library />} />
        <Route path="/radio/schedule" element={<Schedule />} />
        <Route path="/radio/watch" element={<WatchVideo />} />
        
        <Route path="/radio/jukebox" element={<Jukebox />} />
        <Route path="/radio/jukebox/:unidade" element={<Jukebox />} />

        <Route path="/tools/thursday/:unidade" element={<GoldenThursday />} />
        <Route path="/tools/thursday" element={<GoldenThursday />} />

        <Route path="/tools/scoreboard/maintenance/:unidade" element={<ScoreboardEdit />} /> 
        <Route path="/tools/scoreboard/display/:unidade" element={<ScoreboardDisplay />} />
        <Route path="/tools/scoreboard/game/:unidade" element={<ScoreboardGame />} /> 

        <Route path="/tools/prices/maintenance/:unidade" element={<PricesEdit />} />
        <Route path="/tools/prices/display/:unidade" element={<PricesDisplay />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;