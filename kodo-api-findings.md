# Kodo Reimbursement API - Reverse Engineered

## Overview
Kodo uses Angular + Apollo GraphQL client with a Service Worker (ngsw).
The reimbursement submission is a **2-step process** via GraphQL mutations.

## Base URLs
- **GraphQL API**: `https://api.kodo.in/graphql`
- **File Upload (REST)**: `https://api.kodo.in/kodo-pay/bill-soft-copy/outgoing-payment-request-invoice-upload`
- **File Remove (REST)**: `https://api.kodo.in/kodo-pay/bill-soft-copy/outgoing-payment-request-invoice-remove`
- **Web App**: `https://app.kodo.in`

## Authentication
- **Login**: Email + 6-digit passcode → returns JWT tokens
- **Tokens stored in localStorage**:
  - `refreshToken` - JWT (RSA256) containing: `acc` (account ID), `company` (company ID), `verificationStatus`
  - `deviceToken` - device identifier
- **Auth Header**: Likely `Authorization: Bearer <accessToken>` (access token obtained from refresh token exchange)
- **Account ID**: `c27d0cbc-d39a-4928-bebf-e886c2fd81e9`
- **Company ID**: `4d9a0286-2519-466b-ab57-eea3d7609715`

## Step 1: Upload Bill PDF (REST)

```
POST https://api.kodo.in/kodo-pay/bill-soft-copy/outgoing-payment-request-invoice-upload
Content-Type: multipart/form-data

Body:
  invoice: <PDF file>
  outgoingPaymentRequestId: <optional, for updates>

Response: 201 Created
Returns: { attachmentId: "..." } (used in Step 2)
```

## Step 2: Create Outgoing Payment Request (GraphQL)

```graphql
mutation createOutgoingPaymentRequest($input: OutgoingPaymentRequestCreationInput!) {
    createOutgoingPaymentRequest(input: $input) {
        id
        currentlyAssignedTo {
            user {
                id
            }
        }
    }
}
```

### Input: `OutgoingPaymentRequestCreationInput`

```json
{
  "billAmount": 100.00,           // Required - the bill amount
  "payableAmount": 100.00,        // Optional - defaults to billAmount
  "billNumber": "INV-001",        // Optional
  "dueDateIst": "2026-03-15",     // Optional - ISO date string
  "tdsAmount": null,              // Optional - TDS deduction
  "igstAmount": null,             // Optional - IGST tax
  "cgstAmount": null,             // Optional - CGST tax
  "sgstAmount": null,             // Optional - SGST tax
  "beneficiaryId": "...",         // Bank account ID (for non-listed vendors)
  "checkerAccountId": "...",      // Checker's account ID
  "comment": "Reimbursement for travel",  // Maker comment
  "attachmentId": "...",          // Bill file attachment ID (from Step 1)
  "expenseCategoryId": "...",     // Category ID (Travel, Food, etc.)
  "expenseTags": [                // Optional tags
    { "id": "...", "tag": "tag-name" }
  ],
  "companyProjectId": "...",      // Optional project ID
  "companyFormConfigurationId": "...",  // Optional
  "billData": {                   // Nested bill data object
    "billAmount": 100.00,
    "payableAmount": 100.00,
    "tdsAmountPercentage": null,
    "igstAmountPercentage": null,
    "cgstAmountPercentage": null,
    "sgstAmountPercentage": null,
    "softCopyAttachmentId": "..."
  },
  "invoiceDetail": null           // Optional invoice detail object
}
```

## Step 3: Send for Review / Start Checker Flow (GraphQL)

```graphql
mutation startCheckerFlowForOutgoingPaymentRequest($outgoingPaymentRequestId: String!) {
    startCheckerFlowForOutgoingPaymentRequest(outgoingPaymentRequestId: $outgoingPaymentRequestId) {
        savedRequest {
            id
            version
            createdAt
            billData {
                billAmount
                payableAmount
                tdsAmount
                igstAmount
                cgstAmount
                sgstAmount
                billNumber
                dueDateIst
                billSoftCopies {
                    id
                    fileName
                    url
                    mimeType
                    isPrimaryAttachment
                }
            }
            beneficiary {
                id
                fullName
                nickname
                bankAccounts {
                    id
                    accountNumber
                    ifsc
                    accountNameFromValidationService
                }
            }
            makerLatestComment {
                id
                message
                updatedAt
            }
            workflowRoleAssignments {
                stage
                assignee {
                    id
                    user {
                        id
                        displayName
                    }
                    status
                }
            }
            reimbursementInfo {
                category {
                    id
                    name
                }
                tags {
                    id
                }
            }
        }
    }
}
```

## Known Reference Data

### Bank Accounts
- Account: `77770108504735` - FDRL0007777 - Y CHAITHANYA REDDY

### Categories (from form dropdown)
- Project materials, Plumbing materials, Food, Hotel, Marketing, Fuel, Commute
- ATM, Travel, Utilities, Flight Booking, Grocery, Logistics, Auto
- Vendor payment, Printout, Air Travel, Insurance, Office Supplies, IT, Rent, Others

### Checkers (from form dropdown)
- Bob Mathew Pulickan (bob@fluxgentech.com)
- Chetan Kharade (chetan@fluxgentech.com)
- Emanuel A (emanuel@fluxgentech.com)
- Ganesh Shankar (ganesh@fluxgentech.com)
- Manoj Chandy (manoj@fluxgentech.com)
- Sharan K (sharan@fluxgentech.com)
- Shreem Kohli (shreem@fluxgentech.com)

### Workflow Stages Query
```graphql
query outgoingPaymentRequestWorkflowStages {
    outgoingPaymentRequestWorkflowStages {
        id
        label
    }
}
```

## Other Useful Mutations Found

### Initiate Payment for Saved Request
```graphql
mutation initiatePaymentForSavedRequest($input: OutgoingPaymentRequestRefInput!) {
    initiatePaymentForSavedRequest(input: $input) {
        savedRequest {
            id
            version
        }
        paymentAuth {
            id
            otpValidUntil
            maskedMobileNo
        }
    }
}
```

### Bulk Approval
```graphql
mutation validateMultipleOPRsForApprovalAndTriggerOtp($input: [String!]!) {
    validateMultipleOPRsForApprovalAndTriggerOtp(ids: $input) {
        outgoingPaymentRequestBulkApproval {
            id
            version
            paymentRequests {
                id
                version
                status
            }
        }
        paymentAuth {
            id
        }
        errors
    }
}
```

## Recommended Automation Approach

### For Expense Tracker Integration

**Best approach: Playwright browser automation** (not direct API)
- Kodo's auth flow (OTP-based passcode) makes direct API calls complex
- Service Worker intercepts network requests
- Browser automation is more reliable and maintainable

### Flow:
1. User selects expenses in Expense Tracker → downloads PDF
2. User clicks "Submit to Kodo" button
3. App opens Kodo claim form via Playwright/browser
4. Auto-fills: amount, category, comments, uploads PDF
5. **SHOWS PREVIEW** to user for review
6. User clicks "Confirm" → app clicks "Send for Review"

### Alternative: Direct GraphQL API
If auth tokens can be obtained reliably:
1. POST file upload → get attachmentId
2. POST GraphQL `createOutgoingPaymentRequest` mutation → get request ID
3. POST GraphQL `startCheckerFlowForOutgoingPaymentRequest` → submit for review

Requires: Valid Bearer token, correct IDs for category/checker/bank account.
