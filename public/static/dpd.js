// Pali through the Dhamma.Gift voice (Piper + our IAST->IPA rules) for the big speaker button: any word,
// compound or phrase, not only the DPD lemmas that have a recording. Same service as the DG reader; f2 is
// public with CORS, the same-origin proxy is the fallback. The play buttons inside DPD entries keep DPD's
// own recordings (owner: that is their area).
const DG_TTS_URLS = [window.DG_TTS_URL || 'https://api.dhamma.gift/api/tts/pali', '/api/tts/pali'];
const DG_TTS_RATE = 0.875;  // the reader's default Pali pace
const dgTtsCache = new Map();  // text -> object URL of the mp3

// A silent clip played inside the click unlocks the element, so it may still play once synthesis
// returns a few seconds later (iOS refuses audio started outside the tap otherwise).
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';

async function dgSpeak(text) {
    const audio = new Audio(SILENCE);
    audio.play().catch(() => {});
    let url = dgTtsCache.get(text);
    for (const api of url ? [] : DG_TTS_URLS) {
        try {
            const r = await fetch(api, { method: 'POST', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ text, rate: DG_TTS_RATE }) });
            if (!r.ok) continue;
            const b64 = (await r.json()).audioContent;
            url = URL.createObjectURL(new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: 'audio/mpeg' }));
            dgTtsCache.set(text, url);
            break;
        } catch (e) {}
    }
    if (!url) return false;
    audio.src = url;
    await audio.play();
    return true;
}

window.dgSpeak = dgSpeak;

function playAudio(headword, gender) {
    if (!headword) return;
    
    const validGenders = ["male", "female", "male1", "male2", "female1"];
    if (!validGenders.includes(gender)) {
        gender = "male";
        try {
            const audioToggle = localStorage.getItem("audio-toggle");
            if (audioToggle === "true") {
                gender = "female";
            }
        } catch (e) {}
    }

    const url = 'https://dpdict.net/audio/' + encodeURIComponent(headword) + '?gender=' + gender;
    var audio = new Audio(url);
    audio.play().catch(function (error) {
        console.error("Audio playback error:", error);
    });
}

// Attach to window so it's always accessible
window.playAudio = playAudio;

// Global delegated click listener
document.addEventListener("click", function (event) {
    var playButton = event.target.closest(".dpd-button.play");
    if (playButton) {
        var headword = playButton.getAttribute("data-headword");
        var gender = playButton.getAttribute("data-gender");
        if (headword) {
            playAudio(headword, gender);
            event.preventDefault();
            return false;
        }
    }

    var otherButton = event.target.closest(".dpd-button");
    if (otherButton && otherButton.getAttribute("data-target")) {
        const target_id = otherButton.getAttribute("data-target");
        var target = document.getElementById(target_id);
        if (target) {
            let oneButtonToggleEnabled = false;
            try {
                oneButtonToggleEnabled = localStorage.getItem("one-button-toggle") === "true";
            } catch (e) {
                console.log("LocalStorage is not available.");
            }

            if (oneButtonToggleEnabled) {
                 var allButtons = document.querySelectorAll('.dpd-button');
                allButtons.forEach(function (button) {
                    if (button !== otherButton) {
                        button.classList.remove("active");
                    }
                });

                var allContentAreas = document.querySelectorAll('.content');
                allContentAreas.forEach(function (contentArea) {
                    if (contentArea !== target && !contentArea.classList.contains("summary")) {
                        contentArea.classList.add("hidden");
                    }
                });

                if (!target.classList.contains('summary')) {
                    target.classList.toggle("hidden");
                }
            } else {
                target.classList.toggle("hidden");
            }

            if (otherButton.classList.contains("close")) {
                 var target_control = document.querySelector('a.dpd-button[data-target="' + target_id + '"]');
                if (target_control) {
                    target_control.classList.toggle("active");
                }
            } else {
                otherButton.classList.toggle("active");
            }
        }
        event.preventDefault();
    }
});