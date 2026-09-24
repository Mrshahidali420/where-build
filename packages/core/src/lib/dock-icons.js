// The icons of the phone bar at the foot of every page (src/layouts/Base.astro).
// A site's config picks its links and names one of these for each. Drawn on a
// 24 x 24 grid, stroked by the CSS.
export const DOCK_ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"></path><path d="M5 9.5V21h14V9.5"></path>',
  read: '<path d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4z"></path><path d="M20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z"></path>',
  watch: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m10 9 5 3-5 3z"></path>',
  grid:
    '<rect x="4" y="4" width="7" height="7" rx="1"></rect><rect x="13" y="4" width="7" height="7" rx="1"></rect>' +
    '<rect x="4" y="13" width="7" height="7" rx="1"></rect><rect x="13" y="13" width="7" height="7" rx="1"></rect>',
  shop: '<path d="M6 7h12l1 13H5z"></path><path d="M9 10V6a3 3 0 0 1 6 0v4"></path>',
  search: '<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.6-3.6"></path>',
}
