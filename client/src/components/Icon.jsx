import React from 'react';

/* Bộ icon stroke 24px, tự vẽ theo ngôn ngữ kỹ thuật của design system
   ( nét mảnh, bo tròn đầu nét ) — không phụ thuộc thư viện ngoài. */
const paths = {
  search: (<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>),
  home: (<><path d="m4.5 10.2 7.5-6 7.5 6" /><path d="M6.2 8.7v11.1h11.6V8.7" /><path d="M10.2 19.8v-5.4h3.6v5.4" /></>),
  grid: (<><rect x="3.5" y="3.5" width="7" height="7" rx="1" /><rect x="13.5" y="3.5" width="7" height="7" rx="1" /><rect x="3.5" y="13.5" width="7" height="7" rx="1" /><rect x="13.5" y="13.5" width="7" height="7" rx="1" /></>),
  bookmark: (<path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-3.8L5.5 20.5v-16a1 1 0 0 1 1-1z" />),
  cart: (<><circle cx="9.5" cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" /><path d="M3 4h1.8l2.4 11.7a1.7 1.7 0 0 0 1.7 1.4h7.4a1.7 1.7 0 0 0 1.7-1.4L20 8H6.2" /></>),
  arrowRight: (<path d="M4.5 12h15m-6-6 6 6-6 6" />),
  arrowUp: (<path d="M12 20V5m-6 6 6-6 6 6" />),
  plus: (<path d="M12 5.5v13M5.5 12h13" />),
  minus: (<path d="M5.5 12h13" />),
  check: (<path d="m4.5 12.5 5 5 10-11" />),
  close: (<path d="m6 6 12 12M18 6 6 18" />),
  shield: (<path d="M12 3.2l7.3 2.9v5.2c0 4.5-3.1 7.8-7.3 9.4-4.2-1.6-7.3-4.9-7.3-9.4V6.1L12 3.2z" />),
  truck: (<><path d="M2.5 6.5h11v10h-11zM13.5 10h4l3.5 3.5v3h-7.5" /><circle cx="6.5" cy="17.5" r="1.7" /><circle cx="17" cy="17.5" r="1.7" /></>),
  refresh: (<><path d="M20 11.5a8 8 0 0 0-14-4.3L4 9.5" /><path d="M4 12.5a8 8 0 0 0 14 4.3l2-2.3" /><path d="M4 4.2v5h5M20 19.8v-5h-5" /></>),
  spark: (<path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8L12 3.5zM19 16.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1z" />),
  star: (<path d="M12 3.6l2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8L12 3.6z" />),
  clock: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2.5" /></>),
  phone: (<path d="M5.5 3.5h3l1.5 4.5-2 1.5a12.5 12.5 0 0 0 5.5 5.5l1.5-2 4.5 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3.5 5.7a2 2 0 0 1 2-2.2z" />),
  mail: (<><rect x="3.5" y="5.5" width="17" height="13" rx="1.5" /><path d="m4.5 7 7.5 6 7.5-6" /></>),
  pin: (<><path d="M12 21.5s7-6.2 7-11.5a7 7 0 1 0-14 0c0 5.3 7 11.5 7 11.5z" /><circle cx="12" cy="10" r="2.5" /></>),
  send: (<path d="M21 3.5 10.5 14M21 3.5l-6.5 17-4-7-7-4L21 3.5z" />),
  copy: (<><rect x="9" y="9" width="11.5" height="11.5" rx="1.5" /><path d="M5.5 15H4.5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1H14a1 1 0 0 1 1 1v1" /></>),
};

const FILLED = new Set(['star']);

const Icon = ({ name, size = 20, strokeWidth = 1.7, className = '', label }) => {
  const glyph = paths[name];
  if (!glyph) return null;
  return (
    <svg
      className={`icon${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={FILLED.has(name) ? 'currentColor' : 'none'}
      stroke={FILLED.has(name) ? 'none' : 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {glyph}
    </svg>
  );
};

export default Icon;