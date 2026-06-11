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
const agreementWrapEl = $('agreementWrap');
const agreeAllEl = $('agreeAll');
const agreeTermsEl = $('agreeTerms');
const agreePrivacyEl = $('agreePrivacy');
const agreementModalEl = $('agreementModal');
const agreementModalTitleEl = $('agreementModalTitle');
const agreementModalBodyEl = $('agreementModalBody');
const agreementModalCloseBtn = $('agreementModalClose');
const agreementModalConfirmBtn = $('agreementModalConfirm');
const socialAgreementModalEl = $('socialAgreementModal');
const socialAgreementCloseBtn = $('socialAgreementClose');
const socialAgreementConfirmBtn = $('socialAgreementConfirm');
const socialAgreementAlertEl = $('socialAgreementAlert');
const socialAgreeAllEl = $('socialAgreeAll');
const socialAgreeTermsEl = $('socialAgreeTerms');
const socialAgreePrivacyEl = $('socialAgreePrivacy');
const socialProfileModalEl = $('socialProfileModal');
const socialProfileAlertEl = $('socialProfileAlert');
const socialProfilePreviewEl = $('socialProfilePreview');
const socialProfileImageEl = $('socialProfileImage');
const socialProfileNicknameEl = $('socialProfileNickname');
const socialProfileConfirmBtn = $('socialProfileConfirm');

let mode = 'login';
let redirectTimer = null;
let pendingAgreementContext = null;
let pendingProfileContext = null;
let selectedSocialProfileFile = null;
const OAUTH_STATE_KEY = 'sb_oauth_redirect';
const TERMS_VERSION = '2026-06-11';
const PRIVACY_VERSION = '2026-06-11';

const AGREEMENT_CONTENT = {
  terms: {
    title: '이용약관',
    html: `
      <article class="auth-policy-content">
        <h3>제1조 목적</h3>
        <p>본 약관은 Packing이 제공하는 국내 여행지 추천, 성향 분석, 여행 일정 생성 및 저장 서비스의 이용 조건과 절차를 정합니다.</p>
        <h3>제2조 서비스 제공 범위</h3>
        <p>서비스는 사용자의 입력 정보와 저장된 관광지 데이터를 바탕으로 국내 여행 추천 및 일정 생성 기능을 제공합니다. 추천 결과는 참고용이며 실제 이동 가능 여부, 운영 시간, 비용 등은 사용자가 최종 확인해야 합니다.</p>
        <h3>제3조 회원의 의무</h3>
        <p>회원은 타인의 계정을 사용하거나 허위 정보를 입력해서는 안 되며, 서비스 운영을 방해하는 행위를 할 수 없습니다.</p>
        <h3>제4조 계정 및 데이터 관리</h3>
        <p>회원은 본인의 계정 정보를 안전하게 관리해야 합니다. 회원이 생성한 여행 일정, 북마크, 성향 분석 결과는 서비스 제공을 위해 저장될 수 있습니다.</p>
        <h3>제5조 서비스 변경 및 중단</h3>
        <p>서비스는 개발 및 운영 상황에 따라 기능이 변경되거나 일시 중단될 수 있으며, 중요한 변경 사항은 서비스 화면 또는 별도 공지로 안내합니다.</p>
      </article>
    `,
  },
  privacy: {
    title: '개인정보 처리방침',
    html: `
      <article class="auth-policy-content">
        <h3>1. 수집하는 개인정보</h3>
        <p>Packing은 회원가입 및 로그인 과정에서 이메일, 닉네임, 소셜 로그인 식별자와 같은 계정 정보를 수집할 수 있습니다. 서비스 이용 중 성향 분석 결과, 저장한 여행지, 생성한 여행 일정 정보가 함께 저장될 수 있습니다.</p>
        <h3>2. 개인정보 이용 목적</h3>
        <p>수집한 정보는 회원 식별, 로그인 유지, 여행 성향 기반 추천, 여행 일정 저장 및 조회, 서비스 오류 대응을 위해 사용합니다.</p>
        <h3>3. 보관 및 삭제</h3>
        <p>개인정보는 회원이 서비스를 이용하는 동안 보관하며, 회원 탈퇴 또는 삭제 요청 시 관련 법령과 내부 보관 기준에 따라 삭제합니다.</p>
        <h3>4. 제3자 제공</h3>
        <p>서비스는 사용자의 개인정보를 별도 동의 없이 외부에 판매하거나 제공하지 않습니다. 단, Supabase 등 서비스 운영에 필요한 인프라 제공자는 데이터 처리 과정에 관여할 수 있습니다.</p>
        <h3>5. 이용자의 권리</h3>
        <p>이용자는 본인의 개인정보 조회, 수정, 삭제를 요청할 수 있으며, 서비스 운영자는 가능한 범위에서 이를 처리합니다.</p>
      </article>
    `,
  },
};

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
  resetAgreementChecks();
  resetSocialAgreementChecks();
}

