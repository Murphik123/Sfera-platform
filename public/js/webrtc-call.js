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

    function cleanup() {
        callState = 'idle';
        if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
        if (pc) { pc.close(); pc = null; }
        if (callModal) callModal.classList.remove('active');
        if (localVideo) localVideo.srcObject = null;
        if (remoteVideo) remoteVideo.srcObject = null;
        if (acceptCallBtn) acceptCallBtn.style.display = 'none';
        if (callVideos) callVideos.style.display = 'none';
    }

    async function startCall(targetId, video) {
        if (callState !== 'idle') return alert('Вы уже в звонке');
        callState = 'calling';
        peerId = targetId;
        isVideoCall = video;

        callTargetName.textContent = 'Звонок...';
        callStatusText.textContent = 'Соединение...';
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
                callState = 'connected';
            };

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            if (window.SferaSocket) {
                window.SferaSocket.emit('call_user', { userToCall: peerId, signalData: offer, isVideo: isVideoCall });
            }
        } catch (err) {
            console.error('Error startCall:', err);
            alert('Ошибка звонка: ' + err.message);
            cleanup();
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
            };

            await pc.setRemoteDescription(new RTCSessionDescription(window._incomingSignal));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            if (window.SferaSocket) {
                window.SferaSocket.emit('answer_call', { to: peerId, signal: answer });
            }
        } catch (err) {
            console.error('Error acceptCall:', err);
            cleanup();
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

            callTargetName.textContent = 'Входящий звонок...';
            callStatusText.textContent = isVideoCall ? '📹 Видеозвонок' : '📞 Аудиозвонок';
            callModal.classList.add('active');
            acceptCallBtn.style.display = 'block';
            if (isVideoCall) callVideos.style.display = 'flex';
        });

        socket.on('call_accepted', async (signal) => {
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(signal));
                callStatusText.textContent = 'Соединено';
                callState = 'connected';
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

    if (acceptCallBtn) {
        acceptCallBtn.addEventListener('click', acceptCall);
    }

    document.addEventListener('click', (e) => {
        if (e.target.closest('#audioCallBtn') || e.target.closest('#videoCallBtn')) {
            e.preventDefault();
            e.stopPropagation();
            const isVideo = e.target.closest('#videoCallBtn') !== null;
            let targetId = window.activeDialogId;
            if (!targetId) {
                const activeItem = document.querySelector('.dialog-item.active');
                if (activeItem) targetId = activeItem.dataset.id || activeItem.id.replace('dialog-', '');
            }
            if (targetId && targetId !== 'ai_assistant') {
                startCall(targetId, isVideo);
            } else {
                alert('Выберите диалог с пользователем для звонка');
            }
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
