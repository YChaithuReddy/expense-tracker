import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const KODO_GRAPHQL_URL = "https://api.kodo.in/graphql";
const KODO_UPLOAD_URL = "https://api.kodo.in/kodo-pay/bill-soft-copy/outgoing-payment-request-invoice-upload";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function kodoGraphQL(query: string, variables: Record<string, unknown>, token?: string): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(KODO_GRAPHQL_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { throw new Error(`Kodo non-JSON (${res.status}): ${text.substring(0, 200)}`); }
  if (json.errors?.length > 0) {
    const err = json.errors[0];
    const code = err.extensions?.messageCode || "";
    const errMsg = err.message || code || JSON.stringify(err);
    throw new Error(`Kodo: ${errMsg}${code && !errMsg.includes(code) ? ` (${code})` : ""}`);
  }
  return json.data;
}

// Login - exact format from app.kodo.in Angular bundle
// appName enum: KODO_APP | KODO_MANAGEMENT_PORTAL | KODO_KONSOLE
async function kodoLogin(email: string, passcode: string, deviceToken?: string): Promise<any> {
  const data = await kodoGraphQL(
    `mutation userLogin($emailId: String, $passcode: String, $deviceToken: String, $appName: String) {
      userLogin(login: {emailId: $emailId, passcode: $passcode, deviceToken: $deviceToken, appName: $appName})
    }`,
    { emailId: email, passcode, deviceToken: deviceToken || null, appName: "KODO_APP" }
  );
  return typeof data.userLogin === "string" ? JSON.parse(data.userLogin) : data.userLogin;
}

