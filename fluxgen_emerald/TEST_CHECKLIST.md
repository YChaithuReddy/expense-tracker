Excellent! Now I have comprehensive information. Let me compile the complete checklist:

---

# EXHAUSTIVE FEATURE & FLOW CHECKLIST — Expense Tracker Web App

This checklist documents every feature, user action, and expected result for cross-verification in the Flutter APK. Organized by screen and section.

## AUTH FLOWS (Login/Signup Pages)

- [ ] **Email Signup** — User enters name, email, password → validates email format, checks if email already in system → creates auth user + profile record → redirects to employee dashboard (Tables: auth.users, profiles)
- [ ] **Email Login** — User enters email, password → validates credentials → fetches user + profile → stores to localStorage → redirects to appropriate dashboard (Table: auth.users, profiles)
- [ ] **Google OAuth Login** — User clicks "Sign in with Google" → OAuth popup → email verified as company domain (fluxgentech.com) → creates/fetches profile → redirects to dashboard (Tables: auth.users, profiles)
- [ ] **Google OAuth Blocked** — Non-fluxgentech.com email → signOut called → error shown → redirect to login (Table: profiles)
- [ ] **Password Reset** — User enters email → validation → password reset email sent → link opens recovery page (Table: auth.users)
- [ ] **Logout** — User clicks logout → Supabase signOut() called → localStorage cleared → redirect to login.html (Table: auth.users)
- [ ] **Session Persistence** — On app load, checks localStorage user object → verifies Supabase session valid → if invalid, redirects to login (Table: auth.users)
- [ ] **Role Validation** — After login, user.role fetched from profiles → directs to employee (index.html) or admin (accountant.html) dashboard (Table: profiles)

---

## EMPLOYEE DASHBOARD HOME (index.html — section-expenses)

### Greeting Card
- [ ] **Greeting Message** — Shows "Good morning, [User Name]" with dynamic time-based greeting (Table: profiles)
- [ ] **User Email Display** — Shows user's email below name (Table: profiles)
- [ ] **Role Badge** — Displays role: "Employee", "Manager", "Accountant", "Admin" as colored badge (Table: profiles)

