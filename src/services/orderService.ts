import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Order, PrintItem, PrintStatus, OrderSummary } from '../types/database';

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not connected');
  }
  return supabase;
}

// ---------------------------------------------------------------------------
// Service Layer APIs
// ---------------------------------------------------------------------------

export async function fetchOrderByCode(code: string): Promise<Order | null> {
  const client = requireSupabase();
  const cleanCode = code.trim().toUpperCase();

  const { data, error } = await client
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

export async function fetchPrintsForOrder(orderId: string): Promise<PrintItem[]> {
  const client = requireSupabase();

  const { data, error } = await client
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

export async function fetchAllOrdersWithSummaries(): Promise<OrderSummary[]> {
  const client = requireSupabase();

  const { data: ordersData, error: ordersErr } = await client
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (ordersErr) throw ordersErr;

  const { data: printsData, error: printsErr } = await client
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

export async function createOrder(customerName?: string): Promise<Order> {
  const client = requireSupabase();

  const { data, error } = await client
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

export async function updateOrder(
  orderId: string,
  updates: Pick<Partial<Order>, 'customer_name'>
): Promise<void> {
  const client = requireSupabase();

  const { error } = await client
    .from('orders')
    .update({ customer_name: updates.customer_name?.trim() || null })
    .eq('id', orderId);

  if (error) throw error;
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
  const client = requireSupabase();

  const { data, error } = await client.rpc('add_print_to_order', {
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
  const client = requireSupabase();
  const cleanCode = orderCode.trim().toUpperCase();

  const { error: rpcError } = await client.rpc('update_print_in_order', {
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
  const { data: printItem, error: fetchErr } = await client
    .from('prints')
    .select('status, order_id')
    .eq('id', printId)
    .single();

  if (fetchErr || !printItem) throw new Error('Print item not found');
  if (printItem.status !== 'Not Started') {
    throw new Error('Only items in Not Started can be edited');
  }

  const { error: updateErr } = await client
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
}

export async function deleteCustomerPrintViaRPC(
  orderCode: string,
  printId: string
): Promise<void> {
  const client = requireSupabase();
  const cleanCode = orderCode.trim().toUpperCase();

  const { error: rpcError } = await client.rpc('delete_print_from_order', {
    p_order_code: cleanCode,
    p_print_id: printId,
  });

  if (!rpcError) return;

  const { data: printItem, error: fetchErr } = await client
    .from('prints')
    .select('status, order_id')
    .eq('id', printId)
    .single();

  if (fetchErr || !printItem) throw new Error('Print item not found');
  if (printItem.status !== 'Not Started') {
    throw new Error('Only items in Not Started can be deleted');
  }

  const { error: delErr } = await client
    .from('prints')
    .delete()
    .eq('id', printId);

  if (delErr) throw delErr;
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
  const client = requireSupabase();
  const status = printData.status || 'Not Started';

  const { data, error } = await client
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

export async function updatePrint(
  id: string,
  updates: Partial<PrintItem>
): Promise<void> {
  const client = requireSupabase();

  const { error } = await client
    .from('prints')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

export async function deletePrint(id: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('prints').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteOrder(orderId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('orders').delete().eq('id', orderId);
  if (error) throw error;
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
  const client = requireSupabase();

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
