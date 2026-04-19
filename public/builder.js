import { db } from './firebase-config.js';
import { DEFAULT_DOT_PALETTE } from './modules/config.js';
import { renderLetter } from './modules/renderer.js';
import {
    loadSiteContent,
    normalizeDotPalette,
    normalizeHexColor
} from './modules/database.js';
import {
    signOutCurrentUser,
    watchEditorAccess
} from './modules/admin-access.js';
import { requireAuth } from './modules/auth-guard.js';
import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    serverTimestamp,
    setDoc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// Redirect to login page if not authenticated
await requireAuth();

window.letters = window.letters || {};
window.letterColors = window.letterColors || {};
window.letterOffsets = window.letterOffsets || {};

let rows = 11;
let cols = 7;
let currentGrid = Array.from({ length: rows }, () => Array(cols).fill(0));
let currentColorGrid = Array.from({ length: rows }, () => Array(cols).fill(null));
let currentOffsetGrid = Array.from({ length: rows }, () => Array(cols).fill(null));
let selectedColor = null;
let offsetMode = false;
let offsetSelection = new Set(); // Set of "row,col" keys
let currentAccess = {
    user: null,
    email: '',
    canEdit: false,
    isOwner: false,
    role: null
};

const editorGrid = document.getElementById('editor-grid');
const previewContainer = document.getElementById('preview-container');
const letterButtons = document.getElementById('letter-buttons');
const newLetterRow = document.getElementById('new-letter-row');
const newLetterInput = document.getElementById('new-letter-input');
const cancelNewLetterButton = document.getElementById('cancel-new-letter-button');
const graphicModeToggle = document.getElementById('graphic-mode-toggle');
const selectedLetterStatus = document.getElementById('selected-letter-status');
const rowsInput = document.getElementById('grid-rows');
const colsInput = document.getElementById('grid-cols');
const authStatus = document.getElementById('auth-status');
const signOutButton = document.getElementById('sign-out-button');
const saveButton = document.getElementById('save-button');
const deleteButton = document.getElementById('delete-button');
const downloadButton = document.getElementById('download-button');
const selectedColorLabel = document.getElementById('selected-color-label');
const colorPalette = document.getElementById('color-palette');
const paletteColorInput = document.getElementById('palette-color-input');
const paletteNotice = document.getElementById('palette-notice');
const offsetModeToggle = document.getElementById('offset-mode-toggle');
const offsetClearSelection = document.getElementById('offset-clear-selection');
const offsetControls = document.getElementById('offset-controls');
const offsetSelectionCount = document.getElementById('offset-selection-count');
const offsetXInput = document.getElementById('offset-x');
const offsetYInput = document.getElementById('offset-y');
const offsetApplyButton = document.getElementById('offset-apply');
const offsetResetButton = document.getElementById('offset-reset');

let activePalette = [...DEFAULT_DOT_PALETTE];
let paletteEntries = activePalette.map((color) => ({ color, label: color }));
let currentLetterName = '';
let previousLetterName = '';

function cloneGrid(grid) {
    return JSON.parse(JSON.stringify(grid));
}

function cloneColorGrid(grid) {
    return JSON.parse(JSON.stringify(grid));
}

function setPaletteNotice(message, isError = false) {
    paletteNotice.textContent = message;
    paletteNotice.classList.remove('text-gray-400', 'text-red-600', 'text-emerald-600');
    paletteNotice.classList.add(isError ? 'text-red-600' : 'text-emerald-600');
}

function getAllowedPalette() {
    return normalizeDotPalette(activePalette);
}

function syncPaletteEntries() {
    activePalette = getAllowedPalette();
    window.dotPalette = [...activePalette];
    paletteEntries = activePalette.map((color) => ({ color, label: color }));

    if (selectedColor && !activePalette.includes(selectedColor)) {
        selectedColor = null;
    }
}

function updateLetterSelectionUi() {
    const isExistingLetter = Boolean(currentLetterName && window.letters[currentLetterName]);

    if (isExistingLetter) {
        selectedLetterStatus.textContent = `Editing letter "${currentLetterName}".`;
        saveButton.textContent = 'Save changes';
    } else if (newLetterRow.classList.contains('hidden')) {
        selectedLetterStatus.textContent = 'Pick a letter to edit, or create a new one.';
        saveButton.textContent = 'Save letter';
    } else {
        const typedCharacter = newLetterInput.value.trim();
        selectedLetterStatus.textContent = typedCharacter
            ? `Creating new letter "${typedCharacter}".`
            : 'Type the character you want to design.';
        saveButton.textContent = 'Save new letter';
    }

    deleteButton.disabled = !currentAccess.canEdit || !isExistingLetter;
}

