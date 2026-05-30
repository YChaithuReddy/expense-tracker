# Tally Integration — Meeting Brief
**Date:** 7 April 2026  
**Prepared by:** Development Team  
**Project:** FluxGen Expense Tracker

---

## 1. What We've Already Built (Phase 1 — Ready to Use)

### Tally XML Export (Accountant Page)
The accountant dashboard has a fully functional **Tally Export** section:

| Feature | Description |
|---------|-------------|
| **Voucher Selection** | Accountant sees all approved vouchers ready for export with checkboxes |
| **Batch XML Generation** | Generates Tally-compatible XML with multiple vouchers in one file |
| **XML Preview** | Full-screen preview with syntax highlighting before download |
| **Download XML** | Saves `.xml` file — ready to import into Tally Prime |
| **Export Tracking** | Marks vouchers as "Exported to Tally" to prevent duplicates |
| **Export History** | Shows which vouchers have already been exported |
| **Ledger Mapping** | Maps expense categories (Transportation, Meals, Fuel, etc.) to Tally ledger names |
| **Tally Settings** | Configurable company name and payment ledger (Cash/Bank) |

### How It Works Today
```
Employee submits expense → Manager approves → Accountant approves
    → Accountant goes to "Tally Export" tab
    → Selects approved vouchers
    → Clicks "Download XML"
    → Opens Tally Prime → Import → Select XML file → Done
```

### XML Format Generated
```xml
<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Import</TALLYREQUEST>
        <TYPE>Data</TYPE>
        <ID>Vouchers</ID>
    </HEADER>
    <BODY>
        <DESC>
            <STATICVARIABLES>
                <SVCURRENTCOMPANY>FluxGen Technologies Pvt Ltd</SVCURRENTCOMPANY>
            </STATICVARIABLES>
        </DESC>
        <DATA>
            <TALLYMESSAGE>
                <VOUCHER>
                    <DATE>20260406</DATE>
                    <NARRATION>VCH-2026-001 | Chaithanya | Site visit expenses</NARRATION>
                    <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
                    <VOUCHERNUMBER>VCH-2026-001</VOUCHERNUMBER>
                    <ALLLEDGERENTRIES.LIST>
                        <LEDGERNAME>Travelling Expenses</LEDGERNAME>
                        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                        <AMOUNT>-1500.00</AMOUNT>
                    </ALLLEDGERENTRIES.LIST>
                    <ALLLEDGERENTRIES.LIST>
                        <LEDGERNAME>Cash</LEDGERNAME>
                        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                        <AMOUNT>1500.00</AMOUNT>
                    </ALLLEDGERENTRIES.LIST>
                </VOUCHER>
            </TALLYMESSAGE>
        </DATA>
    </BODY>
</ENVELOPE>
```

---

## 2. What We Plan to Build (Phase 2 — Live Integration)

### Tally Bridge — Local Node.js Server
A small server that runs on the **accountant's laptop** (same machine as Tally) and enables live push/pull.

| Feature | Description |
|---------|-------------|
| **Push to Tally** | One-click export — vouchers are pushed directly into Tally, no manual XML import |
| **Import Ledgers** | Pull chart of accounts (ledger names, groups) from Tally into the web app |
| **Two-Way Sync** | Match expenses in both systems, detect what's already imported |
| **Connection Status** | Web app shows if Tally bridge is running and Tally is reachable |

### Architecture
```
┌─────────────────────────┐          ┌──────────────────────┐
│   Web App (Vercel)      │          │  Accountant's Laptop │
│                         │  HTTP    │                      │
│   Accountant clicks     │ ──────▶  │  Tally Bridge        │
│   "Push to Tally"       │          │  (localhost:3456)    │
│                         │ ◀──────  │       │              │
│   Shows success/fail    │  Result  │       ▼              │
│                         │          │  Tally Prime         │
└─────────────────────────┘          │  (localhost:9000)    │
                                     └──────────────────────┘
```

### How It Will Work
1. Accountant installs Node.js (one-time)
2. Runs `npm start` in the bridge folder (or we make a desktop shortcut)
3. Web app detects bridge is running (shows green indicator)
4. Accountant clicks "Push to Tally" — vouchers go directly into Tally
5. Accountant can also pull ledger names from Tally for mapping

---

## 3. Information Needed from Tally Team

### Required Before Phase 2 Development

