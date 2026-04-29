import { ArrowUpRight, ChevronRight, Database, Users, UserX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { EmptyState, PageError, PageLoading } from '@/components/LoadingState';
import { extractErrorMessage } from '@/lib/api';
import { useAllSessions, useCourses } from '@/lib/queries';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function History() {
  const navigate = useNavigate();
  const sessionsQuery = useAllSessions();
  const coursesQuery = useCourses();

  const [filterCourse, setFilterCourse] = useState<number | 'all'>('all');

  const sessions = sessionsQuery.data ?? [];
  const courses = coursesQuery.data ?? [];

  const filtered = useMemo(() => {
    if (filterCourse === 'all') return sessions;
    return sessions.filter((s) => s.course_id === filterCourse);
  }, [sessions, filterCourse]);

  const today = new Date();
  const todayStr = today.toLocaleDateString('tr-TR', { dateStyle: 'medium' });

  const todaySummary = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const todays = sessions.filter((s) => new Date(s.started_at) >= start);
    const present = todays.reduce((acc, s) => acc + s.present_count, 0);
    const absent = todays.reduce((acc, s) => acc + s.absent_count, 0);
    const ended = todays.filter((s) => s.status === 'ended').length;
    return { present, absent, ended, total: todays.length };
  }, [sessions]);

  return (
    <div className="px-4 md:px-8 max-w-[1440px] mx-auto w-full py-6 md:py-8">
      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr] mb-8">
        <section className="rounded-3xl border border-outline-variant bg-gradient-to-br from-primary-container/35 via-surface-container-lowest to-surface-container-lowest p-6 md:p-8 shadow-sm">
          <div className="flex flex-col gap-5">
            <div className="max-w-2xl">
              <p className="text-label-md font-medium text-primary uppercase tracking-[0.16em]">
                Geçmiş
              </p>
              <h2 className="mt-2 font-headline-xl text-headline-xl text-on-surface">
                Yoklama geçmişi ve günlük özet
              </h2>
              <p className="mt-3 font-body-lg text-body-lg text-on-surface-variant">
                Oturumları, katılım oranlarını ve gün bazlı özetleri tek yerde takip edin.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                onClick={() => navigate('/courses')}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-surface-tint"
              >
                Derslere Git
                <ArrowUpRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate('/students')}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest px-5 font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-low"
              >
                Öğrenci Listesi
              </button>
            </div>
          </div>
        </section>

        <aside className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
          <SummaryStat label="Bugün Mevcut" value={todaySummary.present} caption={`${todaySummary.total} oturum`} tone="primary" icon={<Users className="w-5 h-5" />} />
          <SummaryStat label="Bugün Devamsız" value={todaySummary.absent} caption="Gün içi toplam" tone="error" icon={<UserX className="w-5 h-5" />} />
          <SummaryStat label="Tamamlanan" value={todaySummary.ended} caption={`${Math.max(todaySummary.total - todaySummary.ended, 0)} aktif`} tone="neutral" icon={<Database className="w-5 h-5" />} />
        </aside>
      </div>

      <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 md:p-5 mb-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-headline-md text-headline-md text-on-surface">Filtreler</h3>
            <p className="text-body-md text-on-surface-variant">Ders bazında geçmiş oturumları daraltın.</p>
          </div>
          <select
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="h-11 px-3 border border-outline-variant rounded-xl bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary lg:w-[280px]"
          >
            <option value="all">Tüm Dersler</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline-md text-headline-md text-on-surface">Tüm Oturumlar</h3>
        <span className="text-sm text-on-surface-variant">{filtered.length} kayıt</span>
      </div>

      {sessionsQuery.isLoading ? (
        <PageLoading />
      ) : sessionsQuery.error ? (
        <PageError
          message={extractErrorMessage(sessionsQuery.error, 'Oturumlar alınamadı.')}
          onRetry={() => sessionsQuery.refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Henüz oturum kaydı yok"
          description="İlk yoklamayı başlatınca geçmiş burada görünür."
          action={
            <button
              onClick={() => navigate('/courses')}
              className="bg-primary text-on-primary rounded-xl px-4 py-2.5 font-label-md text-label-md hover:bg-surface-tint transition-colors flex items-center gap-2"
            >
              Derslere Git
              <ArrowUpRight className="w-4 h-4" />
            </button>
          }
        />
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden flex flex-col divide-y divide-outline-variant/50 shadow-sm">
          {filtered.map((s) => {
            const total = Math.max(s.total_count, s.present_count + s.absent_count + s.late_count);
            const rate = total > 0 ? Math.round((s.present_count / total) * 100) : 0;
            return (
              <button
                key={s.id}
                onClick={() => navigate(`/history/${s.id}`)}
                className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 md:p-5 hover:bg-surface-container-low transition-colors text-left group"
              >
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-12 h-12 bg-primary-fixed rounded-2xl flex items-center justify-center text-on-primary-fixed-variant shrink-0">
                    <Database className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-label-md text-label-md text-on-surface truncate">
                      {s.course_name} ({s.course_code}) · {s.branch_code}
                    </h4>
                    <p className="font-body-md text-body-md text-on-surface-variant text-sm">
                      {formatDate(s.started_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <div className="text-right hidden sm:block min-w-[120px]">
                    <div className="font-label-md text-label-md text-on-surface">%{rate} Katılım</div>
                    <div className="w-28 h-1.5 bg-surface-container rounded-full mt-1 overflow-hidden">
                      <div
                        className={`h-full ${rate >= 75 ? 'bg-secondary' : rate >= 50 ? 'bg-primary' : 'bg-error'}`}
                        style={{ width: `${rate}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-label-sm text-label-sm px-2.5 py-1 rounded-full ${
                        s.status === 'active'
                          ? 'bg-error-container text-on-error-container'
                          : 'bg-secondary-fixed/30 text-on-secondary-fixed-variant'
                      }`}
                    >
                      {s.status === 'active' ? 'Aktif' : 'Tamamlandı'}
                    </span>
                    <ChevronRight className="w-5 h-5 text-outline group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryStat({
  icon,
  label,
  value,
  caption,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  caption: string;
}) {
  return (
    <div className="p-4 bg-surface rounded border border-outline-variant/50">
      <div className="flex items-center gap-2 mb-2 text-on-surface-variant">
        {icon}
        <span className="font-label-sm text-label-sm">{label}</span>
      </div>
      <div className="font-headline-xl text-headline-xl text-on-surface">{value}</div>
      {caption && <div className="font-label-sm text-label-sm text-on-surface-variant mt-1">{caption}</div>}
    </div>
  );
}
