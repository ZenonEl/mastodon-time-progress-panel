// ==UserScript==
// @name         Mastodon Time & Progress Panel
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
            advancedFilters: 'Advanced filters',
            contentType: 'Content type:',
            postType: 'Post type:',
            searchScope: 'Search scope:',
            startDate: 'Start date',
            endDate: 'End date',
            apply: 'Apply',
            language: 'Language'
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
            advancedFilters: 'Дополнительные фильтры',
            contentType: 'Тип контента:',
            postType: 'Тип поста:',
            searchScope: 'Область поиска:',
            startDate: 'Начальная дата',
            endDate: 'Конечная дата',
            apply: 'Применить',
            language: 'Язык'
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
            opacity: '0.9'
        });

        const calendarView = document.createElement('div');
        calendarView.style.display = 'none';

        // State variables
        let viewDate = new Date();
        let startDate = null;
        let endDate = null;
        let searchAuthor = GM_getValue('searchAuthor', 'all');
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
                marginBottom: '0.5em'
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

            [prevBtn, nextBtn].forEach(btn => {
                Object.assign(btn.style, {
                    background: themeVars.progressBarShadow,
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: 'inherit',
                    padding: '0.3em 0.7em'
                });
            });

            prevBtn.onclick = () => { viewDate.setMonth(viewDate.getMonth() - 1); drawCalendar(); };
            nextBtn.onclick = () => { viewDate.setMonth(viewDate.getMonth() + 1); drawCalendar(); };

            calHeader.append(prevBtn, monthLabel, nextBtn);

            const daysGrid = document.createElement('div');
            Object.assign(daysGrid.style, {
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '5px',
                color: 'inherit',
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
                    cursor: 'pointer',
                    padding: '0.5em 0',
                    color: 'inherit',
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
                    updateAuthorButtons();
                };

                daysGrid.appendChild(dayBtn);
            }

            // --- Date Input Fields ---
            const dateInputsContainer = document.createElement('div');
            Object.assign(dateInputsContainer.style, {
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5em',
                marginBottom: '1em'
            });

            const startDateLabel = document.createElement('label');
            startDateLabel.textContent = t('startDate');
            startDateLabel.style.fontSize = '0.9em';

            const startDateInput = document.createElement('input');
            startDateInput.type = 'text';
            startDateInput.placeholder = 'YYYY-MM-DD';
            Object.assign(startDateInput.style, {
                padding: '0.5em',
                borderRadius: '4px',
                border: `1px solid ${themeVars.borderColor}`,
                background: 'transparent',
                color: 'inherit'
            });

            const endDateLabel = document.createElement('label');
            endDateLabel.textContent = t('endDate');
            endDateLabel.style.fontSize = '0.9em';

            const endDateInput = document.createElement('input');
            endDateInput.type = 'text';
            endDateInput.placeholder = 'YYYY-MM-DD';
            Object.assign(endDateInput.style, {
                padding: '0.5em',
                borderRadius: '4px',
                border: `1px solid ${themeVars.borderColor}`,
                color: 'inherit',
                background: 'transparent'
            });

            const applyDatesBtn = document.createElement('button');
            applyDatesBtn.textContent = t('apply');
            Object.assign(applyDatesBtn.style, {
                background: themeVars.accentGreen,
                border: 'none',
                padding: '0.5em',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                marginTop: '0.5em',
                color: 'inherit'
            });

            applyDatesBtn.onclick = () => {
                const startValue = startDateInput.value.trim();
                const endValue = endDateInput.value.trim();

                const parseDate = (dateStr) => {
                    if (!dateStr) return null;
                    const parts = dateStr.split(/[\s.,\-/]+/);
                    if (parts.length === 3) {
                        const year = parseInt(parts[0]);
                        const month = parseInt(parts[1]) - 1;
                        const day = parseInt(parts[2]);
                        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                            return new Date(year, month, day);
                        }
                    }
                    return null;
                };

                startDate = parseDate(startValue);
                endDate = parseDate(endValue);

                if (startDate && endDate && endDate < startDate) {
                    [startDate, endDate] = [endDate, startDate];
                }

                drawCalendar();
                updateAuthorButtons();

                if (startDate || endDate) {
                    let message = '';
                    if (startDate && endDate && startDate.getTime() === endDate.getTime()) {
                        message = t('copiedToClipboard') + '\n' +
                            `Выбрана дата: ${startDate.toLocaleDateString()}`;
                    } else if (startDate && endDate) {
                        message = t('copiedToClipboard') + '\n' +
                            `Выбран период: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
                    } else if (startDate) {
                        message = t('copiedToClipboard') + '\n' +
                            `Выбрана начальная дата: ${startDate.toLocaleDateString()}`;
                    } else {
                        message = t('copiedToClipboard') + '\n' +
                            `Выбрана конечная дата: ${endDate.toLocaleDateString()}`;
                    }

                    showNotification(
                        t('notificationTitle'),
                        message + '\n' + t('goToExplore')
                    );
                } else {
                    showNotification(
                        t('notificationTitle'),
                        'Пожалуйста, укажите хотя бы одну дату',
                        false
                    );
                }
            };

            dateInputsContainer.append(
                startDateLabel,
                startDateInput,
                endDateLabel,
                endDateInput,
                applyDatesBtn
            );

            // --- Author Filter ---
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
                myPostsBtn.style.fontWeight = searchAuthor === 'me' ? 'bold' : 'normal';
                allPostsBtn.style.fontWeight = searchAuthor === 'all' ? 'bold' : 'normal';
            }

            myPostsBtn.onclick = () => {
                if (!myUsername) return;
                searchAuthor = 'me';
                GM_setValue('searchAuthor', searchAuthor);
                updateAuthorButtons();
            };

            allPostsBtn.onclick = () => {
                searchAuthor = 'all';
                GM_setValue('searchAuthor', searchAuthor);
                updateAuthorButtons();
            };

            if (!myUsername) {
                myPostsBtn.disabled = true;
                myPostsBtn.style.opacity = '0.5';
            }

            authorFilter.append(myPostsBtn, allPostsBtn);
            updateAuthorButtons();

            // --- Advanced Filters Section ---
            const filtersToggleBtn = document.createElement('button');
            filtersToggleBtn.innerHTML = '⌄ ' + t('advancedFilters');
            Object.assign(filtersToggleBtn.style, {
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.9em',
                padding: '5px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                margin: '0 auto 15px auto',
                color: themeVars.accentPurple,
                width: '100%',
                justifyContent: 'center',
                transition: 'color 0.2s ease'
            });

            filtersToggleBtn.addEventListener('mouseenter', () => {
                filtersToggleBtn.style.color = themeVars.accentGreen;
            });
            filtersToggleBtn.addEventListener('mouseleave', () => {
                filtersToggleBtn.style.color = themeVars.accentPurple;
            });

            const filtersContainer = document.createElement('div');
            filtersContainer.style.display = 'none';
            filtersContainer.style.marginTop = '10px';

            // Content Type Filters (has:)
            const contentTypeGroup = document.createElement('div');
            contentTypeGroup.style.marginBottom = '15px';

            const contentTypeLabel = document.createElement('div');
            contentTypeLabel.textContent = t('contentType');
            Object.assign(contentTypeLabel.style, {
                marginBottom: '8px',
                fontSize: '0.85em',
                opacity: 0.9
            });

            const contentTypeButtons = document.createElement('div');
            Object.assign(contentTypeButtons.style, {
                display: 'flex',
                flexWrap: 'wrap',
                color: themeVars.accentPurple,
                gap: '8px'
            });

            ['media', 'poll', 'embed'].forEach(type => {
                const btn = document.createElement('button');
                btn.textContent = `has:${type}`;
                Object.assign(btn.style, {
                    background: 'transparent',
                    border: `1px solid ${themeVars.borderColor}`,
                    borderRadius: '4px',
                    padding: '6px 10px',
                    fontSize: '0.85em',
                    cursor: 'pointer',
                    color: 'inherit',
                    transition: 'all 0.2s ease'
                });

                btn.addEventListener('mouseenter', () => {
                    btn.style.background = `${themeVars.progressBarShadow}30`;
                });
                btn.addEventListener('mouseleave', () => {
                    btn.style.background = 'transparent';
                });

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.name = 'has';
                checkbox.value = type;
                checkbox.style.display = 'none';

                btn.addEventListener('click', () => {
                    checkbox.checked = !checkbox.checked;
                    btn.style.background = checkbox.checked ? `${themeVars.accentGreen}80` : 'transparent';
                    btn.style.borderColor = checkbox.checked ? themeVars.accentGreen : themeVars.borderColor;
                    btn.style.color = checkbox.checked ? themeVars.accentGreen : themeVars.accentPurple;
                });

                contentTypeButtons.appendChild(btn);
                contentTypeButtons.appendChild(checkbox);
            });

            contentTypeGroup.append(contentTypeLabel, contentTypeButtons);

            // Post Type Filters (is:)
            const postTypeGroup = document.createElement('div');
            postTypeGroup.style.marginBottom = '15px';

            const postTypeLabel = document.createElement('div');
            postTypeLabel.textContent = t('postType');
            Object.assign(postTypeLabel.style, {
                marginBottom: '8px',
                fontSize: '0.85em',
                opacity: 0.9
            });

            const postTypeButtons = document.createElement('div');
            Object.assign(postTypeButtons.style, {
                display: 'flex',
                flexWrap: 'wrap',
                color: themeVars.accentPurple,
                gap: '8px'
            });

            ['reply', 'sensitive'].forEach(type => {
                const btn = document.createElement('button');
                btn.textContent = `is:${type}`;
                Object.assign(btn.style, {
                    background: 'transparent',
                    border: `1px solid ${themeVars.borderColor}`,
                    borderRadius: '4px',
                    padding: '6px 10px',
                    fontSize: '0.85em',
                    cursor: 'pointer',
                    color: 'inherit',
                    transition: 'all 0.2s ease'
                });

                btn.addEventListener('mouseenter', () => {
                    btn.style.background = `${themeVars.progressBarShadow}30`;
                });
                btn.addEventListener('mouseleave', () => {
                    btn.style.background = 'transparent';
                });

                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = 'is';
                radio.value = type;
                radio.style.display = 'none';

                btn.addEventListener('click', () => {
                    if (radio.checked) {
                        radio.checked = false;
                        btn.style.background = 'transparent';
                        btn.style.color = themeVars.accentPurple;
                        btn.style.borderColor = themeVars.borderColor;
                    } else {
                        document.querySelectorAll('input[name="is"]').forEach(r => {
                            r.checked = false;
                            const associatedBtn = r.previousElementSibling;
                            if (associatedBtn) {
                                associatedBtn.style.background = 'transparent';
                                associatedBtn.style.borderColor = themeVars.borderColor;
                                associatedBtn.style.color = themeVars.accentPurple;
                            }
                        });
                        radio.checked = true;
                        btn.style.background = `${themeVars.accentGreen}80`;
                        btn.style.color = themeVars.accentGreen;
                        btn.style.borderColor = themeVars.accentGreen;
                    }
                });

                postTypeButtons.appendChild(btn);
                postTypeButtons.appendChild(radio);
            });

            postTypeGroup.append(postTypeLabel, postTypeButtons);

            // Language Selector
            const languageGroup = document.createElement('div');
            languageGroup.style.marginBottom = '15px';

            const languageLabel = document.createElement('div');
            languageLabel.textContent = t('language') + ':';
            Object.assign(languageLabel.style, {
                marginBottom: '8px',
                fontSize: '0.85em',
                opacity: 0.9
            });

            const languageSelect = document.createElement('select');
            languageSelect.name = 'language';
            Object.assign(languageSelect.style, {
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: `1px solid ${themeVars.borderColor}`,
                background: 'transparent',
                color: themeVars.accentGreen,
                fontSize: '0.9em'
            });

            ['', 'ru', 'en'].forEach(lang => {
                const option = document.createElement('option');
                option.value = lang;
                option.textContent = lang === '' ? 'Any' :
                lang === 'ru' ? 'Русский' : 'English';
                if (lang === getCurrentPanelLanguage()) option.selected = true;
                languageSelect.appendChild(option);
            });

            languageGroup.append(languageLabel, languageSelect);

            // Search Scope (in:)
            const searchScopeGroup = document.createElement('div');
            searchScopeGroup.style.marginBottom = '15px';

            const searchScopeLabel = document.createElement('div');
            searchScopeLabel.textContent = t('searchScope');
            Object.assign(searchScopeLabel.style, {
                marginBottom: '8px',
                fontSize: '0.85em',
                opacity: 0.9
            });

            const searchScopeButtons = document.createElement('div');
            Object.assign(searchScopeButtons.style, {
                display: 'flex',
                flexWrap: 'wrap',
                color: themeVars.accentPurple,
                gap: '8px'
            });

            ['all', 'library', 'public'].forEach(scope => {
                const btn = document.createElement('button');
                btn.textContent = `in:${scope}`;
                Object.assign(btn.style, {
                    background: 'transparent',
                    border: `1px solid ${scope === 'all' ? themeVars.accentGreen : themeVars.borderColor}`,
                    borderRadius: '4px',
                    padding: '6px 10px',
                    fontSize: '0.85em',
                    cursor: 'pointer',
                    color: scope === 'all' ? `${themeVars.accentGreen}` : themeVars.accentPurple,
                    transition: 'all 0.2s ease'
                });

                btn.addEventListener('mouseenter', () => {
                    if (!btn.style.background.includes(themeVars.accentGreen)) {
                        btn.style.background = `${themeVars.progressBarShadow}30`;
                    }
                });
                btn.addEventListener('mouseleave', () => {
                    if (!btn.style.background.includes(themeVars.accentGreen)) {
                        btn.style.background = 'transparent';
                    }
                });

                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = 'in';
                radio.value = scope;
                radio.style.display = 'none';
                if (scope === 'all') radio.checked = true;

                btn.addEventListener('click', () => {
                    document.querySelectorAll('input[name="in"]').forEach(r => {
                        r.checked = false;
                        const associatedBtn = r.previousElementSibling;
                        if (associatedBtn) {
                            associatedBtn.style.background = 'transparent';
                            associatedBtn.style.borderColor = themeVars.borderColor;
                            associatedBtn.style.color = themeVars.accentPurple;
                        }
                    });
                    radio.checked = true;
                    btn.style.background = `${themeVars.accentGreen}80`;
                    btn.style.color = themeVars.accentGreen;
                    btn.style.borderColor = themeVars.accentGreen;
                });

                searchScopeButtons.appendChild(btn);
                searchScopeButtons.appendChild(radio);
            });

            searchScopeGroup.append(searchScopeLabel, searchScopeButtons);

            filtersContainer.append(contentTypeGroup, postTypeGroup, languageGroup, searchScopeGroup);

            // Toggle filters visibility
            filtersToggleBtn.onclick = () => {
                const filtersVisible = filtersContainer.style.display === 'block';

                filtersContainer.style.display = filtersVisible ? 'none' : 'block';

                // Переключаем видимость календаря
                if (calHeader.parentNode) {
                    calHeader.style.display = filtersVisible ? 'flex' : 'none';
                }
                if (daysGrid.parentNode) {
                    daysGrid.style.display = filtersVisible ? 'grid' : 'none';
                }

                filtersToggleBtn.innerHTML = filtersVisible
                    ? '⌄ ' + t('advancedFilters')
                : '⌃ ' + t('advancedFilters');
            };

            // Добавляем кнопку сразу под заголовком
            calendarView.appendChild(filtersToggleBtn);

            // Контейнер для календаря
            const calendarContainer = document.createElement('div');
            calendarContainer.append(calHeader, daysGrid);
            calendarView.appendChild(calendarContainer);

            // Добавляем фильтры в календарный вид
            calendarView.appendChild(filtersContainer);

            // Добавляем остальные элементы
            calendarView.append(dateInputsContainer, authorFilter);

            // Find Posts Button
            const findBtn = document.createElement('button');
            findBtn.textContent = t('findPosts');
            Object.assign(findBtn.style, {
                background: themeVars.accentRed,
                border: 'none',
                padding: '0.8em',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                marginTop: '10px',
                width: '100%',
                color: 'inherit'
            });

            findBtn.onclick = () => {
                let queryParts = [];

                // Author filter
                if (searchAuthor === 'me' && myUsername) {
                    queryParts.push(`from:@${myUsername}`);
                }

                // Date filters
                if (startDate || endDate) {
                    if (startDate && endDate && startDate.getTime() === endDate.getTime()) {
                        // Используем during если выбрана одна и та же дата
                        queryParts.push(`during:${startDate.toISOString().slice(0, 10)}`);
                    } else {
                        if (startDate) queryParts.push(`after:${startDate.toISOString().slice(0, 10)}`);
                        if (endDate) {
                            const beforeDate = new Date(endDate);
                            beforeDate.setDate(beforeDate.getDate() + 1);
                            queryParts.push(`before:${beforeDate.toISOString().slice(0, 10)}`);
                        }
                    }
                }

                // Advanced filters
                document.querySelectorAll('input[name="has"]:checked').forEach(checkbox => {
                    queryParts.push(`has:${checkbox.value}`);
                });

                const isType = document.querySelector('input[name="is"]:checked');
                if (isType) queryParts.push(`is:${isType.value}`);

                const language = document.querySelector('select[name="language"]').value;
                if (language) queryParts.push(`language:${language}`);

                const inScope = document.querySelector('input[name="in"]:checked');
                if (inScope) queryParts.push(`in:${inScope.value}`);

                // Validation
                if (queryParts.length === 0 || (queryParts.length === 1 && queryParts[0].startsWith('from:'))) {
                    showNotification(
                        'Error',
                        'Please specify at least one date or filter',
                        false
                    );
                    return;
                }

                const finalQuery = queryParts.join(' ');

                navigator.clipboard.writeText(finalQuery).then(() => {
                    showNotification(
                        t('notificationTitle'),
                        `${t('copiedToClipboard')}\n${finalQuery}\n${t('goToExplore')}`
                    );
                }).catch(err => {
                    showNotification(
                        'Error',
                        `Failed to copy: ${err.message}`,
                        false
                    );
                });
            };

            calendarView.appendChild(findBtn);
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