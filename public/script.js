import { renderText } from './modules/renderer.js';
import { animateDots, initAnimations, initScrollAnimations, initNavScrollAnimation, initDotReverseAnimation } from './modules/animations.js';
import {
    DEFAULT_SITE_CONTENT,
    listenToLetters,
    listenToSiteContent,
    sanitizeRichHtml,
    validateDotText
} from './modules/database.js';

window.renderText = renderText;
window.animateDots = animateDots;
window.initAnimations = initAnimations;

window.letters = {};
window.letterColors = {};
window.letterOffsets = {};
window.siteContent = DEFAULT_SITE_CONTENT;
window.dotPalette = DEFAULT_SITE_CONTENT.dotPalette;

let isFirstFetch = true;
let resizeTimeout;
let lettersReady = false;
let siteContentReady = false;

const navbar = document.getElementById('navbar');
const navLogo = document.getElementById('nav-logo');
const navLinks = document.getElementById('nav-links');
const hamburgerButton = document.getElementById('hamburger-btn');
const mobileMenu = document.getElementById('mobile-menu');
const mobileNavLinks = document.getElementById('mobile-nav-links');
const sectionsRoot = document.getElementById('sections-root');
const heroSubtitle = document.getElementById('hero-subtitle-content');
let mobileMenuOpen = false;

const getSiteContent = () => window.siteContent || DEFAULT_SITE_CONTENT;

function decorateSplitGraphicDots(container) {
    if (!container) return;

    container.querySelectorAll('.dot-wrapper svg').forEach((dot) => {
        dot.setAttribute('data-animation-mode', 'rain');
        dot.setAttribute('data-hover-ink-growth', '0.5');
        dot.setAttribute('data-split-graphic-dot', 'true');
    });
}

function renderSplitGraphic(containerId, graphicName) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const isDesktop = window.innerWidth >= 1024;
    renderText(containerId, graphicName, {
        dotSize: isDesktop ? 22 : 18,
        letterSpacing: isDesktop ? 16 : 14
    });
    decorateSplitGraphicDots(container);
}

function setRichContent(element, html) {
    if (!element) return;
    element.innerHTML = sanitizeRichHtml(html);
}

function renderDotField(container, text, options = {}, fallbackTag = 'div', fallbackClass = '') {
    if (!container) return;

    container.innerHTML = '';
    const missingLetters = validateDotText(text, window.letters || {});

    if (missingLetters.length > 0) {
        const fallback = document.createElement(fallbackTag);
        fallback.className = fallbackClass;
        fallback.textContent = text;
        container.appendChild(fallback);
        return;
    }

    renderText(container.id, text, options);

    if (!container.querySelector('.dot-wrapper')) {
        const fallback = document.createElement(fallbackTag);
        fallback.className = fallbackClass;
        fallback.textContent = text;
        container.appendChild(fallback);
    }
}

function buildNavigation(sections) {
    navLinks.innerHTML = '';
    mobileNavLinks.innerHTML = '';

    sections.forEach((section) => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = `#${section.id}`;
        link.className = section.navUseDots ? 'nav-link nav-link-dots' : 'nav-link';

        if (section.navUseDots) {
            const dotLabel = document.createElement('span');
            dotLabel.id = `nav-label-${section.id}`;
            dotLabel.className = 'nav-dot-label nav-text-label';
            dotLabel.textContent = section.navLabel;
            link.appendChild(dotLabel);
        } else {
            const textLabel = document.createElement('span');
            textLabel.className = 'nav-text-label';
            textLabel.textContent = section.navLabel;
            link.appendChild(textLabel);
        }

        item.appendChild(link);
        navLinks.appendChild(item);

        const mobileItem = document.createElement('li');
        const mobileLink = document.createElement('a');
        mobileLink.href = `#${section.id}`;
        mobileLink.className = 'mobile-menu-link';
        mobileLink.textContent = section.navLabel;
        mobileItem.appendChild(mobileLink);
        mobileNavLinks.appendChild(mobileItem);
    });
}

