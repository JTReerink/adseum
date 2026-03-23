import { db } from './firebase-config.js';
import { palette } from './modules/config.js';
import { renderLetter } from './modules/renderer.js';
import {
    signInWithGoogle,
    signOutCurrentUser,
    watchEditorAccess
} from './modules/admin-access.js';
import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    setDoc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

window.letters = window.letters || {};
window.letterColors = window.letterColors || {};

let rows = 11;
let cols = 7;
let currentGrid = Array.from({ length: rows }, () => Array(cols).fill(0));
let currentColorGrid = Array.from({ length: rows }, () => Array(cols).fill(null));
let selectedColor = null;
let currentAccess = {
    user: null,
    email: '',
    canEdit: false,
    isOwner: false,
    role: null
};

const editorGrid = document.getElementById('editor-grid');
const letterNameInput = document.getElementById('letter-name');
const previewContainer = document.getElementById('preview-container');
const letterButtons = document.getElementById('letter-buttons');
const rowsInput = document.getElementById('grid-rows');
const colsInput = document.getElementById('grid-cols');
const authStatus = document.getElementById('auth-status');
const signInButton = document.getElementById('sign-in-button');
const signOutButton = document.getElementById('sign-out-button');
const saveButton = document.getElementById('save-button');
const deleteButton = document.getElementById('delete-button');
const downloadButton = document.getElementById('download-button');
const selectedColorLabel = document.getElementById('selected-color-label');
const colorPalette = document.getElementById('color-palette');

const paletteEntries = palette.map((color) => ({ color, label: color }));

function cloneGrid(grid) {
    return JSON.parse(JSON.stringify(grid));
}

function cloneColorGrid(grid) {
    return JSON.parse(JSON.stringify(grid));
}

function rebuildLettersFromSnapshot(querySnapshot) {
    window.letters = {};
    window.letterColors = {};

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
    });
}

function getSelectedColorLabel(color) {
    if (!color) {
        return 'None (black)';
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
    eraser.className = 'eraser-swatch selected';
    eraser.textContent = 'x';
    eraser.title = 'No colour (black dot)';
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
        swatch.addEventListener('click', () => {
            selectedColor = color;
            updateSelectedColorDisplay();
            updateSwatchSelection(swatch);
        });
        colorPalette.appendChild(swatch);
    });

    updateSelectedColorDisplay();
}

function setEditorEnabled(enabled) {
    [rowsInput, colsInput, letterNameInput, saveButton, deleteButton, downloadButton].forEach((element) => {
        element.disabled = !enabled;
    });

    colorPalette.querySelectorAll('.color-swatch, .eraser-swatch').forEach((swatch) => {
        swatch.style.pointerEvents = enabled ? 'auto' : 'none';
        swatch.style.opacity = enabled ? '1' : '0.55';
    });

    editorGrid.querySelectorAll('.cell').forEach((cell) => {
        cell.style.pointerEvents = enabled ? 'auto' : 'none';
        cell.style.opacity = enabled ? '1' : '0.55';
    });
}

