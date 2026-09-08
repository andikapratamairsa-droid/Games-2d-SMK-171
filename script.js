// ⚠️ GANTI URL WEB APP GOOGLE SHEET-MU DI SINI!
const SHEET_URL = "https://script.google.com/macros/s/AKfycbzy5FhywYujRGUSvblstz79UbXHkGAuL63Qx5_9NWZEiE_4Rvfq2SZd4EQkUur5mVmpQg/exec";

let user = {username:"", whatsapp:""};
let gameState = {
  score:0, lives:5, round:1, maxRounds:5,
  baseTime:30, minTime:15,  // ⏱️ AWAL 30 DETIK, berkurang tiap ronde
  timeLeft:30,
  isPaused:false, isGameOver:false,
  starRegenTimer:null
};

let canvas, ctx;
let player = {x:50,y:200,w:36,h:36,vx:0,vy:0,speed:6,onGround:false};
let stars = [];     // ⭐ Poin = BINTANG
let obstacles = []; // Rintangan
let keys = {left:false, right:false, up:false};
let gameLoop, timerInterval;

window.onload = () => {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  setupControls();
};

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - 130;
}

// === MENU AWAL ===
function startGame() {
  const u = document.getElementById('username').value.trim();
  const w = document.getElementById('whatsapp').value.trim();
  if(!u || !w){ document.getElementById('errMsg').style.display='block'; return; }
  if(!/^[\d+\-\s]{10,15}$/.test(w)){
    document.getElementById('errMsg').textContent="⚠️ Format nomor WA salah!";
    document.getElementById('errMsg').style.display='block'; return;
  }
  user={username:u, whatsapp:w};
  document.getElementById('lobbyScreen').classList.remove('active');
  document.getElementById('gameScreen').classList.add('active');
  initGame();
}

// === MULAI GAME ===
function initGame() {
  gameState = {
    score:0, lives:5, round:1, maxRounds:5,
    baseTime:30, minTime:15, timeLeft:30, // ⏱️ AWAL 30 DETIK
    isPaused:false, isGameOver:false, starRegenTimer:null
  };
  stars=[]; obstacles=[];
  updateUI(); resetPlayer(); startTimer(); spawnObjects(); startStarRegen();
  if(gameLoop) cancelAnimationFrame(gameLoop);
  requestAnimationFrame(update);
}

// === RESET PEMAIN SAJA — BINTANG & RINTANGAN TETAP ADA ⭐ ===
function resetPlayer() {
  player = {x:50,y:canvas.height-80,w:36,h:36,vx:0,vy:0,speed:6,onGround:false};
}

// === KONTROL ===
function setupControls() {
  document.addEventListener('keydown',e=>{
    if(e.key==='ArrowLeft'||e.key==='a') keys.left=true;
    if(e.key==='ArrowRight'||e.key==='d') keys.right=true;
    if(e.key==='ArrowUp'||e.key==='w'||e.key===' ') keys.up=true;
    if(e.key==='Escape'||e.key==='p') togglePause();
  });
  document.addEventListener('keyup',e=>{
    if(e.key==='ArrowLeft'||e.key==='a') keys.left=false;
    if(e.key==='ArrowRight'||e.key==='d') keys.right=false;
    if(e.key==='ArrowUp'||e.key==='w'||e.key===' ') keys.up=false;
  });
  const bl=document.getElementById('btnLeft'), br=document.getElementById('btnRight');
  const bu=document.getElementById('btnUp'), bp=document.getElementById('btnPause');
  bl.addEventListener('touchstart',e=>{e.preventDefault();keys.left=true;});
  bl.addEventListener('touchend',e=>{e.preventDefault();keys.left=false;});
  br.addEventListener('touchstart',e=>{e.preventDefault();keys.right=true;});
  br.addEventListener('touchend',e=>{e.preventDefault();keys.right=false;});
  bu.addEventListener('touchstart',e=>{e.preventDefault();keys.up=true;});
  bu.addEventListener('touchend',e=>{e.preventDefault();keys.up=false;});
  bp.addEventListener('click',togglePause);
}

// === ⏱️ TIMER — MULAI 30 DETIK, BERKURANG TIAP RONDE ===
function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(()=>{
    if(gameState.isPaused||gameState.isGameOver) return;
    gameState.timeLeft--;
    document.getElementById('timer').textContent = gameState.timeLeft;
    document.querySelector('.timer').style.color = gameState.timeLeft<=10?'#ff4757':'#fffa65';
    if(gameState.timeLeft<=0) endRound();
  },1000);
}

// === ✨ BINTANG OTOMATIS BERTAMBAH SAAT HABIS ===
function startStarRegen() {
  // Tiap 5 detik: jika sisa bintang ≤3 → tambah 5 bintang baru!
  gameState.starRegenTimer = setInterval(()=>{
    if(gameState.isPaused||gameState.isGameOver) return;
    const activeStars = stars.filter(s=>!s.collected).length;
    if(activeStars <= 3) {
      for(let i=0; i<5; i++) {
        stars.push({
          x: Math.random()*(canvas.width-30),
          y: Math.random()*(canvas.height-160),
          w:28, h:28,
          vx: (Math.random()>0.5?1:-1)*(0.5+gameState.round*0.08),
          vy: (Math.random()>0.5?1:-1)*(0.5+gameState.round*0.08),
          collected: false,
          newBorn: true
        });
      }
      playSound(520);
    }
    updateStarCount();
  }, 5000);
}

