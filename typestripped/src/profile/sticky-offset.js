/**
 Keeps the sticky table headers on the profile page (see profile.css) just below the navbar, whatever its height:
 it grows when its links wrap on narrower screens, and can be taller or shorter in other themes. The offset is
 measured from the navbar and set as the --profile-sticky-top custom property, which profile.css gives a starting
 value for until this runs.

 The navbar only needs to be cleared when it is fixed to the top of the page; otherwise it scrolls away.
 */
const NAVBAR_SELECTOR = '#main-navbar';
const OFFSET_PROPERTY = '--profile-sticky-top';
/**
 Sets the offset to the navbar's current height, or 0 if it isn't fixed to the top.
 */
export function updateStickyOffset() {
    const navbar = document.querySelector(NAVBAR_SELECTOR);
    const offset = navbar?.classList.contains('fixed-top') ? navbar.getBoundingClientRect().height : 0;
    document.documentElement.style.setProperty(OFFSET_PROPERTY, `${offset}px`);
}
/**
 Updates the offset now, and whenever the navbar is resized or has its classes changed. Does nothing on pages
 without sticky tables.
 */
export function initStickyOffset() {
    const navbar = document.querySelector(NAVBAR_SELECTOR);
    if (!navbar || !document.querySelector('.sticky-header')) {
        return;
    }
    updateStickyOffset();
    if (typeof ResizeObserver !== 'undefined') {
        // The border box, since the navbar's full height is what matters, padding included
        new ResizeObserver(() => {
            updateStickyOffset();
        }).observe(navbar, { box: 'border-box' });
    }
    new MutationObserver(() => {
        updateStickyOffset();
    }).observe(navbar, { attributes: true, attributeFilter: ['class'] });
}
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStickyOffset, { once: true });
    }
    else {
        initStickyOffset();
    }
}
//# sourceMappingURL=sticky-offset.js.map