const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
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

// POST /api/user/account - Delete user account
router.delete("/account", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "인증 토큰이 없습니다.",
      });
    }
    const token = authHeader.split(" ")[1];

    if (!supabaseAdmin) {
      return res.status(500).json({
        success: false,
        message: "서버의 관리자 키가 설정되지 않아 계정을 완전히 삭제할 수 없습니다. 관리자에게 문의하세요.",
      });
    }

    // Verify token to get the user ID
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return res.status(401).json({
        success: false,
        message: "유효하지 않은 토큰입니다.",
      });
    }

    const userId = userData.user.id;

    // Optional: We can delete user preferences, trips, etc. here or let Supabase triggers handle it.
    // Given the MVP constraints, we will just delete the auth user, and if cascading isn't set up, we should manually clean up public.users.
    // Assuming public.users is set to ON DELETE CASCADE with auth.users, deleting auth.users will clean up public.users and everything related.

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
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

module.exports = router;
