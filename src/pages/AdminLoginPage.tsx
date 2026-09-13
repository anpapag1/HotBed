import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/common/Header';
import styles from './AdminLoginPage.module.css';

export function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signIn, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/admin/orders', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both email and password');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const { error: authErr } = await signIn(email.trim(), password);
      if (authErr) {
        setError(authErr.message);
      } else {
        navigate('/admin/orders');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.ambientBackdrop} />
      <div className={styles.gridOverlay} />
      <Header isAdminArea />

      <main className={styles.mainContent}>
        <div className={styles.card}>
          <div className={styles.headerRow}>
            <div className={styles.iconWrap}>
              <ShieldCheck size={26} />
            </div>
            <h1 className={styles.title}>Admin Login</h1>
            <p className={styles.subtitle}>Enter your credentials to manage orders and prints</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Email Address</label>
              <input
                type="email"
                className={styles.input}
                placeholder="admin@hotbed.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Password</label>
              <input
                type="password"
                className={styles.input}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
              <LogIn size={16} />
              <span>{isSubmitting ? 'Signing in...' : 'Sign In'}</span>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

