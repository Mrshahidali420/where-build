// The platform table. It lives on its own so the build scripts can read it
// without pulling in format.js, which imports JSON that plain Node refuses.
// Nothing here loads the catalog, so the Worker can import it too.
/**
 * Brand marks for every platform we link to.
 * The colour IS the data on this site: a reader scanning a grid should
 * recognise "that one is on WEBTOON" without reading a word. Keep these
 * accurate to each brand, never invented.
 */
export const PLATFORMS = {
  'WEBTOON': { color: '#00D564', note: 'Free, ad-supported' },
  'Naver Webtoon': { color: '#00DC64', note: 'Korean' },
  'Naver Series': { color: '#00C73C', note: 'Korean' },
  'Kakao Webtoon': { color: '#FF365E', note: 'Korean' },
  'KakaoPage': { color: '#FFCC00', note: 'Korean' },
  'Tapas': { color: '#F03C00', note: 'Free with coins' },
  'Tappytoon': { color: '#FF4F6E', note: 'Paid chapters' },
  'Lezhin': { color: '#E5133B', note: 'Paid chapters' },
  'Piccoma': { color: '#FF5C8D', note: 'Japanese' },
  'Manta': { color: '#FF3D00', note: 'Subscription' },
  'Comikey': { color: '#00A9E0', note: 'Free with timer' },
  'INKR': { color: '#FF5722', note: 'Subscription' },
  'MANGA Plus': { color: '#D80000', note: 'Free, official' },
  'Manga Plus': { color: '#D80000', note: 'Free, official' },
  'VIZ': { color: '#0E9CFF', note: 'Subscription' },
  'Yen Press': { color: '#E8112D', note: 'Buy in print' },
  'Seven Seas Entertainment': { color: '#1BA0D7', note: 'Buy in print' },
  'Kodansha': { color: '#009A44', note: 'Buy in print' },
  'Azuki': { color: '#F5405E', note: 'Subscription' },
  'Coolmic': { color: '#00B0F0', note: 'Paid chapters' },
  'WebComics': { color: '#FFB300', note: 'Free with coins' },
  'Bomtoon': { color: '#FF6B00', note: 'Korean' },
  'Lalatoon': { color: '#FF8AB0', note: 'Korean' },
  'Toomics': { color: '#E4002B', note: 'Subscription' },
  'Webnovel': { color: '#E44D26', note: 'Free with coins' },
  'Pocket Comics': { color: '#7C4DFF', note: 'Paid chapters' },
  'NETCOMICS': { color: '#00AEEF', note: 'Paid chapters' },
  'Bilibili Comics': { color: '#00A1D6', note: 'Free with timer' },
  'KuaiKan Manhua': { color: '#FFC800', note: 'Chinese' },
  'Tencent Comics': { color: '#1AAD19', note: 'Chinese' },
  'Dongman Manhua': { color: '#FF7A45', note: 'Chinese' },
  'ONO': { color: '#4A90D9', note: 'Chinese' },

  // Streaming
  'Crunchyroll': { color: '#F47521', note: 'Free tier and premium' },
  'Netflix': { color: '#E50914', note: 'Subscription' },
  'Hulu': { color: '#1CE783', note: 'Subscription' },
  'Amazon Prime Video': { color: '#00A8E1', note: 'Subscription' },
  'Disney Plus': { color: '#0063E5', note: 'Subscription' },
  'HIDIVE': { color: '#00AEEF', note: 'Subscription' },
  'Max': { color: '#0046FF', note: 'Subscription' },
  'YouTube': { color: '#FF0000', note: 'Free, official channel' },
  'Bilibili TV': { color: '#00A1D6', note: 'Free tier' },
  'Bilibili': { color: '#00A1D6', note: 'Free tier' },
  'Tubi TV': { color: '#FBC02D', note: 'Free, ad-supported' },
  'Adult Swim': { color: '#00FF00', note: 'Free episodes' },
  'iQ': { color: '#00BE06', note: 'Free tier' },
  'WeTV': { color: '#FF5C00', note: 'Free tier' },
  'Hoopla': { color: '#0088CE', note: 'Free with library card' },
  'Star+': { color: '#1A1D29', note: 'Subscription' },
}

export const FALLBACK = { color: '#8C86A0', note: '' }

