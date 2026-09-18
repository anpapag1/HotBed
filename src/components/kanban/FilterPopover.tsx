import React, { useRef, useEffect } from 'react';
import {
  SlidersHorizontal,
  X,
  Zap,
  Link,
  MessageSquare,
  Check,
} from 'lucide-react';
import { getFilamentStyle } from '../../utils/statusConfig';
import styles from './FilterPopover.module.css';

export interface FilterState {
  colors: string[];
  urgentOnly: boolean;
  hasLinkOnly: boolean;
  hasCommentsOnly: boolean;
  sortBy: 'default' | 'name-asc' | 'date-desc';
}

export const INITIAL_FILTERS: FilterState = {
  colors: [],
  urgentOnly: false,
  hasLinkOnly: false,
  hasCommentsOnly: false,
  sortBy: 'default',
};

interface FilterPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  onChangeFilters: (filters: FilterState) => void;
  availableColors: string[];
  activeFilterCount: number;
  onReset: () => void;
}

export function FilterPopover({
  isOpen,
  onClose,
  filters,
  onChangeFilters,
  availableColors,
  activeFilterCount,
  onReset,
}: FilterPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleColor = (color: string) => {
    const isSelected = filters.colors.includes(color);
    const newColors = isSelected
      ? filters.colors.filter((c) => c !== color)
      : [...filters.colors, color];
    onChangeFilters({ ...filters, colors: newColors });
  };

  const toggleFlag = (flag: 'urgentOnly' | 'hasLinkOnly' | 'hasCommentsOnly') => {
    onChangeFilters({ ...filters, [flag]: !filters[flag] });
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChangeFilters({
      ...filters,
      sortBy: e.target.value as FilterState['sortBy'],
    });
  };

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div
        ref={popoverRef}
        className={styles.popover}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Filter & Sort print tasks"
      >
        <div className={styles.popoverHeader}>
          <span className={styles.headerTitle}>
            <SlidersHorizontal size={14} />
            <span>Filter & Sort</span>
          </span>

          <div className={styles.headerActions}>
            {activeFilterCount > 0 && (
              <button
                type="button"
                className={styles.btnReset}
                onClick={onReset}
              >
                Reset ({activeFilterCount})
              </button>
            )}
            <button
              type="button"
              className={styles.btnClose}
              onClick={onClose}
              aria-label="Close filters"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <div className={styles.popoverBody}>
          {/* Filaments / Colors */}
          {availableColors.length > 0 && (
            <div className={styles.section}>
              <span className={styles.sectionTitle}>Filament Color</span>
              <div className={styles.chipsGrid}>
                {availableColors.map((color) => {
                  const style = getFilamentStyle(color);
                  const isSelected = filters.colors.includes(color);

                  return (
                    <button
                      key={color}
                      type="button"
                      className={`${styles.colorChip} ${isSelected ? styles.colorChipActive : ''}`}
                      onClick={() => toggleColor(color)}
                    >
                      <span
                        className={styles.chipDot}
                        style={{ backgroundColor: style.dot }}
                      />
                      <span>{color}</span>
                      {isSelected && <Check size={11} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Flags */}
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Task Flags</span>
            <div className={styles.flagsList}>
              <button
                type="button"
                className={`${styles.flagItem} ${filters.urgentOnly ? styles.flagItemActive : ''}`}
                onClick={() => toggleFlag('urgentOnly')}
              >
                <span className={styles.flagLeft}>
                  <Zap size={13} color="#f97316" />
                  <span>High Priority / Urgent</span>
                </span>
                {filters.urgentOnly && <Check size={13} />}
              </button>

              <button
                type="button"
                className={`${styles.flagItem} ${filters.hasLinkOnly ? styles.flagItemActive : ''}`}
                onClick={() => toggleFlag('hasLinkOnly')}
              >
                <span className={styles.flagLeft}>
                  <Link size={13} />
                  <span>Has Model Link / STL</span>
                </span>
                {filters.hasLinkOnly && <Check size={13} />}
              </button>

              <button
                type="button"
                className={`${styles.flagItem} ${filters.hasCommentsOnly ? styles.flagItemActive : ''}`}
                onClick={() => toggleFlag('hasCommentsOnly')}
              >
                <span className={styles.flagLeft}>
                  <MessageSquare size={13} />
                  <span>Has Comments / Notes</span>
                </span>
                {filters.hasCommentsOnly && <Check size={13} />}
              </button>
            </div>
          </div>

          {/* Sort By */}
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Order</span>
            <select
              className={styles.sortSelect}
              value={filters.sortBy}
              onChange={handleSortChange}
            >
              <option value="default">Default (Board order)</option>
              <option value="name-asc">Title (A → Z)</option>
              <option value="date-desc">Newest Added First</option>
            </select>
          </div>
        </div>
      </div>
    </>
  );
}
