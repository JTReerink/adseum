// Configuration
export const DOT_SIZE = 25;
export const DOT_SPACING = 6; // Spacing between dots within a letter
export const LETTER_SPACING = 0; // Spacing between letters
export const WIGGLE_DIST = 100;

export const palette = ['#FF7000', '#325AF1', '#FFE600', '#FF0C0D', '#10B981', '#EC4899']; // Orange, Blue, Yellow, Red, Green, Pink

// Helper: Random float between min/max
export const rand = (min, max) => Math.random() * (max - min) + min;
