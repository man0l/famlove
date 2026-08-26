import type { Metadata } from "next";
import Link from "next/link";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import "./globals.css";
import { DAILY_GIVE_CEILING, SITE_URL } from "@/lib/config";
import { currentUser } from "@/lib/session";
import { givenToday } from "@/lib/queries";
import { Sticker } from "@/components/Sticker";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "famlove.lol — you can't buy the top",
    template: "%s · famlove.lol",
  },
  description:
    "Rank is not dollars. It's how many separate humans spent one cent on you today. 1¢ per person, per project, per day. Hard cap, no stacking, no whales.",
  openGraph: { siteName: "famlove.lol", type: "website", url: SITE_URL },
  twitter: { card: "summary_large_image" },
};

async function Header() {
  const user = await currentUser();
  const given = user ? await givenToday(user.id) : 0;

  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-ink/75 backdrop-blur-xl">
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex h-16 items-center gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-1.5">
            <Sticker name="heart" size={22} />
            <span className="display text-lg">
              famlove<span className="text-love">.lol</span>
            </span>
          </Link>

          {/* On phones the nav gets its own row — three links, a wallet chip
              and a handle do not fit on one line at 390px, and a clipped
              balance is a worse first impression than an extra row. */}
          <nav className="ml-2 hidden items-center gap-1 text-sm font-medium text-mute sm:flex">
            <NavLink href="/">Loved</NavLink>
            <NavLink href="/rising">Rising</NavLink>
            <NavLink href="/givers">Givers</NavLink>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {user ? (
              <>
                <Link
                  href="/wallet"
                  title={`${given} of ${DAILY_GIVE_CEILING} given today`}
                  className="flex items-center gap-1.5 rounded-full border border-line bg-ink-2 px-3 py-1.5 text-sm transition hover:border-line-2"
                >
                  <Sticker name="penny" size={16} />
                  <span className="tabular font-semibold">{user.centsBalance}</span>
                  <span className="text-mute">¢</span>
                </Link>
                <Link
                  href={`/u/${user.handle}`}
                  className="hidden text-sm text-mute transition hover:text-chalk sm:block"
                >
                  @{user.handle}
                </Link>
              </>
            ) : (
              <Link href="/join" className="btn-love px-4 py-2 text-sm font-semibold">
                Get cents
              </Link>
            )}
          </div>
        </div>

        <nav className="-mx-1 flex items-center gap-1 pb-2 text-sm font-medium text-mute sm:hidden">
          <NavLink href="/">Loved</NavLink>
          <NavLink href="/rising">Rising</NavLink>
          <NavLink href="/givers">Givers</NavLink>
          <NavLink href="/cents">Cents</NavLink>
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full px-2.5 py-1.5 transition hover:bg-ink-2 hover:text-chalk sm:px-3"
    >
      {children}
    </Link>
  );
}

function Footer() {
  return (
    <footer className="mt-24 border-t border-line/60">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center">
        <p className="max-w-sm text-sm text-mute">
          Your cent does not reach them. It buys your face on their wall.
          That is the entire product.
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-mute sm:ml-auto">
          <Link href="/cents" className="transition hover:text-chalk">
            Where the cents go
          </Link>
          <Link href="/legal/terms" className="transition hover:text-chalk">
            Terms
          </Link>
          <Link href="/legal/privacy" className="transition hover:text-chalk">
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${bricolage.variable} ${inter.variable}`}>
      <body className="min-h-dvh">
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
