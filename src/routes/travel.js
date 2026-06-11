const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const {
  normalizeTourDestination,
} = require("../services/destination-processing/tourDataNormalizer");

const {
  createTripPlan,
  deleteTripPlan,
  getTripPlanById,
  getTripPlans,
  updateTripPlanStatus,
} = require("../services/supabase/tripPlan");

const router = express.Router();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const itineraryCache = new Map();
const DESTINATION_SELECT_FIELDS =
  "destination_id,destination_name,province,city,description,category,image_url,address,latitude,longitude";
const KEYWORD_ALIASES = {
  오션뷰: ["오션뷰", "자연", "인생샷"],
  로컬맛집: ["로컬맛집", "맛집", "로컬푸드"],
  미술관투어: ["미술관투어", "문화", "전시"],
  역사유적: ["역사유적", "역사", "전통문화"],
  산악트레킹: ["산악트레킹", "자연", "산책"],
  나이트라이프: ["나이트라이프", "야경명소", "활기"],
  웰니스휴양: ["웰니스휴양", "힐링", "숙박", "휴식"],
  나만의숨은명소: ["나만의숨은명소", "명소"],
  럭셔리스테이: ["럭셔리스테이", "숙박", "휴식"],
  배낭여행: ["배낭여행", "계획여행", "여행코스"],
  인생샷: ["인생샷", "오션뷰", "야경명소"],
  로컬축제: ["로컬축제", "축제", "활기"],
};

function getBearerToken(request) {
  const authorization = request.headers.authorization || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
}

function createAuthenticatedClient(accessToken) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

async function requireAuthenticatedContext(request, response) {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    response.status(401).json({
      success: false,
      message: "로그인이 필요한 서비스입니다.",
    });
    return null;
  }

  const supabase = createAuthenticatedClient(accessToken);
  if (!supabase) {
    response.status(500).json({
      success: false,
      message: "Supabase 공개 키가 설정되지 않았습니다.",
    });
    return null;
  }

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user) {
    response.status(401).json({
      success: false,
      message: "로그인 정보가 유효하지 않습니다.",
    });
    return null;
  }

  return {
    user: data.user,
    supabase,
  };
}

