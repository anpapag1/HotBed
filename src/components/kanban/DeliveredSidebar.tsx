import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react';
import type { PrintItem, PrintStatus, ItemComment, ItemSubtask } from '../../types/database';
import { PrintCard } from './PrintCard';
import styles from './DeliveredSidebar.module.css';

interface DeliveredSidebarProps {
  items: PrintItem[];
  comments?: ItemComment[];
  subtasks?: ItemSubtask[];
  readOnly?: boolean;
  isAdmin?: boolean;
  isOver?: boolean;
  onEdit?: (item: PrintItem) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (item: PrintItem) => void;
  onChangeStatus?: (id: string, newStatus: PrintStatus) => void;
  onOpenComments?: (item: PrintItem) => void;
  onAddSubtask?: (printId: string, title: string) => void;
  onToggleSubtask?: (subtaskId: string, completed: boolean) => void;
  onDeleteSubtask?: (subtaskId: string) => void;
}

export function DeliveredSidebar({
  items,
  comments = [],
  subtasks = [],
  readOnly = false,
  isAdmin = false,
  isOver = false,
  onEdit,
  onDelete,
  onDuplicate,
  onChangeStatus,
  onOpenComments,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
}: DeliveredSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { setNodeRef } = useDroppable({
    id: 'Delivered',
    disabled: readOnly || !isAdmin,
  });

  return (
    <aside
      ref={setNodeRef}
      className={`${styles.sidebar} ${!isOpen ? styles.collapsed : ''} ${isOver ? styles.sidebarOver : ''}`}
    >
      {isOpen ? (
        <>
          <div className={styles.header}>
            <div className={styles.titleArea}>
              <CheckCircle2 size={18} color="var(--status-delivered)" />
              <span className={styles.title}>Delivered</span>
              <span className={styles.badge}>{items.length}</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className={styles.toggleBtn}
              title="Collapse sidebar"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className={styles.content}>
              {items.map((item) => {
                const canEdit = !readOnly && (isAdmin || item.status === 'Not Started');
                return (
                  <PrintCard
                    key={item.id}
                    item={item}
                    threadComments={comments.filter((c) => c.print_id === item.id)}
                    subtasks={subtasks.filter((s) => s.print_id === item.id)}
                    readOnly={readOnly}
                    isAdmin={isAdmin}
                    onEdit={canEdit ? onEdit : undefined}
                    onDelete={canEdit ? onDelete : undefined}
                    onDuplicate={canEdit ? onDuplicate : undefined}
                    onChangeStatus={isAdmin ? onChangeStatus : undefined}
                    onOpenComments={onOpenComments}
                    onAddSubtask={onAddSubtask}
                    onToggleSubtask={onToggleSubtask}
                    onDeleteSubtask={onDeleteSubtask}
                  />
                );
              })}

              {items.length === 0 && (
                <div className={styles.emptyState}>
                  <CheckCircle2 size={24} style={{ opacity: 0.4, marginBottom: 8 }} />
                  <span>No delivered prints yet</span>
                </div>
              )}
            </div>
          </SortableContext>
        </>
      ) : (
        <div
          className={styles.collapsedStrip}
          onClick={() => setIsOpen(true)}
          title="Click to expand Delivered prints"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(true);
            }}
            className={styles.toggleBtn}
            title="Open Delivered prints sidebar"
          >
            <ChevronLeft size={16} />
          </button>
          <div className={styles.verticalText}>
            Delivered ({items.length})
          </div>
          <span className={styles.badge}>{items.length}</span>
        </div>
      )}
    </aside>
  );
}

