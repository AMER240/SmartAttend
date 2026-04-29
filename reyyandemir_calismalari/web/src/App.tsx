import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import CourseDetail from './pages/CourseDetail';
import CourseForm from './pages/CourseForm';
import Courses from './pages/Courses';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import Kiosk from './pages/Kiosk';
import Login from './pages/Login';
import Scanner from './pages/Scanner';
import SessionDetail from './pages/SessionDetail';
import StudentForm from './pages/StudentForm';
import Settings from './pages/Settings';
import Students from './pages/Students';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Public student self check-in — no auth required */}
        <Route path="/kiosk/:sessionId" element={<Kiosk />} />

        <Route
          path="/scanner/:sessionId"
          element={
            <ProtectedRoute>
              <Scanner />
            </ProtectedRoute>
          }
        />

        <Route
          path="/courses/new"
          element={
            <ProtectedRoute>
              <CourseForm />
            </ProtectedRoute>
          }
        />

        <Route
          path="/courses/:courseId/edit"
          element={
            <ProtectedRoute>
              <CourseForm />
            </ProtectedRoute>
          }
        />

        <Route
          path="/students/new"
          element={
            <ProtectedRoute>
              <StudentForm />
            </ProtectedRoute>
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="courses" element={<Courses />} />
          <Route path="courses/:courseId" element={<CourseDetail />} />
          <Route path="students" element={<Students />} />
          <Route path="history" element={<History />} />
          <Route path="history/:sessionId" element={<SessionDetail />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
