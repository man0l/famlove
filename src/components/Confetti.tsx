"use client";

import { useEffect, useRef } from "react";

/**
 * A cent's worth of celebration.
 *
 * Hand-rolled rather than pulled from npm: this needs about sixty lines, and
 * a confetti dependency would be larger than the entire client bundle it
 * decorates. Draws to a canvas over the receipt, then removes itself.
 *
 * It fires exactly once, when somebody spends a cent — the one moment in this
 * product worth marking.
 */
const COLOURS = ["#ff3d68", "#c8ff4d", "#6aa8ff", "#ffd166", "#ffffff"];

type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  size: number;
  colour: string;
};

export function Confetti({ pieces = 90 }: { pieces?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    // Anyone who has asked their system to calm down gets no confetti.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const confetti: Piece[] = Array.from({ length: pieces }, () => ({
      x: rect.width / 2 + (Math.random() - 0.5) * rect.width * 0.5,
      y: rect.height * 0.42,
      vx: (Math.random() - 0.5) * 7,
      vy: -Math.random() * 9 - 3,
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      size: 4 + Math.random() * 6,
      colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
    }));

    let frame = 0;
    let raf = 0;
    const TOTAL = 110;

    const tick = () => {
      frame += 1;
      ctx.clearRect(0, 0, rect.width, rect.height);
      const fade = Math.max(0, 1 - frame / TOTAL);

      for (const p of confetti) {
        p.vy += 0.32;         // gravity
        p.vx *= 0.99;         // drag
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.spin;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.colour;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }

      if (frame < TOTAL) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, rect.width, rect.height);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pieces]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
    />
  );
}
