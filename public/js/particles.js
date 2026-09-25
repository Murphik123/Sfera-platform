/**
 * Анимация плавающих частиц для стиля Glassmorphism (без ES-модулей)
 * Требуется тег: <canvas id="particles-canvas"></canvas>
 */
(function () {
    let canvas = null;
    let ctx = null;
    let particlesArray = [];
    let animationFrameId = null;

    const PARTICLE_COUNT = 45;
    const CONNECT_DISTANCE = 110;

    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2.5 + 1;
            this.speedX = (Math.random() - 0.5) * 0.6;
            this.speedY = (Math.random() - 0.5) * 0.6;
            this.color = 'rgba(255, 255, 255, ' + (Math.random() * 0.4 + 0.2) + ')';
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;

            // Отскок от краев
            if (this.x > canvas.width || this.x < 0) this.speedX *= -1;
            if (this.y > canvas.height || this.y < 0) this.speedY *= -1;
        }

        draw() {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function resizeCanvas() {
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function init() {
        canvas = document.getElementById('particles-canvas');
        if (!canvas) {
            // Если canvas нет на странице, создаем его автоматически
            canvas = document.createElement('canvas');
            canvas.id = 'particles-canvas';
            canvas.style.position = 'fixed';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.width = '100vw';
            canvas.style.height = '100vh';
            canvas.style.pointerEvents = 'none';
            canvas.style.zIndex = '-1';
            document.body.prepend(canvas);
        }

        ctx = canvas.getContext('2d');
        resizeCanvas();

        particlesArray = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            particlesArray.push(new Particle());
        }

        window.addEventListener('resize', resizeCanvas);
        animate();
    }

    function connectParticles() {
        for (let a = 0; a < particlesArray.length; a++) {
            for (let b = a; b < particlesArray.length; b++) {
                const dx = particlesArray[a].x - particlesArray[b].x;
                const dy = particlesArray[a].y - particlesArray[b].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < CONNECT_DISTANCE) {
                    const opacity = 1 - (distance / CONNECT_DISTANCE);
                    ctx.strokeStyle = 'rgba(255, 255, 255, ' + (opacity * 0.15) + ')';
                    ctx.lineWidth = 0.8;
                    ctx.beginPath();
                    ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
                    ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
                    ctx.stroke();
                }
            }
        }
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < particlesArray.length; i++) {
            particlesArray[i].update();
            particlesArray[i].draw();
        }

        connectParticles();
        animationFrameId = requestAnimationFrame(animate);
    }

    // Экспорт в window для управления извне при необходимости
    window.Particles = {
        init: init,
        stop: () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        }
    };

    // Автоинициализация при загрузке DOM
    document.addEventListener('DOMContentLoaded', init);
})();
