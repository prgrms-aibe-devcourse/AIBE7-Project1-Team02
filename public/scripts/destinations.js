document.addEventListener("DOMContentLoaded", () => {
  const authToken = sessionStorage.getItem("sb_access_token") || "";
  const guestMbtiType = "INFP";

  const pageSize = 12;
  const grid = document.getElementById("destination-explore-grid");
  const subtitle = document.getElementById("destination-explore-subtitle");
  const backLink = document.getElementById("destination-back-link");
  const resultCount = document.getElementById("destination-result-count");
  const pagination = document.getElementById("destination-pagination");
  const filterForm = document.getElementById("destination-filter-form");
  const provinceFilter = document.getElementById(
    "destination-province-filter",
  );
  const keywordFilter = document.getElementById("destination-keyword-filter");
  const provinceSummary = document.getElementById(
    "destination-province-summary",
  );
  const keywordSummary = document.getElementById(
    "destination-keyword-summary",
  );
  const filterReset = document.getElementById("destination-filter-reset");
  const filterModal = document.getElementById("destination-filter-modal");
  const filterModalTitle = document.getElementById(
    "destination-filter-modal-title",
  );
  const filterOptionsContainer = document.getElementById(
    "destination-filter-options",
  );
  const filterModalClose = document.getElementById(
    "destination-filter-modal-close",
  );
  const filterModalClear = document.getElementById(
    "destination-filter-modal-clear",
  );
  const filterModalApply = document.getElementById(
    "destination-filter-modal-apply",
  );
  const detailModal = document.getElementById("destination-detail-modal");
  const detailClose = document.getElementById("destination-detail-close");
  const detailImage = document.getElementById("destination-detail-image");
  const detailNoImage = document.getElementById("destination-detail-no-image");
  const detailName = document.getElementById("destination-detail-name");
  const detailRegion = document.querySelector(
    "#destination-detail-region span",
  );
  const detailKeywords = document.getElementById(
    "destination-detail-keywords",
  );
  const detailDescription = document.getElementById(
    "destination-detail-description",
  );
  const detailReason = document.querySelector("#destination-detail-reason p");
  const detailAction = document.getElementById("destination-detail-action");
  const detailBookmark = document.getElementById("destination-detail-bookmark");
  let latestRequestId = 0;
  let bookmarkedDestinationIds = new Set();
  const filterOptions = {
    province: [],
    keyword: [],
  };
  const appliedFilters = {
    province: new Set(),
    keyword: new Set(),
  };
  let activeFilterType = null;
  let draftFilterValues = new Set();

  if (!authToken && subtitle) {
    subtitle.hidden = true;
  }
  if (!authToken && backLink) {
    backLink.hidden = true;
  }

  function getSafeImageUrl(imageUrl) {
    if (!imageUrl) {
      return "";
    }

    try {
      const parsedUrl = new URL(imageUrl, window.location.href);
      return ["http:", "https:"].includes(parsedUrl.protocol)
        ? parsedUrl.href
        : "";
    } catch {
      return "";
    }
  }

  function hasDestinationImage(destination) {
    return Boolean(getSafeImageUrl(destination?.imageUrl));
  }

  function createNoImagePlaceholder(className) {
    const placeholder = document.createElement("div");
    placeholder.className = `${className} no-image-placeholder`;
    placeholder.innerHTML = '<i data-lucide="image-off"></i><span>이미지 없음</span>';
    return placeholder;
  }

  function showDetailImage(imageUrl, altText) {
    if (!imageUrl) {
      detailImage.hidden = true;
      detailImage.removeAttribute("src");
      detailNoImage.hidden = false;
      return;
    }

    detailNoImage.hidden = true;
    detailImage.hidden = false;
    detailImage.src = imageUrl;
    detailImage.alt = altText;
    detailImage.onerror = () => {
      detailImage.hidden = true;
      detailImage.removeAttribute("src");
      detailNoImage.hidden = false;
      window.lucide?.createIcons();
    };
  }

  function getRegionText(destination) {
    return (
      destination.address ||
      [destination.province, destination.city].filter(Boolean).join(" ") ||
      "대한민국"
    );
  }

  function getRecommendationReason(destination) {
    const reason = destination.reason?.trim();
    const hasTechnicalRule = /(?:contentType|textRule):\d+/i.test(reason || "");

    if (reason && !hasTechnicalRule) {
      return reason;
    }

    const keywordText = destination.keywords.slice(0, 3).join(", ");
    return keywordText
      ? `${keywordText} 여행 취향과 회원님의 여행 성향이 잘 맞는 여행지입니다.`
      : "회원님의 여행 성향을 바탕으로 추천한 여행지입니다.";
  }

  function getTravelerTitle(mbtiType) {
    return window.TravelerProfile?.getTitle(mbtiType) || "취향 맞춤 여행가";
  }

  function createTravelerBadge(title, mbtiType) {
    return window.TravelerProfile?.createBadge
      ? window.TravelerProfile.createBadge(title, {
          variant: "subtle",
          size: "compact",
          mbtiType: mbtiType
        })
      : document.createTextNode(title);
  }

  function getTripCreateUrl(destinationId) {
    const url = new URL("./trip-create.html", window.location.href);
    url.searchParams.set("destinationId", String(destinationId));
    return url.href;
  }

  function getLoginUrl(redirectUrl) {
    const loginUrl = new URL("./login.html", window.location.href);
    loginUrl.searchParams.set("redirect", redirectUrl);
    return loginUrl.href;
  }

  function isBookmarked(destinationId) {
    return bookmarkedDestinationIds.has(String(destinationId));
  }

  function setBookmarkButtonState(button, destination) {
    if (!button || !destination) return;

    const bookmarked = isBookmarked(destination.destinationId);
    button.classList.toggle("active", bookmarked);
    button.setAttribute("aria-pressed", bookmarked ? "true" : "false");
    button.setAttribute(
      "aria-label",
      `${destination.destinationName} ${bookmarked ? "북마크 해제" : "북마크 저장"}`,
    );
    button.textContent = bookmarked ? "♥" : "♡";
  }

  function updateRenderedBookmarkButtons(destination) {
    setBookmarkButtonState(detailBookmark, destination);
    document
      .querySelectorAll(".destination-bookmark-button")
      .forEach((button) => {
        if (button.dataset.destinationId === String(destination.destinationId)) {
          setBookmarkButtonState(button, destination);
        }
      });
  }

  async function loadBookmarks() {
    if (!authToken) {
      bookmarkedDestinationIds = new Set();
      return;
    }

    try {
      const response = await fetch("/api/user/bookmarks", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const result = await response.json().catch(() => ({}));

      if (response.ok && result.success) {
        bookmarkedDestinationIds = new Set(
          (result.data.destinationIds || []).map(String),
        );
      }
    } catch {
      bookmarkedDestinationIds = new Set();
    }
  }

  async function toggleBookmark(destination, button) {
    if (!authToken) {
      window.location.href = getLoginUrl(window.location.href);
      return;
    }

    const destinationId = String(destination.destinationId);
    const wasBookmarked = bookmarkedDestinationIds.has(destinationId);
    wasBookmarked
      ? bookmarkedDestinationIds.delete(destinationId)
      : bookmarkedDestinationIds.add(destinationId);

    updateRenderedBookmarkButtons(destination);

    try {
      const response = await fetch(
        wasBookmarked
          ? `/api/user/bookmarks/${destinationId}`
          : "/api/user/bookmarks",
        {
          method: wasBookmarked ? "DELETE" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: wasBookmarked
            ? undefined
            : JSON.stringify({ destinationId: destination.destinationId }),
        },
      );
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        throw new Error(result.message || "북마크 처리 실패");
      }
    } catch (error) {
      wasBookmarked
        ? bookmarkedDestinationIds.add(destinationId)
        : bookmarkedDestinationIds.delete(destinationId);
      updateRenderedBookmarkButtons(destination);
      alert(error.message);
    }
  }

  function closeDetail() {
    detailModal.classList.remove("active");
    detailModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  function openDetail(destination) {
    const imageUrl = getSafeImageUrl(destination.imageUrl);
    showDetailImage(imageUrl, destination.destinationName);
    detailName.textContent = destination.destinationName;
    detailRegion.textContent = getRegionText(destination);
    detailKeywords.innerHTML = "";
    destination.keywords.forEach((keyword) => {
      const badge = document.createElement("span");
      badge.textContent = `#${keyword}`;
      detailKeywords.appendChild(badge);
    });
    detailDescription.textContent = (
      destination.description ||
      "회원님의 여행 성향과 잘 맞는 국내 여행지입니다."
    )
      .replace(/(contentType|textRule)[\s:,\d]+/g, "")
      .trim();
    detailReason.textContent = getRecommendationReason(destination);
    detailAction.onclick = () => {
      const tripCreateUrl = getTripCreateUrl(destination.destinationId);

      if (!authToken) {
        window.location.href = getLoginUrl(tripCreateUrl);
        return;
      }

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
      window.location.href = tripCreateUrl;
    };
    if (detailBookmark) {
      detailBookmark.onclick = () => {
        toggleBookmark(destination, detailBookmark);
      };
      setBookmarkButtonState(detailBookmark, destination);
    }
    detailModal.classList.add("active");
    detailModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    detailClose.focus();
    window.lucide?.createIcons();
  }

  function createDestinationCard(destination) {
    const card = document.createElement("article");
    card.className = "destination-explore-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute(
      "aria-label",
      `${destination.destinationName} 상세정보 보기`,
    );

    const image = document.createElement("img");
    const imageUrl = getSafeImageUrl(destination.imageUrl);
    let media = image;

    if (imageUrl) {
      image.src = imageUrl;
      image.alt = destination.destinationName;
      image.loading = "lazy";
      image.onerror = () => {
        image.replaceWith(
          createNoImagePlaceholder("destination-explore-card-image"),
        );
        window.lucide?.createIcons();
      };
    } else {
      media = createNoImagePlaceholder("destination-explore-card-image");
    }

    const bookmarkButton = document.createElement("button");
    bookmarkButton.className = "destination-bookmark-button";
    bookmarkButton.type = "button";
    bookmarkButton.dataset.destinationId = String(destination.destinationId);
    bookmarkButton.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleBookmark(destination, bookmarkButton);
    });
    bookmarkButton.addEventListener("keydown", (event) => {
      event.stopPropagation();
    });
    setBookmarkButtonState(bookmarkButton, destination);

    const content = document.createElement("div");
    content.className = "destination-explore-card-content";

    const name = document.createElement("h2");
    name.textContent = destination.destinationName;

    const region = document.createElement("p");
    region.className = "destination-explore-card-region";
    region.innerHTML = '<i data-lucide="map-pin"></i>';
    const regionText = document.createElement("span");
    regionText.textContent = getRegionText(destination);
    region.appendChild(regionText);

    const keywords = document.createElement("div");
    keywords.className = "destination-explore-card-keywords";
    destination.keywords.slice(0, 3).forEach((keyword) => {
      const badge = document.createElement("span");
      badge.textContent = `#${keyword}`;
      keywords.appendChild(badge);
    });

    const guide = document.createElement("span");
    guide.className = "destination-explore-card-guide";
    guide.textContent = "상세정보 보기";

    content.append(name, region, keywords, guide);
    card.append(media, bookmarkButton, content);
    card.addEventListener("click", () => openDetail(destination));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetail(destination);
      }
    });
    return card;
  }

  function renderState(message) {
    grid.innerHTML = "";
    const state = document.createElement("div");
    state.className = "destination-explore-state";
    state.textContent = message;
    grid.appendChild(state);
  }

  function getFilterSummary(type) {
    const values = [...appliedFilters[type]];
    if (values.length === 0) {
      return type === "province" ? "전체 지역" : "전체 키워드";
    }
    if (values.length === 1) {
      return values[0];
    }
    return `${values[0]} 외 ${values.length - 1}개`;
  }

  function updateFilterSummaries() {
    provinceSummary.textContent = getFilterSummary("province");
    keywordSummary.textContent = getFilterSummary("keyword");
  }

  function renderFilterOptions() {
    filterOptionsContainer.innerHTML = "";

    if (filterOptions[activeFilterType].length === 0) {
      const emptyState = document.createElement("p");
      emptyState.className = "destination-filter-options-empty";
      emptyState.textContent = "선택 가능한 필터가 없습니다.";
      filterOptionsContainer.appendChild(emptyState);
      return;
    }

    filterOptions[activeFilterType].forEach((value) => {
      const button = document.createElement("button");
      button.className = "destination-filter-option";
      button.type = "button";
      button.textContent = value;
      button.classList.toggle("selected", draftFilterValues.has(value));
      button.setAttribute(
        "aria-pressed",
        draftFilterValues.has(value) ? "true" : "false",
      );
      button.addEventListener("click", () => {
        draftFilterValues.has(value)
          ? draftFilterValues.delete(value)
          : draftFilterValues.add(value);
        renderFilterOptions();
      });
      filterOptionsContainer.appendChild(button);
    });
  }

  function openFilterModal(type) {
    activeFilterType = type;
    draftFilterValues = new Set(appliedFilters[type]);
    filterModalTitle.textContent =
      type === "province" ? "지역 선택" : "키워드 선택";
    renderFilterOptions();
    filterModal.classList.add("active");
    filterModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    filterModalClose.focus();
  }

  function closeFilterModal() {
    filterModal.classList.remove("active");
    filterModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    activeFilterType = null;
    draftFilterValues = new Set();
  }

  function createPageButton(label, page, options = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.disabled = options.disabled;
    button.classList.toggle("active", options.active);
    if (options.active) {
      button.setAttribute("aria-current", "page");
    }
    button.addEventListener("click", () => loadDestinations(page));
    return button;
  }

  function renderPagination(pageInfo) {
    pagination.innerHTML = "";
    pagination.hidden = pageInfo.totalPages <= 1;

    if (pageInfo.totalPages <= 1) {
      return;
    }

    pagination.appendChild(
      createPageButton("이전", pageInfo.page - 1, {
        disabled: pageInfo.page === 1,
      }),
    );

    const firstPage = Math.max(1, pageInfo.page - 2);
    const lastPage = Math.min(pageInfo.totalPages, firstPage + 4);
    const adjustedFirstPage = Math.max(1, lastPage - 4);

    for (let page = adjustedFirstPage; page <= lastPage; page += 1) {
      pagination.appendChild(
        createPageButton(String(page), page, {
          active: page === pageInfo.page,
        }),
      );
    }

    pagination.appendChild(
      createPageButton("다음", pageInfo.page + 1, {
        disabled: pageInfo.page === pageInfo.totalPages,
      }),
    );
  }

  async function loadDestinations(page = 1) {
    const requestId = latestRequestId + 1;
    latestRequestId = requestId;
    grid.setAttribute("aria-busy", "true");
    renderState("추천 여행지를 불러오는 중입니다.");

    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (!authToken) {
      params.set("mbtiType", guestMbtiType);
    }
    appliedFilters.province.forEach((value) => {
      params.append("province", value);
    });
    appliedFilters.keyword.forEach((value) => {
      params.append("keyword", value);
    });

    try {
      const response = await fetch(
        `/api/destinations/recommended?${params.toString()}`,
        {
          headers: authToken
            ? {
                Authorization: `Bearer ${authToken}`,
              }
            : {},
        },
      );
      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        throw new Error("로그인이 필요한 추천 서비스입니다.");
      }
      if (response.status === 404 && result.data?.needsSurvey) {
        window.location.replace("./survey.html");
        return;
      }
      if (!response.ok || !result.success) {
        throw new Error(result.message || "추천 조회 실패");
      }
      if (requestId !== latestRequestId) {
        return;
      }

      const { mbtiType, recommendations, pagination: pageInfo } = result.data;
      const travelerTitle = getTravelerTitle(mbtiType);
      subtitle.hidden = !authToken;
      if (authToken) {
        subtitle.replaceChildren(
          createTravelerBadge(travelerTitle, mbtiType),
          document.createTextNode(
            " 여행 성향에 잘 맞는 관광지를 적합도순으로 보여드려요.",
          ),
        );
      } else {
        subtitle.textContent = "";
      }
      const visibleRecommendations = recommendations.filter(hasDestinationImage);
      resultCount.textContent =
        `관광지 ${visibleRecommendations.length.toLocaleString("ko-KR")}개`;
      grid.innerHTML = "";

      if (visibleRecommendations.length === 0) {
        renderState("현재 조건에 맞는 여행지가 없습니다.");
      } else {
        visibleRecommendations.forEach((destination) => {
          grid.appendChild(createDestinationCard(destination));
        });
      }

      renderPagination(pageInfo);
      window.lucide?.createIcons();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      if (requestId !== latestRequestId) {
        return;
      }
      resultCount.textContent = "조회 실패";
      renderState(error.message);
      pagination.hidden = true;
    } finally {
      if (requestId === latestRequestId) {
        grid.removeAttribute("aria-busy");
      }
    }
  }

  async function loadFilters() {
    try {
      const filterUrl = new URL(
        "/api/destinations/recommended/filters",
        window.location.origin,
      );
      if (!authToken) {
        filterUrl.searchParams.set("mbtiType", guestMbtiType);
      }

      const response = await fetch(filterUrl, {
        headers: authToken
          ? {
              Authorization: `Bearer ${authToken}`,
            }
          : {},
      });
      const result = await response.json().catch(() => ({}));

      if (response.ok && result.success) {
        filterOptions.province = (result.data.provinces || []).filter(
          (province) => province !== "경기",
        );
        filterOptions.keyword = result.data.keywords || [];
      }
    } catch {
      // 목록 조회는 필터 옵션 조회 실패와 별개로 계속 사용할 수 있다.
    }
  }

  provinceFilter.addEventListener("click", () => openFilterModal("province"));
  keywordFilter.addEventListener("click", () => openFilterModal("keyword"));
  filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    loadDestinations(1);
  });
  filterReset.addEventListener("click", () => {
    appliedFilters.province.clear();
    appliedFilters.keyword.clear();
    updateFilterSummaries();
  });
  filterModalClear.addEventListener("click", () => {
    draftFilterValues.clear();
    renderFilterOptions();
  });
  filterModalApply.addEventListener("click", () => {
    if (!activeFilterType) {
      return;
    }

    appliedFilters[activeFilterType] = new Set(draftFilterValues);
    updateFilterSummaries();
    closeFilterModal();
  });
  filterModalClose.addEventListener("click", closeFilterModal);
  filterModal.addEventListener("click", (event) => {
    if (event.target === filterModal) {
      closeFilterModal();
    }
  });
  detailClose.addEventListener("click", closeDetail);
  detailModal.addEventListener("click", (event) => {
    if (event.target === detailModal) {
      closeDetail();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && filterModal.classList.contains("active")) {
      closeFilterModal();
    } else if (
      event.key === "Escape" &&
      detailModal.classList.contains("active")
    ) {
      closeDetail();
    }
  });

  Promise.all([loadBookmarks(), loadFilters()]).finally(() => {
    loadDestinations();
  });
  window.lucide?.createIcons();
});
