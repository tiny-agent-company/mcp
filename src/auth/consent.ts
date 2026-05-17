import { MCP_BASE_URL, CLIENT_URL } from '../config.js';

export function getConsentHtml(pendingAuthId: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign in — AgentCard</title>
  <link rel="icon" type="image/svg+xml" href="${CLIENT_URL}/favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #FFFEF0;
      --fg: #10100E;
      --dim: #606055;
      --dimmer: #C0C0AB;
      --accent: #E85D2A;
      --border: #C0C0AB;
      --ease: cubic-bezier(0.4, 0, 0.2, 1);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: var(--bg);
      color: var(--fg);
      font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 14px;
      line-height: 1.7;
      -webkit-font-smoothing: antialiased;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
    }

    .page {
      width: 100%;
      max-width: 400px;
      animation: fadeUp 0.5s var(--ease);
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 500;
      letter-spacing: -0.02em;
      color: var(--fg);
      text-decoration: none;
    }

    .divider {
      height: 1px;
      background: var(--border);
      margin: 20px 0;
    }

    .subtitle {
      font-size: 12px;
      color: var(--dim);
      margin-bottom: 28px;
    }

    label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent);
      margin-bottom: 8px;
    }

    input[type="email"] {
      width: 100%;
      padding: 10px 12px;
      background: transparent;
      border: 1px solid var(--border);
      border-radius: 0;
      color: var(--fg);
      font-family: 'Geist Mono', monospace;
      font-size: 13px;
      outline: none;
      transition: border-color 0.15s var(--ease);
    }

    input[type="email"]::placeholder { color: var(--dimmer); }
    input[type="email"]:focus { border-color: var(--fg); }

    button {
      width: 100%;
      padding: 10px;
      margin-top: 12px;
      background: transparent;
      color: var(--fg);
      border: 1px solid var(--fg);
      border-radius: 0;
      font-family: 'Geist Mono', monospace;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s var(--ease);
    }

    button:hover {
      background: var(--fg);
      color: var(--bg);
    }

    button:disabled {
      border-color: var(--dimmer);
      color: var(--dim);
      cursor: not-allowed;
      background: transparent;
    }

    .status {
      margin-top: 16px;
      padding: 10px 12px;
      font-size: 12px;
      line-height: 1.5;
      display: none;
    }

    .status.info {
      display: block;
      border: 1px solid #E8D5A0;
      color: #8B6914;
    }

    .status.error {
      display: block;
      border: 1px solid #FECACA;
      color: #B91C1C;
    }

    .status.success {
      display: block;
      border: 1px solid #BBF7D0;
      color: #15803D;
    }

    .footer {
      margin-top: 28px;
    }

    .footer a {
      font-size: 12px;
      color: var(--dimmer);
      text-decoration: none;
      transition: color 0.15s var(--ease);
    }

    .footer a:hover { color: var(--fg); }
  </style>
</head>
<body>
  <div class="page">
    <a href="${CLIENT_URL}" target="_blank" class="logo">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="20" height="20" fill="none"><rect x="20" y="43" width="160" height="114" rx="12" stroke="currentColor" stroke-width="5"/><rect x="58" y="68" width="84" height="64" stroke="currentColor" stroke-width="5"/><line x1="58" y1="103.5" x2="142" y2="103.5" stroke="currentColor" stroke-width="5"/><line x1="99.5" y1="68" x2="99.5" y2="103.5" stroke="currentColor" stroke-width="5"/></svg>
      AgentCard
    </a>
    <div class="divider"></div>
    <p class="subtitle">Sign in to connect your account to Claude</p>

    <form id="authForm">
      <label for="email">Email</label>
      <input type="email" id="email" name="email" placeholder="you@example.com" required autocomplete="email">
      <button type="submit" id="submitBtn">Send magic link &rarr;</button>
    </form>

    <div id="status" class="status"></div>

    <div class="footer">
      <a href="${CLIENT_URL}" target="_blank">agentcard.sh</a>
    </div>
  </div>

  <script>
    const pendingAuthId = ${JSON.stringify(pendingAuthId)};
    const baseUrl = ${JSON.stringify(MCP_BASE_URL)};
    const form = document.getElementById('authForm');
    const submitBtn = document.getElementById('submitBtn');
    const statusEl = document.getElementById('status');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      if (!email) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';

      try {
        const res = await fetch(baseUrl + '/oauth/submit-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, pendingAuthId }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to send magic link');
        }

        statusEl.className = 'status info';
        statusEl.textContent = 'Check your email and click the magic link to sign in.';
        form.style.display = 'none';

        // Poll for completion
        pollForAuth();
      } catch (err) {
        statusEl.className = 'status error';
        statusEl.textContent = err.message;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send magic link';
      }
    });

    async function pollForAuth() {
      const maxAttempts = 90; // 15 min at 10s intervals
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 10000));

        try {
          const res = await fetch(baseUrl + '/oauth/poll?pending=' + encodeURIComponent(pendingAuthId));
          const data = await res.json();

          if (data.status === 'verified') {
            statusEl.className = 'status success';
            statusEl.textContent = 'Authenticated! Redirecting...';
            // Redirect to complete OAuth flow
            window.location.href = baseUrl + '/oauth/complete?pending=' + encodeURIComponent(pendingAuthId);
            return;
          }
        } catch {
          // ignore polling errors
        }
      }

      statusEl.className = 'status error';
      statusEl.textContent = 'Session expired. Please refresh and try again.';
    }
  </script>
</body>
</html>`;
}
