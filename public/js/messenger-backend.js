/**
 * SFERA Messenger — Backend Integration (Fixed)
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

    const emojis = ['😀','😂','😍','😊','😎','👍','👏','🙏','❤️','🔥','🎉','😄','😁','🤣','😅','😉','🙂','🙃','😌','🤔','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','🥱','😴','😌','🤓','🧐','😕','😟','🙁','☹️','😲','🥳','🤩','😇','🤗','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😮‍💨','🤤','😋','😛','😜','🤪','🤨','🫡','🤠','🥰','😘','😗','😙','😚','😋','😎'];

    // SFERA-PATCH:MSG-SPRINT1 — единый источник fixed-диалогов
    const FIXED_DIALOGS = [
        { id: 'ai_assistant', name: 'Sfera AI Kömekçi', lastMsg: 'Salam! Size nähili kömek edip bilerin?', time: 'Häzir', unread: 0, isAI: true, type: 'assistant' }
    ];

    // SFERA-PATCH:MSG-SPRINT1 — data-url'ы файлов вне DOM-атрибутов
    const fileStore = new Map();

    function isLocalDialog(id) {
        const s = String(id || '');
        return false;
    }

    function downloadFromStore(fileId) {
        const entry = fileStore.get(fileId);
        if (!entry) return;
        const a = document.createElement('a');
        a.href = entry.url;
        a.download = entry.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    function getDict() {
        return (window.translations && window.translations[currentLang]) ? window.translations[currentLang] : {};
    }

    function tr(key, fallback = '') {
        return getDict()[key] || fallback || key;
    }

    function isAdmin() {
        try {
            const lsUser = JSON.parse(localStorage.getItem('user') || '{}');
            if (lsUser && lsUser.role === 'admin') return true;
        } catch (_) {}
        const u = currentUser && (currentUser.user || currentUser);
        return Boolean(u && u.role === 'admin');
    }

    function getUserId(user) {
        if (!user) return null;
        return String(user._id || user.id || user.userId || '');
    }

    function getUserName(user) {
        if (!user) return tr('user', 'User');
        return user.username || user.name || user.fullName || user.email || tr('user', 'User');
    }

    function normalizeDialog(dialog) {
        const user = dialog?.user || dialog?.partner || dialog;
        const id = dialog?.id || dialog?._id || getUserId(user);
        if (!id) return null;

        return {
            id: String(id),
            name: getUserName(user),
            avatar: user?.avatar || dialog?.avatar || '',
            lastMsg: dialog?.lastMessage?.text || dialog?.lastMsg || '',
            time: formatTime(dialog?.lastMessage?.createdAt || dialog?.time || dialog?.updatedAt),
            unread: Number(dialog?.unread || dialog?.unreadCount || 0),
            online: Boolean(dialog?.online || user?.online),
            isGroup: Boolean(dialog?.isGroup || user?.isGroup),
            role: String(dialog?.role || user?.role || 'user'),
            creator: String(dialog?.creator || user?.creator || ''),
            creator: dialog?.creator || user?.creator || null
        };
    }

    function normalizeMessage(message) {
        const from = message?.from || message?.sender || {};
        const fromId = getUserId(from);
        const isSent = currentUser && fromId === getUserId(currentUser);

        return {
            id: message?._id || message?.id || `msg_${Date.now()}_${Math.random()}`,
            sender: getUserName(from),
            senderId: fromId,
            text: message?.text || '',
            time: formatTime(message?.createdAt || message?.time),
            type: isSent ? 'sent' : 'received',
            read: Boolean(message?.read),
            isHtml: Boolean(message?.isHtml),
            raw: message
        };
    }

    function formatTime(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function showToast(msg, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    async function loadDialogs() {
        try {
            if (!window.api) return;
            const response = await window.api.get('/chat/dialogs');
            const raw = Array.isArray(response) ? response : (response?.dialogs || response?.data || []);

            // Сохраняем локальные группы (group_*) при обновлении списка
            const localGroups = dialogsData.filter(d => String(d.id).startsWith('group_'));
            const serverDialogs = raw.map(normalizeDialog).filter(Boolean);
            const fixedIds = new Set(FIXED_DIALOGS.map(d => d.id));
            
            dialogsData = [
                ...FIXED_DIALOGS,
                ...localGroups,
                ...serverDialogs.filter(d => !fixedIds.has(d.id) && !localGroups.some(g => g.id === d.id))
            ];

            renderDialogs();

            if (activeDialogId && dialogsData.some(d => d.id === activeDialogId)) {
                await loadMessages(activeDialogId, false);
            }
        } catch (error) {
            console.error('SFERA Messenger dialogs:', error);
            dialogsData = [...FIXED_DIALOGS];
            renderDialogs();
            showToast(error.message || tr('connection_error', 'Messenger connection error'), 'error');
        }
    }

    async function loadMessages(userId, markRead = true) {
        if (!userId) return;
        try {
            if (userId === 'ai_assistant') {
                try {
                    const hist = await window.api.get('/ai/history');
                    const rawMsgs = (hist && hist.messages) || [];
                    messagesData[userId] = rawMsgs.map((m, i) => ({
                        id: 'ai_' + i + '_' + (m.createdAt || Date.now()),
                        aiIndex: i,
                        sender: m.role === 'user' ? (currentUser?.username || 'Me') : 'Sfera AI Kömekçi',
                        senderId: null,
                        text: m.content,
                        time: formatTime(m.createdAt),
                        type: m.role === 'user' ? 'sent' : 'received',
                        read: true,
                        isHtml: false
                    }));
                } catch (e) {
                    console.error('AI history error:', e);
                    messagesData[userId] = [];
                }
                renderChat();
                return;
            }
            if (isLocalDialog(userId)) {
                if (!messagesData[userId]) messagesData[userId] = [];
                renderChat();
                return;
            }

            const response = await window.api.get(`/chat/${encodeURIComponent(userId)}`);
            const raw = Array.isArray(response) ? response : (response?.messages || response?.data || []);

            messagesData[userId] = raw.map(normalizeMessage);
            renderChat();

            if (markRead) {
                const unread = messagesData[userId].filter(m => m.type === 'received' && !m.read && m.id);
                for (const message of unread) {
                    try {
                        await window.api.put(`/chat/read/${encodeURIComponent(message.id)}`, {});
                    } catch (e) {
                        console.warn('Не удалось пометить прочитанным:', e.message);
                    }
                }
                const dialog = dialogsData.find(d => d.id === userId);
                if (dialog) { dialog.unread = 0; renderDialogs(); }
            }
        } catch (error) {
            console.error('SFERA Messenger history:', error);
            messagesData[userId] = [];
            renderChat();
            showToast(error.message || tr('connection_error', 'Unable to load messages'), 'error');
        }
    }

    async function sendMessage(text) {
        const value = String(text || '').trim();
        if (!activeDialogId || !value) return;

        if (!currentUser && window.api && window.api.getCurrentUser) {
            currentUser = await window.api.getCurrentUser();
        }

        if (activeDialogId === 'ai_assistant') {
            const userMsg = normalizeMessage({
                id: 'local_' + Date.now(),
                text: value,
                sender: currentUser,
                createdAt: new Date().toISOString()
            });

            if (!messagesData[activeDialogId]) messagesData[activeDialogId] = [];
            messagesData[activeDialogId].push(userMsg);

            if (messageInput) messageInput.value = '';
            renderChat();

            const typingEl = document.createElement('div');
            typingEl.className = 'message received';
            typingEl.id = 'aiTyping';
            typingEl.innerHTML = '<div class="msg-username">Sfera AI Kömekçi</div><div style="opacity:0.7">▍печатает...</div>';
            chatMessages.appendChild(typingEl);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            try {
                const lang = (typeof currentLang !== 'undefined' && currentLang) || 'ru';
                const resp = await window.api.post('/ai/chat', { message: value, lang });
                const reply = resp && resp.reply ? resp.reply : 'Нет ответа';
                const aiMsg = normalizeMessage({
                    id: 'ai_' + Date.now(),
                    text: reply,
                    sender: { username: 'Sfera AI Kömekçi' },
                    createdAt: new Date().toISOString()
                });
                messagesData[activeDialogId].push(aiMsg);
            } catch (err) {
                const errMsg = normalizeMessage({
                    id: 'err_' + Date.now(),
                    text: '⚠ Ошибка AI: ' + (err.message || 'попробуйте позже'),
                    sender: { username: 'Sfera AI Kömekçi' },
                    createdAt: new Date().toISOString()
                });
                messagesData[activeDialogId].push(errMsg);
            } finally {
                const t = document.getElementById('aiTyping');
                if (t) t.remove();
            }
            try { await loadMessages('ai_assistant', false); } catch (_) { renderChat(); }
            return;
        }

        if (isLocalDialog(activeDialogId)) {
            const userMsg = normalizeMessage({
                id: 'local_' + Date.now(),
                text: value,
                sender: currentUser,
                createdAt: new Date().toISOString()
            });
            if (!messagesData[activeDialogId]) messagesData[activeDialogId] = [];
            messagesData[activeDialogId].push(userMsg);
            const dialog = dialogsData.find(d => d.id === activeDialogId);
            if (dialog) { dialog.lastMsg = value; dialog.time = userMsg.time; }
            if (messageInput) messageInput.value = '';
            renderChat();
            renderDialogs();
            return;
        }

        if (sendBtn) sendBtn.disabled = true;

        try {   
            const response = await window.api.post('/chat/send', { to: activeDialogId, text: value });
            const message = response?.message || response?.data || response;

            if (message) {
                const normalized = normalizeMessage(message);
                if (!messagesData[activeDialogId]) messagesData[activeDialogId] = [];
                const exists = messagesData[activeDialogId].some(m => String(m.id) === String(normalized.id));
                if (!exists) messagesData[activeDialogId].push(normalized);
            }

            if (messageInput) messageInput.value = '';
            await loadDialogs();
            renderChat();

        } catch (error) {
            console.error('SFERA Messenger send:', error);
            showToast(error.message || tr('send_error', 'Message was not sent'), 'error');
        } finally {
            if (sendBtn) sendBtn.disabled = false;
            if (messageInput) messageInput.focus();
        }
    }

    // УДАЛЕНА ОШИБОЧНАЯ ДУБЛИРУЮЩАЯ ФУНКЦИЯ sendMessage, КОТОРАЯ ЛОМАЛА ОТПРАВКУ

    function renderDialogs(listToRender = null) {
        if (!dialogsList) return;

        if (listToRender === null) {
            if (activeTab === 'assistant') {
                listToRender = dialogsData.filter(d => d.type === 'assistant' || d.isAI);
            } else if (activeTab === 'news') {
                listToRender = [];
            } else {
                listToRender = dialogsData.filter(d => d.type !== 'assistant' && !d.isAI);
            }
        }

        dialogsList.innerHTML = ''; 

        if (!listToRender.length) {
            dialogsList.innerHTML = `<div class="empty-state"><div class="icon">💬</div><p>${tr('no_chats', 'No conversations yet')}</p></div>`;
            return;
        }

        listToRender.sort((a, b) => {
            if (a.isGroup && !b.isGroup) return -1;
            if (!a.isGroup && b.isGroup) return 1;
            return 0;
        });

        listToRender.forEach(dialog => {
            const item = document.createElement('div');
            item.className = `dialog-item ${activeDialogId === dialog.id ? 'active' : ''}`;
            item.dataset.id = dialog.id;
            
            const avatar = dialog.avatar ? `<img src="${escapeHtml(dialog.avatar)}" alt="">` : escapeHtml(dialog.name.charAt(0));
            const adminBadge = dialog.role === 'admin' ? '<span class="admin-badge" title="Administrator">🛡</span>' : '';

            item.innerHTML = `
                <div class="dialog-avatar ${dialog.isGroup ? 'group' : ''}">
                    ${dialog.isGroup ? '👥' : avatar}
                    ${dialog.online ? '<div class="online-dot"></div>' : ''}
                </div>
                <div class="dialog-info">
                    <div class="name">${escapeHtml(dialog.name)}${adminBadge}</div>
                    <div class="last-msg">${sanitizePreview(dialog.lastMsg)}</div>
                </div>
                <div class="dialog-time">${escapeHtml(dialog.time)}</div>
                ${dialog.unread > 0 ? `<div class="unread-badge">${dialog.unread}</div>` : ''}
            `;

            item.addEventListener('click', () => selectDialog(dialog.id));
            dialogsList.appendChild(item);
        });
    }

    async function selectDialog(id) {
        activeDialogId = String(id);
        window.activeDialogId = activeDialogId;
        if (socket && socket.connected) socket.emit('join_room', activeDialogId);
        renderDialogs();
        const dialog = dialogsData.find(d => d.id === activeDialogId);
        if (dialog) dialog.unread = 0;
        await loadMessages(activeDialogId, true);
    }

    
    function sanitizeLastMsg(msg) {
        if (!msg) return '';
        if (msg.includes('file-card') || msg.includes('<img')) return '📄 Файл';
        return msg.replace(/<[^>]*>?/gm, ''); // Удаляем любые HTML теги
    }

    function renderChat() {
        if (!activeDialogId || !chatMessages) return;
        const dialog = dialogsData.find(d => d.id === activeDialogId);
        if (!dialog) return;

        const chatName = document.getElementById('chatName');
        const chatAvatar = document.getElementById('chatAvatar');
        const chatStatus = document.getElementById('chatStatus');

        if (chatName) chatName.textContent = dialog.name;
        if (chatAvatar) chatAvatar.textContent = dialog.isGroup ? '👥' : dialog.name.charAt(0);
        if (chatStatus) chatStatus.textContent = dialog.online ? tr('online', 'Online') : tr('offline', 'Offline');

        // Кнопка удаления группы (только для создателя)
        const chatActionsEl = document.querySelector('.chat-actions');
        if (chatActionsEl) {
            const existingDel = document.getElementById('deleteGroupBtn');
            if (existingDel) existingDel.remove();
            const existingClear = document.getElementById('clearChatBtn');
            if (existingClear) existingClear.remove();
            if (activeDialogId) {
                const clearBtn = document.createElement('button');
                clearBtn.id = 'clearChatBtn';
                clearBtn.title = 'Очистить чат';
                clearBtn.style.cssText = 'background: rgba(255,165,0,0.15); border-color: rgba(255,165,0,0.4); color: #ffa500;';
                clearBtn.textContent = '🧹';
                clearBtn.addEventListener('click', clearCurrentChat);
                chatActionsEl.appendChild(clearBtn);
            }
            const existingEsc = document.getElementById('escalateAiBtn');
            if (existingEsc) existingEsc.remove();
            if (activeDialogId === 'ai_assistant' && !isAdmin()) {
                const escBtn = document.createElement('button');
                escBtn.id = 'escalateAiBtn';
                escBtn.title = 'Позвать администратора';
                escBtn.style.cssText = 'background: rgba(255,77,77,0.15); border-color: rgba(255,77,77,0.4); color: #ff6b6b;';
                escBtn.textContent = '🆘';
                escBtn.addEventListener('click', escalateToAdmin);
                chatActionsEl.appendChild(escBtn);
            }
            const isCreator = dialog.isGroup && dialog.creator && String(dialog.creator) === String(getUserId(currentUser));
            if (isCreator) {
                const delBtn = document.createElement('button');
                delBtn.id = 'deleteGroupBtn';
                delBtn.title = 'Удалить группу';
                delBtn.style.cssText = 'background: rgba(255,77,77,0.15); border-color: rgba(255,77,77,0.4); color: #ff6b6b;';
                delBtn.textContent = '🗑';
                delBtn.addEventListener('click', deleteCurrentGroup);
                chatActionsEl.appendChild(delBtn);
            }
        }

        chatMessages.innerHTML = '';
        const messages = messagesData[activeDialogId] || [];

        if (!messages.length) {
            chatMessages.innerHTML = `<div class="empty-state"><div class="icon">💬</div><p>${tr('no_messages', 'No messages yet')}</p></div>`;
            return;
        }

        messages.forEach(message => {
            const msgEl = document.createElement('div');
            msgEl.className = `message ${message.type}`;
            
            const isFileCard = message.text && (String(message.text).includes('file-card') || String(message.text).includes('<img src="/api/upload/'));
            if (message.isHtml || isFileCard) {
                msgEl.innerHTML = message.text;
                
                // SFERA-ARCH-FIX: Автоматически исправляем старые кривые ссылки на файлы
                msgEl.querySelectorAll('a.btn-download-file').forEach(a => {
                    let href = a.getAttribute('href');
                    if (href && !href.startsWith('http') && !href.includes('/api/upload/')) {
                        let filename = href.split('/').pop();
                        a.setAttribute('href', '/api/upload/' + filename);
                    }
                });
            } else {
                msgEl.innerHTML = `
                    ${message.type === 'received' && dialog.isGroup ? `<div class="msg-username">${escapeHtml(message.sender)}</div>` : ''}
                    <div>${escapeHtml(message.text)}</div>
                    <div class="msg-time">${escapeHtml(message.time)}</div>
                `;
            }
            const delBtn = document.createElement('span');
            delBtn.className = 'msg-del-btn';
            delBtn.title = 'Удалить';
            delBtn.textContent = '🗑';
            delBtn.addEventListener('click', (e) => { e.stopPropagation(); handleDeleteMessage(message); });
            msgEl.appendChild(delBtn);

            chatMessages.appendChild(msgEl);
        });

        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function sanitizePreview(msg) {
            if (!msg) return '';
            if (msg.includes('file-card') || msg.includes('<img')) return '📄 Файл';
            return String(msg).replace(/<[^>]*>?/gm, '');
        }

    function escapeHtml(value) {
        return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    async function deleteCurrentGroup() {
        const dialog = dialogsData.find(d => String(d.id) === String(activeDialogId));
        if (!dialog || !dialog.isGroup) return;

        const modal = document.getElementById('deleteGroupModal');
        const cancelBtn = document.getElementById('cancelDeleteGroupBtn');
        const confirmBtn = document.getElementById('confirmDeleteGroupBtn');
        if (!modal) return;

        modal.classList.add('active');
        
        const closeModal = () => {
            modal.classList.remove('active');
            cancelBtn.removeEventListener('click', closeModal);
            confirmBtn.removeEventListener('click', executeDelete);
        };

        const executeDelete = async () => {
            closeModal();
            try {
                const token = (window.api && window.api.getToken) ? window.api.getToken() : localStorage.getItem('token');
                const res = await fetch('/api/chat/groups/' + activeDialogId, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.message || 'Ошибка удаления');
                }
                dialogsData = dialogsData.filter(d => String(d.id) !== String(activeDialogId));
                delete messagesData[activeDialogId];
                activeDialogId = null;
                renderDialogs();
                const cm = document.getElementById('chatMessages');
                if (cm) cm.innerHTML = '';
                showToast('Группа удалена', 'success');
            } catch (err) {
                showToast(err.message || 'Не удалось удалить группу', 'error');
            }
        };

        cancelBtn.addEventListener('click', closeModal);
        confirmBtn.addEventListener('click', executeDelete);
    }

    function connectRealtime() {
        if (typeof window.io !== 'function') return;
        const token = window.api.getToken();
        if (!token) return;

        socket = window.io(window.location.origin, {
            auth: { token }, transports: ['websocket', 'polling'], upgrade: false, rememberUpgrade: true, withCredentials: true, reconnection: true, reconnectionAttempts: 20, reconnectionDelay: 1500, reconnectionDelayMax: 8000, timeout: 30000, pingTimeout: 60000, pingInterval: 25000
        });
        window.SferaSocket = socket;
        console.log('✅ SferaSocket exposed to window');

        socket.on('connect', () => {
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            heartbeatInterval = setInterval(() => { if (socket && socket.connected) socket.emit('heartbeat'); }, 45000);
        });

        socket.on('disconnect', () => {
            if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
        });

        socket.on('group_deleted', ({ groupId }) => {
            if (!groupId) return;
            dialogsData = dialogsData.filter(d => String(d.id) !== String(groupId));
            delete messagesData[groupId];
            if (String(activeDialogId) === String(groupId)) {
                activeDialogId = null;
                const cm = document.getElementById('chatMessages');
                if (cm) cm.innerHTML = '';
            }
            renderDialogs();
            showToast('Группа удалена', 'info');
        });

        socket.on('message_deleted', ({ messageId }) => {
            if (!messageId) return;
            Object.keys(messagesData).forEach(key => {
                messagesData[key] = (messagesData[key] || []).filter(m => String(m.id) !== String(messageId));
            });
            renderChat();
        });

        socket.on('dialog_cleared', ({ userId, byUser }) => {
            const target = String(userId) === String(getUserId(currentUser)) ? String(byUser) : String(userId);
            if (messagesData[target]) messagesData[target] = [];
            if (String(activeDialogId) === target) renderChat();
        });

        socket.on('new_message', async message => {
            if (!message) return;
            const normalized = normalizeMessage(message);
            const rawFrom = message.from || message.sender;
            const rawTo = message.to || message.recipient;
            const fromId = String(rawFrom?._id || rawFrom?.id || rawFrom || '');
            const toId = String(rawTo?._id || rawTo?.id || rawTo || '');
            const myId = String(getUserId(currentUser) || '');
            const isGroupMsg = Boolean(rawTo && (rawTo.isGroup || rawTo.name));
            const partnerId = isGroupMsg ? toId : ((fromId === myId) ? toId : fromId);
            if (!partnerId) return;
            const key = String(partnerId);

            if (!messagesData[key]) messagesData[key] = [];
            const exists = messagesData[key].some(m => String(m.id) === String(normalized.id));
            if (!exists) messagesData[key].push(normalized);

            if (String(activeDialogId) === key) {
                renderChat();
                if (normalized.type === 'received' && normalized.id) {
                    await window.api.put(`/chat/read/${encodeURIComponent(normalized.id)}`, {});
                }
            } else {
                const dialog = dialogsData.find(d => String(d.id) === key);
                if (dialog) {
                    dialog.lastMsg = normalized.text || '';
                    dialog.time = normalized.time || dialog.time;
                    if (normalized.type === 'received') dialog.unread = Number(dialog.unread || 0) + 1;
                }
            }
            renderDialogs();
        });
    }

    function initEmojiPicker() {
        if (!emojiBtn || !emojiPicker || !emojiGrid) return;
        emojiGrid.innerHTML = '';
        emojis.forEach(emoji => {
            const btn = document.createElement('span');
            btn.textContent = emoji;
            btn.addEventListener('click', () => {
                if (messageInput) messageInput.value += emoji;
                emojiPicker.classList.remove('active');
                if (messageInput) messageInput.focus();
            });
            emojiGrid.appendChild(btn);
        });

        emojiBtn.addEventListener('click', event => {
            event.stopPropagation();
            emojiPicker.classList.toggle('active');
        });
    }

    function initTabs() {
        // ИСПРАВЛЕНИЕ: Добавляем открытие выпадающего меню по клику на кнопку
        if (dropbtn) {
            dropbtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (tabsDropdown) tabsDropdown.classList.toggle('show');
            });
        }

        if (!dropdownContent) return;
        dropdownContent.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                dropdownContent.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeTab = btn.getAttribute('data-tab');

                const label = document.getElementById('currentTabLabel');
                if (label) label.textContent = btn.textContent;

                if (tabsDropdown) tabsDropdown.classList.remove('show');

                if (activeTab === 'chats') {
                    if (dialogsList) dialogsList.style.display = 'block';
                    if (newsFeed) newsFeed.style.display = 'none';
                    const _cia = document.getElementById('chatInputArea');
                    if (_cia) _cia.style.display = 'flex';
                    renderDialogs();
                    if (activeDialogId === 'ai_assistant') {
                        const firstChat = dialogsData.find(d => !d.isAI);
                        if (firstChat) {
                            selectDialog(firstChat.id);
                        } else {
                            activeDialogId = null;
                            if (chatMessages) chatMessages.innerHTML = '<div class="empty-state"><div class="icon">💬</div><p>Выберите чат</p></div>';
                        }
                    }
                } else if (activeTab === 'news') {
                    if (dialogsList) dialogsList.style.display = 'none';
                    if (newsFeed) newsFeed.style.display = 'block';
                } else if (activeTab === 'assistant') {
                    if (dialogsList) dialogsList.style.display = 'block';
                    if (newsFeed) newsFeed.style.display = 'none';
                    const _cia2 = document.getElementById('chatInputArea');
                    if (_cia2) _cia2.style.display = 'flex';
                    renderDialogs();
                    selectDialog('ai_assistant');
                }                        
            });
        });
    }

    function initSearch() {
        if (!searchInput) return;
        searchInput.addEventListener('input', event => {
            const query = event.target.value.toLowerCase().trim();
            if (!query) { renderDialogs(); return; }
            const filtered = dialogsData.filter(dialog => dialog.name.toLowerCase().includes(query));
            renderDialogs(filtered);
            if (!filtered.length && dialogsList) {
                dialogsList.innerHTML = `<div class="empty-state"><div class="icon">🔍</div><p>${tr('user_not_found', 'User not found')}</p></div>`;
            }
        });
    }

    function initGroups() {
        if (createGroupBtn) {
            createGroupBtn.addEventListener('click', () => {
                if (groupModal) groupModal.classList.add('active');
            });
        }
        if (cancelGroupBtn && groupModal) {
            cancelGroupBtn.addEventListener('click', () => groupModal.classList.remove('active'));
        }
        if (groupForm) {
            groupForm.addEventListener('submit', async event => {
                event.preventDefault();
                const name = document.getElementById('groupName').value.trim();
                if (name) {
                    try {
                        const res = await window.api.post('/chat/groups', { name });
                        if (groupModal) groupModal.classList.remove('active');
                        document.getElementById('groupName').value = '';
                        await loadDialogs();
                        selectDialog(res._id || res.id);
                    } catch (err) {
                        showToast(err.message || 'Ошибка создания группы', 'error');
                    }
                }
            });
        }
    }

    function initCalls() {
        function startCall(type) {
            const dialog = dialogsData.find(d => d.id === activeDialogId);
            if (!dialog) { showToast(tr('select_chat', 'Select a chat first'), 'error'); return; }
            if (callTargetName) callTargetName.textContent = dialog.name;
            if (callStatusText) callStatusText.textContent = type === 'audio' ? tr('audio_call', 'Audio call...') : tr('video_call', 'Video call...');
            if (callModal) callModal.classList.add('active');
        }
        
        
        
    }

    // ИСПРАВЛЕНИЕ: Функция загрузки файлов
    function initFileButton() {
        if (fileBtn && fileInput) {
            fileBtn.addEventListener('click', () => fileInput.click());
        }

        if (fileInput) {
            fileInput.addEventListener('change', async (event) => {
                const file = event.target.files[0];
                if (!file) return;

                const time = formatTime(new Date().toISOString());
                const safeName = escapeHtml(file.name);
                const safeSize = (file.size / 1024).toFixed(1);
                const tempId = 'temp_' + Date.now();

                // Показываем локальный статус загрузки
                if (!messagesData[activeDialogId]) messagesData[activeDialogId] = [];
                messagesData[activeDialogId].push({
                    id: tempId,
                    sender: currentUser?.username || 'Me',
                    text: `<div class="file-card"><span>⏳ Загрузка ${safeName}...</span></div><div class="msg-time">${time}</div>`,
                    time: time,
                    type: 'sent',
                    isHtml: true
                });
                renderChat();

                const formData = new FormData();
                formData.append('file', file);
                const token = localStorage.getItem('token') || localStorage.getItem('sfera_token');

                try {
                    const response = await fetch('/api/upload', {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + token },
                        body: formData
                    });

                    if (!response.ok) throw new Error('Upload failed');
                    const data = await response.json();
                    
                    // Удаляем статус загрузки и обновляем экран
                    messagesData[activeDialogId] = messagesData[activeDialogId].filter(m => m.id !== tempId);
                    renderChat();

                    // Формируем HTML для файла (ссылка на сервер)
                    const isImage = file.type.startsWith('image/');
                    let htmlContent = '';

                    if (isImage) {
                        // Картинки рендерим прямо в ленте
                        htmlContent = `
                            <div class="file-card" style="padding: 5px; background: transparent; border: none;">
                                <img src="/api/upload/${data.filename}" class="chat-image" alt="${safeName}">
                            </div>
                            <div class="msg-time">${time}</div>
                        `;
                    } else {
                        // Остальные файлы даем скачать напрямую
                        htmlContent = `
                            <div class="file-card">
                                <div class="file-info">
                                    <strong>📄 ${safeName}</strong>
                                    <span style="font-size: 11px; opacity: 0.7;">(${safeSize} KB)</span>
                                </div>
                                <a href="/api/upload/${data.filename}" download="${safeName}" class="btn-download-file" style="text-decoration:none;">Скачать 💾</a>
                            </div>
                            <div class="msg-time">${time}</div>
                        `;
                    }

                    // Отправляем через сокет, чтобы получатель увидел
                    if (window.SferaSocket && activeDialogId) {
                        window.SferaSocket.emit('send_message', {
                            to: activeDialogId,
                            text: htmlContent,
                            attachments: [data.url]
                        });
                    } else {
                        // Фолбэк, если сокет не подключен
                        messagesData[activeDialogId].push({
                            id: 'msg_' + Date.now(),
                            sender: currentUser?.username || 'Me',
                            text: htmlContent,
                            time: time,
                            type: 'sent',
                            isHtml: true
                        });
                        renderChat();
                    }
                } catch (err) {
                    console.error('File upload error:', err);
                    messagesData[activeDialogId] = messagesData[activeDialogId].filter(m => m.id !== tempId);
                    messagesData[activeDialogId].push({
                        id: 'msg_' + Date.now(),
                        sender: currentUser?.username || 'Me',
                        text: `<div style="color:#ff4d4d;">❌ Ошибка загрузки файла</div>`,
                        time: time,
                        type: 'sent',
                        isHtml: true
                    });
                    renderChat();
                } finally {
                    event.target.value = '';
                }
            });
        }

        if (chatMessages) {
            chatMessages.addEventListener('click', function (evt) {
                const btn = evt.target.closest('.btn-download-file');
                if (!btn) return;
                const fid = btn.getAttribute('data-file-id');
                if (fid) downloadFromStore(fid);
            });
        }
    }

    window.downloadFileFromPC = function(dataUrl, fileName) {
        const a = document.createElement('a');
        a.href = dataUrl; a.download = fileName;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    function initExport() {
        if (!exportChatBtn) return;
        exportChatBtn.addEventListener('click', () => {
            const messages = messagesData[activeDialogId] || [];
            if (!messages.length) { showToast(tr('no_export', 'No messages to export'), 'error'); return; }
            const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(messages, null, 2));
            const anchor = document.createElement('a');
            anchor.href = dataStr; anchor.download = `chat_export_${activeDialogId}.json`;
            document.body.appendChild(anchor); anchor.click(); anchor.remove();
            showToast(tr('export_success', 'Chat exported'), 'success');
        });
    }

    function initGlobalClicks() {
        document.addEventListener('click', event => {
            if (emojiPicker && !emojiPicker.contains(event.target) && event.target !== emojiBtn) {
                emojiPicker.classList.remove('active');
            }
            if (tabsDropdown && !tabsDropdown.contains(event.target)) {
                tabsDropdown.classList.remove('show');
            }
        });
    }

    function initMessaging() {
        if (sendBtn) {
            sendBtn.addEventListener('click', () => sendMessage(messageInput ? messageInput.value : ''));
        }
        if (messageInput) {
            messageInput.addEventListener('keypress', event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage(messageInput.value);
                }
            });
        }
    }

    async function init() {
        if (!window.api) {
            showToast('API-клиент не загружен', 'error');
            return;
        }
        if (!window.api.isAuthenticated()) {
            showToast('Требуется авторизация…', 'error');
            setTimeout(() => { window.location.href = 'login.html'; }, 1200);
            return;
        }

        try {
            currentUser = await window.api.getCurrentUser();
            if (!currentUser) return;

            const usernameEl = document.getElementById('username');
            if (usernameEl) usernameEl.textContent = getUserName(currentUser) || currentUser.email || 'User';

            initEmojiPicker();
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

        } catch (error) {
            console.error('SFERA Messenger initialization:', error);
            showToast(error.message || 'Messenger initialization failed', 'error');
        }
    }

    // ИСПРАВЛЕНИЕ: Слушаем смену языка от auto_translate_i18n.js
    window.addEventListener('sfera:languageChanged', (e) => {
        currentLang = e.detail.lang;
        renderDialogs();
        renderChat();
    });

    function sferaConfirm(title, message, confirmText) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'group-modal active';
            overlay.style.zIndex = '9999';
            overlay.innerHTML = `
                <div class="modal-box" style="border-color: rgba(255, 77, 77, 0.4); max-width: 400px;">
                    <h2 style="color: #ff6b6b; margin-bottom: 8px;">${escapeHtml(title)}</h2>
                    <p style="color: var(--text-muted); margin-bottom: 24px; font-size: 15px;">${escapeHtml(message)}</p>
                    <div class="form-actions" style="display: flex; gap: 12px; justify-content: center;">
                        <button type="button" class="btn-glass cancel-btn">Отмена</button>
                        <button type="button" class="btn-neon-danger confirm-btn">${confirmText || "Удалить"}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const close = (val) => { overlay.remove(); resolve(val); };
            overlay.querySelector('.cancel-btn').addEventListener('click', () => close(false));
            overlay.querySelector('.confirm-btn').addEventListener('click', () => close(true));
            
            // Закрытие по клику на фон
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
        });
    }

    async function handleDeleteMessage(message) {
        if (!activeDialogId) return;
        const isAi = activeDialogId === 'ai_assistant' || (message.id && String(message.id).startsWith('ai_'));
        if (isAi) {
            if (message.aiIndex === undefined || message.aiIndex === null) {
                return showToast('Невозможно удалить это сообщение', 'error');
            }
            if (!(await sferaConfirm('Удалить сообщение?', 'Оно исчезнет из вашей истории с AI.'))) return;
            try {
                await window.api.delete('/ai/message/' + message.aiIndex);
                await loadMessages('ai_assistant', false);
            } catch (e) { showToast('Ошибка удаления: ' + (e.message || ''), 'error'); }
        } else {
            if (!(await sferaConfirm('Удалить сообщение у всех?', 'Оно исчезнет у вас и у вашего собеседника.'))) return;
            try {
                await window.api.delete('/chat/message/' + message.id);
                messagesData[activeDialogId] = (messagesData[activeDialogId] || []).filter(m => String(m.id) !== String(message.id));
                renderChat();
            } catch (e) { showToast('Ошибка удаления: ' + (e.message || ''), 'error'); }
        }
    }

    async function clearCurrentChat() {
        if (!activeDialogId) return;
        const dialog = dialogsData.find(d => d.id === activeDialogId);
        const isAi = activeDialogId === 'ai_assistant';
        const label = isAi ? 'всю историю с AI' : 'всю переписку с ' + (dialog ? dialog.name : 'пользователем');
        if (!(await sferaConfirm('Очистить чат?', 'Вся переписка (' + label + ') будет удалена безвозвратно.'))) return;
        try {
            if (isAi) {
                await window.api.post('/ai/clear', {});
            } else {
                await window.api.delete('/chat/dialog/' + activeDialogId);
            }
            messagesData[activeDialogId] = [];
            renderChat();
            showToast('Чат очищен', 'success');
        } catch (e) { showToast('Ошибка: ' + (e.message || ''), 'error'); }
    }

    async function escalateToAdmin() {
        if (!(await sferaConfirm('Передать администратору?', 'Ваш диалог с AI будет отправлен администратору для помощи.', 'Вызвать'))) return;
        try {
            showToast('Вызов администратора...', 'info');
            const res = await window.api.post('/ai/escalate', {});
            if (res && res.success && res.adminId) {
                showToast('Админ уведомлён', 'success');
                await loadDialogs();
                selectDialog(res.adminId);
            } else {
                throw new Error('Не удалось вызвать админа');
            }
        } catch (e) {
            showToast('Ошибка: ' + (e.message || 'Связь с админом недоступна'), 'error');
        }
    }

    window.sferaMessenger = {
        reload: loadDialogs,
        selectDialog,
        sendMessage
    };

    document.addEventListener('DOMContentLoaded', init);


    
    

    


    // === SFERA-PATCH: CLEAN NEWS LOGIC ===
    async function loadNewsRoom() {
        const chatMessages = document.getElementById('chatMessages');
        const chatInput = document.getElementById('chatInputArea');
        const chatHeader = document.getElementById('chatHeader');
        
        if (!chatMessages || !chatInput) return;
        
        // Шапка: обновляем точечно, иначе сносим .chat-actions (кнопки звонков 📞📹)
        const _ca = document.getElementById('chatAvatar');
        const _cn = document.getElementById('chatName');
        const _cs = document.getElementById('chatStatus');
        if (_ca) { _ca.textContent = '📰'; _ca.style.background = 'var(--primary)'; _ca.style.color = '#000'; }
        if (_cn) _cn.textContent = 'Новости';
        if (_cs) _cs.textContent = 'Мировые и Туркменские';
        chatInput.style.display = 'none';
        
        chatMessages.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100%; color:#fff;" data-i18n="news_loading">Загрузка новостей...</div>';
        
        // Мгновенно переводим то, что вставили
        if (window.SFERA_I18N) window.SFERA_I18N.setLanguage(window.SFERA_I18N.getLanguage());
        
        try {
            const currentLang = localStorage.getItem('lang') || 'tm';
            const res = await fetch('/api/news/world?lang=' + currentLang, {
                headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('token') || localStorage.getItem('sfera_token')) }
            });
            const news = await res.json();
            
            if (!news || !news.length) {
                chatMessages.innerHTML = '<div style="padding:20px; color:#fff;">Новости не найдены.</div>';
                return;
            }

            // Определяем локаль для правильного формата даты
            let locale = 'tk-TM';
            if (currentLang === 'ru') locale = 'ru-RU';
            if (currentLang === 'en') locale = 'en-US';

            let html = '';
            news.forEach((item) => {
                const date = new Date(item.date).toLocaleString(locale, { hour: '2-digit', minute:'2-digit', day:'numeric', month:'short' });
                const textContent = item.content || 'Текст новости доступен по ссылке.';
                
                // Ссылка "Читать оригинал" получает data-i18n="news_read_orig"
                html += `
                    <div class="message received" style="max-width: 90%; margin-bottom: 16px; padding: 16px 20px;">
                        <div style="font-size: 11px; color: var(--primary); font-weight: 700; margin-bottom: 8px; text-transform: uppercase;">${item.source}</div>
                        <div style="font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 8px; line-height: 1.3;">${item.title}</div>
                        <div style="font-size: 14px; color: var(--text); line-height: 1.5; margin-bottom: 12px;">${textContent}</div>
                        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; font-size: 12px;">
                            <span style="color: var(--text-muted);">${date}</span>
                            <a href="${item.link}" target="_blank" style="color: var(--primary); text-decoration: none; font-weight: 600;" data-i18n="news_read_orig">🔗 Читать оригинал</a>
                        </div>
                    </div>
                `;
            });
            
            chatMessages.innerHTML = html;
            chatMessages.scrollTop = 0;

            // Принудительный перевод после рендера (чтобы работало без F5)
            if (window.SFERA_I18N) window.SFERA_I18N.setLanguage(window.SFERA_I18N.getLanguage());

        } catch (e) {
            chatMessages.innerHTML = '<div style="padding:20px; color:#ff4d4d;">Ошибка загрузки: ' + e.message + '</div>';
        }
    }

    

    const tabNewsBtn = document.getElementById('lblTabNews');
    if (tabNewsBtn) {
        tabNewsBtn.addEventListener('click', () => setTimeout(loadNewsRoom, 50));
    }
    
    
    // === END SFERA-PATCH ===

})();


if (typeof socket !== 'undefined') {
    
    
}
