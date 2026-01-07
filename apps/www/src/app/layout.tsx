import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";
import { Navigation } from "@/components/navbar/navigation";

import { ThemeProvider } from "../components/theme-provider";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  appleWebApp: {
    title: "Voidhash",
  },
  description:
    "Voidhash is an open-source subscription management platform simplifying integrations, analytics, and revenue growth for apps and digital products.",
  title: "Voidhash - Payments made simple",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} text-pretty antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
        >
          <Navigation />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
