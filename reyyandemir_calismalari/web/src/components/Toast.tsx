import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ToastKind = 'success' | 'error' | 'info';
type ToastItem = { id: number; kind: ToastKind; message: string };

type ToastContextValue = {
  show: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextId++;
      setItems((prev) => [...prev, { id, kind, message }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (m) => show(m, 'success'),
      error: (m) => show(m, 'error'),
      info: (m) => show(m, 'info'),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)]">
        {items.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-3 p-3 rounded-xl shadow-lg border backdrop-blur-sm ${
              t.kind === 'success'
                ? 'bg-secondary-container/95 border-secondary text-on-secondary-container'
                : t.kind === 'error'
                  ? 'bg-error-container/95 border-error text-on-error-container'
                  : 'bg-surface-container-lowest/95 border-outline-variant text-on-surface'
            }`}
          >
            {t.kind === 'success' ? (
              <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
            ) : t.kind === 'error' ? (
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            ) : (
              <Info className="w-5 h-5 mt-0.5 shrink-0" />
            )}
            <p className="font-body-md text-body-md flex-1">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="p-1 hover:opacity-70 transition-opacity">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
