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
  const podium = entry.rank <= 3;

  return (
    <li className="border-b border-line/50 last:border-0">
      <Link
        href={`/p/${entry.slug}`}
        className="flex items-center gap-3 px-3 py-3 transition hover:bg-ink-2/80 sm:gap-4 sm:px-5"
      >
        <span
          className={`tabular display grid h-9 w-9 shrink-0 place-items-center rounded-full text-base ${
            podium
              ? "bg-love text-white"
              : "border border-line bg-ink-2 text-mute"
          }`}
        >
          {entry.rank}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate font-semibold">{entry.name}</span>
            <span className="shrink-0 text-xs text-mute">
              @{entry.ownerHandle}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-sm text-mute">
            {entry.tagline}
          </span>
        </span>

        <span className="hidden md:block">
          <FaceRow faces={entry.faces} size={28} max={8} />
        </span>

        <span className="w-16 shrink-0 text-right sm:w-20">
          <span className="tabular display block text-xl">
            {metric ?? entry.backers}
          </span>
          <span className="block text-[11px] text-mute">
            {metricLabel ?? "showed up"}
          </span>
        </span>
      </Link>
    </li>
  );
}
