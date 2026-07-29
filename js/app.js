// js/app.js
// Main Application Controller for Vault Password Manager Dashboard

(async function () {
    /* ---------- Supabase Credentials Setup ---------- */
    let supabaseUrl = window.SUPABASE_URL;
    let supabaseKey = window.SUPABASE_PUBLISHABLE_KEY;

    const IS_PLACEHOLDER_URL = !supabaseUrl || supabaseUrl === "YOUR_SUPABASE_URL" || supabaseUrl.trim() === "";
    const IS_PLACEHOLDER_KEY = !supabaseKey || supabaseKey === "YOUR_SUPABASE_PUBLISHABLE_KEY" || supabaseKey.trim() === "";

    if (IS_PLACEHOLDER_URL || IS_PLACEHOLDER_KEY) {
        supabaseUrl = localStorage.getItem("vault_supabase_url");
        supabaseKey = localStorage.getItem("vault_supabase_publishable_key");
    }

    let supabase = null;
    const setupModal = document.getElementById('setup-modal');
    const setupForm = document.getElementById('setup-form');

    function initSupabase() {
        if (supabaseUrl && supabaseKey && supabaseUrl !== "YOUR_SUPABASE_URL" && supabaseKey !== "YOUR_SUPABASE_PUBLISHABLE_KEY") {
            try {
                supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
                return true;
            } catch (e) {
                console.error("Failed to initialize Supabase client", e);
                return false;
            }
        }
        return false;
    }

    // Show setup modal if not configured
    if (!initSupabase()) {
        if (setupModal) {
            setupModal.classList.add('active');
            setupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const urlInput = document.getElementById('setup-url').value.trim();
                const keyInput = document.getElementById('setup-key').value.trim();
                localStorage.setItem("vault_supabase_url", urlInput);
                localStorage.setItem("vault_supabase_publishable_key", keyInput);
                window.location.reload();
            });
        }
        return; // Halt further initialization
    }

    /* ---------- State Variables ---------- */
    let session = null;
    let cryptoKey = null;
    let passwordsList = []; // Stores the decrypted password entries in memory
    let displayOrder = [];  // Tracks current display order (array of ids)
    let notesList = [];     // Stores the decrypted note entries in memory
    let notesDisplayOrder = []; // Tracks current notes display order (array of ids)

    /* ---------- Authenticate Session ---------- */
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    session = currentSession;

    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    // Check if the cryptography key exists in localStorage
    const b64Key = localStorage.getItem('vault_key');
    if (!b64Key) {
        // If session key is lost, sign out and redirect to log in again
        await supabase.auth.signOut();
        window.location.href = 'index.html';
        return;
    }

    try {
        cryptoKey = await window.VaultCrypto.importKeyFromBase64(b64Key);
    } catch (e) {
        console.error("Failed to import cryptography key", e);
        await supabase.auth.signOut();
        window.location.href = 'index.html';
        return;
    }

    // Listen for sign-out events
    supabase.auth.onAuthStateChange((event, newSession) => {
        if (event === 'SIGNED_OUT' || !newSession) {
            localStorage.removeItem('vault_key');
            window.location.href = 'index.html';
        }
    });

    /* ---------- UI Elements ---------- */
    const toastContainer = document.getElementById('toast-container');
    const sidebar = document.getElementById('sidebar');
    const sidebarTabs = document.querySelectorAll('.sidebar-tab');
    const panels = document.querySelectorAll('.panel');

    // Password Elements
    const pwTableBody = document.getElementById('pw-table-body');
    const searchInput = document.getElementById('search-input');
    const addPwBtn = document.getElementById('add-pw-btn');
    const logoutBtns = document.querySelectorAll('.logout-btn');

    // Modal Elements
    const pwModal = document.getElementById('pw-modal');
    const pwForm = document.getElementById('pw-form');
    const formTitle = document.getElementById('form-title');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const editIdInput = document.getElementById('edit-id');
    const accountNameInput = document.getElementById('account-name');
    const accountUsernameInput = document.getElementById('account-username');
    const accountPwInput = document.getElementById('account-pw');
    const togglePwVisBtn = document.getElementById('toggle-pw-vis');
    const fillGenBtn = document.getElementById('fill-gen-btn');

    // Generator Elements
    const genLenInput = document.getElementById('gen-len');
    const genLenVal = document.getElementById('gen-len-val');
    const genUpper = document.getElementById('gen-upper');
    const genLower = document.getElementById('gen-lower');
    const genNums = document.getElementById('gen-nums');
    const genSyms = document.getElementById('gen-syms');
    const strengthFill = document.getElementById('strength-fill');
    const strengthLabel = document.getElementById('strength-label');

    // Profile Elements
    const userEmailDisplay = document.getElementById('user-email');
    const changePwForm = document.getElementById('change-pw-form');
    const settingsSubmitBtn = document.getElementById('settings-submit');

    // Notes Elements
    const notesGridContainer = document.getElementById('notes-grid-container');
    const notesSearchInput = document.getElementById('notes-search-input');
    const addNoteBtn = document.getElementById('add-note-btn');
    const noteModal = document.getElementById('note-modal');
    const noteForm = document.getElementById('note-form');
    const noteFormTitle = document.getElementById('note-form-title');
    const closeNoteModalBtn = document.getElementById('close-note-modal-btn');
    const noteCancelBtn = document.getElementById('note-cancel-btn');
    const noteEditIdInput = document.getElementById('note-edit-id');
    const noteTitleInput = document.getElementById('note-title');
    const noteContentInput = document.getElementById('note-content');
    const noteCharCount = document.getElementById('note-char-count');
    const noteSaveBtn = document.getElementById('note-save-btn');


    /* ---------- Profile Info Initialization ---------- */
    const userEmail = session.user.email;
    if (userEmailDisplay) userEmailDisplay.textContent = userEmail;

    // Populate Sidebar profile trigger & mobile avatar
    const profileEmailEl = document.getElementById('profile-display-email');
    const profileNameEl = document.getElementById('profile-display-name');
    const profileAvatarEl = document.querySelector('.profile-trigger .avatar');
    const mobileAvatarDisplay = document.getElementById('mobile-avatar-display');

    if (profileEmailEl) profileEmailEl.textContent = userEmail;
    if (profileNameEl) profileNameEl.textContent = userEmail.split('@')[0];
    if (profileAvatarEl) profileAvatarEl.textContent = userEmail.charAt(0).toUpperCase();
    if (mobileAvatarDisplay) mobileAvatarDisplay.textContent = userEmail.charAt(0).toUpperCase();

    // Profile Popover toggling
    const profileTrigger = document.getElementById('profile-menu-trigger');
    const mobileProfileTrigger = document.getElementById('mobile-profile-trigger');
    const profilePopover = document.getElementById('profile-popover-menu');

    if (profilePopover) {
        const togglePopover = (e) => {
            e.stopPropagation();
            profilePopover.classList.toggle('active');
        };

        if (profileTrigger) profileTrigger.addEventListener('click', togglePopover);
        if (mobileProfileTrigger) mobileProfileTrigger.addEventListener('click', togglePopover);

        // Hide popover when clicking anywhere else
        window.addEventListener('click', (e) => {
            const clickOnTrigger = (profileTrigger && profileTrigger.contains(e.target)) ||
                (mobileProfileTrigger && mobileProfileTrigger.contains(e.target));
            if (!clickOnTrigger && !profilePopover.contains(e.target)) {
                profilePopover.classList.remove('active');
            }
        });
    }

    /* ---------- Sidebar Collapse / Expand Toggle (>= 1024px) ---------- */
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebarEl = document.getElementById('sidebar');

    if (sidebarToggleBtn && sidebarEl) {
        const isCollapsedSaved = localStorage.getItem('vault_sidebar_collapsed') === 'true';
        if (isCollapsedSaved && window.innerWidth >= 768) {
            sidebarEl.classList.add('is-collapsed');
            sidebarEl.classList.remove('is-expanded');
        }

        sidebarToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isCurrentlyCollapsed = sidebarEl.classList.contains('is-collapsed');

            if (isCurrentlyCollapsed) {
                sidebarEl.classList.remove('is-collapsed');
                sidebarEl.classList.add('is-expanded');
                localStorage.setItem('vault_sidebar_collapsed', 'false');
            } else {
                sidebarEl.classList.remove('is-expanded');
                sidebarEl.classList.add('is-collapsed');
                localStorage.setItem('vault_sidebar_collapsed', 'true');
            }
        });
    }

    /* ---------- Mobile Navigation Menu Toggling (< 768px) ---------- */
    const mobileHamburgerBtn = document.getElementById('mobile-hamburger-btn');
    const mobileNavMenu = document.getElementById('mobile-nav-menu');
    const mobileNavItems = document.querySelectorAll('.mobile-nav-item');

    if (mobileNavMenu && mobileHamburgerBtn) {
        mobileHamburgerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            mobileNavMenu.classList.toggle('active');
            if (profilePopover) profilePopover.classList.remove('active');
        });

        window.addEventListener('click', (e) => {
            if (!mobileHamburgerBtn.contains(e.target) && !mobileNavMenu.contains(e.target)) {
                mobileNavMenu.classList.remove('active');
            }
        });
    }

    mobileNavItems.forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.getAttribute('data-tab');
            if (tab) {
                switchTab(tab);
            } else if (mobileNavMenu) {
                mobileNavMenu.classList.remove('active');
            }
        });
    });



    /* ---------- Tab Navigation ---------- */
    function switchTab(tabId) {
        const resolvedTabId = (tabId === 'settings') ? 'profile' : tabId;

        // Deactivate all tabs and panels
        sidebarTabs.forEach(tab => tab.classList.remove('active'));
        mobileNavItems.forEach(item => item.classList.remove('active'));
        panels.forEach(panel => panel.classList.remove('active'));

        // Activate matching desktop tab
        const activeTab = document.querySelector(`.sidebar-tab[data-tab="${resolvedTabId}"]`);
        if (activeTab) activeTab.classList.add('active');

        // Activate matching mobile tab
        const activeMobileItem = document.querySelector(`.mobile-nav-item[data-tab="${resolvedTabId}"]`);
        if (activeMobileItem) activeMobileItem.classList.add('active');

        // Activate matching panel
        const targetPanel = document.getElementById(`panel-${resolvedTabId}`);
        if (targetPanel) targetPanel.classList.add('active');

        // Close mobile nav menu
        if (mobileNavMenu) mobileNavMenu.classList.remove('active');
    }

    sidebarTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            switchTab(tab.getAttribute('data-tab'));
        });
    });



    /* ---------- Toast System ---------- */
    function showToast(title, desc, type) {
        const toast = document.createElement('div');
        toast.className = 'toast';

        let iconSvg = '';
        if (type === 'success') {
            iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        } else if (type === 'error') {
            iconSvg = `<svg class="toast-icon toast-icon-error" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
        } else {
            iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
        }

        toast.innerHTML = `
            ${iconSvg}
            <div class="toast-body">
                <div class="toast-title">${title}</div>
                <div class="toast-desc">${desc}</div>
            </div>
            <button class="toast-close" aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        `;

        toastContainer.appendChild(toast);

        const dismiss = () => { toast.remove(); };
        setTimeout(dismiss, 4000);
        toast.querySelector('.toast-close').addEventListener('click', dismiss);
    }

    /* ---------- Custom Centered Confirmation Prompt System ---------- */
    function showConfirm(options = {}) {
        return new Promise((resolve) => {
            let modal = document.getElementById('confirm-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'confirm-modal';
                modal.className = 'confirm-modal-overlay';
                modal.setAttribute('role', 'dialog');
                modal.setAttribute('aria-modal', 'true');
                modal.setAttribute('aria-hidden', 'true');
                modal.innerHTML = `
                    <div class="confirm-modal-card">
                        <div class="confirm-modal-icon-wrap danger" id="confirm-modal-icon-container"></div>
                        <div class="confirm-modal-body">
                            <h3 class="confirm-modal-title" id="confirm-dialog-title"></h3>
                            <p class="confirm-modal-desc" id="confirm-dialog-desc"></p>
                        </div>
                        <div class="confirm-modal-actions">
                            <button type="button" class="btn-secondary" id="confirm-modal-cancel-btn">Cancel</button>
                            <button type="button" class="btn-primary btn-danger-action" id="confirm-modal-submit-btn">Confirm</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
            }

            const titleEl = document.getElementById('confirm-dialog-title');
            const descEl = document.getElementById('confirm-dialog-desc');
            const cancelBtn = document.getElementById('confirm-modal-cancel-btn');
            const submitBtn = document.getElementById('confirm-modal-submit-btn');
            const iconContainer = document.getElementById('confirm-modal-icon-container');

            const {
                title = 'Are you sure?',
                message = 'This action cannot be undone.',
                confirmText = 'Confirm',
                cancelText = 'Cancel',
                isDanger = true
            } = options;

            if (titleEl) titleEl.textContent = title;
            if (descEl) descEl.textContent = message;
            if (submitBtn) submitBtn.textContent = confirmText;
            if (cancelBtn) cancelBtn.textContent = cancelText;

            if (isDanger) {
                if (submitBtn) submitBtn.className = 'btn-primary btn-danger-action';
                if (iconContainer) {
                    iconContainer.className = 'confirm-modal-icon-wrap danger';
                    iconContainer.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
                }
            } else {
                if (submitBtn) submitBtn.className = 'btn-primary';
                if (iconContainer) {
                    iconContainer.className = 'confirm-modal-icon-wrap info';
                    iconContainer.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
                }
            }

            const cleanup = () => {
                modal.classList.remove('active');
                modal.setAttribute('aria-hidden', 'true');
                if (submitBtn) submitBtn.removeEventListener('click', onConfirm);
                if (cancelBtn) cancelBtn.removeEventListener('click', onCancel);
                modal.removeEventListener('click', onBackdropClick);
                document.removeEventListener('keydown', onKeyDown);
            };

            const onConfirm = () => {
                cleanup();
                resolve(true);
            };

            const onCancel = () => {
                cleanup();
                resolve(false);
            };

            const onBackdropClick = (e) => {
                if (e.target === modal) {
                    onCancel();
                }
            };

            const onKeyDown = (e) => {
                if (e.key === 'Escape') {
                    onCancel();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    onConfirm();
                }
            };

            if (submitBtn) submitBtn.addEventListener('click', onConfirm);
            if (cancelBtn) cancelBtn.addEventListener('click', onCancel);
            modal.addEventListener('click', onBackdropClick);
            document.addEventListener('keydown', onKeyDown);

            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
            setTimeout(() => {
                if (submitBtn) submitBtn.focus();
            }, 50);
        });
    }

    window.showConfirm = showConfirm;

    /* ---------- Logout Flow ---------- */
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            const confirmed = await showConfirm({
                title: 'Sign Out',
                message: 'Are you sure you want to sign out of your vault session?',
                confirmText: 'Sign out',
                cancelText: 'Cancel',
                isDanger: false
            });
            if (confirmed) {
                try {
                    await supabase.auth.signOut();
                } catch (err) {
                    showToast('Logout Error', err.message, 'error');
                }
            }
        });
    });

    /* ---------- CRUD: Save Row Order (Database Only) ---------- */
    async function saveRowOrder() {
        try {
            const updates = displayOrder.map((id, index) => {
                return supabase
                    .from('passwords')
                    .update({ sort_order: index })
                    .eq('id', id);
            });

            const results = await Promise.all(updates);
            const err = results.find(r => r.error);
            if (err) {
                console.error("Supabase sort_order update error:", err.error);
            }
        } catch (err) {
            console.error("Failed to save sort_order to database:", err);
            showToast('Sync Error', 'Failed to save row order to database.', 'error');
        }
    }

    /* ---------- CRUD: Fetch & Decrypt Passwords ---------- */
    async function fetchPasswords() {
        try {
            let data = null;
            // Fetch directly from Supabase ordered by sort_order ASC
            const res = await supabase
                .from('passwords')
                .select('*')
                .order('sort_order', { ascending: true })
                .order('updated_at', { ascending: false });

            if (res.error) {
                // Fallback if sort_order column does not exist in DB yet
                const fallbackRes = await supabase
                    .from('passwords')
                    .select('*')
                    .order('updated_at', { ascending: false });
                if (fallbackRes.error) throw fallbackRes.error;
                data = fallbackRes.data;
            } else {
                data = res.data;
            }

            passwordsList = [];
            for (let item of data) {
                let decryptedValue = '[Decryption Error]';
                try {
                    decryptedValue = await window.VaultCrypto.decrypt(item.password, item.iv, cryptoKey);
                } catch (e) {
                    console.error("Failed to decrypt item:", item.id, e);
                }
                passwordsList.push({
                    ...item,
                    decryptedPassword: decryptedValue
                });
            }

            // Single source of truth: displayOrder is set strictly from database records
            displayOrder = passwordsList.map(x => x.id);

            renderPasswords(passwordsList);
        } catch (err) {
            console.error("Fetch Error:", err);
            showToast('Database Error', 'Could not load credentials: ' + err.message, 'error');
        }
    }

    /* ---------- CRUD: Render Password Table ---------- */
    function renderPasswords(items) {
        pwTableBody.innerHTML = '';
        const tableContainer = document.getElementById('table-container');
        const emptyContainer = document.getElementById('empty-state-container');

        if (items.length === 0) {
            if (tableContainer) tableContainer.style.display = 'none';
            if (emptyContainer) emptyContainer.style.display = 'block';
            return;
        }

        if (tableContainer) tableContainer.style.display = '';
        if (emptyContainer) emptyContainer.style.display = 'none';

        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.setAttribute('data-id', item.id);

            // Format updated timestamp
            const dateObj = new Date(item.updated_at);
            const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

            tr.innerHTML = `
                <td class="drag-handle-cell">
                    <div class="drag-handle" draggable="true" title="Drag to reorder">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="8" y1="6" x2="16" y2="6"/>
                            <line x1="8" y1="12" x2="16" y2="12"/>
                            <line x1="8" y1="18" x2="16" y2="18"/>
                        </svg>
                    </div>
                </td>
                <td>
                    <div class="col-account-name">
                        <span class="font-medium">${escapeHTML(item.account_name)}</span>
                    </div>
                </td>
                <td><span class="text-sec">${escapeHTML(item.username || '\u2014')}</span></td>
                <td>
                    <div class="col-pw-field">
                        <span class="masked-pw" data-id="${item.id}">&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;</span>
                        <button type="button" class="btn-icon toggle-row-pw-btn" data-id="${item.id}" title="Show Password">
                            <svg class="eye-open" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                            <svg class="eye-closed" style="display:none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path>
                                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path>
                                <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path>
                                <line x1="2" y1="2" x2="22" y2="22"></line>
                            </svg>
                        </button>
                        <button type="button" class="btn-icon copy-row-pw-btn" data-id="${item.id}" title="Copy to Clipboard">
                            <i class="fa-regular fa-copy"></i>
                        </button>
                    </div>
                </td>
                <td><span class="text-sec">${dateStr}</span></td>
                <td class="text-right">
                    <div class="row-actions">
                        <button class="btn-icon edit-row-btn" data-id="${item.id}" title="Edit Credentials">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button class="btn-icon btn-icon-danger delete-row-btn" data-id="${item.id}" title="Delete Record">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            `;

            pwTableBody.appendChild(tr);
        });

        // Add event listeners for row actions and drag-and-drop
        addTableActionListeners();
        initDragAndDrop();
    }

    /* ---------- Table Row Actions ---------- */
    function addTableActionListeners() {
        // Password Show/Hide Toggle
        document.querySelectorAll('.toggle-row-pw-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = btn.getAttribute('data-id');
                const maskedEl = document.querySelector(`span[data-id="${id}"]`);
                const item = passwordsList.find(x => x.id === id);

                if (!item || !maskedEl) return;

                const eyeOpen = btn.querySelector('.eye-open');
                const eyeClosed = btn.querySelector('.eye-closed');

                if (maskedEl.textContent === '••••••••') {
                    maskedEl.textContent = item.decryptedPassword;
                    maskedEl.className = 'plain-pw';
                    if (eyeOpen) eyeOpen.style.display = 'none';
                    if (eyeClosed) eyeClosed.style.display = 'inline-block';
                    btn.title = "Hide Password";
                } else {
                    maskedEl.textContent = '••••••••';
                    maskedEl.className = 'masked-pw';
                    if (eyeOpen) eyeOpen.style.display = 'inline-block';
                    if (eyeClosed) eyeClosed.style.display = 'none';
                    btn.title = "Show Password";
                }
            });
        });

        // Clipboard Copy Action
        document.querySelectorAll('.copy-row-pw-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const item = passwordsList.find(x => x.id === id);
                if (item) {
                    navigator.clipboard.writeText(item.decryptedPassword).then(() => {
                        showToast('Copied', 'Password copied to clipboard.', 'success');
                    }).catch(e => {
                        showToast('Copy Error', 'Clipboard access denied.', 'error');
                    });
                }
            });
        });

        // Edit Action
        document.querySelectorAll('.edit-row-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const item = passwordsList.find(x => x.id === id);
                if (item) {
                    openModal(item);
                }
            });
        });

        // Delete Action
        document.querySelectorAll('.delete-row-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const confirmed = await showConfirm({
                    title: 'Delete Password Record',
                    message: 'Are you sure you want to permanently delete this password record? This action cannot be undone.',
                    confirmText: 'Delete',
                    cancelText: 'Cancel',
                    isDanger: true
                });
                if (confirmed) {
                    try {
                        const { error } = await supabase
                            .from('passwords')
                            .delete()
                            .eq('id', id);
                        if (error) throw error;
                        showToast('Record Deleted', 'Password record removed successfully.', 'success');
                        fetchPasswords();
                    } catch (err) {
                        showToast('Deletion Error', err.message, 'error');
                    }
                }
            });
        });
    }

    /* ---------- Drag-and-Drop Row Reordering ---------- */
    function initDragAndDrop() {
        let dragSrcId = null;
        const handles = pwTableBody.querySelectorAll('.drag-handle');
        const rows = pwTableBody.querySelectorAll('tr');

        handles.forEach(handle => {
            handle.addEventListener('dragstart', (e) => {
                const tr = handle.closest('tr');
                if (!tr) return;
                dragSrcId = tr.getAttribute('data-id');
                tr.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', dragSrcId);
                if (e.dataTransfer.setDragImage) {
                    e.dataTransfer.setDragImage(tr, 15, 24);
                }
            });

            handle.addEventListener('dragend', () => {
                rows.forEach(r => {
                    r.classList.remove('dragging');
                    r.classList.remove('drag-over');
                });
            });
        });

        rows.forEach(row => {
            row.addEventListener('dragover', (e) => {
                e.preventDefault(); // Crucial to allow drop
                e.dataTransfer.dropEffect = 'move';

                const tr = e.target.closest('tr');
                if (!tr) return;

                const targetId = tr.getAttribute('data-id');
                if (targetId && targetId !== dragSrcId) {
                    rows.forEach(r => {
                        if (r !== tr) r.classList.remove('drag-over');
                    });
                    tr.classList.add('drag-over');
                }
            });

            row.addEventListener('dragleave', (e) => {
                const tr = e.target.closest('tr');
                if (tr && !tr.contains(e.relatedTarget)) {
                    tr.classList.remove('drag-over');
                }
            });

            row.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const tr = e.target.closest('tr');
                rows.forEach(r => r.classList.remove('drag-over'));

                if (!tr) return;
                const targetId = tr.getAttribute('data-id');
                if (!dragSrcId || dragSrcId === targetId) return;

                const srcIdx = displayOrder.indexOf(dragSrcId);
                const tgtIdx = displayOrder.indexOf(targetId);
                if (srcIdx < 0 || tgtIdx < 0) return;

                // Move item in displayOrder array
                displayOrder.splice(srcIdx, 1);
                displayOrder.splice(tgtIdx, 0, dragSrcId);

                // Save order to LocalStorage and database
                saveRowOrder();

                // Re-render in updated display order
                const ordered = displayOrder
                    .map(id => passwordsList.find(x => x.id === id))
                    .filter(Boolean);
                renderPasswords(ordered);
            });
        });
    }

    /* ---------- Search / Filter ---------- */
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        const ordered = displayOrder
            .map(id => passwordsList.find(x => x.id === id))
            .filter(Boolean);

        if (!query) {
            renderPasswords(ordered);
            return;
        }

        const filtered = ordered.filter(item =>
            item.account_name.toLowerCase().includes(query) ||
            (item.username && item.username.toLowerCase().includes(query))
        );

        renderPasswords(filtered);
    });

    /* ---------- Modal Controls ---------- */
    function openModal(editItem = null) {
        pwForm.reset();
        evaluatePasswordStrength('');

        if (editItem) {
            // Edit mode: show options by default and show current credentials
            document.getElementById('gen-section').style.display = 'block';
            formTitle.textContent = 'Edit Password';
            editIdInput.value = editItem.id;
            accountNameInput.value = editItem.account_name;
            accountUsernameInput.value = editItem.username || '';

            const isDecryptionError = editItem.decryptedPassword === '[Decryption Error]';
            const pwVal = isDecryptionError ? '' : editItem.decryptedPassword;

            accountPwInput.value = pwVal;
            evaluatePasswordStrength(pwVal);

            // Sync slider value to current password length (capped min: 8, max: 64)
            const currentLen = pwVal.length || 16;
            const sliderLen = Math.max(8, Math.min(64, currentLen));
            genLenInput.value = sliderLen;
            genLenVal.textContent = sliderLen;
        } else {
            // Add mode: show options by default, reset slider length, and auto-generate password
            document.getElementById('gen-section').style.display = 'block';
            formTitle.textContent = 'Add Password';
            editIdInput.value = '';

            genLenInput.value = 16;
            genLenVal.textContent = '16';
            genUpper.checked = true;
            genLower.checked = true;
            genNums.checked = true;
            genSyms.checked = true;

            const generated = generateRandomPassword();
            if (generated) {
                accountPwInput.value = generated;
                evaluatePasswordStrength(generated);
            }
        }

        pwModal.classList.add('active');
    }

    function closeModal() {
        pwModal.classList.remove('active');
        pwForm.reset();
    }

    addPwBtn.addEventListener('click', () => openModal());

    const fabAddBtn = document.getElementById('fab-add-btn');
    if (fabAddBtn) {
        fabAddBtn.addEventListener('click', () => openModal());
    }

    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Close modal on background click
    pwModal.addEventListener('click', (e) => {
        if (e.target === pwModal) closeModal();
    });

    /* ---------- Password Visibility Toggle in Modal ---------- */
    if (togglePwVisBtn && accountPwInput) {
        togglePwVisBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isHidden = accountPwInput.type === 'password';
            accountPwInput.type = isHidden ? 'text' : 'password';

            const eyeOpen = togglePwVisBtn.querySelector('.eye-open');
            const eyeClosed = togglePwVisBtn.querySelector('.eye-closed');

            if (eyeOpen) eyeOpen.style.display = isHidden ? 'none' : 'inline-block';
            if (eyeClosed) eyeClosed.style.display = isHidden ? 'inline-block' : 'none';
        });
    }

    /* ---------- Password Visibility Toggles in Settings ---------- */
    const settingsToggleBtns = document.querySelectorAll('.toggle-settings-pw');
    settingsToggleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = btn.getAttribute('data-target');
            const targetInput = document.getElementById(targetId);
            if (!targetInput) return;

            const isHidden = targetInput.type === 'password';
            targetInput.type = isHidden ? 'text' : 'password';

            const eyeOpen = btn.querySelector('.eye-open');
            const eyeClosed = btn.querySelector('.eye-closed');

            if (eyeOpen) eyeOpen.style.display = isHidden ? 'none' : 'inline-block';
            if (eyeClosed) eyeClosed.style.display = isHidden ? 'inline-block' : 'none';
        });
    });

    /* ---------- Password Strength & Generator Flow ---------- */
    accountPwInput.addEventListener('input', () => {
        evaluatePasswordStrength(accountPwInput.value);
    });

    // Generate password in real-time as user changes inputs
    function updateRealtimeGenerator() {
        genLenVal.textContent = genLenInput.value;
        const generated = generateRandomPassword();
        if (generated) {
            accountPwInput.value = generated;
            evaluatePasswordStrength(generated);
        }
    }

    genLenInput.addEventListener('input', updateRealtimeGenerator);
    genUpper.addEventListener('change', updateRealtimeGenerator);
    genLower.addEventListener('change', updateRealtimeGenerator);
    genNums.addEventListener('change', updateRealtimeGenerator);
    genSyms.addEventListener('change', updateRealtimeGenerator);

    fillGenBtn.addEventListener('click', () => {
        const genSection = document.getElementById('gen-section');

        // Ensure options panel is visible
        if (genSection.style.display === 'none') {
            genSection.style.display = 'block';
        }

        const generated = generateRandomPassword();
        if (generated) {
            accountPwInput.value = generated;
            evaluatePasswordStrength(generated);
        }
    });

    function generateRandomPassword() {
        const len = parseInt(genLenInput.value);
        const useUpper = genUpper.checked;
        const useLower = genLower.checked;
        const useNums = genNums.checked;
        const useSyms = genSyms.checked;

        let charset = '';
        if (useUpper) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        if (useLower) charset += 'abcdefghijklmnopqrstuvwxyz';
        if (useNums) charset += '0123456789';
        if (useSyms) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

        if (!charset) {
            showToast('Generator Config', 'Select at least one character set checkbox.', 'error');
            return '';
        }

        let password = '';
        const randBuffer = new Uint32Array(len);
        crypto.getRandomValues(randBuffer);

        for (let i = 0; i < len; i++) {
            password += charset[randBuffer[i] % charset.length];
        }
        return password;
    }

    function evaluatePasswordStrength(password) {
        let score = 0;
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;

        if (password.length === 0) {
            strengthFill.style.width = '0%';
            strengthFill.style.backgroundColor = 'var(--border)';
            strengthLabel.textContent = 'None';
            strengthLabel.style.color = 'var(--text-muted)';
        } else if (score <= 3) {
            strengthFill.style.width = '33%';
            strengthFill.style.backgroundColor = 'var(--danger)';
            strengthLabel.textContent = 'Weak';
            strengthLabel.style.color = 'var(--danger)';
        } else if (score <= 5) {
            strengthFill.style.width = '66%';
            strengthFill.style.backgroundColor = '#f59e0b'; // amber
            strengthLabel.textContent = 'Medium';
            strengthLabel.style.color = '#f59e0b';
        } else {
            strengthFill.style.width = '100%';
            strengthFill.style.backgroundColor = '#16a34a'; // green
            strengthLabel.textContent = 'Strong';
            strengthLabel.style.color = '#16a34a';
        }
    }

    /* ---------- Save Password Form Submit ---------- */
    pwForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const saveBtn = document.getElementById('save-btn');
        saveBtn.disabled = true;

        const editId = editIdInput.value;
        const accountName = accountNameInput.value.trim();
        const username = accountUsernameInput.value.trim();
        const plainPassword = accountPwInput.value;

        try {
            // Encrypt password client-side using zero-knowledge engine
            const encryptedData = await window.VaultCrypto.encrypt(plainPassword, cryptoKey);

            if (editId) {
                // Update existing record
                const { error } = await supabase
                    .from('passwords')
                    .update({
                        account_name: accountName,
                        username: username,
                        password: encryptedData.ciphertext,
                        iv: encryptedData.iv,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editId);

                if (error) throw error;
                showToast('Record Updated', 'Credentials saved successfully.', 'success');
            } else {
                // Insert new record
                const { error } = await supabase
                    .from('passwords')
                    .insert({
                        user_id: session.user.id,
                        account_name: accountName,
                        username: username,
                        password: encryptedData.ciphertext,
                        iv: encryptedData.iv
                    });

                if (error) throw error;
                showToast('Record Saved', 'New credentials added to vault.', 'success');
            }

            closeModal();
            fetchPasswords();
        } catch (err) {
            showToast('Save Error', err.message, 'error');
        } finally {
            saveBtn.disabled = false;
        }
    });

    /* ---------- Change Master Password Flow (with Re-encryption) ---------- */
    changePwForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const curPw = document.getElementById('cur-pw').value;
        const newPw = document.getElementById('new-pw').value;
        const confirmPw = document.getElementById('confirm-pw').value;

        if (newPw !== confirmPw) {
            showToast('Change Password', 'New passwords do not match.', 'error');
            return;
        }

        settingsSubmitBtn.disabled = true;
        settingsSubmitBtn.textContent = 'Updating master key...';

        try {
            // 1. Verify old password matches current session decryption key
            const oldKeyVerify = await window.VaultCrypto.deriveKey(curPw, session.user.email);
            const oldB64Verify = await window.VaultCrypto.exportKeyToBase64(oldKeyVerify);
            const activeB64 = localStorage.getItem('vault_key');

            if (oldB64Verify !== activeB64) {
                showToast('Auth Error', 'Current master password entered is incorrect.', 'error');
                settingsSubmitBtn.disabled = false;
                settingsSubmitBtn.textContent = 'Update Password';
                return;
            }

            // 2. Derive new key from the new master password
            const newKey = await window.VaultCrypto.deriveKey(newPw, session.user.email);
            const newB64 = await window.VaultCrypto.exportKeyToBase64(newKey);

            // 3. Batch re-encrypt all existing credentials in memory
            showToast('Re-encrypting', 'Re-encrypting credentials with new master key...', 'info');
            const reEncryptPromises = [];

            for (let item of passwordsList) {
                const encrypted = await window.VaultCrypto.encrypt(item.decryptedPassword, newKey);
                reEncryptPromises.push(
                    supabase
                        .from('passwords')
                        .update({
                            password: encrypted.ciphertext,
                            iv: encrypted.iv,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', item.id)
                );
            }

            // 3b. Also re-encrypt all secure notes
            for (let item of notesList) {
                if (item.decryptedContent === '[Decryption Error]') continue;
                const encrypted = await window.VaultCrypto.encrypt(item.decryptedContent, newKey);
                reEncryptPromises.push(
                    supabase
                        .from('notes')
                        .update({
                            content: encrypted.ciphertext,
                            iv: encrypted.iv,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', item.id)
                );
            }

            // Execute all updates
            await Promise.all(reEncryptPromises);

            // 4. Update the user login credentials in Supabase Auth
            const { error: authError } = await supabase.auth.updateUser({ password: newPw });
            if (authError) throw authError;

            // 5. Update local state key in localStorage
            localStorage.setItem('vault_key', newB64);
            cryptoKey = newKey;

            // Clear input fields
            changePwForm.reset();
            showToast('Success', 'Master password updated and credentials re-encrypted.', 'success');

            // Refresh decrypted passwords and notes list views
            fetchPasswords();
            fetchNotes();

        } catch (err) {
            console.error(err);
            showToast('Update Error', 'Failed to update credentials: ' + err.message, 'error');
        } finally {
            settingsSubmitBtn.disabled = false;
            settingsSubmitBtn.textContent = 'Update Password';
        }
    });


    /* ══════════════════════════════════════════════════════
       SECURE NOTES — CRUD, Modal, Search, Re-encryption
       ══════════════════════════════════════════════════════ */

    /* ---------- Notes: Fetch & Decrypt ---------- */
    async function fetchNotes() {
        try {
            let data = null;
            const res = await supabase
                .from('notes')
                .select('*')
                .order('sort_order', { ascending: true })
                .order('updated_at', { ascending: false });

            if (res.error) {
                // Fallback if sort_order column does not exist in DB yet
                const fallbackRes = await supabase
                    .from('notes')
                    .select('*')
                    .order('updated_at', { ascending: false });
                if (fallbackRes.error) throw fallbackRes.error;
                data = fallbackRes.data;
            } else {
                data = res.data;
            }

            notesList = [];
            for (let item of data) {
                let decryptedContent = '[Decryption Error]';
                try {
                    decryptedContent = await window.VaultCrypto.decrypt(item.content, item.iv, cryptoKey);
                } catch (e) {
                    console.error("Failed to decrypt note:", item.id, e);
                }
                notesList.push({
                    ...item,
                    decryptedContent: decryptedContent
                });
            }

            notesDisplayOrder = notesList.map(x => x.id);
            renderNotes(notesList);
        } catch (err) {
            // Silently handle if the notes table doesn't exist yet
            if (err.message && (err.message.includes('does not exist') || err.code === '42P01')) {
                console.warn('Notes table does not exist yet. Run schema.sql to create it.');
                notesList = [];
                notesDisplayOrder = [];
                renderNotes([]);
                return;
            }
            console.error("Fetch Notes Error:", err);
            showToast('Notes Error', 'Could not load notes: ' + err.message, 'error');
        }
    }

    /* ---------- Notes: Render Card Grid ---------- */
    function renderNotes(items) {
        notesGridContainer.innerHTML = '';
        const emptyState = document.getElementById('notes-empty-state');

        if (items.length === 0) {
            notesGridContainer.style.display = 'none';
            if (emptyState) emptyState.style.display = 'flex';
            return;
        }

        notesGridContainer.style.display = '';
        if (emptyState) emptyState.style.display = 'none';

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'note-card';
            card.setAttribute('data-note-id', item.id);

            const dateObj = new Date(item.updated_at);
            const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

            const isError = item.decryptedContent === '[Decryption Error]';
            const previewText = isError
                ? '•••••••• encrypted ••••••••'
                : escapeHTML(item.decryptedContent);
            const previewClass = isError ? 'note-card-preview encrypted-preview' : 'note-card-preview';

            const charCount = isError ? '—' : item.decryptedContent.length;

            card.innerHTML = `
                <div class="note-card-header">
                    <div class="note-card-title">${escapeHTML(item.title)}</div>
                    <div class="note-card-actions">
                        <button type="button" class="btn-icon copy-note-btn" data-note-id="${item.id}" title="Copy to Clipboard">
                            <i class="fa-regular fa-copy"></i>
                        </button>
                        <button type="button" class="btn-icon edit-note-btn" data-note-id="${item.id}" title="Edit Note">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button type="button" class="btn-icon btn-icon-danger delete-note-btn" data-note-id="${item.id}" title="Delete Note">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
                <div class="${previewClass}">${previewText}</div>
                <div class="note-card-footer">
                    <span class="note-card-date">${dateStr}</span>
                    <span class="note-card-badge">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                        ${charCount} chars
                    </span>
                </div>
            `;

            notesGridContainer.appendChild(card);
        });

        addNoteCardListeners();
    }

    /* ---------- Notes: Card Event Listeners ---------- */
    function addNoteCardListeners() {
        // Click card body to edit
        document.querySelectorAll('.note-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't open modal if clicking on action buttons
                if (e.target.closest('.note-card-actions')) return;
                const id = card.getAttribute('data-note-id');
                const item = notesList.find(x => x.id === id);
                if (item) openNoteModal(item);
            });
        });

        // Copy note content
        document.querySelectorAll('.copy-note-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-note-id');
                const item = notesList.find(x => x.id === id);
                if (item && item.decryptedContent !== '[Decryption Error]') {
                    navigator.clipboard.writeText(item.decryptedContent).then(() => {
                        showToast('Copied', 'Note content copied to clipboard.', 'success');
                    }).catch(() => {
                        showToast('Copy Error', 'Clipboard access denied.', 'error');
                    });
                }
            });
        });

        // Edit note
        document.querySelectorAll('.edit-note-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-note-id');
                const item = notesList.find(x => x.id === id);
                if (item) openNoteModal(item);
            });
        });

        // Delete note
        document.querySelectorAll('.delete-note-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-note-id');
                const confirmed = await showConfirm({
                    title: 'Delete Secure Note',
                    message: 'Are you sure you want to permanently delete this note? This action cannot be undone.',
                    confirmText: 'Delete',
                    cancelText: 'Cancel',
                    isDanger: true
                });
                if (confirmed) {
                    try {
                        const { error } = await supabase
                            .from('notes')
                            .delete()
                            .eq('id', id);
                        if (error) throw error;
                        showToast('Note Deleted', 'Secure note removed successfully.', 'success');
                        fetchNotes();
                    } catch (err) {
                        showToast('Deletion Error', err.message, 'error');
                    }
                }
            });
        });
    }

    /* ---------- Notes: Search / Filter ---------- */
    if (notesSearchInput) {
        notesSearchInput.addEventListener('input', () => {
            const query = notesSearchInput.value.toLowerCase().trim();
            const ordered = notesDisplayOrder
                .map(id => notesList.find(x => x.id === id))
                .filter(Boolean);

            if (!query) {
                renderNotes(ordered);
                return;
            }

            const filtered = ordered.filter(item =>
                item.title.toLowerCase().includes(query) ||
                (item.decryptedContent !== '[Decryption Error]' && item.decryptedContent.toLowerCase().includes(query))
            );

            renderNotes(filtered);
        });
    }

    /* ---------- Notes: Modal Controls ---------- */
    function openNoteModal(editItem = null) {
        noteForm.reset();
        updateNoteCharCount();

        if (editItem) {
            noteFormTitle.textContent = 'Edit Note';
            noteEditIdInput.value = editItem.id;
            noteTitleInput.value = editItem.title;
            const isError = editItem.decryptedContent === '[Decryption Error]';
            noteContentInput.value = isError ? '' : editItem.decryptedContent;
            updateNoteCharCount();
        } else {
            noteFormTitle.textContent = 'Add Note';
            noteEditIdInput.value = '';
        }

        noteModal.classList.add('active');
    }

    function closeNoteModal() {
        noteModal.classList.remove('active');
        noteForm.reset();
        updateNoteCharCount();
    }

    function updateNoteCharCount() {
        if (noteCharCount && noteContentInput) {
            const len = noteContentInput.value.length;
            noteCharCount.textContent = `${len} character${len !== 1 ? 's' : ''}`;
        }
    }

    if (addNoteBtn) addNoteBtn.addEventListener('click', () => openNoteModal());
    if (closeNoteModalBtn) closeNoteModalBtn.addEventListener('click', closeNoteModal);
    if (noteCancelBtn) noteCancelBtn.addEventListener('click', closeNoteModal);

    if (noteModal) {
        noteModal.addEventListener('click', (e) => {
            if (e.target === noteModal) closeNoteModal();
        });
    }

    if (noteContentInput) {
        noteContentInput.addEventListener('input', updateNoteCharCount);
    }

    /* ---------- Notes: Save Form Submit ---------- */
    if (noteForm) {
        noteForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (noteSaveBtn) noteSaveBtn.disabled = true;

            const editId = noteEditIdInput.value;
            const title = noteTitleInput.value.trim();
            const plainContent = noteContentInput.value;

            try {
                const encryptedData = await window.VaultCrypto.encrypt(plainContent, cryptoKey);

                if (editId) {
                    const { error } = await supabase
                        .from('notes')
                        .update({
                            title: title,
                            content: encryptedData.ciphertext,
                            iv: encryptedData.iv,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', editId);

                    if (error) throw error;
                    showToast('Note Updated', 'Secure note saved successfully.', 'success');
                } else {
                    const { error } = await supabase
                        .from('notes')
                        .insert({
                            user_id: session.user.id,
                            title: title,
                            content: encryptedData.ciphertext,
                            iv: encryptedData.iv
                        });

                    if (error) throw error;
                    showToast('Note Saved', 'New secure note added to vault.', 'success');
                }

                closeNoteModal();
                fetchNotes();
            } catch (err) {
                showToast('Save Error', err.message, 'error');
            } finally {
                if (noteSaveBtn) noteSaveBtn.disabled = false;
            }
        });
    }


    /* ---------- Import & Export Functionality ---------- */
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const importDropzone = document.getElementById('import-dropzone');
    const csvFileInput = document.getElementById('csv-file-input');
    const dropzoneText = document.getElementById('dropzone-text');
    const importCsvBtn = document.getElementById('import-csv-btn');
    let selectedCsvFile = null;

    // Export CSV
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => {
            if (!passwordsList || passwordsList.length === 0) {
                showToast('Export Error', 'No password records available to export.', 'error');
                return;
            }

            try {
                // Prepare CSV header and rows
                const headers = ['Account Name', 'Username', 'Password'];
                const csvRows = [headers.join(',')];

                passwordsList.forEach(item => {
                    const name = `"${(item.account_name || '').replace(/"/g, '""')}"`;
                    const uname = `"${(item.username || '').replace(/"/g, '""')}"`;
                    const pass = `"${(item.decryptedPassword || '').replace(/"/g, '""')}"`;
                    csvRows.push(`${name},${uname},${pass}`);
                });

                const csvContent = csvRows.join('\n');
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                const timestamp = new Date().toISOString().slice(0, 10);

                link.setAttribute('href', url);
                link.setAttribute('download', `vault_passwords_export_${timestamp}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                showToast('Export Successful', `Exported ${passwordsList.length} records to CSV.`, 'success');
            } catch (err) {
                console.error(err);
                showToast('Export Error', 'Failed to generate CSV export: ' + err.message, 'error');
            }
        });
    }

    // Drag & Drop / File selection for Import
    if (importDropzone && csvFileInput) {
        importDropzone.addEventListener('click', () => csvFileInput.click());

        importDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            importDropzone.classList.add('border-primary');
        });

        importDropzone.addEventListener('dragleave', () => {
            importDropzone.classList.remove('border-primary');
        });

        importDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            importDropzone.classList.remove('border-primary');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileSelect(e.dataTransfer.files[0]);
            }
        });

        csvFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleFileSelect(e.target.files[0]);
            }
        });
    }

    function handleFileSelect(file) {
        if (!file.name.endsWith('.csv')) {
            showToast('Invalid File', 'Please select a valid .csv file.', 'error');
            return;
        }
        selectedCsvFile = file;
        if (dropzoneText) dropzoneText.textContent = `Selected: ${file.name}`;
        if (importCsvBtn) importCsvBtn.disabled = false;
    }

    // CSV Parsing Helper
    function parseCSV(text) {
        const lines = text.split(/\r\n|\n/);
        const results = [];
        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            // Parse CSV line respecting quotes
            const row = [];
            let inQuotes = false;
            let currentToken = '';
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
                    if (inQuotes && line[i + 1] === '"') {
                        currentToken += '"';
                        i++; // skip escaped quote
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    row.push(currentToken.trim());
                    currentToken = '';
                } else {
                    currentToken += char;
                }
            }
            row.push(currentToken.trim());
            results.push(row);
        }
        return results;
    }

    // Import CSV Execution
    if (importCsvBtn) {
        importCsvBtn.addEventListener('click', async () => {
            if (!selectedCsvFile) return;

            importCsvBtn.disabled = true;
            importCsvBtn.textContent = 'Importing...';

            try {
                const text = await selectedCsvFile.text();
                const rows = parseCSV(text);

                if (rows.length === 0) {
                    throw new Error('CSV file is empty.');
                }

                // Check if first row is header
                let startIndex = 0;
                const headerCandidate = rows[0].map(c => c.toLowerCase().replace(/[^a-z]/g, ''));
                if (headerCandidate.some(h => h.includes('name') || h.includes('title') || h.includes('user') || h.includes('pass'))) {
                    startIndex = 1;
                }

                const recordsToInsert = [];
                for (let i = startIndex; i < rows.length; i++) {
                    const row = rows[i];
                    if (row.length < 2) continue; // Need at least name & password or username

                    const accountName = row[0] || 'Imported Account';
                    const username = row.length >= 3 ? row[1] : '';
                    const plainPassword = row.length >= 3 ? row[2] : row[1];

                    if (!plainPassword) continue;

                    const encryptedData = await window.VaultCrypto.encrypt(plainPassword, cryptoKey);
                    recordsToInsert.push({
                        user_id: session.user.id,
                        account_name: accountName,
                        username: username,
                        password: encryptedData.ciphertext,
                        iv: encryptedData.iv
                    });
                }

                if (recordsToInsert.length === 0) {
                    throw new Error('No valid password records found in CSV file.');
                }

                const { error } = await supabase
                    .from('passwords')
                    .insert(recordsToInsert);

                if (error) throw error;

                showToast('Import Successful', `Successfully imported ${recordsToInsert.length} password records.`, 'success');

                // Reset import state
                selectedCsvFile = null;
                if (csvFileInput) csvFileInput.value = '';
                if (dropzoneText) dropzoneText.textContent = 'Click to select or drag & drop a CSV file';
                importCsvBtn.disabled = true;

                // Refresh vault passwords list
                fetchPasswords();
            } catch (err) {
                console.error(err);
                showToast('Import Error', err.message, 'error');
            } finally {
                importCsvBtn.textContent = 'Import Passwords';
            }
        });
    }

    /* ---------- Helpers ---------- */
    function escapeHTML(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /* ---------- Main Init ---------- */
    // Initial fetch of password entries and notes
    fetchPasswords();
    fetchNotes();

})();
