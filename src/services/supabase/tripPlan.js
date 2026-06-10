function mapTripPlanItem(row) {
  const destination = row.destinations || {};

  return {
    itemId: row.item_id,
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
    title: row.title,
    mbtiType: row.mbti_type || "",
    region: row.region || "",
    totalDays: row.total_days || 1,
    aiSummary: row.ai_summary || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    itemCount: items.length,
    items,
  };
}

function createTripPlanSelect() {
  return [
    "plan_id",
    "title",
    "mbti_type",
    "region",
    "total_days",
    "ai_summary",
    "created_at",
    "updated_at",
    [
      "trip_plan_items(",
      [
        "item_id",
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

async function getTripPlans(supabaseClient) {
  const { data, error } = await supabaseClient
    .from("trip_plans")
    .select(createTripPlanSelect())
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(mapTripPlan);
}

async function getTripPlanById(supabaseClient, planId) {
  const { data, error } = await supabaseClient
    .from("trip_plans")
    .select(createTripPlanSelect())
    .eq("plan_id", planId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapTripPlan(data) : null;
}

module.exports = {
  getTripPlanById,
  getTripPlans,
  mapTripPlan,
  mapTripPlanItem,
};
