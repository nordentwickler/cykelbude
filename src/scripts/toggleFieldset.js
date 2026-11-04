// An input with data-toggles="<id>" shows and enables the element with that id
// while it's checked, and hides and disables it otherwise. A disabled fieldset
// skips browser validation and isn't submitted, so its required fields only
// apply while it's visible.
//
// Works for a checkbox and for one option of a radio group. Selecting another
// option of the group unchecks the toggling radio without firing a change event
// on it, so the whole group is re-evaluated on every change.
//
// Delegated on document, because Vue mounts on #app and replaces the DOM nodes
// that existed before it.
document.addEventListener('change', (event) => {
    const input = event.target
    if (!(input instanceof HTMLInputElement)) {
        return
    }

    const group = input.type === 'radio' && input.form
        ? input.form.querySelectorAll(`input[type="radio"][name="${CSS.escape(input.name)}"]`)
        : [input]

    for (const option of group) {
        const target = option.dataset.toggles && document.getElementById(option.dataset.toggles)
        if (!target) {
            continue
        }

        target.hidden = !option.checked
        target.disabled = !option.checked
    }

    // Elements with data-when="<radio name>" data-is="<value>" are only visible
    // while that value is selected. data-is="" stands for nothing selected yet.
    if (input.type === 'radio' && input.form) {
        const selected = input.form.querySelector(`input[type="radio"][name="${CSS.escape(input.name)}"]:checked`)
        for (const element of input.form.querySelectorAll(`[data-when="${CSS.escape(input.name)}"]`)) {
            element.hidden = element.dataset.is !== (selected?.value ?? '')
        }
    }
})
