import { auth, db } from '../firebase-config.js';
import {
    GoogleAuthProvider,
    isSignInWithEmailLink,
    onAuthStateChanged,
    sendSignInLinkToEmail,
    signInWithEmailAndPassword,
    signInWithEmailLink,
    signInWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

export const OWNER_EMAIL = 'jareerink@gmail.com';

const provider = new GoogleAuthProvider();
const EMAIL_LINK_STORAGE_KEY = 'emailForSignIn';

function normalizeEmail(email = '') {
    return email.trim().toLowerCase();
}

export function isOwnerEmail(email = '') {
    return normalizeEmail(email) === OWNER_EMAIL;
}

export async function resolveEditorAccess(user) {
    const email = normalizeEmail(user?.email);

    if (!user || !email || user.emailVerified !== true) {
        return {
            user,
            email,
            canEdit: false,
            isOwner: false,
            role: null
        };
    }

    if (isOwnerEmail(email)) {
        return {
            user,
            email,
            canEdit: true,
            isOwner: true,
            role: 'owner'
        };
    }

    try {
        const accessDoc = await getDoc(doc(db, 'admins', email));
        if (accessDoc.exists()) {
            const data = accessDoc.data() || {};
            return {
                user,
                email,
                canEdit: true,
                isOwner: false,
                role: data.role || 'editor'
            };
        }
    } catch (error) {
        console.error('Error checking editor access:', error);
    }

    return {
        user,
        email,
        canEdit: false,
        isOwner: false,
        role: null
    };
}

export function watchEditorAccess(callback) {
    return onAuthStateChanged(auth, async (user) => {
        callback(await resolveEditorAccess(user));
    });
}

export function signInWithGoogle() {
    return signInWithPopup(auth, provider);
}

export function signInWithPassword(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
}

export async function sendEmailLink(email) {
    const actionCodeSettings = {
        url: window.location.href,
        handleCodeInApp: true
    };
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, email);
}

export async function completeEmailLinkSignIn() {
    if (!isSignInWithEmailLink(auth, window.location.href)) return false;

    let email = window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY);
    if (!email) {
        email = window.prompt('Please enter your email address to confirm:');
    }
    if (!email) return false;

    const result = await signInWithEmailLink(auth, email, window.location.href);
    window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);

    // Clean the URL by removing sign-in query parameters
    const url = new URL(window.location.href);
    url.searchParams.delete('oobCode');
    url.searchParams.delete('mode');
    url.searchParams.delete('apiKey');
    url.searchParams.delete('lang');
    window.history.replaceState({}, '', url.toString());

    return result;
}

export function signOutCurrentUser() {
    return signOut(auth);
}
