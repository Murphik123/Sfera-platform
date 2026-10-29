/**
 * SFERA Messenger — WebRTC Calls (audio/video 1-1)
 * Rewritten: 2026-10-29
 * Fixes: stale callState (disconnect/close), ICE buffering, video accept, activeDialogId, reject logic
 */
(function () {
    'use strict';

    let pc = null;
    let localStream = null;
    let peerId = null;
    let isVideoCall = false;
    let callState = 'idle'; // idle | calling | ringing | connecting | connected | error
    let pendingCandidates = [];
    let timerInterval = null;
    let timerSeconds = 0;

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
    const ringtoneEl = $('ringtone');

    // WebAudio-фолбэк: если нет файла ringtone — бип через осциллятор
    let _ringtoneOsc = null;
    let _ringtoneCtx = null;

    // Разблокировка AudioContext (autoplay policy) — при первом user gesture
    (function _unlockAudioContext() {
        function _try() {
            try {
                _ringtoneCtx = _ringtoneCtx || new (window.AudioContext || window.webkitAudioContext)();
                if (_ringtoneCtx.state === 'suspended') _ringtoneCtx.resume().catch(function () {});
            } catch (_) {}
        }
        ['click', 'touchstart', 'keydown'].forEach(function (ev) {
            document.addEventListener(ev, _try, { once: true, capture: true });
        });
    })();
    let _ringtoneInterval = null;
    function _ringtoneFallbackStart() {
        if (_ringtoneOsc) return;
        try {
            _ringtoneCtx = _ringtoneCtx || new (window.AudioContext || window.webkitAudioContext)();
            if (_ringtoneCtx.state === 'suspended') _ringtoneCtx.resume().catch(function () {});

            // Реальный телефонный "tuu-tuu": 2 тона 440+480 Гц, 1 сек вкл / 2 сек пауза
            function _pulseOnce() {
                if (!_ringtoneCtx || _ringtoneCtx.state === 'closed') return;
                const gain = _ringtoneCtx.createGain();
                gain.gain.value = 0.35;
                gain.connect(_ringtoneCtx.destination);

                const osc1 = _ringtoneCtx.createOscillator();
                const osc2 = _ringtoneCtx.createOscillator();
                osc1.type = 'sine';
                osc2.type = 'sine';
                osc1.frequency.value = 440;
                osc2.frequency.value = 480;
                osc1.connect(gain);
                osc2.connect(gain);

                const now = _ringtoneCtx.currentTime;
                gain.gain.setValueAtTime(0.35, now);
                gain.gain.setValueAtTime(0.35, now + 0.9);
                gain.gain.linearRampToValueAtTime(0, now + 1.0);

                osc1.start(now);
                osc2.start(now);
                osc1.stop(now + 1.0);
                osc2.stop(now + 1.0);
            }

            _pulseOnce();
            _ringtoneInterval = setInterval(_pulseOnce, 3000);  // каждые 3 сек

            // Для cleanup - флаг
            _ringtoneOsc = { osc: { stop: function () { if (_ringtoneInterval) clearInterval(_ringtoneInterval); } }, gain: { disconnect: function () {} } };
        } catch (_) {}
    }
    function _ringtoneFallbackStop() {
        if (!_ringtoneOsc) return;
        try { _ringtoneOsc.osc.stop(); _ringtoneOsc.gain.disconnect(); } catch (_) {}
        _ringtoneOsc = null;
    }
    function playRingtone() {
        try {
            if (ringtoneEl) {
                ringtoneEl.currentTime = 0;
                const pr = ringtoneEl.play();
                if (pr && pr.catch) pr.catch(function () { _ringtoneFallbackStart(); });
            } else {
                _ringtoneFallbackStart();
            }
        } catch (_) { _ringtoneFallbackStart(); }
    }
    function stopRingtone() {
        try { if (ringtoneEl) { ringtoneEl.pause(); ringtoneEl.currentTime = 0; } } catch (_) {}
        _ringtoneFallbackStop();
    }

    function tr(key, fallback) {
        try { return (window.SFERA_I18N && window.SFERA_I18N.t && window.SFERA_I18N.t(key)) || fallback || key; }
        catch (_) { return fallback || key; }
    }

    function toast(msg, type) {
        if (typeof window.showToast === 'function') { window.showToast(msg, type || 'info'); return; }
        console.log('[call:' + (type || 'info') + '] ' + msg);
    }

    function updateUI(state, text) {
        callState = state;
        if (!modal) return;

        if (statusText) statusText.style.color = 'var(--accent)';
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
            if (targetName) targetName.textContent = text || tr('call_calling', 'Звонок...');
            if (statusText) statusText.textContent = tr('call_connecting', 'Соединение...');
            if (endBtn) endBtn.textContent = '❌ ' + tr('call_cancel', 'Отменить');
            if (muteBtn) { muteBtn.style.display = 'inline-block'; updateMuteLabel(); }
            playRingtone();
        } else if (state === 'ringing') {
            if (targetName) targetName.textContent = text || tr('call_incoming', 'Входящий звонок...');
            if (statusText) statusText.textContent = isVideoCall ? '📹 ' + tr('call_video', 'Видеозвонок') : '📞 ' + tr('call_audio', 'Аудиозвонок');
            if (acceptBtn) {
                acceptBtn.style.display = 'inline-block';
                acceptBtn.textContent = '✅ ' + tr('call_accept', 'Принять');
            }
            if (endBtn) endBtn.textContent = '❌ ' + tr('call_reject', 'Отклонить');
            playRingtone();
        } else if (state === 'connecting') {
            if (statusText) statusText.textContent = tr('call_connecting', 'Соединение...');
            if (endBtn) endBtn.textContent = '❌ ' + tr('call_cancel', 'Отменить');
            if (muteBtn) { muteBtn.style.display = 'inline-block'; updateMuteLabel(); }
        } else if (state === 'connected') {
            if (statusText) statusText.textContent = tr('call_connected', 'Соединено');
            if (timerEl) timerEl.style.display = 'block';
            if (muteBtn) { muteBtn.style.display = 'inline-block'; updateMuteLabel(); }
            if (endBtn) endBtn.textContent = '❌ ' + tr('call_end', 'Завершить');
            stopRingtone();
            startTimer();
        } else if (state === 'error') {
            if (statusText) { statusText.textContent = text || ('❌ ' + tr('call_error_conn', 'Ошибка подключения')); statusText.style.color = '#ff4d4d'; }
            setTimeout(cleanup, 3000);
        }
    }

    function updateMuteLabel() {
        if (!muteBtn || !localStream) return;
        const audio = localStream.getAudioTracks()[0];
        if (!audio) return;
        muteBtn.textContent = audio.enabled
            ? '🔇 ' + tr('call_mute', 'Mute')
            : '🔊 ' + tr('call_unmute', 'Unmute');
    }

    function startTimer() {
        if (timerInterval) return;
        timerSeconds = 0;
        if (timerEl) timerEl.textContent = '00:00';
        timerInterval = setInterval(function () {
            timerSeconds++;
            const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
            const s = String(timerSeconds % 60).padStart(2, '0');
            if (timerEl) timerEl.textContent = m + ':' + s;
        }, 1000);
    }

    function cleanup() {
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        if (localStream) { try { localStream.getTracks().forEach(function (t) { t.stop(); }); } catch (_) {} localStream = null; }
        if (pc) { try { pc.close(); } catch (_) {} pc = null; }
        if (localVideo) localVideo.srcObject = null;
        if (remoteVideo) remoteVideo.srcObject = null;
        pendingCandidates = [];
        peerId = null;
        isVideoCall = false;
        window._incomingSignal = null;
        stopRingtone();
        updateUI('idle');
    }

    async function flushPendingCandidates() {
        if (!pc || !pc.remoteDescription) return;
        const list = pendingCandidates.splice(0);
        for (const c of list) {
            try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (_) {}
        }
    }

    async function getIceServers() {
        try {
            const token = (window.api && window.api.getToken) ? window.api.getToken() : (localStorage.getItem('token') || localStorage.getItem('sfera_token'));
            const res = await fetch('/api/config/webrtc', { headers: { 'Authorization': 'Bearer ' + token } });
            if (!res.ok) throw new Error('config http ' + res.status);
            const data = await res.json();
            if (data && Array.isArray(data.iceServers) && data.iceServers.length) return data.iceServers;
            throw new Error('empty iceServers');
        } catch (e) {
            console.warn('[call] getIceServers fallback STUN:', e.message);
            return [{ urls: 'stun:stun.l.google.com:19302' }];
        }
    }

    function setupPC(iceServers) {
        pc = new RTCPeerConnection({ iceServers: iceServers || [] });

        pc.onicecandidate = function (e) {
            if (e.candidate && window.SferaSocket && peerId) {
                window.SferaSocket.emit('ice_candidate', { to: peerId, candidate: e.candidate });
            }
        };

        pc.ontrack = function (e) {
            if (remoteVideo) {
                remoteVideo.srcObject = e.streams[0];
                const p = remoteVideo.play();
                if (p && p.catch) p.catch(function () {});
            }
            if (callState !== 'connected') updateUI('connected');
        };

        pc.onconnectionstatechange = function () {
            if (!pc) return;
            const s = pc.connectionState;
            console.log('[call] pc.connectionState:', s);
            if (s === 'failed' || s === 'disconnected') {
                updateUI('error', '❌ Связь потеряна');
            } else if (s === 'connected') {
                if (callState !== 'connected') updateUI('connected');
            }
        };

        return pc;
    }

    async function startCall(target, video) {
        if (callState !== 'idle') {
            toast('Уже идёт звонок — завершите текущий', 'error');
            return;
        }
        if (!target || String(target) === 'ai_assistant') {
            toast('Выберите пользователя для звонка', 'error');
            return;
        }

        peerId = String(target);
        isVideoCall = !!video;
        updateUI('calling', '');
        if (isVideoCall && videosBox) videosBox.style.display = 'flex';

        try {
            const ice = await getIceServers();
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideoCall });
            if (localVideo) localVideo.srcObject = localStream;

            setupPC(ice);
            localStream.getTracks().forEach(function (t) { pc.addTrack(t, localStream); });

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            if (!window.SferaSocket) throw new Error('socket not connected');
            window.SferaSocket.emit('call_user', { userToCall: peerId, signalData: offer, isVideo: isVideoCall });
            updateUI('connecting');
        } catch (e) {
            console.error('[call] startCall failed:', e);
            let msg = '❌ Ошибка';
            if (e && e.name === 'NotAllowedError') msg = '❌ Нет доступа к микрофону/камере';
            else if (e && e.name === 'NotFoundError') msg = '❌ Устройство не найдено';
            else if (e && e.name === 'NotReadableError') msg = '❌ Устройство занято';
            else if (e && e.message) msg = '❌ ' + e.message;
            updateUI('error', msg);
        }
    }

    async function acceptCall() {
        if (callState !== 'ringing') return;
        if (!window._incomingSignal) { updateUI('error', '❌ Нет данных звонка'); return; }
        stopRingtone();
        updateUI('connecting');
        if (isVideoCall && videosBox) videosBox.style.display = 'flex';

        try {
            const ice = await getIceServers();
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideoCall });
            if (localVideo) localVideo.srcObject = localStream;

            setupPC(ice);
            localStream.getTracks().forEach(function (t) { pc.addTrack(t, localStream); });

            await pc.setRemoteDescription(new RTCSessionDescription(window._incomingSignal));
            await flushPendingCandidates();

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            if (!window.SferaSocket) throw new Error('socket not connected');
            window.SferaSocket.emit('answer_call', { to: peerId, signal: answer });
        } catch (e) {
            console.error('[call] acceptCall failed:', e);
            let msg = '❌ Ошибка';
            if (e && e.name === 'NotAllowedError') msg = '❌ Нет доступа к камере';
            else if (e && e.message) msg = '❌ ' + e.message;
            updateUI('error', msg);
        }
    }

    function rejectCall() {
        if (window.SferaSocket && peerId) window.SferaSocket.emit('end_call', { to: peerId });
        cleanup();
    }

    function hangup() {
        if (window.SferaSocket && peerId) window.SferaSocket.emit('end_call', { to: peerId });
        cleanup();
    }

    function toggleMute() {
        if (!localStream) return;
        const audio = localStream.getAudioTracks()[0];
        if (!audio) return;
        audio.enabled = !audio.enabled;
        updateMuteLabel();
    }

    function initWebRTCListeners(socket) {
        socket.on('incoming_call', function (data) {
            if (callState !== 'idle') {
                console.warn('[call] incoming rejected — stale state', callState, '→ cleanup');
                cleanup();
                socket.emit('end_call', { to: data.from });
                return;
            }
            peerId = String(data.from);
            isVideoCall = !!data.isVideo;
            window._incomingSignal = data.signal;
            updateUI('ringing', 'Собеседник');

            let callerName = data.fromName || data.name || null;
            if (!callerName && window.sferaMessenger && typeof window.sferaMessenger.getDialogById === 'function') {
                const d = window.sferaMessenger.getDialogById(peerId);
                if (d && d.name) callerName = d.name;
            }
            if (!callerName) {
                const el = document.querySelector('.dialog-item[data-id="' + peerId + '"] .name');
                if (el) {
                    const clone = el.cloneNode(true);
                    const badge = clone.querySelector('.admin-badge');
                    if (badge) badge.remove();
                    callerName = clone.textContent.trim() || null;
                }
            }
            updateUI('ringing', callerName || tr('call_incoming', 'Входящий звонок...'));
        });

        socket.on('call_accepted', async function (signal) {
            if (pc && callState === 'connecting') {
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal));
                    await flushPendingCandidates();
                } catch (e) { console.error('[call] call_accepted error:', e); }
            }
        });

        socket.on('ice_candidate', async function (data) {
            if (!data || !data.candidate) return;
            if (!pc || !pc.remoteDescription) {
                pendingCandidates.push(data.candidate);
                return;
            }
            try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (_) {}
        });

        socket.on('call_ended', function () {
            cleanup();
        });

        socket.on('disconnect', function () {
            if (callState === 'calling' || callState === 'ringing' || callState === 'connecting') {
                console.log('[call] socket disconnect during setup → cleanup');
                cleanup();
            } else if (callState === 'connected') {
                console.log('[call] socket disconnect during active call — keep WebRTC alive');
            }
        });
    }

    // === UI bindings ===
    if (endBtn) endBtn.addEventListener('click', function () {
        if (callState === 'ringing') return rejectCall();
        return hangup();
    });
    if (acceptBtn) acceptBtn.addEventListener('click', acceptCall);
    if (muteBtn) muteBtn.addEventListener('click', toggleMute);

    window.addEventListener('beforeunload', function () {
        if (callState !== 'idle' && peerId && window.SferaSocket) {
            try { window.SferaSocket.emit('end_call', { to: peerId }); } catch (_) {}
        }
        try { cleanup(); } catch (_) {}
    });

    // === Click interception (capture phase) ===
    document.addEventListener('click', function (e) {
        const audioBtn = e.target.closest && e.target.closest('#audioCallBtn');
        const videoBtn = e.target.closest && e.target.closest('#videoCallBtn');
        if (!audioBtn && !videoBtn) return;
        e.preventDefault();
        e.stopPropagation();

        const isVideo = !!videoBtn;

        let targetId = window.activeDialogId;
        if (!targetId) {
            const activeItem = document.querySelector('.dialog-item.active');
            if (activeItem) targetId = activeItem.dataset.id || (activeItem.id ? activeItem.id.replace('dialog-', '') : null);
        }

        if (!targetId || String(targetId) === 'ai_assistant') {
            toast('Выберите диалог с пользователем (не AI)', 'error');
            return;
        }
        startCall(targetId, isVideo);
    }, true);

    // === Экспорт для отладки ===
    window.SferaCall = {
        startCall: startCall,
        acceptCall: acceptCall,
        hangup: hangup,
        rejectCall: rejectCall,
        getState: function () { return { callState: callState, peerId: peerId, isVideoCall: isVideoCall, hasPC: !!pc }; }
    };

    // === Дождаться socket и повесить слушатели (однократно) ===
    let _listenersBound = false;
    const _socketPoll = setInterval(function () {
        if (window.SferaSocket && !_listenersBound) {
            _listenersBound = true;
            clearInterval(_socketPoll);
            initWebRTCListeners(window.SferaSocket);
            console.log('✅ [call] WebRTC listeners bound to SferaSocket');
        }
    }, 300);
})();
