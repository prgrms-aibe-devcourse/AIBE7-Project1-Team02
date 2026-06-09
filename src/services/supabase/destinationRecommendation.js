const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 10;

function createSupabaseHeaders(anonKey, accessToken) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
  };
}

async function requestSupabaseJson(fetchImpl, url, headers) {
  const response = await fetchImpl(url, { headers });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      body?.message || body?.error_description || "Supabase 조회에 실패했습니다.";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return body;
}

function normalizeLimit(limit) {
  const parsedLimit = Number.parseInt(limit, 10);

  if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsedLimit, MAX_LIMIT);
}

function groupKeywords(keywordRows) {
  return keywordRows.reduce((keywordMap, row) => {
    const destinationId = String(row.destination_id);
    const keywords = keywordMap.get(destinationId) || [];
    keywords.push(row.keyword);
    keywordMap.set(destinationId, keywords);
    return keywordMap;
  }, new Map());
}

async function getRecommendedDestinations({
  supabaseUrl,
  anonKey,
  accessToken,
  limit = DEFAULT_LIMIT,
  fetchImpl = fetch,
}) {
  if (!supabaseUrl || !anonKey) {
    const error = new Error("Supabase 환경 변수가 설정되지 않았습니다.");
    error.status = 500;
    throw error;
  }

  const headers = createSupabaseHeaders(anonKey, accessToken);
  const preferenceUrl = new URL(
    "/rest/v1/travel_mbti_results",
    supabaseUrl,
  );
  preferenceUrl.searchParams.set("select", "mbti_type");
  preferenceUrl.searchParams.set("limit", "1");

  const preferenceRows = await requestSupabaseJson(
    fetchImpl,
    preferenceUrl,
    headers,
  );
  const mbtiType = preferenceRows[0]?.mbti_type;

  if (!mbtiType) {
    return {
      mbtiType: null,
      recommendations: [],
    };
  }

  const recommendationLimit = normalizeLimit(limit);
  const scoreUrl = new URL(
    "/rest/v1/destination_mbti_scores",
    supabaseUrl,
  );
  scoreUrl.searchParams.set(
    "select",
    [
      "destination_id",
      "score",
      "reason",
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
        ].join(","),
        ")",
      ].join(""),
    ].join(","),
  );
  scoreUrl.searchParams.set("mbti_type", `eq.${mbtiType}`);
  scoreUrl.searchParams.set("order", "score.desc,destination_id.asc");
  scoreUrl.searchParams.set("limit", String(recommendationLimit));

  const scoreRows = await requestSupabaseJson(fetchImpl, scoreUrl, headers);
  const destinationIds = scoreRows
    .map((row) => row.destination_id)
    .filter((destinationId) => destinationId !== null);

  let keywordMap = new Map();

  if (destinationIds.length > 0) {
    const keywordUrl = new URL(
      "/rest/v1/destination_keywords",
      supabaseUrl,
    );
    keywordUrl.searchParams.set("select", "destination_id,keyword");
    keywordUrl.searchParams.set(
      "destination_id",
      `in.(${destinationIds.join(",")})`,
    );
    keywordUrl.searchParams.set("order", "destination_id.asc,keyword.asc");

    const keywordRows = await requestSupabaseJson(
      fetchImpl,
      keywordUrl,
      headers,
    );
    keywordMap = groupKeywords(keywordRows);
  }

  const recommendations = scoreRows
    .filter((row) => row.destinations)
    .map((row) => ({
      destinationId: row.destination_id,
      destinationName: row.destinations.destination_name,
      description: row.destinations.description || "",
      address: row.destinations.address || "",
      province: row.destinations.province || "",
      city: row.destinations.city || "",
      imageUrl: row.destinations.image_url || "",
      score: Number(row.score),
      reason: row.reason || "",
      keywords: keywordMap.get(String(row.destination_id)) || [],
    }));

  return {
    mbtiType,
    recommendations,
  };
}

module.exports = {
  getRecommendedDestinations,
  normalizeLimit,
};
