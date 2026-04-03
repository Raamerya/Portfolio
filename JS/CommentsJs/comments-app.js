import {
    createComment,
    deleteCommentRecord,
    deleteCommentThread,
    getStoredName,
    getViewerId,
    initializeSession,
    setStoredName,
    subscribeToComments,
    toggleReaction,
    updateCommentText
} from "./comment-service.js";
import {
    createEmailAccount,
    getFriendlyAuthErrorMessage,
    signInWithEmailAccount,
    signInWithGoogleAccount,
    signOutViewer,
    subscribeToAdminProfile,
    subscribeToViewerAuth,
    syncAdminIdentity
} from "./auth-service.js";
import { isFirebaseConfigured } from "./firebase-config.js";
import { getAvatarProps, refreshRelativeTimestamps, renderComments } from "./render-comments.js";

const AUTHOR_NAME = "Ransh";
const AUTHOR_MIGRATION_KEY = "youtube-comment-author-name-migration";
const INITIAL_VISIBLE_THREADS = 3;
const LOAD_MORE_STEP = 5;

function getCurrentPostId() {
    const shellPostId = document.querySelector(".comments-shell")?.dataset.postId?.trim();

    if (shellPostId) {
        return shellPostId;
    }

    const pagePath = window.location.pathname
        .replace(/\\/g, "/")
        .toLowerCase()
        .split("/")
        .filter(Boolean)
        .join("-");

    return pagePath ? `page-${pagePath}` : "page-home";
}

const elements = {
    commentCount: document.getElementById("commentCount"),
    commentForm: document.getElementById("commentForm"),
    commentsContainer: document.getElementById("commentsContainer"),
    commenterName: document.getElementById("commenterName"),
    commentText: document.getElementById("commentText"),
    currentUserAvatar: document.getElementById("currentUserAvatar"),
    firebaseNotice: document.getElementById("firebaseNotice"),
    sortLabel: document.getElementById("sortLabel"),
    sortMenu: document.getElementById("sortMenu"),
    sortToggle: document.getElementById("sortToggle"),
    postCommentButton: document.getElementById("postCommentButton"),
    mainComposerActions: document.getElementById("mainComposerActions"),
    cancelMainComment: document.getElementById("cancelMainComment"),
    mainEmojiButton: document.getElementById("mainEmojiButton"),
    deleteModal: document.getElementById("deleteModal"),
    closeDeleteModal: document.getElementById("closeDeleteModal"),
    deleteModalDescription: document.getElementById("deleteModalDescription"),
    deleteOnlyOption: document.getElementById("deleteOnlyOption"),
    deleteThreadOption: document.getElementById("deleteThreadOption"),
    cancelDeleteAction: document.getElementById("cancelDeleteAction"),
    emojiPopover: document.getElementById("emojiPopover"),
    emojiPicker: document.getElementById("emojiPicker"),
    closeEmojiPopover: document.getElementById("closeEmojiPopover"),
    authStatusName: document.getElementById("authStatusName"),
    authStatusBadge: document.getElementById("authStatusBadge"),
    authStatusText: document.getElementById("authStatusText"),
    authActionButton: document.getElementById("authActionButton"),
    authModal: document.getElementById("authModal"),
    closeAuthModal: document.getElementById("closeAuthModal"),
    cancelAuthAction: document.getElementById("cancelAuthAction"),
    googleSignInButton: document.getElementById("googleSignInButton"),
    authDivider: document.getElementById("authDivider"),
    emailAuthForm: document.getElementById("emailAuthForm"),
    authNameField: document.getElementById("authNameField"),
    authName: document.getElementById("authName"),
    authEmail: document.getElementById("authEmail"),
    authPassword: document.getElementById("authPassword"),
    authHelper: document.getElementById("authHelper"),
    authMessage: document.getElementById("authMessage"),
    emailSignInButton: document.getElementById("emailSignInButton"),
    createAccountButton: document.getElementById("createAccountButton")
};

const state = {
    postId: getCurrentPostId(),
    viewerId: getViewerId(),
    comments: [],
    currentName: getStoredName(),
    auth: {
        user: null,
        uid: "",
        email: "",
        displayName: "",
        isAnonymous: true,
        isAuthenticated: false
    },
    adminProfile: {
        email: "",
        uid: ""
    },
    isAdmin: false,
    authMessage: "",
    isAuthPending: false,
    authMode: "signin",
    sortMode: "top",
    visibleRootCount: INITIAL_VISIBLE_THREADS,
    expandedReplies: new Set(),
    activeReplyId: null,
    replyDrafts: new Map(),
    activeEditId: null,
    editDraft: { name: "", text: "" },
    openMenuId: null,
    activeEmojiTarget: null,
    deleteDialog: {
        isOpen: false,
        commentId: null,
        hasReplies: false
    },
    isLoading: true,
    error: ""
};

if (state.currentName === AUTHOR_NAME && !localStorage.getItem(AUTHOR_MIGRATION_KEY)) {
    state.currentName = "";
    setStoredName("");
    localStorage.setItem(AUTHOR_MIGRATION_KEY, "done");
}

