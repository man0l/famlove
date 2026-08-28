import { XIcon } from "./XIcon";

/** One place the intent URL is built, so a share can't be added somewhere
 *  that forgets to encode it or opens in the same tab. */
export function ShareOnX({
  text,
  label,
  className,
}: {
  text: string;
  label: string;
  className: string;
}) {
  return (
    <a
      href={`https://x.com/intent/post?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      <XIcon size={13} />
      {label}
    </a>
  );
}
