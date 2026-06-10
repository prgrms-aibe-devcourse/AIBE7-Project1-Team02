document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 1. Fetch and inject common components
    const [sidebarRes, headerRes] = await Promise.all([
      fetch("/components/sidebar.html"),
      fetch("/components/header.html"),
    ]);

    const sidebarHtml = await sidebarRes.text();
    const headerHtml = await headerRes.text();

    const sidebarContainer = document.getElementById("sidebar-container");
    const headerContainer = document.getElementById("header-container");

    if (sidebarContainer) sidebarContainer.innerHTML = sidebarHtml;
    if (headerContainer) headerContainer.innerHTML = headerHtml;

    // 2. Initialize Lucide icons for the newly injected HTML
    if (window.lucide) {
      window.lucide.createIcons();
    }

    // 3. Set Active Menu Item based on current path
    const currentPath = window.location.pathname;
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach((item) => {
      let itemPath = item.getAttribute("data-path");
      item.classList.remove("active");
      if (
        (currentPath === "/" || currentPath === "/index.html") &&
        itemPath === "/"
      ) {
        item.classList.add("active");
      } else if (
        currentPath !== "/" &&
        currentPath !== "/index.html" &&
        itemPath !== "/" &&
        currentPath.includes(itemPath)
      ) {
        item.classList.add("active");
      }
    });

    // 4. Update Header Breadcrumb based on current path
    const breadcrumbIcon = document.getElementById("breadcrumb-icon-container");
    const breadcrumbText = document.getElementById("breadcrumb-text-container");

    if (breadcrumbIcon && breadcrumbText) {
      if (currentPath.includes("community")) {
        breadcrumbIcon.innerHTML = '<i data-lucide="users"></i>';
        breadcrumbText.textContent = "커뮤니티";
      } else if (
        currentPath.includes("trip-create") ||
        currentPath.includes("destinations")
      ) {
        breadcrumbIcon.innerHTML = '<i data-lucide="map"></i>';
        breadcrumbText.textContent = "여행 일정";
      } else if (currentPath.includes("survey")) {
        breadcrumbIcon.innerHTML = '<i data-lucide="sparkles"></i>';
        breadcrumbText.textContent = "성향 분석";
      } else if (currentPath.includes("mypage")) {
        breadcrumbIcon.innerHTML = '<i data-lucide="user"></i>';
        breadcrumbText.textContent = "마이페이지";
      } else {
        // Default
        breadcrumbIcon.innerHTML = '<i data-lucide="compass"></i>';
        breadcrumbText.textContent = "탐색하기";
      }
      // re-initialize icons after DOM change
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }

    // 5. Initialize Mobile Toggle
    const mobileToggle = document.getElementById("mobile-toggle");
    const sidebar = document.getElementById("sidebar");
    const sidebarOverlay = document.getElementById("sidebar-overlay");

    if (mobileToggle && sidebar && sidebarOverlay) {
      mobileToggle.addEventListener("click", () => {
        sidebar.classList.toggle("active");
        sidebarOverlay.classList.toggle("active");
      });

      sidebarOverlay.addEventListener("click", () => {
        sidebar.classList.remove("active");
        sidebarOverlay.classList.remove("active");
      });
    }

    // Dispatch a custom event to notify other scripts that layout is ready
    // This allows page-specific scripts to bind events to header/sidebar elements
    document.dispatchEvent(new Event("layoutLoaded"));

    // 6. Update user profile in header
    await updateHeaderProfile();
  } catch (error) {
    console.error("Error loading layout components:", error);
  }
});

