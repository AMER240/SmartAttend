import { Globe, LogOut, Moon, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useToast } from '@/components/Toast';
import { apiRequest, extractErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Teacher } from '@/lib/types';

type Theme = 'system' | 'light' | 'dark';

function applyTheme(theme: Theme) {
  const isDark =
    theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}

export default function Settings() {
  const navigate = useNavigate();
  const toast = useToast();
  const { teacher, signOut, setTeacher } = useAuth();

  const [name, setName] = useState(teacher?.name ?? '');
  const [email, setEmail] = useState(teacher?.email ?? '');
  const [password, setPassword] = useState('');
  const [theme, setTheme] = useState<Theme>(
    (typeof localStorage !== 'undefined' && (localStorage.getItem('smartattend.theme') as Theme)) || 'system',
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(teacher?.name ?? '');
    setEmail(teacher?.email ?? '');
  }, [teacher]);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem('smartattend.theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const handleSave = async () => {
    const payload: Record<string, string> = {};
    if (name.trim() && name.trim() !== teacher?.name) payload.name = name.trim();
    if (email.trim() && email.trim() !== teacher?.email) payload.email = email.trim();
    if (password) payload.password = password;
    if (Object.keys(payload).length === 0) {
      toast.info('Değişiklik yok.');
      return;
    }
    try {
      setSaving(true);
      const updated = await apiRequest<Teacher>('/auth/me', { method: 'PATCH', body: payload });
      setTeacher(updated);
      setPassword('');
      toast.success('Profil güncellendi.');
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Güncellenemedi.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="px-4 md:px-8 max-w-4xl mx-auto w-full py-8 text-on-surface">
      <div className="mb-8">
        <h1 className="font-headline-xl text-headline-xl text-on-surface">Ayarlar</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">
          Hesap bilgilerinizi ve uygulama tercihlerinizi yönetin.
        </p>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden flex flex-col divide-y divide-outline-variant">
        <div className="p-6">
          <h2 className="font-headline-md text-headline-md mb-6">Profil</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-on-surface-variant">Ad Soyad</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="px-3 py-2 border border-outline-variant rounded-xl bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-on-surface-variant">E-posta</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="px-3 py-2 border border-outline-variant rounded-xl bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="font-label-sm text-on-surface-variant">Yeni Şifre (opsiyonel)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Değiştirmek için doldurun"
                className="px-3 py-2 border border-outline-variant rounded-xl bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                minLength={6}
              />
            </div>
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
                className="px-3 py-2 border border-outline-variant rounded-xl bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary opacity-70 cursor-not-allowed"
              >
                <option>Türkçe</option>
              </select>
              <span className="text-xs text-on-surface-variant">
                Şimdilik sadece Türkçe destekleniyor.
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 bg-error-container/10">
          <h2 className="font-headline-md text-headline-md mb-4 text-error flex items-center gap-2">
            <LogOut className="w-5 h-5" /> Oturumu Kapat
          </h2>
          <p className="font-body-md text-on-surface-variant mb-4">
            Çıkış yaptığınızda saklanan oturum tokeni silinecek.
          </p>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-6 py-2.5 bg-error text-on-error rounded-xl font-label-md hover:opacity-90 transition-opacity"
          >
            <LogOut className="w-5 h-5" />
            Çıkış Yap
          </button>
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-primary text-on-primary px-6 py-2.5 rounded-xl font-label-md hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
        </button>
      </div>
    </div>
  );
}
