require("dotenv").config();
const { connectDB } = require("../config/db");
const { seed } = require("./seed");

(async () => {
  try {
    await connectDB();
    await seed();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
