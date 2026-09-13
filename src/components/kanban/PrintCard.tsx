import { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ExternalLink,
  Edit2,
  Trash2,
  Copy,
  ChevronRight,
  MoreVertical,
  CheckSquare,
  Square,
  Paperclip,
  Lock,
  Plus,
  X,
  MessageSquare,
} from 'lucide-react';
import type { PrintItem, PrintStatus } from '../../types/database';
import {
  parseColors,
  getFilamentStyle,
  extractUrls,
  getCommentAlerts,
} from '../../utils/statusConfig';
import {
  getItemSubtasks,
  addSubtask,
  toggleSubtask,
  deleteSubtask,
  SUBTASK_PRESETS,
  type SubTask,
} from '../../utils/subtaskService';
import { getItemCommentCount } from '../../utils/commentService';
import styles from './PrintCard.module.css';

interface PrintCardProps {
  item: PrintItem;
  readOnly?: boolean;
  isAdmin?: boolean;
  onEdit?: (item: PrintItem) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (item: PrintItem) => void;
  onChangeStatus?: (id: string, newStatus: PrintStatus) => void;
  onOpenComments?: (item: PrintItem) => void;
  isOverlay?: boolean;
}

export function PrintCard({
  item,
  readOnly = false,
  isAdmin = false,
  onEdit,
  onDelete,
  onDuplicate,
  onChangeStatus,
  onOpenComments,
  isOverlay = false,
}: PrintCardProps) {
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  // Dynamic subtasks (empty by default, user adds whenever they want)
  const [subtasks, setSubtasks] = useState<SubTask[]>(() => getItemSubtasks(item.id));
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [newSubtaskText, setNewSubtaskText] = useState('');

  // Comment count synced in real time
  const [commentCount, setCommentCount] = useState<number>(() =>
    getItemCommentCount(item.id, item.comments)
  );

  // Sync subtasks if modified elsewhere
  useEffect(() => {
    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.itemId === item.id) {
        setSubtasks(detail.subtasks);
      }
    };
    window.addEventListener('subtasks-updated', handleSync);
    return () => window.removeEventListener('subtasks-updated', handleSync);
  }, [item.id]);

  // Sync comments count if modified elsewhere
  useEffect(() => {
    const handleCommentsSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.itemId === item.id) {
        setCommentCount(detail.count);
      }
    };
    window.addEventListener('comments-updated', handleCommentsSync);
    return () => window.removeEventListener('comments-updated', handleCommentsSync);
  }, [item.id]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setShowActionsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleToggleSubtask = (stId: string) => {
    toggleSubtask(item.id, stId);
    setSubtasks(getItemSubtasks(item.id));
  };

  const handleDeleteSubtask = (stId: string) => {
    deleteSubtask(item.id, stId);
    setSubtasks(getItemSubtasks(item.id));
  };

  const handleAddPreset = (presetTitle: string) => {
    addSubtask(item.id, presetTitle);
    setSubtasks(getItemSubtasks(item.id));
  };

  const handleCreateCustom = () => {
    if (!newSubtaskText.trim()) return;
    addSubtask(item.id, newSubtaskText.trim());
    setSubtasks(getItemSubtasks(item.id));
    setNewSubtaskText('');
  };

  const colors = parseColors(item.xroma);
  const urls = extractUrls(item.link);
  const commentAlerts = getCommentAlerts(item.comments);

  const getNextStatus = (current: PrintStatus): PrintStatus | null => {
    switch (current) {
      case 'Not Started':
        return 'Ready to print';
      case 'Ready to print':
        return 'Printing';
      case 'Printing':
        return 'Finished';
      case 'Finished':
        return 'Delivered';
      default:
        return null;
    }
  };

  const nextStatus = getNextStatus(item.status);

  // Permissions:
  // Customers can only edit specs in 'Not Started'
  const canEdit = !readOnly && (isAdmin || item.status === 'Not Started');
  // Workshop subtasks: strictly admins only! The customer cannot add, toggle, or delete subtasks.
  const canManageSubtasks = !readOnly && isAdmin;
  const isDraggable = !readOnly && !isOverlay && isAdmin;

  // Setup draggable for whole card (admins only)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: !isDraggable,
  });

  const dndStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div
      ref={!isOverlay ? setNodeRef : undefined}
      style={!isOverlay ? dndStyle : undefined}
      {...(isDraggable ? attributes : {})}
      {...(isDraggable ? listeners : {})}
      className={`${styles.card} ${isOverlay ? styles.overlayCard : ''} ${isDraggable ? styles.draggableCard : ''}`}
    >
      {/* Top Row: Title + Actions */}
      <div className={styles.cardHeader}>
        <div className={styles.titleArea}>
          <h4 className={styles.cardTitle} title={item.perigrafi}>
            {item.perigrafi || 'Untitled Print Part'}
          </h4>
        </div>

        {canEdit && (onEdit || onDelete || onDuplicate) ? (
          <div
            className={styles.topActions}
            ref={actionMenuRef}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowActionsMenu(!showActionsMenu);
              }}
              className={styles.btnAction}
              title="More actions"
            >
              <MoreVertical size={15} />
            </button>

            {showActionsMenu && (
              <div
                className={styles.menuDropdown}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {onEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowActionsMenu(false);
                      onEdit(item);
                    }}
                    className={styles.menuItem}
                  >
                    <Edit2 size={14} />
                    <span>Edit Specs</span>
                  </button>
                )}
                {onDuplicate && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowActionsMenu(false);
                      onDuplicate(item);
                    }}
                    className={styles.menuItem}
                  >
                    <Copy size={14} />
                    <span>Duplicate</span>
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowActionsMenu(false);
                      onDelete(item.id);
                    }}
                    className={`${styles.menuItem} ${styles.menuItemDelete}`}
                  >
                    <Trash2 size={14} />
                    <span>Delete Part</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : !isAdmin && item.status !== 'Not Started' ? (
          <div
            className={styles.lockedBadge}
            title="In production — locked from customer editing"
          >
            <Lock size={13} />
          </div>
        ) : null}
      </div>

      {/* Description / Comments */}
      {item.comments && (
        <p className={styles.descriptionText}>
          {item.comments}
        </p>
      )}

      {/* Sub Tasks Checklist (Only admins can add/manage; customers can only view if tasks exist) */}
      {(subtasks.length > 0 || canManageSubtasks) && (
        <div className={styles.subtasksBlock}>
          <div className={styles.subtasksHeader}>
            <span className={styles.subtasksLabel}>
              Sub tasks {subtasks.length > 0 ? `(${subtasks.filter((s) => s.completed).length}/${subtasks.length})` : ''}
            </span>
            {canManageSubtasks && (
              <button
                type="button"
                className={styles.btnAddSubtask}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAddingSubtask((prev) => !prev);
                }}
                title={isAddingSubtask ? 'Close editor' : 'Add sub task'}
              >
                <Plus size={11} />
                <span>{isAddingSubtask ? 'Done' : 'Add'}</span>
              </button>
            )}
          </div>

          {/* Subtask items list */}
          {subtasks.length > 0 && (
            <div className={styles.subtaskList}>
              {subtasks.map((st) => (
                <div key={st.id} className={styles.subtaskRow}>
                  <button
                    type="button"
                    className={`${styles.subtaskItem} ${!canManageSubtasks ? styles.subtaskItemReadOnly : ''}`}
                    disabled={!canManageSubtasks}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (canManageSubtasks) handleToggleSubtask(st.id);
                    }}
                  >
                    {st.completed ? (
                      <CheckSquare size={14} className={styles.checkDone} />
                    ) : (
                      <Square size={14} className={styles.checkEmpty} />
                    )}
                    <span className={st.completed ? styles.taskDoneText : styles.taskText}>
                      {st.title}
                    </span>
                  </button>
                  {canManageSubtasks && (
                    <button
                      type="button"
                      className={styles.btnDeleteSubtask}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSubtask(st.id);
                      }}
                      title="Delete task"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add Subtask panel with presets & custom input (Admins only) */}
          {isAddingSubtask && canManageSubtasks && (
            <div
              className={styles.addSubtaskSection}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.presetsLabel}>Quick Presets</div>
              <div className={styles.presetChips}>
                {SUBTASK_PRESETS.map((preset) => {
                  const alreadyAdded = subtasks.some(
                    (s) => s.title.toLowerCase() === preset.toLowerCase()
                  );
                  return (
                    <button
                      key={preset}
                      type="button"
                      className={`${styles.presetChip} ${alreadyAdded ? styles.presetChipActive : ''}`}
                      onClick={() => handleAddPreset(preset)}
                      title={`Add ${preset}`}
                    >
                      + {preset}
                    </button>
                  );
                })}
              </div>

              <div className={styles.inputRow}>
                <input
                  type="text"
                  value={newSubtaskText}
                  onChange={(e) => setNewSubtaskText(e.target.value)}
                  placeholder="Custom sub task..."
                  className={styles.subtaskInput}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateCustom();
                    }
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  className={styles.btnConfirmAdd}
                  onClick={handleCreateCustom}
                  disabled={!newSubtaskText.trim()}
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Model Link Attachment */}
      {urls.length > 0 && (
        <div className={styles.attachmentRow}>
          {urls.map((u, i) => {
            const host = u.replace(/^https?:\/\//, '').split('/')[0];
            return (
              <a
                key={i}
                href={u}
                target="_blank"
                rel="noreferrer"
                className={styles.attachmentChip}
                title={u}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <Paperclip size={13} />
                <span>{host}</span>
                <ExternalLink size={11} className={styles.extIcon} />
              </a>
            );
          })}
        </div>
      )}

      {/* Card Footer */}
      <div className={styles.cardFooter}>
        <div className={styles.tagPills}>
          {/* Filament Pill */}
          {colors.length > 0 ? (
            colors.map((clr, idx) => {
              const fil = getFilamentStyle(clr);
              return (
                <span
                  key={idx}
                  className={styles.filamentPill}
                  style={{
                    backgroundColor: fil.bg,
                    color: fil.text,
                    borderColor: fil.border,
                  }}
                  title={`Filament: ${clr}`}
                >
                  <span
                    className={styles.filamentDot}
                    style={{ backgroundColor: fil.dot }}
                  />
                  <span>{clr}</span>
                </span>
              );
            })
          ) : (
            <span className={styles.filamentPillDefault}>
              Standard PLA
            </span>
          )}

          {/* Scale Pill */}
          {item.megethos !== null && item.megethos !== undefined && item.megethos !== 1.0 && (
            <span className={styles.scalePill}>
              {Math.round(item.megethos * 100)}%
            </span>
          )}

          {/* Alert Pills */}
          {commentAlerts.map((alert, i) => (
            <span
              key={i}
              className={styles.alertPill}
              title={alert.label}
            >
              {alert.label}
            </span>
          ))}
        </div>

        {/* Footer right: Comments Button + Quick Advance Button */}
        <div className={styles.footerRight}>
          {onOpenComments && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onOpenComments(item);
              }}
              className={`${styles.btnComments} ${commentCount > 0 ? styles.btnCommentsActive : ''}`}
              title={`${commentCount} comment${commentCount === 1 ? '' : 's'}. Click to view or reply.`}
            >
              <MessageSquare size={13} />
              {commentCount > 0 && (
                <span className={styles.commentCountBadge}>{commentCount}</span>
              )}
            </button>
          )}

          {/* Quick Advance Button (Admins only) */}
          {!readOnly && isAdmin && onChangeStatus && nextStatus && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onChangeStatus(item.id, nextStatus);
              }}
              className={styles.btnAdvance}
              title={`Advance to ${nextStatus}`}
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

