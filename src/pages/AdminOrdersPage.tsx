import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  ArrowRight,
  Layers,
  Clock,
  CheckCircle2,
  Printer,
  Edit2,
  Check,
  X,
  Upload,
  Bell,
  Trash2,
  Copy,
} from 'lucide-react';
import {
  fetchAllOrdersWithSummaries,
  fetchOrderByCode,
  createOrder,
  updateOrder,
  deleteOrder,
  adminInsertPrint,
  fetchAllItemComments,
  subscribeToAllComments,
  subscribeToAllOrdersAndPrints,
} from '../services/orderService';
import type { Order, OrderSummary, PrintStatus, ItemComment } from '../types/database';
import { Header } from '../components/common/Header';
import { DeleteConfirmModal } from '../components/kanban/DeleteConfirmModal';
import { hasAnyUnreadComments } from '../utils/commentService';
import { copyTextToClipboard, getOrderShareUrl } from '../utils/clipboard';
import styles from './AdminOrdersPage.module.css';

export function AdminOrdersPage() {
  const [summaries, setSummaries] = useState<OrderSummary[]>([]);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingCustomerName, setEditingCustomerName] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [allComments, setAllComments] = useState<ItemComment[]>([]);
  const navigate = useNavigate();

  // No CommentsDrawer renders on this list page, so 'comments-read' events
  // never fire here -- the only thing that changes unread state on this
  // page is new comment rows arriving over the realtime subscription below.
  useEffect(() => {
    let isMounted = true;

    const loadComments = () => {
      fetchAllItemComments()
        .then((data) => { if (isMounted) setAllComments(data); })
        .catch((err) => console.error('Failed to load comments:', err));
    };

    loadComments();
    const unsubscribe = subscribeToAllComments(loadComments);

    const handleSync = () => {
      if (!document.hidden) {
        loadComments();
      }
    };

    window.addEventListener('focus', handleSync);
    document.addEventListener('visibilitychange', handleSync);
    const interval = setInterval(handleSync, 6000);

    return () => {
      isMounted = false;
      unsubscribe();
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleSync);
      clearInterval(interval);
    };
  }, []);

  const unreadOrderIds = useMemo(() => {
    const ids = new Set<string>();
    summaries.forEach((summary) => {
      const printIds = summary.prints.map((p) => p.id);
      if (hasAnyUnreadComments(allComments, printIds, 'admin')) {
        ids.add(summary.order.id);
      }
    });
    return ids;
  }, [summaries, allComments]);

  const parseCsv = (csv: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let value = '';
    let quoted = false;

    for (let index = 0; index < csv.length; index += 1) {
      const character = csv[index];
      const nextCharacter = csv[index + 1];

      if (character === '"' && quoted && nextCharacter === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = !quoted;
      } else if (character === ',' && !quoted) {
        row.push(value.trim());
        value = '';
      } else if ((character === '\n' || character === '\r') && !quoted) {
        if (character === '\r' && nextCharacter === '\n') index += 1;
        row.push(value.trim());
        if (row.some((cell) => cell)) rows.push(row);
        row = [];
        value = '';
      } else {
        value += character;
      }
    }

    row.push(value.trim());
    if (row.some((cell) => cell)) rows.push(row);
    return rows;
  };

  const normalizeStatus = (value: string): PrintStatus => {
    const statuses: PrintStatus[] = [
      'Not Started',
      'Ready to print',
      'Printing',
      'Finished',
      'Delivered',
      'Failed',
    ];
    return statuses.find((status) => status.toLowerCase() === value.trim().toLowerCase()) || 'Not Started';
  };

  const handleImportCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const orderCode = window.prompt('Import items into which order?', 'JZJZ5T')?.trim();
    if (!orderCode) return;

    setIsImporting(true);
    try {
      const order = await fetchOrderByCode(orderCode);
      if (!order) throw new Error(`Order #${orderCode.toUpperCase()} was not found.`);

      const rows = parseCsv(await file.text());
      const headers = rows.shift()?.map((header) => header.toLowerCase()) || [];
      const column = (row: string[], name: string) => row[headers.indexOf(name)] || '';
      const items = rows
        .map((row) => ({
          perigrafi: column(row, 'perigrafi'),
          xroma: column(row, 'xroma'),
          megethos: Number.parseFloat(column(row, 'megethos').replace('%', '')) / 100 || 1,
          link: column(row, 'link') || null,
          comments: column(row, 'comments') || null,
          status: normalizeStatus(column(row, 'status')),
        }))
        .filter((item) => item.perigrafi);

      for (const item of items) {
        await adminInsertPrint(order.id, item);
      }

      setSummaries(await fetchAllOrdersWithSummaries());
      alert(`Imported ${items.length} items into order #${order.order_code}.`);
    } catch (err) {
      console.error('CSV import failed:', err);
      alert(err instanceof Error ? err.message : 'CSV import failed.');
    } finally {
      setIsImporting(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchAll = async () => {
      try {
        const data = await fetchAllOrdersWithSummaries();
        if (isMounted) {
          setSummaries(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchAll();
    const unsubscribe = subscribeToAllOrdersAndPrints(fetchAll);

    const handleSync = () => {
      if (!document.hidden) {
        fetchAll();
      }
    };

    window.addEventListener('focus', handleSync);
    document.addEventListener('visibilitychange', handleSync);
    const interval = setInterval(handleSync, 6000);

    return () => {
      isMounted = false;
      unsubscribe();
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleSync);
      clearInterval(interval);
    };
  }, []);

  const handleConfirmDelete = async () => {
    if (!deletingOrder) return;
    try {
      await deleteOrder(deletingOrder.id);
      setSummaries((prev) => prev.filter((s) => s.order.id !== deletingOrder.id));
      setDeletingOrder(null);
    } catch (err) {
      console.error('Failed to delete order:', err);
      alert('Failed to delete order. Please check your network and try again.');
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;
    try {
      const created = await createOrder(newCustomerName.trim());
      setIsCreating(false);
      setNewCustomerName('');
      navigate(`/admin/order/${created.order_code}`);
    } catch (err) {
      console.error('Error creating order:', err);
      alert('Failed to create new order.');
    }
  };

  const handleStartEdit = (orderId: string, customerName: string | null) => {
    setEditingOrderId(orderId);
    setEditingCustomerName(customerName || '');
  };

  const handleCancelEdit = () => {
    setEditingOrderId(null);
    setEditingCustomerName('');
  };

  const handleSaveEdit = async (e: React.FormEvent, orderId: string) => {
    e.preventDefault();
    if (!editingCustomerName.trim()) return;

    setIsSavingEdit(true);
    try {
      await updateOrder(orderId, { customer_name: editingCustomerName });
      setSummaries((current) =>
        current.map((summary) =>
          summary.order.id === orderId
            ? { ...summary, order: { ...summary.order, customer_name: editingCustomerName.trim() } }
            : summary
        )
      );
      handleCancelEdit();
    } catch (err) {
      console.error('Error updating order:', err);
      alert('Failed to update order.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const filteredSummaries = summaries.filter((summary) => {
    const codeStr = summary.order.order_code;
    const customer = summary.order.customer_name || '';
    const matchesSearch =
      codeStr.toLowerCase().includes(search.toLowerCase()) ||
      customer.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'active') return summary.hasActive;
    if (filter === 'completed') return !summary.hasActive;
    return true;
  });

  const totalPrints = summaries.reduce((sum, s) => sum + s.totalPrints, 0);
  const activeOrders = summaries.filter((s) => s.hasActive).length;
  const completedOrders = summaries.filter((s) => !s.hasActive).length;

  return (
    <div className={styles.pageContainer}>
      <Header isAdminArea />
      <div className={styles.mainContent}>
        {/* Top Bar */}
        <div className={styles.topBar}>
          <div className={styles.headingGroup}>
            <h1 className={styles.pageTitle}>All Print Orders</h1>
            <p className={styles.pageSubtitle}>
              Monitor queue pipelines, manage customer orders, and advance production
            </p>
          </div>
          <div className={styles.topBarActions}>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleImportCsv}
              className={styles.hiddenFileInput}
            />
            <button
              onClick={() => importInputRef.current?.click()}
              className={styles.btnImport}
              disabled={isImporting}
            >
              <Upload size={17} />
              <span>{isImporting ? 'Importing...' : 'Import CSV'}</span>
            </button>
            <button
              onClick={() => setIsCreating(true)}
              className={styles.btnNewOrder}
            >
              <Plus size={18} />
              <span>New Order</span>
            </button>
          </div>
        </div>

        {/* Quick Order Creator */}
        {isCreating && (
          <form onSubmit={handleCreateOrder} className={styles.shareModalContent} style={{ marginBottom: '24px' }}>
            <div className={styles.shareCodeBox}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>Create New Customer Order</h3>
              <div className={styles.shareLinkRow} style={{ marginTop: '12px' }}>
                <input
                  type="text"
                  placeholder="Customer Name (e.g. Gordon Freeman)"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className={styles.shareLinkInput}
                  autoFocus
                />
                <button type="submit" className={styles.btnCopy}>
                  Create Order
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className={styles.btnActionIcon}
                  style={{ width: 'auto', padding: '0 12px' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Stats Row Grid (4 horizontal cards) */}
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <div className={styles.statIconWrap} style={{ background: 'var(--brand-gradient-subtle)', color: 'var(--brand-primary)' }}>
              <Layers size={22} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{summaries.length}</span>
              <span className={styles.statLabel}>Total Orders</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIconWrap} style={{ background: 'rgba(234, 88, 12, 0.1)', color: 'var(--brand-primary)' }}>
              <Clock size={22} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{activeOrders}</span>
              <span className={styles.statLabel}>Active Queue</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIconWrap} style={{ background: 'var(--tag-green-bg)', color: 'var(--tag-green-text)' }}>
              <CheckCircle2 size={22} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{completedOrders}</span>
              <span className={styles.statLabel}>Completed</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIconWrap} style={{ background: 'var(--tag-blue-bg)', color: 'var(--tag-blue-text)' }}>
              <Printer size={22} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{totalPrints}</span>
              <span className={styles.statLabel}>Total Parts</span>
            </div>
          </div>
        </div>

        {/* Controls Bar (Search + Segmented Filter) */}
        <div className={styles.controlsBar}>
          <div className={styles.searchWrap}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search by order code or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.segmentedFilter}>
            <button
              onClick={() => setFilter('all')}
              className={`${styles.segmentBtn} ${filter === 'all' ? styles.segmentBtnActive : ''}`}
            >
              All ({summaries.length})
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`${styles.segmentBtn} ${filter === 'active' ? styles.segmentBtnActive : ''}`}
            >
              Active ({activeOrders})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`${styles.segmentBtn} ${filter === 'completed' ? styles.segmentBtnActive : ''}`}
            >
              Completed ({completedOrders})
            </button>
          </div>
        </div>

        {/* Orders Grid */}
        {loading ? (
          <div className={styles.emptyNotice}>Loading orders...</div>
        ) : filteredSummaries.length === 0 ? (
          <div className={styles.emptyNotice}>
            <p>No print orders match your filter criteria.</p>
          </div>
        ) : (
          <div className={styles.ordersGrid}>
            {filteredSummaries.map((summary) => {
              const order = summary.order;
              const count = summary.totalPrints;
              const deliveredCount = summary.statusCounts['Delivered'] || 0;
              const printingCount = summary.statusCounts['Printing'] || 0;
              const readyCount = summary.statusCounts['Ready to print'] || 0;
              const progressPct = count > 0 ? Math.round((deliveredCount / count) * 100) : 0;
              const dateStr = new Date(order.created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              });
              const hasUnread = unreadOrderIds.has(order.id);

              return (
                <div
                  key={order.id}
                  className={`${styles.orderCard} ${hasUnread ? styles.orderCardUnread : ''}`}
                  onClick={() => navigate(`/admin/order/${order.order_code}`)}
                >
                  {hasUnread && (
                    <span className={styles.orderUnreadBadge} title="Unread comments on this order">
                      <span className={styles.orderUnreadBadgeRing} />
                      <Bell size={13} strokeWidth={2.5} />
                    </span>
                  )}

                  <div className={styles.cardHeader}>
                    <div>
                      <div className={styles.codeBadge}>
                        <span className={styles.codePrefix}>#</span>
                        <span>{order.order_code}</span>
                      </div>
                      {editingOrderId === order.id ? (
                        <form
                          className={styles.editOrderForm}
                          onSubmit={(e) => handleSaveEdit(e, order.id)}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={editingCustomerName}
                            onChange={(e) => setEditingCustomerName(e.target.value)}
                            className={styles.editOrderInput}
                            aria-label="Customer name"
                            autoFocus
                          />
                          <button
                            type="submit"
                            className={styles.editOrderButton}
                            aria-label="Save customer name"
                            disabled={isSavingEdit || !editingCustomerName.trim()}
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            className={styles.editOrderButton}
                            aria-label="Cancel editing"
                            onClick={handleCancelEdit}
                            disabled={isSavingEdit}
                          >
                            <X size={14} />
                          </button>
                        </form>
                      ) : (
                        <div className={styles.customerName}>
                          {order.customer_name || 'Valued Customer'}
                        </div>
                      )}
                    </div>
                    <span className={styles.cardDate}>{dateStr}</span>
                  </div>

                  {/* Progress Bar */}
                  <div className={styles.progressSection}>
                    <div className={styles.progressMeta}>
                      <span>Production Progress</span>
                      <span>{deliveredCount}/{count} Delivered ({progressPct}%)</span>
                    </div>
                    <div className={styles.progressBarTrack}>
                      <div
                        className={styles.progressBarFill}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Status Pills */}
                  <div className={styles.statusPillsRow}>
                    {printingCount > 0 && (
                      <span className={styles.statusPill} style={{ backgroundColor: 'var(--brand-primary-light)', color: 'var(--brand-primary)', borderColor: 'rgba(234, 88, 12, 0.3)' }}>
                        <span className={styles.statusDot} style={{ backgroundColor: 'var(--brand-primary)' }} />
                        <span>{printingCount} Printing</span>
                      </span>
                    )}
                    {readyCount > 0 && (
                      <span className={styles.statusPill} style={{ backgroundColor: 'var(--tag-purple-bg)', color: 'var(--tag-purple-text)', borderColor: 'var(--tag-purple-border)' }}>
                        <span className={styles.statusDot} style={{ backgroundColor: 'var(--tag-purple-text)' }} />
                        <span>{readyCount} Queued</span>
                      </span>
                    )}
                    {deliveredCount > 0 && (
                      <span className={styles.statusPill} style={{ backgroundColor: 'var(--tag-green-bg)', color: 'var(--tag-green-text)', borderColor: 'var(--tag-green-border)' }}>
                        <span className={styles.statusDot} style={{ backgroundColor: 'var(--tag-green-text)' }} />
                        <span>{deliveredCount} Done</span>
                      </span>
                    )}
                  </div>

                  {/* Footer */}
                  <div className={styles.cardFooter}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {count} {count === 1 ? 'part' : 'parts'} total
                    </span>
                    <div className={styles.footerActions}>
                      <button
                        type="button"
                        className={`${styles.btnActionIcon} ${copiedOrderId === order.id ? styles.btnCopyCopied : ''}`}
                        aria-label={`Copy link for order ${order.order_code}`}
                        title={copiedOrderId === order.id ? 'Copied!' : 'Copy order link'}
                        onClick={async (e) => {
                          e.stopPropagation();
                          const url = getOrderShareUrl(order.order_code);
                          const ok = await copyTextToClipboard(url);
                          if (ok) {
                            setCopiedOrderId(order.id);
                            setTimeout(() => setCopiedOrderId(null), 2000);
                          }
                        }}
                      >
                        {copiedOrderId === order.id ? (
                          <Check size={14} color="#22c55e" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                      <button
                        type="button"
                        className={styles.btnActionIcon}
                        aria-label={`Edit ${order.order_code}`}
                        title="Edit order"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(order.id, order.customer_name);
                        }}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        className={`${styles.btnActionIcon} ${styles.btnDeleteOrder}`}
                        aria-label={`Delete order ${order.order_code}`}
                        title="Delete order"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingOrder(order);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                      <Link
                        to={`/admin/order/${order.order_code}`}
                        className={styles.btnActionIcon}
                        style={{ width: 'auto', padding: '0 12px', gap: '6px', fontSize: '12.5px', fontWeight: 600, textDecoration: 'none', color: 'var(--text-primary)' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>Open Board</span>
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <DeleteConfirmModal
        isOpen={Boolean(deletingOrder)}
        title={`Delete Order #${deletingOrder?.order_code}`}
        message={`Are you sure you want to delete order #${deletingOrder?.order_code}${deletingOrder?.customer_name ? ` for ${deletingOrder.customer_name}` : ''}? This will permanently remove all associated print parts, subtasks, and comments.`}
        onCancel={() => setDeletingOrder(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
