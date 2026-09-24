/**
 * The robots.txt policy every site shares, and the dev-host answer.
 *
 * The policy is written once, here: the search engines and AI answer engines
 * that send readers may read everything, the crawlers that only take (SEO
 * databases, model trainers) are shut out, and anything unnamed reads slowly.
 * src/pages/robots.txt.js serves it with the site's own Sitemap line, and the
 * Worker (src/worker.js) turns the shut-out crawlers away with a 403 on a
 * Workers dev host, where no firewall stands in front of it.
 */

export const ROBOTS_POLICY = `# The search engines that actually send readers. They get everything.
User-agent: Googlebot
Allow: /

User-agent: Googlebot-Image
Allow: /

User-agent: GoogleOther
Allow: /

User-agent: Bingbot
Allow: /

# Yandex gets its own group on purpose. Without one it falls into the
# catch-all group at the bottom and inherits its Crawl-delay. Yandex is a
# search engine that sends readers, so it is never rate limited here.
User-agent: Yandex
Allow: /

User-agent: DuckDuckBot
Allow: /

User-agent: Applebot
Allow: /

# The AI answer engines that SHOW A LINK. These send readers. They are not
# the same as the training crawlers below, which take the words and give
# nothing back.
User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: Claude-User
Allow: /

User-agent: MistralAI-User
Allow: /

User-agent: Google-Extended
Allow: /

# Blocked, and why.
#
# This site is ~104,000 pages on a free plan with 100,000 requests a day. A
# crawler that walks the whole catalogue once uses the entire day's budget and
# the site then fails for real readers. On 14 Sep 2026 that happened: GPTBot
# took 50,135 requests, AhrefsBot 29,880 and YandexBot 9,243, while humans took
# a few hundred. So the rule is simple: a crawler that cannot send a reader is
# not worth a page view.
#
# None of these sell anything here. AhrefsBot, SemrushBot, DataForSeoBot and
# MJ12bot build databases for other people's SEO tools. GPTBot, CCBot,
# Bytespider, ClaudeBot and the rest train models. Petal serves
# an audience this English catalogue does not have.
# ShapBot is Parallel.ai. It feeds AI agents and data APIs, not a search
# engine, so it sends no readers. On 20 Sep 2026 it took 1,927 requests in
# 30 minutes, about three of every four Worker requests.
User-agent: ShapBot
Disallow: /

User-agent: GPTBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Claude-Web
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: Amazonbot
Disallow: /

User-agent: meta-externalagent
Disallow: /

User-agent: FacebookBot
Disallow: /

User-agent: AhrefsBot
Disallow: /

User-agent: SemrushBot
Disallow: /

User-agent: DataForSeoBot
Disallow: /

User-agent: MJ12bot
Disallow: /

User-agent: DotBot
Disallow: /

User-agent: BLEXBot
Disallow: /

User-agent: PetalBot
Disallow: /

User-agent: SeekportBot
Disallow: /

User-agent: ImagesiftBot
Disallow: /

User-agent: Timpibot
Disallow: /

User-agent: Omgilibot
Disallow: /

# Anything not named above may read, but slowly. One page every ten seconds
# still crawls 8,600 pages a day, which is more than enough for a catalogue
# that changes once a day.
User-agent: *
Allow: /
Crawl-delay: 10

`

/** A dev host is never crawled: its robots.txt says so to everyone. */
export const DEV_ROBOTS = 'User-agent: *\nDisallow: /\n'

/** The policy with this site's sitemap. */
export function robotsTxt(siteUrl) {
  return `${ROBOTS_POLICY}Sitemap: ${siteUrl}/sitemap.xml\n`
}

/**
 * Every user agent the policy shuts out completely, lower case. Read from the
 * policy itself, so the 403 list and robots.txt can never disagree.
 */
export const BLOCKED_AGENTS = (() => {
  const blocked = []
  let group = []
  let open = false
  for (const line of ROBOTS_POLICY.split('\n')) {
    const at = line.indexOf(':')
    if (line.startsWith('#') || at < 0) continue
    const field = line.slice(0, at).trim().toLowerCase()
    const value = line.slice(at + 1).trim()
    if (field === 'user-agent') {
      // A user-agent line after a rule starts a new group.
      if (!open) group = []
      group.push(value.toLowerCase())
      open = true
      continue
    }
    open = false
    if (field === 'disallow' && value === '/') blocked.push(...group.filter((agent) => agent !== '*'))
  }
  return blocked
})()

/** True when a user agent string names one of the shut-out crawlers. */
export function isBlockedAgent(userAgent) {
  const agent = String(userAgent || '').toLowerCase()
  return BLOCKED_AGENTS.some((name) => agent.includes(name))
}
