import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL, entityInSentence } from "@/lib/legal";
import {
  DAILY_GIVE_CEILING,
  MIN_X_ACCOUNT_AGE_DAYS,
  MIN_X_POSTS,
  TIERS,
} from "@/lib/config";
import { formatCents } from "@/lib/time";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "What a cent is, what it buys, and what happens to your money. In plain English.",
};

/**
 * The wording here is load-bearing, not boilerplate.
 *
 * Two decisions are doing all the work. First, a cent is a purchase of a
 * feature — an avatar placed on a page — not a tip, a donation, or a transfer.
 * No money ever reaches a project owner, which is why there is no Connect
 * account, no KYC and no payouts anywhere in this codebase. Second, cents are
 * closed-loop, single-issuer, non-transferable credit that can only be
 * redeemed against that one feature and are refunded in cash while unspent.
 *
 * §5 and §7 exist to keep both of those true in writing as well as in code.
 */
export default function TermsPage() {
  const hook = TIERS[0];

  return (
    <article className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="display text-4xl text-chalk">Terms of Service</h1>
      <p className="mt-3 text-sm text-mute">
        Last updated {LEGAL.updated}. These terms are a contract between you and{" "}
        {entityInSentence()}. Nothing in them takes away rights the law where you
        live gives you.
      </p>

      <Section n="1" title="Who you are dealing with">
        <p>
          famlove.lol is operated and sold by{" "}
          <strong className="text-chalk">
            {LEGAL.entity || "the site operator"}
          </strong>
          {LEGAL.companyNumber && `, company number ${LEGAL.companyNumber}`}
          {LEGAL.vatNumber && `, VAT ${LEGAL.vatNumber}`}
          {LEGAL.address && `, registered at ${LEGAL.address}`}
          {LEGAL.country && `, ${LEGAL.country}`}. We are the seller of record
          for everything you buy here.
        </p>
        <p>
          Reach a human at{" "}
          <a href={`mailto:${LEGAL.email}`} className="text-love">
            {LEGAL.email}
          </a>
          . That address is monitored, and it is the right place for refunds,
          deletions, complaints and anything a page here doesn&apos;t answer.
        </p>
      </Section>

      <Section n="2" title="What famlove is">
        <p>
          famlove ranks projects by how many separate people spent one cent on
          them, not by how much money anyone spent. Spending a cent places your
          avatar on that project&apos;s page for that day. That placement — a
          pixel with your face on it, on somebody else&apos;s wall — is the
          entire thing you are buying.
        </p>
      </Section>

      <Section n="3" title="Who can use it">
        <ul className="mt-2 space-y-1.5">
          <Bullet>You must be at least 18.</Bullet>
          <Bullet>
            You need an X account at least {MIN_X_ACCOUNT_AGE_DAYS} days old
            with at least {MIN_X_POSTS} post, and a payment card.
          </Bullet>
          <Bullet>
            One account per person, and one payment card per account. We store a
            fingerprint of your card — never the number — to enforce that.
          </Bullet>
          <Bullet>One project listing per account.</Bullet>
        </ul>
        <p className="mt-3">
          You are responsible for what happens under your account. Tell us at{" "}
          {LEGAL.email} if you think someone else is using it.
        </p>
      </Section>

      <Section n="4" title="The rules of the game">
        <ul className="mt-2 space-y-1.5">
          <Bullet>One cent places one avatar on one project for one UTC day.</Bullet>
          <Bullet>
            You may spend at most <strong className="text-chalk">one cent</strong>{" "}
            on a given project per UTC day. Not two. There is no way to buy more.
          </Bullet>
          <Bullet>
            You may spend at most {DAILY_GIVE_CEILING} cents per day in total.
          </Bullet>
          <Bullet>
            Rank counts distinct people, never cents. Spending more cannot raise
            a position — yours or anyone&apos;s.
          </Bullet>
          <Bullet>You cannot spend a cent on your own project.</Bullet>
        </ul>
        <p className="mt-3">
          These limits are enforced by the database, not by our good intentions.
          If you find a way around one, tell us at {LEGAL.email} rather than
          using it.
        </p>
      </Section>

      <Section n="5" title="What a cent is, and what it is not">
        <p>
          Cents are a limited, personal, non-transferable licence to place your
          avatar on project pages on this site. They are consumed by us in
          exchange for that feature.
        </p>
        <p className="mt-3">A cent is specifically not:</p>
        <ul className="mt-2 space-y-1.5">
          <Bullet>
            a tip, donation, gift, reward, investment or payment to anyone else.{" "}
            <strong className="text-chalk">
              No money reaches the owner of any project, ever, in any amount.
            </strong>
          </Bullet>
          <Bullet>
            electronic money, a payment instrument, a stored-value card, a
            voucher or a gift card. Cents can only ever be redeemed against this
            one feature on this one site.
          </Bullet>
          <Bullet>
            transferable. Cents cannot be sent, sold, gifted, pooled or moved
            between accounts, and have no value outside famlove.
          </Bullet>
        </ul>
        <p className="mt-3">
          Cents do not expire, earn interest, or convert to cash — except
          through the refund right in §7, which returns money to your card
          rather than paying out a balance.
        </p>
      </Section>

      <Section n="6" title="Buying cents">
        <p>
          Cents are sold in fixed jars, starting at {formatCents(hook.cents)} for{" "}
          {hook.grantedCents} cents. Prices shown include any VAT or sales tax
          due, which we calculate from your billing country at checkout and remit
          ourselves. There are no bonus cents at any tier: a cent always costs a
          cent.
        </p>
        <p className="mt-3">
          Payment is a single charge. Nothing renews, nothing is stored on file
          for later, and there is no subscription. Card details are entered on
          our payment provider&apos;s hosted page and never reach our servers.
          Credit is added to your account as soon as the payment clears.
        </p>
      </Section>

      <Section n="7" title="Refunds and your right to cancel">
        <p className="text-chalk">
          Unspent cents are refunded in full, on request, with no questions
          asked, at any time.
        </p>
        <p className="mt-3">
          There is a button on your wallet page that does it immediately; the
          money goes back to the card you paid with. You never have to email
          anyone, explain yourself, or wait.
        </p>
        <p className="mt-3">
          Cents you have already spent are not refundable. Spending one delivers
          the thing you bought — your avatar appears on a page, publicly and
          immediately — and that placement cannot be un-delivered.
        </p>
        <p className="mt-3">
          If you are a consumer in the EU or UK you normally have 14 days to
          withdraw from a distance contract. Because cents are digital content
          supplied immediately, you are asked to agree at checkout that supply
          begins at once and that you lose the statutory right of withdrawal for
          any cent you then spend. Your right of withdrawal over{" "}
          <em>unspent</em> credit is unaffected — and in practice our refund
          promise above is broader than the statutory right, since it has no
          deadline at all.
        </p>
      </Section>

      <Section n="8" title="What is public">
        <p>
          famlove is a public record of who showed up. Your handle, avatar, the
          projects you have backed and when, your totals given and received, and
          your streak are all visible to anyone. That is the product, not a
          setting.
        </p>
        <p className="mt-3">
          If you would rather none of that were public, do not spend a cent.
          What is <em>not</em> public is covered in the{" "}
          <Link href="/legal/privacy" className="text-love">
            privacy policy
          </Link>
          .
        </p>
      </Section>

      <Section n="9" title="Listings and conduct">
        <p>
          If you list a project you confirm it is yours or you are authorised to
          list it, and that its name, tagline and link are accurate. Don&apos;t
          list anything unlawful, hateful, sexual, deceptive, malware-bearing, or
          impersonating someone else. We can remove a listing that breaks this,
          and we&apos;ll tell you why.
        </p>
        <p className="mt-3">Don&apos;t:</p>
        <ul className="mt-2 space-y-1.5">
          <Bullet>
            create more than one account, or use someone else&apos;s card or
            identity, to make your numbers look bigger.
          </Bullet>
          <Bullet>
            automate spending, scrape the site at volume, or interfere with how
            the rules are enforced.
          </Bullet>
          <Bullet>
            attempt to buy, sell or trade rank, cents, accounts or placements.
          </Bullet>
        </ul>
        <p className="mt-3">
          If you do, we may suspend the account and remove the placements it
          bought.{" "}
          <strong className="text-chalk">
            We will still refund its unspent balance in full.
          </strong>{" "}
          We keep your money for a feature we delivered, never as a penalty.
        </p>
      </Section>

      <Section n="10" title="Chargebacks">
        <p>
          If something looks wrong on your statement, email {LEGAL.email} first —
          a refund takes us about a minute and costs you nothing. Raising a
          chargeback on a purchase you made and spent may result in suspension,
          because it reverses a placement that was already delivered publicly.
        </p>
      </Section>

      <Section n="11" title="Availability and changes">
        <p>
          We may change, suspend or discontinue any part of famlove. If we
          discontinue it altogether, or make a change that materially reduces
          what a cent buys, we will refund unspent balances. Beyond that the
          service is provided as-is: we don&apos;t promise it will be
          uninterrupted, error-free, or that any particular number of people will
          show up for you.
        </p>
      </Section>

      <Section n="12" title="Liability">
        <p>
          Nothing here limits our liability for death or personal injury caused
          by negligence, for fraud, or for anything else that cannot be limited
          under the law that applies to you — including your rights as a consumer,
          which these terms do not affect.
        </p>
        <p className="mt-3">
          Subject to that, and because of the amounts involved, our total
          liability to you for any claim connected to famlove is limited to the
          greater of the amount you paid us in the twelve months before the claim
          and €50. We are not liable for indirect or consequential loss, or for
          lost profits, revenue or goodwill.
        </p>
      </Section>

      <Section n="13" title="Ending it">
        <p>
          Close your account whenever you like by emailing {LEGAL.email}. We will
          delete your account, wallet and email address and refund any unspent
          balance. Cents you gave stay on the walls they bought, shown against a
          removed account — we are not editing other people&apos;s records of who
          showed up for them.
        </p>
        <p className="mt-3">
          We may close an account that breaks §9, or where we are required to.
          Unspent balance is refunded either way.
        </p>
      </Section>

      <Section n="14" title="Law, and where to complain">
        <p>
          These terms are governed by the law of {LEGAL.country}, and the courts
          there have jurisdiction. If you are a consumer resident elsewhere in
          the EU or UK, you keep the mandatory protections and the right to bring
          proceedings in the courts of your own country.
        </p>
        <p className="mt-3">
          Complaints go to {LEGAL.email} and we&apos;ll answer within 14 days. EU
          consumers may also use the European Commission&apos;s online dispute
          resolution platform at{" "}
          <a
            href="https://ec.europa.eu/consumers/odr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-love"
          >
            ec.europa.eu/consumers/odr
          </a>
          .
        </p>
      </Section>

      <Section n="15" title="Changes to these terms">
        <p>
          We may update these terms. If a change materially affects you we will
          say so on the site before it takes effect, and you can take your
          unspent balance and go. Continuing to spend cents after that means you
          accept the new version.
        </p>
      </Section>

      <p className="mt-12 border-t border-line pt-6 text-sm text-mute">
        Every cent we take is accounted for at{" "}
        <Link href="/cents" className="text-love">
          famlove.lol/cents
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
      {/* Space consecutive paragraphs without hand-placing a margin on each. */}
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
