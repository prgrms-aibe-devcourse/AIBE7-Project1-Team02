const express = require("express");

const {
  getRecommendedDestinationFilters,
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
  const requestedMbtiType = request.query.mbtiType;

  if (!accessToken && !requestedMbtiType) {
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
      mbtiType: requestedMbtiType,
      limit: request.query.limit,
      page: request.query.page,
      pageSize: request.query.pageSize,
      province: request.query.province,
      keyword: request.query.keyword,
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
    const status = [400, 401].includes(error.status) ? error.status : 502;

    console.error("MBTI 맞춤 여행지 조회 실패:", {
      status: error.status,
      message: error.message,
    });

    return response.status(status).json({
      success: false,
      message:
        status === 401
          ? "로그인 세션이 만료되었습니다."
          : status === 400
            ? error.message
          : "맞춤 여행지를 불러오지 못했습니다.",
    });
  }
});

router.get("/recommended/filters", async (request, response) => {
  const accessToken = getBearerToken(request.get("authorization"));
  const requestedMbtiType = request.query.mbtiType;

  if (!accessToken && !requestedMbtiType) {
    return response.status(401).json({
      success: false,
      message: "로그인이 필요한 요청입니다.",
    });
  }

  try {
    const result = await getRecommendedDestinationFilters({
      supabaseUrl: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
      accessToken,
      mbtiType: requestedMbtiType,
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
      message: "추천 여행지 필터 조회 성공",
    });
  } catch (error) {
    const status = [400, 401].includes(error.status) ? error.status : 502;

    console.error("추천 여행지 필터 조회 실패:", {
      status: error.status,
      message: error.message,
    });

    return response.status(status).json({
      success: false,
      message:
        status === 401
          ? "로그인 세션이 만료되었습니다."
          : status === 400
            ? error.message
          : "추천 여행지 필터를 불러오지 못했습니다.",
    });
  }
});

module.exports = router;
