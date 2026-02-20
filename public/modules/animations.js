import { WIGGLE_DIST, rand } from './config.js';

// 1. Entrance (Staggered fade in/scale)
// 1. Entrance (Ink Converge & Rain)
// 1. Entrance (Ink Converge & Rain)
export const animateDots = () => {
    window.isAnimationComplete = false; // Disable interaction start
    const tl = gsap.timeline();


    const inkDots = document.querySelectorAll('.dot-wrapper svg[data-type="ink"]');
    const rainDots = document.querySelectorAll('.dot-wrapper svg[data-type="standard"]');

    // Prepare Ink Dots (Scattered, Large, Ink Shape)
    inkDots.forEach(dot => {
        const path = dot.querySelector('path');
        // Attributes are on the PATH element, not the SVG
        const inkD = path ? path.getAttribute('data-ink-d') : null;
        const inkSize = dot.getAttribute('data-ink-size'); // Size is on SVG

        // Random start position (scattered)
        // Using a wider range to simulate them coming from "everywhere"
        const startX = rand(-window.innerWidth / 2, window.innerWidth / 2);
        const startY = rand(-window.innerHeight / 2, window.innerHeight / 2);

        // Initial Large Splatter Size
        // "Fill half the screen" - let's make them quite large relative to viewport
        const minDim = Math.min(window.innerWidth, window.innerHeight);
        const startSize = rand(minDim * 0.4, minDim * 0.6); // 40-60% of screen min dimension

        gsap.set(dot, {
            x: startX,
            y: startY,
            width: startSize, // Start HUGE
            height: startSize,
            opacity: 0,
            scale: 1 // Ensure scale is 1, size handled by width/height
        });

        if (path && inkD) {
            gsap.set(path, { attr: { d: inkD } });
            // Ensure morph state tracks visual state
            path._morphState = 'ink';
        }
    });

    // Prepare Rain Dots (Above screen)
    gsap.set(rainDots, {
        y: -window.innerHeight,
        opacity: 0,
        scale: 1 // FIX: Ensure they are visible (initially scale(0))
    });

    // Animate Ink Dots Sequence
    // 1. Fade In Large Splatters
    tl.to(inkDots, {
        duration: 0.5,
        opacity: 1,
        ease: "power2.out",
        stagger: {
            amount: 0.5,
            from: "random"
        }
    })

        // 2. Converge to Grid (after 2.5s delay)
        .to(inkDots, {
            duration: 3.5, // Slower converge
            x: 0,
            y: 0,
            ease: "power3.inOut", // Changed to inOut for smoother start/end of large move
            stagger: {
                amount: 1,
                from: "random"
            }
        }, "+=1.5") // Wait 1.5 seconds (Stay big a little longer)
        .to(inkDots, {
            scale: 1, // Shrink back to standard size (via scale) - Wait, we removed this in previous step? No, we didn't touch this anim block yet.
            // Oh right, the previous step only touched mousemove.
            // But wait, the startup animation sets WIDTH/HEIGHT.
            // We should use SCALE here too if we want consistency?
            // Actually, for startup, we want it to shrink.
            // Let's use duration 3.5 for move and shrink.
            duration: 3.5, // Slower shrink
            width: (i, target) => target.getAttribute('data-std-size'),
            height: (i, target) => target.getAttribute('data-std-size'),
            ease: "power2.inOut"
        }, "<") // Start sizing same time as movement
        .to(inkDots.length > 0 ? Array.from(inkDots).map(d => d.querySelector('path')) : [], {
            attr: { d: (i, target) => target.getAttribute('data-std-d') },
            duration: 1.5,
            ease: "power2.inOut",
            onComplete: () => {
                // Reset morph state to standard so interaction works correctly
                inkDots.forEach(d => {
                    const p = d.querySelector('path');
                    if (p) p._morphState = 'standard';
                });
            }
        }, "<");
    // Animate Rain Dots Falling
    tl.to(rainDots, {
        duration: 0.8, // Faster fall
        y: 0,
        opacity: 1,
        ease: "power2.out", // Changed from bounce.out
        stagger: {
            amount: 1, // Tighter stagger
            from: "random",
            grid: "auto"
        },
        onComplete: () => {
            window.isAnimationComplete = true; // Enable interaction
        }
    }, "-=1.5"); // Overlap with ink animation
};

