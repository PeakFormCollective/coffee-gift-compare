/* Measurement layer, provider-neutral (measurement is the goal, not a specific tool).
   Primary: GoatCounter (one studio account; Claude verifies hits and creates new venture sites via its API).
   Optional: GA4. Each provider is inactive until its ID is set. verify-venture.sh flags placeholders.
   Records: page views + referrer + utm campaign (provider default) and one event per outbound click:
   "click-<link_id>" (link_id = sub_id in data/links.csv), titled with the merchant and first-touch pin. */
(function () {
  // Default provider (no account, zero founder setup): public counters at abacus.jasoncameron.dev, read back by Claude.
  // Counts only (no cookies, no personal data). Keys: pv-<page>, session, ses-<pin>, ref-pinterest, click-<link_id>, clickpin-<pin>
  var ABACUS_NS = 'peakformcollective-v002';
  var GC_CODE = 'GC-CODE-PLACEHOLDER'; // optional upgrade: GoatCounter site code
  var GA4_ID = 'G-XXXXXXXXXX';         // optional: GA4
  var VENTURE = 'V002-coffee';
  var abOn = /^[a-z0-9-]{6,60}$/.test(ABACUS_NS) && !navigator.webdriver;
  var gcOn = /^[a-z0-9][a-z0-9-]{1,40}$/.test(GC_CODE) && GC_CODE !== 'GC-CODE-PLACEHOLDER';
  var gaOn = /^G-[A-Z0-9]{6,12}$/.test(GA4_ID) && GA4_ID !== 'G-XXXXXXXXXX';
  if (!abOn && !gcOn && !gaOn) return;
  function hit(key) {
    if (!abOn) return;
    try { fetch('https://abacus.jasoncameron.dev/hit/' + ABACUS_NS + '/' + key.replace(/[^a-z0-9-]/gi, '-').toLowerCase().slice(0, 60), { mode: 'cors', keepalive: true }); } catch (e) {}
  }

  var ft = {};
  try {
    var q = new URLSearchParams(location.search);
    if (q.get('utm_campaign')) sessionStorage.setItem('ft', JSON.stringify({ source: q.get('utm_source') || '', campaign: q.get('utm_campaign') || '' }));
    ft = JSON.parse(sessionStorage.getItem('ft') || '{}');
  } catch (e) { ft = {}; }

  var page = (location.pathname.split('/').pop() || 'index.html').replace('.html', '');
  hit('pv-' + page);
  var first = false; try { first = !sessionStorage.getItem('seen'); sessionStorage.setItem('seen', '1'); } catch (e) {}
  if (first) {
    hit('session');
    // Discovery pathway (RT1): source class of the session + landing page
    var r = document.referrer || '', h = ''; try { h = r ? new URL(r).hostname : ''; } catch (e) {}
    var src = !h ? (ft.campaign ? 'pinterest' : 'direct')
      : /(^|\.)google\./.test(h) ? 'google' : /(^|\.)bing\.com$/.test(h) ? 'bing' : /duckduckgo\.com$/.test(h) ? 'duckduckgo'
      : /yahoo\./.test(h) ? 'yahoo' : /chatgpt\.com|openai\.com|perplexity\.ai|claude\.ai|copilot\.microsoft\.com|gemini\.google\.com/.test(h) ? 'ai'
      : /pinterest\./.test(h) ? 'pinterest' : /facebook\.|instagram\.|t\.co$|x\.com|reddit\.com|linkedin\./.test(h) ? 'social'
      : h === location.hostname ? 'internal' : 'other';
    hit('src-' + src); hit('land-' + page); hit('land-' + page + '-' + src);
    if (ft.campaign) hit('ses-' + ft.campaign);
    if (/pinterest\./.test(document.referrer) || /pinterest/i.test(ft.source || '')) hit('ref-pinterest');
  }

  function load(src, attrs) {
    var s = document.createElement('script'); s.async = true; s.src = src;
    for (var k in attrs) s.setAttribute(k, attrs[k]);
    document.head.appendChild(s);
  }
  if (gcOn) load('https://gc.zgo.at/count.js', { 'data-goatcounter': 'https://' + GC_CODE + '.goatcounter.com/count' });
  if (gaOn) {
    load('https://www.googletagmanager.com/gtag/js?id=' + GA4_ID, {});
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date()); gtag('config', GA4_ID, { venture_id: VENTURE });
  }

  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a[href]');
    if (!a) return;
    if (a.hostname === location.hostname) { if (a.id) hit('nav-' + a.id); return; } // internal action (RT1)
    var id = a.id || 'no-id', merchant = a.hostname.replace(/^www\.|^store\./, '');
    var pin = ft.campaign || 'none';
    hit('click-' + id); hit('clickpin-' + pin);
    if (gcOn && window.goatcounter && window.goatcounter.count)
      window.goatcounter.count({ path: 'click-' + id, title: merchant + ' | pin:' + pin, event: true });
    if (gaOn) gtag('event', 'outbound_click', { venture_id: VENTURE, link_id: id, merchant: merchant, ft_campaign: pin, transport_type: 'beacon' });
  }, true);
})();
