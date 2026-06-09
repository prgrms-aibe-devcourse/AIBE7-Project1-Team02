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
    currentUser?.email?.split("@")?.[0] ||
    "사용자";
  const fallbackImageUrl = "./images/summer_banner.png";

  const recommendationTitle = document.getElementById("recommendation-title");
  const recommendationSubtitle = document.getElementById(
    "recommendation-subtitle",
  );
  const recommendationList = document.getElementById("recommendation-list");
  const recommendationLink = document.getElementById("recommendation-link");
  const recommendationPrev = document.getElementById("recommendation-prev");
  const recommendationNext = document.getElementById("recommendation-next");
  const recommendationDots = document.getElementById("recommendation-dots");
  const recommendationPosition = document.getElementById(
    "recommendation-position",
  );
  const destinationDetailModal = document.getElementById(
    "destination-detail-modal",
  );
  const destinationDetailClose = document.getElementById(
    "destination-detail-close",
  );
  const destinationDetailImage = document.getElementById(
    "destination-detail-image",
  );
  const destinationDetailRank = document.getElementById(
    "destination-detail-rank",
  );
  const destinationDetailScore = document.getElementById(
    "destination-detail-score",
  );
  const destinationDetailName = document.getElementById(
    "destination-detail-name",
  );
  const destinationDetailRegion = document.querySelector(
    "#destination-detail-region span",
  );
  const destinationDetailKeywords = document.getElementById(
    "destination-detail-keywords",
  );
  const destinationDetailDescription = document.getElementById(
    "destination-detail-description",
  );
  const destinationDetailReason = document.querySelector(
    "#destination-detail-reason p",
  );
  const destinationDetailAction = document.getElementById(
    "destination-detail-action",
  );
  let featuredRecommendations = [];
  let currentRecommendationIndex = 0;

  const ensureAuthBadge = () => {
    const actions = document.querySelector(".header-actions");
    if (!actions) return;

    let badge = document.getElementById("auth-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "auth-badge";
      badge.style.display = "flex";
      badge.style.alignItems = "center";
      badge.style.gap = "10px";
      badge.style.marginLeft = "12px";
      badge.style.fontWeight = "700";
      badge.style.color = "var(--color-text-main)";
      badge.innerHTML = [
        '<span id="auth-user-name"></span>',
        '<button type="button" id="auth-logout-btn" class="btn-icon" title="로그아웃">',
        '  <i data-lucide="log-out"></i>',
        "</button>",
      ].join("\n");
    }

    const notificationBtn = document.getElementById("notification-btn");
    if (badge.parentElement !== actions) {
      if (notificationBtn && notificationBtn.parentElement === actions) {
        actions.insertBefore(badge, notificationBtn);
      } else {
        actions.appendChild(badge);
      }
    }

    const nameEl = document.getElementById('auth-user-name');
    if (nameEl) nameEl.textContent = `${userName}님`;

    const logoutBtn = document.getElementById("auth-logout-btn");
    if (logoutBtn && !logoutBtn.dataset.bound) {
      logoutBtn.dataset.bound = "1";
      logoutBtn.addEventListener("click", () => {
        sessionStorage.removeItem("sb_access_token");
        sessionStorage.removeItem("sb_refresh_token");
        sessionStorage.removeItem("sb_user");
        window.location.replace("./pages/login.html");
      });
    }

    const avatarLink = document.querySelector('#login-link, .user-avatar-wrapper a');
    if (avatarLink) {
      avatarLink.setAttribute('aria-label', `${userName}님 프로필`);
      avatarLink.setAttribute('title', `${userName}님 프로필`);
      avatarLink.setAttribute('href', './pages/mypage.html');
    }

    const userId = currentUser?.id;
    if (userId) {
      const cachedImg = currentUser?.user_metadata?.profile_image;
      if (cachedImg) {
        const headerImg = document.getElementById('header-user-avatar');
        if (headerImg) headerImg.src = cachedImg;
      }

      fetch('/api/config')
        .then((r) => r.json())
        .then((result) => {
          if (!result.success) return;
          const sUrl = result.data.supabaseUrl;
          const sKey = result.data.supabaseAnonKey;
          return fetch(`${sUrl}/rest/v1/users?user_id=eq.${userId}&select=profile_image,nickname`, {
            headers: {
              apikey: sKey,
              Authorization: `Bearer ${authToken}`,
            },
          })
            .then((r) => r.json())
            .then((data) => {
              const dbImg = data?.[0]?.profile_image;
              const dbNick = data?.[0]?.nickname;

              if (dbImg) {
                const headerImg = document.getElementById('header-user-avatar');
                if (headerImg) headerImg.src = dbImg;
                currentUser.user_metadata = currentUser.user_metadata || {};
                currentUser.user_metadata.profile_image = dbImg;
              }

              if (dbNick) {
                if (nameEl) nameEl.textContent = `${dbNick}님`;
                currentUser.user_metadata.nickname = dbNick;
              }

              if (dbImg || dbNick) {
                sessionStorage.setItem('sb_user', JSON.stringify(currentUser));
              }
            });
        })
        .catch((err) => console.error('프로필 로드 오류:', err));
    }
  }

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

  function getTripCreateUrl(destinationId) {
    const tripCreateUrl = new URL(
      "./pages/trip-create.html",
      window.location.href,
    );
    tripCreateUrl.searchParams.set("destinationId", String(destinationId));
    return tripCreateUrl.href;
  }

  function getRecommendationReason(destination) {
    const reason = destination.reason?.trim();
    const hasTechnicalRule = /(?:contentType|textRule):\d+/i.test(reason || "");

    if (reason && !hasTechnicalRule) {
      return reason;
    }

    const keywordText = destination.keywords.slice(0, 3).join(", ");

    if (keywordText) {
      return `${keywordText} 여행 취향과 회원님의 MBTI 성향 점수가 잘 맞는 여행지입니다.`;
    }

    return "회원님의 여행 MBTI 적합도 점수를 바탕으로 추천한 여행지입니다.";
  }

  function closeDestinationDetail() {
    destinationDetailModal.classList.remove("active");
    destinationDetailModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  function openDestinationDetail(destination, rank) {
    const imageUrl = getSafeImageUrl(destination.imageUrl);

    destinationDetailImage.src = imageUrl;
    destinationDetailImage.alt = destination.destinationName;
    destinationDetailImage.onerror = () => {
      destinationDetailImage.src = fallbackImageUrl;
    };
    destinationDetailRank.textContent = `${rank}위 추천`;
    destinationDetailScore.textContent = `${destination.score.toFixed(1)}점`;
    destinationDetailName.textContent = destination.destinationName;
    destinationDetailRegion.textContent = getRegionText(destination);
    let descText =
      destination.description ||
      "여행 MBTI 성향과 높은 적합도를 보인 국내 여행지입니다.";
    descText = descText.replace(/(contentType|textRule)[\s:,\d]+/g, "").trim();
    destinationDetailDescription.textContent = descText;
    destinationDetailReason.textContent = getRecommendationReason(destination);
    destinationDetailKeywords.innerHTML = "";

    destination.keywords.forEach((keyword) => {
      const keywordBadge = document.createElement("span");
      keywordBadge.textContent = `#${keyword}`;
      destinationDetailKeywords.appendChild(keywordBadge);
    });

    destinationDetailAction.onclick = () => {
      sessionStorage.setItem(
        "selected_trip_destination",
        JSON.stringify({
          destinationId: destination.destinationId,
          destinationName: destination.destinationName,
          address: getRegionText(destination),
          imageUrl,
          keywords: destination.keywords,
        }),
      );
      window.location.href = getTripCreateUrl(destination.destinationId);
    };
    destinationDetailModal.classList.add("active");
    destinationDetailModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    destinationDetailClose.focus();
    lucide.createIcons();
  }

  function createFeaturedRecommendation(destination, rank) {
    const card = document.createElement("article");
    card.className = "featured-recommendation-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute(
      "aria-label",
      `${rank}위 ${destination.destinationName} 상세정보 보기`,
    );

    const image = document.createElement("img");
    image.className = "featured-recommendation-image";
    image.src = getSafeImageUrl(destination.imageUrl);
    image.alt = destination.destinationName;
    image.loading = "lazy";
    image.addEventListener("error", () => {
      image.src = fallbackImageUrl;
    });

    const info = document.createElement("div");
    info.className = "featured-recommendation-content";

    const meta = document.createElement("div");
    meta.className = "featured-recommendation-meta";
    meta.innerHTML = [
      `<span>추천 ${rank}위</span>`,
      `<span>적합도 ${destination.score.toFixed(1)}점</span>`,
    ].join("");

    const name = document.createElement("h4");
    name.textContent = destination.destinationName;

    const region = document.createElement("p");
    region.textContent = getRegionText(destination);

    const keywordList = document.createElement("div");
    keywordList.className = "recommendation-keywords";
    destination.keywords.slice(0, 4).forEach((keyword) => {
      const keywordBadge = document.createElement("span");
      keywordBadge.textContent = `#${keyword}`;
      keywordList.appendChild(keywordBadge);
    });

    const description = document.createElement("p");
    description.className = "featured-recommendation-copy";
    description.textContent =
      destination.description ||
      "여행 MBTI 성향과 높은 적합도를 보인 국내 여행지입니다.";

    const detailGuide = document.createElement("span");
    detailGuide.className = "recommendation-detail-guide";
    detailGuide.innerHTML = '상세정보 보기 <i data-lucide="arrow-up-right"></i>';

    info.append(meta, name, region, keywordList, description, detailGuide);
    card.append(image, info);
    card.addEventListener("click", () => {
      openDestinationDetail(destination, rank);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDestinationDetail(destination, rank);
      }
    });
    return card;
  }

  function renderFeaturedRecommendation() {
    const destination = featuredRecommendations[currentRecommendationIndex];
    recommendationList.innerHTML = "";

    if (!destination) {
      return;
    }

    recommendationList.appendChild(
      createFeaturedRecommendation(destination, currentRecommendationIndex + 1),
    );
    recommendationPosition.textContent =
      `${currentRecommendationIndex + 1} / ${featuredRecommendations.length}`;
    recommendationDots
      .querySelectorAll("button")
      .forEach((dot, dotIndex) => {
        dot.classList.toggle("active", dotIndex === currentRecommendationIndex);
        dot.setAttribute(
          "aria-current",
          dotIndex === currentRecommendationIndex ? "true" : "false",
        );
      });
    recommendationPrev.disabled = currentRecommendationIndex === 0;
    recommendationNext.disabled =
      currentRecommendationIndex === featuredRecommendations.length - 1;
    lucide.createIcons();
  }

  function initializeFeaturedRecommendations(recommendations) {
    featuredRecommendations = recommendations;
    currentRecommendationIndex = 0;
    recommendationDots.innerHTML = "";

    recommendations.forEach((destination, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute(
        "aria-label",
        `${index + 1}번째 추천 ${destination.destinationName} 보기`,
      );
      dot.addEventListener("click", () => {
        currentRecommendationIndex = index;
        renderFeaturedRecommendation();
      });
      recommendationDots.appendChild(dot);
    });

    renderFeaturedRecommendation();
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
    // 해당 페이지에 추천 섹션이 없다면 실행하지 않음
    if (!document.getElementById("recommendation-list")) return;

    try {
      const response = await fetch("/api/destinations/recommended?limit=10", {
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
        recommendationTitle.textContent = "여행 MBTI 분석이 필요합니다";
        recommendationSubtitle.textContent =
          "12개 질문에 답하고 나만의 국내 여행지를 추천받아 보세요.";
        recommendationLink.textContent = "성향 분석 시작";
        renderRecommendationState(
          "아직 저장된 여행 MBTI 결과가 없습니다.",
          "여행 성향 분석하기",
        );
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
      recommendationTitle.textContent = `${mbtiType} 맞춤 여행지 TOP ${recommendations.length}`;
      recommendationSubtitle.textContent =
        "한 장씩 넘겨보며 가장 마음에 드는 여행지를 골라보세요.";

      if (recommendations.length === 0) {
        renderRecommendationState(
          "해당 MBTI 유형의 관광지 점수가 아직 없습니다.",
          "성향 다시 분석하기",
        );
        return;
      }

      initializeFeaturedRecommendations(recommendations);
    } catch (error) {
      recommendationTitle.textContent = "추천 결과를 불러오지 못했습니다";
      recommendationSubtitle.textContent = error.message;
      renderRecommendationState(error.message);
    }
  }

  recommendationPrev.addEventListener("click", () => {
    if (currentRecommendationIndex > 0) {
      currentRecommendationIndex -= 1;
      renderFeaturedRecommendation();
    }
  });
  recommendationNext.addEventListener("click", () => {
    if (currentRecommendationIndex < featuredRecommendations.length - 1) {
      currentRecommendationIndex += 1;
      renderFeaturedRecommendation();
    }
  });

  if (destinationDetailClose) {
    destinationDetailClose.addEventListener("click", closeDestinationDetail);
  }
  if (destinationDetailModal) {
    destinationDetailModal.addEventListener("click", (event) => {
      if (event.target === destinationDetailModal) {
        closeDestinationDetail();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        destinationDetailModal.classList.contains("active")
      ) {
        closeDestinationDetail();
      }
    });
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
