// ==UserScript==
// @name         Mastodon Time & Progress Panel
// @namespace    https://github.com/ZenonEl
// @version      1.7.4
// @description  Adds a stylish panel to the Mastodon interface, displaying the current date and visual progress bars for the day, month, and year.
// @description:ru Добавляет стильную панель с текущей датой и наглядными прогресс-барами (день, месяц, год) в интерфейс Mastodon.
// @author       ZenonEl
// @license      GPL-3.0-or-later
//
// @match        https://mastodon.ml/*
// @match        https://fosstodon.org/*
//
// @icon         https://www.google.com/s2/favicons?sz=64&domain=joinmastodon.org
//
// @homepageURL  https://github.com/ZenonEl/mastodon-time-progress-panel
// @supportURL   https://github.com/ZenonEl/mastodon-time-progress-panel/issues
// @downloadURL  https://raw.githubusercontent.com/ZenonEl/mastodon-time-progress-panel/main/mastodon-time-progress-panel.user.js
// @updateURL    https://raw.githubusercontent.com/ZenonEl/mastodon-time-progress-panel/main/mastodon-time-progress-panel.user.js
//
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
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
            progressDay: 'This Day', progressMonth: 'This Month', progressYear: 'This Year',
            settingsMenuTitle: 'Panel Settings',
            colorRedPrompt: 'Enter custom RED accent color (hex):',
            colorGreenPrompt: 'Enter custom GREEN accent color (hex):',
            colorPurplePrompt: 'Enter custom PURPLE accent color (hex):',
        },
        ru: {
            targetNotFound: '❌ Целевой элемент для панели не найден!',
            progressDay: 'Этот день', progressMonth: 'Этот месяц', progressYear: 'Этот год',
            settingsMenuTitle: 'Настройки панели',
            colorRedPrompt: 'Введите свой КРАСНЫЙ акцентный цвет (hex):',
            colorGreenPrompt: 'Введите свой ЗЕЛЕНЫЙ акцентный цвет (hex):',
            colorPurplePrompt: 'Введите свой ФИОЛЕТОВЫЙ акцентный цвет (hex):',
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

    const observerConfig = { childList: true, subtree: true, attributes: false, characterData: false };

    function initPanel() {
        const targetElement = document.querySelector(config.targetSelector);
        if (!targetElement) {
            console.error(t('targetNotFound'));
            return;
        }

        const existingPanel = document.getElementById(CALENDAR_ROOT_ID);
        if (existingPanel) existingPanel.remove();

        const panelRoot = document.createElement('div');
        panelRoot.id = CALENDAR_ROOT_ID;

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

        Object.assign(panelRoot.style, {
            fontFamily: 'inherit', margin: '15px', position: 'relative', zIndex: '1', fontSize: '0.9rem'
        });

        const container = document.createElement('div');
        Object.assign(container.style, {
            padding: '1.2em', borderRadius: '12px',
            border: `1px solid ${themeVars.borderColor}`,
            transition: 'opacity 0.3s ease'
        });

        const header = document.createElement('div');
        Object.assign(header.style, {
            textAlign: 'center', marginBottom: '1.5em',
            borderBottom: `1px solid ${themeVars.borderColor}`, paddingBottom: '1em'
        });

        const dayHeading = document.createElement('h2'); // e.g., "8:5"
        Object.assign(dayHeading.style, {
            fontSize: '1.8em', margin: '0',
            fontWeight: '500', letterSpacing: '-0.03em'
        });

        const dateHeading = document.createElement('h3'); // e.g., "2025"
        Object.assign(dateHeading.style, {
            fontSize: '0.9em',
            margin: '0.3em 0', textTransform: 'uppercase'
        });

        const progressBarsContainer = document.createElement('div');
        Object.assign(progressBarsContainer.style, { display: 'grid', gap: '1.2em', margin: '1em 0' });

        const currentDayDisplay = document.createElement('div'); // e.g., "Thursday, May 8, 2025"
        Object.assign(currentDayDisplay.style, {
            fontSize: '0.85em',
            textAlign: 'center', marginTop: '1.5em', paddingTop: '1em',
            borderTop: `1px solid ${themeVars.borderColor}`, opacity: '0.9'
        });

        const updateHeadingsAndDate = () => {
            const now = new Date();
            dayHeading.textContent = `${now.getDate()}:${now.getMonth() + 1}`;
            dateHeading.textContent = `${now.getFullYear()}`;
            const panelDisplayLang = getCurrentPanelLanguage();
            currentDayDisplay.textContent = now.toLocaleDateString(panelDisplayLang, {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
        };

        const createProgressItem = (label, percentage, color) => {
            const wrapper = document.createElement('div');
            const labelSpan = document.createElement('span');
            Object.assign(labelSpan.style, {
                display: 'flex', justifyContent: 'space-between', fontSize: '0.95em',
                marginBottom: '0.5em'
            });
            const textPart = document.createElement('span'); textPart.textContent = label;
            const percentPart = document.createElement('span');
            percentPart.textContent = `${percentage.toFixed(1)}%`;
            percentPart.style.color = color;
            labelSpan.append(textPart, percentPart);

            const track = document.createElement('div');
            Object.assign(track.style, {
                height: '6px', background: `${themeVars.progressBarShadow}50`,
                borderRadius: '3px', overflow: 'hidden'
            });
            const fill = document.createElement('div');
            Object.assign(fill.style, {
                height: '100%', width: `${percentage.toFixed(1)}%`, background: color,
                borderRadius: '3px', transition: 'width 0.8s cubic-bezier(0.19, 1, 0.22, 1)'
            });
            track.appendChild(fill);
            wrapper.append(labelSpan, track);
            return wrapper;
        };

        const updateProgressBars = () => {
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
        };

        header.append(dayHeading, dateHeading);
        container.append(header, progressBarsContainer, currentDayDisplay);
        panelRoot.appendChild(container);
        targetElement.prepend(panelRoot);

        updateHeadingsAndDate();
        updateProgressBars();

        if (window[`${SCRIPT_ID_PREFIX}_intervalId`]) clearInterval(window[`${SCRIPT_ID_PREFIX}_intervalId`]);
        window[`${SCRIPT_ID_PREFIX}_intervalId`] = setInterval(() => {
            updateHeadingsAndDate();
            updateProgressBars();
        }, config.updateInterval);
    }

    const observer = new MutationObserver(() => {
        if (!document.getElementById(CALENDAR_ROOT_ID)) initPanel();
    });

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

    setTimeout(() => {
        initPanel();
        observer.observe(document.body, observerConfig);
        registerMenuCommands();
    }, config.initialDelay);

})();