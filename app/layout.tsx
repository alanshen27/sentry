import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AppShell } from "@/components/app-shell";
import { ThemeProvider } from "@/components/theme-provider";

const THEME_INIT = `(function(){try{var t=localStorage.getItem('sentry-theme');if(t!=='light'&&t!=='dark'){t='dark';}var d=document.documentElement;d.classList.toggle('dark',t==='dark');d.style.colorScheme=t;}catch(e){}})();`;

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sentry — Programmable Disaster Intelligence",
  description:
    "Draw any region. Monitor every disaster signal. Programmable geospatial disaster intelligence.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
