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
  const [remaining, setRemaining] = useState(() => end - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemaining(end - Date.now()), 1000);
    return () => clearInterval(id);
  }, [end]);

  const pct = Math.min(100, Math.round((progress / goal) * 100));
  const hit = progress >= goal;

  return (
    <div className="rounded-xl border border-line bg-ink-2 p-4">
      <div className="flex items-baseline justify-between font-mono text-xs">
        <span className="uppercase tracking-[0.16em] text-mute">
          Rally: {goal} by deadline
        </span>
        <span className={hit ? "text-gold" : "text-mute"}>
          {remaining > 0 ? countdown(remaining) : "closed"}
        </span>
      </div>

      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${hit ? "bg-gold" : "bg-love"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="tabular mt-2 font-mono text-sm">
        <span className={hit ? "text-gold" : "text-chalk"}>{progress}</span>
        <span className="text-mute"> / {goal}</span>
        {hit && <span className="ml-2 text-gold">goal hit ♥</span>}
      </p>
    </div>
  );
}
