document.addEventListener('DOMContentLoaded', () => {
    // --- Variabel ---
    const authOverlay = document.getElementById('auth-overlay');
    const adminPanel = document.getElementById('admin-panel');
    const adminCodeInput = document.getElementById('admin-code');
    const errorMsg = document.getElementById('error-msg');
    const scrapeBtn = document.getElementById('scrape-btn');
    const reindexBtn = document.getElementById('reindex-btn');
    const viewDataBtn = document.getElementById('view-data-btn');
    const consoleDiv = document.getElementById('console');
    const statusSpan = document.getElementById('status');
    const dataModal = document.getElementById('data-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalTitle = document.getElementById('modal-title');
    const modalContentList = document.getElementById('modal-content-list');
    const modalContentEdit = document.getElementById('modal-content-edit');
    const modalContentDetail = document.getElementById('modal-content-detail');
    const searchDataInput = document.getElementById('search-data-input');
    const adminChatForm = document.getElementById('admin-chat-form');
    const adminChatInput = document.getElementById('admin-chat-input');
    const adminChatSubmit = document.getElementById('admin-chat-submit');
    const thinkingConsole = document.getElementById('thinking-console');
    const deleteFaissBtn = document.getElementById('delete-faiss-btn');
    const deleteDbBtn = document.getElementById('delete-db-btn');
    const tutorialBtn = document.getElementById('tutorial-btn');
    const tutorialModal = document.getElementById('tutorial-modal');
    const closeTutorialBtn = document.getElementById('close-tutorial-btn');
    let currentDataCache = [];
    let adminChatHistory = []; // Riwayat chat untuk panel admin
    const ADMIN_CODE = '355123';

    // --- Authentication ---
    adminCodeInput.addEventListener('keyup', (e) => {
        if (e.target.value === ADMIN_CODE) {
            authOverlay.classList.add('hidden');
            adminPanel.classList.remove('hidden');
        }
    });

    // --- Main Control & Modal Event Listeners ---
    scrapeBtn.addEventListener('click', () => runProcess('/api/scrape', 'Scraping'));
    reindexBtn.addEventListener('click', () => runProcess('/api/reindex', 'Indexing'));
    viewDataBtn.addEventListener('click', async () => {
        showDataListView();
        searchDataInput.value = '';
        modalContentList.innerHTML = '<p class="text-gray-400">Memuat data...</p>';
        dataModal.classList.remove('hidden');
        await fetchDataAndDisplay();
    });
    closeModalBtn.addEventListener('click', () => dataModal.classList.add('hidden'));
    tutorialBtn.addEventListener('click', () => tutorialModal.classList.remove('hidden'));
    closeTutorialBtn.addEventListener('click', () => tutorialModal.classList.add('hidden'));

    deleteFaissBtn.addEventListener('click', async () => {
        if (confirm("ANDA YAKIN ingin menghapus seluruh file Index FAISS?\nAI tidak akan bisa mencari dokumen sampai Anda 'Rebuild Index' lagi.")) {
            await performAction('/api/delete_faiss', 'Menghapus FAISS Index...');
        }
    });

    deleteDbBtn.addEventListener('click', async () => {
        if (confirm("ANDA YAKIN ingin menghapus seluruh DATABASE?\nIni akan menghapus SEMUA data scraping dan memori (reset total).")) {
            await performAction('/api/delete_db', 'Menghapus Database...');
        }
    });
    
    // --- AI Test & Training Logic ---
    adminChatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userQuery = adminChatInput.value.trim();
        if (!userQuery) return;

        adminChatHistory.push({ role: "user", parts: [{ text: userQuery }] });
        
        thinkingConsole.innerHTML = '';
        adminChatSubmit.disabled = true;
        adminChatSubmit.textContent = 'Menganalisis...';
        thinkingConsole.dataset.question = userQuery;

        try {
            const response = await fetch('/api/admin_chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: userQuery, history: adminChatHistory }),
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const jsonObjects = chunk.split('\n').filter(Boolean);

                jsonObjects.forEach(jsonStr => {
                    try {
                        const thought = JSON.parse(jsonStr);
                        appendThoughtToConsole(thought);
                        if (thought.step === 'final_answer') {
                            adminChatHistory.push({ role: "model", parts: [{ text: thought.data }] });
                        }
                    } catch (e) { console.error("Gagal parse JSON chunk:", jsonStr); }
                });
            }
        } catch (error) {
            appendThoughtToConsole({step: "error", data: `Koneksi gagal: ${error.message}`});
        } finally {
            adminChatSubmit.disabled = false;
            adminChatSubmit.textContent = 'Kirim & Analisis';
        }
    });

    thinkingConsole.addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        if (target.id === 'clear-log-btn') {
            thinkingConsole.innerHTML = '<p class="text-gray-500">> Menunggu pertanyaan untuk dianalisis...</p>';
            delete thinkingConsole.dataset.question;
            adminChatHistory = []; // Hapus juga riwayat chat
        }

        if (target.id === 'save-memory-btn') {
            const question = thinkingConsole.dataset.question;
            const answerElement = document.getElementById('final-answer-text');
            if (question && answerElement) {
                const answer = answerElement.innerText;
                target.textContent = 'Menyimpan...';
                target.disabled = true;
                await saveToMemory(question, answer);
                target.textContent = 'Tersimpan!';
                setTimeout(() => { target.textContent = 'Simpan ke Memori'; target.disabled = false; }, 2000);
            }
        }
    });

    function appendThoughtToConsole(thought) {
        let html = '';
        const stepMap = {
            'start': { color: 'text-gray-400', text: `&gt; ${thought.data}` },
            'memory_search': { color: 'text-yellow-400 mt-2', text: `&gt; [Tahap 0] ${thought.data}` },
            'memory_not_found': { color: 'text-gray-500 pl-4 text-sm', text: `&gt; ${thought.data}` },
            'retrieval': { color: 'text-yellow-400 mt-2', text: `&gt; [Tahap 1] ${thought.data}` },
            'refining': { color: 'text-yellow-400 mt-2', text: `&gt; [Tahap 2] ${thought.data}` },
            'final_prompt': { color: 'text-yellow-400 mt-2', text: `&gt; [Tahap 3] ${thought.data}` },
            'error': { color: 'text-red-400', text: `&gt; ${thought.data}` },
            'warning': { color: 'text-red-400', text: `&gt; ${thought.data}` }
        };

        if (stepMap[thought.step]) {
            html = `<p class="${stepMap[thought.step].color}">${stepMap[thought.step].text}</p>`;
        } else if (thought.step === 'memory_found') {
            html = `<div class="pl-4 mt-1 border-l-2 border-green-500">
                       <p class="text-green-400 text-sm">Memori ditemukan. Menggunakan sebagai konteks prioritas.</p>
                       <p class="text-gray-400 text-xs italic">"${thought.data}"</p>
                    </div>`;
        } else if (thought.step === 'retrieved_docs') {
             html = thought.data.map(doc => 
                `<div class="pl-4 mt-1 border-l-2 border-gray-600">
                    <p class="text-cyan-400 text-sm">Dokumen ditemukan: ${doc.source}</p>
                    <p class="text-gray-500 text-xs italic">"${doc.content}"</p>
                </div>`
            ).join('');
        } else if (thought.step === 'refined_context') {
            html = `<div class="pl-4 mt-1 border-l-2 border-gray-600"><p class="text-gray-300 text-sm">${thought.data}</p></div>`;
        } else if (thought.step === 'final_answer') {
            html = `<div class="mt-2 p-3 bg-gray-900 rounded-md">
                        <p class="text-green-400 font-bold">Jawaban Akhir (Bisa Diedit):</p>
                        <div id="final-answer-text" contenteditable="true" class="text-white whitespace-pre-wrap p-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500">${thought.data}</div>
                        <div class="flex space-x-2 mt-3">
                            <button id="save-memory-btn" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-sm rounded">Simpan ke Memori</button>
                            <button id="clear-log-btn" class="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 text-sm rounded">Hapus Log</button>
                        </div>
                    </div>`;
        }
        thinkingConsole.innerHTML += html;
        thinkingConsole.scrollTop = thinkingConsole.scrollHeight;
    }
    
    async function saveToMemory(question, answer) {
        try {
            const response = await fetch('/api/save_memory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, answer })
            });
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message);
        } catch (error) {
            alert(`Gagal menyimpan ke memori: ${error.message}`);
        }
    }
    
    async function performAction(endpoint, message) {
        alert(message);
        try {
            const response = await fetch(endpoint, { method: 'POST' });
            const result = await response.json();
            if (result.status === 'error') throw new Error(result.message);
            alert(`Berhasil: ${result.message}`);
        } catch (error) {
            alert(`Gagal: ${error.message}`);
        }
    }

    // --- Data Management Functions ---
    async function fetchDataAndDisplay() {
        try {
            const response = await fetch('/api/get-scraped-data');
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            currentDataCache = await response.json();
            displayData(currentDataCache);
        } catch (error) {
            modalContentList.innerHTML = `<p class="text-red-400">Gagal memuat data: ${error.message}</p>`;
        }
    }

    function displayData(data) {
        if (data.length === 0) {
            modalContentList.innerHTML = '<p class="text-yellow-400">Tidak ada data yang cocok.</p>';
            return;
        }
        modalContentList.innerHTML = data.map(item => {
            const safeContent = (item.content || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
            return `
                <div class="mb-4 p-4 border border-gray-700 rounded-lg bg-gray-900" id="item-${item.id}">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="text-lg font-bold text-blue-400">${item.title || 'Tanpa Judul'}</h3>
                            <p class="text-xs text-gray-500 mb-2 break-all">${item.url}</p>
                        </div>
                        <div class="flex space-x-2 flex-shrink-0 ml-4">
                            <button class="detail-btn bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-sm rounded" data-id="${item.id}">Detail</button>
                            <button class="edit-btn bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 text-sm rounded" data-id="${item.id}">Ubah</button>
                            <button class="delete-btn bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-sm rounded" data-id="${item.id}">Hapus</button>
                        </div>
                    </div>
                    <p class="text-gray-300 whitespace-pre-wrap text-sm mt-2">${safeContent.substring(0, 200)}...</p>
                </div>
            `;
        }).join('');
    }

    // --- Fungsi CRUD ---
    async function deleteDataItem(id) {
        try {
            const response = await fetch(`/api/data/${id}`, { method: 'DELETE' });
            const result = await response.json();
            if (result.status === 'success') {
                // Hapus dari cache dan re-render
                currentDataCache = currentDataCache.filter(item => item.id != id);
                displayData(currentDataCache);
                alert('Data berhasil dihapus. Jangan lupa Rebuild Index!');
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            alert(`Gagal menghapus data: ${error.message}`);
        }
    }
    
    function showEditFormView(id) {
        const item = currentDataCache.find(d => d.id == id);
        if (!item) return;

        modalTitle.textContent = `Mengubah Data #${id}`;
        modalContentList.classList.add('hidden');
        modalContentDetail.classList.add('hidden');
        modalContentEdit.classList.remove('hidden');

        modalContentEdit.innerHTML = `
            <form id="edit-form" data-id="${id}">
                <div class="mb-4">
                    <label for="edit-title" class="block text-sm font-medium text-gray-400 mb-1">Judul</label>
                    <input type="text" id="edit-title" class="w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600" value="${item.title || ''}">
                </div>
                <div class="mb-4">
                    <label for="edit-content" class="block text-sm font-medium text-gray-400 mb-1">Konten</label>
                    <textarea id="edit-content" rows="15" class="w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600 custom-scrollbar">${item.content || ''}</textarea>
                </div>
                <div class="flex justify-end space-x-3">
                    <button type="button" id="cancel-edit-btn" class="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded">Batal</button>
                    <button type="submit" class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded">Simpan Perubahan</button>
                </div>
            </form>
        `;

        document.getElementById('edit-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveEditedData(id);
        });
        document.getElementById('cancel-edit-btn').addEventListener('click', showDataListView);
    }
    
    function showDetailView(id) {
        const item = currentDataCache.find(d => d.id == id);
        if (!item) return;

        modalTitle.textContent = `Detail Data #${id}`;
        modalContentList.classList.add('hidden');
        modalContentEdit.classList.add('hidden');
        modalContentDetail.classList.remove('hidden');

        const safeContent = (item.content || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
        
        let imageHtml = '';
        if (item.image_url) {
            const imageUrls = item.image_url.split(',');
            const imageElements = imageUrls.map(url => 
                `<img src="${url}" alt="Gambar Terkait" class="rounded-lg w-full h-auto mb-2" loading="lazy">`
            ).join('');
            imageHtml = `
                <div class="my-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    ${imageElements}
                </div>
            `;
        }

        modalContentDetail.innerHTML = `
            <div class="space-y-4">
                <div>
                    <h3 class="text-2xl font-bold text-blue-400">${item.title || 'Tanpa Judul'}</h3>
                    <p class="text-sm text-gray-500 mt-1 break-all">${item.url}</p>
                </div>
                ${imageHtml}
                <div class="text-gray-300 whitespace-pre-wrap text-base border-t border-gray-700 pt-4">
                    ${safeContent}
                </div>
                <div class="flex justify-end pt-4">
                    <button id="back-to-list-btn" class="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded">Kembali ke Daftar</button>
                </div>
            </div>
        `;

        document.getElementById('back-to-list-btn').addEventListener('click', showDataListView);
    }
    
    async function saveEditedData(id) {
        const newTitle = document.getElementById('edit-title').value;
        const newContent = document.getElementById('edit-content').value;
        try {
            const response = await fetch(`/api/data/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle, content: newContent })
            });
            const result = await response.json();
            if (result.status === 'success') {
                alert('Data berhasil diperbarui. Jangan lupa Rebuild Index!');
                showDataListView();
                await fetchDataAndDisplay();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            alert(`Gagal menyimpan data: ${error.message}`);
        }
    }

    // --- Fungsi Utilitas Tampilan ---
    function showDataListView() {
        modalTitle.textContent = 'Data yang Telah Di-Scrape';
        modalContentEdit.innerHTML = '';
        modalContentDetail.innerHTML = '';
        modalContentEdit.classList.add('hidden');
        modalContentDetail.classList.add('hidden');
        modalContentList.classList.remove('hidden');
    }

    // --- Core Process Runner ---
    async function runProcess(endpoint, processName) {
        [scrapeBtn, reindexBtn, viewDataBtn].forEach(btn => btn.disabled = true);
        
        statusSpan.textContent = processName;
        statusSpan.className = 'font-semibold text-blue-400';
        consoleDiv.innerHTML = `<p class="text-yellow-400">> Memulai proses ${processName}...</p>`;

        try {
            const response = await fetch(endpoint, { method: 'POST' });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.trim() !== '');
                
                lines.forEach(line => {
                    const p = document.createElement('p');
                    p.textContent = `> ${line}`;
                    if(line.toLowerCase().includes('error')) p.className = 'text-red-400';
                    else if(line.toLowerCase().includes('success')) p.className = 'text-green-400';
                    else p.className = 'text-gray-300';
                    consoleDiv.appendChild(p);
                });
                consoleDiv.scrollTop = consoleDiv.scrollHeight;
            }
        } catch (error) {
            const p = document.createElement('p');
            p.className = 'text-red-500';
            p.textContent = `> Error: ${error.message}`;
            consoleDiv.appendChild(p);
        } finally {
            [scrapeBtn, reindexBtn, viewDataBtn].forEach(btn => btn.disabled = false);

            statusSpan.textContent = 'Selesai';
            statusSpan.className = 'font-semibold text-green-400';
            const p = document.createElement('p');
            p.className = 'text-yellow-400';
            p.textContent = `> Proses ${processName} Selesai. Kembali ke status Idle.`;
            consoleDiv.appendChild(p);
            consoleDiv.scrollTop = consoleDiv.scrollHeight;
        }
    }
});