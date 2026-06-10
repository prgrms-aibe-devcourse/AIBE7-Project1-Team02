let SUPABASE_URL = "";
let SUPABASE_ANON_KEY = "";
let savedDestinationBookmarks = [];
let latestPlanPayload = null;
let _data;

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
  // 사용자 ID : currentUser.id
  // MBTI Type : userMbtiType
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
    form: document.getElementById("trip-create-form"),
    userMbti: userMbtiType,
    userId: currentUser.id,
    startDate: document.getElementById("start-date"),
    endDate: document.getElementById("end-date"),
    peopleCount: document.getElementById("people-count"),
    region: document.getElementById("region"),
    memo: document.getElementById("memo"),
    submitBtn: document.getElementById("plan-submit-btn"),
    resetBtn: document.getElementById("trip-reset-btn"),
    loading: document.getElementById("plan-loading"),
    result: document.getElementById("plan-result"),
    saveBtn: document.getElementById("plan-save-btn"),
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

  init().catch((error) => {
    console.error(error);
    alert(error.message || "일정 생성 화면을 불러오지 못했습니다.");
  });

  async function init() {
    setDefaultDates();
    resetTripState(false);
    renderSelectedDestination();
    els.form?.addEventListener("submit", handleSubmit);
    els.saveBtn?.addEventListener("click", handleSaveTrip);
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
    if (els.selectedDestinationAddress)
      els.selectedDestinationAddress.textContent =
        activeDestination.address || "";
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
    const region = String(els.region.value || "").trim();
    const memo = String(els.memo.value || "").trim();
    const activeDestination = getActiveDestination();
    const destinationId = Number.isFinite(activeDestination.destinationId)
      ? activeDestination.destinationId
      : null;

    if (!startDate || !endDate) {
      alert("여행 시작일과 종료일을 입력해주세요.");
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      alert("종료일은 시작일보다 빠를 수 없습니다.");
      return;
    }

    if (!Number.isFinite(peopleCount) || peopleCount < 1) {
      alert("인원수는 1명 이상이어야 합니다.");
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
          destinationId,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || "일정 생성에 실패했습니다.");
      }

      renderPlan(data.data);
      _data = data.data;
      sessionStorage.removeItem("selected_trip_destination");
      alert("여행 일정이 생성되었습니다.");
    } catch (error) {
      console.error(error);
      alert(error.message || "일정 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function renderPlan(payload) {
    const { trip, plan } = payload || {};
    if (!trip || !plan) return;
    latestPlanPayload = payload;

    if (els.empty) els.empty.hidden = true;
    if (els.result) els.result.hidden = false;
    if (els.saveBtn) els.saveBtn.hidden = false;
    if (els.saveBtn) els.saveBtn.disabled = false;

    if (els.title) els.title.textContent = trip.title || "생성된 일정";
    if (els.summary) els.summary.textContent = trip.summary || "";

    const days = Array.isArray(plan.days) ? plan.days : [];
    if (els.days) {
      els.days.innerHTML = days.length
        ? days
            .map(
              (day) => `
                <article class="plan-day-card">
                  <h3>${escapeHtml(day.dayLabel || `DAY ${day.day}`)}${day.date ? ` · ${escapeHtml(day.date)}` : ""}</h3>
                  <div class="plan-day-items">
                    ${(Array.isArray(day.items) ? day.items : [])
                      .map(
                        (item) => `
                          <div class="plan-item">
                            <div class="plan-item-content">
                              <span class="plan-time">${escapeHtml(item.time || "")}</span>
                              <strong>${escapeHtml(item.placeName || "")}</strong>
                              <p>${escapeHtml(item.description || "")}</p>
                            </div>
                          </div>
                        `,
                      )
                      .join("")}
                  </div>
                </article>
              `,
            )
            .join("")
        : '<div class="trip-create-empty"><p>생성된 상세 일정이 없습니다.</p></div>';
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
  }

  function resetTripState(keepDates = true) {
    if (els.form) els.form.reset();
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
      alert("저장할 일정이 없습니다. 먼저 일정을 생성해주세요.");
      return;
    }

    if (!currentUser.id) {
      alert("로그인 정보를 확인할 수 없습니다. 다시 로그인해 주세요.");
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
        memo: String(els.memo.value || "").trim(),
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
    savePayload.itinerary = _data.plan.days;
    try {
      const saveResult = await saveTripToSupabase(savePayload);
      console.log("여행 일정 저장 완료:", saveResult);
      alert("여행 일정이 저장되었습니다.");
    } catch (error) {
      console.error(error);
      alert(error.message || "일정 저장 중 오류가 발생했습니다.");
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
    const days = Array.isArray(savePayload.itinerary);

    for (const idx = 0; idx < days.length(); idx++) {
      const day = days[i];
      for (const _idx = 0; _idx < day.items.length(); _idx++) {
        const item = day.items[_idx];

        const planInsertPayload = {
          user_id: savePayload.userId,
          day_number: idx + 1,
          order_index: _idx + 1,
          memo: idx + 1 + "번째 날 " + _idx + 1 + " 번째 방문지",
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
              `DAY ${dayIndex + 1} 일정 저장에 실패했습니다.`,
          );
        }

        const savedPlan = Array.isArray(planResponseData)
          ? planResponseData[0] || null
          : planResponseData;

        if (!savedPlan?.plan_id) {
          throw new Error(`DAY ${dayIndex + 1} 일정 ID를 확인할 수 없습니다.`);
        }
      }
    }
    /*
    for (const [dayIndex, day] of days.entries()) {
      // trip_plans 테이블: 날짜 단위 계획 1행 INSERT
      const planInsertPayload = {
        trip_id: savedTrip.trip_id,
        day_number: Number.isFinite(Number(day?.day))
          ? Number(day.day)
          : dayIndex + 1,
        date: day?.date || null,
        day_label: day?.dayLabel || `DAY ${dayIndex + 1}`,
      };

      const planResponse = await fetch(`${SUPABASE_URL}/rest/v1/trip_plans`, {
        method: "POST",
        headers: supabaseHeaders,
        body: JSON.stringify(planInsertPayload),
      });

      const planResponseData = await planResponse.json().catch(() => ({}));
      if (!planResponse.ok) {
        throw new Error(
          planResponseData?.message ||
            `DAY ${dayIndex + 1} 일정 저장에 실패했습니다.`,
        );
      }

      const savedPlan = Array.isArray(planResponseData)
        ? planResponseData[0] || null
        : planResponseData;

      if (!savedPlan?.plan_id) {
        throw new Error(`DAY ${dayIndex + 1} 일정 ID를 확인할 수 없습니다.`);
      }

      // trip_plan_items 테이블: 해당 날짜의 항목들 일괄 INSERT
      const items = Array.isArray(day?.items) ? day.items : [];
      if (items.length > 0) {
        const itemRows = items.map((item, itemIndex) => ({
          plan_id: savedPlan.plan_id,
          trip_id: savedTrip.trip_id,
          place_name:
            item?.placeName ||
            item?.title ||
            item?.location_name ||
            `일정 ${itemIndex + 1}`,
          description: item?.description || null,
          sort_order: itemIndex,
        }));

        const itemsResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/trip_plan_items`,
          {
            method: "POST",
            headers: supabaseHeaders,
            body: JSON.stringify(itemRows),
          },
        );

        const itemsResponseData = await itemsResponse.json().catch(() => ({}));
        if (!itemsResponse.ok) {
          throw new Error(
            itemsResponseData?.message ||
              `DAY ${dayIndex + 1} 세부 항목 저장에 실패했습니다.`,
          );
        }

        totalItemCount += items.length;
      }
    }
*/
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
