// POST /api/contact — Zentic Motion project-enquiry mailer.
// Sends (1) a notification to Krishna and (2) an auto-reply to the visitor,
// both via the dedicated zenticmotion.noreply@gmail.com Gmail (SMTP + app password).
// Secrets come from Vercel env vars: GMAIL_USER, GMAIL_APP_PASSWORD, CONTACT_NOTIFY_TO.
const nodemailer = require("nodemailer");

const GMAIL_USER = process.env.GMAIL_USER || "";
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || "";
const NOTIFY_TO = process.env.CONTACT_NOTIFY_TO || "";
const FROM = `"Zentic Motion" <${GMAIL_USER}>`;

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const body = req.body || {};

  // Honeypot spam guard: bots fill this hidden field; humans never see it.
  if (body.company) return res.status(200).json({ ok: true });

  const name = String(body.name || "").trim().slice(0, 120);
  const email = String(body.email || "").trim().slice(0, 160);
  const service = String(body.service || "").trim().slice(0, 120);
  const message = String(body.message || "").trim().slice(0, 5000);

  if (!name || !isValidEmail(email) || !message) {
    return res
      .status(400)
      .json({ ok: false, error: "Please add your name, a valid email and your brief." });
  }
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD || !NOTIFY_TO) {
    return res.status(500).json({ ok: false, error: "Email service is not configured." });
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });

  const notifyHtml = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0e0e0e;color:#f4f3ec;border-radius:12px;overflow:hidden">
      <div style="padding:20px 24px;border-bottom:1px solid #2a2a2a">
        <div style="font-size:12px;letter-spacing:3px;color:#8f8f8f">ZENTIC MOTION</div>
        <div style="font-size:20px;margin-top:6px">New project enquiry</div>
      </div>
      <div style="padding:20px 24px;font-size:14px;line-height:1.7">
        <p><strong>Name:</strong> ${esc(name)}</p>
        <p><strong>Email:</strong> <a href="mailto:${esc(email)}" style="color:#f4f3ec">${esc(email)}</a></p>
        <p><strong>Project type:</strong> ${esc(service || "—")}</p>
        <p><strong>Brief:</strong></p>
        <p style="white-space:pre-wrap;background:#161616;border:1px solid #2a2a2a;border-radius:8px;padding:12px 14px">${esc(message)}</p>
        <p><a href="mailto:${esc(email)}?subject=${encodeURIComponent("Re: Project enquiry — " + (service || "Zentic Motion"))}" style="display:inline-block;margin-top:8px;background:#f4f3ec;color:#0e0e0e;text-decoration:none;padding:10px 18px;border-radius:999px;font-weight:bold">Reply to ${esc(name)}</a></p>
      </div>
    </div>`;

  const replyHtml = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0e0e0e;color:#f4f3ec;border-radius:12px;overflow:hidden">
      <div style="padding:20px 24px;border-bottom:1px solid #2a2a2a">
        <div style="font-size:12px;letter-spacing:3px;color:#8f8f8f">ZENTIC MOTION</div>
        <div style="font-size:20px;margin-top:6px">Brief received.</div>
      </div>
      <div style="padding:20px 24px;font-size:14px;line-height:1.8">
        <p>Hi ${esc(name)},</p>
        <p>Thanks for sending your brief — I've got it and I'll reply within 24–48 hours.</p>
        <p style="color:#8f8f8f">— Krishna<br />Zentic Motion</p>
      </div>
    </div>`;

  const notify = transporter.sendMail({
    from: FROM,
    to: NOTIFY_TO,
    replyTo: `"${name.replace(/"/g, "")}" <${email}>`,
    subject: `New project enquiry — ${service || "Zentic Motion"}`,
    text: `Name: ${name}\nEmail: ${email}\nProject type: ${service || "—"}\n\n${message}`,
    html: notifyHtml,
  });

  const autoReply = transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Brief received — Zentic Motion",
    text: `Hi ${name},\n\nThanks for sending your brief — I've got it and I'll reply within 24–48 hours.\n\n— Krishna\nZentic Motion`,
    html: replyHtml,
  });

  const [notifyRes, replyRes] = await Promise.allSettled([notify, autoReply]);
  if (notifyRes.status === "rejected") {
    console.error("contact notify failed:", notifyRes.reason && notifyRes.reason.message);
    return res
      .status(502)
      .json({ ok: false, error: "Couldn't send just now — please email directly instead." });
  }
  if (replyRes.status === "rejected") {
    console.error("contact auto-reply failed:", replyRes.reason && replyRes.reason.message);
  }
  return res.status(200).json({ ok: true });
};
