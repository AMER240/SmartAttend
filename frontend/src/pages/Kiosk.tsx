/**
 * Kiosk — öğrenci self check-in sayfası
 *
 * Akış:
 *  1. sessionStorage'da oturum bayrağı varsa → "Geç" yaz, dur.
 *  2. face-api.js modellerini yükle (public/models/ dizininden).
 *  3. Kamerayı aç (ön kamera, selfie modu).
 *  4. Her 2 saniyede bir: yüz algıla → 128D descriptor çıkar → backend'e gönder.
 *  5. "matched" gelirse → sessionStorage'a kaydet, "Var" yaz, dur.
 *     "matched" değilse → "Yok" yaz, taramayı sürdür.
 *
 * Model dosyaları: https://github.com/vladmandic/face-api/tree/master/model
 * adresinden indir, web/public/models/ klasörüne koy.
 */

import { Camera, CheckCircle2, Loader2, UserCheck, XCircle } from 'lucide-react';
import * as faceapi from '@vladmandic/face-api';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import { API_URL } from '@/lib/api';

// sessionStorage key — per session so different sessions don't collide
const storageKey = (sessionId: number) => `sa_kiosk_recognized_${sessionId}`;

type Phase =
  | 'loading_models'   // face-api.js models loading
  | 'starting_camera'  // getUserMedia in progress
  | 'scanning'         // actively scanning frames
  | 'found'            // matched — show Var
  | 'skipped'          // already recognised this session — show Geç
  | 'error';           // unrecoverable error

const SCAN_INTERVAL_MS = 2000;
const MODELS_URL = '/models';

