# Razorpay ₹1 Autopay (UPI Recurring Mandate)

Node.js + Express + MongoDB backend, plain HTML/CSS/JS frontend.
User form fill karta hai → Razorpay Checkout khulta hai → user apna UPI app
choose karke **apna PIN khud us window ke andar** daalta hai → mandate
authorize ho jata hai → webhook se DB me confirm ho jata hai.

**Important:** Iss project ka koi bhi custom form UPI PIN nahi maangta.
PIN hamesha Razorpay ke apne checkout.js widget ke andar, ya seedha user
ke UPI app (GPay/PhonePe/Paytm) me enter hota hai. Yeh RBI/NPCI ka
mandatory security requirement hai — koi bhi merchant apna PIN input box
nahi bana sakta, aur na hi banana chahiye.

---

## 1. Prerequisites

- Node.js 18+
- MongoDB (local ya [MongoDB Atlas](https://www.mongodb.com/atlas) free tier)
- Razorpay account (test mode se shuru karo): https://dashboard.razorpay.com/signup

## 2. Razorpay Dashboard setup

1. **API Keys**: Settings → API Keys → Generate Test Key. `Key Id` aur `Key Secret` copy karo.
2. **Plan banao** (recurring ₹1 charge ke liye):
   - Dashboard → Subscriptions → Plans → Create Plan
   - Billing amount: ₹1
   - Billing frequency: jitna chahiye (daily/weekly/monthly) — testing ke liye "monthly" bhi chalega, plan sirf template hai
   - Plan create karke uski `plan_id` (starts with `plan_`) copy karo
3. **Webhook setup**:
   - Dashboard → Settings → Webhooks → Add New Webhook
   - URL: `https://yourdomain.com/api/webhook/razorpay` (local testing ke liye [ngrok](https://ngrok.com) use karo: `ngrok http 5000`)
   - Secret ek strong random string daalo, wahi `.env` me daalna hai
   - Active events select karo: `subscription.authenticated`, `subscription.activated`, `subscription.charged`, `payment.failed`

## 3. Project setup

```bash
cd razorpay-autopay
npm install
cp .env.example .env
```

`.env` file kholke apni values daalo:

```
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxx
RAZORPAY_PLAN_ID=plan_xxxxx
MONGO_URI=mongodb://127.0.0.1:27017/razorpay_autopay
PORT=5000
```

## 4. Run

```bash
npm start
```

Browser me kholo: `http://localhost:5000`

Local webhook test karne ke liye alag terminal me:
```bash
ngrok http 5000
```
Jo URL mile (`https://xxxx.ngrok-free.app/api/webhook/razorpay`), wahi
Razorpay dashboard ke webhook URL me daal do.

## 5. Flow kaise chalta hai

1. User form fill karta hai (name, email, mobile)
2. `POST /api/subscription/create` → Razorpay pe customer + subscription (mandate) banta hai, MongoDB me bhi save hota hai (`status: created`)
3. Frontend `subscription_id` ke saath Razorpay Checkout kholta hai
4. Checkout ke andar user apna UPI app select karta hai, apna PIN daalta hai — yeh sab Razorpay ke secure iframe/redirect ke andar hota hai, tumhare server ko PIN kabhi nahi milta
5. Success hone par Razorpay webhook bhejta hai: `subscription.authenticated` → DB me status update hota hai
6. Frontend har 2 second me `GET /api/subscription/status/:id` poll karta hai, jaise hi status `authenticated`/`active` hota hai — "Autopay is on ✅" dikhta hai
7. Aage jab bhi autopay cycle chalega (Razorpay khud automatically charge karega), `subscription.charged` webhook aayega aur `Payment` collection me record ban jayega

## 6. MongoDB Collections

- **customers** — name, email, contact, razorpayCustomerId
- **subscriptions** — customer ref, razorpaySubscriptionId, planId, status, amount
- **payments** — subscription ref, razorpayPaymentId, amount, status, method, poora webhook payload (debug ke liye)

## 7. Test mode me test karna

Razorpay test mode me real paisa nahi katega. Test UPI VPA use karo:
`success@razorpay` (success simulate karega) ya `failure@razorpay` (failure simulate karega).
Docs: https://razorpay.com/docs/payments/payments/test-card-upi-details/

## 8. Production me jaane se pehle

- Test keys ko live keys (`rzp_live_...`) se replace karo
- KYC complete karo Razorpay dashboard pe (live mode ke liye zaroori hai)
- Webhook secret ko strong rakho aur `.env` ko kabhi bhi commit mat karo
- HTTPS domain use karo (webhook aur checkout dono ke liye zaroori hai)
