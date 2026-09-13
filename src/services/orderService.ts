import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Order, PrintItem, PrintStatus, OrderSummary } from '../types/database';

// ---------------------------------------------------------------------------
// Local Demo Storage (used when Supabase credentials are not yet configured)
// ---------------------------------------------------------------------------
const LOCAL_STORAGE_ORDERS_KEY = 'hotbed_demo_orders_v1';
const LOCAL_STORAGE_PRINTS_KEY = 'hotbed_demo_prints_v1';

const INITIAL_DEMO_ORDERS: Order[] = [
  {
    id: 'ord-101',
    order_code: 'HB7890',
    customer_name: 'Alex Vance',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'ord-102',
    order_code: 'PR4421',
    customer_name: 'Gordon F.',
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
];

const INITIAL_DEMO_PRINTS: PrintItem[] = [
  {
    id: 'pr-1',
    order_id: 'ord-101',
    perigrafi: 'Voron StealthBurner Toolhead Cowl',
    status: 'Printing',
    xroma: 'Black, Orange',
    megethos: 1.0,
    link: 'https://github.com/VoronDesign/Voron-Stealthburner',
    comments: 'ASA filament preferred, 4 perimeters',
    position: 10,
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'pr-2',
    order_id: 'ord-101',
    perigrafi: 'Gridfinity 4x2 Bin Baseplate',
    status: 'Ready to print',
    xroma: 'Grey',
    megethos: 1.0,
    link: 'https://makerworld.com/en/models/gridfinity',
    comments: '15% infill gyroid',
    position: 20,
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'pr-3',
    order_id: 'ord-101',
    perigrafi: 'Articulated Dragon Keyring',
    status: 'Not Started',
    xroma: 'Rainbow / Silk Green',
    megethos: 0.8,
    link: 'https://makerworld.com/models/dragon',
    comments: 'Slow down outer wall speed',
    position: 30,
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 'pr-4',
    order_id: 'ord-101',
    perigrafi: 'Headphone Desk Clamp Stand',
    status: 'Delivered',
    xroma: 'Black',
    megethos: 1.0,
    link: null,
    comments: 'Handed over on Friday',
    position: 40,
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'pr-5',
    order_id: 'ord-102',
    perigrafi: 'Bambu Lab AMS Lite Funnel Guide',
    status: 'Ready to print',
    xroma: 'White',
    megethos: 1.0,
    link: 'https://makerworld.com/models/ams-funnel',
    comments: '0.16mm layer height',
    position: 10,
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
];

function getStoredOrders(): Order[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ORDERS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, JSON.stringify(INITIAL_DEMO_ORDERS));
      return INITIAL_DEMO_ORDERS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_DEMO_ORDERS;
  }
}

function saveStoredOrders(orders: Order[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, JSON.stringify(orders));
  } catch (err) {
    console.error('Failed saving orders to localStorage', err);
  }
}

function getStoredPrints(): PrintItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PRINTS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_PRINTS_KEY, JSON.stringify(INITIAL_DEMO_PRINTS));
      return INITIAL_DEMO_PRINTS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_DEMO_PRINTS;
  }
}

function saveStoredPrints(prints: PrintItem[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_PRINTS_KEY, JSON.stringify(prints));
  } catch (err) {
    console.error('Failed saving prints to localStorage', err);
  }
}

function generateRandomCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ---------------------------------------------------------------------------
// Service Layer APIs
// ---------------------------------------------------------------------------

export async function fetchOrderByCode(code: string): Promise<Order | null> {
  const cleanCode = code.trim().toUpperCase();

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .ilike('order_code', cleanCode)
      .maybeSingle();

    if (error) {
      console.error('Error fetching order by code:', error);
      throw error;
    }
    return data;
  }

  // Local fallback
  const orders = getStoredOrders();
  const match = orders.find((o) => o.order_code.toUpperCase() === cleanCode);
  return match || null;
}

export async function fetchPrintsForOrder(orderId: string): Promise<PrintItem[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('prints')
      .select('*')
      .eq('order_id', orderId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching prints:', error);
      throw error;
    }
    return (data || []) as PrintItem[];
  }

  // Local fallback
  const prints = getStoredPrints();
  return prints
    .filter((p) => p.order_id === orderId)
    .sort((a, b) => a.position - b.position);
}

