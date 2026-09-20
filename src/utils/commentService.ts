import type { ItemComment } from '../types/database';

// ---------------------------------------------------------------------------
// Read tracking (per-viewer-role, per-item, stored locally)
//
// Comment content itself lives in Supabase (see orderService.ts); this file
// only tracks, per device, which comments a viewer has already seen.
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

export function markItemCommentsRead(
  itemId: string,
  role: 'admin' | 'customer',
  comments: ItemComment[]
): void {
  try {
    const lastComment = comments[comments.length - 1];
    if (lastComment) {
      localStorage.setItem(`${READ_STORAGE_PREFIX}${role}_${itemId}`, lastComment.id);
    }
    window.dispatchEvent(new CustomEvent('comments-read', { detail: { itemId, role } }));
  } catch (err) {
    console.error('Error saving comment read state to localStorage', err);
  }
}

// Unread = comments from the other role that have has_been_seen = false in Supabase.
// If has_been_seen is true in Supabase, the comment is considered seen/read.
export function getUnreadCommentCount(
  itemId: string,
  role: 'admin' | 'customer',
  comments: ItemComment[]
): number {
  const otherRole = role === 'admin' ? 'customer' : 'admin';

  // Only consider comments from the other role that have NOT been seen (has_been_seen === false in Supabase)
  const unseen = comments.filter(
    (c) =>
      c.print_id === itemId &&
      c.author_role?.toLowerCase() === otherRole &&
      !c.has_been_seen
  );

  if (unseen.length === 0) return 0;

  // Watermark check: if locally read in this device's storage, honor that as well
  const lastReadId = getLastReadCommentId(itemId, role);
  if (lastReadId) {
    const lastReadIndex = unseen.findIndex((c) => c.id === lastReadId);
    if (lastReadIndex !== -1) {
      return unseen.slice(lastReadIndex + 1).length;
    }
  }

  return unseen.length;
}

export function hasUnreadComments(
  itemId: string,
  role: 'admin' | 'customer',
  comments: ItemComment[]
): boolean {
  return getUnreadCommentCount(itemId, role, comments) > 0;
}

export function hasAnyUnreadComments(
  comments: ItemComment[],
  printIds: string[],
  role: 'admin' | 'customer'
): boolean {
  const printIdSet = new Set(printIds);
  const otherRole = role === 'admin' ? 'customer' : 'admin';
  return comments.some(
    (c) =>
      printIdSet.has(c.print_id) &&
      c.author_role?.toLowerCase() === otherRole &&
      !c.has_been_seen
  );
}
