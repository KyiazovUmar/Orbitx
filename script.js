const canvas = document.getElementById('orbitCanvas');
const ctx = canvas.getContext('2d');

const celestialBodies = {
    apophis: { name: '99942 Apophis', baseDist: 180, speed: 0.15, ecc: 0.191, period: '323 Days', color: '#ff3366', size: 5, alt: '38,400 km' },
    iss: { name: 'Space Station', baseDist: 90, speed: 0.35, ecc: 0.0003, period: '92.6 Min', color: '#00f0ff', size: 4, alt: '408 km' },
    hubble: { name: 'Hubble Space Telescope', baseDist: 110, speed: 0.30, ecc: 0.0002, period: '95 Min', color: '#a855f7', size: 3, alt: '540 km' },
    geosync: { name: 'Starlink-X Geosync', baseDist: 260, speed: 0.08, ecc: 0.012, period: '24 Hours', color: '#10b981', size: 4, alt: '35,786 km' }
};

let currentObjectKey = 'apophis';
let timeScale = 1.0;
let isPaused = false;
let showVectors = true;
let showGrid = true;
let angle = 0;
let earthRotation = 0;

let camera = {
    zoom: 1.0,
    panX: 0,
    panY: 0,
    targetZoom: 1.0,
    targetPanX: 0,
    targetPanY: 0
};

let isDragging = false;
let startX = 0;
let startY = 0;
let lastTimestamp = performance.now();

const objectSelect = document.getElementById('objectSelect');
const speedSlider = document.getElementById('speedSlider');
const speedVal = document.getElementById('speedVal');
const btnPause = document.getElementById('btnPause');
const btnReset = document.getElementById('btnReset');
const btnToggleVectors = document.getElementById('btnToggleVectors');
const btnToggleGrid = document.getElementById('btnToggleGrid');
const btnFullscreen = document.getElementById('btnFullscreen');

const telemetryAlt = document.getElementById('telemetryAlt');
const telemetryVel = document.getElementById('telemetryVel');
const telemetryPeriod = document.getElementById('telemetryPeriod');
const telemetryEcc = document.getElementById('telemetryEcc');
const terminalOutput = document.getElementById('terminalOutput');
const posx = document.getElementById('posx');
const posy = document.getElementById('posy');

function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function logTerminal(message, type = 'info') {
    const p = document.createElement('p');
    p.className = `log-${type}`;
    p.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    terminalOutput.appendChild(p);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

function updateTelemetry() {
    const obj = celestialBodies[currentObjectKey];
    telemetryAlt.textContent = obj.alt;
    telemetryVel.textContent = (obj.speed * 80000 * timeScale).toFixed(1) + ' km/h';
    telemetryPeriod.textContent = obj.period;
    telemetryEcc.textContent = obj.ecc;
}
updateTelemetry();

canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX - camera.targetPanX;
    startY = e.clientY - camera.targetPanY;
    canvas.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    camera.targetPanX = e.clientX - startX;
    camera.targetPanY = e.clientY - startY;
});

window.addEventListener('mouseup', () => {
    isDragging = false;
    canvas.style.cursor = 'default';
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = 1.15;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldX = (mouseX - (canvas.width / 2 / window.devicePixelRatio) - camera.targetPanX) / camera.targetZoom;
    const worldY = (mouseY - (canvas.height / 2 / window.devicePixelRatio) - camera.targetPanY) / camera.targetZoom;

    if (e.deltaY < 0) {
        camera.targetZoom *= zoomFactor;
    } else {
        camera.targetZoom /= zoomFactor;
    }

    camera.targetZoom = Math.max(0.2, Math.min(12.0, camera.targetZoom));

    camera.targetPanX = mouseX - (canvas.width / 2 / window.devicePixelRatio) - worldX * camera.targetZoom;
    camera.targetPanY = mouseY - (canvas.height / 2 / window.devicePixelRatio) - worldY * camera.targetZoom;
}, { passive: false });

objectSelect.addEventListener('change', (e) => {
    currentObjectKey = e.target.value;
    angle = 0;
    updateTelemetry();
    logTerminal(`Target reassigned: ${celestialBodies[currentObjectKey].name}`, 'success');
});

speedSlider.addEventListener('input', (e) => {
    timeScale = parseFloat(e.target.value);
    speedVal.textContent = timeScale.toFixed(1);
});

btnPause.addEventListener('click', () => {
    isPaused = !isPaused;
    btnPause.textContent = isPaused ? 'Resume' : 'Halt';
    btnPause.classList.toggle('outline', isPaused);
    logTerminal(isPaused ? 'Thread halted.' : 'Thread running.');
});

btnReset.addEventListener('click', () => {
    camera.targetZoom = 1.0;
    camera.targetPanX = 0;
    camera.targetPanY = 0;
    angle = 0;
    logTerminal('Matrix transform reset.');
});

btnToggleVectors.addEventListener('click', () => {
    showVectors = !showVectors;
    btnToggleVectors.classList.toggle('active', showVectors);
});

btnToggleGrid.addEventListener('click', () => {
    showGrid = !showGrid;
    btnToggleGrid.classList.toggle('active', showGrid);
});

btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
});

