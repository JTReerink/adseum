import { WIGGLE_DIST, rand } from './config.js';

const getHeroScrollProgress = () => {
    const hero = document.getElementById('hero');
    if (!hero) return 0;

    return gsap.utils.clamp(0, 1, -hero.getBoundingClientRect().top / Math.max(hero.offsetHeight, 1));
};

const syncHeroSubtitle = (subtitle, progress = 0) => {
    if (!subtitle) return;

    if (!document.body.classList.contains('intro-complete')) {
        gsap.set(subtitle, { opacity: 0, y: 16, overwrite: 'auto' });
        return;
    }

    const fadeProgress = gsap.utils.clamp(0, 1, progress / 0.35);
    gsap.set(subtitle, {
        opacity: 1 - fadeProgress,
        y: -10 * fadeProgress,
        overwrite: 'auto'
    });
};

const revealIntroChrome = () => {
    if (document.body.classList.contains('intro-complete')) return;

    document.body.classList.add('intro-complete');

    const subtitle = document.querySelector('.subtitle-anim');
    const navLinks = document.getElementById('nav-links');
    const hamburger = document.getElementById('hamburger-btn');

    const tl = gsap.timeline({
        defaults: {
            ease: 'power2.out'
        }
    });

    if (navLinks) {
        tl.fromTo(navLinks, {
            opacity: 0,
            y: -12
        }, {
            opacity: 1,
            y: 0,
            duration: 0.6
        }, 0);
    }

    if (hamburger) {
        tl.fromTo(hamburger, {
            opacity: 0,
            y: -12
        }, {
            opacity: 1,
            y: 0,
            duration: 0.6
        }, 0);
    }

    if (subtitle) {
        const heroScrollProgress = getHeroScrollProgress();

        if (heroScrollProgress <= 0.02) {
            tl.fromTo(subtitle, {
                opacity: 0,
                y: 16
            }, {
                opacity: 1,
                y: 0,
                duration: 0.8
            }, 0.15);
        } else {
            syncHeroSubtitle(subtitle, heroScrollProgress);
        }
    }
};

// 1. Entrance (Staggered fade in/scale)
export const animateDots = (container = document) => {
    const parent = typeof container === 'string' ? document.querySelector(container) : container;

    // Only block interaction for the main logo animation (when no container is provided or explicitly logo)
    const isMainLogo = container === document || container === '#logo-grid' || (parent && parent.id === 'hero');
    if (isMainLogo) {
        window.isAnimationComplete = false;
    }
    console.log("animateDots triggered for:", container);

    const siteContent = window.siteContent || {};
    const animationPause = typeof siteContent.animationPause === 'number' ? siteContent.animationPause : 1.5;
    const animationSpeed = typeof siteContent.animationSpeed === 'number' ? siteContent.animationSpeed : 1.0;

    const tl = gsap.timeline();
    tl.timeScale(animationSpeed);

    if (!parent) return;

    const allDots = Array.from(parent.querySelectorAll('.dot-wrapper svg'));
    const inkDots = allDots.filter((dot) =>
        dot.getAttribute('data-type') === 'ink' && dot.getAttribute('data-animation-mode') !== 'rain'
    );
    const rainDots = allDots.filter((dot) =>
        dot.getAttribute('data-type') === 'standard' || dot.getAttribute('data-animation-mode') === 'rain'
    );

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
        //
        // NOTE: getBoundingClientRect() returns viewport-relative coords. If the user has scrolled
        // before the animation runs, rect.top can be negative (dot above viewport) or > innerHeight
        // (dot below viewport). We clamp the reference point to the visible area so the random
        // spawn zone always maps to something on screen.
        const rawCenterX = rect.left + (rect.width / 2);
        const rawCenterY = rect.top + (rect.height / 2);
        const initialCenterX = gsap.utils.clamp(0, window.innerWidth, rawCenterX);
        const initialCenterY = gsap.utils.clamp(0, window.innerHeight, rawCenterY);

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
            }, `+=${animationPause}`) // Configurable pause before converging
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

                // Snap all ink dots back to their natural grid position (x:0, y:0).
                // If the user scrolled during the intro animation, GSAP's scroll-driven
                // tween on logo-grid may have left the dots with a stale x/y offset.
                // Resetting here ensures they always land in the correct place.
                const logoGrid = document.getElementById('logo-grid');
                if (logoGrid) {
                    logoGrid.querySelectorAll('.dot-wrapper svg[data-type="ink"]').forEach(dot => {
                        gsap.set(dot, {
                            x: 0,
                            y: 0,
                            width: dot.getAttribute('data-std-size'),
                            height: dot.getAttribute('data-std-size'),
                            overwrite: true
                        });
                        const path = dot.querySelector('path');
                        if (path) {
                            const stdD = path.getAttribute('data-std-d');
                            if (stdD) gsap.set(path, { attr: { d: stdD } });
                            path._morphState = 'standard';
                        }
                    });
                }

                revealIntroChrome();
                // Refresh ScrollTrigger now that the viewport is stable and the
                // logo is in its final resting position — fixes cold-start sizing issues
                if (window.ScrollTrigger) ScrollTrigger.refresh();
            }
        }
    }, inkDots.length > 0 ? "-=1.5" : 0); // Overlap with ink animation only if ink dots exist
};

