import type { PrintStatus } from '../types/database';

export interface StatusConfig {
  label: PrintStatus;
  color: string;
  dotColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export function getStatusConfig(status: PrintStatus): StatusConfig {
  switch (status) {
    case 'Not Started':
      return {
        label: 'Not Started',
        color: 'var(--status-not-started)',
        dotColor: 'var(--status-not-started)',
        badgeBg: 'var(--tag-gray-bg)',
        badgeText: 'var(--tag-gray-text)',
        badgeBorder: 'var(--tag-gray-border)',
      };
    case 'Ready to print':
      return {
        label: 'Ready to print',
        color: 'var(--status-ready)',
        dotColor: 'var(--status-ready)',
        badgeBg: 'var(--tag-orange-bg)',
        badgeText: 'var(--tag-orange-text)',
        badgeBorder: 'var(--tag-orange-border)',
      };
    case 'Printing':
      return {
        label: 'Printing',
        color: 'var(--status-printing)',
        dotColor: 'var(--status-printing)',
        badgeBg: 'var(--tag-orange-bg)',
        badgeText: 'var(--tag-orange-text)',
        badgeBorder: 'var(--tag-orange-border)',
      };
    case 'Finished':
      return {
        label: 'Finished',
        color: 'var(--status-finished)',
        dotColor: 'var(--status-finished)',
        badgeBg: 'var(--tag-blue-bg)',
        badgeText: 'var(--tag-blue-text)',
        badgeBorder: 'var(--tag-blue-border)',
      };
    case 'Delivered':
      return {
        label: 'Delivered',
        color: 'var(--status-delivered)',
        dotColor: 'var(--status-delivered)',
        badgeBg: 'var(--tag-green-bg)',
        badgeText: 'var(--tag-green-text)',
        badgeBorder: 'var(--tag-green-border)',
      };
    case 'Failed':
      return {
        label: 'Failed',
        color: 'var(--status-failed)',
        dotColor: 'var(--status-failed)',
        badgeBg: 'var(--tag-rose-bg)',
        badgeText: 'var(--tag-rose-text)',
        badgeBorder: 'var(--tag-rose-border)',
      };
    default:
      return {
        label: status,
        color: 'var(--text-muted)',
        dotColor: 'var(--text-muted)',
        badgeBg: 'var(--tag-gray-bg)',
        badgeText: 'var(--tag-gray-text)',
        badgeBorder: 'var(--tag-gray-border)',
      };
  }
}

/**
 * Return a clear, rich background gradient for each status column.
 * Starts with a visible 26% color wash at the header that naturally dissolves
 * into transparent by 360px. Pure color tint over dark/light column surface with zero milky fog.
 */
export function getStatusGradient(status: PrintStatus): string {
  switch (status) {
    case 'Not Started':
      return 'linear-gradient(180deg, rgba(148, 163, 184, 0.22) 0%, rgba(148, 163, 184, 0.09) 120px, rgba(148, 163, 184, 0.02) 240px, transparent 360px)';
    case 'Ready to print':
      return 'linear-gradient(180deg, rgba(249, 115, 22, 0.26) 0%, rgba(249, 115, 22, 0.11) 120px, rgba(249, 115, 22, 0.03) 240px, transparent 360px)';
    case 'Printing':
      return 'linear-gradient(180deg, rgba(245, 158, 11, 0.26) 0%, rgba(245, 158, 11, 0.11) 120px, rgba(245, 158, 11, 0.03) 240px, transparent 360px)';
    case 'Finished':
      return 'linear-gradient(180deg, rgba(59, 130, 246, 0.26) 0%, rgba(59, 130, 246, 0.11) 120px, rgba(59, 130, 246, 0.03) 240px, transparent 360px)';
    case 'Delivered':
      return 'linear-gradient(180deg, rgba(34, 197, 94, 0.26) 0%, rgba(34, 197, 94, 0.11) 120px, rgba(34, 197, 94, 0.03) 240px, transparent 360px)';
    case 'Failed':
      return 'linear-gradient(180deg, rgba(239, 68, 68, 0.26) 0%, rgba(239, 68, 68, 0.11) 120px, rgba(239, 68, 68, 0.03) 240px, transparent 360px)';
    default:
      return 'none';
  }
}

export interface FilamentStyle {
  bg: string;
  border: string;
  text: string;
  dot: string;
}

export function getFilamentStyle(colorStr: string): FilamentStyle {
  const norm = colorStr.trim().toLowerCase();

  switch (norm) {
    case 'black':
      return {
        bg: 'rgba(100, 116, 139, 0.14)',
        border: 'rgba(100, 116, 139, 0.3)',
        text: 'var(--text-primary)',
        dot: '#0f172a',
      };
    case 'white':
      return {
        bg: 'rgba(255, 255, 255, 0.08)',
        border: 'rgba(203, 213, 225, 0.35)',
        text: 'var(--text-primary)',
        dot: '#f8fafc',
      };
    case 'grey':
    case 'gray':
      return {
        bg: 'rgba(148, 163, 184, 0.14)',
        border: 'rgba(148, 163, 184, 0.3)',
        text: 'var(--text-primary)',
        dot: '#94a3b8',
      };
    case 'orange':
      return {
        bg: 'rgba(249, 115, 22, 0.14)',
        border: 'rgba(249, 115, 22, 0.35)',
        text: 'var(--text-primary)',
        dot: '#f97316',
      };
    case 'green':
      return {
        bg: 'rgba(34, 197, 94, 0.14)',
        border: 'rgba(34, 197, 94, 0.35)',
        text: 'var(--text-primary)',
        dot: '#22c55e',
      };
    case 'blue':
      return {
        bg: 'rgba(59, 130, 246, 0.14)',
        border: 'rgba(59, 130, 246, 0.35)',
        text: 'var(--text-primary)',
        dot: '#3b82f6',
      };
    case 'red':
      return {
        bg: 'rgba(239, 68, 68, 0.14)',
        border: 'rgba(239, 68, 68, 0.35)',
        text: 'var(--text-primary)',
        dot: '#ef4444',
      };
    case 'yellow':
      return {
        bg: 'rgba(234, 179, 8, 0.14)',
        border: 'rgba(234, 179, 8, 0.35)',
        text: 'var(--text-primary)',
        dot: '#eab308',
      };
    case 'purple':
      return {
        bg: 'rgba(168, 85, 247, 0.14)',
        border: 'rgba(168, 85, 247, 0.35)',
        text: 'var(--text-primary)',
        dot: '#a855f7',
      };
    default:
      return {
        bg: 'rgba(148, 163, 184, 0.12)',
        border: 'rgba(148, 163, 184, 0.25)',
        text: 'var(--text-primary)',
        dot: '#94a3b8',
      };
  }
}

export function parseColors(colorStr: string | null | undefined): string[] {
  if (!colorStr) return [];
  return colorStr
    .split(/[,;/+&]/)
    .map((c) => c.trim())
    .filter(Boolean);
}

export function extractUrls(text: string | null | undefined): string[] {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s,]+)/g;
  const matches = text.match(urlRegex);
  return matches ? Array.from(new Set(matches)) : [];
}

export interface CommentAlert {
  label: string;
}

export function getCommentAlerts(comments: string | null | undefined): CommentAlert[] {
  if (!comments) return [];
  const lower = comments.toLowerCase();
  const alerts: CommentAlert[] = [];

  if (lower.includes('filament out') || lower.includes('out of filament')) {
    alerts.push({ label: 'Filament Out' });
  }
  if (lower.includes('urgent') || lower.includes('asap') || lower.includes('priority')) {
    alerts.push({ label: 'Urgent' });
  }
  if (lower.includes('reprint') || lower.includes('retry')) {
    alerts.push({ label: 'Reprint' });
  }
  if (lower.includes('qc') || lower.includes('quality check') || lower.includes('flaw')) {
    alerts.push({ label: 'QC Issue' });
  }

  return alerts;
}
