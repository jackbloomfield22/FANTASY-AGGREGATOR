import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeScript } from "@/components/ThemeScript";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Fantasy Aggregator",
    template: "%s · Fantasy Aggregator",
  },
  description:
    "Every league. Every player. One Sunday. A live command center for your entire fantasy football portfolio.",
};

export const viewport: Viewport = {
  themeColor: "#07090d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
