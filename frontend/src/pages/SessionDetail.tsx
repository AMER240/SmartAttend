import { ArrowLeft, CheckCircle2, Clock, MapPin, Play, Trash2, XCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import ConfirmDialog from '@/components/ConfirmDialog';
import { PageError, PageLoading } from '@/components/LoadingState';
import { useToast } from '@/components/Toast';
import { extractErrorMessage } from '@/lib/api';
import {
  useAttendance,
  useDeleteSession,
  useEndSession,
  useSession,
  useUpdateAttendance,
} from '@/lib/queries';
import type { AttendanceStatus } from '@/lib/types';
import { useState } from 'react';

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'Mevcut',
  absent: 'Yok',
  late: 'Geç',
};

export default function SessionDetail() {
  const { sessionId: raw } = useParams<{ sessionId: string }>();
  const sessionId = Number(raw);
  const navigate = useNavigate();
  const toast = useToast();

  const sessionQuery = useSession(sessionId);
  const attendanceQuery = useAttendance(sessionId);
  const update = useUpdateAttendance(sessionId);
  const endSession = useEndSession();
  const deleteSession = useDeleteSession();

  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!Number.isFinite(sessionId)) return <PageError message="Geçersiz oturum." />;
  if (sessionQuery.isLoading || attendanceQuery.isLoading) return <PageLoading />;
  if (sessionQuery.error || !sessionQuery.data)
    return (
      <PageError
        message={extractErrorMessage(sessionQuery.error, 'Oturum bulunamadı.')}
        onRetry={() => sessionQuery.refetch()}
      />
    );

  const session = sessionQuery.data;
  const attendance = attendanceQuery.data ?? [];
  const total = attendance.length;
  const present = attendance.filter((a) => a.status === 'present').length;
  const absent = attendance.filter((a) => a.status === 'absent').length;
  const late = attendance.filter((a) => a.status === 'late').length;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  const handleStatus = async (id: number, status: AttendanceStatus) => {
    try {
      await update.mutateAsync({ attendanceId: id, status });
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Güncellenemedi.'));
    }
  };

  const handleEnd = async () => {
    try {
      await endSession.mutateAsync(sessionId);
      toast.success('Oturum kapatıldı.');
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Kapatılamadı.'));
    }
  };

  const handleDelete = async () => {
    try {
      await deleteSession.mutateAsync(sessionId);
      toast.success('Oturum silindi.');
      navigate('/history', { replace: true });
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Silinemedi.'));
    }
  };

  return (
    <div className="px-4 md:px-8 max-w-[1440px] mx-auto w-full py-6 md:py-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Geri
      </button>

      <section className="rounded-3xl border border-outline-variant bg-gradient-to-br from-primary-container/35 via-surface-container-lowest to-surface-container-lowest p-6 md:p-8 shadow-sm mb-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl min-w-0">
            <p className="text-label-md font-medium text-primary uppercase tracking-[0.16em]">
              Oturum Detayı
            </p>
            <h1 className="mt-2 font-headline-xl text-headline-xl text-on-surface truncate">
              {session.course_name}
            </h1>
            <p className="mt-2 text-body-lg text-on-surface-variant">
              {session.course_code} · {session.branch_code} · {session.branch_name ?? '—'}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-on-surface-variant">
              <span className="flex items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-1.5">
                <Clock className="w-4 h-4" />
                {new Date(session.started_at).toLocaleString('tr-TR', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
              {session.ended_at && (
                <span className="flex items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-1.5">
                  <Play className="w-4 h-4" />
                  {new Date(session.ended_at).toLocaleString('tr-TR', { timeStyle: 'short' })}
                </span>
              )}
              <span
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${
                  session.status === 'active'
                    ? 'bg-error-container text-on-error-container'
                    : 'bg-secondary-fixed/30 text-on-secondary-fixed-variant'
                }`}
              >
                {session.status === 'active' ? 'Aktif' : 'Tamamlandı'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            {session.status === 'active' ? (
              <>
                <button
                  onClick={() => navigate(`/scanner/${session.id}`)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-on-primary text-sm font-label-md hover:bg-surface-tint transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Devam Et
                </button>
                <button
                  onClick={handleEnd}
                  disabled={endSession.isPending}
                  className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface-variant text-sm font-label-md hover:bg-surface-container-low transition-colors disabled:opacity-60"
                >
                  {endSession.isPending ? 'Bitiriliyor...' : 'Bitir'}
                </button>
              </>
            ) : null}
            <button
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-error/20 bg-error-container/30 px-4 py-2.5 text-error text-sm font-label-md hover:bg-error-container/50 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Sil
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Mevcut" value={present} variant="success" />
        <Stat label="Devamsız" value={absent} variant="error" />
        <Stat label="Geç" value={late} variant="warn" />
        <Stat label="Katılım" value={`${rate}%`} variant="primary" />
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-headline-md text-headline-md text-on-surface">Yoklama Listesi</h2>
        <span className="text-sm text-on-surface-variant">{total} kayıt</span>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-low text-on-surface-variant">
            <tr className="text-left">
              <th className="py-2 px-4 font-label-md text-label-md">Öğrenci</th>
              <th className="py-2 px-4 font-label-md text-label-md hidden sm:table-cell">No</th>
              <th className="py-2 px-4 font-label-md text-label-md hidden md:table-cell">Tarih</th>
              <th className="py-2 px-4 font-label-md text-label-md text-right">Durum</th>
            </tr>
          </thead>
          <tbody>
            {attendance.map((a) => (
              <tr key={a.id} className="border-t border-outline-variant/30 hover:bg-surface-container-low">
                <td className="py-2 px-4">
                  <div className="font-label-md text-label-md text-on-surface">{a.student_name}</div>
                  {a.auto_detected && (
                    <div className="text-[11px] text-on-surface-variant">otomatik</div>
                  )}
                </td>
                <td className="py-2 px-4 text-on-surface-variant hidden sm:table-cell">
                  {a.student_number}
                </td>
                <td className="py-2 px-4 text-on-surface-variant hidden md:table-cell">
                  {new Date(a.marked_at).toLocaleString('tr-TR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </td>
                <td className="py-2 px-4 text-right">
                  <div className="flex justify-end gap-1">
                    {(['present', 'late', 'absent'] as AttendanceStatus[]).map((st) => (
                      <button
                        key={st}
                        onClick={() => handleStatus(a.id, st)}
                        disabled={update.isPending && a.status === st}
                        className={`px-2 py-1 rounded text-xs font-label-sm transition-colors ${
                          a.status === st
                            ? st === 'present'
                              ? 'bg-secondary text-on-secondary'
                              : st === 'late'
                                ? 'bg-tertiary-container text-on-tertiary-container'
                                : 'bg-error text-on-error'
                            : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                      >
                        {STATUS_LABEL[st]}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {attendance.length === 0 && (
              <tr>
                <td colSpan={4} className="py-10 px-4 text-center text-on-surface-variant">
                  Bu oturumda öğrenci yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Oturumu Sil"
        message="Bu oturum ve tüm yoklama kayıtları silinecek. Geri alınamaz."
        destructive
        confirmLabel="Evet, Sil"
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  variant,
}: {
  label: string;
  value: number | string;
  variant: 'primary' | 'success' | 'error' | 'warn';
}) {
  const tone =
    variant === 'success'
      ? 'text-secondary'
      : variant === 'error'
        ? 'text-error'
        : variant === 'warn'
          ? 'text-tertiary'
          : 'text-primary';
  const Icon = variant === 'success' ? CheckCircle2 : variant === 'error' ? XCircle : Clock;
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
      <div className={`flex items-center gap-2 ${tone}`}>
        <Icon className="w-4 h-4" />
        <span className="font-label-sm text-label-sm uppercase tracking-wide">{label}</span>
      </div>
      <span className="font-headline-md text-headline-md text-on-surface">{value}</span>
    </div>
  );
}
