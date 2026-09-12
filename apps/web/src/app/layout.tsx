import type { Metadata } from "next";
import { Figtree, Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://trell.relake.co"),
  title: "trell",
  description: "Bring analytics and conversion tracking to the forms you already have.",
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    title: "trell",
    description: "Bring analytics and conversion tracking to the forms you already have.",
    url: "https://trell.relake.co",
    siteName: "trell",
    type: "website",
    images: [
      {
        url: "https://relake.co/trell-og.jpeg",
        width: 1200,
        height: 630,
        alt: "trell — Bring analytics and conversion tracking to the forms you already have.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "trell",
    description: "Bring analytics and conversion tracking to the forms you already have.",
    images: ["https://relake.co/trell-og.jpeg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${figtree.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('trell-theme');var r=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(r)document.documentElement.classList.add('dark');var a=localStorage.getItem('trell-accent');if(a)document.documentElement.setAttribute('data-accent',a);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
