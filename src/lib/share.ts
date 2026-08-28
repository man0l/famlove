import { possessive } from "./mention";

/**
 * The posts a backer sends after showing up.
 *
 * There are two of them because the moment has two lives. The receipt is
 * transient — it exists for the seconds after the cent lands and is gone on
 * the next page load, and it knows exactly which number you were. The block
 * that replaces it is permanent for the rest of the day, and does not.
 *
 * They live together so the second one can't quietly become a worse version
 * of the first: the share is the whole distribution loop, and losing it when
 * the receipt goes is losing the loop.
 */
export function showedUpPost({
  subject,
  url,
  backerNumber,
}: {
  /** The project, already possessive'd with the owner's @-mention. */
  subject: string;
  url: string;
  /** Their place in today's wall, when the receipt still knows it. */
  backerNumber?: number;
}): string {
  const opener = backerNumber
    ? `I just showed up for ${subject} on famlove.lol — backer #${backerNumber}.`
    : `I showed up for ${subject} on famlove.lol today.`;
  return (
    `${opener}\n\n` +
    `One cent. Capped at one per person per day, so nobody can outspend me.\n\n` +
    url
  );
}

export { possessive };
