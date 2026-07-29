const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const Subscription = require("../models/Subscription");
const Payment = require("../models/Payment");

/**
 * IMPORTANT: Yeh route raw body use karta hai (signature verify karne ke liye),
 * isliye server.js me is route ke liye express.json() se PEHLE
 * express.raw({ type: "application/json" }) middleware lagaya gaya hai.
 *
 * Razorpay Dashboard -> Settings -> Webhooks me yeh events enable karo:
 *   - subscription.authenticated  (user ne PIN dal diya, mandate ban gaya)
 *   - subscription.activated      (autopay officially active ho gaya)
 *   - subscription.charged        (autopay se paisa kat gaya - Rs 1)
 *   - payment.failed
 *
 * Webhook URL: https://yourdomain.com/api/webhook/razorpay
 */
router.post("/razorpay", async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const razorpaySignature = req.headers["x-razorpay-signature"];

    // req.body yaha Buffer hai (raw), isse string banao
    const rawBody = req.body;

    // Signature verify karo - yeh sabse important security step hai
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      console.warn("⚠️ Webhook signature mismatch — fake request ho sakta hai");
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    const payload = JSON.parse(rawBody.toString());
    const event = payload.event;

    console.log("📩 Webhook event received:", event);

    if (event === "subscription.authenticated" || event === "subscription.activated") {
      const sub = payload.payload.subscription.entity;
      await Subscription.findOneAndUpdate(
        { razorpaySubscriptionId: sub.id },
        { status: sub.status }
      );
    }

    if (event === "subscription.charged") {
      const sub = payload.payload.subscription.entity;
      const payment = payload.payload.payment.entity;

      const subscriptionDoc = await Subscription.findOneAndUpdate(
        { razorpaySubscriptionId: sub.id },
        { status: sub.status }
      );

      // Duplicate payment save na ho iska khayal (unique index bhi hai payment id pe)
      const existingPayment = await Payment.findOne({ razorpayPaymentId: payment.id });
      if (!existingPayment && subscriptionDoc) {
        await Payment.create({
          subscription: subscriptionDoc._id,
          razorpayPaymentId: payment.id,
          razorpaySubscriptionId: sub.id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          method: payment.method,
          rawPayload: payload,
        });
      }
    }

    if (event === "payment.failed") {
      console.log("❌ Payment failed webhook:", payload.payload.payment.entity);
    }

    // Razorpay ko turant 200 bhejo, warna woh retry karta rahega
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
