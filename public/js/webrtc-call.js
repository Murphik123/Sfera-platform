(function() {
    'use strict';

    let pc = null;
    let localStream = null;
    let peerId = null;
    let isVideoCall = false;
    let callState = 'idle';

    const callModal = document.getElementById('callModal');
    const callTargetName = document.getElementById('callTargetName');
    const callStatusText = document.getElementById('callStatusText');
    const localVideo = document.getElementById('localVideo');
    const remoteVideo = document.getElementById('remoteVideo');
    const callVideos = document.getElementById('callVideos');
    const endCallBtn = document.getElementById('endCallBtn');
    const acceptCallBtn = document.getElementById('acceptCallBtn');
    const callTimer = document.getElementById('callTimer');
    const muteBtn = document.getElementById('muteBtn');
    let timerInterval = null;
    let timerSeconds = 0;
    let remoteUserName = 'Собеседник';

    async function getIceServers() {
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('sfera_token');
            const response = await fetch('/api/config/webrtc', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('HTTP error ' + response.status);
            const data = await response.json();
            return data.iceServers;
        } catch (error) {
            console.error('❌ [WebRTC] Error loading ICE:', error);
            return [{ urls: 'stun:stun.l.google.com:19302' }];
        }
    }

    function startTimer() {
        if (timerInterval) return;
        timerSeconds = 0;
        callTimer.style.display = 'block';
        callTimer.textContent = '00:00';
        timerInterval = setInterval(() => {
            timerSeconds++;
            const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
            const s = String(timerSeconds % 60).padStart(2, '0');
            callTimer.textContent = m + ':' + s;
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
        timerInterval = null;
        callTimer.style.display = 'none';
        callTimer.textContent = '00:00';
    }

    function cleanup() {
        callState = 'idle';
        if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
        if (pc) { pc.close(); pc = null; }
        if (callModal) callModal.classList.remove('active');
        if (localVideo) localVideo.srcObject = null;
        if (remoteVideo) remoteVideo.srcObject = null;
        if (acceptCallBtn) acceptCallBtn.style.display = 'none';
        if (callVideos) callVideos.style.display = 'none';
        if (muteBtn) muteBtn.style.display = 'none';
        if (callTimer) stopTimer();
        remoteUserName = 'Собеседник';
    }

    
    function getTargetName(targetId) {
        const activeItem = document.querySelector('.dialog-item.active');
        if (activeItem) {
            let name = activeItem.querySelector('.name')?.textContent || 'Собеседник';
            // Если в диалоге есть значок админа 🛡, добавляем его к имени
            if (activeItem.innerHTML.includes('admin-badge') || name.includes('🛡')) {
                name = name.replace('🛡', '').trim() + ' 🛡';
            }
            return name;
        }
        return 'Собеседник';
    }

    async function startCall(targetId, video) {
        if (callState !== 'idle') return alert('Вы уже в звонке');
        callState = 'calling';
        peerId = targetId;
        isVideoCall = video;

        callTargetName.textContent = getTargetName(targetId) + '...';
        callStatusText.textContent = 'Соединение...';
        callStatusText.style.color = 'var(--accent)';
        callModal.classList.add('active');
        if (video) callVideos.style.display = 'flex';

        try {
            const iceServers = await getIceServers();
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideoCall });
            if (localVideo) localVideo.srcObject = localStream;

            pc = new RTCPeerConnection({ iceServers });
            localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

            pc.onicecandidate = (event) => {
                if (event.candidate && window.SferaSocket) {
                    window.SferaSocket.emit('ice_candidate', { to: peerId, candidate: event.candidate });
                }
            };

            pc.ontrack = (event) => {
                if (remoteVideo) remoteVideo.srcObject = event.streams[0];
                callStatusText.textContent = 'Соединено';
                callStatusText.style.color = 'var(--accent)';
                callTargetName.textContent = remoteUserName || getTargetName(peerId);
                callState = 'connected';
                startTimer();
                if (muteBtn) muteBtn.style.display = 'block';
            };

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            if (window.SferaSocket) {
                window.SferaSocket.emit('call_user', { userToCall: peerId, signalData: offer, isVideo: isVideoCall });
            }
        } catch (err) {
            console.error('Error startCall:', err);
            callStatusText.textContent = '❌ Микрофон/Камера заблокированы';
            callStatusText.style.color = '#ff4d4d';
            setTimeout(cleanup, 3000);
        }
    }

    async function acceptCall() {
        if (callState !== 'ringing') return;
        callState = 'connected';
        acceptCallBtn.style.display = 'none';
        callStatusText.textContent = 'Соединение...';

        try {
            const iceServers = await getIceServers();
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideoCall });
            if (localVideo) localVideo.srcObject = localStream;

            pc = new RTCPeerConnection({ iceServers });
            localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

            pc.onicecandidate = (event) => {
                if (event.candidate && window.SferaSocket) {
                    window.SferaSocket.emit('ice_candidate', { to: peerId, candidate: event.candidate });
                }
            };

            pc.ontrack = (event) => {
                if (remoteVideo) remoteVideo.srcObject = event.streams[0];
                callStatusText.textContent = 'Соединено';
                callStatusText.style.color = 'var(--accent)';
                callTargetName.textContent = remoteUserName;
                startTimer();
                if (muteBtn) muteBtn.style.display = 'block';
            };

            await pc.setRemoteDescription(new RTCSessionDescription(window._incomingSignal));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            if (window.SferaSocket) {
                window.SferaSocket.emit('answer_call', { to: peerId, signal: answer });
            }
        } catch (err) {
            console.error('Error acceptCall:', err);
            callStatusText.textContent = '❌ Ошибка подключения';
            callStatusText.style.color = '#ff4d4d';
            setTimeout(cleanup, 3000);
        }
    }

    window.initWebRTCListeners = function(socket) {
        socket.on('incoming_call', (data) => {
            if (callState !== 'idle') {
                socket.emit('end_call', { to: data.from });
                return;
            }
            callState = 'ringing';
            peerId = data.from;
            isVideoCall = data.isVideo;
            window._incomingSignal = data.signal;

            const dialogItem = document.querySelector(`.dialog-item[data-id="${data.from}"]`);
            remoteUserName = dialogItem ? (dialogItem.querySelector('.name')?.textContent || 'Собеседник') : 'Собеседник';
            callTargetName.textContent = remoteUserName;
            callStatusText.textContent = isVideoCall ? '📹 Видеозвонок' : '📞 Аудиозвонок';
            callModal.classList.add('active');
            acceptCallBtn.style.display = 'block';
            if (isVideoCall) callVideos.style.display = 'flex';
        });

        socket.on('call_accepted', async (signal) => {
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(signal));
                callStatusText.textContent = 'Соединено';
                callStatusText.style.color = 'var(--accent)';
                callState = 'connected';
                startTimer();
                if (muteBtn) muteBtn.style.display = 'block';
            }
        });

        socket.on('ice_candidate', async (data) => {
            if (pc) {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(e => console.warn('ICE error:', e));
            }
        });

        socket.on('call_ended', () => {
            cleanup();
        });
    };

    if (endCallBtn) {
        endCallBtn.addEventListener('click', () => {
            if (window.SferaSocket && peerId) {
                window.SferaSocket.emit('end_call', { to: peerId });
            }
            cleanup();
        });
    }

    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            if (!localStream) return;
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                muteBtn.textContent = audioTrack.enabled ? '🔇 Mute' : '🔊 Unmute';
                muteBtn.style.background = audioTrack.enabled ? 'rgba(255,255,255,0.05)' : 'rgba(255, 77, 77, 0.3)';
            }
        });
    }

    if (acceptCallBtn) {
        acceptCallBtn.addEventListener('click', acceptCall);
    }

    document.addEventListener('click', (e) => {
        if (e.target.closest('#audioCallBtn') || e.target.closest('#videoCallBtn')) {
            e.preventDefault();
            e.stopPropagation();
            
            const activeItem = document.querySelector('.dialog-item.active');
            const isAI = activeItem && (
                activeItem.textContent.includes('AI Kömekçi') || 
                activeItem.textContent.includes('Sfera AI')
            );
            
            let targetId = window.activeDialogId;
            if (!targetId && activeItem) {
                targetId = activeItem.dataset.id || activeItem.id.replace('dialog-', '');
            }

            // Если это ИИ или нет ID — просто выходим без всяких alert
            if (isAI || !targetId || targetId === 'ai_assistant') {
                console.warn('⚠️ [WebRTC] Звонки недоступны для ИИ-помощника');
                return;
            }

            const isVideo = e.target.closest('#videoCallBtn') !== null;
            startCall(targetId, isVideo);
        }
    }, true);

    window.SferaCall = { startCall, getIceServers };
    console.log('✅ [WebRTC] Module loaded');
})();

const socketInterval = setInterval(() => {
    if (window.SferaSocket) {
        clearInterval(socketInterval);
        window.initWebRTCListeners(window.SferaSocket);
        console.log('✅ [WebRTC] Listeners attached to socket');
    }
}, 500);

    // Принудительно прячем кнопки звонка для ИИ каждые 300мс
    setInterval(() => {
        const activeItem = document.querySelector('.dialog-item.active');
        const isAI = activeItem && (
            activeItem.textContent.includes('AI Kömekçi') || 
            activeItem.textContent.includes('Sfera AI')
        );
        const callButtons = document.querySelector('.call-buttons');
        
        if (callButtons) {
            if (isAI) {
                callButtons.style.display = 'none';
            } else {
                callButtons.style.display = 'flex';
            }
        }
    }, 300);
