const AVATAR_COLORS = [
    "#1a73e8",
    "#00897b",
    "#e53935",
    "#8e24aa",
    "#ef6c00",
    "#3949ab",
    "#00838f",
    "#7cb342"
];

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function getTimestampValue(timestamp, fallback = 0) {
    if (!timestamp) {
        return fallback;
    }

    if (typeof timestamp.toMillis === "function") {
        return timestamp.toMillis();
    }

    if (timestamp instanceof Date) {
        return timestamp.getTime();
    }

    return Number(timestamp) || fallback;
}

function getAuthorName(state) {
    return state.authorName || "Ransh";
}

function isAuthorComment(comment, state) {
    const adminUid = state.adminUid || "";
    const adminEmail = typeof state.adminEmail === "string" ? state.adminEmail.trim().toLowerCase() : "";

    return Boolean(
        comment.verified ||
        comment.isAuthor ||
        (adminUid && (comment.ownerId === adminUid || comment.authorUid === adminUid)) ||
        (adminEmail && comment.authorEmail === adminEmail)
    );
}

function getDisplayName(comment, state) {
    if (comment.deleted) {
        return "Deleted";
    }

    return isAuthorComment(comment, state) ? getAuthorName(state) : comment.name;
}

function sortComments(comments, sortMode, state) {
    return [...comments].sort((left, right) => {
        const authorDifference = Number(isAuthorComment(right, state)) - Number(isAuthorComment(left, state));

        if (authorDifference !== 0) {
            return authorDifference;
        }

        const timeDifference = getTimestampValue(right.timestamp, right.createdAtClient) - getTimestampValue(left.timestamp, left.createdAtClient);

        if (sortMode === "newest") {
            return timeDifference;
        }

        if (right.likes !== left.likes) {
            return right.likes - left.likes;
        }

        return timeDifference;
    });
}

function sortReplies(comments, state) {
    return [...comments].sort(
        (left, right) => {
            const authorDifference = Number(isAuthorComment(right, state)) - Number(isAuthorComment(left, state));

            if (authorDifference !== 0) {
                return authorDifference;
            }

            return getTimestampValue(left.timestamp, left.createdAtClient) - getTimestampValue(right.timestamp, right.createdAtClient);
        }
    );
}

function pluralize(value, singular, plural) {
    return value === 1 ? singular : plural;
}

function clampText(value, maxLength = 84) {
    const normalized = String(value || "").replace(/\s+/g, " ").trim();

    if (normalized.length <= maxLength) {
        return normalized;
    }

    return `${normalized.slice(0, maxLength - 1)}...`;
}

export function getAvatarProps(name) {
    const safeName = (name || "User").trim();
    const initial = safeName.charAt(0).toUpperCase() || "U";
    const hash = safeName.split("").reduce((total, char) => total + char.charCodeAt(0), 0);

    return {
        initial,
        background: AVATAR_COLORS[hash % AVATAR_COLORS.length]
    };
}

function formatRelativeTimeValue(timestamp) {
    const now = Date.now();
    const ms = getTimestampValue(timestamp, now);
    const seconds = Math.round((ms - now) / 1000);
    const absSeconds = Math.abs(seconds);
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

    if (absSeconds < 60) {
        return rtf.format(Math.round(seconds), "second");
    }

    if (absSeconds < 3600) {
        return rtf.format(Math.round(seconds / 60), "minute");
    }

    if (absSeconds < 86400) {
        return rtf.format(Math.round(seconds / 3600), "hour");
    }

    if (absSeconds < 2592000) {
        return rtf.format(Math.round(seconds / 86400), "day");
    }

    if (absSeconds < 31536000) {
        return rtf.format(Math.round(seconds / 2592000), "month");
    }

    return rtf.format(Math.round(seconds / 31536000), "year");
}

function buildSkeletonMarkup() {
    return Array.from({ length: 4 }, () => `
        <div class="comment-skeleton">
            <div class="comment-skeleton__avatar"></div>
            <div class="comment-skeleton__lines">
                <div class="comment-skeleton__line comment-skeleton__line--short"></div>
                <div class="comment-skeleton__line"></div>
                <div class="comment-skeleton__line comment-skeleton__line--medium"></div>
            </div>
        </div>
    `).join("");
}

function buildEmptyStateMarkup() {
    return `
        <div class="feedback-card feedback-card--neutral">
            <span class="material-symbols-rounded" aria-hidden="true">forum</span>
            <div>
                <strong>No comments yet</strong>
                <p>Be the first to join the conversation.</p>
            </div>
        </div>
    `;
}

function buildErrorMarkup(message) {
    return `
        <div class="feedback-card">
            <span class="material-symbols-rounded" aria-hidden="true">error</span>
            <div>
                <strong>Something went wrong</strong>
                <p>${escapeHtml(message)}</p>
            </div>
        </div>
    `;
}

