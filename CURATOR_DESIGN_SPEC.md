# 🎨 CURATOR Design Specification
## Expense Tracker UI Redesign - Complete Premium Dashboard

**Date:** 2026-04-04  
**Design Style:** "The Curator" - Premium Fintech Dashboard  
**Color Theme:** White & Black Minimalist (B&W)  
**Navigation:** Sidebar + Dedicated Pages  
**Status:** Design Specification (Ready for Implementation)  

---

## 📋 Overview

Complete redesign of the expense tracker to match "The Curator" premium fintech dashboard aesthetic. The app maintains all existing features (OCR scanning, UPI integration, Google Sheets export, advance tracker) while presenting them through a clean, professional white-and-black UI with dedicated pages for each major feature.

### Design Principles
- **Minimalist:** White backgrounds, black text, subtle grays for secondary content
- **Hierarchy:** Clear visual priority through size, weight, spacing
- **Professional:** Premium fintech aesthetic (Apple-like simplicity)
- **Functional:** Every element serves a purpose
- **Accessible:** High contrast, readable typography, clear CTAs

---

## 🏗️ Architecture & Layout

### Page Structure
```
expenses-tracker/
├── Dashboard (main)
├── Add Expense
├── Expenses (list view)
├── Wallets
├── Summary
├── Accounts
└── Settings
```

### Layout Grid
- **Sidebar width:** 240px (desktop), collapsible on mobile
- **Main content:** Flexible, responsive
- **Max width:** 1440px (for large screens)
- **Padding:** 16px (mobile), 24px (tablet), 32px (desktop)
- **Gap between sections:** 24px

### Responsive Breakpoints
- **Mobile:** 320px - 480px (sidebar hidden, hamburger menu)
- **Tablet:** 481px - 768px (sidebar collapsed/visible toggle)
- **Desktop:** 769px+ (sidebar always visible)

---

## 🎭 Visual System

### Color Palette (Pure B&W)
```
Primary Colors:
  - White:        #FFFFFF (backgrounds, cards)
  - Black:        #000000 (text, strong elements)
  - Light Gray:   #F5F5F5 (subtle backgrounds, hover states)
  - Medium Gray:  #E0E0E0 (borders, dividers)
  - Dark Gray:    #404040 (secondary text)
  - Neutral Gray: #808080 (tertiary text, disabled states)

Semantic Colors (B&W interpretation):
  - Success:      #000000 (or dark gray for positive)
  - Warning:      #404040 (darker gray)
  - Error:        #000000 (strong black for errors)
  - Info:         #666666 (medium gray)
```

### Typography
```
Font Family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif

Sizes & Weights:
  - Display (Hero):    32px / Bold (700)      → Balance amount, page titles
  - Heading 1:         24px / Bold (700)      → Section headers
  - Heading 2:         20px / Semi-bold (600) → Card titles, subsections
  - Heading 3:         16px / Semi-bold (600) → Labels, highlights
  - Body (regular):    14px / Regular (400)   → Main text content
  - Body (small):      12px / Regular (400)   → Secondary text, hints
  - Label:             11px / Semi-bold (600) → Form labels, badges
  - Button:            14px / Semi-bold (600) → CTA text

Line Heights:
  - Display: 1.2
  - Headings: 1.3
  - Body: 1.5
  - Form labels: 1.2
```

### Spacing System
```
Base unit: 8px

Spacing scale:
  xs:  4px   (tight spacing)
  sm:  8px   (compact spacing)
  md:  16px  (standard spacing)
  lg:  24px  (generous spacing)
  xl:  32px  (section spacing)
  xxl: 48px  (major spacing)

Applied to:
  - Padding: p-{size}
  - Margin: m-{size}
  - Gap: gap-{size}
```

### Shadows (Subtle)
```
None (B&W minimalist approach - no shadows)
Alternative: 1px solid border on cards for definition
```

### Border Radius
```
None for minimalist feel (square corners)
or 2px for very subtle rounding on form inputs only
```

