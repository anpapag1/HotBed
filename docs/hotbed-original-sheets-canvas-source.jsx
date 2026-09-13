/*
 * ORIGINAL SOURCE — Google Sheets / Gemini Canvas Kanban App
 * ------------------------------------------------------------
 * This is the original React component that ran embedded inside a
 * Google Sheets Gemini Canvas panel, reading/writing rows directly
 * to a Sheet (via `data`, `updateItem`, `deleteItem`, `insertItem`,
 * `moveItem`, `followLink` props supplied by the Canvas host).
 *
 * It is kept here purely as a REFERENCE for the Hotbed rebuild —
 * see print-order-tracker-spec.md for the target architecture
 * (Supabase + GitHub Pages, orders/prints tables, admin + public
 * views, etc). Component names, styling, status config, drag-and-
 * drop logic, and the multi-color filament UI here are all meant
 * to be reused/adapted; the data-access layer (Sheets row parsing,
 * `updateItem`/`insertItem`/etc.) is NOT — that gets replaced with
 * Supabase client calls per the spec.
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import * as dndKit from '@dnd-kit/core';
import * as dndKitSortable from '@dnd-kit/sortable';
import * as dndKitUtils from '@dnd-kit/utilities';
import {
  Printer,
  Clock,
  CheckCircle2,
  AlertOctagon,
  Sparkles,
  Plus,
  ExternalLink,
  Trash2,
  Edit2,
  Calendar,
  Layers,
  Search,
  Filter,
  X,
  ChevronDown,
  MessageSquare,
  Maximize2,
  Check,
  AlertCircle,
  Palette,
  CheckCheck,
  ChevronRight,
  PanelRightClose,
  Archive,
  Copy,
  Play,
  ArrowRight,
  ArrowUpDown,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';

const STATUS_CONFIG = {
  'Not Started': {
    id: 'Not Started',
    label: 'Not Started',
    saveValue: 'Not Started',
    color: '#475569',
    bgColor: '#f8fafc',
    badgeBg: '#f1f5f9',
    badgeText: '#475569',
    badgeBorder: '#cbd5e1',
    headerBg: '#f8fafc',
    headerBorder: '#e2e8f0',
    accentColor: '#64748b',
    dotColor: '#94a3b8',
    cardBorder: '#e2e8f0',
    icon: Clock,
  },
  'Ready to print': {
    id: 'Ready to print',
    label: 'Ready to print',
    saveValue: 'Ready to print ',
    color: '#c2410c',
    bgColor: '#fffaf5',
    badgeBg: '#ffedd5',
    badgeText: '#c2410c',
    badgeBorder: '#fed7aa',
    headerBg: '#fff7ed',
    headerBorder: '#ffedd5',
    accentColor: '#ea580c',
    dotColor: '#f97316',
    cardBorder: '#fed7aa',
    icon: Sparkles,
  },
  'Printing': {
    id: 'Printing',
    label: 'Printing',
    saveValue: 'Printing',
    color: '#a16207',
    bgColor: '#fefce8',
    badgeBg: '#fef9c3',
    badgeText: '#854d0e',
    badgeBorder: '#fde047',
    headerBg: '#fefce8',
    headerBorder: '#fef08a',
    accentColor: '#ca8a04',
    dotColor: '#eab308',
    cardBorder: '#fef08a',
    icon: Printer,
  },
  'Finished': {
    id: 'Finished',
    label: 'Finished',
    saveValue: 'Finished ',
    color: '#1d4ed8',
    bgColor: '#eff6ff',
    badgeBg: '#dbeafe',
    badgeText: '#1e40af',
    badgeBorder: '#bfdbfe',
    headerBg: '#eff6ff',
    headerBorder: '#dbeafe',
    accentColor: '#2563eb',
    dotColor: '#3b82f6',
    cardBorder: '#bfdbfe',
    icon: CheckCheck,
  },
  'Delivered': {
    id: 'Delivered',
    label: 'Delivered',
    saveValue: 'Delivered ',
    color: '#15803d',
    bgColor: '#f0fdf4',
    badgeBg: '#dcfce7',
    badgeText: '#166534',
    badgeBorder: '#86efac',
    headerBg: '#f0fdf4',
    headerBorder: '#bbf7d0',
    accentColor: '#16a34a',
    dotColor: '#22c55e',
    cardBorder: '#bbf7d0',
    icon: CheckCircle2,
  },
  'Failed': {
    id: 'Failed',
    label: 'Failed',
    saveValue: 'Failed',
    color: '#b91c1c',
    bgColor: '#fef2f2',
    badgeBg: '#fee2e2',
    badgeText: '#991b1b',
    badgeBorder: '#fca5a5',
    headerBg: '#fef2f2',
    headerBorder: '#fecaca',
    accentColor: '#dc2626',
    dotColor: '#ef4444',
    cardBorder: '#fecaca',
    icon: AlertOctagon,
  },
  'Unset': {
    id: 'Unset',
    label: 'Unset',
    saveValue: '',
    color: '#6b7280',
    bgColor: '#f9fafb',
    badgeBg: '#f3f4f6',
    badgeText: '#4b5563',
    badgeBorder: '#e5e7eb',
    headerBg: '#f9fafb',
    headerBorder: '#e5e7eb',
    accentColor: '#9ca3af',
    dotColor: '#9ca3af',
    cardBorder: '#e5e7eb',
    icon: Layers,
  }
};

const ALL_STATUS_OPTIONS = ['Not Started', 'Ready to print', 'Printing', 'Finished', 'Delivered', 'Failed'];
const BOARD_COLUMNS = ['Not Started', 'Ready to print', 'Printing', 'Finished', 'Failed'];

function getStatusKey(rawStatus) {
  if (rawStatus === null || rawStatus === undefined || String(rawStatus).trim() === '') {
    return 'Unset';
  }
  const s = String(rawStatus).trim();
  if (STATUS_CONFIG[s]) return s;
  const match = Object.keys(STATUS_CONFIG).find(
    k => k.toLowerCase() === s.toLowerCase()
  );
  return match || 'Unset';
}

function parseColors(colorStr) {
  if (!colorStr || typeof colorStr !== 'string') return [];
  if (/[,/;\+]/.test(colorStr)) {
    return colorStr
      .split(/[,/;\+]/)
      .map(c => c.trim())
      .filter(Boolean);
  }
  const trimmed = colorStr.trim();
  return trimmed ? [trimmed] : [];
}

function getFilamentStyle(colorStr) {
  if (!colorStr) return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1', dot: '#94a3b8' };
  const s = String(colorStr).trim().toLowerCase();
  if (s.includes('black') || s.includes('μαυρ') || s.includes('mavr')) {
    return { bg: '#1e293b', text: '#ffffff', border: '#334155', dot: '#0f172a' };
  }
  if (s.includes('white') || s.includes('λευκ') || s.includes('ασπρ') || s.includes('leuk') || s.includes('aspr')) {
    return { bg: '#ffffff', text: '#334155', border: '#cbd5e1', dot: '#e2e8f0' };
  }
  if (s.includes('gray') || s.includes('grey') || s.includes('γκρι') || s.includes('gri')) {
    return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1', dot: '#94a3b8' };
  }
  if (s.includes('green') || s.includes('πρασιν') || s.includes('prasin')) {
    return { bg: '#dcfce7', text: '#15803d', border: '#86efac', dot: '#22c55e' };
  }
  if (s.includes('purple') || s.includes('μωβ') || s.includes('mov')) {
    return { bg: '#f3e8ff', text: '#7e22ce', border: '#d8b4fe', dot: '#a855f7' };
  }
  if (s.includes('red') || s.includes('κοκκιν') || s.includes('kokkin')) {
    return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5', dot: '#ef4444' };
  }
  if (s.includes('blue') || s.includes('μπλε') || s.includes('ble')) {
    return { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd', dot: '#3b82f6' };
  }
  if (s.includes('yellow') || s.includes('κιτριν') || s.includes('kitrin')) {
    return { bg: '#fef9c3', text: '#a16207', border: '#fde047', dot: '#eab308' };
  }
  if (s.includes('orange') || s.includes('πορτοκαλ') || s.includes('portokal')) {
    return { bg: '#ffedd5', text: '#c2410c', border: '#fed7aa', dot: '#f97316' };
  }
  if (s.includes('pink') || s.includes('ροζ')) {
    return { bg: '#fce7f3', text: '#be185d', border: '#fbcfe8', dot: '#ec4899' };
  }
  return { bg: '#f8fafc', text: '#334155', border: '#cbd5e1', dot: '#6366f1' };
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  if (typeof dateStr !== 'string') return String(dateStr);
  const parts = dateStr.trim().split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }
  return dateStr;
}

function extractUrls(linkStr) {
  if (!linkStr || typeof linkStr !== 'string') return [];
  const matches = linkStr.match(/https?:\/\/[^\s,]+/g);
  return matches || [];
}

function getCommentAlerts(comments) {
  if (!comments || typeof comments !== 'string') return [];
  const lower = comments.toLowerCase();
  const alerts = [];
  if (lower.includes('teleiose') || lower.includes('ran out') || lower.includes('filament') || lower.includes('plastiko')) {
    alerts.push({ label: 'Filament Out', icon: AlertTriangle, color: 'text-amber-800 bg-amber-100 border-amber-300' });
  }
  if (lower.includes('espase') || lower.includes('broke') || lower.includes('failed') || lower.includes('den vgenoun')) {
    alerts.push({ label: 'Print Defect', icon: AlertCircle, color: 'text-red-700 bg-red-100 border-red-300' });
  }
  if (lower.includes('ftiakse') || lower.includes('δυο') || lower.includes('duo') || lower.includes(' 2') || lower.includes('2,')) {
    alerts.push({ label: 'Multi-Copy', icon: Copy, color: 'text-blue-700 bg-blue-100 border-blue-300' });
  }
  return alerts;
}

function CardContent({
  item,
  onEdit,
  onDelete,
  onDuplicate,
  onChangeStatus,
  followLink,
  isOverlay = false,
}) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!showStatusMenu) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowStatusMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showStatusMenu]);

  const statusConfig = STATUS_CONFIG[item.statusKey] || STATUS_CONFIG['Unset'];
  const colors = parseColors(item.xroma);
  const urls = extractUrls(item.link);
  const hasTextModelName = item.link && urls.length === 0 && String(item.link).trim().length > 0;

  let scaleLabel = null;
  if (item.megethos !== null && item.megethos !== undefined && item.megethos !== '') {
    const num = parseFloat(item.megethos);
    if (!isNaN(num)) {
      scaleLabel = `${Math.round(num * 100)}%`;
    }
  }

  const isWarningComment = item.comments && (
    item.comments.toLowerCase().includes('espase') ||
    item.comments.toLowerCase().includes('failed') ||
    item.comments.toLowerCase().includes('teleiose') ||
    item.statusKey === 'Failed'
  );
  const commentAlerts = getCommentAlerts(item.comments);

  return (
    <div
      className={`bg-white rounded-xl border p-3.5 flex flex-col gap-2.5 transition-all select-none ${
        isOverlay
          ? 'shadow-2xl ring-2 ring-blue-500/20'
          : 'shadow-sm hover:shadow-md hover:border-slate-300 border-slate-200'
      }`}
    >
      {/* Top Bar: Badges and Action Controls */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {/* Filament Color Badges (Single or Multi-Color) */}
          {colors.length > 0 ? (
            colors.map((clr, idx) => {
              const filamentStyle = getFilamentStyle(clr);
              return (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 max-w-[150px] truncate shadow-2xs"
                  style={{
                    backgroundColor: filamentStyle.bg,
                    color: filamentStyle.text,
                    borderColor: filamentStyle.border,
                  }}
                  title={`Color: ${clr}`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: filamentStyle.dot }}
                  />
                  <span className="truncate">{clr}</span>
                </span>
              );
            })
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-slate-200 text-slate-400 bg-slate-50 shrink-0">
              <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
              <span>Unspecified</span>
            </span>
          )}

          {/* Scale Badge */}
          {scaleLabel && (
            <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
              {scaleLabel}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        {!isOverlay && (
          <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (onDuplicate) onDuplicate(item);
              }}
              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              title="Duplicate print (batch printing)"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(item);
              }}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
              title="Edit print"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item);
              }}
              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="Delete print"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Description / Part Title */}
      <div className="text-slate-900 font-medium text-sm leading-snug break-words">
        {item.perigrafi || (
          <span className="text-slate-400 italic">No description provided</span>
        )}
      </div>

      {/* Text Model Name if Link column contains title */}
      {hasTextModelName && (
        <div className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100 truncate">
          <span className="font-semibold text-slate-600">Model: </span>
          {item.link}
        </div>
      )}

      {/* External MakerWorld URLs */}
      {urls.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {urls.map((url, idx) => (
            <button
              key={idx}
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (typeof followLink === 'function') {
                  followLink(url);
                }
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/60 transition-colors"
              title={url}
            >
              <ExternalLink className="w-3 h-3 text-blue-600" />
              <span>{urls.length > 1 ? `Model Link ${idx + 1}` : 'MakerWorld Model'}</span>
            </button>
          ))}
        </div>
      )}

      {/* Smart Alert Badges detected from notes */}
      {commentAlerts.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {commentAlerts.map((alert, aIdx) => {
            const AlertIcon = alert.icon;
            return (
              <span
                key={aIdx}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${alert.color}`}
              >
                <AlertIcon className="w-2.5 h-2.5" />
                <span>{alert.label}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Comments & Notes Box */}
      {item.comments && (
        <div
          className={`px-2.5 py-1.5 rounded-lg text-xs border whitespace-pre-line ${
            isWarningComment
              ? 'bg-amber-50 text-amber-900 border-amber-200/80'
              : 'bg-slate-50 text-slate-700 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-1 mb-0.5 font-semibold text-[11px] opacity-75">
            <MessageSquare className="w-3 h-3 shrink-0" />
            <span>Notes</span>
          </div>
          <p className="leading-relaxed">{item.comments}</p>
        </div>
      )}

      {/* Quick 1-Click Workflow Progression */}
      {!isOverlay && (
        <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-1 text-[11px]">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Next Step:</span>
          {item.statusKey === 'Not Started' && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onChangeStatus(item, 'Ready to print');
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 transition-colors cursor-pointer"
              title="Queue for printing"
            >
              <span>Queue Print</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
          {item.statusKey === 'Ready to print' && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onChangeStatus(item, 'Printing');
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer"
              title="Mark as currently printing"
            >
              <Play className="w-2.5 h-2.5 fill-current" />
              <span>Start Printing</span>
            </button>
          )}
          {item.statusKey === 'Printing' && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onChangeStatus(item, 'Finished');
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                title="Mark Finished"
              >
                <Check className="w-3 h-3" />
                <span>Finished</span>
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onChangeStatus(item, 'Failed');
                }}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
                title="Mark Failed"
              >
                <span>Fail</span>
              </button>
            </div>
          )}
          {item.statusKey === 'Finished' && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onChangeStatus(item, 'Delivered');
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
              title="Deliver to recipient"
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Deliver</span>
            </button>
          )}
          {item.statusKey === 'Failed' && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onChangeStatus(item, 'Ready to print');
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors cursor-pointer"
              title="Retry this print"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry Print</span>
            </button>
          )}
          {item.statusKey === 'Delivered' && (
            <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Complete
            </span>
          )}
        </div>
      )}

      {/* Footer: Date & Status Tag / Selector */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
        {/* Date */}
        <div className="flex items-center gap-1 text-slate-500 shrink-0">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{formatDate(item.date) || 'No date'}</span>
        </div>

        {/* Status Chip with Dropdown */}
        {!isOverlay ? (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setShowStatusMenu(!showStatusMenu);
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border transition-all hover:brightness-95"
              style={{
                backgroundColor: statusConfig.badgeBg,
                color: statusConfig.badgeText,
                borderColor: statusConfig.badgeBorder,
              }}
              title="Click to switch status"
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: statusConfig.dotColor }}
              />
              <span>{statusConfig.label}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {showStatusMenu && (
              <div className="absolute right-0 bottom-full mb-1 z-50 w-44 bg-white rounded-xl shadow-xl border border-slate-200 p-1 space-y-0.5">
                <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Move to Status
                </div>
                {ALL_STATUS_OPTIONS.map((colKey) => {
                  const cfg = STATUS_CONFIG[colKey];
                  const isCurrent = item.statusKey === colKey;
                  return (
                    <button
                      key={colKey}
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowStatusMenu(false);
                        if (!isCurrent) {
                          onChangeStatus(item, colKey);
                        }
                      }}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-medium text-left transition-colors ${
                        isCurrent
                          ? 'bg-slate-100 text-slate-900 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: cfg.dotColor }}
                        />
                        <span>{cfg.label}</span>
                      </div>
                      {isCurrent && <Check className="w-3.5 h-3.5 text-slate-600" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border"
            style={{
              backgroundColor: statusConfig.badgeBg,
              color: statusConfig.badgeText,
              borderColor: statusConfig.badgeBorder,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: statusConfig.dotColor }}
            />
            <span>{statusConfig.label}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function SortableCard({
  item,
  onEdit,
  onDelete,
  onDuplicate,
  onChangeStatus,
  followLink,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = dndKitSortable.useSortable({
    id: `item-${item.index_}`,
    data: { type: 'Item', item },
  });

  const style = {
    transform: dndKitUtils.CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group cursor-grab active:cursor-grabbing focus:outline-none touch-manipulation"
    >
      <CardContent
        item={item}
        onEdit={onEdit}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onChangeStatus={onChangeStatus}
        followLink={followLink}
      />
    </div>
  );
}

function KanbanColumn({
  columnKey,
  config,
  items,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onDuplicateItem,
  onChangeStatus,
  followLink,
}) {
  const { setNodeRef, isOver } = dndKit.useDroppable({
    id: `col-${columnKey}`,
  });

  const itemIds = useMemo(() => items.map(it => `item-${it.index_}`), [items]);
  const IconComponent = config.icon || Layers;

  return (
    <div
      id={`col-board-${columnKey}`}
      ref={setNodeRef}
      className={`flex flex-col w-[86vw] max-w-[340px] sm:w-80 shrink-0 snap-center rounded-2xl border transition-colors duration-150 ${
        isOver
          ? 'ring-2 ring-blue-500 ring-offset-2 bg-blue-50/30 border-blue-300'
          : 'bg-slate-50/80 border-slate-200'
      }`}
      style={{ minHeight: '440px', maxHeight: 'calc(100dvh - 190px)' }}
    >
      {/* Column Header */}
      <div
        className="p-3 border-b rounded-t-2xl flex items-center justify-between sticky top-0 bg-inherit z-10"
        style={{
          backgroundColor: config.headerBg,
          borderBottomColor: config.headerBorder,
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
            style={{ backgroundColor: config.badgeBg, color: config.color }}
          >
            <IconComponent className="w-4 h-4" />
          </div>
          <div className="truncate">
            <h3 className="font-bold text-sm text-slate-800 truncate">
              {config.label}
            </h3>
          </div>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0"
            style={{
              backgroundColor: config.badgeBg,
              color: config.badgeText,
              borderColor: config.badgeBorder,
            }}
          >
            {items.length}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onAddItem(columnKey)}
          className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white/80 transition-colors shadow-none hover:shadow-sm"
          title={`Add print to ${config.label}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Column Cards Container */}
      <div className="p-2.5 flex-1 overflow-y-auto space-y-2.5">
        <dndKitSortable.SortableContext
          items={itemIds}
          strategy={dndKitSortable.verticalListSortingStrategy}
        >
          {items.map(item => (
            <SortableCard
              key={item.index_}
              item={item}
              onEdit={onEditItem}
              onDelete={onDeleteItem}
              onDuplicate={onDuplicateItem}
              onChangeStatus={onChangeStatus}
              followLink={followLink}
            />
          ))}
        </dndKitSortable.SortableContext>

        {items.length === 0 && (
          <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-4 text-center">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center mb-1.5 opacity-60"
              style={{ backgroundColor: config.badgeBg, color: config.color }}
            >
              <IconComponent className="w-3.5 h-3.5" />
            </div>
            <p className="text-xs font-medium text-[#647387]">No prints in this status</p>
            <button
              type="button"
              onClick={() => onAddItem(columnKey)}
              className="mt-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 underline decoration-slate-300"
            >
              + Add print
            </button>
          </div>
        )}
      </div>

      {/* Quick Add Footer Button */}
      <div className="p-2 border-t border-slate-200/80 bg-white/40 rounded-b-2xl">
        <button
          type="button"
          onClick={() => onAddItem(columnKey)}
          className="w-full py-1.5 px-3 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-white flex items-center justify-center gap-1.5 transition-all border border-transparent hover:border-slate-200 shadow-none hover:shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add print to {config.label}</span>
        </button>
      </div>
    </div>
  );
}

function ItemModal({ isOpen, mode, item, defaultStatus, onClose, onSave }) {
  const [formData, setFormData] = useState({
    perigrafi: '',
    status: 'Not Started',
    megethos: '100%',
    link: '',
    date: '',
    comments: '',
  });
  const [selectedColors, setSelectedColors] = useState(['Black']);
  const [customColorInput, setCustomColorInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && item) {
        let sizeVal = '100%';
        if (item.megethos !== null && item.megethos !== undefined) {
          const num = parseFloat(item.megethos);
          sizeVal = !isNaN(num) ? `${Math.round(num * 100)}%` : String(item.megethos);
        }
        setFormData({
          perigrafi: item.perigrafi || '',
          status: item.statusKey || 'Not Started',
          megethos: sizeVal,
          link: item.link || '',
          date: item.date || new Date().toISOString().split('T')[0],
          comments: item.comments || '',
        });
        const parsed = parseColors(item.xroma);
        setSelectedColors(parsed.length > 0 ? parsed : ['Black']);
        setCustomColorInput('');
      } else {
        setFormData({
          perigrafi: '',
          status: defaultStatus || 'Not Started',
          megethos: '100%',
          link: '',
          date: new Date().toISOString().split('T')[0],
          comments: '',
        });
        setSelectedColors(['Black']);
        setCustomColorInput('');
      }
    }
  }, [isOpen, mode, item, defaultStatus]);

  if (!isOpen) return null;

  const handleTogglePreset = (presetName) => {
    const existingIndex = selectedColors.findIndex(
      c => c.toLowerCase() === presetName.toLowerCase()
    );
    if (existingIndex !== -1) {
      setSelectedColors(selectedColors.filter((_, idx) => idx !== existingIndex));
    } else {
      setSelectedColors([...selectedColors, presetName]);
    }
  };

  const handleRemoveColor = (indexToRemove) => {
    setSelectedColors(selectedColors.filter((_, idx) => idx !== indexToRemove));
  };

  const handleAddCustomColor = (e) => {
    if (e) e.preventDefault();
    const trimmed = customColorInput.trim();
    if (!trimmed) return;
    const parts = trimmed.split(/[,/;\+]/).map(p => p.trim()).filter(Boolean);
    const toAdd = parts.filter(
      p => !selectedColors.some(c => c.toLowerCase() === p.toLowerCase())
    );
    if (toAdd.length > 0) {
      setSelectedColors([...selectedColors, ...toAdd]);
    }
    setCustomColorInput('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.perigrafi.trim()) return;

    let numericMegethos = 1.0;
    if (formData.megethos) {
      const cleaned = formData.megethos.replace('%', '').trim();
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) {
        numericMegethos = parsed > 2 ? parsed / 100 : parsed;
      }
    }

    // Build finalized colors string (comma separated)
    let finalColors = [...selectedColors];
    if (customColorInput.trim()) {
      const parts = customColorInput.trim().split(/[,/;\+]/).map(p => p.trim()).filter(Boolean);
      for (const p of parts) {
        if (!finalColors.some(c => c.toLowerCase() === p.toLowerCase())) {
          finalColors.push(p);
        }
      }
    }
    const finalXroma = finalColors.length > 0 ? finalColors.join(', ') : 'Black';

    onSave({
      ...formData,
      xroma: finalXroma,
      megethos: numericMegethos,
    });
  };

  const colorPresets = [
    { name: 'Black', hex: '#0f172a' },
    { name: 'Gray', hex: '#94a3b8' },
    { name: 'White', hex: '#e2e8f0', border: true },
    { name: 'Green', hex: '#22c55e' },
    { name: 'Purple', hex: '#a855f7' },
    { name: 'Red', hex: '#ef4444' },
    { name: 'Blue', hex: '#3b82f6' },
    { name: 'Yellow', hex: '#eab308' },
    { name: 'Orange', hex: '#f97316' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in duration-150 max-h-[92dvh] flex flex-col">
        {/* Modal Header */}
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Printer className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-sm sm:text-base text-slate-900 truncate">
              {mode === 'edit' ? 'Edit 3D Print Job' : 'Add New 3D Print Job'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 sm:space-y-4 overflow-y-auto flex-1">
          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Part Description / Model Name <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={formData.perigrafi}
              onChange={(e) => setFormData({ ...formData, perigrafi: e.target.value })}
              placeholder="e.g. Dummy 13 skull head, dual swords, skeleton body..."
              className="w-full text-base sm:text-sm rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
            />
          </div>

          {/* Status & Size Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Print Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full text-base sm:text-sm rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
              >
                {ALL_STATUS_OPTIONS.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Scale / Size (% or ratio)
                </label>
                <div className="flex gap-1">
                  {['50%', '100%', '150%'].map((presetScale) => (
                    <button
                      key={presetScale}
                      type="button"
                      onClick={() => setFormData({ ...formData, megethos: presetScale })}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold transition-colors"
                    >
                      {presetScale}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="text"
                value={formData.megethos}
                onChange={(e) => setFormData({ ...formData, megethos: e.target.value })}
                placeholder="100% or 1.0"
                className="w-full text-base sm:text-sm rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Multiple Filament Colors Selection */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-blue-600" />
                <span>Filament Colors</span>
                <span className="text-[11px] font-normal text-slate-500">
                  ({selectedColors.length} {selectedColors.length === 1 ? 'color' : 'colors'})
                </span>
              </label>
              {selectedColors.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedColors([])}
                  className="text-[11px] font-medium text-slate-400 hover:text-red-600 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Active Color Chips */}
            <div className="min-h-[38px] p-2 bg-white border border-slate-200 rounded-xl flex flex-wrap items-center gap-1.5">
              {selectedColors.length > 0 ? (
                selectedColors.map((colorName, idx) => {
                  const st = getFilamentStyle(colorName);
                  return (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-xs font-medium border shadow-2xs transition-all"
                      style={{
                        backgroundColor: st.bg,
                        color: st.text,
                        borderColor: st.border,
                      }}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: st.dot }}
                      />
                      <span className="font-semibold">{colorName}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveColor(idx)}
                        className="p-0.5 rounded-full hover:bg-black/10 transition-colors ml-0.5"
                        title={`Remove ${colorName}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })
              ) : (
                <span className="text-xs text-slate-400 italic px-1">
                  No colors selected. Click presets below or add custom colors.
                </span>
              )}
            </div>

            {/* Quick Toggle Color Presets */}
            <div>
              <div className="text-[11px] font-medium text-slate-500 mb-1.5">
                Click presets to toggle / add multiple colors:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {colorPresets.map((preset) => {
                  const isSelected = selectedColors.some(
                    c => c.toLowerCase() === preset.name.toLowerCase()
                  );
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleTogglePreset(preset.name)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                        isSelected
                          ? 'bg-blue-50 border-blue-400 text-blue-800 ring-1 ring-blue-300 font-semibold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${preset.border ? 'border border-slate-300' : ''}`}
                        style={{ backgroundColor: preset.hex }}
                      />
                      <span>{preset.name}</span>
                      {isSelected && <Check className="w-3 h-3 text-blue-600 ml-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Color Input */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
              <input
                type="text"
                value={customColorInput}
                onChange={(e) => setCustomColorInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomColor();
                  }
                }}
                placeholder="Add another color..."
                className="flex-1 text-base sm:text-xs rounded-xl border border-slate-300 px-3 py-1.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
              />
              <button
                type="button"
                onClick={handleAddCustomColor}
                disabled={!customColorInput.trim()}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 disabled:opacity-40 disabled:hover:bg-slate-200 transition-colors flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* MakerWorld Link / Model Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              MakerWorld Link or Reference Title
            </label>
            <input
              type="text"
              value={formData.link}
              onChange={(e) => setFormData({ ...formData, link: e.target.value })}
              placeholder="https://makerworld.com/en/models/..."
              className="w-full text-base sm:text-xs rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Date Logged
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full text-base sm:text-sm rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
            />
          </div>

          {/* Comments */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Comments & Print Notes
              </label>
              <span className="text-[10px] text-slate-400">Quick presets</span>
            </div>
            <textarea
              rows={2}
              value={formData.comments}
              onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
              placeholder="e.g. ran out of filament, nozzle details, print that shiiiiiiit..."
              className="w-full text-base sm:text-sm rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {[
                'Print 2 copies',
                'Ran out of filament',
                'High detail nozzle',
                'Failed / Broke'
              ].map((snippet) => (
                <button
                  key={snippet}
                  type="button"
                  onClick={() => {
                    const current = formData.comments.trim();
                    const updated = current ? `${current}\n${snippet}` : snippet;
                    setFormData({ ...formData, comments: updated });
                  }}
                  className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 font-medium transition-colors"
                >
                  + {snippet}
                </button>
              ))}
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all"
            >
              {mode === 'edit' ? 'Save Changes' : 'Create Print Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ isOpen, item, onClose, onConfirm }) {
  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-4 sm:p-5 space-y-4 animate-in fade-in duration-150">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">Delete Print Record</h3>
            <p className="text-xs text-slate-500">This action will remove the print from the tracker.</p>
          </div>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs text-slate-700 font-medium break-words">
          {item.perigrafi || 'Untitled print'}
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 shadow-sm transition-all"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickDeliverDropTarget({ isDragging }) {
  const { setNodeRef, isOver } = dndKit.useDroppable({
    id: 'col-Delivered-quick',
  });

  if (!isDragging) return null;

  return (
    <div
      ref={setNodeRef}
      className={`fixed right-3 bottom-3 sm:right-5 sm:bottom-6 z-40 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl shadow-xl border-2 flex items-center gap-2.5 sm:gap-3 transition-all ${
        isOver
          ? 'bg-emerald-600 text-white border-white scale-105 ring-4 ring-emerald-300'
          : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
      }`}
    >
      <CheckCircle2 className="w-5 h-5 shrink-0" />
      <div>
        <div className="text-xs font-bold leading-tight">Drop here to Deliver</div>
        <div className="text-[10px] opacity-80">Moves to Delivered sidebar</div>
      </div>
    </div>
  );
}

function DeliveredSidebar({
  isOpen,
  onClose,
  items,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onDuplicateItem,
  onChangeStatus,
  followLink,
}) {
  const { setNodeRef, isOver } = dndKit.useDroppable({
    id: 'col-Delivered',
  });
  const itemIds = useMemo(() => items.map(it => `item-${it.index_}`), [items]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Slide-out Sidebar Drawer */}
      <aside
        ref={setNodeRef}
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white shadow-2xl border-l border-slate-200 flex flex-col transition-all animate-in slide-in-from-right duration-200 ${
          isOver ? 'ring-4 ring-emerald-500/40 bg-emerald-50/20' : ''
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-emerald-100 bg-emerald-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-slate-900 leading-tight">
                  Delivered Prints
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                  {items.length}
                </span>
              </div>
              <p className="text-xs text-slate-500">Archived completed prints</p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onAddItem('Delivered')}
              className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 rounded-lg transition-colors"
              title="Add delivered print"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drop Zone Notification */}
        <div className="px-4 py-2 bg-emerald-100/60 border-b border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
          <span className="font-medium flex items-center gap-1.5">
            <Archive className="w-3.5 h-3.5 text-emerald-700" />
            <span>Drop or move prints here</span>
          </span>
          <button
            type="button"
            onClick={() => onAddItem('Delivered')}
            className="font-bold hover:underline text-[11px] text-emerald-800"
          >
            + Add Print
          </button>
        </div>

        {/* Scrollable Items Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/60">
          <dndKitSortable.SortableContext
            items={itemIds}
            strategy={dndKitSortable.verticalListSortingStrategy}
          >
            {items.map(item => (
              <SortableCard
                key={item.index_}
                item={item}
                onEdit={onEditItem}
                onDelete={onDeleteItem}
                onDuplicate={onDuplicateItem}
                onChangeStatus={onChangeStatus}
                followLink={followLink}
              />
            ))}
          </dndKitSortable.SortableContext>

          {items.length === 0 && (
            <div className="h-44 flex flex-col items-center justify-center border-2 border-dashed border-emerald-200 rounded-2xl p-6 text-center bg-white">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-slate-700">No delivered prints</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Drag prints here or use the card status menu to mark them as delivered.
              </p>
              <button
                type="button"
                onClick={() => onAddItem('Delivered')}
                className="mt-3 text-xs font-semibold text-emerald-700 hover:text-emerald-800 px-3 py-1 bg-emerald-50 rounded-lg border border-emerald-200 transition-colors"
              >
                + Add print to Delivered
              </button>
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-500">
          <span>{items.length} {items.length === 1 ? 'item delivered' : 'items delivered'}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </aside>
    </>
  );
}

function App({ data, updateItem, deleteItem, insertItem, moveItem, followLink }) {
  const [activeId, setActiveId] = useState(null);
  const [isDeliveredSidebarOpen, setIsDeliveredSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [colorFilter, setColorFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('sheet');

  const [modalState, setModalState] = useState({
    isOpen: false,
    mode: 'create',
    item: null,
    defaultStatus: 'Not Started',
  });

  const [deleteItemTarget, setDeleteItemTarget] = useState(null);

  // Dynamic Header Row Detection
  const { headerRow, headerIndex, colIndices } = useMemo(() => {
    let foundIndex = 0;
    let foundRow = [];

    for (const item of data) {
      if (item && Array.isArray(item.row)) {
        const isHeader = item.row.some(cell => {
          if (typeof cell !== 'string') return false;
          const lower = cell.toLowerCase().trim();
          return lower === 'status' || lower === 'perigrafi' || lower === 'megethos';
        });
        if (isHeader) {
          foundIndex = item.index_;
          foundRow = item.row;
          break;
        }
      }
    }

    const headers = foundRow || [];
    const getIdx = (candidates, fallback) => {
      const idx = headers.findIndex(h => {
        if (typeof h !== 'string') return false;
        const s = h.toLowerCase().trim();
        return candidates.includes(s);
      });
      return idx !== -1 ? idx : fallback;
    };

    return {
      headerRow: headers,
      headerIndex: foundIndex,
      colIndices: {
        link: getIdx(['link', 'url'], 0),
        date: getIdx(['date', 'imerominia'], 1),
        perigrafi: getIdx(['perigrafi', 'description', 'title', 'name'], 2),
        megethos: getIdx(['megethos', 'size', '% megethos', 'scale'], 3),
        xroma: getIdx(['xroma', 'color', 'filament'], 4),
        status: getIdx(['status', 'katastasi'], 5),
        comments: getIdx(['comments', 'comment', 'sxolia', 'notes'], 6),
        image: getIdx(['image', 'picture', 'photo', 'eikona', 'img', 'fotografia', 'pic'], 7),
      }
    };
  }, [data]);

  // Parse Rows into Clean Kanban Items
  const items = useMemo(() => {
    const list = [];
    for (const envelope of data) {
      if (!envelope || envelope.index_ <= headerIndex) continue;
      const row = envelope.row;
      if (!row || !Array.isArray(row)) continue;

      // Skip completely blank rows
      const isEmpty = row.every(c => c === null || c === undefined || String(c).trim() === '');
      if (isEmpty) continue;

      const rawStatus = row[colIndices.status];
      const statusKey = getStatusKey(rawStatus);

      list.push({
        index_: envelope.index_,
        rawRow: row,
        link: row[colIndices.link],
        date: row[colIndices.date],
        perigrafi: row[colIndices.perigrafi],
        megethos: row[colIndices.megethos],
        xroma: row[colIndices.xroma],
        rawStatus: rawStatus,
        statusKey: statusKey,
        comments: row[colIndices.comments],
      });
    }
    return list;
  }, [data, headerIndex, colIndices]);

  // Filter Items
  const filteredItems = useMemo(() => {
    return items.filter(it => {
      if (colorFilter !== 'ALL') {
        const itemColor = it.xroma ? String(it.xroma).trim().toLowerCase() : '';
        const parsedColors = parseColors(it.xroma);

        if (colorFilter === 'Multi-color') {
          const isMulti = parsedColors.length > 1 || itemColor.includes('kai') || itemColor.includes('και');
          if (!isMulti) return false;
        } else if (colorFilter === 'Custom') {
          const isStandard = ['black', 'green', 'gray', 'grey', 'purple', 'white', 'red', 'blue', 'yellow', 'orange'].some(c =>
            itemColor.includes(c) ||
            itemColor.includes('μαυρ') ||
            itemColor.includes('πρασιν') ||
            itemColor.includes('γκρι') ||
            itemColor.includes('μωβ')
          );
          if (isStandard) return false;
        } else {
          const target = colorFilter.toLowerCase();
          const matches = parsedColors.some(c => c.toLowerCase().includes(target)) ||
            itemColor.includes(target) ||
            (target === 'black' && (itemColor.includes('μαυρ') || itemColor.includes('mavr'))) ||
            (target === 'green' && (itemColor.includes('πρασιν') || itemColor.includes('prasin'))) ||
            (target === 'gray' && (itemColor.includes('γκρι') || itemColor.includes('gri') || itemColor.includes('grey'))) ||
            (target === 'purple' && (itemColor.includes('μωβ') || itemColor.includes('mov')));
          if (!matches) return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesPerigrafi = it.perigrafi && String(it.perigrafi).toLowerCase().includes(q);
        const matchesComments = it.comments && String(it.comments).toLowerCase().includes(q);
        const matchesColor = it.xroma && String(it.xroma).toLowerCase().includes(q);
        const matchesLink = it.link && String(it.link).toLowerCase().includes(q);
        if (!matchesPerigrafi && !matchesComments && !matchesColor && !matchesLink) {
          return false;
        }
      }

      return true;
    });
  }, [items, searchQuery, colorFilter]);

  // Sort Filtered Items
  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    if (sortBy === 'date-desc') {
      return list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    }
    if (sortBy === 'date-asc') {
      return list.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    }
    if (sortBy === 'name-asc') {
      return list.sort((a, b) => String(a.perigrafi || '').localeCompare(String(b.perigrafi || '')));
    }
    if (sortBy === 'scale-desc') {
      return list.sort((a, b) => (Number(b.megethos) || 1) - (Number(a.megethos) || 1));
    }
    return list;
  }, [filteredItems, sortBy]);

  // Separate Delivered items for the sidebar
  const deliveredItems = useMemo(() => {
    return sortedItems.filter(it => it.statusKey === 'Delivered');
  }, [sortedItems]);

  // Ensure every board category is ALWAYS displayed, even if it is not active (0 items)
  const boardCategories = useMemo(() => {
    const cats = [...BOARD_COLUMNS];
    // Include any custom category found in the data (except Delivered, which lives in the sidebar)
    sortedItems.forEach(it => {
      if (it.statusKey !== 'Delivered' && !cats.includes(it.statusKey)) {
        cats.push(it.statusKey);
      }
    });
    return cats;
  }, [sortedItems]);

  // Group items by category (Delivered is routed to sidebar, all board categories always rendered)
  const columnsData = useMemo(() => {
    const groups = {};
    boardCategories.forEach(col => {
      groups[col] = [];
    });

    sortedItems.forEach(item => {
      if (item.statusKey !== 'Delivered') {
        if (groups[item.statusKey]) {
          groups[item.statusKey].push(item);
        } else {
          if (!groups['Unset']) groups['Unset'] = [];
          groups['Unset'].push(item);
        }
      }
    });

    return { groups, boardCategories };
  }, [sortedItems, boardCategories]);

  // Overall Statistics
  const stats = useMemo(() => {
    const total = items.length;
    const delivered = items.filter(it => it.statusKey === 'Delivered').length;
    const finished = items.filter(it => it.statusKey === 'Finished').length;
    const printing = items.filter(it => it.statusKey === 'Printing' || it.statusKey === 'Ready to print').length;
    const failed = items.filter(it => it.statusKey === 'Failed').length;
    const notStarted = items.filter(it => it.statusKey === 'Not Started').length;
    const completionPct = total > 0 ? Math.round(((delivered + finished) / total) * 100) : 0;
    return { total, delivered, finished, printing, failed, notStarted, completionPct };
  }, [items]);



  // DnD Sensors optimized for both desktop mouse and mobile touch
  const mouseSensor = dndKit.useSensor(dndKit.MouseSensor, {
    activationConstraint: {
      distance: 6,
    },
  });
  const touchSensor = dndKit.useSensor(dndKit.TouchSensor, {
    activationConstraint: {
      delay: 200,
      tolerance: 6,
    },
  });
  const keyboardSensor = dndKit.useSensor(dndKit.KeyboardSensor, {
    coordinateGetter: dndKitSortable.sortableKeyboardCoordinates,
  });
  const sensors = dndKit.useSensors(mouseSensor, touchSensor, keyboardSensor);

  const activeItem = useMemo(() => {
    if (!activeId) return null;
    const indexNum = parseInt(String(activeId).replace('item-', ''), 10);
    return items.find(it => it.index_ === indexNum) || null;
  }, [activeId, items]);

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    if (activeIdStr === overIdStr) return;

    const sourceIndex = parseInt(activeIdStr.replace('item-', ''), 10);
    const sourceItem = items.find(it => it.index_ === sourceIndex);
    if (!sourceItem) return;

    let targetStatusKey = null;
    let targetIndex = null;

    if (overIdStr.startsWith('col-')) {
      targetStatusKey = overIdStr.replace('col-', '');
      if (targetStatusKey === 'Delivered-quick') {
        targetStatusKey = 'Delivered';
      }
    } else if (overIdStr.startsWith('item-')) {
      targetIndex = parseInt(overIdStr.replace('item-', ''), 10);
      const targetItem = items.find(it => it.index_ === targetIndex);
      if (targetItem) {
        targetStatusKey = targetItem.statusKey;
      }
    }

    if (!targetStatusKey) return;

    const targetConfig = STATUS_CONFIG[targetStatusKey] || STATUS_CONFIG['Unset'];
    const newStatusValue = targetConfig.saveValue !== undefined ? targetConfig.saveValue : targetStatusKey;

    if (sourceItem.statusKey !== targetStatusKey) {
      const updateRow = Array(Math.max(headerRow.length, 7)).fill(undefined);
      updateRow[colIndices.status] = newStatusValue;
      updateItem(sourceItem.index_, updateRow);
    }

    if (targetIndex !== null && targetIndex !== sourceItem.index_ && typeof moveItem === 'function') {
      moveItem(sourceItem.index_, targetIndex);
    }
  };

  // Direct status dropdown switch on card
  const handleQuickStatusChange = (item, newStatusKey) => {
    const targetConfig = STATUS_CONFIG[newStatusKey] || STATUS_CONFIG['Unset'];
    const newStatusValue = targetConfig.saveValue !== undefined ? targetConfig.saveValue : newStatusKey;
    const updateRow = Array(Math.max(headerRow.length, 7)).fill(undefined);
    updateRow[colIndices.status] = newStatusValue;
    updateItem(item.index_, updateRow);
  };

  // Duplicate a print job (e.g. for batch prints or reprints)
  const handleDuplicateItem = (item) => {
    const targetLen = Math.max(headerRow.length, 7);
    const newRow = Array(targetLen).fill(null);
    newRow[colIndices.link] = item.link || null;
    newRow[colIndices.date] = new Date().toISOString().split('T')[0];
    newRow[colIndices.perigrafi] = `${item.perigrafi || 'Print'} (Copy)`;
    newRow[colIndices.megethos] = item.megethos !== undefined ? item.megethos : 1.0;
    newRow[colIndices.xroma] = item.xroma || 'Black';
    newRow[colIndices.status] = 'Not Started';
    newRow[colIndices.comments] = item.comments || null;
    insertItem(undefined, newRow);
  };

  // Open Modals
  const handleOpenAddModal = (statusCol = 'Not Started') => {
    setModalState({
      isOpen: true,
      mode: 'create',
      item: null,
      defaultStatus: statusCol,
    });
  };

  const handleOpenEditModal = (item) => {
    setModalState({
      isOpen: true,
      mode: 'edit',
      item: item,
      defaultStatus: item.statusKey,
    });
  };

  const handleSaveModal = (formData) => {
    const targetConfig = STATUS_CONFIG[formData.status] || STATUS_CONFIG['Unset'];
    const saveStatusVal = targetConfig.saveValue !== undefined ? targetConfig.saveValue : formData.status;
    const targetLen = Math.max(headerRow.length, 7);

    if (modalState.mode === 'create') {
      const newRow = Array(targetLen).fill(null);
      newRow[colIndices.link] = formData.link || null;
      newRow[colIndices.date] = formData.date || null;
      newRow[colIndices.perigrafi] = formData.perigrafi || 'Untitled Print';
      newRow[colIndices.megethos] = formData.megethos !== undefined ? formData.megethos : 1.0;
      newRow[colIndices.xroma] = formData.xroma || 'Black';
      newRow[colIndices.status] = saveStatusVal;
      newRow[colIndices.comments] = formData.comments || null;
      insertItem(undefined, newRow);
    } else if (modalState.mode === 'edit' && modalState.item) {
      const updateRow = Array(targetLen).fill(undefined);
      updateRow[colIndices.link] = formData.link;
      updateRow[colIndices.date] = formData.date;
      updateRow[colIndices.perigrafi] = formData.perigrafi;
      updateRow[colIndices.megethos] = formData.megethos;
      updateRow[colIndices.xroma] = formData.xroma;
      updateRow[colIndices.status] = saveStatusVal;
      updateRow[colIndices.comments] = formData.comments;
      updateItem(modalState.item.index_, updateRow);
    }
    setModalState({ isOpen: false, mode: 'create', item: null, defaultStatus: 'Not Started' });
  };

  const handleDeletePrompt = (item) => {
    setDeleteItemTarget(item);
  };

  const handleConfirmDelete = () => {
    if (deleteItemTarget) {
      deleteItem(deleteItemTarget.index_);
      setDeleteItemTarget(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      {/* Top Application Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3.5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 sm:gap-3">
            {/* Title & Status Summary Badges */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
                  <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <h1 className="font-bold text-base sm:text-lg text-slate-900 leading-tight">
                      3D Print Tracker
                    </h1>
                    <span className="text-[11px] sm:text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                      {stats.total}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 truncate max-w-[200px] sm:max-w-none">
                    Pipeline synced with Google Sheets
                  </p>
                </div>
              </div>

              {/* Mobile Quick "New Print" Button */}
              <button
                type="button"
                onClick={() => handleOpenAddModal('Not Started')}
                className="md:hidden inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>New</span>
              </button>
            </div>

            {/* Quick KPI Indicators & Sidebar Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-0.5">
              {/* Delivered Sidebar Toggle Button */}
              <button
                type="button"
                onClick={() => setIsDeliveredSidebarOpen(!isDeliveredSidebarOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all shrink-0 ${
                  isDeliveredSidebarOpen
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                }`}
                title="Open/Close Delivered sidebar"
              >
                <CheckCircle2 className={`w-3.5 h-3.5 ${isDeliveredSidebarOpen ? 'text-white' : 'text-emerald-600'}`} />
                <span>Delivered:</span>
                <span className="font-bold">{stats.delivered}</span>
              </button>

              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-yellow-50 text-yellow-900 border border-yellow-200 text-xs font-semibold shrink-0">
                <Printer className="w-3.5 h-3.5 text-yellow-600" />
                <span>Active:</span>
                <span className="font-bold">{stats.printing}</span>
              </div>

              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-50 text-red-800 border border-red-200 text-xs font-semibold shrink-0">
                <AlertOctagon className="w-3.5 h-3.5 text-red-600" />
                <span>Failed:</span>
                <span className="font-bold">{stats.failed}</span>
              </div>

              {/* Desktop-only New Print button */}
              <button
                type="button"
                onClick={() => handleOpenAddModal('Not Started')}
                className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all shrink-0 ml-1"
              >
                <Plus className="w-4 h-4" />
                <span>New Print</span>
              </button>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-2.5">
            {/* Search Input & Sort Dropdown Group */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search models, notes..."
                  className="w-full pl-9 pr-8 py-1.5 text-base sm:text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 placeholder-slate-400 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Sort Selector */}
              <div className="relative shrink-0">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-2xs"
                  title="Sort prints"
                >
                  <option value="sheet">Sort: Default</option>
                  <option value="date-desc">Sort: Newest Date</option>
                  <option value="date-asc">Sort: Oldest Date</option>
                  <option value="name-asc">Sort: Name (A-Z)</option>
                  <option value="scale-desc">Sort: Scale (High-Low)</option>
                </select>
              </div>
            </div>

            {/* Filament Color Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto py-0.5 no-scrollbar">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-0.5 shrink-0 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Color:
              </span>
              {['ALL', 'Multi-color', 'Black', 'Gray', 'Green', 'Purple', 'Custom'].map((clr) => {
                const isSelected = colorFilter === clr;
                return (
                  <button
                    key={clr}
                    type="button"
                    onClick={() => setColorFilter(clr)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 border flex items-center gap-1 ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {clr === 'Multi-color' && <Palette className="w-3 h-3" />}
                    <span>{clr === 'ALL' ? 'All' : clr}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile Quick Column Selector Bar (sm:hidden) */}
          <div className="sm:hidden mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
              Columns:
            </span>
            {columnsData.boardCategories.map((colKey) => {
              const cfg = STATUS_CONFIG[colKey] || STATUS_CONFIG['Unset'];
              const count = (columnsData.groups[colKey] || []).length;
              return (
                <button
                  key={colKey}
                  type="button"
                  onClick={() => {
                    const el = document.getElementById(`col-board-${colKey}`);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 border transition-all active:scale-95 shadow-2xs"
                  style={{
                    backgroundColor: cfg.badgeBg,
                    color: cfg.badgeText,
                    borderColor: cfg.badgeBorder,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: cfg.dotColor }}
                  />
                  <span>{cfg.label}</span>
                  <span className="font-bold opacity-80">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Kanban Board Scroll Area with Smooth Mobile Snapping */}
      <main className="flex-1 overflow-x-auto p-3 sm:p-6 snap-x snap-mandatory scroll-smooth">
        <dndKit.DndContext
          sensors={sensors}
          collisionDetection={dndKit.closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3.5 sm:gap-4 items-start min-w-max pb-6">
            {/* Even if a category is not active (0 items), it is always shown */}
            {columnsData.boardCategories.map((colKey) => {
              const cfg = STATUS_CONFIG[colKey] || STATUS_CONFIG['Unset'];
              const colItems = columnsData.groups[colKey] || [];
              return (
                <KanbanColumn
                  key={colKey}
                  columnKey={colKey}
                  config={cfg}
                  items={colItems}
                  onAddItem={handleOpenAddModal}
                  onEditItem={handleOpenEditModal}
                  onDeleteItem={handleDeletePrompt}
                  onDuplicateItem={handleDuplicateItem}
                  onChangeStatus={handleQuickStatusChange}
                  followLink={followLink}
                />
              );
            })}
          </div>

          {/* Quick Deliver Target shown while dragging */}
          <QuickDeliverDropTarget isDragging={Boolean(activeId)} />

          {/* Delivered Sidebar Drawer (Delivered hidden in sidebar) */}
          <DeliveredSidebar
            isOpen={isDeliveredSidebarOpen}
            onClose={() => setIsDeliveredSidebarOpen(false)}
            items={deliveredItems}
            onAddItem={handleOpenAddModal}
            onEditItem={handleOpenEditModal}
            onDeleteItem={handleDeletePrompt}
            onDuplicateItem={handleDuplicateItem}
            onChangeStatus={handleQuickStatusChange}
            followLink={followLink}
          />

          {/* Drag Overlay Portal (Strict requirement: ReactDOM.createPortal to document.body) */}
          {typeof document !== 'undefined' &&
            ReactDOM.createPortal(
              <dndKit.DragOverlay>
                {activeItem ? (
                  <div className="w-80 shadow-2xl rotate-1.5 opacity-95 pointer-events-none">
                    <CardContent item={activeItem} isOverlay />
                  </div>
                ) : null}
              </dndKit.DragOverlay>,
              document.body
            )}
        </dndKit.DndContext>
      </main>

      {/* Floating Edge Tab to open Delivered Sidebar when closed (hidden on small screens to avoid obstructing cards) */}
      {!isDeliveredSidebarOpen && (
        <button
          type="button"
          onClick={() => setIsDeliveredSidebarOpen(true)}
          className="hidden sm:flex fixed right-0 top-1/2 -translate-y-1/2 z-30 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg rounded-l-xl px-2.5 py-3.5 flex-col items-center gap-1.5 transition-all hover:pr-3.5 border border-r-0 border-emerald-500 group"
          title="Open Delivered Prints Sidebar"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-100 group-hover:scale-110 transition-transform" />
          <span className="text-[11px] font-bold tracking-wider [writing-mode:vertical-rl] rotate-180">
            DELIVERED ({stats.delivered})
          </span>
        </button>
      )}

      {/* Add / Edit Modal */}
      <ItemModal
        isOpen={modalState.isOpen}
        mode={modalState.mode}
        item={modalState.item}
        defaultStatus={modalState.defaultStatus}
        onClose={() => setModalState({ isOpen: false, mode: 'create', item: null, defaultStatus: 'Not Started' })}
        onSave={handleSaveModal}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deleteItemTarget)}
        item={deleteItemTarget}
        onClose={() => setDeleteItemTarget(null)}
        onConfirm={handleConfirmDelete}
      />

    </div>
  );
}
