require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");

const subscriptionRoutes = require("./routes/subscription");
const webhookRoutes = require("./routes/webhook");

const app = express();

connectDB();

app.use(cors());

// ⚠️ Webhook route ko raw body chahiye signature verify karne ke liye,
// isliye ise express.json() se PEHLE mount karo
app.use("/api/webhook", express.raw({ type: "application/json" }), webhookRoutes);

// Baaki sab normal JSON body parse karega
app.use(express.json());

app.use("/api/subscription", subscriptionRoutes);

// Frontend serve karo
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server chal raha hai: http://localhost:${PORT}`));
