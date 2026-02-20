import { DOT_SIZE, rand } from './config.js';

// Helper: Create SVG Dot
export const createDot = (color = 'black') => {
    const isInk = color !== 'black';
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.style.overflow = "visible"; // Prevent clipping at edges
    svg.style.maxWidth = "none"; // FIX: Allow SVG to exceed parent width (Tailwind reset)
    // Initial hidden state to prevent flash before animation
    svg.style.opacity = "0";
    svg.style.transform = "scale(0) translateY(20px)";

    // Generates a path string for a blob
    const generateBlobPath = (radius, variation, numPoints) => {
        const points = [];
        const centerX = 50, centerY = 50;

        for (let i = 0; i < numPoints; i++) {
            const angle = (Math.PI * 2 * i) / numPoints;
            const r = radius + rand(-variation, variation);
            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;
            points.push({ x, y });
        }

        let d = "";
        const midpoints = points.map((p, i) => {
            const next = points[(i + 1) % points.length];
            return {
                x: (p.x + next.x) / 2,
                y: (p.y + next.y) / 2
            };
        });

        d += `M ${midpoints[0].x} ${midpoints[0].y} `;

        for (let i = 0; i < points.length; i++) {
            const p = points[(i + 1) % points.length];
            const nextMid = midpoints[(i + 1) % midpoints.length];
            d += `Q ${p.x} ${p.y} ${nextMid.x} ${nextMid.y} `;
        }
        d += "Z";
        return d;
    }

    const standardRadius = 35;
    const standardVariation = 5;
    const standardPoints = 8;

    // Always generate the standard path (used for morphing target or default)
    const standardPathData = generateBlobPath(standardRadius, standardVariation, standardPoints);

    let initialPathData = standardPathData;
    let inkPathData = null;

    if (isInk) {
        // Generate a more irregular "ink" path
        const inkRadius = 42; // Larger radius to fill the box more
        const inkVariation = 18; // Heavy irregularity
        const inkPoints = 8; // Match standardPoints (8) to avoid morph artifacts
        inkPathData = generateBlobPath(inkRadius, inkVariation, inkPoints);
        initialPathData = inkPathData;
    }

    const stdSize = DOT_SIZE + rand(-2, 3);
    const inkSize = rand(85, 125); // Adjusted to match reference image (approx 3-4x dot size)

    // Choose initial size
    // REVERSED: Start as standard size, grow to ink size logic handled in mousemove
    const currentSize = stdSize;

    const path = document.createElementNS(ns, "path");
    // REVERSED: Start with standard path
    path.setAttribute("d", standardPathData);
    path.setAttribute("fill", color);

    // Set SVG size
    svg.setAttribute("width", currentSize);
    svg.setAttribute("height", currentSize);

    if (isInk) {
        svg.setAttribute("data-type", "ink");
        path.setAttribute("data-ink-d", inkPathData);
        path.setAttribute("data-std-d", standardPathData);

        // Store sizes on the PATH or SVG? 
        // Logic currently selects the SVG for wiggle, but finds PATH for data.
        // Let's store on the SVG for easy access during GSAP loop on 'dot' (which is the svg)
        svg.setAttribute("data-ink-size", inkSize);
        svg.setAttribute("data-std-size", stdSize);

        // Also keep data-type on path for the interaction logic if needed, 
        // or just rely on SVG. 
        // The interaction logic (mousemove) looks for: dot.querySelector('path').getAttribute('data-type')
        // So we MUST keep it on path OR update interaction logic.
        // Let's keep it on path for compatibility with existing interaction logic, AND add to SVG for animation logic.
        path.setAttribute("data-type", "ink");
    } else {
        svg.setAttribute("data-type", "standard");
        path.setAttribute("data-type", "standard");
    }

    svg.appendChild(path);
    return svg;
};
