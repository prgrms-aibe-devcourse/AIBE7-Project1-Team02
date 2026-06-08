const express = require("express");

const router = express.Router();

router.get("/", (request, response) => {
  response.json({
    success: true,
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
    message: "서버가 정상 작동 중입니다.",
  });
});

module.exports = router;
