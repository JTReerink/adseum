import { DOT_SPACING, LETTER_SPACING, palette, rand } from './config.js';
import { createDot } from './dot.js';

export const renderLetter = (char, grid) => {
    const letterCol = document.createElement('div');
    letterCol.className = 'grid gap-1';
    letterCol.style.display = 'grid';
    letterCol.style.gridTemplateColumns = `repeat(${grid[0].length}, 1fr)`;
    letterCol.style.gap = `${DOT_SPACING}px`;

    // 1. Identify valid dot positions associated with this letter
    const validPositions = [];
    grid.forEach((row, r) => {
        row.forEach((cell, c) => {
            if (cell === 1) validPositions.push({ r, c });
        });
    });

    // 2. determine how many colored dots (1 to 3, but not more than total dots)
    const numColored = Math.floor(rand(1, 4)); // 1, 2, or 3
    const count = Math.min(numColored, validPositions.length);

    // 3. Randomly select unique positions
    const coloredIndices = new Set();
    while (coloredIndices.size < count) {
        const idx = Math.floor(Math.random() * validPositions.length);
        coloredIndices.add(idx);
    }

    // Convert to a quick lookup string "r,c"
    const coloredPosStrings = new Set();
    coloredIndices.forEach(idx => {
        const p = validPositions[idx];
        coloredPosStrings.add(`${p.r},${p.c}`);
    });

    grid.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            if (cell === 1) {
                // Check if this position was selected for color
                const key = `${rowIndex},${colIndex}`;
                let color = 'black';

                if (coloredPosStrings.has(key)) {
                    color = palette[Math.floor(Math.random() * palette.length)];
                }

                const dotWrapper = document.createElement('div');
                dotWrapper.className = 'dot-wrapper flex justify-center items-center w-3 h-3 md:w-4 md:h-4';
                // Higher Z-Index for Colored Dots? NO, User wants them BEHIND black dots.
                // Black dots (standard) should be on top.
                if (color !== 'black') {
                    dotWrapper.style.zIndex = 10; // Lower z-index for colored
                } else {
                    dotWrapper.style.zIndex = 20; // Higher z-index for black
                }
                dotWrapper.style.position = 'relative'; // Ensure z-index works

                const dot = createDot(color);
                dotWrapper.appendChild(dot);
                letterCol.appendChild(dotWrapper);
            } else {
                // Empty space
                const spacer = document.createElement('div');
                spacer.className = 'w-3 h-3 md:w-4 md:h-4';
                letterCol.appendChild(spacer);
            }
        });
    });
    return letterCol;
};

export const renderText = (containerId, text) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Apply letter spacing from config
    // container.style.gap = `${LETTER_SPACING}px`; 
    // Commented out as explicitly set to 0 in HTML/CSS logic previously, or we can enforce it here:
    container.style.gap = `${LETTER_SPACING}px`;

    text.split('').forEach(char => {
        // Handle case sensitivity if needed, currently matching keys exactly
        // Access 'letters' from global window scope as it's defined in letters.js
        const key = Object.keys(window.letters || {}).find(k => k === char) || char;
        if (window.letters && window.letters[key]) {
            container.appendChild(renderLetter(key, window.letters[key]));
        } else {
            console.warn(`Letter '${char}' not found in configuration.`);
        }
    });
};
