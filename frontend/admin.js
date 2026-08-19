document.addEventListener('DOMContentLoaded', () => {
    // ============================================================
    //  DOM REFERENCES
    // ============================================================
    const authOverlay = document.getElementById('auth-overlay');
    const adminPanel = document.getElementById('admin-panel');
    const adminCodeInput = document.getElementById('admin-code');
    const errorMsg = document.getElementById('error-msg');
    const scrapeBtn = document.getElementById('scrape-btn');
    const reindexBtn = document.getElementById('reindex-btn');
    const consoleDiv = document.getElementById('console');
    const statusSpan = document.getElementById('status');

    // Sidebar & Navigation
    const sidebar = document.getElementById('admin-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const navItems = document.querySelectorAll('.nav-item[data-section]');
    const contentSections = document.querySelectorAll('.content-section');
    const logoutBtn = document.getElementById('logout-btn');

    // Theme
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const themeIcon = document.getElementById('theme-icon');
    const themeLabel = document.getElementById('theme-label');

    // Data Bank section
    const dataListContent = document.getElementById('data-list-content');
    const dataFilterContainer = document.getElementById('data-filter-container');
    const searchDataInput = document.getElementById('search-data-input');

    // Bug Reports section
    const bugListContent = document.getElementById('bug-list-content');
    const bugFilterContainer = document.getElementById('bug-filter-container');

    // Modals
    const dataModal = document.getElementById('data-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalTitle = document.getElementById('modal-title');
    const modalContentEdit = document.getElementById('modal-content-edit');
    const modalContentDetail = document.getElementById('modal-content-detail');
    const modalContentBugDetail = document.getElementById('modal-content-bug-detail');

    // Tutorial Modal
    const tutorialBtn = document.getElementById('tutorial-btn');
    const tutorialBtnSettings = document.getElementById('tutorial-btn-settings');
    const tutorialModal = document.getElementById('tutorial-modal');
    const closeTutorialBtn = document.getElementById('close-tutorial-btn');
    const tutorialContentContainer = document.getElementById('tutorial-content-container');

    // AI Test
    const adminChatForm = document.getElementById('admin-chat-form');
    const adminChatInput = document.getElementById('admin-chat-input');
    const adminChatSubmit = document.getElementById('admin-chat-submit');
    const thinkingConsole = document.getElementById('thinking-console');

    // Dangerous Actions
    const deleteFaissBtn = document.getElementById('delete-faiss-btn');
    const deleteDbBtn = document.getElementById('delete-db-btn');

    // Add Data Forms
    const manualTextForm = document.getElementById('manual-text-form');
    const manualTextSubmitBtn = document.getElementById('manual-text-submit-btn');
    const manualFileForm = document.getElementById('manual-file-form');
    const manualFileSubmitBtn = document.getElementById('manual-file-submit-btn');
    const manualFileInput = document.getElementById('manual-file');
    const fileUploadFilename = document.getElementById('file-upload-filename');

    // ============================================================
    //  STATE
    // ============================================================
    let currentDataCache = [];
    let currentBugReportsCache = [];
    let adminChatHistory = [];
    let tutorialContentLoaded = false;
    let currentSection = 'dashboard';
    let csrfToken = '';  // [C3] CSRF token from login

    // ============================================================
    //  THEME MANAGEMENT
    // ============================================================
    function getCurrentTheme() {
        return document.documentElement.getAttribute('data-theme') || 'dark';
    }

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('damayai-admin-theme', theme);
        updateThemeUI(theme);
    }

    function updateThemeUI(theme) {
        if (theme === 'dark') {
            themeIcon.innerHTML = '<i class="fas fa-moon"></i>';
            themeLabel.textContent = 'Mode Gelap';
        } else {
            themeIcon.innerHTML = '<i class="fas fa-sun"></i>';
            themeLabel.textContent = 'Mode Terang';
        }
    }

    themeToggleBtn.addEventListener('click', () => {
        const current = getCurrentTheme();
        setTheme(current === 'dark' ? 'light' : 'dark');
    });

    // Init theme UI
    updateThemeUI(getCurrentTheme());

    // ============================================================
    //  AUTHENTICATION & INIT
    // ============================================================
    
    // Optimistic UI: If session storage says we are admin, hide overlay immediately to prevent clunky flashing
    if (sessionStorage.getItem('isAdmin') === 'true') {
        if(authOverlay) authOverlay.style.display = 'none';
        if(adminPanel) adminPanel.style.display = 'flex';
    }

    async function checkAuth() {
        try {
            const tokenResp = await fetch('/api/csrf-token');
            if (tokenResp.ok) {
                const tokenData = await tokenResp.json();
                csrfToken = tokenData.csrf_token || '';
                sessionStorage.setItem('isAdmin', 'true');
                if(authOverlay) authOverlay.style.display = 'none';
                if(adminPanel) adminPanel.style.display = 'flex';
                
                // Initialize page-specific data
                if (dataListContent) loadDataBank();
                if (bugListContent) loadBugReports();
            } else {
                sessionStorage.removeItem('isAdmin');
                if(authOverlay) authOverlay.style.display = 'flex';
                if(adminPanel) adminPanel.style.display = 'none';
            }
        } catch(e) {
            sessionStorage.removeItem('isAdmin');
            if(authOverlay) authOverlay.style.display = 'flex';
            if(adminPanel) adminPanel.style.display = 'none';
        }
    }
    checkAuth();

    // Mobile sidebar
    function openMobileSidebar() {
        if(sidebar) sidebar.classList.add('open');
        if(sidebarOverlay) sidebarOverlay.classList.add('open');
    }

    function closeMobileSidebar() {
        if(sidebar) sidebar.classList.remove('open');
        if(sidebarOverlay) sidebarOverlay.classList.remove('open');
    }

    if(hamburgerBtn) hamburgerBtn.addEventListener('click', openMobileSidebar);
    if(sidebarOverlay) sidebarOverlay.addEventListener('click', closeMobileSidebar);

    // ============================================================
    //  AUTHENTICATION
    // ============================================================
    async function tryLogin() {
        const password = adminCodeInput.value;
        if (!password) return;
        errorMsg.textContent = '';
        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            const result = await response.json();
            if (response.ok && result.status === 'success') {
                // [C3] Store CSRF token from login response
                csrfToken = result.csrf_token || '';
                sessionStorage.setItem('isAdmin', 'true');
                if(authOverlay) authOverlay.style.display = 'none';
                if(adminPanel) adminPanel.style.display = 'flex';
                
                // Initialize page-specific data
                if (dataListContent) loadDataBank();
                if (bugListContent) loadBugReports();
            } else {
                if(errorMsg) errorMsg.textContent = result.message || 'Kata sandi salah.';
                if(adminCodeInput) adminCodeInput.value = '';
            }
        } catch (err) {
            if(errorMsg) errorMsg.textContent = 'Gagal menghubungi server.';
        }
    }

    if(adminCodeInput) {
        adminCodeInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') tryLogin();
            else if(errorMsg) errorMsg.textContent = '';
        });
    }

    // Global 401/403 handler with CSRF token injection
    async function apiFetch(url, options = {}) {
        // [C3] Inject CSRF token header for state-changing requests
        if (csrfToken) {
            options.headers = options.headers || {};
            // Only set for non-FormData requests (FormData sets its own content-type)
            if (!(options.body instanceof FormData)) {
                options.headers['X-CSRF-Token'] = csrfToken;
            } else {
                // For FormData, we can still set CSRF header
                options.headers['X-CSRF-Token'] = csrfToken;
            }
        }
        const response = await fetch(url, options);
        if (response.status === 401) {
            authOverlay.style.display = 'flex';
            adminPanel.style.display = 'none';
            errorMsg.textContent = 'Sesi berakhir. Silakan login kembali.';
            adminCodeInput.value = '';
            csrfToken = '';
            throw new Error('Unauthorized');
        }
        if (response.status === 403) {
            // CSRF token may be stale — try refreshing it
            try {
                const tokenResp = await fetch('/api/csrf-token');
                if (tokenResp.ok) {
                    const tokenData = await tokenResp.json();
                    csrfToken = tokenData.csrf_token || '';
                }
            } catch(e) {}
            throw new Error('Sesi keamanan tidak valid. Silakan coba lagi.');
        }
        return response;
    }

    // Logout
    logoutBtn.addEventListener('click', async () => {
        try { await fetch('/api/admin/logout', { method: 'POST' }); } catch(e) {}
        csrfToken = '';
        sessionStorage.removeItem('isAdmin');
        if(authOverlay) authOverlay.style.display = 'flex';
        if(adminPanel) adminPanel.style.display = 'none';
        if(adminCodeInput) adminCodeInput.value = '';
    });

    // ============================================================
    //  PROCESS RUNNER (Scrape / Reindex)
    // ============================================================
    function setStatusBadge(text, type) {
        const classes = { idle: 'status-idle', running: 'status-running', done: 'status-done' };
        statusSpan.className = `status-badge ${classes[type] || 'status-idle'}`;
        statusSpan.innerHTML = `<i class="fas fa-circle" style="font-size:0.5rem;"></i> ${text}`;
    }

    async function runProcess(endpoint, processName, customPayload = null) {
        if(scrapeBtn) scrapeBtn.disabled = true;
        if(reindexBtn) reindexBtn.disabled = true;
        const crawlBtn = document.getElementById('crawl-btn');
        if (crawlBtn) crawlBtn.disabled = true;

        if (statusSpan) setStatusBadge(processName, 'running');
        if (consoleDiv) consoleDiv.innerHTML = `<p style="color:#facc15;">&gt; Memulai proses ${processName}...</p>`;

        try {
            let options = { method: 'POST' };
            if (customPayload) {
                options.headers = { 'Content-Type': 'application/json' };
                options.body = JSON.stringify(customPayload);
            }
            const response = await apiFetch(endpoint, options);
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
                    if (line.toLowerCase().includes('error')) p.style.color = '#f87171';
                    else if (line.toLowerCase().includes('success') || line.toLowerCase().includes('berhasil')) p.style.color = '#4ade80';
                    else p.style.color = 'var(--text-secondary)';
                    consoleDiv.appendChild(p);
                });
                consoleDiv.scrollTop = consoleDiv.scrollHeight;
            }

        } catch (error) {
            if (consoleDiv) {
                const p = document.createElement('p');
                p.style.color = '#f87171';
                p.textContent = `> Error: ${error.message}`;
                consoleDiv.appendChild(p);
            }
        } finally {
            if(scrapeBtn) scrapeBtn.disabled = false;
            if(reindexBtn) reindexBtn.disabled = false;
            const crawlBtn = document.getElementById('crawl-btn');
            if (crawlBtn) crawlBtn.disabled = false;

            if (statusSpan) setStatusBadge('Selesai', 'done');
            if (consoleDiv) {
                const p = document.createElement('p');
                p.style.color = '#facc15';
                p.textContent = `> Proses ${processName} Selesai.`;
                consoleDiv.appendChild(p);
                consoleDiv.scrollTop = consoleDiv.scrollHeight;
            }

            setTimeout(() => { if(statusSpan) setStatusBadge('Idle', 'idle'); }, 5000);
        }
    }

    async function performAction(endpoint, message) {
        alert(message);
        try {
            const response = await apiFetch(endpoint, { method: 'POST' });
            const result = await response.json();
            if (result.status === 'error') throw new Error(result.message);
            alert(`Berhasil: ${result.message}`);
        } catch (error) {
            alert(`Gagal: ${error.message}`);
        }
    }

    if (scrapeBtn) {
        scrapeBtn.addEventListener('click', () => {
            runProcess('/api/scrape', 'Scraping');
        });
    }
    if (reindexBtn) {
        reindexBtn.addEventListener('click', () => {
            runProcess('/api/reindex', 'Indexing');
        });
    }
    const crawlBtn = document.getElementById('crawl-btn');
    const crawlUrlInput = document.getElementById('crawl-url-input');
    if (crawlBtn && crawlUrlInput) {
        crawlBtn.addEventListener('click', () => {
            const url = crawlUrlInput.value.trim();
            if (!url) return alert('URL tidak boleh kosong.');
            runProcess('/api/crawl', 'Deep Crawling', { url: url, max_pages: 50 });
        });
    }

    if (deleteFaissBtn) {
        deleteFaissBtn.addEventListener('click', () => {
            if (confirm("ANDA YAKIN ingin menghapus seluruh file Index FAISS?\nAI tidak akan bisa mencari dokumen sampai Anda 'Rebuild Index' lagi.")) {
                performAction('/api/delete_faiss', 'Menghapus FAISS Index...');
            }
        });
    }
    if (deleteDbBtn) {
        deleteDbBtn.addEventListener('click', () => {
            if (confirm("ANDA YAKIN ingin menghapus seluruh DATABASE?\nIni akan menghapus SEMUA data (scraping, manual, memori).")) {
                performAction('/api/delete_db', 'Menghapus Database...');
            }
        });
    }

    // ============================================================
    //  DATA BANK MANAGEMENT
    // ============================================================
    let dataLoaded = false;

    async function loadDataBank() {
        if (dataLoaded && currentDataCache.length > 0) {
            displayData(currentDataCache);
            return;
        }
        dataListContent.innerHTML = '<p style="color:var(--text-muted);">Memuat data...</p>';
        try {
            const response = await apiFetch('/api/get-data');
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            currentDataCache = await response.json();
            dataLoaded = true;

            // Reset filters
            dataFilterContainer.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));
            dataFilterContainer.querySelector('.filter-chip[data-filter="Semua"]').classList.add('active');
            searchDataInput.value = '';

            displayData(currentDataCache);
        } catch (error) {
            dataListContent.innerHTML = `<p style="color:#f87171;">Gagal memuat data: ${error.message}</p>`;
        }
    }

    function getFilteredData() {
        const activeFilter = dataFilterContainer.querySelector('.filter-chip.active')?.dataset.filter || 'Semua';
        const query = searchDataInput.value.toLowerCase();

        let filtered = currentDataCache;
        if (activeFilter !== 'Semua') {
            filtered = filtered.filter(item => item.type === activeFilter);
        }
        if (query) {
            filtered = filtered.filter(item =>
                (item.title || '').toLowerCase().includes(query) ||
                (item.content || '').toLowerCase().includes(query)
            );
        }
        return filtered;
    }

    if (dataFilterContainer) {
        dataFilterContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-chip')) {
                dataFilterContainer.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                displayData(getFilteredData());
            }
        });
    }

    if (searchDataInput) {
        searchDataInput.addEventListener('input', () => {
            displayData(getFilteredData());
        });
    }

    function displayData(data) {
        if (data.length === 0) {
            dataListContent.innerHTML = '<p style="color:#facc15;">Tidak ada data yang cocok dengan filter ini.</p>';
            return;
        }

        const typeClasses = {
            'Scrap': 'type-scrap',
            'Teks': 'type-manual',
            'Dokumen': 'type-manual',
            'Memory': 'type-memory'
        };

        dataListContent.innerHTML = data.map(item => {
            const safeContent = (item.content || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const typeClass = typeClasses[item.type] || '';

            return `
                <div class="data-item" id="item-${item.type}-${item.id}">
                    <div class="data-item-header">
                        <div style="min-width:0;">
                            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.375rem;">
                                <span class="type-badge ${typeClass}">${item.type}</span>
                                <strong style="color:var(--text-heading);font-size:0.95rem;">${item.title || 'Tanpa Judul'}</strong>
                            </div>
                            <p style="font-size:0.7rem;color:var(--text-muted);word-break:break-all;">${item.url || ''}</p>
                        </div>
                        <div class="data-item-actions">
                            <button class="btn btn-sm btn-primary detail-btn" data-id="${item.id}" data-type="${item.type}">Detail</button>
                            <button class="btn btn-sm btn-warning edit-btn" data-id="${item.id}" data-type="${item.type}">Ubah</button>
                            <button class="btn btn-sm btn-danger delete-btn" data-id="${item.id}" data-type="${item.type}">Hapus</button>
                        </div>
                    </div>
                    <p style="color:var(--text-secondary);font-size:0.8rem;margin-top:0.5rem;white-space:pre-wrap;">${safeContent.substring(0, 200)}...</p>
                </div>
            `;
        }).join('');
    }

    // Data bank click handlers (delegated)
    if (dataListContent) {
        dataListContent.addEventListener('click', async (e) => {
            const button = e.target.closest('button');
            if (!button) return;
            const id = button.dataset.id;
            const type = button.dataset.type;

            if (button.classList.contains('detail-btn')) showDetailView(id, type);
            if (button.classList.contains('edit-btn')) showEditFormView(id, type);
            if (button.classList.contains('delete-btn')) {
                if (confirm(`Anda yakin ingin menghapus item [${type}] #${id}?`)) {
                    await deleteDataItem(id, type);
                }
            }
        });
    }

    async function deleteDataItem(id, type) {
        try {
            const response = await apiFetch(`/api/data/${type}/${id}`, { method: 'DELETE' });
            const result = await response.json();
            if (result.status === 'success') {
                alert('Data berhasil dihapus. Jangan lupa Rebuild Index!');
                dataLoaded = false;
                await loadDataBank();
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

        showModal();
        modalTitle.textContent = `Mengubah Data #${id} (${type})`;

        const isMemory = type === 'Memory';
        const titleLabel = isMemory ? 'Pertanyaan' : 'Judul';
        const contentLabel = isMemory ? 'Jawaban' : 'Konten';

        modalContentEdit.style.display = 'block';
        modalContentDetail.style.display = 'none';
        modalContentBugDetail.style.display = 'none';

        modalContentEdit.innerHTML = `
            <form id="edit-form" data-id="${id}" data-type="${type}" style="display:flex;flex-direction:column;gap:1rem;">
                <div>
                    <label for="edit-title" class="form-label">${titleLabel}</label>
                    <textarea id="edit-title" class="form-textarea" rows="${isMemory ? 3 : 1}">${item.title || ''}</textarea>
                </div>
                <div>
                    <label for="edit-content" class="form-label">${contentLabel}</label>
                    <textarea id="edit-content" class="form-textarea" rows="12">${item.content || ''}</textarea>
                </div>
                <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
                    <button type="button" id="cancel-edit-btn" class="btn btn-sm btn-secondary">Batal</button>
                    <button type="submit" class="btn btn-sm btn-primary">Simpan Perubahan</button>
                </div>
            </form>
        `;

        document.getElementById('edit-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveEditedData(id, type);
        });
        document.getElementById('cancel-edit-btn').addEventListener('click', () => {
            closeModal();
        });
    }

    async function saveEditedData(id, type) {
        const newTitle = document.getElementById('edit-title').value;
        const newContent = document.getElementById('edit-content').value;
        try {
            const response = await apiFetch(`/api/data/${type}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle, content: newContent })
            });
            const result = await response.json();
            if (result.status === 'success') {
                alert('Data berhasil diperbarui. Jangan lupa Rebuild Index!');
                closeModal();
                dataLoaded = false;
                await loadDataBank();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            alert(`Gagal menyimpan data: ${error.message}`);
        }
    }

    function markdownToHtml(md) {
        if (!md) return '';
        const lines = md.split('\n');
        let html = '';
        let inTable = false;

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
                const cells = trimmedLine.slice(1, -1).split('|').map(c => c.trim());
                if (!inTable) {
                    html += '<table style="width:100%;margin:1rem 0;border-collapse:collapse;border:1px solid var(--border-card);">';
                    html += '<thead style="background:var(--bg-input);"><tr>';
                    cells.forEach(header => {
                        html += `<th style="padding:0.5rem;border:1px solid var(--border-card);text-align:left;word-break:break-word;">${header}</th>`;
                    });
                    html += '</tr></thead><tbody>';
                    inTable = true;
                } else if (cells.every(c => /^--+$/.test(c))) {
                    continue;
                } else {
                    html += '<tr>';
                    cells.forEach(cell => {
                        html += `<td style="padding:0.5rem;border:1px solid var(--border-card);word-break:break-word;">${cell}</td>`;
                    });
                    html += '</tr>';
                }
            } else {
                if (inTable) {
                    html += '</tbody></table>';
                    inTable = false;
                }
                if (trimmedLine) {
                    html += `<p style="margin:0.375rem 0;">${trimmedLine.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`;
                }
            }
        }

        if (inTable) html += '</tbody></table>';
        return html;
    }

    function showDetailView(id, type) {
        const item = currentDataCache.find(d => d.id == id && d.type === type);
        if (!item) return;

        showModal();
        modalTitle.textContent = `Detail Data #${id} (${type})`;

        modalContentEdit.style.display = 'none';
        modalContentDetail.style.display = 'block';
        modalContentBugDetail.style.display = 'none';

        const renderedContent = markdownToHtml(item.content);
        const titleLabel = type === 'Memory' ? 'Pertanyaan' : 'Judul';
        const contentLabel = type === 'Memory' ? 'Jawaban' : 'Konten';

        let imageHtml = '';
        if (item.image_url) {
            imageHtml = `<img src="${item.image_url.split(',')[0]}" alt="Gambar" style="max-width:20rem;border-radius:0.5rem;margin:1rem auto;display:block;">`;
        }
        
        let filePreviewHtml = '';
        if (item.file_path) {
            const fileUrl = window.location.origin + '/uploads/' + item.file_path;
            const ext = item.file_path.split('.').pop().toLowerCase();
            
            if (ext === 'pdf') {
                filePreviewHtml = `
                    <div style="margin-top: 1rem; border: 1px solid var(--border-card); border-radius: 0.5rem; overflow: hidden;">
                        <embed src="/uploads/${item.file_path}" width="100%" height="600px" type="application/pdf">
                    </div>
                `;
            } else if (['docx', 'pptx'].includes(ext)) {
                filePreviewHtml = `
                    <div style="margin-top: 1rem; border: 1px solid var(--border-card); border-radius: 0.5rem; overflow: hidden; background: #fff;">
                        <p style="padding: 0.5rem; font-size: 0.8rem; background: var(--bg-input); color: var(--text-secondary); margin: 0; border-bottom: 1px solid var(--border-card);">
                            Pratinjau Dokumen Asli (Hanya berfungsi jika server online). <a href="/uploads/${item.file_path}" target="_blank" style="color: #3b82f6;">Unduh Dokumen</a>
                        </p>
                        <iframe src="https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}" width="100%" height="600px" frameborder="0"></iframe>
                    </div>
                `;
            } else {
                 filePreviewHtml = `
                    <div style="margin-top: 1rem;">
                        <a href="/uploads/${item.file_path}" target="_blank" class="btn btn-sm btn-secondary"><i class="fas fa-file-download"></i> Unduh File Asli</a>
                    </div>
                `;
            }
        }

        modalContentDetail.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:1rem;">
                <div>
                    <p class="form-label">${titleLabel}</p>
                    <h3 style="font-size:1.25rem;font-weight:700;color:var(--text-heading);margin:0;">${item.title || 'Tanpa Judul'}</h3>
                    <p style="font-size:0.75rem;color:var(--text-muted);margin:0.25rem 0 0;word-break:break-all;">${item.url || ''}</p>
                </div>
                ${imageHtml}
                ${filePreviewHtml}
                <div style="border-top:1px solid var(--border-primary);padding-top:1rem;">
                    <p class="form-label">${contentLabel}</p>
                    <div style="color:var(--text-secondary);font-size:0.9rem;line-height:1.7;">${renderedContent}</div>
                </div>
                <div style="display:flex;justify-content:flex-end;">
                    <button id="back-to-list-btn" class="btn btn-sm btn-secondary">Tutup</button>
                </div>
            </div>
        `;

        document.getElementById('back-to-list-btn').addEventListener('click', closeModal);
    }

    // ============================================================
    //  BUG REPORT MANAGEMENT
    // ============================================================
    let bugsLoaded = false;

    async function loadBugReports() {
        if (bugsLoaded && currentBugReportsCache.length > 0) {
            // Reset filter to Semua
            bugFilterContainer.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));
            bugFilterContainer.querySelector('.filter-chip[data-filter="Semua"]').classList.add('active');
            displayBugReports(currentBugReportsCache);
            return;
        }
        bugListContent.innerHTML = '<p style="color:var(--text-muted);">Memuat laporan bug...</p>';
        try {
            const response = await apiFetch('/api/get_bug_reports');
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            currentBugReportsCache = await response.json();
            bugsLoaded = true;

            bugFilterContainer.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));
            bugFilterContainer.querySelector('.filter-chip[data-filter="Semua"]').classList.add('active');
            displayBugReports(currentBugReportsCache);
        } catch (error) {
            bugListContent.innerHTML = `<p style="color:#f87171;">Gagal memuat laporan bug: ${error.message}</p>`;
        }
    }

    function getFilteredBugs() {
        const activeFilter = bugFilterContainer.querySelector('.filter-chip.active')?.dataset.filter || 'Semua';
        if (activeFilter === 'Semua') return currentBugReportsCache;
        return currentBugReportsCache.filter(r => r.status === activeFilter);
    }

    if (bugFilterContainer) {
        bugFilterContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-chip')) {
                bugFilterContainer.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                displayBugReports(getFilteredBugs());
            }
        });
    }

    function displayBugReports(reports) {
        if (reports.length === 0) {
            bugListContent.innerHTML = '<p style="color:#facc15;">Tidak ada laporan bug yang cocok dengan filter ini.</p>';
            return;
        }

        const statusColors = {
            'Baru': 'background:rgba(59,130,246,0.2);color:#60a5fa;',
            'Sedang Diproses': 'background:rgba(250,204,21,0.2);color:#facc15;',
            'Selesai': 'background:rgba(34,197,94,0.2);color:#4ade80;',
            'Tidak Akan Diperbaiki': 'background:rgba(148,163,184,0.2);color:#94a3b8;'
        };
        const statusOptions = ['Baru', 'Sedang Diproses', 'Selesai', 'Tidak Akan Diperbaiki'];

        bugListContent.innerHTML = reports.map(report => {
            const safeDescription = (report.description || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const selectOptions = statusOptions.map(opt =>
                `<option value="${opt}" ${report.status === opt ? 'selected' : ''}>${opt}</option>`
            ).join('');
            const badgeStyle = statusColors[report.status] || 'background:var(--bg-input);color:var(--text-muted);';

            return `
                <div class="data-item" id="bug-item-${report.id}">
                    <div class="data-item-header">
                        <div>
                            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.375rem;">
                                <strong style="color:var(--text-heading);font-size:0.95rem;">Laporan #${report.id}</strong>
                                <span class="type-badge" style="${badgeStyle}">${report.status}</span>
                            </div>
                            <p style="font-size:0.7rem;color:var(--text-muted);">${new Date(report.reported_at).toLocaleString()}</p>
                        </div>
                        <div class="data-item-actions" style="align-items:center;">
                            <select class="form-select bug-status-select" style="width:auto;padding:0.3rem 0.5rem;font-size:0.75rem;" data-id="${report.id}">${selectOptions}</select>
                            <button class="btn btn-sm btn-primary bug-detail-btn" data-id="${report.id}">Detail</button>
                            <button class="btn btn-sm btn-danger bug-delete-btn" data-id="${report.id}">Hapus</button>
                        </div>
                    </div>
                    <p style="color:var(--text-secondary);font-size:0.8rem;margin-top:0.5rem;white-space:pre-wrap;">${safeDescription.substring(0, 150)}...</p>
                </div>
            `;
        }).join('');
    }

    // Bug report click handlers (delegated)
    if (bugListContent) {
        bugListContent.addEventListener('click', async (e) => {
            const button = e.target.closest('button');
            if (!button) return;
            const id = button.dataset.id;

            if (button.classList.contains('bug-detail-btn')) showBugDetailView(id);
            if (button.classList.contains('bug-delete-btn')) {
                if (confirm(`Anda yakin ingin menghapus laporan bug #${id}?`)) {
                    await deleteBugReport(id);
                }
            }
        });

        bugListContent.addEventListener('change', async (e) => {
            if (e.target.classList.contains('bug-status-select')) {
                const id = e.target.dataset.id;
                const newStatus = e.target.value;
                await updateBugStatus(id, newStatus);
            }
        });
    }

    async function updateBugStatus(id, status) {
        try {
            const response = await apiFetch(`/api/bug_reports/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message);
            const report = currentBugReportsCache.find(r => r.id == id);
            if (report) report.status = status;
            displayBugReports(getFilteredBugs());
        } catch (error) {
            alert(`Gagal memperbarui status: ${error.message}`);
        }
    }

    async function deleteBugReport(id) {
        try {
            const response = await apiFetch(`/api/bug_reports/${id}`, { method: 'DELETE' });
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message);
            currentBugReportsCache = currentBugReportsCache.filter(r => r.id != id);
            displayBugReports(getFilteredBugs());
        } catch (error) {
            alert(`Gagal menghapus laporan: ${error.message}`);
        }
    }

    function showBugDetailView(id) {
        const report = currentBugReportsCache.find(r => r.id == id);
        if (!report) return;

        showModal();
        modalTitle.textContent = `Detail Laporan Bug #${id}`;

        modalContentEdit.style.display = 'none';
        modalContentDetail.style.display = 'none';
        modalContentBugDetail.style.display = 'block';

        const safeDescription = (report.description || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
        let fileHtml = '<p style="font-size:0.85rem;color:var(--text-muted);">Tidak ada file lampiran.</p>';
        if (report.file_path) {
            const filePath = `/uploads/${report.file_path}`;
            const isImage = ['png', 'jpg', 'jpeg', 'gif'].some(ext => filePath.toLowerCase().endsWith(ext));
            const isVideo = ['mp4', 'mov', 'avi', 'webm'].some(ext => filePath.toLowerCase().endsWith(ext));

            if (isImage) {
                fileHtml = `<a href="${filePath}" target="_blank" rel="noopener noreferrer"><img src="${filePath}" alt="Lampiran Bug" style="max-width:20rem;border-radius:0.5rem;margin-top:0.5rem;"></a>`;
            } else if (isVideo) {
                fileHtml = `<video controls style="max-width:20rem;border-radius:0.5rem;margin-top:0.5rem;"><source src="${filePath}">Browser Anda tidak mendukung tag video.</video>`;
            } else {
                fileHtml = `<a href="${filePath}" target="_blank" rel="noopener noreferrer" style="color:var(--text-accent);">Lihat File Lampiran</a>`;
            }
        }

        modalContentBugDetail.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:1rem;">
                <div>
                    <p style="font-size:0.85rem;color:var(--text-muted);">Status: <strong style="color:var(--text-primary);">${report.status}</strong></p>
                    <p style="font-size:0.85rem;color:var(--text-muted);">Dilaporkan pada: <strong style="color:var(--text-primary);">${new Date(report.reported_at).toLocaleString()}</strong></p>
                </div>
                <div style="border-top:1px solid var(--border-primary);padding-top:1rem;color:var(--text-secondary);white-space:pre-wrap;font-size:0.9rem;">${safeDescription}</div>
                <div style="border-top:1px solid var(--border-primary);padding-top:1rem;">
                    <h4 style="font-size:1rem;font-weight:600;color:var(--text-primary);margin:0 0 0.5rem;">Lampiran</h4>
                    ${fileHtml}
                </div>
                <div style="display:flex;justify-content:flex-end;">
                    <button id="back-to-bug-list-btn" class="btn btn-sm btn-secondary">Tutup</button>
                </div>
            </div>
        `;

        document.getElementById('back-to-bug-list-btn').addEventListener('click', closeModal);
    }

    // ============================================================
    //  MODAL HELPERS
    // ============================================================
    function showModal() {
        dataModal.style.display = 'flex';
    }

    function closeModal() {
        dataModal.style.display = 'none';
        modalContentEdit.style.display = 'none';
        modalContentDetail.style.display = 'none';
        modalContentBugDetail.style.display = 'none';
    }

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    // ============================================================
    //  TUTORIAL
    // ============================================================
    function openTutorial() {
        if (!tutorialContentLoaded) {
            fetch('tutorial.html')
                .then(r => { if (!r.ok) throw new Error('File tidak ditemukan.'); return r.text(); })
                .then(html => { tutorialContentContainer.innerHTML = html; tutorialContentLoaded = true; })
                .catch(err => { tutorialContentContainer.innerHTML = `<p style="color:#f87171;">Gagal memuat: ${err.message}</p>`; });
        }
        tutorialModal.style.display = 'flex';
    }

    if (tutorialBtn) tutorialBtn.addEventListener('click', openTutorial);
    if (tutorialBtnSettings) tutorialBtnSettings.addEventListener('click', openTutorial);
    if (closeTutorialBtn) closeTutorialBtn.addEventListener('click', () => { tutorialModal.style.display = 'none'; });
    // ============================================================
    //  ADD DATA FORMS
    // ============================================================
    if (manualFileInput) {
        manualFileInput.addEventListener('change', () => {
            if (fileUploadFilename) {
                fileUploadFilename.textContent = manualFileInput.files.length > 0
                    ? manualFileInput.files[0].name
                    : 'Pilih File (.pdf, .docx, .pptx)';
            }
        });
    }

    if (manualTextForm) {
        manualTextForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('manual-title-text').value;
            const content = document.getElementById('manual-content').value;
            if (!content.trim()) { alert('Konten teks tidak boleh kosong.'); return; }

            manualTextSubmitBtn.disabled = true;
            manualTextSubmitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menambahkan...';
            try {
                const response = await apiFetch('/api/add_manual_text', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, content }),
                });
                const result = await response.json();
                if (response.ok && result.status === 'success') {
                    alert('Data teks berhasil ditambahkan. Jangan lupa Rebuild Index!');
                    manualTextForm.reset();
                    dataLoaded = false;
                } else {
                    throw new Error(result.message || 'Terjadi kesalahan.');
                }
            } catch (error) {
                alert(`Gagal menambahkan data: ${error.message}`);
            } finally {
                manualTextSubmitBtn.disabled = false;
                manualTextSubmitBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Tambah Konteks Teks';
            }
        });
    }
    if (manualFileForm) {
        manualFileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (manualFileInput.files.length === 0) { alert('Silakan pilih file untuk diunggah.'); return; }

            const formData = new FormData(manualFileForm);
            manualFileSubmitBtn.disabled = true;
            manualFileSubmitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengunggah...';
            try {
                const response = await apiFetch('/api/add_manual_file', {
                    method: 'POST',
                    body: formData,
                });
                const result = await response.json();
                if (response.ok && result.status === 'success') {
                    alert('File berhasil ditambahkan. Jangan lupa Rebuild Index!');
                    manualFileForm.reset();
                    if(fileUploadFilename) fileUploadFilename.textContent = 'Pilih File (.pdf, .docx, .pptx)';
                    dataLoaded = false;
                } else {
                    throw new Error(result.message || 'Terjadi kesalahan.');
                }
            } catch (error) {
                alert(`Gagal menambahkan file: ${error.message}`);
            } finally {
                manualFileSubmitBtn.disabled = false;
                manualFileSubmitBtn.innerHTML = '<i class="fas fa-upload"></i> Tambah Konteks File';
            }
        });
    }
    // ============================================================
    //  AI TEST CONSOLE
    // ============================================================
    function appendThoughtToConsole(thought) {
        let html = '';
        const stepStyles = {
            'start': { color: 'var(--text-muted)', text: `&gt; ${thought.data}` },
            'memory_search': { color: '#facc15', text: `&gt; [TAHAP 1] ${thought.data}` },
            'memory_found': { color: '#4ade80', text: `&gt; ${thought.data}` },
            'memory_not_found': { color: 'var(--text-muted)', text: `&gt; ${thought.data}` },
            'manual_search': { color: '#facc15', text: `&gt; [TAHAP 2] ${thought.data}` },
            'manual_found': { color: '#22d3ee', text: `&gt; ${thought.data}` },
            'manual_not_found': { color: 'var(--text-muted)', text: `&gt; ${thought.data}` },
            'scrape_search': { color: '#facc15', text: `&gt; [TAHAP 3] ${thought.data}` },
            'scrape_found': { color: '#60a5fa', text: `&gt; ${thought.data}` },
            'scrape_not_found': { color: 'var(--text-muted)', text: `&gt; ${thought.data}` },
            'final_prompt': { color: '#c084fc', text: `&gt; [TAHAP 4] ${thought.data}` },
            'info': { color: 'var(--text-muted)', text: `&gt; ${thought.data}` },
            'error': { color: '#f87171', text: `&gt; ERROR: ${thought.data}` },
            'warning': { color: '#fbbf24', text: `&gt; PERINGATAN: ${thought.data}` }
        };

        if (stepStyles[thought.step]) {
            html = `<p style="color:${stepStyles[thought.step].color};${thought.step.includes('search') ? 'margin-top:0.5rem;' : ''}">${stepStyles[thought.step].text}</p>`;
        } else if (thought.step === 'retrieved_docs') {
            html = thought.data.map(doc => {
                let borderColor = 'var(--border-card)';
                if (doc.source.includes('[Memory Bank]')) borderColor = '#4ade80';
                else if (doc.source.includes('[Data Manual]')) borderColor = '#22d3ee';
                else if (doc.source.includes('[Data Scrap]')) borderColor = '#60a5fa';

                return `<div style="padding-left:1rem;margin-top:0.25rem;border-left:2px solid ${borderColor};">
                    <p style="color:var(--text-muted);font-size:0.8rem;">Dokumen ditemukan: ${doc.source}</p>
                    <p style="color:var(--text-muted);font-size:0.75rem;font-style:italic;">"${doc.content}"</p>
                </div>`;
            }).join('');
        } else if (thought.step === 'token_usage') {
            const tw = document.getElementById('token-monitor-widget');
            if (tw) {
                tw.style.display = 'block';
                document.getElementById('token-model').innerText = thought.data.model || '-';
                document.getElementById('token-prompt').innerText = thought.data.prompt || 0;
                document.getElementById('token-completion').innerText = thought.data.completion || 0;
                document.getElementById('token-total').innerText = thought.data.total || 0;
            }
        } else if (thought.step === 'final_answer') {
            html = `<div style="margin-top:1rem;padding:0.75rem;background:var(--bg-card-inner);border-radius:0.5rem;border:1px solid var(--border-card);">
                        <p style="color:#4ade80;font-weight:700;margin-bottom:0.5rem;">Jawaban Akhir (Bisa Diedit):</p>
                        <div id="final-answer-text" contenteditable="true" style="color:var(--text-primary);white-space:pre-wrap;padding:0.5rem;border:1px solid var(--border-input);border-radius:0.375rem;outline:none;">${thought.data}</div>
                        <div style="display:flex;gap:0.5rem;margin-top:0.75rem;">
                            <button id="save-memory-btn" class="btn btn-sm btn-success">Simpan ke Memori</button>
                            <button id="clear-log-btn" class="btn btn-sm btn-secondary">Hapus Log</button>
                        </div>
                    </div>`;
        }
        thinkingConsole.innerHTML += html;
        thinkingConsole.scrollTop = thinkingConsole.scrollHeight;
    }

    if (adminChatForm) {
        adminChatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userQuery = adminChatInput.value.trim();
            if (!userQuery) return;

            adminChatHistory.push({ role: "user", parts: [{ text: userQuery }] });
            thinkingConsole.innerHTML = '';
            const tw = document.getElementById('token-monitor-widget');
            if (tw) tw.style.display = 'none';
            adminChatSubmit.disabled = true;
            adminChatSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menganalisis...';
            thinkingConsole.dataset.question = userQuery;
            try {
                const response = await apiFetch('/api/admin_chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: userQuery, history: adminChatHistory.slice(-20) }),
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
                appendThoughtToConsole({ step: "error", data: `Koneksi gagal: ${error.message}` });
            } finally {
                adminChatSubmit.disabled = false;
                adminChatSubmit.innerHTML = '<i class="fas fa-paper-plane"></i> Kirim & Analisis';
            }
        });
    }
    if (thinkingConsole) {
        thinkingConsole.addEventListener('click', async (e) => {
            const target = e.target.closest('button');
            if (!target) return;
            if (target.id === 'clear-log-btn') {
                thinkingConsole.innerHTML = '<p style="color:var(--text-muted);">&gt; Menunggu pertanyaan...</p>';
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
                        const response = await apiFetch('/api/save_memory', {
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
    }

    // --- Global Token Stats (Admin Settings) ---
    const globalTokenCost = document.getElementById('global-token-cost');
    const globalTokenRequests = document.getElementById('global-token-requests');
    const globalTokenPrompt = document.getElementById('global-token-prompt');
    const globalTokenCompletion = document.getElementById('global-token-completion');
    const globalTokenTotal = document.getElementById('global-token-total');
    const refreshTokenStatsBtn = document.getElementById('refresh-token-stats-btn');

    async function loadGlobalTokenStats() {
        if (!globalTokenTotal) return;
        try {
            const response = await apiFetch('/api/admin/token-stats');
            const result = await response.json();
            if (result.status === 'success') {
                const promptCount = result.data.prompt || 0;
                const completionCount = result.data.completion || 0;

                // Model pricing: gemini-3.1-pro ($2.00 / 1M prompt, $12.00 / 1M completion)
                const costPrompt = (promptCount / 1000000) * 2.00;
                const costCompletion = (completionCount / 1000000) * 12.00;
                const totalCost = costPrompt + costCompletion;

                if (globalTokenCost) {
                    globalTokenCost.textContent = `$${totalCost.toFixed(6)}`;
                }

                if (globalTokenRequests) globalTokenRequests.textContent = result.data.requests.toLocaleString();
                globalTokenPrompt.textContent = promptCount.toLocaleString();
                globalTokenCompletion.textContent = completionCount.toLocaleString();
                globalTokenTotal.textContent = result.data.total.toLocaleString();
            }
        } catch (error) {
            console.error("Gagal memuat token stats:", error);
        }
    }

    if (globalTokenTotal) {
        loadGlobalTokenStats();
    }
    
    if (refreshTokenStatsBtn) {
        refreshTokenStatsBtn.addEventListener('click', () => {
            const icon = refreshTokenStatsBtn.querySelector('i');
            if(icon) icon.classList.add('fa-spin');
            loadGlobalTokenStats().finally(() => {
                setTimeout(() => { if(icon) icon.classList.remove('fa-spin'); }, 500);
            });
        });
    }

});