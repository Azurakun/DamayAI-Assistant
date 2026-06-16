document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatContainer = document.getElementById('chat-container');
    const sendBtn = document.getElementById('send-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const chatArea = document.getElementById('chat-area');
    const bugReportBtn = document.getElementById('bug-report-btn');
    const bugReportModal = document.getElementById('bug-report-modal');
    const closeBugReportModalBtn = document.getElementById('close-bug-report-modal-btn');
    const bugReportForm = document.getElementById('bug-report-form');
    const themeToggleUser = document.getElementById('theme-toggle-user');
    const userThemeIcon = document.getElementById('user-theme-icon');

    let lastUserMessage = '';
    let chatHistory = [];
    let isSpeaking = false;
    let currentSpeech = null;

    // ============================================================
    //  THEME
    // ============================================================
    function getCurrentTheme() {
        return document.documentElement.getAttribute('data-theme') || 'light';
    }

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('damayai-user-theme', theme);
        updateThemeIcon(theme);
    }

    function updateThemeIcon(theme) {
        userThemeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    themeToggleUser.addEventListener('click', () => {
        setTheme(getCurrentTheme() === 'dark' ? 'light' : 'dark');
    });

    updateThemeIcon(getCurrentTheme());

    // ============================================================
    //  STYLE HELPERS (theme-aware inline styles)
    // ============================================================
    const STYLES = {
        chatWrapper: 'display:flex;gap:0.5rem;width:100%;animation:fadeInUp 0.3s ease-out forwards;',
        userWrapper: 'align-items:flex-end;justify-content:flex-end;margin-bottom:1rem;',
        aiWrapper: 'align-items:flex-start;margin-bottom:1.5rem;flex-direction:column;',

        avatarBase: 'width:2.25rem;height:2.25rem;border-radius:9999px;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;font-size:0.85rem;',
        avatarAi: 'background:linear-gradient(135deg,#6366f1,#8b5cf6);',
        avatarUser: 'background:var(--user-accent);',

        bubbleBase: 'padding:0.75rem 1rem;border-radius:1rem;max-width:85%;word-break:break-word;font-size:0.875rem;line-height:1.6;',
        bubbleAi: 'background:var(--user-bg-bubble-ai);color:var(--user-text-bubble-ai);border:1px solid var(--user-border-bubble);border-top-left-radius:0.25rem;',
        bubbleUser: 'background:var(--user-bg-bubble-user);color:var(--user-text-bubble-user);border-top-right-radius:0.25rem;margin-left:auto;',
    };

    // ============================================================
    //  CHAT
    // ============================================================
    const startNewChat = () => {
        chatHistory = [];
        if (currentSpeech) window.speechSynthesis.cancel();
        isSpeaking = false;
        chatContainer.innerHTML = `
            <div style="${STYLES.chatWrapper}${STYLES.aiWrapper}">
                <div style="display:flex;gap:0.5rem;width:100%;max-width:48rem;">
                    <div style="${STYLES.avatarBase}${STYLES.avatarAi}"><i class="fas fa-robot"></i></div>
                    <div style="${STYLES.bubbleBase}${STYLES.bubbleAi}">
                        <p style="font-weight:500;margin:0;">Halo! Saya DamayAI, asisten virtual SMKN 2 Indramayu. Apa saja yang ingin Anda ketahui tentang sekolah kami?</p>
                    </div>
                </div>
            </div>`;
    };

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userMessage = chatInput.value.trim();
        if (!userMessage) return;

        lastUserMessage = userMessage;
        chatHistory.push({ role: "user", parts: [{ text: userMessage }] });

        appendMessage(userMessage, 'user');
        chatInput.value = '';
        toggleInput(true);
        showTypingIndicator();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: userMessage, history: chatHistory.slice(-20) }),
            });

            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);

            const data = await response.json();
            chatHistory.push({ role: "model", parts: [{ text: data.response }] });
            appendMessage(data.response, 'ai');

        } catch (error) {
            console.error('Error:', error);
            appendMessage('Maaf, terjadi kesalahan saat menghubungi server. Silakan coba lagi nanti.', 'ai', true);
        } finally {
            removeTypingIndicator();
            toggleInput(false);
        }
    });

    newChatBtn.addEventListener('click', startNewChat);

    bugReportBtn.addEventListener('click', () => { bugReportModal.style.display = 'flex'; });
    closeBugReportModalBtn.addEventListener('click', () => { bugReportModal.style.display = 'none'; });

    bugReportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const description = document.getElementById('bug-description').value;
        const file = document.getElementById('bug-file').files[0];
        const submitBtn = document.getElementById('submit-bug-report-btn');

        const formData = new FormData();
        formData.append('description', description);
        if (file) formData.append('file', file);

        submitBtn.disabled = true;
        submitBtn.textContent = 'Mengirim...';

        try {
            const response = await fetch('/api/report_bug', { method: 'POST', body: formData });
            const result = await response.json();
            if (response.ok) {
                alert('Laporan bug berhasil dikirim. Terima kasih!');
                bugReportForm.reset();
                bugReportModal.style.display = 'none';
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            alert(`Gagal mengirim laporan: ${error.message}`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Kirim';
        }
    });

    function toggleInput(disabled) {
        chatInput.disabled = disabled;
        sendBtn.disabled = disabled;
        chatInput.placeholder = disabled ? "AI sedang mengetik..." : "Tanya seputar sekolah...";
        sendBtn.style.opacity = disabled ? '0.5' : '1';
    }

    // ============================================================
    //  MESSAGE FORMATTING
    // ============================================================
    function formatAIResponse(message) {
        let formattedMessage = message;
        formattedMessage = formattedMessage.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        const codeBlocks = [];
        formattedMessage = formattedMessage.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
            codeBlocks.push({ lang, code });
            return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
        });

        formattedMessage = formattedMessage.replace(/^### (.*$)/gim, `<h3 style="font-size:1rem;font-weight:600;margin:0.75rem 0 0.375rem;color:var(--user-text-heading);">$1</h3>`);
        formattedMessage = formattedMessage.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight:700;">$1</strong>');
        formattedMessage = formattedMessage.replace(/\*(.*?)\*/g, '<em style="font-style:italic;">$1</em>');

        // Image URL sanitization (only http/https) with error handling
        formattedMessage = formattedMessage.replace(/\[IMAGE:\s*(.*?)\s*\]/g, (match, imageUrl) => {
            const trimmedUrl = imageUrl.trim();
            if (!/^https?:\/\//i.test(trimmedUrl)) return '';
            return `<a href="${trimmedUrl}" target="_blank" rel="noopener noreferrer" style="display:block;max-width:20rem;margin:0.75rem auto;overflow:hidden;border-radius:0.5rem;border:1px solid var(--user-border-bubble);">
                        <img src="${trimmedUrl}" alt="Gambar Referensi" style="width:100%;height:auto;display:block;" onerror="this.parentElement.style.display='none'">
                    </a>`;
        });

        // Table Formatting
        formattedMessage = formattedMessage.replace(/((?:^|\n)\|.+)+/g, (match) => {
            const rows = match.trim().split('\n');
            if (rows.length < 2) return match;
            if (!rows[1].includes('---')) return match;
            let html = '<div style="overflow-x:auto;margin:0.75rem 0;"><table style="min-width:100%;border:1px solid var(--user-border-bubble);border-collapse:collapse;border-radius:0.5rem;font-size:0.8rem;">';
            const headers = rows[0].split('|').filter(c => c.trim() !== '').map(c => c.trim());
            html += '<thead><tr style="background:var(--user-bg-input);">';
            headers.forEach(h => html += `<th style="padding:0.5rem 0.75rem;text-align:left;font-weight:600;color:var(--user-text-heading);white-space:nowrap;border:1px solid var(--user-border-bubble);">${h}</th>`);
            html += '</tr></thead><tbody>';
            for (let i = 2; i < rows.length; i++) {
                const cells = rows[i].split('|').filter(c => c.trim() !== '').map(c => c.trim());
                html += '<tr>';
                cells.forEach(c => html += `<td style="padding:0.5rem 0.75rem;border:1px solid var(--user-border-bubble);">${c}</td>`);
                html += '</tr>';
            }
            html += '</tbody></table></div>';
            return html;
        });

        // Ordered lists
        formattedMessage = formattedMessage.replace(/((?:^|\n)\s*\d+\.\s+[\s\S]+?)(?=(\n\n|\n[^\d\-\s]|$))/g, (match) => {
            const firstLine = match.trim().split('\n')[0];
            const startNum = (firstLine.match(/^(\d+)\./) || [0, 1])[1];
            const items = match.trim().split('\n').map(line => `<li style="margin-bottom:0.25rem;padding-left:0.25rem;">${line.replace(/^\s*\d+\.\s*/, '').trim()}</li>`).join('');
            return `<ol start="${startNum}" style="list-style:decimal inside;margin:0.5rem 0;padding-left:0.25rem;">${items}</ol>`;
        });

        // Unordered lists
        formattedMessage = formattedMessage.replace(/((?:^|\n)\s*-\s+[\s\S]+?)(?=(\n\n|\n[^\-\s]|$))/g, (match) => {
            const items = match.trim().split('\n').map(line => `<li style="margin-bottom:0.25rem;padding-left:0.25rem;">${line.replace(/^\s*-\s*/, '').trim()}</li>`).join('');
            return `<ul style="list-style:disc inside;margin:0.5rem 0;padding-left:0.25rem;">${items}</ul>`;
        });

        // Code blocks
        formattedMessage = formattedMessage.replace(/__CODE_BLOCK_(\d+)__/g, (match, index) => {
            const block = codeBlocks[index];
            return `<div style="background:var(--user-bg-code);color:#e2e8f0;padding:0.75rem;border-radius:0.5rem;margin:0.75rem 0;overflow-x:auto;font-size:0.8rem;">
                        ${block.lang ? `<div style="font-size:0.65rem;color:var(--user-text-muted);margin-bottom:0.25rem;text-transform:uppercase;font-weight:700;">${block.lang}</div>` : ''}
                        <pre style="font-family:'JetBrains Mono','Fira Code',monospace;margin:0;"><code>${block.code}</code></pre>
                    </div>`;
        });

        formattedMessage = formattedMessage.replace(/\n/g, '<br>');
        return formattedMessage;
    }

    function processCitations(htmlMessage) {
        const citations = [];
        // Match both [CITE: url | title] and [CITE: url] formats
        const regexFull = /\[CITE:\s*(.*?)\s*\|\s*(.*?)\s*\]/g;
        let cleanedMessage = htmlMessage.replace(regexFull, (match, url, title) => {
            citations.push({ url: url.trim(), title: title.trim() });
            return '';
        });
        // Fallback: match [CITE: url] without title (use last URL segment as title)
        const regexSimple = /\[CITE:\s*(.*?)\s*\]/g;
        cleanedMessage = cleanedMessage.replace(regexSimple, (match, url) => {
            const trimmedUrl = url.trim();
            // Extract a readable title from the URL
            let title = trimmedUrl;
            try {
                const pathname = new URL(trimmedUrl).pathname;
                title = decodeURIComponent(pathname.split('/').filter(Boolean).pop() || trimmedUrl)
                    .replace(/[-_]/g, ' ').replace(/\.[^.]+$/, '');
                // Capitalize first letter
                title = title.charAt(0).toUpperCase() + title.slice(1);
            } catch(e) { /* not a valid URL, use as-is */ }
            citations.push({ url: trimmedUrl, title: title });
            return '';
        });
        const uniqueCitations = citations.filter((value, index, self) => index === self.findIndex((t) => t.url === value.url));
        return { cleanedMessage, uniqueCitations };
    }

    function appendMessage(message, sender, isError = false) {
        const messageWrapper = document.createElement('div');

        if (sender === 'user') {
            messageWrapper.style.cssText = STYLES.chatWrapper + STYLES.userWrapper;
            messageWrapper.innerHTML = `
                <div style="${STYLES.bubbleBase}${STYLES.bubbleUser}">
                    <p style="font-weight:500;margin:0;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
                </div>
                <div style="${STYLES.avatarBase}${STYLES.avatarUser}"><i class="fas fa-user"></i></div>
            `;
        } else {
            let formatted = formatAIResponse(message);
            const processed = processCitations(formatted);
            const contentHtml = processed.cleanedMessage;
            const citations = processed.uniqueCitations;

            const errorStyle = isError
                ? 'background:rgba(239,68,68,0.1);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);'
                : STYLES.bubbleAi;

            let chipsHtml = '';
            if (citations.length > 0) {
                chipsHtml = '<div style="display:flex;flex-wrap:wrap;gap:0.375rem;margin-top:0.5rem;margin-left:2.75rem;" class="animate-fade-in">';
                citations.forEach(cite => {
                    const isUrl = cite.url.startsWith('http');
                    const icon = isUrl ? '<i class="fas fa-external-link-alt" style="font-size:0.6rem;"></i>' : '<i class="fas fa-file-alt" style="font-size:0.6rem;"></i>';
                    const href = isUrl ? `href="${cite.url}" target="_blank"` : `href="#" onclick="alert('Sumber: ${cite.title}')"`;

                    chipsHtml += `
                        <a ${href} class="citation-chip" style="display:flex;align-items:center;gap:0.375rem;padding:0.25rem 0.5rem;background:var(--user-bg-bubble-ai);border:1px solid var(--user-border-bubble);border-radius:9999px;font-size:0.65rem;font-weight:500;color:var(--user-accent);text-decoration:none;transition:all 0.2s;">
                            ${icon} <span style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${cite.title}</span>
                        </a>`;
                });
                chipsHtml += '</div>';
            }

            // Action buttons
            const actionButtonsHtml = `
                <div class="action-buttons" style="margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid var(--user-border-bubble);display:flex;gap:0.25rem;justify-content:flex-end;opacity:0.4;transition:opacity 0.3s;">
                    <button class="action-btn tts-btn" style="border:none;background:none;padding:0.375rem;border-radius:9999px;color:var(--user-text-muted);cursor:pointer;font-size:0.8rem;" title="Dengarkan"><i class="fas fa-volume-up"></i></button>
                    <button class="action-btn copy-btn" style="border:none;background:none;padding:0.375rem;border-radius:9999px;color:var(--user-text-muted);cursor:pointer;font-size:0.8rem;" title="Salin"><i class="fas fa-copy"></i></button>
                    <button class="action-btn regen-btn" style="border:none;background:none;padding:0.375rem;border-radius:9999px;color:var(--user-text-muted);cursor:pointer;font-size:0.8rem;" title="Regenerate"><i class="fas fa-sync-alt"></i></button>
                </div>`;

            messageWrapper.style.cssText = STYLES.chatWrapper + STYLES.aiWrapper;
            messageWrapper.innerHTML = `
                <div style="display:flex;gap:0.5rem;width:100%;max-width:48rem;" class="ai-message-group">
                    <div style="${STYLES.avatarBase}${STYLES.avatarAi}"><i class="fas fa-robot"></i></div>
                    <div style="${STYLES.bubbleBase}${errorStyle}width:100%;">
                        <div style="line-height:1.7;font-size:0.875rem;">${contentHtml}</div>
                        ${!isError ? actionButtonsHtml : ''}
                    </div>
                </div>
                ${chipsHtml}
            `;

            // Make action buttons show on hover
            const bubbleGroup = messageWrapper.querySelector('.ai-message-group');
            const actionBar = messageWrapper.querySelector('.action-buttons');
            if (bubbleGroup && actionBar) {
                bubbleGroup.addEventListener('mouseenter', () => { actionBar.style.opacity = '1'; });
                bubbleGroup.addEventListener('mouseleave', () => { actionBar.style.opacity = '0.4'; });
                // Always visible on touch
                actionBar.style.opacity = window.matchMedia('(hover: none)').matches ? '1' : '0.4';
            }
        }

        chatContainer.appendChild(messageWrapper);
        scrollToBottom();

        // Attach listeners
        if (sender !== 'user' && !isError) {
            const cleanText = message.replace(/\[CITE:.*?\]/g, '').replace(/\*\*/g, '').replace(/###/g, '').trim();
            const ttsBtn = messageWrapper.querySelector('.tts-btn');
            const copyBtn = messageWrapper.querySelector('.copy-btn');
            const regenBtn = messageWrapper.querySelector('.regen-btn');

            if (ttsBtn) ttsBtn.addEventListener('click', (e) => toggleSpeech(cleanText, e.currentTarget));
            if (copyBtn) copyBtn.addEventListener('click', () => copyToClipboard(cleanText, copyBtn));
            if (regenBtn) regenBtn.addEventListener('click', regenerateLastResponse);
        }
    }

    // ============================================================
    //  TYPING INDICATOR
    // ============================================================
    function showTypingIndicator() {
        if (document.getElementById('typing-indicator')) return;
        const ind = document.createElement('div');
        ind.id = 'typing-indicator';
        ind.style.cssText = STYLES.chatWrapper + 'align-items:flex-start;margin-bottom:1.5rem;';
        ind.innerHTML = `
            <div style="${STYLES.avatarBase}${STYLES.avatarAi}"><i class="fas fa-robot"></i></div>
            <div style="${STYLES.bubbleBase}${STYLES.bubbleAi}display:flex;align-items:center;gap:0.375rem;padding:1rem 1.25rem;">
                <div style="width:0.5rem;height:0.5rem;background:var(--user-text-muted);border-radius:9999px;animation:dot-pulse 1.4s infinite ease-in-out;"></div>
                <div style="width:0.5rem;height:0.5rem;background:var(--user-text-muted);border-radius:9999px;animation:dot-pulse 1.4s infinite ease-in-out 0.2s;"></div>
                <div style="width:0.5rem;height:0.5rem;background:var(--user-text-muted);border-radius:9999px;animation:dot-pulse 1.4s infinite ease-in-out 0.4s;"></div>
            </div>
        `;
        chatContainer.appendChild(ind);
        scrollToBottom();
    }

    function removeTypingIndicator() {
        document.getElementById('typing-indicator')?.remove();
    }

    // ============================================================
    //  UTILITIES
    // ============================================================
    function toggleSpeech(text, button) {
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            isSpeaking = false;
            button.innerHTML = '<i class="fas fa-volume-up"></i>';
        } else {
            currentSpeech = new SpeechSynthesisUtterance(text);
            currentSpeech.lang = 'id-ID';
            currentSpeech.onend = () => { isSpeaking = false; button.innerHTML = '<i class="fas fa-volume-up"></i>'; };
            window.speechSynthesis.speak(currentSpeech);
            isSpeaking = true;
            button.innerHTML = '<i class="fas fa-stop-circle"></i>';
        }
    }

    function copyToClipboard(text, button) {
        navigator.clipboard.writeText(text).then(() => {
            const originalIcon = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check" style="color:#22c55e;"></i>';
            setTimeout(() => { button.innerHTML = originalIcon; }, 1500);
        });
    }

    async function regenerateLastResponse() {
        const allUserBubbles = chatContainer.querySelectorAll('[style*="var(--user-bg-bubble-user)"]');
        const lastUserBubble = allUserBubbles[allUserBubbles.length - 1];
        if (!lastUserBubble) return;

        lastUserMessage = lastUserBubble.innerText;

        if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'model') {
            chatHistory.pop();
            chatContainer.lastElementChild.remove();
        }

        toggleInput(true);
        showTypingIndicator();
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: lastUserMessage, history: chatHistory.slice(-20) }),
            });
            if (!response.ok) throw new Error('Server error');
            const data = await response.json();
            chatHistory.push({ role: "model", parts: [{ text: data.response }] });
            appendMessage(data.response, 'ai');
        } catch (error) {
            appendMessage('Maaf, gagal membuat respons baru.', 'ai', true);
        } finally {
            removeTypingIndicator();
            toggleInput(false);
        }
    }

    function scrollToBottom() {
        chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
    }

    startNewChat();
});