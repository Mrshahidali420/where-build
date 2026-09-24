window.dataLayer = window.dataLayer || []
function gtag() { dataLayer.push(arguments) }
gtag('js', new Date())
gtag('config', '__GA4_ID__')

// Our own counter, beside Google's.
//
// Why both: Google Analytics answers the same questions, but only after
// a day of processing and only through a report builder. This one writes
// straight into our own Cloudflare database, so /my-admin can show the
// last few minutes in plain words. It is also ours: no sampling, no
// consent wall, no account to lose.
//
// A whole visit costs one request: rows wait in the tab and leave
// together (see miFlush below). Some robots DO run scripts and even
// scroll, so nothing is written until the visitor moves and Cloudflare
// Turnstile has vouched for the browser (see miAskForPass). That is why
// the counts are worth reading.
var MI_PATH = '/_a'
// Where the page trades one Turnstile ticket for a half hour pass, and
// the public key of our Turnstile widget. The key is meant to be public:
// it names the widget and nothing else. The secret that checks a ticket
// lives in the Worker and is never in a page or in the repository.
var MI_PASS_PATH = '/_p'
var MI_SITEKEY = '__TURNSTILE_SITEKEY__'
var MI_TURNSTILE =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=miTurnstileReady'
// The pass we hold right now. Nothing is sent to our database or to
// Google without it.
var miPass = ''
try {
  var miKept = JSON.parse(sessionStorage.getItem('mi_pass') || 'null')
  // A minute of headroom, so a pass never dies in flight.
  if (miKept && miKept.dies > Date.now() + 60000) miPass = miKept.pass
} catch (e) {}
var miGoogleLoaded = __NO_GA4__
// A visit used to cost three requests: open, click, leave. That was 82%
// of the whole free Workers allowance, and the site began answering 504
// once the allowance ran out. Rows now wait in the tab and go out in one
// request when the reader really leaves the site.
var MI_QUEUE_MAX = 15
var miQueue = []
var miGoingInternal = false
try {
  miQueue = JSON.parse(sessionStorage.getItem('mi_q') || '[]')
  if (!Array.isArray(miQueue)) miQueue = []
} catch (e) {
  miQueue = []
}


// A visit is over after 30 quiet minutes.
var MI_GAP = 1800000
// A page must be on screen 5 seconds before its time is worth keeping.
var MI_LEAVE_MIN = 5000
// Only one reader in this many sends the "I left" row. It is the only
// sampled row, and it halves the cost of the whole counter. Raise it to 4
// if the site ever passes 40,000 real page views a day.
var MI_LEAVE_SAMPLE = 2

// Nothing is counted until the visitor proves a person is there.
//
// A crawler opens the page, reads the words out of it and is gone inside
// a second. It never scrolls, never taps and never stays. Counting it was
// costing a real request every time, and it filled the reports with
// people who were never people: forty countries, one page each, never a
// second page.
//
// Only a movement counts: a scroll, a mouse move, a tap, a click or a
// key. Time on the page is NOT proof, and the reports proved it. Every
// one of the ghost visits held its page open for eight to thirty eight
// seconds and was let through by the clock alone, and not one of them
// ever moved. A reader moves without thinking about it.
var miMissing = document.documentElement.getAttribute('data-missing') === '1'
var miHuman = false
var miWaiting = []
// Which of the three proofs arrived. Kept so the reports can say whether
// a visit was a person moving or only a page left open.
var miProof = 'none'

// A browser driven by a program says so, and a headless one says so in
// its own name. Neither is a reader. Dropping them here costs nothing
// and saves a request every time.
var miRobot = false
try {
  miRobot =
    navigator.webdriver === true ||
    navigator.userAgent.indexOf('HeadlessChrome') !== -1
} catch (e) {}

function miWake(event) {
  if (miHuman) return
  miHuman = true
  miProof = (event && event.type) || 'wait'
  var held = miWaiting
  miWaiting = []
  for (var i = 0; i < held.length; i++) mi(held[i])
  miAskForPass()
}