elements.commenterName.value = state.currentName;
elements.firebaseNotice.hidden = isFirebaseConfigured;

let adminSyncPromise = null;

function autoResize(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
}

function updateAvatarElement(target, name) {
    if (!target) {
        return;
    }

    const avatar = getAvatarProps(name);
    target.textContent = avatar.initial;
    target.style.background = avatar.background;
}

function updateMainComposerState() {
    const hasName = elements.commenterName.value.trim().length > 0;
    const hasText = elements.commentText.value.trim().length > 0;

    updateAvatarElement(elements.currentUserAvatar, elements.commenterName.value);
    elements.postCommentButton.disabled = !(hasName && hasText && isFirebaseConfigured);
}

function getNormalizedCommentName(name) {
    return state.isAdmin ? AUTHOR_NAME : name.trim();
}

function isAuthorCommentRecord(comment) {
    if (!comment) {
        return false;
    }

    return Boolean(
        comment.verified ||
        comment.isAuthor ||
        (state.adminProfile.uid && (comment.ownerId === state.adminProfile.uid || comment.authorUid === state.adminProfile.uid)) ||
        (state.adminProfile.email && comment.authorEmail === state.adminProfile.email)
    );
}

function shouldLockAuthorName(comment) {
    return state.isAdmin && isAuthorCommentRecord(comment);
}

function getNormalizedEditName(commentId, name) {
    const comment = getCommentById(commentId);
    return shouldLockAuthorName(comment) ? AUTHOR_NAME : name.trim();
}

function persistViewerName(name) {
    if (state.isAdmin) {
        return;
    }

    setStoredName(name);
}

function clearLocalViewerName({ clearReplyDrafts = false } = {}) {
    setStoredName("");
    state.currentName = "";
    elements.commenterName.readOnly = false;
    elements.commenterName.value = "";

    if (clearReplyDrafts) {
        state.replyDrafts = new Map(
            [...state.replyDrafts.entries()].map(([commentId, draft]) => [
                commentId,
                { ...draft, name: "" }
            ])
        );
    }

    updateMainComposerState();
}

function getStoredViewerName() {
    const storedName = getStoredName().trim();

    if (!state.isAdmin && storedName === AUTHOR_NAME && !localStorage.getItem(AUTHOR_MIGRATION_KEY)) {
        setStoredName("");
        localStorage.setItem(AUTHOR_MIGRATION_KEY, "done");
        return "";
    }

    return storedName;
}

function normalizeEmail(email) {
    return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function syncAdminFlag() {
    state.isAdmin = Boolean(
        state.auth.email &&
        state.adminProfile.email &&
        normalizeEmail(state.auth.email) === normalizeEmail(state.adminProfile.email)
    );
}

function syncAuthMessage() {
    elements.authMessage.textContent = state.authMessage;
    elements.authMessage.hidden = !state.authMessage;
}

function syncAuthModeUI() {
    const createMode = state.authMode === "create";

    elements.authNameField.hidden = !createMode;
    elements.authNameField.style.display = createMode ? "" : "none";
    elements.authName.disabled = !createMode;
    elements.authName.required = createMode;
    elements.authName.autocomplete = "name";

    if (!createMode) {
        elements.authName.value = "";
    }

    elements.authEmail.autocomplete = createMode ? "email" : "username";
    elements.authPassword.autocomplete = createMode ? "new-password" : "current-password";
    elements.authDivider.querySelector("span").textContent = createMode
        ? "create account with email"
        : "or sign in with email";
    elements.authHelper.textContent = createMode
        ? "Create account once with your name, email, and password. That name will be used for comments."
        : "Google works with any existing Google account. For email/password, sign in with your existing account.";
    elements.createAccountButton.textContent = createMode ? "Create now" : "Create account";
}

function syncAuthControls() {
    elements.googleSignInButton.disabled = state.isAuthPending;
    elements.emailSignInButton.disabled = state.isAuthPending;
    elements.createAccountButton.disabled = state.isAuthPending;
    elements.authActionButton.disabled = !isFirebaseConfigured || state.isAuthPending;
    elements.authActionButton.textContent = state.isAuthPending
        ? "Working..."
        : state.auth.isAuthenticated
            ? "Sign out"
            : "Sign in";
}

function setAuthMode(mode) {
    state.authMode = mode;
    syncAuthModeUI();
}

function updateAuthUI() {
    const signedInName = state.auth.isAuthenticated
        ? (state.isAdmin ? AUTHOR_NAME : state.auth.displayName || state.currentName || "User")
        : "Guest";

    syncAuthModeUI();
    elements.authStatusName.textContent = signedInName;
    elements.authStatusBadge.hidden = !state.isAdmin;
    elements.authStatusText.textContent = state.auth.isAuthenticated
        ? (state.isAdmin ? `${state.auth.email} - author account` : state.auth.email)
        : "Signed in anonymously";

    syncAuthMessage();
    syncAuthControls();
}

function openAuthModal() {
    state.authMessage = "";
    setAuthMode("signin");
    elements.authName.value = "";
    elements.authEmail.value = state.auth.email || "";
    elements.authPassword.value = "";
    syncAuthMessage();
    elements.authModal.hidden = false;
}

function closeAuthModal() {
    state.authMessage = "";
    setAuthMode("signin");
    elements.authName.value = "";
    elements.authPassword.value = "";
    elements.authModal.hidden = true;
    syncAuthMessage();
}

function getCommentAuthorData() {
    return {
        isAuthor: state.isAdmin,
        authorEmail: state.isAdmin ? state.auth.email : "",
        authorUid: state.isAdmin ? state.auth.uid : ""
    };
}

function syncNameFromAuth() {
    const nextName = state.isAdmin
        ? AUTHOR_NAME
        : state.auth.displayName || getStoredViewerName();
    const shouldLockName = state.auth.isAuthenticated && Boolean(nextName.trim());

    elements.commenterName.readOnly = shouldLockName;

    elements.commenterName.value = nextName;
    state.currentName = nextName;

    if (nextName && !state.isAdmin) {
        setStoredName(nextName);
    }

    if (!nextName && !state.isAdmin) {
        setStoredName("");
    }
}

function maybeSyncAdminIdentity() {
    if (
        adminSyncPromise ||
        !state.isAdmin ||
        !state.auth.uid ||
        !state.adminProfile.email ||
        state.adminProfile.uid === state.auth.uid
    ) {
        return;
    }

    adminSyncPromise = syncAdminIdentity({
        email: state.auth.email,
        uid: state.auth.uid
    }).catch(() => {
        // The badge still works for new comments via comment metadata even if this sync fails.
    }).finally(() => {
        adminSyncPromise = null;
    });
}

function showMainComposerActions() {
    elements.mainComposerActions.hidden = false;
}

function countVisibleComments(comments) {
    return comments.length;
}

function countRootThreads(comments) {
    const ids = new Set(comments.map((comment) => comment.id));
    return comments.filter((comment) => !comment.parentId || !ids.has(comment.parentId)).length;
}

function getSortLabel(mode) {
    return mode === "newest" ? "Newest first" : "Top comments";
}

function updateSortMenuState() {
    elements.sortLabel.textContent = getSortLabel(state.sortMode);
    elements.sortMenu.querySelectorAll("[data-sort]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.sort === state.sortMode);
    });
}

