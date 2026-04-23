
// Redirect to login page if not authenticated

/* â”€â”€ DOM refs â”€â”€ */
const accessDenied = document.getElementById('access-denied');
const adminApp = document.getElementById('admin-app');
const publishBar = document.getElementById('publish-bar');
const authStatus = document.getElementById('auth-status');
const deniedMessage = document.getElementById('denied-message');
const signOutButton = document.getElementById('sign-out-button');
const deniedSignOut = document.getElementById('denied-sign-out');
const heroSubtitleEditor = document.getElementById('hero-subtitle-editor');
const addSectionButton = document.getElementById('add-section-button');
const collapseAllButton = document.getElementById('collapse-all-button');
const sectionsList = document.getElementById('sections-list');
const emptySectionsHint = document.getElementById('empty-sections-hint');
const saveContentButton = document.getElementById('save-content-button');
const contentNotice = document.getElementById('content-notice');
const ownerSection = document.getElementById('owner-section');
const editorsList = document.getElementById('editors-list');
const editorForm = document.getElementById('editor-form');
const editorEmailInput = document.getElementById('editor-email');
const editorNotice = document.getElementById('editor-notice');
const previewFrame = document.getElementById('preview-frame');
const animationPauseInput = document.getElementById('animation-pause');
const animationSpeedInput = document.getElementById('animation-speed');
const refreshPreviewButton = document.getElementById('refresh-preview-button');
const toastEl = document.getElementById('cms-toast');

/* â”€â”€ State â”€â”€ */
let currentAccess = { user: null, email: '', canEdit: false, isOwner: false, role: null };
let siteContent = structuredClone(DEFAULT_SITE_CONTENT);
let lettersMap = {};
let lettersReady = false;
let collapsedSections = new Set();

/* â”€â”€ Helpers â”€â”€ */
function normalizeEmail(email = '') { return email.trim().toLowerCase(); }
function getSectionDisplayName(section = {}) { return deriveSectionName(section); }

function showToast(message, type = '') {
    toastEl.textContent = message;
    toastEl.className = 'cms-toast visible' + (type ? ` toast-${type}` : '');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => { toastEl.classList.remove('visible'); }, 4000);
}

function setNotice(element, message, isError = false) {
    element.textContent = message;
    element.classList.remove('text-red-600', 'text-slate-500', 'text-slate-600', 'text-emerald-600', 'text-gray-500');
    element.classList.add(isError ? 'text-red-600' : 'text-emerald-600');
}

function showShell(view) {
    accessDenied.classList.toggle('cms-shell-hidden', view !== 'denied');
    adminApp.classList.toggle('cms-shell-hidden', view !== 'app');
    publishBar.classList.toggle('cms-shell-hidden', view !== 'app');
}

function refreshPreview() {
    if (previewFrame) {
        previewFrame.src = '/?t=' + Date.now();
    }
}

/* â”€â”€ Validation â”€â”€ */
function getInlineValidation(section, index) {
    const issues = [];
    const sectionName = (section.navLabel || '').trim();

    if (!sectionName.trim()) {
        issues.push({ field: 'navLabel', message: 'Give this section a menu name so visitors can find it.' });
    }

    const id = deriveSectionId(section);
    const otherIds = siteContent.sections
        .filter((_, i) => i !== index)
        .map(s => deriveSectionId(s));
    if (otherIds.includes(id)) {
        issues.push({ field: 'navLabel', message: `Another section already uses "${id}" as its URL anchor. Change the menu name so the generated anchor stays unique.` });
    }

    if (lettersReady) {
        if (SECTION_MENU_USES_DOTS) {
            const missing = validateDotText(sectionName, lettersMap);
            if (missing.length > 0) {
                issues.push({
                    field: 'navLabel',
                    message: `The characters ${missing.join(', ')} haven't been designed yet. Open the Letter Designer to create them before publishing.`
                });
            }
        }
        if (SECTION_TITLE_USES_DOTS) {
            const missing = validateDotText(sectionName, lettersMap);
            if (missing.length > 0) {
                issues.push({
                    field: 'navLabel',
                    message: `The characters ${missing.join(', ')} haven't been designed yet. Open the Letter Designer to create them before publishing.`
                });
            }
        }

        if (section.isSplit) {
            if (section.graphicType === 'dot') {
                if (!section.graphicName.trim()) {
                    issues.push({ field: 'graphicName', message: 'Select a dot graphic to display in the split layout.' });
                } else if (!lettersMap[section.graphicName]) {
                    issues.push({ field: 'graphicName', message: `The dot graphic "${section.graphicName}" is not available. Save it in the Letter Designer first.` });
                }
            }
            if (section.graphicType === 'image' && !section.graphicUrl.trim()) {
                issues.push({ field: 'graphicUrl', message: 'Provide an image URL to display in the split layout.' });
            }
        }
    } else if (SECTION_MENU_USES_DOTS || SECTION_TITLE_USES_DOTS) {
        issues.push({ field: 'dots', message: 'Dot letters are still loading. Please wait a moment.' });
    }

    return issues;
}