function getSupabasePermissionMessage(action, error) {
  if (error.code !== "42501") {
    return error.message || `${action}에 실패했습니다.`;
  }

  return [
    `임시 일정 테이블 ${action} 권한이 없습니다.`,
    error.message ? `Supabase: ${error.message}` : "",
    error.hint ? `Hint: ${error.hint}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

router.post("/plan", async (request, response) => {
  const startDate = String(request.body?.startDate || "").trim();
  const endDate = String(request.body?.endDate || "").trim();
  const region = String(request.body?.region || "").trim();
  const memo = String(request.body?.memo || "").trim();
  const keywords = normalizeRequestedKeywords(request.body?.keywords);
  const peopleCount = Number.parseInt(request.body?.peopleCount, 10);
  const destinationId = Number.parseInt(request.body?.destinationId, 10);
  const userId = request.body.userId;
  const accessToken = request.body.accessToken;
  console.log(accessToken);
  if (!startDate || !endDate) {
    return response
      .status(400)
      .json({ success: false, message: "여행 시작일과 종료일은 필수입니다." });
  }
  if (!Number.isFinite(peopleCount) || peopleCount < 1) {
    return response
      .status(400)
      .json({ success: false, message: "인원수는 1명 이상이어야 합니다." });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const tourApiKey = process.env.TOUR_API_KEY;
  if (!supabaseUrl || !anonKey || !geminiApiKey) {
    return response
      .status(500)
      .json({ success: false, message: "서버 환경설정이 올바르지 않습니다." });
  }

  try {
    const userId = currentUserFromAccessToken(accessToken);
    if (!userId) {
      return response
        .status(401)
        .json({ success: false, message: "사용자 정보를 확인할 수 없습니다." });
    }

    const headers = createSupabaseHeaders(anonKey, accessToken);
    const userMbti = await fetchUserMbti({ supabaseUrl, headers, userId });

    const destinationUrl = new URL("/rest/v1/destinations", supabaseUrl);
    destinationUrl.searchParams.set("select", DESTINATION_SELECT_FIELDS);
    destinationUrl.searchParams.set("order", "destination_id.asc");
    if (region) {
      destinationUrl.searchParams.set("province", `ilike.%${region}%`);
      destinationUrl.searchParams.set("limit", "1000");
    } else {
      destinationUrl.searchParams.set("limit", "50");
    }

    const destinationRows = await requestSupabaseJson(
      fetch,
      destinationUrl,
      headers,
    );
    const keywordRows = keywords.length
      ? await fetchDestinationKeywordRows({
          supabaseUrl,
          headers,
          keywords,
        })
      : [];
    const keywordScoreMap = createKeywordScoreMap(keywordRows);
    const destinations = mergeDestinations(
      Array.isArray(destinationRows) ? destinationRows : [],
      !region && keywordRows.length
        ? await fetchDestinationsByIds({
            supabaseUrl,
            headers,
            destinationIds: [...keywordScoreMap.keys()],
          })
        : [],
    ).filter(hasDestinationImage);
    if (!destinations.length) {
      return response.status(404).json({
        success: false,
        message: region
          ? "해당 지역에서 이미지가 있는 여행지를 찾지 못했습니다."
          : "일정 생성에 사용할 이미지가 있는 여행지 데이터가 없습니다.",
      });
    }

    const scoreRows = userMbti
      ? await fetchDestinationScores({
          supabaseUrl,
          headers,
          mbtiType: userMbti,
        })
      : [];
    const scoreMap = new Map(
      scoreRows.map((row) => [
        String(row.destination_id),
        Number(row.score) || 0,
      ]),
    );

    let rankedDestinations = destinations
      .map((destination) => ({
        ...destination,
        mbti_score: scoreMap.get(String(destination.destination_id)) || 0,
        keyword_score: keywordScoreMap.get(String(destination.destination_id)) || 0,
      }))
      .sort(compareRankedDestinations);

    const selectedDestination = Number.isFinite(destinationId)
      ? rankedDestinations.find(
          (destination) => Number(destination.destination_id) === destinationId,
        ) || null
      : null;

    if (selectedDestination) {
      rankedDestinations = [
        {
          ...selectedDestination,
          mbti_score:
            scoreMap.get(String(selectedDestination.destination_id)) || 0,
        },
        ...rankedDestinations.filter(
          (destination) =>
            Number(destination.destination_id) !==
            Number(selectedDestination.destination_id),
        ),
      ];
    }

    const activeRegion =
      region ||
      [selectedDestination?.province, selectedDestination?.city]
        .filter(Boolean)
        .join(" ");
    const selectedKeyword =
      selectedDestination?.destination_name || keywords[0] || activeRegion || "";
    const travelDays = Math.max(
      1,
      Math.floor(
        (new Date(endDate).getTime() - new Date(startDate).getTime()) /
          86400000,
      ) + 1,
    );
    const travelDates = buildTravelDates(startDate, travelDays);
    const itemsPerDay = travelDays >= 3 ? 4 : 3;
    const dayDestinationGroups = buildClosestDestinationGroups(
      rankedDestinations.slice(0, travelDays * 2),
      travelDays,
    );

    const tourItems = tourApiKey
      ? await fetchTourApiItems({
          tourApiKey,
          region: activeRegion,
          keyword: selectedKeyword,
        })
      : [];
    const tourDestinations = tourItems
      .map(mapTourDestination)
      .filter((item) => item.destination_name);
    const tourDestination =
      tourDestinations.find((item) => {
        if (selectedDestination?.destination_name) {
          return normalizeRegion(item.destination_name).includes(
            normalizeRegion(selectedDestination.destination_name),
          );
        }
        return activeRegion
          ? normalizeRegion(
              [item.province, item.city, item.address, item.destination_name]
                .filter(Boolean)
                .join(" "),
            ).includes(normalizeRegion(activeRegion))
          : true;
      }) ||
      tourDestinations[0] ||
      null;
    const matchedDbDestination =
      tourDestination &&
      rankedDestinations.find((destination) => {
        const dbName = normalizeRegion(destination.destination_name);
        const apiName = normalizeRegion(tourDestination.destination_name);
        const dbAddress = normalizeRegion(destination.address);
        const apiAddress = normalizeRegion(tourDestination.address);
        return (
          (dbName &&
            apiName &&
            (dbName.includes(apiName) || apiName.includes(dbName))) ||
          (dbAddress &&
            apiAddress &&
            (dbAddress.includes(apiAddress) || apiAddress.includes(dbAddress)))
        );
      });

    const finalDestination = {
      ...(matchedDbDestination ||
        selectedDestination ||
        rankedDestinations[0] ||
        {}),
      ...(tourDestination || {}),
      address:
        tourDestination?.address ||
        matchedDbDestination?.address ||
        selectedDestination?.address ||
        "",
      province:
        tourDestination?.province ||
        matchedDbDestination?.province ||
        selectedDestination?.province ||
        "",
      city:
        tourDestination?.city ||
        matchedDbDestination?.city ||
        selectedDestination?.city ||
        "",
    };

    const prompt = `
여행 MBTI: ${userMbti}
시작일: ${startDate}
종료일: ${endDate}
인원수: ${peopleCount}
지역: ${activeRegion || finalDestination?.address || "전체"}
선택 키워드: ${keywords.length ? keywords.join(", ") : "없음"}
메모: ${memo || "없음"}
여행 일수: ${travelDays}
하루 일정 수: ${itemsPerDay}
선택 목적지: ${finalDestination ? `${finalDestination.destination_name} (${finalDestination.address || activeRegion})` : "없음"}

아래 day별 추천 목적지를 우선 사용하고, 같은 day 안에서는 가까운 목적지끼리 묶어서 여행 일정을 작성해 주세요.
각 day에는 반드시 실제 여행 날짜(date)를 포함하세요.
반드시 여행 일수(${travelDays}일)에 맞춰서 days 배열을 작성하세요.
각 day에는 반드시 아래 목적지 2개를 사용하세요. 2개를 함께 배치할 수 없으면 날짜 순서를 유지한 채 최대한 근접한 목적지끼리 배치하세요.
반드시 JSON만 응답하세요.
day별 추천 목적지:
${dayDestinationGroups
  .map((group, index) => {
    const destinationsText = group.length
      ? group
          .map((destination) => {
            const regionText = [destination.province, destination.city]
              .filter(Boolean)
              .join(" ");
            return `- ${destination.destination_id}: ${destination.destination_name}${regionText ? ` (${regionText})` : ""}`;
          })
          .join("\n")
      : "- 없음";
    return `day ${index + 1}\n${destinationsText}`;
  })
  .join("\n\n")}

후보 목록:
${rankedDestinations
  .slice(0, 12)
  .map((destination) => {
    const regionText = [destination.province, destination.city]
      .filter(Boolean)
      .join(" ");
    return [
      `- destination_id: ${destination.destination_id}`,
      `  name: ${destination.destination_name}`,
      `  region: ${regionText}`,
      `  category: ${destination.category || ""}`,
      `  keyword_score: ${destination.keyword_score ?? 0}`,
      `  mbti_score: ${destination.mbti_score ?? 0}`,
      `  description: ${String(destination.description || "").slice(0, 180)}`,
    ].join("\n");
  })
  .join("\n")}

응답 형식:
{
  "mainDestinationId": 1,
  "tripTitle": "string",
  "summary": "string",
  "days": [
    {
      "day": 1,
      "items": [
        {
          "time": "09:00",
          "placeName": "string",
          "description": "string"
        }
      ]
    }
  ]
}
`.trim();

    const fallbackDays = buildFallbackDays({
      daysCount: travelDays,
      travelDates,
      destinationName:
        finalDestination?.destination_name ||
        rankedDestinations[0]?.destination_name ||
        activeRegion,
      region: finalDestination?.address || activeRegion,
      memo,
      destinationGroups: dayDestinationGroups,
    });
    const fallbackPayload = {
      mainDestinationId:
        finalDestination?.destination_id ||
        rankedDestinations[0]?.destination_id ||
        null,
      tripTitle: `${finalDestination?.destination_name || activeRegion || "맞춤"} 여행 일정`,
      summary:
        memo && memo.length > 0
          ? `${memo}를 반영한 ${travelDays}일 일정입니다.`
          : `${finalDestination?.destination_name || activeRegion || "선택한 지역"} 중심의 ${travelDays}일 일정입니다.`,
      days: fallbackDays,
    };

    const cacheKey = buildCacheKey({
      userId,
      startDate,
      endDate,
      region: activeRegion,
      memo,
      peopleCount,
      destinationId: finalDestination?.destination_id || destinationId || "",
    });

    const aiResult = await getGeneratedItinerary({
      cacheKey,
      geminiApiKey,
      prompt,
      fallbackPayload,
    });

    const aiSuggestedDestination = rankedDestinations.find(
      (destination) =>
        String(destination.destination_id) ===
        String(aiResult.mainDestinationId),
    );
    const mainDestination = {
      ...(aiSuggestedDestination || rankedDestinations[0] || {}),
      ...finalDestination,
    };
    const safeDays = normalizeAiDays(
      aiResult.days,
      travelDays,
      travelDates,
      fallbackDays,
    );

    return response.json({
      success: true,
      data: {
        trip: {
          title:
            // String(aiResult.tripTitle || "").trim() ||
            `${activeRegion || "국내"} 여행 일정`,
          //  summary: String(aiResult.summary || "").trim(),
          destination: mainDestination,
          startDate,
          endDate,
          peopleCount,
        },
        plan: {
          days: safeDays,
        },
        candidateDestinations: rankedDestinations.slice(0, 12),
      },
      message: "여행 일정이 생성되었습니다.",
    });
  } catch (error) {
    console.error("travel plan error:", error);
    return response.status(error.status || 500).json({
      success: false,
      message: error.message || "일정 생성에 실패했습니다.",
    });
  }
});

router.get("/list", async (request, response) => {
  try {
    const context = await requireAuthenticatedContext(request, response);
    if (!context) return;

    const plans = await getTripPlans(context.supabase, context.user.id);
    response.json({
      success: true,
      data: { plans },
      message: "저장 일정 조회 성공",
    });
  } catch (error) {
    console.error("Trip plan list error:", error);
    response.status(500).json({
      success: false,
      message: getSupabasePermissionMessage("조회", error),
    });
  }
});

router.get("/:planId", async (request, response) => {
  try {
    const context = await requireAuthenticatedContext(request, response);
    if (!context) return;

    const planId = Number.parseInt(request.params.planId, 10);
    if (!Number.isFinite(planId) || planId < 1) {
      return response.status(400).json({
        success: false,
        message: "유효한 일정 ID가 필요합니다.",
      });
    }

    const plan = await getTripPlanById(
      context.supabase,
      planId,
      context.user.id,
    );
    if (!plan) {
      return response.status(404).json({
        success: false,
        message: "일정을 찾을 수 없습니다.",
      });
    }

    return response.json({
      success: true,
      data: { plan },
      message: "일정 상세 조회 성공",
    });
  } catch (error) {
    console.error("Trip plan detail error:", error);
    return response.status(500).json({
      success: false,
      message: getSupabasePermissionMessage("조회", error),
    });
  }
});

router.patch("/:planId/status", async (request, response) => {
  try {
    const context = await requireAuthenticatedContext(request, response);
    if (!context) return;

    const planId = Number.parseInt(request.params.planId, 10);
    if (!Number.isFinite(planId) || planId < 1) {
      return response.status(400).json({
        success: false,
        message: "유효한 일정 ID가 필요합니다.",
      });
    }

    const status = String(request.body?.status || "").trim();
    if (!["planning", "in_progress", "completed"].includes(status)) {
      return response.status(400).json({
        success: false,
        message: "지원하지 않는 일정 상태입니다.",
      });
    }

    const plan = await updateTripPlanStatus(
      context.supabase,
      planId,
      status,
      context.user.id,
    );
    if (!plan) {
      return response.status(404).json({
        success: false,
        message: "일정을 찾을 수 없습니다.",
      });
    }

    return response.json({
      success: true,
      data: { plan },
      message: "일정 상태 변경 성공",
    });
  } catch (error) {
    console.error("Trip plan status update error:", error);
    return response.status(500).json({
      success: false,
      message: getSupabasePermissionMessage("수정", error),
    });
  }
});

router.delete("/:planId", async (request, response) => {
  try {
    const context = await requireAuthenticatedContext(request, response);
    if (!context) return;

    const planId = Number.parseInt(request.params.planId, 10);
    if (!Number.isFinite(planId) || planId < 1) {
      return response.status(400).json({
        success: false,
        message: "유효한 일정 ID가 필요합니다.",
      });
    }

    const plan = await getTripPlanById(
      context.supabase,
      planId,
      context.user.id,
    );
    if (!plan) {
      return response.status(404).json({
        success: false,
        message: "일정을 찾을 수 없습니다.",
      });
    }

    await deleteTripPlan(context.supabase, planId, context.user.id);

    return response.json({
      success: true,
      data: { planId },
      message: "일정 삭제 성공",
    });
  } catch (error) {
    console.error("Trip plan delete error:", error);
    return response.status(500).json({
      success: false,
      message: getSupabasePermissionMessage("삭제", error),
    });
  }
});

module.exports = router;

function parseCoordinate(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getDestinationCoordinates(destination) {
  const latitude = parseCoordinate(destination?.latitude);
  const longitude = parseCoordinate(destination?.longitude);
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
}

function calculateDistanceKm(left, right) {
  const leftCoordinates = getDestinationCoordinates(left);
  const rightCoordinates = getDestinationCoordinates(right);
  if (!leftCoordinates || !rightCoordinates) return null;

  const toRadians = (degree) => (degree * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLatitude = toRadians(
    rightCoordinates.latitude - leftCoordinates.latitude,
  );
  const deltaLongitude = toRadians(
    rightCoordinates.longitude - leftCoordinates.longitude,
  );
  const leftLatitude = toRadians(leftCoordinates.latitude);
  const rightLatitude = toRadians(rightCoordinates.latitude);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(leftLatitude) *
      Math.cos(rightLatitude) *
      Math.sin(deltaLongitude / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(a)));
}

function compareDestinationPriority(left, right) {
  const leftScore = Number(left?.mbti_score) || 0;
  const rightScore = Number(right?.mbti_score) || 0;
  if (leftScore !== rightScore) return rightScore - leftScore;
  return Number(left?.destination_id) - Number(right?.destination_id);
}

function buildClosestDestinationGroups(destinations, daysCount) {
  const available = Array.isArray(destinations)
    ? destinations.filter(Boolean).slice().sort(compareDestinationPriority)
    : [];
  const groups = [];

  while (groups.length < daysCount) {
    if (available.length === 0) {
      groups.push([]);
      continue;
    }

    if (available.length === 1) {
      groups.push([available.shift()]);
      continue;
    }

    let bestPair = [available[0], available[1]];
    let bestDistance = Number.POSITIVE_INFINITY;
    let bestScore = Number.NEGATIVE_INFINITY;
    let foundValidDistance = false;

    for (let leftIndex = 0; leftIndex < available.length - 1; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < available.length;
        rightIndex += 1
      ) {
        const left = available[leftIndex];
        const right = available[rightIndex];
        const distance = calculateDistanceKm(left, right);
        if (distance === null) continue;

        const score =
          (Number(left?.mbti_score) || 0) + (Number(right?.mbti_score) || 0);
        const isBetterPair =
          !foundValidDistance ||
          distance < bestDistance ||
          (distance === bestDistance && score > bestScore) ||
          (distance === bestDistance &&
            score === bestScore &&
            compareDestinationPriority(left, bestPair[0]) < 0);

        if (isBetterPair) {
          foundValidDistance = true;
          bestDistance = distance;
          bestScore = score;
          bestPair = [left, right];
        }
      }
    }

    if (!foundValidDistance) bestPair = available.slice(0, 2);

    const consumedIds = new Set(
      bestPair.map((destination) => String(destination?.destination_id)),
    );
    groups.push(bestPair.filter(Boolean));

    for (let index = available.length - 1; index >= 0; index -= 1) {
      if (consumedIds.has(String(available[index]?.destination_id))) {
        available.splice(index, 1);
      }
    }
  }

  return groups;
}

function formatDestinationDetails(destination, fallbackLabel) {
  const destinationRegionText = [destination?.province, destination?.city]
    .filter(Boolean)
    .join(" ");

  return destinationRegionText
    ? `${destination.destination_name || fallbackLabel} (${destinationRegionText})`
    : `${destination.destination_name || fallbackLabel}`;
}

function buildFallbackDays({
  daysCount,
  travelDates = [],
  destinationName,
  region,
  memo,
  destinationGroups = [],
}) {
  const destinationDays = Math.max(1, daysCount);

  return Array.from({ length: destinationDays }, (_, index) => {
    const dayDestinations = Array.isArray(destinationGroups[index])
      ? destinationGroups[index].filter(Boolean).slice(0, 2)
      : [];
    const dayDate = travelDates[index] || "";

    if (dayDestinations.length > 0) {
      return {
        day: index + 1,
        dayLabel: `DAY ${index + 1}`,
        date: dayDate,
        items: dayDestinations.map((destination, itemIndex) => ({
          time: "",
          placeName: destination?.destination_name || `관광지 ${itemIndex + 1}`,
          description:
            destination?.description ||
            formatDestinationDetails(destination, `관광지 ${itemIndex + 1}`),
          image_url: destination?.image_url || "",
          imageUrl: destination?.image_url || "",
          province: destination?.province || "",
          city: destination?.city || "",
          address: destination?.address || "",
          latitude: destination?.latitude || null,
          longitude: destination?.longitude || null,
          destinationId: destination?.destination_id || null,
          destinationName:
            destination?.destination_name || `관광지 ${itemIndex + 1}`,
          regionText: formatDestinationDetails(
            destination,
            `관광지 ${itemIndex + 1}`,
          ),
        })),
      };
    }

    return {
      day: index + 1,
      dayLabel: `DAY ${index + 1}`,
      date: dayDate,
      items: [
        {
          time: "",
          placeName: destinationName || region || "선택한 지역",
          description: memo
            ? `${memo}를 반영한 추천 일정입니다.`
            : "추천할 관광지가 없어 기본 일정으로 구성했습니다.",
        },
      ],
    };
  });
}

function normalizeAiDays(aiDays, travelDays, travelDates, fallbackDays) {
  const normalizedAiDays = Array.isArray(aiDays)
    ? aiDays.slice(0, travelDays)
    : [];

  return (normalizedAiDays.length ? normalizedAiDays : fallbackDays)
    .slice(0, travelDays)
    .map((day, index) => ({
      ...day,
      day: index + 1,
      dayLabel: day?.dayLabel || `DAY ${index + 1}`,
      date: travelDates[index] || day?.date || "",
      items:
        Array.isArray(fallbackDays[index]?.items) &&
        fallbackDays[index].items.length > 0
          ? fallbackDays[index].items
          : Array.isArray(day?.items)
            ? day.items
            : [],
    }));
}

function currentUserFromAccessToken(accessToken) {
  const payload = String(accessToken || "").split(".")[1];
  if (!payload) return "";
  try {
    const decoded = Buffer.from(
      payload.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");
    const body = JSON.parse(decoded);
    return body?.sub || "";
  } catch {
    return "";
  }
}

function createSupabaseHeaders(anonKey, accessToken) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function fetchUserMbti({ supabaseUrl, headers, userId }) {
  const url = new URL("/rest/v1/travel_mbti_results", supabaseUrl);
  url.searchParams.set("select", "mbti_type");
  url.searchParams.set("user_id", `eq.${userId}`);
  url.searchParams.set("limit", "1");
  const rows = await requestSupabaseJson(fetch, url, headers);
  const mbti = Array.isArray(rows) ? rows[0]?.mbti_type : "";
  if (mbti) return String(mbti).trim().toUpperCase();

  const fallbackUrl = new URL("/rest/v1/user_preferences", supabaseUrl);
  fallbackUrl.searchParams.set("select", "mbti_type");
  fallbackUrl.searchParams.set("user_id", `eq.${userId}`);
  fallbackUrl.searchParams.set("limit", "1");
  const prefs = await requestSupabaseJson(fetch, fallbackUrl, headers);
  return String(Array.isArray(prefs) ? prefs[0]?.mbti_type : "")
    .trim()
    .toUpperCase();
}

async function requestSupabaseJson(fetchImpl, url, headers) {
  const response = await fetchImpl(url, { headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.message || "Supabase 요청에 실패했습니다.");
    error.status = response.status;
    throw error;
  }
  return body;
}

function normalizeRequestedKeywords(rawKeywords) {
  const values = Array.isArray(rawKeywords)
    ? rawKeywords
    : String(rawKeywords || "")
        .split(",")
        .map((value) => value.trim());

  const expandedKeywords = [];
  values.forEach((value) => {
    const normalizedKeyword = String(value || "")
      .replace(/^#/, "")
      .trim();
    if (!normalizedKeyword) return;

    const aliases = KEYWORD_ALIASES[normalizedKeyword] || [normalizedKeyword];
    expandedKeywords.push(...aliases);
  });

  return [...new Set(expandedKeywords.filter(Boolean))];
}

function createInFilter(values) {
  return `in.(${values.map((value) => JSON.stringify(value)).join(",")})`;
}

async function fetchDestinationKeywordRows({ supabaseUrl, headers, keywords }) {
  if (!keywords.length) return [];

  const keywordUrl = new URL("/rest/v1/destination_keywords", supabaseUrl);
  keywordUrl.searchParams.set("select", "destination_id,keyword");
  keywordUrl.searchParams.set("keyword", createInFilter(keywords));
  keywordUrl.searchParams.set("limit", "1000");

  const rows = await requestSupabaseJson(fetch, keywordUrl, headers);
  return Array.isArray(rows) ? rows : [];
}

function createKeywordScoreMap(keywordRows) {
  return keywordRows.reduce((scoreMap, row) => {
    const destinationId = String(row?.destination_id || "");
    if (!destinationId) return scoreMap;

    scoreMap.set(destinationId, (scoreMap.get(destinationId) || 0) + 1);
    return scoreMap;
  }, new Map());
}

function hasDestinationImage(destination) {
  return Boolean(String(destination?.image_url || "").trim());
}

async function fetchDestinationsByIds({ supabaseUrl, headers, destinationIds }) {
  const ids = [...new Set(destinationIds.map((id) => Number(id)).filter(Number.isFinite))];
  if (!ids.length) return [];

  const destinationUrl = new URL("/rest/v1/destinations", supabaseUrl);
  destinationUrl.searchParams.set("select", DESTINATION_SELECT_FIELDS);
  destinationUrl.searchParams.set("destination_id", `in.(${ids.join(",")})`);
  destinationUrl.searchParams.set("limit", String(ids.length));

  const rows = await requestSupabaseJson(fetch, destinationUrl, headers);
  return Array.isArray(rows) ? rows : [];
}

function mergeDestinations(...destinationLists) {
  const mergedDestinationMap = new Map();
  destinationLists.flat().forEach((destination) => {
    if (!destination?.destination_id) return;
    mergedDestinationMap.set(String(destination.destination_id), {
      ...mergedDestinationMap.get(String(destination.destination_id)),
      ...destination,
    });
  });
  return [...mergedDestinationMap.values()];
}

function compareRankedDestinations(left, right) {
  const keywordDiff = (right.keyword_score || 0) - (left.keyword_score || 0);
  if (keywordDiff !== 0) return keywordDiff;

  const mbtiDiff = (right.mbti_score || 0) - (left.mbti_score || 0);
  if (mbtiDiff !== 0) return mbtiDiff;

  return Number(left.destination_id || 0) - Number(right.destination_id || 0);
}

async function fetchDestinationScores({ supabaseUrl, headers, mbtiType }) {
  const url = new URL("/rest/v1/destination_mbti_scores", supabaseUrl);
  url.searchParams.set(
    "select",
    "destination_id,score,destinations(destination_id,destination_name,province,city,description,address,image_url,latitude,longitude,category)",
  );
  url.searchParams.set("mbti_type", `eq.${mbtiType}`);
  url.searchParams.set("order", "score.desc,destination_id.asc");
  url.searchParams.set("limit", "12");
  const rows = await requestSupabaseJson(fetch, url, headers);
  return Array.isArray(rows) ? rows : [];
}

function buildTravelDates(startDate, daysCount) {
  const parsedStartDate = new Date(startDate);
  if (Number.isNaN(parsedStartDate.getTime())) {
    return [];
  }

  return Array.from({ length: daysCount }, (_, index) => {
    const currentDate = new Date(parsedStartDate);
    currentDate.setDate(parsedStartDate.getDate() + index);
    return formatDate(currentDate);
  });
}

async function fetchTourApiItems({ tourApiKey, region, keyword }) {
  const contentTypeIds = [12, 14, 15, 25, 28, 39];
  const results = [];
  const hasKeyword = Boolean(String(keyword || "").trim());
  const hasRegion = Boolean(String(region || "").trim());

  for (const contentTypeId of contentTypeIds) {
    const url = new URL(
      hasKeyword || hasRegion
        ? "https://apis.data.go.kr/B551011/KorService2/searchKeyword2"
        : "https://apis.data.go.kr/B551011/KorService2/areaBasedList2",
    );
    url.searchParams.set("serviceKey", tourApiKey);
    url.searchParams.set("MobileOS", "ETC");
    url.searchParams.set("MobileApp", "ExploraJourneys");
    url.searchParams.set("_type", "json");
    url.searchParams.set("numOfRows", "20");
    url.searchParams.set("pageNo", "1");
    url.searchParams.set("contentTypeId", String(contentTypeId));
    if (hasKeyword) {
      url.searchParams.set("keyword", keyword);
    } else if (hasRegion) {
      url.searchParams.set("keyword", region);
    }

    const response = await fetch(url);
    if (!response.ok) continue;
    const body = await response.json().catch(() => ({}));
    const items = body?.response?.body?.items?.item;
    if (Array.isArray(items)) {
      results.push(...items);
    } else if (items) {
      results.push(items);
    }
  }

  return results;
}

function normalizeRegion(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

async function getGeneratedItinerary({
  cacheKey,
  geminiApiKey,
  prompt,
  fallbackPayload,
}) {
  const cached = itineraryCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.createdAt < 1000 * 60 * 30) {
    return cached.value;
  }

  try {
    const result = await callGemini({ apiKey: geminiApiKey, prompt });
    itineraryCache.set(cacheKey, { createdAt: now, value: result });
    return result;
  } catch (error) {
    console.warn("Gemini fallback used:", error.message);
    itineraryCache.set(cacheKey, { createdAt: now, value: fallbackPayload });
    return fallbackPayload;
  }
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function mapTourDestination(item) {
  const destination = normalizeTourDestination(item);
  const addressParts = String(destination.address || "")
    .split(" ")
    .filter(Boolean);
  return {
    destination_id: Number(item?.contentid || item?.contentId || 0),
    destination_name: destination.destinationName,
    province: addressParts[0] || "",
    city: addressParts[1] || "",
    description: destination.description || "",
    category: String(item?.contenttypename || item?.contenttypeid || ""),
    image_url: destination.imageUrl || "",
    address: destination.address || "",
    latitude: destination.coordinates.latitude,
    longitude: destination.coordinates.longitude,
    tour_content_id: destination.tourContentId,
    content_type_id: destination.contentTypeId,
  };
}

function buildCacheKey({
  userId,
  startDate,
  endDate,
  region,
  memo,
  peopleCount,
  destinationId,
}) {
  return [
    userId,
    startDate,
    endDate,
    region,
    memo,
    peopleCount,
    destinationId || "",
  ]
    .map((value) =>
      String(value || "")
        .trim()
        .toLowerCase(),
    )
    .join("|");
}

async function callGemini({ apiKey, prompt }) {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.6,
        responseMimeType: "application/json",
      },
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      body?.error?.message || body?.message || "Gemini 요청에 실패했습니다.";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  const text =
    body?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n") || "";
  const parsed = parseJsonBlock(text);
  if (!parsed) throw new Error("Gemini 응답을 JSON으로 해석하지 못했습니다.");
  return parsed;
}
module.exports.__testables = {
  calculateDistanceKm,
  buildClosestDestinationGroups,
  buildFallbackDays,
  normalizeAiDays,
  formatDestinationDetails,
};