var miOnce = { passive: true, once: true }
window.addEventListener('scroll', miWake, miOnce)
window.addEventListener('mousemove', miWake, miOnce)
window.addEventListener('pointerdown', miWake, miOnce)
window.addEventListener('keydown', miWake, miOnce)
window.addEventListener('touchstart', miWake, miOnce)

function miRandom() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// One id per browser, kept locally, so a returning reader is one person
// and not two. It is a random number and nothing else: it cannot be
// traced back to a name, an address or an account.
function miVisitor() {
  try {
    var id = localStorage.getItem('mi_v')
    if (!id) {
      id = miRandom()
      localStorage.setItem('mi_v', id)
    }
    return id
  } catch (e) {
    return ''
  }
}

var miMe = miVisitor()

// Half of readers send the leave row, always the same half, so the
// average time on page stays steady instead of jumping about.
var miSampled =
  !miMe || parseInt(miMe.slice(-1), 36) % MI_LEAVE_SAMPLE === 0

// One visit, numbered. It lives in this tab only and restarts after 30
// quiet minutes, so "step 1, step 2, step 3" really is one path through
// the site and can be read back as a journey.
var miVisit = (function () {
  try {
    var now = Date.now()
    var id = sessionStorage.getItem('mi_s')
    var last = Number(sessionStorage.getItem('mi_last') || 0)
    var step = Number(sessionStorage.getItem('mi_n') || 0)
    if (!id || !last || now - last > MI_GAP) {
      id = miRandom()
      step = 0
    }
    step = step + 1
    sessionStorage.setItem('mi_s', id)
    sessionStorage.setItem('mi_n', String(step))
    sessionStorage.setItem('mi_last', String(now))
    return { id: id, step: step }
  } catch (e) {
    return { id: '', step: 0 }
  }
})()

// Only the page they arrived on carries the tag we put on our own links,
// so one shared link is counted once and not on every page after it.
function miCampaign() {
  if (miVisit.step !== 1) return ''
  try {
    var q = new URLSearchParams(location.search)
    var parts = []
    var keys = ['utm_source', 'utm_medium', 'utm_campaign']
    for (var i = 0; i < keys.length; i += 1) {
      var v = (q.get(keys[i]) || '').slice(0, 40)
      if (v) parts.push(v)
    }
    return parts.join('/')
  } catch (e) {
    return ''
  }
}

// The name of the page in plain words, so a report does not have to show
// a web address. Everything after " | " is the site name.
function miTitle() {
  var t = document.title || ''
  var cuts = [' | ', ' \u2013 ', ' \u2014 ', ' - ']
  for (var i = 0; i < cuts.length; i++) t = t.split(cuts[i])[0]
  return t.trim().slice(0, 80)
}

// Time the page was really on screen. A tab left in the background does
// not count, because nobody is reading it.
var miShownAt = document.visibilityState === 'visible' ? Date.now() : 0
var miSeen = 0
var miLeft = false

function miVisible() {
  return miSeen + (miShownAt ? Date.now() - miShownAt : 0)
}

function miLeave() {
  if (miLeft || !miSampled) return
  var ms = miVisible()
  if (ms < MI_LEAVE_MIN) return
  miLeft = true
  mi({ name: 'leave', kind: 'leave', dwell: ms, label: miTitle() })
}

document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible') {
    miShownAt = Date.now()
    return
  }
  if (miShownAt) {
    miSeen += Date.now() - miShownAt
    miShownAt = 0
  }
  miLeave()
})
window.addEventListener('pagehide', function () {
  miLeave()
  // Going to another of our pages? The next page keeps the same queue.
  if (miGoingInternal) {
    miSave()
    return
  }
  miFlush()
})