function refreshPaletteUi() {
    syncPaletteEntries();
    initColorPalette();
    updatePreview();
}

function clearEditorGrid() {
    currentGrid = Array.from({ length: rows }, () => Array(cols).fill(0));
    currentColorGrid = Array.from({ length: rows }, () => Array(cols).fill(null));
    currentOffsetGrid = Array.from({ length: rows }, () => Array(cols).fill(null));
    offsetSelection.clear();
    updateOffsetUi();
}

function openNewLetterMode() {
    previousLetterName = currentLetterName;
    currentLetterName = '';
    clearEditorGrid();
    newLetterInput.value = '';
    graphicModeToggle.checked = false;
    updateNewLetterInputAttributes();
    newLetterRow.classList.remove('hidden');
    initEditor(true);
    refreshLetterButtons();
    updateLetterSelectionUi();
    setPaletteNotice('Choose whether you want to design a letter (single character) or a graphic (like a heart), then draw it on the grid and save.');
    setTimeout(() => newLetterInput.focus(), 0);
}

function closeNewLetterMode() {
    newLetterRow.classList.add('hidden');
    newLetterInput.value = '';
    graphicModeToggle.checked = false;
    updateLetterSelectionUi();
}

function updateNewLetterInputAttributes() {
    const isGraphicMode = graphicModeToggle.checked;
    if (isGraphicMode) {
        newLetterInput.placeholder = 'e.g. heart, smiley, star';
        newLetterInput.removeAttribute('maxlength');
    } else {
        newLetterInput.placeholder = 'Type one character';
        newLetterInput.setAttribute('maxlength', '1');
    }
}

function rebuildLettersFromSnapshot(querySnapshot) {
    window.letters = {};
    window.letterColors = {};
    window.letterOffsets = {};

    querySnapshot.forEach((letterDoc) => {
        const data = letterDoc.data();
        if (data.gridData) {
            const reconstructedGrid = [];
            for (let index = 0; index < data.rows; index += 1) {
                reconstructedGrid.push(data.gridData[`row${index}`]);
            }
            window.letters[letterDoc.id] = reconstructedGrid;
        } else if (data.grid) {
            window.letters[letterDoc.id] = data.grid;
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
        window.letterColors[letterDoc.id] = colorMap;

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
        window.letterOffsets[letterDoc.id] = offsetMap;
    });
}

function getSelectedColorLabel(color) {
    if (!color) {
        return 'Default (black)';
    }

    const entry = paletteEntries.find((item) => item.color === color);
    return entry ? `${entry.label} ${entry.color}` : color;
}

function updateSelectedColorDisplay() {
    selectedColorLabel.textContent = getSelectedColorLabel(selectedColor);
}

function updateSwatchSelection(activeSwatch) {
    colorPalette.querySelectorAll('.color-swatch, .eraser-swatch').forEach((swatch) => {
        swatch.classList.remove('selected');
        if (swatch.classList.contains('color-swatch') && swatch.dataset.color === '#FFFFFF') {
            swatch.style.border = '2px solid #d1d5db';
        } else if (swatch.classList.contains('color-swatch')) {
            swatch.style.border = '2px solid transparent';
        } else {
            swatch.style.border = '2px solid #d1d5db';
        }
    });

    activeSwatch.classList.add('selected');
}

function initColorPalette() {
    colorPalette.innerHTML = '';

    const eraser = document.createElement('div');
    eraser.className = 'eraser-swatch';
    eraser.textContent = 'x';
    eraser.title = 'Default (black dot)';
    if (!selectedColor) {
        eraser.classList.add('selected');
    }
    eraser.addEventListener('click', () => {
        selectedColor = null;
        updateSelectedColorDisplay();
        updateSwatchSelection(eraser);
    });
    colorPalette.appendChild(eraser);

    paletteEntries.forEach(({ color, label }) => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.dataset.color = color;
        swatch.title = `${label} (${color})`;
        swatch.style.backgroundColor = color;
        if (color === '#FFFFFF') {
            swatch.style.border = '2px solid #d1d5db';
        }
        if (selectedColor === color) {
            swatch.classList.add('selected');
        }
        swatch.addEventListener('click', () => {
            selectedColor = color;
            updateSelectedColorDisplay();
            updateSwatchSelection(swatch);
        });
        colorPalette.appendChild(swatch);
    });

    const addColorSwatch = document.createElement('button');
    addColorSwatch.type = 'button';
    addColorSwatch.className = 'add-color-swatch';
    addColorSwatch.textContent = '+';
    addColorSwatch.title = 'Add a new predefined color';
    addColorSwatch.addEventListener('click', () => {
        if (!currentAccess.canEdit) {
            setPaletteNotice('Sign in with an approved editor account before adding colors.', true);
            return;
        }

        paletteColorInput.click();
    });
    colorPalette.appendChild(addColorSwatch);

    updateSelectedColorDisplay();
}

