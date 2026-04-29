/**
 * Auth bypass: the simplified backend has no authentication, so this
 * "guard" simply renders its children. The component is kept (instead of
 * being deleted from App.tsx) so the routing tree stays untouched.
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
