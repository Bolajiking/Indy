import Link from "next/link";
import type { ReactNode } from "react";
import { LegalFooter } from "@/components/legal-footer";

export function LegalPage({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="legal-page">
      <Link className="legal-back" href="/">
        ← Indyfren
      </Link>
      <article>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="legal-updated">Effective {updated}</p>
        {children}
      </article>
      <LegalFooter />
    </main>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
