import type { Metadata, Viewport } from "next";
import { Great_Vibes, Sora, Space_Grotesk } from "next/font/google";
import AppSidebar from "@/components/app-sidebar";
import AdminProfileShortcut from "@/components/admin-profile-shortcut";
import ScrollToTopButton from "@/components/scroll-to-top-button";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const greatVibes = Great_Vibes({
  variable: "--font-romantic",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rencana Biaya Lamaran",
  description: "List management rincian biaya lamaran dengan mode admin",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${spaceGrotesk.variable} ${sora.variable} ${greatVibes.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="app-layout">
          <AppSidebar />
          <div className="app-main">{children}</div>
        </div>
        <AdminProfileShortcut />
        <ScrollToTopButton />
      </body>
    </html>
  );
}
