const test = require("node:test");
const assert = require("node:assert/strict");
const {
  mapTripPlan,
  mapTripPlanItem,
} = require("../src/services/supabase/tripPlan");

test("임시 일정 항목을 여행지 정보와 함께 변환한다", () => {
  const item = mapTripPlanItem({
    item_id: 5,
    destination_id: 12,
    day_number: 2,
    order_index: 1,
    memo: "오후 산책",
    destinations: {
      destination_id: 12,
      destination_name: "서울숲",
      description: "도심 공원",
      address: "서울특별시 성동구",
      province: "서울특별시",
      city: "성동구",
      image_url: "https://example.com/seoul.jpg",
      latitude: 37.5444,
      longitude: 127.0374,
    },
  });

  assert.equal(item.destination.destinationName, "서울숲");
  assert.equal(item.memo, "오후 산책");
  assert.equal(item.dayNumber, 2);
  assert.equal(item.destination.latitude, 37.5444);
  assert.equal(item.destination.longitude, 127.0374);
});

test("임시 일정을 일차와 순서 기준으로 정렬한다", () => {
  const plan = mapTripPlan({
    plan_id: 3,
    title: "서울 여행",
    mbti_type: "INFP",
    region: "서울특별시",
    total_days: 2,
    ai_summary: "천천히 둘러보는 일정",
    trip_plan_items: [
      {
        item_id: 2,
        destination_id: 2,
        day_number: 2,
        order_index: 0,
      },
      {
        item_id: 1,
        destination_id: 1,
        day_number: 1,
        order_index: 1,
      },
    ],
  });

  assert.equal(plan.planId, 3);
  assert.equal(plan.itemCount, 2);
  assert.deepEqual(
    plan.items.map((item) => item.itemId),
    [1, 2],
  );
});