### Scan Receipt Section
- [ ] **Camera Button** — Opens device camera for photo capture with environment (rear) camera (File input: accept="image/*", capture="environment")
- [ ] **Gallery Button** — Opens file picker for image/PDF selection (File input: accept="image/*,.pdf")
- [ ] **Drag & Drop Zone** — Drag image/PDF onto section → validates file type, size — inserts into preview (Max: 10MB per file, 100MB total)
- [ ] **Image Preview Grid** — Shows thumbnails of selected images with remove button (DOM: #imagePreview)
- [ ] **Scan Bills OCR Button** — Processes images via Kodo OCR API → extracts text, amounts, dates → auto-fills form fields (External API: Kodo)
- [ ] **OCR Progress Bar** — Shows processing % during extraction (DOM: #progressText)
- [ ] **Skip Manual Entry Link** — Hides OCR section, shows blank expense form (DOM: #expenseFormSection)

### Recent Entries Card
- [ ] **Recent List** — Shows last 5-10 expenses with date, vendor, amount (Table: expenses, order by created_at DESC limit 10)
- [ ] **Tap Expense** — Opens expense detail view (modal or bottom sheet)
- [ ] **Empty State** — "No recent entries" message if expenses table is empty (Table: expenses)

### Submit for Approval Button (Company Mode Only)
- [ ] **Submit Button Visible** — Only shows if organization exists (isCompanyMode() = true) (Table: organizations)
- [ ] **Opens Submit Wizard Modal** — 4-step wizard for submission flow (DOM: #submitWizardModal)

### Quick Action Cards
- [ ] **Export to Google Sheets** — Opens Google Sheets Service → creates or reuses existing sheet → exports selected expenses (External: Google Apps Script, Table: profiles)
- [ ] **View Saved Images** — Opens orphaned images modal → displays grid of unattached images (Table: orphaned_images)
- [ ] **PDF Library** — Opens modal with generated reimbursement PDFs → download/share options (Table: reimbursement_pdfs)
- [ ] **Clear Data** — Opens confirmation modal → deletes all expenses, advances, images, activity logs (Tables: expenses, advances, orphaned_images, activity_log)
- [ ] **Download Reimbursement Package** — Generates PDF with all expense bills → shares via share sheet (Table: expenses, expense_images)

---

## EXPENSE FORM (Add/Edit Modal — #expenseFormSection)

### Date Picker
- [ ] **Date Input Field** — Flatpickr calendar widget → user selects date → pre-fills to today if new expense (Field: #date)
- [ ] **Date Validation** — Must be valid date, not in future (Validation: client-side)

### Category Selection
- [ ] **Main Category Dropdown** — Predefined list (Travel, Food, Accommodation, etc.) → selects main category (Field: #mainCategory, Table: expense_categories)
- [ ] **Subcategory** — Shows if main category has subcategories (Domestic Travel → Local, Interstate) (Field: #subcategory, Table: expense_categories)
- [ ] **Custom Category** — If "Other" selected, shows text input for custom category name (Field: #customCategory)
- [ ] **Category Hidden Field** — Stores final category value (main or custom) (Field: #category)

### Description Field
- [ ] **Text Input** — Free-form description (e.g., "Site visit", "Team lunch") (Field: #description, Max: text)
- [ ] **Required** — Form submission blocked if empty (Validation: required)

### Amount Field
- [ ] **Number Input** — Decimal amount (e.g., 1500.50) (Field: #amount, step="0.01")
- [ ] **Currency** — Amounts stored as numeric, displayed with ₹ symbol (Formatting: Rupees)
- [ ] **Required** — Form submission blocked if empty (Validation: required)

### Project Dropdown (Company Mode Only)
- [ ] **Project Selection** — Dropdown with list of org's projects → user selects project (Field: #projectDropdownContainer, Table: projects)
- [ ] **Hidden if Personal Mode** — Only shows if organization exists (Conditional: isCompanyMode())

### Vendor Field
- [ ] **Text Input** — Vendor/merchant name (e.g., "Taj Hotel", "Uber") (Field: #vendor)
- [ ] **Optional in Personal, Required in Company Mode** — Validation depends on mode

### Visit Type Toggle
- [ ] **Three Buttons** — "Project" (default), "Service", "Survey" → user selects one (DOM: .visit-type-btn)
- [ ] **Toggle State** — Clicked button gets .active class → value stored (Field: visit_type in expenses table)

### Payment Mode Toggle
- [ ] **Three Buttons** — "Cash" (default), "Bank Transfer", "UPI" → user selects one (DOM: .visit-type-btn--cash/bank/upi)
- [ ] **Toggle State** — Stores selected mode (Field: payment_mode in expenses table)

### Bill Attached Toggle (Shows if bill images uploaded)
- [ ] **Two Buttons** — "Yes" (default), "No" → indicates if physical bill exists (DOM: #billAttachedToggle)
- [ ] **Toggle State** — Stores yes/no value (Field: bill_attached in expenses table)

### Receipt Upload
- [ ] **File Input** — Allows image/PDF files (accept="image/*,.pdf") (Field: #receipt)
- [ ] **Multiple Files** — Can upload multiple bills per expense (Table: expense_images)
- [ ] **File Preview** — Shows thumbnail + remove button in preview area (DOM: #imagePreview)
- [ ] **Drag & Drop** — Drag images onto preview zone to add (Event: dragdrop)

### Form Actions
- [ ] **Back to Scan Button** — Returns to OCR section, clears form data (Button: #backToScan)
- [ ] **Save Button** → Creates new expense or updates existing expense (Button: type="submit")

### Save Logic (Create New Expense)
- [ ] **Inserts to expenses table** — expense_data with user_id, category, amount, vendor, date, visit_type, payment_mode, bill_attached (Table: expenses)
- [ ] **Inserts to expense_images table** — One row per bill image with storage_path, storage_filename (Table: expense_images)
- [ ] **Uploads to Supabase Storage** — Bills stored in bucket: expense-bills/user_id/* (Storage: expense-bills)
- [ ] **Shows Success Toast** — "Expense added" notification (Toast notification)
- [ ] **Clears Form** — Resets all fields for next entry (DOM: reset form)

### Save Logic (Edit Expense)
- [ ] **Pre-fills All Fields** — Loads existing expense data into form (Table: expenses)
- [ ] **Updates expenses row** — Updates amount, vendor, category, etc. with new values (Table: expenses)
- [ ] **Handles Image Changes** — Deletes old image rows if removed, adds new rows if added (Table: expense_images)
- [ ] **Shows Success Toast** — "Expense updated" message (Toast notification)

### Validation
- [ ] **Required Fields** — date, mainCategory, amount marked required (HTML: required attribute)
- [ ] **Amount > 0** — Client-side validation that amount is positive (Validation: step="0.01")
- [ ] **Error Messages** — Shows inline validation errors below fields (Validation: error class)
- [ ] **Form Submit Blocked** — If validation fails, submit button disabled (JS: e.preventDefault())

---

## EXPENSE HISTORY (index.html — section-history)

### Stats Bar
- [ ] **Total Expenses Count** — Number of expenses user has (Calculation: COUNT from expenses table)
- [ ] **Total Amount** — Sum of all expense amounts (Calculation: SUM(amount) from expenses table)
- [ ] **This Month Amount** — Sum of expenses in current month (Calculation: SUM where date >= month_start AND date <= month_end)
- [ ] **Display Format** — "Total: 45 | ₹52,340 | This month: ₹12,450" (Formatting: formatted currency)

### Search & Filter Bar
- [ ] **Search by Vendor** — Text input searches vendor field → filters table real-time (Field: #searchInput, Event: input)
- [ ] **Category Filter Dropdown** — Dropdown with all categories → filters by selected category (Field: #categoryFilter, Event: change)
- [ ] **Project Filter Dropdown** — Shows if company mode, filters by project (Field: #projectFilter, Event: change)
- [ ] **Visit Type Filter Dropdown** — Filters by visit_type (project/service/survey) (Field: #visitTypeFilter, Event: change)
- [ ] **Date Range Filters** — "From Date" and "To Date" inputs → filters expenses in range (Fields: #dateFromFilter, #dateToFilter)
- [ ] **Clear Filters Button** — Resets all filters to default (Button: #resetFilters)
- [ ] **Search Results Info** — Shows "X results found" message (DOM: #searchResults)

### Expense List Table
- [ ] **Column Headers** — Date | Vendor | Category | Amount | Status | Actions (Table: #expensesList)
- [ ] **Date Column** — Formatted date (DD MMM YYYY) (Formatting: formatDate)
- [ ] **Vendor Column** — Vendor name or "N/A" (Table: expenses.vendor)
- [ ] **Category Column** — Category with colored badge (Table: expenses.category)
- [ ] **Amount Column** — Amount with ₹ symbol, right-aligned (Formatting: ₹1,234.50)
- [ ] **Status Column** — Voucher status (unsubmitted, submitted, approved, rejected, reimbursed) with badge color (Table: expenses.voucher_status)
- [ ] **Action Buttons** — View, Edit, Delete buttons per row (Buttons: data attributes with expense ID)
- [ ] **Row Click** → Opens expense detail view (Event: click on row)
- [ ] **Select Checkbox** — Checkbox per row for batch actions (Checkbox: .select-all-checkbox)
- [ ] **Select All Checkbox** — Header checkbox to select/deselect all visible expenses (Checkbox: #selectAllCheckbox)

### Pagination
- [ ] **Page Size Selector** — Dropdown: 10, 25, 50, 100 items per page (Dropdown: #pageSize)
- [ ] **Pagination Info** — Shows "Showing 1-25 of 450 expenses" (DOM: #paginationInfo)
- [ ] **Previous/Next Buttons** — Navigate between pages (Buttons: #prevPage, #nextPage)
- [ ] **Previous Disabled** — When on first page (Button state: disabled)
- [ ] **Next Disabled** — When on last page (Button state: disabled)
- [ ] **Page Numbers** — Jump to specific page (if implemented) (Pagination controls)

### View Expense Detail
- [ ] **Opens Detail Panel** — Shows full expense info (Modal/BottomSheet: expense detail)
- [ ] **All Fields Displayed** — Date, category, amount, vendor, description, visit type, payment mode, bill attached, voucher status (DOM: detail panel)
- [ ] **Receipt Image** — Shows thumbnail of attached bill image (Table: expense_images)
- [ ] **Receipt Tap** → Opens full-screen image viewer (Event: click image)
- [ ] **Edit Button** — Opens expense form pre-filled with data (Button: edit, calls editExpense())
- [ ] **Delete Button** → Opens confirmation dialog (Button: delete)

### Delete Expense
- [ ] **Confirmation Modal** — "Are you sure?" with Cancel/Delete buttons (Modal: confirmation)
- [ ] **Delete Action** — Removes expense row from DB → deletes associated image rows → deletes storage files (Tables: expenses, expense_images; Storage: expense-bills)
- [ ] **Success Toast** — "Expense deleted" message (Toast notification)
- [ ] **Refresh List** — Expense disappears from table (DOM: re-render)

### Expense Detail Bottom Sheet (Tap Expense)
- [ ] **Slide-up Panel** — Shows from bottom of screen → details + timeline (Modal: bottom sheet)
- [ ] **Close Button** — Tap X or backdrop to close (Button: close)
- [ ] **Expense Fields** — Date, category, amount, vendor, description, visit type, payment mode, bill attached status (DOM: detail fields)
- [ ] **Receipt Image** — Thumbnail of uploaded bill (Table: expense_images)
- [ ] **Zoom Image** — Tap image to open full-screen viewer with zoom controls (Event: click image, +/- keys for zoom)
- [ ] **Edit Button** → Scrolls to top, opens expense form with pre-filled data (Button: edit)
- [ ] **Delete Button** → Opens confirmation dialog (Button: delete)

### Image Viewer (Full-Screen)
- [ ] **Full-Screen Display** — Image centered on dark background (Modal: #imageViewerModal)
- [ ] **Zoom Controls** — +/- buttons or keyboard +/- to zoom in/out (Controls: zoom buttons, keyboard)
- [ ] **Zoom Limits** — Max 300%, min 100% (Constraint: max/min zoom)
- [ ] **Pan/Drag** — Swipe to pan zoomed image (Gesture: drag)
- [ ] **Close Button** — X button or Escape key closes viewer (Button: close, Event: Escape key)
- [ ] **Share Button** — Share image via system share sheet (Button: share)

### Export to Google Sheets
- [ ] **Button Opens Service** — Initializes Google Sheets service (Button: #exportToGoogleSheets)
- [ ] **Creates New Sheet** — If user has no sheet, creates copy of template (Table: profiles.google_sheet_id)
- [ ] **Exports Expenses** — Adds selected expenses to sheet → tracks exported IDs to avoid duplicates (Table: profiles)
- [ ] **Sheet URL Opens** — Provides link to Google Sheet for viewing (Link: sheets.google.com)
- [ ] **Success Message** — "Exported X expenses" toast (Toast notification)

---

## ADVANCE MANAGEMENT (index.html — section-advance)

### Stats Bar
- [ ] **Allocated** — Sum of all active advances (Table: advances, status='active', SUM(amount))
- [ ] **Settled** — Sum of expenses linked to closed advances (Calculation: SUM expenses where advance_id in closed advances)
- [ ] **Balance** — Allocated - Settled (Calculation: computed)
- [ ] **Display** — Three stat cards with values (DOM: #advanceStatsBar)

### Create Advance Button
- [ ] **Button Opens Modal** — Launches advance creation form (Button: #openAdvanceModal, Event: click)

### Advance Form Modal
- [ ] **Project Name Field** — Text input for project name (Field: project_name, required)
- [ ] **Amount Field** — Decimal number for advance amount (Field: amount, required)
- [ ] **Visit Type Toggle** — "Project" (default), "Service", "Survey" (Field: visit_type)
- [ ] **Manager Dropdown** (Company Mode Only) — Lists org members with role='manager' → user selects approver (Field: manager_id, Table: profiles)
- [ ] **Accountant Dropdown** (Company Mode Only) — Lists org members with role='accountant' → user selects verifier (Field: accountant_id, Table: profiles)
- [ ] **Notes Field** — Optional text notes (Field: notes)
- [ ] **Create Button** → Inserts into advances table with status='active' (Table: advances)
- [ ] **Success** — Shows "Advance created" toast + refreshes advance list (Toast notification, DOM: re-render)
- [ ] **Close Button** — Closes modal without saving (Button: close)

### Create Advance API Call
- [ ] **Inserts to advances** — Creates row with user_id, organization_id, project_name, amount, notes, visit_type, manager_id, accountant_id, status='active' (Table: advances)
- [ ] **Inserts to advance_history** — Logs creation event with status='submitted' (Table: advance_history)
- [ ] **Stores organization_id** — Links advance to org for company mode (Table: advances.organization_id)

### Advance List Cards
- [ ] **Card Layout** — Shows project name, amount, status badge, balance (DOM: advance cards)
- [ ] **Status Badge** — Color-coded: ACTIVE (green), PENDING (orange), CLOSED (gray), REJECTED (red) (Table: advances.status)
- [ ] **Balance Display** — "Allocated: ₹X | Spent: ₹Y | Remaining: ₹Z" (Calculation: computed)
- [ ] **Tap Card** → Opens advance detail bottom sheet (Event: click)
- [ ] **Edit Button** → Opens form pre-filled with advance data (Button: edit, calls editAdvance())
- [ ] **Close Advance Button** → Changes status from ACTIVE to CLOSED (Button: close, Table update)
- [ ] **Delete Button** (PENDING only) → Removes advance + logs deletion (Button: delete, Table: delete)

### Advance Detail Bottom Sheet
- [ ] **Project Name** — Shows advance project name (Table: advances.project_name)
- [ ] **Amount Allocated** — Shows initial advance amount (Table: advances.amount)
- [ ] **Amount Spent** — Sum of linked expense amounts (Calculation: SUM expenses where advance_id = this)
- [ ] **Balance Remaining** — Allocated - Spent (Calculation: computed)
- [ ] **Status** — Shows current status (Table: advances.status)
- [ ] **Manager/Accountant** — Shows assigned manager + accountant names (if company mode) (Table: profiles)
- [ ] **Notes** — Shows advance notes (Table: advances.notes)
- [ ] **Linked Expenses** — List of expenses linked to this advance (Table: expenses.advance_id = this)
- [ ] **Edit Button** → Opens advance form for editing (Button: edit)
- [ ] **Close Button** → Changes status to CLOSED, prevents future expense linking (Button: close)
- [ ] **Reopen Button** → Re-activates closed advance (Button: reopen, Table: status='active')
- [ ] **Delete Button** → Removes advance (if not CLOSED) (Button: delete, Table: delete)

### Status Filter
- [ ] **Filter Dropdown** — Shows All, Active, Pending, Closed, Rejected (Dropdown: #empAdvanceStatusFilter)
- [ ] **Filter Table** → Shows only advances with selected status (Event: change, DOM: re-render)

---

## REPORTS & ANALYTICS (index.html — section-reports)

### Date Range Filter
- [ ] **From Date Input** — Flatpickr calendar → user selects start date (Field: #rptDateFrom)
- [ ] **To Date Input** — Flatpickr calendar → user selects end date (Field: #rptDateTo)
- [ ] **Clear Button** — Resets dates to empty (Button: clear dates)
- [ ] **Auto-Refresh** — Recalculates all reports when dates change (Event: change, Supabase RPC)

### Advance Summary Cards
- [ ] **Active Advances** — Count and total allocated amount of active advances (Table: advances, status='active')
- [ ] **Pending Approval** — Count and total of pending advances (Table: advances, status='pending_manager' or 'pending_accountant')
- [ ] **Closed Advances** — Count and total of closed advances (Table: advances, status='closed')
- [ ] **Display** — Three stat cards in grid (DOM: #rptAdvanceSummary)

### Spend by Category Table
- [ ] **Column Headers** — Category | Amount | Count | Percentage (Table: #rptCategoryChart)
- [ ] **Rows** — One row per category with: category name, sum of amounts, count of expenses, % of total (Calculation: GROUP BY category, SUM/COUNT)
- [ ] **Sorted** — By amount descending (ORDER BY amount DESC)
- [ ] **Total Row** — Shows grand total at bottom (Calculation: SUM all)
- [ ] **Display Format** — Amount as ₹X,XXX; Percentage as X.X% (Formatting: currency, percentage)

### Top Vendors Table
- [ ] **Column Headers** — Vendor | Amount | Count | Last Used (Table: #rptVendorList)
- [ ] **Rows** — One row per unique vendor with: vendor name, sum amounts, count, last date (Calculation: GROUP BY vendor)
- [ ] **Sorted** — By amount descending (ORDER BY amount DESC)
- [ ] **Total Row** — Shows grand total (Calculation: SUM all)
- [ ] **Display Format** — Amount as ₹X,XXX; Date as DD MMM YYYY (Formatting: currency, date)

### Monthly Trend Table/Chart
- [ ] **Column Headers** — Month | Amount | Expenses (Table/Chart: #rptMonthlyChart)
- [ ] **Rows** — One row per month with: month name (Jan 2024), sum of amounts, count of expenses (Calculation: GROUP BY month)
- [ ] **Sorted** — Chronologically ascending (ORDER BY date ASC)
- [ ] **Visual** — Bar chart showing trend line (Chart: canvas/SVG bars)
- [ ] **Display Format** — Amount as ₹X,XXX (Formatting: currency)

### Payment Modes Table
- [ ] **Column Headers** — Mode | Amount | Count | Percentage (Table: #rptPaymentChart)
- [ ] **Rows** — One row per mode (Cash, Bank Transfer, UPI) with: mode, sum amounts, count, percentage (Calculation: GROUP BY payment_mode)
- [ ] **Display Format** — Amount as ₹X,XXX; Percentage as X.X% (Formatting: currency, percentage)

---

## VOUCHER SUBMISSION WIZARD (3-Step Modal — #submitWizardModal)

### Step 1: Select Expenses
- [ ] **Expense List** — Shows all user's unsubmitted expenses (Table: expenses, voucher_status IS NULL)
- [ ] **List Columns** — Checkbox | Date | Vendor | Amount | Category (DOM: .wizard-expense-list)
- [ ] **Expense Checkbox** — Check/uncheck individual expense (Event: change)
- [ ] **Select All Checkbox** — Check all visible expenses at once (Checkbox: #wizardSelectAll)
- [ ] **Summary** — "Selected: X expenses totaling ₹Y" (Calculation: SUM selected amounts)
- [ ] **Next Button** → Proceeds to Step 2 if at least 1 expense selected (Button: #wizardNextBtn)
- [ ] **Next Disabled** → Until at least 1 expense selected (Button state: disabled)
- [ ] **Cancel Button** → Closes wizard, clears selections (Button: closes modal)

### Step 2: Choose Destinations
- [ ] **Destination Checkboxes** — Multiple options shown:
  - [ ] Export to Google Sheets (default checked)
  - [ ] Generate PDF Package (default checked)
  - [ ] Email to Accounts (default unchecked)
  - [ ] Submit for Approval (default checked, company mode only)
- [ ] **Destination Descriptions** — Brief text explaining each option (DOM: .wizard-dest-desc)
- [ ] **Approval Fields** (if "Submit for Approval" checked):
  - [ ] Manager Dropdown — Required if approval checked (Field: #wizardManagerSelect)
  - [ ] Accountant Dropdown — Required if approval checked (Field: #wizardAccountantSelect)
  - [ ] Purpose/Notes Textarea — Optional purpose description (Field: #wizardPurpose)
- [ ] **Summary** — "X destination(s) selected" (Calculation: count selected)
- [ ] **Back Button** → Returns to Step 1 (Button: #wizardBackBtn)
- [ ] **Submit Button** → Validates approval fields if checked, proceeds to Step 3 (Button: #wizardSubmitBtn)
- [ ] **Submit Disabled** → If no destinations or approval fields empty (Button state: disabled)

### Step 3: Processing
- [ ] **Progress List** — Shows each destination with status:
  - [ ] "Exporting to Google Sheets... ⏳"
  - [ ] "Generating PDF Package... ⏳"
  - [ ] "Sending email... ⏳"
  - [ ] "Submitting for Approval... ⏳"
- [ ] **Processing** — Each destination executed sequentially (Event: progress updates)
- [ ] **Status Icons**:
  - ⏳ (Spinner) = In progress
  - ✓ (Green checkmark) = Success
  - ✕ (Red X) = Failed
- [ ] **Step Transitions** — Auto-advances to Step 4 when all complete (Event: automatic)

### Step 4: Done
- [ ] **Success/Failure Icon** — Green checkmark if all succeed, red X if all fail, yellow ! if mixed (DOM: .wizard-done-icon)
- [ ] **Status Message** — "All completed successfully!" or "X succeeded, Y failed" (DOM: .wizard-done-text)
- [ ] **Results List** — Each destination with success/error message (DOM: .wizard-done-results)
- [ ] **Close Button** → Closes wizard, refreshes expense list (Button: #wizardCloseBtn)

### Processing Actions
- [ ] **Google Sheets Export** — Calls googleSheetsService.exportExpenses(selected) → adds rows to sheet (External: Google Apps Script)
- [ ] **PDF Generation** — Calls generateCombinedReimbursementPDF() → creates PDF with expense bills (Function: pdfs.js)
- [ ] **Email** — Shows note "Open Email from PDF Library to send" (Manual: user completes in PDF Library)
- [ ] **Approval Submission** → Creates voucher record + sends notifications (Table: vouchers, voucher_expenses, voucher_history)

### Voucher Creation (Approval Flow)
- [ ] **Creates voucher** — Inserts row to vouchers table with:
  - organization_id (from user profile)
  - submitted_by (user.id)
  - manager_id (from wizard dropdown)
  - accountant_id (from wizard dropdown)
  - expense_ids (linked via voucher_expenses table)
  - status='pending_manager' (initial)
  - total_amount (SUM of selected expense amounts)
  - purpose (from wizard notes)
- [ ] **Links expenses** — For each selected expense, inserts row to voucher_expenses (Table: voucher_expenses)
- [ ] **Updates expenses** — Sets voucher_status='submitted' on each selected expense (Table: expenses)
- [ ] **Creates history** — Inserts row to voucher_history with action='submitted' (Table: voucher_history)
- [ ] **Sends notification** — Creates notification for manager with voucher details (Table: notifications)
- [ ] **Logs activity** — Logs submission event (Table: activity_log)

---

## MY VOUCHERS (index.html — Submitter View)

### Voucher List
- [ ] **List View** — Shows all user's submitted vouchers (Table: vouchers, submitted_by=user.id)
- [ ] **List Columns** — Number | Manager | Accountant | Amount | Status | Date (DOM: voucher cards)
- [ ] **Voucher Number** — Auto-generated sequential number (Table: vouchers.voucher_number)
- [ ] **Manager Name** — Name of assigned manager (Table: profiles via manager_id)
- [ ] **Accountant Name** — Name of assigned accountant (Table: profiles via accountant_id)
- [ ] **Amount** — Total amount of expenses in voucher (Table: vouchers.total_amount)
- [ ] **Status Badge** — Color-coded: pending_manager, manager_approved, pending_accountant, approved, rejected, reimbursed (Table: vouchers.status)
- [ ] **Date** — Submission date (Table: vouchers.created_at)
- [ ] **Tap Voucher** → Opens detail bottom sheet (Event: click)
- [ ] **Empty State** — "No vouchers submitted yet" if empty (DOM: empty state)

### Voucher Detail Bottom Sheet
- [ ] **Header** — "Voucher #NNN" with status badge (DOM: .voucher-detail__header)
- [ ] **Expense List** — Shows all expenses linked to voucher (Table: voucher_expenses.expense_id)
- [ ] **Expense Rows** — Date | Vendor | Category | Amount (Calculation: from expenses table)
- [ ] **Total Amount** — Sum of all expense amounts (Calculation: SUM)
- [ ] **Timeline** — Shows approval history:
  - [ ] "Submitted by [user] on [date]"
  - [ ] "Manager [name] approved on [date]" (if status >= manager_approved)
  - [ ] "Manager [name] rejected on [date] — [reason]" (if rejected)
  - [ ] "Accountant [name] approved on [date]" (if status = approved)
  - [ ] "Reimbursed on [date]" (if status = reimbursed)
- [ ] **Close Button** → Closes detail sheet (Button: close)

### Rejected Voucher Actions
- [ ] **Show Rejection Reason** — If status='rejected', displays reason in timeline (DOM: rejection message)
- [ ] **Resubmit Button** — Appears if rejected → opens form to resubmit with notes (Button: resubmit)
- [ ] **Resubmit Form** — Shows expense list again + notes field → creates new voucher with resubmitted expenses (Modal: resubmit form)
- [ ] **New Voucher Created** — On resubmit, creates new voucher_history record with action='resubmitted' (Table: voucher_history)

---

## SETTINGS (index.html — section-settings)

### Profile Card
- [ ] **User Name** — Fetched from profiles table (Table: profiles.name)
- [ ] **Email** — User's email from profiles (Table: profiles.email)
- [ ] **Employee ID** — User's employee_id if exists (Table: profiles.employee_id)
- [ ] **Edit Button** → Opens profile edit form (Button: edit)

### Edit Profile Form
- [ ] **Name Field** — Text input, pre-filled with current name (Field: #empName, Table: profiles.name)
- [ ] **Employee ID Field** — Text input, optional (Field: #empCode, Table: profiles.employee_id)
- [ ] **Designation Field** — Text input, optional (Field: designation, Table: profiles.designation)
- [ ] **Department Field** — Text input, optional (Field: department, Table: profiles.department)
- [ ] **Save Button** → Updates profiles row (Button: save, Table: update profiles)
- [ ] **Success Toast** — "Profile updated" (Toast notification)

### Bank Details
- [ ] **Bank Details Form** — Fields for:
  - [ ] Account Holder Name (Table: employee_bank_details.account_holder_name)
  - [ ] Account Number (Table: employee_bank_details.account_number)
  - [ ] IFSC Code (Table: employee_bank_details.ifsc_code)
  - [ ] Bank Name (Table: employee_bank_details.bank_name)
  - [ ] UPI ID (Table: employee_bank_details.upi_id)
  - [ ] Preferred Method Dropdown: Cash, Bank Transfer, UPI (Table: employee_bank_details.preferred_method)
- [ ] **Pre-filled** — Loads existing bank details if any (Table: employee_bank_details)
- [ ] **Save Button** → Inserts or updates employee_bank_details row (Table: employee_bank_details)
- [ ] **Success Toast** — "Bank details saved" (Toast notification)

### Activity Log
- [ ] **Activity List** — Shows user's past actions (Table: activity_log, user_id=user.id)
- [ ] **List Columns** — Action | Details | Timestamp (DOM: activity list)
- [ ] **Actions** — expense_created, expense_deleted, advance_created, voucher_submitted, etc. (Table: activity_log.action)
- [ ] **Details** — Human-readable description (Table: activity_log.details)
- [ ] **Timestamp** — Relative time (e.g., "2 hours ago") (Formatting: relativeTime)
- [ ] **Sorted** — By date descending (ORDER BY created_at DESC)
- [ ] **Pagination** — Shows 50 at a time with load more (Pagination: limit 50)

### Saved/Orphaned Images
- [ ] **Grid of Images** — Shows orphaned images from orphaned_images table (Table: orphaned_images, user_id=user.id)
- [ ] **Image Thumbnails** — Shows preview of each image (DOM: image grid)
- [ ] **Tap Image** → Opens full-screen viewer (Event: click)
- [ ] **Delete Button** → Removes orphaned image from DB + storage (Button: delete, Table: delete row, Storage: delete file)
- [ ] **Empty State** — "No saved images" if empty (DOM: empty state)

### Appearance
- [ ] **Dark Mode Toggle** — Switch between light/dark theme (Toggle: localStorage theme preference)
- [ ] **Apply Theme** — Updates CSS variables for dark colors (Event: toggle, DOM: theme class applied)
- [ ] **Persists** — Saves preference to localStorage (LocalStorage: theme='dark')

### Google Sheets Settings
- [ ] **Google Sheets Info** — Shows current sheet URL (if exists) (Table: profiles.google_sheet_url)
- [ ] **View Sheet Button** → Opens sheet in new tab (Button: view, Action: window.open(sheetUrl))
- [ ] **Reset Sheet Button** → Clears sheet data, restores template (Button: reset, External: Google Apps Script)
- [ ] **Create New Sheet Button** → Disconnects current sheet, creates new one (Button: create new, Function: googleSheetsService.createNewSheet())
- [ ] **Success Toast** — "Sheet created/reset" (Toast notification)

### WhatsApp Share Settings
- [ ] **Phone Number Input** — Text field for WhatsApp number (Field: phone)
- [ ] **Enable Notifications Toggle** — On/off for WhatsApp notifications (Toggle: enable_notifications)
- [ ] **Save Button** → Saves settings to DB (Button: save, Table: update profiles)
- [ ] **Test Button** → Sends test message to configured number (Button: test, Function: api.testWhatsApp())
- [ ] **Success Toast** — "Settings saved" or "Test message sent" (Toast notification)

### Check for Updates
- [ ] **Check Button** → Queries app_config table for latest version (Button: check, Supabase: app_config.latest_version)
- [ ] **Version Info** — Shows "Current: X.X.X | Latest: Y.Y.Y" (Display: version comparison)
- [ ] **Update Available** → Shows "Update available! Download APK" (Conditional: if latest > current)
- [ ] **No Update** → Shows "You're up to date" (Conditional: if latest == current)

### Clear Data
- [ ] **Clear Data Button** → Opens options modal (Button: clear, Modal: #clearDataModal)
- [ ] **Options**:
  - [ ] Clear Expenses Only — Deletes expenses, images, activity logs (Table: delete expenses, expense_images, activity_log)
  - [ ] Clear All Data — Deletes everything: expenses, advances, vouchers, orphaned images, bank details, activity logs (Table: delete all user data)
- [ ] **Confirmation Dialog** — "Are you sure? This cannot be undone." (Modal: confirmation)
- [ ] **Delete Action** → Removes all data + storage files (Tables: delete rows, Storage: delete files)
- [ ] **Success Toast** — "Data cleared" (Toast notification)
- [ ] **Redirect** — Returns to dashboard (Navigation: refresh page)

### Logout Button
- [ ] **Logout Button** → Calls logout() function (Button: logout)
- [ ] **Clears Session** — Supabase signOut() called (Function: supabase.auth.signOut())
- [ ] **Clears LocalStorage** — User object + preferences removed (LocalStorage: cleared)
- [ ] **Redirect** → Goes to login.html (Navigation: window.location.href = 'login.html')

---

## NOTIFICATIONS (Bell Icon — Top Right, Company Mode Only)

### Bell Icon & Badge
- [ ] **Bell Icon** — Shows in top bar with notification badge (DOM: #notifBellBtn)
- [ ] **Unread Badge** — Shows count of unread notifications (DOM: #notifBadge, Table: notifications.is_read=false)
- [ ] **Badge Number** — Shows "1-99+" format (Display: capped at 99+)
- [ ] **Tap Bell** → Opens notification dropdown panel (Event: click, Function: notificationCenter.toggle())

### Notification Panel (Dropdown)
- [ ] **Panel Slides Down** — From top right corner (Modal: #notifPanel)
- [ ] **Notification List** — Shows up to 30 unread notifications (Table: notifications, limit 30, is_read=false first)
- [ ] **List Items** — Each shows:
  - [ ] Icon (based on notification type)
  - [ ] Title (e.g., "Voucher Approved")
  - [ ] Message (e.g., "Your voucher #123 was approved")
  - [ ] Relative Time (e.g., "2 hours ago")
  - [ ] Unread Dot (if not read)
- [ ] **Tap Notification** → Marks as read + navigates to related voucher/advance (Event: click, Function: markNotificationRead())
- [ ] **Mark All Read** → Updates all notifications to is_read=true (Button: mark all read, Table: update is_read)
- [ ] **Empty State** — "No notifications yet" if empty (DOM: empty state)
- [ ] **Close Panel** — Click outside or press Escape (Event: click backdrop/Escape)

### Notification Types & Icons
- [ ] **voucher_submitted** — 📩 Purple (Type: color code in notificationCenter.TYPE_CONFIG)
- [ ] **voucher_approved** — ✅ Green (Type: color code)
- [ ] **voucher_rejected** — ❌ Red (Type: color code)
- [ ] **voucher_reimbursed** — 💰 Cyan (Type: color code)
- [ ] **advance_approved** — ✅ Green (Type: color code)
- [ ] **advance_rejected** — ❌ Red (Type: color code)

### Realtime Updates (Supabase Subscription)
- [ ] **Subscribe on Load** — Listens to notifications table for current user (Function: notificationCenter.subscribeRealtime())
- [ ] **New Notification** → Inserted in DB → realtime event fires → unread count increments (Event: postgres_changes INSERT)
- [ ] **Badge Updates** → Count updates instantly (DOM: #notifBadge)
- [ ] **Toast Notification** — Pops up for new notification (Toast: window.toast.show())
- [ ] **Unsubscribe on Logout** — Closes realtime channel (Event: logout)

---

## ADMIN/ACCOUNTANT DASHBOARD (accountant.html)

### Navigation Sidebar
- [ ] **Nav Buttons** — Each section listed (Buttons: .admin-nav-item)
  - [ ] Overview
  - [ ] Pending Approval
  - [ ] All Vouchers
  - [ ] Tally Export
  - [ ] Advances
  - [ ] Payments
  - [ ] Pipeline
  - [ ] Analytics
  - [ ] Settings
- [ ] **Active Button** — Current section highlighted (CSS class: .active)
- [ ] **Click Section** → Switches to that section (Event: click, Function: switchSection())

### Top Bar
- [ ] **Company Name** — Shows organization name (Table: organizations.name)
- [ ] **Greeting** — "Good morning" with dynamic time (DOM: #topbarGreeting)
- [ ] **Current Date** — Displays today's date (DOM: #topbarDate, Formatting: DD MMM YYYY)
- [ ] **Global Search** — Search for vouchers by number/employee (Field: #globalSearch, Event: input)
- [ ] **User Avatar** — Shows initials (DOM: #acctAvatar)
- [ ] **User Name & Email** — Displays logged-in user (DOM: #acctName, #acctEmail)
- [ ] **Switch to Employee Dashboard** — Link to index.html (Button: switch to employee)
- [ ] **Logout Button** → Calls logout() (Button: logout)

---

## ADMIN OVERVIEW (accountant.html — section-overview)

### Stats Cards
- [ ] **Pending Approval Count** — Number of vouchers with status='pending_manager' (Calculation: COUNT, Table: vouchers)
- [ ] **Pending Amount** — Sum of total_amount where status='pending_manager' (Calculation: SUM, Table: vouchers)
- [ ] **Approved Count** — Number where status='approved' (Calculation: COUNT, Table: vouchers)
- [ ] **Approved Amount** — Sum of total_amount where status='approved' (Calculation: SUM, Table: vouchers)
- [ ] **Exported Count** — Number where tally_exported=true (Calculation: COUNT, Table: vouchers)
- [ ] **Reimbursed Count** — Number where status='reimbursed' (Calculation: COUNT, Table: vouchers)
- [ ] **Display** — 5-6 cards in grid with icons + values + labels (DOM: #overviewStats)

### Quick Actions
- [ ] **Review Pending Button** → Scrolls to or switches to Pending Approval section (Button: review pending)
- [ ] **Export to Tally Button** → Switches to Tally Export section (Button: export to tally)
- [ ] **View All Vouchers Button** → Switches to All Vouchers section (Button: view all vouchers)

### Recent Activity
- [ ] **Recent Activity List** — Shows last 10 voucher/advance/payment events (Table: voucher_history + advance_history, ordered by created_at DESC)
- [ ] **Activity Items** — Each shows:
  - [ ] Action (e.g., "Voucher #123 submitted")
  - [ ] Actor Name (who did the action)
  - [ ] Relative Timestamp (e.g., "1 hour ago")
- [ ] **Tap Activity** → Navigates to related voucher/advance (Event: click)

---

## ADMIN PENDING APPROVAL (accountant.html — section-pending)

### Pending Vouchers Section
- [ ] **Pending List** — Shows vouchers waiting for current user's action (Table: vouchers, status='pending_manager' if user is manager, 'pending_accountant' if accountant)
- [ ] **List Columns** — Number | Employee | Amount | Expenses | Status | Date | Actions (DOM: table)
- [ ] **Voucher Number** — Sequential number, unique per org (Table: vouchers.voucher_number)
- [ ] **Employee Name** — Name of who submitted (Table: profiles via submitted_by)
- [ ] **Amount** — Total reimbursement amount (Table: vouchers.total_amount)
- [ ] **Expenses Count** — Number of expenses in voucher (Calculation: COUNT from voucher_expenses)
- [ ] **Status** — Current approval stage (Table: vouchers.status)
- [ ] **Date** — Submission date (Table: vouchers.created_at)
- [ ] **View Button** → Opens voucher detail bottom sheet (Button: view)
- [ ] **Approve Button** → Updates status to next stage (Button: approve, Table: update status)
- [ ] **Reject Button** → Opens rejection modal (Button: reject)
- [ ] **Empty State** — "No pending vouchers" if empty (DOM: empty state)

### Voucher Detail Sheet (Bottom Sheet)
- [ ] **Voucher Header** — "Voucher #NNN | ₹X,XXX | [Status]" (DOM: header)
- [ ] **Employee Info** — Name, ID, email of submitter (Table: profiles)
- [ ] **Period** — "From [date] to [date]" if provided (Table: vouchers)
- [ ] **Purpose/Notes** — Reason for reimbursement (Table: vouchers.purpose)
- [ ] **Expenses Table** — List of linked expenses:
  - [ ] Date | Vendor | Category | Amount
- [ ] **Total Amount** — Sum of all expenses (Calculation: SUM)
- [ ] **Approval Timeline** — Shows all voucher_history events (Table: voucher_history, order by created_at ASC)
  - [ ] "Submitted by [user] on [date]"
  - [ ] "Manager [name] [approved/rejected] on [date]"
  - [ ] "Accountant [name] [approved/rejected] on [date]"
  - [ ] "Marked Paid on [date]"
- [ ] **Close Button** → Closes detail sheet (Button: close)

### Approve Voucher
- [ ] **Approve Button** → Updates status:
  - If status='pending_manager' → 'manager_approved'
  - If status='pending_accountant' → 'approved' (final)
- [ ] **Inserts History** — Creates voucher_history row with action='approved', acted_by=current user (Table: voucher_history)
- [ ] **Sends Notification** — Creates notification for submitted_by user (Table: notifications)
- [ ] **Updates Expense Status** — All linked expenses get voucher_status='approved' (Table: expenses)
- [ ] **Success Toast** — "Voucher approved" (Toast notification)
- [ ] **Refreshes List** — Removes from pending (DOM: re-render)

### Reject Voucher
- [ ] **Reject Button** → Opens rejection reason modal (Button: reject, Modal: reason dialog)
- [ ] **Reason Input** — Text field for rejection reason (Field: reason, Modal: #rejectModal)
- [ ] **Confirm Button** → Updates status to 'rejected', saves reason (Button: confirm, Table: update)
- [ ] **Inserts History** — Creates voucher_history row with action='rejected', rejection_reason (Table: voucher_history)
- [ ] **Sends Notification** — Creates notification for submitter with reason (Table: notifications)
- [ ] **Success Toast** — "Voucher rejected" (Toast notification)
- [ ] **Refreshes List** — Voucher disappears from pending (DOM: re-render)

### Pending Advances Section (Similar Flow)
- [ ] **Pending Advances List** — Shows advances pending approval (Table: advances, status='pending_manager' or 'pending_accountant')
- [ ] **Approve Button** → Changes status to next stage (Button: approve, Table: update)
- [ ] **Reject Button** → Opens reason dialog (Button: reject, Modal: reason dialog)
- [ ] **Rejection Flow** — Same as vouchers (Table: advance_history, notifications)

---

## ADMIN ALL VOUCHERS (accountant.html — section-all-vouchers)

### Status Filter Chips
- [ ] **Filter Options** — All, Pending, Manager Approved, Accountant Approved, Rejected, Reimbursed (Chips: status filters)
- [ ] **Click Chip** → Filters vouchers to selected status (Event: click, DOM: re-render)
- [ ] **Active Chip** → Highlighted when selected (CSS class: .active)

### Search Bar
- [ ] **Search Input** — Searches by voucher number or employee name (Field: search, Event: input)
- [ ] **Real-time Filter** → Filters table as user types (Event: input, DOM: re-render)

### Voucher List Table
- [ ] **Columns** — Number | Employee | Amount | Status | Paid | Date | Actions (DOM: table)
- [ ] **Voucher Number** — Clickable, shows in search results (Table: vouchers.voucher_number)
- [ ] **Employee** — Name of submitter (Table: profiles.name)
- [ ] **Amount** — Total reimbursement amount (Table: vouchers.total_amount)
- [ ] **Status** — Current approval status (Table: vouchers.status)
- [ ] **Paid** — "Yes" if paid, "No" if pending payment (Table: vouchers.marked_paid)
- [ ] **Date** — Creation date (Table: vouchers.created_at)
- [ ] **View Button** → Opens detail sheet (Button: view)
- [ ] **Mark Paid Button** (if status='approved') → Opens payment modal (Button: mark paid, Modal: payment form)

### Mark Paid Modal
- [ ] **Voucher Number Display** — Shows which voucher is being marked paid (DOM: display)
- [ ] **Payment Method Dropdown** — Options: Cash, Bank Transfer, Cheque, Digital Payment (Field: payment_method, Table: vouchers)
- [ ] **Payment Reference Input** — Text field for UTR/receipt number (Field: payment_reference, Table: vouchers)
- [ ] **Confirm Button** → Updates voucher.marked_paid=true, stores payment details (Button: confirm, Table: update)
- [ ] **Inserts History** — Creates voucher_history row with action='paid' (Table: voucher_history)
- [ ] **Success Toast** — "Payment marked" (Toast notification)
- [ ] **Refreshes List** — Updates Paid column (DOM: re-render)

### Pagination
- [ ] **Page Navigation** — Previous/Next buttons + page size selector (Pagination: standard)
- [ ] **Page Size** — 10, 25, 50, 100 items per page (Dropdown: page size)
- [ ] **Info Text** — "Showing X-Y of Z vouchers" (Display: pagination info)

---

## ADMIN PAYMENTS (accountant.html — section-payments)

### Payment Stats
- [ ] **Pending Count** — Vouchers with status='approved' but not marked paid (Calculation: COUNT)
- [ ] **Pending Amount** — Sum of pending voucher amounts (Calculation: SUM)
- [ ] **Completed Count** — Vouchers with marked_paid=true (Calculation: COUNT)
- [ ] **Completed Amount** — Sum of paid voucher amounts (Calculation: SUM)
- [ ] **Failed Count** — Payment transactions with status='failed' (Table: payment_transactions, status='failed')
- [ ] **Display** — Stat cards in grid (DOM: #paymentStats)

### Pending Payments List
- [ ] **Pending Vouchers** — Shows vouchers ready for payment (Table: vouchers, status='approved', marked_paid=false)
- [ ] **List Columns** — Voucher # | Employee | Amount | Actions (DOM: table)
- [ ] **Mark Paid Button** → Opens payment modal (Button: mark paid, Modal: payment form)
- [ ] **Same Modal as All Vouchers** — Payment method + reference (Modal: reused)

### Payment History
- [ ] **Payment Transactions List** — Shows all past payments (Table: payment_transactions, ordered by created_at DESC)
- [ ] **Columns** — Voucher # | Employee | Method | Reference | Amount | Date (DOM: table)
- [ ] **Payment Method** — Cash, Bank Transfer, etc. (Table: payment_transactions.payment_method)
- [ ] **Reference** — UTR/receipt number (Table: payment_transactions.reference)
- [ ] **Pagination** — Shows 50 at a time with load more (Pagination: limit 50)

---

## ADMIN PIPELINE (accountant.html — section-pipeline)

### 4-Column Kanban View
- [ ] **Column 1: Submitted** — Vouchers with status='pending_manager' (Table: vouchers, status=...)
- [ ] **Column 2: Manager Approved** — status='manager_approved' or 'pending_accountant' (Table: vouchers)
- [ ] **Column 3: Accountant Approved** — status='approved' (Table: vouchers)
- [ ] **Column 4: Reimbursed** — status='reimbursed' (Table: vouchers)
- [ ] **Visual Layout** — Four vertical columns side-by-side (CSS: grid/flex layout)

### Voucher Cards (in each column)
- [ ] **Card Shows** — Voucher #, Employee name, Amount, Status badge (DOM: card)
- [ ] **Card Color** — Colored by urgency/age (Optional: CSS styling)
- [ ] **Tap Card** → Opens detail bottom sheet (Event: click)
- [ ] **Drag Card** (if implemented) — Drag to next column to change status (Gesture: drag, Table: update status)

### Real-time Updates
- [ ] **Auto-Refresh** — Realtime subscription updates pipeline when vouchers change (Function: subscribeRealtime, Event: postgres_changes)
- [ ] **Card Appears/Disappears** → When status changes elsewhere (Event: realtime update, DOM: re-render)

---

## ADMIN ANALYTICS (accountant.html — section-analytics)

### Date Range Filter
- [ ] **From Date Input** — Calendar picker (Field: #analyticsDateFrom, Event: change)
- [ ] **To Date Input** — Calendar picker (Field: #analyticsDateTo, Event: change)
- [ ] **Clear Button** — Resets dates (Button: clear)
- [ ] **Auto-Load** — Refreshes all analytics on date change (Event: change, Function: loadAnalytics())

### Spend by Department
- [ ] **Table Columns** — Department | Amount | Count | % (DOM: #analyticsDepartment)
- [ ] **Rows** — One per department (Table: profiles.department)
- [ ] **Calculation** — SUM(voucher amounts) GROUP BY department (Supabase RPC: get_org_spend_by_department)
- [ ] **Sorted** — By amount descending (ORDER BY amount DESC)

### Spend by Project
- [ ] **Table Columns** — Project | Amount | Count | % (DOM: #analyticsProject)
- [ ] **Rows** — One per project (Table: projects)
- [ ] **Calculation** — SUM GROUP BY project (Supabase RPC: get_org_spend_by_project)
- [ ] **Sorted** — By amount descending (ORDER BY amount DESC)

### Spend by Employee
- [ ] **Table Columns** — Employee | Amount | Count | % (DOM: #analyticsEmployee)
- [ ] **Rows** — One per employee (Table: profiles)
- [ ] **Calculation** — SUM GROUP BY submitted_by (Supabase RPC: get_org_spend_by_employee)
- [ ] **Sorted** — By amount descending (ORDER BY amount DESC)

### Monthly Trend
- [ ] **Chart Type** — Bar chart or line chart showing monthly spend (Chart: #analyticsMonthly)
- [ ] **X-Axis** — Months (Jan, Feb, etc.) (Chart: time axis)
- [ ] **Y-Axis** — Amount in rupees (Chart: amount axis)
- [ ] **Data Points** — One bar/line per month (Supabase RPC: get_org_monthly_trend)
- [ ] **Calculation** — SUM by month for last 12 months (Calculation: GROUP BY month)

---

## ADMIN TALLY EXPORT (accountant.html — section-tally-export)

### Quick Export
- [ ] **Quick Export Button** → Pre-selects all approved vouchers (Button: quick export)
- [ ] **Preview Button** → Shows XML preview without selection (Button: preview)
- [ ] **Download Button** → Generates XML → shares/downloads immediately (Button: download)

### Detailed Export Form
- [ ] **Date Range Filters** — From/To dates (Fields: date inputs)
- [ ] **Voucher Selection Checkboxes** — Checkboxes for each approved voucher (Checkboxes: per voucher)
- [ ] **Select All Checkbox** — Check all at once (Checkbox: select all)
- [ ] **Selected Count** — Shows "X vouchers selected" (Display: count)

### Tally Mapping (Ledger Assignments)
- [ ] **Category Mapping Table** — Each expense category → Tally ledger name (Table: tally_ledger_mappings)
- [ ] **Columns** — Category | Ledger Name | Action (DOM: mapping table)
- [ ] **Edit Ledger** → Text input to change ledger name for category (Event: click, Edit mode)
- [ ] **Save Mappings** → Updates tally_ledger_mappings table (Button: save, Table: update)

### Preview XML
- [ ] **Preview Button** → Generates XML format for selected vouchers → shows in modal (Button: preview, Modal: XML viewer)
- [ ] **XML Format** — Tally-compatible structure with vouchers, line items, ledger codes (Format: Tally XML)
- [ ] **Copy to Clipboard** → User can copy XML (Button: copy)
- [ ] **Close Modal** → Returns to export form (Button: close)

### Export/Download
- [ ] **Export Button** → Generates XML file → downloads to device (Button: export, Action: file download)
- [ ] **File Name** — "TallyExport_[OrgID]_[Date].xml" (Filename: generated)
- [ ] **Updates Tally Status** — Sets tally_exported=true, exported_at, exported_by on vouchers (Table: vouchers)
- [ ] **Inserts History** — Logs export event (Table: voucher_history)
- [ ] **Success Toast** — "Exported X vouchers" (Toast notification)

### Export History
- [ ] **History List** — Shows past Tally exports (Table: voucher_history, action='exported_to_tally')
- [ ] **Columns** — Date | Count | Exported By | File (DOM: history list)
- [ ] **Download Old Export** → If file still available (Button: download, if applicable)

---

## ADMIN ADVANCES (accountant.html — section-advances)

### Advance Stats
- [ ] **Total Allocated** — Sum of all active advance amounts (Calculation: SUM where status='active')
- [ ] **Total Spent** — Sum of expenses linked to advances (Calculation: SUM)
- [ ] **Total Balance** — Allocated - Spent (Calculation: computed)
- [ ] **Display** — Three stat cards (DOM: #advanceStats)

### Status Filter
- [ ] **Dropdown** — All, Active, Pending, Closed, Rejected (Dropdown: #advanceStatusFilter)
- [ ] **Filter List** → Shows only advances with selected status (Event: change)

### Advance List
- [ ] **Columns** — Project | Employee | Amount | Spent | Balance | Status | Actions (DOM: table)
- [ ] **Project Name** — Project or purpose name (Table: advances.project_name)
- [ ] **Employee** — User who created advance (Table: profiles.name)
- [ ] **Amount** — Initial advance amount (Table: advances.amount)
- [ ] **Spent** — Sum of linked expense amounts (Calculation: SUM)
- [ ] **Balance** — Amount - Spent (Calculation: computed)
- [ ] **Status** — Current status with badge (Table: advances.status)
- [ ] **View Button** → Opens advance detail sheet (Button: view)
- [ ] **Approve Button** (if pending) → Approves and notifies (Button: approve)
- [ ] **Reject Button** (if pending) → Opens reason modal (Button: reject)

### Advance Detail Sheet
- [ ] **Header** — "Advance #ID | ₹X,XXX | [Status]" (DOM: header)
- [ ] **Project Name** — Advance project name (Table: advances.project_name)
- [ ] **Employee** — Name and email of creator (Table: profiles)
- [ ] **Allocated Amount** — Initial advance amount (Table: advances.amount)
- [ ] **Spent Amount** — Sum of linked expenses (Calculation: SUM)
- [ ] **Remaining Balance** — Allocated - Spent (Calculation: computed)
- [ ] **Manager/Accountant** — Assigned approvers (Table: profiles)
- [ ] **Notes** — Purpose/notes (Table: advances.notes)
- [ ] **Linked Expenses** — Table of expenses assigned to this advance (Table: expenses, advance_id=this)
- [ ] **Timeline** — Approval history (Table: advance_history)

### Advance Approval Actions
- [ ] **Approve Button** → Updates status to next stage (Button: approve, Table: update)
- [ ] **Inserts History** — Creates advance_history row with action='approved' (Table: advance_history)
- [ ] **Sends Notification** → Creates notification for advance creator (Table: notifications)

### Advance Rejection
- [ ] **Reject Button** → Opens reason modal (Button: reject)
- [ ] **Reason Input** — Text field (Field: rejection_reason)
- [ ] **Confirm** → Updates status='rejected', saves reason (Button: confirm, Table: update)
- [ ] **Inserts History** — Creates advance_history row with action='rejected', rejection_reason (Table: advance_history)
- [ ] **Sends Notification** → Notifies creator with reason (Table: notifications)

---

## ADMIN SETTINGS (accountant.html — section-settings)

### Organization Info Card
- [ ] **Organization Name** — Shows org name (Table: organizations.name)
- [ ] **Email Domain** — Shows domain if configured (Table: organizations.domain)
- [ ] **Member Count** — Shows number of active members (Calculation: COUNT from employee_whitelist)

### Employee Management
- [ ] **Import Employees CSV** — Drag & drop or browse for CSV file (Zone: #csvDropZone)
- [ ] **CSV Columns** — employee_id, name, email, department, designation, role (CSV format)
- [ ] **Preview Before Import** — Shows preview of first 10 rows (Modal: preview)
- [ ] **Import Button** → Inserts employees to employee_whitelist (Table: employee_whitelist, Button: import)
- [ ] **Success Toast** — "Imported X employees" (Toast notification)

### Employee List
- [ ] **Table Columns** — Emp ID | Name | Email | Department | Designation | Role | Status | Actions (DOM: table)
- [ ] **Role Dropdown** — Change role: Employee, Manager, Accountant, Admin (Dropdown: role select)
- [ ] **Status Button** — Activate/Deactivate employee (Button: toggle status)
- [ ] **Update Happens** → Updates employee_whitelist row + updates profiles if user already signed up (Table: update both)

### Project Management
- [ ] **Project List** — Shows all org projects (Table: projects, organization_id=org)
- [ ] **Columns** — Project Code | Name | Client | Status | Actions (DOM: table)
- [ ] **Add Project Button** → Opens form to create new project (Button: add, Modal: project form)
- [ ] **Project Form** — Fields: project_code, project_name, client_name, status (Modal: form)
- [ ] **Delete Project Button** → Removes project (Button: delete, Table: delete)
- [ ] **Import Projects CSV** — Similar to employees (Zone: drag/drop)

### Tally Ledger Configuration
- [ ] **Tally Account Name Input** — Field for primary Tally account name (Field: tally_account_name)
- [ ] **Tally Account Code Input** — Field for code (Field: tally_account_code)
- [ ] **Category Ledger Mappings** — Table showing category → Tally ledger mappings (Table: tally_ledger_mappings)
- [ ] **Add Mapping** → Opens form to add new category mapping (Button: add)
- [ ] **Delete Mapping** → Removes category ledger mapping (Button: delete)
- [ ] **Save Settings** → Updates app_config or tally_settings table (Button: save, Table: update)

---

## COMMON FEATURES ACROSS SCREENS

### Image Viewer Modal (#imageViewerModal)
- [ ] **Full-Screen Display** — Image centered on dark background (Modal: #imageViewerModal)
- [ ] **Zoom Controls** — Buttons +/- or keyboard +/- to zoom (Controls: buttons)
- [ ] **Pan/Drag** — Swipe/drag to pan zoomed image (Gesture: drag/swipe)
- [ ] **Zoom Constraints** — Min 100%, Max 300% (Constraint: min/max)
- [ ] **Close Button** — X button or Escape key (Button: close, Key: Escape)
- [ ] **Share Button** — Opens system share sheet for image (Button: share)
- [ ] **Previous/Next** (if image gallery) — Navigate between multiple images (Buttons: prev/next)

### Toast Notifications
- [ ] **Toast Message** — Brief notification at bottom/top of screen (Toast: window.toast)
- [ ] **Success Toast** — Green, 3-second duration (Style: green, Duration: 3000ms)
- [ ] **Error Toast** — Red, stays longer (Style: red, Duration: 5000ms)
- [ ] **Warning Toast** — Yellow/orange (Style: orange, Duration: 4000ms)
- [ ] **Auto-Dismiss** — Disappears after timeout (Behavior: auto-dismiss)

### Modals & Bottom Sheets
- [ ] **Modal Backdrop** — Click to close (Event: click backdrop closes)
- [ ] **Escape Key** — Closes modal (Event: Escape key closes)
- [ ] **Scroll Lock** — Body overflow hidden when modal open (Behavior: scroll locked)
- [ ] **Keyboard Navigation** — Tab through form fields (Behavior: keyboard navigation)

### Form Validations
- [ ] **Required Fields** — Marked with * (Visual: asterisk)
- [ ] **Client-Side Validation** — Before submission (Validation: client-side)
- [ ] **Error Messages** — Shown inline or as toasts (Display: error messages)
- [ ] **Submit Button Disabled** — When validation fails (Button state: disabled)

### Error Handling
- [ ] **Network Error** → Shows "Connection lost. Please try again." (Toast: error message)
- [ ] **Permission Denied** → Shows "You don't have permission to do this" (Toast: error message)
- [ ] **Not Found** → Shows "Item not found" (Toast: error message)
- [ ] **Server Error** → Shows "Server error. Please try again later." (Toast: error message)

### Offline Support
- [ ] **Offline Detection** — App detects when offline (Event: offline)
- [ ] **Offline Queue** — Actions queued while offline (Service: offline-manager.js)
- [ ] **Sync on Online** → Syncs queued actions when connection returns (Event: online, Function: sync)
- [ ] **Offline Indicator** — Shows "Offline" badge in UI (Display: offline indicator)

### Dark Mode
- [ ] **Light Theme** — Default theme with light backgrounds (Theme: light, CSS: --bg-color=#ffffff)
- [ ] **Dark Theme** — Dark backgrounds, light text (Theme: dark, CSS: --bg-color=#1a1a1a)
- [ ] **Toggle Switch** → In settings, switches theme (Toggle: theme toggle)
- [ ] **Persists** — Theme preference saved to localStorage (LocalStorage: theme preference)
- [ ] **CSS Variables** — Theme applied via CSS custom properties (CSS: CSS variables)

### Responsive Design
- [ ] **Desktop** — Full-width layout, sidebar navigation (Layout: desktop)
- [ ] **Tablet** — Adjusted grid/column layout (Layout: tablet)
- [ ] **Mobile** — Single column, bottom tab navigation (Layout: mobile)
- [ ] **Orientation** — Portrait/landscape support (Responsive: orientation)

---

## DATABASE TABLES INVOLVED (Summary)

| Table | Used By | Key Fields |
|-------|---------|-----------|
| **auth.users** | Login/Signup, Logout | email, password_hash |
| **profiles** | All screens | id, name, email, role, organization_id, employee_id, designation, department |
| **expenses** | Employee dashboard | id, user_id, date, category, amount, vendor, description, visit_type, payment_mode, bill_attached, voucher_status, advance_id |
| **expense_images** | Expense form, detail view | id, expense_id, storage_path, storage_filename |
| **advances** | Advance mgmt section | id, user_id, organization_id, project_name, amount, spent (calculated), status, visit_type, manager_id, accountant_id, notes |
| **advance_history** | Advance timeline | id, advance_id, action, acted_by, status, rejection_reason, created_at |
| **vouchers** | Submit wizard, approval, all vouchers | id, organization_id, submitted_by, manager_id, accountant_id, voucher_number, status, total_amount, purpose, marked_paid, tally_exported |
| **voucher_expenses** | Link expenses to vouchers | voucher_id, expense_id |
| **voucher_history** | Approval timeline, payment tracking | id, voucher_id, action, acted_by, approval_comments, rejection_reason, payment_method, payment_reference, created_at |
| **organizations** | Company mode features | id, name, domain, created_by |
| **employee_whitelist** | Employee management | id, organization_id, employee_id, name, email, role, is_active, department, designation |
| **projects** | Project dropdown, analytics | id, organization_id, project_code, project_name, client_name, status |
| **orphaned_images** | Saved images section | id, user_id, storage_path, storage_filename, was_exported |
| **reimbursement_pdfs** | PDF library | id, user_id, storage_path, filename, page_count, total_amount, date_from, date_to, purpose |
| **activity_log** | Activity log section | id, user_id, action, details, metadata, created_at |
| **employee_bank_details** | Settings bank form | id, user_id, account_holder_name, account_number, ifsc_code, bank_name, upi_id, preferred_method |
| **notifications** | Notification center | id, user_id, type, title, message, reference_type, reference_id, is_read, created_at |
| **tally_ledger_mappings** | Tally export | id, organization_id, category, ledger_name, subcategory |
| **app_config** | Check for updates | latest_version |
| **payment_transactions** | Advance payments | id, advance_id, user_id, organization_id, amount, method, status, reference, notes, created_at |

---

## SUPABASE STORAGE BUCKETS

| Bucket | Contents | Path Structure |
|--------|----------|-----------------|
| **expense-bills** | Expense receipt images/PDFs | `user_id/filename` |
| **reimbursement-pdfs** | Generated reimbursement PDFs | `user_id/filename` |

---

## EXTERNAL SERVICES & APIs

| Service | Used For | Key Functions |
|---------|----------|---------------|
| **Google OAuth** | Login with Google | signInWithOAuth provider='google' |
| **Kodo OCR API** | Receipt text extraction | scanBills() → extracts amounts, dates, vendor |
| **Google Apps Script** | Google Sheets integration | createSheet, exportExpenses, resetSheet, etc. |
| **Supabase Auth** | User authentication | signUp, signIn, signOut, passwordReset |
| **Supabase RPC Functions** | Complex queries | get_org_spend_by_department, get_org_monthly_trend, etc. |
| **Realtime Subscriptions** | Real-time updates | notifications, voucher status changes, pipeline updates |
| **WhatsApp API** | Expense summary messaging | sendWhatsAppSummary (if configured) |
| **App Update Check** | Version checking | Queries app_config.latest_version |

---

## KEY FLOWS SUMMARY

### Expense Creation Flow
1. User selects OCR or manual entry
2. Fills expense form (date, category, amount, vendor, etc.)
3. Uploads receipt images
4. Submits form → inserts to expenses + expense_images tables
5. Logs activity
6. Shows success toast, clears form

### Voucher Submission Flow
1. User opens Submit Wizard
2. Step 1: Selects expenses from list (checkboxes)
3. Step 2: Chooses destinations (Google Sheets, PDF, Email, Approval)
4. If Approval: selects Manager + Accountant
5. Step 3: Processing phase
   - Exports to Google Sheets
   - Generates PDF
   - Creates voucher record (tables: vouchers, voucher_expenses, voucher_history)
   - Sends notification to manager
6. Step 4: Done screen shows results

### Approval Workflow
1. Manager receives notification
2. Opens Pending Approval section
3. Views voucher detail
4. Clicks Approve → status='manager_approved' → creates history entry
5. Accountant then reviews
6. Accountant Approves → status='approved' → final approval
7. Admin marks Paid → status='reimbursed'
8. Notifications sent at each stage

### Advance Tracking
1. Employee creates advance (project, amount, manager, accountant)
2. Inserted to advances table, status='active'
3. Employee links expenses to advance (advance_id field)
4. Balance calculated: allocated - spent
5. Admin approves/rejects → status changes, history logged
6. Marked paid when reimbursed

### Export Flow
1. User selects expenses
2. Click Export to Google Sheets
3. Service checks if user has sheet (from profiles.google_sheet_id)
4. If no sheet: calls Google Apps Script to create copy of master template
5. Exports expense rows to sheet
6. Tracks exported IDs to avoid duplicates
7. Updates sheet URL in profiles
8. Provides link to view sheet

---

## Mobile-Specific Features (Flutter APK)

- [ ] **Camera Access** — Requests camera permission for receipt capture
- [ ] **Photo Gallery Access** — Requests photo library permission
- [ ] **File Download** → Downloads reimbursement PDFs
- [ ] **Share Sheet** → System share for PDFs, images, sheets
- [ ] **Biometric Auth** (Optional) — Fingerprint/Face unlock
- [ ] **Offline Sync** → Queues actions offline, syncs on reconnect
- [ ] **Push Notifications** → Gets voucher approval notifications
- [ ] **Deep Linking** → Links to specific vouchers/expenses from notifications
- [ ] **Native Dialogs** → Uses native date picker, file chooser
- [ ] **Haptic Feedback** → Vibration on actions (optional)
- [ ] **Status Bar** → Shows network status, sync status
- [ ] **Gestures** → Swipe, pinch zoom, long press for context menus

---

## TESTING CHECKLIST USAGE

**For each feature listed:**
1. Perform the user action (e.g., click button, fill form, submit)
2. Verify expected result occurs
3. Check that correct database tables are updated
4. Confirm toast/notification appears
5. Verify UI refreshes correctly
6. Test with both company mode (org exists) and personal mode
7. Test error cases (network down, validation failures, permission denied)
8. Test on mobile & desktop viewports

This checklist is EXHAUSTIVE and covers every user-facing feature in both the web app and what should be replicated in the Flutter APK.