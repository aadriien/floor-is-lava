const video = document.getElementById("webcam");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const scoreElement = document.getElementById("score");

let detector;
let jumpDetected = false;
let score = 0;
const jumpThreshold = 0.15; // Adjust based on camera view

// Resize canvas to match video dimensions
function resizeCanvas() {
    if (video.videoWidth && video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        console.log("Canvas resized:", canvas.width, canvas.height);
    }
}

// Initialize webcam
async function setupWebcam() {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
    });
    video.srcObject = stream;
    
    return new Promise((resolve) => {
        video.onloadeddata = () => {
            resizeCanvas();
            resolve(video);
        };
    });
}

// Load MoveNet model
async function loadModel() {
    await tf.setBackend("webgl");
    await tf.ready();
    
    const model = poseDetection.SupportedModels.MoveNet;
    const detectorConfig = {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    };
    detector = await poseDetection.createDetector(model, detectorConfig);
}

// Draw visible keypoints on canvas
function drawKeypoints(keypoints) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (let kp of keypoints) {
        if (kp && kp.score > 0.3 && kp.x && kp.y) {
            ctx.beginPath();
            ctx.arc(kp.x, kp.y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = "red";
            ctx.fill();
        }
    }
}



let cameraDistanceFactor = 1;  // Default: close distance (scale to change)

function adjustThresholds(videoHeight) {
    // Scale thresholds based on the height of the video feed
    // e.g., further camera = higher values, closer = lower values
    cameraDistanceFactor = videoHeight / 480;  // Assuming 480px as "close" reference

    // Adjust thresholds based on distance factor
    return {
        jumpUpThreshold: -20 * cameraDistanceFactor,   // More sensitive when close
        landDownThreshold: 15 * cameraDistanceFactor,  // Less sensitive when far
    };
}




// Detect jump based on ankle Y positions
function detectJump(keypoints) {
    const leftFoot = keypoints.find(kp => kp.name === "left_ankle");
    const rightFoot = keypoints.find(kp => kp.name === "right_ankle");
    
    
    if (
        leftFoot && rightFoot &&
        leftFoot.score > 0.3 &&
        rightFoot.score > 0.3
        ) {
        const avgFootY = (leftFoot.y + rightFoot.y) / 2 / video.videoHeight;
        
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
}


function detectJumpByDelta(keypoints) {
    let lastHipY = null;
    let jumpState = "ground";

    const leftHip = keypoints.find(kp => kp.name === "left_hip");
    const rightHip = keypoints.find(kp => kp.name === "right_hip");

    if (!leftHip || !rightHip || leftHip.score < 0.2 || rightHip.score < 0.2) {
        return;
    }

    const currentHipY = (leftHip.y + rightHip.y) / 2;

    if (lastHipY === null) {
        lastHipY = currentHipY;
        return;
    }

    const deltaY = hipY - lastHipY;

    // Get dynamically adjusted thresholds
    const { jumpUpThreshold, landDownThreshold } = adjustThresholds(videoHeight);

    // Adjust this value based on camera distance
    // const jumpUpThreshold = -15;  // Fast upward motion
    // const landDownThreshold = 10; // Followed by downward motion

    switch (jumpState) {
        case "ground":
            if (deltaY < jumpUpThreshold) {
                jumpState = "up";
            }
            break;
    
        case "up":
            if (deltaY > landDownThreshold) {
                console.log("JUMP!");
                jumpState = "ground";
            }
            break;
        }
    
        lastHipY = hipY;
}

    

function detectArmRaise(keypoints) {
    let lastLeftWristY = null;
    let lastRightWristY = null;
    let armState = "ground"; // 'ground' → 'up' → 'down'

    const raiseThreshold = 20;  // Sensitivity for detecting arm raises
    const dropThreshold = -20;  // Sensitivity for detecting arm drops


    const leftWrist = keypoints.find(kp => kp.name === "left_wrist");
    const rightWrist = keypoints.find(kp => kp.name === "right_wrist");

    // console.log("Checking wrist detection")

    // If either wrist is not detected, skip this frame
    if (!leftWrist || !rightWrist || leftWrist.score < 0.2 || rightWrist.score < 0.2) {
        // console.log("Wrist NOT detected")
        return;
    }

    // console.log("Wrist detected!")


    const leftWristY = leftWrist.y;
    const rightWristY = rightWrist.y;

    if (lastLeftWristY === null || lastRightWristY === null) {
        // Initialize the first frame values
        lastLeftWristY = leftWristY;
        lastRightWristY = rightWristY;
        return;
    }

    const deltaLeft = leftWristY - lastLeftWristY;
    const deltaRight = rightWristY - lastRightWristY;


    console.log(`lastLeftWristY == ${lastLeftWristY}`)
    console.log(`lastRightWristY == ${lastRightWristY}`)

    console.log(`leftWristY == ${leftWristY}`)
    console.log(`rightWristY == ${rightWristY}`)


    // Average Y movement for both arms
    const deltaY = (deltaLeft + deltaRight) / 2;

    // Detect arm raise (upward movement)
    if (armState === "ground" && deltaY < -raiseThreshold) {
        armState = "up"; // The arms are raised
    }

    // Detect arm drop (downward movement)
    if (armState === "up" && deltaY > dropThreshold) {
        console.log("ARM RAISE DETECTED!");
        armState = "ground"; // Reset after detecting the arm raise and drop
    }

    // Update wrist positions
    lastLeftWristY = leftWristY;
    lastRightWristY = rightWristY;
}


    
// Main loop
async function runGame() {
    if (!detector) return;
    
    // Re-check canvas size every frame in case video was slow to load
    if (canvas.width !== video.videoWidth) resizeCanvas();
    
    const poses = await detector.estimatePoses(video);
    
    if (poses.length > 0) {
        const keypoints = poses[0].keypoints;
        drawKeypoints(keypoints);
        detectJump(keypoints);
        detectJumpByDelta(keypoints);
        detectArmRaise(keypoints);
    }
    
    requestAnimationFrame(runGame);
}

// Start everything
async function init() {
    await setupWebcam();
    await loadModel();
    runGame();
}

init();



    