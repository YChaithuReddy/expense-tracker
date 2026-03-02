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

async function kodoLogin(email: string, passcode: string, deviceToken?: string): Promise<any> {
  const data = await kodoGraphQL(
    `mutation userLogin($emailId: String, $passcode: String, $deviceToken: String, $appName: String) {
      userLogin(login: {emailId: $emailId, passcode: $passcode, deviceToken: $deviceToken, appName: $appName})
    }`,
    { emailId: email, passcode, deviceToken: deviceToken || null, appName: "KODO_APP" }
  );
  return typeof data.userLogin === "string" ? JSON.parse(data.userLogin) : data.userLogin;
}

async function kodoVerifyOtp(email: string, otp: number): Promise<any> {
  const data = await kodoGraphQL(
    `mutation otpValidation($emailId: String, $otp: Int, $appName: String) {
      otpValidation(validOtp: {emailId: $emailId, otp: $otp, appName: $appName})
    }`,
    { emailId: email, otp, appName: "KODO_APP" }
  );
  return typeof data.otpValidation === "string" ? JSON.parse(data.otpValidation) : data.otpValidation;
}

async function ensureToken(supabase: any, userId: string, settings: any): Promise<{ token: string; displayName: string }> {
  const loginResult = await kodoLogin(settings.kodo_email, settings.kodo_passcode, settings.kodo_device_token);
  if (loginResult.needsOtp) {
    throw new Error("OTP_REQUIRED: Your Kodo session has expired. Please re-authenticate in Kodo Settings.");
  }
  if (!loginResult.token) {
    throw new Error("Kodo login did not return an access token.");
  }
  const displayName = loginResult.user?.displayName || loginResult.user?.username || loginResult.user?.fullName || "";
  console.log(`Kodo login success. User: "${displayName}" (${loginResult.user?.email || settings.kodo_email})`);
  await supabase.from("kodo_settings").update({
    kodo_device_token: loginResult.deviceToken || null,
    kodo_refresh_token: loginResult.refreshToken || null,
  }).eq("user_id", userId);
  return { token: loginResult.token, displayName };
}

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

async function fetchReimbursementDetails(accessToken: string): Promise<{
  beneficiaryId: string;
  fullName: string;
  bankAccounts: any[];
  upiVpaList: any[];
} | null> {
  const data = await kodoGraphQL(
    `query reimbursementDetails {
      reimbursementDetails {
        beneficiary {
          id
          fullName
          nickname
          bankAccounts { id accountNumber ifsc branchName isDisabled }
          upiVpaList { id upiHandle registeredName isDisabled }
        }
      }
    }`,
    {},
    accessToken
  );

  const beneficiary = data.reimbursementDetails?.beneficiary;
  if (!beneficiary || !beneficiary.id) return null;

  return {
    beneficiaryId: beneficiary.id,
    fullName: beneficiary.fullName || beneficiary.nickname || "",
    bankAccounts: (beneficiary.bankAccounts || []).filter((a: any) => !a.isDisabled),
    upiVpaList: (beneficiary.upiVpaList || []).filter((v: any) => !v.isDisabled),
  };
}

async function kodoCreateReimbursementClaim(accessToken: string, input: {
  beneficiaryId: string;
  billAmount: number;
  attachmentId: string;
  checkerAccountId: string;
  expenseCategoryId: string;
  comment: string;
  bankAccountId?: string;
  upiVpaId?: string;
}): Promise<string> {
  const categoryId = /^\d+$/.test(String(input.expenseCategoryId))
    ? parseInt(String(input.expenseCategoryId), 10)
    : input.expenseCategoryId;

  const mutationInput: Record<string, unknown> = {
    beneficiaryId: input.beneficiaryId,
    billData: { billAmount: input.billAmount, payableAmount: input.billAmount },
    attachmentId: input.attachmentId,
    checkerAccountId: input.checkerAccountId,
    expenseCategoryId: categoryId,
    comment: input.comment,
    expenseTags: [],
  };

  // Payment method: bank account or UPI (at least one required for reimbursement)
  if (input.bankAccountId) {
    mutationInput.bankAccountIdToUse = input.bankAccountId;
  } else if (input.upiVpaId) {
    mutationInput.upiVpaToUse = { id: input.upiVpaId };
  }

  console.log("createReimbursementOPR input:", JSON.stringify(mutationInput));

  const data = await kodoGraphQL(
    `mutation createReimbursementOPR($input: ReimbursementOprCreationInput!) {
      createReimbursementOPR(input: $input) {
        id
        version
        currentlyAssignedTo { user { id } }
      }
    }`,
    { input: mutationInput },
    accessToken
  );
  return data.createReimbursementOPR.id;
}

