/**
 * Reel "Coming next week": the premieres of the "Coming next week" post
 * (next-week.mjs), one show per slide in day order.
 *
 * Data, wording and hashtags are that post's own; a show whose cover is a
 * blank placeholder is left out the same way. Off until its name is written
 * in FB_POST_TYPES.
 */
import { BIO_END_LINE, CAROUSEL_FRAME, END_LINE, endSlide, hookSlide, itemSlide, titleSlide } from '../reel/slides.mjs'
import nextWeek from './next-week.mjs'

const toReel = (post) => ({
  ...post,
  view: { range: post.view.range, total: post.view.total, items: post.view.rows },
  without: (blank) => {
    const rest = post.without(blank)
    return rest ? toReel(rest) : null
  },
})

const find = (data, ctx) => nextWeek.find(data, ctx).map(toReel)

function slides(v, k) {
  return [
    titleSlide(k, { kicker: 'New anime', lines: [{ text: 'COMING' }, { text: 'NEXT WEEK', pop: true }], sub: `First episodes from ${v.range}. Times are US Eastern.` }),
    ...v.items.map((row, i) => itemSlide(k, { tag: row.day.toUpperCase(), tagNote: row.date, picture: v.art.thumbs[i], title: row.title, note: row.note, step: `${i + 1} / ${v.items.length}` })),
    endSlide(k, { head: 'Dates and where to watch', line: END_LINE }),
  ]
}

/** The same week as an Instagram swipe post: the covers that are coming, then one show per slide. */
function carousel(v, k) {
  const f = CAROUSEL_FRAME
  return [
    hookSlide(k, { kicker: 'New anime', lines: [{ text: 'COMING' }, { text: 'NEXT WEEK', pop: true }], sub: `${v.items.length} first episodes from ${v.range}.`, pictures: v.art.thumbs.slice(0, 3) }, f),
    ...v.items.map((row, i) => itemSlide(k, { tag: row.day.toUpperCase(), tagNote: row.date, picture: v.art.thumbs[i], title: row.title, note: row.note, step: `${i + 1} / ${v.items.length}` }, f)),
    endSlide(k, { head: 'Save this list. Follow for more.', line: BIO_END_LINE }, f),
  ]
}

export default { key: 'reel-next-week', carouselOf: 'next-week', fromPost: toReel, carousel, name: 'Reel: coming next week', reel: true, urgent: false, gapDays: 300, titleGap: false, window: 1, find, captions: nextWeek.captions, questions: nextWeek.questions, tags: (p) => p.tags, slides }
