import { SITE_URL } from "./config";
import { sql } from "./db";
import { unsubscribeUrl } from "./unsubscribe";

/**
 * famlove sends three emails and no others.
 *
 *   showed-up   — somebody just backed your project, sent once a day at most
 *   owner       — the daily digest of who showed up for you
 *   supporter   — the daily digest of how the projects you back are doing
 *
 * Two rules hold across all of them. Nobody gets one without an address we
 * were given — from X's consent screen, or typed in — so silence is the
 * default, and every message carries an unsubscribe that deletes it. And
 * every send is claimed in `email_sends` before it goes out, because a cron
 * that retries must not mean two copies in somebody's inbox.
 */

export const emailConfigured = Boolean(process.env.RESEND_API_KEY);

const FROM = process.env.EMAIL_FROM ?? "famlove <hi@famlove.lol>";

/**
 * Claim the right to send. Returns false if this exact email already went.
 *
 * Insert-first rather than check-then-send: two concurrent runs both see
 * "not sent yet" otherwise, and the unique key is what actually decides.
 * The claim is released again if the send fails, or a provider outage would
 * silently mean nobody ever gets that day's digest — a claim is a lock, not
 * a record of delivery.
 */
async function claim(
  userId: number,
  kind: string,
  day: string,
  ref = "",
): Promise<boolean> {
  const rows = (await sql`
    INSERT INTO email_sends (user_id, kind, day_utc, ref)
    VALUES (${userId}, ${kind}, ${day}::date, ${ref})
    ON CONFLICT DO NOTHING
    RETURNING user_id
  `) as unknown[];
  return rows.length > 0;
}

async function release(
  userId: number,
  kind: string,
  day: string,
  ref = "",
): Promise<void> {
  await sql`
    DELETE FROM email_sends
    WHERE user_id = ${userId} AND kind = ${kind}
      AND day_utc = ${day}::date AND ref = ${ref}
  `;
}

