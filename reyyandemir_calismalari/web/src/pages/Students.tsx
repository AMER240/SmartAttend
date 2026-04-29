import { ArrowUpRight, Mail, Plus, Search, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import ConfirmDialog from '@/components/ConfirmDialog';
import { EmptyState, PageError, PageLoading } from '@/components/LoadingState';
import { useToast } from '@/components/Toast';
import { buildPhotoUrl, extractErrorMessage } from '@/lib/api';
import { useAllStudents, useCourses, useDeleteStudent } from '@/lib/queries';
import type { Student } from '@/lib/types';

export default function Students() {
  const navigate = useNavigate();
  const toast = useToast();

  const studentsQuery = useAllStudents();
  const coursesQuery = useCourses();
  const deleteStudent = useDeleteStudent();

  const [search, setSearch] = useState('');
  const [filterCourse, setFilterCourse] = useState<number | 'all'>('all');
  const [filterBranch, setFilterBranch] = useState<number | 'all'>('all');
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  const students = studentsQuery.data ?? [];
  const courses = coursesQuery.data ?? [];

  const branchesOfFilterCourse =
    filterCourse === 'all' ? [] : courses.find((c) => c.id === filterCourse)?.branches ?? [];

  const filtered = useMemo(() => {
    let list = students;
    if (filterCourse !== 'all') list = list.filter((s) => s.course_id === filterCourse);
    if (filterBranch !== 'all') list = list.filter((s) => s.branch_id === filterBranch);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          s.student_number.toLowerCase().includes(q) ||
          (s.email?.toLowerCase().includes(q) ?? false),
      );
    }
    return list;
  }, [students, search, filterCourse, filterBranch]);

  const totalCount = students.length;
  const presentToday = students.filter((s) => s.attendance_rate >= 75).length;
  const riskCount = students.filter((s) => s.attendance_rate < 60).length;

  const handleDelete = async (s: Student) => {
    try {
      await deleteStudent.mutateAsync(s.id);
      toast.success('Öğrenci silindi.');
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Silinemedi.'));
    }
  };

  return (
    <div className="px-4 md:px-8 max-w-[1320px] mx-auto w-full py-6 md:py-8">
      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr] mb-8">
        <section className="rounded-3xl border border-outline-variant bg-gradient-to-br from-primary-container/35 via-surface-container-lowest to-surface-container-lowest p-6 md:p-8 shadow-sm">
          <div className="flex flex-col gap-5">
            <div className="max-w-2xl">
              <p className="text-label-md font-medium text-primary uppercase tracking-[0.16em]">
                Öğrenciler
              </p>
              <h1 className="mt-2 font-headline-xl text-headline-xl text-on-surface">
                Öğrenci yönetimi tek merkezde
              </h1>
              <p className="mt-3 font-body-lg text-body-lg text-on-surface-variant">
                Kayıtları filtreleyin, yeni öğrenci ekleyin ve ders bazında erişimi sade bir ekrandan yönetin.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant w-5 h-5" />
                <input
                  className="w-full h-12 pl-11 pr-4 bg-surface-container-lowest border border-outline-variant rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/50 transition-all shadow-sm"
                  placeholder="İsim, no veya e-posta ile ara..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  type="text"
                />
              </div>
              <button
                onClick={() => navigate('/students/new')}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-surface-tint"
              >
                <Plus className="w-5 h-5" />
                Yeni Öğrenci
              </button>
            </div>
          </div>
        </section>

        <aside className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <StatCard icon={<Users className="w-6 h-6" />} label="Toplam" value={totalCount} variant="primary" />
          <StatCard icon={<Users className="w-6 h-6" />} label="Katılım ≥ %75" value={presentToday} variant="success" />
          <StatCard icon={<Users className="w-6 h-6" />} label="Risk Grubu" value={riskCount} variant="error" />
        </aside>
      </div>

      <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 md:p-5 mb-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">Filtreler</h2>
            <p className="text-body-md text-on-surface-variant">Ders ve şube bazında listeyi daraltın.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:w-[520px]">
            <div className="grid gap-2">
              <label className="text-sm text-on-surface-variant">Ders</label>
              <select
                value={filterCourse}
                onChange={(e) => {
                  const v = e.target.value === 'all' ? 'all' : Number(e.target.value);
                  setFilterCourse(v);
                  setFilterBranch('all');
                }}
                className="h-11 px-3 border border-outline-variant rounded-xl bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="all">Tümü</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm text-on-surface-variant">Şube</label>
              <select
                value={filterBranch}
                onChange={(e) =>
                  setFilterBranch(e.target.value === 'all' ? 'all' : Number(e.target.value))
                }
                className="h-11 px-3 border border-outline-variant rounded-xl bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="all">Tümü</option>
                {filterCourse !== 'all' && branchesOfFilterCourse.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-headline-md text-headline-md text-on-surface">Öğrenci Listesi</h2>
        <button
          onClick={() => navigate('/students/new')}
          className="hidden md:inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-label-md font-medium text-on-surface-variant hover:bg-surface-container-low transition-colors"
        >
          Hızlı Kayıt
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>

      {studentsQuery.isLoading ? (
        <PageLoading label="Öğrenciler yükleniyor..." />
      ) : studentsQuery.error ? (
        <PageError
          message={extractErrorMessage(studentsQuery.error, 'Veriler alınamadı.')}
          onRetry={() => studentsQuery.refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={students.length === 0 ? 'Henüz öğrenci kaydı yok' : 'Filtreyle eşleşen öğrenci yok'}
          description={
            students.length === 0
              ? 'Fotoğraflı kayıt başlatmak için yeni öğrenci sayfasını açın.'
              : undefined
          }
          action={
            students.length === 0 ? (
              <button
                onClick={() => navigate('/students/new')}
                className="bg-primary text-on-primary rounded-lg px-4 py-2.5 font-label-md text-label-md hover:bg-surface-tint transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Yeni Öğrenci
              </button>
            ) : null
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((s) => {
            const variant: 'good' | 'risk' | 'mid' =
              s.attendance_rate >= 75 ? 'good' : s.attendance_rate < 60 ? 'risk' : 'mid';
            const stripe =
              variant === 'good' ? 'bg-secondary' : variant === 'risk' ? 'bg-error' : 'bg-primary';
            const bar = variant === 'good' ? 'bg-secondary' : variant === 'risk' ? 'bg-error' : 'bg-primary';
            return (
              <article
                key={s.id}
                className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden min-h-[240px]"
              >
                <div className={`absolute top-0 left-0 w-1 h-full ${stripe}`}></div>
                <div className="flex items-start justify-between gap-4 pl-2">
                  <div className="relative shrink-0">
                    {s.photo_path ? (
                      <img
                        alt={s.full_name}
                        src={buildPhotoUrl(s.photo_path) ?? ''}
                        className="w-16 h-16 rounded-2xl object-cover border border-outline-variant"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-surface-container-highest border border-outline-variant flex items-center justify-center text-on-surface-variant font-headline-md">
                        {initials(s.full_name)}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setStudentToDelete(s)}
                    className="text-error hover:bg-error-container/40 rounded p-1.5 transition-colors"
                    title="Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="pl-2 min-w-0">
                  <h3 className="font-headline-md text-headline-md text-on-surface truncate">
                    {s.full_name}
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    No: {s.student_number}
                  </p>
                  {s.email && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Mail className="w-4 h-4 text-outline-variant" />
                      <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
                        {s.email}
                      </span>
                    </div>
                  )}
                  <p className="font-label-sm text-label-sm text-on-surface-variant mt-1 truncate">
                    {s.course_code} {s.branch_code ? `· ${s.branch_code}` : ''}
                  </p>
                </div>
                <div className="w-full bg-surface-container-low h-1.5 rounded-full mt-1 overflow-hidden ml-2">
                  <div
                    className={`${bar} h-full rounded-full`}
                    style={{ width: `${Math.max(0, Math.min(100, s.attendance_rate))}%` }}
                  ></div>
                </div>
                <p className="font-label-sm text-label-sm text-on-surface-variant pl-2">
                  %{s.attendance_rate.toFixed(0)} Katılım{' '}
                  {variant === 'risk' && <span className="text-error">(Riskli)</span>}
                </p>
                <div className="flex gap-2 mt-auto pl-2">
                  <button
                    onClick={() => navigate(`/courses/${s.course_id}`)}
                    className="flex-1 border border-outline-variant text-primary rounded-xl py-2 font-label-md text-label-md hover:bg-surface-container-low transition-colors"
                  >
                    Dersi Aç
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!studentToDelete}
        title="Öğrenciyi Sil"
        message={
          studentToDelete
            ? `"${studentToDelete.full_name}" öğrencisi ve tüm yoklama kayıtları silinecek.`
            : ''
        }
        destructive
        confirmLabel="Evet, Sil"
        onConfirm={async () => {
          if (studentToDelete) {
            await handleDelete(studentToDelete);
            setStudentToDelete(null);
          }
        }}
        onClose={() => !deleteStudent.isPending && setStudentToDelete(null)}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  variant: 'primary' | 'success' | 'error';
}) {
  const ring =
    variant === 'success'
      ? 'bg-secondary-container/30 text-on-secondary-container'
      : variant === 'error'
        ? 'bg-error-container/30 text-on-error-container'
        : 'bg-primary-container/20 text-primary';
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex items-center gap-4 shadow-sm">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${ring}`}>{icon}</div>
      <div className="flex flex-col">
        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide">
          {label}
        </span>
        <span className="font-headline-lg text-headline-lg text-on-surface">{value}</span>
      </div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
