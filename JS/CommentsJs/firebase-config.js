import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
    collection,
    doc,
    getDoc,
    getFirestore,
    onSnapshot,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    setDoc,
    where
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import {
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    getAuth,
    onAuthStateChanged,
    signInAnonymously,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAV3OMQcDxbsV1l_BLjp1hAoc7fL47aDA0",
    authDomain: "ransh-blog-comments.firebaseapp.com",
    projectId: "ransh-blog-comments",
    storageBucket: "ransh-blog-comments.firebasestorage.app",
    messagingSenderId: "129247006599",
    appId: "1:129247006599:web:80e685529b931cb9864d22",
    measurementId: "G-KB1TNTTPLT"
};

const isPlaceholderValue = (value) => String(value).includes("YOUR_");
const isFirebaseConfigured = Object.values(firebaseConfig).every((value) => !isPlaceholderValue(value));

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
const db = app ? getFirestore(app) : null;
const auth = app ? getAuth(app) : null;
const commentsCollection = db ? collection(db, "comments") : null;

export {
    auth,
    commentsCollection,
    createUserWithEmailAndPassword,
    db,
    doc,
    firebaseConfig,
    getDoc,
    GoogleAuthProvider,
    isFirebaseConfigured,
    onAuthStateChanged,
    onSnapshot,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    setDoc,
    where,
    signInAnonymously,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile
};
