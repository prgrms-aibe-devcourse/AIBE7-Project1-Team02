/**
 * 여행 성향 설문 — 점수 계산 & Supabase 저장
 * ─────────────────────────────────────────────
 * 12문항 (축당 3문항) × 5점 리커트 척도
 * 축별 0~100 스코어 계산 후 Supabase travel_mbti_results 테이블에 UPSERT
 */

document.addEventListener("DOMContentLoaded", () => {
  // ── DOM References ──────────────────────────────────────────
  const slides = document.querySelectorAll(".question-slide");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const submitBtn = document.getElementById("submitBtn");
  const stepCount = document.getElementById("stepCount");
  const progressFill = document.getElementById("progressFill");
  const validationMsg = document.getElementById("validationMsg");
  const surveyForm = document.getElementById("surveyForm");
  const surveyHeader = document.getElementById("surveyHeader");
  const progressContainer = document.getElementById("progressContainer");
  const navButtons = document.getElementById("navButtons");
  const resultContainer = document.getElementById("resultContainer");
  const loadingOverlay = document.getElementById("loadingOverlay");
  const nextStepBtn = document.getElementById("nextStepBtn");

  // ── Config 및 사용자 인증 ─────────────────────────────────
  let SUPABASE_URL = "";
  let SUPABASE_ANON_KEY = "";
  const AUTH_KEYS = {
    access: "sb_access_token",
    refresh: "sb_refresh_token",
    user: "sb_user",
  };

  const authToken = sessionStorage.getItem(AUTH_KEYS.access) || "";
  let currentUser = {};
  try {
    currentUser = JSON.parse(sessionStorage.getItem(AUTH_KEYS.user) || "{}");
  } catch (e) {}

  const headerUserName = document.getElementById("header-user-name");
  const headerUserAvatar = document.getElementById("header-user-avatar");
  const logoutBtn = document.getElementById("logout-btn");

  if (authToken && currentUser) {
    const userNickname =
      currentUser?.user_metadata?.nickname ||
      currentUser?.email?.split("@")?.[0] ||
      "사용자";
    if (headerUserName) headerUserName.textContent = `${userNickname}님`;
    if (headerUserAvatar) {
      headerUserAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userNickname)}&background=random&color=fff&size=160`;
    }
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      sessionStorage.removeItem(AUTH_KEYS.access);
      sessionStorage.removeItem(AUTH_KEYS.refresh);
      sessionStorage.removeItem(AUTH_KEYS.user);
      window.location.replace("/public/pages/login.html");
    });
  }

  async function loadConfig() {
    if (SUPABASE_URL && SUPABASE_ANON_KEY) return;
    const res = await fetch("/api/config");
    const result = await res.json();
    if (result.success) {
      SUPABASE_URL = result.data.supabaseUrl;
      SUPABASE_ANON_KEY = result.data.supabaseAnonKey;
    }
  }

  // 문항별 소속 축 매핑 (q1~q12)
  const questionAxisMap = {
    q1: "ei",
    q2: "ei",
    q3: "ei",
    q4: "sn",
    q5: "sn",
    q6: "sn",
    q7: "tf",
    q8: "tf",
    q9: "tf",
    q10: "jp",
    q11: "jp",
    q12: "jp",
  };

  function getTravelerTitle(mbtiType) {
    return window.TravelerProfile?.getTitle(mbtiType) || "나만의 취향 여행가";
  }

  function getTravelerDescription(mbtiType) {
    return (
      window.TravelerProfile?.getDescription(mbtiType) ||
      "여행 성향에 맞춰 국내 여행지를 추천받는 타입입니다."
    );
  }

  // ── Slide Navigation ───────────────────────────────────────
  let currentSlide = 0;
  const totalSlides = slides.length;

  function updateUI() {
    // Show/hide slides
    slides.forEach((s, i) => {
      s.classList.toggle("active", i === currentSlide);
    });

    // Progress
    stepCount.textContent = `${currentSlide + 1} / ${totalSlides}`;
    progressFill.style.width = `${((currentSlide + 1) / totalSlides) * 100}%`;

    // Buttons
    prevBtn.disabled = currentSlide === 0;

    if (currentSlide === totalSlides - 1) {
      nextBtn.style.display = "none";
      submitBtn.style.display = "inline-flex";
    } else {
      nextBtn.style.display = "inline-flex";
      submitBtn.style.display = "none";
    }

    // Clear validation message
    validationMsg.classList.remove("visible");
  }

  function isCurrentSlideAnswered() {
    const qName = `q${currentSlide + 1}`;
    return surveyForm.querySelector(`input[name="${qName}"]:checked`) !== null;
  }

  prevBtn.addEventListener("click", () => {
    if (currentSlide > 0) {
      currentSlide--;
      updateUI();
    }
  });

  nextBtn.addEventListener("click", () => {
    if (!isCurrentSlideAnswered()) {
      validationMsg.classList.add("visible");
      return;
    }
    if (currentSlide < totalSlides - 1) {
      currentSlide++;
      updateUI();
    }
  });

  // Auto-advance 기능 해제: 라디오 클릭 시 에러 메시지만 숨김 (자동 넘어가기 비활성화)
  surveyForm.addEventListener("change", (e) => {
    if (e.target.type === "radio") {
      validationMsg.classList.remove("visible");
    }
  });

  // ── Score Calculation ──────────────────────────────────────
  function calculateScores() {
    const formData = new FormData(surveyForm);
    const axisRaw = { ei: [], sn: [], tf: [], jp: [] };
    const rawAnswers = { ei: [], sn: [], tf: [], jp: [] };

    for (let i = 1; i <= 12; i++) {
      const qName = `q${i}`;
      const val = parseInt(formData.get(qName), 10);
      const axis = questionAxisMap[qName];

      axisRaw[axis].push(val);
      rawAnswers[axis].push({ q: i, answer: val });
    }

    // 축별 평균 → 0~100 변환
    // 평균이 5에 가까우면 score 100(E,S,T,J 성향), 1에 가까우면 score 0(I,N,F,P 성향)
    const scores = {};
    for (const axis of ["ei", "sn", "tf", "jp"]) {
      const avg =
        axisRaw[axis].reduce((a, b) => a + b, 0) / axisRaw[axis].length;
      scores[axis] = Math.round(((avg - 1) / 4) * 100);
    }

    // 내부 추천 기준 유형 결정
    const mbtiType =
      (scores.ei >= 50 ? "E" : "I") +
      (scores.sn >= 50 ? "S" : "N") +
      (scores.tf >= 50 ? "T" : "F") +
      (scores.jp >= 50 ? "J" : "P");

    return { scores, mbtiType, rawAnswers };
  }

  // ── Show Result ────────────────────────────────────────────
  function showResult({ scores, mbtiType }) {
    // Hide survey elements
    surveyHeader.style.display = "none";
    progressContainer.style.display = "none";
    surveyForm.style.display = "none";

    // Populate result
    const travelerTitle = getTravelerTitle(mbtiType);
    document.getElementById("resultMbtiType").textContent = travelerTitle;
    document.getElementById("resultAlias").textContent =
      "당신에게 어울리는 여행가 칭호";
    document.getElementById("resultDesc").textContent =
      getTravelerDescription(mbtiType);

    // Score bars (animated)
    resultContainer.classList.add("visible");

    requestAnimationFrame(() => {
      setTimeout(() => {
        document.getElementById("barEI").style.width = `${scores.ei}%`;
        document.getElementById("barSN").style.width = `${scores.sn}%`;
        document.getElementById("barTF").style.width = `${scores.tf}%`;
        document.getElementById("barJP").style.width = `${scores.jp}%`;

        document.getElementById("valEI").textContent = `${scores.ei}%`;
        document.getElementById("valSN").textContent = `${scores.sn}%`;
        document.getElementById("valTF").textContent = `${scores.tf}%`;
        document.getElementById("valJP").textContent = `${scores.jp}%`;
      }, 100);
    });
  }

  // ── Supabase UPSERT ────────────────────────────────────────
  async function saveToSupabase({ scores, mbtiType, rawAnswers }) {
    try {
      if (!authToken || !currentUser.id) {
        console.warn("로그인된 사용자가 없습니다. 결과가 저장되지 않습니다.");
        return;
      }

      await loadConfig();

      const payload = {
        user_id: currentUser.id,
        mbti_type: mbtiType,
        ei_score: scores.ei,
        sn_score: scores.sn,
        tf_score: scores.tf,
        jp_score: scores.jp,
        raw_answers: rawAnswers,
      };
      const preferencePayload = {
        user_id: currentUser.id,
        mbti_type: mbtiType,
        badge: getTravelerTitle(mbtiType),
      };

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/travel_mbti_results?on_conflict=user_id`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates",
          },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        const errorData = await res.json();
        console.error("MBTI 저장 실패:", JSON.stringify(errorData, null, 2));
        alert("저장 실패: " + (errorData.message || JSON.stringify(errorData)));
      } else {
        console.log("여행 성향 결과 저장 완료:", mbtiType);
      }

      const preferenceRes = await fetch(
        `${SUPABASE_URL}/rest/v1/user_preferences?on_conflict=user_id`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates",
          },
          body: JSON.stringify(preferencePayload),
        },
      );

      if (!preferenceRes.ok) {
        const errorData = await preferenceRes.json().catch(() => ({}));
        console.warn(
          "여행가 칭호 저장 실패:",
          errorData.message || JSON.stringify(errorData),
        );
      }
    } catch (err) {
      console.error("Supabase 연결 오류:", err);
    }
  }

  // ── Form Submit ────────────────────────────────────────────
  surveyForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!isCurrentSlideAnswered()) {
      validationMsg.classList.add("visible");
      return;
    }

    // Show loading
    loadingOverlay.classList.add("visible");

    const result = calculateScores();

    // Save to Supabase (fire & forget, don't block UI)
    saveToSupabase(result);

    // Simulate brief analysis delay for UX
    await new Promise((r) => setTimeout(r, 1200));

    loadingOverlay.classList.remove("visible");
    showResult(result);
  });

  // ── Next Step CTA ──────────────────────────────────────────
  nextStepBtn.addEventListener("click", () => {
    // TODO: 실제 키워드 선택 페이지로 이동
    alert("성향 분석이 끝났습니다!");
    window.location.href = "../index.html";
  });

  // ── Init ───────────────────────────────────────────────────
  // 모든 문항의 기본값을 '보통'(value="3")으로 설정합니다.
  document
    .querySelectorAll('input[type="radio"][value="3"]')
    .forEach((radio) => {
      radio.checked = true;
    });

  updateUI();
});
