// Login page behavior.
const SUPABASE_URL = "https://etomsinirscywqvyyjiv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0b21zaW5pcnNjeXdxdnl5aml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NDQ4NDcsImV4cCI6MjA5NjIyMDg0N30.GnbWzZZQaL2XdPkEavBsbzjx5DEZeAvosMGFVBEEYnA";

const $ = (id) => document.getElementById(id);

const authWrapEl = $("authWrap");
const prefWrapEl = $("prefWrap");
const titleEl = $("title");
const subtitleEl = $("subtitle");
const alertEl = $("alert");
const successEl = $("success");
const nicknameWrapEl = $("nicknameWrap");
const nicknameEl = $("nickname");
const emailEl = $("email");
const passwordEl = $("password");
const submitBtn = $("submitBtn");
const clearBtn = $("clearBtn");
const switchToSignupBtn = $("switchToSignup");
const switchToLoginBtn = $("switchToLogin");

const prefStepEl = $("prefStep");
const prefAlertEl = $("prefAlert");
const prefSuccessEl = $("prefSuccess");
const prefQuestionEl = $("prefQuestion");
const prefDescEl = $("prefDesc");
const prefOptionsEl = $("prefOptions");
const prefPrevBtn = $("prefPrevBtn");
const prefNextBtn = $("prefNextBtn");

let mode = "login";
let prefStep = 0;
let loginRedirectTimer = null;
const prefAnswers = {
  travel_tempo: "",
  food_preference: "",
};

const prefQuestions = [
  {
    id: "travel_tempo",
    title: "여행 스타일은 어떤 편인가요?",
    desc: "활동적으로 많이 움직이는 편인지, 여유롭게 즐기는 편인지 선택하세요.",
    options: [
      { value: "active", label: "활동적", description: "일정이 빡빡해도 많이 보고 많이 움직이는 스타일" },
      { value: "relaxed", label: "여유롭게", description: "천천히 둘러보고 쉬는 시간을 충분히 갖는 스타일" },
    ],
  },
  {
    id: "food_preference",
    title: "맛집 취향은 어떤가요?",
    desc: "유명한 곳을 선호하는지, 현지인이 자주 가는 곳을 선호하는지 선택하세요.",
    options: [
      { value: "popular", label: "유명 맛집", description: "후기가 많고 알려진 곳을 선호" },
      { value: "local", label: "현지 맛집", description: "숨은 맛집이나 로컬 식당을 선호" },
    ],
  },
];

function showAlert(message) {
  alertEl.textContent = message;
  alertEl.style.display = "block";
  successEl.style.display = "none";
}

function showSuccess(message) {
  successEl.textContent = message;
  successEl.style.display = "block";
  alertEl.style.display = "none";
}

function clearMessages() {
  alertEl.style.display = "none";
  successEl.style.display = "none";
  alertEl.textContent = "";
  successEl.textContent = "";
}

function clearPrefMessages() {
  prefAlertEl.style.display = "none";
  prefSuccessEl.style.display = "none";
  prefAlertEl.textContent = "";
  prefSuccessEl.textContent = "";
}

function showPrefAlert(message) {
  prefAlertEl.textContent = message;
  prefAlertEl.style.display = "block";
  prefSuccessEl.style.display = "none";
}

function showPrefSuccess(message) {
  prefSuccessEl.textContent = message;
  prefSuccessEl.style.display = "block";
  prefAlertEl.style.display = "none";
}

function resetFields() {
  emailEl.value = "";
  passwordEl.value = "";
  nicknameEl.value = "";
}

function redirectToMainPage() {
  if (loginRedirectTimer) {
    clearTimeout(loginRedirectTimer);
    loginRedirectTimer = null;
  }
  loginRedirectTimer = setTimeout(() => {
    window.location.replace("./index.html");
  }, 700);
}

function setMode(nextMode) {
  mode = nextMode;
  clearMessages();
  resetFields();

  if (mode === "signup") {
    titleEl.textContent = "회원가입";
    subtitleEl.textContent = "새 계정을 만들어 시작하세요.";
    nicknameWrapEl.style.display = "block";
    submitBtn.textContent = "회원가입";
    switchToSignupBtn.style.display = "none";
    switchToLoginBtn.style.display = "inline-block";
  } else {
    titleEl.textContent = "로그인";
    subtitleEl.textContent = "Supabase 계정으로 로그인하세요.";
    nicknameWrapEl.style.display = "none";
    submitBtn.textContent = "로그인";
    switchToSignupBtn.style.display = "inline-block";
    switchToLoginBtn.style.display = "none";
  }
}

function openPreferenceFlow() {
  authWrapEl.style.display = "none";
  prefWrapEl.style.display = "grid";
  clearPrefMessages();
  prefStep = 0;
  renderPrefStep();
}

function closePreferenceFlow() {
  prefWrapEl.style.display = "none";
  authWrapEl.style.display = "grid";
}

