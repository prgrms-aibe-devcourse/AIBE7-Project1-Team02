require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const {
  processTourDestination,
} = require("../services/destination-processing");

const CONTENT_TYPE_TARGETS = [
  { contentTypeId: 12, name: "관광지", targetCount: 40 },
  { contentTypeId: 14, name: "문화시설", targetCount: 25 },
  { contentTypeId: 39, name: "음식점", targetCount: 25 },
  { contentTypeId: 28, name: "레포츠", targetCount: 10 },
];

const TOUR_REGIONS = {
  강원특별자치도: "32",
  경기도: "31",
  경상남도: "36",
  경상북도: "35",
  광주광역시: "5",
  대구광역시: "4",
  대전광역시: "3",
  부산광역시: "6",
  서울특별시: "1",
  세종특별자치시: "8",
  울산광역시: "7",
  인천광역시: "2",
  전라남도: "38",
  전북특별자치도: "37",
  제주특별자치도: "39",
  충청남도: "34",
  충청북도: "33",
};

const PAGE_SIZE = getPositiveInteger(process.env.TOUR_API_PAGE_SIZE, 50);
const MAX_PAGES = getPositiveInteger(process.env.TOUR_API_MAX_PAGES, 3);
const REQUEST_DELAY_MS = getPositiveInteger(
  process.env.TOUR_API_REQUEST_DELAY_MS,
  150,
);
const DB_BATCH_SIZE = 500;
const MAX_REQUEST_ATTEMPTS = 3;
const TOUR_API_QUOTA_STATUS = 429;

let supabaseClient = null;

function getPositiveInteger(value, fallback) {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue >= 0
    ? parsedValue
    : fallback;
}

function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
  }

  return supabaseClient;
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function createTourApiError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isTourApiQuotaError(error) {
  return error?.statusCode === TOUR_API_QUOTA_STATUS;
}

function chunkRows(rows, chunkSize = DB_BATCH_SIZE) {
  const chunks = [];

  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }

  return chunks;
}

