// Edge Middleware — scoped ONLY to the GoMobile offer.
// 1) Hard expiry: after EXPIRES, the URL serves an "expired" page (cannot be bypassed).
// 2) Open tracking: emails tom@octomonic.com on each real browser open (bots/prefetch filtered).
// Other mockups in this repo are untouched (see config.matcher).

export const config = {
  matcher: ['/2026-06-19-gomobile-offer', '/2026-06-19-gomobile-offer/:path*'],
};

// ─── edit this one line to change the cutoff ───
const EXPIRES = Date.parse('2026-07-03T23:59:59+03:00'); // 14 days, Asia/Jerusalem
// ───────────────────────────────────────────────
const SLUG = '/2026-06-19-gomobile-offer';
const FROM = 'GoMobile Offer <gomobile@octomonic.com>';
const TO = 'tom@octomonic.com';

const BOT = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|twitter|linkedin|embed|curl|wget|python|headless|lighthouse|vercel|pingdom|monitor|fetch|axios|go-http|okhttp/i;
const ASSET = /\.(png|jpe?g|svg|gif|webp|ico|css|js|mjs|woff2?|ttf|map|json|txt|xml)$/i;

function expiredPage() {
  return `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>ההצעה אינה זמינה · Offer expired</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;700;800;900&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{height:100%}
body{font-family:'Heebo',system-ui,sans-serif;background:linear-gradient(125deg,#16182a,#3a0f2c);color:#EEF0F6;
display:flex;align-items:center;justify-content:center;text-align:center;padding:24px}
.box{max-width:440px}.box img{height:52px;margin-bottom:24px}
h1{font-size:21px;font-weight:800;margin-bottom:9px}p{color:#9AA3B5;font-size:14.5px;line-height:1.7}
.b{color:#F0C000;font-weight:800}.sep{height:1px;background:rgba(255,255,255,.12);width:120px;margin:22px auto}
.bar{height:3px;width:90px;margin:18px auto 0;border-radius:3px;background:linear-gradient(90deg,#EC008C,#FF8F4D,#F0C000)}</style></head>
<body><div class="box">
<img src="${SLUG}/octomonic.png" alt="OctoMonic">
<h1>ההצעה כבר אינה זמינה</h1>
<p>תוקף ההצעה הזו פג. לקבלת הצעה מעודכנת, פנו אל <span class="b">OctoMonic</span>.</p>
<div class="sep"></div>
<h1>This offer has expired</h1>
<p>For an updated quote, please contact <span class="b">OctoMonic</span>.</p>
<div class="bar"></div>
</div></body></html>`;
}

export default function middleware(request, context) {
  const url = new URL(request.url);
  const path = url.pathname;
  const isAsset = ASSET.test(path);
  const isPage = !isAsset && (path === SLUG || path === SLUG + '/' || path.endsWith('/index.html'));

  const forceExpired = url.searchParams.get('preview') === 'expired';
  const expired = Date.now() > EXPIRES;

  // 1) expiry gate — page only (assets still load so the expired page can show the logo)
  if (isPage && (expired || forceExpired)) {
    return new Response(expiredPage(), {
      status: 410,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  // 2) open tracking — real browser, main page, not expired
  const ua = request.headers.get('user-agent') || '';
  const accept = request.headers.get('accept') || '';
  const purpose = (request.headers.get('sec-purpose') || request.headers.get('purpose') || '').toLowerCase();
  const realOpen = isPage && request.method === 'GET' && accept.includes('text/html')
    && !BOT.test(ua) && !purpose.includes('prefetch') && !purpose.includes('preview');

  if (realOpen && !forceExpired) {
    const key = process.env.RESEND_API_KEY;
    if (key) {
      const when = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Jerusalem', hour12: false });
      const city = request.headers.get('x-vercel-ip-city') || '';
      const country = request.headers.get('x-vercel-ip-country') || '';
      const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0] || 'unknown';
      const ref = request.headers.get('referer') || '—';
      const loc = decodeURIComponent([city, country].filter(Boolean).join(', ')) || '—';
      const text =
        `The GoMobile offer page was just opened.\n\n` +
        `When (IDT):  ${when}\n` +
        `Location:    ${loc}\n` +
        `IP:          ${ip}\n` +
        `Referrer:    ${ref}\n` +
        `Device:      ${ua}\n` +
        `URL:         ${url.href}`;
      const send = fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: [TO], subject: '📂 GoMobile offer was opened', text }),
      }).catch(() => {});
      if (context && context.waitUntil) context.waitUntil(send);
    }
  }

  // continue to the static file
  return;
}
