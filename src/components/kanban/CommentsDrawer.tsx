import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, MessageSquare, Trash2 } from 'lucide-react';
import type { PrintItem, ItemComment } from '../../types/database';
import { getStatusConfig } from '../../utils/statusConfig';
import { markItemCommentsRead } from '../../utils/commentService';
import { markCommentsSeen } from '../../services/orderService';
import styles from './CommentsDrawer.module.css';

interface CommentsDrawerProps {
  item: PrintItem | null;
  comments: ItemComment[];
  isOpen: boolean;
  onClose: () => void;
  onSend: (printId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onCommentsSeen?: (printId: string) => void;
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
  comments,
  isOpen,
  onClose,
  onSend,
  onDelete,
  onCommentsSeen,
  isAdmin = false,
  currentUserRole = isAdmin ? 'admin' : 'customer',
  currentUserName = isAdmin ? 'Workshop Admin' : 'Customer',
}: CommentsDrawerProps) {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const feedEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mark the other side's comments read as soon as this item's drawer is open,
  // and again whenever a new comment arrives while it's still open.
  // Marks unseen comments from the other role as seen in Supabase.
  useEffect(() => {
    if (isOpen && item) {
      markItemCommentsRead(item.id, currentUserRole, comments);
      const otherRole = currentUserRole === 'admin' ? 'customer' : 'admin';
      const hasUnseen = comments.some(
        (c) => c.print_id === item.id && c.author_role?.toLowerCase() === otherRole && !c.has_been_seen
      );
      if (hasUnseen) {
        onCommentsSeen?.(item.id);
        markCommentsSeen(item.id).catch((err) =>
          console.error('Failed to mark comments as seen in Supabase:', err)
        );
      }
    }
  }, [isOpen, item, currentUserRole, comments, onCommentsSeen]);

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

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !item) return;

    setInputText('');
    setIsSending(true);
    try {
      await onSend(item.id, text);
    } catch (err) {
      console.error('Failed to send comment:', err);
      alert('Could not send comment. Please check your network and try again.');
      setInputText(text);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await onDelete(commentId);
    } catch (err) {
      console.error('Failed to delete comment:', err);
      alert('Could not delete comment. Please check your network and try again.');
    }
  };

  return createPortal(
    (
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
              const canDelete = isAdmin || c.author_role === currentUserRole;
              return (
                <div key={c.id} className={styles.commentCard}>
                  <div className={styles.commentHeader}>
                    <div className={styles.authorGroup}>
                      <span className={styles.authorName}>{c.author_name}</span>
                      <span
                        className={
                          c.author_role === 'admin'
                            ? styles.roleBadgeAdmin
                            : styles.roleBadgeCustomer
                        }
                      >
                        {c.author_role}
                      </span>
                      <span className={styles.timeMeta}>
                        {formatCommentTime(c.created_at)}
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
              disabled={isSending}
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isSending}
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
    ),
    document.body
  );
}
