/**
 * Reel "Top 5 most anticipated": the ranking of the "Most anticipated" post
 * (anticipated.mjs) as a countdown, five to one, one cover per slide.
 *
 * Data, wording and hashtags are that post's own. Off until its name is
 * written in FB_POST_TYPES.
 */
import { BIO_END_LINE, CAROUSEL_FRAME, END_LINE, endSlide, hookSlide, itemSlide, titleSlide } from '../reel/slides.mjs'
import anticipated from './anticipated.mjs'

/** The same post, told from five to one: the pictures follow the items. */
const toReel = (post) => ({
  ...post,
  art: { thumbs: [post.art.hero, ...post.art.thumbs].reverse() },
  view: { heading: post.view.heading, items: [...post.view.rows].reverse() },
})

const find = (data, ctx) => anticipated.find(data, ctx).map(toReel)

function slides(v, k) {
  return [
    titleSlide(k, { kicker: v.heading, lines: [{ text: 'TOP 5', pop: true }, { text: 'MOST' }, { text: 'ANTICIPATED' }], sub: 'Ranked by the AniList users who plan to watch.' }),
    ...v.items.map((row, i) => itemSlide(k, { tag: `#${row.rank}`, picture: v.art.thumbs[i], title: row.title, note: `${row.count} plan to watch`, step: `${i + 1} / ${v.items.length}` })),
    endSlide(k, { head: 'Dates and where to watch', line: END_LINE }),
  ]
}

/** The same countdown as an Instagram swipe post: the hook shows the lower ranks, never number one. */
function carousel(v, k) {
  const f = CAROUSEL_FRAME
  return [
    hookSlide(k, { kicker: v.heading, lines: [{ text: 'TOP 5', pop: true }, { text: 'MOST' }, { text: 'ANTICIPATED' }], sub: 'Number one is on the last slide.', pictures: v.art.thumbs.slice(0, 3) }, f),
    ...v.items.map((row, i) => itemSlide(k, { tag: `#${row.rank}`, picture: v.art.thumbs[i], title: row.title, note: `${row.count} plan to watch`, step: `${i + 1} / ${v.items.length}` }, f)),
    endSlide(k, { head: 'Save this list. Follow for more.', line: BIO_END_LINE }, f),
  ]
}

export default { key: 'reel-anticipated', carouselOf: 'anticipated', fromPost: toReel, carousel, name: 'Reel: top 5 most anticipated', reel: true, urgent: false, gapDays: 21, titleGap: false, window: 1, find, captions: anticipated.captions, questions: anticipated.questions, tags: (p) => p.tags, slides }
