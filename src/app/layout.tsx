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
  title: "Council — Should you build it? Get the verdict.",
  description:
    "The AI investor that tells you GO, PIVOT, or DON'T on your startup idea — in 30 seconds, with 3 reasons why.",
  openGraph: {
    title: "Council — Should you build it? Get the verdict.",
    description:
      "The AI investor that tells you GO, PIVOT, or DON'T on your startup idea — in 30 seconds, with 3 reasons why.",
    type: "website",
    url: "https://councilpro.vercel.app",
  },
  twitter: {
    card: "summary_large_image",
    title: "Council — Should you build it? Get the verdict.",
    description:
      "The AI investor that tells you GO, PIVOT, or DON'T on your startup idea — in 30 seconds, with 3 reasons why.",
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
