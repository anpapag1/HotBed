import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Header } from '../components/common/Header';
import {
  getRecentOrders,
  clearRecentOrders,
  type ViewedOrder,
} from '../utils/recentOrdersService';
import styles from './LandingPage.module.css';

export function LandingPage() {
  const [orderCode, setOrderCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [recentOrders, setRecentOrders] = useState<ViewedOrder[]>(() => getRecentOrders());
  const navigate = useNavigate();

  useEffect(() => {
    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setRecentOrders(detail);
      }
    };
    window.addEventListener('recent-orders-updated', handleSync);
    return () => window.removeEventListener('recent-orders-updated', handleSync);
  }, []);

  const handleTrack = (codeToTrack: string) => {
    const cleanCode = codeToTrack.trim().toUpperCase();
    if (!cleanCode) {
      setError('Please enter your 6-character order code');
      return;
    }
    if (cleanCode.length < 4) {
      setError('Order code is usually 6 characters (e.g. HB7890)');
      return;
    }
    navigate(`/order/${cleanCode}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleTrack(orderCode);
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.ambientBackdrop} />
      <div className={styles.gridOverlay} />

      <Header />

      <main className={styles.mainContent}>
        <section className={styles.heroSection}>
          <div className={styles.logoWrap}>
            <div className={styles.logoGlow} />
            <img src="/Logo.svg" alt="Hotbed Isometric Logo" className={styles.logoImg} />
          </div>

          <h1 className={styles.title}>
            Track your 3D print with <span className={styles.brandGradient}>Hotbed</span>
          </h1>
          <p className={styles.subtitle}>
            Real-time visibility from slicing to the heated bed. Watch your print job advance through each stage without creating an account.
          </p>
        </section>

        <div className={styles.lookupCard}>
          <form onSubmit={handleSubmit} className={styles.form}>
            {error && <div className={styles.errorBox}>{error}</div>}

            <div className={styles.inputRow}>
              <div className={styles.inputWrap}>
                <span className={styles.prefix}>#</span>
                <input
                  type="text"
                  className={styles.codeInput}
                  placeholder="HB7890"
                  maxLength={10}
                  value={orderCode}
                  onChange={(e) => {
                    setError(null);
                    setOrderCode(e.target.value.toUpperCase());
                  }}
                  autoFocus
                />
              </div>

              <button type="submit" className={styles.submitBtn}>
                <span>Track</span>
                <ArrowRight size={17} />
              </button>
            </div>
          </form>

          {/* Customer's Viewed Orders */}
          {recentOrders.length > 0 && (
            <div className={styles.recentSection}>
              <div className={styles.recentHeader}>
                <span className={styles.recentLabel}>Recently viewed:</span>
                <button
                  type="button"
                  onClick={clearRecentOrders}
                  className={styles.btnClearRecent}
                  title="Clear viewed orders"
                >
                  Clear
                </button>
              </div>

              <div className={styles.recentChips}>
                {recentOrders.map((order) => (
                  <button
                    key={order.orderCode}
                    type="button"
                    className={styles.recentChip}
                    onClick={() => handleTrack(order.orderCode)}
                    title={`Open order #${order.orderCode}${order.customerName ? ` (${order.customerName})` : ''}`}
                  >
                    <span className={styles.recentCode}>#{order.orderCode}</span>
                    {order.customerName && (
                      <span className={styles.recentCustomer}>• {order.customerName}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