function setEditorEnabled(enabled) {
    [newLetterInput, cancelNewLetterButton, graphicModeToggle, saveButton, deleteButton, downloadButton, paletteColorInput, offsetXInput, offsetYInput, offsetApplyButton, offsetResetButton].forEach((element) => {
        element.disabled = !enabled;
    });
    offsetModeToggle.disabled = !enabled;

    colorPalette.querySelectorAll('.color-swatch, .eraser-swatch, .add-color-swatch').forEach((swatch) => {
        swatch.style.pointerEvents = enabled ? 'auto' : 'none';
        swatch.style.opacity = enabled ? '1' : '0.55';
    });

    editorGrid.querySelectorAll('.cell').forEach((cell) => {
        cell.style.pointerEvents = enabled ? 'auto' : 'none';
        cell.style.opacity = enabled ? '1' : '0.55';
    });

    updateLetterSelectionUi();
}

function renderAuthState() {
    if (!currentAccess.user) {
        // Auth guard handles redirect
        return;
    }

    signOutButton.classList.remove('hidden');

    if (currentAccess.canEdit) {
        authStatus.textContent = `Signed in as ${currentAccess.email}.`;
        setEditorEnabled(true);
    } else {
        authStatus.textContent = `Signed in as ${currentAccess.email}, but this account hasn't been approved yet.`;
        setEditorEnabled(false);
    }
}

function buildColorMapFromGrid() {
    const colorMap = {};
    currentColorGrid.forEach((row, rowIndex) => {
        row.forEach((color, colIndex) => {
            if (color) {
                colorMap[`${rowIndex},${colIndex}`] = color;
            }
        });
    });
    return colorMap;
}

function buildOffsetMapFromGrid() {
    const offsetMap = {};
    currentOffsetGrid.forEach((row, rowIndex) => {
        row.forEach((offset, colIndex) => {
            if (offset && (offset.x !== 0 || offset.y !== 0)) {
                offsetMap[`${rowIndex},${colIndex}`] = { x: offset.x, y: offset.y };
            }
        });
    });
    return offsetMap;
}

function getOffset(rowIndex, colIndex) {
    return currentOffsetGrid[rowIndex] && currentOffsetGrid[rowIndex][colIndex]
        ? currentOffsetGrid[rowIndex][colIndex]
        : null;
}

function updateOffsetUi() {
    const count = offsetSelection.size;
    offsetSelectionCount.textContent = count;
    offsetClearSelection.classList.toggle('hidden', count === 0);
    offsetControls.classList.toggle('hidden', !offsetMode);

    // When exactly one dot is selected or all share the same offset, show its values
    if (count > 0) {
        const keys = [...offsetSelection];
        const offsets = keys.map(k => {
            const [r, c] = k.split(',').map(Number);
            return getOffset(r, c) || { x: 0, y: 0 };
        });
        const allSameX = offsets.every(o => o.x === offsets[0].x);
        const allSameY = offsets.every(o => o.y === offsets[0].y);
        offsetXInput.value = allSameX ? offsets[0].x : '';
        offsetYInput.value = allSameY ? offsets[0].y : '';
    } else {
        offsetXInput.value = 0;
        offsetYInput.value = 0;
    }

    // Update cell classes for offset indicators
    editorGrid.querySelectorAll('.cell').forEach(cell => {
        const r = parseInt(cell.dataset.r);
        const c = parseInt(cell.dataset.c);
        const key = `${r},${c}`;
        const offset = getOffset(r, c);
        const hasOffset = offset && (offset.x !== 0 || offset.y !== 0);

        cell.classList.toggle('has-offset', hasOffset && offsetMode);
        cell.classList.toggle('offset-selected', offsetSelection.has(key));
    });

    editorGrid.classList.toggle('offset-mode-active', offsetMode);
}