async function updateHeaderProfile() {
  const authToken = sessionStorage.getItem("sb_access_token");
  const userRaw = sessionStorage.getItem("sb_user") || "{}";
  let currentUser = {};
  try {
    currentUser = JSON.parse(userRaw) || {};
  } catch {}

  const headerUserName = document.getElementById("header-user-name");
  const headerTravelerBadge = document.getElementById("header-traveler-badge");
  const headerUserAvatar = document.getElementById("header-user-avatar");
  const headerProfileText = document.getElementById("header-profile-text");
  const headerAvatarWrapper = document.getElementById("header-avatar-wrapper");
  const headerLoginButton = document.getElementById("header-login-button");
  const loginLink = document.getElementById("login-link");
  const profileDropdown = document.getElementById("profile-dropdown");
  const dropdownLogoutBtn = document.getElementById("dropdown-logout-btn");
  const profileDropdownContainer = document.getElementById(
    "profile-dropdown-container",
  );

  if (!authToken) {
    if (headerProfileText) headerProfileText.hidden = true;
    if (headerAvatarWrapper) headerAvatarWrapper.hidden = true;
    if (headerLoginButton) headerLoginButton.hidden = false;
    if (headerUserName) headerUserName.textContent = "";
    setHeaderTravelerBadge(headerTravelerBadge, "");
    if (headerUserAvatar)
      headerUserAvatar.src =
        "https://ui-avatars.com/api/?name=User&background=eaeaea&color=333";
    if (profileDropdown) profileDropdown.style.display = "none";
    return;
  }

  if (headerProfileText) headerProfileText.hidden = false;
  if (headerAvatarWrapper) headerAvatarWrapper.hidden = false;
  if (headerLoginButton) headerLoginButton.hidden = true;
  if (profileDropdown) profileDropdown.style.display = "";

  if (loginLink) {
    loginLink.href = "#";
    loginLink.addEventListener("click", (e) => {
      e.preventDefault();
      if (profileDropdown) profileDropdown.classList.toggle("active");
    });
  }

  document.addEventListener("click", (e) => {
    if (
      profileDropdownContainer &&
      !profileDropdownContainer.contains(e.target)
    ) {
      if (profileDropdown) profileDropdown.classList.remove("active");
    }
  });

  if (dropdownLogoutBtn) {
    dropdownLogoutBtn.addEventListener("click", () => {
      sessionStorage.removeItem("sb_access_token");
      sessionStorage.removeItem("sb_refresh_token");
      sessionStorage.removeItem("sb_user");
      window.location.replace("/pages/login.html");
    });
  }

  const userName =
    currentUser?.user_metadata?.nickname ||
    currentUser?.user_metadata?.name ||
    currentUser?.email?.split("@")?.[0] ||
    "사용자";
  if (headerUserName) headerUserName.textContent = `${userName}님`;
  setHeaderTravelerBadge(
    headerTravelerBadge,
    currentUser?.user_metadata?.badge || "",
  );

  const cachedImg =
    currentUser?.user_metadata?.profile_image ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=1a5c3a&color=fff&size=160`;
  if (headerUserAvatar) {
    headerUserAvatar.src = cachedImg;
  }

  const userId = currentUser?.id;
  if (userId) {
    try {
      const result = await fetch("/api/config").then((r) => r.json());
      if (result.success) {
        const requestHeaders = {
          apikey: result.data.supabaseAnonKey,
          Authorization: `Bearer ${authToken}`,
        };
        const [data, preferenceData] = await Promise.all([
          fetch(
            `${result.data.supabaseUrl}/rest/v1/users?user_id=eq.${userId}&select=profile_image,nickname`,
            { headers: requestHeaders },
          ).then((r) => r.json()),
          fetch(
            `${result.data.supabaseUrl}/rest/v1/user_preferences?user_id=eq.${userId}&select=badge,mbti_type`,
            { headers: requestHeaders },
          ).then((r) => r.json()),
        ]);

        const dbImg = data?.[0]?.profile_image;
        const dbNick = data?.[0]?.nickname;
        const dbBadge = preferenceData?.[0]?.badge;
        const dbMbtiType = preferenceData?.[0]?.mbti_type;
        const travelerBadge =
          dbBadge || window.TravelerProfile?.getTitle(dbMbtiType) || "";

        const finalName = dbNick || userName;
        const finalImg =
          dbImg ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(finalName)}&background=1a5c3a&color=fff&size=160`;

        if (headerUserAvatar) {
          headerUserAvatar.src = finalImg;
        }

        if (dbImg) currentUser.user_metadata.profile_image = dbImg;
        if (dbNick) {
          if (headerUserName) headerUserName.textContent = `${dbNick}님`;
          currentUser.user_metadata.nickname = dbNick;
        }
        if (travelerBadge) {
          setHeaderTravelerBadge(headerTravelerBadge, travelerBadge);
          currentUser.user_metadata.badge = travelerBadge;
        }

        sessionStorage.setItem("sb_user", JSON.stringify(currentUser));
      }
    } catch (err) {
      console.error("Failed to load user profile in layout:", err);
    }
  }
}

function setHeaderTravelerBadge(element, badgeText) {
  if (!element) return;

  const visibleBadge = String(badgeText || "").trim();
  element.textContent = visibleBadge;
  element.hidden = !visibleBadge;
}
