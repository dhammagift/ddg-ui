document.addEventListener('DOMContentLoaded', function() {
    let wordsRequested = false;
    let paliauto = document.getElementById("paliauto");

    if (paliauto) {
        paliauto.addEventListener("input", function () {
            let textInput = paliauto.value;
            let convertedText = uniCoder(textInput);
            paliauto.value = convertedText;
        });

        // Добавляем обработчик клика по пустому инпуту
        paliauto.addEventListener("click", function() {
            // before the word list is in, autocomplete does not exist yet (it threw on an early click)
            if (paliauto.value === "" && $(paliauto).autocomplete("instance")) {
                $(paliauto).autocomplete("search", "");
            }
        });
    }

    // НОВЫЙ БЛОК: Отслеживаем клик и фокус в главном поле поиска
    let searchBoxInput = document.getElementById("search-box");
    if (searchBoxInput) {
        // The word list (340 KB) is fetched on the first click or key in the field, not on every
        // page: the field is focused automatically on load, so focus alone says nothing, and someone
        // who opened a link to a word and types nothing never needed the list.
        const triggerEmptySearch = function() {
            if (searchBoxInput.value === "" && $(searchBoxInput).autocomplete("instance")) {
                $(searchBoxInput).autocomplete("search", "");
            }
        };
        // Срабатывает и при клике мышкой, и при переходе табом (фокусе)
        searchBoxInput.addEventListener("click", triggerEmptySearch);
        searchBoxInput.addEventListener("focus", triggerEmptySearch);
        for (const ev of ["pointerdown", "keydown", "input"]) searchBoxInput.addEventListener(ev, loadWords);
        if (window.dgSearchTyped) loadWords(); // typed before this deferred script ran
    }

  function loadWords() {
  if (wordsRequested) return;
  wordsRequested = true;
  $.ajax({
        url: "./static/sutta_words.txt",
        dataType: "text",
        // dg-apps#42: broken autosuggestions in the apps (fine on the site) — the app's WebView has
        // no Content-Type header to read the charset from on this request, so it fell back to
        // Latin-1 and every diacritic (ā, ṭ, ñ...) came out as "Ä" plus a stray control character.
        // overrideMimeType forces UTF-8 regardless of what header (if any) the response carries.
        mimeType: "text/plain; charset=utf-8",
        success: function(data) {
            var accentMap = {
                "ā": "a",
                "ī": "i",
                "ū": "u",
                "ḍ": "d",
                "ḷ": "l",
                "ṃ": "ṁ",
                "ṁ": "n",
                "ṁ": "m",
                "ṅ": "n",
                "ṇ": "n",
                "ṭ": "t",
                "ñ": "n",
                "ññ": "n",
                "ss": "s",
                "aa": "a",
                "ii": "i",
                "uu": "u",
                "dd": "d",
                "kk": "k",
                "ḍḍ": "d",
                "ḷḷ": "l",
                "ṇṇ": "n",
                "ṭṭ": "t",
                "cc": "c",
                "pp": "p",
                "cch": "c",
                "ch": "c",
                "kh": "k",
                "ph": "p",
                "th": "t",
                "ṭh": "t"
            };

            var normalize = function(term) {
                var ret = "";
                for (var i = 0; i < term.length; i++) {
                    ret += accentMap[term.charAt(i)] || term.charAt(i);
                }
                return ret;
            };

            // sutta_words.txt lines are "word count": how often the form occurs in the Suttas. The count
            // orders the suggestions (frequent forms first); phrases carry none and sort last.
            var allWords = [], allFreq = [];
            data.split('\n').forEach(function (line) {
                var m = line.match(/^(.*?)\s+(\d+)\s*$/);
                var w = m ? m[1] : line.trim();
                if (w) { allWords.push(w); allFreq.push(m ? +m[2] : 0); }
            });
            var allNorm = null; // normalize(allWords[i]), made once on the first search, not twice per letter
            var byFreq = function (a, b) { return allFreq[b] - allFreq[a] || a - b; };

            $("#search-box").autocomplete({
                autoFocus: false,
                // The list hangs under the whole search field (below it, a small gap; above it when there is no room below).
                position: {
                    my: "left top+6",
                    at: "left bottom",
                    of: "#search-form",
                    collision: "flip"
                },
                minLength: 0,
                multiple: /[\s\*]/,
                
                source: function(request, response) {
                    
                    function normalizeTerm(term) {
                        const ruToEn = {
                            'а': 'f', 'в': 'd', 'е': 't', 'к': 'r', 'м': 'v',
                            'н': 'y', 'о': 'j', 'п': 'g', 'р': 'h', 'с': 'c',
                            'т': 'n', 'у': 'e', 'х': '[', 'ъ': ']', 'ы': 's',
                            'ь': 'm', 'э': "'", 'ё': '`', 'я': 'z', 'ж': ';',
                            'з': 'p', 'и': 'b', 'й': 'q', 'л': 'k', 'д': 'l',
                            'г': 'u', 'ф': 'a', 'ц': 'w', 'ч': 'x', 'ш': 'i',
                            'щ': 'o', 'б': ',', 'ю': '.', ' ': ' '
                        };

                        // Only known short text/nikaya abbreviations look like sutta indexes
                        // (mn1.1, dhp423 etc). Regular words (e.g. "samaya 1.1", a DPD
                        // homonym key) must NOT be glued together or lookup breaks.
                        var idxAbbr = "mn|dn|sn|an|dhp|snp|ud|iti|thag|thig|vv|pv";

                        return term.trim()
                            .replace(/[а-яё]/g, char => ruToEn[char] || char)
                            .replace(new RegExp("\\b(" + idxAbbr + ")\\s+(\\d+)\\s+(\\d+)\\b", "gi"), "$1$2.$3")
                            .replace(new RegExp("\\b(" + idxAbbr + ")(\\d+)\\s+(\\d+)\\b", "gi"), "$1$2.$3")
                            .replace(new RegExp("\\b(" + idxAbbr + ")\\s+(\\d+)\\.(\\d+)\\b", "gi"), "$1$2.$3")
                            .replace(new RegExp("\\b(" + idxAbbr + ")\\s+(\\d+)\\b", "gi"), "$1$2");
                    }

                    var normalizedTerm = normalizeTerm(request.term);
                    var terms = normalizedTerm.split(/[\|\s\*]/);
                    var lastTerm = terms.pop().trim();

                    // A bare "1.1"/"1" tail after a word is a DPD homonym number
                    // (e.g. "samaya 1.1"), not a separate search term — put it
                    // back together so the word isn't dropped from the search.
                    if (/^\d+(\.\d+)?$/.test(lastTerm) && terms.length && terms[terms.length - 1].trim()) {
                        lastTerm = terms.pop().trim() + " " + lastTerm;
                    }

                    var minLengthForSearch = 3;

                    // 1. Берем общую историю (ключ должен быть "history-list")
                    var history = JSON.parse(localStorage.getItem("history-list")) || [];

                    // 2. Если поле пустое — показываем всю историю
                    if (!lastTerm) {
                        response(history);
                        return;
                    }

                    // 3. Умная фильтрация истории (учитываем сжатие пробелов в номерах сутт)
                    var filteredHistory = history.filter(key => {
                        var normKey = normalizeTerm(key).toLowerCase();
                        var rawKey = key.toLowerCase();
                        return normKey.startsWith(lastTerm.toLowerCase()) || rawKey.startsWith(lastTerm.toLowerCase());
                    });

                    // 4. Если введено меньше 3 символов, отдаем ТОЛЬКО историю
                    if (lastTerm.length < minLengthForSearch) {
                        response(filteredHistory);
                        return;
                    }

                    // 5. Поиск по словарю (для слов от 3 символов)
                    var normalizedForSearch = normalize(lastTerm);
                    var re = $.ui.autocomplete.escapeRegex(normalizedForSearch);
                    var modifiedRe = re.replace(/([a-zA-Z])/g, "$1{1,2}");
                    var matchbeginonly = new RegExp("^" + modifiedRe, "i");
                    var matchall = new RegExp(modifiedRe, "i");

                    // One pass over the pre-normalized list. Order: the typed word itself (it was below
                    // row 100 for tattha, paññā, samma), then words that begin with it, frequent forms
                    // first (dhammo, bhikkhave show up after 3 letters, not 5-7), then words that contain it.
                    if (!allNorm) allNorm = allWords.map(normalize);
                    var maxRecord = 100;
                    var matchexact = new RegExp("^" + modifiedRe + "$", "i");
                    var exact = [], begin = [], inside = [];
                    for (var i = 0; i < allNorm.length; i++) {
                        if (matchbeginonly.test(allNorm[i])) (matchexact.test(allNorm[i]) ? exact : begin).push(i);
                        else if (inside.length < maxRecord && matchall.test(allNorm[i])) inside.push(i);
                    }
                    // exact = equal up to diacritics (samma, sammā): the very letters typed go first
                    var typed = lastTerm.toLowerCase();
                    exact.sort(function (a, b) { return (allWords[b].toLowerCase() === typed) - (allWords[a].toLowerCase() === typed) || byFreq(a, b); });
                    var resultList = exact.concat(begin.sort(byFreq), inside).slice(0, maxRecord)
                        .map(function (i) { return allWords[i]; });

                    // 6. ФИНАЛ: Объединяем отфильтрованную историю и найденные слова, убирая дубликаты
                    var finalResult = Array.from(new Set([...filteredHistory, ...resultList]));

                    response(finalResult);
                },

      
                focus: function(event, ui) {
                    return false;
                },
                select: function(event, ui) {
                    var terms = this.value.split(/([\|\s\*])/);
                    terms.pop();
                    
                    var selectedValue = ui.item.value;
                    if (/\s+\d+$/.test(selectedValue)) {
                        selectedValue = selectedValue.split(/\s+/)[0];
                    }
                    
                    if (/\d+\s+/.test(selectedValue)) {
                        selectedValue = selectedValue.split(/\s+/)[0];
                    }
                    
                    if (/b[ui]pm|b[ui]-pm|pm/.test(selectedValue)) {
                        selectedValue = selectedValue.split(/\s+/)[0];
                    }
                    
                    terms.push(selectedValue);

                    for (var i = 1; i < terms.length; i += 2) {
                        if (terms[i] === "*") {
                            terms[i] = "*";
                        } else if (terms[i] === "|") {
                            terms[i] = "|";
                        } else {
                            terms[i] = " ";
                        }
                    }

                    this.value = terms.join("");
                   

           // Закрываем автоподсказки
           $(this).autocomplete("close");

           // Инициируем поиск
           handleFormSubmit();

                    return false;
      }
            }).on("keydown", function(event) {
                // ПРИНУДИТЕЛЬНОЕ ЗАКРЫТИЕ ПО ENTER
                if (event.keyCode === 13) {
                    $(this).autocomplete("close");
                }
            }).autocomplete("widget").addClass("fixed-height");
            // ...and as wide as the field: the left and right edges line up with it (the plugin makes the list as wide as the input inside).
            $("#search-box").autocomplete("instance")._resizeMenu = function () {
                this.menu.element.outerWidth($("#search-form").outerWidth());
            };
            // The field may already be focused: show what it asked for while the list was on its way
            // (the history when empty, otherwise suggestions for the letters already typed).
            if (document.activeElement === document.getElementById("search-box")) {
                $("#search-box").autocomplete("search", $("#search-box").val());
            }
        }
  });
  }
});


