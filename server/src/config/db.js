const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let memoryServer;

async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (uri) {
    try {
      await mongoose.connect(uri);
      console.log("MongoDB connected:", uri);
      return { mode: "external", uri };
    } catch (err) {
      console.warn("External MongoDB failed, falling back to in-memory:", err.message);
    }
  }

  memoryServer = await MongoMemoryServer.create();
  const memUri = memoryServer.getUri();
  await mongoose.connect(memUri);
  console.log("MongoDB Memory Server connected");
  return { mode: "memory", uri: memUri };
}

module.exports = { connectDB };
