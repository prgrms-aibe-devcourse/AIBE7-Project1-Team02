const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    data: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      kakaoJavascriptKey: process.env.KAKAO_JAVASCRIPT_KEY
    },
    message: "설정 정보 조회 성공"
  });
});

module.exports = router;
