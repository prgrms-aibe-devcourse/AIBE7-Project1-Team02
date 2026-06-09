const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 10;
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 24;
const MBTI_TYPES = new Set([
  "ISTJ",
  "ISFJ",
  "INFJ",
  "INTJ",
  "ISTP",
  "ISFP",
  "INFP",
  "INTP",
  "ESTP",
  "ESFP",
  "ENFP",
  "ENTP",
  "ESTJ",
  "ESFJ",
  "ENFJ",
  "ENTJ",
]);

function createSupabaseHeaders(anonKey, accessToken, prefer) {
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken || anonKey}`,
  };

  if (prefer) {
    headers.Prefer = prefer;
  }

  return headers;
}

function normalizeMbtiType(mbtiType) {
  const normalizedMbtiType = String(mbtiType || "").trim().toUpperCase();
  return MBTI_TYPES.has(normalizedMbtiType) ? normalizedMbtiType : null;
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

async function requestSupabasePage(fetchImpl, url, headers) {
  const response = await fetchImpl(url, { headers });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      body?.message || body?.error_description || "Supabase 조회에 실패했습니다.";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const contentRange = response.headers?.get?.("content-range") || "";
  const totalText = contentRange.split("/")[1];
  const totalCount =
    totalText && totalText !== "*" ? Number.parseInt(totalText, 10) : body.length;

  return {
    rows: body,
    totalCount: Number.isFinite(totalCount) ? totalCount : body.length,
  };
}

function normalizeLimit(limit) {
  const parsedLimit = Number.parseInt(limit, 10);

  if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsedLimit, MAX_LIMIT);
}

function normalizePage(page) {
  const parsedPage = Number.parseInt(page, 10);
  return Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
}

function normalizePageSize(pageSize) {
  const parsedPageSize = Number.parseInt(pageSize, 10);

  if (!Number.isFinite(parsedPageSize) || parsedPageSize < 1) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(parsedPageSize, MAX_PAGE_SIZE);
}

function normalizeFilterValues(values) {
  const valueList = Array.isArray(values) ? values : [values];

  return [
    ...new Set(
      valueList
        .flatMap((value) => String(value || "").split(","))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}

function createInFilter(values) {
  return `in.(${values.map((value) => JSON.stringify(value)).join(",")})`;
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

function getUserId(accessToken) {
  const payloadText = accessToken?.split(".")?.[1];

  if (!payloadText) {
    return null;
  }

  try {
    return JSON.parse(
      Buffer.from(payloadText, "base64url").toString("utf8"),
    ).sub;
  } catch {
    return null;
  }
}

function validateSupabaseConfig(supabaseUrl, anonKey) {
  if (!supabaseUrl || !anonKey) {
    const error = new Error("Supabase 환경 변수가 설정되지 않았습니다.");
    error.status = 500;
    throw error;
  }
}

async function getUserMbti({
  supabaseUrl,
  headers,
  accessToken,
  fetchImpl,
}) {
  const preferenceUrl = new URL(
    "/rest/v1/travel_mbti_results",
    supabaseUrl,
  );
  preferenceUrl.searchParams.set("select", "mbti_type");
  preferenceUrl.searchParams.set("limit", "1");

  const userId = getUserId(accessToken);
  if (userId) {
    preferenceUrl.searchParams.set("user_id", `eq.${userId}`);
  }

  const preferenceRows = await requestSupabaseJson(
    fetchImpl,
    preferenceUrl,
    headers,
  );
  return preferenceRows[0]?.mbti_type || null;
}

async function getDestinationIdsByKeywords({
  supabaseUrl,
  headers,
  keywords,
  fetchImpl,
}) {
  if (keywords.length === 0) {
    return null;
  }

  const keywordUrl = new URL("/rest/v1/destination_keywords", supabaseUrl);
  keywordUrl.searchParams.set("select", "destination_id");
  keywordUrl.searchParams.set("keyword", createInFilter(keywords));

  const keywordRows = await requestSupabaseJson(fetchImpl, keywordUrl, headers);
  return [
    ...new Set(
      keywordRows
        .map((row) => row.destination_id)
        .filter((destinationId) => destinationId !== null),
    ),
  ];
}

function createScoreUrl({
  supabaseUrl,
  mbtiType,
  provinces,
  destinationIds,
}) {
  const scoreUrl = new URL(
    "/rest/v1/destination_mbti_scores",
    supabaseUrl,
  );
  const destinationRelation =
    provinces.length > 0 ? "destinations!inner" : "destinations";

  scoreUrl.searchParams.set(
    "select",
    [
      "destination_id",
      "score",
      "reason",
      [
        `${destinationRelation}(`,
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

  if (provinces.length > 0) {
    scoreUrl.searchParams.set(
      "destinations.province",
      createInFilter(provinces),
    );
  }
  if (destinationIds) {
    scoreUrl.searchParams.set(
      "destination_id",
      `in.(${destinationIds.join(",")})`,
    );
  }

  return scoreUrl;
}

async function getKeywordsByDestinationIds({
  supabaseUrl,
  headers,
  destinationIds,
  fetchImpl,
}) {
  if (destinationIds.length === 0) {
    return new Map();
  }

  const keywordUrl = new URL("/rest/v1/destination_keywords", supabaseUrl);
  keywordUrl.searchParams.set("select", "destination_id,keyword");
  keywordUrl.searchParams.set(
    "destination_id",
    `in.(${destinationIds.join(",")})`,
  );
  keywordUrl.searchParams.set("order", "destination_id.asc,keyword.asc");

  const keywordRows = await requestSupabaseJson(fetchImpl, keywordUrl, headers);
  return groupKeywords(keywordRows);
}

function mapRecommendations(scoreRows, keywordMap) {
  return scoreRows
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
}

async function getRecommendedDestinations({
  supabaseUrl,
  anonKey,
  accessToken,
  mbtiType: requestedMbtiType,
  limit,
  page,
  pageSize,
  provinces = [],
  keywords = [],
  fetchImpl = fetch,
}) {
  validateSupabaseConfig(supabaseUrl, anonKey);
  const headers = createSupabaseHeaders(anonKey, accessToken);
  const normalizedRequestedMbtiType = normalizeMbtiType(requestedMbtiType);
  const normalizedProvinces = normalizeFilterValues(provinces);
  const normalizedKeywords = normalizeFilterValues(keywords);

  if (requestedMbtiType && !normalizedRequestedMbtiType) {
    const error = new Error("지원하지 않는 MBTI 유형입니다.");
    error.status = 400;
    throw error;
  }

  const mbtiType =
    normalizedRequestedMbtiType ||
    (await getUserMbti({
      supabaseUrl,
      headers,
      accessToken,
      fetchImpl,
    }));

  if (!mbtiType) {
    return {
      mbtiType: null,
      recommendations: [],
    };
  }

  const destinationIds = await getDestinationIdsByKeywords({
    supabaseUrl,
    headers,
    keywords: normalizedKeywords,
    fetchImpl,
  });
  const isPaginated = page !== undefined || pageSize !== undefined;
  const currentPage = normalizePage(page);
  const normalizedPageSize = isPaginated
    ? normalizePageSize(pageSize)
    : normalizeLimit(limit);

  if (destinationIds?.length === 0) {
    return {
      mbtiType,
      recommendations: [],
      pagination: {
        page: currentPage,
        pageSize: normalizedPageSize,
        totalCount: 0,
        totalPages: 0,
      },
    };
  }

  const scoreUrl = createScoreUrl({
    supabaseUrl,
    mbtiType,
    provinces: normalizedProvinces,
    destinationIds,
  });
  scoreUrl.searchParams.set("limit", String(normalizedPageSize));

  if (isPaginated) {
    scoreUrl.searchParams.set(
      "offset",
      String((currentPage - 1) * normalizedPageSize),
    );
  }

  const pageResult = await requestSupabasePage(
    fetchImpl,
    scoreUrl,
    createSupabaseHeaders(anonKey, accessToken, "count=exact"),
  );
  const pageDestinationIds = pageResult.rows
    .map((row) => row.destination_id)
    .filter((destinationId) => destinationId !== null);
  const keywordMap = await getKeywordsByDestinationIds({
    supabaseUrl,
    headers,
    destinationIds: pageDestinationIds,
    fetchImpl,
  });

  const result = {
    mbtiType,
    recommendations: mapRecommendations(pageResult.rows, keywordMap),
  };

  if (isPaginated) {
    result.pagination = {
      page: currentPage,
      pageSize: normalizedPageSize,
      totalCount: pageResult.totalCount,
      totalPages: Math.ceil(pageResult.totalCount / normalizedPageSize),
    };
  }

  return result;
}

async function getRecommendedDestinationFilters({
  supabaseUrl,
  anonKey,
  accessToken,
  mbtiType: requestedMbtiType,
  fetchImpl = fetch,
}) {
  validateSupabaseConfig(supabaseUrl, anonKey);
  const headers = createSupabaseHeaders(anonKey, accessToken);
  const normalizedRequestedMbtiType = normalizeMbtiType(requestedMbtiType);

  if (requestedMbtiType && !normalizedRequestedMbtiType) {
    const error = new Error("지원하지 않는 MBTI 유형입니다.");
    error.status = 400;
    throw error;
  }

  const mbtiType =
    normalizedRequestedMbtiType ||
    (await getUserMbti({
      supabaseUrl,
      headers,
      accessToken,
      fetchImpl,
    }));

  if (!mbtiType) {
    return {
      mbtiType: null,
      provinces: [],
      keywords: [],
    };
  }

  const scoreUrl = new URL(
    "/rest/v1/destination_mbti_scores",
    supabaseUrl,
  );
  scoreUrl.searchParams.set(
    "select",
    "destination_id,destinations!inner(province)",
  );
  scoreUrl.searchParams.set("mbti_type", `eq.${mbtiType}`);
  scoreUrl.searchParams.set("limit", "1000");

  const scoreRows = await requestSupabaseJson(fetchImpl, scoreUrl, headers);
  const destinationIds = scoreRows
    .map((row) => row.destination_id)
    .filter((destinationId) => destinationId !== null);
  const keywordMap = await getKeywordsByDestinationIds({
    supabaseUrl,
    headers,
    destinationIds,
    fetchImpl,
  });

  const provinces = [
    ...new Set(
      scoreRows.map((row) => row.destinations?.province).filter(Boolean),
    ),
  ].sort((firstProvince, secondProvince) =>
    firstProvince.localeCompare(secondProvince, "ko"),
  );
  const keywords = [
    ...new Set([...keywordMap.values()].flat().filter(Boolean)),
  ].sort((firstKeyword, secondKeyword) =>
    firstKeyword.localeCompare(secondKeyword, "ko"),
  );

  return {
    mbtiType,
    provinces,
    keywords,
  };
}

module.exports = {
  getRecommendedDestinationFilters,
  getRecommendedDestinations,
  normalizeLimit,
  normalizeMbtiType,
  normalizePage,
  normalizePageSize,
  normalizeFilterValues,
};
