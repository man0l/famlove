/**
 * Who the buyer is actually contracting with.
 *
 * EU consumer law requires a trader selling online to identify itself before
 * the sale — legal name, registered address, company number and a working
 * contact address. These are constants rather than configuration on purpose:
 * the selling entity is a fact about this deployment, not a knob, and a
 * missing environment variable must never be able to publish terms with a
 * blank where the seller's name goes.
 *
 * Taken from the entity's published legal pages at balkanbit.app, which is the
 * same company. No VAT number is published, so none is claimed here.
 */
export const LEGAL = {
  /** As written on the company's own legal pages. */
  entity: '"Pazaruvai Umno" EOOD',
  entityLocal: "„ПАЗАРУВАЙ УМНО“ ЕООД",
  /** Unified Identification Code (UIC / ЕИК). */
  uic: "206373314",
  address:
    "Sofia 1343, Lyulin 2, bl. 235, vh. V, et. 2, ap. 81",
  country: "Republic of Bulgaria",
  countryShort: "Bulgaria",
  email: "manol@balkanbit.app",
  /** The venture studio the product is built and operated through. */
  studio: "BalkanBit",
  updated: "2026-08-26",

  /** Where an EU data subject complains if we get it wrong. */
  dpa: {
    name: "Commission for Personal Data Protection",
    address: "2 Prof. Tsvetan Lazarov Blvd., 1592 Sofia, Bulgaria",
    email: "kzld@cpdp.bg",
    url: "https://cpdp.bg",
  },
} as const;
