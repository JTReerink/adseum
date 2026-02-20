
// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// TODO: Replace the following with your app's Firebase project configuration
// See: https://firebase.google.com/docs/web/setup#config-object
const firebaseConfig = {
    apiKey: "AIzaSyCXEGyh18YLoB5lfiEZuSJoNZKZQtUXLNk",
    authDomain: "adseum-53dcd.firebaseapp.com",
    projectId: "adseum-53dcd",
    storageBucket: "adseum-53dcd.firebasestorage.app",
    messagingSenderId: "212047935981",
    appId: "1:212047935981:web:6373b950b206c23c3a8fe4",
    measurementId: "G-LBY0Q8X1PP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
