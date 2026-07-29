const express = require("express");
const router = express.Router();
const razorpay = require("../config/razorpay");
const Customer = require("../models/Customer");
const Subscription = require("../models/Subscription");

/**
 * STEP 1: Frontend se name, email, contact aata hai.
 * Yaha hum:
 *   1. Razorpay pe Customer banate hain (agar pehle se nahi hai)
 *   2. Razorpay pe Subscription (mandate) create karte hain, Rs 1 ke plan pe
 *   3. subscription_id frontend ko wapas bhejte hain
 * Frontend fir Razorpay Checkout kholega isi subscription_id ke saath —
 * wahi checkout ke andar user apna UPI app select karke PIN dalega.
 */
router.post("/create", async (req, res) => {
  try {
    const { name, email, contact } = req.body;

    if (!name || !email || !contact) {
      return res.status(400).json({ success: false, message: "Name, email, contact zaroori hai" });
    }

    // 1. Customer create ya find karo
    let customerDoc = await Customer.findOne({ email });

    let razorpayCustomerId;
    if (customerDoc) {
      razorpayCustomerId = customerDoc.razorpayCustomerId;
    } else {
      const rzpCustomer = await razorpay.customers.create({
        name,
        email,
        contact,
        fail_existing: 0, // agar Razorpay pe already customer hai to error na de, use kar le
      });
      razorpayCustomerId = rzpCustomer.id;

      customerDoc = await Customer.create({
        name,
        email,
        contact,
        razorpayCustomerId,
      });
    }

    // 2. Subscription create karo — total_count 12 matlab 12 baar tak autopay chalega
    // (aap apni requirement ke hisaab se badal sakte ho, jaise monthly plan ho to 12 = 1 saal)
    const rzpSubscription = await razorpay.subscriptions.create({
      plan_id: process.env.RAZORPAY_PLAN_ID,
      customer_notify: 1,
      total_count: 12,
      customer_id: razorpayCustomerId,
      notes: {
        purpose: "Autopay authorization - Rs 1 test",
      },
    });

    // 3. DB me save karo (status abhi "created" hai)
    const subscriptionDoc = await Subscription.create({
      customer: customerDoc._id,
      razorpaySubscriptionId: rzpSubscription.id,
      planId: process.env.RAZORPAY_PLAN_ID,
      amount: 100, // Rs 1 = 100 paise
      status: "created",
    });

    return res.json({
      success: true,
      subscriptionId: rzpSubscription.id,
      key: process.env.RAZORPAY_KEY_ID,
      customerName: name,
      customerEmail: email,
      customerContact: contact,
      dbSubscriptionId: subscriptionDoc._id,
    });
  } catch (err) {
    console.error("Subscription create error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * STEP 2 (optional but recommended):
 * Jab Razorpay Checkout se authorization popup close ho, frontend yaha
 * subscription_id bhej ke current status check kar sakta hai
 * (webhook thoda async aata hai, isliye yeh ek immediate confirmation ke liye useful hai)
 */
router.get("/status/:subscriptionId", async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    const rzpSub = await razorpay.subscriptions.fetch(subscriptionId);

    // DB me bhi sync kar do
    await Subscription.findOneAndUpdate(
      { razorpaySubscriptionId: subscriptionId },
      { status: rzpSub.status },
      { new: true }
    );

    return res.json({ success: true, status: rzpSub.status, raw: rzpSub });
  } catch (err) {
    console.error("Status fetch error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;