export async function fetchAllOrdersWithSummaries(): Promise<OrderSummary[]> {
  if (isSupabaseConfigured && supabase) {
    const { data: ordersData, error: ordersErr } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (ordersErr) throw ordersErr;

    const { data: printsData, error: printsErr } = await supabase
      .from('prints')
      .select('*');

    if (printsErr) throw printsErr;

    const orders = (ordersData || []) as Order[];
    const prints = (printsData || []) as PrintItem[];

    return orders.map((order) => {
      const orderPrints = prints.filter((p) => p.order_id === order.id);
      const statusCounts: Record<PrintStatus, number> = {
        'Not Started': 0,
        'Ready to print': 0,
        'Printing': 0,
        'Finished': 0,
        'Delivered': 0,
        'Failed': 0,
      };

      orderPrints.forEach((p) => {
        if (statusCounts[p.status] !== undefined) {
          statusCounts[p.status]++;
        }
      });

      const hasActive = orderPrints.some((p) => p.status !== 'Delivered');

      return {
        order,
        prints: orderPrints,
        totalPrints: orderPrints.length,
        statusCounts,
        hasActive,
      };
    });
  }

  // Local fallback
  const orders = getStoredOrders().sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const prints = getStoredPrints();

  return orders.map((order) => {
    const orderPrints = prints.filter((p) => p.order_id === order.id);
    const statusCounts: Record<PrintStatus, number> = {
      'Not Started': 0,
      'Ready to print': 0,
      'Printing': 0,
      'Finished': 0,
      'Delivered': 0,
      'Failed': 0,
    };

    orderPrints.forEach((p) => {
      if (statusCounts[p.status] !== undefined) {
        statusCounts[p.status]++;
      }
    });

    const hasActive = orderPrints.some((p) => p.status !== 'Delivered');

    return {
      order,
      prints: orderPrints,
      totalPrints: orderPrints.length,
      statusCounts,
      hasActive,
    };
  });
}

export async function createOrder(customerName?: string): Promise<Order> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('orders')
      .insert([
        {
          customer_name: customerName?.trim() || null,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating order:', error);
      throw error;
    }
    return data;
  }

  // Local fallback
  const orders = getStoredOrders();
  const newOrder: Order = {
    id: 'ord-' + Date.now(),
    order_code: generateRandomCode(),
    customer_name: customerName?.trim() || null,
    created_at: new Date().toISOString(),
  };
  orders.unshift(newOrder);
  saveStoredOrders(orders);
  return newOrder;
}

export async function updateOrder(
  orderId: string,
  updates: Pick<Partial<Order>, 'customer_name'>
): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('orders')
      .update({ customer_name: updates.customer_name?.trim() || null })
      .eq('id', orderId);

    if (error) throw error;
    return;
  }

  const orders = getStoredOrders();
  const index = orders.findIndex((order) => order.id === orderId);
  if (index !== -1) {
    orders[index] = {
      ...orders[index],
      customer_name: updates.customer_name?.trim() || null,
    };
    saveStoredOrders(orders);
  }
}

export async function addPrintToOrderViaRPC(
  orderCode: string,
  printData: {
    perigrafi: string;
    xroma?: string;
    megethos?: number;
    link?: string | null;
    comments?: string | null;
  }
): Promise<string> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc('add_print_to_order', {
      p_order_code: orderCode,
      p_perigrafi: printData.perigrafi,
      p_xroma: printData.xroma || '',
      p_megethos: printData.megethos || 1.0,
      p_link: printData.link || null,
      p_comments: printData.comments || null,
    });

    if (error) {
      console.error('RPC add_print_to_order error:', error);
      throw error;
    }
    return data as string;
  }

  // Local fallback
  const order = await fetchOrderByCode(orderCode);
  if (!order) throw new Error('Order not found');

  const prints = getStoredPrints();
  const notStartedPrints = prints.filter(
    (p) => p.order_id === order.id && p.status === 'Not Started'
  );
  const maxPos = notStartedPrints.reduce((max, p) => Math.max(max, p.position), 0);

  const newPrint: PrintItem = {
    id: 'pr-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    order_id: order.id,
    perigrafi: printData.perigrafi,
    status: 'Not Started',
    xroma: printData.xroma || '',
    megethos: printData.megethos ?? 1.0,
    link: printData.link || null,
    comments: printData.comments || null,
    position: maxPos + 10,
    created_at: new Date().toISOString(),
  };

  prints.push(newPrint);
  saveStoredPrints(prints);
  return newPrint.id;
}

export async function updateCustomerPrintViaRPC(
  orderCode: string,
  printId: string,
  printData: {
    perigrafi: string;
    xroma?: string;
    megethos?: number;
    link?: string | null;
    comments?: string | null;
  }
): Promise<void> {
  const cleanCode = orderCode.trim().toUpperCase();

  if (isSupabaseConfigured && supabase) {
    const { error: rpcError } = await supabase.rpc('update_print_in_order', {
      p_order_code: cleanCode,
      p_print_id: printId,
      p_perigrafi: printData.perigrafi,
      p_xroma: printData.xroma || '',
      p_megethos: printData.megethos || 1.0,
      p_link: printData.link || null,
      p_comments: printData.comments || null,
    });

    if (!rpcError) return;

    // Fallback if RPC function is not yet registered in remote Postgres
    const { data: printItem, error: fetchErr } = await supabase
      .from('prints')
      .select('status, order_id')
      .eq('id', printId)
      .single();

    if (fetchErr || !printItem) throw new Error('Print item not found');
    if (printItem.status !== 'Not Started') {
      throw new Error('Only items in Not Started can be edited');
    }

    const { error: updateErr } = await supabase
      .from('prints')
      .update({
        perigrafi: printData.perigrafi,
        xroma: printData.xroma || '',
        megethos: printData.megethos ?? 1.0,
        link: printData.link || null,
        comments: printData.comments || null,
      })
      .eq('id', printId);

    if (updateErr) throw updateErr;
    return;
  }

  // Local fallback
  const order = await fetchOrderByCode(cleanCode);
  if (!order) throw new Error('Order not found');

  const prints = getStoredPrints();
  const idx = prints.findIndex((p) => p.id === printId && p.order_id === order.id);
  if (idx === -1) throw new Error('Print item not found in order');

  if (prints[idx].status !== 'Not Started') {
    throw new Error('Only items in Not Started can be edited');
  }

  prints[idx] = {
    ...prints[idx],
    perigrafi: printData.perigrafi,
    xroma: printData.xroma !== undefined ? printData.xroma : prints[idx].xroma,
    megethos: printData.megethos !== undefined ? printData.megethos : prints[idx].megethos,
    link: printData.link !== undefined ? printData.link : prints[idx].link,
    comments: printData.comments !== undefined ? printData.comments : prints[idx].comments,
  };
  saveStoredPrints(prints);
}