function captureFocusState() {
    const active = document.activeElement;

    if (!active) {
        return null;
    }

    const selection = {
        start: typeof active.selectionStart === "number" ? active.selectionStart : null,
        end: typeof active.selectionEnd === "number" ? active.selectionEnd : null
    };

    if (active === elements.commentText) {
        return { type: "main", ...selection };
    }

    if (active.matches("[data-reply-name]")) {
        return { type: "reply-name", commentId: active.dataset.replyName, ...selection };
    }

    if (active.matches("[data-reply-input]")) {
        return { type: "reply-text", commentId: active.dataset.replyInput, ...selection };
    }

    if (active.matches("[data-edit-name]")) {
        return { type: "edit-name", commentId: active.dataset.editName, ...selection };
    }

    if (active.matches("[data-edit-input]")) {
        return { type: "edit-text", commentId: active.dataset.editInput, ...selection };
    }

    return null;
}

function restoreFocusState(focusState) {
    if (!focusState) {
        return;
    }

    let target = null;

    if (focusState.type === "main") {
        target = elements.commentText;
    }

    if (focusState.type === "reply-name") {
        target = document.querySelector(`[data-reply-name="${focusState.commentId}"]`);
    }

    if (focusState.type === "reply-text") {
        target = document.querySelector(`[data-reply-input="${focusState.commentId}"]`);
    }

    if (focusState.type === "edit-name") {
        target = document.querySelector(`[data-edit-name="${focusState.commentId}"]`);
    }

    if (focusState.type === "edit-text") {
        target = document.querySelector(`[data-edit-input="${focusState.commentId}"]`);
    }

    if (!target) {
        return;
    }

    target.focus({ preventScroll: true });

    if (focusState.start !== null && typeof target.setSelectionRange === "function") {
        target.setSelectionRange(focusState.start, focusState.end ?? focusState.start);
    }
}

function syncInlineComposer(container) {
    if (!container) {
        return;
    }

    const nameField = container.querySelector("[data-reply-name], [data-edit-name]");
    const textField = container.querySelector("[data-reply-input], [data-edit-input]");
    const submitButton = container.querySelector("[data-action='submit-reply'], [data-action='save-edit']");
    const avatar = container.querySelector(".avatar");

    if (textField) {
        autoResize(textField);
    }

    if (submitButton && nameField && textField) {
        submitButton.disabled = !(nameField.value.trim() && textField.value.trim() && isFirebaseConfigured);
    }

    updateAvatarElement(avatar, nameField?.value ?? "");
}

function syncDynamicTextareas() {
    document.querySelectorAll("textarea").forEach((textarea) => autoResize(textarea));
    document.querySelectorAll(".inline-composer").forEach((composer) => syncInlineComposer(composer));
}

