import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import 'react-toastify/dist/ReactToastify.css';

import { PostProvider } from './contexts/PostContext';
import MainLayout from './components/MainLayout';

const Login = lazy(() => import('./pages/Login'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));
const Feed = lazy(() => import('./pages/Feed'));
const EditPost = lazy(() => import('./pages/EditPost'));
const CameraCapture = lazy(() => import('./pages/CameraCapture'));
const Profile = lazy(() => import('./pages/Profile'));
const Search = lazy(() => import('./pages/Search'));
const Ranking = lazy(() => import('./pages/Ranking'));
const EditProfile = lazy(() => import('./pages/EditProfile'));
const Badges = lazy(() => import('./pages/Badges'));
const Inbox = lazy(() => import('./pages/Inbox'));
const Notifications = lazy(() => import('./pages/Notifications'));
const PostDetail = lazy(() => import('./pages/PostDetail'));
const ImageCropper = lazy(() => import('./pages/ImageCropper'));
const StravaCallback = lazy(() => import('./pages/StravaCallback'));

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
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => console.error(err));
    }
  }, []);

  return (
    <GoogleReCaptchaProvider reCaptchaKey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}>
      <PostProvider>
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

          <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/change-password" element={<ChangePassword />} />
              <Route path="/edit-post" element={<EditPost />} />
              <Route path="/camera" element={<CameraCapture />} />
              <Route path="/edit-profile" element={<EditProfile />} />
              <Route path="/crop" element={<ImageCropper />} />
              <Route path="/strava-callback" element={<StravaCallback />} />
              
              <Route path="/notifications" element={<Notifications />} />

              <Route element={<MainLayout />}>
                <Route path="/feed" element={<Feed />} />
                <Route path="/post/:id" element={<PostDetail />} />
                <Route path="/:username/post/:id" element={<PostDetail />} />
                <Route path="/inbox" element={<Inbox />} />
                <Route path="/ranking" element={<Ranking />} />
                <Route path="/search" element={<Search />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/emblemas" element={<Badges />} />
                <Route path="/:username" element={<Profile />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </PostProvider>
    </GoogleReCaptchaProvider>
  );
}

export default App;