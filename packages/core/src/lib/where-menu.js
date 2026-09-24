// The phone menu of a Where page (src/layouts/Where.astro). The button opens
// the menu as a sheet under the header that scrolls inside the screen, so the
// last link is always reachable however short the phone; the page behind it
// stays put. Escape, the button, or a click outside closes it.
const button = document.querySelector('.menu-btn')
const menu = document.getElementById('site-menu')
const header = document.querySelector('.top')

function setOpen(open) {
  if (open) {
    // The sheet starts where the header ends, whatever the header's height.
    document.documentElement.style.setProperty('--menu-top', `${Math.max(0, Math.round(header.getBoundingClientRect().bottom))}px`)
  }
  document.documentElement.classList.toggle('menu-open', open)
  button.setAttribute('aria-expanded', String(open))
  button.querySelector('.menu-btn__label').textContent = open ? 'Close' : 'Menu'
}

if (button && menu && header) {
  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'))
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
      setOpen(false)
      button.focus()
    }
  })
  menu.addEventListener('click', (event) => {
    if (event.target === menu) setOpen(false)
  })
  // Growing the window past the phone layout leaves no sheet behind.
  matchMedia('(min-width: 861px)').addEventListener('change', (event) => {
    if (event.matches) setOpen(false)
  })
}
