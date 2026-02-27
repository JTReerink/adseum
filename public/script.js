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

document.addEventListener('DOMContentLoaded', () => {
    // Force browser to not restore previous scroll position
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    // Fallback for some browsers that trigger restoration after DOMContentLoaded
    setTimeout(() => window.scrollTo(0, 0), 50);

    listenToLetters(() => {
        const container = document.getElementById('logo-grid');
        if (container) {
            container.innerHTML = '';
            renderText('logo-grid', 'ADseum');

            // Render section headings using the scalable font system
            console.log("AVAILABLE LETTERS:", Object.keys(window.letters));
            renderText('about-heading', 'About', { dotSize: 8, monochrome: true });
            renderText('projects-heading', 'Projects', { dotSize: 8, monochrome: true });
            renderText('contact-heading', 'Contact', { dotSize: 8, monochrome: true });

            if (isFirstFetch) {
                // First time running animations
                initAnimations('#logo-grid');
                initScrollAnimations();
                isFirstFetch = false;
            } else {
                // Update existing animations
                if (window.updateWiggleTargets) {
                    window.updateWiggleTargets();
                }
                animateDots('#logo-grid');
            }
        }
    });
});