function buildSections(sections) {
    sectionsRoot.innerHTML = '';

    sections.forEach((section, index) => {
        const sectionElement = document.createElement('section');
        sectionElement.id = section.id;
        const isLast = index === sections.length - 1;
        const isSplitRight = section.isSplit && section.splitLayout === 'text-right';
        sectionElement.className = [
            'cms-section',
            'w-full',
            'flex',
            'flex-col',
            'items-center',
            'justify-center',
            'px-4',
            'relative'
        ].join(' ').trim();
        
        sectionElement.style.zIndex = '10';
        
        const isMobile = window.innerWidth < 768;
        const isDesktop = window.innerWidth >= 1024;
        sectionElement.style.minHeight = isMobile ? 'auto' : '75vh';
        sectionElement.style.paddingTop = isMobile ? '1.5rem' : '5rem';
        sectionElement.style.paddingBottom = isMobile ? '1.5rem' : '5rem';
        if (!isLast) {
            sectionElement.style.marginBottom = isMobile ? '1.5rem' : '2.5rem';
        }

        if (index > 0) {
            const divider = document.createElement('div');
            divider.className = 'w-full max-w-4xl mx-auto h-[1px] relative z-10';
            divider.style.background = 'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0) 100%)';
            sectionsRoot.appendChild(divider);
        }

        const inner = document.createElement('div');
        inner.className = section.isSplit
            ? 'cms-section-inner w-full max-w-6xl grid gap-12 lg:grid-cols-2 items-center'
            : 'cms-section-inner w-full max-w-5xl';
        if (section.isSplit && isDesktop) {
            inner.style.gridTemplateColumns = 'minmax(0, 0.9fr) minmax(0, 1.1fr)';
            inner.style.columnGap = '2rem';
        }

        const heading = document.createElement('div');
        heading.className = section.isSplit
            ? `w-full max-w-6xl flex flex-wrap gap-4 ${isSplitRight ? 'justify-end' : 'justify-start'}`
            : 'w-full flex flex-wrap mb-12 justify-center gap-y-8';
        if (section.isSplit) heading.style.marginBottom = '2.5rem';

        if (section.titleUseDots) {
            const dotHeading = document.createElement('div');
            dotHeading.id = `section-title-${section.id}`;
            dotHeading.className = 'cms-dot-heading';
            if (isSplitRight) dotHeading.style.justifyContent = 'flex-end';
            const fallbackHeading = document.createElement('h2');
            fallbackHeading.className = `dot-fallback-heading ${section.isSplit ? (isSplitRight ? 'text-right' : 'text-left') : 'text-center'}`;
            fallbackHeading.textContent = section.title;
            dotHeading.appendChild(fallbackHeading);
            heading.appendChild(dotHeading);
        } else {
            const plainHeading = document.createElement('h2');
            plainHeading.className = `dot-fallback-heading ${section.isSplit ? (isSplitRight ? 'text-right' : 'text-left') : 'text-center'}`;
            plainHeading.textContent = section.title;
            heading.appendChild(plainHeading);
        }

        const body = document.createElement('div');
        body.className = `cms-section-body rich-content ${section.isSplit ? `max-w-none ${isSplitRight ? 'text-right' : 'text-left'}` : 'max-w-2xl mx-auto text-center'} text-lg md:text-xl leading-relaxed font-medium`;
        
        // Force the text to be pure black to prevent optical color blending from the background
        body.style.color = '#111111';

        setRichContent(body, section.bodyHtml);

        const contentColumn = document.createElement('div');
        contentColumn.className = section.isSplit ? `space-y-8 ${isSplitRight ? 'lg:order-2' : 'lg:order-1'}` : '';

        if (section.isSplit) {
            contentColumn.appendChild(body);
            const graphicColumn = document.createElement('div');
            graphicColumn.className = `cms-section-graphic flex justify-center items-center ${isSplitRight ? 'lg:order-1' : 'lg:order-2'}`;
            
            // On mobile, the graphic bleeds out of its bounding box due to the 1.5 visualScale.
            // We add a top margin to explicitly push it away from the text block.
            if (window.innerWidth < 768) {
                graphicColumn.style.marginTop = '4rem';
            }

            if (section.graphicType === 'image' && section.graphicUrl) {
                const img = document.createElement('img');
                img.src = section.graphicUrl;
                img.alt = section.title;
                img.className = 'w-full h-auto rounded-3xl border border-gray-200 shadow-sm';
                graphicColumn.appendChild(img);
            } else if (section.graphicType === 'dot' && section.graphicName && window.letters && window.letters[section.graphicName]) {
                const graphicWrapper = document.createElement('div');
                graphicWrapper.id = `section-graphic-${section.id}`;
                graphicWrapper.className = 'w-full';
                graphicColumn.appendChild(graphicWrapper);
                renderSplitGraphic(graphicWrapper.id, section.graphicName);
            } else {
                const fallbackGraphic = document.createElement('div');
                fallbackGraphic.className = 'text-sm text-gray-500 italic text-center';
                fallbackGraphic.textContent = section.graphicType === 'image'
                    ? 'Add a valid image URL in the admin panel to show the graphic here.'
                    : 'Choose a dot graphic in the admin panel to show it here.';
                graphicColumn.appendChild(fallbackGraphic);
            }

            sectionElement.appendChild(heading);
            if (isSplitRight) {
                inner.appendChild(graphicColumn);
                inner.appendChild(contentColumn);
            } else {
                inner.appendChild(contentColumn);
                inner.appendChild(graphicColumn);
            }
        } else {
            contentColumn.appendChild(heading);
            contentColumn.appendChild(body);
            inner.appendChild(contentColumn);
        }

        sectionElement.appendChild(inner);
        sectionsRoot.appendChild(sectionElement);
    });
}

