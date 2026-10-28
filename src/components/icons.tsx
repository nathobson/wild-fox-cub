import type { ReactNode } from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

function Svg({
  size = 14,
  className,
  stroke = 'currentColor',
  fill = 'none',
  children,
}: IconProps & { children: ReactNode; stroke?: string; fill?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={fill}
      stroke={stroke}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconHome = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 7.2 8 2.5l5.5 4.7" />
    <path d="M4 6.8V13a.6.6 0 0 0 .6.6h6.8a.6.6 0 0 0 .6-.6V6.8" />
    <path d="M6.5 13.5v-3.4h3v3.4" />
  </Svg>
);

export const IconDoc = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 1.8h5.2L12 4.6v8.6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2.8a1 1 0 0 1 1-1Z" transform="translate(.5 0)" />
    <path d="M9.2 1.8v2.8H12" transform="translate(.5 0)" />
    <path d="M5.5 7.5h5M5.5 9.8h5M5.5 12h3.2" />
  </Svg>
);

export const IconMail = (p: IconProps) => (
  <Svg {...p}>
    <rect x="1.8" y="3.2" width="12.4" height="9.6" rx="1.6" />
    <path d="m2.6 4.6 5.4 4 5.4-4" />
  </Svg>
);

export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 3v10M3 8h10" />
  </Svg>
);

export const IconChevronUp = (p: IconProps) => (
  <Svg {...p}>
    <path d="m4 10 4-4 4 4" />
  </Svg>
);

export const IconChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="m4 6 4 4 4-4" />
  </Svg>
);

export const IconChevronLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 4 6 8l4 4" />
  </Svg>
);

export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 4 4 4-4 4" />
  </Svg>
);

export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 4h11" />
    <path d="M6.5 4V2.9a.9.9 0 0 1 .9-.9h1.2a.9.9 0 0 1 .9.9V4" />
    <path d="M3.8 4l.5 8.9A1.5 1.5 0 0 0 5.8 14.4h4.4a1.5 1.5 0 0 0 1.5-1.5L12.2 4" />
    <path d="M6.6 7v4.5M9.4 7v4.5" />
  </Svg>
);

export const IconCopy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.6" />
    <path d="M10.5 5.5v-1a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h1" />
  </Svg>
);

export const IconSliders = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 5h11M2.5 11h11" />
    <circle cx="6" cy="5" r="1.8" fill="var(--slider-fill, #282a32)" />
    <circle cx="10" cy="11" r="1.8" fill="var(--slider-fill, #282a32)" />
  </Svg>
);

export const IconGrip = (p: IconProps) => (
  <Svg {...p} stroke="none" fill="currentColor">
    <circle cx="5.8" cy="3.5" r="1.15" />
    <circle cx="10.2" cy="3.5" r="1.15" />
    <circle cx="5.8" cy="8" r="1.15" />
    <circle cx="10.2" cy="8" r="1.15" />
    <circle cx="5.8" cy="12.5" r="1.15" />
    <circle cx="10.2" cy="12.5" r="1.15" />
  </Svg>
);

export const IconLink = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.5 9.5 9.5 6.5" />
    <path d="M7.8 4.8 9.3 3.3a2.3 2.3 0 0 1 3.4 3.4L11.2 8.2" />
    <path d="M8.2 11.2l-1.5 1.5a2.3 2.3 0 0 1-3.4-3.4l1.5-1.5" />
  </Svg>
);

export const IconList = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.6 4h8M5.6 8h8M5.6 12h8" />
    <circle cx="2.7" cy="4" r=".9" fill="currentColor" stroke="none" />
    <circle cx="2.7" cy="8" r=".9" fill="currentColor" stroke="none" />
    <circle cx="2.7" cy="12" r=".9" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="m3 8.5 3.2 3.2L13 5" />
  </Svg>
);

export const IconCheckSeal = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="6.2" />
    <path d="m5.2 8.2 1.9 1.9 3.7-3.9" />
  </Svg>
);

export const IconDesktop = (p: IconProps) => (
  <Svg {...p}>
    <rect x="1.8" y="2.6" width="12.4" height="8.4" rx="1.4" />
    <path d="M6 13.6h4M8 11v2.6" />
  </Svg>
);

export const IconTablet = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="1.8" width="10" height="12.4" rx="1.8" />
    <path d="M7 12.2h2" />
  </Svg>
);

export const IconPhone = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4.8" y="1.8" width="6.4" height="12.4" rx="1.7" />
    <path d="M7.2 12.4h1.6" />
  </Svg>
);

export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="m4 4 8 8M12 4l-8 8" />
  </Svg>
);

export const IconImage = (p: IconProps) => (
  <Svg {...p}>
    <rect x="1.8" y="2.6" width="12.4" height="10.8" rx="1.8" />
    <circle cx="5.6" cy="6.2" r="1.2" />
    <path d="m2.6 12 3.6-3.6 2.4 2.4 2.6-2.6 2.2 2.2" />
  </Svg>
);

export const IconText = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 4.2V3h10v1.2" />
    <path d="M8 3v10" />
    <path d="M6 13h4" />
  </Svg>
);

