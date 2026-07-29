const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription", required: true },
    razorpayPaymentId: { type: String, required: true, unique: true },
    razorpaySubscriptionId: { type: String, required: true },
    amount: { type: Number, required: true }, // paise me
    currency: { type: String, default: "INR" },
    status: { type: String, required: true }, // captured / failed
    method: { type: String }, // upi, card, etc.
    rawPayload: { type: Object }, // webhook ka poora payload, debugging ke liye
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