function getCommentById(commentId) {
    return state.comments.find((comment) => comment.id === commentId) ?? null;
}

function commentHasReplies(commentId) {
    return state.comments.some((comment) => comment.parentId === commentId);
}

function getDescendantIds(commentId) {
    const descendants = [];
    const queue = [commentId];

    while (queue.length > 0) {
        const currentId = queue.shift();
        const children = state.comments.filter((comment) => comment.parentId === currentId);

        children.forEach((child) => {
            descendants.push(child.id);
            queue.push(child.id);
        });
    }

    return descendants;
}

function getDeletedAncestorCleanupIds(commentId, plannedDeletedIds = new Set()) {
    const commentMap = new Map(state.comments.map((comment) => [comment.id, comment]));
    const removedIds = new Set(plannedDeletedIds);
    const cleanupIds = [];
    let parentId = commentMap.get(commentId)?.parentId ?? null;

    while (parentId) {
        const parent = commentMap.get(parentId);

        if (!parent || !parent.deleted) {
            break;
        }

        const hasRemainingChildren = state.comments.some(
            (comment) => comment.parentId === parentId && !removedIds.has(comment.id)
        );

        if (hasRemainingChildren) {
            break;
        }

        cleanupIds.push(parentId);
        removedIds.add(parentId);
        parentId = parent.parentId ?? null;
    }

    return cleanupIds;
}

function closeDeleteModal() {
    state.deleteDialog = {
        isOpen: false,
        commentId: null,
        hasReplies: false
    };
    elements.deleteModal.hidden = true;
}

function openDeleteModal(commentId) {
    const comment = getCommentById(commentId);

    if (!comment) {
        return;
    }

    const hasReplies = commentHasReplies(commentId);
    state.deleteDialog = {
        isOpen: true,
        commentId,
        hasReplies
    };

    const deleteOnlyTitle = elements.deleteOnlyOption.querySelector(".dialog-option__title");
    const deleteOnlyText = elements.deleteOnlyOption.querySelector(".dialog-option__text");

    if (comment.deleted) {
        elements.deleteModalDescription.textContent = hasReplies
            ? "This comment is already deleted. You can remove the deleted placeholder only, or delete the full reply thread."
            : "This deleted comment can now be removed permanently.";
        elements.deleteThreadOption.hidden = !hasReplies;
        deleteOnlyTitle.textContent = hasReplies
            ? "Delete only this deleted comment"
            : "Delete this deleted comment";
        deleteOnlyText.textContent = hasReplies
            ? "The deleted placeholder will be removed and replies will stay visible."
            : "This will permanently remove the deleted placeholder.";
    } else {
        elements.deleteModalDescription.textContent = hasReplies
            ? "Choose whether to remove only the selected comment or the entire reply thread under it."
            : "This comment has no replies. Deleting it will remove it permanently.";
        elements.deleteThreadOption.hidden = !hasReplies;
        deleteOnlyTitle.textContent = "Delete only this comment";
        deleteOnlyText.textContent = hasReplies
            ? "The comment will be removed, but replies will stay visible in the thread."
            : "This will permanently remove the comment.";
    }

    elements.deleteModal.hidden = false;
}

function pruneState() {
    const ids = new Set(state.comments.map((comment) => comment.id));
    const rootCount = countRootThreads(state.comments);

    state.expandedReplies = new Set(
        [...state.expandedReplies].filter((commentId) => ids.has(commentId) && commentHasReplies(commentId))
    );

    state.replyDrafts = new Map(
        [...state.replyDrafts.entries()].filter(([commentId]) => ids.has(commentId))
    );

    if (state.activeReplyId && !ids.has(state.activeReplyId)) {
        state.activeReplyId = null;
    }

    if (state.activeEditId) {
        const comment = getCommentById(state.activeEditId);

        if (!comment || comment.deleted) {
            state.activeEditId = null;
            state.editDraft = { name: "", text: "" };
        }
    }

    if (state.openMenuId && !ids.has(state.openMenuId)) {
        state.openMenuId = null;
    }

    if (rootCount === 0) {
        state.visibleRootCount = INITIAL_VISIBLE_THREADS;
        return;
    }

    if (state.visibleRootCount < INITIAL_VISIBLE_THREADS) {
        state.visibleRootCount = INITIAL_VISIBLE_THREADS;
    }

    state.visibleRootCount = Math.min(state.visibleRootCount, rootCount);
}

