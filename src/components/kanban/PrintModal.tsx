import React, { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { type PrintItem, type PrintStatus, ALL_STATUS_OPTIONS } from '../../types/database';
import { getFilamentStyle } from '../../utils/statusConfig';
import styles from './PrintModal.module.css';

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    perigrafi: string;
    xroma: string;
    megethos: number;
    link: string | null;
    comments: string | null;
    status?: PrintStatus;
  }) => Promise<void> | void;
  initialItem?: PrintItem | null;
  defaultStatus?: PrintStatus;
  isAdmin?: boolean;
}

const QUICK_COLORS = [
  'Black',
  'White',
  'Grey',
  'Orange',
  'Green',
  'Blue',
  'Red',
  'Yellow',
  'Purple',
];

function PrintModalForm({
  onClose,
  onSubmit,
  initialItem,
  defaultStatus = 'Not Started',
  isAdmin = false,
}: Omit<PrintModalProps, 'isOpen'>) {
  const [perigrafi, setPerigrafi] = useState(initialItem?.perigrafi || '');
  const [xroma, setXroma] = useState(initialItem?.xroma || '');
  const [scalePercent, setScalePercent] = useState<number>(
    initialItem?.megethos !== undefined && initialItem?.megethos !== null
      ? Math.round(initialItem.megethos * 100)
      : 100
  );
  const [link, setLink] = useState(initialItem?.link || '');
  const [comments, setComments] = useState(initialItem?.comments || '');
  const [status, setStatus] = useState<PrintStatus>(initialItem?.status || defaultStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddQuickColor = (color: string) => {
    if (!xroma.trim()) {
      setXroma(color);
    } else {
      const parts = xroma.split(',').map((p) => p.trim());
      if (!parts.includes(color)) {
        setXroma(`${xroma.trim()}, ${color}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!perigrafi.trim()) {
      setError('Model description / name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const parsedScale = scalePercent ? Math.max(0.01, scalePercent / 100) : 1.0;

      await onSubmit({
        perigrafi: perigrafi.trim(),
        xroma: xroma.trim(),
        megethos: parsedScale,
        link: link.trim() || null,
        comments: comments.trim() || null,
        status: isAdmin ? status : 'Not Started',
      });

      onClose();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to save print item');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            {initialItem ? 'Edit Print Item' : 'Add Print Item'}
          </h3>
          <button onClick={onClose} className={styles.closeBtn} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.errorMsg}>{error}</div>}

          {/* Model Name */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              <span>Model Name / Description *</span>
              <span className={styles.labelHint}>e.g. Voron Stealthburner</span>
            </label>
            <input
              type="text"
              className={styles.input}
              placeholder="What are we 3D printing?"
              value={perigrafi}
              onChange={(e) => setPerigrafi(e.target.value)}
              autoFocus
              required
            />
          </div>

          {/* Filament Color */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              <span>Filament Color(s)</span>
              <span className={styles.labelHint}>Comma-separated for multi-color</span>
            </label>
            <input
              type="text"
              className={styles.input}
              placeholder="e.g. Black, Orange or Silk Green"
              value={xroma}
              onChange={(e) => setXroma(e.target.value)}
            />
            <div className={styles.quickColors}>
              {QUICK_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleAddQuickColor(c)}
                  className={styles.colorChip}
                >
                  + {c}
                </button>
              ))}
              {QUICK_COLORS.map((c) => {
                const fil = getFilamentStyle(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleAddQuickColor(c)}
                    className={styles.colorChip}
                  >
                    <span
                      className={styles.chipDot}
                      style={{ backgroundColor: fil.dot }}
                    />
                    <span>{c}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scale & Admin Status */}
          <div className={styles.rowTwo}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                <span>Scale (%)</span>
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                step="1"
                className={styles.input}
                value={scalePercent}
                onChange={(e) => setScalePercent(parseInt(e.target.value, 10) || 100)}
              />
              <div className={styles.scalePresets}>
                {[50, 75, 100, 150, 200].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={styles.scaleBtn}
                    onClick={() => setScalePercent(s)}
                  >
                    {s}%
                  </button>
                ))}
              </div>
            </div>

            {isAdmin && (
              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  <span>Pipeline Status</span>
                </label>
                <select
                  className={styles.select}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as PrintStatus)}
                >
                  {ALL_STATUS_OPTIONS.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Link */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              <span>MakerWorld / Printables Link</span>
              <span className={styles.labelHint}>Optional URL</span>
            </label>
            <input
              type="text"
              className={styles.input}
              placeholder="https://makerworld.com/en/models/..."
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
          </div>

          {/* Comments */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              <span>Special Instructions / Notes</span>
              <span className={styles.labelHint}>Infill, walls, layer height, etc.</span>
            </label>
            <textarea
              className={styles.textarea}
              placeholder="Any specific requests or requirements..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              onClick={onClose}
              className={styles.btnCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.btnSubmit}
              disabled={isSubmitting}
            >
              <Sparkles size={16} />
              <span>{isSubmitting ? 'Saving...' : initialItem ? 'Save Changes' : 'Add Item'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PrintModal(props: PrintModalProps) {
  if (!props.isOpen) return null;
  return (
    <PrintModalForm
      key={props.initialItem ? props.initialItem.id : 'new-print-item'}
      {...props}
    />
  );
}
