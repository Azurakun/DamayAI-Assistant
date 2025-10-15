document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatContainer = document.getElementById('chat-container');
    const sendBtn = document.getElementById('send-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const chatArea = document.getElementById('chat-area');

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

    function toggleInput(disabled) {
        chatInput.disabled = disabled;
        sendBtn.disabled = disabled;
        chatInput.placeholder = disabled ? "AI sedang mengetik..." : "Ketikkan pertanyaan Anda di sini...";
    }

    function appendMessage(message, sender, isError = false) {
        const messageWrapper = document.createElement('div');
        messageWrapper.className = `flex items-end gap-3 chat-bubble ${sender === 'user' ? 'justify-end' : ''}`;
        const cleanMessage = message.replace(/\[IMAGE:.*?\]/g, '').trim();

        if (sender === 'user') {
            messageWrapper.innerHTML = `
                <div class="message-content user-bubble">
                    <p class="font-medium">${cleanMessage}</p>
                </div>
                <div class="avatar-user"><i class="fas fa-user"></i></div>
            `;
        } else { // AI message
            const formattedMessage = cleanMessage.replace(/\n/g, '<br>');
            const errorClass = isError ? 'bg-red-100 text-red-800 border border-red-200' : 'ai-bubble';
            
            messageWrapper.innerHTML = `
                <div class="avatar-ai"><i class="fas fa-robot"></i></div>
                <div class="message-content ${errorClass}">
                    <p class="font-medium">${formattedMessage}</p>
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
        
        // Tambahkan event listener untuk tombol aksi
        const ttsButton = messageWrapper.querySelector('.tts-btn');
        if (ttsButton) ttsButton.addEventListener('click', (e) => toggleSpeech(cleanMessage, e.currentTarget));
        
        const copyButton = messageWrapper.querySelector('.copy-btn');
        if (copyButton) copyButton.addEventListener('click', () => copyToClipboard(cleanMessage, copyButton));
        
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
            chatContainer.lastChild.remove();
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