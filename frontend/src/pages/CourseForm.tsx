import { ArrowLeft, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { PageError, PageLoading } from '@/components/LoadingState';
import { useToast } from '@/components/Toast';
import { extractErrorMessage } from '@/lib/api';
import { useCourse, useCreateCourse, useUpdateCourse } from '@/lib/queries';

type FormState = {
  name: string;
  code: string;
  schedule: string;
  location: string;
};

const emptyForm: FormState = {
  name: '',
  code: '',
  schedule: '',
  location: '',
};

export default function CourseForm() {
  const { courseId: courseIdRaw } = useParams<{ courseId?: string }>();
  const courseId = courseIdRaw ? Number(courseIdRaw) : null;
  const isEdit = courseId !== null && Number.isFinite(courseId);

  const navigate = useNavigate();
  const toast = useToast();

  const courseQuery = useCourse(isEdit ? courseId ?? undefined : undefined);
  const createCourse = useCreateCourse();
  const updateCourse = useUpdateCourse(courseId ?? 0);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    setInitialized(false);
  }, [courseIdRaw]);

  useEffect(() => {
    if (!isEdit) {
      setForm(emptyForm);
      setInitialized(true);
      return;
    }

    if (courseQuery.data && !initialized) {
      setForm({
        name: courseQuery.data.name,
        code: courseQuery.data.code,
        schedule: courseQuery.data.schedule ?? '',
        location: courseQuery.data.location ?? '',
      });
      setInitialized(true);
    }
  }, [courseQuery.data, initialized, isEdit]);

  if (isEdit && Number.isFinite(courseId) && courseQuery.isLoading) {
    return <PageLoading label="Ders yükleniyor..." />;
  }

  if (isEdit && (courseQuery.error || !courseQuery.data)) {
    return (
      <PageError
        message={extractErrorMessage(courseQuery.error, 'Ders bulunamadı.')} 
        onRetry={() => courseQuery.refetch()}
      />
    );
  }

  const busy = createCourse.isPending || updateCourse.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        schedule: form.schedule.trim(),
        location: form.location.trim(),
      };

      if (isEdit && courseId) {
        await updateCourse.mutateAsync(payload);
        toast.success('Ders güncellendi.');
        navigate(`/courses/${courseId}`, { replace: true });
      } else {
        await createCourse.mutateAsync(payload);
        toast.success('Ders oluşturuldu.');
        navigate('/courses', { replace: true });
      }
    } catch (err) {
      toast.error(extractErrorMessage(err, 'İşlem başarısız.'));
    }
  };

  return (
    <div className="px-4 md:px-8 max-w-3xl mx-auto w-full py-8">
      <button
        onClick={() => navigate('/courses')}
        className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Dersler
      </button>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 md:p-8 shadow-sm">
        <div className="mb-6">
          <p className="text-label-md font-medium text-primary uppercase tracking-[0.16em]">
            {isEdit ? 'Ders Düzenleme' : 'Yeni Ders'}
          </p>
          <h1 className="mt-2 font-headline-xl text-headline-xl text-on-surface">
            {isEdit ? 'Dersi Güncelle' : 'Yeni Ders Oluştur'}
          </h1>
          <p className="mt-2 text-body-md font-body-md text-on-surface-variant">
            {isEdit
              ? 'Ders bilgilerini düzenleyin ve kaydedin.'
              : 'Yeni ders ekleyin. Sistem otomatik olarak varsayılan şubeyi ve ilişkili başlangıç kaydını oluşturur.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-on-surface-variant">Ders Kodu</label>
            <input
              required
              className="w-full h-11 px-4 bg-surface-container-lowest border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              placeholder="Örn: CS 101"
              value={form.code}
              onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-on-surface-variant">Ders Adı</label>
            <input
              required
              className="w-full h-11 px-4 bg-surface-container-lowest border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              placeholder="Örn: Bilgisayar Bilimlerine Giriş"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-on-surface-variant">Program (Gün / Saat)</label>
            <input
              className="w-full h-11 px-4 bg-surface-container-lowest border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              placeholder="Örn: Pazartesi 09:00 - 12:00"
              value={form.schedule}
              onChange={(e) => setForm((prev) => ({ ...prev, schedule: e.target.value }))}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-on-surface-variant">Konum</label>
            <input
              className="w-full h-11 px-4 bg-surface-container-lowest border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              placeholder="Örn: Amfi A"
              value={form.location}
              onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4 border-t border-surface-container-high">
            <button
              type="button"
              onClick={() => navigate('/courses')}
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
              {busy ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : 'Dersi Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
