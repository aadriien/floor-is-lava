const video = document.getElementById("webcam");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const scoreElement = document.getElementById("score");

let score = 0;
let jumpDetected = false;
const jumpThreshold = 0.4; // Normalized Y (0–1)

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

    drawLavaSpots(); // Draw lava spots before pose overlays
    
    if (results.poseLandmarks) {
        drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
            color: '#00FF00', lineWidth: 4
        });
        drawLandmarks(ctx, results.poseLandmarks, {
            color: '#FF0000', lineWidth: 2
        });
        
        detectJump(results.poseLandmarks);
        detectArmMovement(results.poseLandmarks);
        detectLavaStep(results.poseLandmarks);
    }
}

function detectJump(landmarks) {
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];
    
    if (!leftAnkle || !rightAnkle || leftAnkle.visibility < 0.3 || rightAnkle.visibility < 0.3) {
        return;
    }
    
    const avgFootY = (leftAnkle.y + rightAnkle.y) / 2;
    
    if (avgFootY < jumpThreshold) {
        if (!jumpDetected) {
            jumpDetected = true;
            score++;
            scoreElement.textContent = score;
            console.log("JUMP DETECTED!");
        }
    } else {
        jumpDetected = false;
    }
}


let lastWristY = null;
let armState = "rest"; // rest → up → down

function detectArmMovement(landmarks) {
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];

    if (!leftWrist || !rightWrist || leftWrist.visibility < 0.5 || rightWrist.visibility < 0.5) {
        return;
    }

    const avgWristY = (leftWrist.y + rightWrist.y) / 2;

    if (lastWristY === null) {
        lastWristY = avgWristY;
        return;
    }

    const deltaY = avgWristY - lastWristY;

    // Tunable thresholds (positive = moving down, negative = moving up)
    const raiseThreshold = -0.05;
    const dropThreshold = 0.08;

    switch (armState) {
        case "rest":
            if (deltaY < raiseThreshold) {
                armState = "up";
            }
            break;
        case "up":
            if (deltaY > dropThreshold) {
                console.log("ARM FLAP DETECTED!");
                armState = "rest";
                score++;
                scoreElement.textContent = score;
            }
            break;
    }

    lastWristY = avgWristY;
}



// Use normalized (0–1) coordinates
const lavaSpots = [
    { x: 0.2, y: 0.85, radius: 30 },
    { x: 0.5, y: 0.9, radius: 20 },
    { x: 0.75, y: 0.88, radius: 40 },
];


function drawLavaSpots() {
    const time = Date.now() * 0.005;

    lavaSpots.forEach(spot => {
        const cx = spot.x * canvas.width;
        const cy = spot.y * canvas.height;

        const pulse = Math.sin(time + cx * 0.01) * 10;

        ctx.save();
        ctx.shadowColor = "red";
        ctx.shadowBlur = 20 + pulse;

        const grad = ctx.createRadialGradient(
            cx, cy, 10,
            cx, cy, spot.radius
        );
        grad.addColorStop(0, "#ff6600");
        grad.addColorStop(0.5, "#cc0000");
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, spot.radius + pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}



function isInLava(x, y) {
    return lavaSpots.some(spot => {
        const cx = spot.x * canvas.width;
        const cy = spot.y * canvas.height;
        const dx = x - cx;
        const dy = y - cy;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < spot.radius;
    });
}



const lavaWarning = document.getElementById("lava-warning");

function detectLavaStep(landmarks) {
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];

    if (!leftWrist || !rightWrist) return;

    // Convert normalized coordinates to canvas space
    const lx = leftWrist.x * canvas.width;
    const ly = leftWrist.y * canvas.height;
    const rx = rightWrist.x * canvas.width;
    const ry = rightWrist.y * canvas.height;

    if (isInLava(lx, ly) || isInLava(rx, ry)) {
        console.log("STEPPED IN LAVA!");

        lavaWarning.classList.remove("hidden");

        // Hide again after 1 second
        clearTimeout(lavaWarning._timeout);
        lavaWarning._timeout = setTimeout(() => {
            lavaWarning.classList.add("hidden");
        }, 1000);
    }
}





