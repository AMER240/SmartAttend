import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '@/lib/auth-context';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { teacher, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3 text-on-surface-variant">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="font-body-md text-body-md">Yükleniyor...</span>
        </div>
      </div>
    );
  }

  if (!teacher) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
