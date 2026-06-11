const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdmin = null;
if (supabaseUrl && supabaseServiceRoleKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.split(" ")[1];
}

function createAuthenticatedClient(token) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

async function getAuthenticatedUser(req, res) {
  const token = getBearerToken(req);

  if (!token) {
    res.status(401).json({
      success: false,
      message: "인증 토큰이 없습니다.",
    });
    return null;
  }

  const supabase = createAuthenticatedClient(token);
  if (!supabase) {
    res.status(500).json({
      success: false,
      message: "Supabase 공개 키가 설정되지 않았습니다.",
    });
    return null;
  }

  const { data: userData, error: userError } =
    await supabase.auth.getUser(token);

  if (userError || !userData?.user) {
    res.status(401).json({
      success: false,
      message: "유효하지 않은 토큰입니다.",
    });
    return null;
  }

  return userData.user;
}

async function getAuthenticatedContext(req, res) {
  const token = getBearerToken(req);
  const user = await getAuthenticatedUser(req, res);
  if (!user) return null;

  return {
    user,
    supabase: createAuthenticatedClient(token),
  };
}

function requireSupabaseAdmin(res) {
  if (supabaseAdmin) {
    return true;
  }

  res.status(500).json({
    success: false,
    message: "서버 관리자 키가 설정되지 않았습니다.",
  });
  return false;
}

// GET /api/user/preferences/batch - Get public preferences (mbti_type, badge) for multiple users
router.get("/preferences/batch", async (req, res) => {
  try {
    const context = await getAuthenticatedContext(req, res);
    if (!context) return;
    if (!requireSupabaseAdmin(res)) return; // Use admin client to bypass RLS for public read

    const userIds = req.query.userIds ? req.query.userIds.split(',') : [];
    if (userIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const { data, error } = await supabaseAdmin
      .from("user_preferences")
      .select("user_id, mbti_type, badge")
      .in("user_id", userIds);

    if (error) {
      console.error("Batch preferences error:", error);
      return res.status(500).json({
        success: false,
        message: "사용자 성향 정보를 불러오지 못했습니다.",
      });
    }

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Batch preferences failed:", error);
    return res.status(500).json({
      success: false,
      message: "서버 오류로 사용자 성향 정보를 불러오지 못했습니다.",
    });
  }
});

// GET /api/user/bookmarks - Get bookmarked destination IDs
router.get("/bookmarks", async (req, res) => {
  try {
    const context = await getAuthenticatedContext(req, res);
    if (!context) return;
    const { user, supabase } = context;

    const { data, error } = await supabase
      .from("user_bookmarks")
      .select(
        [
          "destination_id",
          "created_at",
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
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Bookmark list error:", error);
      return res.status(500).json({
        success: false,
        message: "북마크 목록을 불러오지 못했습니다.",
      });
    }

    return res.json({
      success: true,
      data: {
        destinationIds: data.map((row) => row.destination_id),
        bookmarks: data.map((row) => ({
          destinationId: row.destination_id,
          createdAt: row.created_at,
          destination: row.destinations
            ? {
                destinationId: row.destinations.destination_id,
                destinationName: row.destinations.destination_name,
                description: row.destinations.description || "",
                address: row.destinations.address || "",
                province: row.destinations.province || "",
                city: row.destinations.city || "",
                imageUrl: row.destinations.image_url || "",
              }
            : null,
        })),
      },
      message: "북마크 목록 조회 성공",
    });
  } catch (error) {
    console.error("Bookmark list failed:", error);
    return res.status(500).json({
      success: false,
      message: "서버 오류로 북마크 목록을 불러오지 못했습니다.",
    });
  }
});

// POST /api/user/bookmarks - Add a destination bookmark
router.post("/bookmarks", async (req, res) => {
  try {
    const context = await getAuthenticatedContext(req, res);
    if (!context) return;
    const { user, supabase } = context;

    const destinationId = Number.parseInt(req.body.destinationId, 10);
    if (!Number.isFinite(destinationId) || destinationId < 1) {
      return res.status(400).json({
        success: false,
        message: "유효한 여행지 ID가 필요합니다.",
      });
    }

    const { data, error } = await supabase
      .from("user_bookmarks")
      .insert({
        user_id: user.id,
        destination_id: destinationId,
      })
      .select("bookmark_id,user_id,destination_id,created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.json({
          success: true,
          data: {
            user_id: user.id,
            destination_id: destinationId,
          },
          message: "이미 저장된 북마크입니다.",
        });
      }

      console.error("Bookmark add error:", error);
      return res.status(500).json({
        success: false,
        message: "북마크를 저장하지 못했습니다.",
      });
    }

    return res.json({
      success: true,
      data,
      message: "북마크 저장 성공",
    });
  } catch (error) {
    console.error("Bookmark add failed:", error);
    return res.status(500).json({
      success: false,
      message: "서버 오류로 북마크를 저장하지 못했습니다.",
    });
  }
});

