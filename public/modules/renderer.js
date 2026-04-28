import { DEFAULT_DOT_PALETTE, DOT_SIZE, DOT_SPACING, LETTER_SPACING } from './config.js';
import { normalizeHexColor } from './database.js';
import { createDot } from './dot.js';

export const renderLetter = (char, grid, options = {}) => {
    const dotSize = options.dotSize || DOT_SIZE;
    const sizeRatio = dotSize / DOT_SIZE;

    // Scale the intra-letter dot gap exactly proportionally to the downscaled dotSize
    const gap = options.gap !== undefined ? options.gap : (DOT_SPACING * sizeRatio);
    const colorMap = options.colorMap || {};
    const offsetMap = options.offsetMap || {};
    const allowedPalette = new Set(Array.isArray(window.dotPalette) && window.dotPalette.length > 0 ? window.dotPalette : DEFAULT_DOT_PALETTE);

    const letterCol = document.createElement('div');
    letterCol.className = 'grid';
    letterCol.style.display = 'grid';
    letterCol.style.gridTemplateColumns = `repeat(${grid[0].length}, ${dotSize}px)`;
    letterCol.style.gridAutoRows = `${dotSize}px`;
    letterCol.style.alignContent = 'start'; // Never stretch rows beyond their natural dotSize height
    // Apply gap but ensure it can drop to sub-pixel values (don't floor it if we need tight packing)
    letterCol.style.gap = `${gap}px`;

    grid.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            if (cell === 1) {
                const key = `${rowIndex},${colIndex}`;
                let color = 'black';
                const mappedColor = normalizeHexColor(colorMap[key] || '');

                if (!options.monochrome && mappedColor && allowedPalette.has(mappedColor)) {
                    color = mappedColor;
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

                // Apply dot offset if present
                const offset = offsetMap[key];
                if (offset && (offset.x !== 0 || offset.y !== 0)) {
                    const ox = (offset.x || 0) * sizeRatio;
                    const oy = (offset.y || 0) * sizeRatio;
                    dotWrapper.style.transform = `translate(${ox}px, ${oy}px)`;
                }

                const dot = createDot(color, {
                    dotSize,
                    visualScale: options.visualScale
                });
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

    const textValue = typeof text === 'string' ? text.trim() : '';
    const exactLetterKey = textValue && window.letters && window.letters[textValue] ? textValue : null;

    // Calculate optimal dotSize if none provided or to ensure it fits container width
    let finalOptions = { ...options };
    let letterGap = options.letterSpacing !== undefined ? options.letterSpacing : LETTER_SPACING;

    // Only calculate dynamic size if we are trying to fit the container width
    if (container.clientWidth > 0) {
        let totalColumns = 0;
        const validChars = [];

        // Sum up total columns needed (count only non-space characters)
        [...text].forEach(char => {
            if (char === ' ') return;
            const key = Object.keys(window.letters || {}).find(k => k === char) || char;
            if (window.letters && window.letters[key]) {
                totalColumns += window.letters[key][0].length;
                validChars.push(key);
            } else {
                console.warn(`Letter '${char}' not found in configuration.`);
            }
        });

        // Use inner content width (excludes horizontal padding) for accurate sizing
        const style = window.getComputedStyle(container);
        const paddingX = parseFloat(style.paddingLeft || '0') + parseFloat(style.paddingRight || '0');
        const containerWidth = container.offsetWidth
            ? container.offsetWidth - paddingX
            : window.innerWidth;

        if (totalColumns > 0) {
            // 1-column letter gap between each letter, plus word spaces
            const numLetterGaps = validChars.length > 1 ? validChars.length - 1 : 0;
            const numWordSpaces = text.split(' ').length - 1;

            // Each letter gap = 1 column, each word space = 3 columns
            const effectiveColumns = totalColumns + numLetterGaps + (numWordSpaces * 3);

            // Calculate the ideal size of a single dot
            const gapRatio = DOT_SPACING / DOT_SIZE;
            const widthPerColumn = 1 + gapRatio; // 1 unit for dot + ratio for gap

            const availableWidth = containerWidth - 8;
            let calculatedSize = availableWidth / (effectiveColumns * widthPerColumn);

            // Cap it at a maximum (either options.dotSize or DOT_SIZE) and minimum of 2
            const maxSize = options.dotSize || DOT_SIZE;
            finalOptions.dotSize = Math.max(2, Math.min(calculatedSize, maxSize));

            // Letter gap = 1 column width (dot + intra-dot gap)
            const sizeRatio = finalOptions.dotSize / DOT_SIZE;
            letterGap = finalOptions.dotSize + (DOT_SPACING * sizeRatio);
        }
    }

    // Fallback: If letterGap was not explicitly set and not calculated by width fitting, 
    // calculate a natural 1-column gap based on the dot size.
    if (options.letterSpacing === undefined && (container.clientWidth === 0 || !text)) {
        const currentDotSize = finalOptions.dotSize || DOT_SIZE;
        const sizeRatio = currentDotSize / DOT_SIZE;
        letterGap = currentDotSize + (DOT_SPACING * sizeRatio);
    }

    // Use a single flex row for all words, centered together
    const rowContainer = document.createElement('div');
    rowContainer.style.display = 'flex';
    rowContainer.style.flexWrap = 'wrap';
    rowContainer.style.justifyContent = 'center';
    rowContainer.style.alignItems = 'flex-end'; // Align letters at the bottom baseline, never stretch
    rowContainer.style.width = '100%';
    rowContainer.style.gap = `${letterGap}px`;

    const words = exactLetterKey ? [exactLetterKey] : text.split(' ');

    words.forEach((word, wordIndex) => {
        // Add a spacer between words (wider than letter gap)
        if (!exactLetterKey && wordIndex > 0) {
            const space = document.createElement('div');
            space.style.width = `${letterGap * 2}px`;
            rowContainer.appendChild(space);
        }

        if (exactLetterKey) {
            const key = exactLetterKey;
            if (window.letters && window.letters[key]) {
                const charOptions = {
                    ...finalOptions,
                    colorMap: (window.letterColors && window.letterColors[key]) || {},
                    offsetMap: (window.letterOffsets && window.letterOffsets[key]) || {}
                };
                rowContainer.appendChild(renderLetter(key, window.letters[key], charOptions));
            }
            return;
        }

        word.split('').forEach(char => {
            const key = Object.keys(window.letters || {}).find(k => k === char) || char;
            if (window.letters && window.letters[key]) {
                const charOptions = {
                    ...finalOptions,
                    colorMap: (window.letterColors && window.letterColors[key]) || {},
                    offsetMap: (window.letterOffsets && window.letterOffsets[key]) || {}
                };
                rowContainer.appendChild(renderLetter(key, window.letters[key], charOptions));
            }
        });
    });

    container.appendChild(rowContainer);
};