function buildLoadMoreMarkup({ remainingCount, nextBatchSize, canCollapse }) {
    if (remainingCount <= 0 && !canCollapse) {
        return "";
    }

    return `
        <div class="comment-list__load-more">
            <div class="comment-list__load-more-fade" aria-hidden="true"></div>
            <div class="comment-list__load-more-actions">
                ${remainingCount > 0 ? `
                    <button class="load-more-comments" type="button" data-action="load-more-comments">
                        <span class="load-more-comments__plus" aria-hidden="true">+</span>
                        <span class="load-more-comments__text">View more comments</span>
                        <span class="load-more-comments__meta">${remainingCount} remaining</span>
                    </button>
                ` : ""}
                ${canCollapse ? `
                    <button class="see-less-comments" type="button" data-action="collapse-comments">
                        <span class="material-symbols-rounded" aria-hidden="true">expand_less</span>
                        <span>See less</span>
                    </button>
                ` : ""}
            </div>
        </div>
    `;
}

function buildChildMap(comments) {
    const childMap = new Map();

    comments.forEach((comment) => {
        const key = comment.parentId ?? "__root__";
        const current = childMap.get(key) ?? [];
        current.push(comment);
        childMap.set(key, current);
    });

    return childMap;
}

function countReplies(commentId, childMap, cache) {
    if (cache.has(commentId)) {
        return cache.get(commentId);
    }

    const children = childMap.get(commentId) ?? [];
    const total = children.reduce((count, child) => count + 1 + countReplies(child.id, childMap, cache), 0);

    cache.set(commentId, total);
    return total;
}

function buildQuoteMarkup(replyTo, className = "reply-quote") {
    if (!replyTo) {
        return "";
    }

    const name = replyTo.name || "Deleted";
    const text = clampText(replyTo.text || "Original message unavailable");

    return `
        <div class="${className}">
            <div class="${className}__bar"></div>
            <div class="${className}__content">
                <div class="${className}__name">${escapeHtml(name)}</div>
                <div class="${className}__text">${escapeHtml(text)}</div>
            </div>
        </div>
    `;
}

function buildReplyContextMarkup(replyTo) {
    if (!replyTo) {
        return "";
    }

    return `
        <div class="comment__context">
            Replying to <span class="comment__context-name">@${escapeHtml(replyTo.name || "Deleted")}</span>
        </div>
    `;
}

function buildReplyComposer(commentId, draft, replyTarget, state) {
    const avatar = getAvatarProps(draft.name);
    const readOnlyName = state.isAuthenticated && draft.name.trim() ? " readonly" : "";

    return `
        <form class="inline-composer" data-inline-form="reply" data-comment-id="${escapeHtml(commentId)}">
            <div class="avatar avatar--sm" style="background:${avatar.background}">${avatar.initial}</div>
            <div class="inline-composer__body">
                ${buildQuoteMarkup(replyTarget, "inline-quote")}
                <input class="field field--name" type="text" maxlength="40" placeholder="Name" value="${escapeHtml(draft.name)}" data-reply-name="${escapeHtml(commentId)}" required${readOnlyName}>
                <div class="inline-composer__row">
                    <textarea class="field field--comment" rows="1" maxlength="2000" placeholder="Add a reply..." data-reply-input="${escapeHtml(commentId)}" required>${escapeHtml(draft.text)}</textarea>
                    <button class="icon-button icon-button--ghost" type="button" data-action="open-emoji" data-target-type="reply" data-comment-id="${escapeHtml(commentId)}" aria-label="Add emoji">
                        <span class="material-symbols-rounded" aria-hidden="true">mood</span>
                    </button>
                </div>
                <div class="inline-composer__actions">
                    <button class="text-button" type="button" data-action="cancel-reply" data-comment-id="${escapeHtml(commentId)}">Cancel</button>
                    <button class="primary-button" type="button" data-action="submit-reply" data-comment-id="${escapeHtml(commentId)}"${draft.name.trim() && draft.text.trim() ? "" : " disabled"}>Reply</button>
                </div>
            </div>
        </form>
    `;
}

