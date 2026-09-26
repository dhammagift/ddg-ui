// The dictionary's mark plays: dgPlayMark(svg) restarts its animation (dg.css, .dg-play). The header mark and the start screen's
// big mark are independent: a click on one plays that one only. The big one also plays by itself as the start screen loads.
(function () {
    var KEY = 'dgLogoPlay';

    window.dgPlayMark = function (svg) {
        if (!svg) return;
        svg.classList.remove('dg-play');
        void svg.getBoundingClientRect();   // the browser must see the class gone, or adding it back does not restart the animation
        svg.classList.add('dg-play');
    };

    // A click on the header logo goes home, which reloads the page: the click leaves a note (sessionStorage), and the page it lands
    // on plays the header mark — and only that one, so the big mark is left still that time.
    window.dgHeaderMarkClicked = function (willReload) {
        dgPlayMark(document.getElementById('header-image'));
        if (willReload) { try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* the mark just stays still */ } }
    };

    // This script sits at the end of <body>, before the first paint: the note is read at once so the big mark can be stilled in time.
    var note = null;
    try { note = sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY); } catch (e) { /* no storage */ }
    if (note) {
        var big = document.querySelector('.start-mark');
        if (big) big.classList.remove('dg-play');
        dgPlayMark(document.getElementById('header-image'));
    }

    // The big mark plays when it is clicked, too.
    var start = document.querySelector('.start-mark');
    if (start) start.addEventListener('click', function () { dgPlayMark(start); });
})();
