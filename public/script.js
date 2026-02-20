import { renderLetter, renderText } from './modules/renderer.js';
import { animateDots, initAnimations } from './modules/animations.js';

// Expose functions to global scope for HTML/Firebase compatibility
window.renderLetter = renderLetter;
window.renderText = renderText;
window.animateDots = animateDots;
window.initAnimations = initAnimations;

console.log("Modules loaded and functions exposed to window.");