---

## 📐 Component Library

### Buttons
```
Primary Button (CTA):
  - Background: #000000 (black)
  - Text: #FFFFFF (white)
  - Padding: 12px 24px
  - Size: 14px semi-bold
  - Hover: #404040 (dark gray)
  - Border: None

Secondary Button:
  - Background: #F5F5F5 (light gray)
  - Text: #000000 (black)
  - Padding: 12px 24px
  - Border: 1px solid #E0E0E0
  - Hover: #E0E0E0 background

Ghost Button:
  - Background: Transparent
  - Text: #000000 (black)
  - Border: None
  - Hover: #F5F5F5 background

States:
  - Disabled: Opacity 0.5
  - Active: #000000 with underline or highlight
```

### Cards
```
Structure:
  - Background: #FFFFFF
  - Border: 1px solid #E0E0E0
  - Padding: 16px
  - No shadow (or 1px border for definition)

Variants:
  - Default: White card on light gray background
  - Highlighted: White card with top border accent (1px black)
  - Transaction item: Minimal styling, row layout

Spacing inside card:
  - Padding: 16px / 24px
  - Internal sections: 16px gap
```

### Forms & Inputs
```
Input Field:
  - Background: #FFFFFF
  - Border: 1px solid #E0E0E0
  - Text: #000000
  - Placeholder: #808080 (neutral gray)
  - Padding: 8px 12px
  - Height: 44px (accessible touch target)
  - Font: 14px regular

Focus State:
  - Border: 1px solid #000000 (black)
  - Outline: None

Disabled State:
  - Background: #F5F5F5
  - Border: 1px solid #E0E0E0
  - Text: #808080
  - Cursor: not-allowed

Label:
  - Font: 11px semi-bold
  - Color: #000000
  - Margin-bottom: 4px
  - Display: block

Error State:
  - Border: 1px solid #000000
  - Error text: #000000, 12px regular
  - Margin-top: 4px
```

### Tables & Lists
```
Table Structure:
  - Header row: #F5F5F5 background, 12px semi-bold labels
  - Data rows: White background, 14px regular text
  - Row hover: #F5F5F5 background
  - Borders: 1px solid #E0E0E0 between rows
  - Padding: 12px (cells)

Transaction List:
  - Card-like rows (white background, 1px border)
  - Flex layout: icon | details | amount
  - Hover: #F5F5F5 background
  - Padding: 12px 16px
```

### Sidebar Navigation
```
Structure:
  - Width: 240px (desktop), collapsible (mobile)
  - Background: #FFFFFF
  - Border-right: 1px solid #E0E0E0

Logo/Brand:
  - Padding: 24px 16px
  - Font: 18px bold
  - Text: #000000

Nav Items:
  - Padding: 12px 16px
  - Font: 14px regular
  - Text: #404040
  - Icon: 16x16px, #404040
  - Margin-bottom: 8px

Active State:
  - Background: #F5F5F5
  - Text: #000000
  - Bold weight (600)
  - Left border: 3px solid #000000

Hover State:
  - Background: #F5F5F5
  - Cursor: pointer

Bottom Section (Settings, Logout):
  - Border-top: 1px solid #E0E0E0
  - Padding-top: 16px
  - Same styling as nav items
```

### Header/Top Bar
```
Structure:
  - Background: #FFFFFF
  - Border-bottom: 1px solid #E0E0E0
  - Padding: 16px 24px
  - Display: Flex (justify-between)

Left: Search bar
  - Input-like styling
  - Placeholder: "Search transactions..."
  - Width: 300px (desktop)

Right: User profile + menu
  - Avatar: 32x32px, #000000 initials on #F5F5F5
  - Name: 14px regular
  - Dropdown menu on click
```

---

## 📄 Page Designs

### 1. DASHBOARD (Main Landing Page)

**Purpose:** Overview of financial health, recent activity, key metrics