// === BUAT BINTANG & RINTANGAN AWAL ===
function spawnObjects() {
  // ⭐ BINTANG BERGERAK — Banyak, lambat, mudah diambil
  for(let i=0; i<15; i++) {
    stars.push({
      x:Math.random()*(canvas.width-30), y:Math.random()*(canvas.height-160),
      w:28, h:28, vx:(Math.random()>0.5?1:-1)*0.5, vy:(Math.random()>0.5?1:-1)*0.5,
      collected:false
    });
  }
  // 🧱 RINTANGAN — Sedikit & lambat
  for(let i=0; i<2; i++) {
    obstacles.push({
      x:Math.random()*canvas.width, y:Math.random()*(canvas.height-120),
      w:40+Math.random()*20, h:40+Math.random()*20,
      vx:(Math.random()>0.5?1:-1)*0.7, vy:(Math.random()>0.5?1:-1)*0.7
    });
  }
  updateStarCount();
}

// === UPDATE JUMLAH BINTANG ===
function updateStarCount() {
  document.getElementById('starCount').textContent = stars.filter(s=>!s.collected).length;
}

// === LOOP UTAMA ===
function update() {
  if(gameState.isGameOver) return;
  if(!gameState.isPaused) {
    updatePlayer();
    updateStars();
    updateObstacles();
    checkCollisions();
    render();
  }
  gameLoop = requestAnimationFrame(update);
}

// === GERAKAN PEMAIN ===
function updatePlayer() {
  player.vx = keys.left ? -player.speed : keys.right ? player.speed : 0;
  if(keys.up && player.onGround){ player.vy=-14; player.onGround=false; }
  player.vy += 0.6;
  player.x += player.vx; player.y += player.vy;
  if(player.x<0) player.x=0;
  if(player.x>canvas.width-player.w) player.x=canvas.width-player.w;
  if(player.y>canvas.height-player.h-25){ player.y=canvas.height-player.h-25; player.vy=0; player.onGround=true; }
}

// === ⭐ BINTANG BERGERAK — TETAP ADA ===
function updateStars() {
  stars.forEach(s=>{
    if(!s.collected){
      s.x += s.vx; s.y += s.vy;
      if(s.x<0||s.x>canvas.width-s.w) s.vx*=-1;
      if(s.y<0||s.y>canvas.height-s.h-25) s.vy*=-1;
      s.newBorn = false;
    }
  });
  updateStarCount();
}

// === RINTANGAN BERGERAK — TETAP ADA ===
function updateObstacles() {
  obstacles.forEach(o=>{
    o.x += o.vx; o.y += o.vy;
    if(o.x<0||o.x>canvas.width-o.w) o.vx*=-1;
    if(o.y<0||o.y>canvas.height-o.h-25) o.vy*=-1;
  });
}

// === TABRAKAN ===
function checkCollisions() {
  // ⭐ Ambil Bintang = +10 Poin
  stars.forEach(s=>{
    if(!s.collected && isCollide(player,s)){
      s.collected=true; gameState.score+=10;
      playSound(880); updateUI();
    }
  });

  // 🧱 Kena Rintangan = -1 Nyawa → BINTANG & RINTANGAN TETAP ADA!
  obstacles.forEach(o=>{
    if(isCollide(player,o)){
      gameState.lives--; playSound(220); updateUI();
      resetPlayer(); // Hanya pemain kembali ke posisi awal
      if(gameState.lives<=0) gameOver();
    }
  });
}

function isCollide(a,b){
  return a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y;
}

// === ⭐ GAMBAR BINTANG (FUNGSI KHUSUS) ===
function drawStar(x, y, r) {
  ctx.beginPath();
  for(let i=0; i<10; i++){
    const angle = (i * Math.PI / 5) - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r/2;
    ctx.lineTo(x + Math.cos(angle)*radius, y + Math.sin(angle)*radius);
  }
  ctx.closePath();
  ctx.fill();
}

