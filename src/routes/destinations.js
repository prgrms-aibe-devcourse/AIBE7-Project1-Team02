const express = require("express");

const {
  getRecommendedDestinations,
} = require("../services/supabase/destinationRecommendation");

const router = express.Router();

function getBearerToken(authorizationHeader) {
  const [scheme, token] = String(authorizationHeader || "").split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

router.get("/recommended", async (request, response) => {
  const accessToken = getBearerToken(request.get("authorization"));

  if (!accessToken) {
    return response.status(401).json({
      success: false,
      message: "로그인이 필요한 요청입니다.",
    });
  }

  try {
    const result = await getRecommendedDestinations({
      supabaseUrl: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
      accessToken,
      limit: request.query.limit,
    });

    if (!result.mbtiType) {
      return response.status(404).json({
        success: false,
        data: {
          needsSurvey: true,
        },
        message: "저장된 여행 MBTI 결과가 없습니다.",
      });
    }

    return response.json({
      success: true,
      data: result,
      message: "MBTI 맞춤 여행지 추천 조회 성공",
    });
  } catch (error) {
    const status = error.status === 401 ? 401 : 502;

    return response.status(status).json({
      success: false,
      message:
        status === 401
          ? "로그인 세션이 만료되었습니다."
          : "맞춤 여행지를 불러오지 못했습니다.",
    });
  }
});

module.exports = router;
