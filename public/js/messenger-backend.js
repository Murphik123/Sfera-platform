/**
 * SFERA Messenger — Backend Integration Pass 04-C (Updated)
 *
 * Source of truth:
 *   GET  /api/chat/dialogs
 *   GET  /api/chat/:userId
 *   POST /api/chat/send
 *   PUT  /api/chat/read/:messageId
 *
 * Realtime:
 *   Socket.IO authenticated gateway
 *
 * USER / ADMIN:
 *   authorization remains server-side.
 *   Messenger never trusts role from localStorage.
 */

(function () {
    'use strict';

    let currentLang = localStorage.getItem('sfera_lang') || 'tm';
    let activeTab = 'chats';
    let activeDialogId = null;

        let dialogsData = [];
    let messagesData = {};
    let currentUser = null;
    let socket = null;
    let heartbeatInterval = null;

    const langBtn = document.getElementById('langBtn');
    const themeToggle = document.getElementById('themeToggle');
    const messengerContainer = document.getElementById('messengerContainer');
    const searchInput = document.getElementById('searchInput');
    const createGroupBtn = document.getElementById('createGroupBtn');
    const groupModal = document.getElementById('groupModal');
    const cancelGroupBtn = document.getElementById('cancelGroupBtn');
    const groupForm = document.getElementById('groupForm');
    const dialogsList = document.getElementById('dialogsList');
    const newsFeed = document.getElementById('newsFeed');
    const chatMessages = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const emojiBtn = document.getElementById('emojiBtn');
    const emojiPicker = document.getElementById('emojiPicker');
    const emojiGrid = document.getElementById('emojiGrid');
    const fileBtn = document.getElementById('fileBtn');
    const fileInput = document.getElementById('fileInput');
    const exportChatBtn = document.getElementById('exportChatBtn');
    const dropbtn = document.getElementById('dropbtn');
    const tabsDropdown = document.getElementById('tabsDropdown');
    const dropdownContent = document.getElementById('dropdownContent');

    const audioCallBtn = document.getElementById('audioCallBtn');
    const videoCallBtn = document.getElementById('videoCallBtn');
    const callModal = document.getElementById('callModal');
    const endCallBtn = document.getElementById('endCallBtn');
    const callTargetName = document.getElementById('callTargetName');
    const callStatusText = document.getElementById('callStatusText');

    const emojis = [
        '😀','😂','😍','😊','😎','👍','👏','🙏','❤️','🔥',
        '🎉','😄','😁','🤣','😅','😉','🙂','🙃','😌','🤔',
        '😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯',
        '😪','😫','🥱','😴','😌','🤓','🧐','😕','😟','🙁',
        '☹️','😲','🥳','🤩','😇','🤗','🤭','🤫','🤥','😶',
        '😐','😑','😬','🙄','😮‍💨','🤤','😋','😛','😜','🤪',
        '🤨','🫡','🤠','🥰','😘','😗','😙','😚','😋','😎'
    ];

    function getDict() {
        if (
            window.translations &&
            window.translations[currentLang]
        ) {
            return window.translations[currentLang];
        }

        return {};
    }

    function tr(key, fallback = '') {
        return getDict()[key] || fallback || key;
    }

    function getUserId(user) {
        if (!user) return null;

        return String(
            user._id ||
            user.id ||
            user.userId ||
            ''
        );
    }

    function getUserName(user) {
        if (!user) return tr('user', 'User');

        return (
            user.username ||
            user.name ||
            user.fullName ||
            user.email ||
            tr('user', 'User')
        );
    }

    function normalizeDialog(dialog) {
        const user = dialog?.user || dialog?.partner || dialog;

        const id =
            dialog?.id ||
            dialog?._id ||
            getUserId(user);

        if (!id) return null;

        return {
            id: String(id),
            name: getUserName(user),
            avatar:
                user?.avatar ||
                dialog?.avatar ||
                '',
            lastMsg:
                dialog?.lastMessage?.text ||
                dialog?.lastMsg ||
                '',
            time:
                formatTime(
                    dialog?.lastMessage?.createdAt ||
                    dialog?.time ||
                    dialog?.updatedAt
                ),
            unread:
                Number(
                    dialog?.unread ||
                    dialog?.unreadCount ||
                    0
                ),
            online:
                Boolean(
                    dialog?.online ||
                    user?.online
                ),
            isGroup:
                Boolean(
                    dialog?.isGroup
                )
        };
    }

    function normalizeMessage(message) {
        const from =
            message?.from ||
            message?.sender ||
            {};

        const fromId = getUserId(from);

        const isSent =
            currentUser &&
            fromId === getUserId(currentUser);

        return {
            id:
                message?._id ||
                message?.id ||
                `msg_${Date.now()}_${Math.random()}`,
            sender:
                getUserName(from),
            senderId: fromId,
            text:
                message?.text ||
                '',
            time:
                formatTime(
                    message?.createdAt ||
                    message?.time
                ),
            type:
                isSent ? 'sent' : 'received',
            read:
                Boolean(message?.read),
            raw: message
        };
    }

    function formatTime(value) {
        if (!value) return '';

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleTimeString(
            [],
            {
                hour: '2-digit',
                minute: '2-digit'
            }
        );
    }

    function showToast(msg, type = 'info') {
        const toast =
            document.createElement('div');

        toast.className =
            `toast ${type}`;

        toast.textContent = msg;

        document.body.appendChild(toast);

        setTimeout(
            () => toast.remove(),
            3000
        );
    }

    async function loadDialogs() {
        try {
            const response =
                await window.api.get(
                    '/chat/dialogs'
                );

            const raw =
                Array.isArray(response)
                    ? response
                    : (
                        response?.dialogs ||
                        response?.data ||
                        []
                    );

            dialogsData = raw
                .map(normalizeDialog)
                .filter(Boolean);

            // === Фиксированные контакты: всегда в списке ===
            const fixedDialogs = [
                {
                    id: 'devs',
                    name: 'Разработчики Sfera',
                    lastMsg: 'Täzeleşdirme taýýar!',
                    time: 'Duş',
                    unread: 0,
                    isGroup: true,
                    avatarIcon: '💻',
                    type: 'chats'
                },
                {
                    id: 'ai_assistant',
                    name: 'Sfera AI Kömekçi',
                    lastMsg: 'Salam! Size nähili kömek edip bilerin?',
                    time: 'Häzir',
                    unread: 0,
                    isAI: true,
                    type: 'assistant'
                }
            ];

            const fixedIds = new Set(fixedDialogs.map(d => d.id));
            dialogsData = [
                ...fixedDialogs,
                ...dialogsData.filter(d => !fixedIds.has(d.id))
            ];
            // === /Фиксированные контакты ===

            renderDialogs();

            if (
                activeDialogId &&
                dialogsData.some(
                    d => d.id === activeDialogId
                )
            ) {
                await loadMessages(
                    activeDialogId,
                    false
                );
            }

        } catch (error) {
            console.error(
                'SFERA Messenger dialogs:',
                error
            );

            dialogsData = [];
            renderDialogs();

            showToast(
                error.message ||
                tr(
                    'connection_error',
                    'Messenger connection error'
                ),
                'error'
            );
        }
    }

    async function loadMessages(
        userId,
        markRead = true
    ) {
        if (!userId) return;

        try {
            // Если это локальный бот или кастомная группа — работаем с локальными данными
            if (userId === 'ai_assistant' || userId === 'devs') {
                if (!messagesData[userId]) {
                    messagesData[userId] = [];
                }
                renderChat();
                return;
            }

            const response =
                await window.api.get(
                    `/chat/${encodeURIComponent(userId)}`
                );

            const raw =
                Array.isArray(response)
                    ? response
                    : (
                        response?.messages ||
                        response?.data ||
                        []
                    );

            messagesData[userId] =
                raw.map(normalizeMessage);

            renderChat();

            if (markRead) {
                const unread =
                    messagesData[userId]
                        .filter(
                            m =>
                                m.type === 'received' &&
                                !m.read &&
                                m.id
                        );

                for (const message of unread) {
                    await markMessageRead(
                        message.id
                    );
                }

                const dialog =
                    dialogsData.find(
                        d => d.id === userId
                    );

                if (dialog) {
                    dialog.unread = 0;
                    renderDialogs();
                }
            }

        } catch (error) {
            console.error(
                'SFERA Messenger history:',
                error
            );

            messagesData[userId] = [];
            renderChat();

            showToast(
                error.message ||
                tr(
                    'connection_error',
                    'Unable to load messages'
                ),
                'error'
            );
        }
    }

    async function markMessageRead(
        messageId
    ) {
        if (!messageId) return;

        try {
            await window.api.put(
                `/chat/read/${encodeURIComponent(messageId)}`,
                {}
            );
        } catch (error) {
            console.warn(
                'SFERA Messenger mark read:',
                error.message
            );
        }
    }

    async function sendMessage(text) {
        const value =
            String(text || '').trim();

        if (!activeDialogId || !value) {
            return;
        }

        // Проверяем текущего пользователя
        if (!currentUser && window.api && window.api.getCurrentUser) {
            currentUser = await window.api.getCurrentUser();
        }

        // === AI-помощник: локальный ответ без бэкенда ===
        if (activeDialogId === 'ai_assistant') {
            const userMsg = normalizeMessage({
                id: 'local_' + Date.now(),
                text: value,
                sender: currentUser,
                createdAt: new Date().toISOString()
            });

            if (!messagesData[activeDialogId]) {
                messagesData[activeDialogId] = [];
            }
            messagesData[activeDialogId].push(userMsg);

            if (messageInput) messageInput.value = '';
            renderChat();

            setTimeout(() => {
                const aiMsg = normalizeMessage({
                    id: 'ai_' + Date.now(),
                    text: 'Men Sfera AI Kömekçi. Soragyňyz kabul edildi: "' + value + '". Häzir bu demo jogap.',
                    sender: { username: 'Sfera AI Kömekçi' },
                    createdAt: new Date().toISOString()
                });
                messagesData[activeDialogId].push(aiMsg);
                renderChat();
            }, 700);

            return;
        }
        // === /AI-помощник ===

        if (sendBtn) sendBtn.disabled = true;

        try {   
            const response =
                await window.api.post(
                    '/chat/send',
                    {
                        to: activeDialogId,
                        text: value
                    }
                );

            const message =
                response?.message ||
                response?.data ||
                response;

            if (message) {
                const normalized =
                    normalizeMessage(message);

                if (!messagesData[activeDialogId]) {
                    messagesData[activeDialogId] = [];
                }

                const exists =
                    messagesData[activeDialogId]
                        .some(
                            m =>
                                String(m.id) ===
                                String(normalized.id)
                        );

                if (!exists) {
                    messagesData[activeDialogId]
                        .push(normalized);
                }
            }

            if (messageInput) messageInput.value = '';

            await loadDialogs();
            renderChat();

        } catch (error) {
            console.error(
                'SFERA Messenger send:',
                error
            );

            showToast(
                error.message ||
                tr(
                    'send_error',
                    'Message was not sent'
                ),
                'error'
            );
        } finally {
            if (sendBtn) sendBtn.disabled = false;
            if (messageInput) messageInput.focus();
        }
    }

    function renderDialogs(
        listToRender = null
    ) {
        if (!dialogsList) return;

        // Фильтр по активной вкладке: chats / assistant / news
        if (listToRender === null) {
            const currentTab = (typeof activeTab !== 'undefined' && activeTab) || 'chats';
            if (currentTab === 'assistant') {
                listToRender = dialogsData.filter(d => d.type === 'assistant' || d.isAI);
            } else if (currentTab === 'news') {
                listToRender = [];
            } else {
                listToRender = dialogsData.filter(d => d.type !== 'assistant' && !d.isAI);
            }
        }

        dialogsList.innerHTML = ''; 

        if (!listToRender.length) {
            dialogsList.innerHTML = `
                <div class="empty-state">
                    <div class="icon">💬</div>
                    <p>${tr(
                        'no_chats',
                        'No conversations yet'
                    )}</p>
                </div>
            `;
            return;
        }

        listToRender.forEach(dialog => {
            const item =
                document.createElement('div');

            item.className =
                `dialog-item ${
                    activeDialogId === dialog.id
                        ? 'active'
                        : ''
                }`;

            item.dataset.id = dialog.id;
            item.setAttribute('data-id', dialog.id);
            const avatar =
                dialog.avatar
                    ? `<img src="${escapeHtml(dialog.avatar)}" alt="">`
                    : escapeHtml(
                        dialog.name.charAt(0)
                    );

            item.innerHTML = `
                <div class="dialog-avatar ${
                    dialog.isGroup ? 'group' : ''
                }">
                    ${dialog.isGroup ? '👥' : avatar}
                    ${
                        dialog.online
                            ? '<div class="online-dot"></div>'
                            : ''
                    }
                </div>

                <div class="dialog-info">
                    <div class="name">
                        ${escapeHtml(dialog.name)}
                    </div>

                    <div class="last-msg">
                        ${escapeHtml(dialog.lastMsg)}
                    </div>
                </div>

                <div class="dialog-time">
                    ${escapeHtml(dialog.time)}
                </div>

                ${
                    dialog.unread > 0
                        ? `<div class="unread-badge">
                            ${dialog.unread}
                           </div>`
                        : ''
                }
            `;

            item.addEventListener(
                'click',
                () => selectDialog(dialog.id)
            );

            dialogsList.appendChild(item);
        });
    }

    async function selectDialog(id) {
        activeDialogId = String(id);

        renderDialogs();

        const dialog =
            dialogsData.find(
                d => d.id === activeDialogId
            );

        if (dialog) {
            dialog.unread = 0;
        }

        await loadMessages(
            activeDialogId,
            true
        );
    }

    function renderChat() {
        if (!activeDialogId || !chatMessages) {
            return;
        }

        const dialog =
            dialogsData.find(
                d => d.id === activeDialogId
            );

        if (!dialog) return;

        const chatName = document.getElementById('chatName');
        const chatAvatar = document.getElementById('chatAvatar');
        const chatStatus = document.getElementById('chatStatus');

        if (chatName) {
            chatName.textContent = dialog.name;
        }

        if (chatAvatar) {
            chatAvatar.textContent =
                dialog.isGroup
                    ? '👥'
                    : dialog.name.charAt(0);
        }

        if (chatStatus) {
            chatStatus.textContent =
                dialog.online
                    ? tr('online', 'Online')
                    : tr('offline', 'Offline');
        }

        chatMessages.innerHTML = '';

        const messages =
            messagesData[activeDialogId] ||
            [];

        if (!messages.length) {
            chatMessages.innerHTML = `
                <div class="empty-state">
                    <div class="icon">💬</div>
                    <p>${tr(
                        'no_messages',
                        'No messages yet'
                    )}</p>
                </div>
            `;

            return;
        }

        messages.forEach(message => {
            const msgEl =
                document.createElement('div');

            msgEl.className =
                `message ${message.type}`;

            msgEl.innerHTML = `
                ${
                    message.type === 'received' &&
                    dialog.isGroup
                        ? `<div class="msg-username">
                            ${escapeHtml(message.sender)}
                           </div>`
                        : ''
                }

                <div>
                    ${escapeHtml(message.text)}
                </div>

                <div class="msg-time">
                    ${escapeHtml(message.time)}
                </div>
            `;

            chatMessages.appendChild(msgEl);
        });

        chatMessages.scrollTop =
            chatMessages.scrollHeight;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function connectRealtime() {
        if (
            typeof window.io !== 'function'
        ) {
            console.warn(
                'SFERA Messenger: Socket.IO client unavailable'
            );
            return;
        }

        const token =
            window.api.getToken();

        if (!token) return;

        socket =    
            window.io(
                window.location.origin,
                {
                    auth: {
                        token
                    },
                    transports: [
                        'polling',
                        'websocket'
                    ],
                    upgrade: true,
                    rememberUpgrade: false,
                    withCredentials: true,
                    reconnection: true,
                    reconnectionAttempts: 20,
                    reconnectionDelay: 1500,
                    reconnectionDelayMax: 8000,
                    timeout: 30000,
                    pingTimeout: 60000,
                    pingInterval: 25000
                }
            );

                socket.on(
            'connect',
            () => {
                console.info(
                    'SFERA Messenger realtime connected'
                );

                if (heartbeatInterval) {
                    clearInterval(heartbeatInterval);
                }
                heartbeatInterval = setInterval(() => {
                    if (socket && socket.connected) {
                        socket.emit('heartbeat');
                    }
                }, 45000);
            }
        );

               socket.on(
            'disconnect',
            reason => {
                console.warn(
                    'SFERA Messenger realtime disconnected:',
                    reason
                );

                if (heartbeatInterval) {
                    clearInterval(heartbeatInterval);
                    heartbeatInterval = null;
                }
            }
        );     

               socket.on(
            'connect_error',
            error => {
                console.warn(
                    'SFERA Messenger realtime:',
                    error.message
                );
            }
        );

        socket.on(
            'user_registered',
            () => {
                loadDialogs();
            }
        );

        socket.on(
            'user_status_change',
            data => {
                const dialog = dialogsData.find(
                    d => d.id === String(data?.userId)
                );
                if (dialog) {
                    dialog.online = Boolean(data.online);
                    renderDialogs();
                }
            }
        );

      socket.on('new_message', async message => {
            if (!message) return;

            const normalized = normalizeMessage(message);

            const rawFrom = message.from || message.sender;
            const rawTo = message.to || message.recipient;

            const fromId = String(rawFrom?._id || rawFrom?.id || rawFrom || '');
            const toId = String(rawTo?._id || rawTo?.id || rawTo || '');
            const myId = String(getUserId(currentUser) || '');

            const partnerId = (fromId === myId) ? toId : fromId;

            if (!partnerId) return;

            const key = String(partnerId);

            if (!messagesData[key]) {
                messagesData[key] = [];
            }

            const exists = messagesData[key].some(m => String(m.id) === String(normalized.id));
            if (!exists) {
                messagesData[key].push(normalized);
            }

            if (String(activeDialogId) === key) {
                renderChat();
                if (normalized.type === 'received' && normalized.id) {
                    await markMessageRead(normalized.id);
                }
            } else {
                const dialog = dialogsData.find(d => String(d.id) === key);
                if (dialog) {
                    dialog.lastMsg = normalized.text || '';
                    dialog.time = normalized.time || dialog.time;
                    if (normalized.type === 'received') {
                        dialog.unread = Number(dialog.unread || 0) + 1;
                    }
                }
            }

            renderDialogs();
        });
    }

    function initEmojiPicker() {       if (!emojiBtn || !emojiPicker || !emojiGrid) return;
        
        emojiGrid.innerHTML = '';
        emojis.forEach(emoji => {
            const btn =
                document.createElement('span');

            btn.textContent = emoji;
            btn.addEventListener(
                'click',
                () => {
                    if (messageInput) messageInput.value += emoji;
                    emojiPicker.classList.remove(
                        'active'
                    );
                    if (messageInput) messageInput.focus();
                }
            );

            emojiGrid.appendChild(btn);
        });

        emojiBtn.addEventListener(
            'click',
            event => {
                event.stopPropagation();
                emojiPicker.classList.toggle(
                    'active'
                );
            }
        );
    }

    function initLanguage() {
        if (!langBtn) return;
        langBtn.addEventListener(
            'click',
            () => {
                currentLang =
                    currentLang === 'tm'
                        ? 'ru'
                        : currentLang === 'ru'
                            ? 'en'
                            : 'tm';

                localStorage.setItem(
                    'sfera_lang',
                    currentLang
                );

                langBtn.textContent =
                    currentLang.toUpperCase();

                if (
                    typeof window.applyLanguage ===
                    'function'
                ) {
                    window.applyLanguage();
                }

                renderDialogs();
                renderChat();
            }
        );
    }

    function initTheme() {
        if (!themeToggle || !messengerContainer) return;
        themeToggle.addEventListener(
            'click',
            () => {
                messengerContainer.classList.toggle(
                    'light-theme'
                );

                themeToggle.textContent =
                    messengerContainer.classList.contains(
                        'light-theme'
                    )
                        ? '☀️'
                        : '🌙';
            }
        );
    }

    function initTabs() {
        if (!dropdownContent) return;

        dropdownContent
            .querySelectorAll('button')
            .forEach(btn => {
                btn.addEventListener(
                    'click',
                    () => {
                        dropdownContent
                            .querySelectorAll(
                                'button'
                            )
                            .forEach(
                                b =>
                                    b.classList.remove(
                                        'active'
                                    )
                            );

                        btn.classList.add(
                            'active'
                        );

                        activeTab =
                            btn.getAttribute(
                                'data-tab'
                            );

                        const label = document.getElementById('currentTabLabel');
                        if (label) label.textContent = btn.textContent;

                        if (tabsDropdown) {
                            tabsDropdown.classList.remove('show');
                        }

                        if (activeTab === 'chats') {
                            if (dialogsList) dialogsList.style.display = 'block';
                            if (newsFeed) newsFeed.style.display = 'none';
                            renderDialogs();
                        } else if (activeTab === 'news') {
                            if (dialogsList) dialogsList.style.display = 'none';
                            if (newsFeed) newsFeed.style.display = 'block';
                            renderNews();
                        } else if (activeTab === 'assistant') {
                            if (dialogsList) dialogsList.style.display = 'block';
                            if (newsFeed) newsFeed.style.display = 'none';
                            renderDialogs();
                            selectDialog('ai_assistant');
                        }                        
                    }
                );
            });
    }

    function initSearch() {
        if (!searchInput) return;
        searchInput.addEventListener(
            'input',
            event => {
                const query =
                    event.target.value
                        .toLowerCase()
                        .trim();

                if (!query) {
                    renderDialogs(
                        dialogsData
                    );
                    return;
                }

                const filtered =
                    dialogsData.filter(
                        dialog =>
                            dialog.name
                                .toLowerCase()
                                .includes(query)
                    );

                renderDialogs(filtered);

                if (!filtered.length && dialogsList) {
                    dialogsList.innerHTML = `
                        <div class="empty-state">
                            <div class="icon">🔍</div>
                            <p>${tr(
                                'user_not_found',
                                'User not found'
                            )}</p>
                        </div>
                    `;
                }
            }
        );
    }

    function initGroups() {
        if (createGroupBtn) {
            createGroupBtn.addEventListener(
                'click',
                () => {
                    showToast(
                        tr(
                            'feature_coming_soon',
                            'Group chats will be connected in a future backend pass.'
                        ),
                        'info'
                    );
                }
            );
        }

        if (cancelGroupBtn && groupModal) {
            cancelGroupBtn.addEventListener(
                'click',
                () =>
                    groupModal.classList.remove(
                        'active'
                    )
            );
        }

        if (groupForm) {
            groupForm.addEventListener(
                'submit',
                event => {
                    event.preventDefault();

                    showToast(
                        tr(
                            'feature_coming_soon',
                            'Group chats will be connected in a future backend pass.'
                        ),
                        'info'
                    );

                    if (groupModal) {
                        groupModal.classList.remove(
                            'active'
                        );
                    }
                }
            );
        }
    }

    function initCalls() {
        function startCall(type) {
            const dialog =
                dialogsData.find(
                    d => d.id === activeDialogId
                );

            if (!dialog) {
                showToast(
                    tr(
                        'select_chat',
                        'Select a chat first'
                    ),
                    'error'
                );
                return;
            }

            if (callTargetName) callTargetName.textContent = dialog.name;

            if (callStatusText) {
                callStatusText.textContent =
                    type === 'audio'
                        ? tr(
                            'audio_call',
                            'Audio call...'
                        )
                        : tr(
                            'video_call',
                            'Video call...'
                        );
            }

            if (callModal) callModal.classList.add('active');
        }

        if (audioCallBtn) audioCallBtn.addEventListener('click', () => startCall('audio'));
        if (videoCallBtn) videoCallBtn.addEventListener('click', () => startCall('video'));
        if (endCallBtn && callModal) {
            endCallBtn.addEventListener(
                'click',
                () => callModal.classList.remove('active')
            );
        }
    }

    function initFileButton() {
        if (fileBtn) {
            fileBtn.addEventListener(
                'click',
                () => {
                    showToast(
                        tr(
                            'file_upload_soon',
                            'File upload will be connected in a future backend pass.'
                        ),
                        'info'
                    );
                }
            );
        }

        if (fileInput) {
            fileInput.addEventListener(
                'change',
                () => {
                    fileInput.value = '';
                }
            );
        }
    }

    function initExport() {
        if (!exportChatBtn) return;
        exportChatBtn.addEventListener(
            'click',
            () => {
                const messages =
                    messagesData[
                        activeDialogId
                    ] || [];

                if (!messages.length) {
                    showToast(
                        tr(
                            'no_export',
                            'No messages to export'
                        ),
                        'error'
                    );
                    return;
                }

                const dataStr =
                    'data:text/json;charset=utf-8,' +
                    encodeURIComponent(
                        JSON.stringify(
                            messages,
                            null,
                            2
                        )
                    );

                const anchor =
                    document.createElement('a');

                anchor.href = dataStr;

                anchor.download =
                    `chat_export_${activeDialogId}.json`;

                document.body.appendChild(
                    anchor
                );

                anchor.click();
                anchor.remove();

                showToast(
                    tr(
                        'export_success',
                        'Chat exported'
                    ),
                    'success'
                );
            }
        );
    }

    function renderNews() {
        if (!newsFeed) return;
        newsFeed.innerHTML = `
            <div class="news-item">
                <div class="title">
                    ${tr(
                        'news_title_1',
                        'Täzelikler'
                    )}
                </div>

                <div class="summary">
                    ${tr(
                        'news_summary_1',
                        'Sfera ulamynda täze mümkinçilikler girizildi.'
                    )}
                </div>
            </div>
        `;
    }

    function initGlobalClicks() {
        document.addEventListener(
            'click',
            event => {
                if (
                    emojiPicker &&
                    !emojiPicker.contains(event.target) &&
                    event.target !== emojiBtn
                ) {
                    emojiPicker.classList.remove('active');
                }

                if (
                    tabsDropdown &&
                    !tabsDropdown.contains(event.target)
                ) {
                    tabsDropdown.classList.remove('show');
                }
            }
        );
    }

    function initMessaging() {
        if (sendBtn) {
            sendBtn.addEventListener(
                'click',
                () =>
                    sendMessage(
                        messageInput ? messageInput.value : ''
                    )
            );
        }

        if (messageInput) {
            messageInput.addEventListener(
                'keypress',
                event => {
                    if (
                        event.key === 'Enter' &&
                        !event.shiftKey
                    ) {
                        event.preventDefault();

                        sendMessage(
                            messageInput.value
                        );
                    }
                }
            );
        }
    }

    async function init() {
        if (
            !window.api ||
            !window.api.isAuthenticated()
        ) {
            return;
        }

        try {
            currentUser =
                await window.api.getCurrentUser();

            if (!currentUser) {
                return;
            }

            const usernameEl = document.getElementById('username');
            if (usernameEl) {
                usernameEl.textContent =
                    getUserName(currentUser) ||
                    currentUser.email ||
                    'User';
            }

            if (langBtn) {
                langBtn.textContent = currentLang.toUpperCase();
            }

            initEmojiPicker();
            initLanguage();
            initTheme();
            initTabs();
            initSearch();
            initGroups();
            initCalls();
            initFileButton();
            initExport();
            initGlobalClicks();
            initMessaging();

            await loadDialogs();

            connectRealtime();

            if (
                typeof window.applyLanguage ===
                'function'
            ) {
                window.applyLanguage();
            }

        } catch (error) {
            console.error(
                'SFERA Messenger initialization:',
                error
            );

            showToast(
                error.message ||
                'Messenger initialization failed',
                'error'
            );
        }
    }

    window.sferaMessenger = {
        reload: loadDialogs,
        selectDialog,
        sendMessage
    };

    init();

})();