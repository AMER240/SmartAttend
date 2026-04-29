import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';

import LoadingSpinner from './LoadingSpinner';
import Modal from './Modal';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
  isLoading?: boolean;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Onayla',
  cancelLabel = 'İptal',
  destructive,
  onConfirm,
  onClose,
  isLoading: isLoadingProp,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);
  const isLoading = loading || isLoadingProp;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={isLoading ? () => {} : onClose} title={title}>
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              destructive ? 'bg-error-container/30 text-error' : 'bg-primary-container/30 text-primary'
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
          <p className="text-on-surface text-sm">{message}</p>
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            disabled={isLoading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`btn ${destructive ? 'btn-error' : 'btn-primary'}`}
            disabled={isLoading}
          >
            {isLoading ? <LoadingSpinner size="small" /> : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