export const initNavScrollAnimation = () => {
    const logoGrid = document.getElementById('logo-grid');
    const navLogoEl = document.getElementById('nav-logo');
    const navbar = document.getElementById('navbar');
    const subtitle = document.querySelector('.subtitle-anim');

    if (!logoGrid || !navLogoEl || !navbar) return;

    // Clear any GSAP state from a previous run
    gsap.set(logoGrid, { clearProps: 'all' });

    // Reveal nav-logo dots; container stays hidden until hero exits viewport
    gsap.set('#nav-logo .dot-wrapper svg', { opacity: 1, scale: 1, x: 0, y: 0 });
    navLogoEl.style.opacity = '0';

    // Measure logo's natural screen position, then lift it to position:fixed so it
    // stays visible as the hero section scrolls away beneath it
    const logoRect = logoGrid.getBoundingClientRect();
    const navRect = navLogoEl.getBoundingClientRect();
    const deltaX = navRect.left - logoRect.left;
    const deltaY = navRect.top - logoRect.top;
    const targetScale = navRect.height / logoRect.height;

    gsap.set(logoGrid, {
        position: 'fixed',
        top: logoRect.top,
        left: logoRect.left,
        width: logoRect.width,
        height: logoRect.height,
        margin: 0,
        zIndex: 51, // Above navbar so it appears to fly into position
        transformOrigin: 'top left',
    });

    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: '#hero',
            start: 'top top',
            end: 'bottom top', // Animation runs exactly as hero scrolls out (100vh)
            scrub: 1,
            onUpdate: (self) => {
                if (subtitle) {
                    syncHeroSubtitle(subtitle, self.progress);
                }
            },
            onLeave: () => {
                // Logo has landed at nav corner — swap to nav logo instantly
                navLogoEl.style.opacity = '1';
                gsap.set(logoGrid, { opacity: 0 });
            },
            onEnterBack: () => {
                // User scrolled back into hero — restore hero logo
                navLogoEl.style.opacity = '0';
                gsap.set(logoGrid, { opacity: 1 });
            },
        }
    });

    // Logo physically flies from hero center to navbar corner
    tl.to(logoGrid, {
        duration: 1,
        x: deltaX,
        y: deltaY,
        scale: targetScale,
        ease: 'power2.inOut',
    }, 0);

    tl.to('.blob', { duration: 0.5, opacity: 0, ease: 'power1.in' }, 0);
    tl.to(navbar, {
        duration: 0.6,
        backgroundColor: 'rgba(253,253,253,0.95)',
        boxShadow: '0 1px 20px rgba(0,0,0,0.06)',
        ease: 'power1.out',
    }, 0.2);
};

