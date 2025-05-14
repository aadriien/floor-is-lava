const video = document.getElementById("webcam");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const scoreElement = document.getElementById("score");
const missedElement = document.getElementById("missed");

let score = 0;
let missed = 0;
let latestLandmarks = null;

let poseInitialized = false;
let poseInitializedAt = null;


// let jumpDetected = false;
// const jumpThreshold = 0.4; // Normalized Y (0–1)

// Resize canvas when video is ready
video.onloadedmetadata = () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
};

// Setup MediaPipe Pose
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

// Setup camera
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

    // drawLavaSpots(); // Draw lava spots before pose overlays
    // drawTargets(); // Draw targets before pose overlays
    
    if (results.poseLandmarks) {
        latestLandmarks = results.poseLandmarks;
        
        if (!poseInitialized) {
            poseInitialized = true;
            poseInitializedAt = Date.now();
        }
        
        // detectJump(results.poseLandmarks);
        // detectArmMovement(results.poseLandmarks);
        // detectLavaStep(results.poseLandmarks);

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

// function detectJump(landmarks) {
//     const leftAnkle = landmarks[27];
//     const rightAnkle = landmarks[28];
    
//     if (!leftAnkle || !rightAnkle || leftAnkle.visibility < 0.3 || rightAnkle.visibility < 0.3) {
//         return;
//     }
    
//     const avgFootY = (leftAnkle.y + rightAnkle.y) / 2;
    
//     if (avgFootY < jumpThreshold) {
//         if (!jumpDetected) {
//             jumpDetected = true;
//             score++;
//             scoreElement.textContent = score;
//             console.log("JUMP DETECTED!");
//         }
//     } else {
//         jumpDetected = false;
//     }
// }


// let lastWristY = null;
// let armState = "rest"; // rest → up → down

// function detectArmMovement(landmarks) {
//     const leftWrist = landmarks[15];
//     const rightWrist = landmarks[16];

//     if (!leftWrist || !rightWrist || leftWrist.visibility < 0.5 || rightWrist.visibility < 0.5) {
//         return;
//     }

//     const avgWristY = (leftWrist.y + rightWrist.y) / 2;

//     if (lastWristY === null) {
//         lastWristY = avgWristY;
//         return;
//     }

//     const deltaY = avgWristY - lastWristY;

//     // Tunable thresholds (positive = moving down, negative = moving up)
//     const raiseThreshold = -0.05;
//     const dropThreshold = 0.08;

//     switch (armState) {
//         case "rest":
//             if (deltaY < raiseThreshold) {
//                 armState = "up";
//             }
//             break;
//         case "up":
//             if (deltaY > dropThreshold) {
//                 console.log("ARM FLAP DETECTED!");
//                 armState = "rest";
//                 score++;
//                 scoreElement.textContent = score;
//             }
//             break;
//     }

//     lastWristY = avgWristY;
// }



// Use normalized (0–1) coordinates
// const lavaSpots = [
//     { x: 0.2, y: 0.85, radius: 30 },
//     { x: 0.5, y: 0.9, radius: 20 },
//     { x: 0.75, y: 0.88, radius: 40 },
// ];


// function drawLavaSpots() {
//     const time = Date.now() * 0.005;

//     lavaSpots.forEach(spot => {
//         const cx = spot.x * canvas.width;
//         const cy = spot.y * canvas.height;

//         const pulse = Math.sin(time + cx * 0.01) * 10;

//         ctx.save();
//         ctx.shadowColor = "red";
//         ctx.shadowBlur = 20 + pulse;

//         const grad = ctx.createRadialGradient(
//             cx, cy, 10,
//             cx, cy, spot.radius
//         );
//         grad.addColorStop(0, "#ff6600");
//         grad.addColorStop(0.5, "#cc0000");
//         grad.addColorStop(1, "rgba(0, 0, 0, 0)");

//         ctx.fillStyle = grad;
//         ctx.beginPath();
//         ctx.arc(cx, cy, spot.radius + pulse, 0, Math.PI * 2);
//         ctx.fill();
//         ctx.restore();
//     });
// }



// function isInLava(x, y) {
//     return lavaSpots.some(spot => {
//         const cx = spot.x * canvas.width;
//         const cy = spot.y * canvas.height;
//         const dx = x - cx;
//         const dy = y - cy;
//         const distance = Math.sqrt(dx * dx + dy * dy);
//         return distance < spot.radius;
//     });
// }



// const lavaWarning = document.getElementById("lava-warning");

// function detectLavaStep(landmarks) {
//     const leftWrist = landmarks[15];
//     const rightWrist = landmarks[16];

//     if (!leftWrist || !rightWrist) return;

//     // Convert normalized coordinates to canvas space
//     const lx = leftWrist.x * canvas.width;
//     const ly = leftWrist.y * canvas.height;
//     const rx = rightWrist.x * canvas.width;
//     const ry = rightWrist.y * canvas.height;

//     if (isInLava(lx, ly) || isInLava(rx, ry)) {
//         console.log("STEPPED IN LAVA!");

//         lavaWarning.classList.remove("hidden");

//         // Hide again after 1 second
//         clearTimeout(lavaWarning._timeout);
//         lavaWarning._timeout = setTimeout(() => {
//             lavaWarning.classList.add("hidden");
//         }, 1000);
//     }
// }



let targets = [];


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


const targetHit = document.getElementById("target-hit");

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






