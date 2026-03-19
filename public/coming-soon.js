import { renderText } from './modules/renderer.js';
import { animateDots } from './modules/animations.js';
import { listenToLetters } from './modules/database.js';

window.letters = {};
let initialized = false;

document.addEventListener('DOMContentLoaded', () => {
    listenToLetters(() => {
        const container = document.getElementById('logo-grid');
        if (!container) return;

        container.innerHTML = '';
        renderText('logo-grid', 'ADseum');

        if (!initialized) {
            initialized = true;

            animateDots('#logo-grid');

            gsap.to('.subtitle-anim', { opacity: 1, delay: 1.5, duration: 1 });

            gsap.to('.blob', {
                scale: 1.2,
                duration: 'random(4, 6)',
                repeat: -1,
                yoyo: true,
                ease: 'sine.inOut',
                stagger: 1
            });
            gsap.to('.blob', {
                x: 'random(-20, 20)',
                y: 'random(-20, 20)',
                rotation: 'random(-10, 10)',
                duration: 'random(5, 8)',
                repeat: -1,
                yoyo: true,
                ease: 'sine.inOut',
                stagger: 0.5
            });
        }
    });
});
