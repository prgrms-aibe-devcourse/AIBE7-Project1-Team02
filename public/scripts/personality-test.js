/**
 * 여행 MBTI 설문 — 점수 계산 & Supabase 저장
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
  const axisLabel = document.getElementById("axisLabel");
  const progressFill = document.getElementById("progressFill");
  const validationMsg = document.getElementById("validationMsg");
  const surveyForm = document.getElementById("surveyForm");
  const surveyHeader = document.getElementById("surveyHeader");
  const progressContainer = document.getElementById("progressContainer");
  const navButtons = document.getElementById("navButtons");
  const resultContainer = document.getElementById("resultContainer");
  const loadingOverlay = document.getElementById("loadingOverlay");
  const nextStepBtn = document.getElementById("nextStepBtn");

  // 인증 모듈이 생성한 공용 Supabase 클라이언트를 사용한다.
  const supabaseClient = window.appSupabaseClient || null;

  // ── 축 라벨 맵 ──────────────────────────────────────────────
  const axisLabels = {
    ei: "E/I 활동 vs 휴식",
    sn: "S/N 전통 vs 탐험",
    tf: "T/F 효율 vs 감성",
    jp: "J/P 계획 vs 즉흥",
  };

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

  // ── 16유형 데이터 ───────────────────────────────────────────
  const mbtiProfiles = {
    ESTJ: {
      alias: "완벽한 여행 총괄",
      desc: "효율적 동선과 체계적 계획으로 알찬 여행을 만드는 리더",
    },
    ESTP: {
      alias: "현장 모험가",
      desc: "스릴 넘치는 액티비티와 현지 문화를 직접 체험하는 탐험가",
    },
    ESFJ: {
      alias: "함께하는 여행 호스트",
      desc: "모두가 행복한 여행을 만드는 따뜻한 여행 매니저",
    },
    ESFP: {
      alias: "축제의 주인공",
      desc: "어디서든 파티! 현지 축제와 맛집을 섭렵하는 에너자이저",
    },
    ENTJ: {
      alias: "전략적 세계 정복자",
      desc: "버킷리스트를 체계적으로 정복해나가는 야심찬 여행자",
    },
    ENTP: {
      alias: "이색 루트 개척자",
      desc: "남들이 안 가는 곳을 발굴하는 창의적 여행 크리에이터",
    },
    ENFJ: {
      alias: "의미있는 여행 큐레이터",
      desc: "문화 교류와 감동적 경험을 추구하는 감성 여행가",
    },
    ENFP: {
      alias: "자유로운 영혼의 탐험가",
      desc: "즉흥과 감성으로 세상을 누비는 낭만 여행자",
    },
    ISTJ: {
      alias: "꼼꼼한 여행 설계사",
      desc: "철저한 리서치와 계획으로 실속 있는 여행을 완성",
    },
    ISTP: {
      alias: "조용한 어드벤처러",
      desc: "혼자만의 속도로 스릴과 자연을 즐기는 독립 탐험가",
    },
    ISFJ: {
      alias: "소중한 추억 수집가",
      desc: "의미 있는 장소에서 조용히 추억을 쌓는 힐링 여행자",
    },
    ISFP: {
      alias: "감성 풍경 사냥꾼",
      desc: "아름다운 풍경과 예술에 빠져드는 감성 방랑자",
    },
    INTJ: {
      alias: "지적 여행 전략가",
      desc: "역사·건축·문화를 깊이 파고드는 지적 호기심의 여행자",
    },
    INTP: {
      alias: "호기심 가득 세계 관찰자",
      desc: "독특한 박물관과 숨겨진 명소를 찾아다니는 지적 탐험가",
    },
    INFJ: {
      alias: "영감을 찾는 순례자",
      desc: "깊은 의미와 영감을 주는 장소를 찾아 떠나는 명상 여행자",
    },
    INFP: {
      alias: "꿈꾸는 낭만 여행자",
      desc: "동화 같은 풍경과 감동적 이야기가 있는 곳을 찾는 몽상가",
    },
  };

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

    // Axis label
    const axis = slides[currentSlide].dataset.axis;
    axisLabel.textContent = axisLabels[axis] || "";

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

  // Auto-advance: 라디오 클릭 시 0.5초 후 다음 문항
  surveyForm.addEventListener("change", (e) => {
    if (e.target.type === "radio") {
      validationMsg.classList.remove("visible");
      if (currentSlide < totalSlides - 1) {
        setTimeout(() => {
          currentSlide++;
          updateUI();
        }, 450);
      }
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

    // MBTI 유형 결정
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
    document.getElementById("resultMbtiType").textContent = mbtiType;

    const profile = mbtiProfiles[mbtiType] || { alias: "", desc: "" };
    document.getElementById("resultAlias").textContent = `"${profile.alias}"`;
    document.getElementById("resultDesc").textContent = profile.desc;

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
    if (!supabaseClient) {
      return;
    }

    try {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();

      if (!user) {
        console.warn("로그인된 사용자가 없습니다. 결과가 저장되지 않습니다.");
        return;
      }

      const { error } = await supabaseClient
        .from("travel_mbti_results")
        .upsert(
          {
            user_id: user.id,
            mbti_type: mbtiType,
            ei_score: scores.ei,
            sn_score: scores.sn,
            tf_score: scores.tf,
            jp_score: scores.jp,
            raw_answers: rawAnswers,
          },
          { onConflict: "user_id" },
        );

      if (error) {
        console.error("MBTI 저장 실패:", error);
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
    window.location.href = "../index.html";
  });

  // ── Init ───────────────────────────────────────────────────
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

  if (window.lucide) {
    window.lucide.createIcons();
  }

  updateUI();
});
