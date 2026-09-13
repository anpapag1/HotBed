export type PrintStatus =
  | 'Not Started'
  | 'Ready to print'
  | 'Printing'
  | 'Finished'
  | 'Delivered'
  | 'Failed';

export const ALL_STATUS_OPTIONS: PrintStatus[] = [
  'Not Started',
  'Ready to print',
  'Printing',
  'Finished',
  'Delivered',
  'Failed',
];

export const BOARD_COLUMNS: PrintStatus[] = [
  'Not Started',
  'Ready to print',
  'Printing',
  'Finished',
  'Failed',
];

export interface Order {
  id: string;
  order_code: string;
  customer_name: string | null;
  created_at: string;
}

export interface PrintItem {
  id: string;
  order_id: string;
  perigrafi: string;
  status: PrintStatus;
  xroma: string;
  megethos: number;
  link: string | null;
  comments: string | null;
  position: number;
  created_at: string;
}

export interface OrderSummary {
  order: Order;
  prints: PrintItem[];
  totalPrints: number;
  statusCounts: Record<PrintStatus, number>;
  hasActive: boolean;
}

