// The dictionary's mark plays: dgPlayMark(svg) restarts its animation (dg.css, .dg-play).
// A click on the logo goes home, which reloads the page, so the click leaves a note (sessionStorage) and the page it lands on plays
// the header mark once it has loaded; the start screen's big mark plays on every load by itself.
(function () {
    var KEY = 'dgLogoPlay';

    window.dgPlayMark = function (svg) {
        if (!svg) return;
        svg.classList.remove('dg-play');
        void svg.getBoundingClientRect();   // the browser must see the class gone, or adding it back does not restart the animation
        svg.classList.add('dg-play');
    };

    // Called by the logo's click handler (extra.js): plays now, and again after the reload if there is one.
    window.dgMarkClicked = function (willReload) {
        dgPlayMark(document.getElementById('header-image'));
        dgPlayMark(document.querySelector('.start-mark'));
        if (willReload) { try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* the mark just stays still */ } }
    };

    document.addEventListener('DOMContentLoaded', function () {
        var note = null;
        try { note = sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY); } catch (e) { /* no storage */ }
        if (note) dgPlayMark(document.getElementById('header-image'));
    });
})();
