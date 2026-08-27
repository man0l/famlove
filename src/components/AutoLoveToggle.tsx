"use client";

import { useState } from "react";

/**
 * "Keep showing up for this one."
 *
 * A standing order changes nothing about the rules — still one cent, still
 * one per project per UTC day, still under the 60-a-day ceiling, still
 * impossible to buy rank with. What it changes is what a face on a wall
 * means, so the copy says plainly that it is automatic and exactly when it
 * stops: when the jar runs out.
 */
export function AutoLoveToggle({
  slug,
  projectName,
  initial,
  centsLeft,
  compact = false,
}: {
  slug: string;
  projectName: string;
  initial: boolean;
  centsLeft: number;
  compact?: boolean;
}) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    const next = !on;
    setOn(next);            // optimistic: this is a preference, not a payment
    setBusy(true);
    try {
      const res = await fetch("/api/autolove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, on: next }),
      });
      if (!res.ok) setOn(!next);
    } catch {
      setOn(!next);
    } finally {
      setBusy(false);
    }
  };

  const days = Math.max(0, centsLeft);

  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
        on
          ? "border-lime/50 bg-lime/10"
          : compact
            ? "border-line bg-ink-2/60 hover:border-line-2"
            : "border-ink/15 bg-ink/5 hover:border-ink/30"
      }`}
    >
      <input
        type="checkbox"
        checked={on}
        onChange={toggle}
        disabled={busy}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#c8ff4d]"
      />
      <span className="min-w-0">
        <span
          className={`block text-sm font-medium ${
            on ? "text-lime" : compact ? "text-chalk" : "text-ink"
          }`}
        >
          Show up for {projectName} every day
        </span>
        <span
          className={`mt-0.5 block text-xs leading-relaxed ${
            compact || on ? "text-mute" : "text-ink/55"
          }`}
        >
          {on
            ? `On. One cent a day, automatically — about ${days} days left in your jar. Untick any time.`
            : "One cent a day, automatically, until your jar runs out."}
        </span>
      </span>
    </label>
  );
}
