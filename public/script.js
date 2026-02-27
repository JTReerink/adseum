import { renderLetter, renderText } from './modules/renderer.js';
import { animateDots, initAnimations } from './modules/animations.js';
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
    listenToLetters(() => {
        const container = document.getElementById('logo-grid');
        if (container) {
            container.innerHTML = '';
            renderText('logo-grid', 'ADseum');

            if (isFirstFetch) {
                // First time running animations
                initAnimations();
                isFirstFetch = false;
            } else {
                // Update existing animations
                if (window.updateWiggleTargets) {
                    window.updateWiggleTargets();
                }
                animateDots();
            }
        }
    });
});
