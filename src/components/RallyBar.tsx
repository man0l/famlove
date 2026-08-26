"use client";

import { useEffect, useState } from "react";
import { countdown } from "@/lib/time";

/**
 * The substitute for outbid's "$14,013 → $17,000" moment. Every vote here is
 * a cent, so there is no escalation to screenshot — unless you manufacture
 * one: a stated goal, a hard deadline, and faces landing in real time.
 */
export function RallyBar({
  goal,
  progress,
  endsAt,
}: {
  goal: number;
  progress: number;
  endsAt: string;
}) {
  const end = new Date(endsAt).getTime();

  /*
   * `null` until mounted, on purpose. Seeding this from Date.now() during
   * render makes the server and the browser disagree by however long the
   * response took, which React reports as a hydration mismatch — and a clock
   * is the one thing a server has no business rendering.
   */
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setRemaining(end - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [end]);

  const pct = Math.min(100, Math.round((progress / goal) * 100));
  const hit = progress >= goal;

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between">
        <span className="display text-lg">Rally to {goal}</span>
        <span
          className={`tabular text-sm ${hit ? "text-butter" : "text-mute"}`}
        >
          {remaining === null
            ? "\u00a0"
            : remaining > 0
              ? countdown(remaining)
              : "closed"}
        </span>
      </div>

      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-ink-3">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${
            hit ? "bg-butter" : "bg-love"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="tabular mt-2.5 text-sm">
        <span className={hit ? "text-butter" : "text-chalk"}>{progress}</span>
        <span className="text-mute"> of {goal} showed up</span>
        {hit && <span className="ml-2 text-butter">goal hit ♥</span>}
      </p>
    </div>
  );
}
