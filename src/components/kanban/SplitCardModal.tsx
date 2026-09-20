import React, { useState } from 'react';
import {
  X,
  Split,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  CheckSquare,
  Square,
  Copy,
  Paperclip,
  ExternalLink,
  Palette,
  Link as LinkIcon,
} from 'lucide-react';
import type { PrintItem, ItemSubtask, PrintStatus } from '../../types/database';
import {
  adminInsertPrint,
  updatePrint,
  moveSubtaskToPrint,
  addSubtaskToPrint,
} from '../../services/orderService';
import {
  getFilamentStyle,
  parseColors,
  extractUrls,
} from '../../utils/statusConfig';
import styles from './SplitCardModal.module.css';

const QUICK_COLORS = [
  'Black',
  'White',
  'Grey',
  'Orange',
  'Red',
  'Blue',
  'Green',
  'Yellow',
  'Purple',
];

interface SplitCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: PrintItem | null;
  subtasks: ItemSubtask[];
  orderId: string;
  isAdmin?: boolean;
  onSuccess: () => Promise<void> | void;
}

interface SplitColumn {
  id: string;
  isOriginal: boolean;
  title: string;
  subtasks: ItemSubtask[];
  colors: string[];
  links: string[];
  newSubtaskInput: string;
  newColorInput: string;
  newLinkInput: string;
}

