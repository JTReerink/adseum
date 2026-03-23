import { db } from './firebase-config.js';
import {
    OWNER_EMAIL,
    signInWithGoogle,
    signOutCurrentUser,
    watchEditorAccess
} from './modules/admin-access.js';
import {
    DEFAULT_SITE_CONTENT,
    createSection,
    escapeHtml,
    listenToLetters,
    loadSiteContent,
    sanitizeRichHtml,
    slugify,
    validateDotText
} from './modules/database.js';
import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    serverTimestamp,
    setDoc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const authGate = document.getElementById('auth-gate');
const accessDenied = document.getElementById('access-denied');
const adminApp = document.getElementById('admin-app');
const authStatus = document.getElementById('auth-status');
const deniedMessage = document.getElementById('denied-message');
const signOutButton = document.getElementById('sign-out-button');
const deniedSignOut = document.getElementById('denied-sign-out');
const heroSubtitleEditor = document.getElementById('hero-subtitle-editor');
const addSectionButton = document.getElementById('add-section-button');
const sectionsList = document.getElementById('sections-list');
const saveContentButton = document.getElementById('save-content-button');
const contentNotice = document.getElementById('content-notice');
const ownerSection = document.getElementById('owner-section');
const editorsList = document.getElementById('editors-list');
const editorForm = document.getElementById('editor-form');
const editorEmailInput = document.getElementById('editor-email');
const editorNotice = document.getElementById('editor-notice');

const signInButtons = [...document.querySelectorAll('[data-auth-action="sign-in"]')];

let currentAccess = {
    user: null,
    email: '',
    canEdit: false,
    isOwner: false,
    role: null
};

let siteContent = structuredClone(DEFAULT_SITE_CONTENT);
let lettersMap = {};
let lettersReady = false;

function normalizeEmail(email = '') {
    return email.trim().toLowerCase();
}

function setNotice(element, message, isError = false) {
    element.textContent = message;
    element.classList.remove('text-red-600', 'text-slate-500', 'text-slate-600', 'text-emerald-600');
    element.classList.add(isError ? 'text-red-600' : 'text-emerald-600');
}

function showShell(view) {
    authGate.classList.toggle('cms-shell-hidden', view !== 'gate');
    accessDenied.classList.toggle('cms-shell-hidden', view !== 'denied');
    adminApp.classList.toggle('cms-shell-hidden', view !== 'app');
    document.body.classList.remove('admin-pending');
}

function getSectionFieldTarget(index, field) {
    return sectionsList.querySelector(`[data-section-index="${index}"] [data-glyph-status="${field}"]`);
}

function getValidationSnapshot() {
    const errors = [];
    const ids = new Set();

    siteContent.sections.forEach((section, index) => {
        const position = index + 1;
        const id = slugify(section.id || section.navLabel || section.title || `section-${position}`);

        if (!section.navLabel.trim()) {
            errors.push(`Section ${position}: navigation label is required.`);
        }

        if (!section.title.trim()) {
            errors.push(`Section ${position}: heading is required.`);
        }

        if (ids.has(id)) {
            errors.push(`Section ${position}: the anchor "${id}" is duplicated.`);
        }
        ids.add(id);

        if ((section.navUseDots || section.titleUseDots) && !lettersReady) {
            errors.push(`Section ${position}: the dot-letter library is still loading. Try saving again in a moment.`);
            return;
        }

        if (section.navUseDots) {
            const missingNavLetters = validateDotText(section.navLabel, lettersMap);
            if (missingNavLetters.length > 0) {
                errors.push(`Section ${position}: nav label is missing dot glyphs for ${missingNavLetters.join(', ')}.`);
            }
        }

        if (section.titleUseDots) {
            const missingTitleLetters = validateDotText(section.title, lettersMap);
            if (missingTitleLetters.length > 0) {
                errors.push(`Section ${position}: heading is missing dot glyphs for ${missingTitleLetters.join(', ')}.`);
            }
        }
    });

    return errors;
}

