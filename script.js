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
// FINGERS
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
// TOUCH STATES
// =====================================================

const fingerState = {

    index: {
        touching: false,
        frames: 0
    },

    middle: {
        touching: false,
        frames: 0
    },

    ring: {
        touching: false,
        frames: 0
    },

    pinky: {
        touching: false,
        frames: 0
    }

};


// =====================================================
// SMOOTHING
// =====================================================

const previousPositions = {};

const SMOOTHING = 0.65;


// =====================================================
// SENTENCE
// =====================================================

let sentenceWords = [];


// =====================================================
// VOICE
// =====================================================

let voiceEnabled = false;


// =====================================================
// ACTIVATION
// =====================================================

let lastActivation = 0;

const ACTIVATION_COOLDOWN = 500;


// A finger must remain touching for
// several frames before activating.

const REQUIRED_TOUCH_FRAMES = 4;


// =====================================================
// INITIALIZE
// =====================================================

async function initialize() {

    try {

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
                        0.6,

                    minHandPresenceConfidence:
                        0.6,

                    minTrackingConfidence:
                        0.6

                }
            );


        await startCamera();

    }

    catch (error) {

        console.error(error);

        cameraMessage.innerHTML = `
            <p>
                Camera couldn't start.
                <br><br>
                Please allow camera access
                and reload the page.
            </p>
        `;

    }

}


// =====================================================
// CAMERA
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
                    },

                    frameRate: {
                        ideal: 30,
                        max: 30
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

        console.error(error);

        cameraMessage.innerHTML = `
            <p>
                Please allow camera access
                to use Finger Words.
            </p>
        `;

    }

}


// =====================================================
// DISTANCE
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
// MIRROR LANDMARK
// =====================================================

function mirrorPoint(point) {

    return {

        x: 1 - point.x,

        y: point.y,

        z: point.z

    };

}


// =====================================================
// SMOOTH POINT
// =====================================================

function smoothPoint(
    point,
    id
) {

    if (!previousPositions[id]) {

        previousPositions[id] = {
            x: point.x,
            y: point.y,
            z: point.z
        };

        return previousPositions[id];

    }


    const previous =
        previousPositions[id];


    const smoothed = {

        x:
            previous.x * SMOOTHING +
            point.x * (1 - SMOOTHING),

        y:
            previous.y * SMOOTHING +
            point.y * (1 - SMOOTHING),

        z:
            previous.z * SMOOTHING +
            point.z * (1 - SMOOTHING)

    };


    previousPositions[id] =
        smoothed;


    return smoothed;

}


// =====================================================
// DRAW CIRCLE
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
// DRAW LINE
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
// DRAW HAND
// =====================================================

function drawHand(hand) {

    const connections = [

        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],

        [0, 5],
        [5, 6],
        [6, 7],
        [7, 8],

        [5, 9],
        [9, 10],
        [10, 11],
        [11, 12],

        [9, 13],
        [13, 14],
        [14, 15],
        [15, 16],

        [13, 17],
        [17, 18],
        [18, 19],
        [19, 20],

        [0, 17]

    ];


    ctx.lineWidth = 2;

    ctx.strokeStyle =
        "rgba(255,255,255,0.28)";


    for (
        const [a, b]
        of connections
    ) {

        drawLine(
            hand[a],
            hand[b]
        );

    }


    for (
        const point
        of hand
    ) {

        drawCircle(
            point,
            2.5,
            "rgba(255,255,255,0.5)"
        );

    }

}


// =====================================================
// DRAW WORD
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


    const padding =
        touching
            ? 17
            : 12;


    const width =
        textWidth + padding * 2;


    const height =
        touching
            ? 40
            : 32;


    const left =
        x - width / 2;


    const top =
        y - height / 2;


    /*
        Glow when touching.
    */

    if (touching) {

        ctx.shadowColor =
            "rgba(255,111,145,0.65)";

        ctx.shadowBlur = 20;

    }


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
// GET WORD
// =====================================================

function getWord(
    fingerName
) {

    const value =
        inputs[fingerName].value.trim();


    return value || "...";

}


// =====================================================
// TOUCH DETECTION
// =====================================================