export default function Kiosk() {
  const { sessionId: raw } = useParams<{ sessionId: string }>();
  const sessionId = Number(raw);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlightRef = useRef(false);

  const [phase, setPhase] = useState<Phase>('loading_models');
  const [scanStatus, setScanStatus] = useState<'scanning' | 'yok' | null>(null);
  const [matchedName, setMatchedName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ─── helpers ────────────────────────────────────────────────────────────────

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function stopTimer() {
    if (scanTimerRef.current !== null) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
  }

  function fail(msg: string) {
    stopTimer();
    stopStream();
    setErrorMsg(msg);
    setPhase('error');
  }

  // ─── main flow ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!Number.isFinite(sessionId)) return;

    // 1. sessionStorage check
    const stored = sessionStorage.getItem(storageKey(sessionId));
    if (stored) {
      setMatchedName(JSON.parse(stored).name ?? null);
      setPhase('skipped');
      return;
    }

    let cancelled = false;

    async function init() {
      // 2. Load models
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
        ]);
      } catch {
        if (!cancelled) fail('Model dosyaları yüklenemedi. public/models/ klasörünü kontrol edin.');
        return;
      }

      if (cancelled) return;

      // 3. Open camera
      setPhase('starting_camera');
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
      } catch (err) {
        if (!cancelled) fail(`Kameraya erişilemedi: ${err instanceof Error ? err.message : err}`);
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }

      setPhase('scanning');
      setScanStatus('scanning');

      // 4. Scan loop
      scanTimerRef.current = setInterval(async () => {
        if (cancelled || inFlightRef.current) return;
        const v = videoRef.current;
        if (!v || !v.videoWidth) return;

        inFlightRef.current = true;
        try {
          const detection = await faceapi
            .detectSingleFace(v, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (!detection) {
            setScanStatus('scanning');
            return;
          }

          const descriptor = Array.from(detection.descriptor) as number[];
          const res = await fetch(`${API_URL}/kiosk/sessions/${sessionId}/recognize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ descriptor }),
          });

          if (!res.ok) {
            const detail = await res.json().catch(() => ({}));
            setScanStatus('yok');
            console.warn('Recognize error:', detail);
            return;
          }

          const data: { matched: boolean; name: string | null } = await res.json();

          if (data.matched) {
            stopTimer();
            stopStream();
            sessionStorage.setItem(
              storageKey(sessionId),
              JSON.stringify({ name: data.name, at: new Date().toISOString() }),
            );
            setMatchedName(data.name);
            setPhase('found');
          } else {
            setScanStatus('yok');
          }
        } catch (e) {
          console.warn('Scan tick error:', e);
        } finally {
          inFlightRef.current = false;
        }
      }, SCAN_INTERVAL_MS);
    }

    init();

    return () => {
      cancelled = true;
      stopTimer();
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ─── UI ─────────────────────────────────────────────────────────────────────

  if (!Number.isFinite(sessionId)) {
    return <Screen bg="bg-neutral-950"><BigLabel text="Geçersiz oturum." color="text-white/70" /></Screen>;
  }

  if (phase === 'error') {
    return (
      <Screen bg="bg-neutral-950">
        <BigLabel text="Hata" color="text-red-300" />
        <p className="mt-4 max-w-md text-sm sm:text-base text-white/60 text-center px-6 leading-relaxed">
          {errorMsg}
        </p>
      </Screen>
    );
  }

  if (phase === 'skipped') {
    return (
      <Screen bg="bg-neutral-950">
        <StatusHero
          icon={<CheckCircle2 className="w-9 h-9 text-emerald-300" />}
          title="Geç"
          subtitle={matchedName ? `${matchedName} olarak zaten tanındınız.` : 'Bu oturumda zaten tanındınız.'}
        />
      </Screen>
    );
  }

  if (phase === 'found') {
    return (
      <Screen bg="bg-emerald-950">
        <StatusHero
          icon={<UserCheck className="w-9 h-9 text-emerald-300" />}
          title="Var"
          subtitle={matchedName ? `${matchedName} için yoklama alındı.` : 'Yoklama alındı.'}
        />
      </Screen>
    );
  }

  // scanning / loading states — show camera + overlay
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-neutral-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.18),transparent_32%),radial-gradient(circle_at_bottom,rgba(59,130,246,0.12),transparent_28%)]" />

      <div className="relative z-10 flex min-h-screen flex-col px-4 py-4 sm:px-6 sm:py-6">
        <header className="flex items-center justify-between gap-3 rounded-3xl border border-white/10 bg-black/25 px-4 py-3 backdrop-blur-md">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">SmartAttend</p>
            <h1 className="text-sm font-semibold text-white">Kiosk Yüz Tanıma</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/80">
            <Camera className="h-4 w-4" />
            Selfie modu
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center py-4">
          <div className="grid w-full max-w-6xl gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-black/30 shadow-2xl">
              <video
                ref={videoRef}
                playsInline
                muted
                className="h-[58vh] min-h-[420px] w-full object-cover scale-x-[-1] sm:h-[62vh] lg:h-[72vh]"
              />

              <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <ScanFrame />
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                <div className="rounded-2xl border border-white/10 bg-black/55 px-4 py-3 backdrop-blur-md">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Canlı Tarama</p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-white/90">Ön kameraya bakın</p>
                      <p className="text-xs text-white/55">2 saniyede bir yüz algılanır ve descriptor gönderilir.</p>
                    </div>
                    <StatusPill
                      phase={phase}
                      scanStatus={scanStatus}
                    />
                  </div>
                </div>
              </div>
            </section>

            <aside className="flex flex-col gap-4">
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-md">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Durum</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {phase === 'loading_models'
                    ? 'Modeller hazırlanıyor'
                    : phase === 'starting_camera'
                      ? 'Kamera açılıyor'
                      : phase === 'scanning'
                        ? 'Yüz aranıyor'
                        : 'Hazır'}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-white/60">
                  Kamera izinlerini verin, yüzünüzü çerçeve içinde tutun ve sistemi bekleyin.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <InfoCard title="Pozisyon" value="Yüz tam karşıda" />
                <InfoCard title="Işık" value="Yeterli ve dengeli" />
                <InfoCard title="Kayıt" value="Tek kişi, net yüz" />
              </div>
            </aside>
          </div>
        </main>
      </div>

      <div className="absolute inset-x-0 bottom-4 z-20 flex justify-center px-4">
        <div className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs text-white/65 backdrop-blur-md">
          {sessionId} no'lu oturum aktif
        </div>
      </div>
    </div>
  );
}

// ─── sub-components ─────────────────────────────────────────────────────────

function Screen({ bg, children }: { bg: string; children: React.ReactNode }) {
  return (
    <div className={`${bg} w-full h-screen flex flex-col items-center justify-center select-none`}>
      {children}
    </div>
  );
}

function BigLabel({ text, color }: { text: string; color: string }) {
  return <span className={`text-5xl sm:text-7xl font-black tracking-tight ${color}`}>{text}</span>;
}

function StatusChip({ text, pulse, color = 'bg-black/60' }: { text: string; pulse?: boolean; color?: string }) {
  return (
    <div className={`${color} backdrop-blur-sm border border-white/10 text-white text-sm font-medium px-5 py-2.5 rounded-full flex items-center gap-2`}>
      {pulse && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
      {text}
    </div>
  );
}

function StatusPill({ phase, scanStatus }: { phase: Phase; scanStatus: 'scanning' | 'yok' | null }) {
  if (phase === 'loading_models') return <StatusChip text="Modeller yükleniyor…" pulse />;
  if (phase === 'starting_camera') return <StatusChip text="Kamera başlatılıyor…" pulse />;
  if (phase === 'scanning' && scanStatus === 'scanning') return <StatusChip text="Yüz aranıyor…" pulse />;
  if (phase === 'scanning' && scanStatus === 'yok') return <StatusChip text="Yok" color="bg-red-600/80" />;
  return <StatusChip text="Hazır" color="bg-emerald-600/80" />;
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
      <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">{title}</p>
      <p className="mt-2 text-sm font-medium text-white/90">{value}</p>
    </div>
  );
}

function StatusHero({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/10 backdrop-blur-md">
        {icon}
      </div>
      <span className="text-5xl sm:text-7xl font-black tracking-tight text-white">{title}</span>
      <p className="mt-4 max-w-md text-sm sm:text-base text-white/65 leading-relaxed">{subtitle}</p>
    </div>
  );
}

function ScanFrame() {
  const s = 'w-10 h-10 border-4 border-white/70';
  return (
    <div className="w-64 h-64 relative">
      <div className={`${s} absolute top-0 left-0 border-r-0 border-b-0 rounded-tl-xl`} />
      <div className={`${s} absolute top-0 right-0 border-l-0 border-b-0 rounded-tr-xl`} />
      <div className={`${s} absolute bottom-0 left-0 border-r-0 border-t-0 rounded-bl-xl`} />
      <div className={`${s} absolute bottom-0 right-0 border-l-0 border-t-0 rounded-br-xl`} />
    </div>
  );
}
