import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SandpackCSS } from "@/components/sandpack-styles";
import { LangProvider } from "@/lib/i18n";
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
  metadataBase: new URL("https://councilpro.vercel.app"),
  title: "Council — Honest AI verdict on your startup idea",
  description:
    "Get a GO, PIVOT, or DON'T verdict in 30 seconds. Real market data, 3 evidence-backed reasons, brutally honest. No sugarcoating.",
  openGraph: {
    title: "Council — Honest AI verdict on your startup idea",
    description:
      "Get a GO, PIVOT, or DON'T verdict in 30 seconds. Real market data, 3 evidence-backed reasons, brutally honest.",
    type: "website",
    url: "https://councilpro.vercel.app",
  },
  twitter: {
    card: "summary_large_image",
    title: "Council — Honest AI verdict on your startup idea",
    description:
      "Get a GO, PIVOT, or DON'T verdict in 30 seconds. Real market data, 3 evidence-backed reasons, brutally honest.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <SandpackCSS />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased selection:bg-foreground/10`}
        suppressHydrationWarning
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('council_theme');var d=t==='dark'||(t===null&&matchMedia('(prefers-color-scheme:dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
        <LangProvider>
          {children}
        </LangProvider>
      </body>
    </html>
  );
}
