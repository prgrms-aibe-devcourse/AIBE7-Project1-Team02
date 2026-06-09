document.addEventListener("DOMContentLoaded", () => {
  const authToken = sessionStorage.getItem("sb_access_token") || "";
  const list = document.getElementById("saved-trips-list");
  const searchInput = document.getElementById("trip-search");
  const filters = document.getElementById("trip-status-filters");
  const detailModal = document.getElementById("trip-detail-modal");
  const detailClose = document.getElementById("trip-detail-close");
  const detailTitle = document.getElementById("trip-detail-title");
  const detailStatus = document.getElementById("trip-detail-status");
  const detailPeriod = document.getElementById("trip-detail-period");
  const detailBody = document.getElementById("trip-detail-body");
  let trips = [];
  let selectedStatus = "all";

  if (!authToken) {
    window.location.replace("./login.html");
    return;
  }

  const statusLabels = {
    planning: "계획 중",
    ongoing: "여행 중",
    completed: "완료",
  };

  function normalizeTrip(row) {
    const destination = row.destination || row.destinations || {};

    return {
      tripId: row.tripId ?? row.trip_id,
      title: row.title || "이름 없는 여행",
      destinationName:
        row.destinationName ||
        row.destination_name ||
        destination.destination_name ||
        "국내 여행",
      imageUrl: row.imageUrl || row.image_url || destination.image_url || "",
      startDate: row.startDate || row.start_date || "",
      endDate: row.endDate || row.end_date || "",
      companionType: row.companionType || row.companion_type || "",
      status: row.status || "planning",
      itineraryCount:
        row.itineraryCount ??
        row.itinerary_count ??
        row.itineraries?.length ??
        0,
      itineraries: row.itineraries || [],
    };
  }

  function formatDate(dateText) {
    if (!dateText) return "미정";
    const date = new Date(`${dateText}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateText;

    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  }

  function getPeriodText(trip) {
    if (!trip.startDate && !trip.endDate) return "여행 날짜 미정";
    return `${formatDate(trip.startDate)} - ${formatDate(trip.endDate)}`;
  }

  function getDurationText(trip) {
    if (!trip.startDate || !trip.endDate) return "미정";
    const startDate = new Date(`${trip.startDate}T00:00:00`);
    const endDate = new Date(`${trip.endDate}T00:00:00`);
    const difference = endDate.getTime() - startDate.getTime();

    if (!Number.isFinite(difference) || difference < 0) return "미정";
    return `${Math.floor(difference / 86400000) + 1}일`;
  }

  function createNoImagePlaceholder(className) {
    const placeholder = document.createElement("div");
    placeholder.className = `${className} no-image-placeholder`;
    placeholder.innerHTML = '<i data-lucide="image-off"></i><span>이미지 없음</span>';
    return placeholder;
  }

  function createState(title, message, actionText) {
    list.innerHTML = "";
    const state = document.createElement("div");
    state.className = "saved-trips-state";

    const icon = document.createElement("i");
    icon.setAttribute("data-lucide", "calendar-days");
    const heading = document.createElement("h2");
    heading.textContent = title;
    const description = document.createElement("p");
    description.textContent = message;
    state.append(icon, heading, description);

    if (actionText) {
      const action = document.createElement("a");
      action.className = "btn-primary";
      action.href = "./trip-create.html";
      action.textContent = actionText;
      state.appendChild(action);
    }

    list.appendChild(state);
    lucide.createIcons();
  }

  function createTripCard(trip) {
    const card = document.createElement("article");
    card.className = "saved-trip-card";

    const cover = document.createElement("div");
    cover.className = "saved-trip-cover";
    const image = document.createElement("img");
    let media = image;
    if (trip.imageUrl) {
      image.src = trip.imageUrl;
      image.alt = trip.destinationName;
      image.loading = "lazy";
      image.addEventListener("error", () => {
        image.replaceWith(createNoImagePlaceholder("saved-trip-no-image"));
        window.lucide?.createIcons();
      });
    } else {
      media = createNoImagePlaceholder("saved-trip-no-image");
    }
    const status = document.createElement("span");
    status.className = "saved-trip-status";
    status.textContent = statusLabels[trip.status] || trip.status;
    cover.append(media, status);

    const content = document.createElement("div");
    content.className = "saved-trip-content";
    const title = document.createElement("h2");
    title.textContent = trip.title;
    const destination = document.createElement("p");
    destination.className = "saved-trip-destination";
    destination.innerHTML = '<i data-lucide="map-pin"></i>';
    const destinationText = document.createElement("span");
    destinationText.textContent = trip.destinationName;
    destination.appendChild(destinationText);

    const meta = document.createElement("div");
    meta.className = "saved-trip-meta";
    [
      ["여행 기간", getDurationText(trip)],
      ["동반자", trip.companionType || "미정"],
      ["세부 일정", `${trip.itineraryCount}개`],
    ].forEach(([label, value]) => {
      const item = document.createElement("div");
      const labelElement = document.createElement("span");
      labelElement.textContent = label;
      const valueElement = document.createElement("strong");
      valueElement.textContent = value;
      item.append(labelElement, valueElement);
      meta.appendChild(item);
    });

    const action = document.createElement("button");
    action.className = "saved-trip-action";
    action.type = "button";
    action.innerHTML =
      '<span>일정 상세 보기</span><i data-lucide="arrow-right"></i>';
    action.addEventListener("click", () => openTripDetail(trip));

    content.append(title, destination, meta, action);
    card.append(cover, content);
    return card;
  }

  function renderTrips() {
    const searchText = searchInput.value.trim().toLowerCase();
    const filteredTrips = trips.filter((trip) => {
      const matchesStatus =
        selectedStatus === "all" || trip.status === selectedStatus;
      const matchesSearch =
        !searchText ||
        trip.title.toLowerCase().includes(searchText) ||
        trip.destinationName.toLowerCase().includes(searchText);
      return matchesStatus && matchesSearch;
    });

    list.innerHTML = "";
    if (filteredTrips.length === 0) {
      createState(
        trips.length === 0 ? "저장된 여행 일정이 없습니다" : "검색 결과가 없습니다",
        trips.length === 0
          ? "새로운 여행을 만들면 이곳에서 일정을 확인할 수 있습니다."
          : "검색어 또는 상태 필터를 변경해 보세요.",
        trips.length === 0 ? "새 여행 만들기" : "",
      );
      return;
    }

    filteredTrips.forEach((trip) => {
      list.appendChild(createTripCard(trip));
    });
    lucide.createIcons();
  }

  function groupItineraries(items) {
    return items.reduce((dayMap, item) => {
      const dayNumber = item.dayNumber ?? item.day_number ?? 1;
      const dayItems = dayMap.get(dayNumber) || [];
      dayItems.push(item);
      dayMap.set(dayNumber, dayItems);
      return dayMap;
    }, new Map());
  }

  function renderTripDetail(trip, itineraries) {
    detailStatus.textContent = statusLabels[trip.status] || trip.status;
    detailTitle.textContent = trip.title;
    detailPeriod.textContent = `${trip.destinationName} · ${getPeriodText(trip)}`;
    detailBody.innerHTML = "";

    if (itineraries.length === 0) {
      const state = document.createElement("div");
      state.className = "saved-trips-state";
      const title = document.createElement("h2");
      title.textContent = "저장된 세부 일정이 없습니다";
      const message = document.createElement("p");
      message.textContent = "여행 기본 정보만 저장된 일정입니다.";
      state.append(title, message);
      detailBody.appendChild(state);
      return;
    }

    const groupedItineraries = groupItineraries(itineraries);
    [...groupedItineraries.entries()]
      .sort(([firstDay], [secondDay]) => firstDay - secondDay)
      .forEach(([dayNumber, dayItems]) => {
        const daySection = document.createElement("section");
        daySection.className = "trip-day";
        const dayTitle = document.createElement("h3");
        dayTitle.textContent = `DAY ${dayNumber}`;
        daySection.appendChild(dayTitle);

        dayItems
          .sort(
            (firstItem, secondItem) =>
              (firstItem.sortOrder ?? firstItem.sort_order ?? 0) -
              (secondItem.sortOrder ?? secondItem.sort_order ?? 0),
          )
          .forEach((item) => {
            const schedule = document.createElement("div");
            schedule.className = "trip-schedule-item";
            const time = document.createElement("span");
            time.className = "trip-schedule-time";
            time.textContent = item.startTime || item.start_time || "--:--";
            const content = document.createElement("div");
            content.className = "trip-schedule-content";
            const location = document.createElement("strong");
            location.textContent =
              item.locationName || item.location_name || "방문 장소";
            const description = document.createElement("p");
            description.textContent = item.description || "등록된 설명이 없습니다.";
            content.append(location, description);
            schedule.append(time, content);
            daySection.appendChild(schedule);
          });

        detailBody.appendChild(daySection);
      });
  }

  function showDetailModal() {
    detailModal.classList.add("active");
    detailModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    detailClose.focus();
  }

  function closeDetailModal() {
    detailModal.classList.remove("active");
    detailModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  async function openTripDetail(trip) {
    renderTripDetail(trip, trip.itineraries);
    showDetailModal();

    if (!trip.tripId || trip.itineraries.length > 0) return;

    try {
      const response = await fetch(`/api/travel/${trip.tripId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const result = await response.json().catch(() => ({}));

      if (response.ok && result.success) {
        const detail = result.data?.trip || result.data || {};
        renderTripDetail(
          { ...trip, ...normalizeTrip(detail) },
          detail.itineraries || result.data?.itineraries || [],
        );
      }
    } catch {
      // The list summary remains visible when the detail API is unavailable.
    }
  }

  async function loadTrips() {
    try {
      const response = await fetch("/api/travel/list", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        sessionStorage.removeItem("sb_access_token");
        sessionStorage.removeItem("sb_refresh_token");
        window.location.replace("./login.html");
        return;
      }

      if (response.status === 404) {
        trips = [];
        renderTrips();
        return;
      }

      if (!response.ok || !result.success) {
        throw new Error(result.message || "저장된 일정을 불러오지 못했습니다.");
      }

      const rows = result.data?.trips || result.data || [];
      trips = Array.isArray(rows) ? rows.map(normalizeTrip) : [];
      renderTrips();
    } catch (error) {
      createState(
        "일정을 불러오지 못했습니다",
        error.message,
        "",
      );
    }
  }

  function updateLayoutNavigation() {
    const breadcrumbIcon = document.getElementById("breadcrumb-icon-container");
    const breadcrumbText = document.getElementById("breadcrumb-text-container");
    if (breadcrumbIcon) {
      breadcrumbIcon.innerHTML = '<i data-lucide="calendar-days"></i>';
    }
    if (breadcrumbText) breadcrumbText.textContent = "내 여행 일정";

    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.remove("active");
      if (item.getAttribute("data-path") === "/pages/trip-create.html") {
        item.classList.add("active");
      }
    });
    lucide.createIcons();
  }

  searchInput.addEventListener("input", renderTrips);
  filters.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-status]");
    if (!button) return;
    selectedStatus = button.dataset.status;
    filters.querySelectorAll("button").forEach((filterButton) => {
      filterButton.classList.toggle("active", filterButton === button);
    });
    renderTrips();
  });
  detailClose.addEventListener("click", closeDetailModal);
  detailModal.addEventListener("click", (event) => {
    if (event.target === detailModal) closeDetailModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && detailModal.classList.contains("active")) {
      closeDetailModal();
    }
  });
  document.addEventListener("layoutLoaded", updateLayoutNavigation);

  loadTrips();
});
