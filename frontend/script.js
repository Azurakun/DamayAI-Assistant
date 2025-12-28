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

    // --- CLASS CONSTANTS (Menggantikan @apply di CSS) ---
    const CLASSES = {
        avatarBase: "w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 shadow-md transition-transform hover:scale-105",
        avatarAi: "bg-gradient-to-br from-indigo-500 to-purple-600",
        avatarUser: "bg-blue-500",
        
        bubbleBase: "p-3 md:p-4 rounded-2xl max-w-[85%] md:max-w-[75%] break-words text-sm md:text-base shadow-sm",
        bubbleAi: "bg-white text-gray-800 rounded-tl-none border border-gray-200",
        bubbleUser: "bg-blue-600 text-white rounded-tr-none ml-auto",
        
        chatWrapper: "flex gap-2 md:gap-3 w-full animate-fade-in-up group", // Added 'group' for hover effects
        userWrapper: "items-end justify-end mb-4",
        aiWrapper: "items-start mb-6"
    };

    const startNewChat = () => {
        chatHistory = [];
        if (currentSpeech) window.speechSynthesis.cancel();
        isSpeaking = false;
        chatContainer.innerHTML = `
            <div class="${CLASSES.chatWrapper} ${CLASSES.aiWrapper}">
                <div class="${CLASSES.avatarBase} ${CLASSES.avatarAi}"><i class="fas fa-robot"></i></div>
                <div class="${CLASSES.bubbleBase} ${CLASSES.bubbleAi}">
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
        // ... (Logika bug report tetap sama) ...
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
        chatInput.placeholder = disabled ? "AI sedang mengetik..." : "Tanya seputar sekolah...";
        sendBtn.classList.toggle('opacity-50', disabled);
    }

    function formatAIResponse(message) {
        let formattedMessage = message;
        formattedMessage = formattedMessage.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        const codeBlocks = [];
        formattedMessage = formattedMessage.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
            codeBlocks.push({ lang, code });
            return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
        });

        formattedMessage = formattedMessage.replace(/^### (.*$)/gim, '<h3 class="text-base md:text-lg font-semibold mb-2 mt-4 text-blue-800">$1</h3>');
        formattedMessage = formattedMessage.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>');
        formattedMessage = formattedMessage.replace(/\*(.*?)\*/g, '<em class="italic text-gray-700">$1</em>');

        formattedMessage = formattedMessage.replace(/\[IMAGE:\s*(.*?)\s*\]/g, (match, imageUrl) => {
            return `<a href="${imageUrl}" target="_blank" rel="noopener noreferrer" class="block w-full max-w-md mx-auto my-3 overflow-hidden rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
                        <img src="${imageUrl}" alt="Gambar Referensi" class="w-full h-auto object-contain bg-gray-50">
                    </a>`;
        });

        // Table Formatting
        formattedMessage = formattedMessage.replace(/((?:^|\n)\|.+)+/g, (match) => {
            const rows = match.trim().split('\n');
            if (rows.length < 2) return match;
            if (!rows[1].includes('---')) return match;
            let html = '<div class="overflow-x-auto my-4 -mx-2 md:mx-0"><table class="min-w-full bg-white border border-gray-300 rounded-lg shadow-sm text-xs md:text-sm">';
            const headers = rows[0].split('|').filter(c => c.trim() !== '').map(c => c.trim());
            html += '<thead class="bg-blue-50 border-b border-blue-100"><tr>';
            headers.forEach(h => html += `<th class="px-3 py-2 text-left font-semibold text-blue-800 whitespace-nowrap">${h}</th>`);
            html += '</tr></thead><tbody>';
            for (let i = 2; i < rows.length; i++) {
                const cells = rows[i].split('|').filter(c => c.trim() !== '').map(c => c.trim());
                html += `<tr class="border-b last:border-0 hover:bg-gray-50 transition-colors">`;
                cells.forEach(c => html += `<td class="px-3 py-2 text-gray-700">${c}</td>`);
                html += '</tr>';
            }
            html += '</tbody></table></div>';
            return html;
        });

        formattedMessage = formattedMessage.replace(/((?:^|\n)\s*\d+\.\s+[\s\S]+?)(?=(\n\n|\n[^\d\-\s]|$))/g, (match) => {
            const firstLine = match.trim().split('\n')[0];
            const startNum = (firstLine.match(/^(\d+)\./) || [0, 1])[1];
            const items = match.trim().split('\n').map(line => `<li class="mb-1 leading-relaxed pl-1">${line.replace(/^\s*\d+\.\s*/, '').trim()}</li>`).join('');
            return `<ol start="${startNum}" class="list-decimal list-inside space-y-1 my-3 pl-1 text-gray-800 marker:text-blue-600 font-medium">${items}</ol>`;
        });

        formattedMessage = formattedMessage.replace(/((?:^|\n)\s*-\s+[\s\S]+?)(?=(\n\n|\n[^\-\s]|$))/g, (match) => {
            const items = match.trim().split('\n').map(line => `<li class="mb-1 leading-relaxed pl-1">${line.replace(/^\s*-\s*/, '').trim()}</li>`).join('');
            return `<ul class="list-disc list-inside space-y-1 my-3 pl-1 text-gray-800 marker:text-blue-600">${items}</ul>`;
        });

        formattedMessage = formattedMessage.replace(/__CODE_BLOCK_(\d+)__/g, (match, index) => {
            const block = codeBlocks[index];
            return `<div class="bg-gray-900 text-gray-100 p-3 md:p-4 rounded-lg my-4 overflow-x-auto shadow-inner border border-gray-700 text-xs md:text-sm">
                        ${block.lang ? `<div class="text-xs text-gray-400 mb-1 uppercase select-none font-bold">${block.lang}</div>` : ''}
                        <pre class="font-mono leading-relaxed"><code>${block.code}</code></pre>
                    </div>`;
        });

        formattedMessage = formattedMessage.replace(/\n/g, '<br>');
        return formattedMessage;
    }

    function processCitations(htmlMessage) {
        const citations = [];
        const regex = /\[CITE:\s*(.*?)\s*\|\s*(.*?)\s*\]/g;
        const cleanedMessage = htmlMessage.replace(regex, (match, url, title) => {
            citations.push({ url: url.trim(), title: title.trim() });
            return '';
        });
        const uniqueCitations = citations.filter((value, index, self) => index === self.findIndex((t) => t.url === value.url));
        return { cleanedMessage, uniqueCitations };
    }

    function appendMessage(message, sender, isError = false) {
        const messageWrapper = document.createElement('div');
        
        let contentHtml = '';
        let citations = [];

        if (sender === 'user') {
            messageWrapper.className = `${CLASSES.chatWrapper} ${CLASSES.userWrapper}`;
            contentHtml = `
                    <div class="${CLASSES.bubbleBase} ${CLASSES.bubbleUser}">
                        <p class="font-medium text-white">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
                    </div>
                    <div class="${CLASSES.avatarBase} ${CLASSES.avatarUser}"><i class="fas fa-user"></i></div>
            `;
        } else {
            let formatted = formatAIResponse(message);
            const processed = processCitations(formatted);
            contentHtml = processed.cleanedMessage;
            citations = processed.uniqueCitations;
            
            const errorClass = isError ? 'bg-red-50 text-red-800 border border-red-200' : CLASSES.bubbleAi;
            
            let chipsHtml = '';
            if (citations.length > 0) {
                chipsHtml = `<div class="flex flex-wrap gap-2 mt-3 ml-1 md:ml-12 animate-fade-in">`;
                citations.forEach(cite => {
                    const isUrl = cite.url.startsWith('http');
                    const icon = isUrl ? '<i class="fas fa-external-link-alt text-[10px]"></i>' : '<i class="fas fa-file-alt text-[10px]"></i>';
                    const href = isUrl ? `href="${cite.url}" target="_blank"` : `href="#" onclick="alert('Sumber: ${cite.title}')"`;
                    
                    chipsHtml += `
                        <a ${href} class="citation-chip flex items-center gap-1.5 px-2 py-1 bg-white border border-blue-200 rounded-full text-[10px] md:text-xs font-medium text-blue-600 hover:bg-blue-50 transition-all shadow-sm">
                            ${icon} <span class="truncate max-w-[150px]">${cite.title}</span>
                        </a>`;
                });
                chipsHtml += `</div>`;
            }

            // Updated Action Buttons: Always visible on mobile (opacity-100), fade on desktop
            const actionButtonsHtml = `
                <div class="action-buttons mt-2 pt-2 border-t border-gray-100 flex gap-1 justify-end opacity-100 md:opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <button class="action-btn tts-btn hover:bg-gray-100 p-1.5 rounded-full text-gray-500 hover:text-blue-600 transition-colors" title="Dengarkan"><i class="fas fa-volume-up"></i></button>
                    <button class="action-btn copy-btn hover:bg-gray-100 p-1.5 rounded-full text-gray-500 hover:text-blue-600 transition-colors" title="Salin"><i class="fas fa-copy"></i></button>
                    <button class="action-btn regen-btn hover:bg-gray-100 p-1.5 rounded-full text-gray-500 hover:text-blue-600 transition-colors" title="Regenerate"><i class="fas fa-sync-alt"></i></button>
                </div>`;

            messageWrapper.className = `${CLASSES.chatWrapper} ${CLASSES.aiWrapper} flex-col`;
            
            // Nested structure for AI to keep avatar on top-left and chips below
            messageWrapper.innerHTML = `
                <div class="flex gap-2 md:gap-3 w-full max-w-3xl">
                    <div class="${CLASSES.avatarBase} ${CLASSES.avatarAi}"><i class="fas fa-robot"></i></div>
                    <div class="${CLASSES.bubbleBase} ${errorClass} w-full relative group-inner">
                        <div class="text-gray-800 leading-relaxed text-sm md:text-base">${contentHtml}</div>
                        ${!isError ? actionButtonsHtml : ''}
                    </div>
                </div>
                ${chipsHtml}
            `;
        }

        if (sender === 'user') messageWrapper.innerHTML = contentHtml; // User HTML is simple
        
        chatContainer.appendChild(messageWrapper);
        scrollToBottom();
        
        // Listeners (TTS, Copy, etc)
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

    function showTypingIndicator() {
        if (document.getElementById('typing-indicator')) return;
        const ind = document.createElement('div');
        ind.id = 'typing-indicator';
        ind.className = `${CLASSES.chatWrapper} ${CLASSES.aiWrapper}`;
        ind.innerHTML = `
            <div class="${CLASSES.avatarBase} ${CLASSES.avatarAi}"><i class="fas fa-robot"></i></div>
            <div class="${CLASSES.bubbleBase} ${CLASSES.bubbleAi} flex items-center gap-1.5 py-4 px-5">
                <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
            </div>
        `;
        chatContainer.appendChild(ind);
        scrollToBottom();
    }

    function removeTypingIndicator() {
        document.getElementById('typing-indicator')?.remove();
    }

    // ... (Fungsi toggleSpeech, copyToClipboard, regenerateLastResponse, scrollToBottom SAMA seperti sebelumnya) ...
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
            button.innerHTML = '<i class="fas fa-check text-green-600"></i>';
            setTimeout(() => { button.innerHTML = originalIcon; }, 1500);
        });
    }

    async function regenerateLastResponse() {
        // ... (Logic sama, ambil last user bubble)
        const lastUserBubble = Array.from(chatContainer.querySelectorAll('.user-bubble, .bg-blue-600')).pop(); // Selector updated
        if (!lastUserBubble) return;
        
        lastUserMessage = lastUserBubble.innerText;

        if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'model') {
            chatHistory.pop();
            chatContainer.lastElementChild.remove(); // Remove AI bubble
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