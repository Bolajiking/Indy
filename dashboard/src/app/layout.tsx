import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Extend under notches/home indicator; safe-area insets handle the spacing.
  viewportFit: "cover",
  themeColor: "#06060c",
};

export const metadata: Metadata = {
  title: {
    default: "Indyfren",
    template: "%s — Indyfren",
  },
  description:
    "The AI agent for independent creators. Find brand deals, pitch in your voice, track every dollar — while you create.",
  icons: {
    icon: "/favicon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
  // iOS "Add to Home Screen": full-screen standalone app with the right title.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Indyfren",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script
          id="remove-extension-hydration-attrs"
          strategy="beforeInteractive"
        >
          {`
            (() => {
              const stripInjectedAttributes = () => {
                document
                  .querySelectorAll("[bis_skin_checked]")
                  .forEach((node) => node.removeAttribute("bis_skin_checked"));
              };

              stripInjectedAttributes();

              const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                  if (mutation.type === "attributes" && mutation.attributeName === "bis_skin_checked") {
                    mutation.target.removeAttribute("bis_skin_checked");
                  }
                  mutation.addedNodes.forEach((node) => {
                    if (node instanceof Element) {
                      node.removeAttribute("bis_skin_checked");
                      node
                        .querySelectorAll("[bis_skin_checked]")
                        .forEach((child) => child.removeAttribute("bis_skin_checked"));
                    }
                  });
                }
              });

              observer.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ["bis_skin_checked"],
                childList: true,
                subtree: true,
              });

              window.addEventListener("load", () => {
                stripInjectedAttributes();
                observer.disconnect();
              }, { once: true });
            })();
          `}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
