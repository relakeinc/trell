import type { Metadata, Viewport } from "next";
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
    apple: "/apple-touch-icon.png",
  },
  // Installed-to-home-screen behaviour (iOS reads these; the manifest covers
  // Chrome/Android).
  appleWebApp: {
    capable: true,
    title: "trell",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false, email: false, address: false },
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

// PWA viewport: cover draws under the notch/status bar, and the safe-area
// insets (see globals.css) keep the UI clear of it. Zoom stays enabled for
// accessibility; mobile inputs are sized to 16px to avoid iOS focus-zoom.
//
// `themeColor` is intentionally NOT set here: it must follow the in-app theme
// toggle, and a React-rendered tag would fight the client code that rewrites
// it (that mismatch surfaced as a `removeChild` crash). The inline head script
// below owns a single `meta[data-trell]` instead.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${figtree.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('trell-theme');var r=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(r)document.documentElement.classList.add('dark');document.documentElement.style.colorScheme=r?'dark':'light';var a=localStorage.getItem('trell-accent');if(a)document.documentElement.setAttribute('data-accent',a);var f=localStorage.getItem('trell-font');if(f)document.documentElement.setAttribute('data-font',f);var m=document.querySelector('meta[name="theme-color"][data-trell]');if(!m){m=document.createElement('meta');m.setAttribute('name','theme-color');m.setAttribute('data-trell','');document.head.appendChild(m);}m.setAttribute('content',r?'#111111':'#ffffff');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
