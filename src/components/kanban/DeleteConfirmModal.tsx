import { AlertTriangle } from 'lucide-react';
import styles from './DeleteConfirmModal.module.css';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmModal({
  isOpen,
  title = 'Delete Print Item',
  message = 'Are you sure you want to delete this print item? This action cannot be undone.',
  onCancel,
  onConfirm,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.headerRow}>
          <div className={styles.iconWrap}>
            <AlertTriangle size={22} />
          </div>
          <h3 className={styles.title}>{title}</h3>
        </div>

        <p className={styles.message}>{message}</p>

        <div className={styles.footer}>
          <button type="button" onClick={onCancel} className={styles.btnCancel}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className={styles.btnDelete}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

