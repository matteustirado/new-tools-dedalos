import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import Notifications from './pages/Notifications';
import PostDetail from './pages/PostDetail';
import ImageCropper from './pages/ImageCropper';

function ScrollManager() {
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      sessionStorage.setItem(`scroll_pos_${location.pathname}`, window.scrollY.toString());
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [location.pathname]);

  useEffect(() => {
    const savedPosition = sessionStorage.getItem(`scroll_pos_${location.pathname}`);
    
    if (savedPosition) {
      setTimeout(() => {
        window.scrollTo(0, parseInt(savedPosition, 10));
      }, 10);
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      
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
        <Route path="/crop" element={<ImageCropper />} />

        <Route element={<MainLayout />}>
          <Route path="/feed" element={<Feed />} />
          <Route path="/post/:id" element={<PostDetail />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/search" element={<Search />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/emblemas" element={<Badges />} />
          <Route path="/:username" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;