import type { SVGProps } from "react";

export type IconName =
  | "home"
  | "employees"
  | "work"
  | "connections"
  | "help"
  | "plus"
  | "arrow"
  | "check"
  | "alert"
  | "close"
  | "search"
  | "spark"
  | "settings";

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
}

const paths: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <path d="M3 10.8 12 3l9 7.8" />
      <path d="M5.5 9.5V21h13V9.5" />
      <path d="M9.5 21v-7h5v7" />
    </>
  ),
  employees: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20v-2.1A4.9 4.9 0 0 1 8.4 13h1.2a4.9 4.9 0 0 1 4.9 4.9V20" />
      <path d="M15.5 5.4a3 3 0 0 1 0 5.8M16.5 14a4.5 4.5 0 0 1 4 4.5V20" />
    </>
  ),
  work: (
    <>
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 14h7M8.5 18h4" />
    </>
  ),
  connections: (
    <>
      <path d="M9.5 14.5 14.5 9" />
      <path d="M7.2 16.8 5.7 18.3a3.5 3.5 0 0 1-5-5l3.1-3.1a3.5 3.5 0 0 1 5 0" transform="translate(3)" />
      <path d="m16.8 7.2 1.5-1.5a3.5 3.5 0 1 1 5 5l-3.1 3.1a3.5 3.5 0 0 1-5 0" transform="translate(-3)" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.7 9a2.4 2.4 0 1 1 3.8 2c-1 .7-1.5 1.1-1.5 2.3" />
      <path d="M12 17.2h.01" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="m9 5 7 7-7 7" />,
  check: <path d="m5 12 4.2 4.2L19 6.5" />,
  alert: (
    <>
      <path d="M10.4 3.8 2.7 18a2 2 0 0 0 1.8 3h15a2 2 0 0 0 1.8-3L13.6 3.8a1.8 1.8 0 0 0-3.2 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.2 4.2" />
    </>
  ),
  spark: (
    <>
      <path d="m12 3 1.2 4.1L17 9l-3.8 1.9L12 15l-1.2-4.1L7 9l3.8-1.9L12 3Z" />
      <path d="m5 14 .7 2.3L8 17.5l-2.3 1.2L5 21l-.7-2.3L2 17.5l2.3-1.2L5 14Z" />
      <path d="m19 12 .5 1.6 1.5.9-1.5.8L19 16l-.5-1.7-1.5-.8 1.5-.9L19 12Z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
};

export function Icon({ name, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
