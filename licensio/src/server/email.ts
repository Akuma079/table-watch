import "server-only";
import { serverEnv } from "@/lib/env";

// Envoi d'emails transactionnels via l'API Resend. Sans RESEND_API_KEY, rien n'est envoyé
// et l'appelant se rabat sur un lien à transmettre à la main.
export function emailConfigured() {
  const env = serverEnv();
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

export async function sendEmail(message: { to: string; subject: string; html: string; text: string; replyTo?: string }) {
  const env = serverEnv();
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return false;
  try {
    const res = await fetch(`${env.RESEND_API_BASE ?? "https://api.resend.com"}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error("[email] Resend", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] Resend", e);
    return false;
  }
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function invitationEmail(input: { workspaceName: string; inviterName: string; roleLabel: string; url: string }) {
  const { workspaceName, inviterName, roleLabel, url } = input;
  const subject = `${inviterName} vous invite à rejoindre « ${workspaceName} » sur Licensio`;
  const text = [
    `Bonjour,`,
    ``,
    `${inviterName} vous invite à rejoindre l'espace « ${workspaceName} » sur Licensio, en tant que ${roleLabel.toLowerCase()}.`,
    `Licensio centralise les licences des musiques, vidéos et images utilisées dans vos montages.`,
    ``,
    `Accepter l'invitation (lien valable 7 jours) :`,
    url,
    ``,
    `Si vous n'attendiez pas cette invitation, ignorez simplement cet email.`,
  ].join("\n");
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f5f5f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#171717">
<div style="max-width:520px;margin:0 auto;padding:32px 16px">
<div style="background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:28px">
<p style="margin:0 0 20px;font-weight:600;font-size:16px">Licensio</p>
<p style="margin:0 0 12px;font-size:15px;line-height:1.5"><strong>${escapeHtml(inviterName)}</strong> vous invite à rejoindre l'espace <strong>« ${escapeHtml(workspaceName)} »</strong> en tant que ${escapeHtml(roleLabel.toLowerCase())}.</p>
<p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#525252">Licensio centralise les licences des musiques, vidéos et images utilisées dans vos montages.</p>
<a href="${escapeHtml(url)}" style="display:inline-block;background:#171717;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:500">Accepter l'invitation</a>
<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#737373">Lien valable 7 jours. Si vous n'attendiez pas cette invitation, ignorez simplement cet email.</p>
</div></div></body></html>`;
  return { subject, text, html };
}
