const MODEL_URL = chrome.runtime.getURL("/javascript/weights");

let videoElement = null;
let canvasElement = null;
let containerElement = null;
let currentStream = null;

async function loadModels() {
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
}

async function startVideo(cameraId) {
  stopVideo();

  await loadModels();

  navigator.mediaDevices
    .getUserMedia({ video: { deviceId: cameraId } })
    .then((stream) => {
      currentStream = stream;

      // containerElement を作成
      containerElement = document.createElement("div");
      containerElement.style.position = "fixed";
      containerElement.style.bottom = "10px";
      containerElement.style.right = "10px";
      containerElement.style.zIndex = "1000000";
      containerElement.style.overflow = "hidden";
      containerElement.style.width = "270px";
      containerElement.style.height = "210px";
      document.body.appendChild(containerElement);

      // videoElement を作成
      videoElement = document.createElement("video");
      videoElement.style.width = "270px";
      videoElement.style.height = "210px";
      videoElement.style.position = "absolute";
      videoElement.style.top = "0";
      videoElement.style.left = "0";
      videoElement.style.objectFit = "fill";
      videoElement.style.borderRadius = "20px";
      videoElement.autoplay = true;
      containerElement.appendChild(videoElement);

      videoElement.addEventListener('play', () => {
        // canvasElement を作成
        canvasElement = faceapi.createCanvasFromMedia(videoElement);
        canvasElement.style.position = "absolute";
        canvasElement.style.top = "0";
        canvasElement.style.left = "0";
        canvasElement.style.objectFit = "fill";
        containerElement.appendChild(canvasElement);
        const displaySize = { width: 270, height: 210 };
        faceapi.matchDimensions(canvasElement, displaySize);

        let distances = [];
        let movingAverages = [];

        // let nowChewing = false;
        // let chewingCount = 0;

        const windowSize = 5;  // 移動平均のウィンドウサイズ
        const threshold = 0.35;   // 変化率の閾値

        setInterval(async () => {
          // 顔・顔の特徴点の検出
          const detections = await faceapi.detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks()

          // 検出された顔のデータをWebへの表示サイズにリサイズする
          const resizedDetections = faceapi.resizeResults(detections, displaySize)

          // キャンバスをクリア
          canvasElement.getContext('2d').clearRect(0, 0, canvasElement.width, canvasElement.height);

          // 顔の特徴点の検出結果を描画
          faceapi.draw.drawFaceLandmarks(canvasElement, resizedDetections);

          // 特徴点を格納（フレーム内には一人しかいない想定なので、最初に検出された顔の特徴点のみ格納）
          const landmarks = resizedDetections[0].landmarks;
          const landmarkPositions = landmarks.positions;
          const noseTip = landmarkPositions[33];
          const mouthCenter = landmarkPositions[51];
          // const mouthCenter = landmarkPositions[8];

          // 口と鼻の距離を計算
          const distance = Math.sqrt(Math.pow(noseTip.x - mouthCenter.x, 2) + Math.pow(noseTip.y - mouthCenter.y, 2));
          distances.push(distance)

          // 移動平均を計算
          if (distances.length >= windowSize) {
            const movingAverage = distances.slice(-windowSize).reduce((a, b) => a + b, 0) / windowSize;
            movingAverages.push(movingAverage);

            // 移動平均の変化率を計算
            if (movingAverages.length > 1) {
              const changeRate = Math.abs(movingAverages[movingAverages.length - 1] - movingAverages[movingAverages.length - 2]);

              // 変化率が閾値を超えた場合
              console.log(changeRate);
              if (changeRate >= threshold) {
                console.log("咀嚼の可能性があります");
                window.scrollBy({ top: 50, behavior: 'smooth' }); // スクロール
                // chewingCount++;
                // nowChewing = true;
              } else {
                console.log("咀嚼していません");
                // nowChewing = false;
              }
            }
          }

        }, 100);
      });

      // ドラッグ＆ドロップで移動
      let isDragging = false;
      let offsetX, offsetY;
      containerElement.addEventListener("mousedown", (e) => {
        isDragging = true;
        offsetX = e.clientX - containerElement.getBoundingClientRect().left;
        offsetY = e.clientY - containerElement.getBoundingClientRect().top;
      });

      window.addEventListener("mousemove", (e) => {
        if (isDragging) {
          containerElement.style.left = e.clientX - offsetX + "px";
          containerElement.style.top = e.clientY - offsetY + "px";
        }
      });

      window.addEventListener("mouseup", () => {
        isDragging = false;
      });

      videoElement.srcObject = stream;
    })
    .catch((error) => {
      console.error("Error accessing the camera:", error);
    });
}

function stopVideo() {
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
  }
  if (containerElement) {
    containerElement.remove();
    containerElement = null;
  }
  videoElement = null;
  canvasElement = null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startVideo") {
    startVideo(message.cameraId);
  } else if (message.action === "stopVideo") {
    stopVideo();
  }
});
