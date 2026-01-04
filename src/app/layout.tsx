import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Noto_Sans_JP } from "next/font/google";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ViewModeProvider } from "@/components/providers/ViewModeProvider";
import "./globals.css";

// Expressive display sans for headings
const spaceGrotesk = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Highly legible Japanese + Latin body font
const notoSansJP = Noto_Sans_JP({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Money Tracker",
  description: "個人財務管理アプリ - PL/BS/CFで家計を管理",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Money Tracker",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#f7fbff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${spaceGrotesk.variable} ${notoSansJP.variable} font-body antialiased text-foreground`}
      >
        <AuthProvider>
          <ViewModeProvider>{children}</ViewModeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
