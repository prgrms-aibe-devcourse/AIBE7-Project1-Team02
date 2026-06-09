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

let mode = 'login';
let redirectTimer = null;

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
    subtitleEl.textContent = '새 계정을 만들고 여행 계획을 시작하세요.';
    nicknameWrapEl.hidden = false;
    submitBtn.textContent = '회원가입';
    switchToSignupBtn.hidden = true;
    switchToLoginBtn.hidden = false;
  } else {
    titleEl.textContent = '로그인';
    subtitleEl.textContent = 'Supabase 계정으로 로그인하세요.';
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
      showSuccess(`회원가입 성공\n\n이메일: ${email}\n닉네임: ${nickname}`);
      setTimeout(() => setMode('login'), 700);
    }
  } catch (err) {
    showAlert(err?.message || '요청 실패');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = mode === 'signup' ? '회원가입' : '로그인';
  }
}

submitBtn.addEventListener('click', handleSubmit);
clearBtn.addEventListener('click', () => {
  clearMessages();
  resetFields();
});
switchToSignupBtn.addEventListener('click', () => setMode('signup'));
switchToLoginBtn.addEventListener('click', () => setMode('login'));

[emailEl, passwordEl, nicknameEl].forEach((el) => {
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSubmit();
  });
});

setMode('login');
