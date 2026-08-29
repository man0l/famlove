import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";
import { BOARD_WINDOW_DAYS } from "@/lib/config";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What famlove stores, what it publishes, who else touches it, and how to make it stop.",
};

/**
 * The counterpart to the Terms. famlove is deliberately a public record, so
 * the useful thing this page can do is draw the line precisely: here is the
 * short list that is public because it *is* the product, and here is
 * everything else, which isn't.
 */
export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="display text-4xl text-chalk">Privacy</h1>
      <p className="mt-3 text-sm text-mute">
        Last updated {LEGAL.updated}. The data controller is {LEGAL.entity} (
        {LEGAL.entityLocal}), UIC/ЕИК {LEGAL.uic}, registered at {LEGAL.address},{" "}
        {LEGAL.country}. Questions, corrections and deletions:{" "}
        <a href={`mailto:${LEGAL.email}`} className="text-love">
          {LEGAL.email}
        </a>
        .
      </p>

      <Section n="1" title="What is public, and why">
        <p>
          famlove is a public record of who showed up for whom. These are
          visible to anyone, because they are the product rather than a setting:
        </p>
        <ul className="mt-2 space-y-1.5">
          <Bullet>your X handle and avatar</Bullet>
          <Bullet>which projects you backed, and on which day</Bullet>
          <Bullet>your totals given and received, and your streak</Bullet>
          <Bullet>your project, if you list one</Bullet>
        </ul>
        <p className="mt-3">
          Nothing else is. Not your email, not your balance, not what you paid,
          not anything about your card.
        </p>
      </Section>

      <Section n="2" title="What we collect">
        <Table
          rows={[
            [
              "From X, when you sign in",
              "account id, handle, display name, avatar URL, account creation date, post count",
              "To create your account and check it is at least 30 days old with a post — one of the two proofs that you are a person.",
            ],
            [
              "From the payment provider",
              "a card fingerprint, brand, last four digits, funding type, country, and the amount and tax of each purchase",
              "To credit your jar, to enforce one account per card, and to keep the books. We never see or store a full card number.",
            ],
            [
              "From X or from you, optionally",
              "an email address",
              "If you allow it on the X consent screen we receive your confirmed address; otherwise we only have one if you type it in. Used for famlove's own emails — who showed up for your project, and the daily digests — and, only if you allow cookies, as a match key for measuring our X ads: your browser hashes it before it is sent, so X never receives a readable address, and we send nothing for anyone who has not allowed cookies. Every email carries an unsubscribe link, and unsubscribing deletes the address.",
            ],
            [
              "Automatically",
              "a signed session cookie",
              "To keep you logged in. It holds your account id and nothing else. It is never used for advertising, and it is never read by anyone but us.",
            ],
            [
              "Automatically",
              "anonymous usage measurement",
              "Google Analytics, to count visits and see which pages get read. Until you answer the cookie question it runs in its cookieless mode: no cookie, no identifier stored on your device, and your IP truncated. Allowing cookies lets it tell a returning visitor from a new one.",
            ],
            [
              "Only if you allow cookies",
              "an analytics cookie",
              "DataFast, which counts visits and which of them lead to a top-up. It sets one cookie to recognise you on a later visit, so it is never loaded until you press Allow. Press No cookies and it is never loaded at all. Your choice is remembered in your browser and you can change it by clearing this site's storage.",
            ],
            [
              "Only if you allow cookies",
              "an advertising cookie",
              "We buy ads on X, and X's measurement tag tells us whether an ad led anywhere: it reports two things, listing a project and topping up your jar, the second with the amount net of VAT. If you are signed in and have given us an address, the tag also sends it as a match key — hashed in your browser, so X never receives a readable one. It sets a cookie, and like the analytics cookie it is never loaded until you press Allow and never at all if you press No cookies. It is measurement, not profiling: we do not run retargeting and we build no audiences.",
            ],
          ]}
        />
      </Section>

      <Section n="3" title="Why we are allowed to">
        <p>
          Under the GDPR: performing our contract with you (running your
          account, taking payment, placing your avatar); our legitimate interest
          in preventing fraud and multi-accounting (the card fingerprint and the
          account-age check); your consent (the email — given either on the X
          consent screen or by typing it in, and withdrawn by the unsubscribe
          link in any email we send; and the analytics and advertising cookies,
          given or refused together on the banner, and changed by clearing this
          site&apos;s storage); and legal obligation (keeping tax records).
        </p>
      </Section>

      <Section n="4" title="Why the card fingerprint">
        <p>
          It is the single thing that makes one human cost one card, and it is
          what stops somebody buying the top spot with a hundred sockpuppets.
          The payment provider derives it from the card and gives us an opaque
          string. It cannot be reversed into a card number, and it is not usable
          anywhere else.
        </p>
      </Section>

      <Section n="5" title="Who else touches it">
        <p>
          Only the processors that make the site work, each under a data
          processing agreement, and none of them for their own purposes:
        </p>
        <Table
          rows={[
            ["Stripe", "payments and tax calculation", "Ireland / United States"],
            ["Neon", "the database", "United States"],
            ["Cloudflare", "hosting and delivery", "United States / global edge"],
            ["Resend", "the one email, if you opt in", "United States"],
            ["Google", "anonymous usage measurement", "United States"],
            ["DataFast", "visit and conversion analytics, only with consent", "United States"],
            ["X", "ad conversion measurement, only with consent", "United States"],
            ["Upstash", "rate limiting, if enabled", "United States"],
          ]}
        />
        <p className="mt-3">
          Transfers outside the EEA rely on the European Commission&apos;s
          standard contractual clauses. We do not sell your data and we do not
          share it with brokers, or with anyone not on this list. The one
          advertising relationship is X, above, and only if you allow cookies:
          it is told that a listing happened after one of our ads, and nothing
          about you beyond that.
        </p>
      </Section>

      <Section n="6" title="How long we keep it">
        <p>
          Your account and the record of what you backed stay while your account
          exists. Purchase records are kept for as long as tax law requires,
          which is normally ten years and is not something we can shorten. Card
          fingerprints are kept while the account exists, because deleting one
          would let the same card start again. Boards are computed over a
          rolling {BOARD_WINDOW_DAYS} days from the same underlying records.
        </p>
      </Section>

      <Section n="7" title="Your rights">
        <p>
          You can ask for a copy of your data, correct it, delete it, restrict or
          object to how it is used, or take it elsewhere. Email {LEGAL.email} and
          we will answer within 30 days.
        </p>
        <p className="mt-3">
          Deleting your account removes it along with your wallet and email, and
          refunds any unspent balance. Cents you gave stay on the walls they
          bought, shown against a removed account — those are other people&apos;s
          records of who showed up for them, and we do not edit them.
        </p>
        <p className="mt-3">
          If we get it wrong you can complain to your local data protection
          authority. In {LEGAL.countryShort} that is the {LEGAL.dpa.name},{" "}
          {LEGAL.dpa.address},{" "}
          <a href={`mailto:${LEGAL.dpa.email}`} className="text-love">
            {LEGAL.dpa.email}
          </a>
          .
        </p>
      </Section>

      <Section n="8" title="Security">
        <p>
          Everything is served over HTTPS. Session cookies are signed,
          HTTP-only and same-site. Card data is entered on the payment
          provider&apos;s hosted page and never reaches our servers. If we ever
          suffer a breach affecting your data we will tell you and the regulator
          within 72 hours.
        </p>
      </Section>

      <Section n="9" title="Children">
        <p>
          famlove is for people 18 and over. If you believe someone younger has
          an account, tell us and we will remove it and refund it.
        </p>
      </Section>

      <p className="mt-12 border-t border-line pt-6 text-sm text-mute">
        The other half of the deal is in the{" "}
        <Link href="/legal/terms" className="text-love">
          terms
        </Link>
        , and the money is at{" "}
        <Link href="/cents" className="text-love">
          /cents
        </Link>
        .
      </p>
    </article>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 text-sm leading-relaxed text-mute">
      <h2 className="display text-xl text-chalk">
        <span className="text-love">{n}.</span> {title}
      </h2>
      <div className="mt-2 [&>p+p]:mt-3">{children}</div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span aria-hidden="true" className="text-love">
        ·
      </span>
      <span>{children}</span>
    </li>
  );
}

function Table({ rows }: { rows: string[][] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-line/60 align-top">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`py-2.5 pr-4 last:pr-0 ${
                    j === 0 ? "w-40 text-chalk" : ""
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
