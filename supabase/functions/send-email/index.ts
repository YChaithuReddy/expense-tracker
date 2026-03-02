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
    const { to, subject, body: emailBody, pdfBase64, fileName, replyTo, senderName } = body;

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

    // Check PDF size (Brevo limit: 4MB per attachment, 20MB total)
    const estimatedSizeMB = (pdfBase64.length * 0.75) / (1024 * 1024);
    if (estimatedSizeMB > 4) return fail(`PDF too large (${estimatedSizeMB.toFixed(1)}MB). Brevo limit is 4MB per attachment.`);

    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) return fail("Email service not configured. BREVO_API_KEY secret is missing.", 500);

    const senderEmail = Deno.env.get("EMAIL_FROM_ADDRESS") || user.email || "noreply@example.com";
    const senderDisplayName = senderName ? `${senderName} via Expense Tracker` : "Expense Tracker";

    // Convert plain text to HTML preserving line breaks
    const htmlBody = emailBody
      ? `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">${emailBody.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</div>`
      : "";

    console.log(`Sending email via Brevo: to=${to.join(",")}, subject="${subject}", attachment=${fileName} (${estimatedSizeMB.toFixed(1)}MB), from=${senderEmail}`);

    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify({
        sender: { name: senderDisplayName, email: senderEmail },
        to: to.map((email: string) => ({ email })),
        subject,
        htmlContent: htmlBody,
        textContent: emailBody || "",
        ...(replyTo ? { replyTo: { email: replyTo } } : {}),
        attachment: [{
          content: pdfBase64,
          name: fileName,
        }],
      }),
    });

    const brevoData = await brevoResponse.json();

    if (!brevoResponse.ok) {
      console.error("Brevo API error:", JSON.stringify(brevoData));
      const errMsg = brevoData.message || "Failed to send email";
      return fail(`Email service error: ${errMsg}`, brevoResponse.status >= 500 ? 502 : 400);
    }

    console.log(`Email sent via Brevo: messageId=${brevoData.messageId}`);
    return ok({ emailId: brevoData.messageId, recipients: to });

  } catch (error) {
    console.error("send-email error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message || "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
