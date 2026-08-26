import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms" };

/**
 * The wording here is load-bearing, not boilerplate. Calling a cent a
 * purchase of a feature rather than a tip or a donation is what keeps famlove
 * out of money transmission and payouts. Closed-loop, single-issuer,
 * non-redeemable credit is the mildest form of stored value there is — but it
 * is still a real category with real EU e-money edges, so get a lawyer to read
 * this before taking the first payment. This file is not legal advice; it is a
 * marker for where legal advice is needed.
 */
export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12 text-sm leading-relaxed text-mute">
      <h1 className="display text-4xl text-chalk">Terms</h1>

      <Section title="What you are buying">
        Cents are credit inside famlove, used to place your avatar on a project
        page. They are consumed by famlove in exchange for that feature. They
        are not a tip, a donation, a gift, an investment, or a transfer of value
        to anyone else. No money reaches the owner of any project, at any point,
        in any amount.
      </Section>

      <Section title="What a cent does">
        One cent places your avatar on one project&apos;s wall for one UTC day.
        You may place at most one cent on a given project per UTC day, and at
        most 60 cents per day in total. Rank counts distinct people, not cents:
        spending more cannot raise a position.
      </Section>

      <Section title="Credit, not currency">
        Cents are non-transferable, do not expire, cannot be exchanged between
        accounts, and have no value outside famlove. Unspent credit is refunded
        in full on request, with no questions asked, to the original payment
        method. Credit that has already been spent is not refundable — it bought
        a placement that was delivered.
      </Section>

      <Section title="Identity">
        An account requires an X account at least 30 days old with at least one
        post, and a payment card. Card fingerprints are stored to enforce one
        account per card. Attempting to create multiple accounts, or to place
        cents on your own project, ends the account and forfeits nothing —
        unspent credit is still refunded.
      </Section>

      <Section title="What we publish">
        Your handle, avatar, the projects you have backed, your totals given and
        received, and your streak are public. That is the product: a public
        record of who showed up. If you would rather that not be public, do not
        spend a cent.
      </Section>

      <Section title="The money">
        Every cent famlove takes is accounted for at /cents. Sales are made
        through a merchant of record where one is configured, in which case that
        merchant is the seller of record and handles tax.
      </Section>

      <p className="mt-10 text-sm">
        Questions, refunds, deletions: reply to any famlove email or contact the
        operator listed at /cents.
      </p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="display text-xl text-chalk">{title}</h2>
      <p className="mt-2">{children}</p>
    </section>
  );
}