| # | Question | Why We Need It |
|---|----------|----------------|
| 1 | **Tally version** — Tally Prime or Tally ERP 9? | API format differs slightly between versions |
| 2 | **ODBC/HTTP Server enabled?** | Tally must have this turned ON (F12 → Advanced → ODBC Server = Yes) |
| 3 | **Tally port** | Default is 9000, but may be changed. What port is Tally listening on? |
| 4 | **Company name in Tally** | Exact name as it appears in Tally (e.g., "FluxGen Technologies Pvt Ltd") |
| 5 | **Chart of Accounts / Ledger List** | List of ledger names used in Tally for expenses. We need to map our categories to their ledgers |
| 6 | **Payment ledger name** | What's the payment source? "Cash", "Bank Account", "Petty Cash"? Multiple? |
| 7 | **Voucher Type** | Are they using "Payment" voucher type, or a custom one like "Expense Reimbursement"? |
| 8 | **Cost Centers** | Do they use cost centers in Tally? If yes, should we map projects to cost centers? |
| 9 | **Multi-currency?** | All transactions in INR, or do they handle foreign currency? |
| 10 | **Who does the import?** | Only the accountant, or multiple people? (affects bridge setup) |

### Required for Ledger Mapping

We need the **exact ledger names** from Tally for these expense categories:

| Our Category | Tally Ledger Name (fill in) |
|-------------|----------------------------|
| Transportation - Auto | ? |
| Transportation - Cab (Uber/Rapido) | ? |
| Transportation - Metro | ? |
| Transportation - Toll | ? |
| Fuel - Petrol | ? |
| Fuel - Diesel | ? |
| Meals - Food | ? |
| Accommodation - Room/Hotel | ? |
| Parking | ? |
| Miscellaneous - Xerox | ? |
| Miscellaneous - Fine | ? |
| Local Conveyance - Auto | ? |

### Nice to Know

| # | Question | Purpose |
|---|----------|---------|
| 11 | **Tally data path** | Where Tally stores data (for backup verification) |
| 12 | **GST enabled?** | Do expense vouchers need GST entries? |
| 13 | **Approval in Tally?** | Does Tally have its own approval workflow, or do they rely on our app? |
| 14 | **Employee as Party?** | Should each employee be a "Party" ledger in Tally for reimbursement tracking? |
| 15 | **Budget tracking?** | Do they track departmental budgets in Tally? Should advances sync? |

---

## 4. What We Need from the Accountant

| Item | Details |
|------|---------|
| **Laptop access** | 30 minutes to install Node.js and test the bridge |
| **Tally running** | Tally must be open with the company selected |
| **Ledger list export** | Screenshot or export of their chart of accounts from Tally |
| **Test voucher** | Permission to push one test voucher into Tally to verify format |
| **Network info** | Is Tally on a local machine or a shared server? Firewall rules? |

---

## 5. Timeline Estimate

| Phase | What | Duration |
|-------|------|----------|
| **Phase 1** | XML Export (already done) | **Completed** |
| **Phase 2a** | Build Tally Bridge server | 2-3 days |
| **Phase 2b** | Import ledgers from Tally | 1 day |
| **Phase 2c** | One-click push to Tally | 1 day |
| **Phase 2d** | Two-way sync + status tracking | 2-3 days |
| **Testing** | End-to-end with real Tally data | 1-2 days |
| **Total Phase 2** | | **~1-2 weeks** |

---

## 6. Demo Flow for Meeting

You can show this live in the meeting:

1. **Login** as accountant → accountant.html
2. Go to **Tally Export** in sidebar
3. Show approved vouchers listed with checkboxes
4. Select a voucher → click **Preview XML**
5. Show the formatted XML with ledger entries
6. Click **Download XML** → show the `.xml` file
7. Open Tally Prime → Gateway → Import Data → select the XML file
8. Show the voucher created in Tally

This demonstrates Phase 1 is working. Phase 2 would replace steps 6-8 with a single "Push to Tally" button.

---

## 7. Key Technical Points

- **Tally API** is XML-based HTTP on localhost:9000 (not REST/JSON)
- **No cloud API** — Tally doesn't expose a cloud endpoint, so we need a local bridge
- **Bridge is lightweight** — ~100 lines of Node.js, runs silently in background
- **Security** — Bridge only talks to localhost (Tally) and Supabase (our DB). No external exposure
- **Fallback** — If bridge is down, XML download still works (Phase 1)
