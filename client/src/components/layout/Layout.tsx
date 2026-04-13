import { Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import Sidebar from './Sidebar';
import { LogOut, User } from 'lucide-react';

export default function Layout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">ProductOS</h1>

          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-telus-purple text-white flex items-center justify-center text-sm font-medium">
                  {user.name?.charAt(0).toUpperCase() || <User className="w-4 h-4" />}
                </div>
                <span className="text-sm font-medium text-gray-700">{user.name}</span>
              </div>
            )}

            <button
              onClick={logout}
              className="inline-flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
