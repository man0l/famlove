"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";

/* A project with no published icon still gets a mark of its own. Two hues off
   the same hash rather than one flat chip: a board of flat colour squares is
   what this replaced, and it read as "nobody has bothered". */
const TILES: [string, string][] = [
  ["#7c5cff", "#4d2bd6"], ["#2fb8a6", "#127a6e"], ["#ff8a5c", "#d64f22"],
  ["#4d8cf0", "#2a5bc0"], ["#ff5c9d", "#c72a68"], ["#8fbf3f", "#5c8a17"],
  ["#f0a63f", "#c07414"], ["#3fb0d6", "#1a7ba0"], ["#b45cff", "#7a2ad6"],
  ["#35b978", "#158049"],
];

function tint(key: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return TILES[hash % TILES.length];
}

/**
 * A project's own icon on the board, falling back to a tinted initial.
 *
 * This is a client component for one reason: third-party favicons rot. A site
 * redesigns, the icon 404s, and a server-rendered <img> leaves a broken-image
 * glyph in every row it appears in. onError swaps to the tile the board drew
 * before favicons existed, so the worst case is the old design rather than a
 * visibly broken one.
 */
export function ProjectMark({
  favicon,
  name,
  size = 32,
  className = "",
}: {
  favicon: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const img = useRef<HTMLImageElement>(null);

  /*
   * onError alone is not enough.
   *
   * These rows are server-rendered, so the browser starts fetching the icon
   * from the raw HTML — often finishing, and failing, before React has
   * hydrated and attached any handler. The error event is gone by then and
   * the fallback never fires, which leaves exactly the broken-image glyph
   * this component exists to prevent. So on mount, ask the element how it
   * actually went: complete with no intrinsic width means it failed.
   */
  useEffect(() => {
    const el = img.current;
    if (el?.complete && el.naturalWidth === 0) setBroken(true);
  }, [favicon]);

  if (favicon && !broken) {
    return (
      <img
        ref={img}
        src={favicon}
        alt=""
        aria-hidden
        width={size}
        height={size}
        // Not lazy: a lazy image below the fold is not "complete" on mount,
        // so the check above would read every off-screen icon as fine and
        // the fallback would depend on scrolling.
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={`shrink-0 rounded-lg bg-white/5 object-contain ring-1 ring-white/10 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const [from, to] = tint(name);
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-lg font-semibold text-white ring-1 ring-white/10 ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(140deg, ${from}, ${to})`,
        fontSize: Math.max(10, size * 0.45),
      }}
    >
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}