function renderPrefStep() {
  const q = prefQuestions[prefStep];
  prefStepEl.textContent = `${prefStep + 1} / ${prefQuestions.length}`;
  prefQuestionEl.textContent = q.title;
  prefDescEl.textContent = q.desc;
  prefOptionsEl.innerHTML = "";

  q.options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `option${prefAnswers[q.id] === opt.value ? " selected" : ""}`;
    btn.innerHTML = `<strong>${opt.label}</strong><div style="font-size:12px; opacity:.85; margin-top:4px;">${opt.description}</div>`;
    btn.addEventListener("click", () => {
      prefAnswers[q.id] = opt.value;
      renderPrefStep();
    });
    prefOptionsEl.appendChild(btn);
  });

  prefPrevBtn.disabled = prefStep === 0;
  prefNextBtn.textContent = prefStep === prefQuestions.length - 1 ? "완료" : "다음";
}

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error_description || data?.msg || data?.message || "로그인 실패");
  return data;
}

async function signUp(email, password, nickname) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      email,
      password,
      data: { nickname },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error_description || data?.msg || data?.message || "회원가입 실패");
  return data;
}

async function savePreference() {
  const accessToken = sessionStorage.getItem("sb_access_token") || "";
  const userJson = sessionStorage.getItem("sb_user") || "{}";
  const user = JSON.parse(userJson);
  const badge =
    prefAnswers.travel_tempo === "active" && prefAnswers.food_preference === "popular"
      ? "인기 스팟 러너"
      : prefAnswers.travel_tempo === "active" && prefAnswers.food_preference === "local"
        ? "현지 맛집 탐험가"
        : prefAnswers.travel_tempo === "relaxed" && prefAnswers.food_preference === "popular"
          ? "감성 미식가"
          : "여유로운 로컬 여행자";

  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_preferences`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      user_id: user?.id,
      travel_tempo: prefAnswers.travel_tempo,
      food_preference: prefAnswers.food_preference,
      badge,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.msg || "성향 저장 실패");
  return data;
}

async function handleSubmit() {
  clearMessages();

  const email = emailEl.value.trim();
  const password = passwordEl.value;
  if (!email || !password) {
    showAlert("이메일과 비밀번호를 입력하세요.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = mode === "signup" ? "가입 중..." : "로그인 중...";

  try {
    if (mode === "login") {
      const data = await signIn(email, password);
      sessionStorage.setItem("sb_access_token", data.access_token || "");
      sessionStorage.setItem("sb_refresh_token", data.refresh_token || "");
      sessionStorage.setItem("sb_user", JSON.stringify(data.user || {}));
      showSuccess(
        `로그인 성공\n\n이메일: ${data.user?.email || email}\n닉네임: ${data.user?.user_metadata?.nickname || "없음"}`
      );
      redirectToMainPage();
    } else {
      const nickname = nicknameEl.value.trim();
      if (!nickname) {
        showAlert("닉네임을 입력하세요.");
        return;
      }
      const data = await signUp(email, password, nickname);
      sessionStorage.setItem("sb_user", JSON.stringify(data.user || { email, user_metadata: { nickname } }));
      sessionStorage.setItem("sb_access_token", data.access_token || "");
      sessionStorage.setItem("sb_refresh_token", data.refresh_token || "");
      showSuccess(`회원가입 성공\n\n이메일: ${email}\n닉네임: ${nickname}\n\n성향 분석을 진행합니다.`);
      setTimeout(() => openPreferenceFlow(), 700);
    }
  } catch (err) {
    showAlert(err.message || "요청 실패");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = mode === "signup" ? "회원가입" : "로그인";
  }
}

async function handlePrefNext() {
  clearPrefMessages();
  const q = prefQuestions[prefStep];
  if (!prefAnswers[q.id]) {
    showPrefAlert("옵션을 하나 선택하세요.");
    return;
  }

  if (prefStep < prefQuestions.length - 1) {
    prefStep += 1;
    renderPrefStep();
    return;
  }

  prefNextBtn.disabled = true;
  prefNextBtn.textContent = "저장 중...";
  try {
    await savePreference();
    showPrefSuccess("성향 분석 완료\n\n이제 여행 추천에 반영됩니다.");
    setTimeout(() => {
      closePreferenceFlow();
      setMode("login");
    }, 1000);
  } catch (err) {
    showPrefAlert(err.message || "성향 저장 실패");
  } finally {
    prefNextBtn.disabled = false;
    prefNextBtn.textContent = "완료";
  }
}

function handlePrefPrev() {
  clearPrefMessages();
  if (prefStep > 0) prefStep -= 1;
  renderPrefStep();
}

submitBtn.addEventListener("click", handleSubmit);
clearBtn.addEventListener("click", () => {
  clearMessages();
  resetFields();
});
switchToSignupBtn.addEventListener("click", () => setMode("signup"));
switchToLoginBtn.addEventListener("click", () => setMode("login"));
prefPrevBtn.addEventListener("click", handlePrefPrev);
prefNextBtn.addEventListener("click", handlePrefNext);

[emailEl, passwordEl, nicknameEl].forEach((el) => {
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSubmit();
  });
});

setMode("login");
closePreferenceFlow();
