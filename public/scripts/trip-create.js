let SUPABASE_URL = "";
let SUPABASE_ANON_KEY = "";
let savedDestinationBookmarks = [];
let latestPlanPayload = null;
let _data;
let kakaoMapSdkPromise = null;
const MAX_TRIP_DAYS = 7;
const TRIP_REGION_OPTIONS = [
  "강원특별자치도",
  "경기도",
  "경상남도",
  "경상북도",
  "광주광역시",
  "대구광역시",
  "대전광역시",
  "부산광역시",
  "서울특별시",
  "세종특별자치시",
  "울산광역시",
  "인천광역시",
  "전라남도",
  "전북특별자치도",
  "제주특별자치도",
  "충청남도",
  "충청북도",
];
const TRIP_COMPANION_OPTIONS = [
  { label: "혼자", peopleCount: 1 },
  { label: "연인", peopleCount: 2 },
  { label: "친구", peopleCount: 3 },
  { label: "가족", peopleCount: 4 },
];
const TRIP_KEYWORDS = [
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
const MAX_SELECTED_KEYWORDS = 3;
const KEYWORD_LAYOUT_CLASSES = [
  "float-a",
  "float-b",
  "float-c",
  "float-d",
  "float-e",
  "float-f",
];

document.addEventListener("DOMContentLoaded", async () => {
  const authToken = sessionStorage.getItem("sb_access_token") || "";
  if (!authToken) {
    window.location.replace("./login.html");
    return;
  }
  const AUTH_KEYS = {
    access: "sb_access_token",
    refresh: "sb_refresh_token",
    user: "sb_user",
  };

  let currentUser = {};
  try {
    currentUser = JSON.parse(sessionStorage.getItem(AUTH_KEYS.user) || "{}");
  } catch (e) {}

  await loadConfig();

  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${authToken}`,
  };

  const userRes = await fetch(
    `${SUPABASE_URL}/rest/v1/travel_mbti_results?user_id=eq.${currentUser.id}&select=mbti_type&limit=1`,
    {
      method: "GET",
      headers,
    },
  );

  const userData = await userRes.json().catch(() => []);
  const userMbtiType = Array.isArray(userData)
    ? userData[0]?.mbti_type || ""
    : "";

  const queryDestinationId = Number.parseInt(
    new URLSearchParams(window.location.search).get("destinationId") || "",
    10,
  );
  const storedSelectedDestination = safeJson(
    sessionStorage.getItem("selected_trip_destination") || "{}",
  );
  const els = {
    inputView: document.getElementById("trip-create-input-view"),
    form: document.getElementById("trip-create-form"),
    userMbti: userMbtiType,
    userId: currentUser.id,
    startDate: document.getElementById("start-date"),
    endDate: document.getElementById("end-date"),
    peopleCount: document.getElementById("people-count"),
    companionSelect: document.getElementById("trip-companion-select"),
    companionSummary: document.getElementById("trip-companion-summary"),
    companionModal: document.getElementById("trip-companion-modal"),
    companionOptions: document.getElementById("trip-companion-options"),
    companionModalClose: document.getElementById("trip-companion-modal-close"),
    companionModalApply: document.getElementById("trip-companion-modal-apply"),
    region: document.getElementById("region"),
    regionSelect: document.getElementById("trip-region-select"),
    regionSummary: document.getElementById("trip-region-summary"),
    regionModal: document.getElementById("trip-region-modal"),
    regionOptions: document.getElementById("trip-region-options"),
    regionModalClose: document.getElementById("trip-region-modal-close"),
    regionModalClear: document.getElementById("trip-region-modal-clear"),
    regionModalApply: document.getElementById("trip-region-modal-apply"),
    memo: document.getElementById("memo"),
    keywordCloud: document.getElementById("trip-keyword-cloud"),
    keywordCount: document.getElementById("trip-keyword-count"),
    keywordWarning: document.getElementById("trip-keyword-warning"),
    submitBtn: document.getElementById("plan-submit-btn"),
    resetBtn: document.getElementById("trip-reset-btn"),
    loading: document.getElementById("plan-loading"),
    result: document.getElementById("plan-result"),
    saveBtn: document.getElementById("plan-save-btn"),
    editBtn: document.getElementById("plan-edit-btn"),
    generatedDayModal: document.getElementById("generated-day-modal"),
    generatedDayModalClose: document.getElementById(
      "generated-day-modal-close",
    ),
    generatedDayModalTitle: document.getElementById(
      "generated-day-modal-title",
    ),
    generatedDayModalPeriod: document.getElementById(
      "generated-day-modal-period",
    ),
    generatedDayModalBody: document.getElementById("generated-day-modal-body"),
    empty: document.getElementById("trip-create-empty"),
    title: document.getElementById("plan-title"),
    summary: document.getElementById("plan-summary"),
    days: document.getElementById("plan-days"),
    selectedDestination: document.getElementById("selected-destination"),
    selectedDestinationName: document.getElementById(
      "selected-destination-name",
    ),
    selectedDestinationAddress: document.getElementById(
      "selected-destination-address",
    ),
    selectedDestinationKeywords: document.getElementById(
      "selected-destination-keywords",
    ),
  };
  const saveBtnDefaultLabel = els.saveBtn?.textContent || "일정 저장하기";
  let selectedRegion = "";
  let draftRegion = "";
  let selectedCompanion = TRIP_COMPANION_OPTIONS[0];
  let draftCompanion = selectedCompanion;
  const selectedKeywords = new Set();
  let keywordWarningTimer = null;

  init().catch((error) => {
    console.error(error);
    window.PackingUI.alert(
      error.message || "일정 생성 화면을 불러오지 못했습니다.",
      {
        type: "error",
        title: "일정 생성 화면 오류",
      },
    );
  });

  async function init() {
    setDefaultDates();
    resetTripState(false);
    renderSelectedDestination();
    renderRegionSummary();
    renderCompanionSummary();
    renderKeywordCloud();
    els.form?.addEventListener("submit", handleSubmit);
    els.startDate?.addEventListener("change", updateEndDateLimit);
    els.saveBtn?.addEventListener("click", handleSaveTrip);
    els.editBtn?.addEventListener("click", showInputView);
    els.generatedDayModalClose?.addEventListener(
      "click",
      closeGeneratedDayModal,
    );
    els.generatedDayModal?.addEventListener("click", (event) => {
      if (event.target === els.generatedDayModal) {
        closeGeneratedDayModal();
      }
    });
    els.regionSelect?.addEventListener("click", openRegionModal);
    els.regionModalClose?.addEventListener("click", closeRegionModal);
    els.regionModalClear?.addEventListener("click", () => {
      draftRegion = "";
      renderRegionOptions();
    });
    els.regionModalApply?.addEventListener("click", () => {
      selectedRegion = draftRegion;
      renderRegionSummary();
      closeRegionModal();
    });
    els.regionModal?.addEventListener("click", (event) => {
      if (event.target === els.regionModal) {
        closeRegionModal();
      }
    });
    els.companionSelect?.addEventListener("click", openCompanionModal);
    els.companionModalClose?.addEventListener("click", closeCompanionModal);
    els.companionModalApply?.addEventListener("click", () => {
      selectedCompanion = draftCompanion;
      renderCompanionSummary();
      closeCompanionModal();
    });
    els.companionModal?.addEventListener("click", (event) => {
      if (event.target === els.companionModal) {
        closeCompanionModal();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        els.regionModal?.classList.contains("active")
      ) {
        closeRegionModal();
      }
      if (
        event.key === "Escape" &&
        els.companionModal?.classList.contains("active")
      ) {
        closeCompanionModal();
      }
      if (
        event.key === "Escape" &&
        els.generatedDayModal?.classList.contains("active")
      ) {
        closeGeneratedDayModal();
      }
    });
    els.resetBtn?.addEventListener("click", () => {
      sessionStorage.removeItem("selected_trip_destination");
      latestPlanPayload = null;
      resetTripState(true);
    });
  }

  function getActiveDestination() {
    if (Number.isFinite(queryDestinationId)) {
      const storedId = Number.parseInt(
        storedSelectedDestination.destinationId || "",
        10,
      );
      return {
        destinationId: queryDestinationId,
        destinationName:
          (storedId === queryDestinationId &&
            storedSelectedDestination.destinationName) ||
          "선택한 여행지",
        address: storedSelectedDestination.address || "",
        keywords: Array.isArray(storedSelectedDestination.keywords)
          ? storedSelectedDestination.keywords
          : [],
      };
    }

    const storedId = Number.parseInt(
      storedSelectedDestination.destinationId || "",
      10,
    );
    return Number.isFinite(storedId)
      ? {
          destinationId: storedId,
          destinationName:
            storedSelectedDestination.destinationName || "선택한 여행지",
          address: storedSelectedDestination.address || "",
          keywords: Array.isArray(storedSelectedDestination.keywords)
            ? storedSelectedDestination.keywords
            : [],
        }
      : {};
  }

  function renderSelectedDestination() {
    const activeDestination = getActiveDestination();
    if (!Number.isFinite(activeDestination.destinationId)) {
      if (els.empty) els.empty.hidden = false;
      if (els.selectedDestination) els.selectedDestination.hidden = true;
      return;
    }

    if (els.empty) els.empty.hidden = true;
    if (els.selectedDestination) els.selectedDestination.hidden = false;
    if (els.selectedDestinationName)
      els.selectedDestinationName.textContent =
        activeDestination.destinationName || "선택한 여행지";
    if (els.selectedDestinationAddress) {
      els.selectedDestinationAddress.textContent =
        activeDestination.address || "";

      const dt = els.selectedDestinationAddress.textContent;
      const dts = dt.split(" ");

      selectedRegion = dts[0];
      renderRegionSummary();
    }
    if (els.selectedDestinationKeywords) {
      const keywords = Array.isArray(activeDestination.keywords)
        ? activeDestination.keywords
        : [];
      els.selectedDestinationKeywords.innerHTML = keywords
        .slice(0, 5)
        .map((keyword) => `<span>#${escapeHtml(keyword)}</span>`)
        .join("");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const startDate = els.startDate.value;
    const endDate = els.endDate.value;
    const userMbti = els.userMbti;
    const peopleCount = Number.parseInt(els.peopleCount.value, 10);
    const region = selectedRegion.trim();
    const memo = getSelectedKeywordMemo();
    const keywords = getSelectedKeywords();
    const activeDestination = getActiveDestination();
    const destinationId = Number.isFinite(activeDestination.destinationId)
      ? activeDestination.destinationId
      : null;
    const userId = currentUser.id;
    const _accessToken = authToken;

    if (!startDate || !endDate) {
      window.PackingUI.alert("여행 시작일과 종료일을 입력해주세요.", {
        type: "warning",
        title: "여행 날짜 확인",
      });
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      window.PackingUI.alert("종료일은 시작일보다 빠를 수 없습니다.", {
        type: "warning",
        title: "여행 날짜 확인",
      });
      return;
    }

    if (calculateTripDays(startDate, endDate) > MAX_TRIP_DAYS) {
      window.PackingUI.alert(
        `현재 관광지 데이터 기준으로 최대 ${MAX_TRIP_DAYS}일 일정까지만 생성할 수 있습니다.`,
        {
          type: "warning",
          title: "여행 기간 확인",
        },
      );
      return;
    }

    if (!Number.isFinite(peopleCount) || peopleCount < 1) {
      window.PackingUI.alert("동행 유형을 선택해주세요.", {
        type: "warning",
        title: "동행 유형 확인",
      });
      return;
    }

    if (!region) {
      alert("지역을 선택해주세요.");
      return;
    }

    setLoading(true);

    try {
      const selectedDestination = destinationId
        ? await selectDestinations({
            supabaseUrl: SUPABASE_URL,
            anonKey: SUPABASE_ANON_KEY,
            accessToken: authToken,
            destinationId,
          })
        : null;

      if (destinationId && !selectedDestination) {
        throw new Error("선택한 여행지를 찾을 수 없습니다.");
      }

      const response = await fetch("/api/travel/plan", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate,
          endDate,
          peopleCount,
          region,
          memo,
          keywords,
          destinationId,
          userId,
          accessToken: _accessToken,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || "일정 생성에 실패했습니다.");
      }

      renderPlan(data.data);
      _data = data.data;
      sessionStorage.removeItem("selected_trip_destination");
      if (els.saveBtn && data.data?.trip?.planId) {
        els.saveBtn.textContent = "저장 완료";
      }
    } catch (error) {
      console.error(error);
      await window.PackingUI.alert(
        error.message || "일정 생성 중 오류가 발생했습니다.",
        {
          type: "error",
          title: "일정 생성 실패",
        },
      );
    } finally {
      setLoading(false);
    }
  }

  function renderPlan(payload) {
    const { trip, plan } = payload || {};
    if (!trip || !plan) return;
    latestPlanPayload = payload;

    if (els.empty) els.empty.hidden = true;
    showResultView();
    if (els.result) els.result.hidden = false;
    if (els.saveBtn) els.saveBtn.hidden = false;
    if (els.saveBtn) els.saveBtn.disabled = false;

    if (els.title) els.title.textContent = trip.title || "생성된 일정";
    if (els.summary) els.summary.textContent = trip.summary || "";

    const days = Array.isArray(plan.days) ? plan.days : [];
    if (els.days) {
      renderGeneratedTripDetail(days);
    }
  }

  function renderGeneratedTripDetail(days) {
    if (!els.days) return;

    if (!days.length) {
      els.days.innerHTML =
        '<div class="trip-create-empty"><p>생성된 상세 일정이 없습니다.</p></div>';
      return;
    }

    els.days.innerHTML = `
      <nav class="generated-day-grid" aria-label="생성된 여행 일차 선택">
        ${days
          .map((day, dayIndex) => {
            const items = Array.isArray(day.items) ? day.items : [];
            const imageItem = items.find((item) => item.imageUrl);
            const previewNames = items
              .slice(0, 3)
              .map((item) => item.placeName || "이름 없는 여행지")
              .join(" · ");

            return `
              <button
                class="generated-day-card"
                type="button"
                data-day-index="${dayIndex}"
              >
                <div class="generated-day-card-media">
                  ${
                    imageItem?.imageUrl
                      ? `<img src="${escapeHtml(imageItem.imageUrl)}" alt="${escapeHtml(imageItem.placeName || `DAY ${day.day}`)}" loading="lazy" />`
                      : '<div class="generated-no-image">이미지 없음</div>'
                  }
                </div>
                <div class="generated-day-card-content">
                  <span>DAY ${escapeHtml(day.day || dayIndex + 1)}</span>
                  <strong>${items.length}곳의 일정</strong>
                  <small>${escapeHtml(previewNames || "생성된 여행지를 확인하세요")}</small>
                </div>
              </button>
            `;
          })
          .join("")}
      </nav>
    `;

    els.days.querySelectorAll("[data-day-index]").forEach((button) => {
      button.addEventListener("click", () => {
        const dayIndex = Number.parseInt(button.dataset.dayIndex || "0", 10);
        openGeneratedDayModal(days, dayIndex);
      });
    });

    window.lucide?.createIcons();
  }

  function openGeneratedDayModal(days, dayIndex) {
    const selectedDay = days[dayIndex] || days[0];
    const selectedItems = Array.isArray(selectedDay.items)
      ? selectedDay.items
      : [];
    const selectedDayNumber = selectedDay.day || dayIndex + 1;
    let selectedItemId =
      selectedItems.length > 0 ? getGeneratedItemId(selectedItems[0], 0) : null;
    let mapController = null;

    const renderModalBody = () => {
      if (els.generatedDayModalTitle) {
        els.generatedDayModalTitle.textContent = `DAY ${selectedDayNumber} 일정과 루트`;
      }
      if (els.generatedDayModalPeriod) {
        els.generatedDayModalPeriod.textContent = `${selectedItems.length}곳의 추천 여행지`;
      }
      if (!els.generatedDayModalBody) return;

      els.generatedDayModalBody.innerHTML = `
        <section class="generated-day-content">
          <div class="generated-day-places">
            <div class="generated-day-section-header">
              <span>DAY ${escapeHtml(selectedDayNumber)}</span>
              <strong>여행지 일정</strong>
            </div>
            <div class="generated-place-list">
              ${selectedItems
                .map((item, itemIndex) =>
                  createGeneratedPlaceCard(item, itemIndex, selectedItemId),
                )
                .join("")}
            </div>
          </div>
          <div class="generated-day-map-section">
            <div class="generated-day-section-header">
              <span>ROUTE</span>
              <strong>여행지 위치</strong>
            </div>
            <div class="generated-day-map" id="generated-day-map">지도를 불러오는 중입니다.</div>
          </div>
        </section>
      `;

      els.generatedDayModalBody
        .querySelectorAll("[data-item-id]")
        .forEach((card) => {
          card.addEventListener("click", () => {
            selectedItemId =
              selectedItemId === card.dataset.itemId
                ? null
                : card.dataset.itemId;
            renderModalBody();
            mapController?.focusItem(selectedItemId);
          });
        });

      window.lucide?.createIcons();

      requestAnimationFrame(async () => {
        const mapContainer = document.getElementById("generated-day-map");
        mapController = await createGeneratedDayMap(
          mapContainer,
          selectedItems,
          (itemId) => {
            selectedItemId = itemId;
            renderModalBody();
          },
        );
        mapController?.focusItem(selectedItemId);
      });
    };

    renderModalBody();
    els.generatedDayModal?.classList.add("active");
    els.generatedDayModal?.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    els.generatedDayModalClose?.focus();
  }

  function closeGeneratedDayModal() {
    els.generatedDayModal?.classList.remove("active");
    els.generatedDayModal?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  function createGeneratedPlaceCard(item, itemIndex, selectedItemId) {
    const itemId = getGeneratedItemId(item, itemIndex);
    const isActive = itemId === selectedItemId;
    const address = getGeneratedItemAddress(item);

    return `
      <article
        class="generated-place-card${isActive ? " active" : ""}"
        role="button"
        tabindex="0"
        data-item-id="${escapeHtml(itemId)}"
      >
        <div class="generated-place-media">
          ${
            item.imageUrl
              ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.placeName || "여행지")}" loading="lazy" />`
              : '<div class="generated-no-image">이미지 없음</div>'
          }
        </div>
        <div class="generated-place-card-content">
          <span class="generated-place-order">${itemIndex + 1}번째 여행지</span>
          <strong>${escapeHtml(item.placeName || "이름 없는 여행지")}</strong>
          ${
            isActive
              ? `
                <div class="generated-place-detail">
                  <p class="generated-place-address"><i data-lucide="map-pin"></i><span>${escapeHtml(address || "주소 정보 없음")}</span></p>
                  <p>${escapeHtml(item.description || "등록된 여행지 설명이 없습니다.")}</p>
                  ${item.memo ? `<p class="generated-place-memo">선택 키워드: ${escapeHtml(item.memo)}</p>` : ""}
                </div>
              `
              : ""
          }
        </div>
      </article>
    `;
  }

  function getGeneratedItemId(item, itemIndex) {
    return String(item.destinationId || item.destination_id || itemIndex);
  }

  function getGeneratedItemAddress(item) {
    return (
      item.address || [item.province, item.city].filter(Boolean).join(" ") || ""
    );
  }

  function getGeneratedCoordinate(item) {
    const latitude = Number(item.latitude);
    const longitude = Number(item.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return { latitude, longitude };
  }

  function createGeneratedMarkerInfoContent(item) {
    const safeName = escapeHtml(item.placeName || "여행지");
    const media = item.imageUrl
      ? `<img src="${escapeHtml(item.imageUrl)}" alt="${safeName}" />`
      : '<div class="generated-marker-info-empty">이미지 없음</div>';

    return [
      '<div class="generated-marker-info">',
      `<div class="generated-marker-info-media">${media}</div>`,
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
              reject(
                new Error("카카오맵 JavaScript 키가 설정되지 않았습니다."),
              );
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

  async function createGeneratedDayMap(container, items, onSelect) {
    if (!container) return null;

    const mapItems = items
      .map((item, index) => ({
        item,
        itemId: getGeneratedItemId(item, index),
        coordinate: getGeneratedCoordinate(item),
      }))
      .filter(({ coordinate }) => coordinate);

    if (mapItems.length === 0) {
      container.classList.add("generated-map-empty");
      container.textContent = "이 DAY에는 지도에 표시할 좌표가 없습니다.";
      return null;
    }

    try {
      const maps = await loadKakaoMapSdk();
      container.classList.remove("generated-map-empty");
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
          content: createGeneratedMarkerInfoContent(item),
          removable: true,
        });
        bounds.extend(position);
        markers.set(itemId, { infoWindow, marker, position });
        maps.event.addListener(marker, "click", () => {
          openInfoWindow(markers.get(itemId));
          onSelect(itemId);
        });
      });

      if (mapItems.length > 1) {
        map.setBounds(bounds);
      }

      openInfoWindow(markers.get(mapItems[0].itemId));

      return {
        focusItem(itemId) {
          const markerData = markers.get(itemId);
          if (!markerData) return;
          map.panTo(markerData.position);
          openInfoWindow(markerData);
        },
      };
    } catch (error) {
      container.classList.add("generated-map-empty");
      container.textContent = error.message;
      return null;
    }
  }

  function setLoading(isLoading) {
    if (els.loading) els.loading.hidden = !isLoading;
    if (els.submitBtn) {
      els.submitBtn.disabled = isLoading;
      els.submitBtn.textContent = isLoading ? "생성 중..." : "일정 생성하기";
    }
  }

  function setDefaultDates() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (els.startDate) els.startDate.value = formatDate(today);
    if (els.endDate) els.endDate.value = formatDate(tomorrow);
    updateEndDateLimit();
  }

  function updateEndDateLimit() {
    if (!els.startDate?.value || !els.endDate) return;

    const maxEndDate = new Date(`${els.startDate.value}T00:00:00`);
    maxEndDate.setDate(maxEndDate.getDate() + MAX_TRIP_DAYS - 1);
    els.endDate.min = els.startDate.value;
    els.endDate.max = formatDate(maxEndDate);

    if (
      els.endDate.value &&
      calculateTripDays(els.startDate.value, els.endDate.value) > MAX_TRIP_DAYS
    ) {
      els.endDate.value = els.endDate.max;
    }
  }

  function calculateTripDays(startDate, endDate) {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return 0;
    }

    const dayMs = 24 * 60 * 60 * 1000;
    return Math.floor((end - start) / dayMs) + 1;
  }

  function resetTripState(keepDates = true) {
    if (els.form) els.form.reset();
    selectedRegion = "";
    draftRegion = "";
    selectedCompanion = TRIP_COMPANION_OPTIONS[0];
    draftCompanion = selectedCompanion;
    selectedKeywords.clear();
    renderRegionSummary();
    renderCompanionSummary();
    renderKeywordCloud();
    if (!keepDates) setDefaultDates();
    if (els.result) els.result.hidden = true;
    if (els.saveBtn) els.saveBtn.hidden = true;
    if (els.saveBtn) els.saveBtn.disabled = true;
    if (els.empty) els.empty.hidden = false;
    if (els.selectedDestination) els.selectedDestination.hidden = true;
    if (els.title) els.title.textContent = "";
    if (els.summary) els.summary.textContent = "";
    if (els.days) els.days.innerHTML = "";
    if (els.loading) els.loading.hidden = true;
  }

  function showResultView() {
    if (els.inputView) els.inputView.hidden = true;
    if (els.result) els.result.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showInputView() {
    if (els.inputView) els.inputView.hidden = false;
    if (els.result) els.result.hidden = true;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderRegionSummary() {
    if (els.region) els.region.value = selectedRegion;
    if (els.regionSummary) {
      els.regionSummary.textContent = selectedRegion || "지역을 선택하세요";
    }
    if (els.regionSelect) {
      els.regionSelect.classList.toggle("has-value", Boolean(selectedRegion));
      els.regionSelect.setAttribute(
        "aria-label",
        selectedRegion ? `선택된 지역 ${selectedRegion}` : "지역 선택",
      );
    }
  }

  function renderRegionOptions() {
    if (!els.regionOptions) return;

    els.regionOptions.innerHTML = "";
    TRIP_REGION_OPTIONS.forEach((regionName) => {
      const button = document.createElement("button");
      button.className = "trip-region-option";
      button.type = "button";
      button.textContent = regionName;
      button.classList.toggle("selected", draftRegion === regionName);
      button.setAttribute(
        "aria-pressed",
        draftRegion === regionName ? "true" : "false",
      );
      button.addEventListener("click", () => {
        draftRegion = draftRegion === regionName ? "" : regionName;
        renderRegionOptions();
      });
      els.regionOptions.appendChild(button);
    });
  }

  function openRegionModal() {
    draftRegion = selectedRegion;
    renderRegionOptions();
    els.regionModal?.classList.add("active");
    els.regionModal?.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    els.regionModalClose?.focus();
  }

  function closeRegionModal() {
    els.regionModal?.classList.remove("active");
    els.regionModal?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    draftRegion = selectedRegion;
  }

  function renderCompanionSummary() {
    if (els.peopleCount) {
      els.peopleCount.value = String(selectedCompanion.peopleCount);
      els.peopleCount.dataset.companion = selectedCompanion.label;
    }
    if (els.companionSummary) {
      els.companionSummary.textContent = selectedCompanion.label;
    }
    if (els.companionSelect) {
      els.companionSelect.classList.add("has-value");
      els.companionSelect.setAttribute(
        "aria-label",
        `선택된 동행 유형 ${selectedCompanion.label}`,
      );
    }
  }

  function renderCompanionOptions() {
    if (!els.companionOptions) return;

    els.companionOptions.innerHTML = "";
    TRIP_COMPANION_OPTIONS.forEach((option) => {
      const button = document.createElement("button");
      button.className = "trip-region-option trip-companion-option";
      button.type = "button";
      button.textContent = option.label;
      button.classList.toggle(
        "selected",
        draftCompanion.label === option.label,
      );
      button.setAttribute(
        "aria-pressed",
        draftCompanion.label === option.label ? "true" : "false",
      );
      button.addEventListener("click", () => {
        draftCompanion = option;
        renderCompanionOptions();
      });
      els.companionOptions.appendChild(button);
    });
  }

  function openCompanionModal() {
    draftCompanion = selectedCompanion;
    renderCompanionOptions();
    els.companionModal?.classList.add("active");
    els.companionModal?.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    els.companionModalClose?.focus();
  }

  function closeCompanionModal() {
    els.companionModal?.classList.remove("active");
    els.companionModal?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    draftCompanion = selectedCompanion;
  }

  function renderKeywordCloud() {
    if (!els.keywordCloud) return;

    els.keywordCloud.innerHTML = "";
    TRIP_KEYWORDS.forEach((keyword, index) => {
      const button = document.createElement("button");
      button.className = `trip-keyword-chip ${KEYWORD_LAYOUT_CLASSES[index % KEYWORD_LAYOUT_CLASSES.length]}`;
      button.type = "button";
      button.textContent = keyword;
      button.classList.toggle("selected", selectedKeywords.has(keyword));
      button.setAttribute(
        "aria-pressed",
        selectedKeywords.has(keyword) ? "true" : "false",
      );
      button.addEventListener("click", () => toggleKeyword(keyword));
      els.keywordCloud.appendChild(button);
    });

    updateKeywordState();
  }

  function toggleKeyword(keyword) {
    if (selectedKeywords.has(keyword)) {
      selectedKeywords.delete(keyword);
      renderKeywordCloud();
      return;
    }

    if (selectedKeywords.size >= MAX_SELECTED_KEYWORDS) {
      showKeywordWarning();
      return;
    }

    selectedKeywords.add(keyword);
    renderKeywordCloud();
  }

  function updateKeywordState() {
    if (els.keywordCount) {
      els.keywordCount.textContent = `${selectedKeywords.size}/${MAX_SELECTED_KEYWORDS}`;
    }
    if (els.memo) {
      els.memo.value = getSelectedKeywordMemo();
    }
  }

  function getSelectedKeywordMemo() {
    return [...selectedKeywords].join(", ");
  }

  function getSelectedKeywords() {
    return [...selectedKeywords].map((keyword) => keyword.replace(/^#/, ""));
  }

  function showKeywordWarning() {
    if (!els.keywordWarning) return;

    els.keywordWarning.hidden = false;
    window.clearTimeout(keywordWarningTimer);
    keywordWarningTimer = window.setTimeout(() => {
      els.keywordWarning.hidden = true;
    }, 1800);
  }

  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function handleSaveTrip() {
    if (!latestPlanPayload) {
      await window.PackingUI.alert(
        "저장할 일정이 없습니다. 먼저 일정을 생성해주세요.",
        {
          type: "warning",
          title: "저장할 일정 없음",
        },
      );
      return;
    }

    if (!currentUser.id) {
      await window.PackingUI.alert(
        "로그인 정보를 확인할 수 없습니다. 다시 로그인해 주세요.",
        {
          type: "error",
          title: "로그인 정보 확인",
        },
      );
      return;
    }

    const savePayload = {
      userId: currentUser.id,
      userMbtiType: els.userMbti,
      destination: getActiveDestination(),
      tripForm: {
        startDate: els.startDate.value,
        endDate: els.endDate.value,
        peopleCount: Number.parseInt(els.peopleCount.value, 10),
        region: String(els.region.value || "").trim(),
        memo: getSelectedKeywordMemo(),
      },
      itinerary: latestPlanPayload,
    };

    setSaveButtonState(true);

    if (typeof window.onTripCreateSave === "function") {
      try {
        await window.onTripCreateSave(savePayload);
      } finally {
        setSaveButtonState(false);
      }
      return;
    }
    try {
      const saveResult = await saveTripToSupabase(savePayload);
      console.log("여행 일정 저장 완료:", saveResult);
      await window.PackingUI.alert("여행 일정이 저장되었습니다.", {
        type: "success",
        title: "일정 저장 완료",
      });
      window.location.replace("/pages/saved-trips.html");
    } catch (error) {
      console.error(error);
      await window.PackingUI.alert(
        error.message || "일정 저장 중 오류가 발생했습니다.",
        {
          type: "error",
          title: "일정 저장 실패",
        },
      );
    } finally {
      setSaveButtonState(false);
    }
  }

  function setSaveButtonState(isSaving) {
    if (els.saveBtn) {
      els.saveBtn.disabled = isSaving;
      els.saveBtn.textContent = isSaving ? "저장 중..." : saveBtnDefaultLabel;
    }
  }

  async function saveTripToSupabase(savePayload) {
    await loadConfig();

    const authToken = sessionStorage.getItem("sb_access_token") || "";
    const supabaseHeaders = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };

    // ── 1단계: trips 테이블 INSERT ──────────────────────────────────────
    const tripInsertPayload = {
      user_id: savePayload.userId,
      title: savePayload.itinerary?.trip?.title || buildTripTitle(savePayload),
      start_date: savePayload.tripForm?.startDate || null,
      end_date: savePayload.tripForm?.endDate || null,
      memo: savePayload.tripForm?.memo || "",
      status: "planning",
    };

    const tripResponse = await fetch(`${SUPABASE_URL}/rest/v1/trips`, {
      method: "POST",
      headers: supabaseHeaders,
      body: JSON.stringify(tripInsertPayload),
    });

    const tripResponseData = await tripResponse.json().catch(() => ({}));
    if (!tripResponse.ok) {
      throw new Error(
        tripResponseData?.message || "여행 일정 기본 정보 저장에 실패했습니다.",
      );
    }

    const savedTrip = Array.isArray(tripResponseData)
      ? tripResponseData[0] || null
      : tripResponseData;

    if (!savedTrip?.trip_id) {
      throw new Error("저장된 여행 ID를 확인할 수 없습니다.");
    }

    // ── 2단계: trip_plan(항목별) INSERT ──────

    const tripPlanInsertPayload = {
      user_id: savePayload.userId,
      title: savePayload.itinerary?.trip?.title || buildTripTitle(savePayload),
      total_days: savePayload.itinerary.length,
      region: savePayload.tripForm.region,
      mbti_type: savePayload.userMbtiType,
      status: "planning",
    };
    const tripPlanResponse = await fetch(`${SUPABASE_URL}/rest/v1/trip_plans`, {
      method: "POST",
      headers: supabaseHeaders,
      body: JSON.stringify(tripPlanInsertPayload),
    });

    const tripPlanResponseData = await tripPlanResponse
      .json()
      .catch(() => ({}));
    if (!tripPlanResponse.ok) {
      throw new Error(
        tripPlanResponseData?.message ||
          "여행 일정 기본 정보 저장에 실패했습니다.",
      );
    }

    const savedTripPlan = Array.isArray(tripPlanResponseData)
      ? tripPlanResponseData[0] || null
      : tripPlanResponseData;

    if (!savedTripPlan?.plan_id) {
      throw new Error("저장된 여행 ID를 확인할 수 없습니다.");
    }

    // ── 3단계: trip_plan_items(항목별) INSERT ──────

    let totalItemCount = 0;
    const days = Array.isArray(savePayload.itinerary?.plan?.days)
      ? savePayload.itinerary.plan.days
      : Array.isArray(savePayload.itinerary)
        ? savePayload.itinerary
        : [];

    for (let idx = 0; idx < days.length; idx++) {
      const day = days[idx] || {};
      const items = Array.isArray(day.items) ? day.items : [];
      for (let _idx = 0; _idx < items.length; _idx++) {
        const item = items[_idx];

        const planInsertPayload = {
          plan_id: savedTripPlan.plan_id,
          user_id: savePayload.userId,
          day_number: idx + 1,
          order_index: _idx + 1,
          memo: idx + 1 + " 일차 " + (_idx + 1) + " 번째 목적지",
          destination_id: item.destinationId,
        };

        const planResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/trip_plan_items`,
          {
            method: "POST",
            headers: supabaseHeaders,
            body: JSON.stringify(planInsertPayload),
          },
        );

        const planResponseData = await planResponse.json().catch(() => ({}));
        if (!planResponse.ok) {
          throw new Error(
            planResponseData?.message ||
              `DAY ${idx + 1} 일정 저장에 실패했습니다.`,
          );
        }

        const savedPlan = Array.isArray(planResponseData)
          ? planResponseData[0] || null
          : planResponseData;

        if (!savedPlan?.item_id) {
          throw new Error(`DAY ${idx + 1} 일정 항목 ID를 확인할 수 없습니다.`);
        }
        totalItemCount += 1;
      }
    }

    return {
      trip: savedTrip,
      planCount: days.length,
      itemCount: totalItemCount,
    };
  }

  function buildTripTitle(savePayload) {
    const destinationName = savePayload?.destination?.destinationName || "여행";
    const startDate = savePayload?.tripForm?.startDate || "";
    const endDate = savePayload?.tripForm?.endDate || "";
    if (startDate && endDate) {
      return `${destinationName} ${startDate}~${endDate}`;
    }
    return `${destinationName} 여행 일정`;
  }

  function normalizeTime(value) {
    const text = String(value || "").trim();
    const matchedTime = text.match(/(\d{1,2}):(\d{2})/);
    if (!matchedTime) return "";

    const hour = String(Number.parseInt(matchedTime[1], 10)).padStart(2, "0");
    const minute = matchedTime[2];
    return `${hour}:${minute}:00`;
  }

  function sanitizeImageUrl(value) {
    const url = String(value || "").trim();
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    return "";
  }

  function safeJson(value) {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
});

