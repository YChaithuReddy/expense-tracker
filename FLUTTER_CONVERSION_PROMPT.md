# Flutter Mobile App — FluxGen Expense Tracker (Emerald)

## Expert Role

You are an expert Flutter developer and UI/UX engineer specializing in enterprise SaaS mobile applications. You will build the FluxGen Expense Tracker ("Emerald") as a production-ready Flutter mobile app targeting Android APK release.

**CRITICAL CONTEXT:** I already have Google Stitch UI designs (HTML/CSS mockups) for 6 key screens. You MUST follow these designs exactly as the visual baseline — do NOT invent a new design. The Stitch designs use a specific "Azure Ledger" design system documented below. All screens not covered by Stitch designs should follow the same design system for consistency.

---

## Stitch Design System — "Azure Ledger" (FOLLOW EXACTLY)

### Creative Direction: "The Architectural Authority"
A sophisticated financial journal aesthetic. Structured yet breathable. White space as a functional tool. Intentional asymmetry to guide the eye through complex financial data.

### Color Palette (Use these exact tokens)
```dart
// Surfaces (layered like frosted glass sheets)
static const surface = Color(0xFFF7F9FB);            // Base background
static const surfaceContainerLow = Color(0xFFF2F4F6); // Section backgrounds
static const surfaceContainerLowest = Color(0xFFFFFFFF); // Cards
static const surfaceContainerHighest = Color(0xFFE0E3E5); // System overlays

// Primary (deep authoritative blue)
static const primary = Color(0xFF00288E);             // Primary actions
static const primaryContainer = Color(0xFF1E40AF);    // Gradient end
static const primaryFixed = Color(0xFFDDE1FF);        // Positive trends
static const onPrimary = Colors.white;

// Secondary
static const secondaryContainer = Color(0xFFE8EAF6);
static const secondaryFixed = Color(0xFFE0E7FF);      // Filter chips bg

// Text
static const onSurface = Color(0xFF191C1E);           // Primary text
static const onSurfaceVariant = Color(0xFF444653);    // Metadata, labels

// Status (NO green for success — use blue system)
static const error = Color(0xFFBA1A1A);               // Errors, negative
static const statusActive = Color(0xFF059669);         // Active advances
static const statusPending = Color(0xFFF59E0B);        // Pending items
static const statusClosed = Color(0xFF6B7280);         // Closed items

// Accent (from Stitch header)
static const tealPrimary = Color(0xFF006699);          // App bar accent
```

### Typography (Inter font, editorial scale)
- **Display** — Large impact numbers (balances, totals). `Inter 700`, tight letter-spacing (-0.02em)
- **Headline** — Section headers. `Inter 700`, generous top-margin (3x bottom-margin)
- **Body** — Financial data, list items. `Inter 400/500`, 14px
- **Label** — Metadata, micro-copy. `Inter 600`, 11px, uppercase, letter-spacing 0.06em, `onSurfaceVariant` color

