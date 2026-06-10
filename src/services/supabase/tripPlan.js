const MAX_TRIP_DAYS = 7;
const MAX_FALLBACK_ITEMS_PER_DAY = 3;
const AI_READY_CANDIDATE_MULTIPLIER = 3;

function mapTripPlanItem(row) {
  const destination = row.destinations || {};

  return {
    itemId: row.item_id,
    userId: row.user_id || "",
    destinationId: row.destination_id,
    dayNumber: row.day_number,
    orderIndex: row.order_index,
    memo: row.memo || "",
    destination: {
      destinationId: destination.destination_id || row.destination_id,
      destinationName: destination.destination_name || "이름 없는 여행지",
      description: destination.description || "",
      address: destination.address || "",
      province: destination.province || "",
      city: destination.city || "",
      imageUrl: destination.image_url || "",
      latitude: Number(destination.latitude) || null,
      longitude: Number(destination.longitude) || null,
    },
  };
}

function mapTripPlan(row) {
  const items = (row.trip_plan_items || [])
    .map(mapTripPlanItem)
    .sort(
      (firstItem, secondItem) =>
        firstItem.dayNumber - secondItem.dayNumber ||
        firstItem.orderIndex - secondItem.orderIndex,
    );

  return {
    planId: row.plan_id,
    userId: row.user_id || "",
    title: row.title,
    mbtiType: row.mbti_type || "",
    region: row.region || "",
    totalDays: row.total_days || 1,
    aiSummary: row.ai_summary || "",
    status: row.status || "planning",
    completedAt: row.completed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    itemCount: items.length,
    items,
  };
}

function calculateTripDays(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor((end - start) / dayMs) + 1;
}

function getCandidateDestinationLimit(totalDays) {
  return Math.min(
    MAX_TRIP_DAYS * AI_READY_CANDIDATE_MULTIPLIER,
    Math.max(totalDays, 1) * AI_READY_CANDIDATE_MULTIPLIER,
  );
}

function hasDestinationImage(destination) {
  return Boolean(String(destination?.image_url || "").trim());
}

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