function mi(row) {
  // The owner's own browser is marked when /my-admin is opened, so his
  // own visits never show up in his own numbers.
  try {
    if (localStorage.getItem('mi_off') === '1') return
  } catch (e) {}

  if (miRobot) return

  // Held, not dropped. The row keeps its own stamp, so a reader who
  // scrolls after six seconds still lands in the report at the second
  // the page was opened.
  if (!miHuman) {
    if (!row.t) row.t = Date.now()
    miWaiting.push(row)
    return
  }

  // The address that was asked for and was not there. Kept by name so
  // the admin page can list the broken links people actually hit.
  if (miMissing && row.kind === 'view') {
    row.kind = 'missing'
    row.name = 'not_found'
  }

  // The proof that let this visit through, kept on the row itself. A
  // page that is only ever proved by the clock, never by a hand, is a
  // page nobody touched.
  if (row.kind === 'view' || row.kind === 'missing') {
    row.name = row.name + '_' + miProof
  }

  row.path = location.pathname
  row.page_type = location.pathname.split('/')[1] || 'home'
  row.device = window.innerWidth < 700 ? 'phone' : 'desktop'
  row.visitor = miMe
  row.session = miVisit.id
  row.step = miVisit.step
  row.campaign = miCampaign()

  // Where they came from. Another site goes in referrer. One of our own
  // pages goes in prev, and that is what draws the journey.
  row.referrer = ''
  row.prev = ''
  row.prev_type = ''
  try {
    var from = document.referrer ? new URL(document.referrer) : null
    if (from && from.hostname === location.hostname) {
      row.prev = from.pathname
      row.prev_type = from.pathname.split('/')[1] || 'home'
    } else if (from) {
      row.referrer = from.hostname
    }
  } catch (e) {}

  // The row waits here. It is stamped now so the batch keeps real times.
  if (!row.t) row.t = Date.now()
  miQueue.push(row)
  // With no Turnstile widget no pass ever arrives, so the queue would only
  // grow. Keep the newest few rows and nothing more.
  if (!MI_SITEKEY && miQueue.length > MI_QUEUE_MAX) miQueue = miQueue.slice(-MI_QUEUE_MAX)
  miSave()
  if (miQueue.length >= MI_QUEUE_MAX) miFlush()
}

// Keep the queue across our own pages, so one visit is one request.
function miSave() {
  try {
    sessionStorage.setItem('mi_q', JSON.stringify(miQueue))
  } catch (e) {}
}

// Send everything that is waiting, once.
function miFlush() {
  if (!miQueue.length) return
  // No pass, nothing leaves the page. The rows stay in the queue and go
  // out the moment a pass arrives.
  if (!miPass) return
  var now = Date.now()
  var rows = miQueue.map(function (row) {
    var out = {}
    for (var key in row) if (key !== 't') out[key] = row[key]
    out.age = Math.max(0, now - (row.t || now))
    return out
  })
  miQueue = []
  miSave()
  var text = JSON.stringify({ pass: miPass, rows: rows })
  // sendBeacon still arrives after the page is gone, which is the whole
  // point for a link that navigates away.
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(MI_PATH, new Blob([text], { type: 'application/json' }))
      return
    }
  } catch (e) {}
  try {
    fetch(MI_PATH, { method: 'POST', body: text, keepalive: true })
  } catch (e) {}
}

// Google's counter, fetched only once a real browser is proved. Every
// gtag call made before this point is already waiting in dataLayer and
// is sent the moment the script arrives, so nothing is lost.
function miGoogle() {
  if (miGoogleLoaded) return
  miGoogleLoaded = true
  var tag = document.createElement('script')
  tag.async = true
  tag.src = 'https://www.googletagmanager.com/gtag/js?id=__GA4_ID__'
  document.head.appendChild(tag)
}

function miPassArrived(pass) {
  miPass = pass
  try {
    sessionStorage.setItem(
      'mi_pass',
      JSON.stringify({ pass: pass, dies: Number(pass.split('.')[0]) })
    )
  } catch (e) {}
  miGoogle()
  miFlush()
}

