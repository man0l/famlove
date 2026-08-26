/* eslint-disable @next/next/no-img-element */

/**
 * The generated art, used the only way generated art should be used here:
 * decoration that carries no information. Every sticker is `aria-hidden`,
 * because a screen reader gaining nothing from "puffy heart" is the correct
 * outcome — the sentence next to it already says what's happening.
 */
export type StickerName =
  | "penny"
  | "heart"
  | "receipt"
  | "sparkle"
  | "hands";

export function Sticker({
  name,
  size = 72,
  className = "",
  float,
}: {
  name: StickerName;
  size?: number;
  className?: string;
  float?: "slow" | "slower";
}) {
  const animation =
    float === "slow" ? "float-slow" : float === "slower" ? "float-slower" : "";

  return (
    <img
      src={`/stickers/${name}.webp`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      draggable={false}
      className={`sticker pointer-events-none select-none ${animation} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
