import { db } from '../firebase-config.js';
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

export function listenToLetters(callback) {
    return onSnapshot(collection(db, "letters"), (querySnapshot) => {
        let hasUpdates = false;
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
            hasUpdates = true;
        });

        if (hasUpdates && callback) {
            callback();
        }
    }, (error) => {
        console.error("Error loading letters (likely offline/CORS):", error);
    });
}
