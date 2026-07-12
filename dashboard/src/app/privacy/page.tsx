import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Sandbox beta" title="Privacy" updated="July 12, 2026">
      <LegalSection title="What we collect">
        <p>
          We process account identity supplied by Privy, creator profile and
          onboarding details, deal and financial records you enter,
          connected-app metadata and encrypted credentials, messages sent to
          Indyfren, and operational security logs such as request IDs and
          service health.
        </p>
      </LegalSection>
      <LegalSection title="How data is used">
        <p>
          Data is used to provide the dashboard, respond to requests, connect
          services you authorize, maintain security, and improve reliability.
          AI-generated suggestions can be inaccurate and always require your
          review before consequential action.
        </p>
      </LegalSection>
      <LegalSection title="Service providers and retention">
        <p>
          Current service providers include Privy for identity and wallets,
          Supabase for application data, Railway and Vercel for hosting, Redis
          for jobs and rate limits, and enabled connected-app or AI providers.
          We retain data only while your account and required operational
          records remain active, subject to legal and security needs.
        </p>
      </LegalSection>
      <LegalSection title="Your controls">
        <p>
          You can export your account data or request deletion from Settings.
          Deletion revokes supported connections and removes application data;
          public blockchain history and provider-archived wallet records may
          remain as disclosed during the deletion flow.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