export const initAnimations = () => {
    animateDots();

    // 2. Subtitle entrance
    gsap.to(".subtitle-anim", {
        opacity: 1,
        delay: 1.5,
        duration: 1
    });

    // 3. Background Breathing
    gsap.to(".blob", {
        scale: 1.2,
        duration: "random(4, 6)",
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        stagger: 1
    });

    gsap.to(".blob", {
        x: "random(-20, 20)",
        y: "random(-20, 20)",
        rotation: "random(-10, 10)",
        duration: "random(5, 8)",
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        stagger: 0.5
    });

    // 4. Interactive Wiggle & Morph
    window.updateWiggleTargets = () => {
        window.wiggleDots = document.querySelectorAll('.dot-wrapper svg');
    };
    window.updateWiggleTargets();

    window.addEventListener('mousemove', (e) => {
        if (!window.wiggleDots || !window.isAnimationComplete) return; // Check flag

        const mouseX = e.clientX;
        const mouseY = e.clientY;

        window.wiggleDots.forEach(dot => {
            const rect = dot.getBoundingClientRect();
            const dotX = rect.left + rect.width / 2;
            const dotY = rect.top + rect.height / 2;

            const dist = Math.hypot(mouseX - dotX, mouseY - dotY);

            // Interaction: Movement
            if (dist < WIGGLE_DIST) {
                const angle = Math.atan2(mouseY - dotY, mouseX - dotX);
                const force = (WIGGLE_DIST - dist) / WIGGLE_DIST; // 0 to 1

                const moveX = Math.cos(angle) * -15 * force;
                const moveY = Math.sin(angle) * -15 * force; // Move away

                gsap.to(dot, {
                    x: moveX,
                    y: moveY,
                    duration: 0.4,
                    ease: "power2.out",
                    overwrite: "auto"
                });
            } else {
                gsap.to(dot, {
                    x: 0,
                    y: 0,
                    duration: 0.6,
                    ease: "elastic.out(1, 0.5)",
                    overwrite: "auto"
                });
            }

            // Interaction: Morphing (Ink to Standard & Size Change)
            const path = dot.querySelector('path');
            if (path && path.getAttribute('data-type') === 'ink') {
                const standardD = path.getAttribute('data-std-d');
                const inkD = path.getAttribute('data-ink-d');

                // Retrieve sizes from the SVG element (dot)
                const inkSize = dot.getAttribute('data-ink-size');
                const stdSize = dot.getAttribute('data-std-size');

                // We use a property on the element to avoid constant re-triggering
                // 1 = morphed (standard), 0 = original (ink)
                // REVERSED DEFAULT: We start as 'standard' visually now
                const currentMorphState = path._morphState || 'standard';

                if (dist < WIGGLE_DIST) {
                    if (currentMorphState !== 'ink') {
                        path._morphState = 'ink';

                        // Morph Shape -> Ink
                        gsap.to(path, {
                            attr: { d: inkD },
                            duration: 0.3,
                            ease: "back.out(1.7)", // More dramatic pop
                            overwrite: "auto"
                        });

                        // Morph Size -> Ink (Grow via Scale)
                        const inkScale = inkSize / stdSize;

                        // Bring to front (but keep behind black dots)
                        // Black dots are z-index 20. Colored are 10.
                        // Hovered colored dot should be > 10 but < 20.
                        if (dot.parentElement) dot.parentElement.style.zIndex = 15;

                        gsap.to(dot, {
                            scale: inkScale, // Use scale for smoother visual pop
                            duration: 0.3,
                            ease: "back.out(1.7)",
                            overwrite: "auto"
                        });
                    }
                } else {
                    if (currentMorphState !== 'standard') {
                        path._morphState = 'standard';

                        // Morph Shape -> Standard
                        gsap.to(path, {
                            attr: { d: standardD },
                            duration: 0.5,
                            ease: "power2.out",
                            overwrite: "auto"
                        });

                        // Reset Z-Index
                        if (dot.parentElement) dot.parentElement.style.zIndex = "";

                        // Morph Size -> Standard (Shrink via Scale)
                        gsap.to(dot, {
                            scale: 1, // Return to base size
                            duration: 0.5,
                            ease: "power2.out",
                            overwrite: "auto"
                        });
                    }
                }
            }
        });
    });
};
