const assert = require("node:assert/strict");
const test = require("node:test");

const {
  __testables: {
    calculateDistanceKm,
    buildClosestDestinationGroups,
    buildFallbackDays,
    normalizeAiDays,
    formatDestinationDetails,
  },
} = require("../src/routes/travel");

test("가까운 여행지끼리 같은 날짜 그룹으로 묶는다", () => {
  const destinations = [
    {
      destination_id: 1,
      destination_name: "A",
      province: "서울특별시",
      city: "강남구",
      latitude: 37.5,
      longitude: 127,
      mbti_score: 90,
    },
    {
      destination_id: 2,
      destination_name: "B",
      province: "서울특별시",
      city: "서초구",
      latitude: 37.5004,
      longitude: 127.0004,
      mbti_score: 80,
    },
    {
      destination_id: 3,
      destination_name: "C",
      province: "부산광역시",
      city: "해운대구",
      latitude: 35.16,
      longitude: 129.16,
      mbti_score: 70,
    },
  ];

  const groups = buildClosestDestinationGroups(destinations, 2);

  assert.deepEqual(
    groups.map((group) => group.map((destination) => destination.destination_id)),
    [
      [1, 2],
      [3],
    ],
  );
  assert.ok(calculateDistanceKm(destinations[0], destinations[1]) < 1);
  assert.ok(calculateDistanceKm(destinations[0], destinations[2]) > 200);
});

test("fallback 일정은 날짜별 2개 추천을 유지한다", () => {
  const travelDates = ["2026-06-10", "2026-06-11"];
  const destinationGroups = [
    [
      {
        destination_id: 1,
        destination_name: "A",
        province: "서울특별시",
        city: "강남구",
        description: "강남의 대표적인 산책 코스",
        image_url: "https://example.com/a.jpg",
        latitude: 37.5,
        longitude: 127,
      },
      {
        destination_id: 2,
        destination_name: "B",
        province: "서울특별시",
        city: "서초구",
        latitude: 37.5004,
        longitude: 127.0004,
      },
    ],
    [
      {
        destination_id: 3,
        destination_name: "C",
        province: "부산광역시",
        city: "해운대구",
        latitude: 35.16,
        longitude: 129.16,
      },
    ],
  ];

  const fallbackDays = buildFallbackDays({
    daysCount: 2,
    travelDates,
    destinationName: "테스트 여행",
    region: "서울특별시",
    memo: "",
    destinationGroups,
  });

  assert.equal(fallbackDays[0].date, "2026-06-10");
  assert.equal(fallbackDays[0].items.length, 2);
  assert.equal(fallbackDays[0].items[0].description, "강남의 대표적인 산책 코스");
  assert.equal(fallbackDays[0].items[0].image_url, "https://example.com/a.jpg");
  assert.equal(fallbackDays[1].items.length, 1);
});

test("AI 응답이 있어도 fallback의 가까운 목적지 배치를 유지한다", () => {
  const fallbackDays = [
    {
      day: 1,
      dayLabel: "DAY 1",
      date: "2026-06-10",
      items: [{ placeName: "A" }, { placeName: "B" }],
    },
  ];

  const normalized = normalizeAiDays(
    [
      {
        day: 1,
        dayLabel: "DAY 1",
        date: "2026-06-10",
        items: [{ placeName: "X" }],
      },
    ],
    1,
    ["2026-06-10"],
    fallbackDays,
  );

  assert.deepEqual(normalized[0].items, fallbackDays[0].items);
});

test("상세 설명은 여행지명과 지역명을 포함한다", () => {
  const description = formatDestinationDetails(
    {
      destination_name: "협재해수욕장",
      province: "제주특별자치도",
      city: "제주시",
      latitude: 33.1,
      longitude: 126.2,
    },
    "관광지 1",
  );

  assert.match(description, /협재해수욕장/);
  assert.match(description, /제주특별자치도 제주시/);
});
