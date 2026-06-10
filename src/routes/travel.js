const express = require("express");
const { createClient } = require("@supabase/supabase-js");
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
  try {
    const context = await requireAuthenticatedContext(request, response);
    if (!context) return;

    const result = await createTripPlan(
      context.supabase,
      context.user,
      request.body || {},
    );
    return response.status(201).json({
      success: true,
      data: result,
      message: "일정 생성 성공",
    });
  } catch (error) {
    console.error("Trip plan create error:", error);
    return response.status(error.statusCode || 500).json({
      success: false,
      message: getSupabasePermissionMessage("저장", error),
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

    const plan = await getTripPlanById(context.supabase, planId, context.user.id);
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
          province: destination?.province || "",
          city: destination?.city || "",
          address: destination?.address || "",
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
  const normalizedAiDays = Array.isArray(aiDays) ? aiDays.slice(0, travelDays) : [];

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

module.exports.__testables = {
  calculateDistanceKm,
  buildClosestDestinationGroups,
  buildFallbackDays,
  normalizeAiDays,
  formatDestinationDetails,
};
