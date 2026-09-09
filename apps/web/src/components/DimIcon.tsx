"use client";

import Image from "next/image";
import type { JSX } from "react";

/**
 * Icons for breakdown dimension values (Sources card).
 * - devices: monochrome line style
 * - browsers + OS: full-color brand marks (static SVGs in public/icons)
 * Unknown / empty values always resolve to the globe fallback — never imageless.
 */

function DesktopIcon(): JSX.Element {
  return (
    <svg height="18" width="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4"><g fill="currentColor"><path d="M12.476,15.535c-.887-.279-1.803-.445-2.726-.504v-1.781c0-.414-.336-.75-.75-.75s-.75,.336-.75,.75v1.781c-.923,.06-1.839,.225-2.726,.504-.395,.125-.614,.545-.489,.941,.124,.394,.541,.612,.94,.49,1.958-.617,4.087-.618,6.049,0,.075,.023,.151,.035,.226,.035,.319,0,.614-.205,.716-.525,.124-.395-.096-.816-.49-.94Z" fill="#212121"></path><path d="M14.25,14H3.75c-1.517,0-2.75-1.233-2.75-2.75V4.75c0-1.517,1.233-2.75,2.75-2.75H14.25c1.517,0,2.75,1.233,2.75,2.75v6.5c0,1.517-1.233,2.75-2.75,2.75ZM3.75,3.5c-.689,0-1.25,.561-1.25,1.25v6.5c0,.689,.561,1.25,1.25,1.25H14.25c.689,0,1.25-.561,1.25-1.25V4.75c0-.689-.561-1.25-1.25-1.25H3.75Z" fill="#212121"></path></g></svg>
  );
}

function MobileIcon(): JSX.Element {
  return (
    <svg height="18" width="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4"><g fill="currentColor"><rect height="14.5" width="10.5" fill="none" rx="2" ry="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" x="3.75" y="1.75"></rect><polyline fill="none" points="7.75 1.75 7.75 2.75 10.25 2.75 10.25 1.75" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></polyline><circle cx="9" cy="13" fill="currentColor" r="1" stroke="none"></circle></g></svg>
  );
}

function TabletIcon(): JSX.Element {
  return (
    <svg height="18" width="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4"><g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5"><rect x="2.75" y="1.75" width="12.5" height="14.5" rx="2"></rect><line x1="7.5" y1="4" x2="10.5" y2="4"></line></g><circle cx="9" cy="13.4" r="1" fill="currentColor"></circle></svg>
  );
}

function ChromeIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 100 100" className="h-4 w-4"><linearGradient id="trell-chrome-b" x1="55.41" x2="12.11" y1="96.87" y2="21.87" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#1e8e3e"></stop><stop offset="1" stopColor="#34a853"></stop></linearGradient><linearGradient id="trell-chrome-c" x1="42.7" x2="86" y1="100" y2="25.13" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#fcc934"></stop><stop offset="1" stopColor="#fbbc04"></stop></linearGradient><linearGradient id="trell-chrome-a" x1="6.7" x2="93.29" y1="31.25" y2="31.25" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#d93025"></stop><stop offset="1" stopColor="#ea4335"></stop></linearGradient><path fill="url(#trell-chrome-a)" d="M93.29 25a50 50 90 0 0-86.6 0l3 54z"></path><path fill="url(#trell-chrome-b)" d="M28.35 62.5 6.7 25A50 50 90 0 0 50 100l49-50z"></path><path fill="url(#trell-chrome-c)" d="M71.65 62.5 50 100a50 50 90 0 0 43.29-75H50z"></path><path fill="#fff" d="M50 75a25 25 90 1 0 0-50 25 25 90 0 0 0 50z"></path><path fill="#1a73e8" d="M50 69.8a19.8 19.8 90 1 0 0-39.6 19.8 19.8 90 0 0 0 39.6z"></path></svg>
  );
}

function SafariIcon(): JSX.Element {
  return (
    <svg className="h-4 w-4" width="66" height="66" viewBox="0 0 66 66"><path fill="#C6C6C6" stroke="#C6C6C6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.5" d="M383.29373 211.97671a31.325188 31.325188 0 0 1-31.32519 31.32519 31.325188 31.325188 0 0 1-31.32518-31.32519 31.325188 31.325188 0 0 1 31.32518-31.32519 31.325188 31.325188 0 0 1 31.32519 31.32519z" paint-order="markers stroke fill" transform="translate(-318.88562 -180.59501)"></path><path fill="#4A9DED" d="M380.83911 211.97671a28.870571 28.870571 0 0 1-28.87057 28.87057 28.870571 28.870571 0 0 1-28.87057-28.87057 28.870571 28.870571 0 0 1 28.87057-28.87057 28.870571 28.870571 0 0 1 28.87057 28.87057z" paint-order="markers stroke fill" transform="translate(-318.88562 -180.59501)"></path><path fill="#ff5150" d="m36.3834003 34.83806178-6.60095092-6.91272438 23.41607429-15.75199774z" paint-order="markers stroke fill"></path><path fill="#f1f1f1" d="m36.38339038 34.83805895-6.60095092-6.91272438-16.81512624 22.66471911z" paint-order="markers stroke fill"></path><path d="m12.96732 50.59006 23.41607-15.75201 16.81513-22.66472z" opacity=".243"></path></svg>
  );
}

function EdgeIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4"><defs><linearGradient id="trell-edge-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#00BCF2"></stop><stop offset="1" stopColor="#0C88C3"></stop></linearGradient></defs><circle cx="12" cy="12" r="10" fill="url(#trell-edge-g)"></circle><path d="M4.5 14.5c2.5.8 4.5-.3 5.8-2.3 1-1.6 2-3.4 3.9-4.2 2.3-1 4.9-.9 6.3.4-1.9-.4-3.9-.1-5.6.9-2.4 1.4-3.8 3.9-6 5.2-1.9 1.1-3.6 1-4.4 0z" fill="#fff"></path></svg>
  );
}

function FirefoxIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4"><circle cx="12" cy="12" r="10" fill="#FF7139"></circle><circle cx="12" cy="12" r="6.2" fill="#fff"></circle><circle cx="12" cy="12" r="4.6" fill="#0060DF"></circle><path d="M12 2.5c2.8 1.6 4 4.3 3.8 7.2" fill="none" stroke="#FFBD4F" strokeWidth="1.8" strokeLinecap="round"></path></svg>
  );
}

function OperaIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4"><ellipse cx="12" cy="12" rx="8" ry="9.5" fill="none" stroke="#FF1B2D" strokeWidth="3.6"></ellipse></svg>
  );
}

function WindowsIcon(): JSX.Element {
  return (
    <Image src="/icons/os-windows.svg" alt="Windows" width={16} height={16} className="h-4 w-4" />
  );
}

function AppleIcon(): JSX.Element {
  return (
    <Image src="/icons/os-apple.svg" alt="Apple" width={16} height={16} className="h-4 w-4" />
  );
}

function AndroidIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4"><g fill="#3DDC84"><path d="M7.5 9.5a4.5 4.5 0 0 1 9 0v1h-9v-1z"></path><rect x="6" y="11" width="12" height="7.5" rx="2.5"></rect><circle cx="9.7" cy="8" r=".9" fill="#fff"></circle><circle cx="14.3" cy="8" r=".9" fill="#fff"></circle><path d="M6.2 3.4 7.6 5.6M17.8 3.4l-1.4 2.2" stroke="#3DDC84" strokeWidth="1.4" strokeLinecap="round"></path></g></svg>
  );
}

function LinuxIcon(): JSX.Element {
  return (
    <Image src="/icons/os-linux.svg" alt="Linux" width={16} height={16} className="h-4 w-4" />
  );
}

function GlobeIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-neutral-400"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18"></path><path d="M12 3a13.5 13.5 0 0 1 0 18 13.5 13.5 0 0 1 0-18z"></path></svg>
  );
}

const DEVICE_ICONS: Record<string, () => JSX.Element> = {
  desktop: DesktopIcon,
  mobile: MobileIcon,
  tablet: TabletIcon,
};

const BROWSER_ICONS: Record<string, () => JSX.Element> = {
  chrome: ChromeIcon,
  safari: SafariIcon,
  edge: EdgeIcon,
  firefox: FirefoxIcon,
  opera: OperaIcon,
};

const BROWSER_ALIASES: Record<string, string> = {
  crios: "chrome",
  "chrome mobile": "chrome",
  chromium: "chrome",
  "mobile safari": "safari",
  "firefox mobile": "firefox",
  fxios: "firefox",
  edg: "edge",
  edgios: "edge",
  "edge mobile": "edge",
  "opera mini": "opera",
  "opera touch": "opera",
  opr: "opera",
};

const OS_ICONS: Record<string, () => JSX.Element> = {
  windows: WindowsIcon,
  macos: AppleIcon,
  android: AndroidIcon,
  linux: LinuxIcon,
};

const OS_ALIASES: Record<string, string> = {
  ios: "macos",
  iphone: "macos",
  ipad: "macos",
  ipados: "macos",
  mac: "macos",
  "mac os x": "macos",
  osx: "macos",
  win: "windows",
  ubuntu: "linux",
  debian: "linux",
  fedora: "linux",
  chromeos: "linux",
  "chrome os": "linux",
};

function resolve(map: Record<string, () => JSX.Element>, aliases: Record<string, string>, key: string): (() => JSX.Element) | null {
  if (map[key]) return map[key]!;
  const alias = aliases[key];
  if (alias && map[alias]) return map[alias]!;
  return null;
}

/**
 * Icon for a breakdown value. Only device / browser / os dimensions have
 * icons; anything else returns null. Unknown values fall back to the globe.
 */
export function DimIcon({ dim, value }: { dim: string; value: string }): JSX.Element | null {
  const key = value.trim().toLowerCase();
  if (dim === "device") {
    const C = resolve(DEVICE_ICONS, {}, key) ?? GlobeIcon;
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[#212121]">
        <C />
      </span>
    );
  }
  if (dim === "browser") {
    const C = resolve(BROWSER_ICONS, BROWSER_ALIASES, key) ?? GlobeIcon;
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        <C />
      </span>
    );
  }
  if (dim === "os") {
    const C = resolve(OS_ICONS, OS_ALIASES, key) ?? GlobeIcon;
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        <C />
      </span>
    );
  }
  return null;
}
