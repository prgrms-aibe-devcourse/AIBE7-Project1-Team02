(function () {
  const profiles = {
    ESTJ: {
      title: "완벽한 일정 설계 여행가",
      description: "동선과 시간을 알차게 짜서 여행의 완성도를 높이는 타입입니다.",
    },
    ESTP: {
      title: "즉흥 액티비티 여행가",
      description: "현장에서 몸으로 부딪히며 새로운 경험을 즐기는 타입입니다.",
    },
    ESFJ: {
      title: "동행 케어 여행가",
      description: "함께 가는 사람의 취향과 편안함까지 챙기는 타입입니다.",
    },
    ESFP: {
      title: "축제 에너지 여행가",
      description: "맛집, 축제, 사람 많은 장소에서 여행의 활기를 찾는 타입입니다.",
    },
    ENTJ: {
      title: "목표 달성 여행가",
      description: "가고 싶은 곳을 전략적으로 정복하며 만족감을 얻는 타입입니다.",
    },
    ENTP: {
      title: "숨은 루트 개척 여행가",
      description: "남들이 지나친 장소에서 새로운 재미를 발견하는 타입입니다.",
    },
    ENFJ: {
      title: "감동 큐레이션 여행가",
      description: "사람, 문화, 이야기가 남는 의미 있는 여정을 좋아하는 타입입니다.",
    },
    ENFP: {
      title: "자유로운 낭만 여행가",
      description: "계획보다 순간의 끌림을 따라 다채로운 감정을 모으는 타입입니다.",
    },
    ISTJ: {
      title: "꼼꼼한 실속 여행가",
      description: "검증된 정보와 안정적인 선택으로 만족도 높은 여행을 만드는 타입입니다.",
    },
    ISTP: {
      title: "조용한 모험 여행가",
      description: "자신만의 속도로 자연과 체험을 깊게 즐기는 타입입니다.",
    },
    ISFJ: {
      title: "따뜻한 추억 여행가",
      description: "편안한 장소에서 소중한 사람과 오래 남을 기억을 쌓는 타입입니다.",
    },
    ISFP: {
      title: "감성 풍경 여행가",
      description: "아름다운 풍경과 분위기 속에서 여행의 감각을 즐기는 타입입니다.",
    },
    INTJ: {
      title: "깊이 있는 탐구 여행가",
      description: "역사, 건축, 문화처럼 한 장소의 맥락을 파고드는 타입입니다.",
    },
    INTP: {
      title: "호기심 관찰 여행가",
      description: "낯선 공간을 차분히 관찰하며 자기만의 발견을 남기는 타입입니다.",
    },
    INFJ: {
      title: "영감 수집 여행가",
      description: "조용한 장소와 깊은 이야기를 통해 내면의 영감을 얻는 타입입니다.",
    },
    INFP: {
      title: "꿈꾸는 이야기 여행가",
      description: "동화 같은 풍경과 감동적인 이야기가 있는 장소에 끌리는 타입입니다.",
    },
  };

  function normalizeType(mbtiType) {
    return String(mbtiType || "").trim().toUpperCase();
  }

  function getProfile(mbtiType) {
    return profiles[normalizeType(mbtiType)] || {
      title: "나만의 취향 여행가",
      description: "여행 성향에 맞춰 국내 여행지를 추천받는 타입입니다.",
    };
  }

  function createBadge(label, options = {}) {
    const badge = document.createElement("span");
    const classNames = ["traveler-title-badge"];

    if (options.variant === "subtle") {
      classNames.push("traveler-title-badge-subtle");
    }
    if (options.size === "compact") {
      classNames.push("traveler-title-badge-compact");
    }
    if (options.size === "large") {
      classNames.push("traveler-title-badge-large");
    }

    badge.className = classNames.join(" ");
    
    if (options.mbtiType) {
      const img = document.createElement("img");
      img.src = `/assets/icons/mbti/${options.mbtiType}.png`;
      img.alt = "badge";
      img.style.width = "1.1rem";
      img.style.height = "1.1rem";
      img.style.verticalAlign = "middle";
      img.style.display = "inline-block";
      img.style.borderRadius = "0";
      
      const textNode = document.createElement("span");
      textNode.textContent = label || "나만의 취향 여행가";
      
      badge.appendChild(img);
      badge.appendChild(textNode);
    } else {
      badge.textContent = label || "나만의 취향 여행가";
    }
    
    return badge;
  }

  window.TravelerProfile = {
    createBadge,
    getDescription(mbtiType) {
      return getProfile(mbtiType).description;
    },
    getTitle(mbtiType) {
      return getProfile(mbtiType).title;
    },
    profiles,
  };
})();