function renderGlyphStatus(index) {
    const section = siteContent.sections[index];
    const navStatus = getSectionFieldTarget(index, 'nav');
    const titleStatus = getSectionFieldTarget(index, 'title');

    if (!section || !navStatus || !titleStatus) {
        return;
    }

    if (!lettersReady) {
        navStatus.className = 'glyph-status text-slate-500';
        titleStatus.className = 'glyph-status text-slate-500';
        navStatus.textContent = section.navUseDots ? 'Checking available dot glyphs...' : 'Navigation label will render as normal text.';
        titleStatus.textContent = section.titleUseDots ? 'Checking available dot glyphs...' : 'Heading will render as normal text.';
        return;
    }

    if (section.navUseDots) {
        const missing = validateDotText(section.navLabel, lettersMap);
        navStatus.className = `glyph-status ${missing.length > 0 ? 'glyph-status-error' : 'glyph-status-ok'}`;
        navStatus.textContent = missing.length > 0
            ? `Missing nav glyphs: ${missing.join(', ')}`
            : 'Navigation label is ready for custom dot rendering.';
    } else {
        navStatus.className = 'glyph-status text-slate-500';
        navStatus.textContent = 'Navigation label will render as normal text.';
    }

    if (section.titleUseDots) {
        const missing = validateDotText(section.title, lettersMap);
        titleStatus.className = `glyph-status ${missing.length > 0 ? 'glyph-status-error' : 'glyph-status-ok'}`;
        titleStatus.textContent = missing.length > 0
            ? `Missing heading glyphs: ${missing.join(', ')}`
            : 'Heading is ready for custom dot rendering.';
    } else {
        titleStatus.className = 'glyph-status text-slate-500';
        titleStatus.textContent = 'Heading will render as normal text.';
    }
}

function renderAllGlyphStatuses() {
    siteContent.sections.forEach((_, index) => renderGlyphStatus(index));
}

function renderSections() {
    sectionsList.innerHTML = siteContent.sections.map((section, index) => `
        <article class="cms-section-card" data-section-index="${index}">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <p class="font-mono text-xs uppercase tracking-[0.25em] text-slate-400">Section ${index + 1}</p>
                    <h3 class="mt-2 text-xl font-semibold text-slate-900">${escapeHtml(section.title || 'Untitled section')}</h3>
                </div>
                <div class="flex flex-wrap gap-2">
                    <button type="button" data-section-action="move-up" class="rounded-full border border-slate-200 px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-slate-600 transition hover:bg-slate-50">Up</button>
                    <button type="button" data-section-action="move-down" class="rounded-full border border-slate-200 px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-slate-600 transition hover:bg-slate-50">Down</button>
                    <button type="button" data-section-action="remove" class="rounded-full border border-red-200 px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-red-600 transition hover:bg-red-50">Remove</button>
                </div>
            </div>

            <div class="mt-5 grid gap-4 md:grid-cols-3">
                <label class="block">
                    <span class="mb-2 block text-sm font-medium text-slate-700">Section anchor</span>
                    <input type="text" class="cms-input" value="${escapeHtml(section.id)}" data-section-field="id">
                </label>
                <label class="block">
                    <span class="mb-2 block text-sm font-medium text-slate-700">Navigation label</span>
                    <input type="text" class="cms-input" value="${escapeHtml(section.navLabel)}" data-section-field="navLabel">
                </label>
                <label class="block">
                    <span class="mb-2 block text-sm font-medium text-slate-700">Section heading</span>
                    <input type="text" class="cms-input" value="${escapeHtml(section.title)}" data-section-field="title">
                </label>
            </div>

            <div class="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                    <label class="cms-checkbox-row">
                        <input type="checkbox" ${section.navUseDots ? 'checked' : ''} data-section-field="navUseDots">
                        <span>Render navigation label with custom dot letters</span>
                    </label>
                    <p class="glyph-status mt-2" data-glyph-status="nav"></p>
                </div>
                <div>
                    <label class="cms-checkbox-row">
                        <input type="checkbox" ${section.titleUseDots ? 'checked' : ''} data-section-field="titleUseDots">
                        <span>Render heading with custom dot letters</span>
                    </label>
                    <p class="glyph-status mt-2" data-glyph-status="title"></p>
                </div>
            </div>

            <div class="mt-5">
                <p class="mb-2 text-sm font-medium text-slate-700">Section body</p>
                <div class="rich-editor-wrap">
                    <div class="editor-toolbar" data-editor-toolbar data-target="section-body-editor-${index}">
                        <button type="button" data-editor-command="bold">Bold</button>
                        <button type="button" data-editor-command="italic">Italic</button>
                        <button type="button" data-editor-command="underline">Underline</button>
                        <button type="button" data-editor-block="h2">H2</button>
                        <button type="button" data-editor-block="h3">H3</button>
                        <button type="button" data-editor-command="insertUnorderedList">Bullets</button>
                        <button type="button" data-editor-command="insertOrderedList">Numbers</button>
                        <button type="button" data-editor-block="blockquote">Quote</button>
                        <button type="button" data-editor-action="link">Link</button>
                        <button type="button" data-editor-action="clear">Clear</button>
                    </div>
                    <div id="section-body-editor-${index}" class="rich-editor-surface rich-content" contenteditable="true"
                        data-section-rich-field="bodyHtml" data-placeholder="Write the section body here...">${sanitizeRichHtml(section.bodyHtml)}</div>
                </div>
            </div>
        </article>
    `).join('');

    renderAllGlyphStatuses();
}

