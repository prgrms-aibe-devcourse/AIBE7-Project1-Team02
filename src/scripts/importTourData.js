require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const {
  processTourDestinations,
} = require("../services/destination-processing");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const CONTENT_TYPE_IDS = [
  12, // 관광지
  14, // 문화시설
  15, // 축제공연행사
  25, // 여행코스
  28, // 레포츠
  39, // 음식점
];

// 타입별로 가져올 개수
const NUM_OF_ROWS = 100;

async function fetchTourApiItemsByContentType(contentTypeId, pageNo = 1) {
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
  url.searchParams.set("numOfRows", String(NUM_OF_ROWS));
  url.searchParams.set("pageNo", String(pageNo));
  url.searchParams.set("contentTypeId", String(contentTypeId));

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`TourAPI 요청 실패: ${res.status}`);
  }

  const json = await res.json();
  const items = json?.response?.body?.items?.item;

  if (!items) return [];

  return Array.isArray(items) ? items : [items];
}

async function fetchTourApiItems() {
  const allItems = [];

  for (const contentTypeId of CONTENT_TYPE_IDS) {
    try {
      console.log(`TourAPI 조회 시작: contentTypeId=${contentTypeId}`);

      const items = await fetchTourApiItemsByContentType(contentTypeId);

      console.log(
        `TourAPI 조회 완료: contentTypeId=${contentTypeId}, ${items.length}개`,
      );

      allItems.push(...items);
    } catch (err) {
      console.error(
        `TourAPI 조회 실패: contentTypeId=${contentTypeId}`,
        err.message,
      );
    }
  }

  return allItems;
}

function parseRegion(address) {
  const parts = String(address || "").split(" ").filter(Boolean);

  return {
    province: parts[0] || "미분류",
    city: parts[1] || null,
  };
}

async function upsertDestination(destination) {
  const { province, city } = parseRegion(destination.address);

  const { data, error } = await supabase
    .from("destinations")
    .upsert(
      {
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
      },
      {
        onConflict: "tour_content_id",
      },
    )
    .select("destination_id")
    .single();

  if (error) {
    throw new Error(`destinations 저장 실패: ${error.message}`);
  }

  return data.destination_id;
}

async function upsertKeywords(destinationId, classification) {
  const rows = classification.keywords.map((keyword) => ({
    destination_id: destinationId,
    keyword,
    source: "RULE",
    confidence: 1,
    rule_version: classification.ruleVersion,
  }));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from("destination_keywords")
    .upsert(rows, {
      onConflict: "destination_id,keyword",
    });

  if (error) {
    throw new Error(`destination_keywords 저장 실패: ${error.message}`);
  }
}

async function upsertMbtiScores(destinationId, classification) {
  const rows = classification.mbtiScores.map((item) => ({
    destination_id: destinationId,
    mbti_type: item.mbtiType,
    score: item.score,
    reason: classification.matchedRules.join(", "),
    source: "RULE",
    rule_version: classification.ruleVersion,
  }));

  const { error } = await supabase
    .from("destination_mbti_scores")
    .upsert(rows, {
      onConflict: "destination_id,mbti_type",
    });

  if (error) {
    throw new Error(`destination_mbti_scores 저장 실패: ${error.message}`);
  }
}

async function importTourData() {
  if (!process.env.SUPABASE_URL) {
    throw new Error("SUPABASE_URL이 .env에 없습니다.");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY가 .env에 없습니다.");
  }

  const tourApiItems = await fetchTourApiItems();

  console.log(`총 ${tourApiItems.length}개 TourAPI 데이터 수집 완료`);

  const processedItems = processTourDestinations(tourApiItems);

  console.log(`총 ${processedItems.length}개 여행지 처리 시작`);

  for (const item of processedItems) {
    try {
      const { destination, classification } = item;

      const destinationId = await upsertDestination(destination);
      await upsertKeywords(destinationId, classification);
      await upsertMbtiScores(destinationId, classification);

      console.log(
        `저장 완료: ${destination.destinationName} / 추천 1순위: ${classification.mbtiScores[0].mbtiType}`,
      );
    } catch (err) {
      console.error("저장 실패:", err.message);
    }
  }

  console.log("TourAPI 여행지 적재 완료");
}

importTourData().catch((err) => {
  console.error("실행 실패:", err.message);
  process.exit(1);
});