// ==UserScript==
// @name         Mastodon Time & Progress Panel (True Final)
// @namespace    https://github.com/ZenonEl
// @version      1.8.0
// @description  A panel with a custom calendar that puts a generated search query into the search box on the /explore page and simulates an Enter press.
// @description:ru Панель с календарём, которая формирует поисковый запрос, вставляет его в поле поиска на странице "Обзор" и имитирует нажатие Enter.
// @author       ZenonEl
// @license      GPL-3.0-or-later
// @match        https://mastodon.ml/*
// @match        https://fosstodon.org/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=joinmastodon.org
// @homepageURL  https://github.com/ZenonEl/mastodon-time-progress-panel
// @supportURL   https://github.com/ZenonEl/mastodon-time-progress-panel/issues
// @downloadURL  https://raw.githubusercontent.com/ZenonEl/mastodon-time-progress-panel/main/mastodon-time-progress-panel.user.js
// @updateURL    https://raw.githubusercontent.com/ZenonEl/mastodon-time-progress-panel/main/mastodon-time-progress-panel.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration & Constants ---
    const SCRIPT_ID_PREFIX = 'mastodon-time-progress-panel';
    const CALENDAR_ROOT_ID = `${SCRIPT_ID_PREFIX}-root`;

    const config = {
        targetSelector: '.flex-spacer',
        updateInterval: 60000,
        initialDelay: 1500,
        customAccentRed: GM_getValue('customAccentRed', "#ebbcba"),
        customAccentGreen: GM_getValue('customAccentGreen', "#eb6f92"),
        customAccentPurple: GM_getValue('customAccentPurple', "#c4a7e7"),
        defaultTheme: {
            bgColor: '#282c37',
            borderColor: '#4b505c',
            shadow: '0 2px 10px rgba(0,0,0,0.2)',
            progressBarShadow: '#404040'
        }
    };

    // --- Localization (i18n) ---
    const translations = {
        en: {
            targetNotFound: '❌ Target element for panel not found!',
            progressDay: 'This day', progressMonth: 'This month', progressYear: 'This year',
            settingsMenuTitle: 'Panel Settings',
            colorRedPrompt: 'Enter custom RED accent color (hex):',
            colorGreenPrompt: 'Enter custom GREEN accent color (hex):',
            colorPurplePrompt: 'Enter custom PURPLE accent color (hex):',
            calendarViewTitle: 'Switch to calendar view',
            progressViewTitle: 'Switch to progress view',
            myPosts: 'My posts',
            allPosts: 'All',
            findPosts: 'Find posts',
            goToExplore: "Paste it into the search field and press Enter.",
            copiedToClipboard: 'Query copied to clipboard!',
            notificationTitle: 'Search Ready!',
        },
        ru: {
            targetNotFound: '❌ Целевой элемент для панели не найден!',
            progressDay: 'Этот день', progressMonth: 'Этот месяц', progressYear: 'Этот год',
            settingsMenuTitle: 'Настройки панели',
            colorRedPrompt: 'Введите свой КРАСНЫЙ акцентный цвет (hex):',
            colorGreenPrompt: 'Введите свой ЗЕЛЕНЫЙ акцентный цвет (hex):',
            colorPurplePrompt: 'Введите свой ФИОЛЕТОВЫЙ акцентный цвет (hex):',
            calendarViewTitle: 'Переключить на вид календаря',
            progressViewTitle: 'Переключить на вид прогресса',
            myPosts: 'Мои посты',
            allPosts: 'Все',
            findPosts: 'Найти посты',
            goToExplore: "Вставьте его в поле для поиска и нажмите Enter",
            copiedToClipboard: 'Запрос скопирован в буфер обмена!',
            notificationTitle: 'Готово к поиску!',
        }
    };

    function getCurrentPanelLanguage() {
        let preferredLang = null;
        try {
            const mastodonLocaleSetting = localStorage.getItem('locale') ||
                                      localStorage.getItem('user_locale') ||
                                      (JSON.parse(localStorage.getItem('settings') || '{}')).locale;
            if (mastodonLocaleSetting && typeof mastodonLocaleSetting === 'string') {
                const langPart = mastodonLocaleSetting.toLowerCase().split('-')[0];
                if (langPart === 'ru') preferredLang = 'ru';
                else if (langPart === 'en') preferredLang = 'en';
            }
        } catch (e) {}
        const htmlLang = (document.documentElement.lang || 'en').toLowerCase().split('-')[0];
        if (preferredLang) return preferredLang;
        return (htmlLang === 'ru') ? 'ru' : 'en';
    }

    const t = (key) => {
        const scriptLang = getCurrentPanelLanguage();
        return translations[scriptLang]?.[key] || translations.en[key];
    };

    // --- Notification System ---
    function showNotification(title, message, isSuccess = true) {
        const notification = document.createElement('div');
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '15px 20px',
            borderRadius: '8px',
            background: isSuccess ? '#31748f' : '#eb6f92',
            color: 'white',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: '9999',
            display: 'flex',
            flexDirection: 'column',
            maxWidth: '320px',
            animation: 'fadeIn 0.3s, slideIn 0.3s'
        });

        const titleEl = document.createElement('strong');
        titleEl.textContent = title;
        titleEl.style.marginBottom = '5px';
        titleEl.style.fontSize = '1.1em';

        const messageEl = document.createElement('span');
        messageEl.textContent = message;
        messageEl.style.fontSize = '0.9em';
        messageEl.style.opacity = '0.9';

        notification.append(titleEl, messageEl);
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.5s forwards';
            setTimeout(() => notification.remove(), 500);
        }, 5000);

        notification.addEventListener('click', () => {
            notification.style.animation = 'fadeOut 0.3s forwards';
            setTimeout(() => notification.remove(), 300);
        });
    }

    // --- Main Panel Initialization ---
    function initPanel() {
        const targetElement = document.querySelector(config.targetSelector);
        if (!targetElement) {
            console.warn(t('targetNotFound'));
            return;
        }

        // Remove existing panel if it exists
        const existingPanel = document.getElementById(CALENDAR_ROOT_ID);
        if (existingPanel) existingPanel.remove();

        const panelRoot = document.createElement('div');
        panelRoot.id = CALENDAR_ROOT_ID;

        // Get theme variables from Mastodon
        const mastodonRoot = document.querySelector(':root');
        const getCSSVar = (varName, defaultValue) => {
            const value = mastodonRoot ? getComputedStyle(mastodonRoot).getPropertyValue(varName).trim() : '';
            return value || defaultValue;
        };

        const themeVars = {
            accentRed: config.customAccentRed,
            accentGreen: config.customAccentGreen,
            accentPurple: config.customAccentPurple,
            borderColor: getCSSVar('--background-border-color', config.defaultTheme.borderColor),
            progressBarShadow: getCSSVar('--surface-variant-active-background-color', config.defaultTheme.progressBarShadow)
        };

        // Panel styles
        Object.assign(panelRoot.style, {
            fontFamily: 'inherit',
            margin: '15px',
            position: 'relative',
            zIndex: '1',
            fontSize: '0.9rem'
        });

        const container = document.createElement('div');
        Object.assign(container.style, {
            padding: '1.2em', borderRadius: '12px',
            border: `1px solid ${themeVars.borderColor}`,
            transition: 'opacity 0.3s ease'
        });

        const header = document.createElement('div');
        Object.assign(header.style, {
            textAlign: 'center',
            marginBottom: '1.5em',
            borderBottom: `1px solid ${themeVars.borderColor}`,
            paddingBottom: '1em',
            cursor: 'pointer'
        });
        header.title = t('calendarViewTitle');

        const dayHeading = document.createElement('h2');
        Object.assign(dayHeading.style, {
            fontSize: '1.8em',
            margin: '0',
            fontWeight: '500',
            letterSpacing: '-0.03em',
            color: themeVars.accentPurple
        });

        const dateHeading = document.createElement('h3');
        Object.assign(dateHeading.style, {
            fontSize: '0.9em',
            margin: '0.3em 0',
            textTransform: 'uppercase',
            color: themeVars.accentGreen,
            opacity: 0.8
        });

        const contentContainer = document.createElement('div');
        const progressView = document.createElement('div');
        const progressBarsContainer = document.createElement('div');
        Object.assign(progressBarsContainer.style, {
            display: 'grid',
            gap: '1.2em',
            margin: '1em 0'
        });

        const currentDayDisplay = document.createElement('div');
        Object.assign(currentDayDisplay.style, {
            fontSize: '0.85em',
            textAlign: 'center',
            marginTop: '1.5em',
            paddingTop: '1em',
            borderTop: `1px solid ${themeVars.borderColor}`,
            opacity: '0.9',
            color: themeVars.textColor
        });

        const calendarView = document.createElement('div');
        calendarView.style.display = 'none';

        // State variables
        let viewDate = new Date();
        let startDate = null;
        let endDate = null;
        let searchAuthor = 'all';
        let myUsername = null;

        try {
            const displayName = document.querySelector('.account__display-name[href*="/@"]');
            if (displayName) {
                const match = displayName.href.match(/@([\w-]+)/);
                if (match) myUsername = match[1];
            }
        } catch (e) {}

        // --- Date and Progress Update ---
        function updateHeadingsAndDate() {
            const now = new Date();
            dayHeading.textContent = `${now.getDate()}:${now.getMonth() + 1}`;
            dateHeading.textContent = `${now.getFullYear()}`;
            const panelDisplayLang = getCurrentPanelLanguage();
            currentDayDisplay.textContent = now.toLocaleDateString(
                panelDisplayLang,
                { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
            );
        }

        function createProgressItem(label, percentage, color) {
            const wrapper = document.createElement('div');

            const labelSpan = document.createElement('span');
            Object.assign(labelSpan.style, {
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.95em',
                marginBottom: '0.5em',
                color: themeVars.textColor
            });

            const textPart = document.createElement('span');
            textPart.textContent = label;

            const percentPart = document.createElement('span');
            percentPart.textContent = `${percentage.toFixed(1)}%`;
            percentPart.style.color = color;

            labelSpan.append(textPart, percentPart);

            const track = document.createElement('div');
            Object.assign(track.style, {
                height: '6px',
                background: `${themeVars.progressBarShadow}50`,
                borderRadius: '3px',
                overflow: 'hidden'
            });

            const fill = document.createElement('div');
            Object.assign(fill.style, {
                height: '100%',
                width: `${percentage.toFixed(1)}%`,
                background: color,
                borderRadius: '3px',
                transition: 'width 0.8s cubic-bezier(0.19, 1, 0.22, 1)'
            });

            track.appendChild(fill);
            wrapper.append(labelSpan, track);
            return wrapper;
        }

        function updateProgressBars() {
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startOfYear = new Date(now.getFullYear(), 0, 1);

            const dayProgress = ((now - startOfDay) / (24 * 60 * 60 * 1000)) * 100;
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const monthProgress = (now.getDate() / daysInMonth) * 100;
            const daysInYear = (new Date(now.getFullYear() + 1, 0, 1) - startOfYear) / (24*60*60*1000);
            const yearProgress = ((now - startOfYear) / (daysInYear * 24 * 60 * 60 * 1000)) * 100;

            progressBarsContainer.innerHTML = '';
            progressBarsContainer.append(
                createProgressItem(t('progressDay'), dayProgress, themeVars.accentRed),
                createProgressItem(t('progressMonth'), monthProgress, themeVars.accentGreen),
                createProgressItem(t('progressYear'), yearProgress, themeVars.accentPurple)
            );
        }

        // --- Calendar ---
        function drawCalendar() {
            calendarView.innerHTML = '';
            const year = viewDate.getFullYear();
            const month = viewDate.getMonth();
            const lang = getCurrentPanelLanguage();
            const monthName = new Date(year, month).toLocaleString(lang, { month: 'long' });

            const calHeader = document.createElement('div');
            Object.assign(calHeader.style, {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1em'
            });

            const prevBtn = document.createElement('button');
            prevBtn.textContent = '<';
            const nextBtn = document.createElement('button');
            nextBtn.textContent = '>';
            const monthLabel = document.createElement('span');
            monthLabel.textContent = `${monthName} ${year}`;
            monthLabel.style.color = themeVars.textColor;

            [prevBtn, nextBtn].forEach(btn => {
                Object.assign(btn.style, {
                    background: themeVars.progressBarShadow,
                    border: 'none',
                    borderRadius: '4px',
                    color: themeVars.textColor,
                    cursor: 'pointer',
                    padding: '0.3em 0.7em'
                });
                btn.onmouseover = () => btn.style.background = themeVars.accentGreen;
                btn.onmouseout = () => btn.style.background = themeVars.progressBarShadow;
            });

            prevBtn.onclick = () => { viewDate.setMonth(viewDate.getMonth() - 1); drawCalendar(); };
            nextBtn.onclick = () => { viewDate.setMonth(viewDate.getMonth() + 1); drawCalendar(); };

            calHeader.append(prevBtn, monthLabel, nextBtn);

            const daysGrid = document.createElement('div');
            Object.assign(daysGrid.style, {
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '5px',
                textAlign: 'center'
            });

            const weekdays = lang === 'ru' ?
                ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] :
                ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

            weekdays.forEach(day => {
                const el = document.createElement('div');
                el.textContent = day;
                Object.assign(el.style, {
                    fontSize: '0.8em',
                    color: themeVars.accentPurple
                });
                daysGrid.appendChild(el);
            });

            const firstDay = new Date(year, month, 1);
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            let startOffset = lang === 'ru' ?
                (firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1) :
                firstDay.getDay();

            for (let i = 1; i <= daysInMonth; i++) {
                const dayBtn = document.createElement('button');
                dayBtn.textContent = i;

                if (i === 1) {
                    dayBtn.style.gridColumnStart = startOffset + 1;
                }

                const thisDate = new Date(year, month, i);
                Object.assign(dayBtn.style, {
                    background: 'transparent',
                    border: '1px solid transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    padding: '0.5em 0',
                    borderRadius: '4px'
                });

                // Highlight selected dates
                if (startDate && endDate && thisDate >= startDate && thisDate <= endDate) {
                    dayBtn.style.background = themeVars.accentPurple + '80';
                }
                if (startDate && thisDate.getTime() === startDate.getTime()) {
                    dayBtn.style.background = themeVars.accentGreen;
                }
                if (endDate && thisDate.getTime() === endDate.getTime()) {
                    dayBtn.style.background = themeVars.accentGreen;
                }

                // Highlight today's date
                const today = new Date();
                if (thisDate.getDate() === today.getDate() &&
                    thisDate.getMonth() === today.getMonth() &&
                    thisDate.getFullYear() === today.getFullYear()) {
                    dayBtn.style.border = `1px solid ${themeVars.accentPurple}`;
                }

                dayBtn.onclick = () => {
                    if (!startDate || (startDate && endDate)) {
                        startDate = thisDate;
                        endDate = null;
                    } else {
                        endDate = thisDate;
                        if (endDate < startDate) {
                            [startDate, endDate] = [endDate, startDate];
                        }
                    }
                    drawCalendar();
                };

                daysGrid.appendChild(dayBtn);
            }

            const controls = document.createElement('div');
            Object.assign(controls.style, {
                marginTop: '1em',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.7em'
            });

            const authorFilter = document.createElement('div');
            authorFilter.style.display = 'flex';

            const myPostsBtn = document.createElement('button');
            myPostsBtn.textContent = t('myPosts');
            const allPostsBtn = document.createElement('button');
            allPostsBtn.textContent = t('allPosts');

            [myPostsBtn, allPostsBtn].forEach(btn => {
                Object.assign(btn.style, {
                    flex: 1,
                    border: `1px solid ${themeVars.borderColor}`,
                    padding: '0.5em',
                    cursor: 'pointer',
                    background: 'transparent',
                    color: 'inherit'
                });
            });

            function updateAuthorButtons() {
                myPostsBtn.style.background = searchAuthor === 'me' ? themeVars.accentGreen : 'transparent';
                allPostsBtn.style.background = searchAuthor === 'all' ? themeVars.accentGreen : 'transparent';
            }

            myPostsBtn.onclick = () => {
                if (!myUsername) return;
                searchAuthor = 'me';
                updateAuthorButtons();
            };

            allPostsBtn.onclick = () => {
                searchAuthor = 'all';
                updateAuthorButtons();
            };

            if (!myUsername) {
                myPostsBtn.disabled = true;
                myPostsBtn.style.opacity = '0.5';
            }

            authorFilter.append(myPostsBtn, allPostsBtn);

            const findBtn = document.createElement('button');
            findBtn.textContent = t('findPosts');
            Object.assign(findBtn.style, {
                background: themeVars.accentRed,
                border: 'none',
                padding: '0.8em',
                borderRadius: '4px',
                cursor: 'pointer',
                color: 'inherit',
                fontWeight: 'bold'
            });

            // Main search logic
            findBtn.onclick = () => {
                if (!startDate) return;
                if (!endDate) endDate = startDate;

                let queryParts = [];
                if (searchAuthor === 'me' && myUsername) {
                    queryParts.push(`from:@${myUsername}`);
                }

                const afterDate = new Date(startDate);
                afterDate.setDate(afterDate.getDate());
                queryParts.push(`after:${afterDate.toISOString().slice(0, 10)}`);

                const beforeDate = new Date(endDate);
                beforeDate.setDate(beforeDate.getDate() + 1);
                queryParts.push(`before:${beforeDate.toISOString().slice(0, 10)}`);

                const finalQuery = queryParts.join(' ');

                // If not on search page - copy to clipboard
                navigator.clipboard.writeText(finalQuery).then(() => {
                    showNotification(
                        t('notificationTitle'),
                        `${t('copiedToClipboard')}\n${t('goToExplore')}`
                    );
                }).catch(err => {
                    showNotification(
                        'Error',
                        `${t('copyError')} ${err.message}`,
                        false
                    );
                });
            };

            updateAuthorButtons();
            controls.append(authorFilter, findBtn);
            calendarView.append(calHeader, daysGrid, controls);
        }

        // Assemble panel
        header.append(dayHeading, dateHeading);
        progressView.append(progressBarsContainer, currentDayDisplay);
        contentContainer.append(progressView, calendarView);
        container.append(header, contentContainer);
        panelRoot.appendChild(container);
        targetElement.prepend(panelRoot);

        // Toggle between views
        header.addEventListener('click', () => {
            const isCalendarVisible = calendarView.style.display !== 'none';
            if (isCalendarVisible) {
                calendarView.style.display = 'none';
                progressView.style.display = 'block';
                header.title = t('calendarViewTitle');
            } else {
                drawCalendar();
                calendarView.style.display = 'block';
                progressView.style.display = 'none';
                header.title = t('progressViewTitle');
            }
        });

        // Initialization
        updateHeadingsAndDate();
        updateProgressBars();

        if (window[`${SCRIPT_ID_PREFIX}_intervalId`]) {
            clearInterval(window[`${SCRIPT_ID_PREFIX}_intervalId`]);
        }

        window[`${SCRIPT_ID_PREFIX}_intervalId`] = setInterval(() => {
            if (progressView.style.display !== 'none') {
                updateHeadingsAndDate();
                updateProgressBars();
            }
        }, config.updateInterval);
    }

    // --- Settings Menu ---
    function registerMenuCommands() {
        const menuTitlePrefix = t('settingsMenuTitle');
        const createColorPrompt = (colorKey, gmKey, promptTextKey) => {
            GM_registerMenuCommand(`${menuTitlePrefix}: ${t(promptTextKey).split(':')[0]} (current: ${config[colorKey]})`, () => {
                const newColor = prompt(t(promptTextKey), config[colorKey]);
                if (newColor !== null && /^#([0-9A-Fa-f]{3}){1,2}$/.test(newColor.trim())) {
                    config[colorKey] = newColor.trim();
                    GM_setValue(gmKey, config[colorKey]);
                    alert(`${t(promptTextKey).split(':')[0]} set to: ${config[colorKey]}. Panel will update/refresh.`);
                    initPanel();
                } else if (newColor !== null) {
                    alert('Invalid color format. Please use hex (e.g., #RRGGBB or #RGB).');
                }
            });
        };

        createColorPrompt('customAccentRed', 'customAccentRed', 'colorRedPrompt');
        createColorPrompt('customAccentGreen', 'customAccentGreen', 'colorGreenPrompt');
        createColorPrompt('customAccentPurple', 'customAccentPurple', 'colorPurplePrompt');
    }

    // --- Notification Styles ---
    GM_addStyle(`
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeOut {
            from { opacity: 1; transform: translateY(0); }
            to { opacity: 0; transform: translateY(-20px); }
        }
        @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
        }
    `);

    // --- Script Launch ---
    setTimeout(() => {
        initPanel();
        registerMenuCommands();

        // Automatic update on DOM changes
        const observer = new MutationObserver(() => {
            if (!document.getElementById(CALENDAR_ROOT_ID)) {
                initPanel();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }, config.initialDelay);
})();