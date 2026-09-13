export interface ViewedOrder {
  orderCode: string;
  customerName?: string | null;
  lastViewedAt: number;
}

const STORAGE_KEY = 'hotbed_recent_viewed_orders';
const MAX_RECENT_ORDERS = 5;

export function getRecentOrders(): ViewedOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list: ViewedOrder[] = JSON.parse(raw);
    if (Array.isArray(list)) {
      return list.sort((a, b) => b.lastViewedAt - a.lastViewedAt);
    }
  } catch (err) {
    console.error('Error reading recent orders from localStorage', err);
  }
  return [];
}

export function recordViewedOrder(orderCode: string, customerName?: string | null): void {
  try {
    const cleanCode = orderCode.trim().toUpperCase();
    if (!cleanCode) return;

    const existing = getRecentOrders().filter((o) => o.orderCode !== cleanCode);
    const newEntry: ViewedOrder = {
      orderCode: cleanCode,
      customerName: customerName ? customerName.trim() : null,
      lastViewedAt: Date.now(),
    };

    const updated = [newEntry, ...existing].slice(0, MAX_RECENT_ORDERS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('recent-orders-updated', { detail: updated }));
  } catch (err) {
    console.error('Error saving recent order to localStorage', err);
  }
}

export function removeViewedOrder(orderCode: string): void {
  try {
    const cleanCode = orderCode.trim().toUpperCase();
    const updated = getRecentOrders().filter((o) => o.orderCode !== cleanCode);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('recent-orders-updated', { detail: updated }));
  } catch (err) {
    console.error('Error removing recent order', err);
  }
}

export function clearRecentOrders(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('recent-orders-updated', { detail: [] }));
  } catch (err) {
    console.error('Error clearing recent orders', err);
  }
}

