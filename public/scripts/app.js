document.addEventListener("DOMContentLoaded", () => {
  const authToken = sessionStorage.getItem("sb_access_token") || "";
  const userRaw = sessionStorage.getItem("sb_user") || "{}";
  const currentUser = (() => {
    try {
      return JSON.parse(userRaw) || {};
    } catch {
      return {};
    }
  })();

  if (!authToken) {
    window.location.replace("./pages/login.html");
    return;
  }

  const userName =
    currentUser?.user_metadata?.nickname ||
    currentUser?.user_metadata?.name ||
    currentUser?.email?.split('@')?.[0] ||
    '사용자';

  const ensureAuthBadge = () => {
    const actions = document.querySelector('.header-actions');
    if (!actions) return;

    let badge = document.getElementById('auth-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'auth-badge';
      badge.style.display = 'flex';
      badge.style.alignItems = 'center';
      badge.style.gap = '10px';
      badge.style.marginLeft = '12px';
      badge.style.fontWeight = '700';
      badge.style.color = 'var(--color-text-main)';
      badge.innerHTML = [
        '<span id="auth-user-name"></span>',
        '<button type="button" id="auth-logout-btn" class="btn-icon" title="로그아웃">',
        '  <i data-lucide="log-out"></i>',
        '</button>',
      ].join('\n');
    }

    const notificationBtn = document.getElementById('notification-btn');
    if (badge.parentElement !== actions) {
      if (notificationBtn && notificationBtn.parentElement === actions) {
        actions.insertBefore(badge, notificationBtn);
      } else {
        actions.appendChild(badge);
      }
    }

    const nameEl = document.getElementById('auth-user-name');
    if (nameEl) nameEl.textContent = `${userName}님`;

    const logoutBtn = document.getElementById('auth-logout-btn');
    if (logoutBtn && !logoutBtn.dataset.bound) {
      logoutBtn.dataset.bound = '1';
      logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('sb_access_token');
        sessionStorage.removeItem('sb_refresh_token');
        sessionStorage.removeItem('sb_user');
        window.location.replace('./pages/login.html');
      });
    }

    const avatarLink = document.querySelector('.user-avatar-wrapper');
    if (avatarLink) {
      avatarLink.setAttribute('aria-label', `${userName} 프로필`);
      avatarLink.setAttribute('title', `${userName} 프로필`);
      avatarLink.setAttribute('href', './pages/mypage.html');
    }
  };
  // Keywords Data for Flow B
  const keywords = [
    "#오션뷰",
    "#로컬맛집",
    "#미술관투어",
    "#역사유적",
    "#산악트레킹",
    "#나이트라이프",
    "#웰니스휴양",
    "#나만의숨은명소",
    "#럭셔리스테이",
    "#배낭여행",
    "#인생샷",
    "#로컬축제",
  ];

  const keywordContainer = document.getElementById("keyword-container");
  const tooltip = document.getElementById("max-selection-tooltip");
  const generateBtn = document.getElementById("btn-generate-itinerary");
  const previewResults = document.getElementById("preview-results");
  const emptyState = document.getElementById("preview-empty");
  const counterText = document.getElementById("counter-text");
  const dots = [
    document.getElementById("dot-1"),
    document.getElementById("dot-2"),
    document.getElementById("dot-3"),
  ];

  let selectedKeywords = new Set();
  let tooltipTimeout;

  // Initialize Keywords
  if (keywordContainer) {
    keywords.forEach((kw) => {
      const btn = document.createElement("button");
      btn.className = "keyword-chip";
      btn.textContent = kw;
      btn.dataset.keyword = kw;

      btn.addEventListener("click", () => handleKeywordClick(btn, kw));
      keywordContainer.appendChild(btn);
    });
  }

  // Handle Keyword Selection
  function handleKeywordClick(btn, kw) {
    if (selectedKeywords.has(kw)) {
      // Deselect
      selectedKeywords.delete(kw);
      btn.classList.remove("active");
    } else {
      // Select
      if (selectedKeywords.size >= 3) {
        showTooltip();
        return;
      }
      selectedKeywords.add(kw);
      btn.classList.add("active");
    }

    updateGenerateButton();
    updateCounter();
  }

  // Update Selection Counter
  function updateCounter() {
    const count = selectedKeywords.size;

    // Update dots
    dots.forEach((dot, index) => {
      if (dot) {
        if (index < count) {
          dot.classList.add("active");
        } else {
          dot.classList.remove("active");
        }
      }
    });

    // Update text
    if (counterText) {
      counterText.textContent = `${count} / 3개 선택됨`;
      if (count === 3) {
        counterText.style.color = "var(--color-primary)";
        counterText.style.fontWeight = "600";
      } else {
        counterText.style.color = "var(--color-text-muted)";
        counterText.style.fontWeight = "500";
      }
    }
  }

  // Show Tooltip
  function showTooltip() {
    if (tooltip) {
      tooltip.classList.add("show");

      if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
      }

      tooltipTimeout = setTimeout(() => {
        tooltip.classList.remove("show");
      }, 2500);
    }
  }

  // Update Button State
  function updateGenerateButton() {
    if (generateBtn) {
      if (selectedKeywords.size > 0) {
        generateBtn.removeAttribute("disabled");
        generateBtn.classList.remove("disabled");
      } else {
        generateBtn.setAttribute("disabled", "true");
        generateBtn.classList.add("disabled");
      }
    }
  }

  // Generate Results with enhanced cards
  if (generateBtn) {
    generateBtn.addEventListener("click", () => {
      if (selectedKeywords.size === 0) return;

      // Clear previous results
      previewResults.innerHTML = "";

      const selectedArr = Array.from(selectedKeywords);

      // Mock data with local images and scores
      const mockDestinations = [
        {
          title: "제주 애월 바다",
          desc: "탁 트인 에메랄드빛 바다와 트렌디한 카페들이 모여있는 곳.",
          img: "./images/jeju_night.png",
          score: 94,
        },
        {
          title: "부산 광안대교 야경",
          desc: "밤이 되면 더욱 화려해지는 바다와 로맨틱한 분위기.",
          img: "./images/gwangalli.png",
          score: 88,
        },
        {
          title: "서울 북촌 한옥마을",
          desc: "현대적인 도심 속에서 느끼는 고즈넉한 전통의 매력.",
          img: "./images/bukchon.png",
          score: 82,
        },
      ];

      // Display results
      selectedArr.forEach((kw, index) => {
        if (mockDestinations[index]) {
          const dest = mockDestinations[index];
          const card = document.createElement("div");
          card.className = "result-card";
          card.style.animationDelay = `${index * 0.1}s`;
          card.innerHTML = `
                        <img src="${dest.img}" alt="${dest.title}" class="result-card-img">
                        <div class="result-card-body">
                            <h3>${dest.title}</h3>
                            <p>${dest.desc}</p>
                            <span class="result-card-tag">${kw} 추천</span>
                            <span class="result-card-score">⭐ ${dest.score}점</span>
                        </div>
                    `;
          previewResults.appendChild(card);
        }
      });

      // Scroll to results
      previewResults.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  // Sidebar nav active state
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      if (item.getAttribute("href") === "#" || !item.getAttribute("href")) {
        e.preventDefault();
      }
      navItems.forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");
    });
  });

  // Modal Toggle for Flow B
  const btnSidebarCreate = document.getElementById("btn-sidebar-create");
  const btnQuickCreate = document.getElementById("btn-quick-create");
  const flowBModal = document.getElementById("flow-b-modal");
  const modalCloseBtn = document.getElementById("modal-close-btn");

  const openModal = () => {
    if (flowBModal) flowBModal.classList.add("active");
  };

  const closeModal = () => {
    if (flowBModal) flowBModal.classList.remove("active");
  };

  if (btnSidebarCreate) btnSidebarCreate.addEventListener("click", openModal);
  if (btnQuickCreate) btnQuickCreate.addEventListener("click", openModal);
  if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);

  // Close modal on overlay click
  if (flowBModal) {
    flowBModal.addEventListener("click", (e) => {
      if (e.target === flowBModal) closeModal();
    });
  }

  // Mobile Sidebar Toggle
  const mobileToggle = document.getElementById("mobile-toggle");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebar-overlay");

  if (mobileToggle && sidebar && sidebarOverlay) {
    mobileToggle.addEventListener("click", () => {
      sidebar.classList.add("active");
      sidebarOverlay.classList.add("active");
    });

    sidebarOverlay.addEventListener("click", () => {
      sidebar.classList.remove("active");
      sidebarOverlay.classList.remove("active");
    });
  }

  ensureAuthBadge();

  // Initialize Lucide Icons
  lucide.createIcons();
});
