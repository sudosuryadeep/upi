const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    razorpaySubscriptionId: { type: String, required: true, unique: true },
    planId: { type: String, required: true },
    status: {
      type: String,
      enum: [
        "created",
        "authenticated", // user ne UPI PIN dalke mandate authorize kar diya
        "active",        // autopay chalu ho gaya
        "pending",
        "halted",
        "cancelled",
        "completed",
      ],
      default: "created",
    },
    amount: { type: Number, required: true }, // paise me (100 = Rs 1)
    currency: { type: String, default: "INR" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subscription", subscriptionSchema);
