const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getRecommendedDestinations,
  normalizeLimit,
} = require("../src/services/supabase/destinationRecommendation");

function createJsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
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
    /select=destination_id%2Cscore%2Creason%2Cdestinations%28destination_id%2Cdestination_name/,
  );
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