function syncHeroEditor() {
    siteContent.hero.subtitleHtml = sanitizeRichHtml(heroSubtitleEditor.innerHTML);
}

function syncSectionRichEditor(surface) {
    const card = surface.closest('[data-section-index]');
    if (!card) return;

    const index = Number(card.dataset.sectionIndex);
    siteContent.sections[index].bodyHtml = sanitizeRichHtml(surface.innerHTML);
}

function updateSectionField(index, field, value) {
    if (!siteContent.sections[index]) return;

    if (field === 'navUseDots' || field === 'titleUseDots') {
        siteContent.sections[index][field] = Boolean(value);
    } else if (field === 'id') {
        siteContent.sections[index][field] = value;
    } else {
        siteContent.sections[index][field] = value;
    }

    renderGlyphStatus(index);
}

function moveSection(index, direction) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= siteContent.sections.length) {
        return;
    }

    const [section] = siteContent.sections.splice(index, 1);
    siteContent.sections.splice(nextIndex, 0, section);
    renderSections();
}

function applyEditorCommand(button) {
    const toolbar = button.closest('[data-editor-toolbar]');
    const surface = toolbar ? document.getElementById(toolbar.dataset.target) : null;
    if (!surface) return;

    surface.focus();

    if (button.dataset.editorAction === 'link') {
        const url = window.prompt('Enter the URL for this link:');
        if (url) {
            document.execCommand('createLink', false, url);
        }
    } else if (button.dataset.editorAction === 'clear') {
        document.execCommand('removeFormat', false, null);
        document.execCommand('unlink', false, null);
    } else if (button.dataset.editorBlock) {
        document.execCommand('formatBlock', false, `<${button.dataset.editorBlock.toLowerCase()}>`);
    } else if (button.dataset.editorCommand) {
        document.execCommand(button.dataset.editorCommand, false, button.dataset.editorValue || null);
    }

    if (surface === heroSubtitleEditor) {
        syncHeroEditor();
    } else {
        syncSectionRichEditor(surface);
    }
}