function toggleOffsetMode() {
    offsetMode = !offsetMode;
    offsetModeToggle.textContent = offsetMode ? 'Disable offset mode' : 'Enable offset mode';
    if (offsetMode) {
        offsetModeToggle.classList.remove('cms-btn-secondary');
        offsetModeToggle.classList.add('cms-btn-primary');
    } else {
        offsetModeToggle.classList.remove('cms-btn-primary');
        offsetModeToggle.classList.add('cms-btn-secondary');
        offsetSelection.clear();
    }
    updateOffsetUi();
}

function applyOffsetToSelection(x, y) {
    offsetSelection.forEach(key => {
        const [r, c] = key.split(',').map(Number);
        if (currentGrid[r] && currentGrid[r][c] === 1) {
            currentOffsetGrid[r][c] = { x, y };
        }
    });
    updateOffsetUi();
    updatePreview();
}

function resetOffsetSelection() {
    applyOffsetToSelection(0, 0);
}

function getUnsupportedGridColors() {
    const allowedColors = new Set(getAllowedPalette());
    const unsupportedColors = new Set();

    currentColorGrid.forEach((row) => {
        row.forEach((color) => {
            const normalizedColor = normalizeHexColor(color || '');
            if (normalizedColor && !allowedColors.has(normalizedColor)) {
                unsupportedColors.add(normalizedColor);
            }
        });
    });

    return [...unsupportedColors];
}

function updatePreview() {
    previewContainer.innerHTML = '';
    const rendered = renderLetter('custom', currentGrid, { colorMap: buildColorMapFromGrid(), offsetMap: buildOffsetMapFromGrid(), visualScale: 1.35, gap: 2 });
    previewContainer.appendChild(rendered);

    if (typeof gsap !== 'undefined') {
        gsap.fromTo(
            '#preview-container .dot-wrapper svg',
            { scale: 0, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.4, stagger: 0.02, ease: 'back.out(1.7)' }
        );
    }
}

function getCellColor(rowIndex, colIndex) {
    return currentColorGrid[rowIndex] ? currentColorGrid[rowIndex][colIndex] : null;
}

function paintCell(cell, rowIndex, colIndex) {
    // In offset mode, clicking a filled dot toggles its selection
    if (offsetMode) {
        if (currentGrid[rowIndex][colIndex] !== 1) return; // only select active dots
        const key = `${rowIndex},${colIndex}`;
        if (offsetSelection.has(key)) {
            offsetSelection.delete(key);
        } else {
            offsetSelection.add(key);
        }
        updateOffsetUi();
        return;
    }

    const isOn = currentGrid[rowIndex][colIndex] === 1;
    const cellColor = getCellColor(rowIndex, colIndex);

    if (!isOn) {
        currentGrid[rowIndex][colIndex] = 1;
        currentColorGrid[rowIndex][colIndex] = selectedColor;
    } else if (cellColor === selectedColor) {
        currentGrid[rowIndex][colIndex] = 0;
        currentColorGrid[rowIndex][colIndex] = null;
        // Clear offset when dot is removed
        currentOffsetGrid[rowIndex][colIndex] = null;
        offsetSelection.delete(`${rowIndex},${colIndex}`);
    } else {
        currentColorGrid[rowIndex][colIndex] = selectedColor;
    }

    const nextColor = currentGrid[rowIndex][colIndex] ? (currentColorGrid[rowIndex][colIndex] || '#000000') : '';
    cell.style.backgroundColor = nextColor;
    cell.classList.toggle('active', currentGrid[rowIndex][colIndex] === 1);
    updatePreview();
}

