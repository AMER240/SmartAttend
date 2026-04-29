import { ArrowLeft, Save, UserRoundPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import CameraCapture from '@/components/CameraCapture';
import { PageError, PageLoading } from '@/components/LoadingState';
import { useToast } from '@/components/Toast';
import { extractErrorMessage } from '@/lib/api';
import { useCourses, useEnrollStudent } from '@/lib/queries';

const emptyForm = {
  full_name: '',
  student_number: '',
  email: '',
};

export default function StudentForm() {
  const navigate = useNavigate();
  const toast = useToast();

  const coursesQuery = useCourses();
  const courses = coursesQuery.data ?? [];

  const [courseId, setCourseId] = useState<number | null>(null);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [photo, setPhoto] = useState<Blob | null>(null);

  useEffect(() => {
    if (courseId !== null) return;
    const firstCourse = courses[0];
    if (!firstCourse) return;
    setCourseId(firstCourse.id);
    setBranchId(firstCourse.branches[0]?.id ?? null);
  }, [courses, courseId]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === courseId) ?? null,
    [courses, courseId],
  );

  const branches = selectedCourse?.branches ?? [];
  const enrollStudent = useEnrollStudent(courseId ?? 0);

  useEffect(() => {
    if (!selectedCourse) return;
    if (!branches.some((branch) => branch.id === branchId)) {
      setBranchId(branches[0]?.id ?? null);
    }
  }, [branchId, branches, selectedCourse]);

  if (coursesQuery.isLoading) {
    return <PageLoading label="Dersler yükleniyor..." />;
  }

  if (coursesQuery.error) {
    return (
      <PageError
        message={extractErrorMessage(coursesQuery.error, 'Dersler alınamadı.')}
        onRetry={() => coursesQuery.refetch()}
      />
    );
  }

  if (courses.length === 0) {
    return (
      <div className="px-4 md:px-8 max-w-3xl mx-auto w-full py-8">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-8 text-center shadow-sm">
          <p className="text-label-md font-medium text-primary uppercase tracking-[0.16em]">
            Öğrenci Kaydı
          </p>
          <h1 className="mt-2 font-headline-xl text-headline-xl text-on-surface">Önce ders oluşturun</h1>
          <p className="mt-2 text-body-md font-body-md text-on-surface-variant">
            Öğrenci ekleyebilmek için en az bir ders ve şube gerekli.
          </p>
          <button
            onClick={() => navigate('/courses/new')}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-medium text-on-primary hover:bg-surface-tint transition-colors"
          >
            <Save className="w-4 h-4" />
            Ders Oluştur
          </button>
        </div>
      </div>
    );
  }

  const busy = enrollStudent.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !branchId) {
      toast.error('Ders ve şube seçin.');
      return;
    }
    if (!photo) {
      toast.error('Lütfen öğrencinin fotoğrafını çekin.');
      return;
    }

    try {
      await enrollStudent.mutateAsync({
        full_name: form.full_name.trim(),
        student_number: form.student_number.trim(),
        branch_id: branchId,
        email: form.email.trim() || undefined,
        photo,
      });
      toast.success('Öğrenci kaydedildi.');
      navigate('/students', { replace: true });
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Kayıt başarısız. Yüz tek ve net görünmeli.'));
    }
  };

  return (
    <div className="px-4 md:px-8 max-w-6xl mx-auto w-full py-6 md:py-8">
      <button
        onClick={() => navigate('/students')}
        className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Öğrenciler
      </button>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p className="text-label-md font-medium text-primary uppercase tracking-[0.16em]">
                Öğrenci Ekle
              </p>
              <h1 className="mt-2 font-headline-xl text-headline-xl text-on-surface">Yeni Öğrenci Kaydı</h1>
              <p className="mt-2 text-body-md font-body-md text-on-surface-variant">
                Fotoğraflı kayıt ile yüz tanıma ve yoklama eşleştirmesi için veri oluşturun.
              </p>
            </div>
            <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-container/30 text-primary">
              <UserRoundPlus className="w-6 h-6" />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-on-surface-variant">Ders</label>
              <select
                required
                value={courseId ?? ''}
                onChange={(e) => {
                  const nextCourseId = Number(e.target.value);
                  setCourseId(nextCourseId);
                  const nextCourse = courses.find((course) => course.id === nextCourseId);
                  setBranchId(nextCourse?.branches[0]?.id ?? null);
                }}
                className="w-full h-11 px-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code} — {course.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-on-surface-variant">Şube</label>
              <select
                required
                value={branchId ?? ''}
                onChange={(e) => setBranchId(Number(e.target.value))}
                className="w-full h-11 px-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} — {branch.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-on-surface-variant">Ad Soyad</label>
              <input
                required
                className="w-full h-11 px-4 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="Örn: Ayşe Yılmaz"
                value={form.full_name}
                onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-on-surface-variant">Öğrenci Numarası</label>
                <input
                  required
                  className="w-full h-11 px-4 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Örn: 202104012"
                  value={form.student_number}
                  onChange={(e) => setForm((prev) => ({ ...prev, student_number: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-on-surface-variant">E-posta</label>
                <input
                  type="email"
                  className="w-full h-11 px-4 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="ayse.yilmaz@uni.edu"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-4">
              <div className="mb-3">
                <label className="text-sm font-medium text-on-surface-variant">Yüz Fotoğrafı</label>
                <p className="text-xs text-on-surface-variant mt-1">
                  Tek yüzün net göründüğü bir kare çekin. Gözlük, maske ve yan açılardan kaçının.
                </p>
              </div>
              <CameraCapture onCapture={(blob) => setPhoto(blob)} />
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/students')}
                className="w-full sm:w-auto px-5 py-2.5 text-on-surface-variant font-medium hover:bg-surface-container-low rounded-xl transition-colors"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={busy}
                className="w-full sm:w-auto px-5 py-2.5 bg-primary text-on-primary font-medium rounded-xl hover:bg-surface-tint shadow-sm transition-all active:scale-[0.98] disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {busy ? 'Kaydediliyor...' : 'Öğrenciyi Kaydet'}
              </button>
            </div>
          </form>
        </section>

        <aside className="space-y-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm">
            <p className="text-label-md font-medium text-primary uppercase tracking-[0.16em]">
              Kayıt Özeti
            </p>
            <div className="mt-4 grid gap-3 text-body-md">
              <InfoRow label="Seçili Ders" value={selectedCourse ? `${selectedCourse.code} · ${selectedCourse.name}` : '—'} />
              <InfoRow
                label="Seçili Şube"
                value={branches.find((branch) => branch.id === branchId) ? branches.find((branch) => branch.id === branchId)!.name : '—'}
              />
              <InfoRow label="Kayıt Tipi" value="Fotoğraflı ve yüz tanımaya hazır" />
              <InfoRow label="Çıktı" value="Liste, kurs ve yüz eşleştirme ekranlarına yansır" />
            </div>
          </div>


        </aside>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl bg-surface-container-low px-4 py-3">
      <span className="text-sm text-on-surface-variant">{label}</span>
      <span className="text-sm font-medium text-on-surface text-right">{value}</span>
    </div>
  );
}

