import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="font-mono text-5xl text-love">404</p>
      <p className="mt-4 text-mute">
        Nothing here. Nobody showed up for it either.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block font-mono text-sm text-chalk underline underline-offset-4"
      >
        Back to the board →
      </Link>
    </div>
  );
}