function initEditor(preserveData = false) {
    updateGridSizeDisplay();
    editorGrid.innerHTML = '';
    editorGrid.style.gridTemplateColumns = `repeat(${cols}, 30px)`;

    if (!preserveData) {
        currentGrid = Array.from({ length: rows }, () => Array(cols).fill(0));
        currentColorGrid = Array.from({ length: rows }, () => Array(cols).fill(null));
        currentOffsetGrid = Array.from({ length: rows }, () => Array(cols).fill(null));
    }

    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
        for (let colIndex = 0; colIndex < cols; colIndex += 1) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            if (currentGrid[rowIndex] && currentGrid[rowIndex][colIndex]) {
                cell.classList.add('active');
                cell.style.backgroundColor = getCellColor(rowIndex, colIndex) || '#000000';
            }

            cell.dataset.r = rowIndex;
            cell.dataset.c = colIndex;
            cell.addEventListener('mousedown', () => {
                if (!currentAccess.canEdit) return;
                paintCell(cell, rowIndex, colIndex);
            });

            editorGrid.appendChild(cell);
        }
    }

    updatePreview();
    setEditorEnabled(currentAccess.canEdit);
}

function loadLetter(char) {
    if (!window.letters[char]) return;

    const data = window.letters[char];
    const storedColorMap = window.letterColors[char] || {};
    const storedOffsetMap = window.letterOffsets[char] || {};

    rows = data.length;
    cols = data[0].length;
    currentGrid = cloneGrid(data);
    currentColorGrid = Array.from({ length: rows }, (_, rowIndex) =>
        Array.from({ length: cols }, (_, colIndex) => storedColorMap[`${rowIndex},${colIndex}`] || null)
    );
    currentOffsetGrid = Array.from({ length: rows }, (_, rowIndex) =>
        Array.from({ length: cols }, (_, colIndex) => {
            const offset = storedOffsetMap[`${rowIndex},${colIndex}`];
            return offset ? { x: offset.x, y: offset.y } : null;
        })
    );
    offsetSelection.clear();

    currentLetterName = char;
    previousLetterName = '';
    closeNewLetterMode();
    initEditor(true);
    refreshLetterButtons();
    updateLetterSelectionUi();

    const unsupportedColors = getUnsupportedGridColors();
    if (unsupportedColors.length > 0) {
        setPaletteNotice(`This letter uses colors not in your current palette: ${unsupportedColors.join(', ')}. Please repaint those dots before saving.`, true);
    } else {
        setPaletteNotice('These colors are available across your website. Use the + button to add new ones.');
    }
}

function refreshLetterButtons() {
    letterButtons.innerHTML = '';

    Object.keys(window.letters || {}).sort().forEach((char) => {
        const button = document.createElement('button');
        button.className = `builder-letter-btn${currentLetterName === char ? ' active' : ''}`;
        button.innerText = char;
        button.addEventListener('click', () => loadLetter(char));
        letterButtons.appendChild(button);
    });

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'builder-letter-btn';
    addButton.style.borderStyle = 'dashed';
    addButton.textContent = '+';
    addButton.title = 'Design a new letter';
    addButton.addEventListener('click', openNewLetterMode);
    letterButtons.appendChild(addButton);
}

async function loadFromFirestore() {
    try {
        const querySnapshot = await getDocs(collection(db, 'letters'));
        rebuildLettersFromSnapshot(querySnapshot);
        refreshLetterButtons();
        updateLetterSelectionUi();
    } catch (error) {
        console.error('Error loading letters from Firestore:', error);
    }
}

function updateGridSizeDisplay() {
    rowsInput.textContent = rows;
    colsInput.textContent = cols;
}

window.addRow = function addRow(side) {
    if (!currentAccess.canEdit) return;
    const emptyRow = Array(cols).fill(0);
    const emptyColorRow = Array(cols).fill(null);
    const emptyOffsetRow = Array(cols).fill(null);
    if (side === 'top') {
        currentGrid.unshift(emptyRow);
        currentColorGrid.unshift(emptyColorRow);
        currentOffsetGrid.unshift(emptyOffsetRow);
    } else {
        currentGrid.push(emptyRow);
        currentColorGrid.push(emptyColorRow);
        currentOffsetGrid.push(emptyOffsetRow);
    }
    rows += 1;
    offsetSelection.clear();
    initEditor(true);
};

window.removeRow = function removeRow(side) {
    if (!currentAccess.canEdit || rows <= 1) return;
    if (side === 'top') {
        currentGrid.shift();
        currentColorGrid.shift();
        currentOffsetGrid.shift();
    } else {
        currentGrid.pop();
        currentColorGrid.pop();
        currentOffsetGrid.pop();
    }
    rows -= 1;
    offsetSelection.clear();
    initEditor(true);
};

