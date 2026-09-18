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

// Unread = comments from the other role, posted after this viewer's last read.
// `comments` must already be filtered to the item and sorted oldest-first.
export function getUnreadCommentCount(
  itemId: string,
  role: 'admin' | 'customer',
  comments: ItemComment[]
): number {
  const lastReadId = getLastReadCommentId(itemId, role);
  const lastReadIndex = lastReadId ? comments.findIndex((c) => c.id === lastReadId) : -1;
  const unseen = lastReadIndex === -1 ? comments : comments.slice(lastReadIndex + 1);

  return unseen.filter((c) => c.author_role !== role).length;
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
  return printIds.some((printId) =>
    hasUnreadComments(printId, role, comments.filter((c) => c.print_id === printId))
  );
}