export const IconLayout = (p: IconProps) => (
  <Svg {...p}>
    <rect x="1.8" y="2.4" width="12.4" height="11.2" rx="1.8" />
    <path d="M1.8 6h12.4M6.4 6v7.6" />
  </Svg>
);

export const IconGrid = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2" y="2" width="5.2" height="5.2" rx="1.2" />
    <rect x="8.8" y="2" width="5.2" height="5.2" rx="1.2" />
    <rect x="2" y="8.8" width="5.2" height="5.2" rx="1.2" />
    <rect x="8.8" y="8.8" width="5.2" height="5.2" rx="1.2" />
  </Svg>
);

export const IconMegaphone = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 6.5v3a1 1 0 0 0 1 1H5l6.5 3.2V2.3L5 5.5H3.5a1 1 0 0 0-1 1Z" />
    <path d="M6 10.8 7 14" />
  </Svg>
);

export const IconSpinner = (p: IconProps) => (
  <Svg {...p} className={`spin${p.className ? ` ${p.className}` : ''}`}>
    <path d="M8 1.8a6.2 6.2 0 1 1-6.2 6.2" />
  </Svg>
);

export const IconUsers = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="6" cy="5.4" r="2.4" />
    <path d="M1.8 13.4c.4-2.3 2.1-3.6 4.2-3.6s3.8 1.3 4.2 3.6" />
    <path d="M10.6 3.2a2.3 2.3 0 0 1 0 4.4M12 9.9c1.2.4 2 1.6 2.2 3.5" />
  </Svg>
);

export const IconInbox = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 9.2 3.8 3.4a1 1 0 0 1 1-.7h6.4a1 1 0 0 1 1 .7L14 9.2v3.3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Z" />
    <path d="M2 9.2h3.4l.9 1.6h3.4l.9-1.6H14" />
  </Svg>
);

export const IconGear = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12.59 6.27 L14.25 6.6 L14.25 9.4 L12.59 9.73 L12.46 10.02 L13.4 11.43 L11.43 13.4 L10.02 12.46 L9.73 12.59 L9.4 14.25 L6.6 14.25 L6.27 12.59 L5.98 12.46 L4.57 13.4 L2.6 11.43 L3.54 10.02 L3.41 9.73 L1.75 9.4 L1.75 6.6 L3.41 6.27 L3.54 5.98 L2.6 4.57 L4.57 2.6 L5.98 3.54 L6.27 3.41 L6.6 1.75 L9.4 1.75 L9.73 3.41 L10.02 3.54 L11.43 2.6 L13.4 4.57 L12.46 5.98 Z" strokeWidth={1.2} />
    <circle cx="8" cy="8" r="2" strokeWidth={1.2} />
  </Svg>
);

export const IconExternal = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5" />
    <path d="M12 9.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3.5" />
  </Svg>
);

export const IconSignOut = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 2.5H3.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1H6" />
    <path d="M10.5 11 13.5 8l-3-3M13.5 8H6" />
  </Svg>
);

/** Fox Cub CMS mark: a geometric fox cub face. */
/** The Fox Cub mark, in the accent orange. `size` is its height; it's about twice as wide. */
export const FoxCubLogo = ({ size = 28, className }: IconProps) => (
  <svg height={size} viewBox="25 21 129 68" className={className} aria-hidden="true">
    <path
      fill="#ff7a1a"
      fillRule="evenodd"
      d="M 152 58 L 149 55 L 149 54 L 121 26 L 120 26 L 117 23 L 113 23 L 111 26 L 111 36 L 109 38 L 104 33 L 103 33 L 102 31 L 101 31 L 93 23 L 89 23 L 87 25 L 87 38 L 86 39 L 86 41 L 85 43 L 79 49 L 77 50 L 75 50 L 74 51 L 44 51 L 42 49 L 42 48 L 45 44 L 70 44 L 71 43 L 74 43 L 76 41 L 77 41 L 80 36 L 80 25 L 42 25 L 34 29 L 31 32 L 31 33 L 28 37 L 28 40 L 27 41 L 27 82 L 28 84 L 32 87 L 35 87 L 37 86 L 39 83 L 39 71 L 44 66 L 48 66 L 53 71 L 53 83 L 55 86 L 60 87 L 62 86 L 65 82 L 65 71 L 66 69 L 70 66 L 74 66 L 78 70 L 79 72 L 79 83 L 81 86 L 86 87 L 88 86 L 91 82 L 91 71 L 92 69 L 96 66 L 100 66 L 104 70 L 104 72 L 105 73 L 105 84 L 107 86 L 112 87 L 116 84 L 116 73 L 117 71 L 121 67 L 147 67 L 148 66 L 150 66 L 152 64 Z M 123 45 L 127 45 L 130 48 L 130 52 L 127 55 L 123 55 L 120 52 L 120 48 Z M 101 45 L 105 45 L 108 48 L 109 50 L 108 52 L 105 55 L 101 55 L 98 51 L 98 49 Z"
    />
  </svg>
);
