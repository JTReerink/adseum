import { renderText } from './modules/renderer.js';
import { animateDots, initAnimations, initScrollAnimations, initNavScrollAnimation } from './modules/animations.js';
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
        sectionElement.className = [
            'cms-section',
            'w-full',
            'min-h-screen',
            'flex',
            'flex-col',
            'items-center',
            'justify-center',
            'py-24',
            'px-4',
            'relative',
            'z-10',
            index % 2 === 1 ? 'bg-gray-50/50' : ''
        ].join(' ').trim();

        const inner = document.createElement('div');
        inner.className = 'cms-section-inner w-full max-w-5xl';

        const heading = document.createElement('div');
        heading.className = 'w-full flex flex-wrap mb-12 justify-center gap-y-8';

        if (section.titleUseDots) {
            const dotHeading = document.createElement('div');
            dotHeading.id = `section-title-${section.id}`;
            dotHeading.className = 'cms-dot-heading';
            const fallbackHeading = document.createElement('h2');
            fallbackHeading.className = 'dot-fallback-heading text-center';
            fallbackHeading.textContent = section.title;
            dotHeading.appendChild(fallbackHeading);
            heading.appendChild(dotHeading);
        } else {
            const plainHeading = document.createElement('h2');
            plainHeading.className = 'dot-fallback-heading text-center';
            plainHeading.textContent = section.title;
            heading.appendChild(plainHeading);
        }

        const body = document.createElement('div');
        body.className = 'cms-section-body rich-content max-w-2xl mx-auto text-center text-gray-700 text-lg md:text-xl leading-relaxed';
        setRichContent(body, section.bodyHtml);

        inner.appendChild(heading);
        inner.appendChild(body);
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
        renderText('nav-logo', 'ADseum', { dotSize: 3, visualScale: 1.15 });
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
                'dot-fallback-heading text-center'
            );
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
    };

    const openMobileMenu = () => {
        mobileMenuOpen = true;
        document.body.classList.add('mobile-menu-open');
        hamburgerButton.classList.add('is-open');
        hamburgerButton.setAttribute('aria-expanded', 'true');
        mobileMenu.classList.add('visible');
        mobileMenu.setAttribute('aria-hidden', 'false');
    };

    const toggleMobileMenu = () => {
        if (mobileMenuOpen) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    };

    const handleNavClick = (event) => {
        const link = event.target.closest('a[href^="#"]');
        if (!link) return;

        event.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
            closeMobileMenu();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
