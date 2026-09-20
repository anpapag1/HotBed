import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import type { PrintItem, PrintStatus, ItemComment, ItemSubtask } from '../../types/database';
import { getStatusConfig, getStatusGradient } from '../../utils/statusConfig';
import { hasUnreadComments } from '../../utils/commentService';
import { PrintCard } from './PrintCard';
import styles from './KanbanColumn.module.css';

interface KanbanColumnProps {
  status: PrintStatus;
  items: PrintItem[];
  comments?: ItemComment[];
  subtasks?: ItemSubtask[];
  readOnly?: boolean;
  isAdmin?: boolean;
  fullScroll?: boolean;
  isOver?: boolean;
  onEdit?: (item: PrintItem) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (item: PrintItem) => void;
  onSplitCard?: (item: PrintItem) => void;
  onChangeStatus?: (id: string, newStatus: PrintStatus) => void;
  onAddClick?: (status: PrintStatus) => void;
  onOpenComments?: (item: PrintItem) => void;
  onAddSubtask?: (printId: string, title: string) => void;
  onToggleSubtask?: (subtaskId: string, completed: boolean) => void;
  onUpdateSubtaskTitle?: (subtaskId: string, title: string) => void;
  onDeleteSubtask?: (subtaskId: string) => void;
  highlightedCardId?: string | null;
  orderCode?: string;
}

export function KanbanColumn({
  status,
  items,
  comments = [],
  subtasks = [],
  readOnly = false,
  isAdmin = false,
  fullScroll = false,
  isOver = false,
  highlightedCardId,
  orderCode,
  onEdit,
  onDelete,
  onDuplicate,
  onSplitCard,
  onChangeStatus,
  onAddClick,
  onOpenComments,
  onAddSubtask,
  onToggleSubtask,
  onUpdateSubtaskTitle,
  onDeleteSubtask,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: status,
    disabled: readOnly || !isAdmin,
  });

  const statusConfig = getStatusConfig(status);
  const viewerRole = isAdmin ? 'admin' : 'customer';
  const hasColumnUnread = items.some((item) =>
    hasUnreadComments(
      item.id,
      viewerRole,
      comments.filter((c) => c.print_id === item.id)
    )
  );

  return (
    <div
      ref={setNodeRef}
      className={`${styles.column} ${isOver ? styles.columnOver : ''} ${fullScroll ? styles.columnFullScroll : ''}`}
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
          {hasColumnUnread && (
            <span
              className={styles.columnUnreadDot}
              title="Unread comments in this column"
            />
          )}
        </div>

        {!readOnly && onAddClick && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddClick(status);
            }}
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
                threadComments={comments.filter((c) => c.print_id === item.id)}
                subtasks={subtasks.filter((s) => s.print_id === item.id)}
                readOnly={!canEdit}
                isAdmin={isAdmin}
                isHighlighted={highlightedCardId === item.id}
                orderCode={orderCode}
                onEdit={canEdit ? onEdit : undefined}
                onDelete={canEdit ? onDelete : undefined}
                onDuplicate={canEdit ? onDuplicate : undefined}
                onSplitCard={isAdmin ? onSplitCard : undefined}
                onChangeStatus={isAdmin ? onChangeStatus : undefined}
                onOpenComments={onOpenComments}
                onAddSubtask={onAddSubtask}
                onToggleSubtask={onToggleSubtask}
                onUpdateSubtaskTitle={onUpdateSubtaskTitle}
                onDeleteSubtask={onDeleteSubtask}
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

