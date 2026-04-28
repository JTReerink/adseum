import { db } from '../firebase-config.js';
import {
    DEFAULT_DOT_PALETTE,
    SECTION_MENU_USES_DOTS,
    SECTION_TITLE_USES_DOTS
} from './config.js';
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

export const SUPPORTED_LOCALES = ['nl', 'en'];
export const DEFAULT_LOCALE = 'nl';

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

export function deriveSectionName(section = {}) {
    if (typeof section === 'string') {
        return section.trim() || 'New Section';
    }

    const navLabel = getLocalizedValue(section.navLabel || '', DEFAULT_LOCALE).trim();
    const title = getLocalizedValue(section.title || '', DEFAULT_LOCALE).trim();
    return navLabel || title || 'New Section';
}

export function deriveSectionId(section = {}) {
    return slugify(deriveSectionName(section));
}

function inferStoredItemType(name, data = {}) {
    if (data.itemType === 'graphic' || data.type === 'graphic') return 'graphic';
    if (data.itemType === 'letter' || data.type === 'letter') return 'letter';
    return name.length === 1 ? 'letter' : 'graphic';
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

export function normalizeLocalizedValue(value = '', sanitizer = (input) => input) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const normalized = {};
        SUPPORTED_LOCALES.forEach((locale) => {
            normalized[locale] = sanitizer(typeof value[locale] === 'string' ? value[locale] : '');
        });

        const fallback = normalized[DEFAULT_LOCALE] || normalized.en || '';
        SUPPORTED_LOCALES.forEach((locale) => {
            if (!normalized[locale]) {
                normalized[locale] = fallback;
            }
        });
        return normalized;
    }

    const normalizedString = sanitizer(typeof value === 'string' ? value : '');
    return {
        nl: normalizedString,
        en: normalizedString
    };
}

export function getLocalizedValue(value, locale = DEFAULT_LOCALE) {
    const normalized = normalizeLocalizedValue(value);
    return normalized[locale] || normalized[DEFAULT_LOCALE] || normalized.en || '';
}

export function createSection(overrides = {}) {
    const rawNavLabel = overrides.navLabel ?? overrides.title ?? 'New Section';
    const navLabel = normalizeLocalizedValue(rawNavLabel, (input) => input.trim());
    const title = normalizeLocalizedValue(overrides.title ?? navLabel, (input) => input.trim());
    const bodyHtml = normalizeLocalizedValue(
        overrides.bodyHtml || '<p>Add your section content here.</p>',
        sanitizeRichHtml
    );
    const specialType = typeof overrides.specialType === 'string'
        ? overrides.specialType.trim().toLowerCase()
        : (overrides.id === 'contact' ? 'contact' : '');

    return {
        id: deriveSectionId({ navLabel: getLocalizedValue(navLabel, DEFAULT_LOCALE) }),
        navLabel,
        navUseDots: SECTION_MENU_USES_DOTS,
        title,
        titleUseDots: SECTION_TITLE_USES_DOTS,
        bodyHtml,
        specialType: specialType || null,
        isSplit: Boolean(overrides.isSplit),
        splitLayout: overrides.splitLayout === 'text-right' ? 'text-right' : 'text-left',
        graphicType: overrides.graphicType && ['image', 'dot'].includes(overrides.graphicType) ? overrides.graphicType : (overrides.isSplit ? 'dot' : null),
        graphicName: typeof overrides.graphicName === 'string' ? overrides.graphicName.trim() : '',
        graphicUrl: typeof overrides.graphicUrl === 'string' ? overrides.graphicUrl.trim() : ''
    };
}

function convertLegacySections(legacySections = {}, legacyNavigation = {}) {
    return ['about', 'projects', 'contact'].map((key) => createSection({
        id: key,
        navLabel: legacyNavigation[key] || legacySections[key]?.heading || key,
        specialType: key === 'contact' ? 'contact' : null,
        bodyHtml: legacySections[key]?.body
            ? `<p>${escapeHtml(legacySections[key].body).replace(/\n/g, '<br>')}</p>`
            : DEFAULT_SECTION_BODIES[key]
    }));
}

export const DEFAULT_SITE_CONTENT = {
    hero: {
        subtitleHtml: {
            nl: '<p>Empowering Queer Art</p>',
            en: '<p>Empowering Queer Art</p>'
        }
    },
    sections: convertLegacySections(),
    dotPalette: [...DEFAULT_DOT_PALETTE],
    animationPause: 1.5,
    animationSpeed: 1.0
};

export function normalizeSiteContent(data = {}) {
    const sections = Array.isArray(data.sections)
        ? data.sections.map((section) => createSection(section))
        : convertLegacySections(data.sections || {}, data.navigation || {});

    const animationPause = typeof data.animationPause === 'number' ? data.animationPause : DEFAULT_SITE_CONTENT.animationPause;
    const animationSpeed = typeof data.animationSpeed === 'number' ? data.animationSpeed : DEFAULT_SITE_CONTENT.animationSpeed;

    return {
        hero: {
            subtitleHtml: normalizeLocalizedValue(
                data.hero?.subtitleHtml
                || (data.hero?.subtitle ? `<p>${escapeHtml(data.hero.subtitle)}</p>` : DEFAULT_SITE_CONTENT.hero.subtitleHtml),
                sanitizeRichHtml
            )
        },
        sections: sections.length > 0 ? sections : DEFAULT_SITE_CONTENT.sections.map((section) => createSection(section)),
        dotPalette: normalizeDotPalette(data.dotPalette),
        animationPause: Math.max(0, Math.min(10, animationPause)),
        animationSpeed: Math.max(0.1, Math.min(5, animationSpeed))
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
        window.letterKinds = {};

        querySnapshot.forEach((snapshotDoc) => {
            const data = snapshotDoc.data();
            window.letterKinds[snapshotDoc.id] = inferStoredItemType(snapshotDoc.id, data);

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
