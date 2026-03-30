import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import MainLayout from './components/MainLayout';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Feed from './pages/Feed';
import EditPost from './pages/EditPost';
import CameraCapture from './pages/CameraCapture';
import Profile from './pages/Profile';
import Search from './pages/Search';
import Ranking from './pages/Ranking';
import EditProfile from './pages/EditProfile';
import Badges from './pages/Badges';
import Inbox from './pages/Inbox';

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
        <Route path="/edit-profile" element={<EditProfile />} />
        <Route path="/emblemas" element={<Badges />} /> 

        <Route element={<MainLayout />}>
          <Route path="/feed" element={<Feed />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/search" element={<Search />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/:username" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;