function getValidationSnapshot() {
    const errors = [];
    siteContent.sections.forEach((section, index) => {
        const issues = getInlineValidation(section, index);
        issues.forEach(issue => {
            errors.push(`Section ${index + 1} "${getSectionDisplayName(section) || 'Untitled'}": ${issue.message}`);
        });
    });
    return errors;
}

function renderInlineValidation(card, index) {
    const section = siteContent.sections[index];
    if (!section) return;

    const issues = getInlineValidation(section, index);
    const existingHints = card.querySelectorAll('.cms-inline-error, .cms-inline-success, .glyph-status');
    existingHints.forEach(el => el.remove());

    const autoFieldsContainer = card.querySelector('[data-validation-target="autoFields"]');
    if (autoFieldsContainer) {
        const dotIssue = issues.find(i => i.field === 'navLabel' && i.message.includes('haven\'t been designed'));
        const derivedId = deriveSectionId(section);

        if (dotIssue) {
            autoFieldsContainer.innerHTML = `<div class="cms-inline-error"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>${escapeHtml(dotIssue.message)}</div>`;
        } else if (!lettersReady && (SECTION_MENU_USES_DOTS || SECTION_TITLE_USES_DOTS)) {
            autoFieldsContainer.innerHTML = `<div class="cms-inline-error" style="color: var(--cms-warn);">Loading letter designs...</div>`;
        } else {
            const dotSummary = [];
            if (SECTION_MENU_USES_DOTS) dotSummary.push('menu');
            if (SECTION_TITLE_USES_DOTS) dotSummary.push('section title');

            const dotText = dotSummary.length > 0
                ? `${dotSummary.join(' and ')} will use the global dot-style setting.`
                : 'Dot-style display is controlled globally by the developer.';

            autoFieldsContainer.innerHTML = `<div class="cms-field-help">URL anchor: <code>#${escapeHtml(derivedId)}</code>. ${dotText}</div>`;
        }
    }

    const graphicAreaContainer = card.querySelector('[data-validation-target="graphicArea"]');
    if (graphicAreaContainer) {
        if (section.isSplit) {
            const graphicError = issues.find(i => i.field === 'graphicName' || i.field === 'graphicUrl');
            if (graphicError) {
                graphicAreaContainer.innerHTML = `<div class="cms-inline-error"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>${escapeHtml(graphicError.message)}</div>`;
            } else if (section.graphicType === 'dot') {
                graphicAreaContainer.innerHTML = `<div class="cms-inline-success"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Dot graphic selection looks good.</div>`;
            } else if (section.graphicType === 'image') {
                graphicAreaContainer.innerHTML = `<div class="cms-inline-success"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Image graphic will display in the split section.</div>`;
            } else {
                graphicAreaContainer.innerHTML = `<div class="cms-field-help">Select a graphic type for the split layout.</div>`;
            }
        } else {
            graphicAreaContainer.innerHTML = '';
        }
    }
}

function renderAllInlineValidation() {
    sectionsList.querySelectorAll('[data-section-index]').forEach(card => {
        const index = Number(card.dataset.sectionIndex);
        renderInlineValidation(card, index);
    });
}