async function send(args: {
  to: string;
  subject: string;
  html: string;
  /** Whose mail this is, so the message can carry its own unsubscribe. */
  unsubscribe: string;
}): Promise<boolean> {
  if (!emailConfigured) return false;
  const { unsubscribe, ...mail } = args;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        ...mail,
        /*
         * RFC 8058. These are what put the native "Unsubscribe" button next
         * to the sender name in Gmail and Apple Mail — the one people
         * actually use. Without them the alternative people reach for is the
         * spam button, which costs the sending domain far more than a lost
         * subscriber.
         */
        headers: {
          "List-Unsubscribe": `<${unsubscribe}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });
    if (!res.ok) console.error("[email]", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("[email] failed:", err);
    return false;
  }
}

/* ------------------------------------------------------------------ layout */

const shell = (body: string, unsubscribe: string) => `
<div style="background:#0c0a12;padding:28px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#16131f;border:1px solid #2e2740;border-radius:22px;padding:28px">
    <p style="margin:0 0 18px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#ff3d68">
      famlove.lol
    </p>
    ${body}
    <p style="margin:28px 0 0;font-size:12px;color:#6f6885;line-height:1.6">
      You get this because you added your address on famlove.
      <a href="${unsubscribe}" style="color:#9b93ad;text-decoration:underline">Unsubscribe</a>
      any time. Every cent we take is listed at
      <a href="${SITE_URL}/cents" style="color:#9b93ad">${SITE_URL.replace(/^https?:\/\//, "")}/cents</a>.
    </p>
  </div>
</div>`;

const h1 = (text: string) =>
  `<h1 style="margin:0 0 10px;font-size:22px;line-height:1.25;color:#f2eff7">${text}</h1>`;

const p = (text: string) =>
  `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#9b93ad">${text}</p>`;

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;margin-top:6px;background:#ff3d68;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:999px">${label}</a>`;

const handles = (list: string[], limit = 14) => {
  const shown = list.slice(0, limit).map((x) => `@${x}`).join(", ");
  const rest = list.length - Math.min(list.length, limit);
  return rest > 0 ? `${shown} and ${rest} more` : shown;
};

/* ------------------------------------------------ 1. somebody just showed up */

/**
 * Sent at most once per project per day, on the first cent.
 *
 * Deliberately not one per backer: a project having a good day would
 * otherwise mean a hundred emails, which is how a sending domain gets
 * classed as spam and how a person learns to filter you. The rest of the
 * day's names arrive in the digest below.
 */
export async function sendFirstBackerOfDay(args: {
  ownerId: number;
  to: string;
  projectName: string;
  slug: string;
  backerHandle: string;
  day: string;
}): Promise<boolean> {
  if (!emailConfigured) return false;
  if (!(await claim(args.ownerId, "showed-up", args.day, args.slug))) return false;

  const unsubscribe = await unsubscribeUrl(args.ownerId);
  const ok = await send({
    unsubscribe,
    to: args.to,
    subject: `@${args.backerHandle} showed up for ${args.projectName}`,
    html: shell(
      h1(`@${args.backerHandle} just showed up.`) +
        p(
          `First cent on <strong style="color:#f2eff7">${args.projectName}</strong> today. ` +
            `They could not have spent more than one — nobody can.`,
        ) +
        p(`Everyone else who shows up today lands in tonight's digest.`) +
        button(`${SITE_URL}/p/${args.slug}`, "See your wall"),
      unsubscribe,
    ),
  });
  if (!ok) await release(args.ownerId, "showed-up", args.day, args.slug);
  return ok;
}

/* ---------------------------------------------------- 2. the owner's digest */

export async function sendOwnerDigest(args: {
  ownerId: number;
  to: string;
  projectName: string;
  slug: string;
  count: number;
  people: string[];
  streakDays: number;
  rank: number | null;
  day: string;
}): Promise<boolean> {
  if (!emailConfigured) return false;
  if (!(await claim(args.ownerId, "owner-digest", args.day, args.slug))) return false;

  const subject =
    args.count === 1
      ? `1 person showed up for ${args.projectName}`
      : `${args.count} people showed up for ${args.projectName}`;

  const unsubscribe = await unsubscribeUrl(args.ownerId);
  const ok = await send({
    unsubscribe,
    to: args.to,
    subject,
    html: shell(
      h1(subject) +
        p(handles(args.people)) +
        p(
          `That is ${args.count}¢, a ${args.streakDays}-day streak` +
            (args.rank ? `, and #${args.rank} on the board` : "") +
            `.`,
        ) +
        button(`${SITE_URL}/p/${args.slug}`, "See the wall") +
        p(
          `<br>Worth posting — the card updates itself, so it always shows who ` +
            `actually turned up.`,
        ),
      unsubscribe,
    ),
  });
  if (!ok) await release(args.ownerId, "owner-digest", args.day, args.slug);
  return ok;
}

/* ------------------------------------------------ 3. the supporter's digest */

export type SupporterLine = {
  name: string;
  slug: string;
  backersToday: number;
  rank: number | null;
};

/**
 * The other half of the loop. Somebody who spends cents on other people's
 * projects currently hears nothing back — this tells them what their cents
 * were part of, and is the thing most likely to bring them back tomorrow.
 */
export async function sendSupporterDigest(args: {
  userId: number;
  to: string;
  handle: string;
  projects: SupporterLine[];
  centsLeft: number;
  autoCount: number;
  day: string;
}): Promise<boolean> {
  if (!emailConfigured || args.projects.length === 0) return false;
  if (!(await claim(args.userId, "supporter-digest", args.day))) return false;

  const rows = args.projects
    .map(
      (x) => `
      <tr>
        <td style="padding:9px 0;border-bottom:1px solid #2e2740">
          <a href="${SITE_URL}/p/${x.slug}" style="color:#f2eff7;text-decoration:none;font-weight:600">${x.name}</a>
          ${x.rank ? `<span style="color:#6f6885"> · #${x.rank}</span>` : ""}
        </td>
        <td style="padding:9px 0;border-bottom:1px solid #2e2740;text-align:right;color:#c8ff4d;font-weight:600">
          ${x.backersToday}
        </td>
      </tr>`,
    )
    .join("");

  const unsubscribe = await unsubscribeUrl(args.userId);
  const ok = await send({
    unsubscribe,
    to: args.to,
    subject: `The ${args.projects.length} you backed, yesterday`,
    html: shell(
      h1("Here's what you were part of.") +
        p(
          `You have shown up for these. This is how they did — the number is ` +
            `how many people turned out.`,
        ) +
        `<table style="width:100%;border-collapse:collapse;margin:4px 0 18px">${rows}</table>` +
        p(
          args.autoCount > 0
            ? `${args.autoCount} of these run on a standing order, and you have ` +
                `<strong style="color:#f2eff7">${args.centsLeft}¢</strong> left — ` +
                `about ${Math.floor(args.centsLeft / Math.max(1, args.autoCount))} more days of it.`
            : `You have <strong style="color:#f2eff7">${args.centsLeft}¢</strong> left in your jar.`,
        ) +
        button(SITE_URL, "Find someone to back"),
      unsubscribe,
    ),
  });
  if (!ok) await release(args.userId, "supporter-digest", args.day);
  return ok;
}
