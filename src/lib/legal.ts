/**
 * Who the buyer is actually contracting with.
 *
 * EU consumer law requires a trader selling online to identify itself
 * properly — legal name, registered address, company number, VAT number and a
 * working contact address — before the sale, not somewhere in a footer. These
 * come from the environment so the deployed entity is the one named on the
 * page, and `npm run golive` refuses to pass while any of them is missing.
 */
export const LEGAL = {
  entity: process.env.LEGAL_ENTITY ?? "",
  companyNumber: process.env.LEGAL_COMPANY_NUMBER ?? "",
  vatNumber: process.env.LEGAL_VAT_NUMBER ?? "",
  address: process.env.LEGAL_ADDRESS ?? "",
  country: process.env.LEGAL_COUNTRY ?? "Bulgaria",
  email: process.env.LEGAL_EMAIL ?? "hello@famlove.lol",
  /** Kept in one place so both legal pages carry the same date. */
  updated: process.env.LEGAL_UPDATED ?? "2026-08-26",
} as const;

/** "Pazaruvai Umno Ltd." mid-sentence, without ending up as "Ltd..". */
export function entityInSentence(): string {
  return (LEGAL.entity || "the operator of famlove.lol").replace(/\.$/, "");
}
