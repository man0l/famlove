"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useRef, useState } from "react";
import { ProjectMark } from "./ProjectMark";

type Meta = {
  title: string | null;
  description: string | null;
  image: string | null;
  favicon: string | null;
  resolved: string;
};

/** Mirrors normalizeUrl on the server so "slashloop.dev" is a valid answer. */
function withScheme(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    return url.hostname.includes(".") ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * The listing form, filled in from the site being listed.
 *
 * A builder has already written their name, their description and drawn their
 * icon — on their own site. Asking them to retype it into a 90-character box
 * gets a worse answer than reading what they published, so the URL goes first
 * and everything under it arrives already filled in.
 *
 * Filled in, not decided: every field stays editable, the preview shows
 * exactly the row the board will draw, and a field the person has touched is
 * never overwritten by a later fetch. Metadata is a first draft written by
 * their own site, and they get the last word on it.
 */
export function NewProjectForm({ error }: { error?: string }) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [favicon, setFavicon] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "reading" | "done" | "failed">("idle");
  const [showArt, setShowArt] = useState(false);

  // Which fields the person has typed into themselves. A fetch fills blanks
  // and fields it filled before; it never argues with a human.
  const touched = useRef({ name: false, tagline: false });
  const lastRead = useRef<string | null>(null);

  const read = useCallback(async (raw: string) => {
    const target = withScheme(raw);
    if (!target || target === lastRead.current) return;
    lastRead.current = target;
    setState("reading");
    try {
      const res = await fetch(`/api/metadata?url=${encodeURIComponent(target)}`);
      const json = (await res.json()) as { ok: boolean; meta?: Meta };
      if (!json.ok || !json.meta) {
        setState("failed");
        return;
      }
      const meta = json.meta;
      if (meta.title && !touched.current.name) setName(meta.title.slice(0, 60));
      if (meta.description && !touched.current.tagline) {
        setTagline(meta.description.slice(0, 90));
      }
      setFavicon(meta.favicon);
      setImage(meta.image);
      setState("done");
    } catch {
      setState("failed");
    }
  }, []);

  const host = withScheme(url) ? new URL(withScheme(url)!).hostname : null;

  return (
    <form action="/api/projects" method="post" className="mt-7 space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-mute">
          URL <span className="text-love">— start here</span>
        </span>
        <input
          name="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={(e) => read(e.target.value)}
          onKeyDown={(e) => {
            // Enter in the URL box should read the site, not submit a form
            // that is still mostly empty.
            if (e.key === "Enter") {
              e.preventDefault();
              read(url);
            }
          }}
          placeholder="slashloop.dev"
          autoFocus
          required
          className="mt-1.5 w-full rounded-2xl border border-line bg-ink px-4 py-3 outline-none transition focus:border-love"
        />
      </label>

      {state === "reading" && (
        <p className="text-sm text-mute">Reading {host}…</p>
      )}
      {state === "failed" && (
        <p className="text-sm text-mute">
          Couldn&apos;t read that site — no problem, fill the two boxes below
          yourself.
        </p>
      )}

      {/* The row the board will draw, shown before it is drawn. */}
      {(state === "done" || name || tagline) && (
        <div className="rounded-2xl border border-line bg-ink-2 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-mute">
            How it looks on the board
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-love text-base font-semibold text-white">
              1
            </span>
            <ProjectMark favicon={favicon} name={name || "?"} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">
                {name || "Your project"}
              </span>
              <span className="mt-0.5 block truncate text-sm text-mute">
                {tagline || "Its one-line description"}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-xl font-semibold tabular-nums">0</span>
              <span className="block text-[11px] text-mute">showed up</span>
            </span>
          </div>
        </div>
      )}

      <label className="block">
        <span className="text-sm font-medium text-mute">Name</span>
        <input
          name="name"
          value={name}
          onChange={(e) => {
            touched.current.name = true;
            setName(e.target.value);
          }}
          placeholder="slashloop"
          maxLength={60}
          required
          className="mt-1.5 w-full rounded-2xl border border-line bg-ink px-4 py-3 outline-none transition focus:border-love"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-mute">
          Tagline{" "}
          <span className="text-mute/70">{tagline.length}/90</span>
        </span>
        <input
          name="tagline"
          value={tagline}
          onChange={(e) => {
            touched.current.tagline = true;
            setTagline(e.target.value);
          }}
          placeholder="Viral video tracker — finds outliers before they peak"
          maxLength={90}
          className="mt-1.5 w-full rounded-2xl border border-line bg-ink px-4 py-3 outline-none transition focus:border-love"
        />
      </label>

      {/* Whatever the site published, editable, and never a blocker. */}
      <input type="hidden" name="favicon_url" value={favicon ?? ""} />
      <input type="hidden" name="image_url" value={image ?? ""} />

      {(favicon || image || state === "done") && (
        <div className="rounded-2xl border border-line p-4">
          <button
            type="button"
            onClick={() => setShowArt((v) => !v)}
            className="flex w-full items-center justify-between text-sm text-mute transition hover:text-chalk"
          >
            <span className="flex items-center gap-2">
              <ProjectMark favicon={favicon} name={name || "?"} size={20} />
              {favicon ? "Icon and share image from your site" : "No icon found"}
            </span>
            <span>{showArt ? "Hide" : "Change"}</span>
          </button>

          {showArt && (
            <div className="mt-4 space-y-3">
              <Art label="Icon URL" value={favicon} onChange={setFavicon} />
              <Art label="Share image URL" value={image} onChange={setImage} />
              {image && (
                <img
                  src={image}
                  alt=""
                  className="max-h-40 w-full rounded-xl object-cover"
                  onError={() => setImage(null)}
                />
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-2xl border border-love/40 bg-love/10 px-4 py-3 text-sm text-love-soft">
          {error}
        </p>
      )}

      <button type="submit" className="btn-love w-full px-5 py-4 font-semibold">
        Put it on the board
      </button>
    </form>
  );
}

function Art({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-mute">{label}</span>
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value.trim() || null)}
        placeholder="https://…"
        className="mt-1 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm outline-none transition focus:border-love"
      />
    </label>
  );
}
