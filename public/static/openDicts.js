

function createDropdowns() {
  const dictionaryData = {
    ru: {
      pali: "Палийские словари",
      sanskrit: "Санскритские словари",
      other: "Другие ресурсы",
      dGift: "https://dhamma.gift/ru/?q=",
      dGiftHeader: "Dhamma.Gift",
      dGiftTitle: "Искать через Dhamma.Gift",
    },
    en: {
      pali: "Pali Dictionaries",
      sanskrit: "Sanskrit Dictionaries",
      other: "Other Resources",
      dGift: "https://dhamma.gift/?q=",
      dGiftHeader: "Dhamma.Gift",
      dGiftTitle: "Search with Dhamma.Gift",

    },
  };

  const lang = document.documentElement.lang === "ru" ? "ru" : "en";
  const texts = dictionaryData[lang];

  const dropdownHTML = `
    <div class="dropdown-section">
    <a class="dropdown-item" target="" rel="noopener noreferrer" title="${texts.dGiftTitle}" href="javascript:void(0)" onclick="return openWithQuery(event, '${texts.dGift}')">
      <span class="dropdown-icon">🔎</span> ${texts.dGiftHeader}
    </a>
    <a class="dropdown-item" target="" rel="noopener noreferrer" title="DharmaMitra.org Translate and Research" href="javascript:void(0)" onclick="return openWithQuery(event, 'https://dharmamitra.org/translate?translate_mode=explain-grammar&input_sentence=')">
        <span class="dropdown-icon">🐻‍❄️</span> DharamMitra.org
    </a>
    </div>
    
    <div class="dropdown-section">
      <div class="dropdown-header">${texts.pali}</div>
      <a class="dropdown-item" target="_blank" href="javascript:void(0)" onclick="return openWithQuery(event, 'https://dsal.uchicago.edu/cgi-bin/app/pali_query.py?matchtype=default&qs=')">
        <span class="dropdown-icon">🏛️</span> PTS Dictionary
      </a>
      <a class="dropdown-item" target="_blank" href="javascript:void(0)" onclick="return openWithQuery(event, 'https://gandhari.org/dictionary?section=dop&search=')">
        <span class="dropdown-icon">🏛️</span> Cone Gandhari.org
      </a>
  <a class="dropdown-item" target="_blank" href="javascript:void(0)" onclick="return openWithQuery(event, 'https://www.digitalpalireader.online/_dprhtml/index.html?frombox=1&analysis=')">
        <span class="dropdown-icon">🏛️</span> DPR Analysis
      </a>

      <a class="dropdown-item" target="_blank" href="javascript:void(0)" onclick="return openWithQuery(event, 'https://cpd.uni-koeln.de/search?query=')">
        <span class="dropdown-icon">🏛️</span> Critical Pali Dict (CPD)
      </a>
    </div>
    
    <div class="dropdown-section">
      <div class="dropdown-header">${texts.sanskrit}</div>
      <a class="dropdown-item" target="_blank" href="javascript:void(0)" onclick="return openWithQuery(event, 'https://sanskrit-lexicon.uni-koeln.de/scans/MWScan/2020/web/webtc/indexcaller.php?transLit=roman&key=')">
        <span class="dropdown-icon">📜</span> Monier-Williams & other
      </a>
          <a class="dropdown-item" target="_blank" href="javascript:void(0)" onclick="return openWithQuery(event, 'https://glosbe.com/pi/sa/')">
        <span class="dropdown-icon">📜</span> Glosbe Pli-Skr
      </a>
      <a class="dropdown-item" target="_blank" href="javascript:void(0)" onclick="return openWithQuery(event, 'https://www.sanskritdictionary.com/?iencoding=iast&lang=sans&action=Search&q=')">
        <span class="dropdown-icon">📜</span> Sanskrit Dictionary
      </a>
      <a class="dropdown-item" target="_blank" href="javascript:void(0)" onclick="return openWithQuery(event, 'https://www.learnsanskrit.cc/translate?dir=au&search=')">
        <span class="dropdown-icon">📜</span> LearnSanskrit
      </a>
    </div>
    
    <div class="dropdown-section">
      <div class="dropdown-header">${texts.other}</div>

      <a class="dropdown-item" target="_blank" href="javascript:void(0)" onclick="return openWithQuery(event, 'https://www.wisdomlib.org/index.php?type=search&division=glossary&item=&mode=text&input=')">
        <span class="dropdown-icon">🌍</span> Wisdomlib
      </a>
      <a class="dropdown-item" target="_blank" href="javascript:void(0)" onclick="return openWithQuery(event, 'https://dhamma.gift/cse.php?q=')">
        <span class="dropdown-icon">🌍</span> Google Custom Search
      </a>
      <a class="dropdown-item" target="_blank" href="javascript:void(0)" onclick="return openWithQuery(event, 'https://www.aksharamukha.com/converter?source=ISOPali&target=Devanagari&text=')">
        <span class="dropdown-icon">🌍</span> Aksharamukha
      </a>
    </div>
  `;

  document.querySelectorAll(".dict-dropdown-menu-down, .dict-dropdown-menu").forEach(
    (el) => (el.innerHTML = dropdownHTML)
  );
}