function render(timestamp) {
    const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
    lastTimestamp = timestamp;

    camera.panX += (camera.targetPanX - camera.panX) * 0.12;
    camera.panY += (camera.targetPanY - camera.panY) * 0.12;
    camera.zoom += (camera.targetZoom - camera.zoom) * 0.12;

    const dpr = window.devicePixelRatio;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(centerX + camera.panX, centerY + camera.panY);
    ctx.scale(camera.zoom, camera.zoom);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    for (let i = 0; i < 40; i++) {
        let x = ((Math.sin(i * 99) * 10000) % (width * 3)) - width * 1.5;
        let y = ((Math.cos(i * 33) * 10000) % (height * 3)) - height * 1.5;
        ctx.fillRect(x, y, 1.2 / camera.zoom, 1.2 / camera.zoom);
    }

    if (showGrid) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
        ctx.lineWidth = 1 / camera.zoom;
        const gridSize = 60;
        const boundX = width * 1.5 / camera.zoom;
        const boundY = height * 1.5 / camera.zoom;
        
        for (let x = -boundX; x < boundX; x += gridSize) {
            ctx.beginPath(); ctx.moveTo(x, -boundY); ctx.lineTo(x, boundY); ctx.stroke();
        }
        for (let y = -boundY; y < boundY; y += gridSize) {
            ctx.beginPath(); ctx.moveTo(-boundX, y); ctx.lineTo(boundX, y); ctx.stroke();
        }
    }

    // --- Realistic Procedural Earth Rendering ---
    const earthRadius = 48;

    // Atmospheric Rayleigh scattering halo
    const atmosphereGlow = ctx.createRadialGradient(0, 0, earthRadius * 0.9, 0, 0, earthRadius * 2.2);
    atmosphereGlow.addColorStop(0, 'rgba(0, 180, 255, 0.25)');
    atmosphereGlow.addColorStop(0.5, 'rgba(0, 110, 255, 0.08)');
    atmosphereGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = atmosphereGlow;
    ctx.beginPath();
    ctx.arc(0, 0, earthRadius * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Earth Ocean Base
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, earthRadius, 0, Math.PI * 2);
    ctx.clip();

    const oceanGrad = ctx.createRadialGradient(-15, -15, 5, 0, 0, earthRadius);
    oceanGrad.addColorStop(0, '#1d4ed8');
    oceanGrad.addColorStop(0.7, '#1e3a8a');
    oceanGrad.addColorStop(1, '#090d16');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(-earthRadius, -earthRadius, earthRadius * 2, earthRadius * 2);

    // Rotating Continental Landmass Blobs
    if (!isPaused) {
        earthRotation += 0.005 * dt * 60;
    }
    
    ctx.fillStyle = '#065f46';
    ctx.strokeStyle = '#047857';
    ctx.lineWidth = 2;

    for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate(earthRotation + (i * Math.PI * 0.4));
        ctx.beginPath();
        ctx.ellipse(20 + i * 4, -10 + i * 6, 18, 10, i, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    // Dynamic Terminator Shadow (Day/Night cycle)
    const terminatorGrad = ctx.createLinearGradient(-earthRadius, -earthRadius, earthRadius, earthRadius);
    terminatorGrad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    terminatorGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.4)');
    terminatorGrad.addColorStop(0.8, 'transparent');
    ctx.fillStyle = terminatorGrad;
    ctx.fillRect(-earthRadius, -earthRadius, earthRadius * 2, earthRadius * 2);

    ctx.restore(); // End clipping mask

    // Earth crisp edge stroke
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1.5 / camera.zoom;
    ctx.beginPath();
    ctx.arc(0, 0, earthRadius, 0, Math.PI * 2);
    ctx.stroke();

    // --- Orbital Mechanics & Target Calculation ---
    const obj = celestialBodies[currentObjectKey];
    const orbitRadiusX = obj.baseDist * 1.4;
    const orbitRadiusY = obj.baseDist * (1 - obj.ecc * 2);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1 / camera.zoom;
    ctx.setLineDash([4 / camera.zoom, 4 / camera.zoom]);
    ctx.beginPath();
    ctx.ellipse(0, 0, orbitRadiusX, orbitRadiusY, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    if (!isPaused) {
        angle += obj.speed * 0.05 * timeScale * dt * 60;
    }

    const posX = Math.cos(angle) * orbitRadiusX;
    const posY = Math.sin(angle) * orbitRadiusY;

    posx.textContent = posX.toFixed(2);
    posy.textContent = posY.toFixed(2);

    if (showVectors) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1 / camera.zoom;
        ctx.beginPath();
        ctx.moveTo(posX, posY);
        ctx.lineTo(posX - Math.sin(angle) * 30, posY + Math.cos(angle) * 30);
        ctx.stroke();
    }

    const nodeGlow = ctx.createRadialGradient(posX, posY, 0, posX, posY, obj.size * 2.5);
    nodeGlow.addColorStop(0, obj.color);
    nodeGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = nodeGlow;
    ctx.beginPath();
    ctx.arc(posX, posY, obj.size * 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = obj.color;
    ctx.beginPath();
    ctx.arc(posX, posY, obj.size, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = `${Math.max(8, 9 / Math.sqrt(camera.zoom))}px JetBrains Mono`;
    ctx.fillText(`▲ ${obj.name}`, posX + 10, posY + 4);

    ctx.restore();

    requestAnimationFrame(render);
}

requestAnimationFrame(render);
logTerminal('Engine pipeline initialized with smooth delta-time interpolation.');