import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SITE_URL } from "@/lib/config";
import { currentUser } from "@/lib/session";
import { givenToday } from "@/lib/queries";
import { DAILY_GIVE_CEILING } from "@/lib/config";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "famlove.lol — you can't buy the top",
    template: "%s · famlove.lol",
  },
  description:
    "Rank is not dollars. It's how many separate humans spent one cent on you today. 1¢ per person, per project, per day. Hard cap, no stacking, no whales.",
  openGraph: {
    siteName: "famlove.lol",
    type: "website",
    url: SITE_URL,
  },
  twitter: { card: "summary_large_image" },
};

async function Header() {
  const user = await currentUser();
  const given = user ? await givenToday(user.id) : 0;

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-ink/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-5 px-4">
        <Link href="/" className="font-mono text-sm font-semibold tracking-tight">
          famlove<span className="text-love">.lol</span>
        </Link>

        <nav className="flex items-center gap-4 font-mono text-xs uppercase tracking-[0.14em] text-mute">
          <Link href="/" className="transition hover:text-chalk">Loved</Link>
          <Link href="/rising" className="transition hover:text-chalk">Rising</Link>
          <Link href="/givers" className="transition hover:text-chalk">Givers</Link>
          <Link href="/cents" className="hidden transition hover:text-chalk sm:block">Cents</Link>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/wallet"
                className="font-mono text-xs text-mute transition hover:text-chalk"
                title={`${given} of ${DAILY_GIVE_CEILING} loves given today`}
              >
                <span className="tabular text-chalk">{user.centsBalance}</span>¢
                <span className="mx-1.5 text-line">·</span>
                <span className="tabular">{given}</span>/{DAILY_GIVE_CEILING}
              </Link>
              <Link
                href={`/u/${user.handle}`}
                className="font-mono text-xs text-chalk transition hover:text-love"
              >
                @{user.handle}
              </Link>
            </>
          ) : (
            <Link
              href="/join"
              className="rounded-full bg-love px-3.5 py-1.5 font-mono text-xs font-semibold text-white transition hover:brightness-110"
            >
              Get cents
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-20 border-t border-line/70">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 font-mono text-xs text-mute sm:flex-row sm:items-center">
        <p>
          Your cent does not reach them. It buys your face on their wall.
        </p>
        <div className="flex gap-4 sm:ml-auto">
          <Link href="/cents" className="transition hover:text-chalk">Where the cents go</Link>
          <Link href="/legal/terms" className="transition hover:text-chalk">Terms</Link>
          <Link href="/legal/privacy" className="transition hover:text-chalk">Privacy</Link>
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
