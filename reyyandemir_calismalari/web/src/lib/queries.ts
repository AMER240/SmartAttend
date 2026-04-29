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

export function useMe(enabled = true) {
  return useQuery({
    queryKey: qk.me,
    queryFn: () => apiRequest<Teacher>('/auth/me'),
    enabled,
    staleTime: 60_000,
  });
}

export function useCourses() {
  return useQuery({
    queryKey: qk.courses,
    queryFn: () => apiRequest<Course[]>('/courses'),
  });
}

export function useCourse(id: number | undefined) {
  return useQuery({
    queryKey: qk.course(id ?? 0),
    queryFn: () => apiRequest<Course>(`/courses/${id}`),
    enabled: !!id && Number.isFinite(id),
  });
}

export function useCreateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; code: string; schedule: string; location: string }) =>
      apiRequest<Course>('/courses', { method: 'POST', body: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.courses }),
  });
}

export function useUpdateCourse(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name?: string; code?: string; schedule?: string; location?: string }) =>
      apiRequest<Course>(`/courses/${id}`, { method: 'PATCH', body: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.courses });
      qc.invalidateQueries({ queryKey: qk.course(id) });
    },
  });
}

export function useDeleteCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiRequest<void>(`/courses/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.courses }),
  });
}

export function useBranches(courseId: number | undefined) {
  return useQuery({
    queryKey: qk.branches(courseId ?? 0),
    queryFn: () => apiRequest<CourseBranch[]>(`/courses/${courseId}/branches`),
    enabled: !!courseId && Number.isFinite(courseId),
  });
}

export function useCreateBranch(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; code: string }) =>
      apiRequest<CourseBranch>(`/courses/${courseId}/branches`, { method: 'POST', body: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.branches(courseId) });
      qc.invalidateQueries({ queryKey: qk.course(courseId) });
      qc.invalidateQueries({ queryKey: qk.courses });
    },
  });
}

export function useUpdateBranch(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { branchId: number; name?: string; code?: string }) =>
      apiRequest<CourseBranch>(`/courses/${courseId}/branches/${payload.branchId}`, {
        method: 'PATCH',
        body: { name: payload.name, code: payload.code },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.branches(courseId) });
      qc.invalidateQueries({ queryKey: ['branches'] });
      qc.invalidateQueries({ queryKey: qk.course(courseId) });
      qc.invalidateQueries({ queryKey: qk.courses });
    },
  });
}

export function useDeleteBranch(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (branchId: number) =>
      apiRequest<void>(`/courses/${courseId}/branches/${branchId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.branches(courseId) });
      qc.invalidateQueries({ queryKey: ['branches'] });
      qc.invalidateQueries({ queryKey: qk.course(courseId) });
      qc.invalidateQueries({ queryKey: qk.courses });
    },
  });
}

export function useAllStudents() {
  return useQuery({
    queryKey: qk.allStudents,
    queryFn: () => apiRequest<Student[]>('/students'),
  });
}

export function useCourseStudents(courseId: number | undefined) {
  return useQuery({
    queryKey: qk.courseStudents(courseId ?? 0),
    queryFn: () => apiRequest<Student[]>(`/courses/${courseId}/students`),
    enabled: !!courseId && Number.isFinite(courseId),
  });
}

export function useBranchStudents(branchId: number | undefined) {
  return useQuery({
    queryKey: qk.branchStudents(branchId ?? 0),
    queryFn: () => apiRequest<Student[]>(`/branches/${branchId}/students`),
    enabled: !!branchId && Number.isFinite(branchId),
  });
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
    }) => {
      const form = new FormData();
      form.append('full_name', payload.full_name);
      form.append('student_number', payload.student_number);
      form.append('branch_id', String(payload.branch_id));
      if (payload.email) form.append('email', payload.email);
      form.append('photo', payload.photo, 'enrollment.jpg');
      return apiRequest<Student>(`/courses/${courseId}/students`, { formData: form });
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
    mutationFn: (payload: {
      studentId: number;
      full_name?: string;
      student_number?: string;
      email?: string | null;
      branch_id?: number;
    }) => {
      const { studentId, ...body } = payload;
      return apiRequest<Student>(`/students/${studentId}`, { method: 'PATCH', body });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.allStudents });
      qc.invalidateQueries({ queryKey: ['branches'] });
      if (data.branch_id) {
        qc.invalidateQueries({ queryKey: qk.branchStudents(data.branch_id) });
      }
    },
  });
}

export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (studentId: number) =>
      apiRequest<void>(`/students/${studentId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      qc.invalidateQueries({ queryKey: ['courses'] });
      qc.invalidateQueries({ queryKey: qk.allStudents });
    },
  });
}

export function useAllSessions() {
  return useQuery({
    queryKey: qk.allSessions,
    queryFn: () => apiRequest<ClassSession[]>('/sessions'),
  });
}

export function useActiveSessions() {
  return useQuery({
    queryKey: qk.activeSessions,
    queryFn: () => apiRequest<ClassSession[]>('/sessions/active'),
    refetchInterval: 30_000,
  });
}

export function useCourseSessions(courseId: number | undefined) {
  return useQuery({
    queryKey: qk.courseSessions(courseId ?? 0),
    queryFn: () => apiRequest<ClassSession[]>(`/courses/${courseId}/sessions`),
    enabled: !!courseId && Number.isFinite(courseId),
  });
}

export function useBranchSessions(branchId: number | undefined) {
  return useQuery({
    queryKey: qk.branchSessions(branchId ?? 0),
    queryFn: () => apiRequest<ClassSession[]>(`/branches/${branchId}/sessions`),
    enabled: !!branchId && Number.isFinite(branchId),
  });
}

export function useStartBranchSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (branchId: number) =>
      apiRequest<ClassSession>(`/branches/${branchId}/sessions`, { method: 'POST' }),
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
    mutationFn: (sessionId: number) =>
      apiRequest<ClassSession>(`/sessions/${sessionId}/end`, { method: 'POST' }),
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
    queryFn: () => apiRequest<ClassSession>(`/sessions/${sessionId}`),
    enabled: !!sessionId && Number.isFinite(sessionId),
  });
}

export function useAttendance(sessionId: number | undefined, opts?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: qk.attendance(sessionId ?? 0),
    queryFn: () => apiRequest<Attendance[]>(`/sessions/${sessionId}/attendance`),
    enabled: !!sessionId && Number.isFinite(sessionId),
    refetchInterval: opts?.refetchInterval,
  });
}

export function useUpdateAttendance(sessionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { attendanceId: number; status: AttendanceStatus }) =>
      apiRequest<Attendance>(`/attendance/${payload.attendanceId}`, {
        method: 'PATCH',
        body: { status: payload.status },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.attendance(sessionId) });
      qc.invalidateQueries({ queryKey: qk.session(sessionId) });
    },
  });
}

export async function recognizeFrame(sessionId: number, frame: Blob): Promise<RecognizeResult> {
  const form = new FormData();
  form.append('frame', frame, 'frame.jpg');
  return apiRequest<RecognizeResult>(`/sessions/${sessionId}/recognize`, { formData: form });
}