// Upload PDF - REST endpoint with exact form fields from Kodo bundle
// Response: { billSoftCopyDetails: [{ id, fileName, url, mimeType }] }
async function kodoUploadPDF(pdfBytes: Uint8Array, filename: string, accessToken: string): Promise<string> {
  const formData = new FormData();
  formData.append("invoice", new Blob([pdfBytes], { type: "application/pdf" }), filename);
  formData.append("attachBillSoftCopyWithOpr", "true");
  const res = await fetch(KODO_UPLOAD_URL, {
    method: "POST",
    headers: { "Authorization": `Bearer ${accessToken}` },
    body: formData,
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Upload failed (${res.status}): ${t}`); }
  const json = await res.json();
  const id = json.billSoftCopyDetails?.[0]?.id || json.attachmentId || json.id;
  if (!id) throw new Error("No attachment ID in upload response");
  return id;
}

// Create claim - exact mutation from Kodo bundle
async function kodoCreateClaim(accessToken: string, input: {
  billAmount: number; attachmentId: string; checkerAccountId: string;
  expenseCategoryId: string; comment: string;
}): Promise<string> {
  const data = await kodoGraphQL(
    `mutation createOutgoingPaymentRequest($input: OutgoingPaymentRequestCreationInput!) {
      createOutgoingPaymentRequest(input: $input) { id currentlyAssignedTo { user { id } } }
    }`,
    { input: {
      billData: { billAmount: input.billAmount, payableAmount: input.billAmount },
      attachmentId: input.attachmentId,
      checkerAccountId: input.checkerAccountId,
      expenseCategoryId: input.expenseCategoryId,
      comment: input.comment,
    }},
    accessToken
  );
  return data.createOutgoingPaymentRequest.id;
}

// Submit for review - exact mutation from Kodo bundle
async function kodoSubmitForReview(accessToken: string, requestId: string): Promise<any> {
  const data = await kodoGraphQL(
    `mutation startCheckerFlowForOutgoingPaymentRequest($outgoingPaymentRequestId: String!) {
      startCheckerFlowForOutgoingPaymentRequest(outgoingPaymentRequestId: $outgoingPaymentRequestId) {
        savedRequest { id version }
      }
    }`,
    { outgoingPaymentRequestId: requestId },
    accessToken
  );
  return data.startCheckerFlowForOutgoingPaymentRequest;
}

// Fetch categories + checkers - exact queries from Kodo bundle
async function fetchKodoConfig(accessToken: string): Promise<{ categories: any[]; checkers: any[] }> {
  const categories: any[] = [];
  const checkers: any[] = [];

  // Categories: getExpenseCategoriesMaster (exact query name from Kodo)
  try {
    const data = await kodoGraphQL(
      `query getExpenseCategoriesMaster($includeArchivedResults: Boolean) {
        getExpenseCategoriesMaster(includeArchivedResults: $includeArchivedResults) { id name isArchived }
      }`,
      { includeArchivedResults: false },
      accessToken
    );
    categories.push(...(data.getExpenseCategoriesMaster || []).filter((c: any) => !c.isArchived));
  } catch (e) { console.error("Categories:", (e as Error).message); }

  // Checkers: initiateOutgoingPaymentRequest returns availableCheckers (exact from Kodo)
  try {
    const data = await kodoGraphQL(
      `mutation initiateOutgoingPaymentRequest($isBulkRequest: Boolean) {
        initiateOutgoingPaymentRequest(isBulkRequest: $isBulkRequest) {
          availableCheckers { id status user { id displayName emailId } }
        }
      }`,
      { isBulkRequest: false },
      accessToken
    );
    const avail = data.initiateOutgoingPaymentRequest?.availableCheckers || [];
    checkers.push(...avail.map((c: any) => ({
      id: c.id, name: c.user?.displayName || "", email: c.user?.emailId || "",
    })).filter((c: any) => c.id && c.name));
  } catch (e) { console.error("Checkers:", (e as Error).message); }

  return { categories, checkers };
}

// --- Main handler ---
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ success: false, error: "Missing authorization" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const body = await req.json();
    const { action } = body;
    const ok = (data: any) => new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    const fail = (error: string, status = 400) => new Response(JSON.stringify({ success: false, error }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    // --- LOGIN ---
    if (action === "login") {
      const { email, passcode } = body;
      if (!email || !passcode) return fail("Email and passcode required");
      const loginResult = await kodoLogin(email, passcode);
      await supabase.from("kodo_settings").upsert({
        user_id: user.id, kodo_email: email, kodo_passcode: passcode,
        kodo_device_token: loginResult.deviceToken, kodo_refresh_token: loginResult.refreshToken,
      }, { onConflict: "user_id" });
      return ok({ user: loginResult.user });
    }

    // --- GET CONFIG ---
    if (action === "get-config") {
      const { data: settings } = await supabase.from("kodo_settings").select("*").eq("user_id", user.id).single();
      if (!settings) return fail("Kodo not configured. Set up your credentials first.");
      const loginResult = await kodoLogin(settings.kodo_email, settings.kodo_passcode, settings.kodo_device_token);
      await supabase.from("kodo_settings").update({
        kodo_device_token: loginResult.deviceToken, kodo_refresh_token: loginResult.refreshToken,
      }).eq("user_id", user.id);
      return ok(await fetchKodoConfig(loginResult.token));
    }

    // --- SUBMIT ---
    if (action === "submit") {
      const { pdfBase64, expenseDetails } = body;
      if (!pdfBase64 || !expenseDetails) return fail("PDF and expense details required");
      const { data: settings } = await supabase.from("kodo_settings").select("*").eq("user_id", user.id).single();
      if (!settings) return fail("Kodo not configured");

      // Step 1: Login to Kodo
      const loginResult = await kodoLogin(settings.kodo_email, settings.kodo_passcode, settings.kodo_device_token);
      const token = loginResult.token;
      await supabase.from("kodo_settings").update({
        kodo_device_token: loginResult.deviceToken, kodo_refresh_token: loginResult.refreshToken,
      }).eq("user_id", user.id);

      // Step 2: Upload PDF
      const pdfBytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
      const attachmentId = await kodoUploadPDF(
        pdfBytes, `reimbursement_${new Date().toISOString().split("T")[0]}.pdf`, token
      );

      // Step 3: Create claim
      const { totalAmount, checkerId, categoryId, comment } = expenseDetails;
      const claimId = await kodoCreateClaim(token, {
        billAmount: totalAmount, attachmentId, checkerAccountId: checkerId,
        expenseCategoryId: categoryId, comment: comment || "Reimbursement claim from Expense Tracker",
      });

      // Step 4: Submit for review
      const submitResult = await kodoSubmitForReview(token, claimId);
      return ok({ claimId, message: "Claim submitted successfully", submitResult });
    }

    return fail(`Unknown action: ${action}`);
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message || "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
