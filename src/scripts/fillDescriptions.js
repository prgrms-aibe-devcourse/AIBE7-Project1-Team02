require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function getOverview(contentId) {
  const url = new URL(
    "https://apis.data.go.kr/B551011/KorService2/detailCommon2",
  );

  url.searchParams.set("serviceKey", process.env.TOUR_API_KEY);
  url.searchParams.set("MobileOS", "ETC");
  url.searchParams.set("MobileApp", "TravelMBTI");
  url.searchParams.set("_type", "json");
  url.searchParams.set("contentId", contentId);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`TourAPI 오류: ${response.status}`);
  }

  const json = await response.json();

  const item = json?.response?.body?.items?.item?.[0];

  if (!item) {
    return null;
  }

  return item.overview || null;
}

async function fillDescriptions() {
  const { data: destinations, error } = await supabase
    .from("destinations")
    .select("destination_id, tour_content_id, destination_name")
    .or("description.is.null,description.eq.");

  if (error) {
    throw error;
  }

  console.log(`${destinations.length}개 관광지 설명 채우기 시작`);

  let successCount = 0;

  for (const destination of destinations) {
    try {
      const overview = await getOverview(
        destination.tour_content_id,
      );

      if (!overview) {
        console.log(
          `설명 없음: ${destination.destination_name}`,
        );
        continue;
      }

      const { error: updateError } = await supabase
        .from("destinations")
        .update({
          description: overview,
        })
        .eq(
          "destination_id",
          destination.destination_id,
        );

      if (updateError) {
        throw updateError;
      }

      successCount++;

      console.log(
        `업데이트 완료 (${successCount}) : ${destination.destination_name}`,
      );

      // TourAPI 과호출 방지
      await new Promise((resolve) =>
        setTimeout(resolve, 300),
      );
    } catch (err) {
      console.error(
        `실패: ${destination.destination_name}`,
        err.message,
      );
    }
  }

  console.log(
    `설명 채우기 완료 (${successCount}개 성공)`,
  );
}

fillDescriptions().catch((err) => {
  console.error(err);
  process.exit(1);
});