function resetAgreementChecks() {
  [agreeAllEl, agreeTermsEl, agreePrivacyEl].forEach((checkbox) => {
    if (checkbox) checkbox.checked = false;
  });
}

function resetSocialAgreementChecks() {
  [socialAgreeAllEl, socialAgreeTermsEl, socialAgreePrivacyEl].forEach((checkbox) => {
    if (checkbox) checkbox.checked = false;
  });
}

function syncAgreementAllCheckbox(allCheckbox, requiredCheckboxes) {
  if (!allCheckbox) return;
  allCheckbox.checked = requiredCheckboxes.every((checkbox) => checkbox?.checked);
}

function setAgreementGroupChecked(checked, allCheckbox, requiredCheckboxes) {
  if (allCheckbox) allCheckbox.checked = checked;
  requiredCheckboxes.forEach((checkbox) => {
    if (checkbox) checkbox.checked = checked;
  });
}

function hasRequiredAgreement() {
  return Boolean(agreeTermsEl?.checked && agreePrivacyEl?.checked);
}

function hasRequiredSocialAgreement() {
  return Boolean(socialAgreeTermsEl?.checked && socialAgreePrivacyEl?.checked);
}

function openAgreementModal(type) {
  const agreement = AGREEMENT_CONTENT[type];
  if (!agreement || !agreementModalEl) return;

  agreementModalTitleEl.textContent = agreement.title;
  agreementModalBodyEl.innerHTML = agreement.html;
  agreementModalEl.classList.add('active');
  agreementModalEl.setAttribute('aria-hidden', 'false');

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function closeAgreementModal() {
  agreementModalEl?.classList.remove('active');
  agreementModalEl?.setAttribute('aria-hidden', 'true');
}

function openSocialAgreementModal(context) {
  pendingAgreementContext = context;
  resetSocialAgreementChecks();
  if (socialAgreementAlertEl) {
    socialAgreementAlertEl.textContent = '';
    socialAgreementAlertEl.style.display = 'none';
  }
  socialAgreementModalEl?.classList.add('active');
  socialAgreementModalEl?.setAttribute('aria-hidden', 'false');

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function closeSocialAgreementModal() {
  pendingAgreementContext = null;
  if (socialAgreementAlertEl) {
    socialAgreementAlertEl.textContent = '';
    socialAgreementAlertEl.style.display = 'none';
  }
  socialAgreementModalEl?.classList.remove('active');
  socialAgreementModalEl?.setAttribute('aria-hidden', 'true');
}

function showSocialAgreementAlert(message) {
  if (!socialAgreementAlertEl) {
    showAlert(message);
    return;
  }
  socialAgreementAlertEl.textContent = message;
  socialAgreementAlertEl.style.display = 'block';
}

function getDefaultProfileImage(nickname) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(nickname || 'User')}&background=1a5c3a&color=fff&size=160`;
}

function requiresSocialProfileSetup(userData) {
  const appMetadata = userData?.app_metadata || {};
  const providers = [
    appMetadata.provider,
    ...(Array.isArray(appMetadata.providers) ? appMetadata.providers : []),
  ]
    .filter(Boolean)
    .map((provider) => String(provider).toLowerCase());

  return providers.some(
    (provider) => provider === 'google' || provider.includes('kakao'),
  );
}

function showSocialProfileAlert(message) {
  if (!socialProfileAlertEl) return;
  socialProfileAlertEl.textContent = message;
  socialProfileAlertEl.style.display = 'block';
}

async function getUserProfile(accessToken, userId) {
  const url = new URL(getSupabaseRestUrl('/rest/v1/users'));
  url.searchParams.set('select', 'nickname,profile_image,profile_completed');
  url.searchParams.set('user_id', `eq.${userId}`);
  url.searchParams.set('limit', '1');

  const response = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(data?.message || '프로필 정보를 불러오지 못했습니다.');
  }
  return Array.isArray(data) ? data[0] || null : null;
}

async function openSocialProfileModal(context) {
  const profile =
    context.profile ||
    (await getUserProfile(context.accessToken, context.userId));
  const metadata = context.userData?.user_metadata || {};
  const nickname =
    profile?.nickname ||
    metadata.nickname ||
    metadata.name ||
    metadata.full_name ||
    '';
  const profileImage =
    profile?.profile_image ||
    metadata.avatar_url ||
    metadata.picture ||
    metadata.profile_image ||
    getDefaultProfileImage(nickname);

  pendingProfileContext = context;
  selectedSocialProfileFile = null;
  socialProfileImageEl.value = '';
  socialProfileNicknameEl.value = nickname;
  socialProfilePreviewEl.src = profileImage;
  socialProfileAlertEl.textContent = '';
  socialProfileAlertEl.style.display = 'none';
  socialProfileModalEl.classList.add('active');
  socialProfileModalEl.setAttribute('aria-hidden', 'false');
  socialProfileNicknameEl.focus();
}

async function uploadSocialProfileImage(accessToken, userId, file) {
  const extension = file.name.split('.').pop() || 'jpg';
  const fileName = `${userId}-${Date.now()}.${extension}`;
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/avatars/${fileName}`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': file.type,
      },
      body: file,
    },
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || '프로필 이미지 업로드에 실패했습니다.');
  }

  return `${SUPABASE_URL}/storage/v1/object/public/avatars/${fileName}`;
}