function toggleDictDropdown(event) {
  event.preventDefault();
  event.stopPropagation();

  const button = event.currentTarget;
  const container = button.closest('.dict-dropdown-container');
  if (!container) return;

  const dropdown = container.querySelector('.dict-dropdown-menu, .dict-dropdown-menu-down');
  if (!dropdown) return;

  // Ленивое создание содержимого
  if (!dropdown.dataset.ready) {
    createDropdowns();
    dropdown.dataset.ready = "1";
  }

  // Закрываем другие открытые меню
  document.querySelectorAll('.dict-dropdown-menu.show, .dict-dropdown-menu-down.show').forEach(el => {
    if (el !== dropdown) el.classList.remove('show');
  });

  const isShowing = dropdown.classList.toggle('show');

  if (isShowing) {
    // 1. Динамическое позиционирование относительно координат кнопки
    const rect = button.getBoundingClientRect();
    const isDown = dropdown.classList.contains('dict-dropdown-menu-down');

    // Привязываем левый край к кнопке
    dropdown.style.left = `${rect.left}px`;

    if (isDown) {
      // Меню выпадает ВНИЗ (из хедера)
      dropdown.style.top = `${rect.bottom + 5}px`;
      dropdown.style.bottom = 'auto';
    } else {
      // Меню выпадает ВВЕРХ (из футера)
      dropdown.style.bottom = `${window.innerHeight - rect.top + 5}px`;
      dropdown.style.top = 'auto';
    }

    // 2. Проверка, чтобы меню не уходило за правый край экрана
    const dropdownWidth = 260; // min-width из CSS
    if (rect.left + dropdownWidth > window.innerWidth) {
      dropdown.style.left = 'auto';
      dropdown.style.right = '10px';
    } else {
      dropdown.style.right = 'auto';
    }

    adjustDropdownHeight(container, dropdown);
  }

  // Обработчики закрытия
  if (container._closeHandler) {
    document.removeEventListener('click', container._closeHandler);
  }

  container._closeHandler = function(e) {
    if (!container.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('show');
      document.removeEventListener('click', container._closeHandler);
      window.removeEventListener('resize', container._resizeHandler);
      delete container._closeHandler;
      delete container._resizeHandler;
    }
  };

  document.addEventListener('click', container._closeHandler);

  container._resizeHandler = function() {
    if (dropdown.classList.contains('show')) {
      toggleDictDropdown(event); // Пересчитать позицию при ресайзе
    }
  };
  window.addEventListener('resize', container._resizeHandler);
}

function adjustDropdownHeight(container, dropdown) {
  const rect = dropdown.getBoundingClientRect();
  const margin = 20;
  let availableSpace;

  if (dropdown.classList.contains('dict-dropdown-menu-down')) {
    // Пространство от верха меню до низа экрана
    availableSpace = window.innerHeight - rect.top - margin;
  } else {
    // Пространство от низа меню до верха экрана
    availableSpace = rect.bottom - margin;
  }

  const maxVhHeight = window.innerHeight * 0.8;
  const finalHeight = Math.max(150, Math.min(availableSpace, maxVhHeight));

  dropdown.style.maxHeight = `${finalHeight}px`;
}



function adjustDropdownHeight(container, dropdown) {
  const rect = container.getBoundingClientRect();
  const margin = 8;
  const padding = 16;
  
  // Добавляем отступы для панелей
  const headerHeight = 70; // Высота верхней шапки (для меню снизу)
  const footerHeight = 60; // 👈 Высота нижней панели (для меню сверху)

  const maxVhHeight = window.innerHeight * 0.7;

  let availableSpace;

  // Логика для меню, которое выпадает ВНИЗ (из Хедера)
  if (dropdown.classList.contains('dict-dropdown-menu-down')) {
    // Высота экрана - (позиция кнопки + отступ) - ВЫСОТА ФУТЕРА
    availableSpace = window.innerHeight - rect.bottom - margin - padding - footerHeight;
  } 
  // Логика для меню, которое выпадает ВВЕРХ (из Футера)
  else {
    availableSpace = rect.top - margin - padding - headerHeight;
  }

  // Ограничиваем высоту
  const finalHeight = Math.max(100, Math.min(availableSpace, maxVhHeight));

  dropdown.style.maxHeight = `${finalHeight}px`;
}

// Показать уведомление
function showBubbleNotification(text) {
  const bubble = document.getElementById('bubbleNotification');
  if (!bubble) return;
  
  bubble.textContent = text;
  bubble.classList.add('show');
  
  setTimeout(() => {
    bubble.classList.remove('show');
  }, 2000);
}



function openWithQuery(event, baseUrl) {
  event.preventDefault();
  
  // 1. Получаем текущее значение из поля поиска
  const searchInput = document.getElementById('search-box');
  const query = searchInput?.value.trim().toLowerCase().replace(/ṁ/g, 'ṃ') || '';
  
  // 2. Копируем в буфер обмена
  if (query) {
    showBubbleNotification('Copied to clipboard');
    navigator.clipboard.writeText(query).catch(err => {
      console.warn('Clipboard copy failed:', err);
    });
  }

  // 3. Формируем URL
  const finalUrl = baseUrl + encodeURIComponent(query);
  
  // 4. Получаем target из ссылки и открываем окно
  const target = event.currentTarget.target || '_self'; // Используем '_self' по умолчанию для текущего окна
  
  // Если target пустой или равен '_self', ссылка откроется в текущей вкладке.
  // Если target равен '_blank', она откроется в новой.
  window.open(finalUrl, target);
  
  return false;
}


