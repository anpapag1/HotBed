-- ==============================================================================
-- Hotbed 3D Print Order Tracker — Supabase Schema & Security Setup
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Helper function to generate unique 6-character order code (omits confusing 0/O, 1/I)
CREATE OR REPLACE FUNCTION generate_order_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- 1. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code text UNIQUE NOT NULL DEFAULT generate_order_code(),
  customer_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index on order_code for fast lookup
CREATE INDEX IF NOT EXISTS idx_orders_order_code ON orders (order_code);

-- 2. PRINTS TABLE
CREATE TABLE IF NOT EXISTS prints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  perigrafi text NOT NULL,
  status text NOT NULL DEFAULT 'Not Started',
  xroma text NOT NULL DEFAULT '',
  megethos numeric NOT NULL DEFAULT 1.0,
  link text,
  comments text,
  position numeric NOT NULL DEFAULT 1000,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for querying by order and position
CREATE INDEX IF NOT EXISTS idx_prints_order_id ON prints (order_id);
CREATE INDEX IF NOT EXISTS idx_prints_status_position ON prints (status, position);

-- 3. ROW LEVEL SECURITY (RLS)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE prints ENABLE ROW LEVEL SECURITY;

-- 3.1 Authenticated Admin Policies (full access to all orders and prints)
CREATE POLICY "Admin full access on orders"
  ON orders
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin full access on prints"
  ON prints
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3.2 Public (Anon) Policies
-- Public can only SELECT orders and prints
CREATE POLICY "Public read orders"
  ON orders
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public read prints"
  ON prints
  FOR SELECT
  TO anon
  USING (true);

-- 4. RPC: add_print_to_order (Guarded Public submission)
-- Public customers cannot directly INSERT into prints; they call this RPC with their order_code
CREATE OR REPLACE FUNCTION add_print_to_order(
  p_order_code text,
  p_perigrafi text,
  p_xroma text DEFAULT '',
  p_megethos numeric DEFAULT 1.0,
  p_link text DEFAULT NULL,
  p_comments text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_max_pos numeric;
  v_new_id uuid;
BEGIN
  -- Look up order by code (case-insensitive)
  SELECT id INTO v_order_id
  FROM orders
  WHERE upper(order_code) = upper(trim(p_order_code));

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'Order with code % not found', p_order_code;
  END IF;

  -- Find the max position in 'Not Started' column for this order
  SELECT COALESCE(MAX(position), 0) + 10 INTO v_max_pos
  FROM prints
  WHERE order_id = v_order_id AND status = 'Not Started';

  -- Insert print item
  INSERT INTO prints (
    order_id,
    perigrafi,
    status,
    xroma,
    megethos,
    link,
    comments,
    position
  )
  VALUES (
    v_order_id,
    trim(p_perigrafi),
    'Not Started',
    COALESCE(trim(p_xroma), ''),
    COALESCE(p_megethos, 1.0),
    NULLIF(trim(p_link), ''),
    NULLIF(trim(p_comments), ''),
    v_max_pos
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- Grant execution of RPC to anon and authenticated
GRANT EXECUTE ON FUNCTION add_print_to_order(text, text, text, numeric, text, text) TO anon;
GRANT EXECUTE ON FUNCTION add_print_to_order(text, text, text, numeric, text, text) TO authenticated;

-- 5. RPC: update_print_in_order (Guarded Public editing of 'Not Started' items only)
CREATE OR REPLACE FUNCTION update_print_in_order(
  p_order_code text,
  p_print_id uuid,
  p_perigrafi text,
  p_xroma text DEFAULT '',
  p_megethos numeric DEFAULT 1.0,
  p_link text DEFAULT NULL,
  p_comments text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_current_status text;
BEGIN
  -- Verify order code
  SELECT id INTO v_order_id
  FROM orders
  WHERE upper(order_code) = upper(trim(p_order_code));

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Verify print belongs to this order and is in 'Not Started'
  SELECT status INTO v_current_status
  FROM prints
  WHERE id = p_print_id AND order_id = v_order_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Print not found in order';
  END IF;

  IF v_current_status != 'Not Started' THEN
    RAISE EXCEPTION 'Only items in Not Started can be edited by customer';
  END IF;

  UPDATE prints
  SET
    perigrafi = trim(p_perigrafi),
    xroma = COALESCE(trim(p_xroma), ''),
    megethos = COALESCE(p_megethos, 1.0),
    link = NULLIF(trim(p_link), ''),
    comments = NULLIF(trim(p_comments), '')
  WHERE id = p_print_id AND order_id = v_order_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION update_print_in_order(text, uuid, text, text, numeric, text, text) TO anon;
GRANT EXECUTE ON FUNCTION update_print_in_order(text, uuid, text, text, numeric, text, text) TO authenticated;

-- 6. RPC: delete_print_from_order (Guarded Public deletion of 'Not Started' items only)
CREATE OR REPLACE FUNCTION delete_print_from_order(
  p_order_code text,
  p_print_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_current_status text;
BEGIN
  -- Verify order code
  SELECT id INTO v_order_id
  FROM orders
  WHERE upper(order_code) = upper(trim(p_order_code));

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Verify print belongs to this order and is in 'Not Started'
  SELECT status INTO v_current_status
  FROM prints
  WHERE id = p_print_id AND order_id = v_order_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Print not found in order';
  END IF;

  IF v_current_status != 'Not Started' THEN
    RAISE EXCEPTION 'Only items in Not Started can be deleted by customer';
  END IF;

  DELETE FROM prints
  WHERE id = p_print_id AND order_id = v_order_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_print_from_order(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION delete_print_from_order(text, uuid) TO authenticated;

