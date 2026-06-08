require("dotenv").config();

const app = require("./app");

const port = Number(process.env.PORT) || 3000;

const server = app.listen(port, (error) => {
  if (error) {
    console.error(`Failed to start server: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Server running at http://localhost:${port}`);
});

function shutdownServer(signal) {
  console.log(`${signal} received. Closing server.`);
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdownServer("SIGINT"));
process.on("SIGTERM", () => shutdownServer("SIGTERM"));