**Layout:** Single column on mobile, multi-column on desktop

**Sections:**

#### Top: Header
- Search bar (centered)
- User profile icon (top right)

#### Hero Card: Total Balance
```
┌─────────────────────────────────┐
│ Total Balance                    │
│ $142,850.42          +12.4%      │
│                                  │
│ Monthly Income    Monthly Expenses│
│    $12,400              $4,820    │
└─────────────────────────────────┘

Styling:
  - Background: #FFFFFF
  - Border: 1px solid #E0E0E0
  - Padding: 24px
  - Amount font: 32px bold
  - Percentage: 12px gray
  - Two columns for income/expenses
```

#### Spending Insights Chart
```
Section: "Spending Insights"
  - Bar chart (Jan-Aug)
  - X-axis: Month labels
  - Y-axis: Amount values
  - Active bar: #000000 (black)
  - Inactive bars: #E0E0E0 (light gray)
  - Tooltip on hover
```

#### Wallets Section
```
"Your Wallets" card list
  - Platinum Business: $42,105
  - Savings Account: $98,042
  - "+ Connect New Wallet" button

Each wallet as mini card:
  - Icon (16x16)
  - Name, account number
  - Balance amount (right-aligned)
  - Hover: #F5F5F5 background
```

#### Recent Transactions
```
List of latest 5-10 transactions:
  - Icon | Merchant name, type | Amount
  - Date/time below merchant
  - Negative amounts in black (expenses)
  - Row: 1px border bottom, 12px padding
  - Click → View details or edit
```

#### Bottom: "Add Expense" CTA
- Primary button: "+ Add Expense"
- Links to Add Expense page

---

### 2. ADD EXPENSE (Dedicated Page)

**Purpose:** Full-featured expense entry with OCR, UPI, manual input

**Layout:** Single column, form-focused

**Sections:**

#### Tabs/Mode Selector
```
┌─────────────────────────────────┐
│ Quick Add │ Scan Receipt │ UPI   │
└─────────────────────────────────┘

Active tab: Black background
Inactive: Light gray background
```

#### TAB 1: Quick Add (Default)
```
Form fields (vertical stack):

1. Merchant/Vendor
   Input: text field, placeholder "Enter merchant name"

2. Amount
   Input: number field, currency prefix "$"

3. Category
   Dropdown: Food, Transport, Utilities, etc.

4. Payment Method
   Radio buttons: Cash, Credit Card, Debit Card, UPI, etc.

5. Date
   Input: date picker

6. Notes (Optional)
   Textarea: placeholder "Add notes..."

7. Receipt Image (Optional)
   Upload button or drag-drop zone

8. Action Buttons
   [Cancel] [Save & Add Another] [Save]
```

#### TAB 2: Scan Receipt (OCR)
```
Camera/File Upload:
  - Large drag-drop zone or "Choose File" button
  - Preview of selected image
  - "Scan & Extract" button

Extracted Data (Auto-filled):
  - Merchant name
  - Amount
  - Date
  - Items list (if applicable)

Review & Edit:
  - All fields editable
  - "Confirm" to add to expenses

Status states:
  - Uploading... (spinner)
  - Processing... (spinner)
  - Ready (extracted fields shown)
  - Error (retry button)
```

#### TAB 3: UPI Import
```
UPI App Selector:
  - Google Pay
  - PhonePe
  - Paytm
  - Other

Click to launch app → returns transaction data

Received Transaction:
  - All fields auto-filled from UPI app
  - User confirms/edits
  - Save to expenses
```

#### Validation & Error States
```
Required fields: Merchant, Amount, Date
Error display: Red border + error text below field
Success: Confirmation message, redirect to dashboard or add another

Loading states:
  - Spinner on buttons during save
  - Disable form during processing
```

---

### 3. EXPENSES (List View)

**Purpose:** Browse, filter, search all expenses

**Layout:** Full-width list with sidebar filters

**Sections:**

