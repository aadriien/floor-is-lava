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
    
    if (results.poseLandmarks) {
        drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
            color: '#00FF00', lineWidth: 4
        });
        drawLandmarks(ctx, results.poseLandmarks, {
            color: '#FF0000', lineWidth: 2
        });
        
        detectJump(results.poseLandmarks);
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