/* â”€â”€ Section rendering â”€â”€ */
function renderSections() {
    const isEmpty = siteContent.sections.length === 0;
    emptySectionsHint.classList.toggle('hidden', !isEmpty);

    sectionsList.innerHTML = siteContent.sections.map((section, index) => {
        const isCollapsed = collapsedSections.has(index);
        const sectionGraphicsOptions = Object.keys(lettersMap || {})
            .filter((name) => (window.letterKinds?.[name] || (name.length === 1 ? 'letter' : 'graphic')) === 'graphic')
            .sort()
            .map(name => 
            `<option value="${escapeHtml(name)}" ${section.graphicName === name ? 'selected' : ''}>${escapeHtml(name)}</option>`
        ).join('');
        return `
        <article class="cms-section-card${isCollapsed ? ' collapsed' : ''}" data-section-index="${index}">
            <div class="cms-section-card-header" data-section-action="toggle">
                <div class="section-title-row">
                    <span class="section-number">${index + 1}</span>
                    <span class="section-name">${escapeHtml(getSectionDisplayName(section) || 'Untitled section')}</span>
                </div>
                <div class="flex items-center gap-2">
                    <button type="button" data-section-action="move-up" class="cms-btn cms-btn-secondary cms-btn-sm" title="Move up" onclick="event.stopPropagation()">&#8593;</button>
                    <button type="button" data-section-action="move-down" class="cms-btn cms-btn-secondary cms-btn-sm" title="Move down" onclick="event.stopPropagation()">&#8595;</button>
                    <button type="button" data-section-action="remove" class="cms-btn cms-btn-danger cms-btn-sm" title="Remove section" onclick="event.stopPropagation()">&#10005;</button>
                    <svg class="collapse-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
            </div>

            <div class="cms-section-card-body" style="${isCollapsed ? 'max-height:0;opacity:0;padding-top:0;padding-bottom:0;' : ''}">
                <div class="mb-4">
                    <label class="block">
                        <span class="cms-field-label">Menu name</span>
                        <input type="text" class="cms-input" value="${escapeHtml(section.navLabel || '')}" data-section-field="navLabel">
                        <p class="cms-field-help">This one name is used for the menu label, the section heading, and the URL anchor.</p>
                    </label>
                    <div data-validation-target="autoFields" class="mt-2"></div>
                </div>

                <div class="mb-4 pt-4 border-t border-gray-100">
                    <div class="mb-4">
                        <label class="cms-checkbox-row">
                            <input type="checkbox" ${section.isSplit ? 'checked' : ''} data-section-field="isSplit">
                            <span>Use split layout with graphic</span>
                        </label>
                        <p class="cms-field-help">Split the section into two columns: text on one side and a graphic on the other.</p>
                    </div>

                    ${section.isSplit ? `
                    <div class="space-y-4 p-4 bg-blue-50 rounded-lg">
                        <div>
                            <p class="cms-field-label mb-2">Graphic type</p>
                            <div class="flex gap-4">
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="graphic-type-${index}" value="dot" ${section.graphicType === 'dot' ? 'checked' : ''} data-section-field="graphicType">
                                    <span class="text-sm font-medium">Dot graphic</span>
                                </label>
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="graphic-type-${index}" value="image" ${section.graphicType === 'image' ? 'checked' : ''} data-section-field="graphicType">
                                    <span class="text-sm font-medium">Uploaded image</span>
                                </label>
                            </div>
                        </div>

                        ${section.graphicType === 'dot' ? `
                        <div>
                            <label class="block">
                                <span class="cms-field-label">Dot graphic</span>
                                <select class="cms-input" data-section-field="graphicName">
                                    <option value="">-- Select a graphic --</option>
                                    ${sectionGraphicsOptions}
                                </select>
                                <p class="cms-field-help">Choose a dot graphic you've designed in the builder.</p>
                                <div data-validation-target="graphicArea" class="mt-2"></div>
                            </label>
                        </div>
                        ` : ''}

                        ${section.graphicType === 'image' ? `
                        <div>
                            <label class="block">
                                <span class="cms-field-label">Image URL</span>
                                <input type="text" class="cms-input" value="${escapeHtml(section.graphicUrl || '')}" data-section-field="graphicUrl" placeholder="https://example.com/image.jpg">
                                <p class="cms-field-help">Paste the URL of an image to display in the graphic area.</p>
                                <div data-validation-target="graphicArea" class="mt-2"></div>
                            </label>
                        </div>
                        <div>
                            <label class="block">
                                <span class="cms-field-label">Or upload an image</span>
                                <input type="file" accept="image/*" class="cms-input" data-section-file="graphicUrl">
                                <p class="cms-field-help">Upload a file and it will be stored for this section.</p>
                            </label>
                        </div>
                        ` : ''}
                    </div>
                    ` : ''}
                </div>

                <div class="mt-4 pt-4 border-t border-gray-100">
                    <p class="cms-field-label">Section content</p>
                    <p class="cms-field-help mb-2">Write the text visitors will see in this section. Use the toolbar to format.</p>
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
                            data-section-rich-field="bodyHtml" data-placeholder="Write your section content here...">${sanitizeRichHtml(section.bodyHtml)}</div>
                    </div>
                </div>

                ${isContactSection(section) ? `
                <div class="mt-4 pt-4 border-t border-gray-100">
                    <p class="cms-field-label mb-1">Contact email</p>
                    <p class="cms-field-help mb-3">The email shown below the section content as a clickable mailto link. Protected from spam bots.</p>
                    <div class="grid gap-4 md:grid-cols-2">
                        <label class="block">
                            <span class="cms-field-label">Display email</span>
                            <input type="email" class="cms-input" value="${escapeHtml(siteContent.contactEmail || '')}" data-contact-field="contactEmail" placeholder="info@adseum.nl">
                        </label>
                        <label class="block">
                            <span class="cms-field-label">Contact subtext</span>
                            <input type="text" class="cms-input" value="${escapeHtml(siteContent.contactSubtext || '')}" data-contact-field="contactSubtext" placeholder="Reach out to collaborate with us.">
                        </label>
                    </div>
                </div>
                ` : ''}
            </div>
        </article>
    `}).join('');

    renderAllInlineValidation();
}

