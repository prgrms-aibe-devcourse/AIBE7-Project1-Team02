require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const { scoreDestinationMbti } = require("../services/destination-processing/mbtiScorer");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function updateKeywords(destinationId, classification) {
  const rows = classification.keywords.map((keyword) => ({
    destination_id: destinationId,
    keyword,
    source: "RULE",
    confidence: 1,
    rule_version: classification.ruleVersion,
  }));

  await supabase
    .from("destination_keywords")
    .delete()
    .eq("destination_id", destinationId);

  if (rows.length > 0) {
    const { error } = await supabase
      .from("destination_keywords")
      .insert(rows);

    if (error) {
      throw error;
    }
  }
}

async function updateMbtiScores(destinationId, classification) {
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
    throw error;
  }
}

async function recalculateMbti() {
  const { data: destinations, error } = await supabase
    .from("destinations")
    .select("*");

  if (error) {
    throw error;
  }

  console.log(`${destinations.length}개 관광지 재분류 시작`);

  let count = 0;

  for (const destination of destinations) {
    try {
      const classification = scoreDestinationMbti({
        destinationName: destination.destination_name,
        description: destination.description,
        address: destination.address,
        contentTypeId: destination.content_type_id,
        categoryCodes: {
          cat1: destination.category_code1,
          cat2: destination.category_code2,
          cat3: destination.category_code3,
        },
      });

      await updateKeywords(
        destination.destination_id,
        classification,
      );

      await updateMbtiScores(
        destination.destination_id,
        classification,
      );

      count++;

      console.log(
        `[${count}/${destinations.length}] ${destination.destination_name}`,
      );
    } catch (err) {
      console.error(
        `${destination.destination_name} 실패`,
        err.message,
      );
    }
  }

  console.log("MBTI 재계산 완료");
}

recalculateMbti().catch((err) => {
  console.error(err);
  process.exit(1);
});