function isTouching(
    thumb,
    fingertip
) {

    /*
        Slightly stricter than before
        to prevent false touches.
    */

    const threshold =
        0.065;


    return (
        distance(
            thumb,
            fingertip
        ) < threshold
    );

}


// =====================================================
// PROCESS HAND
// =====================================================

function processHand(
    rawHand
) {

    /*
        Mirror every landmark horizontally.

        This keeps the camera selfie-style
        while keeping text readable.
    */

    const hand =
        rawHand.map(
            mirrorPoint
        );


    /*
        Smooth all landmarks.
    */

    const smoothedHand =
        hand.map(
            (point, index) =>
                smoothPoint(
                    point,
                    index
                )
        );


    const thumb =
        smoothedHand[4];


    drawHand(
        smoothedHand
    );


    let touchingAnything =
        false;


    for (
        const finger
        of Object.values(fingers)
    ) {

        const fingertip =
            smoothedHand[
                finger.tip
            ];


        const touching =
            isTouching(
                thumb,
                fingertip
            );


        const state =
            fingerState[
                finger.name
            ];


        const word =
            getWord(
                finger.name
            );


        /*
            Stable touch detection.

            If touching, increase frame count.
            If not, reset it.
        */

        if (touching) {

            state.frames++;

        }

        else {

            state.frames = 0;

        }


        /*
            Only consider it an actual
            touch after several consecutive
            frames.
        */

        const stableTouch =
            state.frames >=
            REQUIRED_TOUCH_FRAMES;


        /*
            Draw fingertip.
        */

        drawCircle(
            fingertip,
            stableTouch
                ? 10
                : 5,
            stableTouch
                ? "#ff6f91"
                : "#ffffff"
        );


        /*
            Draw word.
        */

        drawFingerWord(
            word,
            fingertip,
            stableTouch
        );


        /*
            Activate only once when
            stable touch begins.
        */

        if (
            stableTouch &&
            !state.touching
        ) {

            activateFinger(
                finger.name,
                word
            );

        }


        state.touching =
            stableTouch;


        if (stableTouch) {

            touchingAnything =
                true;

        }

    }


    if (!touchingAnything) {

        currentWord.classList.remove(
            "visible"
        );

    }

}


// =====================================================
// ACTIVATE WORD
// =====================================================

function activateFinger(
    fingerName,
    word
) {

    const now =
        Date.now();


    if (
        now - lastActivation <
        ACTIVATION_COOLDOWN
    ) {

        return;

    }


    lastActivation =
        now;


    /*
        Add word to phrase.
    */

    sentenceWords.push(
        word
    );


    renderSentence();


    /*
        Show active word.
    */

    currentWord.innerHTML =
        `<span>${escapeHTML(word)}</span>`;


    currentWord.classList.add(
        "visible"
    );


    currentWord.classList.remove(
        "pop"
    );


    void currentWord.offsetWidth;


    currentWord.classList.add(
        "pop"
    );


    /*
        Speak if enabled.
    */

    if (voiceEnabled) {

        speakWord(
            word
        );

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
// SPEECH
// =====================================================

function speakWord(
    word
) {

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


    utterance.rate =
        0.95;


    utterance.pitch =
        1.05;


    window.speechSynthesis.speak(
        utterance
    );

}


// =====================================================
// RESET
// =====================================================

resetButton.addEventListener(
    "click",
    () => {

        sentenceWords = [];


        renderSentence();


        currentWord.classList.remove(
            "visible"
        );


        for (
            const state
            of Object.values(
                fingerState
            )
        ) {

            state.touching =
                false;

            state.frames =
                0;

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
// MAIN LOOP
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
        Match canvas to video.
    */

    if (
        canvas.width !==
            video.videoWidth ||
        canvas.height !==
            video.videoHeight
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
        Process only new frames.
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


        if (
            results.landmarks &&
            results.landmarks.length > 0
        ) {

            processHand(
                results.landmarks[0]
            );

        }

        else {

            currentWord.classList.remove(
                "visible"
            );


            /*
                Reset states when hand
                disappears.
            */

            for (
                const state
                of Object.values(
                    fingerState
                )
            ) {

                state.touching =
                    false;

                state.frames =
                    0;

            }

        }

    }


    requestAnimationFrame(
        predict
    );

}


// =====================================================
// START
// =====================================================

initialize();
