import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import "./globals.css";
import { DAILY_GIVE_CEILING, SITE_URL } from "@/lib/config";
import { currentUser } from "@/lib/session";
import { givenToday } from "@/lib/queries";
import { sql } from "@/lib/db";
import { Sticker } from "@/components/Sticker";
import { ConsentBanner } from "@/components/ConsentBanner";
import { siteTraffic } from "@/lib/datafast";
import { plural } from "@/lib/time";

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
    default: "famlove.lol — list free, get on the board",
    template: "%s · famlove.lol",
  },
  description: "List free. Get on the board — not a $17,000 outbid bid.",
  openGraph: { siteName: "famlove.lol", type: "website", url: SITE_URL },
  twitter: { card: "summary_large_image" },
};

async function Header() {
  const user = await currentUser();
  const given = user ? await givenToday(user.id) : 0;

  /*
   * A builder who lists a project then browses away had no way back to it:
   * the wall lived at a slug they never typed, linked from nowhere. It goes
   * in the header, because "where is my thing" is a question the top of the
   * page should always answer.
   */
  const mine = user
    ? ((await sql`
        SELECT slug FROM projects
        WHERE owner_id = ${user.id} AND removed_at IS NULL
        ORDER BY id
      `) as { slug: string }[])
    : [];

  // One project links straight to its wall; several link to the profile,
  // which is the only page that lists them all.
  const wallsHref =
    mine.length === 1 ? `/p/${mine[0].slug}` : `/u/${user?.handle ?? ""}`;
  const wallsLabel = mine.length === 1 ? "Your wall" : "Your walls";

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
            {mine.length > 0 && (
              <NavLink href={wallsHref}>
                <span className="text-love">{wallsLabel}</span>
              </NavLink>
            )}
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
                <form action="/api/auth/logout" method="post">
                  <button
                    type="submit"
                    className="whitespace-nowrap rounded-full border border-line px-2.5 py-1.5 text-xs text-mute transition hover:border-line-2 hover:text-chalk sm:px-3 sm:text-sm"
                  >
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <Link href="/new" className="btn-love px-4 py-2 text-sm font-semibold">
                List your SaaS
              </Link>
            )}
          </div>
        </div>

        <nav className="-mx-1 flex items-center gap-1 overflow-x-auto pb-2 text-sm font-medium text-mute sm:hidden">
          <NavLink href="/">Loved</NavLink>
          <NavLink href="/rising">Rising</NavLink>
          <NavLink href="/givers">Givers</NavLink>
          {mine.length > 0 ? (
            <NavLink href={wallsHref}>
              <span className="text-love">{wallsLabel}</span>
            </NavLink>
          ) : (
            <NavLink href="/cents">Cents</NavLink>
          )}
          {user && (
            <>
              {/* "You" rather than the handle: a long one pushes Sign out past
                  the right edge, behind a horizontal scroll nobody guesses at. */}
              <NavLink href={`/u/${user.handle}`}>You</NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="whitespace-nowrap rounded-full px-2.5 py-1.5 transition hover:bg-ink-2 hover:text-chalk sm:px-3"
    >
      {children}
    </Link>
  );
}

/** The public DataFast dashboard — the numbers are checkable there. */
const STATS_URL = "https://datafa.st/share/6a91807d731087339eee56a4";

/**
 * Live traffic, stated plainly and linked to the dashboard that proves it.
 *
 * A pill above the fold rather than a line in the footer, because it is
 * doing the same job as the rest of the page: this product's argument is
 * that a number you can go and check beats a number you are told, and a
 * claim about traffic buried under the terms links is a claim nobody
 * checks.
 *
 * Zeroes are omitted rather than printed. "0 online · 0 visitors" reads
 * worse than silence on a site that opened this week, so the counts appear
 * as they earn themselves while the link is there from the start.
 */
async function TrafficPill() {
  const traffic = await siteTraffic();
  if (!traffic) return null;

  const n = (value: number) => value.toLocaleString("en-US");

  return (
    <div className="flex justify-center px-4 pt-6">
      <div className="inline-flex items-center gap-2 rounded-full border border-line bg-ink-2/70 px-4 py-1.5 text-sm text-mute">
        {traffic.online > 0 && (
          <>
            <span
              aria-hidden
              className="h-2 w-2 rounded-full bg-lime shadow-[0_0_8px_var(--color-lime)]"
            />
            <span className="font-medium text-lime">{n(traffic.online)} online</span>
            <span className="text-line">·</span>
          </>
        )}
        {traffic.visitors > 0 && (
          <>
            <span>{plural(traffic.visitors, "visitor")}</span>
            <span className="text-line">·</span>
          </>
        )}
        <a
          href={STATS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="transition hover:text-chalk"
        >
          see stats →
        </a>
      </div>
    </div>
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

/**
 * Google Analytics.
 *
 * afterInteractive, not beforeInteractive: nothing on the page waits on it,
 * and a measurement script has no business competing with the wall for the
 * first paint.
 *
 * Consent Mode defaults to denied for a first visit — ePrivacy requires that
 * an analytics cookie is not set until the visitor says so. Returning visitors
 * who already pressed Allow are different: the default has to come up granted
 * *before* gtag('config'), or the landing page_view goes out as a cookieless
 * ping (gcs=G100). On a small property those pings are not written into the
 * regular reports (modelling needs ~1,000 consented users a day), so every
 * X-ad click that had already consented still looked like it never arrived.
 *
 * The unread/denied case still sends the cookieless ping, which is lawful
 * without a cookie. ConsentBanner is what flips storage to granted on Allow
 * and sends a real page_view for that first yes.
 */
function Analytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  if (!id) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
var analyticsStorage = 'denied';
try {
  if (localStorage.getItem('famlove.consent') === 'granted') analyticsStorage = 'granted';
} catch (e) {}
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: analyticsStorage
});
gtag('js', new Date());
gtag('config', '${id}', { anonymize_ip: true });`}
      </Script>
    </>
  );
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${bricolage.variable} ${inter.variable}`}>
      <body className="min-h-dvh">
        <Header />
        <TrafficPill />
        <main>{children}</main>
        <Footer />
        <Analytics />
        <ConsentBanner />
      </body>
    </html>
  );
}
