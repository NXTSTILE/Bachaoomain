import type { Metadata, Viewport } from "next";
import { isIndexable, siteDescription, siteUrl } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Bachaoo — Connect with seniors at your college", template: "%s | Bachaoo" },
  description: siteDescription,
  applicationName: "Bachaoo",
  robots: { index: isIndexable, follow: isIndexable },
  openGraph: {
    type: "website", locale: "en_IN", siteName: "Bachaoo",
    title: "Your college. Your seniors. Your people.", description: siteDescription,
  },
  twitter: { card: "summary_large_image", title: "Bachaoo — Don’t solo college.", description: siteDescription },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#f8f7f2", colorScheme: "light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
