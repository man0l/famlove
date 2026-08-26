import Link from "next/link";
import { Sticker } from "@/components/Sticker";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <Sticker name="receipt" size={96} float="slow" className="mx-auto" />
      <p className="display mt-4 text-5xl text-love">404</p>
      <p className="mt-4 text-mute">
        Nothing here. Nobody showed up for it either.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block font-semibold text-love"
      >
        Back to the board →
      </Link>
    </div>
  );
}
