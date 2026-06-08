// subscribe.js - Fixed version
// Simply redirects to Razorpay payment links

const PAYMENT_LINKS = {
  'vlogsource': 'https://rzp.io/rzp/bnXkcm8H',
  'tutorai':    'https://rzp.io/rzp/tutorai',
  'vakeel':     'https://rzp.io/rzp/Z5odPYeR',
  'taxdraftai': 'https://rzp.io/rzp/taxdraftai',
  'suite':      'https://rzp.io/rzp/aGup1zz',
};

function startSubscription(product = 'vlogsource') {
  const link = PAYMENT_LINKS[product];
  if (link) {
    window.open(link, '_blank');
  }
}

function showPostPaymentMessage() {
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