function buildEditComposer(comment, draft, state) {
    const avatar = getAvatarProps(draft.name);
    const readOnlyName = state.isAuthenticated && draft.name.trim() ? " readonly" : "";

    return `
        <form class="inline-composer" data-inline-form="edit" data-comment-id="${escapeHtml(comment.id)}">
            <div class="avatar avatar--sm" style="background:${avatar.background}">${avatar.initial}</div>
            <div class="inline-composer__body">
                <input class="field field--name" type="text" maxlength="40" placeholder="Name" value="${escapeHtml(draft.name)}" data-edit-name="${escapeHtml(comment.id)}" required${readOnlyName}>
                <div class="inline-composer__row">
                    <textarea class="field field--comment" rows="1" maxlength="2000" data-edit-input="${escapeHtml(comment.id)}" required>${escapeHtml(draft.text)}</textarea>
                    <button class="icon-button icon-button--ghost" type="button" data-action="open-emoji" data-target-type="edit" data-comment-id="${escapeHtml(comment.id)}" aria-label="Add emoji">
                        <span class="material-symbols-rounded" aria-hidden="true">mood</span>
                    </button>
                </div>
                <div class="inline-composer__actions">
                    <button class="text-button" type="button" data-action="cancel-edit" data-comment-id="${escapeHtml(comment.id)}">Cancel</button>
                    <button class="primary-button" type="button" data-action="save-edit" data-comment-id="${escapeHtml(comment.id)}"${draft.name.trim() && draft.text.trim() ? "" : " disabled"}>Save</button>
                </div>
            </div>
        </form>
    `;
}

function buildCommentMarkup(comment, childMap, replyCache, state, options = {}) {
    const {
        isReply = false,
        parentComment = null,
        replyThreadMarkup = ""
    } = options;
    const displayName = getDisplayName(comment, state);
    const avatar = getAvatarProps(displayName);
    const isOwner = comment.ownerId === state.viewerId;
    const canModerate = isOwner || state.isAdmin;
    const liked = comment.likedBy.includes(state.viewerId);
    const disliked = comment.dislikedBy.includes(state.viewerId);
    const isEditing = state.activeEditId === comment.id;
    const isReplying = state.activeReplyId === comment.id;
    const menuOpen = state.openMenuId === comment.id;
    const canEdit = canModerate && !comment.deleted;
    const canDelete = canModerate && (!comment.deleted || state.isAdmin);
    const showAuthorBadge = !comment.deleted && isAuthorComment(comment, state);
    const replyTarget = comment.replyTo ?? (isReply && parentComment ? {
        id: parentComment.id,
        name: getDisplayName(parentComment, state),
        text: parentComment.deleted ? "Deleted comment" : parentComment.text
    } : null);
    const replyingMarkup = isReply && !comment.deleted ? buildReplyContextMarkup(replyTarget) : "";
    const bodyMarkup = comment.deleted
        ? `<p class="comment__body comment__body--deleted">Comment deleted</p>`
        : `<p class="comment__body">${escapeHtml(comment.text)}</p>`;
    const editMarkup = isEditing ? buildEditComposer(comment, state.editDraft, state) : "";
    const replyDraft = state.replyDrafts.get(comment.id) ?? { name: state.currentName, text: "" };
    const replyMarkup = isReplying && !comment.deleted ? buildReplyComposer(comment.id, replyDraft, {
        id: comment.id,
        name: displayName,
        text: comment.deleted ? "Deleted comment" : comment.text
    }, state) : "";
    const menuMarkup = (canEdit || canDelete) ? `
        <div class="comment-menu">
            <button class="icon-button icon-button--ghost" type="button" data-action="toggle-menu" data-comment-id="${escapeHtml(comment.id)}" aria-label="More actions">
                <span class="material-symbols-rounded" aria-hidden="true">more_vert</span>
            </button>
            <div class="comment-menu__popup${menuOpen ? " is-open" : ""}">
                ${canEdit ? `
                    <button class="comment-menu__item" type="button" data-action="start-edit" data-comment-id="${escapeHtml(comment.id)}">
                        <span class="material-symbols-rounded" aria-hidden="true">edit</span>
                        <span>Edit</span>
                    </button>
                ` : ""}
                ${canDelete ? `
                    <button class="comment-menu__item" type="button" data-action="delete-comment" data-comment-id="${escapeHtml(comment.id)}">
                    <span class="material-symbols-rounded" aria-hidden="true">delete</span>
                    <span>${comment.deleted ? "Delete permanently" : "Delete"}</span>
                    </button>
                ` : ""}
            </div>
        </div>
    ` : "";

    return `
        <article class="comment${isReply ? " comment--reply" : ""}" data-comment-id="${escapeHtml(comment.id)}">
            <div class="avatar ${isReply ? "avatar--sm" : "avatar--md"}" style="background:${avatar.background}">${avatar.initial}</div>
            <div class="comment__content">
                <div class="comment__header">
                    <span class="comment__author">${escapeHtml(displayName)}</span>
                    ${showAuthorBadge ? `
                        <span class="author-badge">Author</span>
                    ` : ""}
                    <time class="comment__time" data-role="timestamp" data-timestamp="${getTimestampValue(comment.timestamp, comment.createdAtClient)}" title="${new Date(getTimestampValue(comment.timestamp, comment.createdAtClient) || Date.now()).toLocaleString()}">${escapeHtml(formatRelativeTimeValue(comment.timestamp ?? comment.createdAtClient))}</time>
                    ${comment.editedAt && !comment.deleted ? `<span class="comment__edited">edited</span>` : ""}
                    ${menuMarkup}
                </div>
                ${replyingMarkup}
                ${isEditing ? editMarkup : bodyMarkup}
                ${!isEditing ? `
                    <div class="comment__actions">
                        <div class="reaction-group">
                            <button class="reaction-button${liked ? " is-active" : ""}" type="button" data-action="like" data-comment-id="${escapeHtml(comment.id)}" aria-label="Like comment"${comment.deleted ? " disabled" : ""}>
                                <span class="material-symbols-rounded${liked ? " is-filled" : ""}" aria-hidden="true">thumb_up</span>
                            </button>
                            <span class="reaction-count">${comment.likes > 0 ? comment.likes : ""}</span>
                            <button class="reaction-button${disliked ? " is-active" : ""}" type="button" data-action="dislike" data-comment-id="${escapeHtml(comment.id)}" aria-label="Dislike comment"${comment.deleted ? " disabled" : ""}>
                                <span class="material-symbols-rounded${disliked ? " is-filled" : ""}" aria-hidden="true">thumb_down</span>
                            </button>
                        </div>
                        ${!comment.deleted ? `<button class="comment-reply-button" type="button" data-action="toggle-reply-form" data-comment-id="${escapeHtml(comment.id)}">Reply</button>` : ""}
                    </div>
                ` : ""}
                ${replyMarkup}
                ${replyThreadMarkup}
            </div>
        </article>
    `;
}

