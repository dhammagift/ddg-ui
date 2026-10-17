const c = console.log

//// elements

const docBody = document.body
const titleClear = document.getElementById("title-clear")
const mainPane = document.getElementById("main-pane");
const dpdPane = document.getElementById("dpd-pane");
const summaryResults = document.getElementById("summary-results");
const dpdResults = document.getElementById("dpd-results");
const historyPane = document.getElementById("history-pane");
const historyListPane = document.getElementById("history-list-pane");
const subTitle = document.getElementById("subtitle")
const searchBox = document.getElementById("search-box")
const entryBoxClass = document.getElementsByClassName("search-box")
const searchForm = document.getElementById("search-form");
const searchButton = document.getElementById("search-button");
const footerText = document.getElementById("footer");

const sansSerifToggle = document.getElementById("sans-serif-toggle");
const niggahitaToggle = document.getElementById("niggahita-toggle");
const grammarToggle = document.getElementById("grammar-toggle");
const exampleToggle = document.getElementById("example-toggle");
const oneButtonToggle = document.getElementById("one-button-toggle");
// const sbsexampleToggle = document.getElementById("sbs-example-toggle");
const summaryToggle = document.getElementById("summary-toggle");
const sandhiToggle = document.getElementById("sandhi-toggle");
const audioToggle = document.getElementById("audio-toggle");

var fontSize
const fontSizeUp = document.getElementById("font-size-up");
const fontSizeDown = document.getElementById("font-size-down");
var fontSizeDisplay = document.getElementById("font-size-display");


let dpdResultsContent = "";
let language;

//// uri utils

function getQueryVariable(variable) {
    // The word may live in the path (/dukkha) instead of ?q= (see dictUrl in extra.js).
    if (variable === 'q' && !new URLSearchParams(window.location.search).get('q') && window.dgPathWord) return window.dgPathWord;
    var query = window.location.search.substring(1);
    var vars = query.split('&');

    for (var i = 0; i < vars.length; i++) {
      var pair = vars[i].split('=');

      if (pair[0] === variable) {
        return decodeURIComponent(pair[1].replace(/\+/g, '%20'));
      }
    }
}

//// load state

function loadToggleState(id) {
    var savedState = localStorage.getItem(id);
    if (savedState !== null) {
        document.getElementById(id).checked = JSON.parse(savedState);
    }
}

//// Page load
document.addEventListener("DOMContentLoaded", function() {
    const htmlElement = document.documentElement;
    language = htmlElement.lang || 'en';

    loadToggleState("sans-serif-toggle");
    loadToggleState("niggahita-toggle");
    loadToggleState("grammar-toggle");
    loadToggleState("example-toggle");
    loadToggleState("one-button-toggle");
    // loadToggleState("sbs-example-toggle");
    loadToggleState("summary-toggle");
    loadToggleState("sandhi-toggle");
    loadToggleState("audio-toggle");

    loadFontSize();
    swopSansSerif();

    // The input carries the HTML `autofocus` attribute, which focuses it on desktop, but a WebView (the app)
    // ignores that attribute and the keyboard never comes up. Focus it in JS too, only on the empty start screen
    // (not while a word is already loading on the entry screen). iOS raises the keyboard natively; on Android the
    // WebView ignores a scripted focus, so the app exposes window.DgKeyboard.show() (MainActivity) to bring it up.
    var sb = document.getElementById("search-box");
    if (sb && document.body.dataset.screen === "start" && !sb.value) {
        try { sb.focus(); } catch (e) { /* focus can throw on a detached/hidden input */ }
        // Android only: nudge the soft keyboard up (no-op on the web and on iOS, where DgKeyboard is undefined).
        try { if (window.DgKeyboard && window.DgKeyboard.show) window.DgKeyboard.show(); } catch (e) { /* ignore */ }
    }
});

//// listeners

//// back button

// An entry without a word ("/" — the page the reader started on) goes back to the start screen;
// it used to keep the last word on screen under the bare address.
window.onpopstate = function(e) {
    const q = (e.state && e.state.q) || (typeof currentDictWord === 'function' ? currentDictWord() : null);
    if (q) {
        searchBox.value = q;
        window.handleClientSearch(q, { fromHistory: true });
    } else if (typeof window.dgShowStart === 'function') {
        window.dgShowStart();
    }
};



