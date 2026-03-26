import { auth } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

/**
 * Redirects to /login if the user is not signed in.
 * Returns a promise that resolves with the Firebase user once authenticated.
 * Import this at the top of any protected page's JS module.
 */
export function requireAuth() {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) {
                const redirect = encodeURIComponent(window.location.pathname + window.location.search);
                window.location.replace(`/login?redirect=${redirect}`);
            } else {
                unsubscribe();
                resolve(user);
            }
        });
    });
}
