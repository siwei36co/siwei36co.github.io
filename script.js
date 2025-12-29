// DOM Elements
const themeToggle = document.querySelector('.theme-toggle');
const filterButtons = document.querySelectorAll('.filter-btn');
const gameCards = document.querySelectorAll('.game-card');
const languageSelector = document.getElementById('language-selector'); // Get language selector

// --- Theme Toggle Logic ---
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');
        themeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
}

// Apply saved theme on load
window.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-theme');
        if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
});

// --- Category Filter Logic ---
filterButtons.forEach(button => {
    button.addEventListener('click', () => {
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        const filterValue = button.getAttribute('data-filter');

        gameCards.forEach(card => {
            card.style.display = (filterValue === 'all' || card.getAttribute('data-category') === filterValue) ? '' : 'none';
        });
    });
});

// --- Smooth Scrolling Logic ---
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');
        if (targetId && targetId !== '#') {
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                e.preventDefault();
                window.scrollTo({
                    top: targetElement.offsetTop - 80, // Adjusted offset for sticky header
                    behavior: 'smooth'
                });
            }
        }
    });
});

// --- Animate on Scroll Logic ---
const animateOnScroll = () => {
    const elements = document.querySelectorAll('.section-header, .game-card, .featured-game-card');
    const screenPosition = window.innerHeight / 1.3;
    elements.forEach(element => {
        if (element.getBoundingClientRect().top < screenPosition) {
            element.classList.add('animate');
        }
    });
};

// Add animation styles and initialize scroll animation
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = `
        .section-header, .game-card, .featured-game-card {
            opacity: 0;
            transform: translateY(20px);
            transition: opacity 0.6s ease-out, transform 0.6s ease-out;
        }
        .section-header.animate, .game-card.animate, .featured-game-card.animate {
            opacity: 1;
            transform: translateY(0);
        }
        .game-card {
            transition-delay: calc(var(--card-index) * 0.08s); /* Slightly faster stagger */
        }
    `;
    document.head.appendChild(style);

    document.querySelectorAll('.game-card').forEach((card, index) => {
        card.style.setProperty('--card-index', index);
    });

    animateOnScroll(); // Initial check
    window.addEventListener('scroll', animateOnScroll);
});

// --- Newsletter Form Handling ---
const newsletterForm = document.querySelector('.newsletter-form');
if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const emailInput = newsletterForm.querySelector('input[type="email"]');
        const email = emailInput.value.trim();
        const lang = getCurrentLanguage(); // Get current language

        // Get translated messages using current language
        const messages = getTranslationsForLang(lang);
        const thankYouMessage = messages.thankYou || 'Thank you for subscribing!';
        const validEmailMessage = messages.validEmail || 'Please enter a valid email address.';

        if (email && isValidEmail(email)) {
            alert(thankYouMessage); // Use translated message
            emailInput.value = '';
        } else {
            alert(validEmailMessage); // Use translated message
        }
    });
}

// Email validation helper
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// --- Language Switching Logic ---

// Function to get the current language setting
function getCurrentLanguage() {
    let currentLang = localStorage.getItem('language') ||
                     (navigator.language || navigator.userLanguage).split('-')[0];
    if (!['zh', 'en'].includes(currentLang)) {
        currentLang = 'en'; // Default to English if unsupported language
    }
    return currentLang;
}

// Function to get the appropriate translation source
function getTranslationSource() {
    // Only use primary translations. If they fail to load, keep the UI in its default language
    // rather than falling back to pinyin.
    if (typeof translations !== 'undefined' && translations && translations.en) {
        return translations;
    }
    console.error("No translation data found!");
    return { en: {}, zh: {} };
}

// Function to get translations for a specific language
function getTranslationsForLang(lang) {
    const source = getTranslationSource();
    return source[lang] || source['en'] || {}; // Fallback to English if lang not found
}

// Typewriter effect function
function startTypewriterEffect(element, text) {
    // 计算字符数（考虑中英文）
    const charCount = [...text].length; // 使用扩展运算符正确计算Unicode字符
    
    // 设置基准打字速度（每个字符的时间）
    const baseSpeed = 100; // 毫秒/字符
    const duration = Math.max(charCount * baseSpeed / 1000, 1); // 至少1秒
    
    // 重置任何现有动画
    element.style.animation = 'none';
    element.offsetHeight; // 触发重排
    
    // 创建临时元素来计算实际文本宽度
    const temp = document.createElement('span');
    temp.style.cssText = `
        visibility: hidden;
        position: absolute;
        white-space: nowrap;
        font: ${getComputedStyle(element).font};
        letter-spacing: ${getComputedStyle(element).letterSpacing};
    `;
    temp.textContent = text;
    document.body.appendChild(temp);
    
    // 获取实际文本宽度
    const textWidth = temp.offsetWidth;
    document.body.removeChild(temp);
    
    // 设置元素样式和内容
    element.style.width = '0';
    element.style.maxWidth = `${textWidth}px`;
    element.textContent = text;
    
    // 设置CSS变量
    element.style.setProperty('--typewriter-chars', charCount.toString());
    element.style.setProperty('--typewriter-duration', `${duration}s`);
    element.style.setProperty('--typewriter-width', `${textWidth}px`);
    
    // 重启动画
    element.style.animation = null;
    
    // 隐藏Play Now按钮
    const playNowButton = element.parentElement.querySelector('.primary-btn');
    if (playNowButton) {
        playNowButton.classList.remove('show');
        
        // 在打字机效果完成后显示按钮
        setTimeout(() => {
            playNowButton.classList.add('show');
        }, duration * 1000 + 200); // 添加一点延迟
    }
}