window.addCol = function addCol(side) {
    if (!currentAccess.canEdit) return;
    for (let i = 0; i < rows; i += 1) {
        if (side === 'left') {
            currentGrid[i].unshift(0);
            currentColorGrid[i].unshift(null);
            currentOffsetGrid[i].unshift(null);
        } else {
            currentGrid[i].push(0);
            currentColorGrid[i].push(null);
            currentOffsetGrid[i].push(null);
        }
    }
    cols += 1;
    offsetSelection.clear();
    initEditor(true);
};

window.removeCol = function removeCol(side) {
    if (!currentAccess.canEdit || cols <= 1) return;
    for (let i = 0; i < rows; i += 1) {
        if (side === 'left') {
            currentGrid[i].shift();
            currentColorGrid[i].shift();
            currentOffsetGrid[i].shift();
        } else {
            currentGrid[i].pop();
            currentColorGrid[i].pop();
            currentOffsetGrid[i].pop();
        }
    }
    cols -= 1;
    offsetSelection.clear();
    initEditor(true);
};

window.downloadLettersJS = function downloadLettersJS() {
    if (!currentAccess.canEdit) {
        window.alert('Please sign in with an approved account to download the letter set.');
        return;
    }

    const content = `// Letter Definitions (1 = dot, 0 = space)\n// Generated by Letter Builder\nconst letters = ${JSON.stringify(window.letters, null, 4)};\nwindow.letters = letters;\n`;
    const blob = new Blob([content], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'letters.js';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
};

window.addToAlphabet = async function addToAlphabet() {
    if (!currentAccess.canEdit) {
        window.alert('Sign in with an approved editor account before saving.');
        return;
    }

    const name = (currentLetterName || newLetterInput.value.trim()).trim();
    if (!name) {
        window.alert('Please type the character you want to save first.');
        return;
    }

    const isGraphicMode = graphicModeToggle.checked;
    if (!isGraphicMode && name.length !== 1) {
        window.alert('Each letter design represents a single character (e.g. "A", "b", "3").');
        return;
    }

    if (isGraphicMode && name.length < 2) {
        window.alert('Graphic names should be at least 2 characters (e.g. "heart", "star").');
        return;
    }

    if (!isGraphicMode && name.match(/[^a-zA-Z0-9]/)) {
        window.alert('Letter names can only contain letters and numbers.');
        return;
    }

    if (isGraphicMode && name.match(/[^a-z0-9_-]/i)) {
        window.alert('Graphic names can only contain letters, numbers, hyphens, and underscores.');
        return;
    }

    const unsupportedColors = getUnsupportedGridColors();
    if (unsupportedColors.length > 0) {
        setPaletteNotice(`Some dots use colors not in your website palette (${unsupportedColors.join(', ')}). Please repaint them with palette colors before saving.`, true);
        return;
    }

    const originalText = saveButton.textContent;
    saveButton.textContent = 'Saving...';
    saveButton.disabled = true;

    try {
        const gridData = {};
        const colorData = {};
        const offsetData = {};

        currentGrid.forEach((rowData, index) => {
            gridData[`row${index}`] = rowData;
        });

        currentColorGrid.forEach((rowData, index) => {
            colorData[`row${index}`] = rowData;
        });

        currentOffsetGrid.forEach((rowData, index) => {
            offsetData[`row${index}`] = rowData.map(o => o ? { x: o.x, y: o.y } : null);
        });

        await setDoc(doc(db, 'letters', name), {
            rows,
            cols,
            gridData,
            colorData,
            offsetData
        });

        window.letters[name] = cloneGrid(currentGrid);
        window.letterColors[name] = buildColorMapFromGrid();
        window.letterOffsets[name] = buildOffsetMapFromGrid();
        currentLetterName = name;
        previousLetterName = '';
        closeNewLetterMode();
        refreshLetterButtons();
        updateLetterSelectionUi();
        const itemType = isGraphicMode ? 'Graphic' : 'Letter';
        window.alert(`${itemType} "${name}" has been saved! It will appear on your website automatically.`);
    } catch (error) {
        console.error('Error saving letter:', error);
        window.alert('Something went wrong while saving. Please check your connection and try again.');
    } finally {
        saveButton.textContent = originalText;
        saveButton.disabled = !currentAccess.canEdit;
    }
};

async function persistPaletteChange(successMessage) {
    if (!currentAccess.canEdit) {
        setPaletteNotice('Sign in with an approved editor account before changing colors.', true);
        return false;
    }

    const nextPalette = normalizeDotPalette(activePalette);
    setPaletteNotice('Saving predefined colors...');

    try {
        await setDoc(doc(db, 'siteContent', 'homepage'), {
            dotPalette: nextPalette,
            updatedAt: serverTimestamp(),
            updatedBy: currentAccess.email
        }, { merge: true });

        activePalette = nextPalette;
        refreshPaletteUi();
        setPaletteNotice(successMessage);
        return true;
    } catch (error) {
        console.error('Error saving palette:', error);
        setPaletteNotice('Could not save the color palette right now. Check Firebase rules and console details.', true);
        return false;
    }
}

window.deleteLetter = async function deleteLetter() {
    if (!currentAccess.canEdit) {
        window.alert('Sign in with an approved editor account before deleting.');
        return;
    }

    const name = currentLetterName.trim();
    if (!name) {
        window.alert('Please load an existing letter to delete.');
        return;
    }

    const confirmed = window.confirm(`Delete the letter "${name}"? It will be removed from your website and this cannot be undone.`);
    if (!confirmed) {
        return;
    }

    try {
        await deleteDoc(doc(db, 'letters', name));
        delete window.letters[name];
        delete window.letterColors[name];
        delete window.letterOffsets[name];
        currentLetterName = '';
        previousLetterName = '';
        closeNewLetterMode();
        clearEditorGrid();
        initEditor(true);
        refreshLetterButtons();
        updateLetterSelectionUi();
        window.alert(`Letter "${name}" has been deleted.`);
    } catch (error) {
        console.error('Error deleting letter:', error);
        window.alert('Something went wrong while deleting. Please check your connection and try again.');
    }
};


signOutButton.addEventListener('click', async () => {
    try {
        await signOutCurrentUser();
    } catch (error) {
        console.error('Error signing out:', error);
    }
});

cancelNewLetterButton.addEventListener('click', () => {
    if (previousLetterName && window.letters[previousLetterName]) {
        loadLetter(previousLetterName);
        return;
    }

    previousLetterName = '';
    closeNewLetterMode();
    if (!currentLetterName) {
        clearEditorGrid();
        initEditor(true);
    }
});

newLetterInput.addEventListener('input', () => {
    updateLetterSelectionUi();
});

graphicModeToggle.addEventListener('change', () => {
    updateNewLetterInputAttributes();
    newLetterInput.value = '';
    newLetterInput.focus();
});

paletteColorInput.addEventListener('change', async () => {
    const nextColor = normalizeHexColor(paletteColorInput.value);
    if (!nextColor) {
        setPaletteNotice('Use a valid 6-digit hex color before adding it.', true);
        return;
    }

    if (activePalette.includes(nextColor)) {
        setPaletteNotice(`${nextColor} is already in the predefined palette.`, true);
        return;
    }

    const previousPalette = [...activePalette];
    activePalette.push(nextColor);
    refreshPaletteUi();
    const saved = await persistPaletteChange(`${nextColor} was added to the predefined palette.`);
    if (!saved) {
        activePalette = previousPalette;
        refreshPaletteUi();
    }
});

offsetModeToggle.addEventListener('click', toggleOffsetMode);

offsetClearSelection.addEventListener('click', () => {
    offsetSelection.clear();
    updateOffsetUi();
});

offsetApplyButton.addEventListener('click', () => {
    const x = parseFloat(offsetXInput.value) || 0;
    const y = parseFloat(offsetYInput.value) || 0;
    applyOffsetToSelection(x, y);
});

offsetResetButton.addEventListener('click', resetOffsetSelection);

watchEditorAccess((access) => {
    currentAccess = access;
    renderAuthState();
});

refreshPaletteUi();
initEditor();
refreshLetterButtons();
loadFromFirestore();

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const siteContent = await loadSiteContent();
        activePalette = normalizeDotPalette(siteContent.dotPalette);
        refreshPaletteUi();
        setPaletteNotice('These colors are available across your website. Use the + button to add new ones.');
    } catch (error) {
        console.error('Error loading palette settings:', error);
        setPaletteNotice('Could not load the saved palette, so the default palette is shown for now.', true);
    }
});
