import {
    HandLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";


// =====================================================
// ELEMENTS
// =====================================================

const video = document.getElementById("webcam");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");

const cameraMessage =
    document.getElementById("cameraMessage");

const currentWord =
    document.getElementById("currentWord");

const sentence =
    document.getElementById("sentence");

const resetButton =
    document.getElementById("resetButton");

const speakButton =
    document.getElementById("speakButton");


// =====================================================
// WORD INPUTS
// =====================================================

const inputs = {

    index:
        document.getElementById("indexInput"),

    middle:
        document.getElementById("middleInput"),

    ring:
        document.getElementById("ringInput"),

    pinky:
        document.getElementById("pinkyInput")

};


// =====================================================
// MEDIAPIPE
// =====================================================

let handLandmarker = null;

let lastVideoTime = -1;


// =====================================================
// FINGER INFORMATION
// =====================================================

const fingers = {

    index: {
        tip: 8,
        name: "index"
    },

    middle: {
        tip: 12,
        name: "middle"
    },

    ring: {
        tip: 16,
        name: "ring"
    },

    pinky: {
        tip: 20,
        name: "pinky"
    }

};


// =====================================================
// TOUCH STATE
// =====================================================

const fingerState = {

    index: false,
    middle: false,
    ring: false,
    pinky: false

};


// =====================================================
// SENTENCE
// =====================================================

let sentenceWords = [];


// =====================================================
// VOICE
// =====================================================

let voiceEnabled = false;


// Prevent accidental double activations

let lastActivation = 0;

const ACTIVATION_COOLDOWN = 400;


// =====================================================
// INITIALIZE MEDIAPIPE
// =====================================================

async function initialize() {

    try {

        console.log(
            "Loading hand tracking..."
        );


        const vision =
            await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
            );


        handLandmarker =
            await HandLandmarker.createFromOptions(
                vision,
                {

                    baseOptions: {

                        modelAssetPath:
                            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"

                    },

                    runningMode: "VIDEO",

                    numHands: 1,

                    minHandDetectionConfidence:
                        0.5,

                    minHandPresenceConfidence:
                        0.5,

                    minTrackingConfidence:
                        0.5

                }
            );


        console.log(
            "Hand tracking loaded!"
        );


        await startCamera();

    }

    catch (error) {

        console.error(
            "Could not initialize:",
            error
        );


        cameraMessage.innerHTML = `
            <p>
                Camera couldn't start.
                <br><br>
                Please make sure you allowed
                camera access and reload the page.
            </p>
        `;

    }

}


// =====================================================
// START CAMERA
// =====================================================

async function startCamera() {

    try {

        const stream =
            await navigator.mediaDevices.getUserMedia({

                video: {

                    facingMode: "user",

                    width: {
                        ideal: 1280
                    },

                    height: {
                        ideal: 720
                    }

                },

                audio: false

            });


        video.srcObject = stream;


        video.addEventListener(
            "loadeddata",
            () => {

                cameraMessage.classList.add(
                    "hidden"
                );

                requestAnimationFrame(
                    predict
                );

            },
            {
                once: true
            }
        );


    }

    catch (error) {

        console.error(
            "Camera error:",
            error
        );


        cameraMessage.innerHTML = `
            <p>
                Please allow camera access
                to use Finger Words.
            </p>
        `;

    }

}


// =====================================================
// DISTANCE BETWEEN TWO LANDMARKS
// =====================================================

function distance(a, b) {

    const dx =
        a.x - b.x;

    const dy =
        a.y - b.y;

    const dz =
        a.z - b.z;


    return Math.sqrt(
        dx * dx +
        dy * dy +
        dz * dz
    );

}


// =====================================================
// CHECK IF FINGER IS TOUCHING THUMB
// =====================================================

function isTouching(
    thumb,
    fingertip
) {

    /*
        Lower number =
        requires more precise touch.

        Higher number =
        easier to activate.
    */

    const TOUCH_THRESHOLD = 0.075;


    return (
        distance(
            thumb,
            fingertip
        ) < TOUCH_THRESHOLD
    );

}


// =====================================================
// DRAW A CIRCLE
// =====================================================

function drawCircle(
    point,
    radius,
    color
) {

    ctx.beginPath();

    ctx.arc(
        point.x * canvas.width,
        point.y * canvas.height,
        radius,
        0,
        Math.PI * 2
    );

    ctx.fillStyle = color;

    ctx.fill();

}


// =====================================================
// DRAW A LINE
// =====================================================

