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
      <a
        href="/join"
        className="block w-full rounded-xl bg-love px-5 py-3.5 text-center font-mono text-sm font-semibold text-white transition hover:brightness-110"
      >
        Sign in with X to give 1¢
      </a>
    );
  }

  if (isOwner) {
    return (
      <p className="rounded-xl border border-dashed border-line px-5 py-3.5 text-center font-mono text-xs text-mute">
        This one&apos;s yours. You can&apos;t show up for yourself.
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
      <div className="rounded-xl border border-love/40 bg-love/5 px-5 py-3.5 text-center">
        <p className="font-mono text-sm text-love">You showed up today. ♥</p>
        <p className="mt-1 font-mono text-xs text-mute">
          Your cap resets at 00:00 UTC. One per person, per project, per day.
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
        className="pulse-love w-full rounded-xl bg-love px-5 py-3.5 font-mono text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-love-dim disabled:opacity-70"
      >
        {state.kind === "sending"
          ? "…"
          : viewerBalance < 1
            ? "Your jar is empty"
            : "Give 1¢ ♥"}
      </button>

      {viewerBalance < 1 && (
        <a
          href="/wallet"
          className="mt-2 block text-center font-mono text-xs text-mute underline underline-offset-4 transition hover:text-chalk"
        >
          Top up →
        </a>
      )}

      {state.kind === "error" && (
        <p className="mt-2 text-center font-mono text-xs text-love">
          {state.message}
        </p>
      )}
    </div>
  );
}
