import {
    completeEmailLinkSignIn,
    sendEmailLink,
    signInWithGoogle,
    signInWithPassword,
    watchEditorAccess
} from './modules/admin-access.js';

const googleSignIn = document.getElementById('google-sign-in');
const emailStep = document.getElementById('email-step');
const emailInput = document.getElementById('email-input');
const methodStep = document.getElementById('method-step');
const methodEmailLabel = document.getElementById('method-email-label');
const changeEmailBtn = document.getElementById('change-email');
const passwordForm = document.getElementById('password-form');
const passwordInput = document.getElementById('password-input');
const sendLinkBtn = document.getElementById('send-link-btn');
const emailLinkSent = document.getElementById('email-link-sent');
const toastEl = document.getElementById('cms-toast');

let chosenEmail = '';

function getRedirectTarget() {
    const params = new URLSearchParams(window.location.search);
    return params.get('redirect') || '/admin';
}

function showToast(message, type = 'info') {
    toastEl.textContent = message;
    toastEl.className = `cms-toast visible ${type === 'error' ? 'error' : ''}`;
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => { toastEl.classList.remove('visible'); }, 4000);
}

function showMethodStep(email) {
    chosenEmail = email;
    methodEmailLabel.textContent = email;
    emailStep.classList.add('hidden');
    methodStep.classList.remove('hidden');
    emailLinkSent.classList.add('hidden');
    sendLinkBtn.classList.remove('hidden');
    passwordInput.focus();
}

function showEmailStep() {
    methodStep.classList.add('hidden');
    emailLinkSent.classList.add('hidden');
    emailStep.classList.remove('hidden');
    emailInput.focus();
}

// If already signed in, redirect immediately
watchEditorAccess((access) => {
    if (access.user) {
        window.location.replace(getRedirectTarget());
    }
});

// Step 1: enter email
emailStep.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    if (!email) return;
    showMethodStep(email);
});

// Change email
changeEmailBtn.addEventListener('click', showEmailStep);

// Option A: password sign-in
passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = passwordInput.value;
    if (!password) return;
    try {
        await signInWithPassword(chosenEmail, password);
        // watchEditorAccess will handle redirect
    } catch (error) {
        console.error('Password sign-in failed:', error);
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
            showToast('Incorrect email or password.', 'error');
        } else if (error.code === 'auth/too-many-requests') {
            showToast('Too many attempts. Try again later or use the sign-in link.', 'error');
        } else {
            showToast('Sign-in failed. Please try again.', 'error');
        }
    }
});

// Option B: email link
sendLinkBtn.addEventListener('click', async () => {
    try {
        await sendEmailLink(chosenEmail);
        sendLinkBtn.classList.add('hidden');
        emailLinkSent.classList.remove('hidden');
    } catch (error) {
        console.error('Error sending email link:', error);
        showToast('Could not send sign-in link. Please try again.', 'error');
    }
});

// Google sign-in
googleSignIn.addEventListener('click', async () => {
    try {
        await signInWithGoogle();
    } catch (error) {
        console.error('Error signing in:', error);
        showToast('Sign-in failed. Please make sure pop-ups are allowed.', 'error');
    }
});

// Complete email link sign-in if returning from email link
completeEmailLinkSignIn().catch((error) => {
    if (error.code) console.error('Email link sign-in failed:', error);
});
