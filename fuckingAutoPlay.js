// ==UserScript==
// @name         Bilibili AutoPlay Nuclear Terminator (Screenshot Fixed)
// @namespace    http://tampermonkey.net/
// @version      9.9.PRO
// @description  自动连播，自动开播 终极杀手
// @author       Alucard
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

    // --- 专家配置区：基于你截图的精确选择器 ---
    const TARGETS = {
        // [图1] 侧边栏/合集列表的自动连播开关 (关键特征: switch-btn + on)
        SIDEBAR_AUTO_NEXT: '.switch-btn.on',

        // [图2] 播放器设置菜单内的自动开播开关 (关键特征: input checkbox + checked)
        // 注意：B站设置菜单经常是懒加载的，但DOM中通常存在 input
        SETTING_AUTO_PLAY: '.bpx-player-ctrl-setting-autoplay input.bui-switch-input',

        // [补充] 播放器底部栏通用的自动连播开关 (以防万一)
        PLAYER_AUTO_NEXT: '.bpx-player-ctrl-autoplay.bpx-state-active'
    };

    const LOG_PREFIX = '[Bili-Killer]:';

    // --- 状态变量 ---
    let userInteracted = false; // 标记用户是否动手了

    // 1. 核心：重写媒体播放原型 (最底层的防线)
    // 无论开关显示什么，只要不是用户点的，就不准播！
    function initVideoInterceptor() {
        const originalPlay = HTMLMediaElement.prototype.play;

        HTMLMediaElement.prototype.play = function() {
            // 如果用户已经交互过（点击/按键），放行
            if (userInteracted) {
                return originalPlay.apply(this, arguments);
            }

            // 特殊判断：如果视频当前时间大于1秒，可能是暂停后的恢复，放行
            // 但如果是0秒附近的起播，且无交互，予以拦截
            if (this.currentTime < 0.5) {
                console.warn(LOG_PREFIX, '拦截到非法自动起播请求，已强制暂停！');
                this.pause();
                return Promise.reject('Auto-play blocked by UserScript.');
            }

            return originalPlay.apply(this, arguments);
        };
    }

    // 2. 行为白名单：区分"人"和"代码"
    function initUserDetection() {
        const activeEvents = ['mousedown', 'keydown', 'touchstart', 'pointerdown'];

        const unlock = () => {
            userInteracted = true;
            console.log(LOG_PREFIX, '检测到用户真实操作，解除封锁。');
            // 一旦用户操作，移除监听，节省性能
            activeEvents.forEach(e => window.removeEventListener(e, unlock, true));
        };

        activeEvents.forEach(e => window.addEventListener(e, unlock, true));
    }

    // 3. 针对图1和图2的暴力猎杀逻辑 (每500ms执行一次，永不停止)
    // 既然B站喜欢悄悄改状态，我们就比它更勤快
    function executeKillLoop() {
        setInterval(() => {
            // --- 任务A: 猎杀侧边栏自动连播 (图1) ---
            const sidebarSwitch = document.querySelector(TARGETS.SIDEBAR_AUTO_NEXT);
            if (sidebarSwitch) {
                console.log(LOG_PREFIX, '发现侧边栏【自动连播】开启中(图1)，正在关闭...');
                sidebarSwitch.click(); // 模拟点击触发Vue事件
            }

            // --- 任务B: 猎杀设置内自动开播 (图2) ---
            const settingInput = document.querySelector(TARGETS.SETTING_AUTO_PLAY);
            if (settingInput && settingInput.checked) {
                console.log(LOG_PREFIX, '发现内部设置【自动开播】开启中(图2)，正在关闭...');
                settingInput.click(); // 点击checkbox取消勾选
            }

            // --- 任务C: 猎杀播放器底部连播按钮 (补充) ---
            const playerNextBtn = document.querySelector(TARGETS.PLAYER_AUTO_NEXT);
            if (playerNextBtn) {
                console.log(LOG_PREFIX, '发现底部栏【自动连播】开启中，正在关闭...');
                playerNextBtn.click();
            }

        }, 500); // 0.5秒一次，既不卡顿也能秒杀状态回弹
    }

    // 4. 双重保险：强制锁定 LocalStorage 配置
    // 防止页面刷新瞬间B站读取旧配置
    function lockLocalStorage() {
        try {
            const key = 'bilibili_player_settings';
            let settings = localStorage.getItem(key);

            if (settings) {
                let json = JSON.parse(settings);
                // 强制修正两个核心参数
                if (json.video_status) {
                    let changed = false;
                    if (json.video_status.autoplay !== 0) {
                        json.video_status.autoplay = 0; // 关自动开播
                        changed = true;
                    }
                    if (json.video_status.autopart !== 0) {
                        json.video_status.autopart = 0; // 关自动连播
                        changed = true;
                    }
                    if (changed) {
                        localStorage.setItem(key, JSON.stringify(json));
                        console.log(LOG_PREFIX, '已修正本地配置防线。');
                    }
                }
            }
        } catch (e) {
            // 忽略JSON解析错误
        }
    }

    // --- 主程序入口 ---
    function main() {
        console.log(LOG_PREFIX, '专家防御系统启动 (截图适配版)...');

        // 1. 马上拦截视频流 (最快速度)
        initVideoInterceptor();

        // 2. 注册用户行为检测
        initUserDetection();

        // 3. 锁定本地配置
        lockLocalStorage();

        // 4. 启动无限巡逻 (针对UI开关)
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', executeKillLoop);
        } else {
            executeKillLoop();
        }
    }

    main();

})();
