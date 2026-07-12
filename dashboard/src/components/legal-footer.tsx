import Link from "next/link";

const LINKS = [
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
  ["Acceptable use", "/acceptable-use"],
  ["Support", "/support"],
] as const;

export function LegalFooter() {
  return (
    <footer className="legal-footer">
      <span>© {new Date().getFullYear()} Chainfren</span>
      <nav aria-label="Legal and support">
        {LINKS.map(([label, href]) => (
          <Link href={href} key={href}>
            {label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
