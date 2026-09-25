/**
 * Sfera Core WebSocket & WebRTC Client
 * Синхронизирован с sockets/index.js и serverSocket.js
 */

class SocketService {
    constructor() {
        this.socket = null;
        this.init();
    }

    init() {
        const token = localStorage.getItem('sfera_token');
        if (!token) return;

        // Подключаемся к тому же хосту, с которого открыта страница
        const socketUrl = window.location.origin;

        this.socket = io(socketUrl, {
            auth: { token },
            transports: ['websocket', 'polling']
        });

        this.socket.on('connect', () => {
            console.log('🟢 WebSocket соединён:', this.socket.id);
            
            const user = window.api ? window.api.getCurrentUser() : null;
            if (user && (user._id || user.id)) {
                const userId = user._id || user.id;
                this.socket.emit('register_user', userId);
            }
        });

        this.socket.on('connect_error', (err) => {
            console.error('❌ Ошибка WebSocket соединения:', err.message);
        });

        // ==========================================
        // ЛОГИКА СООБЩЕНИЙ И СТАТУСОВ
        // ==========================================

        // Новое сообщение из sockets/index.js
        this.socket.on('new_message', (message) => {
            if (typeof window.onNewMessageReceived === 'function') {
                window.onNewMessageReceived(message);
            }
        });

        // Сообщение из serverSocket.js
        this.socket.on('receive_message', (message) => {
            if (typeof window.onNewMessageReceived === 'function') {
                window.onNewMessageReceived(message);
            }
        });

        // Смена онлайн-статуса пользователя
        this.socket.on('user_status_change', (data) => {
            if (typeof window.onUserStatusChanged === 'function') {
                window.onUserStatusChanged(data);
            }
        });

        // ==========================================
        // WEBRTC SIGNALING (ЗВОНКИ)
        // ==========================================

        this.socket.on('incoming_call', (data) => {
            if (typeof window.onIncomingCall === 'function') {
                window.onIncomingCall(data);
            }
        });

        this.socket.on('call_accepted', (signal) => {
            if (typeof window.onCallAccepted === 'function') {
                window.onCallAccepted(signal);
            }
        });

        this.socket.on('ice_candidate', (data) => {
            if (typeof window.onIceCandidateReceived === 'function') {
                window.onIceCandidateReceived(data);
            }
        });

        this.socket.on('call_ended', () => {
            if (typeof window.onCallEnded === 'function') {
                window.onCallEnded();
            }
        });
    }

    /**
     * Отправка чат-сообщения
     */
    sendMessage(recipientId, text, attachments = []) {
        if (!this.socket || !this.socket.connected) {
            console.error('WebSocket не подключён');
            return;
        }
        this.socket.emit('send_message', {
            to: recipientId,
            recipientId: recipientId,
            text,
            attachments
        });
    }

    /**
     * Инициация WebRTC звонка
     */
    callUser(userToCall, signalData, isVideo = true) {
        if (!this.socket) return;
        const currentUser = window.api ? window.api.getCurrentUser() : null;
        this.socket.emit('call_user', {
            userToCall,
            signalData,
            from: currentUser ? (currentUser._id || currentUser.id) : null,
            isVideo
        });
    }

    /**
     * Ответ на вызов
     */
    answerCall(to, signal) {
        if (!this.socket) return;
        this.socket.emit('answer_call', { to, signal });
    }

    /**
     * Передача ICE кандидатов
     */
    sendIceCandidate(to, candidate) {
        if (!this.socket) return;
        this.socket.emit('ice_candidate', { to, candidate });
    }

    /**
     * Завершение вызова
     */
    endCall(to) {
        if (!this.socket) return;
        this.socket.emit('end_call', { to });
    }
}

window.socketService = new SocketService();
