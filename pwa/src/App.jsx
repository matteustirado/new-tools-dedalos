import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import MainLayout from './components/MainLayout';
import Feed from './pages/Feed';
import EditPost from './pages/EditPost';
import CameraCapture from './pages/CameraCapture'; // <- NOVA IMPORTAÇÃO AQUI

function App() {
  return (
    <BrowserRouter>
      <ToastContainer
        position="top-center"
        autoClose={3000}
        hideProgressBar
        closeOnClick
        theme="dark"
        toastClassName="mx-4 mt-4 bg-[#111]/90 text-white font-bold border border-white/10 rounded-2xl shadow-2xl backdrop-blur-md"
      />
      
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/change-password" element={<ChangePassword />} />
        
        <Route path="/edit-post" element={<EditPost />} />
        <Route path="/camera" element={<CameraCapture />} />
        
        <Route element={<MainLayout />}>
          <Route path="/feed" element={<Feed />} />
          <Route path="/inbox" element={<div className="text-center p-10 text-yellow-500 font-bold uppercase italic tracking-widest">Caixa de Entrada 📥</div>} />
          <Route path="/ranking" element={<div className="text-center p-10 text-yellow-500 font-bold uppercase italic tracking-widest">Pódio dos Monstros 🏆</div>} />
          <Route path="/search" element={<div className="text-center p-10 text-yellow-500 font-bold uppercase italic tracking-widest">Pesquisar Amigos 🔍</div>} />
          <Route path="/profile" element={<div className="text-center p-10 text-yellow-500 font-bold uppercase italic tracking-widest">O Teu Perfil 👤</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;