let SUPABASE_URL = '';
let SUPABASE_ANON_KEY = '';

const $ = (id) => document.getElementById(id);

const titleEl = $('title');
const subtitleEl = $('subtitle');
const alertEl = $('alert');
const successEl = $('success');
const nicknameWrapEl = $('nicknameWrap');
const nicknameEl = $('nickname');
const emailEl = $('email');
const passwordEl = $('password');
const submitBtn = $('submitBtn');
const clearBtn = $('clearBtn');
const switchToSignupBtn = $('switchToSignup');
const switchToLoginBtn = $('switchToLogin');
const googleLoginBtn = $('googleLoginBtn');
const kakaoLoginBtn = $('kakaoLoginBtn');

let mode = 'login';
let redirectTimer = null;
const OAUTH_STATE_KEY = 'sb_oauth_redirect';

async function loadConfig() {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) return;

  const response = await fetch('/api/config');
  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.success) {
    throw new Error('로그인 설정 정보를 불러오지 못했습니다.');
  }

  SUPABASE_URL = result.data.supabaseUrl;
  SUPABASE_ANON_KEY = result.data.supabaseAnonKey;
}

function showAlert(message) {
  alertEl.textContent = message;
  alertEl.style.display = 'block';
  successEl.style.display = 'none';
}

function showSuccess(message) {
  successEl.textContent = message;
  successEl.style.display = 'block';
  alertEl.style.display = 'none';
}

function clearMessages() {
  alertEl.style.display = 'none';
  successEl.style.display = 'none';
  alertEl.textContent = '';
  successEl.textContent = '';
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function resetFields() {
  emailEl.value = '';
  passwordEl.value = '';
  nicknameEl.value = '';
}

function setMode(nextMode) {
  mode = nextMode;
  clearMessages();
  resetFields();

  if (mode === 'signup') {
    titleEl.textContent = '회원가입';
    subtitleEl.hidden = false;
    subtitleEl.textContent = '새 계정을 만들고 여행 계획을 시작하세요.';
    nicknameWrapEl.hidden = false;
    submitBtn.textContent = '회원가입';
    switchToSignupBtn.hidden = true;
    switchToLoginBtn.hidden = false;
  } else {
    titleEl.textContent = '로그인';
    subtitleEl.hidden = true;
    subtitleEl.textContent = '';
    nicknameWrapEl.hidden = true;
    submitBtn.textContent = '로그인';
    switchToSignupBtn.hidden = false;
    switchToLoginBtn.hidden = true;
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function redirectToMainPage() {
  if (redirectTimer) clearTimeout(redirectTimer);
  redirectTimer = setTimeout(() => {
    const redirectPath = new URLSearchParams(window.location.search).get('redirect');
    window.location.replace(redirectPath || '../index.html');
  }, 700);
}

function getOAuthRedirectUrl() {
  return `${window.location.origin}/pages/login.html`;
}

async function startOAuthLogin(provider) {
  await loadConfig();

  const redirectUrl = getOAuthRedirectUrl();
  sessionStorage.setItem(
    OAUTH_STATE_KEY,
    JSON.stringify({
      provider,
      redirect: new URLSearchParams(window.location.search).get('redirect') || '../index.html',
    })
  );

  const authorizeUrl = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
  authorizeUrl.searchParams.set('provider', provider);
  authorizeUrl.searchParams.set('redirect_to', redirectUrl);
  window.location.href = authorizeUrl.toString();
}

function parseOAuthCallback() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  if (!accessToken) return null;
  return {
    access_token: accessToken,
    refresh_token: refreshToken || '',
    expires_in: hash.get('expires_in') || '',
    token_type: hash.get('token_type') || 'bearer',
  };
}

function redirectToSurveyPage() {
  if (redirectTimer) clearTimeout(redirectTimer);
  redirectTimer = setTimeout(() => {
    window.location.replace('./survey.html');
  }, 700);
}

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error_description || data?.msg || data?.message || '로그인 실패');
  }
  return data;
}

async function signUp(email, password, nickname) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      email,
      password,
      data: { nickname },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error_description || data?.msg || data?.message || '회원가입 실패');
  }
  return data;
}

async function handleSubmit() {
  clearMessages();

  const email = emailEl.value.trim();
  const password = passwordEl.value;
  if (!email || !password) {
    showAlert('이메일과 비밀번호를 입력하세요.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = mode === 'signup' ? '가입 중...' : '로그인 중...';

  try {
    await loadConfig();

    if (mode === 'login') {
      const data = await signIn(email, password);
      sessionStorage.setItem('sb_access_token', data.access_token || '');
      sessionStorage.setItem('sb_refresh_token', data.refresh_token || '');
      sessionStorage.setItem('sb_user', JSON.stringify(data.user || {}));
      showSuccess(
        `로그인 성공\n\n이메일: ${data.user?.email || email}\n닉네임: ${data.user?.user_metadata?.nickname || '없음'}`
      );
      redirectToMainPage();
    } else {
      const nickname = nicknameEl.value.trim();
      if (!nickname) {
        showAlert('닉네임을 입력하세요.');
        return;
      }
      const data = await signUp(email, password, nickname);
      sessionStorage.setItem('sb_user', JSON.stringify(data.user || { email, user_metadata: { nickname } }));
      sessionStorage.setItem('sb_access_token', data.access_token || '');
      sessionStorage.setItem('sb_refresh_token', data.refresh_token || '');
      showSuccess(`회원가입 성공\n\n이메일: ${email}\n닉네임: ${nickname}\n성향 분석 페이지로 이동합니다.`);
      redirectToSurveyPage();
    }
  } catch (err) {
    showAlert(err?.message || '요청 실패');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = mode === 'signup' ? '회원가입' : '로그인';
  }
}

async function handleOAuthReturn() {
  const callback = parseOAuthCallback();
  if (!callback) return;

  try {
    await loadConfig();
    const state = safeJson(sessionStorage.getItem(OAUTH_STATE_KEY) || '{}');
    sessionStorage.removeItem(OAUTH_STATE_KEY);

    const accessToken = callback.access_token;
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const userData = await userRes.json().catch(() => ({}));
    if (!userRes.ok) {
      throw new Error(userData?.message || '소셜 로그인 정보를 불러오지 못했습니다.');
    }

    sessionStorage.setItem('sb_access_token', accessToken);
    sessionStorage.setItem('sb_refresh_token', callback.refresh_token || '');
    sessionStorage.setItem('sb_user', JSON.stringify(userData || {}));

    const redirectPath = state.redirect || '../index.html';
    window.location.replace(redirectPath);
  } catch (error) {
    showAlert(error?.message || '소셜 로그인 처리에 실패했습니다.');
  } finally {
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }
}

submitBtn.addEventListener('click', handleSubmit);
clearBtn.addEventListener('click', () => {
  clearMessages();
  resetFields();
});
switchToSignupBtn.addEventListener('click', () => setMode('signup'));
switchToLoginBtn.addEventListener('click', () => setMode('login'));
googleLoginBtn?.addEventListener('click', () => startOAuthLogin('google'));
kakaoLoginBtn?.addEventListener('click', () => startOAuthLogin('custom:kakao'));

[emailEl, passwordEl, nicknameEl].forEach((el) => {
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSubmit();
  });
});

setMode('login');
handleOAuthReturn();
