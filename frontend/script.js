document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatContainer = document.getElementById('chat-container');
    const sendBtn = document.getElementById('send-btn');
    const newChatBtn = document.getElementById('new-chat-btn');

    let lastUserMessage = '';
    // PERUBAHAN: Variabel untuk menyimpan riwayat chat
    let chatHistory = [];

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userMessage = chatInput.value.trim();
        if (!userMessage) return;

        lastUserMessage = userMessage;
        // Simpan pesan pengguna ke riwayat
        chatHistory.push({ role: "user", parts: [{ text: userMessage }] });
        
        appendMessage(userMessage, 'user');
        chatInput.value = '';
        chatInput.disabled = true;
        sendBtn.disabled = true;

        showTypingIndicator();

        try {
            // Kirim pesan dan riwayatnya ke backend
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: userMessage, history: chatHistory }),
            });

            removeTypingIndicator();
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);

            const data = await response.json();
            // Simpan balasan AI ke riwayat
            chatHistory.push({ role: "model", parts: [{ text: data.response }] });
            appendMessage(data.response, 'ai');

        } catch (error) {
            console.error('Error:', error);
            removeTypingIndicator();
            appendMessage('Maaf, terjadi kesalahan saat menghubungi server.', 'ai', true);
        } finally {
            chatInput.disabled = false;
            sendBtn.disabled = false;
            chatInput.focus();
        }
    });
    
    newChatBtn.addEventListener('click', () => {
        // PERUBAHAN: Hapus riwayat chat saat memulai obrolan baru
        chatHistory = [];
        chatContainer.innerHTML = `
             <div class="flex items-start gap-3 chat-bubble">
                <div class="bg-blue-600 text-white p-2 rounded-full h-8 w-8 flex items-center justify-center font-bold flex-shrink-0">AI</div>
                <div class="p-4 rounded-lg max-w-[85%] ai-bubble">
                    <p>Selamat datang di SMKN 2 Indramayu. Saya staf administrasi digital di sini, ada informasi yang bisa saya bantu carikan?</p>
                </div>
            </div>`;
    });

    function appendMessage(message, sender, isError = false) {
        const messageWrapper = document.createElement('div');
        messageWrapper.className = 'flex items-start gap-3 chat-bubble';

        if (sender === 'user') {
            messageWrapper.classList.add('justify-end');
            messageWrapper.innerHTML = `
                <div class="p-4 rounded-lg max-w-[85%] user-bubble">
                    <p>${message}</p>
                </div>
                <div class="bg-gray-300 text-gray-700 p-2 rounded-full h-8 w-8 flex items-center justify-center font-bold flex-shrink-0">Anda</div>
            `;
        } else { // AI message
            let imageHtml = '';
            const imageRegex = /\[IMAGE:\s*(.*?)\s*\]/g;
            const imageUrlMatch = imageRegex.exec(message);
            if (imageUrlMatch) {
                const imageUrl = imageUrlMatch[1];
                imageHtml = `<img src="${imageUrl}" alt="Gambar terkait" class="mt-2 rounded-lg max-w-full h-auto" loading="lazy">`;
            }
            
            const cleanMessage = message.replace(imageRegex, '').trim();
            let formattedMessage = cleanMessage.replace(/\n/g, '<br>');

            const errorClass = isError ? 'bg-red-100 text-red-700' : 'ai-bubble';
            
            messageWrapper.innerHTML = `
                <div class="bg-blue-600 text-white p-2 rounded-full h-8 w-8 flex items-center justify-center font-bold flex-shrink-0">AI</div>
                <div class="p-4 rounded-lg max-w-[85%] ${errorClass}">
                    <p>${formattedMessage}</p>
                    ${imageHtml}
                    <div class="mt-3 flex gap-2 items-center text-gray-500">
                        <button class="tts-btn p-1 hover:bg-gray-200 rounded-full"><i class="fas fa-volume-up"></i></button>
                        <button class="regen-btn p-1 hover:bg-gray-200 rounded-full"><i class="fas fa-sync-alt"></i></button>
                    </div>
                </div>
            `;
        }

        chatContainer.appendChild(messageWrapper);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        const ttsButton = messageWrapper.querySelector('.tts-btn');
        if(ttsButton) {
            ttsButton.addEventListener('click', () => speakText(message.replace(/\[IMAGE:.*?\]/g, '')));
        }
        
        const regenButton = messageWrapper.querySelector('.regen-btn');
        if(regenButton) {
            regenButton.addEventListener('click', regenerateLastResponse);
        }
    }

    function showTypingIndicator() {
        const typingIndicator = document.createElement('div');
        typingIndicator.id = 'typing-indicator';
        typingIndicator.className = 'flex items-start gap-3';
        typingIndicator.innerHTML = `
            <div class="bg-blue-500 text-white p-2 rounded-full h-8 w-8 flex items-center justify-center font-bold">AI</div>
            <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div class="flex items-center space-x-1">
                    <div class="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                    <div class="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style="animation-delay: 0.2s;"></div>
                    <div class="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style="animation-delay: 0.4s;"></div>
                </div>
            </div>
        `;
        chatContainer.appendChild(typingIndicator);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function removeTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    function speakText(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'id-ID';
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
        } else {
            alert('Maaf, browser Anda tidak mendukung fitur Text-to-Speech.');
        }
    }
    
    async function regenerateLastResponse() {
        const allMessages = chatContainer.querySelectorAll('.flex.items-start.gap-3');
        const lastAiMessage = allMessages[allMessages.length - 1]; 
        if(lastAiMessage) {
            lastAiMessage.remove();
        }

        showTypingIndicator();
        chatInput.disabled = true;
        sendBtn.disabled = true;

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: lastUserMessage }),
            });

            removeTypingIndicator();
            if (!response.ok) throw new Error('Server error');

            const data = await response.json();
            appendMessage(data.response, 'ai');

        } catch (error) {
            console.error('Error:', error);
            removeTypingIndicator();
            appendMessage('Maaf, gagal membuat respons baru.', 'ai', true);
        } finally {
            chatInput.disabled = false;
            sendBtn.disabled = false;
            chatInput.focus();
        }
    }
});