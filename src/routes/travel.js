const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const {
  getTripPlanById,
  getTripPlans,
} = require("../services/supabase/tripPlan");

const router = express.Router();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

function getBearerToken(request) {
  const authorization = request.headers.authorization || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
}

async function requireAuthenticatedUser(request, response) {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    response.status(401).json({
      success: false,
      message: "로그인이 필요한 서비스입니다.",
    });
    return null;
  }

  if (!supabaseAdmin) {
    response.status(500).json({
      success: false,
      message: "Supabase 환경 변수가 설정되지 않았습니다.",
    });
    return null;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data?.user) {
    response.status(401).json({
      success: false,
      message: "로그인 정보가 유효하지 않습니다.",
    });
    return null;
  }

  return data.user;
}

router.get("/list", async (request, response) => {
  try {
    const user = await requireAuthenticatedUser(request, response);
    if (!user) return;

    const plans = await getTripPlans(supabaseAdmin);
    response.json({
      success: true,
      data: { plans },
      message: "저장 일정 조회 성공",
    });
  } catch (error) {
    console.error("Trip plan list error:", error);
    response.status(500).json({
      success: false,
      message:
        error.code === "42501"
          ? "임시 일정 테이블 조회 권한이 없습니다."
          : "저장된 일정을 불러오지 못했습니다.",
    });
  }
});

router.get("/:planId", async (request, response) => {
  try {
    const user = await requireAuthenticatedUser(request, response);
    if (!user) return;

    const planId = Number.parseInt(request.params.planId, 10);
    if (!Number.isFinite(planId) || planId < 1) {
      return response.status(400).json({
        success: false,
        message: "유효한 일정 ID가 필요합니다.",
      });
    }

    const plan = await getTripPlanById(supabaseAdmin, planId);
    if (!plan) {
      return response.status(404).json({
        success: false,
        message: "일정을 찾을 수 없습니다.",
      });
    }

    return response.json({
      success: true,
      data: { plan },
      message: "일정 상세 조회 성공",
    });
  } catch (error) {
    console.error("Trip plan detail error:", error);
    return response.status(500).json({
      success: false,
      message:
        error.code === "42501"
          ? "임시 일정 테이블 조회 권한이 없습니다."
          : "일정 상세를 불러오지 못했습니다.",
    });
  }
});

module.exports = router;