/* â”€â”€ Sync editors â”€â”€ */
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

    if (field === 'isSplit') {
        siteContent.sections[index][field] = Boolean(value);
        if (siteContent.sections[index].isSplit && !siteContent.sections[index].graphicType) {
            siteContent.sections[index].graphicType = 'dot';
        }
        // Re-render the entire section when split mode changes
        renderSections();
        return;
    } else if (field === 'graphicType') {
        siteContent.sections[index][field] = value || null;
        // Re-render the entire section when graphic type changes
        renderSections();
        return;
    } else {
        siteContent.sections[index][field] = value;
        if (field === 'navLabel') {
            siteContent.sections[index].title = value.trim();
            siteContent.sections[index].id = deriveSectionId({ navLabel: value });
        }
    }

    // Update card header title live
    const card = sectionsList.querySelector(`[data-section-index="${index}"]`);
    if (card && field === 'navLabel') {
        const nameEl = card.querySelector('.section-name');
        if (nameEl) nameEl.textContent = getSectionDisplayName(siteContent.sections[index]) || 'Untitled section';
    }

    if (card) renderInlineValidation(card, index);
}

function moveSection(index, direction) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= siteContent.sections.length) return;

    const [section] = siteContent.sections.splice(index, 1);
    siteContent.sections.splice(nextIndex, 0, section);

    // Update collapsed tracking
    const newCollapsed = new Set();
    collapsedSections.forEach(i => {
        if (i === index) newCollapsed.add(nextIndex);
        else if (i === nextIndex) newCollapsed.add(index);
        else newCollapsed.add(i);
    });
    collapsedSections = newCollapsed;

    renderSections();
}

