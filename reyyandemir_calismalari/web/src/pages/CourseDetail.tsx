import {
  ArrowLeft,
  Edit2,
  GraduationCap,
  Mail,
  MapPin,
  Plus,
  Play,
  Search,
  Trash2,
  UserPlus,
  Users,
  UserCheck,
  X,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import CameraCapture from '@/components/CameraCapture';
import ConfirmDialog from '@/components/ConfirmDialog';
import { EmptyState, PageError, PageLoading } from '@/components/LoadingState';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { buildPhotoUrl, extractErrorMessage } from '@/lib/api';
import {
  useAllStudents,
  useBranchStudents,
  useCourse,
  useCourseSessions,
  useCreateBranch,
  useDeleteBranch,
  useDeleteStudent,
  useEnrollStudent,
  useStartBranchSession,
  useUpdateBranch,
  useUpdateStudent,
} from '@/lib/queries';
import type { CourseBranch, Student } from '@/lib/types';

type Tab = 'students' | 'sessions';
type EnrollTab = 'existing' | 'new';

export default function CourseDetail() {
  const { courseId: courseIdRaw } = useParams<{ courseId: string }>();
  const courseId = Number(courseIdRaw);
  const navigate = useNavigate();
  const toast = useToast();

  const courseQuery = useCourse(courseId);
  const sessionsQuery = useCourseSessions(courseId);

  const [tab, setTab] = useState<Tab>('students');
  const [activeBranchId, setActiveBranchId] = useState<number | null>(null);

  const course = courseQuery.data;
  const branches: CourseBranch[] = course?.branches ?? [];

  const selectedBranchId = useMemo(() => {
    if (activeBranchId && branches.some((b) => b.id === activeBranchId)) return activeBranchId;
    return branches[0]?.id ?? null;
  }, [activeBranchId, branches]);

  const studentsQuery = useBranchStudents(selectedBranchId ?? undefined);
  const allStudentsQuery = useAllStudents();

  const createBranch = useCreateBranch(courseId);
  const updateBranch = useUpdateBranch(courseId);
  const deleteBranch = useDeleteBranch(courseId);
  const enrollStudent = useEnrollStudent(courseId);
  const updateStudent = useUpdateStudent();
  const deleteStudent = useDeleteStudent();
  const startSession = useStartBranchSession();

  // --- Branch modal state ---
  const [branchModal, setBranchModal] = useState<{ mode: 'create' | 'edit'; branch?: CourseBranch } | null>(null);
  const [branchCode, setBranchCode] = useState('');
  const [branchName, setBranchName] = useState('');
  const [branchToDelete, setBranchToDelete] = useState<CourseBranch | null>(null);

  // --- Enroll modal state ---
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [enrollTab, setEnrollTab] = useState<EnrollTab>('existing');
  const [enrollName, setEnrollName] = useState('');
  const [enrollNumber, setEnrollNumber] = useState('');
  const [enrollEmail, setEnrollEmail] = useState('');
  const [enrollPhoto, setEnrollPhoto] = useState<Blob | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  const branchCodeRef = useRef<HTMLInputElement>(null);

  if (!Number.isFinite(courseId)) return <PageError message="Geçersiz ders." />;
  if (courseQuery.isLoading) return <PageLoading label="Ders yükleniyor..." />;
  if (courseQuery.error || !course) {
    return (
      <PageError
        message={extractErrorMessage(courseQuery.error, 'Ders bulunamadı.')}
        onRetry={() => courseQuery.refetch()}
      />
    );
  }

  // ---- Branch handlers ----
  const openCreateBranch = () => {
    setBranchCode('');
    setBranchName('');
    setBranchModal({ mode: 'create' });
    // focus after mount
    setTimeout(() => branchCodeRef.current?.focus(), 50);
  };

  const openEditBranch = (b: CourseBranch) => {
    setBranchCode(b.code);
    setBranchName(b.name);
    setBranchModal({ mode: 'edit', branch: b });
    setTimeout(() => branchCodeRef.current?.focus(), 50);
  };

  const closeBranchModal = () => {
    if (createBranch.isPending || updateBranch.isPending) return;
    setBranchModal(null);
  };

  const submitBranch = async () => {
    const code = branchCode.trim();
    const name = branchName.trim();
    if (!code || !name) {
      toast.error('Şube kodu ve adı zorunludur.');
      return;
    }
    try {
      if (branchModal?.mode === 'create') {
        const created = await createBranch.mutateAsync({ code, name });
        setActiveBranchId(created.id);
        toast.success('Şube oluşturuldu.');
      } else if (branchModal?.branch) {
        await updateBranch.mutateAsync({ branchId: branchModal.branch.id, code, name });
        toast.success('Şube güncellendi.');
      }
      setBranchModal(null);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'İşlem başarısız.'));
    }
  };

  const handleDeleteBranch = async (b: CourseBranch) => {
    try {
      await deleteBranch.mutateAsync(b.id);
      toast.success('Şube silindi.');
      if (activeBranchId === b.id) setActiveBranchId(null);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Silinemedi.'));
    }
  };

  // ---- Enroll handlers ----
  const openEnrollModal = () => {
    setEnrollTab('existing');
    setEnrollName('');
    setEnrollNumber('');
    setEnrollEmail('');
    setEnrollPhoto(null);
    setStudentSearch('');
    allStudentsQuery.refetch();
    setEnrollModalOpen(true);
  };

  const handleEnrollExisting = async (s: Student) => {
    if (!selectedBranchId) { toast.error('Önce bir şube seçin.'); return; }
    try {
      await updateStudent.mutateAsync({ studentId: s.id, branch_id: selectedBranchId });
      await studentsQuery.refetch();
      toast.success(`${s.full_name} şubeye eklendi.`);
      setEnrollModalOpen(false);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Eklenemedi.'));
    }
  };

  const handleEnrollNew = async () => {
    if (!selectedBranchId) { toast.error('Önce bir şube seçin.'); return; }
    if (!enrollName.trim() || !enrollNumber.trim()) { toast.error('Ad ve numara zorunludur.'); return; }
    if (!enrollPhoto) { toast.error('Lütfen fotoğraf çekin.'); return; }
    try {
      await enrollStudent.mutateAsync({
        full_name: enrollName.trim(),
        student_number: enrollNumber.trim(),
        branch_id: selectedBranchId,
        email: enrollEmail.trim() || undefined,
        photo: enrollPhoto,
      });
      toast.success('Öğrenci kaydedildi.');
      setEnrollModalOpen(false);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Kayıt başarısız. Yüz tek ve net görünmeli.'));
    }
  };

  const handleDeleteStudent = async (s: Student) => {
    try {
      await deleteStudent.mutateAsync(s.id);
      toast.success('Öğrenci silindi.');
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Silinemedi.'));
    }
  };

  const handleStart = async () => {
    if (!selectedBranchId) { toast.error('Şube seçin.'); return; }
    try {
      const session = await startSession.mutateAsync(selectedBranchId);
      navigate(`/scanner/${session.id}`);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Oturum başlatılamadı.'));
    }
  };

  const sessions = sessionsQuery.data ?? [];
  const branchSessions = sessions.filter((s) => s.branch_id === selectedBranchId);
  const activeBranchSession = branchSessions.find((s) => s.status === 'active') ?? null;

  // Mevcut şubede olmayan, aynı dersteki öğrenciler
  const availableStudents = useMemo(() => {
    const all = allStudentsQuery.data ?? [];
    const currentIds = new Set((studentsQuery.data ?? []).map((s) => s.id));
    const q = studentSearch.trim().toLowerCase();
    return all.filter((s) => {
      if (s.course_id !== courseId) return false;
      if (currentIds.has(s.id)) return false;
      if (!q) return true;
      return (
        s.full_name.toLowerCase().includes(q) ||
        s.student_number.toLowerCase().includes(q) ||
        (s.branch_name?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [allStudentsQuery.data, studentsQuery.data, studentSearch, courseId]);

  const isBranchBusy = createBranch.isPending || updateBranch.isPending;

  return (
    <div className="px-4 md:px-8 max-w-[1280px] mx-auto w-full py-8">
      {/* Geri */}
      <button
        onClick={() => navigate('/courses')}
        className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Tüm dersler
      </button>

      {/* Başlık */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-primary-fixed rounded-xl flex items-center justify-center text-on-primary-fixed-variant shrink-0">
            <GraduationCap className="w-7 h-7" />
          </div>
          <div>
            <span className="font-label-md text-label-md text-primary">{course.code}</span>
            <h1 className="font-headline-xl text-headline-xl text-on-surface mt-1">{course.name}</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1 flex flex-wrap items-center gap-3">
              {course.schedule && <span>{course.schedule}</span>}
              {course.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" /> {course.location}
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => (activeBranchSession ? navigate(`/scanner/${activeBranchSession.id}`) : handleStart())}
          disabled={!selectedBranchId || startSession.isPending}
          className="bg-primary text-on-primary font-label-md text-label-md py-2.5 px-5 rounded-lg hover:bg-surface-tint transition-colors flex items-center gap-2 disabled:opacity-60"
        >
          <Play className="w-4 h-4" />
          {activeBranchSession ? 'Devam Et' : startSession.isPending ? 'Başlatılıyor...' : 'Yoklama Başlat'}
        </button>
      </div>

      {/* Şubeler */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wide">Şubeler</h3>
          <button
            onClick={openCreateBranch}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-surface-tint transition-colors"
          >
            <Plus className="w-4 h-4" /> Şube Ekle
          </button>
        </div>

        {branches.length === 0 ? (
          <p className="text-sm text-on-surface-variant py-1">
            Henüz şube yok.{' '}
            <button onClick={openCreateBranch} className="text-primary font-medium hover:underline">
              İlk şubeyi ekle
            </button>
          </p>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {branches.map((b) => {
              const active = b.id === selectedBranchId;
              return (
                <div
                  key={b.id}
                  className={`flex items-center rounded-full border overflow-hidden transition-colors ${
                    active ? 'border-primary bg-primary-container/40' : 'border-outline-variant bg-surface-container-low'
                  }`}
                >
                  <button
                    onClick={() => setActiveBranchId(b.id)}
                    className={`pl-3 pr-2 py-1.5 text-sm font-semibold flex items-center gap-1.5 ${
                      active ? 'text-on-primary-fixed-variant' : 'text-on-surface-variant'
                    }`}
                  >
                    <span>{b.code} · {b.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      active ? 'bg-primary/20 text-primary' : 'bg-surface-container text-on-surface-variant'
                    }`}>
                      {b.student_count}
                    </span>
                  </button>
                  <button
                    onClick={() => openEditBranch(b)}
                    className="px-1.5 py-1.5 text-on-surface-variant hover:text-on-surface transition-colors"
                    title="Düzenle"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setBranchToDelete(b)}
                    className="px-1.5 py-1.5 text-error hover:bg-error-container/30 transition-colors"
                    title="Sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sekmeler */}
      <div className="border-b border-outline-variant flex gap-4 mb-6">
        {(['students', 'sessions'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 font-label-md text-label-md transition-colors ${
              tab === t ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant'
            }`}
          >
            {t === 'students' ? 'Öğrenciler' : 'Oturumlar'}
          </button>
        ))}
      </div>

      {tab === 'students' ? (
        <StudentsList
          studentsQuery={studentsQuery}
          selectedBranchId={selectedBranchId}
          onAdd={openEnrollModal}
          onDelete={(s) => setStudentToDelete(s)}
        />
      ) : (
        <SessionsList
          sessionsLoading={sessionsQuery.isLoading}
          sessionsError={sessionsQuery.error}
          sessions={branchSessions}
          onOpen={(id) => navigate(`/history/${id}`)}
          onResume={(id) => navigate(`/scanner/${id}`)}
        />
      )}

      {/* ===== ŞUBE MODAL ===== */}
      <Modal
        open={!!branchModal}
        onClose={closeBranchModal}
        title={branchModal?.mode === 'create' ? 'Yeni Şube Ekle' : 'Şubeyi Düzenle'}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface-variant" htmlFor="branch-code">
              Şube Kodu <span className="text-error">*</span>
            </label>
            <input
              id="branch-code"
              ref={branchCodeRef}
              className="w-full h-11 px-4 bg-surface-container-lowest border border-outline-variant rounded-xl text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              placeholder="Örn: A, B, 101 ..."
              value={branchCode}
              onChange={(e) => setBranchCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitBranch(); }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface-variant" htmlFor="branch-name">
              Şube Adı <span className="text-error">*</span>
            </label>
            <input
              id="branch-name"
              className="w-full h-11 px-4 bg-surface-container-lowest border border-outline-variant rounded-xl text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              placeholder="Örn: A Şubesi, Grup 1 ..."
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitBranch(); }}
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-outline-variant/40">
            <button
              type="button"
              onClick={closeBranchModal}
              disabled={isBranchBusy}
              className="px-5 py-2.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low rounded-xl transition-colors disabled:opacity-50"
            >
              İptal
            </button>
            <button
              type="button"
              disabled={isBranchBusy || !branchCode.trim() || !branchName.trim()}
              onClick={submitBranch}
              className="px-5 py-2.5 text-sm font-medium bg-primary text-on-primary rounded-xl hover:bg-surface-tint transition-colors disabled:opacity-50 shadow-sm min-w-[100px]"
            >
              {isBranchBusy ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ===== ÖĞRENCİ EKLE MODAL ===== */}
      <Modal
        open={enrollModalOpen}
        onClose={() => { if (!enrollStudent.isPending && !updateStudent.isPending) setEnrollModalOpen(false); }}
        title="Öğrenci Ekle"
        maxWidth="max-w-2xl"
      >
        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-surface-container rounded-xl mb-5">
          {([['existing', 'Mevcut Öğrenci'], ['new', 'Yeni Öğrenci']] as [EnrollTab, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setEnrollTab(key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                enrollTab === key
                  ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {key === 'existing' ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {label}
            </button>
          ))}
        </div>

        {/* Hedef şube */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-container/20 border border-primary/20 text-on-primary-fixed-variant text-sm mb-5">
          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
          Hedef şube: <strong>{branches.find((b) => b.id === selectedBranchId)?.name ?? '—'}</strong>
        </div>

        {enrollTab === 'existing' ? (
          <ExistingStudentPicker
            students={availableStudents}
            isLoading={allStudentsQuery.isLoading}
            isAdding={updateStudent.isPending}
            search={studentSearch}
            onSearchChange={setStudentSearch}
            onSelect={handleEnrollExisting}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Ad Soyad <span className="text-error">*</span></label>
              <input
                className="w-full h-11 px-4 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="Örn: Ayşe Yılmaz"
                value={enrollName}
                onChange={(e) => setEnrollName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Öğrenci Numarası <span className="text-error">*</span></label>
              <input
                className="w-full h-11 px-4 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="Örn: 202104012"
                value={enrollNumber}
                onChange={(e) => setEnrollNumber(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">E-posta <span className="text-on-surface-variant/50">(opsiyonel)</span></label>
              <input
                type="email"
                className="w-full h-11 px-4 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="ayse.yilmaz@uni.edu"
                value={enrollEmail}
                onChange={(e) => setEnrollEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Yüz Fotoğrafı <span className="text-error">*</span></label>
              <p className="text-xs text-on-surface-variant">Yüz tanıma için zorunlu. Tek ve net yüz görünmeli.</p>
              <CameraCapture onCapture={(blob) => setEnrollPhoto(blob)} />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-outline-variant/40">
              <button
                type="button"
                onClick={() => setEnrollModalOpen(false)}
                className="px-5 py-2.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low rounded-xl transition-colors"
              >
                İptal
              </button>
              <button
                type="button"
                disabled={enrollStudent.isPending || !enrollPhoto || !enrollName.trim() || !enrollNumber.trim()}
                onClick={handleEnrollNew}
                className="px-5 py-2.5 text-sm font-medium bg-primary text-on-primary rounded-xl hover:bg-surface-tint transition-colors disabled:opacity-50 shadow-sm"
              >
                {enrollStudent.isPending ? 'Kaydediliyor...' : 'Öğrenciyi Kaydet'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Şube sil onayı */}
      <ConfirmDialog
        open={!!branchToDelete}
        title="Şubeyi Sil"
        message={branchToDelete ? `"${branchToDelete.name}" şubesi ve içindeki tüm öğrenciler/oturumlar silinecek. Bu işlem geri alınamaz.` : ''}
        destructive
        confirmLabel="Evet, Sil"
        onConfirm={async () => { if (branchToDelete) { await handleDeleteBranch(branchToDelete); setBranchToDelete(null); } }}
        onClose={() => !deleteBranch.isPending && setBranchToDelete(null)}
      />

      {/* Öğrenci sil onayı */}
      <ConfirmDialog
        open={!!studentToDelete}
        title="Öğrenciyi Sil"
        message={studentToDelete ? `"${studentToDelete.full_name}" öğrencisi ve tüm yoklama kayıtları silinecek.` : ''}
        destructive
        confirmLabel="Evet, Sil"
        onConfirm={async () => { if (studentToDelete) { await handleDeleteStudent(studentToDelete); setStudentToDelete(null); } }}
        onClose={() => !deleteStudent.isPending && setStudentToDelete(null)}
      />
    </div>
  );
}

// ─── Alt bileşenler ───────────────────────────────────────────────────────────

function ExistingStudentPicker({
  students, isLoading, isAdding, search, onSearchChange, onSelect,
}: {
  students: Student[];
  isLoading: boolean;
  isAdding: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  onSelect: (s: Student) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
        <input
          autoFocus
          className="w-full h-11 pl-10 pr-4 bg-surface-container-lowest border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
          placeholder="İsim veya numara ile ara..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-sm text-on-surface-variant">Yükleniyor...</div>
      ) : students.length === 0 ? (
        <div className="py-10 text-center text-sm text-on-surface-variant">
          {search.trim() ? 'Eşleşen öğrenci bulunamadı.' : 'Bu dersin diğer şubelerinde aktarılabilecek öğrenci yok.'}
        </div>
      ) : (
        <ul className="divide-y divide-outline-variant/50 max-h-[52vh] overflow-y-auto rounded-xl border border-outline-variant">
          {students.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors">
              {s.photo_path ? (
                <img src={buildPhotoUrl(s.photo_path) ?? ''} alt={s.full_name}
                  className="w-9 h-9 rounded-full object-cover border border-outline-variant shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed text-xs font-bold shrink-0">
                  {s.full_name.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-on-surface truncate">{s.full_name}</p>
                <p className="text-xs text-on-surface-variant truncate">
                  #{s.student_number}{s.branch_name ? ` · ${s.branch_name}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={isAdding}
                onClick={() => onSelect(s)}
                className="shrink-0 px-3 py-1.5 bg-primary text-on-primary text-xs font-semibold rounded-lg hover:bg-surface-tint transition-colors disabled:opacity-60"
              >
                {isAdding ? '...' : 'Ekle'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StudentsList({
  studentsQuery, selectedBranchId, onAdd, onDelete,
}: {
  studentsQuery: ReturnType<typeof useBranchStudents>;
  selectedBranchId: number | null;
  onAdd: () => void;
  onDelete: (s: Student) => void;
}) {
  if (!selectedBranchId) return <EmptyState title="Şube seçin" description="Bu derste önce bir şube oluşturun." />;
  if (studentsQuery.isLoading) return <PageLoading label="Öğrenciler yükleniyor..." />;
  if (studentsQuery.error) return (
    <PageError message={extractErrorMessage(studentsQuery.error, 'Öğrenciler alınamadı.')} onRetry={() => studentsQuery.refetch()} />
  );

  const students = studentsQuery.data ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
          <Users className="w-5 h-5" /> {students.length} Öğrenci
        </h3>
        <button
          onClick={onAdd}
          className="bg-primary text-on-primary rounded-lg px-4 py-2 font-label-md text-label-md hover:bg-surface-tint transition-colors flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" /> Öğrenci Ekle
        </button>
      </div>

      {students.length === 0 ? (
        <EmptyState title="Bu şubede öğrenci yok" description="Yüz tanıma için her öğrenci için tek yüz içeren net bir fotoğraf çekin." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {students.map((s) => (
            <article key={s.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start gap-3">
                {s.photo_path ? (
                  <img alt={s.full_name} src={buildPhotoUrl(s.photo_path) ?? ''}
                    className="w-12 h-12 rounded-full object-cover border border-outline-variant shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-surface-container-highest border border-outline-variant flex items-center justify-center text-on-surface-variant font-semibold text-sm shrink-0">
                    {s.full_name.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-on-surface text-sm truncate">{s.full_name}</h4>
                  <p className="text-xs text-on-surface-variant truncate">No: {s.student_number}</p>
                  {s.email && (
                    <p className="flex items-center gap-1 mt-0.5 text-on-surface-variant">
                      <Mail className="w-3 h-3 shrink-0" />
                      <span className="text-xs truncate">{s.email}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mt-auto pt-2 border-t border-outline-variant/40">
                <span className="text-xs text-on-surface-variant">Katılım: %{s.attendance_rate.toFixed(0)}</span>
                <button onClick={() => onDelete(s)} className="text-error hover:bg-error-container/30 rounded p-1.5 transition-colors" title="Sil">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionsList({
  sessionsLoading, sessionsError, sessions, onOpen, onResume,
}: {
  sessionsLoading: boolean;
  sessionsError: unknown;
  sessions: Array<{ id: number; status: string; started_at: string; ended_at: string | null; present_count: number; total_count: number }>;
  onOpen: (id: number) => void;
  onResume: (id: number) => void;
}) {
  if (sessionsLoading) return <PageLoading label="Oturumlar yükleniyor..." />;
  if (sessionsError) return <PageError message={extractErrorMessage(sessionsError, 'Oturumlar alınamadı.')} />;
  if (sessions.length === 0) return (
    <EmptyState title="Bu şubede oturum yok" description="'Yoklama Başlat' düğmesi ile ilk oturumu başlatabilirsiniz." />
  );

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden divide-y divide-outline-variant/60">
      {sessions.map((s) => {
        const date = new Date(s.started_at);
        const dateStr = date.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
        const total = s.total_count || s.present_count;
        const rate = total > 0 ? Math.round((s.present_count / total) * 100) : 0;
        return (
          <button
            key={s.id}
            onClick={() => s.status === 'active' ? onResume(s.id) : onOpen(s.id)}
            className="w-full flex items-center justify-between p-4 hover:bg-surface-container-low transition-colors text-left"
          >
            <div>
              <p className="font-label-md text-label-md text-on-surface">{dateStr}</p>
              <p className="text-sm text-on-surface-variant">{s.present_count}/{total} katılım · %{rate}</p>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              s.status === 'active'
                ? 'bg-error-container text-on-error-container'
                : 'bg-secondary-container/40 text-on-secondary-fixed-variant'
            }`}>
              {s.status === 'active' ? 'Devam Ediyor' : 'Tamamlandı'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
