// Вешаем обработчик на document (не на ссылки!)

document.addEventListener('click', function(event) {
  const link = event.target.closest('a');
  if (!link || !link.href) return;

  // Проверяем, нужно ли обрабатывать эту ссылку
  const isSuttaLink = link.classList.contains('sutta_link') || link.closest('.sutta'); // Добавили проверку на родителя с классом sutta
  const isOldSite = link.href.includes('thebuddhaswords.net');
  
  if (!isSuttaLink && !isOldSite) return;

  event.preventDefault();
  let newUrl = link.href;

  // 1. Замена домена для старых ссылок
  if (isOldSite) {
    // Регулярное выражение для поиска сутт (MN, DN, SN, AN) с диапазонами или без
    const suttaMatch = newUrl.match(/\/(mn|dn|sn|an|dhp|snp|ud)([^\/]+?)\.html$/i);
    
    if (suttaMatch) {
      const suttaType = suttaMatch[1].toLowerCase();
      const suttaNum = suttaMatch[2];
      const suttaCode = suttaType + suttaNum;
      
      // Проверяем текущий URL страницы на наличие /ru/
      if (window.location.href.includes('/ru/')) {
        newUrl = `https://dhamma.gift/r/?q=${suttaCode}`;
      } else {
        newUrl = `https://dhamma.gift/read/?q=${suttaCode}`;
      }
    } else {
      // Обычная замена для не-сутт
      newUrl = newUrl
        .replace('www.thebuddhaswords.net', 'dhamma.gift/bw')
        .replace('thebuddhaswords.net', 'dhamma.gift/bw');
    }
  }

  // 2. Определение параметра s
  let sParam = '';

  // Случай для sutta_link: ищем bold в предыдущих элементах
  if (isSuttaLink) {
    const parentParagraph = link.closest('p');
    if (parentParagraph) {
      // Ищем ближайший предыдущий элемент с bold
      let prevElement = parentParagraph.previousElementSibling;
      while (prevElement) {
        const boldElement = prevElement.querySelector('b');
        if (boldElement) {
          sParam = boldElement.textContent.trim();
          break;
        }
        prevElement = prevElement.previousElementSibling;
      }
    }
  }

  // Если не нашли bold, берем q из URL
  if (!sParam) {
    sParam = new URLSearchParams(window.location.search).get('q') || '';
  }

  // 3. Добавляем параметр s (если есть значение) только если его ещё нет в newUrl
  if (sParam && !newUrl.includes('s=')) {
    const separator = newUrl.includes('?') ? '&' : '?';
    newUrl += `${separator}s=${encodeURIComponent(sParam.replace(/ṃ/g, "ṁ").replace(/'/g, ""))}`;
  }

  window.location.href = newUrl;
});


