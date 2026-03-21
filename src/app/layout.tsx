import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SandpackCSS } from "@/components/sandpack-styles";
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
  metadataBase: new URL("https://council-zeta.vercel.app"),
  title: "Council — Your Startup's Strategic Memory",
  description:
    "Evaluate your startup idea, track progress over time, and make better decisions. Council scores your idea across 5 dimensions, identifies risks, and gives you a concrete 7-day action plan. Come back with updates — Council remembers.",
  openGraph: {
    title: "Council — Your Startup's Strategic Memory",
    description: "Evaluate your startup idea, track progress over time, and make better decisions.",
    type: "website",
    url: "https://council-zeta.vercel.app",
  },
  twitter: {
    card: "summary_large_image",
    title: "Council — Your Startup's Strategic Memory",
    description: "Evaluate your startup idea, track progress over time, and make better decisions.",
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
        {children}
      </body>
    </html>
  );
}
