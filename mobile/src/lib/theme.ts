/**
 * Design tokens — the app's entire palette and scale in one place.
 * Screens and components must not hardcode hex values or magic sizes;
 * if a token is missing, add it here so the next screen reuses it.
 * Palette is Untitled UI-derived (grays + blue 700 primary).
 */
export const colors = {
  /** screen background */
  bg: '#f8fafc',
  /** cards, rows, inputs */
  surface: '#ffffff',
  /** hairline borders on cards and rows */
  border: '#eaecf0',
  /** stronger borders: inputs, outlined buttons, pills */
  borderStrong: '#d0d5dd',

  /** headings and emphasized copy */
  text: '#101828',
  /** body copy */
  textBody: '#344054',
  /** secondary copy, field labels */
  textMuted: '#475467',
  /** placeholders, empty states, chevrons, disabled */
  textFaint: '#98a2b3',

  primary: '#175cd3',
  primarySurface: '#eff8ff',
  onPrimary: '#ffffff',

  danger: '#d92d20',
  dangerBorder: '#fda29b',
  dangerSurface: '#fef3f2',

  success: '#067647',
  successSurface: '#ecfdf3',

  warning: '#b54708',
  warningBorder: '#fec84b',
  warningSurface: '#fffaeb',
  /** chips/badges that flag staff-only or elevated things */
  warningChip: '#fef0c7',

  neutralSurface: '#f2f4f7',

  /** unread notification highlight */
  unreadBorder: '#84caff',
  unreadSurface: '#f5faff',

  /** favorite star */
  star: '#eaaa08',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radii = {
  sm: 8,
  md: 10,
  lg: 12,
  pill: 999,
} as const;

export const fontSize = {
  /** captions, badges, metadata */
  xs: 13,
  /** compact body */
  sm: 15,
  /** body, inputs */
  md: 16,
  /** section titles */
  lg: 18,
  /** screen-level headings inside content */
  xl: 22,
  /** auth screen titles */
  xxl: 28,
} as const;