function getTourApiItems(body) {
  const items = body?.items?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

function getSelectedRegions(regionValue = process.env.TOUR_API_REGIONS) {
  if (!regionValue?.trim()) {
    return Object.entries(TOUR_REGIONS).map(([name, areaCode]) => ({
      name,
      areaCode,
    }));
  }

  const regionNames = [
    ...new Set(
      regionValue
        .split(",")
        .map((regionName) => regionName.trim())
        .filter(Boolean),
    ),
  ];
  const unknownRegions = regionNames.filter(
    (regionName) => !TOUR_REGIONS[regionName],
  );

  if (unknownRegions.length > 0) {
    throw new Error(`지원하지 않는 지역: ${unknownRegions.join(", ")}`);
  }

  return regionNames.map((name) => ({
    name,
    areaCode: TOUR_REGIONS[name],
  }));
}

function getTotalPages(totalCount, pageSize = PAGE_SIZE) {
  if (!Number.isFinite(totalCount) || totalCount <= 0) return 0;
  return Math.ceil(totalCount / pageSize);
}

function selectDistributedPages(totalPages, pageLimit = MAX_PAGES) {
  if (!Number.isInteger(totalPages) || totalPages <= 0) return [];

  if (pageLimit === 0 || pageLimit >= totalPages) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (pageLimit === 1) {
    return [Math.ceil(totalPages / 2)];
  }

  const selectedPages = new Set();

  for (let index = 0; index < pageLimit; index += 1) {
    const pageNo = Math.round(
      1 + (index * (totalPages - 1)) / (pageLimit - 1),
    );
    selectedPages.add(pageNo);
  }

  return Array.from(selectedPages).sort((first, second) => first - second);
}

async function fetchTourApiPage(contentTypeId, areaCode, pageNo) {
  const serviceKey = process.env.TOUR_API_KEY;

  if (!serviceKey) {
    throw new Error("TOUR_API_KEY가 .env에 없습니다.");
  }

  const url = new URL(
    "https://apis.data.go.kr/B551011/KorService2/areaBasedList2",
  );

  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("MobileOS", "ETC");
  url.searchParams.set("MobileApp", "TravelMBTI");
  url.searchParams.set("_type", "json");
  url.searchParams.set("numOfRows", String(PAGE_SIZE));
  url.searchParams.set("pageNo", String(pageNo));
  url.searchParams.set("contentTypeId", String(contentTypeId));
  url.searchParams.set("areaCode", String(areaCode));
  url.searchParams.set("arrange", "A");

  for (let attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt += 1) {
    const response = await fetch(url);

    if (response.ok) {
      const json = await response.json();
      const header = json?.response?.header;
      const body = json?.response?.body;

      if (header?.resultCode && header.resultCode !== "0000") {
        throw new Error(
          `TourAPI 오류 ${header.resultCode}: ${header.resultMsg || "알 수 없는 오류"}`,
        );
      }

      return {
        items: getTourApiItems(body),
        totalCount: Number(body?.totalCount || 0),
      };
    }

    if (response.status === TOUR_API_QUOTA_STATUS) {
      throw createTourApiError(
        "TourAPI 일일 호출 한도를 초과했습니다.",
        response.status,
      );
    }

    const isRetryable = response.status >= 500;
    if (!isRetryable || attempt === MAX_REQUEST_ATTEMPTS) {
      throw createTourApiError(
        `TourAPI 요청 실패: ${response.status}`,
        response.status,
      );
    }

    await sleep(REQUEST_DELAY_MS * attempt * 2);
  }

  return { items: [], totalCount: 0 };
}

async function fetchTourApiDescription(contentId) {
  const serviceKey = process.env.TOUR_API_KEY;
  const url = new URL(
    "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
  );

  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("MobileOS", "ETC");
  url.searchParams.set("MobileApp", "TravelMBTI");
  url.searchParams.set("_type", "json");
  url.searchParams.set("contentId", String(contentId));
  url.searchParams.set("overviewYN", "Y");

  for (let attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt += 1) {
    const response = await fetch(url);

    if (response.ok) {
      const json = await response.json();
      const header = json?.response?.header;
      const body = json?.response?.body;

      if (header?.resultCode && header.resultCode !== "0000") {
        throw new Error(
          `TourAPI 오류 ${header.resultCode}: ${header.resultMsg || "알 수 없는 오류"}`,
        );
      }

      return getTourApiItems(body)[0]?.overview || "";
    }

    if (response.status === TOUR_API_QUOTA_STATUS) {
      throw createTourApiError(
        "TourAPI 일일 호출 한도를 초과했습니다.",
        response.status,
      );
    }

    const isRetryable = response.status >= 500;
    if (!isRetryable || attempt === MAX_REQUEST_ATTEMPTS) {
      throw createTourApiError(
        `TourAPI 상세 요청 실패: ${response.status}`,
        response.status,
      );
    }

    await sleep(REQUEST_DELAY_MS * attempt * 2);
  }

  return "";
}

function parseRegion(address) {
  const parts = String(address || "").split(" ").filter(Boolean);

  return {
    province: parts[0] || "미분류",
    city: parts[1] || null,
  };
}

function createDestinationRow(destination) {
  const { province, city } = parseRegion(destination.address);

  return {
    tour_content_id: destination.tourContentId,
    content_type_id: destination.contentTypeId,
    destination_name: destination.destinationName,
    description: destination.description,
    address: destination.address,
    province,
    city,
    category_code1: destination.categoryCodes.cat1,
    category_code2: destination.categoryCodes.cat2,
    category_code3: destination.categoryCodes.cat3,
    latitude: destination.coordinates.latitude,
    longitude: destination.coordinates.longitude,
    image_url: destination.imageUrl,
  };
}

async function upsertDestinations(processedItems) {
  const rows = processedItems.map(({ destination }) =>
    createDestinationRow(destination),
  );
  const destinationIdByTourContentId = new Map();

  for (const batch of chunkRows(rows)) {
    const { data, error } = await getSupabase()
      .from("destinations")
      .upsert(batch, { onConflict: "tour_content_id" })
      .select("destination_id,tour_content_id");

    if (error) {
      throw new Error(`destinations 일괄 저장 실패: ${error.message}`);
    }

    (data || []).forEach((row) => {
      destinationIdByTourContentId.set(
        String(row.tour_content_id),
        row.destination_id,
      );
    });
  }

  return destinationIdByTourContentId;
}

async function upsertRows(tableName, rows, onConflict) {
  for (const batch of chunkRows(rows)) {
    const { error } = await getSupabase()
      .from(tableName)
      .upsert(batch, { onConflict });

    if (error) {
      throw new Error(`${tableName} 일괄 저장 실패: ${error.message}`);
    }
  }
}

async function saveProcessedItems(processedItems) {
  if (processedItems.length === 0) return;

  const destinationIdByTourContentId =
    await upsertDestinations(processedItems);
  const keywordRows = [];
  const mbtiScoreRows = [];

  processedItems.forEach(({ destination, classification }) => {
    const destinationId = destinationIdByTourContentId.get(
      destination.tourContentId,
    );

    if (!destinationId) {
      throw new Error(
        `저장된 destination_id를 찾을 수 없습니다: ${destination.tourContentId}`,
      );
    }

    classification.keywords.forEach((keyword) => {
      keywordRows.push({
        destination_id: destinationId,
        keyword,
        source: "RULE",
        confidence: 1,
        rule_version: classification.ruleVersion,
      });
    });

    classification.mbtiScores.forEach((item) => {
      mbtiScoreRows.push({
        destination_id: destinationId,
        mbti_type: item.mbtiType,
        score: item.score,
        reason: classification.matchedRules.join(", "),
        source: "RULE",
        rule_version: classification.ruleVersion,
      });
    });
  });

  await upsertRows(
    "destination_keywords",
    keywordRows,
    "destination_id,keyword",
  );
  await upsertRows(
    "destination_mbti_scores",
    mbtiScoreRows,
    "destination_id,mbti_type",
  );
}

function hasRequiredListFields(item) {
  const imageUrl = item?.firstimage || item?.firstimage2;

  return Boolean(
    item?.addr1 &&
      imageUrl &&
      item?.mapx &&
      item?.mapy,
  );
}

async function processPageItems(
  items,
  seenTourContentIds,
  stats,
  getDescription = fetchTourApiDescription,
  maxItems = Number.POSITIVE_INFINITY,
) {
  const processedItems = [];

  for (const item of items) {
    if (processedItems.length >= maxItems) {
      break;
    }

    const tourContentId = String(item?.contentid || item?.contentId || "");

    if (!tourContentId) {
      stats.invalid += 1;
      continue;
    }

    if (seenTourContentIds.has(tourContentId)) {
      stats.duplicates += 1;
      continue;
    }

    if (!hasRequiredListFields(item)) {
      stats.invalid += 1;
      continue;
    }

    try {
      const description = await getDescription(tourContentId);

      if (!String(description || "").trim()) {
        stats.noDescription += 1;
        continue;
      }

      processedItems.push(
        processTourDestination({
          ...item,
          overview: description,
        }),
      );
      seenTourContentIds.add(tourContentId);

      if (REQUEST_DELAY_MS > 0) {
        await sleep(REQUEST_DELAY_MS);
      }
    } catch (error) {
      if (isTourApiQuotaError(error)) {
        throw error;
      }

      stats.invalid += 1;
      console.error(
        `가공 제외: contentId=${tourContentId}, ${error.message}`,
      );
    }
  }

  return processedItems;
}

async function importContentType(
  contentType,
  region,
  seenTourContentIds,
  stats,
) {
  const { contentTypeId, name, targetCount } = contentType;
  const firstPage = await fetchTourApiPage(
    contentTypeId,
    region.areaCode,
    1,
  );
  const totalPages = Math.max(1, getTotalPages(firstPage.totalCount));
  const selectedPages = selectDistributedPages(totalPages);

  console.log(
    [
      `분산 조회 계획: region=${region.name}`,
      `type=${name}(${contentTypeId})`,
      `목표=${targetCount}`,
      `전체=${totalPages}페이지`,
      `선택=${selectedPages.join(",")}`,
    ].join(", "),
  );

  let savedForType = 0;

  for (let index = 0; index < selectedPages.length; index += 1) {
    if (savedForType >= targetCount) {
      break;
    }

    const pageNo = selectedPages[index];
    const { items } =
      pageNo === 1
        ? firstPage
        : await fetchTourApiPage(contentTypeId, region.areaCode, pageNo);

    if (items.length === 0) continue;

    const processedItems = await processPageItems(
      items,
      seenTourContentIds,
      stats,
      fetchTourApiDescription,
      targetCount - savedForType,
    );
    await saveProcessedItems(processedItems);

    stats.fetched += items.length;
    stats.saved += processedItems.length;
    savedForType += processedItems.length;

    console.log(
      [
        `저장 완료: region=${region.name}`,
        `type=${name}(${contentTypeId})`,
        `page=${pageNo}/${totalPages}`,
        `조회=${items.length}`,
        `저장=${processedItems.length}`,
        `유형누적=${savedForType}/${targetCount}`,
        `누적=${stats.saved}`,
      ].join(", "),
    );

    if (index < selectedPages.length - 1 && REQUEST_DELAY_MS > 0) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  if (savedForType < targetCount) {
    console.warn(
      [
        `유형 목표 미달: region=${region.name}`,
        `type=${name}(${contentTypeId})`,
        `저장=${savedForType}/${targetCount}`,
      ].join(", "),
    );
  }

  return savedForType;
}

async function importTourData() {
  if (!process.env.SUPABASE_URL) {
    throw new Error("SUPABASE_URL이 .env에 없습니다.");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY가 .env에 없습니다.");
  }

  const seenTourContentIds = new Set();
  const selectedRegions = getSelectedRegions();
  const stats = {
    fetched: 0,
    saved: 0,
    invalid: 0,
    noDescription: 0,
    duplicates: 0,
  };

  for (const region of selectedRegions) {
    let savedForRegion = 0;

    for (const contentType of CONTENT_TYPE_TARGETS) {
      try {
        console.log(
          `TourAPI 분산 조회 시작: region=${region.name}, type=${contentType.name}`,
        );
        savedForRegion += await importContentType(
          contentType,
          region,
          seenTourContentIds,
          stats,
        );
      } catch (error) {
        if (isTourApiQuotaError(error)) {
          throw error;
        }

        console.error(
          `TourAPI 유형 적재 실패: region=${region.name}, type=${contentType.name}`,
          error.message,
        );
      }
    }

    console.log(
      `지역 적재 완료: region=${region.name}, 저장=${savedForRegion}/100`,
    );
  }

  console.log(
    [
      "TourAPI 여행지 적재 완료",
      `조회=${stats.fetched}`,
      `저장=${stats.saved}`,
      `제외=${stats.invalid}`,
      `설명없음=${stats.noDescription}`,
      `중복=${stats.duplicates}`,
    ].join(", "),
  );
}

if (require.main === module) {
  importTourData().catch((error) => {
    console.error("실행 실패:", error.message);
    process.exit(1);
  });
}

module.exports = {
  chunkRows,
  CONTENT_TYPE_TARGETS,
  getSelectedRegions,
  getTotalPages,
  getTourApiItems,
  hasRequiredListFields,
  isTourApiQuotaError,
  processPageItems,
  selectDistributedPages,
};