function buildReplyChainMarkup(comment, childMap, replyCache, state, parentComment) {
    const children = sortReplies(childMap.get(comment.id) ?? [], state);

    return [
        buildCommentMarkup(comment, childMap, replyCache, state, {
            isReply: true,
            parentComment
        }),
        children.map((child) => buildReplyChainMarkup(child, childMap, replyCache, state, comment)).join("")
    ].join("");
}

function buildReplyThreadMarkup(comment, childMap, replyCache, state) {
    const children = sortReplies(childMap.get(comment.id) ?? [], state);

    if (children.length === 0) {
        return "";
    }

    const replyCount = countReplies(comment.id, childMap, replyCache);
    const isExpanded = state.expandedReplies.has(comment.id);

    return `
        <button class="toggle-replies" type="button" data-action="toggle-replies" data-comment-id="${escapeHtml(comment.id)}">
            <span class="material-symbols-rounded${isExpanded ? " is-filled" : ""}" aria-hidden="true">${isExpanded ? "expand_less" : "expand_more"}</span>
            <span>${isExpanded ? "Hide" : "View"} ${replyCount} ${pluralize(replyCount, "reply", "replies")}</span>
        </button>
        <div class="reply-thread${isExpanded ? " is-open" : ""}"${isExpanded ? "" : " hidden"}>
            ${children.map((child) => buildReplyChainMarkup(child, childMap, replyCache, state, comment)).join("")}
        </div>
    `;
}

export function renderComments(container, state) {
    if (!state.isConfigured) {
        container.innerHTML = buildEmptyStateMarkup();
        return;
    }

    if (state.error) {
        container.innerHTML = buildErrorMarkup(state.error);
        return;
    }

    if (state.isLoading) {
        container.innerHTML = buildSkeletonMarkup();
        return;
    }

    if (state.comments.length === 0) {
        container.innerHTML = buildEmptyStateMarkup();
        return;
    }

    const idSet = new Set(state.comments.map((comment) => comment.id));
    const childMap = buildChildMap(state.comments);
    const replyCache = new Map();
    const rootComments = sortComments(
        state.comments.filter((comment) => !comment.parentId || !idSet.has(comment.parentId)),
        state.sortMode,
        state
    );
    const visibleRootCount = Math.max(0, Number(state.visibleRootCount) || rootComments.length);
    const visibleRootComments = rootComments.slice(0, visibleRootCount);
    const remainingRootCount = Math.max(0, rootComments.length - visibleRootComments.length);
    const nextBatchSize = Math.min(
        Math.max(1, Number(state.loadMoreStep) || 5),
        remainingRootCount
    );
    const canCollapse = visibleRootComments.length > Math.max(0, Number(state.initialVisibleRootCount) || 4);

    container.innerHTML = visibleRootComments
        .map((comment) => buildCommentMarkup(comment, childMap, replyCache, state, {
            replyThreadMarkup: buildReplyThreadMarkup(comment, childMap, replyCache, state)
        }))
        .join("") + buildLoadMoreMarkup({
            remainingCount: remainingRootCount,
            nextBatchSize,
            canCollapse
        });
}

export function refreshRelativeTimestamps(root) {
    root.querySelectorAll("[data-role='timestamp']").forEach((element) => {
        const timestamp = Number(element.getAttribute("data-timestamp"));
        element.textContent = formatRelativeTimeValue(timestamp);
    });
}