function renderStaticContent() {
    const content = getSiteContent();
    setRichContent(heroSubtitle, content.hero.subtitleHtml);
    buildNavigation(content.sections);
    buildSections(content.sections);
}

function renderDynamicDotContent() {
    const content = getSiteContent();
    const logoGrid = document.getElementById('logo-grid');

    if (logoGrid) {
        logoGrid.innerHTML = '';
        renderText('logo-grid', 'ADseum', { visualScale: 1.35, gap: 2 });
    }

    if (navLogo) {
        navLogo.innerHTML = '';
        // Logo size dynamically adjusts for mobile to prevent clipping
        const isMobile = window.innerWidth < 768;
        renderText('nav-logo', 'ADseum', { 
            dotSize: isMobile ? 3 : 4.5, 
            visualScale: isMobile ? 1 : 1.35 
        });
    }

    content.sections.forEach((section) => {
        if (section.navUseDots) {
            renderDotField(
                document.getElementById(`nav-label-${section.id}`),
                section.navLabel,
                { dotSize: 4, monochrome: true, letterSpacing: 4, gap: 1.5, visualScale: 1.3 },
                'span',
                'nav-text-label'
            );
        }

        if (section.titleUseDots) {
            renderDotField(
                document.getElementById(`section-title-${section.id}`),
                section.title,
                { dotSize: 8, monochrome: true, visualScale: 1.3 },
                'h2',
                `dot-fallback-heading ${section.isSplit ? (section.splitLayout === 'text-right' ? 'text-right' : 'text-left') : 'text-center'}`
            );
        }

        if (section.isSplit && section.graphicType === 'dot') {
            const graphicWrapper = document.getElementById(`section-graphic-${section.id}`);
            if (graphicWrapper && section.graphicName) {
                graphicWrapper.innerHTML = '';
                renderSplitGraphic(graphicWrapper.id, section.graphicName);
            }
        }
    });
}

