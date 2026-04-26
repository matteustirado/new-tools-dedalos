import React from 'react';
import { Outlet } from 'react-router-dom';

import TopBar from './TopBar';
import BottomNav from './BottomNav';

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col relative overflow-x-hidden">
      <div className="fixed top-[-10%] left-[-20%] w-[70%] h-[50%] bg-yellow-500/[0.03] rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-[-10%] right-[-20%] w-[60%] h-[40%] bg-yellow-600/[0.02] rounded-full blur-[100px] pointer-events-none z-0" />

      <TopBar />

      <main className="relative z-10 flex-1 pt-24 pb-24 max-w-md mx-auto w-full animate-fade-in-up">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}