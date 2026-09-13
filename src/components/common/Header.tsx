import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Sun, Moon, Laptop, Check, LogOut, LayoutGrid } from 'lucide-react';
import { useTheme, type ThemeMode } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import styles from './Header.module.css';

interface HeaderProps {
  orderCode?: string;
  customerName?: string | null;
  isAdminArea?: boolean;
}

export function Header({ orderCode, customerName, isAdminArea }: HeaderProps) {
  const { themeMode, resolvedTheme, setThemeMode } = useTheme();
  const { isAuthenticated, signOut } = useAuth();
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isOrdersPage = location.pathname === '/admin/orders';

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelectTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    setIsThemeMenuOpen(false);
  };

  return (
    <header className={styles.header}>
      <Link to={isAuthenticated ? '/admin/orders' : '/'} className={styles.brandLink}>
        <div className={styles.logoWrap}>
          <img src="/Logo.svg" alt="Hotbed Logo" className={styles.logoImg} />
        </div>
        <span className={styles.brandName}>
          Hotbed
          {isAdminArea && <span className={styles.brandSubtitle}>Admin</span>}
        </span>
      </Link>

      <div className={styles.navRight}>
        {orderCode && (
          <div className={styles.orderBadge} title={customerName ? `Order for ${customerName}` : undefined}>
            <span className={styles.codeDot}></span>
            <span>Order #{orderCode}</span>
            {customerName && <span className={styles.customerName}>• {customerName}</span>}
          </div>
        )}

        {isAuthenticated && (
          <Link
            to="/admin/orders"
            className={`${styles.adminBtn} ${isOrdersPage ? styles.adminBtnActive : ''}`}
            title="All Orders"
          >
            <LayoutGrid size={16} />
            <span>All Orders</span>
          </Link>
        )}

        {/* Theme Dropdown Menu */}
        <div className={styles.themeMenuWrapper} ref={themeMenuRef}>
          <button
            onClick={() => setIsThemeMenuOpen((prev) => !prev)}
            className={`${styles.iconButton} ${isThemeMenuOpen ? styles.iconButtonActive : ''}`}
            aria-label="Theme menu"
            aria-expanded={isThemeMenuOpen}
            title={`Theme: ${themeMode} (${resolvedTheme})`}
          >
            {themeMode === 'device' ? (
              <Laptop size={18} />
            ) : resolvedTheme === 'dark' ? (
              <Moon size={18} />
            ) : (
              <Sun size={18} />
            )}
          </button>

          {isThemeMenuOpen && (
            <div className={styles.themeDropdown} role="menu">
              <button
                type="button"
                onClick={() => handleSelectTheme('light')}
                className={`${styles.themeOption} ${themeMode === 'light' ? styles.themeOptionActive : ''}`}
                role="menuitem"
              >
                <Sun size={15} />
                <span>Light</span>
                {themeMode === 'light' && <Check size={14} className={styles.checkIcon} />}
              </button>

              <button
                type="button"
                onClick={() => handleSelectTheme('dark')}
                className={`${styles.themeOption} ${themeMode === 'dark' ? styles.themeOptionActive : ''}`}
                role="menuitem"
              >
                <Moon size={15} />
                <span>Dark</span>
                {themeMode === 'dark' && <Check size={14} className={styles.checkIcon} />}
              </button>

              <button
                type="button"
                onClick={() => handleSelectTheme('device')}
                className={`${styles.themeOption} ${themeMode === 'device' ? styles.themeOptionActive : ''}`}
                role="menuitem"
              >
                <Laptop size={15} />
                <span>Device</span>
                {themeMode === 'device' && <Check size={14} className={styles.checkIcon} />}
              </button>
            </div>
          )}
        </div>

        {isAuthenticated && (
          <button
            onClick={handleSignOut}
            className={styles.logoutBtn}
            aria-label="Sign Out"
            title="Sign Out"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </header>
  );
}