function handleRender() {
    renderStaticContent();

    if (!lettersReady || !siteContentReady) {
        return;
    }

    if (isFirstFetch) {
        renderDynamicDotContent();
        initAnimations('#logo-grid');
        initScrollAnimations();
        initNavScrollAnimation();
        initDotReverseAnimation();
        isFirstFetch = false;
    } else if (window.isAnimationComplete === false) {
        // Entrance animation is still playing — don't re-render dots or we'll kill it
        return;
    } else {
        renderDynamicDotContent();

        if (window.ScrollTrigger) {
            ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
            initScrollAnimations();
            initNavScrollAnimation();
            initDotReverseAnimation();
        }

        // Show dots in their final position without replaying the entrance animation
        const logoDots = document.querySelectorAll('#logo-grid .dot-wrapper svg');
        logoDots.forEach(dot => {
            gsap.set(dot, { opacity: 1, x: 0, y: 0, scale: 1 });
            const path = dot.querySelector('path');
            if (path) {
                const stdD = path.getAttribute('data-std-d');
                if (stdD) gsap.set(path, { attr: { d: stdD } });
                path._morphState = 'standard';
            }
        });

        window.isAnimationComplete = true;

        if (window.updateWiggleTargets) {
            window.updateWiggleTargets();
        }
    }
}

function initNavbar() {
    if (!navLinks || !navbar || !hamburgerButton || !mobileMenu || !mobileNavLinks) return;

    const closeMobileMenu = () => {
        mobileMenuOpen = false;
        document.body.classList.remove('mobile-menu-open');
        hamburgerButton.classList.remove('is-open');
        hamburgerButton.setAttribute('aria-expanded', 'false');
        mobileMenu.classList.remove('visible');
        mobileMenu.setAttribute('aria-hidden', 'true');
        if (sectionsRoot) sectionsRoot.removeAttribute('inert');
    };

    const openMobileMenu = () => {
        mobileMenuOpen = true;
        document.body.classList.add('mobile-menu-open');
        hamburgerButton.classList.add('is-open');
        hamburgerButton.setAttribute('aria-expanded', 'true');
        mobileMenu.classList.add('visible');
        mobileMenu.setAttribute('aria-hidden', 'false');
        if (sectionsRoot) sectionsRoot.setAttribute('inert', '');
    };

    const toggleMobileMenu = () => {
        if (mobileMenuOpen) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    };

    const smoothScrollTo = (targetY, duration = 800) => {
        const startY = window.scrollY;
        const diff = targetY - startY;
        if (Math.abs(diff) < 1) return;
        let start = null;

        const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        const step = (timestamp) => {
            if (!start) start = timestamp;
            const progress = Math.min((timestamp - start) / duration, 1);
            window.scrollTo(0, startY + diff * easeInOutCubic(progress));
            if (progress < 1) requestAnimationFrame(step);
        };

        requestAnimationFrame(step);
    };

    const handleNavClick = (event) => {
        const link = event.target.closest('a[href^="#"]');
        if (!link) return;

        event.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
            const wasMenuOpen = mobileMenuOpen;
            closeMobileMenu();

            const doScroll = () => {
                const navHeight = navbar.offsetHeight;
                const targetTop = target.getBoundingClientRect().top + window.scrollY - navHeight;
                smoothScrollTo(targetTop);
            };

            if (wasMenuOpen) {
                requestAnimationFrame(doScroll);
            } else {
                doScroll();
            }
        }
    };

    navLinks.addEventListener('click', handleNavClick);
    mobileNavLinks.addEventListener('click', handleNavClick);
    hamburgerButton.addEventListener('click', toggleMobileMenu);

    window.addEventListener('resize', () => {
        if (window.innerWidth >= 768 && mobileMenuOpen) {
            closeMobileMenu();
        }
    });

    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && mobileMenuOpen) {
            closeMobileMenu();
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
    setTimeout(() => window.scrollTo(0, 0), 50);

    renderStaticContent();
    initNavbar();

    listenToLetters(() => {
        lettersReady = true;
        handleRender();
    });

    listenToSiteContent((content) => {
        window.siteContent = content;
        window.dotPalette = content.dotPalette || DEFAULT_SITE_CONTENT.dotPalette;
        siteContentReady = true;
        handleRender();
    });

    let lastWidth = window.innerWidth;
    window.addEventListener('resize', () => {
        if (window.innerWidth === lastWidth) return;
        lastWidth = window.innerWidth;

        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (lettersReady && siteContentReady) {
                handleRender();
            } else {
                renderStaticContent();
            }
        }, 200);
    });
});
