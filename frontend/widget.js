/**
 * DamayAI Chat Widget — Embeddable assistant for SMKN 2 Indramayu
 * 
 * Usage: Add this to any website:
 *   <script src="https://YOUR_RAILWAY_URL/widget.js"></script>
 * 
 * The widget auto-detects the server URL from its own script src.
 */
(function () {
    'use strict';

    // ============================================================
    //  CONFIG — auto-detect server URL from script src
    // ============================================================
    const scriptTag = document.currentScript || (function () {
        const scripts = document.getElementsByTagName('script');
        return scripts[scripts.length - 1];
    })();
    const WIDGET_BASE_URL = scriptTag.src.replace(/\/widget\.js.*$/, '');

    // ============================================================
    //  STYLES — injected into shadow DOM to avoid conflicts
    // ============================================================
    // SVG icon definitions (inline to avoid Shadow DOM font-loading issues)
    const ICONS = {
        comments: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" fill="currentColor"><path d="M208 0C93.1 0 0 78.1 0 174.5c0 44.2 21.4 84.5 56.6 115.1L32 368l90.5-49.7C150 330 178.5 349 208 349c114.9 0 208-78.1 208-174.5S322.9 0 208 0zm0 317c-24 0-47.2-4.2-69.1-12.5L98 322.5l20.4-56.2C93.1 243.9 80 209.6 80 174.5 80 105.3 137.3 48 208 48s128 57.3 128 126.5S278.7 317 208 317zM504 176c-17.6 0-34.4 2.1-50.2 5.9c1.4 10.5 2.2 21.2 2.2 32.1c0 113.8-103.1 206-230 206c-6.9 0-13.7-.3-20.4-.9C237.4 449 295.1 512 504 512c29.5 0 58-5.3 84.5-15.3L680 544l-32.6-78.4C680.6 436.5 702 396.2 702 352c0-96.4-84.2-176-198-176z"/></svg>`,
        xmark: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3l105.4 105.3c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256l105.3-105.4z"/></svg>`,
        robot: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" fill="currentColor"><path d="M320 0c17.7 0 32 14.3 32 32v64h120c48.6 0 88 39.4 88 88v272c0 48.6-39.4 88-88 88H168c-48.6 0-88-39.4-88-88V184c0-48.6 39.4-88 88-88h120V32c0-17.7 14.3-32 32-32zM208 384c35.3 0 64-28.7 64-64s-28.7-64-64-64s-64 28.7-64 64s28.7 64 64 64zm224-64c0-35.3-28.7-64-64-64s-64 28.7-64 64s28.7 64 64 64s64-28.7 64-64zM64 224c-17.7 0-32 14.3-32 32v64c0 17.7 14.3 32 32 32s32-14.3 32-32v-64c0-17.7-14.3-32-32-32zm512 0c-17.7 0-32 14.3-32 32v64c0 17.7 14.3 32 32 32s32-14.3 32-32v-64c0-17.7-14.3-32-32-32z"/></svg>`,
        plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32v144H48c-17.7 0-32 14.3-32 32s14.3 32 32 32h144v144c0 17.7 14.3 32 32 32s32-14.3 32-32V288h144c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"/></svg>`,
        arrowUp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor"><path d="M214.6 41.4c-12.5-12.5-32.8-12.5-45.3 0l-160 160c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 109.3l137.4 137.3c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-160-160z"/></svg>`,
        user: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z"/></svg>`,
    };

    function icon(name, cls = '') {
        return `<span class="damayai-icon ${cls}" aria-hidden="true">${ICONS[name] || ''}</span>`;
    }

    const WIDGET_CSS = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        /* Inline SVG icons */
        .damayai-icon { display: inline-flex; align-items: center; justify-content: center; }
        .damayai-icon svg { width: 1em; height: 1em; fill: currentColor; }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        :host {
            --w-primary: #4f46e5;
            --w-primary-hover: #4338ca;
            --w-bg: #ffffff;
            --w-bg-chat: #f8fafc;
            --w-bg-input: #f1f5f9;
            --w-bg-bubble-ai: #ffffff;
            --w-bg-bubble-user: #4f46e5;
            --w-border: #e2e8f0;
            --w-text: #0f172a;
            --w-text-secondary: #475569;
            --w-text-muted: #94a3b8;
            --w-text-bubble-ai: #1e293b;
            --w-text-bubble-user: #ffffff;
            --w-shadow: 0 25px 60px -12px rgba(0,0,0,0.25);
            --w-radius: 1rem;
            font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
            font-size: 14px;
            line-height: 1.5;
            color: var(--w-text);
        }

        /* --- Floating Button --- */
        .damayai-fab {
            position: fixed;
            bottom: 24px;
            right: 24px;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(135deg, #6366f1, #4f46e5);
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 24px rgba(79, 70, 229, 0.4);
            z-index: 2147483646;
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s;
            color: #fff;
            font-size: 1.5rem;
        }
        .damayai-fab:hover {
            transform: scale(1.1);
            box-shadow: 0 12px 32px rgba(79, 70, 229, 0.5);
        }
        .damayai-fab.open .fab-icon-chat { display: none; }
        .damayai-fab.open .fab-icon-close { display: block; }
        .damayai-fab:not(.open) .fab-icon-chat { display: block; }
        .damayai-fab:not(.open) .fab-icon-close { display: none; }

        /* Pulse ring */
        .damayai-fab::after {
            content: '';
            position: absolute;
            inset: -4px;
            border-radius: 50%;
            border: 2px solid rgba(99, 102, 241, 0.4);
            animation: fabPulse 2s ease-out infinite;
        }
        .damayai-fab.open::after { display: none; }

        @keyframes fabPulse {
            0% { transform: scale(1); opacity: 1; }
            100% { transform: scale(1.4); opacity: 0; }
        }

        /* --- Chat Window --- */
        .damayai-chat-window {
            position: fixed;
            bottom: 100px;
            right: 24px;
            width: 400px;
            height: 560px;
            max-height: calc(100vh - 140px);
            background: var(--w-bg);
            border: 1px solid var(--w-border);
            border-radius: var(--w-radius);
            box-shadow: var(--w-shadow);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            z-index: 2147483645;
            opacity: 0;
            transform: translateY(20px) scale(0.95);
            pointer-events: none;
            transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .damayai-chat-window.visible {
            opacity: 1;
            transform: translateY(0) scale(1);
            pointer-events: all;
        }

        @media (max-width: 480px) {
            .damayai-chat-window {
                width: calc(100vw - 16px);
                height: calc(100vh - 100px);
                max-height: calc(100vh - 100px);
                right: 8px;
                bottom: 88px;
                border-radius: 1rem;
            }
            .damayai-fab { bottom: 16px; right: 16px; width: 54px; height: 54px; font-size: 1.3rem; }
        }

        /* --- Header --- */
        .damayai-header {
            padding: 0.875rem 1rem;
            background: linear-gradient(135deg, #4f46e5, #6366f1);
            color: #fff;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            flex-shrink: 0;
        }
        .damayai-header-avatar {
            width: 2.25rem;
            height: 2.25rem;
            border-radius: 50%;
            background: rgba(255,255,255,0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1rem;
            flex-shrink: 0;
        }
        .damayai-header-info h3 { font-size: 0.9rem; font-weight: 700; line-height: 1.2; }
        .damayai-header-info p { font-size: 0.65rem; opacity: 0.8; font-weight: 500; }
        .damayai-header-actions { margin-left: auto; display: flex; gap: 0.25rem; }
        .damayai-header-btn {
            width: 2rem; height: 2rem;
            border-radius: 0.375rem;
            border: none;
            background: rgba(255,255,255,0.15);
            color: #fff;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer;
            font-size: 0.8rem;
            transition: background 0.2s;
        }
        .damayai-header-btn:hover { background: rgba(255,255,255,0.25); }

        /* --- Messages Area --- */
        .damayai-messages {
            flex: 1;
            overflow-y: auto;
            padding: 1rem;
            background: var(--w-bg-chat);
            scroll-behavior: smooth;
        }
        .damayai-messages::-webkit-scrollbar { width: 5px; }
        .damayai-messages::-webkit-scrollbar-track { background: transparent; }
        .damayai-messages::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }

        .damayai-msg {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 1rem;
            animation: msgFadeIn 0.3s ease-out;
        }
        .damayai-msg.user { justify-content: flex-end; }

        @keyframes msgFadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .damayai-msg-avatar {
            width: 1.75rem;
            height: 1.75rem;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.7rem;
            color: #fff;
            flex-shrink: 0;
        }
        .damayai-msg-avatar.ai { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
        .damayai-msg-avatar.user-avatar { background: var(--w-primary); }

        .damayai-bubble {
            max-width: 82%;
            padding: 0.6rem 0.85rem;
            border-radius: 0.875rem;
            font-size: 0.85rem;
            line-height: 1.6;
            word-break: break-word;
        }
        .damayai-bubble.ai {
            background: var(--w-bg-bubble-ai);
            color: var(--w-text-bubble-ai);
            border: 1px solid var(--w-border);
            border-top-left-radius: 0.25rem;
        }
        .damayai-bubble.user {
            background: var(--w-bg-bubble-user);
            color: var(--w-text-bubble-user);
            border-top-right-radius: 0.25rem;
        }
        .damayai-bubble p { margin: 0.25rem 0; }
        .damayai-bubble strong { font-weight: 600; }
        .damayai-bubble ul, .damayai-bubble ol { padding-left: 1.25rem; margin: 0.25rem 0; }
        .damayai-bubble li { margin: 0.125rem 0; }

        /* Typing indicator */
        .damayai-typing { display: flex; align-items: center; gap: 0.3rem; padding: 0.75rem 1rem; }
        .damayai-typing-dot {
            width: 7px; height: 7px;
            background: var(--w-text-muted);
            border-radius: 50%;
            animation: typingDot 1.4s infinite ease-in-out;
        }
        .damayai-typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .damayai-typing-dot:nth-child(3) { animation-delay: 0.4s; }

        @keyframes typingDot {
            0%, 100% { transform: scale(1); opacity: 0.4; }
            50% { transform: scale(1.2); opacity: 1; }
        }

        /* --- Footer / Input --- */
        .damayai-footer {
            padding: 0.75rem;
            border-top: 1px solid var(--w-border);
            background: var(--w-bg);
            flex-shrink: 0;
        }
        .damayai-input-row {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .damayai-input {
            flex: 1;
            padding: 0.6rem 0.875rem;
            background: var(--w-bg-input);
            border: 1px solid var(--w-border);
            border-radius: 9999px;
            font-size: 0.85rem;
            font-family: inherit;
            color: var(--w-text);
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        .damayai-input:focus {
            border-color: var(--w-primary);
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
        }
        .damayai-input::placeholder { color: var(--w-text-muted); }

        .damayai-send-btn {
            width: 2.25rem;
            height: 2.25rem;
            border-radius: 50%;
            background: var(--w-primary);
            color: #fff;
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background 0.2s, transform 0.1s;
            font-size: 0.8rem;
            flex-shrink: 0;
        }
        .damayai-send-btn:hover { background: var(--w-primary-hover); }
        .damayai-send-btn:active { transform: scale(0.95); }
        .damayai-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .damayai-disclaimer {
            text-align: center;
            font-size: 0.6rem;
            color: var(--w-text-muted);
            margin-top: 0.375rem;
        }

        /* --- Powered By --- */
        .damayai-powered {
            text-align: center;
            padding: 0.375rem;
            font-size: 0.6rem;
            color: var(--w-text-muted);
            border-top: 1px solid var(--w-border);
            background: var(--w-bg);
        }
        .damayai-powered a { color: var(--w-primary); text-decoration: none; font-weight: 600; }
    `;

    // ============================================================
    //  WIDGET CLASS
    // ============================================================
    class DamayAIWidget {
        constructor() {
            this.isOpen = false;
            this.chatHistory = [];
            this.container = null;
            this.shadow = null;
            this.init();
        }

        init() {
            // Create container with Shadow DOM for CSS isolation
            this.container = document.createElement('div');
            this.container.id = 'damayai-widget-root';
            this.shadow = this.container.attachShadow({ mode: 'open' });

            // Inject styles
            const style = document.createElement('style');
            style.textContent = WIDGET_CSS;
            this.shadow.appendChild(style);

            // Build DOM
            this.shadow.appendChild(this.buildFAB());
            this.shadow.appendChild(this.buildChatWindow());

            document.body.appendChild(this.container);

            // Show welcome message
            this.appendMessage('Halo! 👋 Saya **DamayAI**, asisten virtual SMKN 2 Indramayu. Ada yang bisa saya bantu?', 'ai');
        }

        buildFAB() {
            const fab = document.createElement('button');
            fab.className = 'damayai-fab';
            fab.setAttribute('aria-label', 'Buka chat DamayAI');
            fab.innerHTML = `
                ${icon('comments', 'fab-icon-chat')}
                ${icon('xmark', 'fab-icon-close')}
            `;
            fab.addEventListener('click', () => this.toggle());
            this.fab = fab;
            return fab;
        }

        buildChatWindow() {
            const win = document.createElement('div');
            win.className = 'damayai-chat-window';
            win.innerHTML = `
                <div class="damayai-header">
                    <div class="damayai-header-avatar">${icon('robot')}</div>
                    <div class="damayai-header-info">
                        <h3>DamayAI</h3>
                        <p>Asisten SMKN 2 Indramayu</p>
                    </div>
                    <div class="damayai-header-actions">
                        <button class="damayai-header-btn damayai-newchat-btn" title="Chat Baru">${icon('plus')}</button>
                        <button class="damayai-header-btn damayai-close-btn" title="Tutup">${icon('xmark')}</button>
                    </div>
                </div>
                <div class="damayai-messages"></div>
                <div class="damayai-footer">
                    <form class="damayai-input-row">
                        <input type="text" class="damayai-input" placeholder="Tanya seputar sekolah..." autocomplete="off" required>
                        <button type="submit" class="damayai-send-btn">${icon('arrowUp')}</button>
                    </form>
                    <p class="damayai-disclaimer">AI dapat membuat kesalahan. Cek kembali info penting.</p>
                </div>
                <div class="damayai-powered">Didukung oleh <a href="${WIDGET_BASE_URL}" target="_blank" rel="noopener">DamayAI</a></div>
            `;

            this.chatWindow = win;
            this.messagesArea = win.querySelector('.damayai-messages');
            this.inputField = win.querySelector('.damayai-input');
            this.sendBtn = win.querySelector('.damayai-send-btn');
            this.form = win.querySelector('form');

            // Event listeners
            this.form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendMessage();
            });
            win.querySelector('.damayai-close-btn').addEventListener('click', () => this.toggle());
            win.querySelector('.damayai-newchat-btn').addEventListener('click', () => this.newChat());

            return win;
        }

        toggle() {
            this.isOpen = !this.isOpen;
            this.chatWindow.classList.toggle('visible', this.isOpen);
            this.fab.classList.toggle('open', this.isOpen);
            if (this.isOpen) {
                setTimeout(() => this.inputField.focus(), 300);
            }
        }

        newChat() {
            this.chatHistory = [];
            this.messagesArea.innerHTML = '';
            this.appendMessage('Halo! 👋 Saya **DamayAI**, asisten virtual SMKN 2 Indramayu. Ada yang bisa saya bantu?', 'ai');
        }

        async sendMessage() {
            const text = this.inputField.value.trim();
            if (!text) return;

            this.chatHistory.push({ role: 'user', parts: [{ text }] });
            this.appendMessage(text, 'user');
            this.inputField.value = '';
            this.setInputDisabled(true);
            this.showTyping();

            try {
                const resp = await fetch(`${WIDGET_BASE_URL}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: text,
                        history: this.chatHistory.slice(-20)
                    })
                });
                if (!resp.ok) throw new Error('Server error');
                const data = await resp.json();
                this.chatHistory.push({ role: 'model', parts: [{ text: data.response }] });
                this.appendMessage(data.response, 'ai');
            } catch (err) {
                this.appendMessage('Maaf, terjadi kesalahan. Silakan coba lagi nanti.', 'ai');
            } finally {
                this.hideTyping();
                this.setInputDisabled(false);
            }
        }

        setInputDisabled(disabled) {
            this.inputField.disabled = disabled;
            this.sendBtn.disabled = disabled;
            this.inputField.placeholder = disabled ? 'AI sedang mengetik...' : 'Tanya seputar sekolah...';
        }

        showTyping() {
            if (this.shadow.querySelector('.damayai-typing-wrapper')) return;
            const wrapper = document.createElement('div');
            wrapper.className = 'damayai-msg damayai-typing-wrapper';
            wrapper.innerHTML = `
                <div class="damayai-msg-avatar ai">${icon('robot')}</div>
                <div class="damayai-bubble ai damayai-typing">
                    <div class="damayai-typing-dot"></div>
                    <div class="damayai-typing-dot"></div>
                    <div class="damayai-typing-dot"></div>
                </div>
            `;
            this.messagesArea.appendChild(wrapper);
            this.scrollToBottom();
        }

        hideTyping() {
            this.shadow.querySelector('.damayai-typing-wrapper')?.remove();
        }

        formatMessage(text) {
            let html = text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            // Bold
            html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            // Italic
            html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
            // Remove citation tags (clean display)
            html = html.replace(/\[CITE:\s*.*?\s*\|\s*.*?\s*\]/g, '');
            // Remove image tags
            html = html.replace(/\[IMAGE:\s*.*?\s*\]/g, '');
            // Ordered list
            html = html.replace(/((?:^|\n)\s*\d+\.\s+.+(?:\n|$))+/g, (match) => {
                const items = match.trim().split('\n').map(l => `<li>${l.replace(/^\s*\d+\.\s*/, '')}</li>`).join('');
                return `<ol>${items}</ol>`;
            });
            // Unordered list
            html = html.replace(/((?:^|\n)\s*-\s+.+(?:\n|$))+/g, (match) => {
                const items = match.trim().split('\n').map(l => `<li>${l.replace(/^\s*-\s*/, '')}</li>`).join('');
                return `<ul>${items}</ul>`;
            });
            // Line breaks
            html = html.replace(/\n/g, '<br>');
            return html;
        }

        appendMessage(text, sender) {
            const msg = document.createElement('div');
            msg.className = `damayai-msg ${sender}`;

            if (sender === 'user') {
                msg.innerHTML = `
                    <div class="damayai-bubble user"><p>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p></div>
                    <div class="damayai-msg-avatar user-avatar">${icon('user')}</div>
                `;
            } else {
                msg.innerHTML = `
                    <div class="damayai-msg-avatar ai">${icon('robot')}</div>
                    <div class="damayai-bubble ai">${this.formatMessage(text)}</div>
                `;
            }

            this.messagesArea.appendChild(msg);
            this.scrollToBottom();
        }

        scrollToBottom() {
            this.messagesArea.scrollTo({ top: this.messagesArea.scrollHeight, behavior: 'smooth' });
        }
    }

    // ============================================================
    //  INIT — wait for DOM ready then create widget
    // ============================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new DamayAIWidget());
    } else {
        new DamayAIWidget();
    }
})();
