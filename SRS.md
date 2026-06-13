### Comprehensive Technical Implementation Plan & Software Requirements Specification (SRS)
**Project:** Charity Aid Distribution Management System
**Target Engine:** Codex / AI Code Generator

---

### 1. Project Overview & Business Logic
This is a highly secure, Next.js-based web application designed to manage and track monthly charitable aid distributions. The system enforces mandatory authentication. It serves two main workflows: a fast-paced cashier interface for real-time search and aid disbursement, and a comprehensive admin dashboard for deep analytics and historical tracking.

**Core Business Rules:**
*   No access without email/password authentication.
*   A beneficiary can only receive aid once per calendar month.
*   "Received" status is dynamically calculated: if a beneficiary has a transaction record in the current month, their status is "Received" (Red). If not, it is "Not Received" (Green).
*   All disbursement actions must be permanently logged with exact timestamps.

---

### 2. Technology Stack & Dependencies
*   **Framework:** Next.js (App Router, React 18+)
*   **Backend & Database:** Supabase (PostgreSQL, Supabase Auth)
*   **Styling:** Tailwind CSS
*   **Animations:** Framer Motion (for smooth layout changes and search filtering)
*   **Data Visualization:** Recharts (for clean, responsive charts)
*   **Icons:** Lucide-React
*   **Date Handling:** date-fns (for exact minute/day calculations)

---

### 3. UI/UX & Styling Guidelines
The design must be formal, elegant, modern, and strictly avoid harsh or random colors. It should utilize ample whitespace and smooth transitions.

**Color Palette (Tailwind Configuration):**
*   **Background:** `bg-slate-50` (`#F8FAFC`) - Soft, calm background.
*   **Surface:** `bg-white` (`#FFFFFF`) - For cards and main containers.
*   **Primary Brand:** `text-emerald-800` (`#065F46`), `bg-emerald-700` (`#047857`) - Formal, representing trust and charity.
*   **Text Primary:** `text-slate-800` (`#1E293B`) - High readability.
*   **Text Secondary:** `text-slate-500` (`#64748B`) - For dates and minor stats.
*   **Status - Not Received (Actionable):** `bg-emerald-100 text-emerald-800` / Button: `bg-emerald-600 hover:bg-emerald-700`
*   **Status - Already Received (Warning):** `bg-rose-100 text-rose-800` / Button: Disabled state.

**Animation Specs (Framer Motion):**
*   **Page Transitions:** Fade in (`opacity: 0` to `1`, `duration: 0.3s`).
*   **List Filtering:** `layout` prop on list items for smooth repositioning when searching.
*   **Modals/Popups:** Scale up (`scale: 0.95` to `1`) with slight spring physics.

---

### 4. Database Schema (Supabase PostgreSQL)

**Table 1: `beneficiaries`**
| Column | Type | Constraints/Notes |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key, Default: `uuid_generate_v4()` |
| `full_name` | Text | Required, Indexed for searching |
| `identifier` | Text | Required, Unique (National ID or Phone) |
| `family_size` | Integer | Default: 1 |
| `joined_at` | Timestamp | Default: `now()` |

**Table 2: `aid_transactions`**
| Column | Type | Constraints/Notes |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `beneficiary_id` | UUID | Foreign Key (`beneficiaries.id`), Cascade Delete |
| `received_at` | Timestamp | Default: `now()` |
| `admin_id` | UUID | Foreign Key (`auth.users.id`) |

---

### 5. Core Features & Technical Requirements

#### 5.1. Authentication Module (`/login`)
*   **UI:** Minimalist centered login card with Email and Password inputs.
*   **Logic:** Uses `@supabase/supabase-js` auth client.
*   **Middleware:** Next.js middleware to protect all routes (`/dashboard`, `/search`, `/beneficiary/*`). Unauthenticated users are strictly redirected to `/login`.

#### 5.2. Real-Time Search & Cashier Interface (`/search`)
*   **Component:** Large, prominent search input taking center stage.
*   **Logic:** As the user types (minimum 2 characters), query the `beneficiaries` table.
*   **Status Calculation:** For each loaded beneficiary, check if they have a transaction in the `aid_transactions` table where `received_at` is within the current month.
*   **UI Cards:**
    *   If *Not Received*: Show green accents. Display a "Confirm Disbursement" button.
    *   If *Received*: Show red/rose accents. Display "Received on [Date/Time]" and disable the button.
*   **Action:** Clicking "Confirm" opens a small Framer Motion modal for confirmation. Upon confirmation, insert a record into `aid_transactions`. Update the UI instantly without page reload.
*   **Routing:** Clicking on a beneficiary's name routes to `/beneficiary/[id]`.

#### 5.3. Comprehensive Beneficiary Profile (`/beneficiary/[id]`)
*   **Layout:** Formal profile header with user details.
*   **Calculated Statistics Engine:**
    *   *Total Receipts:* `COUNT(*)` of transactions for this ID.
    *   *First Aid Received:* `MIN(received_at)`.
    *   *Days Since Last Receipt:* Calculated dynamically (Current Date - `MAX(received_at)` in days).
*   **Historical Log:** A mapped list/table of all `aid_transactions` for this user, sorted by `received_at` DESC. Display format: `dd MMM yyyy, hh:mm a`.

#### 5.4. Graphical Admin Dashboard (`/dashboard`)
*   **Top KPI Cards:**
    *   Total Beneficiaries in DB.
    *   Total Distributions (All time).
    *   Distributions This Month.
    *   **Live Counter:** Remaining unreceived beneficiaries this month (Total Beneficiaries - Distinct beneficiaries who received this month).
*   **Interactive Charts (Recharts):**
    *   *Monthly Distribution Trend:* A BarChart or AreaChart showing the number of aid packages distributed per month over the last 12 months.
*   **Live Feed Component:** A scrolling list showing the last 10 transactions across the entire system in real-time (fetching `aid_transactions` ordered by `received_at` DESC with joined beneficiary names).

---

### 6. Implementation Order (Instructions for AI/Codex)

1.  **Initialization:** Setup Next.js App router, configure Tailwind CSS with the specified exact color palette, install `lucide-react`, `date-fns`, `recharts`, `framer-motion`, and `@supabase/supabase-js`.
2.  **Supabase Setup:** Initialize the Supabase client and create the Next.js auth middleware to protect routes.
3.  **Layouts & Routing:** Build the main authenticated layout containing a sleek top navigation bar with links to Dashboard and Search.
4.  **Database Actions:** Create reusable server actions/API routes for fetching beneficiaries, fetching transactions, and inserting new transactions.
5.  **Build Search Interface:** Implement the real-time search page with Framer Motion layout animations and the conditional Green/Red status cards.
6.  **Build Profile Page:** Implement dynamic routing (`/beneficiary/[id]`) and construct the statistical logic and historical table.
7.  **Build Dashboard:** Implement the KPI logic, integrate Recharts for monthly data, and build the live feed component.