import { db } from '../firebase-config.js';
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

export function listenToLetters(callback) {
    return onSnapshot(collection(db, "letters"), (querySnapshot) => {
        let hasUpdates = false;
        window.letters = window.letters || {};
        window.letterColors = window.letterColors || {};
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.gridData) {
                const reconstructedGrid = [];
                for (let i = 0; i < data.rows; i++) {
                    reconstructedGrid.push(data.gridData[`row${i}`]);
                }
                window.letters[doc.id] = reconstructedGrid;
            } else if (data.grid) {
                // Legacy support
                window.letters[doc.id] = data.grid;
            }
            if (data.colorData) {
                const colorMap = {};
                for (let i = 0; i < data.rows; i++) {
                    const row = data.colorData[`row${i}`] || [];
                    row.forEach((color, c) => {
                        if (color) colorMap[`${i},${c}`] = color;
                    });
                }
                window.letterColors[doc.id] = colorMap;
            }
            hasUpdates = true;
        });

        if (hasUpdates && callback) {
            callback();
        }
    }, (error) => {
        console.error("Error loading letters (likely offline/CORS):", error);
    });
}
