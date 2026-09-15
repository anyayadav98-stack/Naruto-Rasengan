const camVideo = document.getElementById('cam');
const canvas   = document.getElementById('skeleton');
const pen      = canvas.getContext('2d');
const orbs     = Array.from(document.querySelectorAll('.rasengan'));

// Left hand = warm orange, Right hand = cool chakra blue
const PALETTES = {
  Left:  { bone: '#ff8a3d', joint: '#fff36a', glow: '#ff5e1a' },
  Right: { bone: '#62f0ff', joint: '#ff66e0', glow: '#1aa6ff' }
};

// Har hand ke liye alag se charge (fade-in/out) track karega
const orbState = [
  { charge: 0, wasOpen: false },
  { charge: 0, wasOpen: false }
];

const FINGER_TIPS     = [8, 12, 16, 20];
const FINGER_KNUCKLES = [6, 10, 14, 18];

// Check karta hai palm open hai ya nahi
function isPalmOpen(lm) {
  const wrist = lm[0];
  let extended = 0;
  for (let i = 0; i < FINGER_TIPS.length; i++) {
    const tip = lm[FINGER_TIPS[i]];
    const knk = lm[FINGER_KNUCKLES[i]];
    const dTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
    const dKnk = Math.hypot(knk.x - wrist.x, knk.y - wrist.y);
    if (dTip > dKnk) extended++;
  }
  return extended >= 3; // 3+ fingers open = palm open
}

// Skeleton (bones + joints) draw karta hai canvas pe
function paintSkeleton(lm, colors) {
  pen.save();
  pen.shadowBlur  = 18;
  pen.shadowColor = colors.glow;
  drawConnectors(pen, lm, HAND_CONNECTIONS, { color: colors.bone, lineWidth: 3 });
  pen.restore();

  pen.save();
  pen.shadowBlur  = 10;
  pen.shadowColor = colors.glow;
  pen.fillStyle   = colors.joint;
  for (const p of lm) {
    pen.beginPath();
    pen.arc(p.x * canvas.width, p.y * canvas.height, 3.5, 0, Math.PI * 2);
    pen.fill();
  }
  pen.restore();
}

// Rasengan orb ko palm ke upar sahi jagah pe place karta hai
function placeOrb(slot, lm, charge) {
  const wrist  = lm[0];
  const midKnk = lm[9];

  const cx = (wrist.x + midKnk.x) / 2;
  const cy = (wrist.y + midKnk.y) / 2;
  const handSize = Math.hypot(midKnk.x - wrist.x, midKnk.y - wrist.y);
  const lift = handSize * 1.8;

  const orb = orbs[slot];
  orb.style.left    = `${(1 - cx) * window.innerWidth}px`;
  orb.style.top     = `${(cy - lift) * window.innerHeight}px`;
  orb.style.opacity = charge.toFixed(3);
}

// Har frame pe ye function call hota hai (MediaPipe se result aate hi)
function onResults(res) {
  canvas.width  = camVideo.videoWidth  || canvas.clientWidth;
  canvas.height = camVideo.videoHeight || canvas.clientHeight;
  pen.clearRect(0, 0, canvas.width, canvas.height);

  const seen = [false, false];

  if (res.multiHandLandmarks && res.multiHandedness) {
    res.multiHandLandmarks.forEach((lm, i) => {
      const label  = res.multiHandedness[i].label; // "Left" | "Right"
      const slot   = label === 'Right' ? 1 : 0;
      const colors = PALETTES[label] || PALETTES.Left;
      seen[slot]   = true;

      paintSkeleton(lm, colors);

      const open = isPalmOpen(lm);
      const st   = orbState[slot];
      st.charge  = Math.max(0, Math.min(1, st.charge + (open ? 0.06 : -0.18)));

      if (open && !st.wasOpen) {
        const v = orbs[slot];
        v.currentTime = 0;
        v.play().catch(err => console.warn('rasengan play failed', err));
      }
      st.wasOpen = open;

      if (st.charge > 0.01) placeOrb(slot, lm, st.charge);
      else orbs[slot].style.opacity = 0;
    });
  }

  // Jo hand is frame mein nahi dikha uska charge dheere dheere kam karo
  for (let i = 0; i < 2; i++) {
    if (seen[i]) continue;
    orbState[i].charge  = Math.max(0, orbState[i].charge - 0.18);
    orbState[i].wasOpen = false;
    orbs[i].style.opacity = orbState[i].charge.toFixed(3);
  }
}

// MediaPipe Hands setup
const hands = new Hands({
  locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
});
hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.65,
  minTrackingConfidence:  0.65
});
hands.onResults(onResults);

// Camera start karo aur har frame MediaPipe ko bhejo
const camera = new Camera(camVideo, {
  onFrame: async () => { await hands.send({ image: camVideo }); },
  width:  1280,
  height: 720
});
camera.start();