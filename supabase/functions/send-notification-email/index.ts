import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Send notification emails for voucher/advance approval workflow.
 * Supports both Resend and Brevo (fallback).
 *
 * Body: { notificationId: UUID } or { to: string, subject: string, message: string, voucherNumber?: string }
 */
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
    let to: string, subject: string, message: string, voucherNumber: string;

    if (body.notificationId) {
      const { data: notif, error: nErr } = await supabase
        .from("notifications")
        .select("*, recipient:user_id(email, name)")
        .eq("id", body.notificationId)
        .single();

      if (nErr || !notif) {
        return new Response(JSON.stringify({ success: false, error: "Notification not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      to = notif.recipient?.email;
      subject = notif.title;
      message = notif.message;
      voucherNumber = "";
    } else {
      to = body.to;
      subject = body.subject;
      message = body.message;
      voucherNumber = body.voucherNumber || "";
    }

    if (!to || !subject) {
      return new Response(JSON.stringify({ success: false, error: "Recipient and subject are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Email config
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    const senderEmail = Deno.env.get("EMAIL_FROM_ADDRESS") || "noreply@fluxgentech.com";
    const senderName = Deno.env.get("EMAIL_FROM_NAME") || "FluxGen Expenses";
    const appUrl = Deno.env.get("FRONTEND_URL") || "https://expense-tracker-delta-ashy.vercel.app";

    // Build HTML email
    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:#111827;padding:24px 28px;">
      <h1 style="color:#ffffff;margin:0;font-size:16px;font-weight:700;">${senderName}</h1>
      ${voucherNumber ? `<p style="color:rgba(255,255,255,0.6);margin:4px 0 0;font-size:12px;">${voucherNumber}</p>` : ""}
    </div>
    <div style="padding:28px;">
      <h2 style="color:#111827;margin:0 0 12px;font-size:16px;font-weight:700;">${subject}</h2>
      <p style="color:#374151;line-height:1.7;font-size:14px;margin:0 0 24px;">${message.replace(/\n/g, "<br>")}</p>
      <a href="${appUrl}" style="display:inline-block;padding:12px 28px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Open Dashboard</a>
    </div>
    <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
      <p style="color:#9ca3af;font-size:11px;margin:0;">This is an automated notification from ${senderName}. Do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;

    let emailResult: { success: boolean; messageId?: string; error?: string };

    // Try Resend first (better deliverability), fallback to Brevo
    if (resendApiKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${senderName} <${senderEmail}>`,
          to: [to],
          subject: `[${senderName}] ${subject}`,
          html: htmlContent,
          text: message,
        }),
      });
      const data = await res.json();
      emailResult = res.ok
        ? { success: true, messageId: data.id }
        : { success: false, error: data.message || "Resend failed" };
    } else if (brevoApiKey) {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": brevoApiKey,
          "Content-Type": "application/json",
          "accept": "application/json",
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: to }],
          subject: `[${senderName}] ${subject}`,
          htmlContent,
          textContent: message,
        }),
      });
      const data = await res.json();
      emailResult = res.ok
        ? { success: true, messageId: data.messageId }
        : { success: false, error: data.message || "Brevo failed" };
    } else {
      return new Response(JSON.stringify({ success: false, error: "No email service configured (set RESEND_API_KEY or BREVO_API_KEY)" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!emailResult.success) {
      console.error("Email error:", emailResult.error);
      return new Response(JSON.stringify(emailResult), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark notification as email_sent
    if (body.notificationId) {
      await supabase.from("notifications").update({ email_sent: true }).eq("id", body.notificationId);
    }

    console.log(`Email sent to ${to}: ${subject}`);
    return new Response(JSON.stringify({ success: true, messageId: emailResult.messageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("send-notification-email error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
