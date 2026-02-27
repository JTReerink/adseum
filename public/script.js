import { renderLetter, renderText } from './modules/renderer.js';
import { animateDots, initAnimations, initScrollAnimations } from './modules/animations.js';
import { listenToLetters } from './modules/database.js';

// Expose functions to global scope for HTML/Firebase compatibility
window.renderLetter = renderLetter;
window.renderText = renderText;
window.animateDots = animateDots;
window.initAnimations = initAnimations;

console.log("Modules loaded and functions exposed to window.");

window.letters = {};
let isFirstFetch = true;
let resizeTimeout;

const handleRender = () => {
    const container = document.getElementById('logo-grid');
    if (!container) return;

    // Clear existing content
    container.innerHTML = '';
    document.getElementById('about-heading').innerHTML = '';
    document.getElementById('projects-heading').innerHTML = '';
    document.getElementById('contact-heading').innerHTML = '';

    // Render text with dynamic scaling calculated in renderer.js
    renderText('logo-grid', 'ADseum');
    renderText('about-heading', 'About', { dotSize: 8, monochrome: true });
    renderText('projects-heading', 'Projects', { dotSize: 8, monochrome: true });
    renderText('contact-heading', 'Contact', { dotSize: 8, monochrome: true });

    if (isFirstFetch) {
        // First time running animations
        initAnimations('#logo-grid');
        initScrollAnimations();
        isFirstFetch = false;
    } else {
        // Update existing animations & scroll triggers on resize
        if (window.ScrollTrigger) {
            ScrollTrigger.getAll().forEach(t => t.kill());
            initScrollAnimations();
        }
        if (window.updateWiggleTargets) {
            window.updateWiggleTargets();
        }
        // Give dots tiny visual pop on resize so it doesn't just snap jarringly
        animateDots('#logo-grid');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Force browser to not restore previous scroll position
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    // Fallback for some browsers that trigger restoration after DOMContentLoaded
    setTimeout(() => window.scrollTo(0, 0), 50);

    listenToLetters(() => {
        handleRender();
    });

    // Handle responsive resizing
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (Object.keys(window.letters).length > 0) {
                handleRender();
            }
        }, 200); // 200ms debounce
    });
});