#### Header
- Title: "Expenses"
- Search bar
- Filter/Sort button

#### Filters (Sidebar on desktop, Collapse on mobile)
```
Filters:
  - Date Range (from/to)
  - Category (checkboxes)
  - Payment Method (checkboxes)
  - Amount Range (slider)
  - Tags/Labels

Apply / Reset buttons
```

#### Expenses Table/List
```
Column layout:
  | Icon | Merchant | Category | Date | Amount |

Each row:
  - 1px border bottom
  - 12px padding
  - Hover: #F5F5F5 background
  - Click row: Open detail view or edit modal

Actions (right side):
  - Edit icon
  - Delete icon (with confirmation)
  - Menu (...)

Pagination:
  - Previous / Next buttons
  - "Showing X of Y"
```

#### Bulk Actions
```
Checkbox select multiple:
  - Delete selected
  - Export selected
  - Tag selected
```

---

### 4. WALLETS (Account Management)

**Purpose:** View and manage connected accounts/wallets

**Layout:** Card grid or list

**Sections:**

#### Wallet List
```
Each wallet as card:
  - Icon (bank/service logo)
  - Wallet name (e.g., "Platinum Business")
  - Account number (masked)
  - Balance
  - Last synced (timestamp)
  
  Hover: #F5F5F5 background
  Click: View wallet details
```

#### Add New Wallet
```
Button: "+ Connect New Wallet"
  - Click → Modal or new page
  - Bank/service selector
  - Authentication flow
  - Confirmation
```

#### Wallet Details
```
Expanded view:
  - Transactions in this wallet
  - Balance history
  - Settings/disconnect
```

---

### 5. SUMMARY (Analytics/Reports)

**Purpose:** Financial overview, trends, insights

**Layout:** Cards + charts

**Sections:**

#### Summary Cards
```
Monthly Summary:
  - Total Income
  - Total Expenses
  - Net Savings
  - Average Daily Spend

Display as 2x2 grid of cards
  Each card: Number + label + trend indicator
```

#### Category Breakdown
```
Pie chart or table:
  - Category | Amount | % of total
  - Sorted by amount (descending)
```

#### Trends Chart
```
Multi-month comparison:
  - Line chart or bar chart
  - Income vs Expenses trend
  - Savings rate trend
```

#### Export Options
```
Button: "Export to Google Sheets"
  - Creates/updates connected Google Sheet
  - Shows confirmation
```

---

### 6. ACCOUNTS (User Management)

**Purpose:** Manage user profile and roles (for multi-user feature)

**Layout:** Form-based

**Sections:**

#### User Profile
```
- User avatar
- Name
- Email
- Role (User / Admin / Accountant)
- Edit button
```

#### Linked Accounts
```
(If team/advance features)
- List of team members
- Roles
- Invite user button
- Remove user button
```

#### Approval Workflows (Advanced)
```
(If advance tracker is enabled)
- Pending approvals
- Approved advances
- History
```

---

### 7. SETTINGS

**Purpose:** App configuration, preferences

**Layout:** Sidebar with sections

**Sections:**

#### General Settings
```
- App name/branding
- Timezone
- Currency preference
- Date format
```

#### Notifications
```
- Email notifications toggle
- Push notifications (mobile)
- Digest frequency
```

#### Advanced
```
- Clear cache
- Export all data
- Delete account
- Logout
```

#### Security
```
- Change password
- Connected apps/permissions
- Session management
```

---

## 🔄 Navigation Flow

```
Sidebar (always visible on desktop):
├── Dashboard (home icon) → Dashboard page
├── Add Expense (plus icon) → Add Expense page
├── Expenses (list icon) → Expenses list
├── Wallets (wallet icon) → Wallets page
├── Summary (chart icon) → Summary/Analytics
├── Accounts (people icon) → Accounts page
└── Settings (gear icon) → Settings page

Top Bar:
├── Search (global search)
└── User Profile (click → Account menu + Logout)

Breadcrumb Navigation:
  Dashboard / Expenses / [Details] (on detail pages)
```

