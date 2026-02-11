document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-hero-slideshow]').forEach((container) => {
        const images = container.querySelectorAll('img');
        if (images.length <= 1) return;

        let current = 0;

        setInterval(() => {
            images[current].classList.replace('z-10', 'z-0');
            current = (current + 1) % images.length;
            images[current].classList.replace('z-0', 'z-10');
        }, 800);
    });
});
