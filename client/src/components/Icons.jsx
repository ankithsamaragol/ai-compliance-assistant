// Minimal stroke-icon set (Feather-style) — no external dependency.
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function Svg({ children, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      {children}
    </svg>
  );
}

export const IconHome = (p) => <Svg {...p}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" /></Svg>;
export const IconSparkle = (p) => <Svg {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" /></Svg>;
export const IconDocument = (p) => <Svg {...p}><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v5h5" /></Svg>;
export const IconAlertTriangle = (p) => <Svg {...p}><path d="M10.3 4.3 2.5 18a1 1 0 0 0 .9 1.5h17.2a1 1 0 0 0 .9-1.5L13.7 4.3a1 1 0 0 0-1.7 0Z" /><path d="M12 9.5v4M12 17h.01" /></Svg>;
export const IconBuilding = (p) => <Svg {...p}><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" /></Svg>;
export const IconBook = (p) => <Svg {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" /><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20" /></Svg>;
export const IconShieldCheck = (p) => <Svg {...p}><path d="M12 3 4.5 6v6c0 4.5 3 7.5 7.5 9 4.5-1.5 7.5-4.5 7.5-9V6L12 3Z" /><path d="m9 12 2 2 4-4" /></Svg>;
export const IconClipboard = (p) => <Svg {...p}><rect x="6" y="4" width="12" height="17" rx="1.5" /><rect x="9" y="2.5" width="6" height="3" rx="1" /><path d="M9 11h6M9 15h6" /></Svg>;
export const IconCheckSquare = (p) => <Svg {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="2" /><path d="m8 12 3 3 6-6" /></Svg>;
export const IconFileText = (p) => <Svg {...p}><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M9 13h6M9 17h6" /></Svg>;
export const IconClock = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></Svg>;
export const IconHelp = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.3 9.2a2.7 2.7 0 0 1 5.2.9c0 1.8-2.5 1.9-2.5 3.4" /><path d="M12 17.2h.01" /></Svg>;
export const IconSettings = (p) => <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 13a7.97 7.97 0 0 0 0-2l2-1.4-2-3.4-2.3.9a8 8 0 0 0-1.7-1L15 3h-4l-.4 2.1a8 8 0 0 0-1.7 1l-2.3-.9-2 3.4L6.6 11a7.97 7.97 0 0 0 0 2l-2 1.4 2 3.4 2.3-.9a8 8 0 0 0 1.7 1L11 21h4l.4-2.1a8 8 0 0 0 1.7-1l2.3.9 2-3.4-2-1.4Z" /></Svg>;
export const IconChevronDown = (p) => <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>;
export const IconSearch = (p) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></Svg>;
export const IconArrowRight = (p) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
export const IconTrendUp = (p) => <Svg {...p}><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></Svg>;
export const IconCheckCircle = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.5 2.5 5-5" /></Svg>;
export const IconMessageCircle = (p) => <Svg {...p}><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.35 0-2.62-.32-3.73-.9L3 20l1-4.9A8.5 8.5 0 1 1 21 11.5Z" /></Svg>;
export const IconUser = (p) => <Svg {...p}><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20c1.2-4 4-6 7.5-6s6.3 2 7.5 6" /></Svg>;
export const IconUsers = (p) => <Svg {...p}><circle cx="9" cy="8" r="3" /><path d="M2.5 20c1-3.5 3.5-5.3 6.5-5.3s5.5 1.8 6.5 5.3" /><circle cx="17" cy="7.5" r="2.3" /><path d="M15.5 9.5c1.7.2 3 1.6 3.7 4" /></Svg>;
export const IconImage = (p) => <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="m4 17 5-5 4 4 3-3 4 4" /></Svg>;
export const IconTrash = (p) => <Svg {...p}><path d="M4 7h16M9 7V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></Svg>;
