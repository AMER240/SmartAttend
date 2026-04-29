import { Eye, EyeOff, School } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useToast } from '@/components/Toast';
import { extractErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type Mode = 'signin' | 'signup' | 'forgot-password';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { teacher, signIn, signUp } = useAuth();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (teacher) {
      const target =
        (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/dashboard';
      navigate(target, { replace: true });
    }
  }, [teacher, navigate, location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (mode === 'signup') {
      if (!name.trim()) {
        toast.error('Ad soyad gerekli.');
        return;
      }
      if (password.length < 6) {
        toast.error('Şifre en az 6 karakter olmalı.');
        return;
      }
      if (password !== confirmPassword) {
        toast.error('Şifreler eşleşmiyor.');
        return;
      }
    }

    try {
      setSubmitting(true);
      if (mode === 'forgot-password') {
        // Mocking an async request
        await new Promise((r) => setTimeout(r, 600));
        toast.success('Şifre sıfırlama bağlantısı e-postanıza gönderildi.');
        setMode('signin');
        return;
      }
      
      if (mode === 'signin') {
        await signIn(email.trim(), password);
        toast.success('Giriş başarılı.');
        navigate('/dashboard', { replace: true });
      } else {
        await signUp(name.trim(), email.trim(), password);
        toast.success('Kaydınız başarıyla oluşturuldu. Şimdi giriş yapabilirsiniz.');
        setMode('signin');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      toast.error(
        extractErrorMessage(err, mode === 'signin' ? 'Giriş yapılamadı.' : 'Kayıt başarısız.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-surface min-h-screen flex items-center justify-center p-4 md:p-8 antialiased">
      <main className="w-full max-w-[1024px] bg-surface-container-lowest rounded-xl border border-outline-variant flex flex-col md:flex-row overflow-hidden shadow-sm">
        <div className="md:w-[45%] relative p-8 md:p-12 flex flex-col justify-between min-h-[300px] md:min-h-[640px] bg-primary-fixed">
          <div
            className="absolute inset-0 bg-cover bg-center mix-blend-multiply opacity-20"
            style={{
              backgroundImage:
                'url(https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1400&q=60)',
            }}
          />
          <div className="relative z-10 flex items-center gap-2 text-on-primary-fixed">
            <School className="w-8 h-8" />
            <span className="font-headline-md text-headline-md">SmartAttend</span>
          </div>
          <div className="relative z-10 mt-12 md:mt-24 text-on-primary-fixed">
            <h1 className="font-headline-xl text-headline-xl mb-4">
              Akademik Portal'a
              <br />
              Hoş Geldiniz
            </h1>
            <p className="font-body-lg text-body-lg text-on-primary-fixed-variant max-w-[320px]">
              Yüz tanıma ile dakikalar içinde yoklama alın. Öğrenci ve ders yönetimi tek panelde.
            </p>
          </div>
        </div>

        <div className="md:w-[55%] p-8 md:p-16 flex flex-col justify-center bg-surface-container-lowest">
          <div className="flex gap-6 border-b border-outline-variant mb-12">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`font-label-md text-label-md pb-2 px-1 transition-colors ${
                mode === 'signin'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Giriş Yap
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`font-label-md text-label-md pb-2 px-1 transition-colors ${
                mode === 'signup'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Kayıt Ol
            </button>
          </div>

          <div className="flex flex-col w-full max-w-[400px]">
            <div className="mb-8">
              <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">
              {mode === 'signin'
                ? 'Hesabınıza Erişin'
                : mode === 'forgot-password'
                  ? 'Şifrenizi Sıfırlayın'
                  : 'Yeni Hesap Oluştur'}
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {mode === 'signin'
                ? 'Lütfen devam etmek için bilgilerinizi girin.'
                : mode === 'forgot-password'
                  ? 'E-posta adresinizi girin, sıfırlama bağlantısı gönderelim.'
                  : 'Birkaç saniye içinde hesabınızı oluşturun.'}
            </p>
            </div>

            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              {mode === 'signup' && (
                <div className="flex flex-col gap-1">
                  <label
                    className="font-label-sm text-label-sm text-on-surface-variant block"
                    htmlFor="name"
                  >
                    Ad Soyad
                  </label>
                  <input
                    id="name"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-10 px-4 bg-transparent border border-outline-variant rounded font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary focus:ring-inset transition-shadow"
                    placeholder="Dr. Ad Soyad"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label
                  className="font-label-sm text-label-sm text-on-surface-variant block"
                  htmlFor="user-id"
                >
                  E-posta
                </label>
                <input
                  id="user-id"
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 px-4 bg-transparent border border-outline-variant rounded font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary focus:ring-inset transition-shadow"
                  placeholder="ornek@universite.edu.tr"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label
                    className="font-label-sm text-label-sm text-on-surface-variant block"
                    htmlFor="password"
                  >
                    {mode === 'forgot-password' ? 'Yeni Şifre' : 'Şifre'}
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      className="text-primary hover:underline font-label-sm text-label-sm"
                      onClick={() => setMode('forgot-password')}
                    >
                      Şifremi Unuttum
                    </button>
                  )}
                </div>
                {mode !== 'forgot-password' && (
                  <div className="relative w-full">
                    <input
                      id="password"
                      required
                      minLength={6}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-10 px-4 pr-10 bg-transparent border border-outline-variant rounded font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary focus:ring-inset transition-shadow"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant flex items-center justify-center"
                    >
                      {showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                    </button>
                  </div>
                )}
              </div>

              {mode === 'signup' && (
                <div className="flex flex-col gap-1">
                  <label
                    className="font-label-sm text-label-sm text-on-surface-variant block"
                    htmlFor="confirm-password"
                  >
                    Şifre (Tekrar)
                  </label>
                  <input
                    id="confirm-password"
                    required
                    minLength={6}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-10 px-4 bg-transparent border border-outline-variant rounded font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary focus:ring-inset transition-shadow"
                    placeholder="••••••••"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-[44px] bg-primary text-on-primary font-label-md text-label-md rounded flex items-center justify-center hover:bg-surface-tint transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {submitting
                  ? mode === 'signin'
                    ? 'Giriş yapılıyor...'
                    : mode === 'forgot-password'
                      ? 'Gönderiliyor...'
                      : 'Kayıt yapılıyor...'
                  : mode === 'signin'
                    ? 'Giriş Yap'
                    : mode === 'forgot-password'
                      ? 'Sıfırlama Bağlantısı Gönder'
                      : 'Hesap Oluştur'}
              </button>

              <p className="text-center font-label-sm text-label-sm text-on-surface-variant mt-2">
                {mode === 'signin' ? (
                  <>
                    Hesabın yok mu?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('signup')}
                      className="text-primary hover:underline"
                    >
                      Kayıt Ol
                    </button>
                  </>
                ) : mode === 'forgot-password' ? (
                  <>
                    Giriş sayfasına dönmek için={' '}
                    <button
                      type="button"
                      onClick={() => setMode('signin')}
                      className="text-primary hover:underline"
                    >
                      tıklayın
                    </button>
                  </>
                ) : (
                  <>
                    Zaten hesabın var mı?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('signin')}
                      className="text-primary hover:underline"
                    >
                      Giriş Yap
                    </button>
                  </>
                )}
              </p>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