function renderEditors(entries) {
    editorsList.innerHTML = '';

    const ownerCard = document.createElement('div');
    ownerCard.className = 'flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3';
    ownerCard.innerHTML = `
        <div>
            <p class="font-medium text-slate-900">${OWNER_EMAIL}</p>
            <p class="text-sm text-slate-500">Owner access</p>
        </div>
        <span class="rounded-full bg-slate-900 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white">Owner</span>
    `;
    editorsList.appendChild(ownerCard);

    entries.forEach((entry) => {
        if (entry.email === OWNER_EMAIL) {
            return;
        }

        const row = document.createElement('div');
        row.className = 'flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3';
        row.innerHTML = `
            <div>
                <p class="font-medium text-slate-900">${entry.email}</p>
                <p class="text-sm text-slate-500">${entry.role || 'editor'}</p>
            </div>
            <button type="button" data-email="${entry.email}" class="rounded-full border border-red-200 px-3 py-1 text-sm text-red-600 transition hover:bg-red-50">
                Remove
            </button>
        `;

        row.querySelector('button').addEventListener('click', async () => {
            const email = row.querySelector('button').dataset.email;
            const confirmed = window.confirm(`Remove editor access for ${email}?`);
            if (!confirmed) return;

            try {
                await deleteDoc(doc(db, 'admins', email));
                setNotice(editorNotice, `Removed editor access for ${email}.`);
                await loadEditors();
            } catch (error) {
                console.error('Error removing editor:', error);
                setNotice(editorNotice, 'Could not remove that editor right now.', true);
            }
        });

        editorsList.appendChild(row);
    });
}

async function loadEditors() {
    if (!currentAccess.isOwner) {
        editorsList.innerHTML = '';
        return;
    }

    try {
        const querySnapshot = await getDocs(collection(db, 'admins'));
        const entries = [];

        querySnapshot.forEach((entryDoc) => {
            entries.push({
                email: entryDoc.id,
                ...(entryDoc.data() || {})
            });
        });

        entries.sort((left, right) => left.email.localeCompare(right.email));
        renderEditors(entries);
    } catch (error) {
        console.error('Error loading editors:', error);
        setNotice(editorNotice, 'Could not load the editor list.', true);
    }
}

function renderAccessState() {
    if (!currentAccess.user) {
        showShell('gate');
        return;
    }

    if (!currentAccess.canEdit) {
        deniedMessage.textContent = `${currentAccess.email} is signed in, but this account is not approved to edit the CMS.`;
        showShell('denied');
        return;
    }

    authStatus.textContent = `Signed in as ${currentAccess.email}. ${currentAccess.isOwner ? 'You can manage editors and publish changes.' : 'You can edit and publish the site content.'}`;
    ownerSection.classList.toggle('cms-shell-hidden', !currentAccess.isOwner);
    showShell('app');
}

saveContentButton.addEventListener('click', async () => {
    if (!currentAccess.canEdit) {
        setNotice(contentNotice, 'Sign in with an approved account before saving.', true);
        return;
    }

    syncHeroEditor();

    const validationErrors = getValidationSnapshot();
    if (validationErrors.length > 0) {
        setNotice(contentNotice, validationErrors[0], true);
        return;
    }

    const payload = {
        hero: {
            subtitleHtml: sanitizeRichHtml(siteContent.hero.subtitleHtml)
        },
        sections: siteContent.sections.map((section) => ({
            id: slugify(section.id || section.navLabel || section.title),
            navLabel: section.navLabel.trim(),
            navUseDots: Boolean(section.navUseDots),
            title: section.title.trim(),
            titleUseDots: Boolean(section.titleUseDots),
            bodyHtml: sanitizeRichHtml(section.bodyHtml)
        })),
        updatedAt: serverTimestamp(),
        updatedBy: currentAccess.email
    };

    saveContentButton.disabled = true;
    saveContentButton.textContent = 'Saving...';

    try {
        await setDoc(doc(db, 'siteContent', 'homepage'), payload, { merge: true });
        siteContent = payload;
        renderSections();
        setNotice(contentNotice, 'Homepage content saved. Dot-field validation passed.');
    } catch (error) {
        console.error('Error saving homepage content:', error);
        setNotice(contentNotice, 'Saving failed. Check Firebase rules and console details.', true);
    } finally {
        saveContentButton.disabled = false;
        saveContentButton.textContent = 'Save homepage content';
    }
});

editorForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!currentAccess.isOwner) {
        setNotice(editorNotice, 'Only the owner can manage editor emails.', true);
        return;
    }

    const email = normalizeEmail(editorEmailInput.value);
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!validEmail) {
        setNotice(editorNotice, 'Enter a valid email address.', true);
        return;
    }

    if (email === OWNER_EMAIL) {
        setNotice(editorNotice, 'That email is already the owner account.');
        return;
    }

    try {
        await setDoc(doc(db, 'admins', email), {
            email,
            role: 'editor',
            grantedBy: currentAccess.email,
            updatedAt: serverTimestamp()
        }, { merge: true });

        editorEmailInput.value = '';
        setNotice(editorNotice, `${email} can now sign in and edit the CMS.`);
        await loadEditors();
    } catch (error) {
        console.error('Error adding editor:', error);
        setNotice(editorNotice, 'Could not add that editor right now.', true);
    }
});

signInButtons.forEach((button) => {
    button.addEventListener('click', async () => {
        try {
            await signInWithGoogle();
        } catch (error) {
            console.error('Error signing in:', error);
            window.alert('Google sign-in failed. Confirm Google sign-in is enabled in Firebase Authentication.');
        }
    });
});

[signOutButton, deniedSignOut].forEach((button) => {
    button.addEventListener('click', async () => {
        try {
            await signOutCurrentUser();
        } catch (error) {
            console.error('Error signing out:', error);
        }
    });
});

addSectionButton.addEventListener('click', () => {
    siteContent.sections.push(createSection({
        id: `section-${siteContent.sections.length + 1}`,
        title: 'New Section',
        navLabel: 'New Section',
        titleUseDots: false,
        navUseDots: false
    }));
    renderSections();
});

sectionsList.addEventListener('input', (event) => {
    const card = event.target.closest('[data-section-index]');
    if (!card) return;

    const index = Number(card.dataset.sectionIndex);

    if (event.target.matches('[data-section-field]')) {
        updateSectionField(index, event.target.dataset.sectionField, event.target.type === 'checkbox' ? event.target.checked : event.target.value);
        return;
    }

    if (event.target.matches('[data-section-rich-field]')) {
        syncSectionRichEditor(event.target);
    }
});

sectionsList.addEventListener('change', (event) => {
    const card = event.target.closest('[data-section-index]');
    if (!card || !event.target.matches('[data-section-field="id"]')) return;

    const index = Number(card.dataset.sectionIndex);
    const nextValue = slugify(event.target.value);
    event.target.value = nextValue;
    updateSectionField(index, 'id', nextValue);
});

sectionsList.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-section-action]');
    if (!actionButton) return;

    const card = actionButton.closest('[data-section-index]');
    const index = Number(card.dataset.sectionIndex);
    const action = actionButton.dataset.sectionAction;

    if (action === 'remove') {
        siteContent.sections.splice(index, 1);
        renderSections();
    } else if (action === 'move-up') {
        moveSection(index, -1);
    } else if (action === 'move-down') {
        moveSection(index, 1);
    }
});

document.addEventListener('mousedown', (event) => {
    if (event.target.closest('[data-editor-toolbar] button')) {
        event.preventDefault();
    }
});

document.addEventListener('click', (event) => {
    const editorButton = event.target.closest('[data-editor-toolbar] button');
    if (!editorButton) return;

    applyEditorCommand(editorButton);
});

heroSubtitleEditor.addEventListener('input', syncHeroEditor);

document.addEventListener('DOMContentLoaded', async () => {
    try {
        siteContent = await loadSiteContent();
    } catch (error) {
        console.error('Error loading homepage content:', error);
        siteContent = structuredClone(DEFAULT_SITE_CONTENT);
        setNotice(contentNotice, 'Could not load saved homepage content, so defaults are shown for now.', true);
    }

    heroSubtitleEditor.innerHTML = siteContent.hero.subtitleHtml;
    renderSections();
    setNotice(contentNotice, 'The CMS checks dot-letter fields before saving.');
    setNotice(editorNotice, 'Only approved accounts can reach the editor tools.');

    listenToLetters((letters) => {
        lettersMap = letters || {};
        lettersReady = true;
        renderAllGlyphStatuses();
    });

    watchEditorAccess(async (access) => {
        currentAccess = access;
        renderAccessState();

        if (currentAccess.isOwner) {
            await loadEditors();
        }
    });
});
