const express = require("express");
const { normalizeTourDestination } = require("../services/destination-processing/tourDataNormalizer");

const router = express.Router();
const itineraryCache = new Map();

function getBearerToken(authorizationHeader) {
  const [scheme, token] = String(authorizationHeader || "").split(" ");
  return scheme === "Bearer" && token ? token : null;
}

function createSupabaseHeaders(anonKey, accessToken) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
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

function currentUserFromAccessToken(accessToken) {
  const payload = String(accessToken || "").split(".")[1];
  if (!payload) return "";
  try {
    const decoded = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const body = JSON.parse(decoded);
    return body?.sub || "";
  } catch {
    return "";
  }
}

function parseJsonBlock(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
  const payload = fenced ? fenced[1] : raw;
  try {
    return JSON.parse(payload);
  } catch {
    const start = payload.indexOf("{");
    const end = payload.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(payload.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeRegion(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function buildCacheKey({ userId, startDate, endDate, region, memo, peopleCount, destinationId }) {
  return [userId, startDate, endDate, region, memo, peopleCount, destinationId || ""]
    .map((value) => String(value || "").trim().toLowerCase())
    .join("|");
}

function buildFallbackDays({ daysCount, destinationName, region, memo }) {
  const baseItems = [
    { time: "09:00", placeName: "출발 및 이동", description: "여행지로 이동하며 일정을 시작합니다." },
    { time: "11:00", placeName: "핵심 관광", description: `${destinationName || region || "선택한 지역"}의 대표 코스를 둘러봅니다.` },
    { time: "13:00", placeName: "점심 식사", description: "지역 맛집에서 식사를 하며 잠시 쉬어갑니다." },
    { time: "15:00", placeName: "자유 시간", description: memo ? `${memo}를 반영해 여유롭게 둘러봅니다.` : "카페, 산책, 전시 등 취향에 맞게 자유 시간을 보냅니다." },
    { time: "18:00", placeName: "저녁 식사", description: "현지 분위기를 느낄 수 있는 곳에서 저녁을 즐깁니다." },
  ];

  return Array.from({ length: daysCount }, (_, index) => ({
    day: index + 1,
    items: baseItems.slice(0, index === 0 ? 5 : 4),
  }));
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
  return String(Array.isArray(prefs) ? prefs[0]?.mbti_type : "").trim().toUpperCase();
}

async function fetchDestinationScores({ supabaseUrl, headers, mbtiType }) {
  const url = new URL("/rest/v1/destination_mbti_scores", supabaseUrl);
  url.searchParams.set(
    "select",
    "destination_id,score,destinations(destination_id,destination_name,province,city,description,address,image_url,latitude,longitude,category)"
  );
  url.searchParams.set("mbti_type", `eq.${mbtiType}`);
  url.searchParams.set("order", "score.desc,destination_id.asc");
  url.searchParams.set("limit", "12");
  const rows = await requestSupabaseJson(fetch, url, headers);
  return Array.isArray(rows) ? rows : [];
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
        : "https://apis.data.go.kr/B551011/KorService2/areaBasedList2"
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

function mapTourDestination(item) {
  const destination = normalizeTourDestination(item);
  const addressParts = String(destination.address || "").split(" ").filter(Boolean);
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

async function callGemini({ apiKey, prompt }) {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.6, responseMimeType: "application/json" },
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.message || body?.message || "Gemini 요청에 실패했습니다.";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  const text = body?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "";
  const parsed = parseJsonBlock(text);
  if (!parsed) throw new Error("Gemini 응답을 JSON으로 해석하지 못했습니다.");
  return parsed;
}

async function getGeneratedItinerary({ cacheKey, geminiApiKey, prompt, fallbackPayload }) {
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

router.post("/plan", async (request, response) => {
  const accessToken = getBearerToken(request.get("authorization"));
  if (!accessToken) {
    return response.status(401).json({ success: false, message: "로그인이 필요합니다." });
  }

  const startDate = String(request.body?.startDate || "").trim();
  const endDate = String(request.body?.endDate || "").trim();
  const region = String(request.body?.region || "").trim();
  const memo = String(request.body?.memo || "").trim();
  const peopleCount = Number.parseInt(request.body?.peopleCount, 10);
  const destinationId = Number.parseInt(request.body?.destinationId, 10);

  if (!startDate || !endDate) {
    return response.status(400).json({ success: false, message: "여행 시작일과 종료일은 필수입니다." });
  }
  if (!Number.isFinite(peopleCount) || peopleCount < 1) {
    return response.status(400).json({ success: false, message: "인원수는 1명 이상이어야 합니다." });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const tourApiKey = process.env.TOUR_API_KEY;
  if (!supabaseUrl || !anonKey || !geminiApiKey) {
    return response.status(500).json({ success: false, message: "서버 환경설정이 올바르지 않습니다." });
  }

  try {
    const userId = currentUserFromAccessToken(accessToken);
    if (!userId) {
      return response.status(401).json({ success: false, message: "사용자 정보를 확인할 수 없습니다." });
    }

    const headers = createSupabaseHeaders(anonKey, accessToken);
    const userMbti = await fetchUserMbti({ supabaseUrl, headers, userId });

    const destinationUrl = new URL("/rest/v1/destinations", supabaseUrl);
    destinationUrl.searchParams.set(
      "select",
      "destination_id,destination_name,province,city,description,category,image_url,address,latitude,longitude"
    );
    destinationUrl.searchParams.set("order", "destination_id.asc");
    destinationUrl.searchParams.set("limit", "50");

    const destinationRows = await requestSupabaseJson(fetch, destinationUrl, headers);
    const destinations = Array.isArray(destinationRows) ? destinationRows : [];
    if (!destinations.length) {
      return response.status(404).json({
        success: false,
        message: region ? "해당 지역에 맞는 여행지를 찾지 못했습니다." : "여행지 데이터가 없습니다.",
      });
    }

    const scoreRows = userMbti ? await fetchDestinationScores({ supabaseUrl, headers, mbtiType: userMbti }) : [];
    const scoreMap = new Map(scoreRows.map((row) => [String(row.destination_id), Number(row.score) || 0]));

    let rankedDestinations = destinations
      .map((destination) => ({
        ...destination,
        mbti_score: scoreMap.get(String(destination.destination_id)) || 0,
      }))
      .sort((left, right) => right.mbti_score - left.mbti_score);

    const selectedDestination = Number.isFinite(destinationId)
      ? destinations.find((destination) => Number(destination.destination_id) === destinationId) || null
      : null;

    if (selectedDestination) {
      rankedDestinations = [
        {
          ...selectedDestination,
          mbti_score: scoreMap.get(String(selectedDestination.destination_id)) || 0,
        },
        ...rankedDestinations.filter(
          (destination) => Number(destination.destination_id) !== Number(selectedDestination.destination_id)
        ),
      ];
    }

    const activeRegion = region || [selectedDestination?.province, selectedDestination?.city].filter(Boolean).join(" ");
    const selectedKeyword = selectedDestination?.destination_name || activeRegion || "";
    const travelDays = Math.max(
      1,
      Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1
    );
    const itemsPerDay = travelDays >= 3 ? 4 : 3;

    const tourItems = tourApiKey
      ? await fetchTourApiItems({ tourApiKey, region: activeRegion, keyword: selectedKeyword })
      : [];
    const tourDestinations = tourItems.map(mapTourDestination).filter((item) => item.destination_name);
    const tourDestination =
      tourDestinations.find((item) => {
        if (selectedDestination?.destination_name) {
          return normalizeRegion(item.destination_name).includes(normalizeRegion(selectedDestination.destination_name));
        }
        return activeRegion
          ? normalizeRegion([item.province, item.city, item.address, item.destination_name].filter(Boolean).join(" ")).includes(
              normalizeRegion(activeRegion)
            )
          : true;
      }) || tourDestinations[0] || null;
    const matchedDbDestination =
      tourDestination &&
      rankedDestinations.find((destination) => {
        const dbName = normalizeRegion(destination.destination_name);
        const apiName = normalizeRegion(tourDestination.destination_name);
        const dbAddress = normalizeRegion(destination.address);
        const apiAddress = normalizeRegion(tourDestination.address);
        return (
          (dbName && apiName && (dbName.includes(apiName) || apiName.includes(dbName))) ||
          (dbAddress && apiAddress && (dbAddress.includes(apiAddress) || apiAddress.includes(dbAddress)))
        );
      });

    const finalDestination = {
      ...(matchedDbDestination || selectedDestination || rankedDestinations[0] || {}),
      ...(tourDestination || {}),
      address: tourDestination?.address || matchedDbDestination?.address || selectedDestination?.address || "",
      province: tourDestination?.province || matchedDbDestination?.province || selectedDestination?.province || "",
      city: tourDestination?.city || matchedDbDestination?.city || selectedDestination?.city || "",
    };

    const prompt = `
여행 MBTI: ${userMbti || "UNKNOWN"}
시작일: ${startDate}
종료일: ${endDate}
인원수: ${peopleCount}
지역: ${activeRegion || finalDestination?.address || "전체"}
메모: ${memo || "없음"}
여행 일수: ${travelDays}
하루 일정 수: ${itemsPerDay}
선택 목적지: ${finalDestination ? `${finalDestination.destination_name} (${finalDestination.address || activeRegion})` : "없음"}

아래 후보 중 가장 적합한 목적지를 기준으로 여행 일정을 작성해 주세요.
반드시 JSON만 응답하세요.
후보 목록:
${rankedDestinations
  .slice(0, 12)
  .map((destination) => {
    const regionText = [destination.province, destination.city].filter(Boolean).join(" ");
    return [
      `- destination_id: ${destination.destination_id}`,
      `  name: ${destination.destination_name}`,
      `  region: ${regionText}`,
      `  category: ${destination.category || ""}`,
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
      destinationName: finalDestination?.destination_name || rankedDestinations[0]?.destination_name || activeRegion,
      region: finalDestination?.address || activeRegion,
      memo,
    });
    const fallbackPayload = {
      mainDestinationId: finalDestination?.destination_id || rankedDestinations[0]?.destination_id || null,
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
      (destination) => String(destination.destination_id) === String(aiResult.mainDestinationId)
    );
    const mainDestination = {
      ...(aiSuggestedDestination || rankedDestinations[0] || {}),
      ...finalDestination,
    };
    const safeDays = Array.isArray(aiResult.days) && aiResult.days.length ? aiResult.days : fallbackDays;

    return response.json({
      success: true,
      data: {
        trip: {
          title: String(aiResult.tripTitle || "").trim() || `${activeRegion || "국내"} 여행 일정`,
          summary: String(aiResult.summary || "").trim(),
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

module.exports = router;