// === GAMBAR DI LAYAR ===
function render() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // Langit
  const g=ctx.createLinearGradient(0,0,0,canvas.height);
  g.addColorStop(0,'#87ceeb'); g.addColorStop(1,'#e0f7fa');
  ctx.fillStyle=g; ctx.fillRect(0,0,canvas.width,canvas.height);
  // Tanah
  ctx.fillStyle='#4caf50'; ctx.fillRect(0,canvas.height-25,canvas.width,25);
  
  // ⭐ BINTANG — Berbentuk Bintang Kuning!
  stars.forEach(s=>{
    if(!s.collected){
      // Bintang baru berkedip biar kelihatan
      if(s.newBorn && Math.floor(Date.now()/200)%2===0) return;
      ctx.fillStyle='#ffd700';
      drawStar(s.x+14, s.y+14, 14); // Gambar bintang
      ctx.fillStyle='#ffb300';
      drawStar(s.x+14, s.y+14, 8);  // Bagian dalam bintang
    }
  });

  // 🧱 RINTANGAN
  obstacles.forEach(o=>{
    ctx.fillStyle='#e74c3c'; ctx.fillRect(o.x,o.y,o.w,o.h);
    ctx.fillStyle='#c0392b'; ctx.fillRect(o.x+3,o.y+3,o.w-6,o.h-6);
  });

  // 🟦 PEMAIN
  ctx.fillStyle='#3498db'; ctx.fillRect(player.x,player.y,player.w,player.h);
  ctx.fillStyle='#fff'; ctx.beginPath();
  ctx.arc(player.x+11,player.y+14,5,0,Math.PI*2);
  ctx.arc(player.x+25,player.y+14,5,0,Math.PI*2); ctx.fill();
}

// === ⏭️ RONDE BERIKUTNYA — 5 RONDE, WAKTU BERKURANG TIAP RONDE ===
function endRound() {
  if(gameState.round >= gameState.maxRounds){ gameOver(true); return; }
  gameState.round++;
  // ⏱️ WAKTU BERKURANG 3 DETIK TIAP RONDE, MINIMAL 15 DETIK
  gameState.timeLeft = Math.max(gameState.minTime, gameState.baseTime - (gameState.round-1)*3);
  resetPlayer(); spawnObjects();
  updateUI();
}

// === GAME OVER ===
function gameOver(isWin=false) {
  gameState.isGameOver = true;
  clearInterval(timerInterval);
  clearInterval(gameState.starRegenTimer);
  cancelAnimationFrame(gameLoop);
  saveScore();
  document.getElementById('goTitle').textContent = isWin?'🎉 MENANG!':'💀 GAME OVER';
  document.getElementById('finalScore').textContent = gameState.score;
  document.getElementById('finalRound').textContent = gameState.round;
  document.getElementById('goOverlay').classList.add('active');
}

// === SIMPAN KE GOOGLE SHEET ===
async function saveScore() {
  try{
    await fetch(SHEET_URL, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({username:user.username, whatsapp:user.whatsapp, score:gameState.score, round:gameState.round})
    });
  }catch(e){console.log('Gagal simpan:',e);}
}

// === LEADERBOARD ===
async function showLB() {
  document.getElementById('lobbyScreen').classList.remove('active');
  document.getElementById('lbScreen').classList.add('active');
  try{
    const r = await fetch(SHEET_URL);
    const d = await r.json();
    const list = document.getElementById('lbList'); list.innerHTML='';
    if(!d.length){ list.innerHTML='<p style="text-align:center;color:#aaa;">Belum ada pemain</p>'; return; }
    d.forEach((item,i)=>{ list.innerHTML += `<div class="lb-item"><span>${i+1}. ${item[0]}</span><span>${item[2]} poin</span></div>`; });
  }catch(e){ document.getElementById('lbList').innerHTML='<p style="text-align:center;color:#f66;">Gagal memuat ranking</p>'; }
}
function hideLB() {
  document.getElementById('lbScreen').classList.remove('active');
  document.getElementById('lobbyScreen').classList.add('active');
}

// === UPDATE UI ===
function updateUI() {
  document.getElementById('hearts').textContent = '❤️'.repeat(gameState.lives);
  document.getElementById('round').textContent = gameState.round;
  document.getElementById('score').textContent = gameState.score;
  document.getElementById('timer').textContent = gameState.timeLeft;
}

// === PAUSE & NAVIGASI ===
function togglePause() { if(gameState.isGameOver) return; gameState.isPaused=!gameState.isPaused; document.getElementById('pauseOverlay').classList.toggle('active',gameState.isPaused); }
function resumeGame() { gameState.isPaused=false; document.getElementById('pauseOverlay').classList.remove('active'); }
function quitGame() { gameState.isGameOver=true; clearInterval(timerInterval); clearInterval(gameState.starRegenTimer); cancelAnimationFrame(gameLoop); goToLobby(); }
function restartGame() { document.getElementById('goOverlay').classList.remove('active'); initGame(); }
function goToLobby() {
  document.getElementById('goOverlay').classList.remove('active');
  document.getElementById('pauseOverlay').classList.remove('active');
  document.getElementById('gameScreen').classList.remove('active');
  document.getElementById('lobbyScreen').classList.add('active');
  document.querySelector('.timer').style.color='#fffa65';
}

// === SUARA EFEK ===
function playSound(freq, dur=100) {
  try{
    const a = new (window.AudioContext||window.webkitAudioContext)();
    const o = a.createOscillator(); const g = a.createGain();
    o.connect(g); g.connect(a.destination);
    o.frequency.value=freq; o.type='sine';
    g.gain.setValueAtTime(0.15,a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,a.currentTime+dur/1000);
    o.start(a.currentTime); o.stop(a.currentTime+dur/1000);
  }catch(e){}
}