function render() {
    const focusState = captureFocusState();

    elements.commentCount.textContent = String(countVisibleComments(state.comments));
    updateSortMenuState();

    renderComments(elements.commentsContainer, {
        comments: state.comments,
        currentName: state.currentName,
        expandedReplies: state.expandedReplies,
        activeReplyId: state.activeReplyId,
        replyDrafts: state.replyDrafts,
        activeEditId: state.activeEditId,
        editDraft: state.editDraft,
        openMenuId: state.openMenuId,
        isLoading: state.isLoading,
        error: state.error,
        isConfigured: isFirebaseConfigured,
        viewerId: state.viewerId,
        isAdmin: state.isAdmin,
        isAuthenticated: state.auth.isAuthenticated,
        adminUid: state.adminProfile.uid,
        adminEmail: state.adminProfile.email,
        authorName: AUTHOR_NAME,
        sortMode: state.sortMode,
        visibleRootCount: state.visibleRootCount,
        loadMoreStep: LOAD_MORE_STEP,
        initialVisibleRootCount: INITIAL_VISIBLE_THREADS
    });

    syncDynamicTextareas();
    refreshRelativeTimestamps(elements.commentsContainer);
    updateAuthUI();
    updateMainComposerState();
    restoreFocusState(focusState);
}

function closeSortMenu() {
    elements.sortMenu.hidden = true;
    elements.sortToggle.setAttribute("aria-expanded", "false");
}

function openSortMenu() {
    elements.sortMenu.hidden = false;
    elements.sortToggle.setAttribute("aria-expanded", "true");
}

function closeEmojiPopover() {
    elements.emojiPopover.hidden = true;
    state.activeEmojiTarget = null;
}

function getEmojiAnchorElement(fallbackAnchor = null) {
    const targetField = getEmojiTargetField();

    if (targetField) {
        return targetField.closest(".composer-form__row, .inline-composer__row") ?? targetField;
    }

    return fallbackAnchor;
}

function getEmojiHostElement(anchor = null) {
    const resolvedAnchor = getEmojiAnchorElement(anchor);

    if (!resolvedAnchor) {
        return null;
    }

    return resolvedAnchor.closest(".composer-form, .inline-composer__body") ?? document.body;
}

function positionEmojiPopover(anchor = null) {
    const resolvedAnchor = getEmojiAnchorElement(anchor);
    const host = getEmojiHostElement(anchor);

    if (!resolvedAnchor || !host) {
        return;
    }

    if (elements.emojiPopover.parentElement !== host) {
        host.appendChild(elements.emojiPopover);
    }

    const anchorRect = resolvedAnchor.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const availableWidth = Math.max(260, host.clientWidth - 8);
    const popoverWidth = Math.min(360, availableWidth);
    const left = Math.max(0, Math.min(anchorRect.left - hostRect.left, host.clientWidth - popoverWidth));
    const top = anchorRect.bottom - hostRect.top + 8;

    elements.emojiPopover.style.width = `${popoverWidth}px`;
    elements.emojiPopover.style.left = `${left}px`;
    elements.emojiPopover.style.top = `${top}px`;
}

function openEmojiPopover(anchor, targetType, commentId = "") {
    state.activeEmojiTarget = { targetType, commentId };
    elements.emojiPopover.hidden = false;
    positionEmojiPopover(anchor);
}

function getEmojiTargetField() {
    if (!state.activeEmojiTarget) {
        return null;
    }

    if (state.activeEmojiTarget.targetType === "main") {
        return elements.commentText;
    }

    if (state.activeEmojiTarget.targetType === "reply") {
        return document.querySelector(`[data-reply-input="${state.activeEmojiTarget.commentId}"]`);
    }

    if (state.activeEmojiTarget.targetType === "edit") {
        return document.querySelector(`[data-edit-input="${state.activeEmojiTarget.commentId}"]`);
    }

    return null;
}

function insertEmoji(target, emoji) {
    if (!target) {
        return;
    }

    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    const nextValue = `${target.value.slice(0, start)}${emoji}${target.value.slice(end)}`;

    target.value = nextValue;
    target.focus();
    target.setSelectionRange(start + emoji.length, start + emoji.length);
    target.dispatchEvent(new Event("input", { bubbles: true }));
}

async function submitMainComment() {
    const name = getNormalizedCommentName(elements.commenterName.value);
    const text = elements.commentText.value.trim();

    if (!name || !text || !isFirebaseConfigured) {
        return;
    }

    try {
        persistViewerName(name);
        state.currentName = name;
        await createComment({
            postId: state.postId,
            name,
            text,
            parentId: null,
            ...getCommentAuthorData()
        });
        elements.commentText.value = "";
        elements.commentText.style.height = "auto";
        elements.mainComposerActions.hidden = true;
        updateMainComposerState();
        state.error = "";
        render();
    } catch (error) {
        console.error("Unable to post comment.", error);
        state.error = error.message || "Unable to post comment.";
        render();
    }
}

async function submitReply(commentId) {
    const draft = state.replyDrafts.get(commentId);
    const name = getNormalizedCommentName(draft?.name ?? "");
    const text = draft?.text?.trim() ?? "";
    const targetComment = getCommentById(commentId);

    if (!name || !text || !isFirebaseConfigured) {
        return;
    }

    try {
        persistViewerName(name);
        state.currentName = name;
        state.expandedReplies.add(commentId);
        await createComment({
            postId: state.postId,
            name,
            text,
            parentId: commentId,
            replyTo: targetComment ? {
                id: targetComment.id,
                name: targetComment.name,
                text: targetComment.deleted ? "Deleted comment" : targetComment.text
            } : null,
            ...getCommentAuthorData()
        });
        state.replyDrafts.delete(commentId);
        state.activeReplyId = null;
        state.error = "";
        render();
    } catch (error) {
        console.error("Unable to post reply.", error);
        state.error = error.message || "Unable to post reply.";
        render();
    }
}