// DELETE /api/user/bookmarks/:destinationId - Remove a destination bookmark
router.delete("/bookmarks/:destinationId", async (req, res) => {
  try {
    const context = await getAuthenticatedContext(req, res);
    if (!context) return;
    const { user, supabase } = context;

    const destinationId = Number.parseInt(req.params.destinationId, 10);
    if (!Number.isFinite(destinationId) || destinationId < 1) {
      return res.status(400).json({
        success: false,
        message: "유효한 여행지 ID가 필요합니다.",
      });
    }

    const { error } = await supabase
      .from("user_bookmarks")
      .delete()
      .eq("user_id", user.id)
      .eq("destination_id", destinationId);

    if (error) {
      console.error("Bookmark delete error:", error);
      return res.status(500).json({
        success: false,
        message: "북마크를 해제하지 못했습니다.",
      });
    }

    return res.json({
      success: true,
      data: {
        destinationId,
      },
      message: "북마크 해제 성공",
    });
  } catch (error) {
    console.error("Bookmark delete failed:", error);
    return res.status(500).json({
      success: false,
      message: "서버 오류로 북마크를 해제하지 못했습니다.",
    });
  }
});

// POST /api/user/account - Delete user account
router.delete("/account", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;
    if (!requireSupabaseAdmin(res)) return;

    // Optional: We can delete user preferences, trips, etc. here or let Supabase triggers handle it.
    // Given the MVP constraints, we will just delete the auth user, and if cascading isn't set up, we should manually clean up public.users.
    // Assuming public.users is set to ON DELETE CASCADE with auth.users, deleting auth.users will clean up public.users and everything related.

    const { error: deleteError } =
      await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error("Auth user delete error:", deleteError);
      return res.status(500).json({
        success: false,
        message: "회원 탈퇴 처리 중 오류가 발생했습니다.",
      });
    }

    return res.json({
      success: true,
      message: "회원 탈퇴가 완료되었습니다.",
    });
  } catch (error) {
    console.error("Account deletion failed:", error);
    res.status(500).json({
      success: false,
      message: "서버 오류로 회원 탈퇴를 진행할 수 없습니다.",
    });
  }
});

// DELETE /api/user/data - Reset all user data
router.delete("/data", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;
    if (!requireSupabaseAdmin(res)) return;

    // RLS 무시하고 관리자 권한으로 삭제
    const [prefRes, mbtiRes, tripsRes, bookmarkRes] = await Promise.all([
      supabaseAdmin.from("user_preferences").delete().eq("user_id", user.id),
      supabaseAdmin.from("travel_mbti_results").delete().eq("user_id", user.id),
      supabaseAdmin.from("trips").delete().eq("user_id", user.id),
      supabaseAdmin.from("user_bookmarks").delete().eq("user_id", user.id),
    ]);

    if (prefRes.error) console.error("pref delete error:", prefRes.error);
    if (mbtiRes.error) console.error("mbti delete error:", mbtiRes.error);
    if (tripsRes.error) console.error("trips delete error:", tripsRes.error);
    if (bookmarkRes.error) console.error("bookmark delete error:", bookmarkRes.error);

    if (prefRes.error || mbtiRes.error || tripsRes.error || bookmarkRes.error) {
      return res.status(500).json({
        success: false,
        message: "일부 데이터를 초기화하는 데 실패했습니다.",
      });
    }

    return res.json({
      success: true,
      message: "데이터 초기화가 완료되었습니다.",
    });
  } catch (error) {
    console.error("Data reset failed:", error);
    res.status(500).json({
      success: false,
      message: "서버 오류로 데이터를 초기화할 수 없습니다.",
    });
  }
});

module.exports = router;
