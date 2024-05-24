const MODEL_URL = "./weights";
const video = document.getElementById('video')

Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
]).then(cameraStart)

function cameraStart() {
    if (navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true, audio: false })
            .then(stream => {
                video.srcObject = stream;
            })
            .catch(err => {
                console.error(err);
            });
    }
}

video.addEventListener('play', () => {

    // キャンバス要素を取得
    var canvas_bg = document.createElement("canvas");
    var ctx_bg = canvas_bg.getContext('2d');

    // キャンバスサイズを指定
    canvas_bg.width = video.width;
    canvas_bg.height = video.height;

    // キャンバス要素をDOMに挿入
    document.body.append(canvas_bg)

    // 動画からキャンバスを作成、DOMに挿入
    const canvas = faceapi.createCanvasFromMedia(video)
    document.body.append(canvas)

    // 顔の検出オプションを設定
    const displaySize = { width: video.width, height: video.height }
    faceapi.matchDimensions(canvas, displaySize)

    let distances = [];
    let movingAverages = [];

    let nowChewing = false;
    let chewingCount = 0;

    const windowSize = 5;  // 移動平均のウィンドウサイズ
    const threshold = 1.2;   // 変化率の閾値

    setInterval(async () => {
        // 顔・顔の特徴点の検出
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks()

        // 検出された顔のデータをWebへの表示サイズにリサイズする
        const resizedDetections = faceapi.resizeResults(detections, displaySize)

        // キャンバスをクリア
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)

        // 顔の特徴点の検出結果を描画
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections)

        // 特徴点を格納（フレーム内には一人しかいない想定なので、最初に検出された顔の特徴点のみ格納）
        const landmarks = resizedDetections[0].landmarks;
        const landmarkPositions = landmarks.positions;
        const noseTip = landmarkPositions[33];
        const mouthCenter = landmarkPositions[51];
        // const mouthCenter = landmarkPositions[8];

        // 口と鼻の距離を計算
        ctx_bg.clearRect(0, 0, canvas_bg.width, canvas_bg.height)
        ctx_bg.strokeStyle = 'rgb(255,0,0)';
        ctx_bg.lineWidth = 2;
        ctx_bg.beginPath()
        ctx_bg.moveTo(noseTip.x, noseTip.y);
        ctx_bg.lineTo(mouthCenter.x, mouthCenter.y);
        ctx_bg.stroke();

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
                    chewingCount++;
                    nowChewing = true;
                } else {
                    console.log("咀嚼していません");
                    nowChewing = false;
                }
            }
        }

        var ctx = canvas.getContext('2d');
        ctx.font = "48px serif";
        ctx.fillText("Count:" + chewingCount, 10, 100);
        if (nowChewing) {
            ctx.fillText("Chewing", 10, 150);
        }
    }, 100)

})