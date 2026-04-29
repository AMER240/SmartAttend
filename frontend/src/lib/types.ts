export type Teacher = {
  id: number;
  email: string;
  name: string;
  created_at: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  teacher: Teacher;
};

export type CourseBranch = {
  id: number;
  name: string;
  code: string;
  course_id: number;
  created_at: string;
  student_count: number;
};

export type Course = {
  id: number;
  name: string;
  code: string;
  schedule: string;
  location: string;
  teacher_id: number;
  created_at: string;
  student_count: number;
  session_count: number;
  branches: CourseBranch[];
};

export type Student = {
  id: number;
  full_name: string;
  student_number: string;
  email: string | null;
  course_id: number;
  branch_id: number;
  photo_path: string | null;
  has_face_encoding: boolean;
  created_at: string;
  branch_name: string | null;
  branch_code: string | null;
  course_name: string | null;
  course_code: string | null;
  total_absences: number;
  attendance_rate: number;
};

export type SessionStatus = 'active' | 'ended';

export type ClassSession = {
  id: number;
  course_id: number;
  branch_id: number;
  status: SessionStatus;
  started_at: string;
  ended_at: string | null;
  present_count: number;
  absent_count: number;
  late_count: number;
  total_count: number;
  course_name: string | null;
  course_code: string | null;
  branch_name: string | null;
  branch_code: string | null;
};

export type AttendanceStatus = 'present' | 'absent' | 'late';

export type Attendance = {
  id: number;
  session_id: number;
  student_id: number;
  status: AttendanceStatus;
  auto_detected: boolean;
  marked_at: string;
  student_name: string;
  student_number: string;
};

export type RecognizeResult = {
  detected_faces: number;
  matched_student_ids: number[];
  newly_marked: number[];
};

export type ApiError = {
  detail: string;
};
