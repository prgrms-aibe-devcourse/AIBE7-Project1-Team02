const path = require("node:path");
const fs = require("node:fs");
const express = require("express");

const healthRouter = require("./routes/health");
const configRouter = require("./routes/config");
const destinationsRouter = require("./routes/destinations");
const travelRouter = require("./routes/travel");

const app = express();
const publicDirectory = path.join(__dirname, "..", "public");
const indexHtmlPath = path.join(publicDirectory, "index.html");

function getSiteUrl(request) {
  const configuredUrl =
    process.env.SITE_URL ||
    process.env.PUBLIC_SITE_URL ||
    process.env.RENDER_EXTERNAL_URL;

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  const protocol = request.get("x-forwarded-proto") || request.protocol || "http";
  const host = request.get("host");
  return `${protocol}://${host}`;
}

function serveIndexHtml(request, response, next) {
  fs.readFile(indexHtmlPath, "utf8", (error, html) => {
    if (error) {
      next(error);
      return;
    }

    const siteUrl = getSiteUrl(request);
    response
      .type("html")
      .send(html.replaceAll("__SITE_URL__", siteUrl));
  });
}

app.disable("x-powered-by");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/health", healthRouter);
app.use("/api/config", configRouter);
app.use("/api/destinations", destinationsRouter);
app.use("/api/travel", travelRouter);
app.use("/api/user", require("./routes/user"));
app.use("/public", express.static(publicDirectory));

app.get(["/", "/index.html"], serveIndexHtml);

app.use(express.static(publicDirectory, { index: false }));

app.use("/api", (request, response) => {
  response.status(404).json({
    success: false,
    message: "요청한 API를 찾을 수 없습니다.",
  });
});

app.use((request, response) => {
  response.status(404).send("Not Found");
});

module.exports = app;
