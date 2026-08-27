"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Receipt } from "./Receipt";
import { AutoLoveToggle } from "./AutoLoveToggle";

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
  projectUrl,
  autoLoves,
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
  projectUrl: string;
  autoLoves: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <div>
        <a
          href={`/join?next=${encodeURIComponent(`/p/${slug}`)}`}
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
        projectUrl={projectUrl}
        slug={slug}
        autoLoves={autoLoves}
      />
    );
  }

  if (lovedToday) {
    return (
      <div>
        <div className="rounded-[26px] border border-love/40 bg-love/10 px-5 py-5 text-center">
          <p className="display text-lg text-love">You showed up today ♥</p>
          <p className="mt-1.5 text-sm text-mute">
            That&apos;s your one. Resets at 00:00 UTC — and no, you can&apos;t
            buy another.
          </p>
        </div>
        <div className="mt-3">
          <AutoLoveToggle
            slug={slug}
            projectName={projectName}
            initial={autoLoves}
            centsLeft={viewerBalance}
            compact
          />
        </div>
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

  /*
   * An empty jar used to render a disabled grey button reading "Your jar is
   * empty", with the only way forward as a small underlined link beneath it.
   * That puts a dead control where the primary action belongs and hides the
   * live one. When there is nothing to spend, topping up *is* the action.
   */
  if (viewerBalance < 1) {
    return (
      <div>
        <a
          href="/wallet"
          className="btn-love block w-full px-5 py-4 text-center text-base font-semibold"
        >
          Get cents to show up →
        </a>
        <p className="mt-2.5 text-center text-xs text-mute">
          Your jar is empty. $3 covers the next 300 people.
        </p>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={send}
        disabled={state.kind === "sending"}
        className="btn-love pulse-love w-full px-5 py-4 text-base font-semibold"
      >
        {state.kind === "sending" ? "…" : "Show up for this · 1¢ ♥"}
      </button>

      <p className="mt-2.5 text-center text-xs text-mute">
        Leaves {viewerBalance - 1}¢ in your jar · refundable anytime
      </p>

      {state.kind === "error" && (
        <p className="mt-2 text-center text-xs text-love">{state.message}</p>
      )}
    </div>
  );
}