async function saveEdit(commentId) {
    const name = getNormalizedEditName(commentId, state.editDraft.name);
    const text = state.editDraft.text.trim();

    if (!name || !text || !isFirebaseConfigured) {
        return;
    }

    try {
        persistViewerName(name);
        state.currentName = name;
        await updateCommentText({ commentId, name, text });
        state.activeEditId = null;
        state.editDraft = { name: "", text: "" };
        state.error = "";
        render();
    } catch (error) {
        console.error("Unable to save comment changes.", error);
        state.error = error.message || "Unable to save comment changes.";
        render();
    }
}

async function removeComment(commentId, mode = "single") {
    const comment = getCommentById(commentId);

    if (!comment) {
        closeDeleteModal();
        return;
    }

    try {
        const hasReplies = commentHasReplies(commentId);
        const forceDeleteRecord = mode === "single" && comment.deleted;

        if (mode === "thread" && hasReplies) {
            const descendantIds = getDescendantIds(commentId);
            await deleteCommentThread({
                commentId,
                descendantIds,
                cleanupIds: getDeletedAncestorCleanupIds(
                    commentId,
                    new Set([commentId, ...descendantIds])
                )
            });
        } else {
            await deleteCommentRecord({
                commentId,
                hasReplies,
                forceDeleteRecord,
                cleanupIds: (forceDeleteRecord || !hasReplies)
                    ? getDeletedAncestorCleanupIds(commentId, new Set([commentId]))
                    : []
            });
        }

        state.activeEditId = state.activeEditId === commentId ? null : state.activeEditId;
        state.activeReplyId = state.activeReplyId === commentId ? null : state.activeReplyId;
        state.openMenuId = null;
        state.error = "";
        closeDeleteModal();
        render();
    } catch (error) {
        console.error("Unable to delete comment.", error);
        state.error = error.message || "Unable to delete comment.";
        closeDeleteModal();
        render();
    }
}

elements.commentText.addEventListener("focus", showMainComposerActions);

elements.commenterName.addEventListener("input", () => {
    if (state.isAdmin && elements.commenterName.value !== AUTHOR_NAME) {
        elements.commenterName.value = AUTHOR_NAME;
    }

    if (elements.commenterName.readOnly) {
        elements.commenterName.value = state.currentName;
    }

    state.currentName = elements.commenterName.value;
    persistViewerName(state.currentName);
    updateMainComposerState();
});

elements.commentText.addEventListener("input", () => {
    autoResize(elements.commentText);
    updateMainComposerState();
});

elements.cancelMainComment.addEventListener("click", () => {
    elements.commentText.value = "";
    elements.commentText.style.height = "auto";
    elements.mainComposerActions.hidden = true;
    updateMainComposerState();
});

elements.commentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitMainComment();
});

elements.sortToggle.addEventListener("click", () => {
    if (elements.sortMenu.hidden) {
        openSortMenu();
    } else {
        closeSortMenu();
    }
});

elements.sortMenu.addEventListener("click", (event) => {
    const button = event.target.closest("[data-sort]");

    if (!button) {
        return;
    }

    state.sortMode = button.dataset.sort;
    state.visibleRootCount = INITIAL_VISIBLE_THREADS;
    closeSortMenu();
    render();
});

elements.mainEmojiButton.addEventListener("click", () => {
    showMainComposerActions();
    openEmojiPopover(elements.mainEmojiButton, "main");
});