async function fetchKodoConfig(accessToken: string, diagnostic = false): Promise<{ categories: any[]; checkers: any[]; rawCheckers?: any[] }> {
  const categories: any[] = [];
  const checkers: any[] = [];
  let rawCheckers: any[] = [];

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
    rawCheckers = avail;
    checkers.push(...avail.map((c: any) => ({
      id: c.id, name: c.user?.displayName || "", email: c.user?.emailId || "",
      userId: c.user?.id,
    })).filter((c: any) => c.id && c.name));
  } catch (e) { console.error("Checkers:", (e as Error).message); }

  if (diagnostic) {
    return { categories, checkers, rawCheckers };
  }
  return { categories, checkers };
}

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

    if (action === "login") {
      const { email, passcode } = body;
      if (!email || !passcode) return fail("Email and passcode required");
      const loginResult = await kodoLogin(email, passcode);
      if (loginResult.needsOtp) {
        await supabase.from("kodo_settings").upsert({
          user_id: user.id, kodo_email: email, kodo_passcode: passcode,
        }, { onConflict: "user_id" });
        return ok({ needsOtp: true, email: loginResult.email || email });
      }
      await supabase.from("kodo_settings").upsert({
        user_id: user.id, kodo_email: email, kodo_passcode: passcode,
        kodo_device_token: loginResult.deviceToken, kodo_refresh_token: loginResult.refreshToken,
      }, { onConflict: "user_id" });
      return ok({ user: loginResult.user, authenticated: true });
    }

    if (action === "verify-otp") {
      const { email, otp } = body;
      if (!email || !otp) return fail("Email and OTP required");
      const otpResult = await kodoVerifyOtp(email, parseInt(otp, 10));
      if (!otpResult.token) return fail("OTP verification failed: no token returned");
      await supabase.from("kodo_settings").update({
        kodo_device_token: otpResult.deviceToken || null,
        kodo_refresh_token: otpResult.refreshToken || null,
      }).eq("user_id", user.id);
      return ok({ user: otpResult.user, authenticated: true, hasDeviceToken: !!otpResult.deviceToken });
    }

    if (action === "get-config") {
      const { data: settings } = await supabase.from("kodo_settings").select("*").eq("user_id", user.id).single();
      if (!settings) return fail("Kodo not configured. Set up your credentials first.");
      const { token } = await ensureToken(supabase, user.id, settings);
      const diagnostic = body.diagnostic === true;
      const config = await fetchKodoConfig(token, diagnostic);
      const reimbursement = await fetchReimbursementDetails(token);
      return ok({
        ...config,
        beneficiary: reimbursement ? {
          id: reimbursement.beneficiaryId,
          name: reimbursement.fullName,
          bankAccounts: reimbursement.bankAccounts,
          upiVpaList: reimbursement.upiVpaList,
        } : null,
      });
    }

    if (action === "get-beneficiary") {
      const { data: settings } = await supabase.from("kodo_settings").select("*").eq("user_id", user.id).single();
      if (!settings) return fail("Kodo not configured");
      const { token } = await ensureToken(supabase, user.id, settings);
      const reimbursement = await fetchReimbursementDetails(token);
      return ok({
        beneficiary: reimbursement ? {
          id: reimbursement.beneficiaryId,
          name: reimbursement.fullName,
          bankAccounts: reimbursement.bankAccounts,
          upiVpaList: reimbursement.upiVpaList,
        } : null,
        errors: reimbursement ? [] : ["No reimbursement beneficiary found. Ensure your Kodo account has reimbursement access."],
      });
    }

    if (action === "submit") {
      const { pdfBase64, expenseDetails } = body;
      if (!pdfBase64 || !expenseDetails) return fail("PDF and expense details required");
      const { data: settings } = await supabase.from("kodo_settings").select("*").eq("user_id", user.id).single();
      if (!settings) return fail("Kodo not configured");
      const { token } = await ensureToken(supabase, user.id, settings);

      // Fetch reimbursement details (self-beneficiary + bank/UPI accounts)
      const reimbursement = await fetchReimbursementDetails(token);
      if (!reimbursement) {
        return fail("No reimbursement beneficiary found. Ensure your Kodo account has reimbursement access enabled.");
      }
      console.log(`Reimbursement beneficiary: ${reimbursement.beneficiaryId} (${reimbursement.fullName}), banks: ${reimbursement.bankAccounts.length}, UPI: ${reimbursement.upiVpaList.length}`);

      // Determine payment method (bank account preferred, then UPI)
      const bankAccountId = reimbursement.bankAccounts[0]?.id;
      const upiVpaId = reimbursement.upiVpaList[0]?.id;
      if (!bankAccountId && !upiVpaId) {
        return fail("No active bank account or UPI found on your Kodo reimbursement profile. Add a bank account or UPI in Kodo first.");
      }

      // Step 1: Upload PDF
      let attachmentId: string;
      try {
        const pdfBytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
        console.log(`Uploading PDF: ${pdfBytes.length} bytes`);
        attachmentId = await kodoUploadPDF(
          pdfBytes, `reimbursement_${new Date().toISOString().split("T")[0]}.pdf`, token
        );
        console.log(`Upload success, attachmentId: ${attachmentId}`);
      } catch (e) {
        throw new Error(`[UPLOAD] ${(e as Error).message}`);
      }

      // Step 2: Create reimbursement claim (auto-routes to checker)
      let claimId: string;
      try {
        const { totalAmount, checkerId, categoryId, comment } = expenseDetails;
        console.log(`Creating reimbursement claim: amount=${totalAmount}, checker=${checkerId}, category=${categoryId}, beneficiary=${reimbursement.beneficiaryId} (${reimbursement.fullName}), payment=${bankAccountId ? "bank:" + bankAccountId : "upi:" + upiVpaId}`);
        claimId = await kodoCreateReimbursementClaim(token, {
          beneficiaryId: reimbursement.beneficiaryId,
          billAmount: totalAmount,
          attachmentId,
          checkerAccountId: checkerId,
          expenseCategoryId: categoryId,
          comment: comment || "Reimbursement claim from Expense Tracker",
          bankAccountId,
          upiVpaId: bankAccountId ? undefined : upiVpaId,
        });
        console.log(`Reimbursement claim created: ${claimId}`);
      } catch (e) {
        throw new Error(`[CREATE_CLAIM] ${(e as Error).message}`);
      }

      return ok({
        claimId,
        message: "Reimbursement claim submitted successfully",
      });
    }

    return fail(`Unknown action: ${action}`);
  } catch (error) {
    const msg = error.message || "Internal server error";
    if (msg.startsWith("OTP_REQUIRED:")) {
      return new Response(JSON.stringify({ success: false, error: msg, needsReauth: true }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
