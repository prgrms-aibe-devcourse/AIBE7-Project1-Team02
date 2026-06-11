let SUPABASE_URL = "";
let SUPABASE_ANON_KEY = "";
let savedDestinationBookmarks = [];

const POLICY_CONTENT = {
  terms: {
    title: "이용약관",
    html: `
      <article class="policy-content">
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
    title: "개인정보 처리방침",
    html: `
      <article class="policy-content">
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
  const savedDestinationsList = document.getElementById("saved-destinations-list");
  const completedTripList = document.getElementById("completed-trip-list");
  const completedTripCount = document.getElementById("completed-trip-count");
  const completedTripStatFill = document.getElementById("completed-trip-stat-fill");
  const completedTripStatSub = document.getElementById("completed-trip-stat-sub");
  const savedDestinationsModal = document.getElementById("saved-destinations-modal");
  const savedDestinationsModalList = document.getElementById("saved-destinations-modal-list");
  const savedDestinationsCloseBtn = document.getElementById("saved-destinations-close-btn");
  const savedDestinationsModalHeader = savedDestinationsModal?.querySelector(
    ".saved-destinations-modal-header",
  );
  let savedDestinationsModalMode = "list";
  let savedDestinationsDetailReturnMode = "list";

  const userRaw = sessionStorage.getItem("sb_user");
  const storedAccessToken = sessionStorage.getItem("sb_access_token");
  if (!userRaw || !storedAccessToken) {
    const loginUrl = new URL("./login.html", window.location.href);
    loginUrl.searchParams.set("redirect", "/pages/mypage.html");
    window.location.replace(loginUrl.href);
    return;
  }

  let user = {};
  let userId = null;
  let accessToken = storedAccessToken;

  try {
    user = JSON.parse(userRaw);
    userId = user.id;

    if (!userId) {
      const loginUrl = new URL("./login.html", window.location.href);
      loginUrl.searchParams.set("redirect", "/pages/mypage.html");
      window.location.replace(loginUrl.href);
      return;
    }

    await loadConfig();

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
    const prefRes = await fetch(`${SUPABASE_URL}/rest/v1/user_preferences?user_id=eq.${userId}&select=badge,mbti_type`, {
      method: 'GET',
      headers
    });

    const userData = await userRes.json().catch(() => null);
    const prefData = await prefRes.json().catch(() => null);

    const nickname = userData?.[0]?.nickname || user.user_metadata?.nickname || "여행자";
    const profileImage = userData?.[0]?.profile_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(nickname)}&background=random&color=fff&size=160`;
    const badge = prefData?.[0]?.badge || "새로운 여행자";
    const mbtiType = prefData?.[0]?.mbti_type ? prefData[0].mbti_type.toLowerCase() : null;

    // DOM 업데이트
    if (nameEl) nameEl.textContent = nickname;
    if (imgEl) imgEl.src = profileImage;
    
    const badgeContainer = document.getElementById("mypage-user-badge");
    if (badgeContainer) {
      if (mbtiType) {
        badgeContainer.innerHTML = `<img src="/assets/icons/mbti/${mbtiType}.png" alt="badge icon" style="width: 1.4rem; height: 1.4rem; margin-right: 0.3rem; vertical-align: middle; display: inline-block;"><span id="mypage-badge-text">${badge}</span>`;
      } else {
        badgeContainer.innerHTML = `<i data-lucide="compass"></i><span id="mypage-badge-text">${badge}</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
    } else if (badgeTextEl) {
      badgeTextEl.textContent = badge;
    }

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
          const travelerTitle =
            window.TravelerProfile?.getTitle(recData.data.mbtiType) ||
            "취향 맞춤 여행가";
          aiBannerTitle.textContent = `${travelerTitle}님을 위한 추천!`;
        }
        if (aiBannerDesc) {
          let descText = rec.reason || rec.description || "";
          // DB에 포함된 불필요한 메타데이터(TourAPI 찌꺼기) 제거
          descText = descText.replace(/(contentType|textRule)[\s:,\d]+/g, '').trim();
          
          aiBannerDesc.innerHTML = `이번 여행은 <strong style="color: #fbbf24">${rec.destinationName}</strong> 어떠신가요?<br><span style="font-size:0.9rem; opacity:0.9; margin-top:0.3rem; display:block;">${descText}</span>`;
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

  await loadSavedDestinations(accessToken, savedDestinationsList, (bookmark) => {
    savedDestinationsModalMode = "detail";
    savedDestinationsDetailReturnMode = "page";
    renderSavedDestinationDetail(
      savedDestinationsModalHeader,
      savedDestinationsModalList,
      bookmark,
      () => {
        savedDestinationsModal?.classList.remove("active");
        savedDestinationsModalMode = "list";
      },
    );
    savedDestinationsModal?.classList.add("active");
  });
  await loadCompletedTrips(
    accessToken,
    completedTripList,
    completedTripCount,
    completedTripStatFill,
    completedTripStatSub,
  );

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
  const policyModal = document.getElementById("policy-modal");
  const policyModalTitle = document.getElementById("policy-modal-title");
  const policyModalBody = document.getElementById("policy-modal-body");
  const policyModalCloseBtn = document.getElementById("policy-modal-close-btn");
  const policyModalConfirmBtn = document.getElementById("policy-modal-confirm-btn");
  const policyViewButtons = document.querySelectorAll("[data-policy-view]");

  function openPolicyModal(policyType) {
    const policy = POLICY_CONTENT[policyType];
    if (!policy || !policyModal || !policyModalTitle || !policyModalBody) return;

    policyModalTitle.textContent = policy.title;
    policyModalBody.innerHTML = policy.html;
    policyModal.classList.add("active");

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function closePolicyModal() {
    policyModal?.classList.remove("active");
  }

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

  policyViewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      openPolicyModal(button.dataset.policyView);
    });
  });

  policyModalCloseBtn?.addEventListener("click", closePolicyModal);
  policyModalConfirmBtn?.addEventListener("click", closePolicyModal);
  policyModal?.addEventListener("click", (event) => {
    if (event.target === policyModal) {
      closePolicyModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePolicyModal();
    }
  });

  // 비밀번호 변경
  if (btnChangePassword) {
    btnChangePassword.addEventListener("click", async () => {
      const newPassword = inputNewPassword.value;
      if (newPassword.length < 6) {
        await window.PackingUI.alert("비밀번호는 6자 이상이어야 합니다.", {
          type: "warning",
          title: "비밀번호 확인",
        });
        return;
      }
      const shouldChangePassword = await window.PackingUI.confirm(
        "새 비밀번호로 변경하시겠습니까?",
        {
          title: "비밀번호 변경",
          confirmText: "변경하기",
        },
      );
      if (!shouldChangePassword) return;

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
        
        await window.PackingUI.alert(
          "비밀번호가 성공적으로 변경되었습니다.",
          {
            type: "success",
            title: "비밀번호 변경 완료",
          },
        );
        inputNewPassword.value = "";
      } catch (err) {
        await window.PackingUI.alert(err.message, {
          type: "error",
          title: "비밀번호 변경 실패",
        });
      } finally {
        btnChangePassword.disabled = false;
        btnChangePassword.textContent = "비밀번호 변경";
      }
    });
  }

  // 데이터 초기화
  if (btnResetData) {
    btnResetData.addEventListener("click", async () => {
      const shouldResetData = await window.PackingUI.confirm(
        "성향 분석 결과, 저장한 여행지, 여행 일정 등 모든 활동 데이터를 삭제합니다.\n이 작업은 복구할 수 없습니다.",
        {
          type: "danger",
          title: "모든 활동 데이터를 삭제할까요?",
          confirmText: "모두 삭제",
        },
      );
      if (!shouldResetData) return;

      try {
        btnResetData.disabled = true;
        btnResetData.textContent = "삭제 중...";
        
        const res = await fetch("/api/user/data", {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${accessToken}`
          }
        });

        const data = await res.json().catch(()=>({}));
        
        if (!res.ok || !data.success) {
          throw new Error(data.message || "데이터 초기화에 실패했습니다.");
        }

        await window.PackingUI.alert(
          "모든 데이터가 성공적으로 초기화되었습니다.",
          {
            type: "success",
            title: "데이터 초기화 완료",
          },
        );
        window.location.reload();
      } catch (err) {
        console.error(err);
        await window.PackingUI.alert(
          "데이터 초기화 중 오류가 발생했습니다.",
          {
            type: "error",
            title: "데이터 초기화 실패",
          },
        );
      } finally {
        btnResetData.disabled = false;
        btnResetData.textContent = "내 데이터 모두 지우기";
      }
    });
  }

  // 회원 탈퇴 (Hard Delete)
  if (btnDeleteAccount) {
    btnDeleteAccount.addEventListener("click", async () => {
      const shouldDeleteAccount = await window.PackingUI.confirm(
        "모든 계정 정보와 활동 데이터가 완전히 삭제되며 복구할 수 없습니다.",
        {
          type: "danger",
          title: "정말 회원 탈퇴할까요?",
          confirmText: "회원 탈퇴",
        },
      );
      if (!shouldDeleteAccount) return;

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

        await window.PackingUI.alert(
          "회원 탈퇴가 정상적으로 처리되었습니다.\n그동안 이용해 주셔서 감사합니다.",
          {
            type: "success",
            title: "회원 탈퇴 완료",
            confirmText: "확인",
            dismissible: false,
          },
        );
        sessionStorage.clear();
        window.location.replace("./login.html");
      } catch (err) {
        await window.PackingUI.alert(err.message, {
          type: "error",
          title: "회원 탈퇴 실패",
        });
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
        await window.PackingUI.alert("닉네임을 입력해주세요.", {
          type: "warning",
          title: "프로필 입력 확인",
        });
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

        editModal.classList.remove("active");
        await window.PackingUI.alert("프로필이 성공적으로 수정되었습니다.", {
          type: "success",
          title: "프로필 수정 완료",
        });
      } catch (err) {
        console.error("프로필 수정 오류:", err);
        await window.PackingUI.alert(
          err.message || "프로필 수정 중 오류가 발생했습니다.",
          {
            type: "error",
            title: "프로필 수정 실패",
          },
        );
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

  const openSavedDestinationDetail = (bookmark) => {
    savedDestinationsModalMode = "detail";
    savedDestinationsDetailReturnMode = "list";
    renderSavedDestinationDetail(
      savedDestinationsModalHeader,
      savedDestinationsModalList,
      bookmark,
      () => {
        savedDestinationsModalMode = "list";
        renderSavedDestinationsModal(
          savedDestinationsModalHeader,
          savedDestinationsModalList,
          savedDestinationBookmarks,
          openSavedDestinationDetail,
        );
      },
    );
  };

  const showSavedDestinationList = () => {
    savedDestinationsModalMode = "list";
    renderSavedDestinationsModal(
      savedDestinationsModalHeader,
      savedDestinationsModalList,
      savedDestinationBookmarks,
      openSavedDestinationDetail,
    );
  };

  if (linkSavedDest) {
    linkSavedDest.addEventListener("click", (e) => {
      e.preventDefault();
      showSavedDestinationList();
      if (savedDestinationsModal) {
        savedDestinationsModal.classList.add("active");
      }
    });
  }

  const closeSavedDestinationsModal = () => {
    if (savedDestinationsModalMode === "detail") {
      if (savedDestinationsDetailReturnMode === "list") {
        showSavedDestinationList();
      } else if (savedDestinationsModal) {
        savedDestinationsModal.classList.remove("active");
        savedDestinationsModalMode = "list";
        savedDestinationsDetailReturnMode = "list";
      }
      return;
    }

    if (savedDestinationsModal) {
      savedDestinationsModal.classList.remove("active");
    }
  };

  if (savedDestinationsCloseBtn) {
    savedDestinationsCloseBtn.addEventListener("click", closeSavedDestinationsModal);
  }

  if (savedDestinationsModal) {
    savedDestinationsModal.addEventListener("click", (event) => {
      if (event.target === savedDestinationsModal) {
        closeSavedDestinationsModal();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      savedDestinationsModal?.classList.contains("active")
    ) {
      closeSavedDestinationsModal();
    }
  });

});

function getSafeDestinationImage(imageUrl) {
  if (!imageUrl) return "";

  try {
    const parsedUrl = new URL(imageUrl, window.location.href);
    return ["http:", "https:"].includes(parsedUrl.protocol)
      ? parsedUrl.href
      : "";
  } catch {
    return "";
  }
}

function createNoImagePlaceholder(className) {
  const placeholder = document.createElement("div");
  placeholder.className = `${className} no-image-placeholder`;
  placeholder.innerHTML = '<i data-lucide="image-off"></i><span>이미지 없음</span>';
  return placeholder;
}

function getDestinationRegion(destination) {
  return (
    destination.address ||
    [destination.province, destination.city].filter(Boolean).join(" ") ||
    "대한민국"
  );
}

function renderSavedDestinationState(container, message) {
  if (!container) return;

  container.className = "saved-destinations-list saved-destinations-empty";
  container.innerHTML = [
    '<i data-lucide="bookmark" aria-hidden="true"></i>',
    `<p>${message}</p>`,
  ].join("");
  window.lucide?.createIcons();
}

function renderSavedDestinationsHeader(header, eyebrow, title, description) {
  if (!header) return;

  header.innerHTML = "";

  const eyebrowEl = document.createElement("span");
  eyebrowEl.className = "recommendation-eyebrow";
  eyebrowEl.textContent = eyebrow;

  const titleEl = document.createElement("h2");
  titleEl.textContent = title;

  const descriptionEl = document.createElement("p");
  descriptionEl.textContent = description;

  header.append(eyebrowEl, titleEl, descriptionEl);
}

function renderSavedDestinationsModal(header, container, bookmarks, onSelect) {
  if (!container) return;

  renderSavedDestinationsHeader(
    header,
    "BOOKMARKS",
    "저장한 여행지",
    "북마크한 관광지를 위아래로 스크롤하며 확인하세요.",
  );
  container.className = "saved-destinations-modal-list";
  container.innerHTML = "";

  if (!bookmarks.length) {
    const state = document.createElement("div");
    state.className = "saved-destinations-modal-empty";
    state.innerHTML = [
      '<i data-lucide="bookmark" aria-hidden="true"></i>',
      "<p>저장한 여행지가 없습니다.</p>",
    ].join("");
    container.appendChild(state);
    window.lucide?.createIcons();
    return;
  }

  bookmarks.forEach((bookmark) => {
    const card = createSavedDestinationCard(bookmark, onSelect);
    card.classList.add("saved-destination-card--modal");
    container.appendChild(card);
  });

  window.lucide?.createIcons();
}

function renderSavedDestinationDetail(header, container, bookmark, onBack) {
  if (!container) return;

  const destination = bookmark.destination;
  const imageUrl = getSafeDestinationImage(destination.imageUrl);
  const regionText = getDestinationRegion(destination);
  let description =
    destination.description ||
    "저장한 국내 관광지입니다. 여행 일정에 추가해 나만의 코스를 만들어 보세요.";
  description = description.replace(/(contentType|textRule)[\s:,\d]+/g, "").trim();

  renderSavedDestinationsHeader(
    header,
    "BOOKMARK DETAIL",
    destination.destinationName,
    "저장한 여행지 상세정보를 확인하세요.",
  );

  container.innerHTML = "";
  container.className = "saved-destinations-modal-list saved-destination-detail-view";

  const detail = document.createElement("article");
  detail.className = "saved-destination-detail-card";

  const image = document.createElement("img");
  image.className = "saved-destination-detail-image";
  let media = image;

  if (imageUrl) {
    image.src = imageUrl;
    image.alt = destination.destinationName;
    image.addEventListener("error", () => {
      image.replaceWith(
        createNoImagePlaceholder("saved-destination-detail-image"),
      );
      window.lucide?.createIcons();
    });
  } else {
    media = createNoImagePlaceholder("saved-destination-detail-image");
  }

  const content = document.createElement("div");
  content.className = "saved-destination-detail-content";

  const region = document.createElement("p");
  region.className = "saved-destination-detail-region";
  region.innerHTML = '<i data-lucide="map-pin"></i>';
  const regionTextNode = document.createElement("span");
  regionTextNode.textContent = regionText;
  region.appendChild(regionTextNode);

  const descriptionEl = document.createElement("p");
  descriptionEl.className = "saved-destination-detail-description";
  descriptionEl.textContent = description;

  const actionGroup = document.createElement("div");
  actionGroup.className = "saved-destination-detail-actions";

  const backButton = document.createElement("button");
  backButton.className = "btn-primary btn-outline";
  backButton.type = "button";
  backButton.innerHTML = '<i data-lucide="arrow-left"></i> 목록으로';
  backButton.addEventListener("click", onBack);

  const tripButton = document.createElement("button");
  tripButton.className = "btn-primary btn-glow";
  tripButton.type = "button";
  tripButton.innerHTML = '이 여행지로 일정 만들기 <i data-lucide="arrow-right"></i>';
  tripButton.addEventListener("click", () => {
    sessionStorage.setItem(
      "selected_trip_destination",
      JSON.stringify({
        destinationId: destination.destinationId,
        destinationName: destination.destinationName,
        address: regionText,
        imageUrl,
      }),
    );
    window.location.href = `./trip-create.html?destinationId=${encodeURIComponent(destination.destinationId)}`;
  });

  actionGroup.append(backButton, tripButton);
  content.append(region, descriptionEl, actionGroup);
  detail.append(media, content);
  container.appendChild(detail);
  window.lucide?.createIcons();
}

function createSavedDestinationCard(bookmark, onSelect) {
  const destination = bookmark.destination;
  const card = document.createElement("article");
  card.className = "saved-destination-card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `${destination.destinationName} 여행지 보기`);

  const image = document.createElement("img");
  const imageUrl = getSafeDestinationImage(destination.imageUrl);
  let media = image;

  if (imageUrl) {
    image.src = imageUrl;
    image.alt = destination.destinationName;
    image.loading = "lazy";
    image.addEventListener("error", () => {
      image.replaceWith(createNoImagePlaceholder("saved-destination-card-image"));
      window.lucide?.createIcons();
    });
  } else {
    media = createNoImagePlaceholder("saved-destination-card-image");
  }

  const content = document.createElement("div");
  content.className = "saved-destination-content";

  const title = document.createElement("h4");
  title.textContent = destination.destinationName;

  const region = document.createElement("p");
  region.textContent = getDestinationRegion(destination);

  const savedAt = document.createElement("span");
  savedAt.textContent = "♥ 저장됨";

  content.append(title, region, savedAt);
  card.append(media, content);

  const openDestinationDetail = () => {
    if (typeof onSelect === "function") {
      onSelect(bookmark);
      return;
    }
    window.location.href = "./destinations.html";
  };
  card.addEventListener("click", openDestinationDetail);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDestinationDetail();
    }
  });

  return card;
}

function formatCompletedDate(value) {
  if (!value) return "완료일 미정";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "완료일 미정";

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function createCompletedTripCard(trip) {
  const card = document.createElement("article");
  card.className = "trip-list-item";
  card.tabIndex = 0;
  card.setAttribute("role", "button");

  const items = trip.items || trip.trip_plan_items || [];
  const firstDestination = items[0]?.destination || items[0]?.destinations || {};
  const imageUrl = firstDestination.imageUrl || firstDestination.image_url || "";
  let media;
  if (imageUrl) {
    const image = document.createElement("img");
    image.className = "trip-list-img";
    image.src = imageUrl;
    image.alt = trip.title || "완료한 여행";
    image.loading = "lazy";
    image.addEventListener("error", () => {
      image.replaceWith(createNoImagePlaceholder("trip-list-img"));
      window.lucide?.createIcons();
    });
    media = image;
  } else {
    media = createNoImagePlaceholder("trip-list-img");
  }

  const content = document.createElement("div");
  content.style.flex = "1";

  const date = document.createElement("div");
  date.className = "trip-list-date";
  date.innerHTML = '<i data-lucide="calendar-check"></i>';
  const dateText = document.createElement("span");
  dateText.textContent = formatCompletedDate(
    trip.completedAt || trip.completed_at,
  );
  date.appendChild(dateText);

  const title = document.createElement("h4");
  title.className = "trip-list-title";
  title.textContent = trip.title || "완료한 여행";

  const description = document.createElement("p");
  description.className = "trip-list-desc";
  const region = trip.region || "국내 여행";
  const totalDays = trip.totalDays || trip.total_days || 1;
  const itemCount = trip.itemCount ?? trip.item_count ?? items.length ?? 0;
  description.textContent = `${region} · ${totalDays}일 · ${itemCount}곳 방문`;

  content.append(date, title, description);

  const status = document.createElement("span");
  status.className = "trip-list-status";
  status.textContent = "완료";

  const openTrip = () => {
    window.location.href = "./saved-trips.html";
  };
  card.addEventListener("click", openTrip);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openTrip();
    }
  });

  card.append(media, content, status);
  return card;
}

function renderCompletedTripsState(container, message) {
  if (!container) return;

  container.innerHTML = [
    '<div style="text-align: center">',
    '<i data-lucide="map" style="width:32px;height:32px;margin-bottom:0.5rem;opacity:0.5;"></i>',
    `<p>${message}</p>`,
    "</div>",
  ].join("");
  window.lucide?.createIcons();
}

async function loadCompletedTrips(
  accessToken,
  container,
  countElement,
  fillElement,
  subElement,
) {
  if (!accessToken) return;

  try {
    const response = await fetch("/api/travel/list", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(result.message || "완료한 여행 조회 실패");
    }

    const completedTrips = (result.data.plans || [])
      .filter((trip) => String(trip.status || "").trim() === "completed")
      .sort(
        (firstTrip, secondTrip) =>
          new Date(secondTrip.completedAt || secondTrip.completed_at || 0) -
          new Date(firstTrip.completedAt || firstTrip.completed_at || 0),
      );

    if (countElement) {
      countElement.textContent = String(completedTrips.length);
    }
    if (fillElement) {
      fillElement.style.width = `${Math.min(completedTrips.length * 20, 100)}%`;
    }
    if (subElement) {
      subElement.textContent =
        completedTrips.length > 0
          ? `최근 완료한 여행 ${Math.min(completedTrips.length, 3)}개를 보여드려요.`
          : "첫 여행을 기록해 보세요!";
    }

    if (!container) return;

    if (completedTrips.length === 0) {
      renderCompletedTripsState(
        container,
        "아직 다녀온 여행이 없습니다.<br />여행지 완료를 기록해 보세요!",
      );
      return;
    }

    container.removeAttribute("style");
    container.className = "trip-list-wrapper";
    container.innerHTML = "";
    completedTrips.slice(0, 3).forEach((trip) => {
      container.appendChild(createCompletedTripCard(trip));
    });
    window.lucide?.createIcons();
  } catch (error) {
    console.error("완료한 여행 로드 실패:", error);
    renderCompletedTripsState(
      container,
      "완료한 여행을 불러오지 못했습니다.<br />잠시 후 다시 시도해 주세요.",
    );
  }
}

async function loadSavedDestinations(accessToken, container, onSelect) {
  if (!container || !accessToken) return;

  try {
    const response = await fetch("/api/user/bookmarks", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(result.message || "저장한 여행지 조회 실패");
    }

    const bookmarks = (result.data.bookmarks || []).filter(
      (bookmark) => bookmark.destination,
    );
    savedDestinationBookmarks = bookmarks;

    if (bookmarks.length === 0) {
      renderSavedDestinationState(container, "저장한 여행지가 없습니다.");
      return;
    }

    container.className = "saved-destinations-list";
    container.innerHTML = "";
    bookmarks.slice(0, 4).forEach((bookmark) => {
      container.appendChild(createSavedDestinationCard(bookmark, onSelect));
    });
    window.lucide?.createIcons();
  } catch (error) {
    console.error("저장한 여행지 로드 실패:", error);
    renderSavedDestinationState(container, "저장한 여행지를 불러오지 못했습니다.");
  }
}
