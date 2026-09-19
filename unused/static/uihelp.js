// Целевые посещения
var targetVisitForPWApopup = 5; 
var extraTimes = 0;

console.log('Script loaded. Target visits:', targetVisitForPWApopup);

document.addEventListener("DOMContentLoaded", function () {
    console.log('DOM fully loaded and parsed');
    
    // Получаем текущее количество посещений из localStorage
    var visitCount = parseInt(localStorage.getItem("visitCount") || "0", 10);
    console.log('Current visit count:', visitCount);

    // Увеличиваем счетчик посещений, если не достигнуто целевое значение
    if (visitCount < targetVisitForPWApopup) {
        visitCount += 1;
        localStorage.setItem("visitCount", visitCount);
        console.log("Incremented visitCount to:", visitCount);
    } else {
        console.log("Visit count already reached target, not incrementing");
    }
  
    initPwaBanner();
});

// Объявляем все необходимые переменные
let deferPrompt = null;
let banner = null;
let installBtn = null;
let closeBtnPWA = null;
const pwaBannerShownKey = 'pwaBannerShown';

// Функция создания баннера
function createPwaBanner() {
    console.log('Creating PWA banner');
    
    // Проверяем, не был ли баннер уже создан
    if (document.getElementById('pwa-banner')) {
        console.log('Banner already exists, skipping creation');
        return;
    }
  
    // Создаем HTML баннера
    const bannerHTML = `
    <div id="pwa-banner" class="pwa-install hidden">
      <img src="/static/dg-logo.svg" alt="App Icon" class="icon">
      <div class="text">
        <h2 class="pwa-title">Install Dict.Dhamma.Gift</h2>
        <p class="pwa-description">Add to home screen for quick access</p>
      </div>
      <div class="actions">
        <button id="installBtn" class="pwa-button">Install</button>
        <button id="closePwaBanner">✕</button>
      </div>
    </div>
    `;
  
    // Добавляем баннер в DOM
    document.body.insertAdjacentHTML('beforeend', bannerHTML);
    console.log('Banner HTML added to DOM');
  
    // Инициализируем элементы
    banner = document.getElementById('pwa-banner');
    installBtn = document.getElementById('installBtn');
    closeBtnPWA = document.getElementById('closePwaBanner');
    console.log('Banner elements initialized:', {banner, installBtn, closeBtnPWA});
  
    // Назначаем обработчики событий
    if (installBtn) {
        installBtn.addEventListener('click', installPwa);
        console.log('Added click handler for install button');
    }
    if (closeBtnPWA) {
        closeBtnPWA.addEventListener('click', hidePwaBanner);
        console.log('Added click handler for close button');
    }
}

// Функция скрытия баннера
function hidePwaBanner() {
    console.log('Hiding PWA banner');
    if (banner) {
        banner.classList.add('hidden');
        localStorage.setItem(pwaBannerShownKey, 'true');
        console.log('Banner hidden and state saved to localStorage');
    } else {
        console.log('No banner to hide');
    }
}

// Установка PWA
async function installPwa() {
    console.log('Attempting PWA installation');
    if (deferPrompt) {
        try {
            console.log('Showing install prompt');
            deferPrompt.prompt();
            const { outcome } = await deferPrompt.userChoice;
            console.log('User choice:', outcome);
            
            if (outcome === 'accepted') {
                console.log('User accepted installation');
                hidePwaBanner();
            } else {
                console.log('User declined installation');
            }
        } catch (error) {
            console.error('Ошибка при установке PWA:', error);
        } finally {
            deferPrompt = null;
            console.log('Install prompt cleared');
        }
    } else {
        console.log('No deferred prompt available');
    }
}

// Локализация текстов
function localizePwaBanner() {
    const language = getLanguage();
    console.log('Localizing banner for language:', language);
    
    const texts = {
        ru: {
            title: 'Установить Dict.Dhamma.Gift',
            description: 'Добавить на главный экран для быстрого доступа',
            installBtn: 'Установить'
        },
        en: {
            title: 'Install Dict.Dhamma.Gift',
            description: 'Add to home screen for quick access',
            installBtn: 'Install'
        }
    };
  
    if (!banner) {
        console.log('No banner available for localization');
        return;
    }
  
    const currentTexts = texts[language] || texts.en;
    console.log('Using texts:', currentTexts);
    
    const titleEl = banner.querySelector('.pwa-title');
    const descEl = banner.querySelector('.pwa-description');
    const btnEl = banner.querySelector('.pwa-button');
  
    if (titleEl) titleEl.textContent = currentTexts.title;
    if (descEl) descEl.textContent = currentTexts.description;
    if (btnEl) btnEl.textContent = currentTexts.installBtn;
    
    console.log('Banner localized');
}

// Определение языка
function getLanguage() {
    const path = window.location.pathname;
    const language = (path.startsWith('/ru/') || path.startsWith('/r/')) ? 'ru' : 'en';
    console.log('Detected language:', language, 'from path:', path);
    return language;
}

// Инициализация баннера
function initPwaBanner() {
    console.log('Initializing PWA banner');
    try {
        const visitCount = parseInt(localStorage.getItem('visitCount') || '0', 10);
        const alreadyShown = localStorage.getItem(pwaBannerShownKey);
        
        console.log('Checking conditions:', {
            visitCount,
            targetVisitForPWApopup,
            alreadyShown,
            meetsVisitRequirement: visitCount >= targetVisitForPWApopup,
            notShownYet: !alreadyShown
        });

        if (visitCount >= targetVisitForPWApopup && !alreadyShown) {
            console.log('Conditions met - creating banner');
            createPwaBanner();
            
            window.addEventListener('beforeinstallprompt', (e) => {
                console.log('beforeinstallprompt event triggered', e);
                e.preventDefault();
                deferPrompt = e;
                console.log('Deferred prompt saved');
                
                localizePwaBanner();
                if (banner) {
                    console.log('Showing banner');
                    banner.classList.remove('hidden');
                } else {
                    console.log('No banner to show');
                }
            });
        } else {
            console.log('Conditions not met for showing banner');
            if (visitCount < targetVisitForPWApopup) {
                console.log(`Visit count ${visitCount} < ${targetVisitForPWApopup}`);
            }
            if (alreadyShown) {
                console.log('Banner already shown previously');
            }
        }
    } catch (error) {
        console.error('Ошибка инициализации PWA баннера:', error);
    }
}
