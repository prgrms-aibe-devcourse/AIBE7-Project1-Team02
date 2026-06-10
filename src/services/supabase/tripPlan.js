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

async function getDestinationsForTrip(
  supabaseClient,
  { destinationId, region, limit },
) {
  const destinations = [];
  const selectedDestination = await getDestinationById(
    supabaseClient,
    destinationId,
  );
  if (selectedDestination) destinations.push(selectedDestination);

  const remainingLimit = Math.max(limit - destinations.length, 0);
  if (remainingLimit < 1) return destinations;

  const regionKeyword = normalizeRegionKeyword(region);
  let query = supabaseClient
    .from("destinations")
    .select(createDestinationSelect())
    .order("destination_id", { ascending: true })
    .limit(remainingLimit + 8);

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
    if (!selectedIds.has(destination.destination_id)) {
      destinations.push(destination);
      selectedIds.add(destination.destination_id);
    }
    if (destinations.length >= limit) break;
  }

  return destinations;
}

function createPlanDays(destinations, totalDays, memo) {
  return Array.from({ length: totalDays }, (_, index) => {
    const destination = destinations[index % destinations.length];
    return {
      day: index + 1,
      items: [
        {
          time: "10:00",
          placeName: destination.destination_name || "이름 없는 여행지",
          description:
            destination.description ||
            destination.address ||
            "선택한 조건에 맞춰 방문하기 좋은 여행지입니다.",
          memo: index === 0 ? memo : "",
          destinationId: destination.destination_id,
        },
      ],
    };
  });
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

  if (!Number.isFinite(peopleCount) || peopleCount < 1) {
    const error = new Error("인원수는 1명 이상이어야 합니다.");
    error.statusCode = 400;
    throw error;
  }

  const destinations = await getDestinationsForTrip(supabaseClient, {
    destinationId,
    region,
    limit: Math.min(totalDays, 7),
  });

  if (destinations.length === 0) {
    const error = new Error("일정 생성에 사용할 관광지 데이터가 없습니다.");
    error.statusCode = 404;
    throw error;
  }

  const mbtiType = await getUserMbtiType(supabaseClient, user.id);
  const representativeDestination = destinations[0];
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

  const planDays = createPlanDays(destinations, totalDays, memo);
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

  const { error: itemError } = await supabaseClient
    .from("trip_plan_items")
    .insert(tripPlanItems);

  if (itemError) {
    await supabaseClient
      .from("trip_plans")
      .delete()
      .eq("plan_id", insertedPlan.plan_id);
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

module.exports = {
  createTripPlan,
  getTripPlanById,
  getTripPlans,
  mapTripPlan,
  mapTripPlanItem,
  updateTripPlanStatus,
};
