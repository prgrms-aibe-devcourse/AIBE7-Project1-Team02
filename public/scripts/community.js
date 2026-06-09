document.addEventListener("DOMContentLoaded", () => {
  const AUTH_KEYS = { access: "sb_access_token", refresh: "sb_refresh_token", user: "sb_user" };
  const authToken = sessionStorage.getItem(AUTH_KEYS.access) || "";

  if (!authToken) {
    window.location.replace("./login.html");
    return;
  }

  const currentUser = safeJson(sessionStorage.getItem(AUTH_KEYS.user) || "{}");
  const jwt = decodeJwt(authToken);
  const userId = currentUser?.id || jwt?.sub || "";
  const userNickname =
    currentUser?.user_metadata?.nickname ||
    currentUser?.user_metadata?.name ||
    currentUser?.email?.split("@")?.[0] ||
    "사용자";
  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(userNickname)}&background=1a5c3a&color=fff&size=160`;

  const state = {
    supabaseUrl: "",
    supabaseAnonKey: "",
    storageBucket: "community-images",
    api: {},
    posts: [],
    comments: [],
    detailPost: null,
    editingPostId: null,
    editingCommentId: null,
    activeCommentPostId: null,
    postImages: [],
    existingPostImages: [],
    postSummarySelectionStart: 0,
    postSummarySelectionEnd: 0,
    likingPostIds: new Set(),
  };

  const els = {
    headerUserName: document.getElementById("header-user-name"),
    logoutBtn: document.getElementById("logout-btn"),
    feed: document.getElementById("community-feed"),
    popularTags: document.getElementById("popular-tags"),
    recommendedUsers: document.getElementById("recommended-users"),
    featuredStory: document.getElementById("featured-story"),
    btnSidebarCreate: document.getElementById("btn-sidebar-create"),
    btnWritePost: document.getElementById("btn-write-post"),
    postModal: document.getElementById("post-modal"),
    postModalClose: document.getElementById("post-modal-close"),
    postForm: document.getElementById("post-form"),
    postType: document.getElementById("post-type"),
    postTitle: document.getElementById("post-title"),
    postSummary: document.getElementById("post-summary"),
    postImageFile: document.getElementById("post-image-file"),
    postImageOrderList: document.getElementById("post-image-order-list"),
    postImageGallery: document.getElementById("post-image-gallery"),
    postImageDropzone: document.getElementById("post-image-dropzone"),
    postTags: document.getElementById("post-tags"),
    postLocation: document.getElementById("post-location"),
    postCategory: document.getElementById("post-category"),
    commentModal: document.getElementById("comment-modal"),
    commentModalClose: document.getElementById("comment-modal-close"),
    commentList: document.getElementById("comment-list"),
    commentForm: document.getElementById("comment-form"),
    commentTextarea: document.getElementById("comment-text"),
    commentPostId: document.getElementById("comment-post-id"),
    commentPostTitle: document.getElementById("comment-post-title"),
    mobileToggle: document.getElementById("mobile-toggle"),
    sidebar: document.getElementById("sidebar"),
    sidebarOverlay: document.getElementById("sidebar-overlay"),
    detailModal: document.getElementById("post-detail-modal"),
    detailModalClose: document.getElementById("detail-modal-close"),
    detailGallery: document.getElementById("detail-gallery"),
    detailTitle: document.getElementById("detail-title"),
    detailAuthor: document.getElementById("detail-author"),
    detailTime: document.getElementById("detail-time"),
    detailTags: document.getElementById("detail-tags"),
    detailSummary: document.getElementById("detail-summary"),
    detailCommentList: document.getElementById("detail-comment-list"),
    detailLikeBtn: document.getElementById("detail-like-btn"),
    detailCommentBtn: document.getElementById("detail-comment-btn"),
    detailShareBtn: document.getElementById("detail-share-btn"),
    detailEditBtn: document.getElementById("detail-edit-btn"),
    detailDeleteBtn: document.getElementById("detail-delete-btn"),
    imageLightbox: document.getElementById("image-lightbox"),
    imageLightboxClose: document.getElementById("image-lightbox-close"),
    imageLightboxImg: document.getElementById("image-lightbox-img"),
    insertImageTokenBtns: document.querySelectorAll("[data-insert-image-token]"),
  };

  init().catch((error) => {
    console.error(error);
    alert(error.message || "커뮤니티를 불러오지 못했습니다.");
  });

  async function init() {
    if (els.headerUserName) els.headerUserName.textContent = userNickname;
    bindEvents();
    await loadConfig();
    await refreshCommunity();
    lucide.createIcons();
  }

  async function loadConfig() {
    const res = await fetch("/api/config");
    const result = await res.json();
    if (!result.success) throw new Error("설정 정보를 불러오지 못했습니다.");

    state.supabaseUrl = result.data.supabaseUrl;
    state.supabaseAnonKey = result.data.supabaseAnonKey;
    state.storageBucket = result.data.supabaseStorageBucket || "community-images";
    state.api = {
      feed: `${state.supabaseUrl}/rest/v1/community_feed`,
      posts: `${state.supabaseUrl}/rest/v1/community_posts`,
      likes: `${state.supabaseUrl}/rest/v1/community_likes`,
      comments: `${state.supabaseUrl}/rest/v1/community_comments`,
      shares: `${state.supabaseUrl}/rest/v1/community_shares`,
      tags: `${state.supabaseUrl}/rest/v1/community_tags_popular`,
      users: `${state.supabaseUrl}/rest/v1/users`,
      storage: `${state.supabaseUrl}/storage/v1/object/${state.storageBucket}`,
      storagePublic: `${state.supabaseUrl}/storage/v1/object/public/${state.storageBucket}`,
    };
  }

  function bindEvents() {
    els.logoutBtn?.addEventListener("click", handleLogout);
    els.btnSidebarCreate?.addEventListener("click", openPostModal);
    els.btnWritePost?.addEventListener("click", openPostModal);
    els.mobileToggle?.addEventListener("click", () => toggleSidebar(true));
    els.sidebarOverlay?.addEventListener("click", () => toggleSidebar(false));
    els.postModalClose?.addEventListener("click", closePostModal);
    els.commentModalClose?.addEventListener("click", closeCommentModal);
    els.detailModalClose?.addEventListener("click", closeDetailModal);
    els.postModal?.addEventListener("click", (e) => {
      if (e.target === els.postModal) closePostModal();
    });
    els.commentModal?.addEventListener("click", (e) => {
      if (e.target === els.commentModal) closeCommentModal();
    });
    els.detailModal?.addEventListener("click", (e) => {
      if (e.target === els.detailModal) closeDetailModal();
    });
    els.imageLightbox?.addEventListener("click", (e) => {
      if (e.target === els.imageLightbox) closeImageLightbox();
    });
    els.postForm?.addEventListener("submit", handlePostSubmit);
    els.commentForm?.addEventListener("submit", handleCommentSubmit);
    els.postImageFile?.addEventListener("change", handlePostFilesSelected);
    els.postImageDropzone?.addEventListener("click", () => els.postImageFile?.click());
    els.postImageDropzone?.addEventListener("dragover", (e) => {
      e.preventDefault();
      els.postImageDropzone.classList.add("is-dragover");
    });
    els.postImageDropzone?.addEventListener("dragleave", () => {
      els.postImageDropzone.classList.remove("is-dragover");
    });
    els.postImageDropzone?.addEventListener("drop", async (e) => {
      e.preventDefault();
      els.postImageDropzone.classList.remove("is-dragover");
      const files = Array.from(e.dataTransfer?.files || []);
      await handlePostFiles(files);
    });
    els.postSummary?.addEventListener("click", rememberSummarySelection);
    els.postSummary?.addEventListener("keyup", rememberSummarySelection);
    els.postSummary?.addEventListener("select", rememberSummarySelection);
    els.insertImageTokenBtns?.forEach((btn) => {
      btn.addEventListener("click", insertImageToken);
    });
    els.detailLikeBtn?.addEventListener("click", async () => {
      if (!state.detailPost) return;
      await toggleLike(state.detailPost);
      await openPostDetail(state.detailPost.post_id, { refresh: true });
      await refreshCommunity();
    });
    els.detailCommentBtn?.addEventListener("click", () => {
      if (state.detailPost) openCommentModal(state.detailPost);
    });
    els.detailShareBtn?.addEventListener("click", async () => {
      if (state.detailPost) await sharePost(state.detailPost);
    });
    els.detailEditBtn?.addEventListener("click", () => {
      if (state.detailPost) openPostEditModal(state.detailPost);
    });
    els.detailDeleteBtn?.addEventListener("click", async () => {
      if (!state.detailPost) return;
      if (!confirm("이 게시글을 삭제할까요? 삭제 후에는 복구할 수 없습니다.")) return;
      await request(`${state.api.posts}?post_id=eq.${state.detailPost.post_id}&user_id=eq.${userId}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
      closeDetailModal();
      await refreshCommunity();
    });
    els.imageLightboxClose?.addEventListener("click", closeImageLightbox);
  }

  async function refreshCommunity() {
    await Promise.all([renderFeed(), renderTags(), renderRecommendedUsers(), renderFeaturedStory()]);
    if (state.detailPost) {
      await openPostDetail(state.detailPost.post_id, { refresh: true });
    }
  }

  async function request(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      cache: "no-store",
      headers: {
        apikey: state.supabaseAnonKey,
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.message || data?.msg || data?.error_description || "요청에 실패했습니다.");
    }
    return data;
  }

  async function renderFeed() {
    const rows = await request(`${state.api.feed}?select=*&order=created_at.desc`, { method: "GET" });
    state.posts = Array.isArray(rows) ? rows : [];

    if (!state.posts.length) {
      els.feed.innerHTML = '<div class="empty-feed">아직 게시글이 없습니다. 첫 게시글을 작성해보세요.</div>';
      return;
    }

    els.feed.innerHTML = state.posts
      .map((post) => {
        const isMine = String(post.user_id) === String(userId);
        const tags = splitTags(post.tags);
        return `
          <article class="feed-card feed-card--summary" data-post-id="${post.post_id}">
            <div class="feed-card-body">
              <div class="feed-card-meta">
                <span><strong>${escapeHtml(post.nickname || userNickname)}</strong> · ${formatRelative(post.updated_at || post.created_at)}</span>
                <span>${escapeHtml(post.location || post.category || "국내 여행")}</span>
              </div>
              <h3 class="feed-card-title">${escapeHtml(post.title || "")}</h3>
              <p class="feed-card-desc">${escapeHtml(truncateText(post.summary || "", 120))}</p>
              <div class="feed-card-tags">
                ${tags.map((tag) => `<span class="community-tag">#${escapeHtml(tag)}</span>`).join("")}
              </div>
              <div class="feed-card-actions">
                <button type="button" class="action-link" data-action="detail" data-post-id="${post.post_id}">상세보기</button>
                <button type="button" class="action-link" data-action="like" data-post-id="${post.post_id}">좋아요 ${post.like_count || 0}</button>
                <button type="button" class="action-link" data-action="comment" data-post-id="${post.post_id}">댓글 ${post.comment_count || 0}</button>
                ${isMine ? `<button type="button" class="action-link" data-action="edit" data-post-id="${post.post_id}">수정</button>` : ""}
                ${isMine ? `<button type="button" class="action-link danger" data-action="delete" data-post-id="${post.post_id}">삭제</button>` : ""}
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    els.feed.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", async (e) => {
        e.stopPropagation();
        const action = button.dataset.action;
        const postId = button.dataset.postId;
        const post = state.posts.find((row) => String(row.post_id) === String(postId));
        if (!post) return;

        if (action === "detail") await openPostDetail(post.post_id);
        if (action === "like") {
          await toggleLike(post);
          await refreshCommunity();
        }
        if (action === "comment") openCommentModal(post);
        if (action === "edit") openPostEditModal(post);
        if (action === "delete") {
          if (!confirm("이 게시글을 삭제할까요? 삭제 후에는 복구할 수 없습니다.")) return;
          await request(`${state.api.posts}?post_id=eq.${post.post_id}&user_id=eq.${userId}`, {
            method: "DELETE",
            headers: { Prefer: "return=minimal" },
          });
          await refreshCommunity();
        }
      });
    });

    els.feed.querySelectorAll(".feed-card").forEach((card) => {
      card.addEventListener("click", () => openPostDetail(card.dataset.postId));
    });
  }

  async function renderTags() {
    const rows = await request(`${state.api.tags}?select=*&order=post_count.desc&limit=8`, { method: "GET" });
    const tags = Array.isArray(rows) ? rows : [];
    els.popularTags.innerHTML = tags.length
      ? tags.map((tag) => `<span class="tag-pill">#${escapeHtml(tag.tag_name)} · ${tag.post_count ?? 0}</span>`).join("")
      : '<span class="tag-pill">#여행 · 0</span>';
  }

  async function renderRecommendedUsers() {
    const rows = await request(`${state.api.users}?select=user_id,nickname,profile_image&limit=3`, { method: "GET" });
    const users = Array.isArray(rows) ? rows : [];
    els.recommendedUsers.innerHTML = users.length
      ? users
          .map(
            (user) => `
          <div class="recommend-user">
            <img src="${escapeAttr(user.profile_image || defaultAvatar)}" alt="${escapeAttr(user.nickname || "추천 사용자")}">
            <div>
              <strong>${escapeHtml(user.nickname || "추천 사용자")}</strong>
              <p>국내 여행 이야기를 공유하는 사용자</p>
            </div>
          </div>
        `
          )
          .join("")
      : '<div class="empty-feed">추천 사용자가 없습니다.</div>';
  }

  async function renderFeaturedStory() {
    const rows = await request(`${state.api.feed}?select=*&order=like_count.desc&limit=1`, { method: "GET" });
    const post = Array.isArray(rows) ? rows[0] : null;
    if (!post) {
      els.featuredStory.innerHTML = '<div class="empty-feed">추천 여행 이야기가 없습니다.</div>';
      return;
    }
    els.featuredStory.innerHTML = `
      <div style="margin-top: 0.75rem;">
        <span class="story-title">${escapeHtml(post.title || "")}</span>
        <p class="story-desc">${escapeHtml(post.summary || "")}</p>
        <a href="#" class="story-link" data-featured-detail="${post.post_id}">상세 보기</a>
      </div>
    `;
    els.featuredStory.querySelector("[data-featured-detail]")?.addEventListener("click", (e) => {
      e.preventDefault();
      openPostDetail(post.post_id);
    });
  }

  async function openPostDetail(postId, options = {}) {
    if (!postId) return;
    const post =
      options.refresh || !state.detailPost || String(state.detailPost.post_id) !== String(postId)
        ? await fetchPostById(postId)
        : state.detailPost;
    if (!post) return;

    state.detailPost = post;
    if (els.detailTitle) els.detailTitle.textContent = post.title || "";
    if (els.detailAuthor) els.detailAuthor.textContent = post.nickname || userNickname;
    if (els.detailTime) els.detailTime.textContent = formatRelative(post.updated_at || post.created_at);
    if (els.detailSummary) els.detailSummary.innerHTML = renderBody(post.summary || "", getPostImages(post));
    if (els.detailTags) {
      const tags = splitTags(post.tags);
      els.detailTags.innerHTML = tags.map((tag) => `<span class="community-tag">#${escapeHtml(tag)}</span>`).join("");
    }
    renderDetailGallery(post);
    els.detailSummary?.querySelectorAll("[data-inline-image-src]").forEach((button) => {
      button.addEventListener("click", () => openImageLightbox(button.dataset.inlineImageSrc || ""));
    });
    const isMine = String(post.user_id) === String(userId);
    if (els.detailEditBtn) els.detailEditBtn.style.display = isMine ? "inline-flex" : "none";
    if (els.detailDeleteBtn) els.detailDeleteBtn.style.display = isMine ? "inline-flex" : "none";

    els.detailModal?.classList.add("active");
    await loadComments(post.post_id);
    renderComments(state.comments, els.detailCommentList);
  }

  function renderDetailGallery(post) {
    if (!els.detailGallery) return;
    const images = getPostImages(post);
    if (!images.length) {
      els.detailGallery.innerHTML = "";
      els.detailGallery.style.display = "none";
      return;
    }
    els.detailGallery.style.display = "grid";
    els.detailGallery.innerHTML = images
      .map(
        (src) => `
        <button type="button" class="detail-gallery-item" data-gallery-src="${escapeAttr(src)}">
          <img src="${escapeAttr(src)}" alt="게시글 첨부 사진">
        </button>
      `
      )
      .join("");
    els.detailGallery.querySelectorAll("[data-gallery-src]").forEach((button) => {
      button.addEventListener("click", () => {
        openImageLightbox(button.dataset.gallerySrc || "");
      });
    });
  }

  function closeDetailModal() {
    els.detailModal?.classList.remove("active");
    state.detailPost = null;
  }

  function openImageLightbox(src) {
    if (!src || !els.imageLightbox || !els.imageLightboxImg) return;
    els.imageLightboxImg.src = src;
    els.imageLightbox.classList.add("active");
    els.imageLightbox.setAttribute("aria-hidden", "false");
  }

  function closeImageLightbox() {
    if (!els.imageLightbox || !els.imageLightboxImg) return;
    els.imageLightbox.classList.remove("active");
    els.imageLightbox.setAttribute("aria-hidden", "true");
    els.imageLightboxImg.src = "";
  }

  async function fetchPostById(postId) {
    const rows = await request(`${state.api.feed}?post_id=eq.${encodeURIComponent(postId)}&select=*`, { method: "GET" });
    return Array.isArray(rows) ? rows[0] : null;
  }

  async function toggleLike(post) {
    const postId = String(post.post_id);
    if (state.likingPostIds.has(postId)) return;
    state.likingPostIds.add(postId);
    setLikeButtonsDisabled(postId, true);

    const existing = await request(
      `${state.api.likes}?post_id=eq.${encodeURIComponent(post.post_id)}&user_id=eq.${encodeURIComponent(userId)}&select=like_id`,
      { method: "GET" }
    );
    try {
      if (Array.isArray(existing) && existing.length > 0) {
        await request(`${state.api.likes}?post_id=eq.${encodeURIComponent(post.post_id)}&user_id=eq.${encodeURIComponent(userId)}`, {
          method: "DELETE",
          headers: { Prefer: "return=minimal" },
        });
        return;
      }
      await request(state.api.likes, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ post_id: post.post_id, user_id: userId }),
      });
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      state.likingPostIds.delete(postId);
      setLikeButtonsDisabled(postId, false);
    }
  }

  function setLikeButtonsDisabled(postId, disabled) {
    document.querySelectorAll(`[data-post-id="${CSS.escape(postId)}"][data-action="like"]`).forEach((button) => {
      button.disabled = disabled;
      button.classList.toggle("is-loading", disabled);
    });
    if (state.detailPost && String(state.detailPost.post_id) === String(postId) && els.detailLikeBtn) {
      els.detailLikeBtn.disabled = disabled;
      els.detailLikeBtn.classList.toggle("is-loading", disabled);
    }
  }

  async function sharePost(post) {
    const url = `${window.location.origin}${window.location.pathname}?post=${post.post_id}`;
    await request(state.api.shares, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ post_id: post.post_id, user_id: userId, shared_url: url }),
    });
    if (navigator.share) {
      await navigator.share({ title: post.title || "여행 게시글", text: post.summary || "", url });
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      alert("공유 링크를 복사했습니다.");
    }
  }

  function openPostModal() {
    state.editingPostId = null;
    state.postImages = [];
    state.existingPostImages = [];
    state.postSummarySelectionStart = 0;
    state.postSummarySelectionEnd = 0;
    els.postForm?.reset();
    renderPostImageGallery();
    setPostSubmitLabel("게시글 등록");
    bringModalToFront(els.postModal, 210);
    els.postModal?.classList.add("active");
  }

  function openPostEditModal(post) {
    if (!post) return;
    state.editingPostId = post.post_id;
    state.existingPostImages = getPostImages(post);
    state.postImages = [...state.existingPostImages];
    els.postType.value = post.type || "여행후기";
    els.postTitle.value = post.title || "";
    els.postSummary.value = post.summary || "";
    els.postTags.value = Array.isArray(post.tags) ? post.tags.join(", ") : String(post.tags || "");
    els.postLocation.value = post.location || "";
    els.postCategory.value = post.category || "";
    setPostSubmitLabel("게시글 수정");
    renderPostImageGallery();
    bringModalToFront(els.postModal, 210);
    els.postModal?.classList.add("active");
  }

  function closePostModal() {
    els.postModal?.classList.remove("active");
  }

  function clearPostImagePreview() {
    if (els.postImageFile) els.postImageFile.value = "";
    if (els.postImageGallery) els.postImageGallery.innerHTML = "";
    if (els.postImageOrderList) els.postImageOrderList.innerHTML = "";
    state.postImages = [];
    state.existingPostImages = [];
  }

  function renderPostImageGallery() {
    if (!els.postImageGallery) return;
    if (!state.postImages.length) {
      els.postImageGallery.innerHTML = '<div class="image-gallery-empty">업로드한 사진이 없습니다. 드래그 앤 드랍 또는 클릭으로 추가해보세요.</div>';
      renderPostImageOrderList();
      return;
    }
    els.postImageGallery.innerHTML = state.postImages
      .map(
        (src, index) => `
          <div class="image-gallery-item" draggable="true" data-drag-index="${index}">
            <img src="${escapeAttr(src)}" alt="업로드된 사진 ${index + 1}">
            <div class="image-gallery-actions">
              <button type="button" class="image-gallery-move" data-move-up="${index}">위</button>
              <button type="button" class="image-gallery-move" data-move-down="${index}">아래</button>
              <button type="button" class="image-gallery-remove" data-remove-index="${index}">삭제</button>
            </div>
          </div>
        `
      )
      .join("");
    els.postImageGallery.querySelectorAll("[data-remove-index]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.removeIndex);
        state.postImages.splice(index, 1);
        renderPostImageGallery();
      });
    });
    els.postImageGallery.querySelectorAll("[data-move-up]").forEach((button) => {
      button.addEventListener("click", () => movePostImage(Number(button.dataset.moveUp), -1));
    });
    els.postImageGallery.querySelectorAll("[data-move-down]").forEach((button) => {
      button.addEventListener("click", () => movePostImage(Number(button.dataset.moveDown), 1));
    });
    els.postImageGallery.querySelectorAll("[data-drag-index]").forEach((item) => {
      item.addEventListener("dragstart", () => {
        item.classList.add("is-dragging");
      });
      item.addEventListener("dragend", () => {
        item.classList.remove("is-dragging");
      });
      item.addEventListener("dragover", (e) => e.preventDefault());
      item.addEventListener("drop", (e) => {
        e.preventDefault();
        const fromIndex = Number(document.querySelector(".image-gallery-item.is-dragging")?.dataset.dragIndex);
        const toIndex = Number(item.dataset.dragIndex);
        if (Number.isNaN(fromIndex) || Number.isNaN(toIndex) || fromIndex === toIndex) return;
        const [dragged] = state.postImages.splice(fromIndex, 1);
        state.postImages.splice(toIndex, 0, dragged);
        renderPostImageGallery();
      });
    });
    renderPostImageOrderList();
  }

  async function handlePostFilesSelected() {
    const files = Array.from(els.postImageFile?.files || []);
    await handlePostFiles(files);
    if (els.postImageFile) els.postImageFile.value = "";
  }

  async function handlePostFiles(files) {
    if (!files.length) return;
    const validFiles = files.filter((file) => /^image\/(png|jpe?g|webp)$/i.test(file.type));
    if (!validFiles.length) {
      alert("PNG, JPG, JPEG, WEBP 파일만 업로드할 수 있습니다.");
      return;
    }

    for (const file of validFiles) {
      const uploadedUrl = await uploadPostImage(file);
      if (uploadedUrl) {
        state.postImages.push(uploadedUrl);
        continue;
      }

      const localDataUrl = await readAsDataURL(file);
      state.postImages.push(localDataUrl);
    }

    renderPostImageGallery();
  }

  function movePostImage(index, direction) {
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= state.postImages.length) return;
    const [item] = state.postImages.splice(index, 1);
    state.postImages.splice(nextIndex, 0, item);
    renderPostImageGallery();
  }

  function renderPostImageOrderList() {
    if (!els.postImageOrderList) return;
    if (!state.postImages.length) {
      els.postImageOrderList.innerHTML = "";
      return;
    }
    els.postImageOrderList.innerHTML = state.postImages
      .map(
        (src, index) => `
        <button type="button" class="image-order-chip" data-order-index="${index}">
          사진 ${index + 1}
        </button>
      `
      )
      .join("");
  }

  function rememberSummarySelection() {
    if (!els.postSummary) return;
    state.postSummarySelectionStart = els.postSummary.selectionStart || 0;
    state.postSummarySelectionEnd = els.postSummary.selectionEnd || 0;
  }

  function insertImageToken() {
    if (!els.postSummary) return;
    const token = "[이미지]";
    const value = els.postSummary.value || "";
    const start = state.postSummarySelectionStart ?? value.length;
    const end = state.postSummarySelectionEnd ?? value.length;
    els.postSummary.value = `${value.slice(0, start)}${token}${value.slice(end)}`;
    const nextPos = start + token.length;
    els.postSummary.focus();
    els.postSummary.setSelectionRange(nextPos, nextPos);
    rememberSummarySelection();
  }

  async function uploadPostImage(file) {
    const safeName = `${Date.now()}-${file.name}`.replace(/\s+/g, "-");
    const bucketPath = `community-posts/${safeName}`;
    const response = await fetch(`${state.api.storage}/${bucketPath}`, {
      method: "POST",
      headers: {
        apikey: state.supabaseAnonKey,
        Authorization: `Bearer ${authToken}`,
        "Content-Type": file.type,
        "x-upsert": "true",
      },
      body: file,
    });
    if (!response.ok) return "";
    return `${state.api.storagePublic}/${bucketPath}`;
  }

  function setPostSubmitLabel(text) {
    const btn = els.postForm?.querySelector('button[type="submit"]');
    if (btn) btn.textContent = text;
  }

  function openCommentModal(post) {
    state.activeCommentPostId = post.post_id;
    state.editingCommentId = null;
    els.commentPostId.value = post.post_id;
    els.commentPostTitle.textContent = post.title || "댓글";
    els.commentTextarea.value = "";
    bringModalToFront(els.commentModal, 210);
    els.commentModal?.classList.add("active");
    loadComments(post.post_id).catch(console.error);
  }

  function closeCommentModal() {
    els.commentModal?.classList.remove("active");
    state.activeCommentPostId = null;
    state.editingCommentId = null;
  }

  function bringModalToFront(modal, zIndex) {
    if (!modal) return;
    modal.style.zIndex = String(zIndex);
  }

  async function loadComments(postId) {
    const rows = await request(`${state.api.comments}?post_id=eq.${encodeURIComponent(postId)}&select=*&order=created_at.asc`, {
      method: "GET",
    });
    state.comments = Array.isArray(rows) ? rows : [];
    renderComments(state.comments, els.commentList);
    if (els.detailCommentList && els.detailModal?.classList.contains("active")) {
      renderComments(state.comments, els.detailCommentList);
    }
  }

  function renderComments(rows, targetList = els.commentList) {
    targetList.innerHTML = Array.isArray(rows) && rows.length
      ? rows
          .map((comment) => {
            const isMine = String(comment.user_id) === String(userId);
            const isEditing = String(state.editingCommentId) === String(comment.comment_id);
            const isEdited = comment.updated_at && comment.created_at && comment.updated_at !== comment.created_at;
            return `
              <article class="comment-item${isEditing ? " is-editing" : ""}" data-comment-id="${comment.comment_id}">
                <div class="comment-item-head">
                  <div class="comment-author-block">
                    <strong class="comment-author">${escapeHtml(comment.nickname || "사용자")}</strong>
                    ${isEdited ? '<span class="comment-edited-badge">수정됨</span>' : ""}
                  </div>
                  <span class="comment-timestamp">${formatRelative(comment.updated_at || comment.created_at)}</span>
                </div>
                <div class="comment-body">
                  ${
                    isEditing
                      ? `<textarea class="comment-inline-edit" data-inline-edit-input="${comment.comment_id}" rows="3">${escapeHtml(comment.content || "")}</textarea>`
                      : `<p class="comment-content">${escapeHtml(comment.content || "")}</p>`
                  }
                </div>
                ${
                  isMine
                    ? `
                  <div class="comment-item-actions">
                    ${
                      isEditing
                        ? `
                      <button type="button" class="action-link" data-comment-action="save" data-comment-id="${comment.comment_id}">저장</button>
                      <button type="button" class="action-link" data-comment-action="cancel" data-comment-id="${comment.comment_id}">취소</button>
                    `
                        : `
                      <button type="button" class="action-link" data-comment-action="edit" data-comment-id="${comment.comment_id}">수정</button>
                      <button type="button" class="action-link danger" data-comment-action="delete" data-comment-id="${comment.comment_id}">삭제</button>
                    `
                    }
                  </div>
                `
                    : ""
                }
              </article>
            `;
          })
          .join("")
      : '<div class="empty-feed">아직 댓글이 없습니다. 첫 댓글을 남겨보세요.</div>';

    targetList.querySelectorAll("[data-comment-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const action = button.dataset.commentAction;
        const commentId = button.dataset.commentId;
        const comment = state.comments.find((row) => String(row.comment_id) === String(commentId));
        if (!comment || String(comment.user_id) !== String(userId)) return;

        if (action === "edit") {
          state.editingCommentId = comment.comment_id;
          renderComments(state.comments, targetList);
          return;
        }
        if (action === "cancel") {
          state.editingCommentId = null;
          renderComments(state.comments, targetList);
          return;
        }
        if (action === "save") {
          const input = targetList.querySelector(`[data-inline-edit-input="${commentId}"]`);
          const nextContent = input?.value.trim() || "";
          if (!nextContent) {
            alert("댓글 내용을 입력해주세요.");
            return;
          }
          await request(`${state.api.comments}?comment_id=eq.${encodeURIComponent(commentId)}&user_id=eq.${encodeURIComponent(userId)}`, {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({ content: nextContent, updated_at: new Date().toISOString() }),
          });
          state.editingCommentId = null;
          await loadComments(state.activeCommentPostId);
          await refreshCommunity();
          return;
        }
        if (action === "delete") {
          if (!confirm("이 댓글을 삭제할까요? 삭제 후에는 복구할 수 없습니다.")) return;
          await request(`${state.api.comments}?comment_id=eq.${encodeURIComponent(commentId)}&user_id=eq.${encodeURIComponent(userId)}`, {
            method: "DELETE",
            headers: { Prefer: "return=minimal" },
          });
          await loadComments(state.activeCommentPostId);
          await refreshCommunity();
        }
      });
    });
  }

  async function handlePostSubmit(e) {
    e.preventDefault();
    const title = els.postTitle.value.trim();
    const summary = els.postSummary.value.trim();

    if (!title || !summary) {
      alert("제목과 후기는 필수입니다.");
      return;
    }

    const images = state.postImages.length ? [...state.postImages] : state.existingPostImages.length ? [...state.existingPostImages] : [];
    const payload = {
      user_id: userId,
      nickname: userNickname,
      title,
      summary,
      image_urls: JSON.stringify(images),
      tags: splitTags(els.postTags.value).join(","),
      location: els.postLocation.value.trim(),
      category: els.postCategory.value.trim(),
      type: els.postType.value || "여행후기",
      updated_at: new Date().toISOString(),
    };

    if (state.editingPostId) {
      await request(`${state.api.posts}?post_id=eq.${encodeURIComponent(state.editingPostId)}&user_id=eq.${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload),
      });
    } else {
      await request(state.api.posts, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ ...payload, like_count: 0, comment_count: 0 }),
      });
    }

    state.editingPostId = null;
    closePostModal();
    await refreshCommunity();
  }

  async function handleCommentSubmit(e) {
    e.preventDefault();
    const postId = state.activeCommentPostId || els.commentPostId.value;
    const content = els.commentTextarea.value.trim();
    if (!postId || !content) {
      alert("댓글 내용을 입력해주세요.");
      return;
    }

    if (state.editingCommentId) {
      const target = state.comments.find((r) => String(r.comment_id) === String(state.editingCommentId));
      if (target) {
        await request(`${state.api.comments}?comment_id=eq.${encodeURIComponent(target.comment_id)}&user_id=eq.${encodeURIComponent(userId)}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ content, updated_at: new Date().toISOString() }),
        });
        state.editingCommentId = null;
        els.commentTextarea.value = "";
        await loadComments(postId);
        await refreshCommunity();
        return;
      }
    }

    await request(state.api.comments, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        post_id: Number(postId),
        user_id: userId,
        nickname: userNickname,
        content,
      }),
    });
    els.commentTextarea.value = "";
    await loadComments(postId);
    await refreshCommunity();
  }

  function handleLogout() {
    sessionStorage.removeItem(AUTH_KEYS.access);
    sessionStorage.removeItem(AUTH_KEYS.refresh);
    sessionStorage.removeItem(AUTH_KEYS.user);
    window.location.replace("./login.html");
  }

  function toggleSidebar(active) {
    els.sidebar?.classList.toggle("active", active);
    els.sidebarOverlay?.classList.toggle("active", active);
  }

  function splitTags(text) {
    return String(text || "")
      .split(",")
      .map((tag) => tag.trim().replace(/^#/, ""))
      .filter(Boolean);
  }

  function getPostImages(post) {
    if (!post) return [];
    const raw = post.image_urls;
    if (Array.isArray(raw)) {
      return raw.filter(Boolean);
    }
    if (typeof raw === "string" && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch {
        return raw
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
      }
    }
    return [];
  }

  function renderBody(text, images = []) {
    const parts = String(text || "").split("[이미지]");
    const html = [];
    parts.forEach((part, index) => {
      if (part.trim()) {
        html.push(`<p>${escapeHtml(part).replace(/\n/g, "<br>")}</p>`);
      }
      if (index < images.length) {
        html.push(`
          <figure class="inline-image-block">
            <button type="button" class="inline-image-button" data-inline-image-src="${escapeAttr(images[index])}">
              <img src="${escapeAttr(images[index])}" alt="본문 이미지 ${index + 1}">
            </button>
          </figure>
        `);
      }
    });
    return html.join("");
  }

  function formatRelative(iso) {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.max(1, Math.floor(diff / 60000));
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
  }

  function truncateText(text, maxLength) {
    const value = String(text || "");
    return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
  }

  function safeJson(value) {
    try {
      return JSON.parse(value) || {};
    } catch {
      return {};
    }
  }

  function decodeJwt(token) {
    if (!token) return {};
    const payload = token.split(".")[1];
    if (!payload) return {};
    try {
      const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
      return JSON.parse(atob(padded)) || {};
    } catch {
      return {};
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replaceAll("`", "&#96;");
  }

  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("파일 읽기에 실패했습니다."));
      reader.readAsDataURL(file);
    });
  }
});
