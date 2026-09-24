/**
 * What each platform actually asks of a reader. This is the data behind the
 * comparison table on every title page.
 *
 * Why it lives here and not in the catalog: these facts belong to the
 * PLATFORM, not to the title. A title added tomorrow that links to WEBTOON
 * gets the WEBTOON row with no extra work from anyone.
 *
 * Rules for anything added here:
 *   1. Only state what the platform's own model makes true. No guessing.
 *   2. No dollar figures. Prices change and we cannot re-check 48 platforms.
 *      "How you pay" stays true for years; "$4.99" does not.
 *   3. Keep every string short. Most of this is read on a phone.
 *
 * Fields:
 *   pay     how money changes hands
 *   free    what a reader gets without paying
 *   region  where the service works
 *   account whether you must sign in to read or watch
 */

export const PAY = {
  ADS: 'Free with ads',
  COINS: 'Coins per chapter',
  BUY: 'Buy each chapter',
  SUB: 'Monthly plan',
  SUB_FREE: 'Free tier, or monthly plan',
  PRINT: 'Buy the book',
  LIBRARY: 'Free with a library card',
}

export const FREE = {
  ALL: 'All of it',
  MOST: 'Most of it',
  EARLY: 'All but the newest',
  SOME: 'The first chapters',
  SOME_EP: 'The first episodes',
  TIMER: 'One chapter on a timer',
  TRIAL: 'A trial only',
  NONE: 'None',
}

const WORLD = 'Worldwide'
const KR = 'Korea'
const JP = 'Japan'
const CN = 'China'
const SOME = 'Some countries'
const US = 'US and Canada'

const f = (pay, free, region, account) => ({ pay, free, region, account })

export const FACTS = {
  /* ------------------------------------------------------------- comics */
  'WEBTOON': f(PAY.ADS, FREE.EARLY, WORLD, false),
  'Naver Webtoon': f(PAY.ADS, FREE.EARLY, KR, false),
  'Naver Series': f(PAY.COINS, FREE.SOME, KR, true),
  'Kakao Webtoon': f(PAY.COINS, FREE.TIMER, KR, true),
  'KakaoPage': f(PAY.COINS, FREE.TIMER, KR, true),
  'Tapas': f(PAY.COINS, FREE.EARLY, WORLD, false),
  'Tappytoon': f(PAY.COINS, FREE.SOME, WORLD, true),
  'Lezhin': f(PAY.COINS, FREE.SOME, WORLD, true),
  'Piccoma': f(PAY.COINS, FREE.TIMER, JP, true),
  'Manta': f(PAY.SUB, FREE.TRIAL, WORLD, true),
  'Comikey': f(PAY.COINS, FREE.TIMER, WORLD, false),
  'INKR': f(PAY.SUB_FREE, FREE.SOME, WORLD, true),
  'MANGA Plus': f(PAY.ADS, FREE.EARLY, WORLD, false),
  'Manga Plus': f(PAY.ADS, FREE.EARLY, WORLD, false),
  'VIZ': f(PAY.SUB_FREE, FREE.SOME, US, true),
  'Yen Press': f(PAY.PRINT, FREE.NONE, WORLD, false),
  'Seven Seas Entertainment': f(PAY.PRINT, FREE.NONE, WORLD, false),
  'Kodansha': f(PAY.PRINT, FREE.NONE, WORLD, false),
  'Azuki': f(PAY.SUB_FREE, FREE.SOME, WORLD, true),
  'Coolmic': f(PAY.BUY, FREE.SOME, WORLD, true),
  'WebComics': f(PAY.COINS, FREE.TIMER, WORLD, false),
  'Bomtoon': f(PAY.COINS, FREE.SOME, KR, true),
  'Lalatoon': f(PAY.COINS, FREE.SOME, KR, true),
  'Toomics': f(PAY.SUB, FREE.SOME, WORLD, true),
  'Webnovel': f(PAY.COINS, FREE.EARLY, WORLD, false),
  'Pocket Comics': f(PAY.COINS, FREE.TIMER, WORLD, true),
  'NETCOMICS': f(PAY.BUY, FREE.SOME, WORLD, true),
  'Bilibili Comics': f(PAY.COINS, FREE.TIMER, WORLD, false),
  'KuaiKan Manhua': f(PAY.COINS, FREE.TIMER, CN, true),
  'Tencent Comics': f(PAY.COINS, FREE.TIMER, CN, true),
  'Dongman Manhua': f(PAY.COINS, FREE.TIMER, CN, true),
  'ONO': f(PAY.COINS, FREE.TIMER, CN, true),

  /* ---------------------------------------------------------- streaming */
  'Crunchyroll': f(PAY.SUB_FREE, FREE.SOME_EP, WORLD, true),
  'Netflix': f(PAY.SUB, FREE.NONE, WORLD, true),
  'Hulu': f(PAY.SUB, FREE.NONE, US, true),
  'Amazon Prime Video': f(PAY.SUB, FREE.NONE, WORLD, true),
  'Disney Plus': f(PAY.SUB, FREE.NONE, WORLD, true),
  'HIDIVE': f(PAY.SUB, FREE.NONE, SOME, true),
  'Max': f(PAY.SUB, FREE.NONE, SOME, true),
  'YouTube': f(PAY.ADS, FREE.ALL, WORLD, false),
  'Bilibili TV': f(PAY.SUB_FREE, FREE.MOST, SOME, false),
  'Bilibili': f(PAY.SUB_FREE, FREE.MOST, SOME, false),
  'Tubi TV': f(PAY.ADS, FREE.ALL, US, false),
  'Adult Swim': f(PAY.ADS, FREE.SOME_EP, US, false),
  'iQ': f(PAY.SUB_FREE, FREE.MOST, SOME, false),
  'WeTV': f(PAY.SUB_FREE, FREE.MOST, SOME, false),
  'Hoopla': f(PAY.LIBRARY, FREE.ALL, US, true),
  'Star+': f(PAY.SUB, FREE.NONE, SOME, true),
}

// A platform we have no row for. Say nothing rather than guess.
export const UNKNOWN = { pay: null, free: null, region: null, account: null }

export const factsFor = (site) => FACTS[site] || UNKNOWN