function findClosestDestinationIndex(anchorDestination, destinations) {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  destinations.forEach((destination, index) => {
    const distance = calculateDistanceKm(anchorDestination, destination);
    if (distance === null) return;

    const isCloser = distance < bestDistance;
    const isSameDistanceLowerId =
      distance === bestDistance &&
      Number(destination.destination_id) <
        Number(destinations[bestIndex]?.destination_id);

    if (isCloser || isSameDistanceLowerId) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function groupDestinationsByDay(
  destinations,
  totalDays,
  maxItemsPerDay = MAX_FALLBACK_ITEMS_PER_DAY,
) {
  const seenDestinationIds = new Set();
  const available = [];

  for (const destination of Array.isArray(destinations) ? destinations : []) {
    if (!destination) continue;

    const destinationId = String(destination.destination_id || "");
    if (!destinationId || seenDestinationIds.has(destinationId)) continue;

    seenDestinationIds.add(destinationId);
    available.push(destination);
  }

  const groups = Array.from({ length: totalDays }, () => []);

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 1) {
    if (available.length === 0) break;
    groups[dayIndex].push(available.shift());
  }

  while (available.length > 0) {
    let didAssign = false;

    for (const dayDestinations of groups) {
      if (available.length === 0) break;
      if (dayDestinations.length === 0) continue;
      if (dayDestinations.length >= maxItemsPerDay) continue;

      const anchorDestination = dayDestinations.at(-1);
      const closestIndex = findClosestDestinationIndex(
        anchorDestination,
        available,
      );
      dayDestinations.push(available.splice(closestIndex, 1)[0]);
      didAssign = true;
    }

    if (!didAssign) break;
  }

  return groups;
}

function createTripPlanSelect() {
  return [
    "plan_id",
    "user_id",
    "title",
    "mbti_type",
    "region",
    "total_days",
    "ai_summary",
    "status",
    "completed_at",
    "created_at",
    "updated_at",
    [
      "trip_plan_items(",
      [
        "item_id",
        "user_id",
        "destination_id",
        "day_number",
        "order_index",
        "memo",
        [
          "destinations(",
          [
            "destination_id",
            "destination_name",
            "description",
            "address",
            "province",
            "city",
            "image_url",
            "latitude",
            "longitude",
          ].join(","),
          ")",
        ].join(""),
      ].join(","),
      ")",
    ].join(""),
  ].join(",");
}

function createDestinationSelect() {
  return [
    "destination_id",
    "destination_name",
    "description",
    "address",
    "province",
    "city",
    "image_url",
    "latitude",
    "longitude",
  ].join(",");
}

function normalizeRegionKeyword(region) {
  return String(region || "")
    .trim()
    .replace(/,/g, " ")
    .replace(/\s+/g, " ");
}

async function getUserMbtiType(supabaseClient, userId) {
  const { data, error } = await supabaseClient
    .from("travel_mbti_results")
    .select("mbti_type")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return "";
  return data?.mbti_type || "";
}

async function getDestinationById(supabaseClient, destinationId) {
  if (!Number.isFinite(destinationId) || destinationId < 1) return null;

  const { data, error } = await supabaseClient
    .from("destinations")
    .select(createDestinationSelect())
    .eq("destination_id", destinationId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function getCandidateDestinations(
  supabaseClient,
  { destinationId, region, limit, mbtiType = "" },
) {
  const destinations = [];

  // 사용자가 상세 화면에서 선택한 관광지는 후보 목록의 첫 번째 우선순위로 유지한다.
  const selectedDestination = await getDestinationById(
    supabaseClient,
    destinationId,
  );
  if (hasDestinationImage(selectedDestination)) {
    destinations.push(selectedDestination);
  }

  const remainingLimit = Math.max(limit - destinations.length, 0);
  if (remainingLimit < 1) return destinations;

  const regionKeyword = normalizeRegionKeyword(region);
  // 현재는 지역 기반 후보 선정만 수행하고, 추후 키워드/MBTI 가중치는 이 함수에 추가한다.
  void mbtiType;
  let query = supabaseClient
    .from("destinations")
    .select(createDestinationSelect())
    .order("destination_id", { ascending: true })
    .limit(remainingLimit * 3 + 12);

  if (regionKeyword) {
    const searchValue = `%${regionKeyword}%`;
    query = query.or(
      [
        `province.ilike.${searchValue}`,
        `city.ilike.${searchValue}`,
        `destination_name.ilike.${searchValue}`,
        `address.ilike.${searchValue}`,
      ].join(","),
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  const selectedIds = new Set(
    destinations.map((destination) => destination.destination_id),
  );
  for (const destination of data || []) {
    if (!hasDestinationImage(destination)) continue;

    if (!selectedIds.has(destination.destination_id)) {
      destinations.push(destination);
      selectedIds.add(destination.destination_id);
    }
    if (destinations.length >= limit) break;
  }

  return destinations;
}

function createFallbackPlanDays(destinations, totalDays, memo) {
  const fallbackDestinations = Array.isArray(destinations)
    ? destinations.filter(Boolean)
    : [];

  if (fallbackDestinations.length === 0) {
    return [];
  }

  // AI 응답이 실패해도 저장 흐름이 끊기지 않도록 검증된 후보 관광지를 가까운 곳끼리 묶는다.
  return groupDestinationsByDay(fallbackDestinations, totalDays).map(
    (dayDestinations, dayIndex) => {
      return {
        day: dayIndex + 1,
        items: dayDestinations.map((destination, itemIndex) => ({
          placeName: destination.destination_name || "이름 없는 여행지",
          description:
            destination.description ||
            destination.address ||
            "선택한 조건에 맞춰 방문하기 좋은 여행지입니다.",
          memo: dayIndex === 0 && itemIndex === 0 ? memo : "",
          destinationId: destination.destination_id,
          imageUrl: destination.image_url || "",
          address: destination.address || "",
          province: destination.province || "",
          city: destination.city || "",
          latitude: destination.latitude || null,
          longitude: destination.longitude || null,
        })),
      };
    },
  );
}

async function cleanupInsertedPlan(supabaseClient, insertedPlan, userId) {
  if (!insertedPlan?.plan_id) return;

  await supabaseClient
    .from("trip_plans")
    .delete()
    .eq("plan_id", insertedPlan.plan_id)
    .eq("user_id", userId);
}

async function createTripPlan(supabaseClient, user, payload) {
  const startDate = String(payload.startDate || "").trim();
  const endDate = String(payload.endDate || "").trim();
  const peopleCount = Number.parseInt(payload.peopleCount, 10);
  const destinationId = Number.parseInt(payload.destinationId, 10);
  const region = normalizeRegionKeyword(payload.region);
  const memo = String(payload.memo || "").trim();
  const totalDays = calculateTripDays(startDate, endDate);

  if (!startDate || !endDate || totalDays < 1) {
    const error = new Error("유효한 여행 시작일과 종료일이 필요합니다.");
    error.statusCode = 400;
    throw error;
  }

  if (totalDays > MAX_TRIP_DAYS) {
    const error = new Error(`여행 일정은 최대 ${MAX_TRIP_DAYS}일까지만 생성할 수 있습니다.`);
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isFinite(peopleCount) || peopleCount < 1) {
    const error = new Error("인원수는 1명 이상이어야 합니다.");
    error.statusCode = 400;
    throw error;
  }

  const mbtiType = await getUserMbtiType(supabaseClient, user.id);
  const candidateDestinations = await getCandidateDestinations(supabaseClient, {
    destinationId,
    region,
    mbtiType,
    limit: getCandidateDestinationLimit(totalDays),
  });

  if (candidateDestinations.length === 0) {
    const error = new Error("일정 생성에 사용할 관광지 데이터가 없습니다.");
    error.statusCode = 404;
    throw error;
  }

  if (candidateDestinations.length < totalDays) {
    const error = new Error(
      `여행지 데이터가 부족하여 ${totalDays}일 일정을 생성할 수 없습니다. 현재 조건에서는 ${candidateDestinations.length}개의 관광지만 사용할 수 있습니다.`,
    );
    error.statusCode = 400;
    throw error;
  }

  const representativeDestination = candidateDestinations[0];
  const titleRegion =
    region ||
    representativeDestination.province ||
    representativeDestination.city ||
    representativeDestination.destination_name ||
    "국내";
  const aiSummary = `${titleRegion} 중심으로 ${totalDays}일 동안 둘러보는 ${peopleCount}명 여행 일정입니다.`;

  const { data: insertedPlan, error: planError } = await supabaseClient
    .from("trip_plans")
    .insert({
      user_id: user.id,
      title: `${titleRegion} 여행`,
      mbti_type: mbtiType || null,
      region: titleRegion,
      total_days: totalDays,
      ai_summary: aiSummary,
      status: "planning",
    })
    .select(
      "plan_id,user_id,title,mbti_type,region,total_days,ai_summary,status,completed_at,created_at,updated_at",
    )
    .single();

  if (planError) throw planError;

  const planDays = createFallbackPlanDays(candidateDestinations, totalDays, memo);
  const tripPlanItems = planDays.flatMap((day) =>
    day.items.map((item, itemIndex) => ({
      plan_id: insertedPlan.plan_id,
      user_id: user.id,
      destination_id: item.destinationId,
      day_number: day.day,
      order_index: itemIndex + 1,
      memo: item.memo || null,
    })),
  );

  if (tripPlanItems.length === 0) {
    await cleanupInsertedPlan(supabaseClient, insertedPlan, user.id);
    const error = new Error("저장할 일정 항목을 생성하지 못했습니다.");
    error.statusCode = 500;
    throw error;
  }

  const { error: itemError } = await supabaseClient
    .from("trip_plan_items")
    .insert(tripPlanItems);

  if (itemError) {
    await cleanupInsertedPlan(supabaseClient, insertedPlan, user.id);
    throw itemError;
  }

  return {
    trip: {
      planId: insertedPlan.plan_id,
      userId: insertedPlan.user_id || user.id,
      title: insertedPlan.title,
      summary: insertedPlan.ai_summary || aiSummary,
      mbtiType: insertedPlan.mbti_type || "",
      region: insertedPlan.region || titleRegion,
      totalDays: insertedPlan.total_days || totalDays,
      status: insertedPlan.status || "planning",
      completedAt: insertedPlan.completed_at || null,
      createdAt: insertedPlan.created_at,
      updatedAt: insertedPlan.updated_at,
    },
    plan: {
      days: planDays,
    },
  };
}

async function getTripPlans(supabaseClient, userId) {
  const { data, error } = await supabaseClient
    .from("trip_plans")
    .select(createTripPlanSelect())
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(mapTripPlan);
}

async function getTripPlanById(supabaseClient, planId, userId) {
  const { data, error } = await supabaseClient
    .from("trip_plans")
    .select(createTripPlanSelect())
    .eq("plan_id", planId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapTripPlan(data) : null;
}

async function updateTripPlanStatus(supabaseClient, planId, status, userId) {
  const updatePayload = {
    status,
    completed_at: status === "completed" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseClient
    .from("trip_plans")
    .update(updatePayload)
    .eq("plan_id", planId)
    .eq("user_id", userId)
    .select(createTripPlanSelect())
    .maybeSingle();

  if (error) throw error;
  return data ? mapTripPlan(data) : null;
}

async function deleteTripPlan(supabaseClient, planId, userId) {
  const { error } = await supabaseClient
    .from("trip_plans")
    .delete()
    .eq("plan_id", planId)
    .eq("user_id", userId);

  if (error) throw error;
  return true;
}

module.exports = {
  MAX_TRIP_DAYS,
  MAX_FALLBACK_ITEMS_PER_DAY,
  calculateDistanceKm,
  calculateTripDays,
  createTripPlan,
  deleteTripPlan,
  getTripPlanById,
  getTripPlans,
  mapTripPlan,
  mapTripPlanItem,
  updateTripPlanStatus,
};
