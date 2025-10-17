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

        // Escape HTML entities first to prevent accidental rendering of raw tags
        formattedMessage = formattedMessage.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        // Apply custom tags
        formattedMessage = formattedMessage.replace(/\[TITLE\](.*?)\[\/TITLE\]/g, '<h3 class="text-lg font-semibold mb-2 mt-4">$1</h3>');
        formattedMessage = formattedMessage.replace(/\[B\](.*?)\[\/B\]/g, '<strong class="font-bold">$1</strong>');
        
        // ========================================================================
        // --- FUNGSI DIPERBAIKI ---
        // ========================================================================
        // Handle images: Ensure aspect ratio and make them clickable for full view
        formattedMessage = formattedMessage.replace(/\[IMAGE:\s*(.*?)\s*\]/g, (match, imageUrl) => {
            return `<a href="${imageUrl}" target="_blank" rel="noopener noreferrer" class="block w-full max-w-md mx-auto my-3 overflow-hidden rounded-lg shadow-md">
                        <img src="${imageUrl}" alt="Gambar" class="w-full h-auto object-contain">
                    </a>`;
        });
        // ========================================================================
        // --- AKHIR DARI FUNGSI YANG DIPERBAIKI ---
        // ========================================================================

        // Process lists (numbered and bulleted)
        const processLists = (text) => {
            let processedText = text.replace(/((?:\n|^)\s*\d+\..+)+/g, (match) => {
                const items = match.trim().split('\n').map(item => `<li class="mb-1">${item.replace(/^\s*\d+\.\s*/, '')}</li>`).join('');
                return `<ol class="list-decimal list-inside space-y-1 my-3 pl-2">${items}</ol>`;
            });
            processedText = processedText.replace(/((?:\n|^)\s*-.+)+/g, (match) => {
                const items = match.trim().split('\n').map(item => `<li class="mb-1">${item.replace(/^\s*-\s*/, '')}</li>`).join('');
                return `<ul class="list-disc list-inside space-y-1 my-3 pl-2">${items}</ul>`;
            });
            return processedText;
        };
        formattedMessage = processLists(formattedMessage);
        
        // Convert remaining newlines to <br>
        formattedMessage = formattedMessage.replace(/\n/g, '<br>');

        // Cleanup: remove <br> tags immediately before/after block-level elements
        formattedMessage = formattedMessage.replace(/<br>\s*(<(?:ul|ol|h3|img|a\s+href))/g, '$1');
        formattedMessage = formattedMessage.replace(/(<\/(?:ul|ol|h3|a)>)\s*<br>/g, '$1');
        
        return formattedMessage;
    }

    function appendMessage(message, sender, isError = false) {
        const messageWrapper = document.createElement('div');
        messageWrapper.className = `flex items-end gap-3 chat-bubble ${sender === 'user' ? 'justify-end' : ''}`;
        
        
        const cleanMessageForActions = message;

        if (sender === 'user') {
            messageWrapper.innerHTML = `
                <div class="message-content user-bubble">
                    <p class="font-medium">${cleanMessageForActions.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
                </div>
                <div class="avatar-user"><i class="fas fa-user"></i></div>
            `;
        } else { 
            const formattedMessage = formatAIResponse(cleanMessageForActions);
            const errorClass = isError ? 'bg-red-100 text-red-800 border border-red-200' : 'ai-bubble';
            
            messageWrapper.innerHTML = `
                <div class="avatar-ai"><i class="fas fa-robot"></i></div>
                <div class="message-content ${errorClass}">
                    <div class="font-medium text-gray-800">${formattedMessage}</div>
                    <div class="action-buttons">
                        <button class="action-btn tts-btn" title="Dengarkan"><i class="fas fa-volume-up"></i></button>
                        <button class="action-btn copy-btn" title="Salin Teks"><i class="fas fa-copy"></i></button>
                        <button class="action-btn regen-btn" title="Buat Ulang"><i class="fas fa-sync-alt"></i></button>
                    </div>
                </div>
            `;
        }

        chatContainer.appendChild(messageWrapper);
        scrollToBottom();
        
        // The text for speech and copy should be the raw AI response, but stripped of custom tags
        const cleanTextForSpeechAndCopy = cleanMessageForActions
            .replace(/\[TITLE\](.*?)\[\/TITLE\]/g, '$1\n')
            .replace(/\[B\](.*?)\[\/B\]/g, '$1')
            .replace(/\[IMAGE:.*?\]/g, '') // Remove image tags entirely for speech/copy
            .trim();
        
        const ttsButton = messageWrapper.querySelector('.tts-btn');
        if (ttsButton) ttsButton.addEventListener('click', (e) => toggleSpeech(cleanTextForSpeechAndCopy, e.currentTarget));
        
        const copyButton = messageWrapper.querySelector('.copy-btn');
        if (copyButton) copyButton.addEventListener('click', () => copyToClipboard(cleanTextForSpeechAndCopy, copyButton));
        
        const regenButton = messageWrapper.querySelector('.regen-btn');
        if (regenButton) regenButton.addEventListener('click', regenerateLastResponse);
    }

    function showTypingIndicator() {
        if (document.getElementById('typing-indicator')) return;
        const typingIndicator = document.createElement('div');
        typingIndicator.id = 'typing-indicator';
        typingIndicator.className = 'flex items-end gap-3 chat-bubble';
        typingIndicator.innerHTML = `
            <div class="avatar-ai"><i class="fas fa-robot"></i></div>
            <div class="message-content ai-bubble typing-indicator-bubble">
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
            button.innerHTML = '<i class="fas fa-check"></i>';
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
            
            const allBubbles = chatContainer.querySelectorAll('.chat-bubble');
            if (allBubbles.length > 0) {
                allBubbles[allBubbles.length - 1].remove();
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