function applyEditorCommand(button) {
    const toolbar = button.closest('[data-editor-toolbar]');
    const surface = toolbar ? document.getElementById(toolbar.dataset.target) : null;
    if (!surface) return;

    surface.focus();

    if (button.dataset.editorAction === 'link') {
        const url = window.prompt('Enter the URL for this link:');
        if (url) document.execCommand('createLink', false, url);
    } else if (button.dataset.editorAction === 'clear') {
        document.execCommand('removeFormat', false, null);
        document.execCommand('unlink', false, null);
    } else if (button.dataset.editorBlock) {
        document.execCommand('formatBlock', false, `<${button.dataset.editorBlock.toLowerCase()}>`);
    } else if (button.dataset.editorCommand) {
        document.execCommand(button.dataset.editorCommand, false, button.dataset.editorValue || null);
    }

    if (surface === heroSubtitleEditor) syncHeroEditor();
    else syncSectionRichEditor(surface);
}

/* â”€â”€ Editor management â”€â”€ */
function renderEditors(entries) {
    editorsList.innerHTML = '';

    const ownerCard = document.createElement('div');
    ownerCard.className = 'flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3';
    ownerCard.innerHTML = `
        <div>
            <p class="font-medium text-sm">${OWNER_EMAIL}</p>
            <p class="text-xs text-gray-400">Owner</p>
        </div>
        <span class="text-xs uppercase tracking-wider text-gray-400 font-mono">Owner</span>
    `;
    editorsList.appendChild(ownerCard);

    entries.forEach((entry) => {
        if (entry.email === OWNER_EMAIL) return;

        const row = document.createElement('div');
        row.className = 'flex items-center justify-between gap-4 rounded-xl border border-gray-100 px-4 py-3';
        row.innerHTML = `
            <div>
                <p class="font-medium text-sm">${entry.email}</p>
                <p class="text-xs text-gray-400">${entry.role || 'editor'}</p>
            </div>
            <button type="button" data-email="${entry.email}" class="cms-btn cms-btn-danger cms-btn-sm">
                Remove
            </button>
        `;

        row.querySelector('button').addEventListener('click', async () => {
            const email = row.querySelector('button').dataset.email;
            const confirmed = window.confirm(`Remove access for ${email}? They will no longer be able to edit the website.`);
            if (!confirmed) return;

            try {
                await deleteDoc(doc(db, 'admins', email));
                showToast(`${email} has been removed.`);
                await loadEditors();
            } catch (error) {
                console.error('Error removing editor:', error);
                showToast('Could not remove that person right now.', 'error');
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
            entries.push({ email: entryDoc.id, ...(entryDoc.data() || {}) });
        });
        entries.sort((a, b) => a.email.localeCompare(b.email));
        renderEditors(entries);
    } catch (error) {
        console.error('Error loading editors:', error);
        setNotice(editorNotice, 'Could not load team members.', true);
    }
}

function renderAccessState() {
    if (!currentAccess.user) {
        window.location.replace('/login?redirect=' + encodeURIComponent(window.location.pathname));
        return;
    }

    if (!currentAccess.canEdit) {
        const verified = currentAccess.user?.emailVerified;
        if (!verified) {
            deniedMessage.textContent = `${currentAccess.email} is signed in, but the email address has not been verified yet. Please sign out and use the email sign-in link to verify your account.`;
        } else {
            deniedMessage.textContent = `${currentAccess.email} is signed in, but this account hasn't been approved yet. Ask the site owner to invite you.`;
        }
        showShell('denied');
        return;
    }

    authStatus.textContent = `Signed in as ${currentAccess.email}.${currentAccess.isOwner ? ' You have full owner access.' : ''}`;
    ownerSection.classList.toggle('cms-shell-hidden', !currentAccess.isOwner);
    showShell('app');
}

/* â”€â”€ Save / publish â”€â”€ */
saveContentButton.addEventListener('click', async () => {
    if (!currentAccess.canEdit) {
        showToast('Sign in with an approved account first.', 'error');
        return;
    }

    syncHeroEditor();

    const validationErrors = getValidationSnapshot();
    if (validationErrors.length > 0) {
        setNotice(contentNotice, validationErrors[0], true);
        showToast('Please fix the issues above before publishing.', 'error');

        // Expand the first section with errors
        siteContent.sections.forEach((section, index) => {
            const issues = getInlineValidation(section, index);
            if (issues.length > 0 && collapsedSections.has(index)) {
                collapsedSections.delete(index);
            }
        });
        renderSections();
        return;
    }

    const confirmed = window.confirm('Publish these changes? They will go live on your website immediately.');
    if (!confirmed) return;

    const payload = {
        hero: { subtitleHtml: sanitizeRichHtml(siteContent.hero.subtitleHtml) },
        sections: siteContent.sections.map((section) => ({
            id: deriveSectionId(section),
            navLabel: getSectionDisplayName(section),
            navUseDots: SECTION_MENU_USES_DOTS,
            title: getSectionDisplayName(section),
            titleUseDots: SECTION_TITLE_USES_DOTS,
            bodyHtml: sanitizeRichHtml(section.bodyHtml),
            specialType: section.specialType || null,
            isSplit: Boolean(section.isSplit),
            graphicType: section.isSplit ? (section.graphicType || 'dot') : null,
            graphicName: section.isSplit ? (section.graphicName || '').trim() : '',
            graphicUrl: section.isSplit ? (section.graphicUrl || '').trim() : ''
        })),
        dotPalette: siteContent.dotPalette || DEFAULT_SITE_CONTENT.dotPalette,
        animationPause: Math.max(0, Math.min(10, parseFloat(siteContent.animationPause) || 1.5)),
        animationSpeed: Math.max(0.1, Math.min(5, parseFloat(siteContent.animationSpeed) || 1.0)),
        contactEmail: (siteContent.contactEmail || '').trim(),
        contactSubtext: (siteContent.contactSubtext || '').trim(),
        updatedAt: serverTimestamp(),
        updatedBy: currentAccess.email
    };

    saveContentButton.disabled = true;
    saveContentButton.innerHTML = '<svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4m-3.93 7.07l-2.83-2.83M7.76 7.76L4.93 4.93"/></svg> Publishing...';

    try {
        await setDoc(doc(db, 'siteContent', 'homepage'), payload, { merge: true });
        siteContent = payload;
        renderSections();
        setNotice(contentNotice, 'Your changes are now live!');
        showToast('Published successfully! Your website has been updated.', 'success');

        // Refresh preview after publish
        setTimeout(refreshPreview, 1000);
    } catch (error) {
        console.error('Error saving homepage content:', error);
        setNotice(contentNotice, 'Publishing failed. Please try again.', true);
        showToast('Publishing failed. Check your connection and try again.', 'error');
    } finally {
        saveContentButton.disabled = false;
        saveContentButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Publish changes';
    }
});

/* â”€â”€ Editor form (owner) â”€â”€ */
editorForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!currentAccess.isOwner) {
        showToast('Only the site owner can manage team access.', 'error');
        return;
    }

    const email = normalizeEmail(editorEmailInput.value);
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!validEmail) {
        setNotice(editorNotice, 'Please enter a valid email address.', true);
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
        setNotice(editorNotice, `${email} has been invited! They can now sign in and edit.`);
        showToast(`${email} can now edit your website.`, 'success');
        await loadEditors();
    } catch (error) {
        console.error('Error adding editor:', error);
        showToast('Could not add that person right now.', 'error');
    }
});

