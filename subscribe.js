// subscribe.js
// Drop this script into any Vectrasource product page
// Replaces the static Razorpay payment link with a proper subscription checkout
// Usage: call startSubscription('vlogsource') on button click

// Your Razorpay Key ID (public — safe to expose)
const RAZORPAY_KEY = 'rzp_live_SxsAgSqIpmxqs2'; // ← replace with your actual key

// Map product → Razorpay Plan ID
// Get these from Razorpay Dashboard → Subscriptions → Plans
const PLAN_IDS = {
  'vlogsource': 'plan_SxrzUFchScm8fi', // ← replace after creating plan
  'tutorai':    'plan_xxxxxxxxxxxxxxxx',
  'vakeel':     'plan_xxxxxxxxxxxxxxxx',
  'suite':      'plan_xxxxxxxxxxxxxxxx',
};

const PLAN_AMOUNTS = {
  'vlogsource': 26900, // ₹269 in paise
  'tutorai':    26900,
  'vakeel':     26900,
  'suite':      69900, // ₹699 in paise
};

const PLAN_DISPLAY_NAMES = {
  'vlogsource': 'VlogSource Pro',
  'tutorai':    'TutorAI Pro',
  'vakeel':     'Vakeel AI Pro',
  'suite':      'Vectrasource Suite Pro',
};

async function startSubscription(product = 'vlogsource') {
  // Load Razorpay checkout script if not already loaded
  if (!window.Razorpay) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  const planId = PLAN_IDS[product];
  if (!planId || planId.includes('xxxxxxx')) {
    console.error('Plan ID not configured for', product);
    alert('Payment setup incomplete. Please contact support.');
    return;
  }

  const options = {
    key: RAZORPAY_KEY,
    subscription_id: null, // will be set after creating subscription
    name: 'Vectrasource',
    description: PLAN_DISPLAY_NAMES[product] + ' — Monthly Subscription',
    image: 'https://vlogsource.vercel.app/favicon.ico',
    recurring: true,
    // Create subscription on your backend first, then pass subscription_id
    // For now using payment link as fallback — replace with subscription flow
    handler: function(response) {
      console.log('Payment success:', response);
      showPostPaymentMessage();
    },
    prefill: {
      email: '',   // pre-fill if you have the user's email
      contact: '',
    },
    notes: {
      product: product,
    },
    theme: {
      color: '#FF3B3B'
    },
    modal: {
      ondismiss: function() {
        console.log('Checkout closed');
      }
    }
  };

  // Open Razorpay checkout
  const rzp = new window.Razorpay(options);
  rzp.open();
}

function showPostPaymentMessage() {
  // Show a message telling user to check email for token
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;padding:1.5rem;';
  overlay.innerHTML = `
    <div style="background:#1F1210;border:1px solid rgba(255,59,59,0.2);border-radius:20px;padding:2.5rem;max-width:420px;width:100%;text-align:center;">
      <div style="font-size:48px;margin-bottom:1rem;">🎉</div>
      <div style="font-size:22px;font-weight:800;color:#F0EAE8;margin-bottom:0.5rem;">Payment Successful!</div>
      <p style="font-size:14px;color:rgba(255,255,255,0.6);line-height:1.6;margin-bottom:1.5rem;">
        Your access token is being generated and will be sent to your email within <strong style="color:#4ade80;">2 minutes</strong>.
      </p>
      <div style="background:rgba(255,59,59,0.08);border:1px solid rgba(255,59,59,0.15);border-radius:10px;padding:14px;margin-bottom:1.5rem;font-size:13px;color:rgba(255,255,255,0.6);line-height:1.7;">
        1. Check your email for the token<br/>
        2. Click <strong style="color:#F0EAE8;">"I have a token"</strong> below<br/>
        3. Paste your token to unlock access
      </div>
      <button onclick="this.closest('div[style]').remove();showTokenInput();" style="background:#FF3B3B;color:white;border:none;border-radius:30px;padding:14px 28px;font-size:15px;font-weight:700;cursor:pointer;width:100%;">
        I have my token →
      </button>
      <button onclick="this.closest('div[style]').remove()" style="background:none;border:none;color:rgba(255,255,255,0.3);font-size:12px;cursor:pointer;margin-top:12px;font-family:inherit;">
        I'll check email later
      </button>
    </div>
  `;
  document.body.appendChild(overlay);
}
