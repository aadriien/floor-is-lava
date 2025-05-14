const video = document.getElementById("webcam");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const scoreElement = document.getElementById("score");
const missedElement = document.getElementById("missed");

const targetHit = document.getElementById("target-hit");

let score = 0;
let missed = 0;

let latestLandmarks = null;

let poseInitialized = false;
let poseInitializedAt = null;

let targets = [];


// Resize canvas when video ready
video.onloadedmetadata = () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
};


// Set up MediaPipe Pose
const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});


pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
});

pose.onResults(onResults);


// Set up camera
const camera = new Camera(video, {
    onFrame: async () => {
        await pose.send({ image: video });
    },
    width: 640,
    height: 480,
});

camera.start();


function onResults(results) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (results.poseLandmarks) {
        latestLandmarks = results.poseLandmarks;
        
        if (!poseInitialized) {
            poseInitialized = true;
            poseInitializedAt = Date.now();
        }
        
        detectTargetHits(latestLandmarks);

        drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
            color: '#00FF00', lineWidth: 4
        });
        drawLandmarks(ctx, results.poseLandmarks, {
            color: '#FF0000', lineWidth: 2
        });
    }

    drawTargets();
}


function isNearAnyWrist(target) {
    if (!latestLandmarks) return false; // allow if no data yet

    const wrists = [latestLandmarks[15], latestLandmarks[16]];
    const threshold = 80; // pixels

    for (const wrist of wrists) {
        if (!wrist || wrist.visibility < 0.5) continue;

        const wx = wrist.x * canvas.width;
        const wy = wrist.y * canvas.height;
        const tx = target.x * canvas.width;
        const ty = target.y * canvas.height;

        const dx = wx - tx;
        const dy = wy - ty;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < threshold + target.radius) {
            return true; // too close
        }
    }
    return false;
}


function spawnTarget() {
    const maxAttempts = 20;
    let attempt = 0;

    while (attempt < maxAttempts) {
        attempt++;

        const target = {
            x: Math.random(),
            y: Math.random(),
            radius: 30 + Math.random() * 20,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`,
            createdAt: Date.now(),
            ttl: Date.now() + 2500,
        };

        // Check if too close to any wrist
        if (!isNearAnyWrist(target)) {
            targets.push(target);
            break;
        }
    }
}


function drawTargets() {
    const now = Date.now();
    targets = targets.filter(target => now < target.ttl);

    targets.forEach(target => {
        const cx = target.x * canvas.width;
        const cy = target.y * canvas.height;

        const timeLeft = (target.ttl - now) / 2000;
        const pulse = Math.sin(now * 0.01) * 5;

        ctx.save();
        ctx.shadowColor = target.color;
        ctx.shadowBlur = 20;

        const grad = ctx.createRadialGradient(
            cx, cy, 5,
            cx, cy, target.radius
        );
        grad.addColorStop(0, target.color);
        grad.addColorStop(1, "rgba(0,0,0,0)");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, target.radius + pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}


function detectTargetHits(landmarks) {
    const wrists = [landmarks[15], landmarks[16]];
    if (!wrists[0] || !wrists[1]) return;

    const now = Date.now();
    const hitRadius = 30;
    const minAge = 500;

    targets = targets.filter(target => {
        if (now - target.createdAt < minAge) {
            return true; // too new to hit
        }

        if (now >= target.ttl) {
            // Don't count as missed until pose active
            if (!poseInitialized || now - poseInitializedAt < 2000) return true;

            missed++;
            missedElement.textContent = missed;
            return false; // expired, remove
        }

        const tx = target.x * canvas.width;
        const ty = target.y * canvas.height;

        for (const wrist of wrists) {
            const wx = wrist.x * canvas.width;
            const wy = wrist.y * canvas.height;

            const dx = wx - tx;
            const dy = wy - ty;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < target.radius + hitRadius) {
                console.log("HIT!");
                score++;
                scoreElement.textContent = score;

                targetHit.classList.remove("hidden");
                clearTimeout(targetHit._timeout);
                targetHit._timeout = setTimeout(() => {
                    targetHit.classList.add("hidden");
                }, 500);

                return false; // remove this target
            }
        }

        return true; // keep target
    });
}


function randomSpawnLoop() {
    // Spawn new target on some randomized interval (2.5 – 3.5 sec delay)
    spawnTarget();
    setTimeout(randomSpawnLoop, 2500 + Math.random() * 1000); 
}
randomSpawnLoop();