/* â”€â”€ Event listeners â”€â”€ */
[signOutButton, deniedSignOut].forEach((btn) => {
    btn.addEventListener('click', async () => {
        try { await signOutCurrentUser(); }
        catch (error) { console.error('Error signing out:', error); }
    });
});

addSectionButton.addEventListener('click', () => {
    siteContent.sections.push(createSection({
        navLabel: `New Section ${siteContent.sections.length + 1}`
    }));
    renderSections();

    // Scroll to the new section
    setTimeout(() => {
        const lastCard = sectionsList.querySelector('[data-section-index]:last-child');
        if (lastCard) lastCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
});

collapseAllButton.addEventListener('click', () => {
    const allCollapsed = siteContent.sections.every((_, i) => collapsedSections.has(i));
    if (allCollapsed) {
        collapsedSections.clear();
        collapseAllButton.textContent = 'Collapse all';
    } else {
        siteContent.sections.forEach((_, i) => collapsedSections.add(i));
        collapseAllButton.textContent = 'Expand all';
    }
    renderSections();
});

refreshPreviewButton.addEventListener('click', refreshPreview);

sectionsList.addEventListener('input', (event) => {
    const card = event.target.closest('[data-section-index]');
    if (!card) return;
    const index = Number(card.dataset.sectionIndex);

    if (event.target.matches('[data-contact-field]')) {
        siteContent[event.target.dataset.contactField] = event.target.value.trim();
        return;
    }

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
    if (!card) return;

    if (event.target.matches('[data-section-file]')) {
        const index = Number(card.dataset.sectionIndex);
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.addEventListener('load', () => {
            if (typeof reader.result === 'string') {
                updateSectionField(index, 'graphicUrl', reader.result);
            }
        });
        reader.readAsDataURL(file);
        return;
    }
});

sectionsList.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-section-action]');
    if (!actionButton) return;

    const card = actionButton.closest('[data-section-index]');
    const index = Number(card.dataset.sectionIndex);
    const action = actionButton.dataset.sectionAction;

    if (action === 'toggle') {
        if (collapsedSections.has(index)) {
            collapsedSections.delete(index);
        } else {
            collapsedSections.add(index);
        }
        card.classList.toggle('collapsed');
        const body = card.querySelector('.cms-section-card-body');
        if (body) {
            if (card.classList.contains('collapsed')) {
                body.style.maxHeight = '0';
                body.style.opacity = '0';
                body.style.paddingTop = '0';
                body.style.paddingBottom = '0';
            } else {
                body.style.maxHeight = '';
                body.style.opacity = '';
                body.style.paddingTop = '';
                body.style.paddingBottom = '';
            }
        }
    } else if (action === 'remove') {
        const title = siteContent.sections[index]?.title || 'this section';
        if (!window.confirm(`Remove "${title}"? This cannot be undone.`)) return;
        siteContent.sections.splice(index, 1);
        collapsedSections.delete(index);
        renderSections();
    } else if (action === 'move-up') {
        moveSection(index, -1);
    } else if (action === 'move-down') {
        moveSection(index, 1);
    }
});

