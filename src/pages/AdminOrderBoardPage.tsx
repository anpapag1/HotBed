import { useEffect, useState, useTransition } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import {
  fetchOrderByCode,
  fetchPrintsForOrder,
  subscribeToPrintsForOrder,
  updatePrintStatus,
  updatePrint,
  deletePrint,
  adminInsertPrint,
  updatePrintOrder
} from '../services/orderService';
import type { Order, PrintItem, PrintStatus } from '../types/database';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import { Header } from '../components/common/Header';
import styles from './CustomerOrderPage.module.css';

export function AdminOrderBoardPage() {
  const { code } = useParams<{ code: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [prints, setPrints] = useState<PrintItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    const loadOrderAndPrints = async () => {
      if (!code) return;
      try {
        const orderData = await fetchOrderByCode(code);
        if (!isMounted) return;

        if (!orderData) {
          setError(`Order #${code.toUpperCase()} not found.`);
          setLoading(false);
          return;
        }

        setOrder(orderData);
        const printsData = await fetchPrintsForOrder(orderData.id);
        if (!isMounted) return;

        setPrints(printsData);
        setLoading(false);

        const refreshPrints = async () => {
          try {
            const freshPrints = await fetchPrintsForOrder(orderData.id);
            if (!isMounted) return;
            startTransition(() => {
              setPrints(freshPrints);
            });
          } catch (err) {
            console.error('Failed to sync prints:', err);
          }
        };

        unsubscribe = subscribeToPrintsForOrder(orderData.id, refreshPrints);

        const handleSync = () => {
          if (!document.hidden) {
            refreshPrints();
          }
        };

        window.addEventListener('focus', handleSync);
        document.addEventListener('visibilitychange', handleSync);
        const pollInterval = setInterval(handleSync, 5000);

        cleanups.push(() => {
          window.removeEventListener('focus', handleSync);
          document.removeEventListener('visibilitychange', handleSync);
          clearInterval(pollInterval);
        });
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load order');
        setLoading(false);
      }
    };

    const cleanups: (() => void)[] = [];
    loadOrderAndPrints();

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
      cleanups.forEach((fn) => fn());
    };
  }, [code]);

  const handleUpdateStatus = async (id: string, newStatus: PrintStatus) => {
    setPrints((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
    );
    try {
      await updatePrintStatus(id, newStatus);
    } catch (err) {
      console.error('Failed to update status in DB:', err);
    }
  };

  const handleReorder = async (reorderedItems: PrintItem[]) => {
    setPrints(reorderedItems);
    try {
      const payload = reorderedItems.map((item, idx) => ({
        id: item.id,
        position: (idx + 1) * 10,
      }));
      await updatePrintOrder(payload);
    } catch (err) {
      console.error('Failed to save order in DB:', err);
    }
  };

  const handleAddPrint = async (
    orderId: string,
    item: {
      perigrafi: string;
      xroma?: string;
      megethos?: number;
      link?: string | null;
      comments?: string | null;
      status?: PrintStatus;
    }
  ) => {
    try {
      const created = await adminInsertPrint(orderId, item);
      setPrints((prev) => [...prev, created]);
    } catch (err) {
      console.error('Failed to add print part:', err);
      throw err;
    }
  };

  const handleUpdatePrint = async (id: string, updates: Partial<PrintItem>) => {
    try {
      await updatePrint(id, updates);
      setPrints((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    } catch (err) {
      console.error('Failed to update print part:', err);
      throw err;
    }
  };

  const handleDeletePrint = async (id: string) => {
    if (!window.confirm('Delete this 3D print part permanently?')) return;
    try {
      await deletePrint(id);
      setPrints((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Failed to delete print part:', err);
    }
  };

  const handleRefreshPrints = async () => {
    if (!order) return;
    try {
      const freshPrints = await fetchPrintsForOrder(order.id);
      startTransition(() => {
        setPrints(freshPrints);
      });
    } catch (err) {
      console.error('Failed to refresh prints:', err);
    }
  };

  if (loading) {
    return (
      <div className={styles.pageContainer}>
        <Header isAdminArea orderCode={code?.toUpperCase()} />
        <div className={styles.centerNotice}>
          <div className={styles.spinner} />
          <p className={styles.noticeText}>Loading Admin Production Board...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className={styles.pageContainer}>
        <Header isAdminArea orderCode={code?.toUpperCase()} />
        <div className={styles.centerNotice}>
          <div className={styles.noticeCard}>
            <div className={styles.iconWrap}>
              <ShieldAlert size={28} color="var(--status-failed)" />
            </div>
            <h2 className={styles.noticeTitle}>Order Not Found</h2>
            <p className={styles.noticeText}>{error}</p>
            <Link to="/admin/orders" className={styles.btnReturn}>
              Back to Orders List
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <Header
        isAdminArea
        orderCode={order.order_code}
        customerName={order.customer_name}
      />
      <KanbanBoard
        items={prints}
        orderId={order.id}
        orderCode={order.order_code}
        customerName={order.customer_name}
        readOnly={false}
        isAdmin={true}
        onUpdateStatus={handleUpdateStatus}
        onReorder={handleReorder}
        onAddPrint={handleAddPrint}
        onUpdatePrint={handleUpdatePrint}
        onDeletePrint={handleDeletePrint}
        onRefreshPrints={handleRefreshPrints}
        pageTitle="Production Pipeline"
        pageSubtitle={`Admin Control for Order #${order.order_code} • ${order.customer_name || 'Client'} (${prints.length} items)`}
      />
    </div>
  );
}

