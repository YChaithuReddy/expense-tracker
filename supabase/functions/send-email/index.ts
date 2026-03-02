import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { to, subject, body: emailBody, pdfBase64, fileName } = body;

    const ok = (data: any) => new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    const fail = (error: string, status = 400) => new Response(JSON.stringify({ success: false, error }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    // Validate inputs
    if (!to || !Array.isArray(to) || to.length === 0) return fail("At least one recipient required");
    if (!subject) return fail("Subject is required");
    if (!pdfBase64) return fail("PDF attachment is required");
    if (!fileName) return fail("File name is required");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of to) {
      if (!emailRegex.test(email)) return fail(`Invalid email address: ${email}`);
    }

    // Check PDF size (practical limit ~10MB for email)
    const estimatedSizeMB = (pdfBase64.length * 0.75) / (1024 * 1024);
    if (estimatedSizeMB > 10) return fail(`PDF too large (${estimatedSizeMB.toFixed(1)}MB). Maximum is 10MB.`);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) return fail("Email service not configured. RESEND_API_KEY secret is missing.", 500);

    const fromAddress = Deno.env.get("EMAIL_FROM_ADDRESS") || "Expense Tracker <onboarding@resend.dev>";

    // Convert plain text to HTML preserving line breaks
    const htmlBody = emailBody
      ? `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">${emailBody.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</div>`
      : "";

    console.log(`Sending email: to=${to.join(",")}, subject="${subject}", attachment=${fileName} (${estimatedSizeMB.toFixed(1)}MB), from=${user.email}`);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to,
        subject,
        html: htmlBody,
        text: emailBody || "",
        attachments: [{
          filename: fileName,
          content: pdfBase64,
        }],
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend API error:", JSON.stringify(resendData));
      const errMsg = resendData.message || resendData.error?.message || "Failed to send email";
      return fail(`Email service error: ${errMsg}`, resendResponse.status >= 500 ? 502 : 400);
    }

    console.log(`Email sent: id=${resendData.id}`);
    return ok({ emailId: resendData.id, recipients: to });

  } catch (error) {
    console.error("send-email error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message || "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
