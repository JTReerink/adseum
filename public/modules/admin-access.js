import { auth, db } from '../firebase-config.js';
import {
    GoogleAuthProvider,
    isSignInWithEmailLink,
    onAuthStateChanged,
    sendPasswordResetEmail,
    sendSignInLinkToEmail,
    signInWithEmailAndPassword,
    signInWithEmailLink,
    signInWithPopup,
    signOut,
    updatePassword
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

export const OWNER_EMAIL = 'jareerink@gmail.com';

const provider = new GoogleAuthProvider();
const EMAIL_LINK_STORAGE_KEY = 'emailForSignIn';

function getCanonicalAuthUrl() {
    const url = new URL(window.location.href);

    // Firebase Auth usually trusts localhost for local development,
    // while 127.0.0.1 may be treated as a separate unauthorized domain.
    if (url.hostname === '127.0.0.1') {
        url.hostname = 'localhost';
    }

    return url.toString();
}

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

/**
 * Check if an email is authorized (owner or in admins collection).
 * Returns { authorized, hasLoggedIn } or { authorized: false }.
 */
export async function checkEmailAuthorized(email) {
    email = normalizeEmail(email);
    if (isOwnerEmail(email)) {
        return { authorized: true, hasLoggedIn: true };
    }
    try {
        const accessDoc = await getDoc(doc(db, 'admins', email));
        if (accessDoc.exists()) {
            const data = accessDoc.data() || {};
            return { authorized: true, hasLoggedIn: !!data.hasLoggedIn };
        }
    } catch (error) {
        console.error('Error checking email authorization:', error);
    }
    return { authorized: false, hasLoggedIn: false };
}

/**
 * Mark that a user has logged in at least once.
 * Called after successful authentication.
 */
export async function markHasLoggedIn(email) {
    email = normalizeEmail(email);
    if (isOwnerEmail(email)) return;
    try {
        await setDoc(doc(db, 'admins', email), {
            hasLoggedIn: true,
            lastLoginAt: serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('Error marking login:', error);
    }
}

export function signInWithGoogle() {
    return signInWithPopup(auth, provider);
}

export function signInWithPassword(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
}

export async function sendEmailLink(email) {
    const actionCodeSettings = {
        url: getCanonicalAuthUrl(),
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

export function sendPasswordReset(email) {
    return sendPasswordResetEmail(auth, email);
}

export function setNewPassword(password) {
    return updatePassword(auth.currentUser, password);
}

export function signOutCurrentUser() {
    return signOut(auth);
}
