import { WIGGLE_DIST, rand } from './config.js';

// 1. Entrance (Staggered fade in/scale)
export const animateDots = (container = document) => {
    const parent = typeof container === 'string' ? document.querySelector(container) : container;

    // Only block interaction for the main logo animation (when no container is provided or explicitly logo)
    const isMainLogo = container === document || container === '#logo-grid' || (parent && parent.id === 'hero');
    if (isMainLogo) {
        window.isAnimationComplete = false;
    }
    console.log("animateDots triggered for:", container);
    const tl = gsap.timeline();

    if (!parent) return;

    const inkDots = parent.querySelectorAll('.dot-wrapper svg[data-type="ink"]');
    const rainDots = parent.querySelectorAll('.dot-wrapper svg[data-type="standard"]');

    // Fail-safe: if there are no dots at all, exit the animation to prevent errors
    if (inkDots.length === 0 && rainDots.length === 0) {
        console.warn("No dots found in", container, "skipping animation.");
        return;
    }

    console.log(`Found ${inkDots.length} ink dots and ${rainDots.length} rain dots.`);
    inkDots.forEach(dot => {
        const path = dot.querySelector('path');
        // Attributes are on the PATH element, not the SVG
        const inkD = path ? path.getAttribute('data-ink-d') : null;
        const inkSize = dot.getAttribute('data-ink-size'); // Size is on SVG

        // Initial Large Splatter Size
        // Cap the maximum size to 80% of window width so it physically can't blow out mobile screens
        const minDim = Math.min(window.innerWidth, window.innerHeight);
        let startSize = rand(minDim * 0.2, minDim * 0.4); // 20-40% of screen min dimension
        startSize = Math.min(startSize, window.innerWidth * 0.8);

        // Random start position (scattered)
        // Constrain startX tightly so the blob's right edge NEVER exceeds the exact window bound
        const rect = dot.getBoundingClientRect();

        // Calculate random spawn point using the absolute CENTER of the blob. 
        // Because the blob expands inside a 'flex justify-center' container, its physical top-left moves left by startSize/2.
        // Doing the math purely based on the center-point elegantly neutralizes this flex layout shift!
        const initialCenterX = rect.left + (rect.width / 2);
        const initialCenterY = rect.top + (rect.height / 2);

        const minCenterX = startSize / 2;
        const maxCenterX = window.innerWidth - (startSize / 2);
        const randomCenterX = rand(minCenterX, maxCenterX);

        const minCenterY = startSize / 2;
        const maxCenterY = window.innerHeight - (startSize / 2);
        const randomCenterY = rand(minCenterY, maxCenterY);

        const startX = randomCenterX - initialCenterX;
        const startY = randomCenterY - initialCenterY;

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

    if (inkDots.length > 0) {
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
                duration: 3.5, // Slower shrink
                width: (i, target) => target.getAttribute('data-std-size'),
                height: (i, target) => target.getAttribute('data-std-size'),
                ease: "power2.inOut"
            }, "<") // Start sizing same time as movement
            .to(Array.from(inkDots).map(d => d.querySelector('path')), {
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
    }

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
            // After any animation completes, refresh the target list so hover works
            if (window.updateWiggleTargets) window.updateWiggleTargets();

            const isMainLogo = container === document || container === '#logo-grid' || (parent && parent.id === 'hero');
            if (isMainLogo) {
                window.isAnimationComplete = true; // Enable interaction main logo
            }
        }
    }, inkDots.length > 0 ? "-=1.5" : 0); // Overlap with ink animation only if ink dots exist
};

export const initScrollAnimations = () => {
    gsap.registerPlugin(ScrollTrigger);

    gsap.utils.toArray('section').forEach(section => {
        // Skip the hero section, it is animated separately on load
        if (section.id === 'hero') return;

        // Setup initially hidden state for the heading dots to prevent pop-in before scroll
        const headingDots = section.querySelectorAll('.dot-wrapper svg');
        if (headingDots.length === 0) return; // Skip sections without dots

        gsap.set(headingDots, { opacity: 0 });

        ScrollTrigger.create({
            trigger: section,
            start: "top 85%",
            once: true,
            invalidateOnRefresh: true, // Recalculate triggers naturally if height changes
            markers: false, // Set to true for debugging if needed
            onEnter: () => {
                console.log("ScrollTrigger onEnter for:", section.id);
                animateDots(section);
            }
        });
    });
};

export const initAnimations = (containerSelector) => {
    animateDots(containerSelector);

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
        // Only select dots that have finished animating or are already visible
        // Since dots start with opacity 0 or off-screen, we just select all svgs in dot-wrappers
        window.wiggleDots = document.querySelectorAll('.dot-wrapper svg');
        console.log("Wiggle targets updated:", window.wiggleDots.length);
    };
    window.updateWiggleTargets();

    // Ensure we don't bind multiple listeners if called again
    if (!window.hasWiggleListener) {
        window.hasWiggleListener = true;
        window.addEventListener('mousemove', (e) => {
            // Check global flag - only lock if main logo is hiding everything
            if (window.isAnimationComplete === false) return;
            if (!window.wiggleDots || window.wiggleDots.length === 0) return;

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
    }
};
