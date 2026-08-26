/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

const TILES = [
  "#3b2d4a", "#1f3b3a", "#432a24", "#23324d", "#3d2233",
  "#2b3a22", "#4a3520", "#243f4a", "#3a2440", "#1e3a2e",
];

function tint(handle: string): string {
  let hash = 0;
  for (let i = 0; i < handle.length; i += 1) {
    hash = (hash * 31 + handle.charCodeAt(i)) >>> 0;
  }
  return TILES[hash % TILES.length];
}

export function initials(handle: string): string {
  const clean = handle.replace(/[^a-zA-Z0-9]/g, "");
  return (clean.slice(0, 2) || "??").toUpperCase();
}

/**
 * One face on a wall. Every one of these is a real X account that spent a
 * cent, which is why it links out by default — except inside a row that is
 * already a link, where `linked={false}` keeps the markup legal.
 */
export function Face({
  handle,
  avatarUrl,
  size = 40,
  landing = false,
  linked = true,
}: {
  handle: string;
  avatarUrl?: string | null;
  size?: number;
  landing?: boolean;
  linked?: boolean;
}) {
  const inner = avatarUrl ? (
    <img
      src={avatarUrl}
      alt={`@${handle}`}
      width={size}
      height={size}
      loading="lazy"
      className="h-full w-full rounded-full object-cover ring-1 ring-white/10 transition group-hover:ring-love"
    />
  ) : (
    <span
      className="flex h-full w-full items-center justify-center rounded-full font-mono font-medium tracking-tight text-chalk/80 ring-1 ring-white/10 transition group-hover:ring-love"
      style={{ background: tint(handle), fontSize: Math.max(9, size * 0.32) }}
    >
      {initials(handle)}
    </span>
  );

  const className = `group relative block shrink-0 ${landing ? "land" : ""}`;
  const style = { width: size, height: size };

  if (!linked) {
    return (
      <span className={className} style={style} title={`@${handle}`}>
        {inner}
      </span>
    );
  }

  return (
    <Link href={`/u/${handle}`} title={`@${handle}`} className={className} style={style}>
      {inner}
    </Link>
  );
}

/** A huddle of overlapping faces. Renders inline so it can sit inside a link. */
export function FaceRow({
  faces,
  size = 30,
  max = 12,
  linked = false,
}: {
  faces: { handle: string; avatarUrl: string | null }[];
  size?: number;
  max?: number;
  linked?: boolean;
}) {
  const shown = faces.slice(0, max);
  const rest = faces.length - shown.length;
  return (
    <span className="inline-flex items-center align-middle">
      {shown.map((f, i) => (
        <span
          key={f.handle}
          className="inline-block"
          style={{ marginLeft: i === 0 ? 0 : -size * 0.28 }}
        >
          <Face handle={f.handle} avatarUrl={f.avatarUrl} size={size} linked={linked} />
        </span>
      ))}
      {rest > 0 && (
        <span className="ml-2 font-mono text-xs text-mute tabular" aria-label={`${rest} more`}>
          +{rest}
        </span>
      )}
    </span>
  );
}
