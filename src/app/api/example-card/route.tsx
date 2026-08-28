import { exampleCard } from "@/lib/example-card";

export const dynamic = "force-dynamic";

/** The homepage's own <img>. The drawing lives in lib so the og:image
 *  version cannot drift from the one people see on the page. */
export async function GET() {
  return exampleCard();
}