function drawLine(
    a,
    b
) {

    ctx.beginPath();

    ctx.moveTo(
        a.x * canvas.width,
        a.y * canvas.height
    );

    ctx.lineTo(
        b.x * canvas.width,
        b.y * canvas.height
    );

    ctx.stroke();

}


// =====================================================
// DRAW HAND SKELETON
// =====================================================

function drawHand(hand) {

    const connections = [

        // Thumb
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],

        // Index
        [0, 5],
        [5, 6],
        [6, 7],
        [7, 8],

        // Middle
        [5, 9],
        [9, 10],
        [10, 11],
        [11, 12],

        // Ring
        [9, 13],
        [13, 14],
        [14, 15],
        [15, 16],

        // Pinky
        [13, 17],
        [17, 18],
        [18, 19],
        [19, 20],

        // Palm
        [0, 17]

    ];


    ctx.lineWidth = 2;

    ctx.strokeStyle =
        "rgba(255,255,255,0.35)";


    for (
        const [a, b]
        of connections
    ) {

        drawLine(
            hand[a],
            hand[b]
        );

    }


    /*
        Small landmark dots.
    */

    for (
        const point
        of hand
    ) {

        drawCircle(
            point,
            3,
            "rgba(255,255,255,0.6)"
        );

    }

}


// =====================================================
// DRAW FINGER WORD
// =====================================================

