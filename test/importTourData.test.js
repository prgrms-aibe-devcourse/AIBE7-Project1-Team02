const assert = require("node:assert/strict");
const test = require("node:test");

const {
  chunkRows,
  getTotalPages,
  getTourApiItems,
  processPageItems,
  selectDistributedPages,
} = require("../src/scripts/importTourData");

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

test("페이지 데이터는 중복과 필수 위치 정보가 없는 항목을 제외한다", () => {
  const seenTourContentIds = new Set(["1"]);
  const stats = { invalid: 0, duplicates: 0 };
  const processedItems = processPageItems(
    [
      {
        contentid: "1",
        contenttypeid: "12",
        title: "기존 관광지",
        addr1: "서울특별시 종로구",
        mapx: "126.9",
        mapy: "37.5",
      },
      {
        contentid: "2",
        contenttypeid: "12",
        title: "경복궁",
        addr1: "서울특별시 종로구",
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
  );

  assert.equal(processedItems.length, 1);
  assert.equal(processedItems[0].destination.destinationName, "경복궁");
  assert.equal(stats.duplicates, 1);
  assert.equal(stats.invalid, 1);
});

test("DB 일괄 저장 크기에 맞춰 행을 분할한다", () => {
  assert.deepEqual(chunkRows([1, 2, 3, 4, 5], 2), [
    [1, 2],
    [3, 4],
    [5],
  ]);
});
