// Minimales barrierefreies Push-Navigationsmenü
document.addEventListener('DOMContentLoaded', () => {
    const toggleButton = document.getElementById('menu-toggle')
    const closeButton = document.getElementById('menu-close')
    const nav = document.getElementById('mobile-navigation')
    const siteContent = document.getElementById('site-content')

    if (!toggleButton || !closeButton || !nav || !siteContent) return

    const focusableElements = 'a[href], button:not([disabled])'
    let firstFocusable, lastFocusable

    // Overlay für Abdunklung erstellen
    const overlay = document.createElement('div')
    overlay.className = 'fixed inset-0 bg-black/50 z-40 opacity-0 pointer-events-none transition-opacity duration-300'
    siteContent.parentElement.appendChild(overlay)

    const openMenu = () => {
        siteContent.classList.add('-translate-x-72', 'md:-translate-x-80', 'lg:-translate-x-96')
        nav.classList.remove('translate-x-full')
        nav.classList.add('translate-x-0')
        overlay.classList.remove('opacity-0', 'pointer-events-none')
        overlay.classList.add('opacity-100', 'pointer-events-auto')

        nav.setAttribute('aria-hidden', 'false')
        toggleButton.setAttribute('aria-expanded', 'true')
        toggleButton.setAttribute('aria-label', 'Menü schließen')

        closeButton.focus()

        const focusables = nav.querySelectorAll(focusableElements)
        firstFocusable = focusables[0]
        lastFocusable = focusables[focusables.length - 1]
    }

    const closeMenu = () => {
        siteContent.classList.remove('-translate-x-72', 'md:-translate-x-80', 'lg:-translate-x-96')
        nav.classList.add('translate-x-full')
        nav.classList.remove('translate-x-0')
        overlay.classList.add('opacity-0', 'pointer-events-none')
        overlay.classList.remove('opacity-100', 'pointer-events-auto')

        nav.setAttribute('aria-hidden', 'true')
        toggleButton.setAttribute('aria-expanded', 'false')
        toggleButton.setAttribute('aria-label', 'Menü öffnen')

        toggleButton.focus()
    }

    // Focus Trap im geöffneten Menü
    const trapFocus = (e) => {
        if (nav.getAttribute('aria-hidden') === 'true') return

        if (e.key === 'Tab') {
            if (e.shiftKey) {
                if (document.activeElement === firstFocusable) {
                    e.preventDefault()
                    lastFocusable.focus()
                }
            } else {
                if (document.activeElement === lastFocusable) {
                    e.preventDefault()
                    firstFocusable.focus()
                }
            }
        }

        if (e.key === 'Escape') {
            closeMenu()
        }
    }

    // Klick auf abgedunkelten Bereich schließt das Menü
    overlay.addEventListener('click', closeMenu)

    toggleButton.addEventListener('click', openMenu)
    closeButton.addEventListener('click', closeMenu)
    document.addEventListener('keydown', trapFocus)
})
