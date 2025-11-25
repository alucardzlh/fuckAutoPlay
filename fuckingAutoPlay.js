// ==UserScript==
// @name         Bilibili AutoPlay Commander [2025 Expert Edition]
// @namespace    http://tampermonkey.net/
// @version      7.0.0
// @description  全权接管B站自动播放与自动连播。强制关闭自动连播，精准拦截自动开播，不影响手动播放。
// @author       Gemini & Alucard
// @match        *://www.bilibili.com/video/*
// @match        *://www.bilibili.com/list/*
// @match        *://www.bilibili.com/bangumi/play/*
// @icon         https://www.bilibili.com/favicon.ico
// @grant        none
// @run-at       document-start
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // --- 配置常量区 ---
    const CONFIG = {
        LOG_PREFIX: '[Bili Commander]:',
        CHECK_INTERVAL: 1000, // 检查周期(ms)，高频检测防止反弹
        SELECTORS: {
            // 播放器容器
            PLAYER: '#bilibili-player',
            // 自动连播开关按钮 (精确命中class)
            AUTO_NEXT_SWITCH: '.bpx-player-ctrl-autoplay',
            // 开关激活状态的class (B站通常用 bpx-state-active 或 aria-checked)
            SWITCH_ACTIVE_STATE: 'bpx-state-active',
            // 视频元素
            VIDEO_TAG: 'video'
        }
    };

    // --- 状态管理 ---
    const State = {
        userInteracted: false, // 用户是否进行了交互（点击/按键）
        currentUrl: window.location.href,
        autoPlayNextKilledCount: 0
    };

    // --- 核心工具函数 ---
    const Logger = {
        info: (msg) => console.log(`%c${CONFIG.LOG_PREFIX} ${msg}`, 'color: #00d1b2; font-weight: bold;'),
        warn: (msg) => console.warn(`${CONFIG.LOG_PREFIX} ${msg}`),
        success: (msg) => console.log(`%c${CONFIG.LOG_PREFIX} ${msg}`, 'color: #48c774; font-weight: bold;')
    };

    // --- 模块1：自动连播杀手 (Auto Play Next Killer) ---
    // 策略：查找开关元素，如果发现它处于“激活”状态，立即模拟点击将其关闭。
    // 强度：高 (使用 setInterval 持续强制执行)
    function executeAutoNextKiller() {
        const switchBtn = document.querySelector(CONFIG.SELECTORS.AUTO_NEXT_SWITCH);

        if (!switchBtn) {
            // 播放器可能还没加载完，暂时忽略
            return;
        }

        // 检测开关是否包含 "active" 类名，如果有，说明连播是开着的
        const isActive = switchBtn.classList.contains(CONFIG.SELECTORS.SWITCH_ACTIVE_STATE);

        if (isActive) {
            Logger.info('检测到【自动连播】处于开启状态，正在执行强制关闭...');

            // 方法A: 模拟点击 (模拟真实用户行为)
            switchBtn.click();

            // 方法B (备用): 如果点击没反应，尝试直接移除类名 (视觉欺骗 + 状态破坏)
            // switchBtn.classList.remove(CONFIG.SELECTORS.SWITCH_ACTIVE_STATE);

            State.autoPlayNextKilledCount++;
            Logger.success(`自动连播已强制关闭。本次会话已拦截次数: ${State.autoPlayNextKilledCount}`);
        }
    }

    // --- 模块2：自动开播杀手 (Auto Start Killer) ---
    // 策略：劫持 video 标签的 play 事件。如果是脚本/页面自动触发的，则暂停；如果是用户操作，则放行。
    function initAutoStartInterceptor() {
        Logger.info('初始化自动开播拦截系统...');

        // 1. 监听用户交互，建立“白名单”
        // 当用户点击页面任何地方，或按下键盘时，我们认为接下来的播放是合法的
        const allowPlay = () => {
            State.userInteracted = true;
            // Logger.info('用户已交互，解除播放锁定。');
        };

        // 使用捕获阶段，确保先于播放器逻辑触发
        window.addEventListener('click', allowPlay, true);
        window.addEventListener('keydown', allowPlay, true);

        // 2. 核心：定时检测视频状态
        // 为什么不用 hook video.play? 因为 B站播放器逻辑复杂，hook 可能会导致播放器报错卡死。
        // “事后诸葛亮”策略更稳健：一旦发现它在没交互的情况下开始走了，就立刻按停。
        setInterval(() => {
            const video = document.querySelector('video');
            if (!video) return;

            // 如果视频正在播放 (currentTime > 0 或 !paused) 且 用户没交互过
            // 且 视频刚开始播放 (currentTime < 1.5秒，防止误伤看了一半切出去的情况)
            if (!video.paused && !State.userInteracted && video.currentTime < 1.5) {
                video.pause();
                video.currentTime = 0; // 拉回开头
                Logger.warn('检测到【自动开播】行为，已强制暂停！等待用户手动播放。');
            }
        }, 200); // 200ms 检测一次，人眼几乎无感
    }

    // --- 模块3：SPA (单页应用) 导航监听 ---
    // B站点击视频往往不刷新页面，需要重置状态
    function initNavigationObserver() {
        // 覆写 history.pushState 和 replaceState 来监听路由变化
        const _historyWrap = function(type) {
            const orig = history[type];
            return function() {
                const rv = orig.apply(this, arguments);
                const e = new Event(type);
                e.arguments = arguments;
                window.dispatchEvent(e);
                return rv;
            };
        };
        history.pushState = _historyWrap('pushState');
        history.replaceState = _historyWrap('replaceState');

        const resetState = () => {
            if (window.location.href !== State.currentUrl) {
                Logger.info('检测到页面跳转 (SPA)，重置拦截状态...');
                State.currentUrl = window.location.href;
                State.userInteracted = false; // 重置交互状态，新视频需要新点击
            }
        };

        window.addEventListener('pushState', resetState);
        window.addEventListener('replaceState', resetState);
        window.addEventListener('popstate', resetState); // 监听后退

        // 针对B站内部可能的自定义事件，也挂载一个定时检查URL
        setInterval(resetState, 1000);
    }

    // --- 主执行逻辑 (Main Thread) ---
    function main() {
        Logger.info('系统启动。正在部署防御措施...');

        // 1. 启动自动开播拦截
        initAutoStartInterceptor();

        // 2. 启动自动连播检测哨兵 (永久循环)
        setInterval(executeAutoNextKiller, CONFIG.CHECK_INTERVAL);

        // 3. 启动导航监听
        initNavigationObserver();

        // 4. 首次运行时的额外清理 (针对 LocalStorage)
        try {
            const key = 'bilibili_player_settings';
            const settings = JSON.parse(localStorage.getItem(key));
            if (settings && settings.video_status && settings.video_status.autopart === 1) {
                settings.video_status.autopart = 0;
                localStorage.setItem(key, JSON.stringify(settings));
                Logger.success('已修正 LocalStorage 中的自动连播设置。');
            }
        } catch (e) {
            // 忽略错误，这是次要防御
        }
    }

    // 确保在 DOM 加载后尽快运行，但不阻塞
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }

})();
