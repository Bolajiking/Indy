import React from "react";

export interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

function SvgIcon({
  size = 14,
  className,
  strokeWidth = 1.5,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 4.5v3.5l2.5 1.5" />
    </SvgIcon>
  );
}

export function IconCard(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M2 6.5h12" />
    </SvgIcon>
  );
}

export function IconDocument(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <rect x="3" y="2.5" width="10" height="11" rx="1.5" />
      <path d="M6 6h4M6 8.5h4M6 11h2" />
    </SvgIcon>
  );
}

export function IconBarChart(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M4 12.5V7M8 12.5V3.5M12 12.5V5.5" />
    </SvgIcon>
  );
}

export function IconGear(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="8" cy="8" r="2.5" />
      <path d="M13.5 8a5.5 5.5 0 01-.4 2l.9 1.5-1.5.9-1.2-.7a5.5 5.5 0 01-1.8.8L9 14H7l-.5-1.5a5.5 5.5 0 01-1.8-.8l-1.2.7-1.5-.9.9-1.5A5.5 5.5 0 012.5 8c0-.7.1-1.4.4-2L2 4.5 3.5 3.6l1.2.7a5.5 5.5 0 011.8-.8L7 2h2l.5 1.5a5.5 5.5 0 011.8.8l1.2-.7 1.5.9-.9 1.5c.3.6.4 1.3.4 2z" />
    </SvgIcon>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M2.5 8.5l4 4L13.5 3.5" />
    </SvgIcon>
  );
}

export function IconX(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </SvgIcon>
  );
}

export function IconSend(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M14 2L7 9M14 2l-4 12-3-5-5-3z" />
    </SvgIcon>
  );
}

export function IconBell(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M4 6a4 4 0 018 0c0 4 2 5 2 5H2s2-1 2-5" />
      <path d="M6.5 13a1.5 1.5 0 003 0" />
    </SvgIcon>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </SvgIcon>
  );
}

export function IconList(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M3 4h10M3 8h6M3 12h8" />
    </SvgIcon>
  );
}

export function IconArrowUp(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M8 12V4M5 7l3-3 3 3" />
    </SvgIcon>
  );
}

export function IconPulse(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M2 8h3l2-5 2 10 2-5h3" />
    </SvgIcon>
  );
}

export function IconGrid(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M6 2v12M10 2v12M2 6h12M2 10h12" />
    </SvgIcon>
  );
}

export function IconRefresh(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M13 3v4h-4" />
      <path d="M3 8a5 5 0 019-2l1 1" />
      <path d="M3 13V9h4" />
      <path d="M13 8a5 5 0 01-9 2l-1-1" />
    </SvgIcon>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M6 4l4 4-4 4" />
    </SvgIcon>
  );
}

export function IconTrendUp(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M8 1v14M4.5 4L8 1l3.5 3" />
    </SvgIcon>
  );
}
