// Community feed page behavior.
document.addEventListener('DOMContentLoaded', () => {
  const SUPABASE_URL = 'https://etomsinirscywqvyyjiv.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0b21zaW5pcnNjeXdxdnl5aml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NDQ4NDcsImV4cCI6MjA5NjIyMDg0N30.GnbWzZZQaL2XdPkEavBsbzjx5DEZeAvosMGFVBEEYnA';
  const AUTH_KEYS = { access: 'sb_access_token', refresh: 'sb_refresh_token', user: 'sb_user' };
  const API = {
    feed: `${SUPABASE_URL}/rest/v1/community_feed`,
    posts: `${SUPABASE_URL}/rest/v1/community_posts`,
    likes: `${SUPABASE_URL}/rest/v1/community_likes`,
    comments: `${SUPABASE_URL}/rest/v1/community_comments`,
    shares: `${SUPABASE_URL}/rest/v1/community_shares`,
    tags: `${SUPABASE_URL}/rest/v1/community_tags_popular`,
    users: `${SUPABASE_URL}/rest/v1/users`,
  };

  const authToken = sessionStorage.getItem(AUTH_KEYS.access) || '';
  if (!authToken) {
    window.location.replace('/public/pages/login.html');
    return;
  }

  const currentUser = safeJson(sessionStorage.getItem(AUTH_KEYS.user) || '{}');
  const userId = currentUser?.id || decodeJwt(authToken)?.sub || '';
  const userNickname = currentUser?.user_metadata?.nickname || currentUser?.email?.split('@')?.[0] || '사용자';
  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(userNickname)}&background=1a5c3a&color=fff&size=160`;

  const state = {
    activeCommunityPostId: null,
    editingPostId: null,
    editingCommentId: null,
    comments: [],
  };

  const els = {
    headerUserName: document.getElementById('header-user-name'),
    logoutBtn: document.getElementById('logout-btn'),
    feed: document.getElementById('community-feed'),
    popularTags: document.getElementById('popular-tags'),
    recommendedUsers: document.getElementById('recommended-users'),
    featuredStory: document.getElementById('featured-story'),
    btnSidebarCreate: document.getElementById('btn-sidebar-create'),
    btnWritePost: document.getElementById('btn-write-post'),
    postModal: document.getElementById('post-modal'),
    postModalClose: document.getElementById('post-modal-close'),
    postForm: document.getElementById('post-form'),
    postType: document.getElementById('post-type'),
    postTitle: document.getElementById('post-title'),
    postSummary: document.getElementById('post-summary'),
    postImageUrl: document.getElementById('post-image-url'),
    postTags: document.getElementById('post-tags'),
    postLocation: document.getElementById('post-location'),
    postCategory: document.getElementById('post-category'),
    commentModal: document.getElementById('comment-modal'),
    commentModalClose: document.getElementById('comment-modal-close'),
    commentList: document.getElementById('comment-list'),
    commentForm: document.getElementById('comment-form'),
    commentTextarea: document.getElementById('comment-text'),
    commentPostId: document.getElementById('comment-post-id'),
    commentPostTitle: document.getElementById('comment-post-title'),
    mobileToggle: document.getElementById('mobile-toggle'),
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
  };

  if (els.headerUserName) els.headerUserName.textContent = `${userNickname}님`;

  bindEvents();
  loadCommunityPage().catch(console.error);
  lucide.createIcons();

  function safeJson(value) {
    try { return JSON.parse(value) || {}; } catch { return {}; }
  }

  function decodeJwt(token) {
    if (!token) return {};
    const payload = token.split('.')[1];
    if (!payload) return {};
    try {
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
      return JSON.parse(atob(padded)) || {};
    } catch {
      return {};
    }
  }

  async function request(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      cache: 'no-store',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || data?.msg || data?.error_description || '요청 실패');
    return data;
  }

  function bindEvents() {
    els.logoutBtn?.addEventListener('click', () => {
      sessionStorage.removeItem(AUTH_KEYS.access);
      sessionStorage.removeItem(AUTH_KEYS.refresh);
      sessionStorage.removeItem(AUTH_KEYS.user);
      window.location.replace('/public/pages/login.html');
    });

    els.btnSidebarCreate?.addEventListener('click', openPostModal);
    els.btnWritePost?.addEventListener('click', openPostModal);

    els.mobileToggle?.addEventListener('click', () => {
      els.sidebar?.classList.add('active');
      els.sidebarOverlay?.classList.add('active');
    });
    els.sidebarOverlay?.addEventListener('click', () => {
      els.sidebar?.classList.remove('active');
      els.sidebarOverlay?.classList.remove('active');
    });

    els.postModalClose?.addEventListener('click', closePostModal);
    els.commentModalClose?.addEventListener('click', closeCommentModal);
    els.postModal?.addEventListener('click', (e) => { if (e.target === els.postModal) closePostModal(); });
    els.commentModal?.addEventListener('click', (e) => { if (e.target === els.commentModal) closeCommentModal(); });

    els.postForm?.addEventListener('submit', handlePostSubmit);
    els.commentForm?.addEventListener('submit', handleCommentSubmit);
  }

  async function loadCommunityPage() {
    await Promise.all([renderFeed(), renderTags(), renderRecommendedUsers(), renderFeaturedStory()]);
  }

  async function renderFeed() {
    const rows = await request(`${API.feed}?select=*&order=created_at.desc`, { method: 'GET' });
    els.feed.innerHTML = (Array.isArray(rows) ? rows : []).map((post) => {
      const tags = splitTags(post.tags);
      const isMine = String(post.user_id) === String(userId);
      return `
        <article class="feed-card" data-post-id="${post.post_id}">
          <img src="${escapeAttr(post.image_url || './images/jeju_night.png')}" alt="${escapeAttr(post.title || '게시물 이미지')}">
          <div class="feed-card-body">
            <div class="feed-card-meta">
              <span><strong>${escapeHtml(post.nickname || userNickname)}</strong> · ${formatRelative(post.updated_at || post.created_at)}</span>
              <span>${escapeHtml(post.location || post.category || '국내 여행')}</span>
            </div>
            <h3 class="feed-card-title">${escapeHtml(post.title || '')}</h3>
            <p class="feed-card-desc">${escapeHtml(post.summary || '')}</p>
            <div class="feed-card-tags">
              ${tags.map((tag) => `<span class="community-tag">#${escapeHtml(tag)}</span>`).join('')}
            </div>
            <div class="feed-card-actions">
              <button type="button" class="action-link" data-action="like" data-post-id="${post.post_id}">좋아요 ${post.like_count || 0}</button>
              <button type="button" class="action-link" data-action="comment" data-post-id="${post.post_id}">댓글 ${post.comment_count || 0}</button>
              <button type="button" class="action-link" data-action="share" data-post-id="${post.post_id}">공유</button>
              ${isMine ? `<button type="button" class="action-link" data-action="edit" data-post-id="${post.post_id}">수정</button>` : ''}
              ${isMine ? `<button type="button" class="action-link danger" data-action="delete" data-post-id="${post.post_id}">삭제</button>` : ''}
            </div>
          </div>
        </article>
      `;
    }).join('');

    els.feed.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', async () => {
        const action = button.dataset.action;
        const postId = button.dataset.postId;
        const post = (rows || []).find((row) => String(row.post_id) === String(postId));
        if (!post) return;

        if (action === 'like') await toggleLike(post);
        if (action === 'comment') openCommentModal(post);
        if (action === 'share') await sharePost(post);
        if (action === 'edit') openPostEditModal(post);
        if (action === 'delete') {
          if (!confirm('이 게시물을 삭제할까요? 삭제 후에는 복구할 수 없습니다.')) return;
          await request(`${API.posts}?post_id=eq.${encodeURIComponent(post.post_id)}&user_id=eq.${encodeURIComponent(userId)}`, {
            method: 'DELETE',
            headers: { Prefer: 'return=minimal' },
          });
        }
        await loadCommunityPage();
      });
    });
  }

  async function renderTags() {
    const rows = await request(`${API.tags}?select=*&order=post_count.desc&limit=8`, { method: 'GET' });
    const tags = Array.isArray(rows) && rows.length ? rows : [];
    els.popularTags.innerHTML = tags.map((tag) => `<span class="tag-pill">#${escapeHtml(tag.tag_name)} · ${tag.post_count ?? 0}</span>`).join('');
  }

  async function renderRecommendedUsers() {
    const rows = await request(`${API.users}?select=user_id,nickname,profile_image&limit=3`, { method: 'GET' });
    els.recommendedUsers.innerHTML = (Array.isArray(rows) ? rows : []).map((user) => `
      <div class="recommend-user">
        <img src="${escapeAttr(user.profile_image || defaultAvatar)}" alt="${escapeAttr(user.nickname || '추천 사용자')}">
        <div>
          <strong>${escapeHtml(user.nickname || '추천 사용자')}</strong>
          <p>국내 여행 정보를 공유하는 사용자</p>
        </div>
      </div>
    `).join('');
  }

  async function renderFeaturedStory() {
    const rows = await request(`${API.feed}?select=*&order=like_count.desc&limit=1`, { method: 'GET' });
    const post = Array.isArray(rows) ? rows[0] : null;
    if (!post) {
      els.featuredStory.innerHTML = '<div class="empty-feed">추천 이야기가 없습니다.</div>';
      return;
    }
    els.featuredStory.innerHTML = `
      <img class="story-thumb" src="${escapeAttr(post.image_url || './images/jeju_night.png')}" alt="추천 이야기">
      <div style="margin-top: 0.75rem;">
        <span class="story-title">${escapeHtml(post.title || '')}</span>
        <p class="story-desc">${escapeHtml(post.summary || '')}</p>
        <a href="#" class="story-link" data-featured-comment="${post.post_id}">상세 이야기 보기</a>
      </div>
    `;
    els.featuredStory.querySelector('[data-featured-comment]')?.addEventListener('click', (e) => {
      e.preventDefault();
      openCommentModal(post);
    });
  }

  async function toggleLike(post) {
    const existing = await request(`${API.likes}?post_id=eq.${encodeURIComponent(post.post_id)}&user_id=eq.${encodeURIComponent(userId)}&select=like_id`, { method: 'GET' });
    if (Array.isArray(existing) && existing.length > 0) {
      await request(`${API.likes}?post_id=eq.${encodeURIComponent(post.post_id)}&user_id=eq.${encodeURIComponent(userId)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      await request(`${API.posts}?post_id=eq.${encodeURIComponent(post.post_id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ like_count: Math.max(0, (post.like_count || 0) - 1), updated_at: new Date().toISOString() }),
      });
      return;
    }
    await request(API.likes, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ post_id: post.post_id, user_id: userId }),
    });
    await request(`${API.posts}?post_id=eq.${encodeURIComponent(post.post_id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ like_count: (post.like_count || 0) + 1, updated_at: new Date().toISOString() }),
    });
  }

  async function sharePost(post) {
    const url = `${window.location.origin}${window.location.pathname}?post=${post.post_id}`;
    await request(API.shares, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ post_id: post.post_id, user_id: userId, shared_url: url }),
    });
    if (navigator.share) {
      await navigator.share({ title: post.title || '여행 게시물', text: post.summary || '', url });
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      alert('공유 링크를 복사했습니다.');
    }
  }

  function openPostModal() {
    state.editingPostId = null;
    els.postForm?.reset();
    setPostSubmitLabel('게시물 등록');
    els.postModal?.classList.add('active');
  }

  function openPostEditModal(post) {
    if (!post) return;
    state.editingPostId = post.post_id;
    els.postType.value = post.type || '여행후기';
    els.postTitle.value = post.title || '';
    els.postSummary.value = post.summary || '';
    els.postImageUrl.value = post.image_url || '';
    els.postTags.value = Array.isArray(post.tags) ? post.tags.join(', ') : String(post.tags || '');
    els.postLocation.value = post.location || '';
    els.postCategory.value = post.category || '';
    setPostSubmitLabel('게시물 수정');
    els.postModal?.classList.add('active');
  }

  function closePostModal() {
    els.postModal?.classList.remove('active');
  }

  function setPostSubmitLabel(text) {
    const btn = els.postForm?.querySelector('button[type="submit"]');
    if (btn) btn.textContent = text;
  }

  function openCommentModal(post) {
    state.activeCommunityPostId = post.post_id;
    state.editingCommentId = null;
    els.commentPostId.value = post.post_id;
    els.commentPostTitle.textContent = post.title || '댓글';
    els.commentTextarea.value = '';
    els.commentModal?.classList.add('active');
    loadComments(post.post_id).catch(console.error);
  }

  function closeCommentModal() {
    els.commentModal?.classList.remove('active');
    state.activeCommunityPostId = null;
    state.editingCommentId = null;
  }

  async function loadComments(postId) {
    const rows = await request(`${API.comments}?post_id=eq.${encodeURIComponent(postId)}&select=*&order=created_at.asc`, { method: 'GET' });
    state.comments = Array.isArray(rows) ? rows : [];
    renderComments(state.comments);
  }

  function renderComments(rows) {
    els.commentList.innerHTML = Array.isArray(rows) && rows.length
      ? rows.map((comment) => {
          const isMine = String(comment.user_id) === String(userId);
          const isEditing = String(state.editingCommentId) === String(comment.comment_id);
          const isEdited = comment.updated_at && comment.created_at && comment.updated_at !== comment.created_at;
          return `
            <div class="comment-item" data-comment-id="${comment.comment_id}">
              <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
                <div style="min-width:0; flex:1;">
                  <strong>${escapeHtml(comment.nickname || '사용자')}</strong>
                  ${isEdited ? '<span class="comment-edited-badge">수정됨</span>' : ''}
                  ${isEditing ? `<textarea class="comment-inline-edit" data-inline-edit-input="${comment.comment_id}" rows="3">${escapeHtml(comment.content || '')}</textarea>` : `<p>${escapeHtml(comment.content || '')}</p>`}
                  <span>${formatRelative(comment.updated_at || comment.created_at)}</span>
                </div>
                ${isMine ? `
                  <div style="display:flex; gap:10px; flex-shrink:0; align-items:center;">
                    ${isEditing ? `
                      <button type="button" class="action-link" data-comment-action="save" data-comment-id="${comment.comment_id}">저장</button>
                      <button type="button" class="action-link" data-comment-action="cancel" data-comment-id="${comment.comment_id}">취소</button>
                    ` : `
                      <button type="button" class="action-link" data-comment-action="edit" data-comment-id="${comment.comment_id}">수정</button>
                      <button type="button" class="action-link danger" data-comment-action="delete" data-comment-id="${comment.comment_id}">삭제</button>
                    `}
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')
      : '<div class="empty-feed">아직 댓글이 없습니다. 첫 댓글을 남겨보세요.</div>';

    els.commentList.querySelectorAll('[data-comment-action]').forEach((button) => {
      button.addEventListener('click', async () => {
        const action = button.dataset.commentAction;
        const commentId = button.dataset.commentId;
        const comment = state.comments.find((row) => String(row.comment_id) === String(commentId));
        if (!comment || String(comment.user_id) !== String(userId)) return;

        if (action === 'edit') {
          state.editingCommentId = comment.comment_id;
          renderComments(state.comments);
          return;
        }
        if (action === 'cancel') {
          state.editingCommentId = null;
          renderComments(state.comments);
          return;
        }
        if (action === 'save') {
          const input = els.commentList.querySelector(`[data-inline-edit-input="${commentId}"]`);
          const nextContent = input?.value.trim() || '';
          if (!nextContent) {
            alert('댓글 내용을 입력해주세요.');
            return;
          }
          await request(`${API.comments}?comment_id=eq.${encodeURIComponent(commentId)}&user_id=eq.${encodeURIComponent(userId)}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify({ content: nextContent, updated_at: new Date().toISOString() }),
          });
          state.editingCommentId = null;
          await loadComments(state.activeCommunityPostId);
          await loadCommunityPage();
          return;
        }
        if (action === 'delete') {
          if (!confirm('이 댓글을 삭제할까요? 삭제 후에는 복구할 수 없습니다.')) return;
          await request(`${API.comments}?comment_id=eq.${encodeURIComponent(commentId)}&user_id=eq.${encodeURIComponent(userId)}`, {
            method: 'DELETE',
            headers: { Prefer: 'return=minimal' },
          });
          await loadComments(state.activeCommunityPostId);
          await loadCommunityPage();
        }
      });
    });
  }

  async function handlePostSubmit(e) {
    e.preventDefault();
    const title = els.postTitle.value.trim();
    const summary = els.postSummary.value.trim();
    if (!title || !summary) {
      alert('제목과 내용은 필수입니다.');
      return;
    }

    const payload = {
      user_id: userId,
      nickname: userNickname,
      title,
      summary,
      image_url: els.postImageUrl.value.trim() || './images/jeju_night.png',
      tags: splitTags(els.postTags.value).join(','),
      location: els.postLocation.value.trim(),
      category: els.postCategory.value.trim(),
      type: els.postType.value || '여행후기',
      updated_at: new Date().toISOString(),
    };

    if (state.editingPostId) {
      await request(`${API.posts}?post_id=eq.${encodeURIComponent(state.editingPostId)}&user_id=eq.${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      });
    } else {
      await request(API.posts, {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ ...payload, like_count: 0, comment_count: 0 }),
      });
    }

    state.editingPostId = null;
    closePostModal();
    await loadCommunityPage();
  }

  async function handleCommentSubmit(e) {
    e.preventDefault();
    const postId = state.activeCommunityPostId || els.commentPostId.value;
    const content = els.commentTextarea.value.trim();
    if (!postId || !content) {
      alert('댓글 내용을 입력해주세요.');
      return;
    }

    if (state.editingCommentId) {
      const target = state.comments.find((r) => String(r.comment_id) === String(state.editingCommentId));
      if (target) {
        await request(`${API.comments}?comment_id=eq.${encodeURIComponent(target.comment_id)}&user_id=eq.${encodeURIComponent(userId)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ content, updated_at: new Date().toISOString() }),
        });
        state.editingCommentId = null;
        els.commentTextarea.value = '';
        await loadComments(postId);
        await loadCommunityPage();
        return;
      }
    }

    await request(API.comments, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        post_id: Number(postId),
        user_id: userId,
        nickname: userNickname,
        content,
      }),
    });
    els.commentTextarea.value = '';
    await loadComments(postId);
    await loadCommunityPage();
  }

  function splitTags(text) {
    return String(text || '')
      .split(',')
      .map((tag) => tag.trim().replace(/^#/, ''))
      .filter(Boolean);
  }

  function formatRelative(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.max(1, Math.floor(diff / 60000));
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replaceAll('`', '&#96;');
  }
});
