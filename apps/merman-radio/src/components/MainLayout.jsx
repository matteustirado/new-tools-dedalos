import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import Sidebar from './Sidebar';

export default function MainLayout() {
  return (
    <div className="flex flex-col md:flex-row min-h-screen text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen relative">
        <TopBar />
        <main className="flex-1 overflow-y-auto pt-20 pb-24 px-4 md:p-8 md:pb-8">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  );
}