function renderAuthState() {
    if (!currentAccess.user) {
        authStatus.textContent = 'Sign in with an approved Google account to edit letters.';
        signInButton.classList.remove('hidden');
        signOutButton.classList.add('hidden');
        setEditorEnabled(false);
        return;
    }

    signInButton.classList.add('hidden');
    signOutButton.classList.remove('hidden');

    if (currentAccess.canEdit) {
        authStatus.textContent = `Signed in as ${currentAccess.email}. You can edit and publish letters.`;
        setEditorEnabled(true);
    } else {
        authStatus.textContent = `Signed in as ${currentAccess.email}, but this account is not approved to edit.`;
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

function updatePreview() {
    previewContainer.innerHTML = '';
    const rendered = renderLetter('custom', currentGrid, { colorMap: buildColorMapFromGrid() });
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
    const isOn = currentGrid[rowIndex][colIndex] === 1;
    const cellColor = getCellColor(rowIndex, colIndex);

    if (!isOn) {
        currentGrid[rowIndex][colIndex] = 1;
        currentColorGrid[rowIndex][colIndex] = selectedColor;
    } else if (cellColor === selectedColor) {
        currentGrid[rowIndex][colIndex] = 0;
        currentColorGrid[rowIndex][colIndex] = null;
    } else {
        currentColorGrid[rowIndex][colIndex] = selectedColor;
    }

    const nextColor = currentGrid[rowIndex][colIndex] ? (currentColorGrid[rowIndex][colIndex] || '#000000') : '';
    cell.style.backgroundColor = nextColor;
    cell.classList.toggle('active', currentGrid[rowIndex][colIndex] === 1);
    updatePreview();
}

function initEditor(preserveData = false) {
    rowsInput.value = rows;
    colsInput.value = cols;
    editorGrid.innerHTML = '';
    editorGrid.style.gridTemplateColumns = `repeat(${cols}, 30px)`;

    if (!preserveData) {
        currentGrid = Array.from({ length: rows }, () => Array(cols).fill(0));
        currentColorGrid = Array.from({ length: rows }, () => Array(cols).fill(null));
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

    rows = data.length;
    cols = data[0].length;
    currentGrid = cloneGrid(data);
    currentColorGrid = Array.from({ length: rows }, (_, rowIndex) =>
        Array.from({ length: cols }, (_, colIndex) => storedColorMap[`${rowIndex},${colIndex}`] || null)
    );

    letterNameInput.value = char;
    initEditor(true);
}

function refreshLetterButtons() {
    letterButtons.innerHTML = '';

    Object.keys(window.letters || {}).sort().forEach((char) => {
        const button = document.createElement('button');
        button.className = 'rounded-full border border-slate-200 px-3 py-1 text-sm transition hover:bg-slate-100';
        button.innerText = char;
        button.addEventListener('click', () => loadLetter(char));
        letterButtons.appendChild(button);
    });
}

async function loadFromFirestore() {
    try {
        const querySnapshot = await getDocs(collection(db, 'letters'));
        rebuildLettersFromSnapshot(querySnapshot);
        refreshLetterButtons();
    } catch (error) {
        console.error('Error loading letters from Firestore:', error);
    }
}

window.updateGridSize = function updateGridSize() {
    if (!currentAccess.canEdit) return;

    const newRows = parseInt(rowsInput.value, 10) || 11;
    const newCols = parseInt(colsInput.value, 10) || 7;
    const newGrid = Array.from({ length: newRows }, () => Array(newCols).fill(0));
    const newColorGrid = Array.from({ length: newRows }, () => Array(newCols).fill(null));

    for (let rowIndex = 0; rowIndex < Math.min(rows, newRows); rowIndex += 1) {
        for (let colIndex = 0; colIndex < Math.min(cols, newCols); colIndex += 1) {
            newGrid[rowIndex][colIndex] = currentGrid[rowIndex][colIndex];
            newColorGrid[rowIndex][colIndex] = currentColorGrid[rowIndex][colIndex];
        }
    }

    rows = newRows;
    cols = newCols;
    currentGrid = newGrid;
    currentColorGrid = newColorGrid;
    initEditor(true);
};

window.downloadLettersJS = function downloadLettersJS() {
    if (!currentAccess.canEdit) {
        window.alert('Sign in with an approved editor account before downloading the latest letter set.');
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

    const name = letterNameInput.value.trim();
    if (!name) {
        window.alert('Please enter a letter name.');
        return;
    }

    const originalText = saveButton.textContent;
    saveButton.textContent = 'Saving...';
    saveButton.disabled = true;

    try {
        const gridData = {};
        const colorData = {};

        currentGrid.forEach((rowData, index) => {
            gridData[`row${index}`] = rowData;
        });

        currentColorGrid.forEach((rowData, index) => {
            colorData[`row${index}`] = rowData;
        });

        await setDoc(doc(db, 'letters', name), {
            rows,
            cols,
            gridData,
            colorData
        });

        window.letters[name] = cloneGrid(currentGrid);
        window.letterColors[name] = buildColorMapFromGrid();
        refreshLetterButtons();
        window.alert(`Letter "${name}" saved.`);
    } catch (error) {
        console.error('Error saving letter:', error);
        window.alert('Error saving letter. Check the console for details.');
    } finally {
        saveButton.textContent = originalText;
        saveButton.disabled = !currentAccess.canEdit;
    }
};

window.deleteLetter = async function deleteLetter() {
    if (!currentAccess.canEdit) {
        window.alert('Sign in with an approved editor account before deleting.');
        return;
    }

    const name = letterNameInput.value.trim();
    if (!name) {
        window.alert('Please load or name a letter to delete.');
        return;
    }

    const confirmed = window.confirm(`Are you sure you want to delete the letter "${name}"? This cannot be undone.`);
    if (!confirmed) {
        return;
    }

    try {
        await deleteDoc(doc(db, 'letters', name));
        delete window.letters[name];
        delete window.letterColors[name];
        refreshLetterButtons();
        letterNameInput.value = '';
        window.alert(`Letter "${name}" deleted.`);
    } catch (error) {
        console.error('Error deleting letter:', error);
        window.alert('Error deleting letter. Check the console for details.');
    }
};

signInButton.addEventListener('click', async () => {
    try {
        await signInWithGoogle();
    } catch (error) {
        console.error('Error signing in:', error);
        window.alert('Google sign-in failed. Make sure Google sign-in is enabled in Firebase Authentication.');
    }
});

signOutButton.addEventListener('click', async () => {
    try {
        await signOutCurrentUser();
    } catch (error) {
        console.error('Error signing out:', error);
    }
});

watchEditorAccess((access) => {
    currentAccess = access;
    renderAuthState();
});

initColorPalette();
initEditor();
refreshLetterButtons();
loadFromFirestore();
