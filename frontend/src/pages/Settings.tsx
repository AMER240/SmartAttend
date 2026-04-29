import { Globe, Info, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth-context';

type Theme = 'system' | 'light' | 'dark';

function applyTheme(theme: Theme) {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}

/**
 * Settings page – simplified for the no-auth backend.
 *
 * The original frontend had a profile editor (PATCH /auth/me) and a
 * sign-out button; both have been removed because the spec backend
 * does not expose any auth endpoints. We keep the theme switcher and
 * a small info card describing the demo account.
 */
export default function Settings() {
  const { teacher } = useAuth();

  const [theme, setTheme] = useState<Theme>(
    (typeof localStorage !== 'undefined' &&
      (localStorage.getItem('smartattend.theme') as Theme)) ||
      'system',
  );

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem('smartattend.theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  return (
    <div className="px-4 md:px-8 max-w-4xl mx-auto w-full py-8 text-on-surface">
      <div className="mb-8">
        <h1 className="font-headline-xl text-headline-xl text-on-surface">Ayarlar</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">
          Uygulama tercihlerinizi yönetin.
        </p>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden flex flex-col divide-y divide-outline-variant">
        <div className="p-6">
          <h2 className="font-headline-md text-headline-md mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" /> Hesap Bilgisi
          </h2>
          <div className="rounded-xl bg-primary-container/20 border border-primary/20 p-4 flex flex-col gap-1">
            <p className="text-sm text-on-surface">
              <strong>{teacher?.name ?? 'Demo Hoca'}</strong>{' '}
              <span className="text-on-surface-variant">· {teacher?.email}</span>
            </p>
            <p className="text-xs text-on-surface-variant">
              Bu sürümde kimlik doğrulaması (login) yoktur. Sistem demo bir hoca
              kimliğiyle çalışır; profil düzenleme ve çıkış yapma desteklenmiyor.
            </p>
          </div>
        </div>

        <div className="p-6">
          <h2 className="font-headline-md text-headline-md mb-6 flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" /> Uygulama Tercihleri
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="font-label-sm text-on-surface-variant flex items-center gap-2">
                <Moon className="w-4 h-4" /> Tema
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as Theme)}
                className="px-3 py-2 border border-outline-variant rounded-xl bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="system">Sistem Tercihi</option>
                <option value="light">Açık Tema</option>
                <option value="dark">Koyu Tema</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-label-sm text-on-surface-variant flex items-center gap-2">
                <Globe className="w-4 h-4" /> Dil
              </label>
              <select
                disabled
                className="px-3 py-2 border border-outline-variant rounded-xl bg-surface-container-lowest opacity-70 cursor-not-allowed"
              >
                <option>Türkçe</option>
              </select>
              <span className="text-xs text-on-surface-variant">
                Şimdilik sadece Türkçe destekleniyor.
              </span>
            </div>
          </div>
        </div>

        <div className="p-6">
          <h2 className="font-headline-md text-headline-md mb-2">Backend</h2>
          <p className="text-sm text-on-surface-variant">
            API:{' '}
            <code className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface">
              {((import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) ||
                'http://localhost:8000'}
            </code>
          </p>
          <p className="text-xs text-on-surface-variant mt-1">
            Farklı bir API adresi için <code>frontend/.env</code> dosyasına{' '}
            <code>VITE_API_URL=...</code> ekleyin.
          </p>
        </div>
      </div>
    </div>
  );
}
