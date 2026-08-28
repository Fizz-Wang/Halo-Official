import type { Metadata, Viewport } from "next";
import {
  readRequestCspNonce,
  readRequestReleaseContext,
} from "../lib/stage8/request-context";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const release = await readRequestReleaseContext();
  return {
    title: "Halo Database",
    applicationName: "Halo Database",
    icons: {
      icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    },
    metadataBase: release.active && release.origin ? new URL(release.origin) : null,
    robots: { index: release.active, follow: true },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
  themeColor: "#0B1220",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const release = await readRequestReleaseContext();
  const cspNonce = await readRequestCspNonce();
  const websiteSchema = release.active && release.origin
    ? JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Halo Database",
        url: release.origin,
      }).replaceAll("<", "\\u003c")
    : null;

  return (
    <html lang="en" dir="ltr">
      <body>
        {websiteSchema ? (
          <script
            nonce={cspNonce ?? undefined}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: websiteSchema }}
          />
        ) : null}
        {children}
      </body>
    </html>
  );
}
