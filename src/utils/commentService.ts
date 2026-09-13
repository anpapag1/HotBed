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

