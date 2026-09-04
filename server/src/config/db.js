const net = require("net");
const mongoose = require("mongoose");
const { embeddedModels, createModel } = require("./inMemoryDB");

let useEmbedded = false;
const origModel = mongoose.model.bind(mongoose);

mongoose.model = function (name, schema) {
  try {
    const real = origModel(name, schema);
    return new Proxy(real, {
      get(target, prop) {
        if (useEmbedded && embeddedModels[name] && prop in embeddedModels[name]) {
          return embeddedModels[name][prop];
        }
        return target[prop];
      },
    });
  } catch (e) {
    return embeddedModels[name] || createModel(name);
  }
};

function isPortReachable(port, host, timeout = 500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let status = false;
    socket.setTimeout(timeout);
    socket.on("connect", () => {
      status = true;
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (uri) {
    // Check if it's local 127.0.0.1 or localhost
    const isLocal = uri.includes("127.0.0.1:27017") || uri.includes("localhost:27017");
    let reachable = true;
    if (isLocal) {
      reachable = await isPortReachable(27017, "127.0.0.1", 300);
    }

    if (reachable) {
      try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
        console.log("MongoDB connected:", uri);
        useEmbedded = false;
        return { mode: "external", uri };
      } catch (err) {
        console.warn("External MongoDB connection failed:", err.message);
      }
    }
  }

  // Fallback to embedded in-memory database
  useEmbedded = true;
  console.log("ComplyBD running on embedded in-memory database (offline, zero-setup)");
  return { mode: "embedded" };
}

module.exports = { connectDB };

