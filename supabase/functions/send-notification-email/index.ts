import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Send notification emails for voucher approval workflow.
 * Called from the frontend after voucher status changes.
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
      // Load notification from DB
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

    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      return new Response(JSON.stringify({ success: false, error: "Email service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const senderEmail = Deno.env.get("EMAIL_FROM_ADDRESS") || "noreply@expense-tracker.app";
    const appUrl = Deno.env.get("FRONTEND_URL") || "https://expense-tracker-delta-ashy.vercel.app";

    // Build HTML email
    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:20px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#7c3aed,#8b5cf6);padding:24px 28px;">
      <h1 style="color:#ffffff;margin:0;font-size:18px;">Expense Tracker</h1>
      ${voucherNumber ? `<p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px;">${voucherNumber}</p>` : ""}
    </div>
    <div style="padding:28px;">
      <h2 style="color:#1a1a2e;margin:0 0 12px;font-size:16px;">${subject}</h2>
      <p style="color:#4a4a68;line-height:1.6;font-size:14px;margin:0 0 24px;">${message.replace(/\n/g, "<br>")}</p>
      <a href="${appUrl}" style="display:inline-block;padding:12px 28px;background:#8b5cf6;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Open Expense Tracker</a>
    </div>
    <div style="padding:16px 28px;background:#f8f8fc;border-top:1px solid #eeeef2;">
      <p style="color:#9999aa;font-size:12px;margin:0;">This is an automated notification from your company's Expense Tracker.</p>
    </div>
  </div>
</body>
</html>`;

    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Expense Tracker", email: senderEmail },
        to: [{ email: to }],
        subject: `[Expense Tracker] ${subject}`,
        htmlContent,
        textContent: message,
      }),
    });

    const brevoData = await brevoResponse.json();

    if (!brevoResponse.ok) {
      console.error("Brevo error:", JSON.stringify(brevoData));
      return new Response(JSON.stringify({ success: false, error: brevoData.message || "Email send failed" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark notification as email_sent if notificationId provided
    if (body.notificationId) {
      await supabase
        .from("notifications")
        .update({ email_sent: true })
        .eq("id", body.notificationId);
    }

    console.log(`Notification email sent to ${to}: ${subject}`);
    return new Response(JSON.stringify({ success: true, messageId: brevoData.messageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("send-notification-email error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
