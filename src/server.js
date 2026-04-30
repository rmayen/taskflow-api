const http = require("http");
const { createApp } = require("./app");

const port = Number(process.env.PORT || 3000);
const server = http.createServer(createApp());

server.listen(port, () => {
  console.log(`TaskFlow API running at http://localhost:${port}`);
});