---

## 📱 Mobile Responsiveness

### Mobile Layout (< 481px)
```
Header:
  - Hamburger menu icon (left)
  - App logo (center)
  - User profile icon (right)

Sidebar:
  - Hidden by default
  - Hamburger click → Slide-in overlay sidebar
  - Dismiss on item click or backdrop click

Content:
  - Full width (24px padding)
  - Single column layout
  - Stack components vertically
  - Larger touch targets (44px minimum)

Forms:
  - Full-width inputs
  - Buttons full width or stacked
  - Date pickers/selects: native mobile UI

Tables/Lists:
  - Collapse to card layout
  - Essential columns visible
  - Swipe or menu (...) for actions
```

### Tablet Layout (481px - 768px)
```
Sidebar:
  - 180px width (narrower)
  - Icons only (text hidden on hover)
  - Toggle button to expand/collapse

Content:
  - Flex layout adapts
  - 2-column where appropriate
  - 16px padding

Forms:
  - 2-column layout possible
  - Inputs larger
```

---

## 🎯 Feature Integration Details

### OCR Scanning
- Tab in Add Expense page
- Upload image → process → extract fields
- User reviews and confirms
- Saves to database with image reference

### UPI Integration
- Tab in Add Expense page
- App launcher (Android) or deep link
- Returns transaction data
- Auto-fills form fields

### Google Sheets Export
- Button in Summary page
- One-click export all expenses
- Creates/updates Google Sheet
- Shows success confirmation

### Advance Tracker
- Separate section in Accounts or dashboard
- Manager approval workflows
- Status tracking (pending, approved, rejected)

### Receipt Images
- Upload with expense
- Store in Cloudinary
- View in transaction details
- Gallery view option

---

## 🎨 Visual Examples

### Color Usage in Context
```
Dashboard Hero Card:
  Background: White (#FFFFFF)
  Border: 1px solid #E0E0E0
  Text (Amount): Black (#000000), 32px bold
  Text (Subtitle): Dark Gray (#404040), 14px regular
  Percentage: Medium Gray (#808080), 12px regular

Button (Primary):
  Normal: Black (#000000) bg, white text
  Hover: Dark Gray (#404040) bg, white text
  Active: Black (#000000), white text, slight scale

Links:
  Default: Black (#000000), underline
  Hover: Dark Gray (#404040)
  Visited: Medium Gray (#808080)
```

---

## 📊 Design System Summary Table

| Element | Style | Size | Weight | Color |
|---------|-------|------|--------|-------|
| Page Title | Heading 1 | 24px | Bold | #000000 |
| Section Title | Heading 2 | 20px | Semi-bold | #000000 |
| Card Title | Heading 3 | 16px | Semi-bold | #000000 |
| Body Text | Regular | 14px | Regular | #000000 |
| Secondary Text | Small | 12px | Regular | #404040 |
| Label | Label | 11px | Semi-bold | #000000 |
| Disabled Text | - | - | Regular | #808080 |
| Button Text | Button | 14px | Semi-bold | White on Black |
| Input Text | Regular | 14px | Regular | #000000 |
| Placeholder | Regular | 14px | Regular | #808080 |
| Border | - | 1px | - | #E0E0E0 |

---

## ✅ Implementation Checklist

### Phase 1: Layout & Navigation
- [ ] Create sidebar navigation component
- [ ] Create header/top bar with search
- [ ] Implement responsive layout (desktop/tablet/mobile)
- [ ] Set up page routing (Dashboard, Add Expense, etc.)
- [ ] Create base HTML structure for all pages

### Phase 2: Dashboard Page
- [ ] Total balance hero card
- [ ] Spending insights chart (using Chart.js or similar)
- [ ] Wallets section
- [ ] Recent transactions list
- [ ] Style all elements with B&W theme

