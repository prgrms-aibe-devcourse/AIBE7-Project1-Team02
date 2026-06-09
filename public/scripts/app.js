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
  const fallbackImageUrl = "./images/summer_banner.png";

  const greetingTitle = document.getElementById("greeting-title");
  const greetingDesc = document.getElementById("greeting-desc");
  const mbtiProfileSummary = document.getElementById("mbti-profile-summary");
  const recommendationTitle = document.getElementById("recommendation-title");
  const recommendationSubtitle = document.getElementById(
    "recommendation-subtitle",
  );
  const recommendationList = document.getElementById("recommendation-list");
  const recommendationLink = document.getElementById("recommendation-link");
  const featuredImage = document.getElementById(
    "featured-recommendation-image",
  );
  const featuredBadge = document.getElementById(
    "featured-recommendation-badge",
  );
  const featuredName = document.getElementById(
    "featured-recommendation-name",
  );
  const featuredRegion = document.querySelector(
    "#featured-recommendation-region span",
  );
  const featuredDescription = document.getElementById(
    "featured-recommendation-description",
  );
  const featuredAction = document.getElementById(
    "featured-recommendation-action",
  );

  if (greetingTitle) {
    greetingTitle.textContent = `안녕하세요, ${userName}님!`;
  }

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

    // --- 아바타 이미지 및 닉네임 최신화 (DB 조회) ---
    const userId = currentUser?.id;
    if (userId) {
      // 1. 화면 깜빡임(로딩 지연) 방지를 위해 세션 캐시 이미지로 즉시 적용
      const cachedImg = currentUser?.user_metadata?.profile_image;
      if (cachedImg) {
        const headerImg = document.getElementById("header-user-avatar");
        if (headerImg) headerImg.src = cachedImg;
      }

      // 2. 이후 백그라운드에서 DB 최신 데이터로 동기화
      fetch("/api/config").then(r => r.json()).then(result => {
        if (result.success) {
          const sUrl = result.data.supabaseUrl;
          const sKey = result.data.supabaseAnonKey;
          fetch(`${sUrl}/rest/v1/users?user_id=eq.${userId}&select=profile_image,nickname`, {
            headers: {
              "apikey": sKey,
              "Authorization": `Bearer ${authToken}`
            }
          })
          .then(r => r.json())
          .then(data => {
            const dbImg = data?.[0]?.profile_image;
            const dbNick = data?.[0]?.nickname;
            
            // 이미지 업데이트
            if (dbImg) {
              const headerImg = document.getElementById("header-user-avatar");
              if (headerImg) headerImg.src = dbImg;
              
              // sessionStorage 캐싱 업데이트
              currentUser.user_metadata = currentUser.user_metadata || {};
              currentUser.user_metadata.profile_image = dbImg;
            }
            
            // 닉네임 업데이트
            if (dbNick) {
              if (nameEl) nameEl.textContent = `${dbNick}님`;
              currentUser.user_metadata.nickname = dbNick;
            }

            if (dbImg || dbNick) {
              sessionStorage.setItem("sb_user", JSON.stringify(currentUser));
            }
          })
          .catch(err => console.error("프로필 헤더 로드 에러:", err));
        }
      });
    }
  };

  function getSafeImageUrl(imageUrl) {
    if (!imageUrl) {
      return fallbackImageUrl;
    }

    try {
      const parsedUrl = new URL(imageUrl, window.location.href);

      if (["http:", "https:"].includes(parsedUrl.protocol)) {
        return parsedUrl.href;
      }
    } catch {
      return fallbackImageUrl;
    }

    return fallbackImageUrl;
  }

  function getRegionText(destination) {
    return (
      destination.address ||
      [destination.province, destination.city].filter(Boolean).join(" ") ||
      "대한민국"
    );
  }

  function createRecommendationCard(destination, rank) {
    const card = document.createElement("article");
    card.className = "dest-mini-card recommendation-card";

    const image = document.createElement("img");
    image.src = getSafeImageUrl(destination.imageUrl);
    image.alt = destination.destinationName;
    image.loading = "lazy";
    image.addEventListener("error", () => {
      image.src = fallbackImageUrl;
    });

    const rankBadge = document.createElement("span");
    rankBadge.className = "recommendation-rank";
    rankBadge.textContent = `${rank}위`;

    const scoreBadge = document.createElement("span");
    scoreBadge.className = "recommendation-score";
    scoreBadge.textContent = `${destination.score.toFixed(1)}점`;

    const info = document.createElement("div");
    info.className = "dest-mini-info";

    const name = document.createElement("h4");
    name.textContent = destination.destinationName;

    const region = document.createElement("p");
    region.textContent = getRegionText(destination);

    const keywordList = document.createElement("div");
    keywordList.className = "recommendation-keywords";
    destination.keywords.slice(0, 2).forEach((keyword) => {
      const keywordBadge = document.createElement("span");
      keywordBadge.textContent = `#${keyword}`;
      keywordList.appendChild(keywordBadge);
    });

    info.append(name, region, keywordList);
    card.append(image, rankBadge, scoreBadge, info);
    return card;
  }

  function renderFeaturedRecommendation(destination, mbtiType) {
    const imageUrl = getSafeImageUrl(destination.imageUrl);

    featuredImage.style.backgroundImage = `url(${JSON.stringify(imageUrl)})`;
    featuredBadge.textContent = `${mbtiType} 추천 1위 · ${destination.score.toFixed(1)}점`;
    featuredName.textContent = destination.destinationName;
    featuredRegion.textContent = getRegionText(destination);
    featuredDescription.textContent =
      destination.description || "여행 MBTI 성향과 높은 적합도를 보인 국내 여행지입니다.";
    featuredAction.disabled = false;
    featuredAction.innerHTML =
      '이 여행지로 일정 만들기 <i data-lucide="arrow-right"></i>';
    featuredAction.addEventListener("click", () => {
      const tripCreateUrl = new URL("./pages/trip-create.html", window.location.href);
      tripCreateUrl.searchParams.set(
        "destinationId",
        String(destination.destinationId),
      );
      window.location.href = tripCreateUrl.href;
    });
  }

  function renderRecommendationState(message, actionText) {
    recommendationList.innerHTML = "";

    const state = document.createElement("div");
    state.className = "recommendation-state recommendation-state-empty";

    const messageElement = document.createElement("p");
    messageElement.textContent = message;
    state.appendChild(messageElement);

    if (actionText) {
      const action = document.createElement("a");
      action.className = "btn-primary recommendation-state-action";
      action.href = "./pages/survey.html";
      action.textContent = actionText;
      state.appendChild(action);
    }

    recommendationList.appendChild(state);
  }

  async function loadMbtiRecommendations() {
    try {
      const response = await fetch("/api/destinations/recommended?limit=6", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        sessionStorage.removeItem("sb_access_token");
        sessionStorage.removeItem("sb_refresh_token");
        window.location.replace("./pages/login.html");
        return;
      }

      if (response.status === 404 && result.data?.needsSurvey) {
        greetingDesc.textContent =
          "여행 성향 분석을 완료하면 나에게 맞는 여행지를 추천해 드립니다.";
        mbtiProfileSummary.innerHTML =
          '<strong style="color: var(--color-primary)">MBTI:</strong> 미검사';
        recommendationTitle.textContent = "여행 MBTI 분석이 필요합니다";
        recommendationSubtitle.textContent =
          "12개 질문에 답하고 나만의 국내 여행지를 추천받아 보세요.";
        recommendationLink.textContent = "성향 분석 시작";
        renderRecommendationState(
          "아직 저장된 여행 MBTI 결과가 없습니다.",
          "여행 성향 분석하기",
        );
        featuredBadge.textContent = "성향 분석 필요";
        featuredName.textContent = "나에게 맞는 여행지를 발견해 보세요";
        featuredRegion.textContent = "여행 MBTI 검사 후 추천 결과가 표시됩니다.";
        featuredDescription.textContent = "";
        featuredAction.disabled = false;
        featuredAction.textContent = "여행 성향 분석하기";
        featuredAction.addEventListener("click", () => {
          window.location.href = "./pages/survey.html";
        });
        return;
      }

      if (response.status === 404) {
        throw new Error(
          "추천 API를 찾을 수 없습니다. Express 서버를 다시 시작해 주세요.",
        );
      }

      if (!response.ok || !result.success) {
        throw new Error(result.message || "추천 조회 실패");
      }

      const { mbtiType, recommendations } = result.data;
      greetingDesc.textContent = `${mbtiType} 여행 성향에 잘 맞는 국내 여행지를 추천해 드려요.`;
      mbtiProfileSummary.innerHTML =
        `<strong style="color: var(--color-primary)">MBTI:</strong> ${mbtiType}`;
      recommendationTitle.textContent = `${mbtiType} 맞춤 여행지 TOP ${recommendations.length}`;
      recommendationSubtitle.textContent =
        "Supabase에 저장된 관광지별 MBTI 적합도 점수 순위입니다.";
      recommendationList.innerHTML = "";

      if (recommendations.length === 0) {
        renderRecommendationState(
          "해당 MBTI 유형의 관광지 점수가 아직 없습니다.",
          "성향 다시 분석하기",
        );
        return;
      }

      recommendations.forEach((destination, index) => {
        recommendationList.appendChild(
          createRecommendationCard(destination, index + 1),
        );
      });
      renderFeaturedRecommendation(recommendations[0], mbtiType);
      lucide.createIcons();
    } catch (error) {
      greetingDesc.textContent =
        "맞춤 여행지를 불러오는 중 문제가 발생했습니다.";
      recommendationTitle.textContent = "추천 결과를 불러오지 못했습니다";
      recommendationSubtitle.textContent = error.message;
      renderRecommendationState(error.message);
      featuredBadge.textContent = "추천 조회 실패";
      featuredName.textContent = "잠시 후 다시 시도해 주세요";
      featuredRegion.textContent = "Supabase 연결 상태를 확인해 주세요.";
      featuredDescription.textContent = "";
    }
  }
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
  loadMbtiRecommendations();

  // Initialize Lucide Icons
  lucide.createIcons();
});
