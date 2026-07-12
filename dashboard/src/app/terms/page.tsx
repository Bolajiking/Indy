import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Sandbox beta"
      title="Terms of use"
      updated="July 12, 2026"
    >
      <LegalSection title="Beta service">
        <p>
          Indyfren is an experimental sandbox-beta service for independent
          creators. Features may change, be unavailable, or be withdrawn while
          we evaluate safety and reliability.
        </p>
      </LegalSection>
      <LegalSection title="Your responsibility">
        <p>
          You are responsible for the information you submit, the accounts you
          connect, and every action you approve. Review generated pitches, deal
          guidance, and connected-app previews before acting.
        </p>
      </LegalSection>
      <LegalSection title="Important limitations">
        <p>
          Indyfren does not provide legal, tax, financial, investment, or
          professional advice. Contract review highlights practical issues and
          is not a substitute for qualified counsel. Tempo sandbox balances and
          MPP testnet activity have no real-world monetary value.
        </p>
      </LegalSection>
      <LegalSection title="Changes and access">
        <p>
          We may update these beta terms as the service evolves. Continued use
          after an effective-date change means you accept the updated beta
          terms.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
