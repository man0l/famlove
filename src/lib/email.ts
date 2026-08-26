import { SITE_URL } from "./config";

/**
 * One email exists: "N people showed up for you today", with their handles.
 * It is the only notification in v1 because it is the only one that carries
 * the product — the wall — into an inbox.
 *
 * X OAuth does not hand out email addresses, so users.email is opt-in from
 * /settings and this is a no-op for everyone who hasn't filled it in.
 */

export const emailConfigured = Boolean(process.env.RESEND_API_KEY);

export async function sendShowedUpEmail(args: {
  to: string;
  projectName: string;
  slug: string;
  count: number;
  handles: string[];
  streakDays: number;
}): Promise<boolean> {
  if (!emailConfigured) return false;

  const { to, projectName, slug, count, handles, streakDays } = args;
  const people = handles.slice(0, 12).map((h) => `@${h}`).join(", ");
  const more = handles.length > 12 ? ` and ${handles.length - 12} more` : "";
  const subject =
    count === 1
      ? `1 person showed up for ${projectName}`
      : `${count} people showed up for ${projectName}`;

  const html = `
    <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;max-width:520px">
      <p style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#8a8a8a">
        famlove.lol · receipt
      </p>
      <h1 style="font-size:22px;margin:8px 0 4px">${subject}</h1>
      <p style="color:#444;margin:0 0 16px">
        ${people}${more}
      </p>
      <p style="color:#444;margin:0 0 16px">
        That's ${count}¢, and a ${streakDays}-day streak.
      </p>
      <p><a href="${SITE_URL}/p/${slug}" style="color:#e03e6a">See the wall →</a></p>
      <p style="color:#8a8a8a;font-size:12px;margin-top:24px">
        Every cent famlove takes is listed at ${SITE_URL}/cents.
      </p>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "famlove <hi@famlove.lol>",
        to,
        subject,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
