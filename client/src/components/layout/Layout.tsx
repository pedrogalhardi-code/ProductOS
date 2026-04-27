import { Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import Sidebar from './Sidebar';
import { LogOut } from 'lucide-react';

export default function Layout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const initials =
    user?.name
      ?.split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';

  return (
    <div
      className="flex h-screen"
      style={{ backgroundColor: 'var(--neutral-100)' }}
    >
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="h-16 bg-white px-8 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-4">
            <h2
              className="font-medium"
              style={{ color: 'var(--neutral-900)' }}
            >
              ProductOS
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full gradient-mark flex items-center justify-center">
                  <span className="text-white text-sm font-medium">{initials}</span>
                </div>
                <span className="text-sm font-medium">{user.name}</span>
              </div>
            )}
            <button
              onClick={logout}
              className="transition-colors"
              style={{ color: 'var(--neutral-500)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--neutral-900)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--neutral-500)')}
              title="Logout"
            >
              <LogOut size={18} />
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
