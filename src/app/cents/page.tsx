import type { Metadata } from "next";
import { centsLedger } from "@/lib/queries";
import { formatCents } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Where every cent goes",
  description:
    "famlove keeps the cent. Here is exactly how much came in, what it cost to take, and what it was spent on.",
};

/**
 * The honesty page, and non-optional.
 *
 * The predictable attack on this product is "you put a card reader on
 * friendship." The rebuttal has to exist before launch, and it is this page:
 * one cent, hard capped, unstackable, and a public accounting of the money.
 * That makes it a distribution asset, not a compliance chore.
 */
export default async function CentsPage() {
  const ledger = await centsLedger();
  const kept = ledger.netCents - ledger.spentCents;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">
        Where every cent goes
      </h1>
      <p className="mt-3 text-mute">
        famlove keeps your cent. It is not a tip, not a donation, and it does
        not reach the person you gave it to — it buys your face on their wall,
        which is the feature you are paying for. Nobody here is paid out, so
        there is no Connect account, no KYC and no 1099 anywhere in this
        product. Here is the money.
      </p>

      <section className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        <Cell label="Jars sold" value={ledger.jarsSold.toLocaleString()} />
        <Cell label="Wallets funded" value={ledger.walletsFunded.toLocaleString()} />
        <Cell label="Gross" value={formatCents(ledger.grossCents)} />
        <Cell label="Net kept" value={formatCents(ledger.netCents)} accent />
      </section>

      <section className="mt-8">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-mute">
          What it cost to take the money
        </h2>
        <table className="mt-3 w-full font-mono text-sm">
          <tbody>
            <Line label="Gross received" cents={ledger.grossCents} />
            <Line label="Payment fees" cents={-ledger.feeCents} />
            <Line label="Tax collected and remitted" cents={-ledger.taxCents} />
            <Line label="Refunded, no questions asked" cents={-ledger.refundedCents} />
            <Line label="Net" cents={ledger.netCents} strong />
          </tbody>
        </table>
        <p className="mt-3 font-mono text-xs text-mute">
          The card fee is under a third of the real cost of taking money. VAT,
          currency conversion, refunds and disputes are the rest, and they are
          the reason this sells through a merchant of record rather than raw
          Stripe.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-mute">
          What it was spent on
        </h2>
        {ledger.expenses.length === 0 ? (
          <p className="mt-3 font-mono text-sm text-mute">
            Nothing spent yet.
          </p>
        ) : (
          <table className="mt-3 w-full font-mono text-sm">
            <tbody>
              {ledger.expenses.map((expense, i) => (
                <tr key={`${expense.occurredOn}-${i}`} className="border-b border-line/50">
                  <td className="py-2 pr-3 text-mute">{expense.occurredOn}</td>
                  <td className="py-2 pr-3">
                    {expense.label}
                    {expense.detail && (
                      <span className="block text-xs text-mute">{expense.detail}</span>
                    )}
                  </td>
                  <td className="tabular py-2 text-right">
                    {formatCents(expense.cents)}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="py-2 pr-3 text-mute" />
                <td className="py-2 pr-3 font-semibold">Left over</td>
                <td className="tabular py-2 text-right font-semibold text-love">
                  {formatCents(kept)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        <Small label="Cents still in jars" value={ledger.centsInJars.toLocaleString()} />
        <Small label="Cents given away" value={ledger.centsGiven.toLocaleString()} />
        <Small label="Loves, all time" value={ledger.lovesAllTime.toLocaleString()} />
      </section>

      <p className="mt-10 font-mono text-xs leading-relaxed text-mute">
        Unspent balance is refunded in full, on request, no questions — one
        button on your wallet page. Cents you have already given are gone: they
        bought a pixel on somebody&apos;s wall, and that wall is not being
        edited. There are no bonus cents at any tier, because the moment $30
        buys 3,600¢ a cent stops being a cent and &ldquo;one human, one
        cent&rdquo; stops being true.
      </p>
    </div>
  );
}

function Cell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-ink px-4 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">
        {label}
      </p>
      <p className={`tabular mt-1 font-mono text-xl ${accent ? "text-love" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function Line({
  label,
  cents,
  strong,
}: {
  label: string;
  cents: number;
  strong?: boolean;
}) {
  return (
    <tr className={`border-b border-line/50 ${strong ? "font-semibold" : ""}`}>
      <td className="py-2 pr-3">{label}</td>
      <td className={`tabular py-2 text-right ${cents < 0 ? "text-mute" : ""}`}>
        {cents < 0 ? `−${formatCents(-cents)}` : formatCents(cents)}
      </td>
    </tr>
  );
}

function Small({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">
        {label}
      </p>
      <p className="tabular mt-1 font-mono text-lg">{value}</p>
    </div>
  );
}
