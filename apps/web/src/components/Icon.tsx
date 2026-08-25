"use client";

import {
  BarChart2,
  GitBranch,
  Scale,
  Zap,
  Link,
  Globe,
  Sparkles,
  ArrowRight,
  LogOut,
  ChevronDown,
  RefreshCw,
  LayoutGrid,
  SlidersHorizontal,
  Calendar,
  Settings,
  CreditCard,
  KeyRound,
  Key,
  MonitorSmartphone,
  Target,
  Upload,
  Download,
  XCircle,
  Send,
  type LucideIcon,
} from "lucide-react";
import type { JSX } from "react";

function FunnelsIcon({ size = 24, className }: { size?: number | string; className?: string }): JSX.Element {
  return (
    <svg height={size} width={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EventsIcon({ size = 24, className }: { size?: number | string; className?: string }): JSX.Element {
  return (
    <svg height={size} width={size} viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" className={className}>
      <g fill="currentColor">
        <g>
          <path d="M8.095,7.778l7.314,2.51c.222,.076,.226,.388,.007,.47l-3.279,1.233c-.067,.025-.121,.079-.146,.146l-1.233,3.279c-.083,.219-.394,.215-.47-.007l-2.51-7.314c-.068-.197,.121-.385,.318-.318Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></path>
          <line fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" x1="12.031" x2="16.243" y1="12.031" y2="16.243"></line>
        </g>
        <g>
          <line fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" x1="7.75" x2="7.75" y1="1.75" y2="3.75"></line>
          <line fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" x1="11.993" x2="10.578" y1="3.507" y2="4.922"></line>
          <line fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" x1="3.507" x2="4.922" y1="11.993" y2="10.578"></line>
          <line fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" x1="1.75" x2="3.75" y1="7.75" y2="7.75"></line>
          <line fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" x1="3.507" x2="4.922" y1="3.507" y2="4.922"></line>
        </g>
      </g>
    </svg>
  );
}

function AnalyticsIcon({ size = 24, className }: { size?: number | string; className?: string }): JSX.Element {
  return (
    <svg height={size} width={size} viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" className={className}>
      <g fill="currentColor">
        <line fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" x1="2.75" x2="2.75" y1="2.75" y2="15.25"></line>
        <line fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" x1="7" x2="7" y1="7.75" y2="15.25"></line>
        <line fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" x1="11" x2="11" y1="11.75" y2="15.25"></line>
        <line fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" x1="15.25" x2="15.25" y1="4.75" y2="15.25"></line>
      </g>
    </svg>
  );
}

function ComparisonIcon({ size = 24, className }: { size?: number | string; className?: string }): JSX.Element {
  return (
    <svg height={size} width={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M11 13H7"></path>
      <path d="M19 9h-4"></path>
      <path d="M3 3v16a2 2 0 0 0 2 2h16"></path>
      <rect x="15" y="5" width="4" height="12" rx="1"></rect>
      <rect x="7" y="8" width="4" height="9" rx="1"></rect>
    </svg>
  );
}

function GeneralIcon({ size, className }: { size?: number | string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <g fill="currentColor">
        <circle cx="9" cy="9" fill="none" r="5.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <line x1="6.25" y1="4.237" x2="9" y2="9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <line x1="6.25" y1="13.764" x2="9" y2="9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <line x1="14.5" y1="9" x2="9" y2="9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <line x1="9" y1="1.75" x2="9" y2="3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <line x1="2.721" y1="5.375" x2="4.237" y2="6.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <line x1="1.75" y1="9" x2="3.5" y2="9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <line x1="16.25" y1="9" x2="14.5" y2="9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <line x1="2.721" y1="12.625" x2="4.237" y2="11.75" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <line x1="9" y1="16.25" x2="9" y2="14.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <line x1="12.625" y1="15.279" x2="11.75" y2="13.763" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <line x1="5.375" y1="15.279" x2="6.25" y2="13.763" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <line x1="15.279" y1="12.625" x2="13.763" y2="11.75" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <line x1="15.279" y1="5.375" x2="13.763" y2="6.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <line x1="12.625" y1="2.721" x2="11.75" y2="4.237" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <line x1="5.375" y1="2.721" x2="6.25" y2="4.237" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </g>
    </svg>
  );
}

function BillingIcon({ size, className }: { size?: number | string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <g fill="currentColor">
        <line x1="16.25" y1="2.75" x2="1.75" y2="2.75" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <line x1="5.75" y1="11.25" x2="9.25" y2="11.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <line x1="5.75" y1="8.25" x2="9.25" y2="8.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <line x1="11.75" y1="11.25" x2="12.25" y2="11.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <line x1="11.75" y1="8.25" x2="12.25" y2="8.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <polyline points="14.75 5.75 14.75 16.25 12 14.75 9 16.25 6 14.75 3.25 16.25 3.25 5.75" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </g>
    </svg>
  );
}

function DomainsIcon({ size, className }: { size?: number | string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <g fill="currentColor">
        <ellipse cx="9" cy="9" rx="7.25" ry="3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <ellipse cx="9" cy="9" rx="3" ry="7.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <circle cx="9" cy="9" r="7.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </g>
    </svg>
  );
}

function ApiKeyIcon({ size, className }: { size?: number | string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <g fill="currentColor">
        <path d="M15.747,2.076l-2.847,.177-5.891,5.891c-.324-.084-.658-.144-1.009-.144-2.209,0-4,1.791-4,4s1.791,4,4,4,4-1.791,4-4c0-.362-.064-.707-.154-1.041l1.904-1.959v-2.25h2.25l1.753-1.645-.006-3.029Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <circle cx="5.5" cy="12.5" r="1" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}

function TrackingIcon({ size, className }: { size?: number | string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <g fill="currentColor">
        <path d="M9.217,9.622l2.016,5.781c.099,.283,.498,.285,.599,.003l.895-2.487c.032-.089,.102-.159,.191-.191l2.487-.895c.282-.101,.28-.501-.003-.599l-5.781-2.016c-.251-.088-.492,.154-.405,.405Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <path d="M16.244,8.879c-.065-3.948-3.281-7.129-7.244-7.129C4.996,1.75,1.75,4.996,1.75,9c0,3.963,3.182,7.179,7.13,7.244-.002-.006-.005-.011-.008-.017" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <path d="M13.046,7.763c-.532-1.74-2.132-3.013-4.046-3.013-2.347,0-4.25,1.903-4.25,4.25,0,1.914,1.273,3.513,3.013,4.045" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <line x1="12.778" y1="12.778" x2="16.25" y2="16.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </g>
    </svg>
  );
}

function WebhooksIcon({ size, className }: { size?: number | string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <g fill="currentColor">
        <circle cx="3.804" cy="13.278" r="1.25" fill="currentColor" />
        <circle cx="9" cy="4.222" r="1.25" fill="currentColor" />
        <circle cx="14.248" cy="13.252" r="1.25" fill="currentColor" />
        <path d="M3.804,13.278l3.721-6.444c-.91-.515-1.524-1.492-1.524-2.613,0-1.657,1.343-3,3-3s3,1.343,3,3c0,.08-.003,.159-.009,.237" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <path d="M14.246,13.25H6.805c.009,1.046-.53,2.065-1.5,2.626-1.435,.828-3.27,.337-4.098-1.098s-.337-3.27,1.098-4.098c.069-.04,.139-.077,.21-.11" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <path d="M9,4.222l3.72,6.444c.901-.531,2.054-.574,3.025-.014,1.435,.828,1.927,2.663,1.098,4.098s-2.663,1.927-4.098,1.098c-.069-.04-.136-.082-.2-.126" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </g>
    </svg>
  );
}

function UtmIcon({ size, className }: { size?: number | string; className?: string }) {
  return (
    <svg height={size} width={size} viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" className={className}>
      <g fill="currentColor">
        <polyline fill="none" points="10 6.5 12.25 8.75 10 11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <path d="M12.25,8.75h-3.5c-1.105,0-2,.895-2,2v.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <rect height="11.313" width="11.313" fill="none" rx="2" ry="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" transform="translate(21.728 9) rotate(135)" x="3.343" y="3.343" />
      </g>
    </svg>
  );
}

const ICON_MAP: Record<string, LucideIcon | ((props: { size?: number | string; className?: string }) => JSX.Element)> = {
  "chart-2": BarChart2,
  hierarchy: GitBranch,
  weight: Scale,
  flash: Zap,
  link: Link,
  global: Globe,
  "magic-star": Sparkles,
  "arrow-right-01": ArrowRight,
  "logout-01": LogOut,
  "arrow-down-01": ChevronDown,
  "refresh-right": RefreshCw,
  "grid-2": LayoutGrid,
  "filter-square": SlidersHorizontal,
  "calendar-2": Calendar,
  "setting-2": Settings,
  "card-pos": CreditCard,
  "key-square": KeyRound,
  "monitor-mobile": MonitorSmartphone,
  "export-arrow-01": Upload,
  "close-circle": XCircle,
  // Settings icons
  general: GeneralIcon,
  billing: BillingIcon,
  domains: DomainsIcon,
  api: ApiKeyIcon,
  tracking: TrackingIcon,
  webhooks: WebhooksIcon,
  links: UtmIcon,
  // Sidebar icons
  events: EventsIcon,
  analytics: AnalyticsIcon,
  comparison: ComparisonIcon,
  funnels: FunnelsIcon,
  // Standard lucide names (for new code)
  settings: Settings,
  creditCard: CreditCard,
  globe: Globe,
  key: Key,
  keyRound: KeyRound,
  target: Target,
  upload: Upload,
  download: Download,
  send: Send,
};

/** Maps icon names to their animation CSS class */
const ANIM_CLASS: Record<string, string> = {
  "arrow-right-01": "trell-icon-arrow",
  "arrow-down-01": "trell-icon-arrow",
  "refresh-right": "trell-icon-refresh",
  "close-circle": "trell-icon-close",
  "logout-01": "trell-icon-logout",
  "export-arrow-01": "trell-icon-export",
};

export interface IconProps {
  name: string;
  size?: number | string;
  color?: string;
  className?: string;
  strokeWidth?: number;
}

export function Icon({
  name,
  size = 24,
  color = "currentColor",
  className,
  strokeWidth = 1.5,
}: IconProps): JSX.Element {
  const IconComponent = ICON_MAP[name];
  const animClass = ANIM_CLASS[name];

  if (!IconComponent) {
    return (
      <span className={className} aria-hidden="true" style={{ width: size, height: size }} />
    );
  }

  return (
    <span className={animClass} style={{ display: "inline-flex" }}>
      <IconComponent
        size={size}
        color={color}
        strokeWidth={strokeWidth}
        className={className}
        aria-hidden="true"
      />
    </span>
  );
}
