import {
    checkEmailAuthorized,
    completeEmailLinkSignIn,
    markHasLoggedIn,
    sendEmailLink,
    sendPasswordReset,
    setNewPassword,
    signInWithGoogle,
    signInWithPassword,
    watchEditorAccess
} from './modules/admin-access.js';

/* ── DOM refs ── */
const googleSignIn = document.getElementById('google-sign-in');
const emailStep = document.getElementById('email-step');
const emailInput = document.getElementById('email-input');
const notAuthorized = document.getElementById('not-authorized');
const backFromDenied = document.getElementById('back-from-denied');
const firstTimeStep = document.getElementById('first-time-step');
const firstTimeEmailLabel = document.getElementById('first-time-email-label');
const changeEmailFirst = document.getElementById('change-email-first');
const sendLinkFirst = document.getElementById('send-link-first');
const methodStep = document.getElementById('method-step');
const methodEmailLabel = document.getElementById('method-email-label');
const changeEmailBtn = document.getElementById('change-email');
const passwordForm = document.getElementById('password-form');
const passwordInput = document.getElementById('password-input');
const forgotPasswordBtn = document.getElementById('forgot-password-btn');
const sendLinkBtn = document.getElementById('send-link-btn');
const setPasswordStep = document.getElementById('set-password-step');
const setPasswordForm = document.getElementById('set-password-form');
const newPasswordInput = document.getElementById('new-password-input');
const confirmPasswordInput = document.getElementById('confirm-password-input');
const skipPasswordBtn = document.getElementById('skip-password');
const emailLinkSent = document.getElementById('email-link-sent');
const resetLinkSent = document.getElementById('reset-link-sent');
const toastEl = document.getElementById('cms-toast');

let chosenEmail = '';
let waitingForSetPassword = false;

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

function hideAllSteps() {
    emailStep.classList.add('hidden');
    notAuthorized.classList.add('hidden');
    firstTimeStep.classList.add('hidden');
    methodStep.classList.add('hidden');
    setPasswordStep.classList.add('hidden');
    emailLinkSent.classList.add('hidden');
    resetLinkSent.classList.add('hidden');
}

function showEmailStep() {
    hideAllSteps();
    emailStep.classList.remove('hidden');
    emailInput.focus();
}

function redirect() {
    window.location.replace(getRedirectTarget());
}

/* ── Auth state listener ── */
watchEditorAccess(async (access) => {
    if (!access.user) return;

    await markHasLoggedIn(access.email);

    // If we just completed email link sign-in, offer to set password
    if (waitingForSetPassword) {
        waitingForSetPassword = false;
        hideAllSteps();
        setPasswordStep.classList.remove('hidden');
        newPasswordInput.focus();
        return;
    }

    redirect();
});

/* ── Step 1: enter email ── */
emailStep.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    if (!email) return;
    chosenEmail = email;

    const { authorized, hasLoggedIn } = await checkEmailAuthorized(email);

    hideAllSteps();

    if (!authorized) {
        notAuthorized.classList.remove('hidden');
        return;
    }

    if (!hasLoggedIn) {
        firstTimeEmailLabel.textContent = email;
        firstTimeStep.classList.remove('hidden');
        return;
    }

    methodEmailLabel.textContent = email;
    methodStep.classList.remove('hidden');
    passwordInput.focus();
});

/* ── Not authorized: back ── */
backFromDenied.addEventListener('click', showEmailStep);

/* ── First time: change email ── */
changeEmailFirst.addEventListener('click', showEmailStep);

/* ── First time: send link ── */
sendLinkFirst.addEventListener('click', async () => {
    try {
        waitingForSetPassword = true;
        await sendEmailLink(chosenEmail);
        hideAllSteps();
        emailLinkSent.classList.remove('hidden');
    } catch (error) {
        console.error('Error sending email link:', error);
        waitingForSetPassword = false;
        showToast('Could not send sign-in link. Please try again.', 'error');
    }
});

/* ── Returning: change email ── */
changeEmailBtn.addEventListener('click', showEmailStep);

/* ── Returning: password sign-in ── */
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
            showToast('Incorrect email or password. If you haven\'t set a password yet, use the sign-in link instead.', 'error');
        } else if (error.code === 'auth/too-many-requests') {
            showToast('Too many attempts. Try again later or use the sign-in link.', 'error');
        } else {
            showToast('Sign-in failed. Please try again.', 'error');
        }
    }
});

/* ── Returning: forgot password ── */
forgotPasswordBtn.addEventListener('click', async () => {
    try {
        await sendPasswordReset(chosenEmail);
        hideAllSteps();
        resetLinkSent.classList.remove('hidden');
    } catch (error) {
        console.error('Error sending reset email:', error);
        if (error.code === 'auth/user-not-found') {
            showToast('No account found for this email. Use the sign-in link to create one.', 'error');
        } else {
            showToast('Could not send reset email. Please try again.', 'error');
        }
    }
});

/* ── Returning: send link ── */
sendLinkBtn.addEventListener('click', async () => {
    try {
        await sendEmailLink(chosenEmail);
        hideAllSteps();
        emailLinkSent.classList.remove('hidden');
    } catch (error) {
        console.error('Error sending email link:', error);
        showToast('Could not send sign-in link. Please try again.', 'error');
    }
});

/* ── Set password ── */
setPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = newPasswordInput.value;
    const confirm = confirmPasswordInput.value;
    if (pw !== confirm) {
        showToast('Passwords do not match.', 'error');
        return;
    }
    if (pw.length < 6) {
        showToast('Password must be at least 6 characters.', 'error');
        return;
    }
    try {
        await setNewPassword(pw);
        showToast('Password set successfully!');
        setTimeout(redirect, 1000);
    } catch (error) {
        console.error('Error setting password:', error);
        showToast('Could not set password. Please try again later.', 'error');
        setTimeout(redirect, 2000);
    }
});

skipPasswordBtn.addEventListener('click', redirect);

/* ── Google sign-in ── */
googleSignIn.addEventListener('click', async () => {
    try {
        await signInWithGoogle();
    } catch (error) {
        console.error('Error signing in:', error);
        showToast('Sign-in failed. Please make sure pop-ups are allowed.', 'error');
    }
});

/* ── Complete email link sign-in if returning from link ── */
completeEmailLinkSignIn().then((result) => {
    if (result) {
        // Email link sign-in completed; watchEditorAccess handles the rest
        // Set flag so we offer to set a password
        waitingForSetPassword = true;
    }
}).catch((error) => {
    if (error.code) console.error('Email link sign-in failed:', error);
});