elements.closeEmojiPopover.addEventListener("click", closeEmojiPopover);
elements.closeDeleteModal.addEventListener("click", closeDeleteModal);
elements.cancelDeleteAction.addEventListener("click", closeDeleteModal);
elements.authActionButton.addEventListener("click", async () => {
    if (!isFirebaseConfigured) {
        return;
    }

    if (state.auth.isAuthenticated) {
        try {
            state.isAuthPending = true;
            render();
            await signOutViewer();
            state.auth = {
                user: null,
                uid: "",
                email: "",
                displayName: "",
                isAnonymous: true,
                isAuthenticated: false
            };
            syncAdminFlag();
            clearLocalViewerName({ clearReplyDrafts: true });
        } catch (error) {
            state.error = error.message || "Unable to sign out.";
            render();
        } finally {
            state.isAuthPending = false;
            render();
        }
        return;
    }

    openAuthModal();
});
elements.closeAuthModal.addEventListener("click", closeAuthModal);
elements.cancelAuthAction.addEventListener("click", closeAuthModal);
elements.googleSignInButton.addEventListener("click", async () => {
    try {
        state.isAuthPending = true;
        state.authMessage = "";
        render();
        await signInWithGoogleAccount();
        closeAuthModal();
    } catch (error) {
        state.authMessage = getFriendlyAuthErrorMessage(error);
        render();
    } finally {
        state.isAuthPending = false;
        render();
    }
});
elements.emailAuthForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setAuthMode("signin");

    const email = elements.authEmail.value.trim();
    const password = elements.authPassword.value;

    if (!email || !password) {
        state.authMessage = "Email and password are required.";
        render();
        return;
    }

    try {
        state.isAuthPending = true;
        state.authMessage = "";
        render();
        await signInWithEmailAccount({ email, password });
        closeAuthModal();
    } catch (error) {
        state.authMessage = getFriendlyAuthErrorMessage(error);
        render();
    } finally {
        state.isAuthPending = false;
        render();
    }
});
elements.createAccountButton.addEventListener("click", async () => {
    if (state.authMode !== "create") {
        setAuthMode("create");
        elements.authName.focus();
        return;
    }

    const name = elements.authName.value.trim();
    const email = elements.authEmail.value.trim();
    const password = elements.authPassword.value;

    if (!name || !email || !password) {
        state.authMessage = "Name, email, and password are required.";
        render();
        return;
    }

    try {
        state.isAuthPending = true;
        state.authMessage = "";
        render();
        await createEmailAccount({ name, email, password });
        state.auth = {
            ...state.auth,
            displayName: name
        };
        state.currentName = name;
        persistViewerName(name);
        elements.commenterName.value = name;
        updateMainComposerState();
        closeAuthModal();
    } catch (error) {
        state.authMessage = getFriendlyAuthErrorMessage(error);
        render();
    } finally {
        state.isAuthPending = false;
        render();
    }
});
elements.deleteOnlyOption.addEventListener("click", async () => {
    if (!state.deleteDialog.commentId) {
        return;
    }

    await removeComment(state.deleteDialog.commentId, "single");
});
elements.deleteThreadOption.addEventListener("click", async () => {
    if (!state.deleteDialog.commentId || !state.deleteDialog.hasReplies) {
        return;
    }

    await removeComment(state.deleteDialog.commentId, "thread");
});

elements.emojiPicker.addEventListener("emoji-click", (event) => {
    insertEmoji(getEmojiTargetField(), event.detail.unicode);
});

elements.commentsContainer.addEventListener("click", async (event) => {
    const actionTarget = event.target.closest("[data-action]");

    if (!actionTarget) {
        return;
    }

    const { action, commentId, targetType } = actionTarget.dataset;

    if (action === "toggle-replies") {
        if (state.expandedReplies.has(commentId)) {
            state.expandedReplies.delete(commentId);
        } else {
            state.expandedReplies.add(commentId);
        }

        render();
        return;
    }

    if (action === "load-more-comments") {
        state.visibleRootCount += LOAD_MORE_STEP;
        render();
        return;
    }

    if (action === "collapse-comments") {
        state.visibleRootCount = INITIAL_VISIBLE_THREADS;
        render();
        return;
    }

    if (action === "toggle-reply-form") {
        if (state.activeReplyId === commentId) {
            state.activeReplyId = null;
        } else {
            state.activeReplyId = commentId;

            if (!state.replyDrafts.has(commentId)) {
                state.replyDrafts.set(commentId, { name: state.currentName, text: "" });
            }
        }

        state.openMenuId = null;
        render();
        return;
    }

    if (action === "cancel-reply") {
        state.activeReplyId = null;
        render();
        return;
    }

    if (action === "submit-reply") {
        await submitReply(commentId);
        return;
    }

    if (action === "toggle-menu") {
        state.openMenuId = state.openMenuId === commentId ? null : commentId;
        render();
        return;
    }

    if (action === "start-edit") {
        const comment = getCommentById(commentId);

        if (!comment || comment.deleted) {
            return;
        }

        state.activeEditId = commentId;
        state.activeReplyId = null;
        state.openMenuId = null;
        state.editDraft = { name: shouldLockAuthorName(comment) ? AUTHOR_NAME : comment.name, text: comment.text };
        render();
        return;
    }

    if (action === "cancel-edit") {
        state.activeEditId = null;
        state.editDraft = { name: "", text: "" };
        render();
        return;
    }

    if (action === "save-edit") {
        await saveEdit(commentId);
        return;
    }

    if (action === "delete-comment") {
        openDeleteModal(commentId);
        return;
    }

    if (action === "like" || action === "dislike") {
        try {
            await toggleReaction(commentId, action);
            state.error = "";
        } catch (error) {
            state.error = error.message || "Unable to update reaction.";
            render();
        }
        return;
    }

    if (action === "open-emoji") {
        openEmojiPopover(actionTarget, targetType, commentId);
    }
});

