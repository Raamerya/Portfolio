import {
    auth,
    createUserWithEmailAndPassword,
    db,
    doc,
    getDoc,
    GoogleAuthProvider,
    isFirebaseConfigured,
    onAuthStateChanged,
    onSnapshot,
    setDoc,
    signInAnonymously,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile
} from "./firebase-config.js";

const ADMIN_DOC_PATH = ["admins", "admin"];

const googleProvider = auth ? new GoogleAuthProvider() : null;

if (googleProvider) {
    googleProvider.setCustomParameters({ prompt: "select_account" });
}

let anonymousPromise = null;

function normalizeEmail(email) {
    return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function getPreferredDisplayName(user) {
    if (!user) {
        return "";
    }

    return user.displayName?.trim() || "";
}

function buildViewerState(user) {
    return {
        user,
        uid: user?.uid ?? "",
        email: normalizeEmail(user?.email),
        displayName: getPreferredDisplayName(user),
        isAnonymous: Boolean(user?.isAnonymous),
        isAuthenticated: Boolean(user && !user.isAnonymous)
    };
}

export async function ensureAnonymousViewer() {
    if (!auth) {
        return null;
    }

    if (auth.currentUser) {
        return auth.currentUser;
    }

    if (!anonymousPromise) {
        anonymousPromise = signInAnonymously(auth).finally(() => {
            anonymousPromise = null;
        });
    }

    await anonymousPromise;
    return auth.currentUser;
}

export function getFriendlyAuthErrorMessage(error) {
    const code = error?.code || "";

    if (code === "auth/popup-closed-by-user") {
        return "Google sign-in was closed before it finished.";
    }

    if (code === "auth/popup-blocked") {
        return "Allow popups in your browser and try Google sign-in again.";
    }

    if (code === "auth/invalid-email") {
        return "Enter a valid email address.";
    }

    if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found" ||
        code === "auth/invalid-login-credentials"
    ) {
        return "Incorrect email or password.";
    }

    if (code === "auth/too-many-requests") {
        return "Too many sign-in attempts. Try again later.";
    }

    if (code === "auth/email-already-in-use") {
        return "This email is already registered. Use Sign in instead.";
    }

    if (code === "auth/weak-password") {
        return "Use a password with at least 6 characters.";
    }

    return error?.message || "Unable to sign in right now.";
}

export function subscribeToViewerAuth(onData, onError = () => {}) {
    if (!isFirebaseConfigured || !auth) {
        onData(buildViewerState(null));
        return () => {};
    }

    return onAuthStateChanged(
        auth,
        async (user) => {
            try {
                if (!user) {
                    await ensureAnonymousViewer();
                    return;
                }

                onData(buildViewerState(user));
            } catch (error) {
                onError(error);
            }
        },
        onError
    );
}

export function subscribeToAdminProfile(onData, onError = () => {}) {
    if (!isFirebaseConfigured || !db) {
        onData({ email: "", uid: "" });
        return () => {};
    }

    const adminRef = doc(db, ...ADMIN_DOC_PATH);

    return onSnapshot(
        adminRef,
        (snapshot) => {
            if (!snapshot.exists()) {
                onData({ email: "", uid: "" });
                return;
            }

            const data = snapshot.data() || {};
            onData({
                email: normalizeEmail(data.email),
                uid: data.uid || ""
            });
        },
        onError
    );
}

export async function syncAdminIdentity({ email, uid }) {
    if (!isFirebaseConfigured || !db || !email || !uid) {
        return false;
    }

    const adminRef = doc(db, ...ADMIN_DOC_PATH);
    const snapshot = await getDoc(adminRef);

    if (!snapshot.exists()) {
        return false;
    }

    const data = snapshot.data() || {};
    const adminEmail = normalizeEmail(data.email);

    if (!adminEmail || adminEmail !== normalizeEmail(email) || data.uid === uid) {
        return adminEmail === normalizeEmail(email);
    }

    await setDoc(adminRef, { email: adminEmail, uid }, { merge: true });
    return true;
}

export async function signInWithGoogleAccount() {
    if (!auth || !googleProvider) {
        throw new Error("Firebase authentication is not configured.");
    }

    await signInWithPopup(auth, googleProvider);
    return auth.currentUser;
}

export async function signInWithEmailAccount({ email, password }) {
    if (!auth) {
        throw new Error("Firebase authentication is not configured.");
    }

    await signInWithEmailAndPassword(auth, email.trim(), password);
    return auth.currentUser;
}

export async function createEmailAccount({ name, email, password }) {
    if (!auth) {
        throw new Error("Firebase authentication is not configured.");
    }

    await createUserWithEmailAndPassword(auth, email.trim(), password);

    if (auth.currentUser && name.trim()) {
        await updateProfile(auth.currentUser, {
            displayName: name.trim()
        });
        await auth.currentUser.reload();
    }

    return auth.currentUser;
}

export async function signOutViewer() {
    if (!auth) {
        return;
    }

    await signOut(auth);
}
