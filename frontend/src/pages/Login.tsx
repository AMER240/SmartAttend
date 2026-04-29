import { Navigate } from 'react-router-dom';

/**
 * The simplified backend has no authentication. This page just bounces
 * to the dashboard so any old `/login` link or legacy redirect keeps
 * working without breaking the navigation.
 */
export default function Login() {
  return <Navigate to="/dashboard" replace />;
}
