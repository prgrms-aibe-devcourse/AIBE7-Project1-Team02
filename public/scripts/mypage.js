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
    const profileImage = userData?.[0]?.profile_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(nickname)}&background=1a5c3a&color=fff&size=160`;
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

    // AI 추천 데이터 조회
    try {
      const recRes = await fetch("/api/destinations/recommended?limit=1", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const recData = await recRes.json().catch(() => null);
      
      if (recRes.ok && recData && recData.success && recData.data && recData.data.mbtiType && recData.data.recommendations.length > 0) {
        const rec = recData.data.recommendations[0];
        
        const aiBannerTitle = document.getElementById("mypage-ai-title");
        const aiBannerDesc = document.getElementById("mypage-ai-desc");
        const aiBannerBtn = document.getElementById("mypage-ai-btn");
        const aiBannerBg = document.getElementById("mypage-ai-bg");

        if (aiBannerTitle) {
          aiBannerTitle.textContent = `${recData.data.mbtiType} 여행자님을 위한 추천!`;
        }
        if (aiBannerDesc) {
          aiBannerDesc.innerHTML = `이번 여행은 <strong style="color: #fbbf24">${rec.destinationName}</strong> 어떠신가요?<br><span style="font-size:0.9rem; opacity:0.9; margin-top:0.3rem; display:block;">${rec.reason || rec.description}</span>`;
        }
        if (aiBannerBtn) {
          aiBannerBtn.innerHTML = `추천 여행지 전체보기 <i data-lucide="arrow-right"></i>`;
          aiBannerBtn.href = "../index.html";
        }
        if (aiBannerBg && rec.imageUrl) {
          aiBannerBg.style.backgroundImage = `url('${rec.imageUrl}')`;
          aiBannerBg.style.backgroundColor = "transparent";
          aiBannerBg.style.backgroundSize = "cover";
          aiBannerBg.style.backgroundPosition = "center";
        }
      }
    } catch (err) {
      console.error("추천 데이터 로드 실패:", err);
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

  const settingsModal = document.getElementById("settings-modal");
  const settingsCloseBtn = document.getElementById("settings-close-btn");
  const settingsTabs = document.querySelectorAll(".settings-tab");
  const settingsTabContents = document.querySelectorAll(".settings-tab-content");
  const btnChangePassword = document.getElementById("btn-change-password");
  const btnDeleteAccount = document.getElementById("btn-delete-account");
  const btnResetData = document.getElementById("btn-reset-data");
  const inputNewPassword = document.getElementById("settings-new-password");

  if (btnSettings) {
    btnSettings.addEventListener("click", () => {
      if (settingsModal) settingsModal.classList.add("active");
    });
  }

  if (settingsCloseBtn) {
    settingsCloseBtn.addEventListener("click", () => {
      settingsModal.classList.remove("active");
    });
  }

  if (settingsModal) {
    settingsModal.addEventListener("click", (e) => {
      if (e.target === settingsModal) {
        settingsModal.classList.remove("active");
      }
    });
  }

  settingsTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      settingsTabs.forEach(t => t.classList.remove("active"));
      settingsTabContents.forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      const targetContent = document.getElementById(`settings-tab-${tab.dataset.tab}`);
      if (targetContent) targetContent.classList.add("active");
    });
  });

  // 비밀번호 변경
  if (btnChangePassword) {
    btnChangePassword.addEventListener("click", async () => {
      const newPassword = inputNewPassword.value;
      if (newPassword.length < 6) {
        alert("비밀번호는 6자 이상이어야 합니다.");
        return;
      }
      if (!confirm("비밀번호를 변경하시겠습니까?")) return;

      try {
        btnChangePassword.disabled = true;
        btnChangePassword.textContent = "변경 중...";
        
        const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${accessToken}`
          },
          body: JSON.stringify({ password: newPassword })
        });
        
        if (!res.ok) {
          const errData = await res.json().catch(()=>({}));
          throw new Error(errData.msg || "비밀번호 변경 실패");
        }
        
        alert("비밀번호가 성공적으로 변경되었습니다.");
        inputNewPassword.value = "";
      } catch (err) {
        alert(err.message);
      } finally {
        btnChangePassword.disabled = false;
        btnChangePassword.textContent = "비밀번호 변경";
      }
    });
  }

  // 데이터 초기화
  if (btnResetData) {
    btnResetData.addEventListener("click", async () => {
      if (!confirm("모든 활동 데이터(MBTI 결과, 여행지 저장, 일정 등)를 삭제합니다.\n이 작업은 복구할 수 없습니다. 계속하시겠습니까?")) return;

      try {
        btnResetData.disabled = true;
        btnResetData.textContent = "삭제 중...";
        
        const headers = {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${accessToken}`
        };

        await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/user_preferences?user_id=eq.${userId}`, { method: 'DELETE', headers }),
          fetch(`${SUPABASE_URL}/rest/v1/travel_mbti_results?user_id=eq.${userId}`, { method: 'DELETE', headers }),
          fetch(`${SUPABASE_URL}/rest/v1/trips?user_id=eq.${userId}`, { method: 'DELETE', headers })
        ]);

        alert("모든 데이터가 성공적으로 초기화되었습니다.");
        window.location.reload();
      } catch (err) {
        console.error(err);
        alert("데이터 초기화 중 오류가 발생했습니다.");
      } finally {
        btnResetData.disabled = false;
        btnResetData.textContent = "내 데이터 모두 지우기";
      }
    });
  }

  // 회원 탈퇴 (Hard Delete)
  if (btnDeleteAccount) {
    btnDeleteAccount.addEventListener("click", async () => {
      if (!confirm("정말 탈퇴하시겠습니까?\n모든 계정 정보와 데이터가 완전히 삭제되며 복구할 수 없습니다.")) return;

      try {
        btnDeleteAccount.disabled = true;
        btnDeleteAccount.textContent = "탈퇴 처리 중...";

        const res = await fetch("/api/user/account", {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${accessToken}`
          }
        });
        
        const data = await res.json().catch(()=>({}));
        
        if (!res.ok || !data.success) {
          throw new Error(data.message || "회원 탈퇴에 실패했습니다.");
        }

        alert("회원 탈퇴가 정상적으로 처리되었습니다.\n그동안 이용해 주셔서 감사합니다.");
        sessionStorage.clear();
        window.location.replace("./login.html");
      } catch (err) {
        alert(err.message);
        btnDeleteAccount.disabled = false;
        btnDeleteAccount.textContent = "회원 탈퇴";
      }
    });
  }

  const editModal = document.getElementById("edit-profile-modal");
  const editCloseBtn = document.getElementById("edit-profile-close-btn");
  const editPreview = document.getElementById("edit-profile-avatar-preview");
  const editImageInput = document.getElementById("edit-profile-image");
  const editNicknameInput = document.getElementById("edit-profile-nickname");
  const btnSaveProfile = document.getElementById("btn-save-profile");
  
  let selectedProfileFile = null;

  if (btnEditProfile) {
    btnEditProfile.addEventListener("click", () => {
      // 모달 띄울 때 현재 값 세팅
      if(imgEl) {
        editPreview.src = imgEl.src;
      }
      if(nameEl) {
        editNicknameInput.value = nameEl.textContent;
      }
      editImageInput.value = ""; // 파일 입력란 초기화
      selectedProfileFile = null;
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

  // 이미지 파일 선택 시 미리보기 변경 및 파일 객체 저장
  if (editImageInput) {
    editImageInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        selectedProfileFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => {
          editPreview.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // 프로필 저장
  if (btnSaveProfile) {
    btnSaveProfile.addEventListener("click", async () => {
      const newNickname = editNicknameInput.value.trim();
      let newImage = editPreview.src; // 기본적으로 현재 미리보기 된 주소 사용

      if (!newNickname) {
        alert("닉네임을 입력해주세요.");
        return;
      }

      btnSaveProfile.textContent = "저장 중...";
      btnSaveProfile.disabled = true;

      try {
        const baseHeaders = {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${accessToken}`
        };

        // 이미지 파일이 새로 선택된 경우 Supabase Storage(avatars)에 업로드
        if (selectedProfileFile) {
          const fileExt = selectedProfileFile.name.split('.').pop();
          const fileName = `${userId}-${Date.now()}.${fileExt}`;
          
          const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${fileName}`, {
            method: 'POST',
            headers: {
              ...baseHeaders,
              "Content-Type": selectedProfileFile.type
            },
            body: selectedProfileFile
          });

          if (!uploadRes.ok) {
            const errData = await uploadRes.json().catch(()=>({}));
            throw new Error(errData.message || "이미지 업로드 실패");
          }

          newImage = `${SUPABASE_URL}/storage/v1/object/public/avatars/${fileName}`;
        }

        const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/users?user_id=eq.${userId}`, {
          method: 'PATCH',
          headers: {
            ...baseHeaders,
            "Content-Type": "application/json"
          },
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
