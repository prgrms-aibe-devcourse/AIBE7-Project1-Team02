document.addEventListener("DOMContentLoaded", () => {
  const authToken = sessionStorage.getItem("sb_access_token") || "";

  if (!authToken) {
    window.location.replace("./login.html");
    return;
  }

  const pageSize = 12;
  const fallbackImageUrl = "../images/summer_banner.png";
  const grid = document.getElementById("destination-explore-grid");
  const subtitle = document.getElementById("destination-explore-subtitle");
  const resultCount = document.getElementById("destination-result-count");
  const pagination = document.getElementById("destination-pagination");
  const provinceFilter = document.getElementById(
    "destination-province-filter",
  );
  const keywordFilter = document.getElementById("destination-keyword-filter");
  const filterReset = document.getElementById("destination-filter-reset");
  const detailModal = document.getElementById("destination-detail-modal");
  const detailClose = document.getElementById("destination-detail-close");
  const detailImage = document.getElementById("destination-detail-image");
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
  let latestRequestId = 0;

  function getSafeImageUrl(imageUrl) {
    if (!imageUrl) {
      return fallbackImageUrl;
    }

    try {
      const parsedUrl = new URL(imageUrl, window.location.href);
      return ["http:", "https:"].includes(parsedUrl.protocol)
        ? parsedUrl.href
        : fallbackImageUrl;
    } catch {
      return fallbackImageUrl;
    }
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
      ? `${keywordText} 여행 취향과 회원님의 MBTI 성향이 잘 맞는 여행지입니다.`
      : "회원님의 여행 MBTI 적합도를 바탕으로 추천한 여행지입니다.";
  }

  function getTripCreateUrl(destinationId) {
    const url = new URL("./trip-create.html", window.location.href);
    url.searchParams.set("destinationId", String(destinationId));
    return url.href;
  }

  function closeDetail() {
    detailModal.classList.remove("active");
    detailModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  function openDetail(destination) {
    const imageUrl = getSafeImageUrl(destination.imageUrl);
    detailImage.src = imageUrl;
    detailImage.alt = destination.destinationName;
    detailImage.onerror = () => {
      detailImage.src = fallbackImageUrl;
    };
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
      "여행 MBTI 성향과 높은 적합도를 보인 국내 여행지입니다."
    )
      .replace(/(contentType|textRule)[\s:,\d]+/g, "")
      .trim();
    detailReason.textContent = getRecommendationReason(destination);
    detailAction.onclick = () => {
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
    image.src = getSafeImageUrl(destination.imageUrl);
    image.alt = destination.destinationName;
    image.loading = "lazy";
    image.onerror = () => {
      image.src = fallbackImageUrl;
    };

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
    card.append(image, content);
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
    if (provinceFilter.value) {
      params.set("province", provinceFilter.value);
    }
    if (keywordFilter.value) {
      params.set("keyword", keywordFilter.value);
    }

    try {
      const response = await fetch(
        `/api/destinations/recommended?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
      );
      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        sessionStorage.clear();
        window.location.replace("./login.html");
        return;
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
      subtitle.textContent =
        `${mbtiType} 여행 성향에 맞는 관광지를 적합도순으로 보여드려요.`;
      resultCount.textContent =
        `조건에 맞는 관광지 ${pageInfo.totalCount.toLocaleString("ko-KR")}개`;
      grid.innerHTML = "";

      if (recommendations.length === 0) {
        renderState("선택한 조건에 맞는 여행지가 없습니다.");
      } else {
        recommendations.forEach((destination) => {
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

  function appendOptions(select, values) {
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  async function loadFilters() {
    try {
      const response = await fetch("/api/destinations/recommended/filters", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const result = await response.json().catch(() => ({}));

      if (response.ok && result.success) {
        appendOptions(provinceFilter, result.data.provinces);
        appendOptions(keywordFilter, result.data.keywords);
      }
    } catch {
      // 목록 조회는 필터 옵션 조회 실패와 별개로 계속 사용할 수 있다.
    }
  }

  provinceFilter.addEventListener("change", () => loadDestinations(1));
  keywordFilter.addEventListener("change", () => loadDestinations(1));
  filterReset.addEventListener("click", () => {
    provinceFilter.value = "";
    keywordFilter.value = "";
    loadDestinations(1);
  });
  detailClose.addEventListener("click", closeDetail);
  detailModal.addEventListener("click", (event) => {
    if (event.target === detailModal) {
      closeDetail();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && detailModal.classList.contains("active")) {
      closeDetail();
    }
  });

  loadFilters();
  loadDestinations();
  window.lucide?.createIcons();
});
