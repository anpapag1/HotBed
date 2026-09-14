import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import type { PrintItem, PrintStatus } from '../../types/database';
import { getStatusConfig, getStatusGradient } from '../../utils/statusConfig';
import { PrintCard } from './PrintCard';
import styles from './KanbanColumn.module.css';

interface KanbanColumnProps {
  status: PrintStatus;
  items: PrintItem[];
  readOnly?: boolean;
  isAdmin?: boolean;
  isOver?: boolean;
  onEdit?: (item: PrintItem) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (item: PrintItem) => void;
  onChangeStatus?: (id: string, newStatus: PrintStatus) => void;
  onAddClick?: (status: PrintStatus) => void;
  onOpenComments?: (item: PrintItem) => void;
}

export function KanbanColumn({
  status,
  items,
  readOnly = false,
  isAdmin = false,
  isOver = false,
  onEdit,
  onDelete,
  onDuplicate,
  onChangeStatus,
  onAddClick,
  onOpenComments,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: status,
    disabled: readOnly || !isAdmin,
  });

  const statusConfig = getStatusConfig(status);

  return (
    <div
      ref={setNodeRef}
      className={`${styles.column} ${isOver ? styles.columnOver : ''}`}
      style={{
        backgroundImage: getStatusGradient(status),
      }}
    >
      {/* Column Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span
            className={styles.statusDot}
            style={{ backgroundColor: statusConfig.dotColor || statusConfig.color }}
          />
          <h3 className={styles.columnTitle}>
            {status}
          </h3>
          <span className={styles.countBadge}>
            {items.length}
          </span>
        </div>

        {!readOnly && onAddClick && (
          <button
            onClick={() => onAddClick(status)}
            className={styles.btnAdd}
            title={`Add item to ${status}`}
          >
            <Plus size={15} />
          </button>
        )}
      </div>

      {/* Sortable Print Cards */}
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className={styles.cardList}>
          {items.map((item) => {
            const canEdit = !readOnly && (isAdmin || item.status === 'Not Started');
            return (
              <PrintCard
                key={item.id}
                item={item}
                readOnly={!canEdit}
                isAdmin={isAdmin}
                onEdit={canEdit ? onEdit : undefined}
                onDelete={canEdit ? onDelete : undefined}
                onDuplicate={canEdit ? onDuplicate : undefined}
                onChangeStatus={isAdmin ? onChangeStatus : undefined}
                onOpenComments={onOpenComments}
              />
            );
          })}

          {items.length === 0 && (
            <div className={styles.emptyDropzone}>
              <span>No prints</span>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