async function saveSocialProfile({
  accessToken,
  userId,
  nickname,
  profileImage,
}) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/users?user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        nickname,
        profile_image: profileImage,
        profile_completed: true,
      }),
    },
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || '프로필 저장에 실패했습니다.');
  }
}

function getSupabaseRestUrl(path) {
  return `${SUPABASE_URL.replace(/\/$/, '')}${path}`;
}

async function getUserAgreement(accessToken, userId) {
  const url = new URL(getSupabaseRestUrl('/rest/v1/user_agreements'));
  url.searchParams.set('select', 'user_id');
  url.searchParams.set('user_id', `eq.${userId}`);
  url.searchParams.set('limit', '1');

  const response = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(data?.message || '약관 동의 정보를 확인하지 못했습니다.');
  }
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

async function saveUserAgreement(accessToken, userId, agreedAt = new Date().toISOString()) {
  if (!accessToken || !userId) return;

  const existingAgreement = await getUserAgreement(accessToken, userId);
  if (existingAgreement) return;

  const response = await fetch(getSupabaseRestUrl('/rest/v1/user_agreements'), {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      user_id: userId,
      terms_agreed_at: agreedAt,
      privacy_agreed_at: agreedAt,
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
    }),
  });

  if (!response.ok && response.status !== 409) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || '약관 동의 정보를 저장하지 못했습니다.');
  }
}

