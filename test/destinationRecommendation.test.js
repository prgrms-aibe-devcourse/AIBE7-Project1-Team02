const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getRecommendedDestinations,
  normalizeLimit,
  normalizeMbtiType,
  normalizeFilterValues,
  normalizePage,
  normalizePageSize,
} = require("../src/services/supabase/destinationRecommendation");

function createJsonResponse(body, status = 200, contentRange = "") {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) =>
        name.toLowerCase() === "content-range" ? contentRange : null,
    },
    json: async () => body,
  };
}

test("사용자 MBTI의 저장 점수 내림차순 결과를 추천 형식으로 변환한다", async () => {
  const requestedUrls = [];
  const responses = [
    createJsonResponse([{ mbti_type: "INFP" }]),
    createJsonResponse([
      {
        destination_id: 3,
        score: "86.25",
        reason: "contentType:12, textRule:1",
        destinations: {
          destination_id: 3,
          destination_name: "협재해수욕장",
          description: "푸른 바다를 볼 수 있는 해변",
          address: "제주특별자치도 제주시",
          province: "제주특별자치도",
          city: "제주시",
          image_url: "https://example.com/hyeopjae.jpg",
        },
      },
    ]),
    createJsonResponse([
      { destination_id: 3, keyword: "오션뷰" },
      { destination_id: 3, keyword: "힐링" },
    ]),
  ];
  const fetchImpl = async (url) => {
    requestedUrls.push(String(url));
    return responses.shift();
  };

  const result = await getRecommendedDestinations({
    supabaseUrl: "https://example.supabase.co",
    anonKey: "anon-key",
    accessToken: "access-token",
    fetchImpl,
  });

  assert.equal(result.mbtiType, "INFP");
  assert.equal(result.recommendations.length, 1);
  assert.deepEqual(result.recommendations[0].keywords, ["오션뷰", "힐링"]);
  assert.equal(result.recommendations[0].score, 86.25);
  assert.match(
    requestedUrls[1],
    /select=destination_id%2Cscore%2Creason%2Cdestinations%21inner%28destination_id%2Cdestination_name/,
  );
  assert.match(requestedUrls[1], /destinations\.image_url=not\.is\.null/);
  assert.match(requestedUrls[1], /mbti_type=eq\.INFP/);
  assert.match(requestedUrls[1], /order=score\.desc%2Cdestination_id\.asc/);
});

test("저장된 여행 MBTI가 없으면 빈 추천 결과를 반환한다", async () => {
  const result = await getRecommendedDestinations({
    supabaseUrl: "https://example.supabase.co",
    anonKey: "anon-key",
    accessToken: "access-token",
    fetchImpl: async () => createJsonResponse([]),
  });

  assert.deepEqual(result, {
    mbtiType: null,
    recommendations: [],
  });
});

test("추천 개수는 기본 6개, 최대 10개로 제한한다", () => {
  assert.equal(normalizeLimit(undefined), 6);
  assert.equal(normalizeLimit("0"), 6);
  assert.equal(normalizeLimit("8"), 8);
  assert.equal(normalizeLimit("100"), 10);
});

test("공개 조회용 MBTI 유형을 16개 유형으로 제한한다", () => {
  assert.equal(normalizeMbtiType("infp"), "INFP");
  assert.equal(normalizeMbtiType("abcd"), null);
});

test("MBTI 유형을 직접 전달하면 사용자 결과 조회 없이 추천한다", async () => {
  const requestedUrls = [];
  const responses = [
    createJsonResponse([
      {
        destination_id: 3,
        score: "86.25",
        reason: "",
        destinations: {
          destination_id: 3,
          destination_name: "협재해수욕장",
          description: "푸른 바다",
          address: "제주특별자치도 제주시",
          province: "제주특별자치도",
          city: "제주시",
          image_url: "",
        },
      },
    ]),
    createJsonResponse([{ destination_id: 3, keyword: "힐링" }]),
  ];
  const fetchImpl = async (url) => {
    requestedUrls.push(String(url));
    return responses.shift();
  };

  const result = await getRecommendedDestinations({
    supabaseUrl: "https://example.supabase.co",
    anonKey: "anon-key",
    mbtiType: "infp",
    limit: 10,
    fetchImpl,
  });

  assert.equal(result.mbtiType, "INFP");
  assert.equal(result.recommendations.length, 1);
  assert.match(requestedUrls[0], /destination_mbti_scores/);
  assert.doesNotMatch(requestedUrls[0], /travel_mbti_results/);
});

test("전체 추천 조회의 페이지와 페이지 크기를 안전한 범위로 제한한다", () => {
  assert.equal(normalizePage(undefined), 1);
  assert.equal(normalizePage("-2"), 1);
  assert.equal(normalizePage("3"), 3);
  assert.equal(normalizePageSize(undefined), 12);
  assert.equal(normalizePageSize("16"), 16);
  assert.equal(normalizePageSize("100"), 24);
});

test("복수 필터 값을 중복 없이 정규화한다", () => {
  assert.deepEqual(
    normalizeFilterValues(["서울특별시", "부산광역시,서울특별시"]),
    ["서울특별시", "부산광역시"],
  );
});

test("복수 지역과 키워드 조건을 적용하고 전체 개수를 포함해 페이지 조회한다", async () => {
  const requestedUrls = [];
  const responses = [
    createJsonResponse([{ mbti_type: "INFP" }]),
    createJsonResponse([{ destination_id: 3 }]),
    createJsonResponse(
      [
        {
          destination_id: 3,
          score: "86.25",
          reason: "",
          destinations: {
            destination_id: 3,
            destination_name: "협재해수욕장",
            description: "푸른 바다",
            address: "제주특별자치도 제주시",
            province: "제주특별자치도",
            city: "제주시",
            image_url: "",
          },
        },
      ],
      200,
      "12-12/37",
    ),
    createJsonResponse([{ destination_id: 3, keyword: "힐링" }]),
  ];
  const fetchImpl = async (url) => {
    requestedUrls.push(String(url));
    return responses.shift();
  };

  const result = await getRecommendedDestinations({
    supabaseUrl: "https://example.supabase.co",
    anonKey: "anon-key",
    accessToken: "access-token",
    page: "2",
    pageSize: "12",
    provinces: ["제주특별자치도", "서울특별시"],
    keywords: ["힐링", "자연"],
    fetchImpl,
  });

  assert.deepEqual(result.pagination, {
    page: 2,
    pageSize: 12,
    totalCount: 37,
    totalPages: 4,
  });
  assert.match(requestedUrls[1], /keyword=in\./);
  assert.match(requestedUrls[1], /%ED%9E%90%EB%A7%81/);
  assert.match(requestedUrls[1], /%EC%9E%90%EC%97%B0/);
  assert.match(requestedUrls[2], /destinations%21inner/);
  assert.match(requestedUrls[2], /destinations\.province=in\./);
  assert.match(requestedUrls[2], /%EC%A0%9C%EC%A3%BC/);
  assert.match(requestedUrls[2], /%EC%84%9C%EC%9A%B8/);
  assert.match(requestedUrls[2], /destination_id=in\.%283%29/);
  assert.match(requestedUrls[2], /limit=12/);
  assert.match(requestedUrls[2], /offset=12/);
});
