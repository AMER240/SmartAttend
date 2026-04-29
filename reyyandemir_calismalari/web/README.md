# SmartAttend Web

Yüz tanımalı yoklama sisteminin web frontend'i.

## Stack
- React 19 + TypeScript
- Vite 6
- Tailwind v4
- React Router 7
- TanStack React Query 5
- lucide-react ikonlar
- Tarayıcı `getUserMedia` (kamera) + Canvas2D (kare yakalama)

## Geliştirme

```bash
cd web
npm install
copy .env.example .env.local         # Windows
# cp .env.example .env.local         # macOS/Linux
npm run dev
```

Vite `http://0.0.0.0:3000` üzerinde dinler. Backend'in çalışıyor olduğundan emin
ol (`backend/` klasöründe `python -m app.main`).

## Ortam Değişkenleri

`.env.local` dosyasında:

```
VITE_API_URL=http://localhost:8000
```

LAN üzerindeki başka bir cihazdan kullanmak için bu değeri laptop'un LAN IP'si
yap (örn. `http://192.168.1.20:8000`).

## Üretim Build'i

```bash
npm run build       # dist/ klasörüne çıkar
npm run preview     # üretim sunucusunu yerelde test et
```

## Önemli Tarayıcı Notları

- `getUserMedia` HTTPS veya `localhost` ister. LAN üzerinde HTTP IP'siyle kamera
  açılmazsa Chrome'da `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
  bayrağına IP'yi ekleyin.
- iOS Safari'de kamera tarayıcı sürümüne göre çalışmayabilir.
- Tarayıcı izinlerinden "Kamera" ayarını kontrol edin.

## Klasör Yapısı

```
src/
├── App.tsx                    Router
├── main.tsx                   QueryClient + AuthProvider
├── index.css                  Tailwind + tasarım tokenları
├── lib/
│   ├── api.ts                 fetch wrapper, token saklama
│   ├── auth-context.tsx       Auth context + useAuth
│   ├── queries.ts             React Query hook'ları
│   └── types.ts               Backend ile uyumlu TS tipleri
├── components/
│   ├── ProtectedRoute.tsx     Auth guard
│   ├── CameraCapture.tsx      Tek-shot kamera (öğrenci kaydı için)
│   ├── Modal.tsx, ConfirmDialog.tsx, Toast.tsx, LoadingState.tsx
├── layouts/
│   └── DashboardLayout.tsx
└── pages/
    ├── Login.tsx              Giriş + Kayıt Ol
    ├── Dashboard.tsx          Anasayfa, aktif oturumlar
    ├── Courses.tsx            Ders listesi
    ├── CourseDetail.tsx       Şube/öğrenci/oturum yönetimi
    ├── Students.tsx           Tüm öğrenciler
    ├── Scanner.tsx            Canlı kamera + recognize
    ├── History.tsx            Oturum geçmişi
    ├── SessionDetail.tsx      Oturum detayı + manuel düzeltme
    └── Settings.tsx           Profil, tema, çıkış
```
