const form = document.getElementById("autopayForm");
const submitBtn = document.getElementById("submitBtn");
const formCard = document.getElementById("formCard");
const statusCard = document.getElementById("statusCard");
const statusIcon = document.getElementById("statusIcon");
const statusTitle = document.getElementById("statusTitle");
const statusSub = document.getElementById("statusSub");
const resetBtn = document.getElementById("resetBtn");

let pollTimer = null;

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const contact = document.getElementById("contact").value.trim();

  submitBtn.disabled = true;
  submitBtn.querySelector(".btn-label").textContent = "Setting up…";

  try {
    // STEP 1: Backend se subscription create karwao
    const res = await fetch("/api/subscription/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, contact }),
    });

    const data = await res.json();

    if (!data.success) {
      alert("Kuch gadbad ho gayi: " + data.message);
      resetSubmitBtn();
      return;
    }

    // Form card hide karo, status card dikhao
    formCard.classList.add("hidden");
    statusCard.classList.remove("hidden");

    // STEP 2: Razorpay Checkout kholo. Yahi pe user apna UPI app choose karke
    // apna PIN dalega — yeh sab Razorpay ke apne secure window ke andar hota hai.
    const options = {
      key: data.key,
      subscription_id: data.subscriptionId,
      name: "Autopay Setup",
      description: "₹1 autopay authorization",
      theme: { color: "#35d0a3" },
      prefill: {
        name: data.customerName,
        email: data.customerEmail,
        contact: data.customerContact,
      },
      handler: function (response) {
        // Checkout se successful response mila — ab backend se confirm karo
        pollStatus(data.subscriptionId);
      },
      modal: {
        ondismiss: function () {
          // User ne beech me hi window band kar di
          showResult(
            "fail",
            "Authorization cancelled",
            "Aapne process complete nahi kiya. Dobara try kar sakte ho."
          );
        },
      },
    };

    const rzp = new Razorpay(options);

    rzp.on("payment.failed", function (response) {
      showResult(
        "fail",
        "Authorization failed",
        response.error.description || "Kuch galat ho gaya, dobara try karo."
      );
    });

    rzp.open();
  } catch (err) {
    console.error(err);
    alert("Network error, dobara try karo.");
    resetSubmitBtn();
  }
});

function resetSubmitBtn() {
  submitBtn.disabled = false;
  submitBtn.querySelector(".btn-label").textContent = "Authorize ₹1 autopay";
}

// STEP 3: Backend se poll karo ki subscription authenticated/active hui ya nahi
// (webhook thoda async hota hai, isliye kuch second retry karte hain)
function pollStatus(subscriptionId, attempt = 0) {
  statusTitle.textContent = "Confirming authorization…";
  statusSub.textContent = "Ek second, backend se confirm kar rahe hain.";

  fetch(`/api/subscription/status/${subscriptionId}`)
    .then((res) => res.json())
    .then((data) => {
      if (!data.success) throw new Error(data.message);

      const status = data.status;

      if (status === "authenticated" || status === "active") {
        showResult(
          "success",
          "Autopay is on ✅",
          "₹1 will be auto-debited each cycle from now on. Done!"
        );
        return;
      }

      if (attempt < 6) {
        pollTimer = setTimeout(() => pollStatus(subscriptionId, attempt + 1), 2000);
      } else {
        showResult(
          "pending",
          "Still processing…",
          "Bank se confirmation aane me thoda time lag sakta hai. Baad me check kar lena."
        );
      }
    })
    .catch((err) => {
      console.error(err);
      showResult("fail", "Couldn't confirm", "Status check nahi ho paya, refresh karke dekho.");
    });
}

function showResult(type, title, sub) {
  clearTimeout(pollTimer);

  statusTitle.textContent = title;
  statusSub.textContent = sub;
  resetBtn.classList.remove("hidden");

  if (type === "success") {
    statusIcon.innerHTML = `
      <div class="success-check">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path d="M4 12.5L9.5 18L20 6" stroke="#35d0a3" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`;
  } else if (type === "fail") {
    statusIcon.innerHTML = `
      <div class="fail-mark">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M6 6L18 18M18 6L6 18" stroke="#ef7e6b" stroke-width="2.6" stroke-linecap="round"/>
        </svg>
      </div>`;
  }
  // "pending" type ke liye loader icon wahi rehne do
}

resetBtn.addEventListener("click", () => {
  statusCard.classList.add("hidden");
  formCard.classList.remove("hidden");
  form.reset();
  resetSubmitBtn();
  resetBtn.classList.add("hidden");
});