### Phase 3: Add Expense Page
- [ ] Quick Add tab with form
- [ ] Scan Receipt tab with OCR integration
- [ ] UPI Import tab with app launcher
- [ ] Validation and error handling
- [ ] Success confirmation

### Phase 4: Other Pages
- [ ] Expenses list with filters/search
- [ ] Wallets management page
- [ ] Summary/Analytics page
- [ ] Accounts page
- [ ] Settings page

### Phase 5: Polish & Testing
- [ ] Mobile responsiveness testing (all breakpoints)
- [ ] Cross-browser testing
- [ ] Dark mode (optional: invert B&W theme)
- [ ] Performance optimization
- [ ] Accessibility audit (WCAG AA)

### Phase 6: Integration
- [ ] Connect to existing Supabase backend
- [ ] Integrate OCR scanning (Tesseract.js)
- [ ] Integrate UPI launcher
- [ ] Integrate Google Sheets export
- [ ] Integrate advance tracker

---

## 📚 Implementation Notes

### Technology Stack
- **Frontend:** Vanilla JavaScript (existing) or upgrade to React/Vue
- **Styling:** CSS (organize by component)
- **Charts:** Chart.js, Recharts, or similar
- **Database:** Supabase (existing)
- **Deployment:** Vercel (existing)

### File Organization
```
frontend/
├── index.html (main entry)
├── pages/
│   ├── dashboard.html
│   ├── add-expense.html
│   ├── expenses.html
│   ├── wallets.html
│   ├── summary.html
│   ├── accounts.html
│   └── settings.html
├── css/
│   ├── globals.css (colors, typography, spacing)
│   ├── components.css (buttons, cards, forms)
│   ├── layout.css (sidebar, header, grid)
│   ├── pages.css (page-specific styles)
│   └── responsive.css (mobile breakpoints)
├── js/
│   ├── app.js (main app logic)
│   ├── router.js (page navigation)
│   ├── api.js (Supabase calls)
│   └── components.js (reusable components)
└── assets/
    ├── icons/
    └── images/
```

### Design Token Variables (CSS)
```css
:root {
  /* Colors */
  --color-white: #FFFFFF;
  --color-black: #000000;
  --color-gray-light: #F5F5F5;
  --color-gray-medium: #E0E0E0;
  --color-gray-dark: #404040;
  --color-gray-neutral: #808080;
  
  /* Typography */
  --font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-size-display: 32px;
  --font-size-h1: 24px;
  --font-size-h2: 20px;
  --font-size-h3: 16px;
  --font-size-body: 14px;
  --font-size-small: 12px;
  --font-size-label: 11px;
  
  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-xxl: 48px;
  
  /* Sidebar */
  --sidebar-width: 240px;
  --sidebar-width-mobile: 0;
}

@media (max-width: 768px) {
  :root {
    --sidebar-width: 180px;
  }
}
```

---

## 🎯 Success Criteria

✅ **Design is complete when:**
1. All 7 pages are designed and detailed
2. Color palette is B&W only (no accent colors)
3. Typography hierarchy is clear and consistent
4. Component library is documented
5. Responsive layout works at all breakpoints
6. Mobile (< 480px), tablet (480-768px), desktop (769px+) validated
7. All existing features can be accessed and used
8. Navigation is intuitive and consistent

✅ **Implementation is complete when:**
1. All pages are built in HTML/CSS/JS
2. Sidebar navigation fully functional
3. Responsive layout tested on real devices
4. All existing features integrated and working
5. No console errors or warnings
6. Accessibility audit passes (WCAG AA)
7. Performance is fast (Lighthouse > 90)
8. Deployed to Vercel and live

---

## 📝 Design Document Status

**Status:** ✅ DESIGN SPECIFICATION COMPLETE

**Next Steps:**
1. User reviews this specification
2. User approves design direction
3. Invoke superpowers:writing-plans to create implementation plan
4. Begin coding (Phase 1: Layout & Navigation)

**Ready to proceed?**
