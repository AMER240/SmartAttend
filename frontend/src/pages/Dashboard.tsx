import {
  ArrowUpRight,
  Clock,
  GraduationCap,
  MapPin,
  Megaphone,
  Play,
  Plus,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { EmptyState, PageError, PageLoading } from '@/components/LoadingState';
import { useToast } from '@/components/Toast';
import { extractErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  useActiveSessions,
  useAllSessions,
  useCourses,
  useStartBranchSession,
} from '@/lib/queries';

export default function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const { teacher } = useAuth();
  const coursesQuery = useCourses();
  const activeQuery = useActiveSessions();
  const allSessionsQuery = useAllSessions();
  const startSession = useStartBranchSession();

  const today = new Date();
  const todayStr = today.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  });

  const courses = coursesQuery.data ?? [];
  const active = activeQuery.data ?? [];
  const allSessions = allSessionsQuery.data ?? [];
  const activeSessionsByBranch = useMemo(() => new Map(active.map((session) => [session.branch_id, session])), [active]);

  const weekStats = useMemo(() => {
    if (allSessions.length === 0) return { rate: 0, sessions: 0 };
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = allSessions.filter((s) => new Date(s.started_at).getTime() >= oneWeekAgo);
    if (recent.length === 0) return { rate: 0, sessions: 0 };
    const totalPresent = recent.reduce((acc, s) => acc + s.present_count, 0);
    const totalSlots = recent.reduce((acc, s) => acc + Math.max(s.total_count, 1), 0);
    return {
      rate: Math.round((totalPresent / Math.max(totalSlots, 1)) * 100),
      sessions: recent.length,
    };
  }, [allSessions]);

  const handleStart = async (branchId: number) => {
    try {
      const session = await startSession.mutateAsync(branchId);
      navigate(`/scanner/${session.id}`);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Oturum başlatılamadı.'));
    }
  };

  const isLoading = coursesQuery.isLoading || activeQuery.isLoading;
  const isError = coursesQuery.error || activeQuery.error;

  return (
    <div className="max-w-[1440px] mx-auto w-full px-4 md:px-8 py-6 md:py-8">
      <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr] mb-8">
        <section className="rounded-3xl border border-outline-variant bg-gradient-to-br from-primary-container/35 via-surface-container-lowest to-surface-container-lowest p-6 md:p-8 shadow-sm overflow-hidden relative">
          <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative flex flex-col gap-6">
            <div className="max-w-2xl">
              <p className="text-label-md font-medium text-primary uppercase tracking-[0.16em]">
                Kontrol Merkezi
              </p>
              <h2 className="mt-2 font-headline-xl text-headline-xl text-on-surface break-words">
                Hoş geldin{teacher?.name ? `, ${teacher.name}` : ''}.
              </h2>
              <p className="mt-3 font-body-lg text-body-lg text-on-surface-variant">
                {todayStr} · Oturumları başlat, öğrencileri ekle ve son haftanın katılımını tek ekrandan izle.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                onClick={() => navigate('/courses/new')}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-surface-tint"
              >
                <Plus className="w-5 h-5" />
                Yeni Ders
              </button>
              <button
                onClick={() => navigate('/students/new')}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest px-5 font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-low"
              >
                <UserCheck className="w-5 h-5" />
                Öğrenci Ekle
              </button>
              <button
                onClick={() => navigate('/courses')}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest px-5 font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-low"
              >
                Dersleri Aç
                <ArrowUpRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </section>

        <aside className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <SummaryCard label="Haftalık Katılım" value={`${weekStats.rate}%`} subtitle={`Son 7 gün · ${weekStats.sessions} oturum`} accent="primary" />
          <SummaryCard label="Aktif Oturum" value={active.length.toString()} subtitle="Şu anda devam eden" accent="success" />
          <SummaryCard label="Toplam Ders" value={courses.length.toString()} subtitle="Yönetilen ders sayısı" accent="neutral" />
        </aside>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-6 md:gap-8">
        <div className="flex flex-col gap-5 md:gap-6">
          {isLoading ? (
            <PageLoading />
          ) : isError ? (
            <PageError message={extractErrorMessage(isError, 'Veriler alınamadı.')} />
          ) : active.length > 0 ? (
            active.map((s) => (
              <div
                key={s.id}
                className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden"
              >
                <div className="h-2 w-full bg-error"></div>
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-4 md:mb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center px-2 py-1 rounded-sm bg-error-container text-on-error-container font-label-sm text-label-sm">
                          <span className="w-2 h-2 rounded-full bg-error mr-1.5 animate-pulse"></span>
                          Devam Ediyor
                        </span>
                        <span className="font-label-md text-label-md text-on-surface-variant">
                          {s.course_code} · {s.branch_code}
                        </span>
                      </div>
                      <h3 className="font-headline-md text-headline-md text-on-surface">
                        {s.course_name}
                      </h3>
                    </div>
                    <div className="hidden sm:flex bg-surface-container rounded-lg p-2 text-center flex-col min-w-[60px]">
                      <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                        Mevcut
                      </span>
                      <span className="font-headline-md text-headline-md text-primary">
                        {s.present_count}/{s.total_count}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 border-t border-surface-container-highest pt-4">
                    <button
                      onClick={() => navigate(`/scanner/${s.id}`)}
                      className="w-full bg-primary text-on-primary font-label-md text-label-md py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-surface-tint transition-colors"
                    >
                      <UserCheck className="w-5 h-5" />
                      Tarayıcıyı Aç
                    </button>
                    <button
                      onClick={() => navigate(`/courses/${s.course_id}`)}
                      className="w-full bg-surface-container-lowest border border-outline hover:border-primary text-primary font-label-md text-label-md py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
                    >
                      Detayları Gör
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : null}

          <div className="flex items-center justify-between mt-2">
            <h3 className="font-headline-md text-headline-md text-on-surface">Derslerim</h3>
            <button
              onClick={() => navigate('/courses/new')}
              className="hidden md:inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-label-md font-medium text-on-surface-variant hover:bg-surface-container-low transition-colors"
            >
              Ders Ekle
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
          {courses.length === 0 ? (
            <EmptyState
              title="Henüz ders eklemedin"
              description="İlk dersini oluşturup şubeye öğrenci eklemeye başla."
              action={
                <button
                  onClick={() => navigate('/courses/new')}
                  className="bg-primary text-on-primary rounded-xl px-4 py-2.5 font-label-md text-label-md hover:bg-surface-tint transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Ders Ekle
                </button>
              }
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {courses.map((c) => (
                <div
                  key={c.id}
                  className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-sm"
                >
                  <div className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-primary-fixed/40 text-primary flex items-center justify-center shrink-0">
                          <GraduationCap className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-label-md text-label-md text-primary">{c.code}</span>
                          <h4 className="font-headline-md text-headline-md text-on-surface truncate">
                            {c.name}
                          </h4>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-on-surface-variant text-sm">
                            {c.schedule && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" /> {c.schedule}
                              </span>
                            )}
                            {c.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" /> {c.location}
                              </span>
                            )}
                            <span>{c.student_count} öğrenci · {c.branches.length} şube</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        {c.branches.map((b) => {
                          const activeSession = activeSessionsByBranch.get(b.id);
                          return (
                            <button
                              key={b.id}
                              onClick={() => (activeSession ? navigate(`/scanner/${activeSession.id}`) : handleStart(b.id))}
                              disabled={startSession.isPending}
                              className={`px-3 py-2 rounded-xl text-sm font-label-md flex items-center gap-1.5 transition-colors disabled:opacity-60 ${
                                activeSession
                                  ? 'bg-secondary-container/40 text-on-secondary-container hover:bg-secondary-container/60'
                                  : 'bg-primary-container/30 text-on-primary-fixed-variant hover:bg-primary hover:text-on-primary'
                              }`}
                            >
                              <Play className="w-4 h-4" />
                              {b.code} {activeSession ? 'Devam Et' : 'Başlat'}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => navigate(`/courses/${c.id}`)}
                          className="px-3 py-2 rounded-xl border border-outline-variant text-on-surface-variant hover:bg-surface-container-low text-sm font-label-md transition-colors"
                        >
                          Aç
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 md:gap-6">
          <div className="bg-primary-fixed rounded-2xl p-4 sm:p-6 border border-primary-fixed-dim shadow-sm">
            <h4 className="font-label-md text-label-md text-on-primary-fixed-variant mb-4 uppercase tracking-wider">
              Haftalık Özet
            </h4>
            <div className="flex items-end gap-3 mb-2">
              <span className="font-headline-xl text-headline-xl text-on-primary-fixed">
                {weekStats.rate}%
              </span>
              <span className="font-body-md text-body-md text-on-primary-fixed-variant pb-1">
                Ortalama Katılım
              </span>
            </div>
            <div className="w-full bg-surface-container-highest rounded-full h-1.5 mb-2 mt-4">
              <div
                className="bg-primary h-1.5 rounded-full"
                style={{ width: `${weekStats.rate}%` }}
              ></div>
            </div>
            <p className="font-label-sm text-label-sm text-on-primary-fixed-variant flex justify-between">
              <span>Son 7 gün · {weekStats.sessions} oturum</span>
              <TrendingUp className="w-4 h-4" />
            </p>
          </div>


        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  subtitle,
  accent,
}: {
  label: string;
  value: string;
  subtitle: string;
  accent: 'primary' | 'success' | 'neutral';
}) {
  const accentClass =
    accent === 'success'
      ? 'bg-secondary-container text-on-secondary-container'
      : accent === 'neutral'
        ? 'bg-surface-container-highest text-on-surface'
        : 'bg-primary-container/30 text-primary';

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
      <div className={`inline-flex rounded-xl px-3 py-1.5 text-label-sm font-medium ${accentClass}`}>
        {label}
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <span className="font-headline-xl text-headline-xl text-on-surface">{value}</span>
        <span className="text-sm text-on-surface-variant text-right max-w-[140px]">{subtitle}</span>
      </div>
    </div>
  );
}