export const initDotReverseAnimation = () => {
    // Remove any overlay from a previous call (e.g. on re-render)
    document.querySelector('[data-dot-reverse]')?.remove();

    const logoGrid = document.getElementById('logo-grid');
    if (!logoGrid) return;

    const inkDots = Array.from(logoGrid.querySelectorAll('.dot-wrapper svg[data-type="ink"]'));
    if (!inkDots.length) return;

    // Fixed overlay sits below the flying logo (z-index 51) and navbar (z-index 100).
    // Hidden until the intro animation finishes so clones don't appear during the ink-to-dots sequence.
    const overlayEl = document.createElement('div');
    overlayEl.setAttribute('data-dot-reverse', '');
    overlayEl.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:49;overflow:visible;opacity:0;';
    document.body.appendChild(overlayEl);

    // Pre-create clones off-screen; positions and tweens are set in revealOverlay once the
    // intro is done and getBoundingClientRect() reflects the dots' true settled positions.
    const cloneData = inkDots.map(svg => {
        const path = svg.querySelector('path');
        const inkD = path?.getAttribute('data-ink-d');
        const stdD = path?.getAttribute('data-std-d');
        const inkSize = parseFloat(svg.getAttribute('data-ink-size'));
        const stdSize = parseFloat(svg.getAttribute('data-std-size'));
        if (!path || !inkD || !stdD || !inkSize || !stdSize) return null;

        const clone = svg.cloneNode(true);
        const clonePath = clone.querySelector('path');
        overlayEl.appendChild(clone);
        gsap.set(clone, { position: 'absolute', left: -9999, top: -9999, opacity: 0 });

        return { svg, path, clone, clonePath, inkD, stdD, inkSize, stdSize };
    }).filter(Boolean);

    // Scrubbed timeline — tweens added in revealOverlay after measuring final positions
    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: '#hero',
            start: 'top top',
            end: 'bottom top',
            scrub: 1,
        },
    });

    const revealOverlay = () => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // If the user scrolled during the intro, logo-grid already has a mid-scroll
        // GSAP transform (x/y/scale) from the nav-scroll animation. Measuring
        // getBoundingClientRect() now would give shifted positions.
        // Fix: temporarily reset logo-grid to its scroll=0 state, measure, then
        // restore. getBoundingClientRect() triggers a layout reflow but NOT a paint,
        // so this all happens within one JS frame with no visible flash.
        const logoGrid = document.getElementById('logo-grid');
        let savedX = 0, savedY = 0, savedScale = 1;
        if (logoGrid) {
            savedX = gsap.getProperty(logoGrid, 'x') || 0;
            savedY = gsap.getProperty(logoGrid, 'y') || 0;
            savedScale = gsap.getProperty(logoGrid, 'scale') || 1;
            if (savedX !== 0 || savedY !== 0 || savedScale !== 1) {
                gsap.set(logoGrid, { x: 0, y: 0, scale: 1 });
            }
        }

        cloneData.forEach(({ svg, clone, clonePath, inkD, stdD, inkSize, stdSize }) => {
            // Measure the dot's exact screen position at scroll=0 (logo in hero center)
            const rect = svg.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;

            gsap.set(clone, {
                left: cx - stdSize / 2,
                top: cy - stdSize / 2,
                width: stdSize,
                height: stdSize,
                x: 0,
                y: 0,
                scale: 1,
                opacity: 1,
                transformOrigin: 'center center',
            });
            if (clonePath && stdD) gsap.set(clonePath, { attr: { d: stdD } });

            const inkScale = inkSize / stdSize;
            const targetCX = inkSize / 2 + Math.random() * (vw - inkSize);
            const targetCY = inkSize / 2 + Math.random() * (vh - inkSize);
            const targetX = targetCX - cx;
            const targetY = targetCY - cy;

            tl.to(clone, {
                opacity: 0.3,
                scale: inkScale,
                x: targetX,
                y: targetY,
                duration: 1,
                ease: 'power3.inOut',
            }, 0);

            if (clonePath && inkD) {
                tl.to(clonePath, {
                    attr: { d: inkD },
                    duration: 1,
                    ease: 'power2.inOut',
                }, 0);
            }
        });

        // Restore logo-grid to its actual current scroll-driven transform position
        if (logoGrid && (savedX !== 0 || savedY !== 0 || savedScale !== 1)) {
            gsap.set(logoGrid, { x: savedX, y: savedY, scale: savedScale });
        }

        // Show overlay and hide originals in the same paint — no gap, no jump
        gsap.set(overlayEl, { opacity: 1 });
        inkDots.forEach(svg => gsap.set(svg, { opacity: 0 }));

        // If the user already scrolled during the intro, seek the scrubbed timeline
        // to the current scroll progress so the dots instantly reflect the right state
        // (e.g. 50% scrolled → 50% scatter) instead of snapping from 0% to current.
        if (tl.scrollTrigger) {
            tl.scrollTrigger.update();
        }
    };

    if (document.body.classList.contains('intro-complete')) {
        revealOverlay();
    } else {
        const observer = new MutationObserver(() => {
            if (document.body.classList.contains('intro-complete')) {
                observer.disconnect();
                revealOverlay();
            }
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
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
            start: "top bottom",
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

    // 2. Background Breathing
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

    // 3. Interactive Wiggle & Morph
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
                            const hoverInkGrowth = parseFloat(dot.getAttribute('data-hover-ink-growth') || '1');
                            const adjustedInkScale = 1 + ((inkScale - 1) * hoverInkGrowth);

                            // Bring to front (but keep behind black dots)
                            // Black dots are z-index 20. Colored are 10.
                            // Hovered colored dot should be > 10 but < 20.
                            if (dot.parentElement) dot.parentElement.style.zIndex = 15;

                            gsap.to(dot, {
                                scale: adjustedInkScale, // Use scale for smoother visual pop
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
