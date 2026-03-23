import { auth, db } from '../firebase-config.js';
import {
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

export const OWNER_EMAIL = 'jareerink@gmail.com';

const provider = new GoogleAuthProvider();

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

export function signOutCurrentUser() {
    return signOut(auth);
}
