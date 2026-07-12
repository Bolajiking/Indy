import { LegalPage, LegalSection } from "@/components/legal-page";
import { publicSupportEmail } from "@/lib/public-config";

export const metadata = { title: "Support" };

export default function SupportPage() {
  return (
    <LegalPage eyebrow="Human support" title="Support" updated="July 12, 2026">
      <LegalSection title="Contact">
        <p>
          Email{" "}
          <a href={`mailto:${publicSupportEmail}`}>{publicSupportEmail}</a> for
          account access, deletion, connected-app, safety, or beta feedback.
        </p>
      </LegalSection>
      <LegalSection title="Security reports">
        <p>
          For suspected vulnerabilities, follow the private reporting
          instructions in the project&apos;s SECURITY.md file. Do not include
          secrets or private user data in ordinary support messages.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
