import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata = { title: "Acceptable use" };

export default function AcceptableUsePage() {
  return (
    <LegalPage
      eyebrow="Sandbox beta"
      title="Acceptable use"
      updated="July 12, 2026"
    >
      <LegalSection title="Use Indyfren responsibly">
        <p>
          Use the service only for lawful creator-business activity and only
          with accounts, data, and recipients you are authorized to access.
        </p>
      </LegalSection>
      <LegalSection title="Do not">
        <ul>
          <li>
            misrepresent identity, authority, endorsements, or payment status;
          </li>
          <li>send spam, harassment, scams, malware, or deceptive outreach;</li>
          <li>
            circumvent approvals, rate limits, safety controls, or access
            boundaries;
          </li>
          <li>
            use connected accounts to access another person&apos;s information;
            or
          </li>
          <li>
            use the service for unlawful, harmful, or rights-infringing
            activity.
          </li>
        </ul>
      </LegalSection>
      <LegalSection title="Enforcement">
        <p>
          We may pause connected-app writes, agent execution, messaging, or
          access where we reasonably believe safety, security, or these rules
          require it.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
