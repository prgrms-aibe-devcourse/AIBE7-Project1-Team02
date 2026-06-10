document.addEventListener("DOMContentLoaded", () => {
  const AUTH_KEYS = {
    access: "sb_access_token",
    refresh: "sb_refresh_token",
    user: "sb_user",
  };
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
  const userProfileImage = currentUser?.user_metadata?.profile_image || "";

  function getAvatarUrl(profileImage, nickname) {
    if (profileImage) return profileImage;
    const name = nickname || "사용자";
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name.charAt(0))}&background=random&color=fff`;
  }

  const defaultAvatar = getAvatarUrl(userProfileImage, userNickname);

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
    replyingToCommentId: null,
    activeCommentPostId: null,
    postImages: [],
    existingPostImages: [],
    postSummarySelectionStart: 0,
    postSummarySelectionEnd: 0,
    likingPostIds: new Set(),
    likedPostIds: new Set(),
    feedPage: 0,
    feedLimit: 12,
    hasMoreFeed: true,
    isLoadingFeed: false,
    draftTags: [],
    currentGalleryIndex: 0,
    likedCommentIds: [],
    currentWizardStep: 1,
    currentTagFilter: null,
  };

  const els = {
    headerUserName: document.getElementById("header-user-name"),
    logoutBtn: document.getElementById("logout-btn"),
    feed: document.getElementById("community-feed"),
    popularTags: document.getElementById("popular-tags"),
    recommendedUsers: document.getElementById("recommended-users"),
    featuredStory: document.getElementById("featured-story"),
    widgetUserAvatar: document.getElementById("widget-user-avatar"),
    widgetUserName: document.getElementById("widget-user-name"),
    btnSidebarCreate: document.getElementById("btn-sidebar-create"),
    btnWritePost: document.getElementById("btn-write-post"),
    postFullscreenEditor: document.getElementById("post-fullscreen-editor"),
    postModalClose: document.getElementById("post-modal-close"),
    postForm: document.getElementById("post-form"),
    postTitle: document.getElementById("post-title"),
    postTitleCount: document.getElementById("post-title-count"),
    postSummary: document.getElementById("post-summary"),
    postSummaryCount: document.getElementById("post-summary-count"),
    postImageFile: document.getElementById("post-image-file"),
    postImageCount: document.getElementById("post-image-count"),
    postImageOrderList: document.getElementById("post-image-order-list"),
    postImageGallery: document.getElementById("post-image-gallery"),
    postImageDropzone: document.getElementById("post-image-dropzone"),
    btnAddPhoto: document.getElementById("btn-add-photo"),
    tagInputContainer: document.getElementById("tag-input-container"),
    tagChipList: document.getElementById("tag-chip-list"),
    postTags: document.getElementById("post-tags"),
    postLocation: document.getElementById("post-location"),
    btnFsPublish: document.getElementById("btn-fs-publish"),
    btnViewGrid: document.getElementById("btn-view-grid"),
    btnViewList: document.getElementById("btn-view-list"),
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
    galleryPrevBtn: document.getElementById("gallery-prev-btn"),
    galleryNextBtn: document.getElementById("gallery-next-btn"),
    galleryPagination: document.getElementById("gallery-pagination"),
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
    insertImageTokenBtns: document.querySelectorAll(
      "[data-insert-image-token]",
    ),
  };

  init().catch((error) => {
    console.error(error);
    alert(error.message || "커뮤니티를 불러오지 못했습니다.");
  });

  async function init() {
    if (els.headerUserName) els.headerUserName.textContent = userNickname;
    if (els.widgetUserName) els.widgetUserName.textContent = userNickname;
    if (els.widgetUserAvatar) {
      const cachedImg = currentUser?.user_metadata?.profile_image;
      els.widgetUserAvatar.src = cachedImg || defaultAvatar;
    }
    bindEvents();
    bindTagInputEvents();
    await loadConfig();
    const likesPromise = fetchUserLikes();
    setupInfiniteScroll();
    await refreshCommunity(likesPromise);
  }

  async function loadConfig() {
    const res = await fetch(resolveApiPath("/api/config"));
    const result = await res.json();
    if (!result.success)
      throw new Error(result.message || "설정 정보를 불러오지 못했습니다.");

    state.supabaseUrl = result.data.supabaseUrl;
    state.supabaseAnonKey = result.data.supabaseAnonKey;
    if (!state.supabaseUrl || !state.supabaseAnonKey) {
      throw new Error("Supabase 설정이 비어 있습니다. .env 파일을 확인하세요.");
    }
    state.storageBucket =
      result.data.supabaseStorageBucket || "community-images";
    state.api = {
      feed: `${state.supabaseUrl}/rest/v1/community_feed`,
      posts: `${state.supabaseUrl}/rest/v1/community_posts`,
      likes: `${state.supabaseUrl}/rest/v1/community_likes`,
      comments: `${state.supabaseUrl}/rest/v1/community_comments`,
      commentLikes: `${state.supabaseUrl}/rest/v1/community_comment_likes`,
      shares: `${state.supabaseUrl}/rest/v1/community_shares`,
      tags: `${state.supabaseUrl}/rest/v1/community_tags_popular`,
      users: `${state.supabaseUrl}/rest/v1/users`,
      storage: `${state.supabaseUrl}/storage/v1/object/${state.storageBucket}`,
      storagePublic: `${state.supabaseUrl}/storage/v1/object/public/${state.storageBucket}`,
    };
  }

  function bindEvents() {
    if (els.galleryPrevBtn) {
      els.galleryPrevBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (state.currentGalleryIndex > 0) {
          state.currentGalleryIndex--;
          updateGallerySlide();
        }
      });
    }
    if (els.galleryNextBtn) {
      els.galleryNextBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const total = els.detailGallery.children.length;
        if (state.currentGalleryIndex < total - 1) {
          state.currentGalleryIndex++;
          updateGallerySlide();
        }
      });
    }

    els.logoutBtn?.addEventListener("click", handleLogout);
    els.btnSidebarCreate?.addEventListener("click", openPostModal);
    els.btnWritePost?.addEventListener("click", openPostModal);
    els.mobileToggle?.addEventListener("click", () => toggleSidebar(true));
    els.sidebarOverlay?.addEventListener("click", () => toggleSidebar(false));
    els.postModalClose?.addEventListener("click", closePostModal);
    els.commentModalClose?.addEventListener("click", closeCommentModal);
    els.detailModalClose?.addEventListener("click", closeDetailModal);
    els.postFullscreenEditor?.addEventListener("click", (e) => {
      if (e.target === els.postFullscreenEditor) closePostModal();
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
    els.postTitle?.addEventListener("input", updateEditorStats);
    els.postSummary?.addEventListener("input", updateEditorStats);

    function updateToolbarState() {
      const blockFormat = document.queryCommandValue("formatBlock");
      const isHeading = blockFormat === "h2" || blockFormat === "H2";
      const isBold = document.queryCommandState("bold") && !isHeading;
      const isItalic = document.queryCommandState("italic");

      const btnBold = document.querySelector('.toolbar-btn[data-cmd="bold"]');
      if (btnBold) {
        btnBold.classList.toggle("active", isBold);
        btnBold.disabled = isHeading;
        btnBold.style.opacity = isHeading ? "0.4" : "1";
        btnBold.style.cursor = isHeading ? "not-allowed" : "pointer";
      }

      document
        .querySelector('.toolbar-btn[data-cmd="italic"]')
        ?.classList.toggle("active", isItalic);
      document
        .querySelector('.toolbar-btn[data-cmd="heading"]')
        ?.classList.toggle("active", isHeading);
    }

    els.postSummary?.addEventListener("keyup", updateToolbarState);
    els.postSummary?.addEventListener("mouseup", updateToolbarState);
    els.postSummary?.addEventListener("focus", updateToolbarState);

    document.querySelectorAll(".toolbar-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const cmd = btn.dataset.cmd;
        if (!cmd) return;

        if (document.activeElement !== els.postSummary) {
          els.postSummary?.focus();
        }

        switch (cmd) {
          case "heading":
            const currentBlock = document.queryCommandValue("formatBlock");
            if (currentBlock === "h2" || currentBlock === "H2") {
              document.execCommand("formatBlock", false, "P");
            } else {
              document.execCommand("formatBlock", false, "H2");
            }
            break;
          case "bold":
            document.execCommand("bold", false, null);
            break;
          case "italic":
            document.execCommand("italic", false, null);
            break;
        }
        updateEditorStats();
        updateToolbarState();
      });
    });
    els.commentForm?.addEventListener("submit", handleCommentSubmit);
    els.commentTextarea?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        els.commentForm?.requestSubmit();
      }
    });
    els.postImageFile?.addEventListener("change", handlePostFilesSelected);
    els.btnAddPhoto?.addEventListener("click", (e) => {
      e.stopPropagation();
      els.postImageFile?.click();
    });
    els.postImageDropzone?.addEventListener("click", () => {
      els.postImageFile?.click();
    });
    els.postImageDropzone?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        els.postImageFile?.click();
      }
    });
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

      // Optimistic UI update for modal button
      const isLikedBefore = isPostLiked(state.detailPost.post_id);
      const isLikedNow = !isLikedBefore;
      els.detailLikeBtn.classList.toggle("liked", isLikedNow);
      const iconHtml = isLikedNow
        ? `<i data-lucide="heart" style="fill: currentColor; color: #ef4444;"></i>`
        : `<i data-lucide="heart"></i>`;
      let count = getLikeCount(state.detailPost);
      if (isLikedNow && !isLikedBefore) count++;
      else if (!isLikedNow && isLikedBefore) count = Math.max(0, count - 1);

      els.detailLikeBtn.innerHTML = `${iconHtml} 좋아요 ${count > 0 ? count : ""}`;
      if (window.lucide) window.lucide.createIcons({ root: els.detailLikeBtn });

      // Sync background feed card immediately
      const feedBtn = document.querySelector(
        `[data-post-id="${CSS.escape(state.detailPost.post_id)}"][data-action="like"]`,
      );
      if (feedBtn) {
        const wrapper = feedBtn.closest(".travel-card-like") || feedBtn;
        if (isLikedNow) wrapper.classList.add("is-liked");
        else wrapper.classList.remove("is-liked");
      }

      await toggleLike(state.detailPost);

      // Update local state without full refresh
      state.detailPost.like_count = count;
      const postInFeed = state.posts.find(
        (p) => String(p.post_id) === String(state.detailPost.post_id),
      );
      if (postInFeed) postInFeed.like_count = count;
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
      if (!confirm("이 게시글을 삭제할까요? 삭제 후에는 복구할 수 없습니다."))
        return;
      await request(
        `${state.api.posts}?post_id=eq.${state.detailPost.post_id}&user_id=eq.${userId}`,
        {
          method: "DELETE",
          headers: { Prefer: "return=minimal" },
        },
      );
      closeDetailModal();
      await refreshCommunity();
    });
    els.imageLightboxClose?.addEventListener("click", closeImageLightbox);

    els.fsCategorySelect?.addEventListener("change", (e) => {
      if (els.postType) {
        els.postType.value = e.target.value;
      }
    });

    els.btnFsPublish?.addEventListener("click", () => {
      els.postForm?.requestSubmit();
    });
  }

  async function refreshCommunity(likesPromise = Promise.resolve()) {
    state.feedPage = 0;
    state.hasMoreFeed = true;
    state.posts = [];

    const skeletonHTML = Array(4)
      .fill(0)
      .map(
        () => `
      <article class="travel-card skeleton-card">
        <div class="travel-card-image-wrap skeleton"></div>
        <div class="travel-card-info">
          <div class="travel-card-title skeleton skeleton-text"></div>
        </div>
      </article>
    `,
      )
      .join("");
    els.feed.innerHTML = skeletonHTML;

    await Promise.all([loadFeedChunk(likesPromise), renderTags()]);
    if (state.detailPost) {
      await openPostDetail(state.detailPost.post_id, { refresh: true });
    }
  }

  function setupInfiniteScroll() {
    if (!els.feed) return;
    let sentinel = document.getElementById("feed-sentinel");
    if (!sentinel) {
      sentinel = document.createElement("div");
      sentinel.id = "feed-sentinel";
      sentinel.style.height = "20px";
      sentinel.style.width = "100%";
      els.feed.parentNode.insertBefore(sentinel, els.feed.nextSibling);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !state.isLoadingFeed &&
          state.hasMoreFeed
        ) {
          loadFeedChunk();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
  }

  async function loadFeedChunk(likesPromise = Promise.resolve()) {
    if (state.isLoadingFeed || !state.hasMoreFeed) return;
    state.isLoadingFeed = true;

    try {
      const from = state.feedPage * state.feedLimit;
      let url = `${state.api.feed}?select=*&order=created_at.desc&limit=${state.feedLimit}&offset=${from}`;
      if (state.currentTagFilter) {
        url += `&tags=ilike.*${encodeURIComponent(state.currentTagFilter)}*`;
      }
      const feedPromise = request(url, { method: "GET" });

      const [rows] = await Promise.all([feedPromise, likesPromise]);

      const newPosts = Array.isArray(rows) ? rows : [];
      if (newPosts.length < state.feedLimit) {
        state.hasMoreFeed = false;
      }

      if (newPosts.length > 0) {
        const userIds = [...new Set(newPosts.map((p) => p.user_id))].filter(
          Boolean,
        );
        if (userIds.length > 0) {
          try {
            const usersRes = await request(
              `${state.api.users}?user_id=in.(${userIds.join(",")})&select=user_id,profile_image,nickname`,
              { method: "GET" },
            );
            if (Array.isArray(usersRes)) {
              const userMap = {};
              usersRes.forEach((u) => (userMap[u.user_id] = u));
              newPosts.forEach((p) => {
                if (userMap[p.user_id]) {
                  p.profile_image = userMap[p.user_id].profile_image;
                  p.nickname = userMap[p.user_id].nickname || p.nickname;
                }
              });
            }
          } catch (e) {
            console.error("작성자 프로필 조회 실패:", e);
          }
        }
      }

      if (newPosts.length === 0 && state.feedPage === 0) {
        els.feed.innerHTML =
          '<div class="empty-feed">아직 게시글이 없습니다. 첫 게시글을 작성해보세요.</div>';
        return;
      }

      state.posts.push(...newPosts);

      const html = newPosts
        .map((post) => {
          const isMine = String(post.user_id) === String(userId);
          const tags = splitTags(post.tags);
          const images = getPostImages(post);
          let imageHtml = "";
          if (images.length === 0) {
            imageHtml = `<div class="empty-image-placeholder"><i data-lucide="image"></i></div>`;
          } else if (images.length === 1) {
            imageHtml = `<img src="${escapeAttr(images[0])}" alt="게시글 이미지" loading="lazy">`;
          } else {
            imageHtml = `
              <div class="card-slider">
                ${images.map((img) => `<img src="${escapeAttr(img)}" alt="게시글 이미지" loading="lazy">`).join("")}
              </div>
            `;
          }

          return `
            <article class="travel-card" data-post-id="${post.post_id}" data-action="detail">
              <div class="travel-card-image-wrap">
                ${imageHtml}
                <button class="travel-card-like${isPostLiked(post.post_id) ? " is-liked" : ""}" data-action="like" data-post-id="${post.post_id}">
                  <i data-lucide="heart"></i>
                </button>
              </div>
              <div class="travel-card-info">
                <div class="travel-card-title">${escapeHtml(post.title || "무제")}</div>
                <div class="travel-card-meta">
                  <img src="${escapeAttr(getAvatarUrl(post.profile_image, post.nickname || userNickname))}" alt="프로필" loading="lazy">
                  <span>${escapeHtml(post.nickname || userNickname)}</span>
                </div>
              </div>
            </article>
          `;
        })
        .join("");

      if (state.feedPage === 0) {
        els.feed.innerHTML = html;
      } else {
        els.feed.insertAdjacentHTML("beforeend", html);
      }

      bindCardEvents();

      if (window.lucide) {
        window.lucide.createIcons({ root: els.feed });
      }

      state.feedPage++;
    } finally {
      state.isLoadingFeed = false;
    }
  }

  function bindCardEvents() {
    els.feed.querySelectorAll("[data-action]").forEach((el) => {
      if (el.dataset.bound) return;
      el.dataset.bound = "true";
      el.addEventListener("click", async (e) => {
        e.stopPropagation();
        const action = el.dataset.action;
        const postId = el.dataset.postId;
        const post = state.posts.find(
          (row) => String(row.post_id) === String(postId),
        );
        if (!post) return;

        if (action === "detail")
          openPostDetail(post.post_id, { initialData: post });
        if (action === "like") {
          await toggleLike(post);
          const btn = el.closest(".travel-card-like") || el;
          if (isPostLiked(post.post_id)) {
            btn.classList.add("is-liked");
          } else {
            btn.classList.remove("is-liked");
          }
        }
      });
    });
  }

  function getTagIcon(tagName) {
    const text = String(tagName).toLowerCase();
    if (
      text.includes("부산") ||
      text.includes("바다") ||
      text.includes("해운대") ||
      text.includes("광안리")
    )
      return '<i data-lucide="palmtree"></i>';
    if (
      text.includes("일본") ||
      text.includes("도쿄") ||
      text.includes("교토") ||
      text.includes("오사카")
    )
      return '<i data-lucide="ticket"></i>';
    if (text.includes("제주")) return '<i data-lucide="sun"></i>';
    if (text.includes("산") || text.includes("등산"))
      return '<i data-lucide="mountain"></i>';
    if (text.includes("카페") || text.includes("커피"))
      return '<i data-lucide="coffee"></i>';
    if (text.includes("맛집") || text.includes("식당"))
      return '<i data-lucide="utensils"></i>';
    if (text.includes("호텔") || text.includes("숙소"))
      return '<i data-lucide="bed"></i>';
    if (text.includes("가족")) return '<i data-lucide="heart"></i>';
    if (text.includes("친구")) return '<i data-lucide="smile"></i>';
    if (text.includes("혼자")) return '<i data-lucide="backpack"></i>';
    return '<i data-lucide="hash"></i>';
  }

  async function renderTags() {
    const rows = await request(
      `${state.api.tags}?select=*&order=post_count.desc&limit=8`,
      { method: "GET" },
    );
    const tags = Array.isArray(rows) ? rows : [];

    let html = "";
    const isAllActive = state.currentTagFilter === null ? " active" : "";
    html += `<button class="keyword-chip${isAllActive}" data-tag="all"><i data-lucide="globe"></i> 전체</button>`;

    if (tags.length > 0) {
      html += tags
        .map((tag) => {
          const isActive =
            state.currentTagFilter === tag.tag_name ? " active" : "";
          return `<button class="keyword-chip${isActive}" data-tag="${escapeAttr(tag.tag_name)}">${getTagIcon(tag.tag_name)} ${escapeHtml(tag.tag_name)}</button>`;
        })
        .join("");
    }

    els.popularTags.innerHTML = html;

    if (window.lucide) {
      window.lucide.createIcons({ root: els.popularTags });
    }

    els.popularTags.querySelectorAll(".keyword-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tag = btn.dataset.tag;
        if (!tag) return;

        if (tag === "all") {
          state.currentTagFilter = null;
        } else {
          state.currentTagFilter = state.currentTagFilter === tag ? null : tag;
        }

        refreshCommunity();
      });
    });
  }

  async function fetchUserLikes() {
    if (!userId) {
      state.likedPostIds = new Set();
      return;
    }

    const rows = await request(
      `${state.api.likes}?user_id=eq.${encodeURIComponent(userId)}&select=post_id`,
      { method: "GET" },
    ).catch(() => []);
    const likedIds = Array.isArray(rows)
      ? rows.map((row) => String(row.post_id))
      : [];
    state.likedPostIds = new Set(likedIds);
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
      throw new Error(
        data?.message ||
          data?.msg ||
          data?.error_description ||
          "요청에 실패했습니다.",
      );
    }
    return data;
  }

  function isPostLiked(postId) {
    return state.likedPostIds.has(String(postId));
  }

  async function openPostDetail(postId, options = {}) {
    if (!postId) return;

    if (options.initialData) {
      state.detailPost = options.initialData;
      renderDetailContent(options.initialData);
      els.detailModal?.classList.add("active");
      if (window.lucide) {
        window.lucide.createIcons({ root: els.detailModal });
      }
      updateBodyScroll();

      fetchPostById(postId)
        .then((updatedPost) => {
          if (
            updatedPost &&
            state.detailPost &&
            String(state.detailPost.post_id) === String(postId)
          ) {
            state.detailPost = updatedPost;
            renderDetailContent(updatedPost);
            if (window.lucide) {
              window.lucide.createIcons({ root: els.detailModal });
            }
          }
        })
        .catch(console.error);
      return;
    }

    const post =
      options.refresh ||
      !state.detailPost ||
      String(state.detailPost.post_id) !== String(postId)
        ? await fetchPostById(postId)
        : state.detailPost;
    if (!post) return;

    state.detailPost = post;
    renderDetailContent(post);
    els.detailModal?.classList.add("active");
    if (window.lucide) {
      window.lucide.createIcons({ root: els.detailModal });
    }
    updateBodyScroll();
  }

  function renderDetailContent(post) {
    state.currentGalleryIndex = 0;
    if (els.detailTitle) els.detailTitle.textContent = post.title || "";
    const detailCategory = document.getElementById("detail-category");
    if (detailCategory)
      detailCategory.textContent = post.type || post.category || "게시글 상세";
    const authorName = post.nickname || userNickname;
    if (els.detailAuthor) els.detailAuthor.textContent = authorName;

    const detailAuthorAvatar = document.getElementById("detail-author-avatar");
    if (detailAuthorAvatar) {
      detailAuthorAvatar.src = getAvatarUrl(post.profile_image, authorName);
      detailAuthorAvatar.hidden = false;
    }

    if (els.detailTime)
      els.detailTime.textContent = formatRelative(
        post.updated_at || post.created_at,
      );
    if (els.detailSummary)
      els.detailSummary.innerHTML = renderBody(post.summary || "", []);
    if (els.detailTags) {
      const tags = splitTags(post.tags);
      els.detailTags.innerHTML = tags
        .map((tag) => `<span class="keyword-chip">#${escapeHtml(tag)}</span>`)
        .join("");
    }
    renderDetailGallery(post);
    els.detailSummary
      ?.querySelectorAll("[data-inline-image-src]")
      .forEach((button) => {
        button.addEventListener("click", () =>
          openImageLightbox(button.dataset.inlineImageSrc || ""),
        );
      });
    const isMine = String(post.user_id) === String(userId);
    if (els.detailEditBtn)
      els.detailEditBtn.style.display = isMine ? "inline-flex" : "none";
    if (els.detailDeleteBtn)
      els.detailDeleteBtn.style.display = isMine ? "inline-flex" : "none";

    if (els.detailLikeBtn) {
      const isLiked = isPostLiked(post.post_id);
      els.detailLikeBtn.classList.toggle("liked", isLiked);
      const iconHtml = isLiked
        ? `<i data-lucide="heart" style="fill: currentColor; color: #ef4444;"></i>`
        : `<i data-lucide="heart"></i>`;
      const count = getLikeCount(post);
      els.detailLikeBtn.innerHTML = `${iconHtml} 좋아요 ${count > 0 ? count : ""}`;
    }

    if (els.detailCommentBtn) {
      const count = getCommentCount(post);
      els.detailCommentBtn.innerHTML = `<i data-lucide="message-circle"></i> 댓글 ${count > 0 ? count : ""}`;
    }
  }

  function updateGallerySlide() {
    if (!els.detailGallery) return;
    const total = els.detailGallery.children.length;
    els.detailGallery.style.transform = `translateX(-${state.currentGalleryIndex * 100}%)`;

    if (els.galleryPrevBtn)
      els.galleryPrevBtn.hidden = state.currentGalleryIndex === 0;
    if (els.galleryNextBtn)
      els.galleryNextBtn.hidden = state.currentGalleryIndex === total - 1;

    if (els.galleryPagination) {
      Array.from(els.galleryPagination.children).forEach((dot, index) => {
        dot.classList.toggle("active", index === state.currentGalleryIndex);
      });
    }
  }

  function renderDetailGallery(post) {
    if (!els.detailGallery) return;
    const images = getPostImages(post);
    if (!images.length) {
      els.detailGallery.innerHTML = "";
      els.detailGallery.style.display = "none";
      if (els.galleryPrevBtn) els.galleryPrevBtn.hidden = true;
      if (els.galleryNextBtn) els.galleryNextBtn.hidden = true;
      if (els.galleryPagination) els.galleryPagination.innerHTML = "";
      return;
    }
    els.detailGallery.style.display = "flex";
    els.detailGallery.innerHTML = images
      .map(
        (src) => `
        <button type="button" class="detail-gallery-item" data-gallery-src="${escapeAttr(src)}">
          <div class="blur-bg" style="background-image: url('${escapeAttr(src)}')"></div>
          <img src="${escapeAttr(src)}" alt="게시글 첨부 사진" class="main-img">
        </button>
      `,
      )
      .join("");

    if (els.galleryPagination) {
      els.galleryPagination.innerHTML =
        images.length > 1
          ? images
              .map(
                (_, i) =>
                  `<button type="button" class="gallery-dot" data-index="${i}" aria-label="Go to slide ${i + 1}"></button>`,
              )
              .join("")
          : "";

      els.galleryPagination.querySelectorAll(".gallery-dot").forEach((dot) => {
        dot.addEventListener("click", (e) => {
          e.stopPropagation();
          state.currentGalleryIndex = parseInt(dot.dataset.index, 10);
          updateGallerySlide();
        });
      });
    }

    updateGallerySlide();

    els.detailGallery
      .querySelectorAll("[data-gallery-src]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          openImageLightbox(button.dataset.gallerySrc || "");
        });
      });
  }

  function closeDetailModal() {
    els.detailModal?.classList.remove("active");
    state.detailPost = null;
    updateBodyScroll();
  }

  function openImageLightbox(src) {
    if (!src || !els.imageLightbox || !els.imageLightboxImg) return;
    els.imageLightboxImg.src = src;
    els.imageLightbox.classList.add("active");
    els.imageLightbox.setAttribute("aria-hidden", "false");
    updateBodyScroll();
  }

  function closeImageLightbox() {
    if (!els.imageLightbox || !els.imageLightboxImg) return;
    els.imageLightbox.classList.remove("active");
    els.imageLightbox.setAttribute("aria-hidden", "true");
    els.imageLightboxImg.src = "";
    updateBodyScroll();
  }

  async function fetchPostById(postId) {
    const rows = await request(
      `${state.api.feed}?post_id=eq.${encodeURIComponent(postId)}&select=*`,
      { method: "GET" },
    );
    const post = Array.isArray(rows) ? rows[0] : null;
    if (post && post.user_id) {
      try {
        const usersRes = await request(
          `${state.api.users}?user_id=eq.${encodeURIComponent(post.user_id)}&select=profile_image,nickname`,
          { method: "GET" },
        );
        if (Array.isArray(usersRes) && usersRes[0]) {
          post.profile_image = usersRes[0].profile_image;
          post.nickname = usersRes[0].nickname || post.nickname;
        }
      } catch (e) {
        console.error("작성자 프로필 조회 실패:", e);
      }
    }
    return post;
  }

  async function toggleLike(post) {
    const postId = String(post.post_id);
    if (state.likingPostIds.has(postId)) return;
    state.likingPostIds.add(postId);
    setLikeButtonsDisabled(postId, true);

    const existing = await request(
      `${state.api.likes}?post_id=eq.${encodeURIComponent(post.post_id)}&user_id=eq.${encodeURIComponent(userId)}&select=like_id`,
      { method: "GET" },
    );
    try {
      if (Array.isArray(existing) && existing.length > 0) {
        await request(
          `${state.api.likes}?post_id=eq.${encodeURIComponent(post.post_id)}&user_id=eq.${encodeURIComponent(userId)}`,
          {
            method: "DELETE",
            headers: { Prefer: "return=minimal" },
          },
        );
        state.likedPostIds.delete(postId);
        return;
      }
      await request(state.api.likes, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ post_id: post.post_id, user_id: userId }),
      });
      state.likedPostIds.add(postId);
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      state.likingPostIds.delete(postId);
      setLikeButtonsDisabled(postId, false);
    }
  }

  function getLikeCount(post) {
    return Number(post?.real_like_count ?? post?.like_count ?? 0);
  }

  function getCommentCount(post) {
    return Number(post?.real_comment_count ?? post?.comment_count ?? 0);
  }

  function setLikeButtonsDisabled(postId, disabled) {
    document
      .querySelectorAll(
        `[data-post-id="${CSS.escape(postId)}"][data-action="like"]`,
      )
      .forEach((button) => {
        button.disabled = disabled;
        button.classList.toggle("is-loading", disabled);
      });
    if (
      state.detailPost &&
      String(state.detailPost.post_id) === String(postId) &&
      els.detailLikeBtn
    ) {
      els.detailLikeBtn.disabled = disabled;
      els.detailLikeBtn.classList.toggle("is-loading", disabled);
    }
  }

  async function sharePost(post) {
    const url = `${window.location.origin}${window.location.pathname}?post=${post.post_id}`;
    await request(state.api.shares, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        post_id: post.post_id,
        user_id: userId,
        shared_url: url,
      }),
    });
    if (navigator.share) {
      await navigator.share({
        title: post.title || "여행 게시글",
        text: post.summary || "",
        url,
      });
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
    state.draftTags = [];
    els.postForm?.reset();
    if (els.postSummary) els.postSummary.innerHTML = "";

    renderDraftTags();
    renderPostImageGallery();
    setPostSubmitLabel("작성하기");
    updateEditorStats();

    els.postFullscreenEditor?.classList.add("active");
    updateBodyScroll();
  }

  function openPostEditModal(post) {
    if (!post) return;
    state.editingPostId = post.post_id;
    state.existingPostImages = getPostImages(post);
    state.postImages = [...state.existingPostImages];

    els.postTitle.value = post.title || "";
    if (els.postSummary) els.postSummary.innerHTML = post.summary || "";

    state.draftTags = splitTags(post.tags);
    renderDraftTags();
    els.postTags.value = "";

    els.postLocation.value = post.location || "";
    setPostSubmitLabel("수정 완료");
    renderPostImageGallery();
    updateEditorStats();

    els.postFullscreenEditor?.classList.add("active");
    updateBodyScroll();
  }

  function closePostModal() {
    els.postFullscreenEditor?.classList.remove("active");
    updateBodyScroll();
  }

  function clearPostImagePreview() {
    if (els.postImageFile) els.postImageFile.value = "";
    if (els.postImageGallery) els.postImageGallery.innerHTML = "";
    if (els.postImageOrderList) els.postImageOrderList.innerHTML = "";
    state.postImages = [];
    state.existingPostImages = [];
  }

  function renderDraftTags() {
    if (!els.tagChipList) return;
    els.tagChipList.innerHTML = state.draftTags
      .map(
        (tag, index) => `
      <div class="tag-input-chip">
        #${escapeHtml(tag)}
        <button type="button" data-index="${index}" aria-label="태그 삭제">
          <i data-lucide="x"></i>
        </button>
      </div>
    `,
      )
      .join("");

    els.tagChipList.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.index);
        state.draftTags.splice(idx, 1);
        renderDraftTags();
      });
    });

    if (window.lucide) {
      window.lucide.createIcons({ root: els.tagChipList });
    }
  }

  function bindTagInputEvents() {
    if (!els.postTags || !els.tagChipList) return;

    els.postTags.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.code === "Space" || e.key === ",") {
        e.preventDefault();
        const tags = splitTags(els.postTags.value);
        let countExceeded = false;

        tags.forEach((t) => {
          if (t.length > 10) {
            alert(
              `태그는 최대 10자까지만 입력 가능합니다: '${t.slice(0, 10)}...'`,
            );
            return;
          }
          if (state.draftTags.length >= 5) {
            if (!countExceeded) {
              alert("태그는 최대 5개까지만 등록할 수 있습니다.");
              countExceeded = true;
            }
            return;
          }
          if (!state.draftTags.includes(t)) state.draftTags.push(t);
        });

        renderDraftTags();
        els.postTags.value = "";
      } else if (e.key === "Backspace" && els.postTags.value === "") {
        if (state.draftTags.length > 0) {
          state.draftTags.pop();
          renderDraftTags();
        }
      }
    });

    els.tagInputContainer?.addEventListener("click", () => {
      els.postTags.focus();
    });
  }

  function renderPostImageGallery() {
    if (!els.postImageGallery) return;
    if (!state.postImages.length) {
      els.postImageGallery.innerHTML = "";
      renderPostImageOrderList();
      updateEditorStats();
      return;
    }
    els.postImageGallery.innerHTML = state.postImages
      .map(
        (src, index) => `
          <div class="image-gallery-item" draggable="true" data-drag-index="${index}">
            <img src="${escapeAttr(src)}" alt="업로드된 사진 ${index + 1}">
            <button type="button" class="image-gallery-remove" data-remove-index="${index}" aria-label="삭제">
              <i data-lucide="x"></i>
            </button>
          </div>
        `,
      )
      .join("");
    els.postImageGallery
      .querySelectorAll("[data-remove-index]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const index = Number(button.dataset.removeIndex);
          state.postImages.splice(index, 1);
          renderPostImageGallery();
        });
      });
    if (window.lucide) {
      window.lucide.createIcons({ root: els.postImageGallery });
    }
    els.postImageGallery
      .querySelectorAll("[data-drag-index]")
      .forEach((item) => {
        item.addEventListener("dragstart", () => {
          item.classList.add("is-dragging");
        });
        item.addEventListener("dragend", () => {
          item.classList.remove("is-dragging");
        });
        item.addEventListener("dragover", (e) => e.preventDefault());
        item.addEventListener("drop", (e) => {
          e.preventDefault();
          const fromIndex = Number(
            document.querySelector(".image-gallery-item.is-dragging")?.dataset
              .dragIndex,
          );
          const toIndex = Number(item.dataset.dragIndex);
          if (
            Number.isNaN(fromIndex) ||
            Number.isNaN(toIndex) ||
            fromIndex === toIndex
          )
            return;
          const [dragged] = state.postImages.splice(fromIndex, 1);
          state.postImages.splice(toIndex, 0, dragged);
          renderPostImageGallery();
        });
      });
    renderPostImageOrderList();
    updateEditorStats();
  }

  async function handlePostFilesSelected() {
    const files = Array.from(els.postImageFile?.files || []);
    await handlePostFiles(files);
    if (els.postImageFile) els.postImageFile.value = "";
  }

  async function handlePostFiles(files) {
    if (!files.length) return;
    const validFiles = files.filter((file) =>
      /^image\/(png|jpe?g|webp)$/i.test(file.type),
    );
    if (!validFiles.length) {
      alert("PNG, JPG, JPEG, WEBP 파일만 업로드할 수 있습니다.");
      return;
    }

    const maxRemaining = 10 - state.postImages.length;
    const filesToUpload = validFiles.slice(0, maxRemaining);

    if (validFiles.length > maxRemaining) {
      alert(`사진은 최대 10장까지만 업로드할 수 있습니다. (초과된 파일 제외)`);
    }

    for (const file of filesToUpload) {
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
    if (index < 0 || nextIndex < 0 || nextIndex >= state.postImages.length)
      return;
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
      `,
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
    if (els.btnFsPublish) els.btnFsPublish.textContent = text;
  }

  function updateEditorStats() {
    if (els.postTitleCount) {
      const titleLength = (els.postTitle?.value || "").length;
      const titleMax = els.postTitle?.maxLength || 80;
      els.postTitleCount.textContent = `${titleLength}/${titleMax}`;
    }
    if (els.postSummaryCount) {
      const summaryLength = (els.postSummary?.innerText || "").replace(
        /\n/g,
        "",
      ).length;
      els.postSummaryCount.textContent = `${summaryLength.toLocaleString()}/2000자`;
    }
    if (els.postImageCount) {
      els.postImageCount.textContent = `${state.postImages.length}/10장`;
    }
  }

  function openCommentModal(post) {
    state.activeCommentPostId = post.post_id;
    state.editingCommentId = null;
    els.commentPostId.value = post.post_id;
    const commentSubtitle = document.getElementById("comment-post-subtitle");
    if (commentSubtitle)
      commentSubtitle.textContent = post.title || "게시글 상세";
    els.commentTextarea.value = "";
    const userAvatar = document.getElementById("comment-user-avatar");
    if (userAvatar)
      userAvatar.src = getAvatarUrl(userProfileImage, userNickname);
    bringModalToFront(els.commentModal, 210);
    els.commentModal?.classList.add("active");
    updateBodyScroll();
    loadComments(post.post_id).catch(console.error);
  }

  function closeCommentModal() {
    els.commentModal?.classList.remove("active");
    state.activeCommentPostId = null;
    state.editingCommentId = null;
    state.replyingToCommentId = null;
    updateBodyScroll();
  }

  function bringModalToFront(modal, zIndex) {
    if (!modal) return;
    modal.style.zIndex = String(zIndex);
  }

  function updateBodyScroll() {
    const hasActiveModal =
      document.querySelectorAll(".modal-overlay.active").length > 0;
    document.body.classList.toggle("modal-open", hasActiveModal);
  }

  async function loadComments(postId) {
    const rows = await request(
      `${state.api.comments}?post_id=eq.${encodeURIComponent(postId)}&select=*,likes:community_comment_likes(count)&order=created_at.asc`,
      {
        method: "GET",
      },
    );
    state.comments = Array.isArray(rows) ? rows : [];

    if (state.comments.length > 0) {
      const userIds = [...new Set(state.comments.map((c) => c.user_id))].filter(
        Boolean,
      );
      if (userIds.length > 0) {
        try {
          const usersRes = await request(
            `${state.api.users}?user_id=in.(${userIds.join(",")})&select=user_id,profile_image,nickname`,
            { method: "GET" },
          );
          if (Array.isArray(usersRes)) {
            const userMap = {};
            usersRes.forEach((u) => (userMap[u.user_id] = u));
            state.comments.forEach((c) => {
              if (userMap[c.user_id]) {
                c.profile_image = userMap[c.user_id].profile_image;
                c.nickname = userMap[c.user_id].nickname || c.nickname;
              }
            });
          }
        } catch (e) {
          console.error("댓글 작성자 프로필 조회 실패:", e);
        }
      }
    }

    if (userId) {
      try {
        const likes = await request(
          `${state.api.commentLikes}?user_id=eq.${encodeURIComponent(userId)}&select=comment_id`,
          { method: "GET" },
        );
        state.likedCommentIds = Array.isArray(likes)
          ? likes.map((l) => String(l.comment_id))
          : [];
      } catch (e) {
        console.error("댓글 좋아요 정보 불러오기 실패:", e);
      }
    }

    renderComments(state.comments, els.commentList);
  }

  function renderComments(rows, targetList = els.commentList) {
    if (!Array.isArray(rows) || !rows.length) {
      targetList.innerHTML =
        '<div class="empty-feed">아직 댓글이 없습니다. 첫 댓글을 남겨보세요.</div>';
      return;
    }

    const threads = [];
    rows.forEach((c) => {
      let displayContent = c.content || "";
      let targetParentId = null;
      let isReply = false;

      // Extract hidden reply metadata if exists
      const replyMatch = displayContent.match(/<!--reply:([^>]+)-->$/);
      if (replyMatch) {
        targetParentId = replyMatch[1];
        displayContent = displayContent.replace(replyMatch[0], "").trim();
      } else if (displayContent.startsWith("@")) {
        isReply = true;
      }

      // Try explicit target parent first
      if (targetParentId) {
        const parent = threads.find(
          (t) => String(t.comment_id) === String(targetParentId),
        );
        if (parent) {
          parent.replies.push({ ...c, content: displayContent });
          return;
        }
      }

      // Fallback for legacy comments or missing parent
      if (isReply && threads.length > 0) {
        threads[threads.length - 1].replies.push({
          ...c,
          content: displayContent,
        });
        return;
      }

      // Otherwise it's a main thread
      threads.push({ ...c, content: displayContent, replies: [] });
    });

    const generateCommentHtml = (
      comment,
      isReply = false,
      repliesHtml = "",
    ) => {
      const isMine = String(comment.user_id) === String(userId);
      const isEditing =
        String(state.editingCommentId) === String(comment.comment_id);
      const authorName = comment.nickname || "사용자";
      const avatarUrl = getAvatarUrl(comment.profile_image, authorName);
      const isLiked = state.likedCommentIds.includes(
        String(comment.comment_id),
      );
      const likeCount =
        comment.likes && comment.likes.length > 0 ? comment.likes[0].count : 0;

      return `
        <article class="comment-item${isEditing ? " is-editing" : ""}${isReply ? " is-reply" : ""}" data-comment-id="${comment.comment_id}">
          <div class="comment-avatar-col">
            <img src="${avatarUrl}" alt="프로필" loading="lazy">
          </div>
          <div class="comment-content-col">
            ${
              isEditing
                ? `<textarea class="comment-inline-edit" data-inline-edit-input="${comment.comment_id}" rows="3" style="width:100%; resize:none; padding:0.5rem; border:1px solid #ddd; border-radius:4px; font-family:inherit; margin-bottom:0.5rem;">${escapeHtml(comment.content || "")}</textarea>`
                : `
                <div class="comment-text-block">
                  <span class="comment-author-name">${escapeHtml(authorName)}</span>
                  <span class="comment-text-body">${escapeHtml(comment.content || "").replace(/\n/g, "<br>")}</span>
                </div>
              `
            }
            <div class="comment-actions-row">
              ${
                isEditing
                  ? `
                <button type="button" class="comment-opt-btn" data-comment-action="save" data-comment-id="${comment.comment_id}" style="width:auto; padding:0.3rem 0.6rem; border:1px solid #ddd; border-radius:99px; margin-right: 0.5rem;"><i data-lucide="check"></i> 저장</button>
                <button type="button" class="comment-opt-btn" data-comment-action="cancel" data-comment-id="${comment.comment_id}" style="width:auto; padding:0.3rem 0.6rem; border:1px solid #ddd; border-radius:99px;"><i data-lucide="x"></i> 취소</button>
                `
                  : `
                <span class="comment-time">${formatRelative(comment.updated_at || comment.created_at)}</span>
                <span class="comment-like-count" style="${likeCount > 0 ? "" : "display:none;"} font-weight: 600; font-size: 0.8rem; color: #666; cursor: pointer;">좋아요 ${likeCount}개</span>
                ${!isReply ? `<span class="comment-reply-text" data-comment-action="reply" data-comment-id="${comment.comment_id}">답글 달기</span>` : ""}
                `
              }
            </div>
            ${repliesHtml}
          </div>
          ${
            !isEditing
              ? `
          <div class="comment-right-col" style="display: flex; align-items: center; gap: 0.5rem;">
            <button type="button" class="comment-heart-btn${isLiked ? " liked" : ""}" aria-label="좋아요" data-comment-action="like" data-comment-id="${comment.comment_id}"><i data-lucide="heart"></i></button>
            ${
              isMine
                ? `
            <div class="comment-more-wrapper">
              <button type="button" class="comment-more-opts-btn" data-comment-action="toggle-opts" data-comment-id="${comment.comment_id}"><i data-lucide="more-horizontal"></i></button>
              <div class="comment-opts-dropdown" id="comment-opts-${comment.comment_id}" style="right: 0; left: auto; transform: translateX(0);">
                <button type="button" class="comment-opt-btn" data-comment-action="edit" data-comment-id="${comment.comment_id}"><i data-lucide="edit-2"></i> 수정</button>
                <button type="button" class="comment-opt-btn danger" data-comment-action="delete" data-comment-id="${comment.comment_id}"><i data-lucide="trash-2"></i> 삭제</button>
              </div>
            </div>
            `
                : ""
            }
          </div>
          `
              : ""
          }
        </article>
      `;
    };

    targetList.innerHTML = threads
      .map((thread) => {
        let repliesWrapperHtml = "";
        if (thread.replies.length > 0) {
          const repliesHtmlInner = thread.replies
            .map((r) => generateCommentHtml(r, true))
            .join("");
          repliesWrapperHtml = `
          <div class="comment-replies-wrapper">
            <button type="button" class="comment-replies-toggle" data-comment-action="toggle-replies" data-comment-id="${thread.comment_id}">
              <span class="line"></span> 답글 보기(${thread.replies.length}개)
            </button>
            <div class="comment-replies-list" style="display: none;">
              ${repliesHtmlInner}
            </div>
          </div>
        `;
        }
        return generateCommentHtml(thread, false, repliesWrapperHtml);
      })
      .join("");

    if (window.lucide) {
      window.lucide.createIcons({ root: targetList });
    }

    targetList.querySelectorAll(".comment-inline-edit").forEach((textarea) => {
      textarea.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          const commentId = textarea.dataset.inlineEditInput;
          const saveBtn = targetList.querySelector(
            `button[data-comment-action="save"][data-comment-id="${commentId}"]`,
          );
          if (saveBtn) saveBtn.click();
        }
      });
    });

    targetList.querySelectorAll("[data-comment-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const action = button.dataset.commentAction;
        const commentId = button.dataset.commentId;
        const comment = state.comments.find(
          (row) => String(row.comment_id) === String(commentId),
        );
        if (!comment) return;

        if (action === "reply") {
          state.replyingToCommentId = comment.comment_id;
          const input = document.getElementById("comment-text");
          if (input) {
            input.value = `@${comment.nickname || "사용자"} `;
            input.focus();
          }
          return;
        }

        if (action === "toggle-replies") {
          const wrapper = button.closest(".comment-replies-wrapper");
          const list = wrapper.querySelector(".comment-replies-list");
          const isHidden = list.style.display === "none";
          list.style.display = isHidden ? "block" : "none";
          const count = list.children.length;
          button.innerHTML = isHidden
            ? `<span class="line"></span> 답글 숨기기`
            : `<span class="line"></span> 답글 보기(${count}개)`;
          return;
        }

        if (action === "like") {
          button.classList.toggle("liked");
          const isLiked = button.classList.contains("liked");
          const cIdStr = String(commentId);

          const countSpan = button
            .closest(".comment-item")
            .querySelector(".comment-like-count");
          let currentCount = countSpan
            ? parseInt(countSpan.textContent.replace(/[^0-9]/g, "")) || 0
            : 0;

          if (isLiked) {
            currentCount++;
            if (!state.likedCommentIds.includes(cIdStr))
              state.likedCommentIds.push(cIdStr);
            request(state.api.commentLikes, {
              method: "POST",
              headers: { Prefer: "return=minimal" },
              body: JSON.stringify({ comment_id: commentId, user_id: userId }),
            }).catch((e) => console.error("댓글 좋아요 실패:", e));
          } else {
            currentCount--;
            state.likedCommentIds = state.likedCommentIds.filter(
              (id) => id !== cIdStr,
            );
            request(
              `${state.api.commentLikes}?comment_id=eq.${encodeURIComponent(commentId)}&user_id=eq.${encodeURIComponent(userId)}`,
              {
                method: "DELETE",
                headers: { Prefer: "return=minimal" },
              },
            ).catch((e) => console.error("댓글 좋아요 취소 실패:", e));
          }

          if (countSpan) {
            if (currentCount > 0) {
              countSpan.textContent = `좋아요 ${currentCount}개`;
              countSpan.style.display = "inline-block";
            } else {
              countSpan.textContent = `좋아요 0개`;
              countSpan.style.display = "none";
            }
          }
          return;
        }

        if (String(comment.user_id) !== String(userId)) return;

        if (action === "toggle-opts") {
          const dropdown = targetList.querySelector(
            `#comment-opts-${commentId}`,
          );
          if (dropdown) {
            dropdown.classList.toggle("active");
            targetList
              .querySelectorAll(".comment-opts-dropdown.active")
              .forEach((d) => {
                if (d !== dropdown) d.classList.remove("active");
              });
          }
          return;
        }

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
          const input = targetList.querySelector(
            `[data-inline-edit-input="${commentId}"]`,
          );
          const nextContent = input?.value.trim() || "";
          if (!nextContent) {
            alert("댓글 내용을 입력해주세요.");
            return;
          }
          await request(
            `${state.api.comments}?comment_id=eq.${encodeURIComponent(commentId)}&user_id=eq.${encodeURIComponent(userId)}`,
            {
              method: "PATCH",
              headers: { Prefer: "return=representation" },
              body: JSON.stringify({
                content: nextContent,
                updated_at: new Date().toISOString(),
              }),
            },
          );
          state.editingCommentId = null;
          await loadComments(state.activeCommentPostId);
          await refreshCommunity();
          return;
        }
        if (action === "delete") {
          if (!confirm("이 댓글을 삭제할까요? 삭제 후에는 복구할 수 없습니다."))
            return;
          await request(
            `${state.api.comments}?comment_id=eq.${encodeURIComponent(commentId)}&user_id=eq.${encodeURIComponent(userId)}`,
            {
              method: "DELETE",
              headers: { Prefer: "return=minimal" },
            },
          );
          await loadComments(state.activeCommentPostId);
          await refreshCommunity();
        }
      });
    });
  }

  async function handlePostSubmit(e) {
    e.preventDefault();
    const title = els.postTitle.value.trim();
    const summary = els.postSummary.innerHTML;
    const summaryText = els.postSummary.innerText.trim();

    if (!title || !summaryText) {
      alert("제목과 후기는 필수입니다.");
      return;
    }

    const images = state.postImages.length
      ? [...state.postImages]
      : state.existingPostImages.length
        ? [...state.existingPostImages]
        : [];

    if (images.length === 0) {
      alert("최소 한 장 이상의 사진을 업로드해주세요.");
      return;
    }
    const payload = {
      user_id: userId,
      nickname: userNickname,
      title,
      summary,
      image_urls: JSON.stringify(images),
      tags: (() => {
        const inputTags = splitTags(els.postTags.value);
        inputTags.forEach((t) => {
          if (!state.draftTags.includes(t)) state.draftTags.push(t);
        });
        return state.draftTags.join(",");
      })(),
      location: els.postLocation ? els.postLocation.value.trim() : "",
      category: "",
      type: "여행후기",
      updated_at: new Date().toISOString(),
    };

    if (state.editingPostId) {
      await request(
        `${state.api.posts}?post_id=eq.${encodeURIComponent(state.editingPostId)}&user_id=eq.${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(payload),
        },
      );
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
    let content = els.commentTextarea.value.trim();
    if (!postId || !content) {
      alert("댓글 내용을 입력해주세요.");
      return;
    }

    if (state.replyingToCommentId) {
      const parent = state.comments.find(
        (c) => String(c.comment_id) === String(state.replyingToCommentId),
      );
      const expectedPrefix = parent ? `@${parent.nickname || "사용자"}` : "";
      if (content.startsWith(expectedPrefix) || content.startsWith("@")) {
        content += `\n<!--reply:${state.replyingToCommentId}-->`;
      } else {
        state.replyingToCommentId = null;
      }
    }

    if (state.editingCommentId) {
      const target = state.comments.find(
        (r) => String(r.comment_id) === String(state.editingCommentId),
      );
      if (target) {
        await request(
          `${state.api.comments}?comment_id=eq.${encodeURIComponent(target.comment_id)}&user_id=eq.${encodeURIComponent(userId)}`,
          {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({
              content,
              updated_at: new Date().toISOString(),
            }),
          },
        );
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
    state.replyingToCommentId = null;
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
      reader.onerror = () =>
        reject(reader.error || new Error("파일 읽기에 실패했습니다."));
      reader.readAsDataURL(file);
    });
  }

  function resolveApiPath(path) {
    const normalized = String(path || "").replace(/^\/+/, "");
    const base = window.location.pathname.includes("/public/")
      ? `${window.location.origin}/`
      : `${window.location.origin}/`;
    return new URL(normalized, base).toString();
  }
});
