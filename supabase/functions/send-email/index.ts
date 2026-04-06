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

    if (!to || !Array.isArray(to) || to.length === 0) return fail("At least one recipient required");
    if (!subject) return fail("Subject is required");
    if (!pdfBase64) return fail("PDF attachment is required");
    if (!fileName) return fail("File name is required");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of to) {
      if (!emailRegex.test(email)) return fail(`Invalid email address: ${email}`);
    }

    const estimatedSizeMB = (pdfBase64.length * 0.75) / (1024 * 1024);
    if (estimatedSizeMB > 10) return fail(`PDF too large (${estimatedSizeMB.toFixed(1)}MB). Limit is 10MB.`);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    const senderEmail = Deno.env.get("EMAIL_FROM_ADDRESS") || "noreply@fluxgentech.com";
    const senderDisplayName = senderName ? `${senderName} via FluxGen Expenses` : "FluxGen Expenses";

    const htmlBody = emailBody
      ? `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.6;color:#374151;">${emailBody.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</div>`
      : "";

    console.log(`Sending email: to=${to.join(",")}, subject="${subject}", attachment=${fileName} (${estimatedSizeMB.toFixed(1)}MB)`);

    let result: { success: boolean; messageId?: string; error?: string };

    if (resendApiKey) {
      // Resend API
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${senderDisplayName} <${senderEmail}>`,
          to,
          subject,
          html: htmlBody,
          text: emailBody || "",
          ...(replyTo ? { reply_to: replyTo } : {}),
          attachments: [{
            content: pdfBase64,
            filename: fileName,
          }],
        }),
      });
      const data = await res.json();
      result = res.ok
        ? { success: true, messageId: data.id }
        : { success: false, error: data.message || "Resend failed" };
    } else if (brevoApiKey) {
      // Brevo API (fallback)
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
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
          attachment: [{ content: pdfBase64, name: fileName }],
        }),
      });
      const data = await res.json();
      result = res.ok
        ? { success: true, messageId: data.messageId }
        : { success: false, error: data.message || "Brevo failed" };
    } else {
      return fail("No email service configured (set RESEND_API_KEY or BREVO_API_KEY)", 500);
    }

    if (!result.success) {
      console.error("Email error:", result.error);
      return fail(`Email service error: ${result.error}`, 502);
    }

    console.log(`Email sent: messageId=${result.messageId}`);
    return ok({ emailId: result.messageId, recipients: to });

  } catch (error) {
    console.error("send-email error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message || "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
