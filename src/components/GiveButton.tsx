"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Receipt } from "./Receipt";

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | {
      kind: "done";
      balance: number;
      givenToday: number;
      backersToday: number;
      rank: number | null;
      previousRank: number | null;
    }
  | { kind: "error"; message: string };

/**
 * The entire purchase flow, and the only button that matters. One cent, one
 * click, one receipt — and then it is spent for the day, on this project,
 * for this human, and no amount of clicking changes that.
 */
export function GiveButton({
  slug,
  projectName,
  ownerHandle,
  viewerHandle,
  viewerBalance,
  lovedToday,
  isOwner,
  signedIn,
  rank,
}: {
  slug: string;
  projectName: string;
  ownerHandle: string;
  viewerHandle: string | null;
  viewerBalance: number;
  lovedToday: boolean;
  isOwner: boolean;
  signedIn: boolean;
  rank: number | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <div>
        <a
          href="/join"
          className="btn-love block w-full px-5 py-4 text-center font-semibold"
        >
          Show up for this · 1¢
        </a>
        <p className="mt-2.5 text-center text-xs text-mute">
          Sign in with X first. One cent, capped at one a day — you literally
          cannot spend more here.
        </p>
      </div>
    );
  }

  if (isOwner) {
    return (
      <p className="rounded-2xl border border-dashed border-line px-5 py-4 text-center text-sm text-mute">
        This one&apos;s yours. You can&apos;t show up for yourself — that&apos;s
        rather the point.
      </p>
    );
  }

  if (state.kind === "done") {
    return (
      <Receipt
        projectName={projectName}
        ownerHandle={ownerHandle}
        viewerHandle={viewerHandle ?? "you"}
        balance={state.balance}
        givenToday={state.givenToday}
        backerNumber={state.backersToday}
        rank={state.rank}
        previousRank={state.previousRank}
      />
    );
  }

  if (lovedToday) {
    return (
      <div className="rounded-[26px] border border-love/40 bg-love/10 px-5 py-5 text-center">
        <p className="display text-lg text-love">You showed up today ♥</p>
        <p className="mt-1.5 text-sm text-mute">
          That&apos;s your one. Resets at 00:00 UTC — and no, you can&apos;t
          buy another.
        </p>
      </div>
    );
  }

  const send = () => {
    setState({ kind: "sending" });
    void (async () => {
      try {
        const res = await fetch("/api/love", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setState({
            kind: "error",
            message: data.message ?? "Couldn't do that.",
          });
          return;
        }
        setState({
          kind: "done",
          balance: data.balance,
          givenToday: data.givenToday,
          backersToday: data.backersToday,
          rank: data.rank,
          previousRank: rank,
        });
        startTransition(() => router.refresh());
      } catch {
        setState({ kind: "error", message: "Network hiccup. Try again." });
      }
    })();
  };

  return (
    <div>
      <button
        type="button"
        onClick={send}
        disabled={state.kind === "sending" || viewerBalance < 1}
        className="btn-love pulse-love w-full px-5 py-4 text-base font-semibold"
      >
        {state.kind === "sending"
          ? "…"
          : viewerBalance < 1
            ? "Your jar is empty"
            : "Show up for this · 1¢ ♥"}
      </button>

      {viewerBalance < 1 ? (
        <a
          href="/wallet"
          className="mt-2.5 block text-center text-xs font-medium text-mute underline underline-offset-4 transition hover:text-chalk"
        >
          Top up — $3 covers the next 300 →
        </a>
      ) : (
        <p className="mt-2.5 text-center text-xs text-mute">
          Leaves {viewerBalance - 1}¢ in your jar · refundable anytime
        </p>
      )}

      {state.kind === "error" && (
        <p className="mt-2 text-center text-xs text-love">{state.message}</p>
      )}
    </div>
  );
}
