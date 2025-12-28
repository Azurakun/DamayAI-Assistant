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

    let lastUserMessage = '';
    let chatHistory = [];
    let isSpeaking = false;
    let currentSpeech = null;

    const startNewChat = () => {
        chatHistory = [];
        if (currentSpeech) window.speechSynthesis.cancel();
        isSpeaking = false;
        chatContainer.innerHTML = `
            <div class="flex items-end gap-3 chat-bubble">
                <div class="avatar-ai"><i class="fas fa-robot"></i></div>
                <div class="message-content ai-bubble">
                    <p class="font-medium">Halo! Saya DamayAI, asisten virtual SMKN 2 Indramayu. Apa saja yang ingin Anda ketahui tentang sekolah kami?</p>
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
                body: JSON.stringify({ query: userMessage, history: chatHistory }),
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

    bugReportBtn.addEventListener('click', () => {
        bugReportModal.classList.remove('hidden');
    });

    closeBugReportModalBtn.addEventListener('click', () => {
        bugReportModal.classList.add('hidden');
    });

    bugReportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const description = document.getElementById('bug-description').value;
        const file = document.getElementById('bug-file').files[0];
        const submitBtn = document.getElementById('submit-bug-report-btn');

        const formData = new FormData();
        formData.append('description', description);
        if (file) {
            formData.append('file', file);
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Mengirim...';

        try {
            const response = await fetch('/api/report_bug', {
                method: 'POST',
                body: formData,
            });
            const result = await response.json();
            if (response.ok) {
                alert('Laporan bug berhasil dikirim. Terima kasih!');
                bugReportForm.reset();
                bugReportModal.classList.add('hidden');
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            alert(`Gagal mengirim laporan: ${error.message}`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Kirim Laporan';
        }
    });

    function toggleInput(disabled) {
        chatInput.disabled = disabled;
        sendBtn.disabled = disabled;
        chatInput.placeholder = disabled ? "AI sedang mengetik..." : "Ketikkan pertanyaan Anda di sini...";
    }

    function formatAIResponse(message) {
        let formattedMessage = message;

        // 1. Escape HTML entities
        formattedMessage = formattedMessage.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        // 2. Extract Code Blocks to protect them
        const codeBlocks = [];
        formattedMessage = formattedMessage.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
            codeBlocks.push({ lang, code });
            return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
        });

        // 3. Basic Markdown
        formattedMessage = formattedMessage.replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mb-2 mt-4 text-blue-800">$1</h3>');
        formattedMessage = formattedMessage.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>');
        formattedMessage = formattedMessage.replace(/\*(.*?)\*/g, '<em class="italic text-gray-700">$1</em>');

        // 4. Images
        formattedMessage = formattedMessage.replace(/\[IMAGE:\s*(.*?)\s*\]/g, (match, imageUrl) => {
            return `<a href="${imageUrl}" target="_blank" rel="noopener noreferrer" class="block w-full max-w-md mx-auto my-3 overflow-hidden rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
                        <img src="${imageUrl}" alt="Gambar Referensi" class="w-full h-auto object-contain bg-gray-50">
                    </a>`;
        });

        // 5. Tables
        formattedMessage = formattedMessage.replace(/((?:^|\n)\|.+)+/g, (match) => {
            const rows = match.trim().split('\n');
            if (rows.length < 2) return match;
            if (!rows[1].includes('---')) return match;

            let html = '<div class="overflow-x-auto my-4"><table class="min-w-full bg-white border border-gray-300 rounded-lg shadow-sm text-sm">';
            const headers = rows[0].split('|').filter(c => c.trim() !== '').map(c => c.trim());
            html += '<thead class="bg-blue-50 border-b border-blue-100"><tr>';
            headers.forEach(h => html += `<th class="px-4 py-2 text-left font-semibold text-blue-800">${h}</th>`);
            html += '</tr></thead><tbody>';
            for (let i = 2; i < rows.length; i++) {
                const cells = rows[i].split('|').filter(c => c.trim() !== '').map(c => c.trim());
                html += `<tr class="border-b last:border-0 hover:bg-gray-50 transition-colors">`;
                cells.forEach(c => html += `<td class="px-4 py-2 text-gray-700">${c}</td>`);
                html += '</tr>';
            }
            html += '</tbody></table></div>';
            return html;
        });

        // 6. Lists
        formattedMessage = formattedMessage.replace(/((?:^|\n)\s*\d+\.\s+[\s\S]+?)(?=(\n\n|\n[^\d\-\s]|$))/g, (match) => {
            const firstLine = match.trim().split('\n')[0];
            const startNum = (firstLine.match(/^(\d+)\./) || [0, 1])[1];
            const items = match.trim().split('\n').map(line => {
                return `<li class="mb-1 leading-relaxed">${line.replace(/^\s*\d+\.\s*/, '').trim()}</li>`;
            }).join('');
            return `<ol start="${startNum}" class="list-decimal list-inside space-y-1 my-3 pl-2 text-gray-800">${items}</ol>`;
        });
        formattedMessage = formattedMessage.replace(/((?:^|\n)\s*-\s+[\s\S]+?)(?=(\n\n|\n[^\-\s]|$))/g, (match) => {
            const items = match.trim().split('\n').map(line => `<li class="mb-1 leading-relaxed">${line.replace(/^\s*-\s*/, '').trim()}</li>`).join('');
            return `<ul class="list-disc list-inside space-y-1 my-3 pl-2 text-gray-800">${items}</ul>`;
        });

        // 7. Restore Code Blocks
        formattedMessage = formattedMessage.replace(/__CODE_BLOCK_(\d+)__/g, (match, index) => {
            const block = codeBlocks[index];
            const langLabel = block.lang ? `<div class="text-xs text-gray-400 mb-1 uppercase select-none">${block.lang}</div>` : '';
            return `<div class="bg-gray-900 text-gray-100 p-4 rounded-lg my-4 overflow-x-auto shadow-inner border border-gray-700">
                        ${langLabel}
                        <pre class="font-mono text-sm leading-relaxed"><code>${block.code}</code></pre>
                    </div>`;
        });

        // 8. Newlines
        formattedMessage = formattedMessage.replace(/\n/g, '<br>');
        formattedMessage = formattedMessage.replace(/<br>\s*(<(?:ul|ol|div|table|h3))/g, '$1');
        formattedMessage = formattedMessage.replace(/(<\/(?:ul|ol|div|table|h3)>)\s*<br>/g, '$1');

        return formattedMessage;
    }

    // --- NEW: Function to extract citations and generate Chips ---
    function processCitations(htmlMessage) {
        const citations = [];
        // Regex to find [CITE: Url | Title]
        // We use a broader regex to capture variations, then clean up
        const regex = /\[CITE:\s*(.*?)\s*\|\s*(.*?)\s*\]/g;
        
        // Remove tags from text and store them
        const cleanedMessage = htmlMessage.replace(regex, (match, url, title) => {
            citations.push({ url: url.trim(), title: title.trim() });
            return ''; // Remove from visible text
        });

        // Remove duplicates based on URL/Source
        const uniqueCitations = citations.filter((value, index, self) =>
            index === self.findIndex((t) => (
                t.url === value.url
            ))
        );

        return { cleanedMessage, uniqueCitations };
    }

    function appendMessage(message, sender, isError = false) {
        const messageWrapper = document.createElement('div');
        messageWrapper.className = `flex flex-col gap-1 chat-bubble ${sender === 'user' ? 'items-end' : 'items-start'}`;
        
        let contentHtml = '';
        let citations = [];

        if (sender === 'user') {
             // User message remains simple
             contentHtml = `
                <div class="flex items-end gap-3 justify-end">
                    <div class="message-content user-bubble shadow-md">
                        <p class="font-medium text-white">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
                    </div>
                    <div class="avatar-user"><i class="fas fa-user"></i></div>
                </div>`;
        } else {
            // AI Message: Format -> Extract Citations -> Render
            let formatted = formatAIResponse(message);
            const processed = processCitations(formatted);
            contentHtml = processed.cleanedMessage;
            citations = processed.uniqueCitations;
            
            const errorClass = isError ? 'bg-red-50 text-red-800 border border-red-200 shadow-sm' : 'ai-bubble shadow-sm border border-gray-100';
            
            // Build Citation Chips HTML
            let chipsHtml = '';
            if (citations.length > 0) {
                chipsHtml = `<div class="flex flex-wrap gap-2 mt-3 ml-12 animate-fade-in">`;
                citations.forEach(cite => {
                    const isUrl = cite.url.startsWith('http');
                    const icon = isUrl ? '<i class="fas fa-external-link-alt text-xs"></i>' : '<i class="fas fa-file-alt text-xs"></i>';
                    const href = isUrl ? `href="${cite.url}" target="_blank"` : `href="#" onclick="alert('Sumber: ${cite.title} (Data Internal)')"`;
                    
                    chipsHtml += `
                        <a ${href} class="citation-chip flex items-center gap-2 px-3 py-1 bg-white border border-blue-200 rounded-full text-xs font-medium text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all shadow-sm">
                            ${icon}
                            <span>${cite.title}</span>
                        </a>
                    `;
                });
                chipsHtml += `</div>`;
            }

            contentHtml = `
                <div class="flex items-end gap-3 w-full max-w-3xl">
                    <div class="avatar-ai"><i class="fas fa-robot"></i></div>
                    <div class="message-content ${errorClass} w-full">
                        <div class="text-gray-800 leading-relaxed">${contentHtml}</div>
                        <div class="action-buttons mt-2 pt-2 border-t border-gray-100 flex gap-2">
                            <button class="action-btn tts-btn hover:bg-gray-200 p-1.5 rounded-full transition-colors" title="Dengarkan"><i class="fas fa-volume-up"></i></button>
                            <button class="action-btn copy-btn hover:bg-gray-200 p-1.5 rounded-full transition-colors" title="Salin Teks"><i class="fas fa-copy"></i></button>
                            <button class="action-btn regen-btn hover:bg-gray-200 p-1.5 rounded-full transition-colors" title="Buat Ulang"><i class="fas fa-sync-alt"></i></button>
                        </div>
                    </div>
                </div>
                ${chipsHtml}
            `;
        }

        messageWrapper.innerHTML = contentHtml;
        chatContainer.appendChild(messageWrapper);
        scrollToBottom();
        
        // Attach Event Listeners to the new buttons
        if (sender !== 'user') {
             // Prepare clean text for TTS/Copy (strip all HTML and custom tags)
            const cleanText = message
                .replace(/\[CITE:.*?\]/g, '') // Remove citation tags for TTS
                .replace(/\[IMAGE:.*?\]/g, '') 
                .replace(/\*\*/g, '')
                .replace(/###/g, '')
                .replace(/```[\s\S]*?```/g, ' [Kode Program] ')
                .trim();
            
            const ttsButton = messageWrapper.querySelector('.tts-btn');
            if (ttsButton) ttsButton.addEventListener('click', (e) => toggleSpeech(cleanText, e.currentTarget));
            
            const copyButton = messageWrapper.querySelector('.copy-btn');
            if (copyButton) copyButton.addEventListener('click', () => copyToClipboard(cleanText, copyButton));
            
            const regenButton = messageWrapper.querySelector('.regen-btn');
            if (regenButton) regenButton.addEventListener('click', regenerateLastResponse);
        }
    }

    function showTypingIndicator() {
        if (document.getElementById('typing-indicator')) return;
        const typingIndicator = document.createElement('div');
        typingIndicator.id = 'typing-indicator';
        typingIndicator.className = 'flex items-end gap-3 chat-bubble';
        typingIndicator.innerHTML = `
            <div class="avatar-ai"><i class="fas fa-robot"></i></div>
            <div class="message-content ai-bubble typing-indicator-bubble shadow-sm">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        chatContainer.appendChild(typingIndicator);
        scrollToBottom();
    }

    function removeTypingIndicator() {
        document.getElementById('typing-indicator')?.remove();
    }

    function toggleSpeech(text, button) {
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            isSpeaking = false;
            button.innerHTML = '<i class="fas fa-volume-up"></i>';
        } else {
            currentSpeech = new SpeechSynthesisUtterance(text);
            currentSpeech.lang = 'id-ID';
            currentSpeech.onend = () => {
                isSpeaking = false;
                button.innerHTML = '<i class="fas fa-volume-up"></i>';
            };
            window.speechSynthesis.speak(currentSpeech);
            isSpeaking = true;
            button.innerHTML = '<i class="fas fa-stop-circle"></i>';
        }
    }
    
    function copyToClipboard(text, button) {
        navigator.clipboard.writeText(text).then(() => {
            const originalIcon = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check text-green-600"></i>';
            setTimeout(() => {
                button.innerHTML = originalIcon;
            }, 1500);
        });
    }

    async function regenerateLastResponse() {
        const lastUserBubble = Array.from(chatContainer.querySelectorAll('.chat-bubble')).filter(el => el.querySelector('.user-bubble')).pop();
        if (lastUserBubble) lastUserMessage = lastUserBubble.querySelector('p').textContent;

        if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'model') {
            chatHistory.pop();
            // Remove last AI bubble AND its chips if present
            const allWrappers = chatContainer.children;
            if (allWrappers.length > 0) {
                allWrappers[allWrappers.length - 1].remove();
            }
        }
        
        toggleInput(true);
        showTypingIndicator();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: lastUserMessage, history: chatHistory }),
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