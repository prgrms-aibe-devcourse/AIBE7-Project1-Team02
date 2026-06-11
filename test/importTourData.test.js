const assert = require("node:assert/strict");
const test = require("node:test");

const {
  chunkRows,
  CONTENT_TYPE_TARGETS,
  getSelectedRegions,
  getTotalPages,
  getTourApiItems,
  hasRequiredListFields,
  isTourApiQuotaError,
  processPageItems,
  selectDistributedPages,
} = require("../src/scripts/importTourData");

test("지역별 유형 목표는 총 100개이며 40:25:25:10 비율이다", () => {
  assert.deepEqual(
    CONTENT_TYPE_TARGETS.map(({ contentTypeId, targetCount }) => ({
      contentTypeId,
      targetCount,
    })),
    [
      { contentTypeId: 12, targetCount: 40 },
      { contentTypeId: 14, targetCount: 25 },
      { contentTypeId: 39, targetCount: 25 },
      { contentTypeId: 28, targetCount: 10 },
    ],
  );
  assert.equal(
    CONTENT_TYPE_TARGETS.reduce(
      (total, contentType) => total + contentType.targetCount,
      0,
    ),
    100,
  );
});

test("TourAPI totalCount를 기준으로 마지막 페이지까지 계산한다", () => {
  assert.equal(getTotalPages(0, 100), 0);
  assert.equal(getTotalPages(100, 100), 1);
  assert.equal(getTotalPages(101, 100), 2);
  assert.equal(getTotalPages(1249, 100), 13);
});

test("TourAPI 단일 item 응답도 배열로 정규화한다", () => {
  const item = { contentid: "1", title: "경복궁" };

  assert.deepEqual(getTourApiItems({ items: { item } }), [item]);
  assert.deepEqual(getTourApiItems({ items: "" }), []);
});

test("제한된 페이지를 전체 구간에 균등하게 분산 선택한다", () => {
  assert.deepEqual(selectDistributedPages(127, 3), [1, 64, 127]);
  assert.deepEqual(selectDistributedPages(10, 4), [1, 4, 7, 10]);
  assert.deepEqual(selectDistributedPages(3, 5), [1, 2, 3]);
  assert.deepEqual(selectDistributedPages(5, 1), [3]);
  assert.deepEqual(selectDistributedPages(4, 0), [1, 2, 3, 4]);
});

test("설정한 지역명은 TourAPI 지역 코드로 변환한다", () => {
  assert.deepEqual(getSelectedRegions("서울특별시, 제주특별자치도"), [
    { name: "서울특별시", areaCode: "1" },
    { name: "제주특별자치도", areaCode: "39" },
  ]);
  assert.throws(
    () => getSelectedRegions("없는지역"),
    /지원하지 않는 지역/,
  );
});

test("주소, 이미지, 좌표가 모두 있어야 목록 저장 후보가 된다", () => {
  const validItem = {
    addr1: "서울특별시 종로구",
    firstimage: "https://example.com/image.jpg",
    mapx: "126.976",
    mapy: "37.579",
  };

  assert.equal(hasRequiredListFields(validItem), true);
  assert.equal(hasRequiredListFields({ ...validItem, addr1: "" }), false);
  assert.equal(hasRequiredListFields({ ...validItem, firstimage: "" }), false);
});

test("페이지 데이터는 중복과 필수 정보가 없는 항목을 제외한다", async () => {
  const seenTourContentIds = new Set(["1"]);
  const stats = { invalid: 0, noDescription: 0, duplicates: 0 };
  const processedItems = await processPageItems(
    [
      {
        contentid: "1",
        contenttypeid: "12",
        title: "기존 관광지",
        addr1: "서울특별시 종로구",
        firstimage: "https://example.com/existing.jpg",
        mapx: "126.9",
        mapy: "37.5",
      },
      {
        contentid: "2",
        contenttypeid: "12",
        title: "경복궁",
        addr1: "서울특별시 종로구",
        firstimage: "https://example.com/gyeongbokgung.jpg",
        mapx: "126.976",
        mapy: "37.579",
      },
      {
        contentid: "3",
        contenttypeid: "12",
        title: "주소 없는 관광지",
      },
    ],
    seenTourContentIds,
    stats,
    async () => "조선 시대의 궁궐입니다.",
  );

  assert.equal(processedItems.length, 1);
  assert.equal(processedItems[0].destination.destinationName, "경복궁");
  assert.equal(
    processedItems[0].destination.description,
    "조선 시대의 궁궐입니다.",
  );
  assert.equal(stats.duplicates, 1);
  assert.equal(stats.invalid, 1);
});

test("상세 설명이 없는 관광지는 제외한다", async () => {
  const stats = { invalid: 0, noDescription: 0, duplicates: 0 };
  const processedItems = await processPageItems(
    [
      {
        contentid: "2",
        contenttypeid: "12",
        title: "설명 없는 관광지",
        addr1: "서울특별시 종로구",
        firstimage: "https://example.com/image.jpg",
        mapx: "126.976",
        mapy: "37.579",
      },
    ],
    new Set(),
    stats,
    async () => "",
  );

  assert.deepEqual(processedItems, []);
  assert.equal(stats.noDescription, 1);
});

test("TourAPI 429 오류는 다음 관광지로 넘어가지 않고 즉시 전파한다", async () => {
  const stats = { invalid: 0, noDescription: 0, duplicates: 0 };
  let descriptionRequestCount = 0;
  const quotaError = new Error("TourAPI 일일 호출 한도를 초과했습니다.");
  quotaError.statusCode = 429;

  await assert.rejects(
    processPageItems(
      [
        {
          contentid: "1",
          contenttypeid: "12",
          title: "관광지 1",
          addr1: "강원특별자치도 삼척시",
          firstimage: "https://example.com/image-1.jpg",
          mapx: "129.1",
          mapy: "37.4",
        },
        {
          contentid: "2",
          contenttypeid: "12",
          title: "관광지 2",
          addr1: "강원특별자치도 강릉시",
          firstimage: "https://example.com/image-2.jpg",
          mapx: "128.9",
          mapy: "37.7",
        },
      ],
      new Set(),
      stats,
      async () => {
        descriptionRequestCount += 1;
        throw quotaError;
      },
    ),
    (error) => isTourApiQuotaError(error),
  );

  assert.equal(descriptionRequestCount, 1);
  assert.equal(stats.invalid, 0);
});

test("유형별 남은 목표 수량만큼만 상세 데이터를 가공한다", async () => {
  const stats = { invalid: 0, noDescription: 0, duplicates: 0 };
  let descriptionRequestCount = 0;
  const items = Array.from({ length: 5 }, (_, index) => ({
    contentid: String(index + 1),
    contenttypeid: "12",
    title: `관광지 ${index + 1}`,
    addr1: "서울특별시 종로구",
    firstimage: `https://example.com/image-${index + 1}.jpg`,
    mapx: "126.976",
    mapy: "37.579",
  }));

  const processedItems = await processPageItems(
    items,
    new Set(),
    stats,
    async () => {
      descriptionRequestCount += 1;
      return "상세 설명";
    },
    2,
  );

  assert.equal(processedItems.length, 2);
  assert.equal(descriptionRequestCount, 2);
});

test("DB 일괄 저장 크기에 맞춰 행을 분할한다", () => {
  assert.deepEqual(chunkRows([1, 2, 3, 4, 5], 2), [
    [1, 2],
    [3, 4],
    [5],
  ]);
});
