import type { Metadata, Viewport } from "next";
import { Roboto_Condensed } from "next/font/google";
import "./globals.css";

// Cloud Phone ships Roboto and Roboto Condensed; self-hosting the same face keeps the desktop
// preview pixel-close to the handset and adds no third-party request at runtime.
const robotoCondensed = Roboto_Condensed({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-rc",
  display: "swap",
});

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Mizani",
  description: "Farm prices, deal maths and buyers for keypad phones at the Busia border.",
  manifest: `${base}/manifest.webmanifest`,
  icons: { icon: `${base}/icon-192.png`, apple: `${base}/icon-192.png` },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d6a4d",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${robotoCondensed.variable} antialiased`}>{children}</body>
    </html>
  );
}
