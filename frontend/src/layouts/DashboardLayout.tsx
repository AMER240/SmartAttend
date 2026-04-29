import {
  GraduationCap,
  History as HistoryIcon,
  LayoutDashboard,
  School,
  Settings,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '@/lib/auth-context';

const navItems = [
  { to: '/dashboard', label: 'Panel', short: 'Panel', Icon: LayoutDashboard },
  { to: '/courses', label: 'Dersler', short: 'Dersler', Icon: GraduationCap },
  { to: '/students', label: 'Öğrenciler', short: 'Öğrenci', Icon: Users },
  { to: '/history', label: 'Geçmiş', short: 'Geçmiş', Icon: HistoryIcon },
  { to: '/settings', label: 'Ayarlar', short: 'Ayarlar', Icon: Settings },
];

function getInitials(name: string | undefined): string {
  if (!name) return 'YS';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'YS';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { teacher } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="bg-surface text-on-surface font-body-md text-body-md min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 w-full bg-surface-container-lowest border-b border-outline-variant shadow-sm flex items-center justify-between px-4 lg:px-8 h-16 transition-colors">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate('/dashboard')}
        >
          <School className="w-8 h-8 text-primary" />
          <h1 className="text-xl font-bold tracking-tight text-on-surface hidden sm:block">
            SmartAttend
          </h1>
        </div>

        <nav className="hidden md:flex items-center gap-1 lg:gap-2 h-full">
          {navItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 h-full border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-surface-container-low transition-colors"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-label-md text-label-md">
              {getInitials(teacher?.name)}
            </div>
            <span className="hidden lg:block font-label-md text-label-md text-on-surface-variant truncate max-w-[140px]">
              {teacher?.name ?? '—'}
            </span>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg z-40 overflow-hidden">
                <div className="px-4 py-3 border-b border-outline-variant">
                  <p className="font-label-md text-label-md text-on-surface truncate">
                    {teacher?.name ?? '—'}
                  </p>
                  <p className="font-label-sm text-label-sm text-on-surface-variant truncate">
                    {teacher?.email ?? ''}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/settings');
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-on-surface-variant hover:bg-surface-container-low transition-colors text-left"
                >
                  <Settings className="w-4 h-4" />
                  <span className="font-label-md text-label-md">Ayarlar</span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 w-full pb-20 md:pb-8">
        <Outlet />
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 w-full z-40 flex justify-around items-center h-[72px] pb-safe px-1 bg-surface-container-lowest border-t border-outline-variant text-label-sm font-medium">
        {navItems.map(({ to, short, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className="flex flex-col items-center justify-center flex-1 py-2 text-on-surface-variant transition-colors"
          >
            {({ isActive }) => (
              <>
                <div
                  className={`flex items-center justify-center w-14 h-8 rounded-full mb-1 transition-colors ${
                    isActive ? 'bg-primary-container text-on-primary-container' : ''
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`${isActive ? 'text-on-surface font-semibold' : ''}`}>{short}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