function drawFingerWord(
    word,
    point,
    touching
) {

    const x =
        point.x * canvas.width;

    const y =
        point.y * canvas.height - 40;


    ctx.save();


    ctx.textAlign = "center";

    ctx.textBaseline = "middle";


    const fontSize =
        touching
            ? 25
            : 18;


    ctx.font =
        `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;


    const textWidth =
        ctx.measureText(word).width;


    const horizontalPadding =
        touching
            ? 17
            : 12;


    const width =
        textWidth +
        horizontalPadding * 2;


    const height =
        touching
            ? 40
            : 32;


    const left =
        x - width / 2;

    const top =
        y - height / 2;


    /*
        Activated words get a glow.
    */

    if (touching) {

        ctx.shadowColor =
            "rgba(255,111,145,0.65)";

        ctx.shadowBlur = 22;

    }


    /*
        Rounded bubble.
    */

    drawRoundedRectangle(
        left,
        top,
        width,
        height,
        height / 2
    );


    ctx.fillStyle =
        touching
            ? "#ff6f91"
            : "rgba(255,255,255,0.92)";


    ctx.fill();


    ctx.shadowBlur = 0;


    ctx.fillStyle =
        touching
            ? "#ffffff"
            : "#222222";


    ctx.fillText(
        word,
        x,
        y
    );


    ctx.restore();

}


// =====================================================
// ROUNDED RECTANGLE
// =====================================================

function drawRoundedRectangle(
    x,
    y,
    width,
    height,
    radius
) {

    ctx.beginPath();

    ctx.moveTo(
        x + radius,
        y
    );

    ctx.lineTo(
        x + width - radius,
        y
    );

    ctx.quadraticCurveTo(
        x + width,
        y,
        x + width,
        y + radius
    );

    ctx.lineTo(
        x + width,
        y + height - radius
    );

    ctx.quadraticCurveTo(
        x + width,
        y + height,
        x + width - radius,
        y + height
    );

    ctx.lineTo(
        x + radius,
        y + height
    );

    ctx.quadraticCurveTo(
        x,
        y + height,
        x,
        y + height - radius
    );

    ctx.lineTo(
        x,
        y + radius
    );

    ctx.quadraticCurveTo(
        x,
        y,
        x + radius,
        y
    );

    ctx.closePath();

}


// =====================================================
// GET WORD FROM INPUT
// =====================================================

function getWord(
    fingerName
) {

    const value =
        inputs[fingerName].value.trim();


    if (value.length === 0) {

        return "...";

    }


    return value;

}


// =====================================================
// PROCESS THE HAND
// =====================================================

function processHand(hand) {

    /*
        Thumb tip:
        landmark 4
    */

    const thumb =
        hand[4];


    drawHand(hand);


    let touchingAnything = false;


    for (
        const finger
        of Object.values(fingers)
    ) {

        const fingertip =
            hand[finger.tip];


        const touching =
            isTouching(
                thumb,
                fingertip
            );


        const word =
            getWord(
                finger.name
            );


        /*
            Draw fingertip.

            Pink when touching.
        */

        drawCircle(
            fingertip,
            touching ? 10 : 5,
            touching
                ? "#ff6f91"
                : "#ffffff"
        );


        /*
            Draw the word attached
            to the fingertip.
        */

        drawFingerWord(
            word,
            fingertip,
            touching
        );


        /*
            IMPORTANT:

            Only activate when the finger
            changes from NOT touching
            → touching.

            This prevents the same word
            from being added every frame.
        */

        if (
            touching &&
            !fingerState[finger.name]
        ) {

            activateFinger(
                finger.name,
                word
            );

        }


        /*
            Save current state.
        */

        fingerState[finger.name] =
            touching;


        if (touching) {

            touchingAnything = true;

        }

    }


    /*
        Hide current word when
        no finger is touching.
    */

    if (!touchingAnything) {

        currentWord.classList.remove(
            "visible"
        );

    }

}


// =====================================================
// ACTIVATE A WORD
// =====================================================

function activateFinger(
    fingerName,
    word
) {

    const now =
        Date.now();


    /*
        Prevent tracking jitter
        from causing accidental
        double activations.
    */

    if (
        now - lastActivation <
        ACTIVATION_COOLDOWN
    ) {

        return;

    }


    lastActivation =
        now;


    /*
        Add word to sentence.
    */

    sentenceWords.push(word);


    renderSentence();


    /*
        Display the active word.
    */

    currentWord.innerHTML =
        `<span>${escapeHTML(word)}</span>`;


    currentWord.classList.add(
        "visible"
    );


    /*
        Restart the pop animation.
    */

    currentWord.classList.remove(
        "pop"
    );


    void currentWord.offsetWidth;


    currentWord.classList.add(
        "pop"
    );


    /*
        Optional speech.
    */

    if (voiceEnabled) {

        speakWord(word);

    }

}


// =====================================================
// RENDER SENTENCE
// =====================================================

function renderSentence() {

    if (
        sentenceWords.length === 0
    ) {

        sentence.innerHTML = `
            <span class="placeholder">
                Your words will appear here
            </span>
        `;

        return;

    }


    sentence.innerHTML =
        sentenceWords
            .map(
                word => `
                    <span class="word-chip">
                        ${escapeHTML(word)}
                    </span>
                `
            )
            .join("");

}


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHTML(value) {

    return value
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


// =====================================================
// TEXT TO SPEECH
// =====================================================

function speakWord(word) {

    if (
        !("speechSynthesis" in window)
    ) {

        return;

    }


    window.speechSynthesis.cancel();


    const utterance =
        new SpeechSynthesisUtterance(
            word
        );


    utterance.rate = 0.95;

    utterance.pitch = 1.05;


    window.speechSynthesis.speak(
        utterance
    );

}


// =====================================================
// RESET BUTTON
// =====================================================

resetButton.addEventListener(
    "click",
    () => {

        sentenceWords = [];


        renderSentence();


        currentWord.classList.remove(
            "visible"
        );


        /*
            Reset finger states.
        */

        for (
            const finger
            of Object.keys(fingerState)
        ) {

            fingerState[finger] =
                false;

        }

    }
);


// =====================================================
// VOICE BUTTON
// =====================================================

speakButton.addEventListener(
    "click",
    () => {

        voiceEnabled =
            !voiceEnabled;


        speakButton.classList.toggle(
            "active",
            voiceEnabled
        );


        speakButton.textContent =
            voiceEnabled
                ? "🔊 Voice: On"
                : "🔊 Voice: Off";

    }
);


// =====================================================
// MAIN CAMERA LOOP
// =====================================================

async function predict() {

    if (
        !handLandmarker ||
        video.readyState < 2
    ) {

        requestAnimationFrame(
            predict
        );

        return;

    }


    /*
        Make the canvas exactly
        the same size as the video.
    */

    if (
        canvas.width !== video.videoWidth ||
        canvas.height !== video.videoHeight
    ) {

        canvas.width =
            video.videoWidth;

        canvas.height =
            video.videoHeight;

    }


    /*
        Clear previous frame.
    */

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    /*
        Only process a new video frame.
    */

    if (
        video.currentTime !==
        lastVideoTime
    ) {

        lastVideoTime =
            video.currentTime;


        const results =
            handLandmarker.detectForVideo(
                video,
                performance.now()
            );


        /*
            Did MediaPipe find a hand?
        */

        if (
            results.landmarks &&
            results.landmarks.length > 0
        ) {

            processHand(
                results.landmarks[0]
            );

        }

        else {

            /*
                No hand detected.
            */

            currentWord.classList.remove(
                "visible"
            );


            /*
                Reset finger states so
                the next touch counts
                as a new activation.
            */

            for (
                const finger
                of Object.keys(fingerState)
            ) {

                fingerState[finger] =
                    false;

            }

        }

    }


    requestAnimationFrame(
        predict
    );

}


// =====================================================
// START EVERYTHING
// =====================================================

initialize();
