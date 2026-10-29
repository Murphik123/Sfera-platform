(function() {
    'use strict';

    let pc = null;
    let localStream = null;
    let peerId = null;
    let isVideoCall = false;
    let callState = 'idle'; // idle, calling, ringing, connecting, connected, error
    let timerInterval = null;
    let timerSeconds = 0;
    let pendingCandidates = [];

    const $ = (id) => document.getElementById(id);
    const modal = $('callModal');
    const targetName = $('callTargetName');
    const statusText = $('callStatusText');
    const timerEl = $('callTimer');
    const videosBox = $('callVideos');
    const localVideo = $('localVideo');
    const remoteVideo = $('remoteVideo');
    const endBtn = $('endCallBtn');
    const acceptBtn = $('acceptCallBtn');
    const muteBtn = $('muteBtn');

    function tr(key, fallback) {
        return window.SFERA_I18N?.t(key) || fallback;
    }

    function updateUI(state, text = '') {
        callState = state;
        if (!modal) return;

        // Сброс базовых стилей
        statusText.style.color = 'var(--accent)';
        if (acceptBtn) acceptBtn.style.display = 'none';
        if (muteBtn) muteBtn.style.display = 'none';
        
        if (state === 'idle') {
            modal.classList.remove('active');
            if (timerEl) timerEl.style.display = 'none';
            if (videosBox) videosBox.style.display = 'none';
            return;
        }

        modal.classList.add('active');

        if (state === 'calling') {
            targetName.textContent = text || tr('call_calling', 'Звонок...');
            statusText.textContent = tr('call_connecting', 'Соединение...');
        } 
        else if (state === 'ringing') {
            targetName.textContent = text || tr('call_incoming', 'Входящий звонок...');
            statusText.textContent = isVideoCall ? '📹 ' + tr('call_video', 'Видеозвонок') : '📞 ' + tr('call_audio', 'Аудиозвонок');
            if (acceptBtn) acceptBtn.style.display = 'block';
        } 
        else if (state === 'connecting') {
            statusText.textContent = tr('call_connecting', 'Соединение...');
        } 
        else if (state === 'connected') {
            statusText.textContent = tr('call_connected', 'Соединено');
            if (timerEl) timerEl.style.display = 'block';
            if (muteBtn) muteBtn.style.display = 'block';
            startTimer();
        } 
        else if (state === 'error') {
            statusText.textContent = text || tr('call_error_conn', '❌ Ошибка подключения');
            statusText.style.color = '#ff4d4d';
            setTimeout(cleanup, 3000);
        }
    }

    function startTimer() {
        if (timerInterval) return;
        timerSeconds = 0;
        if (timerEl) timerEl.textContent = '00:00';
        timerInterval = setInterval(() => {
            timerSeconds++;
            const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
            const s = String(timerSeconds % 60).padStart(2, '0');
            if (timerEl) timerEl.textContent = m + ':' + s;
        }, 1000);
    }

    function cleanup() {
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
        if (pc) { pc.close(); pc = null; }
        if (localVideo) localVideo.srcObject = null;
        if (remoteVideo) remoteVideo.srcObject = null;
        pendingCandidates = [];
        updateUI('idle');
    }

    async function flushPendingCandidates() {
        if (!pc || !pc.remoteDescription) return;
        const list = pendingCandidates.splice(0);
        for (const c of list) {
            await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
    }

    async function getIceServers() {
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('sfera_token');
            const res = await fetch('/api/config/webrtc', { headers: { 'Authorization': 'Bearer ' + token } });
            const data = await res.json();
            return data.iceServers;
        } catch (e) {
            return [{ urls: 'stun:stun.l.google.com:19302' }];
        }
    }

    function setupPC() {
        pc = new RTCPeerConnection({ iceServers: [] }); // Заполним чуть позже

        pc.onicecandidate = (e) => {
            if (e.candidate && window.SferaSocket) {
                window.SferaSocket.emit('ice_candidate', { to: peerId, candidate: e.candidate });
            }
        };

        pc.ontrack = (e) => {
            if (remoteVideo) {
                remoteVideo.srcObject = e.streams[0];
                remoteVideo.play().catch(() => {});
            }
            updateUI('connected');
        };

        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
                updateUI('error', '❌ Связь потеряна');
            }
        };
    }

    async function startCall(target, video) {
        if (callState !== 'idle') return;
        peerId = target;
        isVideoCall = video;

        updateUI('calling');
        if (video && videosBox) videosBox.style.display = 'flex';

        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
            if (localVideo) localVideo.srcObject = localStream;

            setupPC();
            const ice = await getIceServers();
            pc.setConfiguration({ iceServers: ice });

            localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            if (window.SferaSocket) {
                window.SferaSocket.emit('call_user', { userToCall: peerId, signalData: offer, isVideo });
            }
            updateUI('connecting');
        } catch (e) {
            updateUI('error', e.name === 'NotAllowedError' ? '❌ Нет доступа к микрофону' : '❌ Ошибка');
        }
    }

    async function acceptCall() {
        if (callState !== 'ringing') return;
        updateUI('connecting');
        if (isVideoCall && videosBox) videosBox.style.display = 'flex';

        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideoCall });
            if (localVideo) localVideo.srcObject = localStream;

            setupPC();
            const ice = await getIceServers();
            pc.setConfiguration({ iceServers: ice });

            localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

            await pc.setRemoteDescription(new RTCSessionDescription(window._incomingSignal));
            await flushPendingCandidates();
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            if (window.SferaSocket) {
                window.SferaSocket.emit('answer_call', { to: peerId, signal: answer });
            }
        } catch (e) {
            updateUI('error', e.name === 'NotAllowedError' ? '❌ Нет доступа к камере' : '❌ Ошибка');
        }
    }

    window.initWebRTCListeners = function(socket) {
        socket.on('incoming_call', (data) => {
            if (callState !== 'idle') {
                socket.emit('end_call', { to: data.from });
                return;
            }
            peerId = data.from;
            isVideoCall = data.isVideo;
            window._incomingSignal = data.signal;
            updateUI('ringing', 'Собеседник');
        });

        socket.on('call_accepted', async (signal) => {
            if (pc && callState === 'connecting') {
                await pc.setRemoteDescription(new RTCSessionDescription(signal));
                await flushPendingCandidates();
            }
        });

        socket.on('ice_candidate', async (data) => {
            if (!pc || !pc.remoteDescription) {
                pendingCandidates.push(data.candidate);
                return;
            }
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
        });

        socket.on('call_ended', () => {
            cleanup();
        });
    };

    if (endBtn) endBtn.addEventListener('click', () => {
        if (window.SferaSocket && peerId) window.SferaSocket.emit('end_call', { to: peerId });
        cleanup();
    });

    if (acceptBtn) acceptBtn.addEventListener('click', acceptCall);

    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            if (!localStream) return;
            const audio = localStream.getAudioTracks()[0];
            if (audio) {
                audio.enabled = !audio.enabled;
                muteBtn.textContent = audio.enabled ? '🔇 Mute' : '🔊 Unmute';
            }
        });
    }

    // Экспорт в глобальную область
    
    // Перехват кликов по кнопкам звонка
    document.addEventListener('click', (e) => {
        if (e.target.closest('#audioCallBtn') || e.target.closest('#videoCallBtn')) {
            e.preventDefault();
            e.stopPropagation();
            
            const isVideo = e.target.closest('#videoCallBtn') !== null;
            
            // Берем ID собеседника из активного диалога
            let targetId = window.activeDialogId;
            if (!targetId) {
                const activeItem = document.querySelector('.dialog-item.active');
                if (activeItem) targetId = activeItem.dataset.id || activeItem.id.replace('dialog-', '');
            }

            if (targetId && targetId !== 'ai_assistant') {
                startCall(targetId, isVideo);
            } else {
                console.warn('⚠️ Выберите диалог с пользователем для звонка');
            }
        }
    }, true); // capture: true позволяет перехватить клик раньше других скриптов
    
    window.SferaCall = { startCall };
})();

// Ждем сокет и инициализируем слушатели
const socketInt = setInterval(() => {
    if (window.SferaSocket) {
        clearInterval(socketInt);
        window.initWebRTCListeners(window.SferaSocket);
    }
}, 500);
