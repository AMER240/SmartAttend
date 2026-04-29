import { ArrowUpRight, Edit2, GraduationCap, Plus, Search, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import ConfirmDialog from '@/components/ConfirmDialog';
import { EmptyState, PageError, PageLoading } from '@/components/LoadingState';
import { useToast } from '@/components/Toast';
import { extractErrorMessage } from '@/lib/api';
import {
  useCourses,
  useCreateCourse,
  useDeleteCourse,
  useUpdateCourse,
} from '@/lib/queries';
import type { Course } from '@/lib/types';

type FormState = { name: string; code: string; schedule: string; location: string };

export default function Courses() {
  const navigate = useNavigate();
  const toast = useToast();

  const { data: courses, isLoading, error, refetch } = useCourses();
  const deleteCourse = useDeleteCourse();

  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Course | null>(null);

  const filtered = useMemo(() => {
    const list = courses ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.schedule.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q),
    );
  }, [courses, search]);

  const openAdd = () => {
    navigate('/courses/new');
  };

  const openEdit = (course: Course) => {
    navigate(`/courses/${course.id}/edit`);
  };

  const handleDelete = async (course: Course) => {
    try {
      await deleteCourse.mutateAsync(course.id);
      toast.success('Ders silindi.');
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Silinemedi.'));
    }
  };

  return (
    <div className="px-4 md:px-8 max-w-[1440px] mx-auto w-full py-6 md:py-8">
      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr] mb-8">
        <section className="rounded-3xl border border-outline-variant bg-gradient-to-br from-primary-container/35 via-surface-container-lowest to-surface-container-lowest p-6 md:p-8 shadow-sm">
          <div className="max-w-2xl">
            <p className="text-label-md font-medium text-primary uppercase tracking-[0.16em]">Dersler</p>
            <h1 className="mt-2 font-headline-xl text-headline-xl text-on-surface">Ders yönetimi merkezi</h1>
            <p className="mt-3 font-body-lg text-body-lg text-on-surface-variant">
              Dersleri, şubeleri ve kayıtları tek bir sade akışla yönetin.
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              onClick={openAdd}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-surface-tint"
            >
              <Plus className="w-5 h-5" />
              Yeni Ders
            </button>
            <button
              onClick={() => navigate('/students/new')}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest px-5 font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-low"
            >
              Öğrenci Ekle
              <ArrowUpRight className="w-5 h-5" />
            </button>
          </div>
        </section>

        <aside className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
            <p className="text-label-sm uppercase tracking-wide text-on-surface-variant">Toplam Ders</p>
            <p className="mt-2 font-headline-xl text-headline-xl text-on-surface">{courses?.length ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
            <p className="text-label-sm uppercase tracking-wide text-on-surface-variant">Arama</p>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant w-5 h-5" />
              <input
                className="w-full h-11 pl-11 pr-4 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/50 transition-all shadow-sm"
                placeholder="Derslerde ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                type="text"
              />
            </div>
          </div>
        </aside>
      </div>

      {isLoading ? (
        <PageLoading label="Dersler yükleniyor..." />
      ) : error ? (
        <PageError message={extractErrorMessage(error, 'Dersler alınamadı.')} onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={courses?.length === 0 ? 'Henüz ders yok' : 'Eşleşen ders yok'}
          description={
            courses?.length === 0
              ? 'İlk dersinizi ekleyin. Her ders için otomatik şube ve kayıt akışı hazırlanır.'
              : 'Arama terimini değiştirin veya yeni ders ekleyin.'
          }
          action={
            <button
              onClick={openAdd}
              className="bg-primary text-on-primary rounded-xl px-4 py-2.5 font-label-md text-label-md hover:bg-surface-tint transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Yeni Ders
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((course) => (
            <article
              key={course.id}
              className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all group min-h-[260px]"
            >
              <Link to={`/courses/${course.id}`} className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 bg-primary-fixed rounded-2xl flex items-center justify-center text-on-primary-fixed-variant shrink-0">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-label-md text-label-md text-primary">{course.code}</span>
                    <h3 className="font-headline-md text-headline-md text-on-surface leading-tight mt-1 truncate">
                      {course.name}
                    </h3>
                  </div>
                </div>
              </Link>
              <div className="flex flex-col gap-2 mt-2 text-on-surface-variant">
                {course.schedule && (
                  <p className="font-body-md text-body-md text-on-surface-variant flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-outline-variant shrink-0"></span>
                    {course.schedule}
                  </p>
                )}
                {course.location && (
                  <p className="font-body-md text-body-md text-on-surface-variant flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-outline-variant shrink-0"></span>
                    {course.location}
                  </p>
                )}
                <p className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-2 mt-1">
                  <Users className="w-4 h-4" />
                  {course.student_count} öğrenci • {course.branches.length} şube
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-auto pt-4 border-t border-surface-container-high">
                <button
                  onClick={() => navigate(`/courses/${course.id}`)}
                    className="bg-primary-container/30 text-on-primary-fixed-variant font-label-md text-label-md py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-primary-container/50 transition-colors"
                >
                  Aç
                </button>
                <button
                  onClick={() => openEdit(course)}
                  className="bg-surface-container-low text-on-surface font-label-md text-label-md py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 hover:bg-surface-container-high transition-colors"
                  title="Düzenle"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setConfirmDelete(course)}
                  className="text-error hover:bg-error-container/40 font-label-md text-label-md py-2.5 px-3 rounded-xl flex items-center justify-center transition-colors"
                  title="Sil"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Dersi Sil"
        message={
          confirmDelete
            ? `"${confirmDelete.name}" dersi tüm şubeleri, öğrencileri ve oturum kayıtları ile birlikte silinecek. Bu işlem geri alınamaz.`
            : ''
        }
        confirmLabel="Evet, Sil"
        destructive
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}
