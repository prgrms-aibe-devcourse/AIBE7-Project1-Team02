require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const {
  processTourDestination,
} = require("../services/destination-processing");

const CONTENT_TYPE_IDS = [
  12, // 관광지
  14, // 문화시설
  28, // 레포츠
  39, // 음식점
];

const PAGE_SIZE = getPositiveInteger(process.env.TOUR_API_PAGE_SIZE, 50);
const MAX_PAGES = getPositiveInteger(process.env.TOUR_API_MAX_PAGES, 3);
const REQUEST_DELAY_MS = getPositiveInteger(
  process.env.TOUR_API_REQUEST_DELAY_MS,
  150,
);
const DB_BATCH_SIZE = 500;
const MAX_REQUEST_ATTEMPTS = 3;

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

async function fetchTourApiPage(contentTypeId, pageNo) {
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

    const isRetryable = response.status === 429 || response.status >= 500;
    if (!isRetryable || attempt === MAX_REQUEST_ATTEMPTS) {
      throw new Error(`TourAPI 요청 실패: ${response.status}`);
    }

    await sleep(REQUEST_DELAY_MS * attempt * 2);
  }

  return { items: [], totalCount: 0 };
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

function processPageItems(items, seenTourContentIds, stats) {
  const processedItems = [];

  items.forEach((item) => {
    const tourContentId = String(item?.contentid || item?.contentId || "");

    if (!tourContentId) {
      stats.invalid += 1;
      return;
    }

    if (seenTourContentIds.has(tourContentId)) {
      stats.duplicates += 1;
      return;
    }

    if (!item.addr1 || !item.mapx || !item.mapy) {
      stats.invalid += 1;
      return;
    }

    try {
      processedItems.push(processTourDestination(item));
      seenTourContentIds.add(tourContentId);
    } catch (error) {
      stats.invalid += 1;
      console.error(
        `가공 제외: contentId=${tourContentId}, ${error.message}`,
      );
    }
  });

  return processedItems;
}

async function importContentType(contentTypeId, seenTourContentIds, stats) {
  const firstPage = await fetchTourApiPage(contentTypeId, 1);
  const totalPages = Math.max(1, getTotalPages(firstPage.totalCount));
  const selectedPages = selectDistributedPages(totalPages);

  console.log(
    [
      `분산 조회 계획: contentTypeId=${contentTypeId}`,
      `전체=${totalPages}페이지`,
      `선택=${selectedPages.join(",")}`,
    ].join(", "),
  );

  for (let index = 0; index < selectedPages.length; index += 1) {
    const pageNo = selectedPages[index];
    const { items } =
      pageNo === 1
        ? firstPage
        : await fetchTourApiPage(contentTypeId, pageNo);

    if (items.length === 0) continue;

    const processedItems = processPageItems(
      items,
      seenTourContentIds,
      stats,
    );
    await saveProcessedItems(processedItems);

    stats.fetched += items.length;
    stats.saved += processedItems.length;

    console.log(
      [
        `저장 완료: contentTypeId=${contentTypeId}`,
        `page=${pageNo}/${totalPages}`,
        `조회=${items.length}`,
        `저장=${processedItems.length}`,
        `누적=${stats.saved}`,
      ].join(", "),
    );

    if (index < selectedPages.length - 1 && REQUEST_DELAY_MS > 0) {
      await sleep(REQUEST_DELAY_MS);
    }
  }
}

async function importTourData() {
  if (!process.env.SUPABASE_URL) {
    throw new Error("SUPABASE_URL이 .env에 없습니다.");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY가 .env에 없습니다.");
  }

  const seenTourContentIds = new Set();
  const stats = {
    fetched: 0,
    saved: 0,
    invalid: 0,
    duplicates: 0,
  };

  for (const contentTypeId of CONTENT_TYPE_IDS) {
    try {
      console.log(`TourAPI 분산 조회 시작: contentTypeId=${contentTypeId}`);
      await importContentType(contentTypeId, seenTourContentIds, stats);
    } catch (error) {
      console.error(
        `TourAPI 유형 적재 실패: contentTypeId=${contentTypeId}`,
        error.message,
      );
    }
  }

  console.log(
    [
      "TourAPI 여행지 적재 완료",
      `조회=${stats.fetched}`,
      `저장=${stats.saved}`,
      `제외=${stats.invalid}`,
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
  getTotalPages,
  getTourApiItems,
  processPageItems,
  selectDistributedPages,
};
