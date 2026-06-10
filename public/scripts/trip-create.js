document.addEventListener("DOMContentLoaded", () => {
  const authToken = sessionStorage.getItem("sb_access_token") || "";
  if (!authToken) {
    window.location.replace("./login.html");
    return;
  }

  const queryDestinationId = Number.parseInt(new URLSearchParams(window.location.search).get("destinationId") || "", 10);
  const storedSelectedDestination = safeJson(sessionStorage.getItem("selected_trip_destination") || "{}");

  const els = {
    form: document.getElementById("trip-create-form"),
    startDate: document.getElementById("start-date"),
    endDate: document.getElementById("end-date"),
    peopleCount: document.getElementById("people-count"),
    region: document.getElementById("region"),
    memo: document.getElementById("memo"),
    submitBtn: document.getElementById("plan-submit-btn"),
    resetBtn: document.getElementById("trip-reset-btn"),
    loading: document.getElementById("plan-loading"),
    result: document.getElementById("plan-result"),
    empty: document.getElementById("trip-create-empty"),
    title: document.getElementById("plan-title"),
    summary: document.getElementById("plan-summary"),
    days: document.getElementById("plan-days"),
    selectedDestination: document.getElementById("selected-destination"),
    selectedDestinationName: document.getElementById("selected-destination-name"),
    selectedDestinationAddress: document.getElementById("selected-destination-address"),
    selectedDestinationKeywords: document.getElementById("selected-destination-keywords"),
  };

  init().catch((error) => {
    console.error(error);
    alert(error.message || "일정 생성 화면을 불러오지 못했습니다.");
  });

  async function init() {
    setDefaultDates();
    resetTripState(false);
    renderSelectedDestination();
    els.form?.addEventListener("submit", handleSubmit);
    els.resetBtn?.addEventListener("click", () => {
      sessionStorage.removeItem("selected_trip_destination");
      resetTripState(true);
    });
  }

  function getActiveDestination() {
    if (Number.isFinite(queryDestinationId)) {
      const storedId = Number.parseInt(storedSelectedDestination.destinationId || "", 10);
      return {
        destinationId: queryDestinationId,
        destinationName:
          (storedId === queryDestinationId && storedSelectedDestination.destinationName) || "선택한 여행지",
        address: storedSelectedDestination.address || "",
        keywords: Array.isArray(storedSelectedDestination.keywords) ? storedSelectedDestination.keywords : [],
      };
    }

    const storedId = Number.parseInt(storedSelectedDestination.destinationId || "", 10);
    return Number.isFinite(storedId)
      ? {
          destinationId: storedId,
          destinationName: storedSelectedDestination.destinationName || "선택한 여행지",
          address: storedSelectedDestination.address || "",
          keywords: Array.isArray(storedSelectedDestination.keywords) ? storedSelectedDestination.keywords : [],
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
    if (els.selectedDestinationName) els.selectedDestinationName.textContent = activeDestination.destinationName || "선택한 여행지";
    if (els.selectedDestinationAddress) els.selectedDestinationAddress.textContent = activeDestination.address || "";
    if (els.selectedDestinationKeywords) {
      const keywords = Array.isArray(activeDestination.keywords) ? activeDestination.keywords : [];
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
    const peopleCount = Number.parseInt(els.peopleCount.value, 10);
    const region = String(els.region.value || "").trim();
    const memo = String(els.memo.value || "").trim();
    const activeDestination = getActiveDestination();
    const destinationId = Number.isFinite(activeDestination.destinationId) ? activeDestination.destinationId : null;

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

    if (els.empty) els.empty.hidden = true;
    if (els.result) els.result.hidden = false;

    if (els.title) els.title.textContent = trip.title || "생성된 일정";
    if (els.summary) els.summary.textContent = trip.summary || "";

    const days = Array.isArray(plan.days) ? plan.days : [];
    if (els.days) {
      els.days.innerHTML = days.length
        ? days
            .map(
              (day) => `
                <article class="plan-day-card">
                  <h3>DAY ${escapeHtml(day.day)}</h3>
                  <div class="plan-day-items">
                    ${(Array.isArray(day.items) ? day.items : [])
                      .map(
                        (item) => `
                          <div class="plan-item">
                            <span class="plan-time">${escapeHtml(item.time || "")}</span>
                            <div>
                              <strong>${escapeHtml(item.placeName || "")}</strong>
                              <p>${escapeHtml(item.description || "")}</p>
                            </div>
                          </div>
                        `
                      )
                      .join("")}
                  </div>
                </article>
              `
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

  function safeJson(value) {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
});
