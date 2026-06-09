const path = require("node:path");
const express = require("express");

const healthRouter = require("./routes/health");
const configRouter = require("./routes/config");
const destinationsRouter = require("./routes/destinations");

const app = express();
const publicDirectory = path.join(__dirname, "..", "public");

app.disable("x-powered-by");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/health", healthRouter);
app.use("/api/config", configRouter);
app.use("/api/destinations", destinationsRouter);
app.use("/api/user", require("./routes/user"));
app.use("/public", express.static(publicDirectory));
app.use(express.static(publicDirectory));

app.get("/", (request, response) => {
  response.sendFile(path.join(publicDirectory, "index.html"));
});

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
