// Configuration
export const DOT_SIZE = 25;
export const DOT_SPACING = 6; // Spacing between dots within a letter
export const LETTER_SPACING = 0; // Spacing between letters
export const WIGGLE_DIST = 100;

export const DEFAULT_DOT_PALETTE = ['#FF7000', '#325AF1', '#FF85AA', '#50C8FF', '#FFE600', '#AA1EAA', '#FF0000', '#5AD836', '#964B00', '#FFFFFF']; // Orange, Blue, Pink, Light Blue, Yellow, Purple, Red, Green, Brown, White
export const palette = DEFAULT_DOT_PALETTE;
export const SECTION_MENU_USES_DOTS = false;
export const SECTION_TITLE_USES_DOTS = true;

// Helper: Random float between min/max
export const rand = (min, max) => Math.random() * (max - min) + min;