// переделать в сортируемую таблицу 

    function transformToSortable(table) {
        if (table.classList.contains('sortable-processed')) return;
        table.classList.add('sortable-processed');

        const oldTbody = table.querySelector('tbody');
        if (!oldTbody) return; // вдруг пустая таблица
        
        const oldRows = oldTbody.querySelectorAll('tr');
        table.innerHTML = '';

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
    const urlLanguage = window.location.pathname.split('/')[1];
    const lang = urlLanguage === 'ru' ? 'ru' : 'en';

    const tableHeaders = lang === 'ru' 
        ? ['ЧР⇅', '⇅', '⇅', '⇅', 'от', 'слово⇅']
        : ['pos⇅', '⇅', '⇅', '⇅', 'of', 'word⇅'];
        
        tableHeaders.forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            th.setAttribute('data-sort', 'string');
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        table.appendChild(tbody);

        oldRows.forEach(oldRow => {
            const cells = oldRow.querySelectorAll('td');
            if (cells.length < 4) return;
            
            const pos = cells[0].textContent.trim();
            const grammar = cells[1].textContent.trim();
            const word = cells[3].textContent.trim();
            
            const grammarParts = grammar.split(/\s+/);
            const gender = grammarParts[0] || '';
            const case_ = grammarParts[1] || '';
            const number = grammarParts[2] || '';
            
            const newRow = document.createElement('tr');
            
            [pos, gender, case_, number, 'of', word].forEach(text => {
                const td = document.createElement('td');
                td.textContent = text;
                newRow.appendChild(td);
            });
            
            tbody.appendChild(newRow);
        });

        setupSorting(table);
    }

    function setupSorting(table) {
        const tbody = table.querySelector('tbody');
        const headers = table.querySelectorAll('th');

        headers.forEach(header => {
            header.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                const order = header.dataset.order === 'asc' ? 'desc' : 'asc';
                const colIndex = header.cellIndex;
                const rows = Array.from(tbody.querySelectorAll('tr'));
                
                rows.sort((a, b) => {
                    const aValue = a.cells[colIndex].textContent.trim().toLowerCase();
                    const bValue = b.cells[colIndex].textContent.trim().toLowerCase();
                    return aValue.localeCompare(bValue);
                });
                
                if (order === 'desc') {
                    rows.reverse();
                }
                
                tbody.innerHTML = '';
                rows.forEach(row => tbody.appendChild(row));
                
                headers.forEach(h => h.dataset.order = '');
                header.dataset.order = order;
            });
        });
    }

    // Делегирование события клика
    document.addEventListener('click', function(event) {
        // Ищем, был ли клик по таблице с классом grammar_dict
        const table = event.target.closest('table.grammar_dict');
        if (table) {
            transformToSortable(table);
        }
    });



// конец сорт таблиц

/*
function rewriteOldLinksInExampleDivs() {
  const containers = document.querySelectorAll('div[name="example-div"]');
  containers.forEach(container => {
    rewriteOldLinksInContainer(container);
  });
}

function rewriteOldLinksInContainer(container) {
  if (!container) return;

  const links = container.querySelectorAll('a[href*="thebuddhaswords.net"]');

  links.forEach(link => {
    let url = link.href;

    // Проверяем, есть ли sutta-путь
    const suttaMatch = url.match(/\/(mn|dn|sn|an|dhp|snp|ud)([^\/]+?)\.html$/i);

    if (suttaMatch) {
      const suttaType = suttaMatch[1].toLowerCase();
      const suttaNum = suttaMatch[2];
      const suttaCode = suttaType + suttaNum;

      if (window.location.href.includes('/ru/')) {
        url = `https://dhamma.gift/r/?q=${suttaCode}`;
      } else {
        url = `https://dhamma.gift/read/?q=${suttaCode}`;
      }
    } else {
      url = url
        .replace('www.thebuddhaswords.net', 'dhamma.gift/bw')
        .replace('thebuddhaswords.net', 'dhamma.gift/bw');
    }

    // Определяем параметр s — ищем bold в предыдущих соседних абзацах
    let sParam = '';
    const parentP = link.closest('p');
    if (parentP) {
      let prev = parentP.previousElementSibling;
      while (prev) {
        const bold = prev.querySelector('b');
        if (bold) {
          sParam = bold.textContent.trim();
          break;
        }
        prev = prev.previousElementSibling;
      }
    }

    // Если не нашли, берём из URL параметр q
    if (!sParam) {
      sParam = new URLSearchParams(window.location.search).get('q') || '';
    }

    if (sParam) {
      const sep = url.includes('?') ? '&' : '?';
      url += `${sep}s=${encodeURIComponent(sParam.replace(/ṃ/g, 'ṁ').replace(/'/g, ''))}`;
    }

    // Обновляем href
    link.href = url;
  });
}

// Запускать в момент, когда контент подгружен (через idle или setTimeout)
function rewriteLinksWhenIdle() {
  const run = () => rewriteOldLinksInExampleDivs();

  if ('requestIdleCallback' in window) {
    requestIdleCallback(run, { timeout: 2000 });
  } else {
    setTimeout(run, 1000);
  }
}

*/