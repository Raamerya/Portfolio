import {
    auth,
    commentsCollection,
    db,
    doc,
    getDoc,
    isFirebaseConfigured,
    onSnapshot,
    query,
    runTransaction,
    serverTimestamp,
    setDoc,
    where
} from "./firebase-config.js";
import { ensureAnonymousViewer } from "./auth-service.js";

const STORAGE_KEYS = {
    viewerId: "youtube-comment-viewer-id",
    displayName: "youtube-comment-display-name"
};

function generateId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    return `viewer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getOrCreateViewerId() {
    const existing = localStorage.getItem(STORAGE_KEYS.viewerId);

    if (existing) {
        return existing;
    }

    const nextId = generateId();
    localStorage.setItem(STORAGE_KEYS.viewerId, nextId);
    return nextId;
}

function setViewerId(nextViewerId) {
    viewerId = nextViewerId;
    localStorage.setItem(STORAGE_KEYS.viewerId, nextViewerId);
}

function normalizeList(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeEmail(email) {
    return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function normalizePostId(postId) {
    return typeof postId === "string" ? postId.trim() : "";
}

function normalizeComment(snapshot) {
    const data = snapshot.data({ serverTimestamps: "estimate" });

    return {
        id: data.id || snapshot.id,
        postId: normalizePostId(data.postId),
        name: data.name || "Anonymous",
        text: data.text || "",
        timestamp: data.timestamp ?? null,
        parentId: data.parentId ?? data.parent ?? null,
        threadOwnerId: data.threadOwnerId || data.ownerId || data.userId || "",
        likes: Number.isFinite(data.likes) ? data.likes : normalizeList(data.likedBy ?? data.likes).length,
        likedBy: normalizeList(data.likedBy ?? data.likes),
        dislikedBy: normalizeList(data.dislikedBy ?? data.dislikes),
        ownerId: data.ownerId || data.userId || "",
        editedAt: data.editedAt ?? (data.edited ? data.timestamp ?? data.createdAtClient ?? null : null),
        deleted: Boolean(data.deleted),
        verified: Boolean(data.verified ?? data.isAuthor),
        isAuthor: Boolean(data.isAuthor ?? data.verified),
        authorEmail: typeof data.authorEmail === "string" ? data.authorEmail.trim().toLowerCase() : "",
        authorUid: data.authorUid || "",
        createdAtClient: Number(data.createdAtClient) || 0,
        replyTo: data.replyTo ?? null
    };
}

let viewerId = getOrCreateViewerId();

async function canCurrentUserModerate(currentViewerId) {
    if (!db || !currentViewerId) {
        return false;
    }

    const adminSnapshot = await getDoc(doc(db, "admins", "admin"));

    if (!adminSnapshot.exists()) {
        return false;
    }

    const adminData = adminSnapshot.data() || {};
    const adminEmail = normalizeEmail(adminData.email);
    const currentEmail = normalizeEmail(auth?.currentUser?.email);

    return Boolean(
        (adminData.uid && adminData.uid === currentViewerId) ||
        (adminEmail && currentEmail && adminEmail === currentEmail)
    );
}

export function getViewerId() {
    return viewerId;
}

export async function initializeSession() {
    if (!isFirebaseConfigured || !auth) {
        return viewerId;
    }

    if (auth.currentUser?.uid) {
        setViewerId(auth.currentUser.uid);
        return auth.currentUser.uid;
    }

    const user = await ensureAnonymousViewer();

    if (user?.uid) {
        setViewerId(user.uid);
        return user.uid;
    }

    throw new Error("Unable to start a viewer session.");
}

export function getStoredName() {
    return localStorage.getItem(STORAGE_KEYS.displayName) ?? "";
}

export function setStoredName(name) {
    localStorage.setItem(STORAGE_KEYS.displayName, name.trim());
}

export function subscribeToComments(postId, onData, onError) {
    if (!isFirebaseConfigured || !commentsCollection) {
        const safeOnData = typeof postId === "function" ? postId : onData;
        safeOnData?.([]);
        return () => {};
    }

    const usingGenericSignature = typeof postId === "function";
    const normalizedPostId = usingGenericSignature ? "" : normalizePostId(postId);
    const resolvedOnData = usingGenericSignature ? postId : onData;
    const resolvedOnError = usingGenericSignature ? onData : onError;
    const commentsQuery = normalizedPostId
        ? query(commentsCollection, where("postId", "==", normalizedPostId))
        : query(commentsCollection);

    return onSnapshot(
        commentsQuery,
        (snapshot) => {
            resolvedOnData(snapshot.docs.map((docSnapshot) => normalizeComment(docSnapshot)));
        },
        resolvedOnError
    );
}

export async function createComment({
    postId = "",
    name,
    text,
    parentId = null,
    replyTo = null,
    isAuthor = false,
    authorEmail = "",
    authorUid = ""
}) {
    if (!isFirebaseConfigured || !commentsCollection) {
        throw new Error("Firebase is not configured.");
    }

    const nextName = name.trim();
    const nextText = text.trim();
    const nextPostId = normalizePostId(postId);
    const normalizedAuthorEmail = typeof authorEmail === "string" ? authorEmail.trim().toLowerCase() : "";

    if (!nextName || !nextText) {
        throw new Error("Name and comment text are required.");
    }

    const currentViewerId = await initializeSession();
    const ref = doc(commentsCollection);
    let threadOwnerId = currentViewerId;
    const normalizedReplyTo = replyTo && replyTo.id ? {
        id: replyTo.id,
        name: (replyTo.name || "Deleted").trim(),
        text: (replyTo.text || "").trim()
    } : null;

    if (parentId) {
        const parentSnapshot = await getDoc(doc(db, "comments", parentId));

        if (!parentSnapshot.exists()) {
            throw new Error("Reply target not found.");
        }

        const parentData = parentSnapshot.data() || {};

        const parentPostId = normalizePostId(parentData.postId);

        if (parentPostId && nextPostId && parentPostId !== nextPostId) {
            throw new Error("Replies must stay in the same post thread.");
        }

        if (!nextPostId && parentPostId) {
            postId = parentPostId;
        }

        threadOwnerId = parentData.threadOwnerId || parentData.ownerId || parentData.userId || currentViewerId;
    }

    const commentPayload = {
        id: ref.id,
        name: nextName,
        text: nextText,
        timestamp: serverTimestamp(),
        parentId,
        parent: parentId,
        threadOwnerId,
        likes: 0,
        likedBy: [],
        dislikedBy: [],
        ownerId: currentViewerId,
        userId: currentViewerId,
        editedAt: null,
        deleted: false,
        verified: Boolean(isAuthor),
        isAuthor: Boolean(isAuthor),
        authorEmail: normalizedAuthorEmail,
        authorUid: authorUid || currentViewerId,
        createdAtClient: Date.now(),
        replyTo: normalizedReplyTo
    };

    const resolvedPostId = normalizePostId(postId);

    if (resolvedPostId) {
        commentPayload.postId = resolvedPostId;
    }

    await setDoc(ref, commentPayload);

    return ref.id;
}

export async function updateCommentText({ commentId, name, text }) {
    if (!db) {
        throw new Error("Firebase is not configured.");
    }

    const nextName = name.trim();
    const nextText = text.trim();

    if (!nextName || !nextText) {
        throw new Error("Name and comment text are required.");
    }

    const currentViewerId = await initializeSession();
    const currentUserIsAdmin = await canCurrentUserModerate(currentViewerId);
    const ref = doc(db, "comments", commentId);

    await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref);

        if (!snapshot.exists()) {
            throw new Error("Comment not found.");
        }

        const data = snapshot.data();

        const ownerId = data.ownerId || data.userId;

        if (ownerId !== currentViewerId && !currentUserIsAdmin) {
            throw new Error("Only the comment owner can edit this comment.");
        }

        if (data.deleted) {
            throw new Error("Deleted comments cannot be edited.");
        }

        transaction.update(ref, {
            name: nextName,
            text: nextText,
            editedAt: serverTimestamp()
        });
    });
}

export async function deleteCommentRecord({ commentId, hasReplies, cleanupIds = [], forceDeleteRecord = false }) {
    if (!db) {
        throw new Error("Firebase is not configured.");
    }

    const currentViewerId = await initializeSession();
    const currentUserIsAdmin = await canCurrentUserModerate(currentViewerId);
    const ref = doc(db, "comments", commentId);
    const extraDeletes = [...new Set(cleanupIds.filter((id) => id && id !== commentId))];

    await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref);

        if (!snapshot.exists()) {
            throw new Error("Comment not found.");
        }

        const data = snapshot.data();

        const ownerId = data.ownerId || data.userId;

        if (ownerId !== currentViewerId && !currentUserIsAdmin) {
            throw new Error("Only the comment owner can delete this comment.");
        }

        if (hasReplies && !forceDeleteRecord) {
            transaction.update(ref, {
                deleted: true,
                text: "",
                likes: 0,
                likedBy: [],
                dislikedBy: [],
                editedAt: serverTimestamp()
            });
            return;
        }

        transaction.delete(ref);

        extraDeletes.forEach((id) => {
            transaction.delete(doc(db, "comments", id));
        });
    });
}

export async function deleteCommentThread({ commentId, descendantIds = [], cleanupIds = [] }) {
    if (!db) {
        throw new Error("Firebase is not configured.");
    }

    const currentViewerId = await initializeSession();
    const currentUserIsAdmin = await canCurrentUserModerate(currentViewerId);
    const rootRef = doc(db, "comments", commentId);
    const uniqueIds = [
        ...new Set([...descendantIds, ...cleanupIds].filter((id) => id && id !== commentId))
    ];

    await runTransaction(db, async (transaction) => {
        const rootSnapshot = await transaction.get(rootRef);

        if (!rootSnapshot.exists()) {
            throw new Error("Comment not found.");
        }

        const data = rootSnapshot.data();
        const ownerId = data.ownerId || data.userId;

        if (ownerId !== currentViewerId && !currentUserIsAdmin) {
            throw new Error("Only the comment owner can delete this comment thread.");
        }

        transaction.delete(rootRef);

        uniqueIds.forEach((id) => {
            transaction.delete(doc(db, "comments", id));
        });
    });
}

export async function toggleReaction(commentId, reaction) {
    if (!db) {
        throw new Error("Firebase is not configured.");
    }

    const currentViewerId = await initializeSession();
    const ref = doc(db, "comments", commentId);

    await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref);

        if (!snapshot.exists()) {
            throw new Error("Comment not found.");
        }

        const data = snapshot.data();

        if (data.deleted) {
            return;
        }

        let likedBy = normalizeList(data.likedBy ?? data.likes);
        let dislikedBy = normalizeList(data.dislikedBy ?? data.dislikes);

        const liked = likedBy.includes(currentViewerId);
        const disliked = dislikedBy.includes(currentViewerId);

        if (reaction === "like") {
            likedBy = liked ? likedBy.filter((id) => id !== currentViewerId) : [...likedBy, currentViewerId];

            if (disliked) {
                dislikedBy = dislikedBy.filter((id) => id !== currentViewerId);
            }
        }

        if (reaction === "dislike") {
            dislikedBy = disliked ? dislikedBy.filter((id) => id !== currentViewerId) : [...dislikedBy, currentViewerId];

            if (liked) {
                likedBy = likedBy.filter((id) => id !== currentViewerId);
            }
        }

        transaction.update(ref, {
            likes: likedBy.length,
            likedBy,
            dislikedBy
        });
    });
}
