(function() {
    'use strict';

    // 1. Проверяем, авторизован ли юзер
    const token = localStorage.getItem('token') || localStorage.getItem('sfera_token');
    if (!token) return;

    // 2. Если мы уже на странице мессенджера, ничего не делаем (там уже все работает)
    if (window.location.pathname.includes('messenger.html')) return;

    
    const style = document.createElement('style');
    style.textContent = `
        .call-modal {
            display: none; position: fixed; inset: 0; background: rgba(3, 8, 14, 0.6);
            backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); justify-content: center; align-items: center; z-index: 99999;
        }
        .call-modal.active { display: flex; animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .call-modal .modal-box {
            background: rgba(10, 18, 32, 0.85); backdrop-filter: blur(40px) saturate(200%); -webkit-backdrop-filter: blur(40px) saturate(200%);
            border: 1px solid rgba(0, 212, 255, 0.25); border-radius: 28px; padding: 36px;
            max-width: 440px; width: 90%; text-align: center; box-shadow: 0 30px 60px rgba(0,0,0,0.8), inset 0 0 20px rgba(0, 212, 255, 0.05);
            color: #fff; font-family: 'Inter', sans-serif;
        }
        .call-modal .btn-glass { padding: 12px 24px; border-radius: 14px; border: 1px solid rgba(0, 212, 255, 0.18); background: rgba(255,255,255,0.05); color: #fff; cursor: pointer; font-weight: 600; transition: all 0.3s ease; }
        .call-modal .btn-glass:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.3); }
        .call-modal .btn-neon-primary { padding: 12px 24px; border-radius: 14px; border: 1px solid #00d4ff; background: linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(0, 255, 163, 0.15)); color: #fff; font-weight: 700; cursor: pointer; box-shadow: 0 0 15px rgba(0, 212, 255, 0.2); transition: all 0.3s ease; }
        .call-modal .btn-neon-primary:hover { background: #00d4ff; color: #000; box-shadow: 0 0 25px rgba(0, 212, 255, 0.6); }
        .call-modal .btn-neon-danger { padding: 12px 24px; border-radius: 14px; border: 1px solid #ff4d4d; background: rgba(255, 77, 77, 0.15); color: #ff4d4d; font-weight: 700; cursor: pointer; box-shadow: 0 0 15px rgba(255, 77, 77, 0.2); transition: all 0.3s ease; }
        .call-modal .btn-neon-danger:hover { background: #ff4d4d; color: #fff; box-shadow: 0 0 25px rgba(255, 77, 77, 0.6); }
    `;
    document.head.appendChild(style);

    // 3. Динамически вставляем HTML модалки звонка в body
    const modalHTML = `
    <div class="group-modal call-modal" id="callModal" style="z-index: 99999;">
        <div class="modal-box" style="background: rgba(10, 18, 32, 0.95); border-color: var(--primary);">
            <div class="call-avatar" id="callAvatar" style="font-size: 48px; margin-bottom: 16px;">👤</div>
            <h2 id="callTargetName" style="margin-bottom: 4px;">...</h2>
            <div class="call-status" id="callStatusText" style="color: var(--accent); font-size: 15px; margin-bottom: 10px;">Birikdirilýär...</div>
            <div id="callTimer" style="font-size: 28px; font-weight: 800; color: #fff; margin-bottom: 20px; display: none;">00:00</div>
            <div class="call-videos" id="callVideos" style="display:none; gap:10px; justify-content:center; margin-bottom:20px;">
                <video id="localVideo" autoplay muted playsinline style="width:120px; height:160px; border-radius:12px; background:#000; object-fit:cover;"></video>
                <video id="remoteVideo" autoplay playsinline style="width:240px; height:160px; border-radius:12px; background:#000; object-fit:cover;"></video>
            </div>
            <div class="call-actions" style="display:flex; justify-content:center; gap:10px;">
                <button class="btn-glass" id="muteBtn" style="display:none;">🔇 Mute</button>
                <button class="btn-neon-primary" id="acceptCallBtn" style="display:none;">✅ Принять</button>
                <button class="btn-neon-danger" id="endCallBtn">❌ Jaňy bes et</button>
            </div>
        </div>
    </div>`;
    
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // 4. Подключаем сокет (если он еще не создан на этой странице)
    // Используем глобальный io, который должен быть подключен в HTML
    if (typeof io !== 'undefined' && !window.SferaSocket) {
        const socket = io(window.location.origin, {
            auth: { token }, transports: ['websocket', 'polling']
        });
        window.SferaSocket = socket;
    }

    // 5. Подключаем скрипт webrtc-call.js (он сам подхватит window.SferaSocket и модалку)
    const script = document.createElement('script');
    script.src = '/js/webrtc-call.js';
    document.body.appendChild(script);

})();
