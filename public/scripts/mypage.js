let SUPABASE_URL = "";
let SUPABASE_ANON_KEY = "";

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

document.addEventListener("DOMContentLoaded", async () => {
  const nameEl = document.getElementById("mypage-user-name");
  const imgEl = document.getElementById("mypage-avatar-img");
  const badgeTextEl = document.getElementById("mypage-badge-text");

  const userRaw = sessionStorage.getItem("sb_user");
  if (!userRaw) return;

  let user = {};
  let userId = null;
  let accessToken = null;

  try {
    user = JSON.parse(userRaw);
    userId = user.id;

    if (!userId) return;

    await loadConfig();
    accessToken = sessionStorage.getItem("sb_access_token");

    const headers = {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${accessToken}`
    };

    // DB에서 사용자 프로필 정보 조회
    const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users?user_id=eq.${userId}&select=nickname,profile_image`, {
      method: 'GET',
      headers
    });
    
    // DB에서 사용자 성향 뱃지 정보 조회
    const prefRes = await fetch(`${SUPABASE_URL}/rest/v1/user_preferences?user_id=eq.${userId}&select=badge`, {
      method: 'GET',
      headers
    });

    const userData = await userRes.json().catch(() => null);
    const prefData = await prefRes.json().catch(() => null);

    const nickname = userData?.[0]?.nickname || user.user_metadata?.nickname || "여행자";
    const profileImage = userData?.[0]?.profile_image || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80";
    const badge = prefData?.[0]?.badge || "새로운 여행자";

    // DOM 업데이트
    if (nameEl) nameEl.textContent = nickname;
    if (imgEl) imgEl.src = profileImage;
    if (badgeTextEl) badgeTextEl.textContent = badge;

    // 공통 헤더의 아바타 이미지도 업데이트 (app.js가 처리하지 않는 부분)
    const headerAvatarEl = document.getElementById("header-user-avatar");
    if (headerAvatarEl) {
      headerAvatarEl.src = profileImage;
    }

  } catch (error) {
    console.error("사용자 정보 로드 중 오류 발생:", error);
  }

  // 마이페이지 버튼 이벤트 핸들러 연동
  const btnSettings = document.getElementById("btn-settings");
  const btnEditProfile = document.getElementById("btn-edit-profile");
  const btnNewTrip = document.getElementById("btn-new-trip");
  const btnViewRec = document.getElementById("btn-view-recommendations");
  const linkAllTrips = document.getElementById("link-view-all-trips");
  const linkSavedDest = document.getElementById("link-view-saved-destinations");

  if (btnSettings) {
    btnSettings.addEventListener("click", () => {
      alert("설정 기능은 준비 중입니다.");
    });
  }

  const editModal = document.getElementById("edit-profile-modal");
  const editCloseBtn = document.getElementById("edit-profile-close-btn");
  const editPreview = document.getElementById("edit-profile-avatar-preview");
  const editImageInput = document.getElementById("edit-profile-image");
  const editNicknameInput = document.getElementById("edit-profile-nickname");
  const editEmailInput = document.getElementById("edit-profile-email");
  const btnSaveProfile = document.getElementById("btn-save-profile");

  if (btnEditProfile) {
    btnEditProfile.addEventListener("click", () => {
      // 모달 띄울 때 현재 값 세팅
      if(imgEl) {
        editPreview.src = imgEl.src;
        editImageInput.value = imgEl.src;
      }
      if(nameEl) {
        editNicknameInput.value = nameEl.textContent;
      }
      editEmailInput.value = user.email || "";
      editModal.classList.add("active");
    });
  }

  if (editCloseBtn) {
    editCloseBtn.addEventListener("click", () => {
      editModal.classList.remove("active");
    });
  }

  // 모달 외부 클릭 시 닫기
  if (editModal) {
    editModal.addEventListener("click", (e) => {
      if (e.target === editModal) {
        editModal.classList.remove("active");
      }
    });
  }

  // 이미지 URL 입력 시 미리보기 변경
  if (editImageInput) {
    editImageInput.addEventListener("input", (e) => {
      editPreview.src = e.target.value;
    });
  }

  // 프로필 저장
  if (btnSaveProfile) {
    btnSaveProfile.addEventListener("click", async () => {
      const newNickname = editNicknameInput.value.trim();
      const newImage = editImageInput.value.trim();

      if (!newNickname) {
        alert("닉네임을 입력해주세요.");
        return;
      }

      btnSaveProfile.textContent = "저장 중...";
      btnSaveProfile.disabled = true;

      try {
        const headers = {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${accessToken}`
        };

        const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/users?user_id=eq.${userId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            nickname: newNickname,
            profile_image: newImage
          })
        });

        if (!updateRes.ok) {
          throw new Error("업데이트 실패");
        }

        // 성공 시 DOM 바로 업데이트
        if(nameEl) nameEl.textContent = newNickname;
        if(imgEl) imgEl.src = newImage;
        
        const headerAvatarEl = document.getElementById("header-user-avatar");
        if (headerAvatarEl) headerAvatarEl.src = newImage;
        
        const authNameEl = document.getElementById("auth-user-name");
        if (authNameEl) authNameEl.textContent = `${newNickname}님`;

        // sessionStorage 업데이트
        user.user_metadata = user.user_metadata || {};
        user.user_metadata.nickname = newNickname;
        sessionStorage.setItem("sb_user", JSON.stringify(user));

        alert("프로필이 성공적으로 수정되었습니다.");
        editModal.classList.remove("active");
      } catch (err) {
        console.error("프로필 수정 오류:", err);
        alert("프로필 수정 중 오류가 발생했습니다.");
      } finally {
        btnSaveProfile.textContent = "저장하기";
        btnSaveProfile.disabled = false;
      }
    });
  }

  if (btnNewTrip) {
    btnNewTrip.addEventListener("click", () => {
      window.location.href = "./trip-create.html";
    });
  }

  if (btnViewRec) {
    btnViewRec.addEventListener("click", () => {
      window.location.href = "./destinations.html";
    });
  }

  if (linkAllTrips) {
    linkAllTrips.addEventListener("click", (e) => {
      e.preventDefault();
      alert("내 여행 전체보기 기능은 준비 중입니다.");
    });
  }

  if (linkSavedDest) {
    linkSavedDest.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "./destinations.html";
    });
  }
});
