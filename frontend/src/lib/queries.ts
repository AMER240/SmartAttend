/**
 * SmartAttend – React Query hooks.
 *
 * This file is the *adapter layer* between the React UI (which was
 * originally written for a richer backend with auth/branches/teachers)
 * and our simplified spec-compliant FastAPI backend (4 tables: students,
 * courses, sessions, attendance_log).
 *
 * Translation rules used throughout this file:
 *
 *   • Branches do not exist on the backend. We expose a single virtual
 *     "Genel / A" branch per course, with `branch_id == course_id`.
 *
 *   • Backend Student PK is a string (e.g. "2021001"). React expects a
 *     numeric `id` plus a separate `student_number`. We map
 *         student_id (str) <-> id (number) + student_number (str).
 *
 *   • Backend Session has `session_id`, `course_id`, `session_date`,
 *     `is_active`. React expects `id`, `branch_id`, `course_id`,
 *     `started_at`, `ended_at`, `status`, plus precomputed counts.
 *
 *   • Backend AttendanceLog status is 'Present' / 'Absent'. React
 *     types accept 'present' / 'absent' / 'late' (lowercase).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from './api';
import type {
  Attendance,
  AttendanceStatus,
  ClassSession,
  Course,
  CourseBranch,
  RecognizeResult,
  Student,
  Teacher,
} from './types';

// ---------------------------------------------------------------------------
// Backend DTOs (raw shapes returned by FastAPI). Kept private to this file.
// ---------------------------------------------------------------------------

type BackendStudent = {
  student_id: string;
  full_name: string;
  has_face_encoding: boolean;
};

type BackendCourse = {
  course_id: number;
  course_name: string;
  course_code: string;
};

type BackendSession = {
  session_id: number;
  course_id: number;
  session_date: string; // YYYY-MM-DD
  is_active: boolean;
};

type BackendAttendanceLog = {
  log_id: number;
  session_id: number;
  student_id: string;
  full_name: string | null;
  status: 'Present' | 'Absent' | string;
  check_in_time: string | null;
};

type BackendLiveMatchResult = {
  matched: boolean;
  student_id: string | null;
  full_name: string | null;
  distance: number | null;
  message: string;
};

// ---------------------------------------------------------------------------
// Tiny utilities for the string<->number ID translation
// ---------------------------------------------------------------------------

function studentIdToNumber(studentId: string): number {
  const n = Number(studentId);
  if (Number.isFinite(n)) return n;
  // Fallback: deterministic 32-bit hash so non-numeric IDs still get a stable id
  let h = 0;
  for (let i = 0; i < studentId.length; i += 1) {
    h = (h * 31 + studentId.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const studentIdMap = new Map<number, string>();
function rememberStudentId(numericId: number, stringId: string) {
  studentIdMap.set(numericId, stringId);
}
function resolveStudentId(numericId: number): string {
  return studentIdMap.get(numericId) ?? String(numericId);
}

// ---------------------------------------------------------------------------
// Mappers: backend -> React shapes
// ---------------------------------------------------------------------------

function virtualBranch(course: BackendCourse, studentCount = 0): CourseBranch {
  return {
    id: course.course_id, // branch_id == course_id (1:1 virtual branch)
    name: 'Genel',
    code: 'A',
    course_id: course.course_id,
    created_at: new Date(0).toISOString(),
    student_count: studentCount,
  };
}

function mapCourse(c: BackendCourse, studentCount = 0, sessionCount = 0): Course {
  return {
    id: c.course_id,
    name: c.course_name,
    code: c.course_code,
    schedule: '',
    location: '',
    teacher_id: 1,
    created_at: new Date(0).toISOString(),
    student_count: studentCount,
    session_count: sessionCount,
    branches: [virtualBranch(c, studentCount)],
  };
}

function mapStudent(s: BackendStudent, course?: BackendCourse): Student {
  const id = studentIdToNumber(s.student_id);
  rememberStudentId(id, s.student_id);
  return {
    id,
    full_name: s.full_name,
    student_number: s.student_id,
    email: null,
    course_id: course?.course_id ?? 0,
    branch_id: course?.course_id ?? 0,
    photo_path: null,
    has_face_encoding: s.has_face_encoding,
    created_at: new Date(0).toISOString(),
    branch_name: course ? 'Genel' : null,
    branch_code: course ? 'A' : null,
    course_name: course?.course_name ?? null,
    course_code: course?.course_code ?? null,
    total_absences: 0,
    attendance_rate: 0,
  };
}

function mapAttendanceLog(a: BackendAttendanceLog): Attendance {
  const id = studentIdToNumber(a.student_id);
  rememberStudentId(id, a.student_id);
  const status = (a.status || '').toLowerCase();
  const reactStatus: AttendanceStatus =
    status === 'present' ? 'present' : status === 'late' ? 'late' : 'absent';
  return {
    id: a.log_id,
    session_id: a.session_id,
    student_id: id,
    status: reactStatus,
    auto_detected: !!a.check_in_time && reactStatus === 'present',
    marked_at: a.check_in_time ?? new Date(0).toISOString(),
    student_name: a.full_name ?? a.student_id,
    student_number: a.student_id,
  };
}

async function mapSession(
  s: BackendSession,
  courses: BackendCourse[],
): Promise<ClassSession> {
  const course = courses.find((c) => c.course_id === s.course_id);

  // Counts come from the per-session attendance log endpoint.
  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let totalCount = 0;
  try {
    const log = await apiRequest<BackendAttendanceLog[]>(
      `/sessions/${s.session_id}/log`,
    );
    totalCount = log.length;
    for (const row of log) {
      const status = (row.status || '').toLowerCase();
      if (status === 'present') presentCount += 1;
      else if (status === 'late') lateCount += 1;
      else absentCount += 1;
    }
  } catch {
    // Session might not have any log rows yet – leave counts at 0.
  }

  return {
    id: s.session_id,
    course_id: s.course_id,
    branch_id: s.course_id, // virtual branch == course
    status: s.is_active ? 'active' : 'ended',
    started_at: `${s.session_date}T00:00:00`,
    ended_at: s.is_active ? null : `${s.session_date}T23:59:59`,
    present_count: presentCount,
    absent_count: absentCount,
    late_count: lateCount,
    total_count: totalCount,
    course_name: course?.course_name ?? null,
    course_code: course?.course_code ?? null,
    branch_name: course ? 'Genel' : null,
    branch_code: course ? 'A' : null,
  };
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const qk = {
  me: ['me'] as const,
  courses: ['courses'] as const,
  course: (id: number) => ['courses', id] as const,
  branches: (courseId: number) => ['courses', courseId, 'branches'] as const,
  branchStudents: (branchId: number) => ['branches', branchId, 'students'] as const,
  branchSessions: (branchId: number) => ['branches', branchId, 'sessions'] as const,
  courseStudents: (courseId: number) => ['courses', courseId, 'students'] as const,
  courseSessions: (courseId: number) => ['courses', courseId, 'sessions'] as const,
  allStudents: ['students'] as const,
  allSessions: ['sessions'] as const,
  activeSessions: ['sessions', 'active'] as const,
  session: (id: number) => ['sessions', id] as const,
  attendance: (sessionId: number) => ['sessions', sessionId, 'attendance'] as const,
};

// ---------------------------------------------------------------------------
// Auth – backend has none, so we synthesise a fake "me" response.
// ---------------------------------------------------------------------------

export function useMe(enabled = true) {
  return useQuery({
    queryKey: qk.me,
    queryFn: async (): Promise<Teacher> => ({
      id: 1,
      email: 'demo@smartattend.local',
      name: 'Demo Hoca',
      created_at: new Date().toISOString(),
    }),
    enabled,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export function useCourses() {
  return useQuery({
    queryKey: qk.courses,
    queryFn: async (): Promise<Course[]> => {
      const [courses, students, sessions] = await Promise.all([
        apiRequest<BackendCourse[]>('/courses/'),
        apiRequest<BackendStudent[]>('/students/').catch(() => []),
        apiRequest<BackendSession[]>('/sessions/').catch(() => []),
      ]);
      // Without a foreign key on Student->Course, every student counts for
      // every course. This is a limitation of the simplified spec.
      const totalStudents = students.length;
      return courses.map((c) =>
        mapCourse(
          c,
          totalStudents,
          sessions.filter((s) => s.course_id === c.course_id).length,
        ),
      );
    },
  });
}

export function useCourse(id: number | undefined) {
  return useQuery({
    queryKey: qk.course(id ?? 0),
    queryFn: async (): Promise<Course> => {
      const [course, students, sessions] = await Promise.all([
        apiRequest<BackendCourse>(`/courses/${id}`),
        apiRequest<BackendStudent[]>('/students/').catch(() => []),
        apiRequest<BackendSession[]>('/sessions/').catch(() => []),
      ]);
      return mapCourse(
        course,
        students.length,
        sessions.filter((s) => s.course_id === course.course_id).length,
      );
    },
    enabled: !!id && Number.isFinite(id),
  });
}

export function useCreateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      code: string;
      schedule: string;
      location: string;
    }): Promise<Course> => {
      const created = await apiRequest<BackendCourse>('/courses/', {
        method: 'POST',
        body: { course_name: payload.name, course_code: payload.code },
      });
      return mapCourse(created);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.courses }),
  });
}

export function useUpdateCourse(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_payload: {
      name?: string;
      code?: string;
      schedule?: string;
      location?: string;
    }): Promise<Course> => {
      // Backend does not currently support PATCH /courses/:id. Return the
      // current version so callers' .onSuccess() still fires.
      const current = await apiRequest<BackendCourse>(`/courses/${id}`);
      return mapCourse(current);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.courses });
      qc.invalidateQueries({ queryKey: qk.course(id) });
    },
  });
}

export function useDeleteCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiRequest<void>(`/courses/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.courses }),
  });
}

// ---------------------------------------------------------------------------
// Branches – stubbed (each course has one virtual "Genel / A" branch)
// ---------------------------------------------------------------------------

export function useBranches(courseId: number | undefined) {
  return useQuery({
    queryKey: qk.branches(courseId ?? 0),
    queryFn: async (): Promise<CourseBranch[]> => {
      if (!courseId) return [];
      const [course, students] = await Promise.all([
        apiRequest<BackendCourse>(`/courses/${courseId}`),
        apiRequest<BackendStudent[]>('/students/').catch(() => []),
      ]);
      return [virtualBranch(course, students.length)];
    },
    enabled: !!courseId && Number.isFinite(courseId),
  });
}

export function useCreateBranch(_courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_payload: { name: string; code: string }): Promise<CourseBranch> => {
      throw new Error(
        'Bu sürümde her ders için tek bir varsayılan şube vardır. Yeni şube ekleyemezsiniz.',
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.courses }),
  });
}

export function useUpdateBranch(_courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_payload: {
      branchId: number;
      name?: string;
      code?: string;
    }): Promise<CourseBranch> => {
      throw new Error('Şube düzenleme bu sürümde desteklenmiyor.');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.courses }),
  });
}

export function useDeleteBranch(_courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_branchId: number): Promise<void> => {
      throw new Error('Şube silme bu sürümde desteklenmiyor.');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.courses }),
  });
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

export function useAllStudents() {
  return useQuery({
    queryKey: qk.allStudents,
    queryFn: async (): Promise<Student[]> => {
      const list = await apiRequest<BackendStudent[]>('/students/');
      return list.map((s) => mapStudent(s));
    },
  });
}

export function useCourseStudents(courseId: number | undefined) {
  return useQuery({
    queryKey: qk.courseStudents(courseId ?? 0),
    queryFn: async (): Promise<Student[]> => {
      // Backend has no per-course enrollment, so all students belong to all
      // courses in this simplified model.
      const [list, course] = await Promise.all([
        apiRequest<BackendStudent[]>('/students/'),
        courseId
          ? apiRequest<BackendCourse>(`/courses/${courseId}`).catch(() => undefined)
          : Promise.resolve(undefined),
      ]);
      return list.map((s) => mapStudent(s, course ?? undefined));
    },
    enabled: !!courseId && Number.isFinite(courseId),
  });
}

export function useBranchStudents(branchId: number | undefined) {
  // branch_id == course_id in this simplified model.
  return useCourseStudents(branchId);
}

export function useEnrollStudent(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      full_name: string;
      student_number: string;
      branch_id: number;
      email?: string;
      photo: Blob;
    }): Promise<Student> => {
      const form = new FormData();
      form.append('student_id', payload.student_number);
      form.append('full_name', payload.full_name);
      form.append('photo', payload.photo, 'enrollment.jpg');
      const created = await apiRequest<BackendStudent>('/students/', { formData: form });
      const course = await apiRequest<BackendCourse>(`/courses/${courseId}`).catch(
        () => undefined,
      );
      return mapStudent(created, course ?? undefined);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      qc.invalidateQueries({ queryKey: qk.courseStudents(courseId) });
      qc.invalidateQueries({ queryKey: qk.allStudents });
      qc.invalidateQueries({ queryKey: qk.courses });
      qc.invalidateQueries({ queryKey: qk.course(courseId) });
    },
  });
}

export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_payload: {
      studentId: number;
      full_name?: string;
      student_number?: string;
      email?: string | null;
      branch_id?: number;
    }): Promise<Student> => {
      throw new Error('Öğrenci düzenleme bu sürümde desteklenmiyor.');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.allStudents });
    },
  });
}

export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (studentId: number) => {
      const stringId = resolveStudentId(studentId);
      return apiRequest<void>(`/students/${stringId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.allStudents });
      qc.invalidateQueries({ queryKey: qk.courses });
    },
  });
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export function useAllSessions() {
  return useQuery({
    queryKey: qk.allSessions,
    queryFn: async (): Promise<ClassSession[]> => {
      const [sessions, courses] = await Promise.all([
        apiRequest<BackendSession[]>('/sessions/'),
        apiRequest<BackendCourse[]>('/courses/'),
      ]);
      return Promise.all(sessions.map((s) => mapSession(s, courses)));
    },
  });
}

export function useActiveSessions() {
  return useQuery({
    queryKey: qk.activeSessions,
    queryFn: async (): Promise<ClassSession[]> => {
      const [sessions, courses] = await Promise.all([
        apiRequest<BackendSession[]>('/sessions/active'),
        apiRequest<BackendCourse[]>('/courses/'),
      ]);
      return Promise.all(sessions.map((s) => mapSession(s, courses)));
    },
    refetchInterval: 30_000,
  });
}

export function useCourseSessions(courseId: number | undefined) {
  return useQuery({
    queryKey: qk.courseSessions(courseId ?? 0),
    queryFn: async (): Promise<ClassSession[]> => {
      const [sessions, courses] = await Promise.all([
        apiRequest<BackendSession[]>('/sessions/'),
        apiRequest<BackendCourse[]>('/courses/'),
      ]);
      const filtered = sessions.filter((s) => s.course_id === courseId);
      return Promise.all(filtered.map((s) => mapSession(s, courses)));
    },
    enabled: !!courseId && Number.isFinite(courseId),
  });
}

export function useBranchSessions(branchId: number | undefined) {
  return useCourseSessions(branchId);
}

export function useStartBranchSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (branchId: number): Promise<ClassSession> => {
      const created = await apiRequest<BackendSession>('/sessions/start', {
        method: 'POST',
        body: { course_id: branchId },
      });
      const courses = await apiRequest<BackendCourse[]>('/courses/').catch(() => []);
      return mapSession(created, courses);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.branchSessions(data.branch_id) });
      qc.invalidateQueries({ queryKey: qk.courseSessions(data.course_id) });
      qc.invalidateQueries({ queryKey: qk.allSessions });
      qc.invalidateQueries({ queryKey: qk.activeSessions });
    },
  });
}

export function useEndSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: number): Promise<ClassSession> => {
      const ended = await apiRequest<BackendSession>(
        `/sessions/end/${sessionId}`,
        { method: 'POST' },
      );
      const courses = await apiRequest<BackendCourse[]>('/courses/').catch(() => []);
      return mapSession(ended, courses);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.session(data.id) });
      qc.invalidateQueries({ queryKey: qk.branchSessions(data.branch_id) });
      qc.invalidateQueries({ queryKey: qk.courseSessions(data.course_id) });
      qc.invalidateQueries({ queryKey: qk.allSessions });
      qc.invalidateQueries({ queryKey: qk.activeSessions });
    },
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: number) =>
      apiRequest<void>(`/sessions/${sessionId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.allSessions });
      qc.invalidateQueries({ queryKey: qk.activeSessions });
    },
  });
}

export function useSession(sessionId: number | undefined) {
  return useQuery({
    queryKey: qk.session(sessionId ?? 0),
    queryFn: async (): Promise<ClassSession> => {
      const [session, courses] = await Promise.all([
        apiRequest<BackendSession>(`/sessions/${sessionId}`),
        apiRequest<BackendCourse[]>('/courses/').catch(() => []),
      ]);
      return mapSession(session, courses);
    },
    enabled: !!sessionId && Number.isFinite(sessionId),
  });
}

export function useAttendance(
  sessionId: number | undefined,
  opts?: { refetchInterval?: number },
) {
  return useQuery({
    queryKey: qk.attendance(sessionId ?? 0),
    queryFn: async (): Promise<Attendance[]> => {
      const log = await apiRequest<BackendAttendanceLog[]>(
        `/sessions/${sessionId}/log`,
      );
      return log.map(mapAttendanceLog);
    },
    enabled: !!sessionId && Number.isFinite(sessionId),
    refetchInterval: opts?.refetchInterval,
  });
}

export function useUpdateAttendance(sessionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      attendanceId: number;
      status: AttendanceStatus;
    }): Promise<Attendance> => {
      const updated = await apiRequest<BackendAttendanceLog>(
        `/attendance/${payload.attendanceId}`,
        { method: 'PATCH', body: { status: payload.status } },
      );
      return mapAttendanceLog(updated);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.attendance(sessionId) });
      qc.invalidateQueries({ queryKey: qk.session(sessionId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Recognition – translate to our /attendance/live_match contract.
// ---------------------------------------------------------------------------

export async function recognizeFrame(
  sessionId: number,
  frame: Blob,
): Promise<RecognizeResult> {
  const form = new FormData();
  form.append('session_id', String(sessionId));
  form.append('frame', frame, 'frame.jpg');
  const result = await apiRequest<BackendLiveMatchResult>(
    '/attendance/live_match',
    { formData: form },
  );

  if (result.matched && result.student_id) {
    const numericId = studentIdToNumber(result.student_id);
    rememberStudentId(numericId, result.student_id);
    return {
      detected_faces: 1,
      matched_student_ids: [numericId],
      newly_marked: [numericId],
    };
  }

  // Heuristic: treat "Face detected but no matching student" as a detected
  // face (so the UI can show 1 detected even when there's no match).
  const sawFace = (result.message || '').toLowerCase().includes('face detected');
  return {
    detected_faces: sawFace ? 1 : 0,
    matched_student_ids: [],
    newly_marked: [],
  };
}
