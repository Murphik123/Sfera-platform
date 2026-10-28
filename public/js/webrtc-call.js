(function() {
    'use strict';

    async function getIceServers() {
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('sfera_token');
            const response = await fetch('/api/config/webrtc', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('HTTP error ' + response.status);
            const data = await response.json();
            console.log('✅ [WebRTC] ICE Servers loaded:', data.iceServers);
            return data.iceServers;
        } catch (error) {
            console.error('❌ [WebRTC] Error loading ICE servers:', error);
            return [{ urls: 'stun:stun.l.google.com:19302' }];
        }
    }

    async function startCall(peerId, isVideo) {
        console.log(`📞 [WebRTC] Starting call to ${peerId}, video: ${isVideo}`);
        const iceServers = await getIceServers();
        console.log('🔧 [WebRTC] Ready to connect with servers:', iceServers);
        alert('ICE-серверы получены! Смотри консоль браузера.');
    }

    window.SferaCall = {
        startCall,
        getIceServers
    };
})();
