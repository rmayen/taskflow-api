const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_DATA = {
  users: [],
  projects: [],
  tasks: []
};

function createStore(filePath = path.join(__dirname, "..", "data", "taskflow.json")) {
  function read() {
    if (!fs.existsSync(filePath)) {
      return structuredClone(DEFAULT_DATA);
    }

    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  }

  function write(data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  function mutate(callback) {
    const data = read();
    const result = callback(data);
    write(data);
    return result;
  }

  return {
    read,
    write,
    mutate,
    id: () => crypto.randomUUID()
  };
}

module.exports = {
  createStore
};
