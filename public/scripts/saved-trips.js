document.addEventListener("DOMContentLoaded", () => {
  const authToken = sessionStorage.getItem("sb_access_token") || "";
  const list = document.getElementById("saved-trips-list");
  const searchInput = document.getElementById("trip-search");
  const detailModal = document.getElementById("trip-detail-modal");
  const detailClose = document.getElementById("trip-detail-close");
  const detailTitle = document.getElementById("trip-detail-title");
  const detailStatus = document.getElementById("trip-detail-status");
  const detailPeriod = document.getElementById("trip-detail-period");
  const detailBody = document.getElementById("trip-detail-body");
  const dayDetailModal = document.getElementById("trip-day-detail-modal");
  const dayDetailClose = document.getElementById("trip-day-detail-close");
  const dayDetailTitle = document.getElementById("trip-day-detail-title");
  const dayDetailStatus = document.getElementById("trip-day-detail-status");
  const dayDetailPeriod = document.getElementById("trip-day-detail-period");
  const dayDetailBody = document.getElementById("trip-day-detail-body");
  let currentUser = {};
  try {
    currentUser = JSON.parse(sessionStorage.getItem("sb_user") || "{}");
  } catch {
    currentUser = {};
  }
  const completionOwnerId = currentUser?.id || "guest";
  let trips = [];
  let kakaoMapSdkPromise = null;
  let detailRenderId = 0;
  let dayRenderId = 0;
  const syncingCompletedTripIds = new Set();

  if (!authToken) {
    window.location.replace("./login.html");
    return;
  }

  function normalizeTrip(row) {
    const items = row.items || row.trip_plan_items || [];
    const firstDestination = items[0]?.destination || {};

    return {
      tripId: row.planId ?? row.plan_id,
      title: row.title || "이름 없는 여행",
      destinationName: row.region || "국내 여행",
      imageUrl: firstDestination.imageUrl || "",
      mbtiType: row.mbtiType || row.mbti_type || "",
      travelerTitle:
        window.TravelerProfile?.getTitle(row.mbtiType || row.mbti_type) ||
        "여행 계획",
      totalDays: row.totalDays ?? row.total_days ?? 1,
      aiSummary: row.aiSummary || row.ai_summary || "",
      status: row.status || "planning",
      completedAt: row.completedAt || row.completed_at || null,
      itineraryCount:
        row.itemCount ?? row.item_count ?? items.length ?? 0,
      itineraries: items,
    };
  }

  function getTripCompletionKey(trip) {
    return [
      "saved-trip-completion",
      completionOwnerId,
      trip.tripId || trip.title || "unknown-trip",
    ].join(":");
  }

  function readTripCompletion(trip) {
    try {
      const saved = localStorage.getItem(getTripCompletionKey(trip));
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  }

  function writeTripCompletion(trip, completedItemKeys) {
    localStorage.setItem(
      getTripCompletionKey(trip),
      JSON.stringify([...completedItemKeys]),
    );
  }

  function getItemKey(item, index = 0) {
    const destination = getDestination(item);
    return String(
      item.itemId ??
        item.item_id ??
        [
          item.dayNumber ?? item.day_number ?? 1,
          item.orderIndex ?? item.order_index ?? index,
          destination.destinationId ?? destination.destination_id ?? index,
        ].join("-"),
    );
  }

  function isItemCompleted(trip, item, index = 0) {
    if (trip.status === "completed") return true;
    return readTripCompletion(trip).has(getItemKey(item, index));
  }

  function markItemCompleted(trip, item, index = 0) {
    const completedItemKeys = readTripCompletion(trip);
    completedItemKeys.add(getItemKey(item, index));
    writeTripCompletion(trip, completedItemKeys);
  }

  function getCompletionStats(trip, items = trip.itineraries) {
    if (trip.status === "completed") {
      const totalCount = items.length;
      return {
        completedCount: totalCount,
        totalCount,
        isCompleted: totalCount > 0,
      };
    }

    const completedItemKeys = readTripCompletion(trip);
    const itemKeys = items.map((item, index) => getItemKey(item, index));
    const completedCount = itemKeys.filter((itemKey) =>
      completedItemKeys.has(itemKey),
    ).length;

    return {
      completedCount,
      totalCount: itemKeys.length,
      isCompleted: itemKeys.length > 0 && completedCount === itemKeys.length,
    };
  }

  function getTripStatusText(trip) {
    return trip.status === "completed" || getCompletionStats(trip).isCompleted
      ? "완료한 여행"
      : trip.travelerTitle || "여행 일정";
  }

  async function markTripCompletedInDatabase(trip) {
    if (
      !trip.tripId ||
      trip.status === "completed" ||
      syncingCompletedTripIds.has(String(trip.tripId))
    ) {
      return false;
    }

    try {
      syncingCompletedTripIds.add(String(trip.tripId));
      const response = await fetch(`/api/travel/${trip.tripId}/status`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "completed" }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        throw new Error(result.message || "일정 완료 저장 실패");
      }

      trip.status = "completed";
      trip.completedAt =
        result.data?.plan?.completedAt || new Date().toISOString();
      trips = trips.map((savedTrip) =>
        savedTrip.tripId === trip.tripId ? { ...savedTrip, ...trip } : savedTrip,
      );
      return true;
    } catch (error) {
      console.error("일정 완료 상태 저장 실패:", error);
      return false;
    } finally {
      syncingCompletedTripIds.delete(String(trip.tripId));
    }
  }

  async function syncLocalCompletedTripsToDatabase() {
    const localCompletedTrips = trips.filter(
      (trip) =>
        trip.status !== "completed" &&
        trip.tripId &&
        getCompletionStats(trip).isCompleted,
    );

    if (localCompletedTrips.length === 0) return;

    let hasUpdatedTrip = false;
    for (const trip of localCompletedTrips) {
      hasUpdatedTrip = (await markTripCompletedInDatabase(trip)) || hasUpdatedTrip;
    }

    if (hasUpdatedTrip) {
      renderTrips();
    }
  }

  function getPeriodText(trip) {
    return `${trip.totalDays}일 일정`;
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
    const completionStats = getCompletionStats(trip);
    const card = document.createElement("article");
    card.className = "saved-trip-card";
    card.classList.toggle("completed", completionStats.isCompleted);

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
    status.className =
      "saved-trip-status traveler-title-badge traveler-title-badge-compact";
    status.textContent = getTripStatusText(trip);
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
      ["여행 기간", getPeriodText(trip)],
      ["여행 성향", trip.travelerTitle],
      [
        "여행 완료",
        `${completionStats.completedCount}/${completionStats.totalCount || trip.itineraryCount}`,
      ],
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
      `<span>${completionStats.isCompleted ? "완료한 여행 보기" : "일정 상세 보기"}</span><i data-lucide="arrow-right"></i>`;
    action.addEventListener("click", () => openTripDetail(trip));

    content.append(title, destination, meta, action);
    card.append(cover, content);
    return card;
  }

  function renderTrips() {
    const searchText = searchInput.value.trim().toLowerCase();
    const filteredTrips = trips.filter((trip) => {
      const matchesSearch =
        !searchText ||
        trip.title.toLowerCase().includes(searchText) ||
        trip.destinationName.toLowerCase().includes(searchText);
      return matchesSearch;
    });

    list.innerHTML = "";
    if (filteredTrips.length === 0) {
      createState(
        trips.length === 0 ? "저장된 여행 일정이 없습니다" : "검색 결과가 없습니다",
        trips.length === 0
          ? "새로운 여행을 만들면 이곳에서 일정을 확인할 수 있습니다."
          : "검색어를 변경해 보세요.",
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

  function getDestination(item) {
    return item.destination || item.destinations || {};
  }

  function getDestinationName(item) {
    const destination = getDestination(item);
    return (
      destination.destinationName ||
      destination.destination_name ||
      "이름 없는 여행지"
    );
  }

  function getItemId(item, index) {
    return getItemKey(item, index);
  }

  function getCoordinate(item) {
    const destination = getDestination(item);
    if (
      destination.latitude === null ||
      destination.latitude === undefined ||
      destination.longitude === null ||
      destination.longitude === undefined
    ) {
      return null;
    }

    const latitude = Number(destination.latitude);
    const longitude = Number(destination.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return { latitude, longitude };
  }

  function escapeHtml(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function createMarkerInfoContent(item) {
    const destination = getDestination(item);
    const imageUrl = destination.imageUrl || destination.image_url || "";
    const safeName = escapeHtml(getDestinationName(item));
    const media = imageUrl
      ? `<img src="${escapeHtml(imageUrl)}" alt="${safeName}" />`
      : '<div class="trip-marker-info-empty">이미지 없음</div>';

    return [
      '<div class="trip-marker-info">',
      `<div class="trip-marker-info-media">${media}</div>`,
      `<strong>${safeName}</strong>`,
      "</div>",
    ].join("");
  }

  async function loadKakaoMapSdk() {
    if (window.kakao?.maps) {
      return window.kakao.maps;
    }
    if (kakaoMapSdkPromise) {
      return kakaoMapSdkPromise;
    }

    kakaoMapSdkPromise = fetch("/api/config")
      .then((response) => response.json())
      .then(
        (result) =>
          new Promise((resolve, reject) => {
            const appKey = result.data?.kakaoJavascriptKey;
            if (!appKey) {
              reject(new Error("카카오맵 JavaScript 키가 설정되지 않았습니다."));
              return;
            }

            const script = document.createElement("script");
            script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`;
            script.onload = () => {
              if (!window.kakao?.maps) {
                reject(new Error("카카오맵을 초기화하지 못했습니다."));
                return;
              }
              window.kakao.maps.load(() => resolve(window.kakao.maps));
            };
            script.onerror = () => {
              reject(new Error("카카오맵을 불러오지 못했습니다."));
            };
            document.head.appendChild(script);
          }),
      )
      .catch((error) => {
        kakaoMapSdkPromise = null;
        throw error;
      });

    return kakaoMapSdkPromise;
  }

  function createDestinationDetail(item, isCompleted, onComplete) {
    const destination = getDestination(item);
    const detail = document.createElement("div");
    detail.className = "trip-place-detail";

    const address = document.createElement("p");
    address.className = "trip-place-address";
    address.innerHTML = '<i data-lucide="map-pin"></i>';
    const addressText = document.createElement("span");
    addressText.textContent =
      destination.address ||
      [destination.province, destination.city].filter(Boolean).join(" ") ||
      "주소 정보 없음";
    address.appendChild(addressText);

    const description = document.createElement("p");
    description.textContent =
      destination.description || "등록된 여행지 설명이 없습니다.";
    detail.append(address, description);

    if (item.memo) {
      const memo = document.createElement("p");
      memo.className = "trip-place-memo";
      memo.textContent = `일정 메모: ${item.memo}`;
      detail.appendChild(memo);
    }

    const completeAction = document.createElement("button");
    completeAction.className = "trip-place-complete-button";
    completeAction.type = "button";
    completeAction.disabled = isCompleted;
    completeAction.innerHTML = isCompleted
      ? '<i data-lucide="check-circle-2"></i><span>여행 완료됨</span>'
      : '<i data-lucide="check"></i><span>여행 완료</span>';
    completeAction.addEventListener("click", (event) => {
      event.stopPropagation();
      onComplete();
    });
    detail.appendChild(completeAction);

    return detail;
  }

  function createDestinationCard(
    trip,
    item,
    itemIndex,
    selectedItemId,
    onSelect,
    onComplete,
  ) {
    const destination = getDestination(item);
    const itemId = getItemKey(item, itemIndex);
    const completed = isItemCompleted(trip, item, itemIndex);
    const card = document.createElement("article");
    card.className = "trip-place-card";
    card.classList.toggle("completed", completed);
    card.classList.toggle("active", itemId === selectedItemId);
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-expanded", itemId === selectedItemId ? "true" : "false");

    const media = document.createElement("div");
    media.className = "trip-place-media";
    if (destination.imageUrl || destination.image_url) {
      const image = document.createElement("img");
      image.src = destination.imageUrl || destination.image_url;
      image.alt = getDestinationName(item);
      image.addEventListener("error", () => {
        image.replaceWith(createNoImagePlaceholder("trip-place-no-image"));
        window.lucide?.createIcons();
      });
      media.appendChild(image);
    } else {
      media.appendChild(createNoImagePlaceholder("trip-place-no-image"));
    }

    const content = document.createElement("div");
    content.className = "trip-place-card-content";
    const order = document.createElement("span");
    order.className = "trip-place-order";
    order.textContent = `${itemIndex + 1}번째 여행지`;
    const name = document.createElement("strong");
    name.textContent = getDestinationName(item);
    const titleRow = document.createElement("div");
    titleRow.className = "trip-place-title-row";
    titleRow.appendChild(name);
    if (completed) {
      const completedBadge = document.createElement("span");
      completedBadge.className = "trip-place-completed-badge";
      completedBadge.textContent = "완료";
      titleRow.appendChild(completedBadge);
    }
    content.append(order, titleRow);

    if (itemId === selectedItemId) {
      content.appendChild(
        createDestinationDetail(item, completed, async () => {
          markItemCompleted(trip, item, itemIndex);
          if (getCompletionStats(trip).isCompleted) {
            await markTripCompletedInDatabase(trip);
          }
          onComplete();
        }),
      );
    }

    card.append(media, content);
    card.addEventListener("click", () => onSelect(itemId));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect(itemId);
      }
    });
    return card;
  }

  async function createDayMap(container, items, onSelect) {
    const mapItems = items
      .map((item, index) => ({
        item,
        index,
        itemId: getItemId(item, index),
        coordinate: getCoordinate(item),
      }))
      .filter(({ coordinate }) => coordinate);

    if (mapItems.length === 0) {
      container.classList.add("trip-map-empty");
      container.textContent = "이 DAY에는 지도에 표시할 좌표가 없습니다.";
      return;
    }

    try {
      const maps = await loadKakaoMapSdk();
      container.classList.remove("trip-map-empty");
      container.textContent = "";
      const selectedMapItem = mapItems[0];
      const center = new maps.LatLng(
        selectedMapItem.coordinate.latitude,
        selectedMapItem.coordinate.longitude,
      );
      const map = new maps.Map(container, {
        center,
        level: mapItems.length === 1 ? 4 : 8,
      });
      const bounds = new maps.LatLngBounds();
      let openedInfoWindow = null;
      const markers = new Map();

      function openInfoWindow(markerData) {
        if (!markerData) return;
        if (openedInfoWindow) {
          openedInfoWindow.close();
        }
        markerData.infoWindow.open(map, markerData.marker);
        openedInfoWindow = markerData.infoWindow;
      }

      mapItems.forEach(({ item, itemId, coordinate }) => {
        const position = new maps.LatLng(
          coordinate.latitude,
          coordinate.longitude,
        );
        const marker = new maps.Marker({ map, position });
        const infoWindow = new maps.InfoWindow({
          content: createMarkerInfoContent(item),
          removable: true,
        });
        bounds.extend(position);
        markers.set(itemId, { infoWindow, marker, position });
        maps.event.addListener(marker, "click", () => {
          openInfoWindow(markers.get(itemId));
          onSelect(itemId, { fromMap: true });
        });
      });

      if (mapItems.length > 1) {
        map.setBounds(bounds);
      }

      return {
        focusItem(itemId) {
          const markerData = markers.get(itemId);
          if (!markerData) return;
          map.panTo(markerData.position);
          openInfoWindow(markerData);
        },
      };
    } catch (error) {
      container.classList.add("trip-map-empty");
      container.textContent = error.message;
      return null;
    }
  }

  function renderDayDetail(trip, dayNumber, dayItems) {
    dayRenderId += 1;
    const currentDayRenderId = dayRenderId;
    let selectedItemId = null;
    let dayMapController = null;

    const updateDayHeader = () => {
      const tripStats = getCompletionStats(trip);
      const dayStats = getCompletionStats(trip, dayItems);
      dayDetailStatus.textContent = tripStats.isCompleted
        ? "완료한 여행"
        : trip.travelerTitle || "DAY ROUTE";
      dayDetailPeriod.textContent =
        `${trip.destinationName} · ${dayItems.length}곳 중 ${dayStats.completedCount}곳 완료`;
    };

    updateDayHeader();
    dayDetailTitle.textContent = `DAY ${dayNumber} 일정과 루트`;
    dayDetailBody.innerHTML = "";

    const dayContent = document.createElement("section");
    dayContent.className = "trip-day-content";
    const places = document.createElement("div");
    places.className = "trip-day-places";
    const placesHeader = document.createElement("div");
    placesHeader.className = "trip-day-section-header";
    placesHeader.innerHTML = `<span>DAY ${dayNumber}</span><strong>여행지 일정</strong>`;
    const placeList = document.createElement("div");
    placeList.className = "trip-place-list";
    places.append(placesHeader, placeList);

    const mapSection = document.createElement("div");
    mapSection.className = "trip-day-map-section";
    const mapHeader = document.createElement("div");
    mapHeader.className = "trip-day-section-header";
    mapHeader.innerHTML = "<span>ROUTE</span><strong>여행지 위치</strong>";
    const mapContainer = document.createElement("div");
    mapContainer.className = "trip-day-map";
    mapContainer.textContent = "지도를 불러오는 중입니다.";
    mapSection.append(mapHeader, mapContainer);
    dayContent.append(places, mapSection);
    dayDetailBody.appendChild(dayContent);

    const renderPlaceList = () => {
      placeList.innerHTML = "";
      dayItems.forEach((item, itemIndex) => {
        placeList.appendChild(
          createDestinationCard(
            trip,
            item,
            itemIndex,
            selectedItemId,
            selectItem,
            () => {
              updateDayHeader();
              renderPlaceList();
              renderTripDetail(trip, trip.itineraries);
              renderTrips();
            },
          ),
        );
      });
      window.lucide?.createIcons();
    };

    const selectItem = (itemId, options = {}) => {
      selectedItemId = itemId;
      renderPlaceList();
      if (!options.fromMap) {
        dayMapController?.focusItem(itemId);
      }
    };

    renderPlaceList();
    requestAnimationFrame(async () => {
      if (currentDayRenderId !== dayRenderId) return;
      dayMapController = await createDayMap(mapContainer, dayItems, selectItem);
    });
  }

  function showDayDetailModal(trip, dayNumber, dayItems) {
    renderDayDetail(trip, dayNumber, dayItems);
    dayDetailModal.classList.add("active");
    dayDetailModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    dayDetailClose.focus();
  }

  function closeDayDetailModal() {
    dayRenderId += 1;
    dayDetailModal.classList.remove("active");
    dayDetailModal.setAttribute("aria-hidden", "true");
  }

  function renderTripDetail(trip, itineraries) {
    detailRenderId += 1;
    const completionStats = getCompletionStats(trip, itineraries);
    detailStatus.textContent = completionStats.isCompleted
      ? "완료한 여행"
      : trip.travelerTitle || "여행 일정";
    detailTitle.textContent = trip.title;
    detailPeriod.textContent =
      `${trip.destinationName} · ${getPeriodText(trip)} · ${completionStats.completedCount}/${completionStats.totalCount}곳 완료`;
    detailBody.innerHTML = "";

    if (trip.aiSummary) {
      const summary = document.createElement("p");
      summary.className = "trip-detail-summary";
      summary.textContent = trip.aiSummary;
      detailBody.appendChild(summary);
    }

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
    const days = [...groupedItineraries.entries()]
      .sort(([firstDay], [secondDay]) => firstDay - secondDay)
      .map(([dayNumber, dayItems]) => [
        dayNumber,
        dayItems.sort(
          (firstItem, secondItem) =>
            (firstItem.orderIndex ?? firstItem.order_index ?? 0) -
            (secondItem.orderIndex ?? secondItem.order_index ?? 0),
        ),
      ]);
    const dayGrid = document.createElement("nav");
    dayGrid.className = "trip-day-grid";
    dayGrid.setAttribute("aria-label", "여행 일차 선택");
    detailBody.appendChild(dayGrid);

    days.forEach(([dayNumber, dayItems]) => {
      const dayStats = getCompletionStats(trip, dayItems);
      const dayButton = document.createElement("button");
      dayButton.className = "trip-day-card trip-day-card-large";
      dayButton.classList.toggle("completed", dayStats.isCompleted);
      dayButton.type = "button";
      const previewNames = dayItems
        .slice(0, 3)
        .map(getDestinationName)
        .join(" · ");
      dayButton.innerHTML = [
        `<span>DAY ${dayNumber}</span>`,
        `<strong>${dayStats.isCompleted ? "DAY 완료" : `${dayItems.length}곳의 일정`}</strong>`,
        `<em>${dayStats.completedCount}/${dayStats.totalCount}곳 완료</em>`,
        `<small>${previewNames || "저장된 여행지를 확인하세요"}</small>`,
      ].join("");
      dayButton.addEventListener("click", () => {
        showDayDetailModal(trip, dayNumber, dayItems);
      });
      dayGrid.appendChild(dayButton);
    });
  }

  function showDetailModal() {
    detailModal.classList.add("active");
    detailModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    detailClose.focus();
  }

  function closeDetailModal() {
    detailRenderId += 1;
    closeDayDetailModal();
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
        const detail = result.data?.plan || result.data || {};
        const normalizedTrip = { ...trip, ...normalizeTrip(detail) };
        trips = trips.map((savedTrip) =>
          savedTrip.tripId === normalizedTrip.tripId ? normalizedTrip : savedTrip,
        );
        renderTripDetail(
          normalizedTrip,
          detail.items || result.data?.items || [],
        );
        renderTrips();
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

      const rows = result.data?.plans || result.data || [];
      trips = Array.isArray(rows) ? rows.map(normalizeTrip) : [];
      renderTrips();
      window.setTimeout(syncLocalCompletedTripsToDatabase, 0);
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
      if (item.getAttribute("data-path") === "/pages/saved-trips.html") {
        item.classList.add("active");
      }
    });
    lucide.createIcons();
  }

  searchInput.addEventListener("input", renderTrips);
  detailClose.addEventListener("click", closeDetailModal);
  dayDetailClose.addEventListener("click", closeDayDetailModal);
  detailModal.addEventListener("click", (event) => {
    if (event.target === detailModal) closeDetailModal();
  });
  dayDetailModal.addEventListener("click", (event) => {
    if (event.target === dayDetailModal) closeDayDetailModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && dayDetailModal.classList.contains("active")) {
      closeDayDetailModal();
    } else if (
      event.key === "Escape" &&
      detailModal.classList.contains("active")
    ) {
      closeDetailModal();
    }
  });
  document.addEventListener("layoutLoaded", updateLayoutNavigation);

  loadTrips();
});
