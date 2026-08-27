import { formatCents } from "@/lib/time";
import { DAILY_CAP_PER_PROJECT, DAILY_GIVE_CEILING } from "@/lib/config";
import { Confetti } from "./Confetti";

/**
 * "RECEIPT · NOT A DONATION" is not a joke line — it's the product's legal
 * shape written where the buyer can see it. The cent is consumed by famlove
 * in exchange for a pixel on a wall.
 */
export function Receipt({
  projectName,
  ownerHandle,
  viewerHandle,
  balance,
  givenToday,
  backerNumber,
  rank,
  previousRank,
  projectUrl,
}: {
  projectName: string;
  ownerHandle: string;
  viewerHandle: string;
  balance: number;
  givenToday: number;
  backerNumber: number;
  rank: number | null;
  previousRank: number | null;
  projectUrl: string;
}) {
  const moved = rank !== null && previousRank !== null && rank !== previousRank;

  /*
   * The backer's own version of the share loop. The project owner posts their
   * wall; the person who showed up gets to post that they did — and the thing
   * worth saying is the part money cannot buy: they were number N, and nobody
   * can outrank them by spending more.
   */
  const shareText = encodeURIComponent(
    `I just showed up for ${projectName} on famlove.lol — backer #${backerNumber}.\n\n` +
      `One cent. Capped at one per person per day, so nobody can outspend me.\n\n` +
      projectUrl,
  );

  return (
    <div className="relative">
      <Confetti />
      <div className="receipt-edge land rounded-lg bg-paper px-5 py-4 text-ink shadow-[0_18px_50px_-20px_rgba(255,61,104,0.55)]">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
        <span>famlove.lol</span>
        <span>Receipt · not a donation</span>
      </div>

      <div className="mt-3 flex items-baseline justify-between font-mono text-sm">
        <span>1 × LOVE</span>
        <span className="tabular">{formatCents(1)}</span>
      </div>
      <p className="font-mono text-xs text-ink/60">
        → {projectName} <span className="text-ink/40">@{ownerHandle}</span>
      </p>

      <div className="my-3 border-t border-dashed border-ink/25" />

      <dl className="space-y-1.5 font-mono text-xs">
        <Row label="Your cap today" value={`${DAILY_CAP_PER_PROJECT} / ${DAILY_CAP_PER_PROJECT}`} />
        <Row label="Given today" value={`${givenToday} / ${DAILY_GIVE_CEILING}`} />
        <Row label="Wallet after" value={`${balance}¢`} />
        <Row label="Signed" value={`@${viewerHandle}`} />
      </dl>

      <div className="my-3 border-t border-dashed border-ink/25" />

      <div className="flex items-baseline justify-between font-mono text-sm font-semibold">
        <span>TOTAL</span>
        <span className="tabular">{formatCents(1)}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/50">
            You are backer
          </p>
          <p className="tabular font-mono text-2xl font-semibold">#{backerNumber}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/50">
            Rank change
          </p>
          <p className="tabular font-mono text-2xl font-semibold">
            {moved ? (
              <>
                <span className="text-ink/40">#{previousRank}</span>
                <span className="mx-1 text-ink/40">→</span>
                <span className="text-love">#{rank}</span>
              </>
            ) : (
              <span>{rank ? `#${rank}` : "—"}</span>
            )}
          </p>
        </div>
      </div>

      <p className="mt-4 font-mono text-[11px] leading-relaxed text-ink/55">
        Your cent does not reach them. It buys your face on their wall.
        That is the entire product.
      </p>

      <a
        href={`https://x.com/intent/post?text=${shareText}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 block rounded-full bg-ink px-4 py-3 text-center font-mono text-xs font-semibold tracking-wide text-paper transition hover:bg-love"
      >
        Post that you showed up ↗
      </a>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink/55">{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}
