"use client";

import Image from "next/image";

export const WORKSPACE_ICON_COUNT = 8;

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export interface WorkspaceIconProps {
  name: string;
  variant?: number;
  size?: number;
  className?: string;
}

/**
 * Workspace logo: white rounded card with three gradient lines
 * (see public/slug-icon.svg). 8 variants, identical except the line
 * gradient — picked by `variant` (0-7, stored per project) or hashed
 * from the workspace name.
 */
export function WorkspaceIcon({ name, variant, size = 64, className = "" }: WorkspaceIconProps) {
  const idx =
    variant != null
      ? Math.max(0, Math.min(WORKSPACE_ICON_COUNT - 1, Math.floor(variant)))
      : hashCode(name) % WORKSPACE_ICON_COUNT;

  return (
    <Image
      src={`/icons/workspace-${idx}.svg`}
      alt={name}
      width={size}
      height={size}
      className={className}
    />
  );
}
