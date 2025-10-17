document.addEventListener('DOMContentLoaded', () => {
    // Definisi Variabel DOM
    const authOverlay = document.getElementById('auth-overlay');
    const adminPanel = document.getElementById('admin-panel');
    const adminCodeInput = document.getElementById('admin-code');
    const errorMsg = document.getElementById('error-msg');
    const scrapeBtn = document.getElementById('scrape-btn');
    const reindexBtn = document.getElementById('reindex-btn');
    const viewDataBtn = document.getElementById('view-data-btn');
    const viewBugsBtn = document.getElementById('view-bugs-btn');
    const consoleDiv = document.getElementById('console');
    const statusSpan = document.getElementById('status');
    const dataModal = document.getElementById('data-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalTitle = document.getElementById('modal-title');
    const modalContentList = document.getElementById('modal-content-list');
    const modalContentEdit = document.getElementById('modal-content-edit');
    const modalContentDetail = document.getElementById('modal-content-detail');
    const modalContentBugDetail = document.getElementById('modal-content-bug-detail');
    const searchContainer = document.getElementById('search-container');
    const searchDataInput = document.getElementById('search-data-input');
    const dataFilterContainer = document.getElementById('data-filter-container');
    const bugFilterContainer = document.getElementById('bug-filter-container');
    const adminChatForm = document.getElementById('admin-chat-form');
    const adminChatInput = document.getElementById('admin-chat-input');
    const adminChatSubmit = document.getElementById('admin-chat-submit');
    const thinkingConsole = document.getElementById('thinking-console');
    const deleteFaissBtn = document.getElementById('delete-faiss-btn');
    const deleteDbBtn = document.getElementById('delete-db-btn');
    const tutorialBtn = document.getElementById('tutorial-btn');
    const tutorialModal = document.getElementById('tutorial-modal');
    const closeTutorialBtn = document.getElementById('close-tutorial-btn');
    const tutorialContentContainer = document.getElementById('tutorial-content-container');
    const manualTextForm = document.getElementById('manual-text-form');
    const manualTextSubmitBtn = document.getElementById('manual-text-submit-btn');
    const manualFileForm = document.getElementById('manual-file-form');
    const manualFileSubmitBtn = document.getElementById('manual-file-submit-btn');
    const manualFileInput = document.getElementById('manual-file');
    const fileUploadFilename = document.getElementById('file-upload-filename');

    // Variabel State Aplikasi
    let currentDataCache = [];
    let currentBugReportsCache = [];
    let adminChatHistory = [];
    let tutorialContentLoaded = false;
    const ADMIN_CODE = '355123';

    // --- FUNGSI UTAMA ---

    function appendThoughtToConsole(thought) {
        let html = '';
        const stepMap = {
            'start': { color: 'text-gray-400', text: `&gt; ${thought.data}` },
            'memory_search': { color: 'text-yellow-400 mt-2', text: `&gt; [TAHAP 1] ${thought.data}` },
            'memory_found': { color: 'text-green-400 pl-4 text-sm', text: `&gt; ${thought.data}` },
            'memory_not_found': { color: 'text-gray-500 pl-4 text-sm', text: `&gt; ${thought.data}` },
            'manual_search': { color: 'text-yellow-400 mt-2', text: `&gt; [TAHAP 2] ${thought.data}` },
            'manual_found': { color: 'text-cyan-400 pl-4 text-sm', text: `&gt; ${thought.data}` },
            'manual_not_found': { color: 'text-gray-500 pl-4 text-sm', text: `&gt; ${thought.data}` },
            'scrape_search': { color: 'text-yellow-400 mt-2', text: `&gt; [TAHAP 3] ${thought.data}` },
            'scrape_found': { color: 'text-blue-400 pl-4 text-sm', text: `&gt; ${thought.data}` },
            'scrape_not_found': { color: 'text-gray-500 pl-4 text-sm', text: `&gt; ${thought.data}` },
            'final_prompt': { color: 'text-purple-400 mt-2', text: `&gt; [TAHAP 4] ${thought.data}` },
            'info': { color: 'text-gray-500 pl-4 text-sm', text: `&gt; ${thought.data}` },
            'error': { color: 'text-red-400 font-bold', text: `&gt; ERROR: ${thought.data}` },
            'warning': { color: 'text-yellow-500', text: `&gt; PERINGATAN: ${thought.data}` }
        };

        if (stepMap[thought.step]) {
            html = `<p class="${stepMap[thought.step].color}">${stepMap[thought.step].text}</p>`;
        } else if (thought.step === 'retrieved_docs') {
             html = thought.data.map(doc => {
                let borderColor = 'border-gray-600';
                if (doc.source.includes('[Memory Bank]')) borderColor = 'border-green-500';
                else if (doc.source.includes('[Data Manual]')) borderColor = 'border-cyan-500';
                else if (doc.source.includes('[Data Scrap]')) borderColor = 'border-blue-500';

                return `<div class="pl-4 mt-1 border-l-2 ${borderColor}">
                    <p class="text-gray-400 text-sm">Dokumen ditemukan: ${doc.source}</p>
                    <p class="text-gray-500 text-xs italic">"${doc.content}"</p>
                </div>`
             }).join('');
        } else if (thought.step === 'final_answer') {
            html = `<div class="mt-4 p-3 bg-gray-900 rounded-md">
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

    async function runProcess(endpoint, processName) {
        [scrapeBtn, reindexBtn, viewDataBtn, viewBugsBtn].forEach(btn => btn.disabled = true);

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
                    else if(line.toLowerCase().includes('success') || line.toLowerCase().includes('berhasil')) p.className = 'text-green-400';
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
            [scrapeBtn, reindexBtn, viewDataBtn, viewBugsBtn].forEach(btn => btn.disabled = false);

            statusSpan.textContent = 'Selesai';
            statusSpan.className = 'font-semibold text-green-400';
            const p = document.createElement('p');
            p.className = 'text-yellow-400';
            p.textContent = `> Proses ${processName} Selesai. Kembali ke status Idle.`;
            consoleDiv.appendChild(p);
            consoleDiv.scrollTop = consoleDiv.scrollHeight;
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

    // --- MANAJEMEN DATA BANK ---

    // ========================================================================
    // --- FUNGSI DIPERBAIKI ---
    // ========================================================================
    async function fetchDataAndDisplay() {
        try {
            const response = await fetch('/api/get-data');
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            currentDataCache = await response.json();
            
            // Perbaikan: Langsung panggil displayData dan atur status UI
            displayData(currentDataCache);
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelector('.filter-btn[data-filter="Semua"]').classList.add('active');
            
        } catch (error) {
            modalContentList.innerHTML = `<p class="text-red-400">Gagal memuat data: ${error.message}</p>`;
        }
    }
    // ========================================================================
    // --- AKHIR DARI FUNGSI YANG DIPERBAIKI ---
    // ========================================================================

    dataFilterContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
            const filter = e.target.dataset.filter;
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            
            const query = searchDataInput.value.toLowerCase();
            let filteredData = currentDataCache;

            if (filter !== 'Semua') {
                filteredData = filteredData.filter(item => item.type === filter);
            }
            
            if (query) {
                filteredData = filteredData.filter(item => {
                    return (item.title || '').toLowerCase().includes(query) || (item.content || '').toLowerCase().includes(query);
                });
            }
            
            displayData(filteredData);
        }
    });

    searchDataInput.addEventListener('input', () => {
        const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;
        document.querySelector(`.filter-btn[data-filter="${activeFilter}"]`).click();
    });

    function displayData(data) {
        if (data.length === 0) {
            modalContentList.innerHTML = '<p class="text-yellow-400">Tidak ada data yang cocok dengan filter ini.</p>';
            return;
        }

        const typeColors = {
            'Scrap': 'bg-blue-600 text-blue-100',
            'Manual': 'bg-green-600 text-green-100',
            'Memory': 'bg-purple-600 text-purple-100'
        };

        modalContentList.innerHTML = data.map(item => {
            const safeContent = (item.content || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const typeColor = typeColors[item.type] || 'bg-gray-600 text-gray-100';
            
            return `
                <div class="mb-4 p-4 border border-gray-700 rounded-lg bg-gray-900" id="item-${item.type}-${item.id}">
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="flex items-center gap-2 mb-2">
                                <span class="px-2 py-0.5 text-xs font-semibold rounded-full ${typeColor}">${item.type}</span>
                                <h3 class="text-lg font-bold text-blue-400">${item.title || 'Tanpa Judul'}</h3>
                            </div>
                            <p class="text-xs text-gray-500 mb-2 break-all">${item.url || ''}</p>
                        </div>
                        <div class="flex space-x-2 flex-shrink-0 ml-4">
                            <button class="detail-btn bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 text-sm rounded" data-id="${item.id}" data-type="${item.type}">Detail</button>
                            <button class="edit-btn bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 text-sm rounded" data-id="${item.id}" data-type="${item.type}">Ubah</button>
                            <button class="delete-btn bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-sm rounded" data-id="${item.id}" data-type="${item.type}">Hapus</button>
                        </div>
                    </div>
                    <p class="text-gray-300 whitespace-pre-wrap text-sm mt-2">${safeContent.substring(0, 200)}...</p>
                </div>
            `;
        }).join('');
    }
    
    async function deleteDataItem(id, type) {
        try {
            const response = await fetch(`/api/data/${type}/${id}`, { method: 'DELETE' });
            const result = await response.json();
            if (result.status === 'success') {
                alert('Data berhasil dihapus. Jangan lupa Rebuild Index!');
                await fetchDataAndDisplay();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            alert(`Gagal menghapus data: ${error.message}`);
        }
    }

    function showEditFormView(id, type) {
        const item = currentDataCache.find(d => d.id == id && d.type === type);
        if (!item) return;

        showModalView('data-edit');
        modalTitle.textContent = `Mengubah Data #${id} (${type})`;
        
        const isMemory = type === 'Memory';
        const titleLabel = isMemory ? 'Pertanyaan' : 'Judul';
        const contentLabel = isMemory ? 'Jawaban' : 'Konten';

        modalContentEdit.innerHTML = `
            <form id="edit-form" data-id="${id}" data-type="${type}">
                <div class="mb-4">
                    <label for="edit-title" class="block text-sm font-medium text-gray-400 mb-1">${titleLabel}</label>
                    <textarea id="edit-title" rows="${isMemory ? 3 : 1}" class="w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600 custom-scrollbar">${item.title || ''}</textarea>
                </div>
                <div class="mb-4">
                    <label for="edit-content" class="block text-sm font-medium text-gray-400 mb-1">${contentLabel}</label>
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
            await saveEditedData(id, type);
        });
        document.getElementById('cancel-edit-btn').addEventListener('click', () => {
            showModalView('data');
            const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;
            document.querySelector(`.filter-btn[data-filter="${activeFilter}"]`).click();
        });
    }

    async function saveEditedData(id, type) {
        const newTitle = document.getElementById('edit-title').value;
        const newContent = document.getElementById('edit-content').value;
        try {
            const response = await fetch(`/api/data/${type}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle, content: newContent })
            });
            const result = await response.json();
            if (result.status === 'success') {
                alert('Data berhasil diperbarui. Jangan lupa Rebuild Index!');
                showModalView('data');
                await fetchDataAndDisplay();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            alert(`Gagal menyimpan data: ${error.message}`);
        }
    }
    
    function showDetailView(id, type) {
        const item = currentDataCache.find(d => d.id == id && d.type === type);
        if (!item) return;
        
        showModalView('data-detail');
        modalTitle.textContent = `Detail Data #${id} (${type})`;

        const safeContent = (item.content || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const titleLabel = type === 'Memory' ? 'Pertanyaan' : 'Judul';
        const contentLabel = type === 'Memory' ? 'Jawaban' : 'Konten';
        
        let imageHtml = '';
        if (item.image_url) {
            imageHtml = `<img src="${item.image_url.split(',')[0]}" alt="Gambar" class="rounded-lg max-w-sm mx-auto my-4">`;
        }

        modalContentDetail.innerHTML = `
            <div class="space-y-4">
                <div>
                    <p class="text-sm text-gray-400">${titleLabel}</p>
                    <h3 class="text-2xl font-bold text-blue-400">${item.title || 'Tanpa Judul'}</h3>
                    <p class="text-sm text-gray-500 mt-1 break-all">${item.url || ''}</p>
                </div>
                ${imageHtml}
                <div class="border-t border-gray-700 pt-4">
                     <p class="text-sm text-gray-400">${contentLabel}</p>
                    <div class="text-gray-300 whitespace-pre-wrap text-base">${safeContent}</div>
                </div>
                <div class="flex justify-end pt-4">
                    <button id="back-to-list-btn" class="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded">Kembali ke Daftar</button>
                </div>
            </div>
        `;

        document.getElementById('back-to-list-btn').addEventListener('click', () => {
            showModalView('data');
            const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;
            document.querySelector(`.filter-btn[data-filter="${activeFilter}"]`).click();
        });
    }

    // --- MANAJEMEN LAPORAN BUG ---

    async function fetchBugsAndDisplay() {
        try {
            const response = await fetch('/api/get_bug_reports');
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            currentBugReportsCache = await response.json();
            const allFilterButton = document.querySelector('.bug-filter-btn[data-filter="Semua"]');
            if (allFilterButton) {
                allFilterButton.click();
            } else {
                displayBugReports(currentBugReportsCache);
            }
        } catch (error) {
            modalContentList.innerHTML = `<p class="text-red-400">Gagal memuat laporan bug: ${error.message}</p>`;
        }
    }

    function displayBugReports(reports) {
        if (reports.length === 0) {
            modalContentList.innerHTML = '<p class="text-yellow-400">Tidak ada laporan bug yang cocok dengan filter ini.</p>';
            return;
        }
        const statusColors = {
            'Baru': 'bg-blue-500',
            'Sedang Diproses': 'bg-yellow-500',
            'Selesai': 'bg-green-500',
            'Tidak Akan Diperbaiki': 'bg-gray-500'
        };
        const statusOptions = ['Baru', 'Sedang Diproses', 'Selesai', 'Tidak Akan Diperbaiki'];

        modalContentList.innerHTML = reports.map(report => {
            const safeDescription = (report.description || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const selectOptions = statusOptions.map(opt => `<option value="${opt}" ${report.status === opt ? 'selected' : ''}>${opt}</option>`).join('');

            return `
                <div class="mb-4 p-4 border border-gray-700 rounded-lg bg-gray-900" id="bug-item-${report.id}">
                    <div class="flex justify-between items-start flex-wrap gap-2">
                        <div>
                            <div class="flex items-center gap-3 mb-2">
                                <span class="text-lg font-bold text-blue-400">Laporan #${report.id}</span>
                                <span class="px-2 py-0.5 text-xs font-semibold rounded-full ${statusColors[report.status] || 'bg-gray-600'}">${report.status}</span>
                            </div>
                            <p class="text-xs text-gray-500">${new Date(report.reported_at).toLocaleString()}</p>
                        </div>
                        <div class="flex items-center space-x-2 flex-shrink-0">
                             <select class="bug-status-select bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-sm focus:outline-none" data-id="${report.id}">${selectOptions}</select>
                            <button class="bug-detail-btn bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-sm rounded" data-id="${report.id}">Detail</button>
                            <button class="bug-delete-btn bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-sm rounded" data-id="${report.id}">Hapus</button>
                        </div>
                    </div>
                    <p class="text-gray-300 whitespace-pre-wrap text-sm mt-3">${safeDescription.substring(0, 150)}...</p>
                </div>
            `;
        }).join('');
    }

    async function updateBugStatus(id, status) {
        try {
            const response = await fetch(`/api/bug_reports/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: status })
            });
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message);
            const reportInCache = currentBugReportsCache.find(r => r.id == id);
            if (reportInCache) reportInCache.status = status;
            
            const activeFilter = document.querySelector('.bug-filter-btn.active').dataset.filter;
            const filteredReports = activeFilter === 'Semua' ? currentBugReportsCache : currentBugReportsCache.filter(r => r.status === activeFilter);
            displayBugReports(filteredReports);
        } catch (error) {
            alert(`Gagal memperbarui status: ${error.message}`);
        }
    }

    async function deleteBugReport(id) {
        try {
            const response = await fetch(`/api/bug_reports/${id}`, { method: 'DELETE' });
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message);
            currentBugReportsCache = currentBugReportsCache.filter(r => r.id != id);
            const activeFilter = document.querySelector('.bug-filter-btn.active').dataset.filter;
            const filteredReports = activeFilter === 'Semua' ? currentBugReportsCache : currentBugReportsCache.filter(r => r.status === activeFilter);
            displayBugReports(filteredReports);
        } catch (error) {
            alert(`Gagal menghapus laporan: ${error.message}`);
        }
    }

    function showBugDetailView(id) {
        const report = currentBugReportsCache.find(r => r.id == id);
        if (!report) return;

        showModalView('bug-detail');
        modalTitle.textContent = `Detail Laporan Bug #${id}`;
        
        const safeDescription = (report.description || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
        let fileHtml = '<p class="text-gray-500 text-sm">Tidak ada file lampiran.</p>';
        if (report.file_path) {
            const filePath = `/uploads/${report.file_path}`;
            const isImage = ['png', 'jpg', 'jpeg', 'gif'].some(ext => filePath.toLowerCase().endsWith(ext));
            const isVideo = ['mp4', 'mov', 'avi', 'webm'].some(ext => filePath.toLowerCase().endsWith(ext));

            if (isImage) {
                fileHtml = `<a href="${filePath}" target="_blank" rel="noopener noreferrer"><img src="${filePath}" alt="Lampiran Bug" class="max-w-md rounded-lg mt-2"/></a>`;
            } else if (isVideo) {
                fileHtml = `<video controls class="max-w-md rounded-lg mt-2"><source src="${filePath}">Browser Anda tidak mendukung tag video.</video>`;
            } else {
                fileHtml = `<a href="${filePath}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">Lihat File Lampiran</a>`;
            }
        }

        modalContentBugDetail.innerHTML = `
            <div class="space-y-4">
                <div>
                    <p class="text-sm text-gray-400">Status: <span class="font-bold">${report.status}</span></p>
                    <p class="text-sm text-gray-400">Dilaporkan pada: <span class="font-bold">${new Date(report.reported_at).toLocaleString()}</span></p>
                </div>
                <div class="text-gray-300 whitespace-pre-wrap text-base border-t border-gray-700 pt-4">${safeDescription}</div>
                <div class="border-t border-gray-700 pt-4">
                    <h4 class="text-lg font-semibold text-gray-300 mb-2">Lampiran</h4>
                    ${fileHtml}
                </div>
                <div class="flex justify-end pt-4">
                    <button id="back-to-bug-list-btn" class="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded">Kembali ke Daftar</button>
                </div>
            </div>
        `;

        document.getElementById('back-to-bug-list-btn').addEventListener('click', () => {
            showModalView('bugs');
            fetchBugsAndDisplay();
        });
    }

    // --- MANAJEMEN MODAL & UI ---

    function showModalView(type) {
        modalContentList.classList.add('hidden');
        modalContentEdit.classList.add('hidden');
        modalContentDetail.classList.add('hidden');
        modalContentBugDetail.classList.add('hidden');
        searchContainer.classList.add('hidden');
        bugFilterContainer.classList.add('hidden');
        dataFilterContainer.classList.add('hidden');

        if (type === 'data') {
            modalTitle.textContent = 'Data Bank';
            dataFilterContainer.classList.remove('hidden');
            searchContainer.classList.remove('hidden');
            modalContentList.classList.remove('hidden');
        } else if (type === 'bugs') {
            modalTitle.textContent = 'Laporan Bug';
            bugFilterContainer.classList.remove('hidden');
            modalContentList.classList.remove('hidden');
        } else if (type === 'data-edit') {
            modalContentEdit.classList.remove('hidden');
        } else if (type === 'data-detail') {
            modalContentDetail.classList.remove('hidden');
        } else if (type === 'bug-detail') {
            modalContentBugDetail.classList.remove('hidden');
        }
        dataModal.classList.remove('hidden');
    }

    // --- EVENT LISTENERS ---

    adminCodeInput.addEventListener('keyup', (e) => {
        if (e.target.value === ADMIN_CODE) {
            authOverlay.classList.add('hidden');
            adminPanel.classList.remove('hidden');
        } else if (e.target.value.length >= ADMIN_CODE.length) {
             errorMsg.textContent = 'Kode salah.'
        }
    });

    scrapeBtn.addEventListener('click', () => runProcess('/api/scrape', 'Scraping'));
    reindexBtn.addEventListener('click', () => runProcess('/api/reindex', 'Indexing'));
    deleteFaissBtn.addEventListener('click', () => {
        if (confirm("ANDA YAKIN ingin menghapus seluruh file Index FAISS?\nAI tidak akan bisa mencari dokumen sampai Anda 'Rebuild Index' lagi.")) {
            performAction('/api/delete_faiss', 'Menghapus FAISS Index...');
        }
    });
    deleteDbBtn.addEventListener('click', () => {
        if (confirm("ANDA YAKIN ingin menghapus seluruh DATABASE?\nIni akan menghapus SEMUA data (scraping, manual, memori).")) {
            performAction('/api/delete_db', 'Menghapus Database...');
        }
    });

    viewDataBtn.addEventListener('click', async () => {
        showModalView('data');
        modalContentList.innerHTML = '<p class="text-gray-400">Memuat data...</p>';
        await fetchDataAndDisplay();
    });

    viewBugsBtn.addEventListener('click', async () => {
        showModalView('bugs');
        modalContentList.innerHTML = '<p class="text-gray-400">Memuat laporan bug...</p>';
        await fetchBugsAndDisplay();
    });
    
    closeModalBtn.addEventListener('click', () => dataModal.classList.add('hidden'));

    tutorialBtn.addEventListener('click', async () => {
        if (!tutorialContentLoaded) {
            try {
                const response = await fetch('tutorial.html');
                if (!response.ok) throw new Error('File tutorial tidak ditemukan.');
                const tutorialHtml = await response.text();
                tutorialContentContainer.innerHTML = tutorialHtml;
                tutorialContentLoaded = true;
            } catch (error) {
                tutorialContentContainer.innerHTML = `<p class="text-red-400">Gagal memuat tutorial: ${error.message}</p>`;
            }
        }
        tutorialModal.classList.remove('hidden');
    });
    closeTutorialBtn.addEventListener('click', () => tutorialModal.classList.add('hidden'));
    
    manualFileInput.addEventListener('change', () => {
        if (manualFileInput.files.length > 0) {
            fileUploadFilename.textContent = manualFileInput.files[0].name;
        } else {
            fileUploadFilename.textContent = 'Pilih File (.pdf, .docx, .pptx)';
        }
    });

    manualTextForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('manual-title-text').value;
        const content = document.getElementById('manual-content').value;
        if (!content.trim()) {
            alert('Konten teks tidak boleh kosong.');
            return;
        }
        manualTextSubmitBtn.disabled = true;
        manualTextSubmitBtn.textContent = 'Menambahkan...';
        try {
            const response = await fetch('/api/add_manual_text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content }),
            });
            const result = await response.json();
            if (response.ok && result.status === 'success') {
                alert('Data teks berhasil ditambahkan. Jangan lupa Rebuild Index!');
                manualTextForm.reset();
            } else {
                throw new Error(result.message || 'Terjadi kesalahan.');
            }
        } catch (error) {
            alert(`Gagal menambahkan data: ${error.message}`);
        } finally {
            manualTextSubmitBtn.disabled = false;
            manualTextSubmitBtn.textContent = 'Tambah Konteks Teks';
        }
    });

    manualFileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (manualFileInput.files.length === 0) {
            alert('Silakan pilih file untuk diunggah.');
            return;
        }
        const formData = new FormData(manualFileForm);
        manualFileSubmitBtn.disabled = true;
        manualFileSubmitBtn.textContent = 'Mengunggah...';
        try {
            const response = await fetch('/api/add_manual_file', {
                method: 'POST',
                body: formData,
            });
            const result = await response.json();
            if (response.ok && result.status === 'success') {
                alert('File berhasil ditambahkan. Jangan lupa Rebuild Index!');
                manualFileForm.reset();
                fileUploadFilename.textContent = 'Pilih File (.pdf, .docx, .pptx)';
            } else {
                throw new Error(result.message || 'Terjadi kesalahan.');
            }
        } catch (error) {
            alert(`Gagal menambahkan file: ${error.message}`);
        } finally {
            manualFileSubmitBtn.disabled = false;
            manualFileSubmitBtn.textContent = 'Tambah Konteks File';
        }
    });

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
            if (!response.body) throw new Error('Response body is null.');
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            const processBuffer = () => {
                let newlineIndex;
                while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
                    const line = buffer.slice(0, newlineIndex).trim();
                    buffer = buffer.slice(newlineIndex + 1);
                    if (line) {
                        try {
                            const thought = JSON.parse(line);
                            appendThoughtToConsole(thought);
                            if (thought.step === 'final_answer') {
                                adminChatHistory.push({ role: "model", parts: [{ text: thought.data }] });
                            }
                        } catch (e) { console.error("Gagal parse JSON:", line, e); }
                    }
                }
            };
            while (true) {
                const { done, value } = await reader.read();
                if (done) { if (buffer) processBuffer(); break; }
                buffer += decoder.decode(value, { stream: true });
                processBuffer();
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
            thinkingConsole.innerHTML = '<p class="text-gray-500">> Menunggu pertanyaan...</p>';
            delete thinkingConsole.dataset.question;
            adminChatHistory = [];
        }
        if (target.id === 'save-memory-btn') {
            const question = thinkingConsole.dataset.question;
            const answerElement = document.getElementById('final-answer-text');
            if (question && answerElement) {
                const answer = answerElement.innerText;
                target.textContent = 'Menyimpan...';
                target.disabled = true;
                try {
                    const response = await fetch('/api/save_memory', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ question, answer })
                    });
                    const result = await response.json();
                    if (result.status !== 'success') throw new Error(result.message);
                    target.textContent = 'Tersimpan!';
                } catch (error) {
                    alert(`Gagal menyimpan ke memori: ${error.message}`);
                    target.textContent = 'Simpan ke Memori';
                } finally {
                    setTimeout(() => {
                        target.textContent = 'Simpan ke Memori';
                        target.disabled = false;
                    }, 2000);
                }
            }
        }
    });

    bugFilterContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('bug-filter-btn')) {
            const filter = e.target.dataset.filter;
            document.querySelectorAll('.bug-filter-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            const filteredReports = filter === 'Semua' 
                ? currentBugReportsCache 
                : currentBugReportsCache.filter(report => report.status === filter);
            displayBugReports(filteredReports);
        }
    });
    
    modalContentList.addEventListener('click', async (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        const id = button.dataset.id;
        const type = button.dataset.type;

        // Event untuk tombol data bank
        if (button.classList.contains('detail-btn')) showDetailView(id, type);
        if (button.classList.contains('edit-btn')) showEditFormView(id, type);
        if (button.classList.contains('delete-btn')) {
            if (confirm(`Anda yakin ingin menghapus item [${type}] #${id}?`)) {
                await deleteDataItem(id, type);
            }
        }

        // Event untuk tombol bug report
        if (button.classList.contains('bug-detail-btn')) showBugDetailView(id);
        if (button.classList.contains('bug-delete-btn')) {
            if (confirm(`Anda yakin ingin menghapus laporan bug #${id}?`)) {
                await deleteBugReport(id);
            }
        }
    });

    modalContentList.addEventListener('change', async (e) => {
        if (e.target.classList.contains('bug-status-select')) {
            const id = e.target.dataset.id;
            const newStatus = e.target.value;
            await updateBugStatus(id, newStatus);
        }
    });

});