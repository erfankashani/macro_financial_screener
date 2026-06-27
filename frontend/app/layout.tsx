import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Macro Market Screener — daily market risk read",
  description:
    "A one-glance morning read on macro risk: recession-onset, credit stress, labor, the business cycle, and long-run valuation.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Persisted theme is read server-side from a cookie, so the correct theme is
  // rendered in the initial HTML — no flash, no client boot script. Light is the
  // default when nothing is stored.
  const isDark = (await cookies()).get("theme")?.value === "dark";
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${isDark ? "dark" : ""} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-text">
        {/* Slim, sticky product bar — gives the app a fixed frame of reference. */}
        <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              <span className="text-sm font-semibold tracking-tight text-text-strong">
                Macro Screener
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-text-muted sm:inline">
                Daily macro-risk read
              </span>
              <ThemeToggle />
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
