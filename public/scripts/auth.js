(function initializeAuthService() {
  const SESSION_KEYS = {
    accessToken: "sb_access_token",
    refreshToken: "sb_refresh_token",
    user: "sb_user",
  };

  let configPromise;

  function getStorage(remember) {
    return remember ? localStorage : sessionStorage;
  }

  async function loadPublicConfig() {
    if (window.APP_CONFIG?.supabaseUrl && window.APP_CONFIG?.supabaseAnonKey) {
      return window.APP_CONFIG;
    }

    if (!configPromise) {
      configPromise = fetch("/api/config/public")
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("공개 환경 설정을 불러오지 못했습니다.");
          }

          return response.json();
        })
        .then((response) => response.data || response);
    }

    const config = await configPromise;

    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      throw new Error("Supabase 환경 변수가 설정되지 않았습니다.");
    }

    return config;
  }

  async function requestAuth(path, body) {
    const config = await loadPublicConfig();
    const response = await fetch(`${config.supabaseUrl}/auth/v1/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.supabaseAnonKey,
      },
      body: JSON.stringify(body),
    });
    const responseBody = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        responseBody.error_description ||
          responseBody.msg ||
          responseBody.message ||
          "인증 요청에 실패했습니다.",
      );
    }

    return responseBody;
  }

  function saveSession(authData, remember) {
    const storage = getStorage(remember);
    const otherStorage = remember ? sessionStorage : localStorage;

    Object.values(SESSION_KEYS).forEach((key) => otherStorage.removeItem(key));
    storage.setItem(SESSION_KEYS.accessToken, authData.access_token || "");
    storage.setItem(SESSION_KEYS.refreshToken, authData.refresh_token || "");
    storage.setItem(SESSION_KEYS.user, JSON.stringify(authData.user || {}));
  }

  function getSessionValue(key) {
    return sessionStorage.getItem(key) || localStorage.getItem(key) || "";
  }

  function getSession() {
    let user = {};

    try {
      user = JSON.parse(getSessionValue(SESSION_KEYS.user) || "{}");
    } catch {
      user = {};
    }

    return {
      accessToken: getSessionValue(SESSION_KEYS.accessToken),
      refreshToken: getSessionValue(SESSION_KEYS.refreshToken),
      user,
    };
  }

  function clearSession() {
    [sessionStorage, localStorage].forEach((storage) => {
      Object.values(SESSION_KEYS).forEach((key) => storage.removeItem(key));
    });
  }

  async function signIn({ email, password, remember }) {
    const authData = await requestAuth("token?grant_type=password", {
      email,
      password,
    });
    saveSession(authData, remember);
    return authData;
  }

  async function signUp({ email, password, nickname }) {
    const authData = await requestAuth("signup", {
      email,
      password,
      data: { nickname },
    });
    saveSession(authData, false);
    return authData;
  }

  async function saveMbtiResult(result) {
    const session = getSession();

    if (!session.accessToken || !session.user.id) {
      return;
    }

    const config = await loadPublicConfig();
    const response = await fetch(
      `${config.supabaseUrl}/rest/v1/travel_mbti_results?on_conflict=user_id`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${session.accessToken}`,
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          user_id: session.user.id,
          mbti_type: result.mbtiType,
          ei_score: result.scores.ei,
          sn_score: result.scores.sn,
          tf_score: result.scores.tf,
          jp_score: result.scores.jp,
          raw_answers: result.rawAnswers,
        }),
      },
    );

    if (!response.ok) {
      const responseBody = await response.json().catch(() => ({}));
      throw new Error(responseBody.message || "MBTI 결과 저장에 실패했습니다.");
    }
  }

  window.authService = {
    clearSession,
    getSession,
    saveMbtiResult,
    signIn,
    signUp,
  };
})();
