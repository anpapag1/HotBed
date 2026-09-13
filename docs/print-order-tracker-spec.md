# Hotbed — 3D Print Order Tracker — Project Spec

## Overview
**Hotbed** is a standalone web app for tracking 3D print orders through a Kanban-style pipeline. It replaces an existing Google Sheets-based tracker. The admin creates orders and hands customers their order code; customers use that code to add print items and watch their order's progress without creating an account. An admin (site owner) manages every order through a private, hidden login.

**No sensitive/PII-critical data is involved** — this is a low-stakes internal/small-business tool, not something requiring enterprise-grade auth.

## Name & Branding
- **Name:** Hotbed (pun on a 3D printer's heated bed)
- **Logo:** isometric heated-bed grid icon (dark navy frame, warm orange-to-amber heat gradient across the tiles, small glowing amber dot representing an active print) with a bold rounded wordmark. Will be provided as an SVG file (final asset, not to be regenerated).

### Color Palette

**Light mode**
| Role | Color | Hex |
|---|---|---|
| Background | off-white | `#f8fafc` |
| Surface / card | white | `#ffffff` |
| Primary text | dark navy | `#1e293b` |
| Border / divider | light slate | `#e2e8f0` |
| Brand primary (accent) | warm orange | `#ea580c` |
| Brand secondary (accent) | amber | `#f59e0b` |

**Dark mode**
| Role | Color | Hex |
|---|---|---|
| Background | deep navy | `#0f172a` |
| Surface / card | slate navy | `#1e293b` |
| Primary text | off-white | `#f1f5f9` |
| Border / divider | mid slate | `#334155` |
| Brand primary (accent) | bright orange | `#f97316` |
| Brand secondary (accent) | bright amber | `#fbbf24` |

Status colors (Not Started, Ready to print, Printing, Finished, Delivered, Failed) keep their existing distinct hues from the current Kanban component in both modes — only background/surface/border/text/brand shift between light and dark.

## Tech Stack
- **Frontend:** Static React app (Vite or similar), hosted on **GitHub Pages**
- **Backend/Data:** **Supabase** (Postgres + built-in REST API + Auth), used directly from the browser — no custom server, no serverless functions
- **Drag-and-drop:** `@dnd-kit` (core, sortable, utilities) — reuse existing implementation
- **Icons:** `lucide-react`
- **Styling:** Tailwind CSS (utility classes), matching the existing card/column/modal visual style already built

## Data Model (Supabase / Postgres)

### `orders` table
One row per customer order (a customer may request multiple prints in one order).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `order_code` | text, unique | Short human-typeable code (e.g. 6 characters, alphanumeric), since customers type it in by hand on the landing page. Not sequential/predictable (random per order), but shorter codes are inherently more guessable than long ones — acceptable trade-off here since there's no sensitive data. |
| `customer_name` | text, nullable | Optional, left blank by default — admin can fill it in later if useful, but nothing requires it |
| `created_at` | timestamptz | default now() |

### `prints` table
One row per individual print job, belonging to an order.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `order_id` | uuid, FK → orders.id | |
| `perigrafi` | text | Description / model name |
| `status` | text | One of: `Not Started`, `Ready to print`, `Printing`, `Finished`, `Delivered`, `Failed` |
| `xroma` | text | Filament color(s), comma-separated for multi-color |
| `megethos` | numeric | Scale, e.g. 1.0 = 100% |
| `link` | text, nullable | MakerWorld/model link or reference title |
| `comments` | text, nullable | Notes |
| `position` | numeric | For drag-and-drop ordering within a status column (use gapped values like 10, 20, 30 so most reorders only touch one row) |
| `created_at` | timestamptz | default now() |

## Access Model (Supabase Row-Level Security)

No sign-in required for customers. Auth (Supabase Auth, email/password) required only for admin. **Orders themselves are created only by the admin** — customers cannot create a new order or order code; the owner creates an order (just the order itself, initially empty — no print items) from the admin orders grid and hands the resulting order code/link to the customer. Customers *can* submit new print items to an order they already hold the code for (see the RPC below).

- **`anon` role (public, unauthenticated):**
  - Can `SELECT` from `orders`/`prints` **only** when a request supplies the matching `order_code` (i.e., the app always queries `WHERE order_code = :code`, never fetches the full table) — enforce via RLS policy scoped to that filter, not just app-level filtering
  - Can add a **new** print to an order via a dedicated Postgres RPC function (e.g. `add_print_to_order(order_code, perigrafi, xroma, megethos, link, comments)`), `SECURITY DEFINER`, which looks up the order by `order_code` server-side and only then inserts — this avoids exposing a raw `INSERT` policy on `prints` that would let anyone write to any order if they guessed/obtained an `order_id`
  - **Cannot** `UPDATE` or `DELETE` anything, and cannot directly `INSERT` into the `prints` table (only via the RPC above) or into `orders` at all

- **`authenticated` role (admin, after login):**
  - Full `SELECT`, `UPDATE`, `DELETE`, `INSERT` on both tables — this powers the admin Kanban board

## Pages / Routes

### 1. Public: Landing (`/`)
- A simple page with a single input box: "Enter your order number" + submit button
- On submit, navigates to `/order/:code` with whatever was entered
- No other content needed here — this is the only public entry point (no public listing of orders, no nav links to admin)

### 2. Public: Order View (`/order/:code`)
- Looks up the order by `order_code`
- Renders a **Kanban board** scoped to just that order's prints — same visual columns/cards as the admin board (Not Started → Ready to print → Printing → Finished/Failed → Delivered)
- **View-only for existing cards**: no drag-and-drop, no edit/delete on existing prints, no status-change controls, no search/filter bar
- **One exception**: an "Add print" button/modal lets the customer add a *new* print item to their own order (goes through the `add_print_to_order` RPC — see RLS section below), which appears in `Not Started`
- If code not found: friendly "order not found" message

### 3. Admin: Login (`/admin`, not linked from anywhere public)
- Supabase Auth email/password login form
- Not discoverable via site navigation — the URL itself is the "secret"

### 4. Admin: Orders Grid (`/admin/orders`, behind auth check — this is what admin lands on after login)
- A grid/list of every order, each showing: order code, and a per-status count summary (e.g. "2 Printing · 1 Delivered · 1 Not Started")
- Supports search/filter/sort — search by order code, sort by date created, filter by whether an order has active (non-Delivered) prints
- Orders stay in the grid indefinitely once all their prints are Delivered — no auto-archiving or manual archive action; the grid is the permanent record of every order
- A "New Order" action that creates a fresh order (empty, no print items) and shows/copies the generated order code/link to send to the customer
- Clicking into an order opens that order's individual Kanban board (below)

### 5. Admin: Single-Order Kanban (`/admin/order/:code`, behind auth check)
- Same board as the public Order View, but **fully editable** for this authenticated admin session: drag-and-drop between statuses, edit/delete existing prints, quick status-advance buttons, add-print modal
- This is essentially the **existing React Kanban component**, adapted:
  - Data source changes from Sheets `data`/`updateItem`/`insertItem`/`deleteItem`/`moveItem` props to Supabase client calls (`select`, `update`, `insert`, `delete`) against the `prints` table, scoped to this order's `order_id`
  - Drag-and-drop updates `status` and/or `position` in Supabase on drop
  - Keep existing features: multi-color filament tags, search, color filter, sort, Delivered sidebar, quick status-advance buttons, duplicate/edit/delete, add-print modal
  - Redirect to `/admin` login if not authenticated

## Component Reuse Notes
The existing Kanban React component (`CardContent`, `SortableCard`, `KanbanColumn`, `ItemModal`, `DeleteConfirmModal`, `DeliveredSidebar`, `App`) should be reused for both the admin board and the customer view:
- Add a `readOnly` (or similar) prop that hides/disables: action buttons (edit/delete/duplicate), the quick status-advance controls, the status-change dropdown, and drag handles — but for the customer view, keep the "Add print" entry point active (wired to the `add_print_to_order` RPC instead of a direct table insert)
- Filter the `items` passed into the board by `order_id` for the customer view, vs. all prints for admin

## Out of Scope / Non-Goals
- No payment processing
- No email/SMS notifications (could be a future addition)
- No customer accounts/login — the order code is the only "identity," and knowing it is sufficient to both view and add prints to that order
- Public write access is limited to adding new prints to a *known* order code via the guarded RPC — no ability to view other orders, edit/delete existing prints, or write to the `orders` table at all; there's no cap on how many prints can be added to one order

## Deployment Notes
- Supabase project: create tables + RLS policies as above; get the project URL + anon public key (safe to expose in frontend code — RLS enforces the actual security boundary)
- Frontend: build as static site, deploy to GitHub Pages
- Environment: anon key + Supabase URL baked into the frontend build (standard practice for Supabase + static hosting)
