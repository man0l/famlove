import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12 text-sm leading-relaxed text-mute">
      <h1 className="display text-4xl text-chalk">Privacy</h1>

      <Section title="What we store">
        From X: your account id, handle, display name, avatar URL, account
        creation date. From payments: a card fingerprint, brand, last four
        digits, funding type and country — never a full card number, which
        famlove never sees. From you: an email address, only if you type one in.
      </Section>

      <Section title="What is public">
        Your handle, avatar, which projects you backed and when, your totals
        given and received, and your streak. Everything else is not.
      </Section>

      <Section title="Why the card fingerprint">
        It is the only thing that makes one human cost one card. It is stored
        hashed by the payment processor and given to us as an opaque string; it
        cannot be turned back into a card number.
      </Section>

      <Section title="Email">
        One kind of email exists: a daily note listing who showed up for your
        project. Leave the field blank and you get none.
      </Section>

      <Section title="Deletion">
        Ask and your account, wallet and email are deleted and your unspent
        balance refunded. Cents you gave stay on the walls they bought, shown
        against a removed account.
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="display text-xl text-chalk">{title}</h2>
      <p className="mt-2">{children}</p>
    </section>
  );
}