//// font size ////

const BASE_FONT_SIZE = 15; // matches body{font-size} in dg.css

function loadFontSize() {
    fontSize = localStorage.getItem("fontSize");
    // No saved choice: 110%, not 100% (dg-apps#38/#39 — "сделать в приложении по умолчанию 110% от
    // текущих 100%, но чтобы шторки и другие элементы окна не поехали"). Anyone who already picked a
    // size (including 100% on purpose) keeps it; this only moves the untouched default.
    if (fontSize === null) fontSize = BASE_FONT_SIZE * 1.1;
    setFontSize()
}

function saveFontSize() {
    localStorage.setItem("fontSize", fontSize);
}

// Font size is page zoom, the way dhamma.gift scales (search/js/home.js applyUiScale): dg.css sets
// its sizes in px, so body{font-size} alone changed nothing visible (owner: +/− did nothing).
// fontSize stays "px of BASE_FONT_SIZE" so saved values and the Alt+−/=/0 hotkeys (extra.js) keep
// working; steps of 10%, 70–150%. --dg-zoom lets vw-based widths in dg.css undo the zoom.
const CAN_ZOOM = !!(window.CSS && CSS.supports && CSS.supports('zoom', '1.5'));
function fontScale() {
    return Math.min(1.5, Math.max(0.7, Math.round(parseFloat(fontSize) / BASE_FONT_SIZE * 10) / 10 || 1));
}

function setFontSize() {
    const scale = fontScale();
    const root = document.documentElement;
    // No zoom (Safari < 17, Firefox < 126): the old body font-size, better than a dead button.
    document.body.style.fontSize = CAN_ZOOM ? '' : BASE_FONT_SIZE * scale + 'px';
    root.style.zoom = CAN_ZOOM ? scale : '';
    root.style.setProperty('--dg-zoom', CAN_ZOOM ? scale : 1);
    fontSizeDisplay.innerHTML = `${Math.round(scale * 100)}%`
}

fontSizeUp.addEventListener("click", increaseFontSize)
fontSizeDown.addEventListener("click", decreaseFontSize)

function increaseFontSize() {
    fontSize = BASE_FONT_SIZE * Math.min(1.5, fontScale() + 0.1)
    setFontSize()
    saveFontSize()
}

function decreaseFontSize() {
    fontSize = BASE_FONT_SIZE * Math.max(0.7, fontScale() - 0.1)
    setFontSize()
    saveFontSize()
}








//// save settings on toggle

sansSerifToggle.addEventListener("change", saveToggleState);
niggahitaToggle.addEventListener("change", saveToggleState);
grammarToggle.addEventListener("change", saveToggleState);
exampleToggle.addEventListener("change", saveToggleState);
oneButtonToggle.addEventListener("change", saveToggleState);
// sbsexampleToggle.addEventListener("change", saveToggleState);
summaryToggle.addEventListener("change", saveToggleState);
sandhiToggle.addEventListener("change", saveToggleState);
audioToggle.addEventListener("change", saveToggleState);


function saveToggleState(event) {
    localStorage.setItem(event.target.id, event.target.checked);
}

//// theme: dgSetTheme() in extra.js (dark / light / auto)


//// toggle sans / serif

sansSerifToggle.addEventListener("change", function() {
    swopSansSerif()
});

function swopSansSerif() {
    const serifFonts = '"Source Serif 4", "Noto Serif", "Georgia", serif';
    const sansFonts = '"Lato", "Noto Sans", "Helvetica Neue", Arial, sans-serif';
    if (sansSerifToggle.checked) {
        document.body.style.fontFamily = serifFonts;
        searchBox.style.fontFamily = serifFonts
        searchButton.style.fontFamily = serifFonts
    } else {
        document.body.style.fontFamily = sansFonts;
        searchBox.style.fontFamily = sansFonts
        searchButton.style.fontFamily = sansFonts
    }

} 


//// niggahita

