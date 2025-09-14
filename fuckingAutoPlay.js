// ==UserScript==
// @name         Bilibili AutoPlay Killer (Optimized - MutationObserver)
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  【推荐】高效、永久关闭B站所有自动播放，适配动态加载
// @author       alucard·D·Zhang
// @match        https://www.bilibili.com/*
// @icon         https://www.bilibili.com/favicon.ico
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // 定义处理函数：当发现 video 标签时进行处理
    const stopAutoplay = (video) => {
        if (video.tagName !== 'VIDEO') return;

        // B站播放器有一个特殊的属性，我们将其设置为 true 来标记已处理
        if (video.dataset.autoplayKillerProcessed) return;

        video.dataset.autoplayKillerProcessed = true; // 标记已处理，避免重复操作

        // 核心：直接暂停视频
        video.pause();

        // 移除 autoplay 属性并设置 preload='none'
        if (video.hasAttribute('autoplay')) {
            video.removeAttribute('autoplay');
        }
        video.preload = 'none';

        // 监听 canplay 事件，确保在视频准备好播放时再次暂停
        // 因为B站的JS逻辑可能会在之后再次尝试播放
        video.addEventListener('canplay', () => {
            video.pause();
        }, { once: true }); // { once: true } 确保监听器只执行一次后自动移除
    };

    // 创建一个 MutationObserver 实例来监听整个文档的变动
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            // 检查是否有新节点被添加
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    // 如果添加的节点是元素节点 (Element)
                    if (node.nodeType === 1) {
                        // 如果节点本身就是 video 标签
                        if (node.tagName === 'VIDEO') {
                            stopAutoplay(node);
                        }
                        // 否则，在节点内部查找 video 标签
                        const videos = node.querySelectorAll('video');
                        videos.forEach(stopAutoplay);
                    }
                });
            }
        }
    });

    // 配置 MutationObserver
    const config = {
        childList: true, // 监听子节点的变动（添加或删除）
        subtree: true    // 监听后代所有节点的变动
    };

    // 在文档的根节点上启动监听
    observer.observe(document.documentElement, config);
})();
