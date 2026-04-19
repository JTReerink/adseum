import { db } from '../firebase-config.js';
import { DEFAULT_DOT_PALETTE } from './config.js';
import {
    collection,
    doc,
    getDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.0.6/+esm';

const DEFAULT_SECTION_BODIES = {
    about: '<p>Placeholder for About Us content. We are dedicated to empowering queer art through dynamic digital experiences.</p>',
    projects: '<p>Placeholder for Projects overview. Highlighting past, present, and future exhibitions.</p>',
    contact: '<p>Placeholder for Contact information. Reach out to collaborate with us.</p>'
};

export function normalizeHexColor(value = '') {
    const trimmed = value.trim();
    const match = trimmed.match(/^#([0-9a-f]{6})$/i);
    return match ? `#${match[1].toUpperCase()}` : null;
}

export function normalizeDotPalette(values = []) {
    const normalized = [];
    const seen = new Set();
    const source = Array.isArray(values) ? values : [];

    source.forEach((value) => {
        const color = normalizeHexColor(value);
        if (color && !seen.has(color)) {
            seen.add(color);
            normalized.push(color);
        }
    });

    return normalized.length > 0 ? normalized : [...DEFAULT_DOT_PALETTE];
}

export function isPaletteColorAllowed(color, palette = DEFAULT_DOT_PALETTE) {
    const normalizedColor = normalizeHexColor(color);
    if (!normalizedColor) {
        return false;
    }

    return normalizeDotPalette(palette).includes(normalizedColor);
}

export function slugify(value = '') {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || `section-${Date.now()}`;
}

export function escapeHtml(value = '') {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function sanitizeRichHtml(html = '') {
    if (typeof document === 'undefined') {
        return html;
    }
    
    // Using DOMPurify to securely sanitize inputs
    return DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed']
    }).trim();
}

export function createSection(overrides = {}) {
    const title = overrides.title || 'New Section';
    const navLabel = overrides.navLabel || title;

    return {
        id: overrides.id || slugify(navLabel),
        navLabel,
        navUseDots: Boolean(overrides.navUseDots),
        title,
        titleUseDots: overrides.titleUseDots !== undefined ? Boolean(overrides.titleUseDots) : true,
        bodyHtml: sanitizeRichHtml(overrides.bodyHtml || '<p>Add your section content here.</p>'),
        isSplit: Boolean(overrides.isSplit),
        graphicType: overrides.graphicType && ['image', 'dot'].includes(overrides.graphicType) ? overrides.graphicType : (overrides.isSplit ? 'dot' : null),
        graphicName: typeof overrides.graphicName === 'string' ? overrides.graphicName.trim() : '',
        graphicUrl: typeof overrides.graphicUrl === 'string' ? overrides.graphicUrl.trim() : ''
    };
}

function convertLegacySections(legacySections = {}, legacyNavigation = {}) {
    return ['about', 'projects', 'contact'].map((key) => createSection({
        id: key,
        navLabel: legacyNavigation[key] || legacySections[key]?.heading || key,
        navUseDots: false,
        title: legacySections[key]?.heading || key,
        titleUseDots: true,
        bodyHtml: legacySections[key]?.body
            ? `<p>${escapeHtml(legacySections[key].body).replace(/\n/g, '<br>')}</p>`
            : DEFAULT_SECTION_BODIES[key]
    }));
}

export const DEFAULT_SITE_CONTENT = {
    hero: {
        subtitleHtml: '<p>Empowering Queer Art</p>'
    },
    sections: convertLegacySections(),
    dotPalette: [...DEFAULT_DOT_PALETTE],
    animationPause: 1.5,
    animationSpeed: 1.0,
    contactEmail: '',
    contactSubtext: ''
};

export function normalizeSiteContent(data = {}) {
    const sections = Array.isArray(data.sections)
        ? data.sections.map((section) => createSection(section))
        : convertLegacySections(data.sections || {}, data.navigation || {});

    const animationPause = typeof data.animationPause === 'number' ? data.animationPause : DEFAULT_SITE_CONTENT.animationPause;
    const animationSpeed = typeof data.animationSpeed === 'number' ? data.animationSpeed : DEFAULT_SITE_CONTENT.animationSpeed;

    return {
        hero: {
            subtitleHtml: sanitizeRichHtml(
                data.hero?.subtitleHtml
                || (data.hero?.subtitle ? `<p>${escapeHtml(data.hero.subtitle)}</p>` : DEFAULT_SITE_CONTENT.hero.subtitleHtml)
            )
        },
        sections: sections.length > 0 ? sections : DEFAULT_SITE_CONTENT.sections.map((section) => createSection(section)),
        dotPalette: normalizeDotPalette(data.dotPalette),
        animationPause: Math.max(0, Math.min(10, animationPause)),
        animationSpeed: Math.max(0.1, Math.min(5, animationSpeed)),
        contactEmail: typeof data.contactEmail === 'string' ? data.contactEmail.trim() : '',
        contactSubtext: typeof data.contactSubtext === 'string' ? data.contactSubtext.trim() : ''
    };
}

export function validateDotText(text = '', lettersMap = {}) {
    const seen = new Set();
    const missing = [];

    [...text].forEach((char) => {
        if (!char.trim()) {
            return;
        }

        if (!lettersMap[char] && !seen.has(char)) {
            seen.add(char);
            missing.push(char);
        }
    });

    return missing;
}

export function listenToLetters(callback) {
    return onSnapshot(collection(db, 'letters'), (querySnapshot) => {
        window.letters = {};
        window.letterColors = {};
        window.letterOffsets = {};

        querySnapshot.forEach((snapshotDoc) => {
            const data = snapshotDoc.data();

            if (data.gridData) {
                const reconstructedGrid = [];
                for (let index = 0; index < data.rows; index += 1) {
                    reconstructedGrid.push(data.gridData[`row${index}`]);
                }
                window.letters[snapshotDoc.id] = reconstructedGrid;
            } else if (data.grid) {
                window.letters[snapshotDoc.id] = data.grid;
            }

            const colorMap = {};
            if (data.colorData) {
                for (let rowIndex = 0; rowIndex < data.rows; rowIndex += 1) {
                    const row = data.colorData[`row${rowIndex}`] || [];
                    row.forEach((color, colIndex) => {
                        if (color) {
                            colorMap[`${rowIndex},${colIndex}`] = color;
                        }
                    });
                }
            }
            window.letterColors[snapshotDoc.id] = colorMap;

            const offsetMap = {};
            if (data.offsetData) {
                for (let rowIndex = 0; rowIndex < data.rows; rowIndex += 1) {
                    const row = data.offsetData[`row${rowIndex}`] || [];
                    row.forEach((offset, colIndex) => {
                        if (offset && (offset.x !== 0 || offset.y !== 0)) {
                            offsetMap[`${rowIndex},${colIndex}`] = offset;
                        }
                    });
                }
            }
            window.letterOffsets[snapshotDoc.id] = offsetMap;
        });

        if (callback) {
            callback(window.letters);
        }
    }, (error) => {
        console.error('Error loading letters (likely offline/CORS):', error);
    });
}

export async function loadSiteContent() {
    const snapshot = await getDoc(doc(db, 'siteContent', 'homepage'));
    return normalizeSiteContent(snapshot.exists() ? snapshot.data() : {});
}

export function listenToSiteContent(callback) {
    return onSnapshot(doc(db, 'siteContent', 'homepage'), (snapshot) => {
        if (callback) {
            callback(normalizeSiteContent(snapshot.exists() ? snapshot.data() : {}));
        }
    }, (error) => {
        console.error('Error loading homepage content:', error);
    });
}
