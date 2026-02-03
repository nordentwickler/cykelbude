// Minimales barrierefreies Navigationsmenü
document.addEventListener('DOMContentLoaded', () => {
    const toggleButton = document.getElementById('menu-toggle')
    const closeButton = document.getElementById('menu-close')
    const nav = document.getElementById('mobile-navigation')

    if (!toggleButton || !closeButton || !nav) return

    const focusableElements = 'a[href], button:not([disabled])'
    let firstFocusable, lastFocusable

    const openMenu = () => {
        nav.classList.remove('opacity-0', 'pointer-events-none')
        nav.classList.add('opacity-100', 'pointer-events-auto')
        nav.setAttribute('aria-hidden', 'false')
        toggleButton.setAttribute('aria-expanded', 'true')
        toggleButton.setAttribute('aria-label', 'Menü schließen')

        // Focus auf Close-Button setzen
        closeButton.focus()

        // Alle fokussierbaren Elemente im Menü finden
        const focusables = nav.querySelectorAll(focusableElements)
        firstFocusable = focusables[0]
        lastFocusable = focusables[focusables.length - 1]
    }

    const closeMenu = () => {
        nav.classList.add('opacity-0', 'pointer-events-none')
        nav.classList.remove('opacity-100', 'pointer-events-auto')
        nav.setAttribute('aria-hidden', 'true')
        toggleButton.setAttribute('aria-expanded', 'false')
        toggleButton.setAttribute('aria-label', 'Menü öffnen')

        // Focus zurück zum Toggle-Button
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

        // ESC zum Schließen
        if (e.key === 'Escape') {
            closeMenu()
        }
    }

    toggleButton.addEventListener('click', openMenu)
    closeButton.addEventListener('click', closeMenu)
    document.addEventListener('keydown', trapFocus)
})