// Update page language based on selected language
function updatePageLanguage(lang) {
    console.log('Updating page language to:', lang);
    document.documentElement.lang = lang;

    const translationData = getTranslationsForLang(lang);

    // 隐藏Play Now按钮（在语言切换时）
    const playNowButton = document.querySelector('.hero-content .primary-btn');
    if (playNowButton) {
        playNowButton.classList.remove('show');
    }

    // Select all elements with a data-key attribute
    document.querySelectorAll('[data-key]').forEach(element => {
        const key = element.dataset.key;
        if (translationData[key]) {
            // Special handling for typewriter effect
            if (element.classList.contains('typewriter-text')) {
                startTypewriterEffect(element, translationData[key]);
            } else if (element.tagName === 'INPUT' && element.type === 'email' && key === 'yourEmail') {
                element.placeholder = translationData[key];
            } else if (element.tagName === 'OPTION') {
                element.textContent = translationData[key];
            } else if (element.tagName === 'LABEL' && element.classList.contains('sr-only')) {
                element.textContent = translationData[key];
                const select = document.getElementById(element.getAttribute('for'));
                if (select) select.setAttribute('aria-label', translationData[key]);
            } else {
                element.textContent = translationData[key];
            }
        } else {
            console.warn(`Translation key "${key}" not found for language "${lang}".`);
        }
    });

    // --- Specific handling for Game Cards (using data-key-* attributes) ---
    document.querySelectorAll('.game-card').forEach(card => {
        // Translate Title
        const titleElement = card.querySelector('.game-info h3[data-key-title]');
        if (titleElement) {
            const titleKey = titleElement.dataset.keyTitle;
            if (translationData[titleKey]) {
                titleElement.textContent = translationData[titleKey];
            } else {
                 console.warn(`Translation key "${titleKey}" (title) not found for language "${lang}".`);
            }
        }

        // Translate Category
        const categoryElement = card.querySelector('.game-meta .category[data-key-category]');
         if (categoryElement) {
            const categoryKey = categoryElement.dataset.keyCategory;
            if (translationData[categoryKey]) {
                categoryElement.textContent = translationData[categoryKey];
            } else {
                 console.warn(`Translation key "${categoryKey}" (category) not found for language "${lang}".`);
            }
        }

        // Translate Difficulty
        const difficultyElement = card.querySelector('.game-meta .difficulty[data-key-difficulty]');
         if (difficultyElement) {
            const difficultyKey = difficultyElement.dataset.keyDifficulty;
            if (translationData[difficultyKey]) {
                difficultyElement.textContent = translationData[difficultyKey];
            } else {
                 console.warn(`Translation key "${difficultyKey}" (difficulty) not found for language "${lang}".`);
            }
        }
    });


    // --- Specific handling for Copyright ---
    const copyrightElement = document.querySelector('.footer-bottom p');
    if (copyrightElement) {
        const year = new Date().getFullYear();
        const copyrightText = translationData.allRightsReserved || 'All Rights Reserved.'; // Fallback text
        copyrightElement.textContent = `\u00A9 ${year} GameVerse. ${copyrightText}`;
    }

    // --- Specific handling for Newsletter Email Placeholder ---
     const emailInput = document.querySelector('.newsletter-form input[type="email"]');
     if (emailInput) {
         emailInput.placeholder = translationData.yourEmail || 'Your email address'; // Fallback placeholder
     }

    // --- Dispatch event for other scripts (like memory game) ---
    const event = new CustomEvent('languageChanged', { detail: { language: lang } });
    document.dispatchEvent(event);
}


// Initialize language on page load
document.addEventListener('DOMContentLoaded', function() {
    const initialLang = getCurrentLanguage();
    
    // 确保Play Now按钮一开始是隐藏的
    const playNowButton = document.querySelector('.hero-content .primary-btn');
    if (playNowButton) {
        playNowButton.classList.remove('show');
    }
    
    // 设置下拉菜单语言
    if (languageSelector) {
        languageSelector.value = initialLang; // Set dropdown to current language
    }
    
    // 应用翻译
    updatePageLanguage(initialLang); // Apply translations

    // Add event listener for language change
    if (languageSelector) {
        languageSelector.addEventListener('change', function() {
            const selectedLang = this.value;
            localStorage.setItem('language', selectedLang); // Save preference
            updatePageLanguage(selectedLang); // Update UI
        });
    }
});
