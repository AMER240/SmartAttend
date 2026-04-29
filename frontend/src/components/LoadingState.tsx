import { AlertCircle, Loader2 } from 'lucide-react';

export function PageLoading({ label = 'Yükleniyor...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-on-surface-variant">
      <div className="flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="font-body-md text-body-md">{label}</span>
      </div>
    </div>
  );
}

export function PageError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant gap-3 text-center px-4">
      <AlertCircle className="w-8 h-8 text-error" />
      <p className="font-body-md text-body-md max-w-md">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 px-4 py-2 text-primary font-label-md text-label-md border border-outline-variant rounded-lg hover:bg-surface-container-low transition-colors"
        >
          Tekrar Dene
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-16 text-on-surface-variant gap-2 text-center px-4">
      <h3 className="font-headline-md text-headline-md text-on-surface">{title}</h3>
      {description && <p className="font-body-md text-body-md max-w-md">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
