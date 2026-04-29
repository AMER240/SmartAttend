# SmartAttend Web

SmartAttend yüz tanıma yoklama sisteminin React frontend'i.

## Stack
- React 19 + TypeScript
- Vite 6
- Tailwind v4
- React Router 7
- TanStack React Query 5
- lucide-react (ikonlar)
- Tarayıcı `getUserMedia` (kamera) + Canvas2D (kare yakalama)

## Geliştirme

```bash
cd frontend
npm install
copy .env.example .env         # Windows
# cp .env.example .env         # macOS/Linux
npm run dev
```

Vite `http://0.0.0.0:3000` üzerinde dinler. Backend'in
(`uvicorn backend.main:app --port 8000`) ayakta olduğundan emin olun.

## Ortam Değişkenleri

`.env` dosyasında:

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
├── App.tsx                    Router (BrowserRouter)
├── main.tsx                   QueryClient + AuthProvider + ToastProvider
├── index.css                  Tailwind + Material You tema değişkenleri
├── lib/
│   ├── api.ts                 fetch wrapper + hata logger'ı
│   ├── auth-context.tsx       "Demo Hoca" sahte auth (backend'de auth yok)
│   ├── queries.ts             React Query hook'ları (backend adapter)
│   └── types.ts               UI'ın beklediği veri şekilleri
├── components/
│   ├── ProtectedRoute.tsx     (auth bypass: çocukları olduğu gibi render)
│   ├── CameraCapture.tsx      Öğrenci kaydı için tek-shot kamera
│   ├── Modal.tsx
│   ├── ConfirmDialog.tsx
│   ├── Toast.tsx
│   ├── LoadingSpinner.tsx
│   └── LoadingState.tsx
├── layouts/
│   └── DashboardLayout.tsx    Üst bar + sayfa Outlet'i
└── pages/
    ├── Login.tsx              Auth bypass: /dashboard'a yönlendirir
    ├── Dashboard.tsx          Anasayfa, aktif oturumlar, derslerim
    ├── Courses.tsx            Ders listesi + ekle/sil
    ├── CourseForm.tsx         Yeni / düzenleme formu
    ├── CourseDetail.tsx       Ders detayı + öğrenci ekle + oturum geçmişi
    ├── Students.tsx           Tüm öğrenciler
    ├── StudentForm.tsx        Yeni öğrenci kaydı (kamera fotoğraflı)
    ├── Scanner.tsx            Canlı kamera + 2.5sn'de bir recognize
    ├── History.tsx            Oturum geçmişi listesi
    ├── SessionDetail.tsx      Oturum detayı + manuel Mevcut/Yok/Geç
    └── Settings.tsx           Tema seçimi + API bilgisi
```
