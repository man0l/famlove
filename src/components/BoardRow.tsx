import Link from "next/link";
import { FaceRow } from "./Face";
import type { BoardEntry } from "@/lib/queries";

export function BoardRow({
  entry,
  metric,
  metricLabel,
}: {
  entry: BoardEntry;
  metric?: string;
  metricLabel?: string;
}) {
  return (
    <li className="group border-b border-line/60 transition hover:bg-ink-2">
      <Link href={`/p/${entry.slug}`} className="flex items-center gap-4 px-4 py-3.5">
        <span
          className={`tabular w-10 shrink-0 font-mono text-lg ${
            entry.rank <= 3 ? "text-love" : "text-mute"
          }`}
        >
          {entry.rank}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate font-medium">{entry.name}</span>
            <span className="shrink-0 font-mono text-[11px] text-mute">
              @{entry.ownerHandle}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-sm text-mute">
            {entry.tagline}
          </span>
        </span>

        <span className="hidden md:block">
          <FaceRow faces={entry.faces} size={26} max={8} />
        </span>

        <span className="w-20 shrink-0 text-right">
          <span className="tabular block font-mono text-lg">
            {metric ?? entry.backers}
          </span>
          <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-mute">
            {metricLabel ?? "backers"}
          </span>
        </span>
      </Link>
    </li>
  );
}