// Ask Cloudflare whether a real browser is here.
//
// Nothing the page can measure works any more. The crawler that fills
// these reports runs a real browser on home internet lines in forty six
// countries, holds a page open for up to thirty eight seconds, and
// scrolls. From inside the page it is a reader. Turnstile looks at it
// from outside, where it is not.
//
// The reader never sees this and never clicks anything. It runs once per
// half hour, not once per page.
var miAsking = false
function miAskForPass() {
  if (miPass) {
    miGoogle()
    miFlush()
    return
  }
  if (miAsking) return
  miAsking = true
  // A site with no Turnstile widget yet asks nobody: no pass, so nothing is
  // ever sent, and no script is fetched from Cloudflare for a key that is not
  // there. The rows stay in the tab (capped) until the widget exists.
  if (!MI_SITEKEY) return

  var box = document.createElement('div')
  box.style.display = 'none'
  document.body.appendChild(box)

  window.miTurnstileReady = function () {
    try {
      window.turnstile.render(box, {
        sitekey: MI_SITEKEY,
        callback: function (ticket) {
          fetch(MI_PASS_PATH, {
            method: 'POST',
            body: JSON.stringify({ token: ticket }),
          })
            .then(function (answer) {
              return answer.ok ? answer.json() : null
            })
            .then(function (given) {
              if (given && given.pass) miPassArrived(given.pass)
            })
            .catch(function () {})
        },
      })
    } catch (e) {}
  }

  var loader = document.createElement('script')
  loader.async = true
  loader.src = MI_TURNSTILE
  document.head.appendChild(loader)
}

// A queue left over from an abandoned tab goes out on the next page.
if (miQueue.length >= MI_QUEUE_MAX) miFlush()

mi({ name: 'page_view', kind: 'view', label: miTitle() })

// Every link that leaves the site is worth counting, because leaving is
// the whole job here: this site answers "where do I read, watch or buy
// this" and then hands the reader over. One listener on the document
// covers every page and every link, so no button has to be wired by hand
// and a new link can never ship untracked.
// GA4 accepts letters, digits and underscore in an event name, nothing
// else, and at most 40 characters.
function ga4Name(part) {
  return String(part || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

document.addEventListener('click', function (event) {
  var link = event.target.closest && event.target.closest('a[href]')
  if (!link) return

  var url
  try { url = new URL(link.href, location.href) } catch (e) { return }
  // One of ours: the queue travels to the next page instead of being
  // sent, so a three page visit still costs one request.
  if (url.hostname === location.hostname) {
    miGoingInternal = true
    setTimeout(function () { miGoingInternal = false }, 2000)
    return
  }

  // Each link says for itself what it is, because the component that
  // built it is the only thing that knows. rel="sponsored" cannot be
  // used for this: the official read and watch links carry that same rel,
  // so reading rel filed every free link as a sale link.
  var kind = link.getAttribute('data-aff') // books, discs, figures, ...
  var go = link.getAttribute('data-go') // read or watch
  var site = link.getAttribute('data-platform') // WEBTOON, Netflix, ...

  // The name alone says what the click was, so a report needs no filter:
  // affiliate_amazon_books, read_webtoon, watch_crunchyroll. The set is
  // bounded by five shop kinds and 48 platforms, about a hundred names in
  // total, so it can never grow into GA4's ceiling of 500.
  var name = 'outbound_other'
  if (kind) name = 'affiliate_amazon_' + ga4Name(kind)
  else if (go && site) name = ga4Name(go) + '_' + ga4Name(site)

  var label = link.querySelector('.buy__label')

  gtag('event', name.slice(0, 40), {
    // The same facts again as parameters, so every click can also be read
    // as one group: all buying, or one platform across both verbs.
    click_type: kind ? 'buy' : go || 'other',
    shop_kind: kind || '',
    platform: site || (kind ? 'Amazon' : url.hostname),
    // The first part of the path is the page kind: manhwa, manga, anime,
    // character, shop. It answers "which pages actually earn".
    page_type: location.pathname.split('/')[1] || 'home',
    link_domain: url.hostname,
    link_url: url.href,
    link_label: (label ? label.textContent : link.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100),
    page_path: location.pathname,
  })

  // The same click, in our own database, under the same name.
  mi({
    name: name.slice(0, 40),
    kind: kind ? 'buy' : go || 'other',
    label: (label ? label.textContent : link.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120),
    platform: site || (kind ? 'Amazon' : url.hostname),
    shop_kind: kind || '',
    target: url.href,
    dwell: miVisible(),
    // Where an Amazon link sat: pick, buybox, shop or themes. It says
    // which of the four places earns, which the kind alone cannot.
    detail: kind ? link.getAttribute('data-aff-src') || '' : '',
  })
})