function setMode(nextMode) {
  mode = nextMode;
  clearMessages();
  resetFields();
  if (agreementWrapEl) {
    agreementWrapEl.hidden = mode !== 'signup';
  }

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

async function redirectAfterAgreementCheck(
  accessToken,
  userId,
  redirectPath,
  userData,
) {
  const isSocialLogin = requiresSocialProfileSetup(userData);
  const profile = isSocialLogin
    ? await getUserProfile(accessToken, userId)
    : null;
  const context = {
    accessToken,
    userId,
    redirectPath,
    userData,
    profile,
    requiresProfileSetup:
      isSocialLogin && profile?.profile_completed !== true,
  };
  const agreement = await getUserAgreement(accessToken, userId);
  if (agreement) {
    if (context.requiresProfileSetup) {
      await openSocialProfileModal(context);
    } else {
      window.location.replace(redirectPath);
    }
    return;
  }

  openSocialAgreementModal(context);
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
    const rawMessage = data?.error_description || data?.msg || data?.message || '';
    const normalizedMessage = rawMessage.toLowerCase();
    if (
      normalizedMessage.includes('invalid login credentials') ||
      normalizedMessage.includes('invalid credentials')
    ) {
      throw new Error('가입되지 않은 이메일이거나 비밀번호가 올바르지 않습니다. 아직 회원이 아니라면 회원가입을 먼저 진행해주세요.');
    }
    throw new Error(rawMessage || '로그인 실패');
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

  if (mode === 'signup' && !hasRequiredAgreement()) {
    showAlert('이용약관과 개인정보 처리방침에 동의해주세요.');
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
      const redirectPath = new URLSearchParams(window.location.search).get('redirect') || '../index.html';
      await redirectAfterAgreementCheck(
        data.access_token,
        data.user?.id,
        redirectPath,
        data.user,
      );
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
      await saveUserAgreement(data.access_token, data.user?.id);
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
    await redirectAfterAgreementCheck(
      accessToken,
      userData.id,
      redirectPath,
      userData,
    );
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

agreeAllEl?.addEventListener('change', () => {
  setAgreementGroupChecked(agreeAllEl.checked, agreeAllEl, [agreeTermsEl, agreePrivacyEl]);
});
[agreeTermsEl, agreePrivacyEl].forEach((checkbox) => {
  checkbox?.addEventListener('change', () => syncAgreementAllCheckbox(agreeAllEl, [agreeTermsEl, agreePrivacyEl]));
});

socialAgreeAllEl?.addEventListener('change', () => {
  setAgreementGroupChecked(socialAgreeAllEl.checked, socialAgreeAllEl, [
    socialAgreeTermsEl,
    socialAgreePrivacyEl,
  ]);
});
[socialAgreeTermsEl, socialAgreePrivacyEl].forEach((checkbox) => {
  checkbox?.addEventListener('change', () => {
    syncAgreementAllCheckbox(socialAgreeAllEl, [socialAgreeTermsEl, socialAgreePrivacyEl]);
  });
});

document.querySelectorAll('[data-agreement-view]').forEach((button) => {
  button.addEventListener('click', () => openAgreementModal(button.dataset.agreementView));
});

agreementModalCloseBtn?.addEventListener('click', closeAgreementModal);
agreementModalConfirmBtn?.addEventListener('click', closeAgreementModal);
agreementModalEl?.addEventListener('click', (event) => {
  if (event.target === agreementModalEl) closeAgreementModal();
});

socialAgreementCloseBtn?.addEventListener('click', closeSocialAgreementModal);
socialAgreementModalEl?.addEventListener('click', (event) => {
  if (event.target === socialAgreementModalEl) closeSocialAgreementModal();
});
socialAgreementConfirmBtn?.addEventListener('click', async () => {
  if (!hasRequiredSocialAgreement()) {
    showSocialAgreementAlert('서비스 이용을 계속하려면 이용약관과 개인정보 처리방침에 동의해주세요.');
    return;
  }
  if (!pendingAgreementContext) {
    showSocialAgreementAlert('로그인 정보를 확인하지 못했습니다. 다시 로그인해주세요.');
    return;
  }

  const {
    accessToken,
    userId,
    redirectPath,
    userData,
    requiresProfileSetup,
  } = pendingAgreementContext;
  socialAgreementConfirmBtn.disabled = true;
  socialAgreementConfirmBtn.textContent = '저장 중...';

  try {
    await saveUserAgreement(accessToken, userId);
    closeSocialAgreementModal();
    if (requiresProfileSetup) {
      await openSocialProfileModal({
        accessToken,
        userId,
        redirectPath,
        userData,
        requiresProfileSetup,
      });
    } else {
      window.location.replace(redirectPath || '../index.html');
    }
  } catch (error) {
    showSocialAgreementAlert(error?.message || '약관 동의 정보를 저장하지 못했습니다.');
  } finally {
    socialAgreementConfirmBtn.disabled = false;
    socialAgreementConfirmBtn.textContent = '동의하고 계속하기';
  }
});

socialProfileImageEl?.addEventListener('change', () => {
  const [file] = socialProfileImageEl.files || [];
  if (!file) return;

  selectedSocialProfileFile = file;
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    socialProfilePreviewEl.src = String(reader.result || '');
  });
  reader.readAsDataURL(file);
});

socialProfileConfirmBtn?.addEventListener('click', async () => {
  const nickname = socialProfileNicknameEl.value.trim();
  if (!nickname) {
    showSocialProfileAlert('닉네임을 입력해주세요.');
    return;
  }
  if (!pendingProfileContext) {
    showSocialProfileAlert('로그인 정보를 확인하지 못했습니다. 다시 로그인해주세요.');
    return;
  }

  socialProfileConfirmBtn.disabled = true;
  socialProfileConfirmBtn.textContent = '저장 중...';

  try {
    const { accessToken, userId, redirectPath, userData } =
      pendingProfileContext;
    let profileImage = socialProfilePreviewEl.src;

    if (selectedSocialProfileFile) {
      profileImage = await uploadSocialProfileImage(
        accessToken,
        userId,
        selectedSocialProfileFile,
      );
    }

    await saveSocialProfile({
      accessToken,
      userId,
      nickname,
      profileImage,
    });

    const storedUser = {
      ...(userData || safeJson(sessionStorage.getItem('sb_user') || '{}')),
    };
    storedUser.user_metadata = {
      ...(storedUser.user_metadata || {}),
      nickname,
      profile_image: profileImage,
    };
    sessionStorage.setItem('sb_user', JSON.stringify(storedUser));
    window.location.replace(redirectPath || '../index.html');
  } catch (error) {
    showSocialProfileAlert(error?.message || '프로필 저장에 실패했습니다.');
  } finally {
    socialProfileConfirmBtn.disabled = false;
    socialProfileConfirmBtn.textContent = '프로필 저장하고 시작하기';
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  closeAgreementModal();
  if (!socialProfileModalEl?.classList.contains('active')) {
    closeSocialAgreementModal();
  }
});

[emailEl, passwordEl, nicknameEl].forEach((el) => {
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSubmit();
  });
});

setMode('login');
handleOAuthReturn();