elements.commentsContainer.addEventListener("input", (event) => {
    const replyNameField = event.target.closest("[data-reply-name]");
    const replyTextField = event.target.closest("[data-reply-input]");
    const editNameField = event.target.closest("[data-edit-name]");
    const editTextField = event.target.closest("[data-edit-input]");

    if (replyNameField) {
        const draft = state.replyDrafts.get(replyNameField.dataset.replyName) ?? { name: "", text: "" };
        draft.name = state.isAdmin ? AUTHOR_NAME : replyNameField.value;
        if (state.isAdmin && replyNameField.value !== AUTHOR_NAME) {
            replyNameField.value = AUTHOR_NAME;
        }
        state.replyDrafts.set(replyNameField.dataset.replyName, draft);
        syncInlineComposer(replyNameField.closest(".inline-composer"));
        return;
    }

    if (replyTextField) {
        const draft = state.replyDrafts.get(replyTextField.dataset.replyInput) ?? { name: state.currentName, text: "" };
        draft.text = replyTextField.value;
        state.replyDrafts.set(replyTextField.dataset.replyInput, draft);
        syncInlineComposer(replyTextField.closest(".inline-composer"));
        return;
    }

    if (editNameField) {
        const editingComment = getCommentById(state.activeEditId);
        state.editDraft.name = shouldLockAuthorName(editingComment) ? AUTHOR_NAME : editNameField.value;
        if (shouldLockAuthorName(editingComment) && editNameField.value !== AUTHOR_NAME) {
            editNameField.value = AUTHOR_NAME;
        }
        syncInlineComposer(editNameField.closest(".inline-composer"));
        return;
    }

    if (editTextField) {
        state.editDraft.text = editTextField.value;
        syncInlineComposer(editTextField.closest(".inline-composer"));
    }
});

elements.commentsContainer.addEventListener("keydown", async (event) => {
    if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") {
        return;
    }

    const replyField = event.target.closest("[data-reply-input]");
    const editField = event.target.closest("[data-edit-input]");

    if (replyField) {
        event.preventDefault();
        await submitReply(replyField.dataset.replyInput);
        return;
    }

    if (editField) {
        event.preventDefault();
        await saveEdit(editField.dataset.editInput);
    }
});

document.addEventListener("click", (event) => {
    if (!event.target.closest(".sort-control")) {
        closeSortMenu();
    }

    if (!event.target.closest(".comment-menu") && state.openMenuId) {
        state.openMenuId = null;
        render();
    }

    const clickedReplyToggle = event.target.closest("[data-action='toggle-reply-form']");
    const insideReplyComposer = event.target.closest(".inline-composer[data-inline-form='reply']");
    const insideReplyEmoji = event.target.closest(".emoji-popover") && state.activeEmojiTarget?.targetType === "reply";

    if (state.activeReplyId && !insideReplyComposer && !clickedReplyToggle && !insideReplyEmoji) {
        state.activeReplyId = null;
        render();
    }

    const clickedEmojiTrigger = event.target.closest("[data-action='open-emoji']");

    if (!event.target.closest(".emoji-popover") && !clickedEmojiTrigger) {
        closeEmojiPopover();
    }

    if (event.target === elements.deleteModal) {
        closeDeleteModal();
    }

    if (event.target === elements.authModal) {
        closeAuthModal();
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
        return;
    }

    if (!elements.authModal.hidden) {
        closeAuthModal();
        return;
    }

    if (!elements.deleteModal.hidden) {
        closeDeleteModal();
    }
});

window.addEventListener("resize", () => {
    if (state.activeEmojiTarget && !elements.emojiPopover.hidden) {
        const selector = state.activeEmojiTarget.targetType === "main"
            ? "[data-target-type='main']"
            : `[data-action='open-emoji'][data-target-type='${state.activeEmojiTarget.targetType}'][data-comment-id='${state.activeEmojiTarget.commentId}']`;
        const anchor = document.querySelector(selector);

        if (anchor) {
            positionEmojiPopover(anchor);
        }
    }
});

setInterval(() => refreshRelativeTimestamps(elements.commentsContainer), 60000);

async function bootstrap() {
    try {
        state.viewerId = await initializeSession();

        subscribeToViewerAuth(
            (authState) => {
                state.auth = authState;
                state.viewerId = authState.uid || state.viewerId;
                syncAdminFlag();
                syncNameFromAuth();
                maybeSyncAdminIdentity();
                render();
            },
            (error) => {
                state.authMessage = getFriendlyAuthErrorMessage(error);
                render();
            }
        );

        subscribeToAdminProfile(
            (adminProfile) => {
                state.adminProfile = adminProfile;
                syncAdminFlag();
                syncNameFromAuth();
                maybeSyncAdminIdentity();
                render();
            },
            () => {
                state.adminProfile = { email: "", uid: "" };
                syncAdminFlag();
                syncNameFromAuth();
                render();
            }
        );

        subscribeToComments(
            state.postId,
            (comments) => {
                state.comments = comments;
                state.isLoading = false;
                pruneState();
                render();
            },
            (error) => {
                state.isLoading = false;
                console.error("Unable to load comments.", error);
                state.error = error.message || "Unable to load comments.";
                render();
            }
        );
    } catch (error) {
        state.isLoading = false;
        console.error("Unable to start Firebase session.", error);
        state.error = error.message || "Unable to start Firebase session.";
        render();
    }
}

updateMainComposerState();
syncAuthModeUI();
render();
bootstrap();