export function SplitCardModal({
  isOpen,
  onClose,
  item,
  subtasks,
  orderId,
  onSuccess,
}: SplitCardModalProps) {
  if (!isOpen || !item) return null;

  return (
    <SplitCardModalContent
      item={item}
      subtasks={subtasks}
      orderId={orderId}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}

function SplitCardModalContent({
  item,
  subtasks,
  orderId,
  onClose,
  onSuccess,
}: Omit<SplitCardModalProps, 'isOpen'> & { item: PrintItem }) {
  const itemSubtasks = subtasks.filter((s) => s.print_id === item.id);

  const initialColors = parseColors(item.xroma);
  if (initialColors.length === 0 && item.xroma?.trim()) {
    initialColors.push(item.xroma.trim());
  }

  const initialLinks = extractUrls(item.link);
  if (initialLinks.length === 0 && item.link?.trim()) {
    initialLinks.push(item.link.trim());
  }

  const [columns, setColumns] = useState<SplitColumn[]>(() => [
    {
      id: 'col-original',
      isOriginal: true,
      title: item.perigrafi,
      subtasks: [...itemSubtasks],
      colors: [...initialColors],
      links: [...initialLinks],
      newSubtaskInput: '',
      newColorInput: '',
      newLinkInput: '',
    },
    {
      id: 'col-2',
      isOriginal: false,
      title: `${item.perigrafi} (Part 2)`,
      subtasks: [],
      colors: [],
      links: [],
      newSubtaskInput: '',
      newColorInput: '',
      newLinkInput: '',
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  // Column management
  const handleAddColumn = () => {
    const nextIndex = columns.length + 1;
    setColumns((prev) => [
      ...prev,
      {
        id: `col-${Date.now()}-${Math.random()}`,
        isOriginal: false,
        title: `${item.perigrafi} (Part ${nextIndex})`,
        subtasks: [],
        colors: [],
        links: [],
        newSubtaskInput: '',
        newColorInput: '',
        newLinkInput: '',
      },
    ]);
  };

  const handleDuplicateColumn = (colIndex: number) => {
    const target = columns[colIndex];
    const newCol: SplitColumn = {
      id: `col-${Date.now()}-${Math.random()}`,
      isOriginal: false,
      title: `${target.title} (Copy)`,
      subtasks: target.subtasks.map((st) => ({
        ...st,
        id: `temp-dup-${Date.now()}-${Math.random()}`,
      })),
      colors: [...target.colors],
      links: [...target.links],
      newSubtaskInput: '',
      newColorInput: '',
      newLinkInput: '',
    };
    setColumns((prev) => {
      const next = [...prev];
      next.splice(colIndex + 1, 0, newCol);
      return next;
    });
  };

  const handleRemoveColumn = (colIndex: number) => {
    if (columns.length <= 2) return;
    const removedCol = columns[colIndex];
    setColumns((prev) => {
      const next = prev.filter((_, idx) => idx !== colIndex);
      // Return any subtasks, colors, links from the removed column back to the original column
      if (removedCol.subtasks.length > 0) {
        next[0].subtasks = [...next[0].subtasks, ...removedCol.subtasks];
      }
      for (const clr of removedCol.colors) {
        if (!next[0].colors.includes(clr)) {
          next[0].colors.push(clr);
        }
      }
      for (const lnk of removedCol.links) {
        if (!next[0].links.includes(lnk)) {
          next[0].links.push(lnk);
        }
      }
      return next;
    });
  };

  const handleUpdateTitle = (colIndex: number, newTitle: string) => {
    setColumns((prev) =>
      prev.map((col, idx) => (idx === colIndex ? { ...col, title: newTitle } : col))
    );
  };

  // Subtask actions
  const handleShiftSubtask = (fromColIndex: number, toColIndex: number, subtaskId: string) => {
    if (fromColIndex === toColIndex) return;
    setColumns((prev) => {
      const st = prev[fromColIndex].subtasks.find((s) => s.id === subtaskId);
      if (!st) return prev;

      return prev.map((col, idx) => {
        if (idx === fromColIndex) {
          return { ...col, subtasks: col.subtasks.filter((s) => s.id !== subtaskId) };
        }
        if (idx === toColIndex) {
          return { ...col, subtasks: [...col.subtasks, st] };
        }
        return col;
      });
    });
  };

  const handleDuplicateSubtask = (fromColIndex: number, subtaskId: string) => {
    setColumns((prev) => {
      const st = prev[fromColIndex].subtasks.find((s) => s.id === subtaskId);
      if (!st) return prev;

      const targetColIndex =
        fromColIndex < prev.length - 1 ? fromColIndex + 1 : fromColIndex - 1;
      const duplicatedSt: ItemSubtask = {
        ...st,
        id: `temp-dup-${Date.now()}-${Math.random()}`,
        completed: false,
      };

      return prev.map((col, idx) => {
        if (idx === targetColIndex) {
          return { ...col, subtasks: [...col.subtasks, duplicatedSt] };
        }
        return col;
      });
    });
  };

  const handleDeleteSubtask = (colIndex: number, subtaskId: string) => {
    setColumns((prev) =>
      prev.map((col, idx) =>
        idx === colIndex
          ? { ...col, subtasks: col.subtasks.filter((s) => s.id !== subtaskId) }
          : col
      )
    );
  };

  const handleAddSubtaskToColumn = (colIndex: number) => {
    const text = columns[colIndex].newSubtaskInput.trim();
    if (!text) return;

    const tempSubtask: ItemSubtask = {
      id: `temp-${Date.now()}-${Math.random()}`,
      print_id: item.id,
      order_id: orderId,
      title: text,
      completed: false,
      position: Date.now(),
      created_at: new Date().toISOString(),
    };

    setColumns((prev) =>
      prev.map((col, idx) =>
        idx === colIndex
          ? { ...col, subtasks: [...col.subtasks, tempSubtask], newSubtaskInput: '' }
          : col
      )
    );
  };

  // Color actions
  const handleShiftColor = (fromColIndex: number, toColIndex: number, color: string) => {
    if (fromColIndex === toColIndex) return;
    setColumns((prev) =>
      prev.map((col, idx) => {
        if (idx === fromColIndex) {
          return { ...col, colors: col.colors.filter((c) => c !== color) };
        }
        if (idx === toColIndex) {
          return col.colors.includes(color)
            ? col
            : { ...col, colors: [...col.colors, color] };
        }
        return col;
      })
    );
  };

  const handleDuplicateColor = (fromColIndex: number, color: string) => {
    setColumns((prev) => {
      const targetColIndex =
        fromColIndex < prev.length - 1 ? fromColIndex + 1 : fromColIndex - 1;
      return prev.map((col, idx) => {
        if (idx === targetColIndex) {
          return col.colors.includes(color)
            ? col
            : { ...col, colors: [...col.colors, color] };
        }
        return col;
      });
    });
  };

  const handleRemoveColor = (colIndex: number, color: string) => {
    setColumns((prev) =>
      prev.map((col, idx) =>
        idx === colIndex
          ? { ...col, colors: col.colors.filter((c) => c !== color) }
          : col
      )
    );
  };

  const handleAddColor = (colIndex: number, colorText?: string) => {
    setColumns((prev) => {
      const text = (colorText || prev[colIndex].newColorInput).trim();
      if (!text) return prev;
      return prev.map((col, idx) =>
        idx === colIndex
          ? {
              ...col,
              colors: col.colors.includes(text) ? col.colors : [...col.colors, text],
              newColorInput: '',
            }
          : col
      );
    });
  };

  // Link actions
  const handleShiftLink = (fromColIndex: number, toColIndex: number, link: string) => {
    if (fromColIndex === toColIndex) return;
    setColumns((prev) =>
      prev.map((col, idx) => {
        if (idx === fromColIndex) {
          return { ...col, links: col.links.filter((l) => l !== link) };
        }
        if (idx === toColIndex) {
          return col.links.includes(link)
            ? col
            : { ...col, links: [...col.links, link] };
        }
        return col;
      })
    );
  };

  const handleDuplicateLink = (fromColIndex: number, link: string) => {
    setColumns((prev) => {
      const targetColIndex =
        fromColIndex < prev.length - 1 ? fromColIndex + 1 : fromColIndex - 1;
      return prev.map((col, idx) => {
        if (idx === targetColIndex) {
          return col.links.includes(link)
            ? col
            : { ...col, links: [...col.links, link] };
        }
        return col;
      });
    });
  };

  const handleRemoveLink = (colIndex: number, link: string) => {
    setColumns((prev) =>
      prev.map((col, idx) =>
        idx === colIndex
          ? { ...col, links: col.links.filter((l) => l !== link) }
          : col
      )
    );
  };

  const handleAddLink = (colIndex: number) => {
    setColumns((prev) => {
      const text = prev[colIndex].newLinkInput.trim();
      if (!text) return prev;
      return prev.map((col, idx) =>
        idx === colIndex
          ? {
              ...col,
              links: col.links.includes(text) ? col.links : [...col.links, text],
              newLinkInput: '',
            }
          : col
      );
    });
  };

  // Drag and Drop
  const handleDragStart = (
    e: React.DragEvent,
    payload: { type: 'subtask' | 'color' | 'link'; id: string; fromColIndex: number }
  ) => {
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColId !== colId) {
      setDragOverColId(colId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverColId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, toColIndex: number) => {
    e.preventDefault();
    setDragOverColId(null);
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const data = JSON.parse(dataStr);
      if (!data || data.fromColIndex === undefined) return;

      if (data.type === 'subtask' && data.id) {
        handleShiftSubtask(data.fromColIndex, toColIndex, data.id);
      } else if (data.type === 'color' && data.id) {
        handleShiftColor(data.fromColIndex, toColIndex, data.id);
      } else if (data.type === 'link' && data.id) {
        handleShiftLink(data.fromColIndex, toColIndex, data.id);
      }
    } catch (err) {
      console.error('Failed to parse dropped item:', err);
    }
  };

  // Submit and save
  const handleConfirmSplit = async () => {
    setIsSubmitting(true);
    try {
      // 1. Update original card
      const originalCol = columns[0];
      const origUpdates: Partial<PrintItem> = {};
      if (originalCol.title.trim() && originalCol.title !== item.perigrafi) {
        origUpdates.perigrafi = originalCol.title.trim();
      }
      const newOrigXroma = originalCol.colors.join(', ');
      if (newOrigXroma !== (item.xroma || '')) {
        origUpdates.xroma = newOrigXroma;
      }
      const newOrigLink = originalCol.links.join(' ');
      if (newOrigLink !== (item.link || '')) {
        origUpdates.link = newOrigLink || null;
      }

      if (Object.keys(origUpdates).length > 0) {
        await updatePrint(item.id, origUpdates);
      }

      // 2. Add any newly typed or duplicated subtasks for the original card
      for (const st of originalCol.subtasks) {
        if (st.id.startsWith('temp-')) {
          await addSubtaskToPrint(item.id, orderId, st.title);
        }
      }

      // 3. Process each newly split card
      for (let i = 1; i < columns.length; i++) {
        const splitCol = columns[i];
        const newPrint = await adminInsertPrint(orderId, {
          perigrafi: splitCol.title.trim() || `${item.perigrafi} (Part ${i + 1})`,
          status: 'Not Started' as PrintStatus,
          xroma: splitCol.colors.join(', '),
          link: splitCol.links.join(' ') || null,
          megethos: item.megethos ?? 1.0,
          comments: item.comments,
        });

        // Assign subtasks
        for (const st of splitCol.subtasks) {
          if (st.id.startsWith('temp-')) {
            await addSubtaskToPrint(newPrint.id, orderId, st.title);
          } else {
            await moveSubtaskToPrint(st.id, newPrint.id);
          }
        }
      }

      await onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to split card:', err);
      alert('Failed to split card. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.iconWrap}>
              <Split size={20} />
            </div>
            <div className={styles.titleArea}>
              <h3 className={styles.title}>Split Print Item</h3>
              <p className={styles.subtitle}>
                Distribute subtasks, colors & links across cards. Duplicate parts or whole cards.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={styles.btnClose}
            title="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Multi-column Body */}
        <div className={styles.body}>
          {columns.map((col, colIdx) => (
            <div
              key={col.id}
              className={`${styles.column} ${dragOverColId === col.id ? styles.columnOver : ''}`}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, colIdx)}
            >
              {/* Column Top: Badge & Actions */}
              <div className={styles.columnHeader}>
                <span
                  className={
                    col.isOriginal ? styles.columnBadgeOriginal : styles.columnBadgeNew
                  }
                >
                  {col.isOriginal ? `Original (${item.status})` : 'New (Not Started)'}
                </span>

                <div className={styles.columnHeaderActions}>
                  {/* Duplicate Whole Card */}
                  <button
                    type="button"
                    onClick={() => handleDuplicateColumn(colIdx)}
                    className={styles.btnColAction}
                    title="Duplicate this card (with subtasks, colors & links)"
                  >
                    <Copy size={13} />
                  </button>

                  {/* Remove Column */}
                  {!col.isOriginal && columns.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveColumn(colIdx)}
                      className={`${styles.btnColAction} ${styles.btnColActionDelete}`}
                      title="Remove this split card"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Title input */}
              <input
                type="text"
                value={col.title}
                onChange={(e) => handleUpdateTitle(colIdx, e.target.value)}
                placeholder="Card title..."
                className={styles.titleInput}
              />

              {/* Metadata */}
              <div className={styles.metaRow}>
                {item.megethos !== null && item.megethos !== undefined && (
                  <span className={styles.metaChip}>
                    Scale: {Math.round(item.megethos * 100)}%
                  </span>
                )}
                <span style={{ marginLeft: 'auto' }}>
                  {col.subtasks.length} {col.subtasks.length === 1 ? 'part' : 'parts'}
                </span>
              </div>

              {/* 1. Subtasks Section */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitle}>
                    <CheckSquare size={13} style={{ color: 'var(--brand-primary)' }} />
                    <span>Subtasks</span>
                  </div>
                  <span className={styles.countBadge}>{col.subtasks.length}</span>
                </div>

                <div className={styles.subtaskList}>
                  {col.subtasks.length === 0 ? (
                    <div className={styles.emptyBox}>
                      <span>No subtasks in this card</span>
                    </div>
                  ) : (
                    col.subtasks.map((st) => (
                      <div
                        key={st.id}
                        className={styles.subtaskRow}
                        draggable
                        onDragStart={(e) =>
                          handleDragStart(e, {
                            type: 'subtask',
                            id: st.id,
                            fromColIndex: colIdx,
                          })
                        }
                      >
                        <div className={styles.subtaskLeft}>
                          {st.completed ? (
                            <CheckSquare
                              size={13}
                              style={{ color: 'var(--tag-green-text)', flexShrink: 0 }}
                            />
                          ) : (
                            <Square size={13} style={{ opacity: 0.4, flexShrink: 0 }} />
                          )}
                          <span className={styles.subtaskTitle} title={st.title}>
                            {st.title}
                          </span>
                        </div>

                        <div className={styles.itemActions}>
                          <button
                            type="button"
                            disabled={colIdx === 0}
                            onClick={() => handleShiftSubtask(colIdx, colIdx - 1, st.id)}
                            className={styles.btnMini}
                            title="Move to previous card"
                          >
                            <ArrowLeft size={11} />
                          </button>
                          <button
                            type="button"
                            disabled={colIdx === columns.length - 1}
                            onClick={() => handleShiftSubtask(colIdx, colIdx + 1, st.id)}
                            className={styles.btnMini}
                            title="Move to next card"
                          >
                            <ArrowRight size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateSubtask(colIdx, st.id)}
                            className={styles.btnMini}
                            title={
                              colIdx < columns.length - 1
                                ? 'Duplicate to next card'
                                : 'Duplicate to previous card'
                            }
                          >
                            <Copy size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSubtask(colIdx, st.id)}
                            className={`${styles.btnMini} ${styles.btnMiniDelete}`}
                            title="Delete subtask"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className={styles.inputRow}>
                  <input
                    type="text"
                    value={col.newSubtaskInput}
                    onChange={(e) =>
                      setColumns((prev) =>
                        prev.map((c, i) =>
                          i === colIdx ? { ...c, newSubtaskInput: e.target.value } : c
                        )
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubtaskToColumn(colIdx);
                      }
                    }}
                    placeholder="+ Add subtask..."
                    className={styles.inputField}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddSubtaskToColumn(colIdx)}
                    disabled={!col.newSubtaskInput.trim()}
                    className={styles.btnAddSmall}
                    title="Add subtask"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>

              {/* 2. Colors Section */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitle}>
                    <Palette size={13} style={{ color: 'var(--brand-primary)' }} />
                    <span>Colors</span>
                  </div>
                  <span className={styles.countBadge}>{col.colors.length}</span>
                </div>

                <div className={styles.colorChipsContainer}>
                  {col.colors.length === 0 ? (
                    <div className={styles.emptyBox}>
                      <span>No colors assigned</span>
                    </div>
                  ) : (
                    col.colors.map((clr) => {
                      const fil = getFilamentStyle(clr);
                      return (
                        <div
                          key={clr}
                          className={styles.colorPill}
                          draggable
                          onDragStart={(e) =>
                            handleDragStart(e, {
                              type: 'color',
                              id: clr,
                              fromColIndex: colIdx,
                            })
                          }
                        >
                          <span
                            className={styles.colorDot}
                            style={{ backgroundColor: fil.dot }}
                          />
                          <span className={styles.colorLabel} title={clr}>
                            {clr}
                          </span>

                          <div className={styles.itemActions}>
                            <button
                              type="button"
                              disabled={colIdx === 0}
                              onClick={() => handleShiftColor(colIdx, colIdx - 1, clr)}
                              className={styles.btnMini}
                              title="Transfer to previous card"
                            >
                              <ArrowLeft size={10} />
                            </button>
                            <button
                              type="button"
                              disabled={colIdx === columns.length - 1}
                              onClick={() => handleShiftColor(colIdx, colIdx + 1, clr)}
                              className={styles.btnMini}
                              title="Transfer to next card"
                            >
                              <ArrowRight size={10} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateColor(colIdx, clr)}
                              className={styles.btnMini}
                              title={
                                colIdx < columns.length - 1
                                  ? 'Duplicate color to next card'
                                  : 'Duplicate color to previous card'
                              }
                            >
                              <Copy size={10} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveColor(colIdx, clr)}
                              className={`${styles.btnMini} ${styles.btnMiniDelete}`}
                              title="Remove color"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Quick colors pills */}
                <div className={styles.quickColorsRow}>
                  {QUICK_COLORS.map((qc) => {
                    const fil = getFilamentStyle(qc);
                    return (
                      <button
                        key={qc}
                        type="button"
                        onClick={() => handleAddColor(colIdx, qc)}
                        className={styles.quickColorBtn}
                        title={`Add ${qc}`}
                      >
                        <span
                          className={styles.colorDot}
                          style={{ backgroundColor: fil.dot, width: 7, height: 7 }}
                        />
                        <span>{qc}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom color input */}
                <div className={styles.inputRow}>
                  <input
                    type="text"
                    value={col.newColorInput}
                    onChange={(e) =>
                      setColumns((prev) =>
                        prev.map((c, i) =>
                          i === colIdx ? { ...c, newColorInput: e.target.value } : c
                        )
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddColor(colIdx);
                      }
                    }}
                    placeholder="+ Custom color..."
                    className={styles.inputField}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddColor(colIdx)}
                    disabled={!col.newColorInput.trim()}
                    className={styles.btnAddSmall}
                    title="Add custom color"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>

              {/* 3. Links Section */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitle}>
                    <LinkIcon size={13} style={{ color: 'var(--brand-primary)' }} />
                    <span>Model Links</span>
                  </div>
                  <span className={styles.countBadge}>{col.links.length}</span>
                </div>

                <div className={styles.linkList}>
                  {col.links.length === 0 ? (
                    <div className={styles.emptyBox}>
                      <span>No links assigned</span>
                    </div>
                  ) : (
                    col.links.map((lnk) => {
                      const host = lnk.replace(/^https?:\/\//, '').split('/')[0] || lnk;
                      return (
                        <div
                          key={lnk}
                          className={styles.linkRow}
                          draggable
                          onDragStart={(e) =>
                            handleDragStart(e, {
                              type: 'link',
                              id: lnk,
                              fromColIndex: colIdx,
                            })
                          }
                        >
                          <div className={styles.linkLeft}>
                            <Paperclip size={12} style={{ flexShrink: 0, opacity: 0.6 }} />
                            <span className={styles.linkUrlText} title={lnk}>
                              {host}
                            </span>
                            {lnk.startsWith('http') && (
                              <a
                                href={lnk}
                                target="_blank"
                                rel="noreferrer"
                                className={styles.linkOpenBtn}
                                title="Open link in new tab"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </div>

                          <div className={styles.itemActions}>
                            <button
                              type="button"
                              disabled={colIdx === 0}
                              onClick={() => handleShiftLink(colIdx, colIdx - 1, lnk)}
                              className={styles.btnMini}
                              title="Transfer link to previous card"
                            >
                              <ArrowLeft size={10} />
                            </button>
                            <button
                              type="button"
                              disabled={colIdx === columns.length - 1}
                              onClick={() => handleShiftLink(colIdx, colIdx + 1, lnk)}
                              className={styles.btnMini}
                              title="Transfer link to next card"
                            >
                              <ArrowRight size={10} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateLink(colIdx, lnk)}
                              className={styles.btnMini}
                              title={
                                colIdx < columns.length - 1
                                  ? 'Duplicate link to next card'
                                  : 'Duplicate link to previous card'
                              }
                            >
                              <Copy size={10} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveLink(colIdx, lnk)}
                              className={`${styles.btnMini} ${styles.btnMiniDelete}`}
                              title="Remove link"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className={styles.inputRow}>
                  <input
                    type="text"
                    value={col.newLinkInput}
                    onChange={(e) =>
                      setColumns((prev) =>
                        prev.map((c, i) =>
                          i === colIdx ? { ...c, newLinkInput: e.target.value } : c
                        )
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddLink(colIdx);
                      }
                    }}
                    placeholder="+ Add URL/link..."
                    className={styles.inputField}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddLink(colIdx)}
                    disabled={!col.newLinkInput.trim()}
                    className={styles.btnAddSmall}
                    title="Add link"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* "+ Add Split Card" button at the right */}
          <button
            type="button"
            onClick={handleAddColumn}
            className={styles.btnAddColumn}
            title="Add another split card"
          >
            <Plus size={24} />
            <span className={styles.btnAddColumnSpan}>+ Add Card</span>
          </button>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className={styles.btnCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmSplit}
            disabled={isSubmitting}
            className={styles.btnConfirm}
          >
            <Split size={14} />
            <span>{isSubmitting ? 'Splitting...' : 'Confirm Split'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
