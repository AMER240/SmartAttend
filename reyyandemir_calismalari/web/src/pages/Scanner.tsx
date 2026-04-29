import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Pause, Play, ScanLine, SwitchCamera, UserCheck, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useToast } from '@/components/Toast';
import { extractErrorMessage } from '@/lib/api';
import {
  recognizeFrame,
  useAttendance,
  useEndSession,
  useSession,
  useUpdateAttendance,
} from '@/lib/queries';
import type { Attendance } from '@/lib/types';

const RECOGNIZE_INTERVAL_MS = 2500;

const STATUS_LABEL: Record<string, string> = {
  present: 'Mevcut',
  absent: 'Yok',
  late: 'Geç',
};

const STATUS_COLORS: Record<string, string> = {
  present: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  absent: 'bg-red-500/20 text-red-400 border-red-500/30',
  late: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

function Avatar({ name, size = 'md' }: { name?: string; size?: 'sm' | 'md' }) {
  const initials = name
    ? name.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
    : '?';
  const cls = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  return (
    <div className={`${cls} rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center font-semibold text-white shrink-0 shadow-lg`}>
      {initials}
    </div>
  );
}

export default function Scanner() {
  const { sessionId: sessionIdRaw } = useParams<{ sessionId: string }>();
  const sessionId = Number(sessionIdRaw);
  const navigate = useNavigate();
  const toast = useToast();

  const sessionQuery = useSession(sessionId);
  const attendanceQuery = useAttendance(sessionId, { refetchInterval: 5_000 });
  const endSession = useEndSession();
  const updateAttendance = useUpdateAttendance(sessionId);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inFlightRef = useRef(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const [latestDetected, setLatestDetected] = useState<{ id: number; ts: number } | null>(null);
  const [latestRecognized, setLatestRecognized] = useState<Attendance | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const session = sessionQuery.data;
  const attendance = attendanceQuery.data ?? [];

  useEffect(() => {
    let cancelled = false;
    setCameraError(null);

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Tarayıcı kamerayı desteklemiyor.');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => undefined);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Kameraya erişilemedi.';
        setCameraError(msg);
      }
    }

    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facingMode]);

  useEffect(() => {
    if (!scanning || cameraError || !session || session.status !== 'active') return;

    let stopped = false;

    async function tick() {
      if (stopped || inFlightRef.current) return;
      const v = videoRef.current;
      if (!v || !v.videoWidth) return;
      const canvas = document.createElement('canvas');
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);

      inFlightRef.current = true;
      try {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.7),
        );
        if (!blob) return;
        const result = await recognizeFrame(sessionId, blob);
        if (result.newly_marked.length) {
          for (const sid of result.newly_marked) {
            setLatestDetected({ id: sid, ts: Date.now() });
          }
          attendanceQuery.refetch();
        }
      } catch (err) {
        const message = extractErrorMessage(err, '');
        if (message && message !== 'Oturum aktif değil.') {
          toast.error(message);
        }
      } finally {
        inFlightRef.current = false;
      }
    }

    const handle = window.setInterval(tick, RECOGNIZE_INTERVAL_MS);
    return () => {
      stopped = true;
      window.clearInterval(handle);
    };
  }, [scanning, cameraError, session, sessionId, attendanceQuery, toast]);

  useEffect(() => {
    if (!latestDetected) return;
    const found = attendance.find((a) => a.student_id === latestDetected.id);
    if (found) setLatestRecognized(found);
  }, [latestDetected, attendance]);

  const stats = useMemo(() => {
    const total = attendance.length;
    const present = attendance.filter((a) => a.status === 'present').length;
    const absent = attendance.filter((a) => a.status === 'absent').length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, rate };
  }, [attendance]);

  const handleEnd = async () => {
    if (!confirmEnd) { setConfirmEnd(true); return; }
    try {
      await endSession.mutateAsync(sessionId);
      toast.success('Yoklama tamamlandı.');
      navigate(`/history/${sessionId}`, { replace: true });
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Oturum kapatılamadı.'));
      setConfirmEnd(false);
    }
  };

  const handleManualMark = async (att: Attendance, status: 'present' | 'absent' | 'late') => {
    try {
      await updateAttendance.mutateAsync({ attendanceId: att.id, status });
      toast.success(`${att.student_name}: ${STATUS_LABEL[status]}`);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Güncellenemedi.'));
    }
  };

  if (!Number.isFinite(sessionId)) {
    return (
      <div className="bg-gray-950 h-screen flex items-center justify-center text-white p-4 text-center">
        Geçersiz oturum.
      </div>
    );
  }

  return (
    <div className="bg-gray-950 min-h-screen w-full flex flex-col relative overflow-hidden antialiased">
      {/* Camera layer */}
      <div className="absolute inset-0 z-0">
        {cameraError ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-900 text-gray-400 p-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center">
                <SwitchCamera className="w-7 h-7 text-gray-500" />
              </div>
              <p className="text-sm font-medium text-gray-300">Kamera açılamadı</p>
              <p className="text-xs text-gray-500">{cameraError}</p>
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          />
        )}
      </div>

      {/* Vignette gradient */}
      <div className="absolute inset-0 z-[1] pointer-events-none bg-gradient-to-b from-black/60 via-transparent to-black/80" />

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-4 pt-5 pb-3">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md border border-white/15 hover:bg-white/20 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15">
            <span className={`w-2 h-2 rounded-full ${scanning ? 'bg-blue-400 animate-pulse' : 'bg-gray-500'}`} />
            <span className="text-white text-xs font-semibold tracking-wide uppercase">
              {session?.status === 'active'
                ? scanning ? 'Tarama Aktif' : 'Duraklatıldı'
                : 'Oturum Durdu'}
            </span>
          </div>
        </div>

        <button
          onClick={() => setFacingMode((f) => (f === 'user' ? 'environment' : 'user'))}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md border border-white/15 hover:bg-white/20 transition-colors"
          title="Kamerayı değiştir"
        >
          <SwitchCamera className="w-5 h-5" />
        </button>
      </header>

      {/* Scanner frame */}
      <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center" style={{ top: '-10%' }}>
        <div className="relative w-64 h-64">
          <div className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-blue-400 rounded-tl-xl" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-blue-400 rounded-tr-xl" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-blue-400 rounded-bl-xl" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-blue-400 rounded-br-xl" />
          {scanning && (
            <div className="absolute left-3 right-3 top-0 h-[2px] bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_12px_4px_rgba(96,165,250,0.6)] animate-[scanline_2s_ease-in-out_infinite]" />
          )}
        </div>
      </div>

      {/* Bottom panel */}
      <div className="relative z-20 mt-auto">
        {/* Last recognized — floating chip above panel */}
        {latestRecognized && (
          <div className="mx-4 mb-3 flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-3 shadow-xl">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <Avatar name={latestRecognized.student_name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">{latestRecognized.student_name}</p>
              <p className="text-white/50 text-xs">#{latestRecognized.student_number} · Tanındı</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
              Mevcut
            </span>
          </div>
        )}

        <div className="bg-gray-900 rounded-t-3xl shadow-2xl border-t border-white/8">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          <div className="px-5 pt-3 pb-6 flex flex-col gap-5">
            {/* Course info */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-white text-lg font-bold leading-tight">
                  {session?.course_code ?? '—'} · {session?.course_name ?? ''}
                </h2>
                <p className="text-white/50 text-sm mt-0.5">Şube: {session?.branch_name ?? '—'}</p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/15 border border-blue-500/25 text-blue-400 text-xs font-semibold shrink-0">
                <ScanLine className="w-3.5 h-3.5" />
                Yüz Tanıma
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/5 border border-white/8 rounded-2xl p-3 flex flex-col items-center gap-1">
                <span className="text-white text-xl font-bold">{stats.present}</span>
                <span className="text-white/40 text-[11px] font-medium">Mevcut</span>
              </div>
              <div className="bg-white/5 border border-white/8 rounded-2xl p-3 flex flex-col items-center gap-1">
                <span className="text-white text-xl font-bold">{stats.absent}</span>
                <span className="text-white/40 text-[11px] font-medium">Yok</span>
              </div>
              <div className="bg-white/5 border border-white/8 rounded-2xl p-3 flex flex-col items-center gap-1">
                <span className="text-blue-400 text-xl font-bold">%{stats.rate}</span>
                <span className="text-white/40 text-[11px] font-medium">Oran</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs text-white/40 font-medium">
                <span>{stats.present}/{stats.total} öğrenci</span>
                <span>%{stats.rate} tamamlandı</span>
              </div>
              <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-[width] duration-700"
                  style={{ width: `${stats.rate}%` }}
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2.5">
              <button
                onClick={() => { setShowManual((v) => !v); setConfirmEnd(false); }}
                className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-white/8 border border-white/12 text-white/80 text-sm font-semibold hover:bg-white/12 transition-colors"
              >
                <UserCheck className="w-4 h-4" />
                {showManual ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => { setScanning((s) => !s); setConfirmEnd(false); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-colors border ${
                  scanning
                    ? 'bg-white/8 border-white/12 text-white/80 hover:bg-white/12'
                    : 'bg-blue-500/20 border-blue-500/30 text-blue-400 hover:bg-blue-500/30'
                }`}
              >
                {scanning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {scanning ? 'Duraklat' : 'Devam Et'}
              </button>

              <button
                onClick={handleEnd}
                disabled={endSession.isPending || session?.status !== 'active'}
                className={`flex-[1.6] flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all disabled:opacity-50 ${
                  confirmEnd
                    ? 'bg-red-500 border border-red-500 text-white shadow-[0_4px_20px_rgba(239,68,68,0.4)]'
                    : 'bg-blue-600 border border-blue-500 text-white shadow-[0_4px_20px_rgba(37,99,235,0.35)] hover:bg-blue-500'
                }`}
              >
                {endSession.isPending
                  ? 'Bitiriliyor...'
                  : confirmEnd
                  ? 'Emin misin?'
                  : 'Yoklamayı Bitir'}
                {!endSession.isPending && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>

            {/* Manual list */}
            {showManual && (
              <div className="bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
                  <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">Manuel İşaretle</span>
                  <span className="text-white/40 text-xs">{attendance.length} öğrenci</span>
                </div>
                {attendance.length === 0 ? (
                  <div className="py-8 text-center text-white/30 text-sm">Bu şubede henüz öğrenci yok.</div>
                ) : (
                  <ul className="max-h-[38vh] overflow-y-auto divide-y divide-white/6">
                    {attendance.map((a) => (
                      <li key={a.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/4 transition-colors">
                        <Avatar name={a.student_name} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{a.student_name}</p>
                          <p className="text-white/40 text-xs">#{a.student_number}{a.auto_detected ? ' · otomatik' : ''}</p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          {(['present', 'late', 'absent'] as const).map((s) => (
                            <button
                              key={s}
                              onClick={() => handleManualMark(a, s)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                                a.status === s
                                  ? STATUS_COLORS[s]
                                  : 'bg-white/6 border-white/10 text-white/40 hover:bg-white/10'
                              }`}
                            >
                              {STATUS_LABEL[s]}
                            </button>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