async function loadConfig() {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) return;
  const res = await fetch("/api/config");
  const result = await res.json();
  if (result.success) {
    SUPABASE_URL = result.data.supabaseUrl;
    SUPABASE_ANON_KEY = result.data.supabaseAnonKey;
  } else {
    console.error("설정 정보를 불러오는데 실패했습니다.");
  }
}

async function selectDestinations({
  supabaseUrl,
  anonKey,
  accessToken,
  destinationId,
  fetchImpl = fetch,
}) {
  if (
    !supabaseUrl ||
    !anonKey ||
    !accessToken ||
    !Number.isFinite(destinationId)
  ) {
    return null;
  }

  const destinationUrl = new URL("/rest/v1/destinations", supabaseUrl);
  destinationUrl.searchParams.set(
    "select",
    "destination_id,destination_name,province,city,address,image_url,category,latitude,longitude",
  );
  destinationUrl.searchParams.set("destination_id", `eq.${destinationId}`);
  destinationUrl.searchParams.set("limit", "1");

  const response = await fetchImpl(destinationUrl, {
    method: "GET",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json().catch(() => []);

  if (!response.ok) {
    const message = data?.message || "destinations 조회에 실패했습니다.";
    throw new Error(message);
  }

  return Array.isArray(data) ? data[0] || null : null;
}