// Text nodes of the DPD entry and summary only: innerHTML over the whole pane reloaded every
// dictionary iframe on each switch, and new results never got the setting at all.
function setNiggahita(up) {
    const from = up ? "ṃ" : "ṁ", to = up ? "ṁ" : "ṃ";
    for (const root of [summaryResults, dpdResults]) {
        if (!root) continue;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n; (n = walker.nextNode());) {
            if (n.nodeValue.includes(from)) n.nodeValue = n.nodeValue.split(from).join(to);
        }
    }
}
// extra.js calls this after each render
window.applyNiggahita = function() {
    if (niggahitaToggle.checked) setNiggahita(true);
};

niggahitaToggle.addEventListener("change", function() {
    setNiggahita(this.checked);
});

//// grammar button closed / open

grammarToggle.addEventListener("change", function() {
    const grammarButtons = document.getElementsByName("grammar-button");
    const grammarDivs = document.getElementsByName("grammar-div");
    if (this.checked) {
        grammarButtons.forEach(button => {
            button.classList.add("active");
        });
        grammarDivs.forEach(div => {
            div.classList.remove("hidden");
        });
    } else {
        grammarButtons.forEach(button => {
            button.classList.remove("active");
        });
        grammarDivs.forEach(div => {
            div.classList.add("hidden");
        });
    }
});

//// examples button toggle

exampleToggle.addEventListener("change", function() {
    const exampleButtons = document.getElementsByName("example-button");
    const exampleDivs = document.getElementsByName("example-div");
    if (this.checked) {
        exampleButtons.forEach(button => {
            button.classList.add("active");
        });
        exampleDivs.forEach(div => {
            div.classList.remove("hidden");
        });
    } else {
        exampleButtons.forEach(button => {
            button.classList.remove("active");
        });
        exampleDivs.forEach(div => {
            div.classList.add("hidden");
        });
    }
});


// //// sbs examples button toggle
// sbsexampleToggle.addEventListener("change", function() {
//     const sbsexampleButtons = document.getElementsByName("sbs-example-button");
//     const sbsexampleDivs = document.getElementsByName("sbs-example-div");
//     if (this.checked) {
//         sbsexampleButtons.forEach(button => {
//             button.classList.add("active");
//         });
//         sbsexampleDivs.forEach(div => {
//             div.classList.remove("hidden");
//         });
//     } else {
//         sbsexampleButtons.forEach(button => {
//             button.classList.remove("active");
//         });
//         sbsexampleDivs.forEach(div => {
//             div.classList.add("hidden");
//         });
//     }
// });

//// summary 

summaryToggle.addEventListener("change", function() {
    showHideSummary()
});

function showHideSummary() {
    if (summaryToggle.checked) {
        summaryResults.style.display = "block";
    } else {
        summaryResults.style.display = "none";
    }
}

//// sandhi ' toggle

sandhiToggle.addEventListener("change", function() {
    showHideSandhi()
});

function showHideSandhi() {
    const results = document.getElementById('dpd-results');
    if (!results) return;
    results.classList.toggle('hide-apostrophes', !sandhiToggle.checked);
}
window.showHideSandhi = showHideSandhi;

//// text to unicode

// Velthuis to Unicode. Here, not in autopali.js: that one is deferred, and typing before it ran threw
// "uniCoder is not defined" on this listener. autopali.js uses it from here.
function uniCoder(textInput) {
    if (!textInput || textInput === "") return textInput;
    return textInput
        .replace(/aa/g, "ā")
        .replace(/ii/g, "ī")
        .replace(/uu/g, "ū")
        .replace(/\"n/g, "ṅ")
        .replace(/\~n/g, "ñ")
        .replace(/\.t/g, "ṭ")
        .replace(/\.d/g, "ḍ")
        .replace(/\.n/g, "ṇ")
        .replace(/\.m/g, "ṃ")
        .replace(/\.l/g, "ḷ")
        .replace(/\.h/g, "ḥ");
}

searchBox.addEventListener("input", function() {
    window.dgSearchTyped = true; // autopali.js: the reader typed before it ran (a word page's own word does not count)
    let textInput = searchBox.value;
    let convertedText = uniCoder(textInput);
    searchBox.value = convertedText;
});