document.addEventListener('mousedown', (event) => {
    if (event.target.closest('[data-editor-toolbar] button')) event.preventDefault();
});

document.addEventListener('click', (event) => {
    const editorButton = event.target.closest('[data-editor-toolbar] button');
    if (!editorButton) return;
    applyEditorCommand(editorButton);
});

heroSubtitleEditor.addEventListener('input', syncHeroEditor);

animationPauseInput.addEventListener('input', () => {
    siteContent.animationPause = parseFloat(animationPauseInput.value) || 1.5;
});

animationSpeedInput.addEventListener('input', () => {
    siteContent.animationSpeed = parseFloat(animationSpeedInput.value) || 1.0;
});

/* â”€â”€ Init (DOM is guaranteed ready after await requireAuth()) â”€â”€ */
try {
    siteContent = await loadSiteContent();
} catch (error) {
    console.error('Error loading homepage content:', error);
    siteContent = structuredClone(DEFAULT_SITE_CONTENT);
    showToast('Could not load saved content. Showing defaults.', 'error');
}

heroSubtitleEditor.innerHTML = siteContent.hero.subtitleHtml;
animationPauseInput.value = siteContent.animationPause ?? 1.5;
animationSpeedInput.value = siteContent.animationSpeed ?? 1.0;
renderSections();
setNotice(contentNotice, 'Ready to publish. Your changes won\'t go live until you click Publish.');
setNotice(editorNotice, 'Only approved accounts can edit the website.');

listenToLetters((letters) => {
    lettersMap = letters || {};
    lettersReady = true;
    renderSections();
});

watchEditorAccess(async (access) => {
    currentAccess = access;
    renderAccessState();
    if (currentAccess.isOwner) await loadEditors();
});