export async function deleteCustomerPrintViaRPC(
  orderCode: string,
  printId: string
): Promise<void> {
  const cleanCode = orderCode.trim().toUpperCase();

  if (isSupabaseConfigured && supabase) {
    const { error: rpcError } = await supabase.rpc('delete_print_from_order', {
      p_order_code: cleanCode,
      p_print_id: printId,
    });

    if (!rpcError) return;

    const { data: printItem, error: fetchErr } = await supabase
      .from('prints')
      .select('status, order_id')
      .eq('id', printId)
      .single();

    if (fetchErr || !printItem) throw new Error('Print item not found');
    if (printItem.status !== 'Not Started') {
      throw new Error('Only items in Not Started can be deleted');
    }

    const { error: delErr } = await supabase
      .from('prints')
      .delete()
      .eq('id', printId);

    if (delErr) throw delErr;
    return;
  }

  // Local fallback
  const order = await fetchOrderByCode(cleanCode);
  if (!order) throw new Error('Order not found');

  const prints = getStoredPrints();
  const item = prints.find((p) => p.id === printId && p.order_id === order.id);
  if (!item) throw new Error('Print item not found in order');

  if (item.status !== 'Not Started') {
    throw new Error('Only items in Not Started can be deleted');
  }

  const filtered = prints.filter((p) => p.id !== printId);
  saveStoredPrints(filtered);
}

export async function adminInsertPrint(
  orderId: string,
  printData: {
    perigrafi: string;
    status?: PrintStatus;
    xroma?: string;
    megethos?: number;
    link?: string | null;
    comments?: string | null;
    position?: number;
  }
): Promise<PrintItem> {
  const status = printData.status || 'Not Started';

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('prints')
      .insert([
        {
          order_id: orderId,
          perigrafi: printData.perigrafi,
          status,
          xroma: printData.xroma || '',
          megethos: printData.megethos ?? 1.0,
          link: printData.link || null,
          comments: printData.comments || null,
          position: printData.position ?? 1000,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data as PrintItem;
  }

  // Local fallback
  const prints = getStoredPrints();
  const newPrint: PrintItem = {
    id: 'pr-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    order_id: orderId,
    perigrafi: printData.perigrafi,
    status,
    xroma: printData.xroma || '',
    megethos: printData.megethos ?? 1.0,
    link: printData.link || null,
    comments: printData.comments || null,
    position: printData.position ?? 1000,
    created_at: new Date().toISOString(),
  };
  prints.push(newPrint);
  saveStoredPrints(prints);
  return newPrint;
}

export async function updatePrint(
  id: string,
  updates: Partial<PrintItem>
): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('prints')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    return;
  }

  // Local fallback
  const prints = getStoredPrints();
  const idx = prints.findIndex((p) => p.id === id);
  if (idx !== -1) {
    prints[idx] = { ...prints[idx], ...updates };
    saveStoredPrints(prints);
  }
}

export async function deletePrint(id: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('prints').delete().eq('id', id);
    if (error) throw error;
    return;
  }

  // Local fallback
  const prints = getStoredPrints().filter((p) => p.id !== id);
  saveStoredPrints(prints);
}

export async function deleteOrder(orderId: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) throw error;
    return;
  }

  // Local fallback
  const orders = getStoredOrders().filter((o) => o.id !== orderId);
  const prints = getStoredPrints().filter((p) => p.order_id !== orderId);
  saveStoredOrders(orders);
  saveStoredPrints(prints);
}

export async function updatePrintStatus(id: string, status: PrintStatus): Promise<void> {
  return updatePrint(id, { status });
}

export async function updatePrintOrder(items: { id: string; position: number }[]): Promise<void> {
  for (const item of items) {
    await updatePrint(item.id, { position: item.position });
  }
}

export function subscribeToPrintsForOrder(orderId: string, callback: () => void): () => void {
  const client = supabase;
  if (isSupabaseConfigured && client) {
    const channel = client
      .channel('prints:' + orderId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'prints',
          filter: 'order_id=eq.' + orderId,
        },
        () => {
          callback();
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }

  // Local storage listener
  const handler = () => {
    callback();
  };
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener('storage', handler);
  };
}
