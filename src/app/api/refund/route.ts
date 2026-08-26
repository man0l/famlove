import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { refundUnspent } from "@/lib/payments";

/**
 * "Unspent balance refunded in full, on request, no questions." One route,
 * one support macro, and the reason the /cents page can stay short.
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { refundedCents } = await refundUnspent(user.id);
  return NextResponse.redirect(
    new URL(`/wallet?refunded=${refundedCents}`, request.nextUrl.origin),
    { status: 303 },
  );
}
