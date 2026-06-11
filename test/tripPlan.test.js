const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_FALLBACK_ITEMS_PER_DAY,
  MAX_TRIP_DAYS,
  calculateDistanceKm,
  calculateTripDays,
  createFallbackPlanDays,
  createTripPlan,
  getCandidateDestinationLimit,
  getCandidateDestinations,
  groupDestinationsByDay,
  hasDestinationImage,
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

test("여행 일수는 시작일과 종료일을 포함해 계산한다", () => {
  assert.equal(calculateTripDays("2026-07-01", "2026-07-07"), MAX_TRIP_DAYS);
  assert.equal(calculateTripDays("2026-07-01", "2026-07-08"), 8);
});

test("후보 관광지 조회 수는 AI 연결을 대비해 일수보다 넉넉하게 제한한다", () => {
  assert.equal(getCandidateDestinationLimit(1), MAX_FALLBACK_ITEMS_PER_DAY);
  assert.equal(getCandidateDestinationLimit(3), 9);
  assert.equal(getCandidateDestinationLimit(10), 21);
});

test("fallback 일정은 하루 최대 3개 후보 관광지를 배치한다", () => {
  const days = createFallbackPlanDays(
    [
      {
        destination_id: 10,
        destination_name: "서울숲",
        description: "도심 공원",
        image_url: "https://example.com/seoul-forest.jpg",
        latitude: 37.5444,
        longitude: 127.0374,
      },
      {
        destination_id: 11,
        destination_name: "북촌",
        address: "서울특별시 종로구",
        latitude: 37.5826,
        longitude: 126.983,
      },
      {
        destination_id: 12,
        destination_name: "성수",
        latitude: 37.5446,
        longitude: 127.0557,
      },
      {
        destination_id: 13,
        destination_name: "한강공원",
        latitude: 37.5285,
        longitude: 126.934,
      },
    ],
    2,
    "첫날은 천천히 이동",
  );

  assert.equal(days.length, 2);
  assert.deepEqual(
    days.map((day) => day.items.map((item) => item.destinationId)),
    [
      [10, 12],
      [11, 13],
    ],
  );
  assert.equal(days[0].items[0].memo, "첫날은 천천히 이동");
  assert.equal(days[0].items[0].imageUrl, "https://example.com/seoul-forest.jpg");
  assert.equal(days[0].items[0].latitude, 37.5444);
  assert.equal(days[0].items[0].longitude, 127.0374);
  assert.equal(days[0].items[1].memo, "");
  assert.ok(days.every((day) => day.items.length <= MAX_FALLBACK_ITEMS_PER_DAY));
});

test("fallback 그룹은 좌표가 있으면 가까운 관광지를 같은 날에 묶는다", () => {
  const destinations = [
    {
      destination_id: 1,
      destination_name: "A",
      latitude: 37.5,
      longitude: 127,
    },
    {
      destination_id: 3,
      destination_name: "C",
      latitude: 35.16,
      longitude: 129.16,
    },
    {
      destination_id: 2,
      destination_name: "B",
      latitude: 37.5004,
      longitude: 127.0004,
    },
    {
      destination_id: 4,
      destination_name: "D",
      latitude: 35.1604,
      longitude: 129.1604,
    },
  ];

  const groups = groupDestinationsByDay(destinations, 2, 2);

  assert.deepEqual(
    groups.map((group) =>
      group.map((destination) => destination.destination_id),
    ),
    [
      [1, 2],
      [3, 4],
    ],
  );
  assert.ok(calculateDistanceKm(destinations[0], destinations[2]) < 1);
});

test("fallback 일정은 후보가 충분하면 각 DAY에 최소 1개 관광지를 배치한다", () => {
  const days = createFallbackPlanDays(
    [
      { destination_id: 51, destination_name: "첫째 후보" },
      { destination_id: 52, destination_name: "둘째 후보" },
      { destination_id: 53, destination_name: "셋째 후보" },
      { destination_id: 54, destination_name: "넷째 후보" },
    ],
    3,
    "",
  );

  assert.equal(days.length, 3);
  assert.deepEqual(
    days.map((day) => day.items.length),
    [2, 1, 1],
  );
  assert.ok(days.every((day) => day.items.length >= 1));
});

test("fallback 일정은 같은 관광지를 한 번만 사용한다", () => {
  const days = createFallbackPlanDays(
    [
      {
        destination_id: 21,
        destination_name: "중복 관광지",
      },
      {
        destination_id: 21,
        destination_name: "중복 관광지",
      },
      {
        destination_id: 22,
        destination_name: "다른 관광지",
      },
    ],
    3,
    "",
  );
  const destinationIds = days.flatMap((day) =>
    day.items.map((item) => item.destinationId),
  );

  assert.deepEqual(destinationIds, [21, 22]);
  assert.equal(new Set(destinationIds).size, destinationIds.length);
});

test("일정 후보 관광지는 이미지가 있는 데이터만 사용한다", async () => {
  assert.equal(hasDestinationImage({ image_url: "https://example.com/a.jpg" }), true);
  assert.equal(hasDestinationImage({ image_url: "" }), false);
  assert.equal(hasDestinationImage({}), false);

  const supabaseClient = {
    from(tableName) {
      if (tableName !== "destinations") {
        throw new Error(`Unexpected table: ${tableName}`);
      }

      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return {
                    data: {
                      destination_id: 40,
                      destination_name: "이미지 없는 선택지",
                      image_url: "",
                    },
                    error: null,
                  };
                },
              };
            },
            order() {
              return {
                limit() {
                  return {
                    async then(resolve) {
                      return resolve({
                        data: [
                          {
                            destination_id: 41,
                            destination_name: "이미지 없는 후보",
                            image_url: null,
                          },
                          {
                            destination_id: 42,
                            destination_name: "이미지 있는 후보",
                            image_url: "https://example.com/with-image.jpg",
                          },
                        ],
                        error: null,
                      });
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const candidates = await getCandidateDestinations(supabaseClient, {
    destinationId: 40,
    region: "",
    limit: 2,
  });

  assert.deepEqual(
    candidates.map((destination) => destination.destination_id),
    [42],
  );
});

test("후보 관광지가 여행 일수보다 적으면 일정을 저장하지 않는다", async () => {
  let didInsertPlan = false;
  const supabaseClient = {
    from(tableName) {
      if (tableName === "travel_mbti_results") {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return { data: { mbti_type: "INFP" }, error: null };
                  },
                };
              },
            };
          },
        };
      }

      if (tableName === "destinations") {
        return {
          select() {
            return {
              order() {
                return {
                  limit() {
                    return {
                      async then(resolve) {
                        return resolve({
                          data: [
                            {
                              destination_id: 31,
                              destination_name: "짧은 후보",
                              image_url: "https://example.com/short.jpg",
                            },
                          ],
                          error: null,
                        });
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (tableName === "trip_plans") {
        return {
          insert() {
            didInsertPlan = true;
            return this;
          },
        };
      }

      throw new Error(`Unexpected table: ${tableName}`);
    },
  };

  await assert.rejects(
    () =>
      createTripPlan(
        supabaseClient,
        { id: "user-1" },
        {
          startDate: "2026-07-01",
          endDate: "2026-07-03",
          peopleCount: 1,
          region: "",
        },
      ),
    /여행지 데이터가 부족하여 3일 일정을 생성할 수 없습니다/,
  );
  assert.equal(didInsertPlan, false);
});