### Design Rules (STRICT)
1. **NO 1px solid borders** for sectioning — use background color shifts only
2. **NO pure black shadows** — use `onSurface` (#191C1E) at 4% opacity, 40px blur
3. **Gradient CTAs** — Primary buttons use linear gradient from `primary` to `primaryContainer` at 135°
4. **No divider lines** between list items — use vertical white space (24px) or alternating surface tones
5. **Input fields** — No 4-sided borders. Use surface background with 2px bottom accent on focus
6. **Filter chips** — Full border-radius (Stadium shape), `secondaryFixed` background
7. **Glassmorphism header** — Sticky app bar with backdrop-blur, 80% opacity white
8. **Card radius** — 16px (1rem) default, 24px (1.5rem) for XL cards

### Stitch Screen Designs (6 screens — MATCH THESE EXACTLY)

**1. Employee Dashboard (Home)**
- Glassmorphism sticky header: "F" logo circle + "Emerald" + notification bell + overflow menu
- Greeting card: "Good afternoon, {name}" + subtitle + email + role badge (ADMIN/EMPLOYEE)
- Quick action icon buttons row: Settings, Notifications (with red badge count), Approvals, Dashboard
- "Scan Receipt" card: Icon + title + subtitle + Camera button (teal) + Gallery button (outlined)
- "Enter Manually" card: Icon + title + subtitle + arrow
- "Recent Entries" section: list items with category badge, vendor, project, amount

**2. Expense History**
- Header: "Expense History" + notification icon
- Stats row: TOTAL COUNT (142) | TOTAL AMOUNT (₹42.5k) | THIS MONTH (₹8.2k)
- Search bar: "Search by vendor or category..."
- Filter chips row: "All Filters" (primary), "Project" (outlined), "Category" (outlined)
- Results count: "SHOWING 10 OF 142 RESULTS" + "Select All" checkbox
- Expense list cards: Category badge (colored), vendor name, amount (₹), project name, date
- Pagination: 1 2 3 ... buttons

**3. Advance Management**
- Back arrow + "Advance Management" title + notification icon
- Stats row: ALLOCATED (₹25k) | SETTLED (₹12k) | BALANCE (₹13k)
- "Create Advance Request" full-width button (orange gradient)
- "RECENT REQUESTS" header + "View All" link
- Advance cards: Project name, type badge (PROJECT/SERVICE/SURVEY), ID, status badge (ACTIVE/PENDING/CLOSED), requested amount

**4. Request Advance (Blue Theme)**
- Header: "ExpenseFlow" branding
- "Request Advance" title + subtitle
- Form: Project Name dropdown, Requested Amount ($ input), Available balance text, Visit Type toggle (SITE/OFFICE/OTHER), Purpose/Notes textarea
- Bottom nav: Ledger, Advances, Reports, Settings

**5. Submit Reimbursement Step 1 (Blue Theme)**
- Back arrow + "ExpenseFlow" branding
- "Submit Reimbursement" title + "STEP 1 OF 4" indicator
- "APPROVED LEDGER" subtitle
- Expense selection list: Checkbox + expense name + category + date + receipt count + amount
- "SHOW OLDER APPROVED EXPENSES" link
- Bottom sticky: "REIMBURSEMENT TOTAL: $695.70" + "3 items selected" + "Next Step" button

**6. Azure Ledger Design System** — Full design token documentation (see above)

---

## Project Context

**App Name:** FluxGen Expense Tracker
**Domain:** Internal corporate expense management for FluxGen Technologies
**Current Stack:** Vanilla JavaScript + CSS, Supabase (PostgreSQL + Auth + Realtime), Capacitor (Android)
**Target:** Flutter (iOS + Android) with Supabase backend (reuse existing database & auth)

### What This App Does
A complete corporate expense management system with:
- Receipt scanning via OCR (Tesseract.js)
- Multi-role approval workflows (Employee → Manager → Accountant)
- Cash advance management with project-level tracking
- Google Sheets export, Tally ERP integration, PDF generation
- Real-time notifications via Supabase subscriptions
- UPI payment integration (India-specific)
- Offline-first with background sync

### User Roles (4 roles, 2 modes)
| Role | Access | Key Actions |
|------|--------|-------------|
| **Employee** | Employee dashboard | Add expenses, scan receipts, request advances, submit vouchers, view reports |
| **Manager** | Admin dashboard | Everything employee can + approve/reject vouchers & advances from team |
| **Accountant** | Admin dashboard | Everything manager can + final approval, mark as paid, Tally export, payment tracking |
| **Admin** | Admin dashboard | Everything accountant can + org setup, employee management, project management, role assignment |

**Modes:**
- **Personal Mode** — Single user, no organization. Local expense tracking only.
- **Company Mode** — Multi-user with organization. Full approval workflows, role-based access.

---

## Existing Database Schema (Supabase — REUSE AS-IS)

```
profiles          — id, email, name, organization_id, role, employee_id, designation, department, profile_picture
expenses          — id, user_id, date, vendor, description, amount, category, subcategory, receipt_url, paymentMode, voucherStatus, visitType, billAttached
expense_images    — id, expense_id, image_url, storage_path
orphaned_images   — id, user_id, image_url, storage_path, expires_at
advances          — id, user_id, project_name, amount, purpose, status, manager_id, visit_type, organization_id, submitted_at
advance_history   — id, advance_id, action, acted_by, comment, created_at
vouchers          — id, organization_id, submitted_by, voucher_number, status, manager_id, accountant_id, total_amount, expense_count, notes, submitted_at
voucher_expenses  — id, voucher_id, expense_id
voucher_history   — id, voucher_id, action, acted_by, comment, created_at
payment_transactions — id, voucher_id, advance_id, amount, payment_method, payment_reference, status, user_id
organizations     — id, name, domain, owner_id
employee_whitelist — id, organization_id, user_id, role, is_active
projects          — id, organization_id, project_code, project_name, client_name, description
notifications     — id, user_id, type, title, message, read, created_at
activity_log      — id, user_id, action, description, created_at
employee_bank_details — id, user_id, account_holder_name, account_number, ifsc_code, bank_name, upi_id, preferred_method
kodo_claims       — id, user_id, claim_id, amount, status, checker_name, category_name
```

**Auth:** Supabase Auth with email/password + Google OAuth (restricted to @fluxgentech.com domain)

---

## Complete Screen Inventory

### Authentication (3 screens)
1. **Login Screen** — Email/password + Google OAuth button + "Forgot password" link
2. **Signup Screen** — Email, password, name, employee ID + Google OAuth
3. **Forgot Password Screen** — Email input, sends reset link

### Employee Dashboard (5 sections as tabs/pages)

#### 1. Expenses (Home)
- **Greeting header** — "Good morning, {name}" with date
- **Scan Receipt card** — Drag-drop zone, camera button, gallery button. Supports JPG/PNG/WebP/HEIC/PDF
- **Manual Entry card** — Quick entry button that opens expense form
- **Recent entries list** — Last 5 expenses with date, vendor, amount, category badge
- **Action cards row:**
  - View Google Sheet (opens external link)
  - Saved Images (orphaned images gallery)
  - PDF Library (uploaded PDFs)
- **Submit Reimbursement button** — Opens multi-step wizard
- **Floating Action Button** — Quick add expense

#### 2. History
- **Stats bar** — Total expenses count, total amount, this month count
- **Search bar** — Search by description/vendor
- **Filter chips/dropdowns:**
  - Project filter
  - Category filter
  - Date range (From/To)
  - Visit type (Project/Service/Survey)
  - Advance link filter
- **Expense list/table** — Paginated (25/50/100), each row shows: checkbox, date, amount, category badge, vendor, actions (edit/delete)
- **Select All checkbox** — For bulk operations
- **Export to Excel button**
- **Tap row → Expense Detail modal** — Full details with receipt image viewer

#### 3. Advance
- **Stats bar** — Total advance amount, settled, pending, balance
- **Create Advance button** — Opens form modal
- **Advance list** — Cards showing: project name, amount, visit type, status badge, dates
- **Advance form fields:**
  - Project Name (required)
  - Amount ₹ (required)
  - Visit Type toggle (Project/Service/Survey)
  - Notes (optional)
  - Manager dropdown (company mode)
  - Accountant dropdown (company mode)
- **Advance detail** — Tap to view history, linked expenses, balance tracking

#### 4. Reports (Analytics)
- **Breadcrumb** — "Insights > Analytics"
- **Date range filter** — From/To date pickers + Clear button
- **4 analytics cards in 2-column grid:**
  - **Spend by Category** — Table: Category, Amount, Count, % of Total
  - **Top Vendors** — Table: Vendor, Amount, Count
  - **Monthly Trend** — Table: Month, Amount, Count + inline bar chart
  - **Payment Modes** — Table: Method, Amount, Count, % of Total

#### 5. Settings
- **Profile card** — Name, email, employee ID, designation, department. Tap to edit.
- **Bank Details card** — Account holder, masked account number, IFSC, UPI ID, preferred method
- **Appearance card** — Light/Dark theme toggle
- **Google Sheets card** — Configure sheet, view sheet link, reset
- **Admin Panel card** (admin only) — Opens org management
- **Clear Data card** — Clear expenses/images/everything with confirmation
- **Logout button**

### Admin/Accountant Dashboard (9 sections)

#### 1. Overview
- **Greeting header** — "Good morning, {company name}" with date
- **Search bar** — Search vouchers
- **Stats cards** — Pending, Approved, Rejected, Reimbursed counts with amounts
- **Quick action buttons** — Go to pending, export to Tally

#### 2. Pending Approval
- **Voucher list** — Table: Voucher #, Employee, Amount, Expenses count, Status, Date
- **Advance requests list** — Table: Type badge, Employee, Amount, Project, Status, Date
- **Per-row actions:** View, Approve, Reject buttons
- **Expandable detail** — Shows expense items, receipt images, timeline

#### 3. All Vouchers
- **Status filter tabs** — All, Pending, Approved, Rejected, Reimbursed
- **Voucher table** — Voucher #, Employee, Amount, Status badge, Date
- **Mark Paid button** — Opens payment modal (method dropdown + reference input)
- **Voucher detail** — Full breakdown with expense list, approval timeline, payment info

#### 4. Tally Export
- **Date range selection**
- **Voucher list for export**
- **Ledger mapping config** — Payment ledger name input
- **Preview XML button**
- **Export/Download XML button**

#### 5. Advances
- **Advance list with approve/reject** — Same as pending but filtered to advances
- **Advance detail modal** — Full history, linked expenses, balance

#### 6. Payments
- **Breadcrumb** — "Finance > Payments"
- **Stats pills** — Pending count (₹amount), Completed count, Failed count
- **Pending Payments table** — Employee, ID, Project, Amount, Bank Details, Date, "Mark Paid" button
- **Payment History table** — Employee, Amount, Method, Reference, Date, Status

#### 7. Pipeline
- **Visual pipeline** — Kanban-style columns: Submitted → Manager Approved → Accountant Approved → Reimbursed
- **Voucher cards** in each column with drag capability
- **Count badges** per stage

#### 8. Analytics
- **Date range filter** — From/To + Clear
- **4 analytics cards in 2-column grid:**
  - Spend by Department — Table: Department, Amount, Count, % of Total
  - Spend by Project — Table: Project, Amount, Count
  - Spend by Employee — Table: Employee, ID, Department, Amount, Count
  - Monthly Trend — Table: Month, Amount, Count + inline bar

#### 9. Settings (Admin)
- **Organization settings** — Company name, domain
- **Employee management** — List with role dropdown, add/invite, deactivate, CSV import
- **Project management** — List with edit/delete, create new, CSV import
- **Tally ledger mapping** — Payment ledger name

### Shared Modals/Sheets (implement as bottom sheets or full-screen on mobile)

1. **Submit Reimbursement Wizard** (4 steps) — Expense selection → Destination selection → Processing → Done
2. **Submit for Approval Modal** — Manager/accountant selection, expense period, declaration
3. **Expense Detail Sheet** — Full expense with image gallery, edit/delete
4. **Advance Form Sheet** — Create/edit advance
5. **Email Reimbursement Sheet** — Recipient, subject, message, attachment preview
6. **Mark Paid Sheet** — Payment method dropdown, reference input, confirm
7. **Image Viewer** — Full-screen pinch-zoom receipt viewer
8. **PDF Viewer** — In-app PDF display
9. **Profile Edit Sheet** — Edit name, emp ID, designation, department
10. **Bank Details Sheet** — Edit bank info with masked display
11. **Notification Panel** — Bell icon opens list of notifications with unread badge
12. **Activity Log Sheet** — Scrollable list of all actions
13. **Clear Data Confirmation** — Two-stage: select what to clear → type DELETE to confirm
14. **Admin Panel** — Org setup, employee list, project list (can be separate screens)

---

## Complete Feature Specifications

### A. OCR Receipt Scanning
- Camera capture (native camera API)
- Gallery selection (image picker)
- Multi-file batch processing
- Supported formats: JPG, PNG, WebP, HEIC, GIF, BMP, PDF
- Auto-extract: Date, Amount (₹), Vendor name, Category
- Amount parsing from Indian formats ("Rs. 500", "₹1,234.50", "Rupees Five Hundred")
- Show extraction results in editable form
- Image compression before upload (max 10MB per file)
- Upload to Supabase Storage or Cloudinary

### B. Expense CRUD
- **Create:** Date, category (with subcategories), description, amount, vendor, visit type, payment mode, bill attached toggle, receipt images
- **Read:** List with search, filter, sort, pagination
- **Update:** Edit all fields, replace receipt images
- **Delete:** Soft delete with confirmation
- **Categories:** Transportation (Cab, Auto, Metro, Bus, Train, Flight), Food, Accommodation, Office Supplies, Communication, Medical, Parking, Toll, Entertainment, Other
- **Payment Modes:** Cash, Bank Transfer, UPI
- **Visit Types:** Project, Service, Survey

### C. Voucher Approval Workflow
```
Employee submits voucher
    ↓
Status: pending_manager → Manager gets notification
    ↓ (approve)                    ↓ (reject)
Status: manager_approved      Status: rejected → Employee notified
    ↓                                              ↓ (can resubmit)
Status: pending_accountant → Accountant gets notification
    ↓ (approve)                    ↓ (reject)
Status: approved               Status: rejected → Employee notified
    ↓
Accountant clicks "Mark Paid"
    ↓
Status: reimbursed → Employee notified with payment details
```

### D. Advance Management
```
Employee requests advance (amount, project, visit type)
    ↓
Status: pending_manager → Manager notified
    ↓ (approve)              ↓ (reject → employee notified)
Status: pending_accountant → Accountant notified
    ↓ (approve)              ↓ (reject → employee notified)
Status: active → Employee can link expenses to this advance
    ↓
Track: allocated amount vs. spent amount vs. remaining balance
    ↓
Settlement: Accountant marks paid → Status: closed
```

### E. Google Sheets Integration
- Apps Script web app URL for read/write
- Export expenses to configured Google Sheet
- Tabs: ExpenseReport, Log, ByProject, Individual project tabs
- Auto-format with headers, formulas, currency
- Sheet creation from template on first export
- Duplicate prevention via exported expense ID tracking

### F. Notifications (Real-time)
- Supabase real-time subscriptions on `notifications` table
- Bell icon with unread count badge
- Types: voucher_submitted, voucher_approved, voucher_rejected, voucher_reimbursed, advance_submitted, advance_approved, advance_rejected, expense_added, employee_joined, system
- Tap notification → Navigate to relevant screen
- Mark as read on tap
- Push notifications via Firebase Cloud Messaging (new for Flutter)

### G. PDF Generation
- Generate reimbursement package PDF combining all selected expenses
- Include: Employee info, expense table, receipt images, total summary
- Libraries: pdf package for Flutter
- Share/download generated PDF

### H. Tally ERP Export
- Generate Tally-compatible XML from approved vouchers
- Configurable ledger mapping (payment ledger name)
- Batch export with date range selection
- Download XML file

### I. Offline Support
- Cache expenses locally using Hive/Isar
- Queue create/update/delete operations when offline
- Sync automatically when connectivity restored
- Show offline indicator in app bar
- Conflict resolution: server wins for approval status, client wins for expense edits

### J. Theme Support
- Light and Dark themes
- Material Design 3 color scheme
- Persistent preference (SharedPreferences)
- Dynamic theme switching without restart

---

## Architecture & Technical Requirements

### State Management
- **Riverpod** (recommended) or BLoC for state management
- Separate providers for: Auth, Expenses, Advances, Vouchers, Notifications, Settings

### Folder Structure
```
lib/
├── main.dart
├── app.dart                    # MaterialApp, theme, routes
├── core/
│   ├── theme/
│   │   ├── app_theme.dart      # Light & dark ThemeData
│   │   ├── app_colors.dart     # Color palette constants
│   │   └── app_typography.dart # Text styles
│   ├── constants/
│   │   ├── app_constants.dart  # API URLs, timeouts, limits
│   │   └── categories.dart     # Expense categories & subcategories
│   ├── utils/
│   │   ├── currency_formatter.dart  # ₹ Indian locale formatting
│   │   ├── date_formatter.dart      # DD/MM/YYYY, relative dates
│   │   ├── validators.dart          # Form validation helpers
│   │   └── extensions.dart          # String, DateTime extensions
│   └── network/
│       ├── supabase_client.dart     # Singleton Supabase init
│       └── connectivity_service.dart # Online/offline detection
│
├── models/
│   ├── user_profile.dart
│   ├── expense.dart
│   ├── advance.dart
│   ├── voucher.dart
│   ├── notification_item.dart
│   ├── organization.dart
│   ├── project.dart
│   ├── payment_transaction.dart
│   ├── bank_details.dart
│   └── activity_log_entry.dart
│
├── services/
│   ├── auth_service.dart           # Login, signup, Google OAuth, logout
│   ├── expense_service.dart        # Expense CRUD + image upload
│   ├── advance_service.dart        # Advance CRUD + approval
│   ├── voucher_service.dart        # Voucher CRUD + approval workflow
│   ├── notification_service.dart   # Real-time notifications + FCM
│   ├── ocr_service.dart            # Receipt scanning & text extraction
│   ├── google_sheets_service.dart  # Export to Google Sheets
│   ├── pdf_service.dart            # PDF generation
│   ├── tally_service.dart          # Tally XML export
│   ├── storage_service.dart        # Image/file upload to Supabase Storage
│   ├── organization_service.dart   # Org CRUD, employee management
│   └── offline_service.dart        # Local cache + sync queue
│
├── providers/                       # Riverpod providers
│   ├── auth_provider.dart
│   ├── expense_provider.dart
│   ├── advance_provider.dart
│   ├── voucher_provider.dart
│   ├── notification_provider.dart
│   ├── theme_provider.dart
│   └── settings_provider.dart
│
├── screens/
│   ├── auth/
│   │   ├── login_screen.dart
│   │   ├── signup_screen.dart
│   │   └── forgot_password_screen.dart
│   ├── employee/
│   │   ├── employee_shell.dart          # Scaffold with bottom nav
│   │   ├── expenses/
│   │   │   ├── expenses_screen.dart     # Home: scan + manual + recent
│   │   │   ├── add_expense_screen.dart  # Full expense form
│   │   │   └── expense_detail_screen.dart
│   │   ├── history/
│   │   │   ├── history_screen.dart      # List + search + filters
│   │   │   └── history_filters.dart
│   │   ├── advance/
│   │   │   ├── advance_screen.dart      # List + stats
│   │   │   ├── advance_form_sheet.dart  # Create/edit bottom sheet
│   │   │   └── advance_detail_screen.dart
│   │   ├── reports/
│   │   │   └── reports_screen.dart      # Analytics tables
│   │   └── settings/
│   │       ├── settings_screen.dart
│   │       ├── profile_edit_screen.dart
│   │       ├── bank_details_screen.dart
│   │       └── admin_panel_screen.dart
│   ├── admin/
│   │   ├── admin_shell.dart             # Scaffold with drawer/bottom nav
│   │   ├── overview_screen.dart
│   │   ├── pending_approval_screen.dart
│   │   ├── all_vouchers_screen.dart
│   │   ├── voucher_detail_screen.dart
│   │   ├── tally_export_screen.dart
│   │   ├── advances_screen.dart
│   │   ├── payments_screen.dart
│   │   ├── pipeline_screen.dart
│   │   ├── analytics_screen.dart
│   │   └── admin_settings_screen.dart
│   └── shared/
│       ├── submit_wizard_screen.dart    # Multi-step reimbursement
│       ├── approval_submit_sheet.dart   # Submit for approval
│       ├── image_viewer_screen.dart     # Full-screen receipt viewer
│       ├── pdf_viewer_screen.dart
│       └── notification_screen.dart
│
├── widgets/
│   ├── common/
│   │   ├── app_button.dart             # Primary, secondary, danger variants
│   │   ├── app_text_field.dart         # Styled input with label + validation
│   │   ├── app_card.dart               # Consistent card styling
│   │   ├── status_badge.dart           # Color-coded status pills
│   │   ├── stat_card.dart              # Icon + value + label metric card
│   │   ├── empty_state.dart            # Illustration + message for empty lists
│   │   ├── loading_indicator.dart      # Consistent loading spinner
│   │   ├── error_widget.dart           # Error state with retry
│   │   └── confirm_dialog.dart         # Reusable confirmation dialog
│   ├── expense/
│   │   ├── expense_list_tile.dart      # Single expense row
│   │   ├── receipt_scanner.dart        # Camera + gallery + drag-drop
│   │   ├── category_picker.dart        # Category + subcategory selector
│   │   ├── payment_mode_toggle.dart    # Cash/Bank/UPI toggle
│   │   └── visit_type_toggle.dart      # Project/Service/Survey toggle
│   ├── voucher/
│   │   ├── voucher_list_tile.dart
│   │   ├── approval_actions.dart       # Approve/reject buttons
│   │   └── voucher_timeline.dart       # Approval history timeline
│   ├── advance/
│   │   ├── advance_list_tile.dart
│   │   └── advance_stats_bar.dart
│   └── analytics/
│       ├── analytics_table_card.dart   # Table inside card (like admin analytics)
│       └── inline_bar.dart             # Small inline progress bar for tables
```

### Routing
- **GoRouter** with shell routes for bottom navigation
- Auth guard: redirect to login if not authenticated
- Role guard: redirect employee vs. admin dashboard based on role
- Deep link support for notification tap navigation

### Dependencies (pubspec.yaml)
```yaml
dependencies:
  flutter:
    sdk: flutter
  supabase_flutter: ^2.0.0     # Supabase client + auth + realtime
  flutter_riverpod: ^2.4.0     # State management
  go_router: ^13.0.0           # Navigation
  google_sign_in: ^6.2.0       # Google OAuth
  image_picker: ^1.0.0         # Camera + gallery
  google_mlkit_text_recognition: ^0.12.0  # On-device OCR
  pdf: ^3.10.0                 # PDF generation
  printing: ^5.12.0            # PDF viewing + sharing
  share_plus: ^7.2.0           # Share files
  path_provider: ^2.1.0        # Local file paths
  hive_flutter: ^1.1.0         # Local database for offline
  connectivity_plus: ^5.0.0    # Network status
  cached_network_image: ^3.3.0 # Image caching
  shimmer: ^3.0.0              # Loading skeletons
  intl: ^0.19.0                # Date + currency formatting (Indian locale)
  flutter_animate: ^4.3.0      # Animations
  photo_view: ^0.14.0          # Pinch-zoom image viewer
  file_picker: ^6.1.0          # File selection
  excel: ^4.0.0                # Excel export
  xml: ^6.5.0                  # Tally XML generation
  firebase_messaging: ^14.7.0  # Push notifications
  url_launcher: ^6.2.0         # Open Google Sheets, UPI apps
  shared_preferences: ^2.2.0   # Theme + settings persistence
  flutter_local_notifications: ^16.0.0  # Local notification display
```

---

## UI/UX Design Guidelines

### Design System
- **Framework:** Material Design 3 (Material You)
- **Grid:** 8px spacing system
- **Border radius:** 12px for cards, 8px for inputs, 20px for bottom sheets
- **Elevation:** Minimal — prefer borders over shadows

### Color Palette
**USE THE AZURE LEDGER TOKENS DEFINED IN THE STITCH DESIGN SYSTEM SECTION ABOVE.**
The app uses a deep blue primary (#00288E) with teal accents (#006699), NOT green.

### Typography
- **Font:** Inter (Google Fonts) — editorial financial journal feel
- **Display:** 700 weight, tight letter-spacing (-0.02em), for impact numbers
- **Headlines:** 700 weight, generous top-margin (3x bottom)
- **Body:** 400/500 weight, 14px base
- **Labels:** 600 weight, 11px, uppercase, 0.06em letter-spacing, `onSurfaceVariant` color

### Mobile-First Principles
- Bottom navigation for primary sections (not sidebar)
- Bottom sheets for forms and details (not modals/popups)
- Pull-to-refresh on all lists
- Swipe actions on list items (edit, delete)
- Large touch targets (min 48px)
- Haptic feedback on key actions
- Skeleton loading states (shimmer)

### What to IMPROVE Over the Web Version
1. **Remove clutter** — Web has too many inline cards on the home screen. Mobile should be cleaner.
2. **Bottom sheets over modals** — All forms and details should slide up as bottom sheets, not centered popups.
3. **Native camera integration** — Direct camera access instead of HTML file input.
4. **On-device OCR** — Use Google ML Kit instead of Tesseract.js for faster, offline-capable scanning.
5. **Push notifications** — Firebase Cloud Messaging instead of polling.
6. **Smoother animations** — Page transitions, list item animations, status changes.
7. **Better empty states** — Illustrations with helpful messages instead of just "No data".
8. **Gesture navigation** — Swipe to go back, swipe list items for quick actions.
9. **Biometric auth** — Fingerprint/Face ID for app lock (optional setting).
10. **Better offline experience** — Clear offline indicator, queue display, auto-sync.

---

## Implementation Priority

### Phase 1 — Core (MVP)
1. Auth (login, signup, Google OAuth)
2. Employee: Add expense (manual + camera scan)
3. Employee: History (list, search, filter)
4. Employee: Settings (profile, theme, logout)
5. Offline caching for expenses

### Phase 2 — Approval Workflow
6. Employee: Submit voucher for approval
7. Admin: Pending approval screen
8. Admin: Approve/reject vouchers
9. Admin: All vouchers list
10. Notifications (real-time + push)

### Phase 3 — Advances & Payments
11. Employee: Advance request & tracking
12. Admin: Advance approval
13. Admin: Payments screen (mark as paid)
14. Admin: Pipeline view

### Phase 4 — Exports & Analytics
15. Employee: Reports screen (analytics tables)
16. Admin: Analytics screen
17. Google Sheets export
18. PDF generation & sharing
19. Tally XML export
20. Excel export

### Phase 5 — Polish
21. Bank details management
22. Admin panel (org, employees, projects)
23. Activity log
24. Biometric auth
25. Onboarding flow for first-time users

---

## APK Build & Release Requirements

### App Identity
- **App Name:** FluxGen Emerald
- **Package Name:** com.fluxgentech.emerald
- **Min SDK:** Android 21 (Lollipop)
- **Target SDK:** Android 34
- **Icon:** "F" letter in teal circle (#006699) on white, adaptive icon

### Build Configuration
```bash
# Debug APK
flutter build apk --debug

# Release APK (signed)
flutter build apk --release

# App Bundle for Play Store
flutter build appbundle --release
```

### Signing
- Generate keystore: `keytool -genkey -v -keystore fluxgen-emerald.jks -keyalg RSA -keysize 2048 -validity 10000 -alias emerald`
- Configure `android/key.properties` and `android/app/build.gradle`

### Permissions (AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

### Deep Links (for Google OAuth callback)
```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="com.fluxgentech.emerald" android:host="auth" />
</intent-filter>
```

### Supabase Config
```dart
// Use existing Supabase project — DO NOT create a new one
const supabaseUrl = 'https://ynpquqlxafdvoealmfye.supabase.co';
const supabaseAnonKey = '<existing-anon-key>';  // Safe to embed in client
```

---

## Output Format

For each screen:
1. **Design explanation** — How it matches the Stitch design and what was adapted for Flutter
2. **Widget tree overview** — High-level structure
3. **Complete Dart code** — Production-ready, commented, follows Azure Ledger design system
4. **Separate files** — One widget per file, clearly named

**CRITICAL:** For the 6 screens that have Stitch designs (Dashboard, History, Advance, Request Advance, Submit Reimbursement, Azure Ledger), match the design PIXEL-PERFECT. For all other screens, extrapolate from the same design system.

Start with Phase 1. Build the foundation (theme, models, services, routing) first, then screens one by one.
