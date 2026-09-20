import { useEffect, useState, useTransition } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import {
  fetchOrderByCode,
  fetchPrintsForOrder,
  subscribeToPrintsForOrder,
  addPrintToOrderViaRPC,
  updateCustomerPrintViaRPC,
  deleteCustomerPrintViaRPC
} from '../services/orderService';
import type { Order, PrintItem } from '../types/database';
import { Header } from '../components/common/Header';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import { recordViewedOrder } from '../utils/recentOrdersService';
import styles from './CustomerOrderPage.module.css';

export function CustomerOrderPage() {
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
          setError(`Order #${code.toUpperCase()} was not found.`);
          setLoading(false);
          return;
        }

        setOrder(orderData);
        recordViewedOrder(orderData.order_code, orderData.customer_name);

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

        // Subscribe to real-time changes
        unsubscribe = subscribeToPrintsForOrder(orderData.id, refreshPrints);

        // Fallback sync: every 5s when visible, and immediately on tab focus
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

  const handleAddPrintRPC = async (
    _orderId: string,
    item: {
      perigrafi: string;
      xroma?: string;
      megethos?: number;
      link?: string | null;
      comments?: string | null;
    }
  ) => {
    if (!order) return;
    try {
      await addPrintToOrderViaRPC(order.order_code, item);
      const freshPrints = await fetchPrintsForOrder(order.id);
      setPrints(freshPrints);
    } catch (err) {
      console.error('RPC Error:', err);
      alert('Could not submit print item. Please check your network.');
    }
  };

  const handleUpdatePrintRPC = async (
    id: string,
    updates: Partial<PrintItem>
  ) => {
    if (!order) return;
    try {
      await updateCustomerPrintViaRPC(order.order_code, id, {
        perigrafi: updates.perigrafi || '',
        xroma: updates.xroma,
        megethos: updates.megethos,
        link: updates.link,
        comments: updates.comments,
      });
      const freshPrints = await fetchPrintsForOrder(order.id);
      setPrints(freshPrints);
    } catch (err) {
      console.error('Customer update error:', err);
      alert(err instanceof Error ? err.message : 'Could not update print part.');
    }
  };

  const handleDeletePrintRPC = async (id: string) => {
    if (!order) return;
    if (!window.confirm('Delete this 3D print part from your order?')) return;
    try {
      await deleteCustomerPrintViaRPC(order.order_code, id);
      const freshPrints = await fetchPrintsForOrder(order.id);
      setPrints(freshPrints);
    } catch (err) {
      console.error('Customer delete error:', err);
      alert(err instanceof Error ? err.message : 'Could not delete print part.');
    }
  };

  if (loading) {
    return (
      <div className={styles.pageContainer}>
        <Header orderCode={code?.toUpperCase()} />
        <div className={styles.centerNotice}>
          <div className={styles.spinner} />
          <p className={styles.noticeText}>Connecting to 3D Print Pipeline...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className={styles.pageContainer}>
        <Header orderCode={code?.toUpperCase()} />
        <div className={styles.centerNotice}>
          <div className={styles.noticeCard}>
            <div className={styles.iconWrap}>
              <ShieldAlert size={28} color="var(--status-failed)" />
            </div>
            <h2 className={styles.noticeTitle}>Order Not Found</h2>
            <p className={styles.noticeText}>
              We couldn't locate an order with code{' '}
              <span className={styles.codeHighlight}>#{code?.toUpperCase()}</span>. Please verify your order number and try again.
            </p>
            <Link to="/" className={styles.btnReturn}>
              <ArrowLeft size={16} />
              <span>Back to Lookup</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleRefreshPrints = async () => {
    if (!order) return;
    try {
      const freshPrints = await fetchPrintsForOrder(order.id);
      setPrints(freshPrints);
    } catch (err) {
      console.error('Customer refresh error:', err);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <Header
        orderCode={order.order_code}
        customerName={order.customer_name}
      />
      <KanbanBoard
        items={prints}
        orderId={order.id}
        orderCode={order.order_code}
        customerName={order.customer_name}
        readOnly={false}
        isAdmin={false}
        onAddPrint={handleAddPrintRPC}
        onUpdatePrint={handleUpdatePrintRPC}
        onDeletePrint={handleDeletePrintRPC}
        onRefreshPrints={handleRefreshPrints}
        pageTitle={`Order #${order.order_code}`}
        pageSubtitle={`Live 3D Print Pipeline for ${order.customer_name || 'Customer'} (${prints.length} items)`}
      />
    </div>
  );
}

