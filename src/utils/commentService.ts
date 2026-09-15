export interface ItemComment {
  id: string;
  itemId: string;
  authorRole: 'admin' | 'customer';
  authorName: string;
  content: string;
  createdAt: string;
}

const STORAGE_PREFIX = 'hotbed_comments_';

export function getItemComments(itemId: string, legacyComment?: string | null): ItemComment[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${itemId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading comments from localStorage', err);
  }

  // If no saved comments in localStorage, seed initial comment if one exists on the print item
  if (legacyComment && legacyComment.trim()) {
    const seeded: ItemComment[] = [
      {
        id: `cm-initial-${itemId}`,
        itemId,
        authorRole: 'customer',
        authorName: 'Customer Note',
        content: legacyComment.trim(),
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ];
    saveItemComments(itemId, seeded);
    return seeded;
  }

  return [];
}

export function saveItemComments(itemId: string, comments: ItemComment[]): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${itemId}`, JSON.stringify(comments));
    window.dispatchEvent(
      new CustomEvent('comments-updated', {
        detail: { itemId, count: comments.length, comments },
      })
    );
  } catch (err) {
    console.error('Error saving comments to localStorage', err);
  }
}

export function addItemComment(
  itemId: string,
  content: string,
  authorRole: 'admin' | 'customer',
  authorName: string,
  legacyComment?: string | null
): ItemComment {
  const current = getItemComments(itemId, legacyComment);
  const newComment: ItemComment = {
    id: `cm-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    itemId,
    authorRole,
    authorName: authorName.trim() || (authorRole === 'admin' ? 'Workshop Admin' : 'Customer'),
    content: content.trim(),
    createdAt: new Date().toISOString(),
  };

  const updated = [...current, newComment];
  saveItemComments(itemId, updated);
  return newComment;
}

export function deleteItemComment(
  itemId: string,
  commentId: string,
  legacyComment?: string | null
): void {
  const current = getItemComments(itemId, legacyComment);
  const updated = current.filter((c) => c.id !== commentId);
  saveItemComments(itemId, updated);
}

export function getItemCommentCount(itemId: string, legacyComment?: string | null): number {
  return getItemComments(itemId, legacyComment).length;
}

// ---------------------------------------------------------------------------
// Read tracking (per-viewer-role, per-item, stored locally)
// ---------------------------------------------------------------------------
const READ_STORAGE_PREFIX = 'hotbed_comments_read_';

// Watermarked on the last comment's id rather than a timestamp: two actions
// landing in the same tick can get identical millisecond-resolution
// `Date.now()` values (routinely on Windows, where timer resolution is
// ~15ms), which made a "posted after last read" time comparison silently
// swallow a comment posted right after a read. An id-based watermark has no
// clock to tie against.
function getLastReadCommentId(itemId: string, role: 'admin' | 'customer'): string | null {
  try {
    return localStorage.getItem(`${READ_STORAGE_PREFIX}${role}_${itemId}`);
  } catch {
    return null;
  }
}

export function markItemCommentsRead(itemId: string, role: 'admin' | 'customer'): void {
  try {
    const comments = getItemComments(itemId);
    const lastComment = comments[comments.length - 1];
    if (lastComment) {
      localStorage.setItem(`${READ_STORAGE_PREFIX}${role}_${itemId}`, lastComment.id);
    }
    window.dispatchEvent(new CustomEvent('comments-read', { detail: { itemId, role } }));
  } catch (err) {
    console.error('Error saving comment read state to localStorage', err);
  }
}

// Unread = comments from the other role, posted after this viewer's last read.
export function getUnreadCommentCount(
  itemId: string,
  role: 'admin' | 'customer',
  legacyComment?: string | null
): number {
  const comments = getItemComments(itemId, legacyComment);
  const lastReadId = getLastReadCommentId(itemId, role);
  const lastReadIndex = lastReadId ? comments.findIndex((c) => c.id === lastReadId) : -1;
  const unseen = lastReadIndex === -1 ? comments : comments.slice(lastReadIndex + 1);

  return unseen.filter((c) => c.authorRole !== role).length;
}

export function hasUnreadComments(
  itemId: string,
  role: 'admin' | 'customer',
  legacyComment?: string | null
): boolean {
  return getUnreadCommentCount(itemId, role, legacyComment) > 0;
}

export function hasAnyUnreadComments(
  items: { id: string; comments: string | null }[],
  role: 'admin' | 'customer'
): boolean {
  return items.some((item) => hasUnreadComments(item.id, role, item.comments));
}

