import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import SiteChrome from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Infinix | Everyday Luxury Beauty",
  description: "Fragrances, body sprays, powders, and nail colors crafted for those who dare to be unforgettable.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <SiteChrome>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
