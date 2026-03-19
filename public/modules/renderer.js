import { DOT_SIZE, DOT_SPACING, LETTER_SPACING } from './config.js';
import { createDot } from './dot.js';

export const renderLetter = (char, grid, options = {}) => {
    const dotSize = options.dotSize || DOT_SIZE;
    const sizeRatio = dotSize / DOT_SIZE;

    // Scale the intra-letter dot gap exactly proportionally to the downscaled dotSize
    const gap = options.gap !== undefined ? options.gap : (DOT_SPACING * sizeRatio);
    const colorMap = options.colorMap || {};

    const letterCol = document.createElement('div');
    letterCol.className = 'grid';
    letterCol.style.display = 'grid';
    letterCol.style.gridTemplateColumns = `repeat(${grid[0].length}, 1fr)`;
    // Apply gap but ensure it can drop to sub-pixel values (don't floor it if we need tight packing)
    letterCol.style.gap = `${gap}px`;

    grid.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            if (cell === 1) {
                const key = `${rowIndex},${colIndex}`;
                let color = 'black';

                if (!options.monochrome && colorMap[key]) {
                    color = colorMap[key];
                }

                const dotWrapper = document.createElement('div');
                dotWrapper.className = 'dot-wrapper flex justify-center items-center';
                dotWrapper.style.width = `${dotSize}px`;
                dotWrapper.style.height = `${dotSize}px`;
                // Higher Z-Index for Colored Dots? NO, User wants them BEHIND black dots.
                // Black dots (standard) should be on top.
                if (color !== 'black') {
                    dotWrapper.style.zIndex = 10; // Lower z-index for colored
                } else {
                    dotWrapper.style.zIndex = 20; // Higher z-index for black
                }
                dotWrapper.style.position = 'relative'; // Ensure z-index works

                const dot = createDot(color, { dotSize });
                dotWrapper.appendChild(dot);
                letterCol.appendChild(dotWrapper);
            } else {
                // Empty space
                const spacer = document.createElement('div');
                spacer.style.width = `${dotSize}px`;
                spacer.style.height = `${dotSize}px`;
                letterCol.appendChild(spacer);
            }
        });
    });
    return letterCol;
};

export const renderText = (containerId, text, options = {}) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Apply letter spacing from config
    const letterGap = options.letterSpacing !== undefined ? options.letterSpacing : LETTER_SPACING;
    container.style.gap = `${letterGap}px`;

    // Calculate optimal dotSize if none provided or to ensure it fits container width
    let finalOptions = { ...options };

    // Only calculate dynamic size if we are trying to fit the container width
    if (container.clientWidth > 0) {
        let totalColumns = 0;
        const validChars = [];

        // Sum up total columns needed
        text.split('').forEach(char => {
            const key = Object.keys(window.letters || {}).find(k => k === char) || char;
            if (window.letters && window.letters[key]) {
                totalColumns += window.letters[key][0].length;
                validChars.push(key);
            } else {
                console.warn(`Letter '${char}' not found in configuration.`);
            }
        });

        const containerWidth = container.offsetWidth || window.innerWidth;

        if (totalColumns > 0) {
            // Calculate available width minus all the gaps between letters and some padding
            const numGaps = validChars.length > 1 ? validChars.length - 1 : 0;
            const availableWidth = containerWidth - (numGaps * letterGap) - 40;

            // Calculate the ideal size of a single dot
            // We know each dot essentially takes up 1 part dotSize + some proportional gap
            const gapRatio = DOT_SPACING / DOT_SIZE;
            const widthPerColumn = 1 + gapRatio; // 1 unit for dot + ratio for gap

            let calculatedSize = availableWidth / (totalColumns * widthPerColumn);

            // Cap it at a maximum (either options.dotSize or DOT_SIZE) and minimum of 2
            const maxSize = options.dotSize || DOT_SIZE;
            finalOptions.dotSize = Math.max(2, Math.min(calculatedSize, maxSize));

            // Keep decimal precision for smooth sub-pixel fitting on mobile layout
            // finalOptions.dotSize = Math.max(2, Math.floor(finalOptions.dotSize));
        }
    }

    // Split text into words to prevent letters wrapping individually
    const words = text.split(' ');

    words.forEach((word, wordIndex) => {
        const wordContainer = document.createElement('div');
        wordContainer.style.display = 'flex';
        wordContainer.style.flexWrap = 'nowrap';
        wordContainer.style.gap = `${letterGap}px`;

        word.split('').forEach(char => {
            const key = Object.keys(window.letters || {}).find(k => k === char) || char;
            if (window.letters && window.letters[key]) {
                const charOptions = {
                    ...finalOptions,
                    colorMap: (window.letterColors && window.letterColors[key]) || {}
                };
                wordContainer.appendChild(renderLetter(key, window.letters[key], charOptions));
            }
        });

        container.appendChild(wordContainer);

        // If not the last word, we can add a space element (or let the container's gap handle it)
        // We'll rely on the main container's gap-y or gap-x for spacing between words
        // Let's explicitly add a space if needed to maintain sentence structure if it doesn't wrap
        if (wordIndex < words.length - 1) {
            const space = document.createElement('div');
            // Make space width equivalent to roughly 2 letters + gaps
            space.style.width = `${(finalOptions.dotSize * 10) + letterGap}px`;
            container.appendChild(space);
        }
    });
};
