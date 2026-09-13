import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageSquare, Trash2 } from 'lucide-react';
import type { PrintItem } from '../../types/database';
import { getStatusConfig } from '../../utils/statusConfig';
import {
  getItemComments,
  addItemComment,
  deleteItemComment,
  type ItemComment,
} from '../../utils/commentService';
import styles from './CommentsDrawer.module.css';

interface CommentsDrawerProps {
  item: PrintItem | null;
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
  currentUserRole?: 'admin' | 'customer';
  currentUserName?: string;
}

function formatCommentTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Recently';
  }
}

export function CommentsDrawer({
  item,
  isOpen,
  onClose,
  isAdmin = false,
  currentUserRole = isAdmin ? 'admin' : 'customer',
  currentUserName = isAdmin ? 'Workshop Admin' : 'Customer',
}: CommentsDrawerProps) {
  const [comments, setComments] = useState<ItemComment[]>([]);
  const [inputText, setInputText] = useState('');
  const feedEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync comments for active item
  useEffect(() => {
    if (!item) {
      setComments([]);
      return;
    }

    setComments(getItemComments(item.id, item.comments));

    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.itemId === item.id) {
        setComments(detail.comments);
      }
    };

    window.addEventListener('comments-updated', handleSync);
    return () => window.removeEventListener('comments-updated', handleSync);
  }, [item]);

  // Scroll to bottom when new comment arrives or drawer opens
  useEffect(() => {
    if (isOpen) {
      feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments.length, isOpen]);

  // Auto focus textarea when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen]);

  if (!isOpen || !item) return null;

  const statusConfig = getStatusConfig(item.status);

  const handleSend = () => {
    if (!inputText.trim()) return;

    addItemComment(
      item.id,
      inputText.trim(),
      currentUserRole,
      currentUserName,
      item.comments
    );

    setComments(getItemComments(item.id, item.comments));
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDelete = (commentId: string) => {
    deleteItemComment(item.id, commentId, item.comments);
    setComments(getItemComments(item.id, item.comments));
  };

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <aside
        className={styles.drawer}
        onClick={(e) => e.stopPropagation()}
        aria-label="Comments panel"
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <div className={styles.headerTitleRow}>
              <h3 className={styles.title} title={item.perigrafi}>
                {item.perigrafi || 'Print Part'}
              </h3>
            </div>
            <span
              className={styles.statusPill}
              style={{
                backgroundColor: statusConfig.badgeBg,
                color: statusConfig.badgeText,
                borderColor: statusConfig.badgeBorder,
              }}
            >
              <span
                className={styles.statusDot}
                style={{ backgroundColor: statusConfig.dotColor }}
              />
              {statusConfig.label}
            </span>
          </div>

          <button
            onClick={onClose}
            className={styles.btnClose}
            title="Close comments"
            aria-label="Close comments"
          >
            <X size={16} />
          </button>
        </div>

        {/* Comments Feed */}
        <div className={styles.feed}>
          {comments.length === 0 ? (
            <div className={styles.emptyFeed}>
              <div className={styles.emptyIconWrap}>
                <MessageSquare size={22} />
              </div>
              <div className={styles.emptyTitle}>No comments yet</div>
              <p className={styles.emptyDesc}>
                Post notes, specs, or questions for this print part. Both workshop staff and customers can collaborate here.
              </p>
            </div>
          ) : (
            comments.map((c) => {
              const canDelete = isAdmin || c.authorRole === currentUserRole;
              return (
                <div key={c.id} className={styles.commentCard}>
                  <div className={styles.commentHeader}>
                    <div className={styles.authorGroup}>
                      <span className={styles.authorName}>{c.authorName}</span>
                      <span
                        className={
                          c.authorRole === 'admin'
                            ? styles.roleBadgeAdmin
                            : styles.roleBadgeCustomer
                        }
                      >
                        {c.authorRole}
                      </span>
                      <span className={styles.timeMeta}>
                        {formatCommentTime(c.createdAt)}
                      </span>
                    </div>

                    {canDelete && (
                      <button
                        onClick={() => handleDelete(c.id)}
                        className={styles.btnDeleteComment}
                        title="Delete comment"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  <div className={styles.commentContent}>{c.content}</div>
                </div>
              );
            })
          )}
          <div ref={feedEndRef} />
        </div>

        {/* Composer */}
        <div className={styles.composer}>
          <div className={styles.inputWrapper}>
            <textarea
              ref={textareaRef}
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Comment as ${currentUserName}...`}
              className={styles.commentTextarea}
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim()}
              className={styles.btnSend}
              title="Send comment (Enter)"
            >
              <Send size={15} />
            </button>
          </div>
          <div className={styles.composerHint}>
            <span>Press <strong>Enter</strong> to send, <strong>Shift + Enter</strong> for new line</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

