const boundaryTouchThreshold = 0.05;
const noseMouthKissThreshold = 0.02;
const touchBandMargin = 0.1;
const highTouchTopThreshold = 0.4;
const centeredFaceThreshold = 0.004;

export class Landmarks extends EventTarget {
  #eid = 0;
  #isHighTouchActive = false;

  constructor({ poseLandmarker = null, handLandmarker = null } = {}) {
    super();
    this.poseLandmarker = poseLandmarker;
    this.handLandmarker = handLandmarker;
  }

  detect(videoFrame, timestamp = performance.now()) {
    const poseData = this.#detectPoseData(videoFrame, timestamp);
    const handPoints = this.#detectHandPoints(videoFrame, timestamp);
    const events = this.#detectEvents(poseData.mouthPoints, poseData.nosePoint, poseData.eyePoints, handPoints);

    this.#appendEvents(events, timestamp);

    return {
      points: [...poseData.points, ...handPoints],
      handPoints,
      mouthPoints: poseData.mouthPoints,
      nosePoint: poseData.nosePoint,
      eyePoints: poseData.eyePoints,
      orientation: poseData.orientation,
      events,
    };
  }

  maybeDispatchHighTouch(handPoints, mouthPoints, maskMeta, width, timestamp = performance.now()) {
    if (!mouthPoints.length || !handPoints.length) {
      this.#isHighTouchActive = false;
      return false;
    }

    const midpointX = 0.5;
    const midpointThreshold = 0.05;
    const relaxedHighTouchThreshold = 0.1;
    const highTouchThreshold = this.#isHighTouchActive ? relaxedHighTouchThreshold : midpointThreshold;
    const validHandPoints = handPoints.filter((point) => this.#isWithinTouchBand(point));
    const highTouchCandidates = validHandPoints.filter(
      (point) => Math.abs(point.x - midpointX) <= highTouchThreshold && this.#isHighTouchPose(point, maskMeta, width)
    );

    if (highTouchCandidates.length === 0) {
      this.#isHighTouchActive = false;
      return false;
    }

    this.#isHighTouchActive = true;
    this.#appendEvents(["high-touch"], timestamp);
    return true;
  }

  maybeDispatchKiss(nosePoint, mouthPoints, maskMeta, width, timestamp = performance.now()) {
    if (!this.#isKissPose(nosePoint, mouthPoints, maskMeta, width)) {
      return false;
    }

    this.#appendEvents(["kiss"], timestamp);
    return true;
  }

  #detectPoseData(videoFrame, timestamp) {
    if (!this.poseLandmarker) {
      return {
        points: [],
        mouthPoints: [],
        nosePoint: null,
        eyePoints: [],
      };
    }

    const result = this.poseLandmarker.detectForVideo(videoFrame, timestamp);
    const poseLandmarks = result.landmarks?.[0] ?? null;

    if (!poseLandmarks) {
      return {
        points: [],
        mouthPoints: [],
        nosePoint: null,
        eyePoints: [],
      };
    }

    const noseLandmark = poseLandmarks[0] ?? null;
    const nosePoint = noseLandmark ? { x: noseLandmark.x, y: noseLandmark.y } : null;
    const eyePoints = [2, 5]
      .map((index) => poseLandmarks[index] ?? null)
      .filter(Boolean)
      .map((landmark) => ({ x: landmark.x, y: landmark.y }));

    const mouthPoints = [9, 10]
      .map((index) => poseLandmarks[index] ?? null)
      .filter(Boolean)
      .map((landmark) => ({ x: landmark.x, y: landmark.y }));

    const earPoints = [7, 8]
      .map((index) => poseLandmarks[index] ?? null)
      .filter(Boolean)
      .map((landmark) => ({ x: landmark.x, y: landmark.y, z: landmark.z }));
    const earZDifference = (earPoints[0]?.z ?? 0) - (earPoints[1]?.z ?? 0);
    const points = [...(nosePoint ? [nosePoint] : []), ...eyePoints, ...mouthPoints, ...earPoints.map(({ z, ...point }) => point)];

    return {
      points,
      mouthPoints,
      nosePoint,
      eyePoints,
      orientation: earZDifference > 0 ? "right" : "left",
    };
  }

  #detectHandPoints(videoFrame, timestamp) {
    if (!this.handLandmarker) {
      return [];
    }

    const result = this.handLandmarker.detectForVideo(videoFrame, timestamp);

    return (result.landmarks ?? [])
      .map((handLandmarks) => handLandmarks?.[8] ?? null)
      .filter(Boolean)
      .map((landmark) => ({ x: landmark.x, y: landmark.y }));
  }

  #detectEvents(mouthPoints, nosePoint, eyePoints, handPoints) {
    const events = [];
    const midpointX = 0.5;
    const midpointThreshold = 0.01;
    const wallThreshold = 0.05;

    if (nosePoint && (nosePoint.x <= wallThreshold || nosePoint.x >= 1 - wallThreshold)) {
      events.push("wall-hit");
    }

    if (handPoints.length === 0 && this.#isCenteredFacePose(nosePoint, eyePoints)) {
      events.push("face-centered");
    }

    if (mouthPoints.length === 0) {
      return events;
    }

    const mouthCenterY = mouthPoints.reduce((sum, point) => sum + point.y, 0) / mouthPoints.length;
    const validHandPoints = handPoints.filter((point) => this.#isWithinTouchBand(point));
    let hasLowTouch = false;

    for (const point of validHandPoints) {
      if (Math.abs(point.x - midpointX) <= midpointThreshold && point.y >= mouthCenterY) {
        hasLowTouch = true;
      }
    }

    if (hasLowTouch) {
      events.push("low-touch");
    }

    return events;
  }

  #appendEvents(events, timestamp) {
    if (events.length === 0) {
      return;
    }

    for (const eventName of events) {
      const eventId = this.#eid++;

      this.dispatchEvent(
        new CustomEvent(eventName, {
          detail: {
            id: eventId,
            name: eventName,
            timestamp,
          },
        })
      );
    }
  }

  #isWithinTouchBand(point) {
    return point.x >= touchBandMargin && point.x <= 1 - touchBandMargin && point.y >= touchBandMargin && point.y <= 1 - touchBandMargin;
  }

  #isHighTouchPose(point, maskMeta, width) {
    if (!point || point.y > highTouchTopThreshold || !maskMeta || !width) {
      return false;
    }

    const boundaryX = maskMeta.sourceBoundaryX;

    if (boundaryX == null) {
      return false;
    }

    const normalizedBoundaryX = boundaryX / width;
    const isLeftMost = maskMeta.orientation === "left" && point.x <= normalizedBoundaryX + boundaryTouchThreshold;
    const isRightMost = maskMeta.orientation !== "left" && point.x >= normalizedBoundaryX - boundaryTouchThreshold;

    return isLeftMost || isRightMost;
  }

  #isKissPose(nosePoint, mouthPoints, maskMeta, width) {
    if (!nosePoint || mouthPoints.length === 0 || !maskMeta || !width) {
      return false;
    }

    if (!this.#isWithinTouchBand(nosePoint)) {
      return false;
    }

    const boundaryX = maskMeta.sourceBoundaryX;

    if (boundaryX == null) {
      return false;
    }

    const mouthXs = mouthPoints.map((point) => point.x);
    const normalizedBoundaryX = boundaryX / width;
    const isNoseLeftMost = maskMeta.orientation === "left" && nosePoint.x <= normalizedBoundaryX + boundaryTouchThreshold;
    const isNoseRightMost = maskMeta.orientation !== "left" && nosePoint.x >= normalizedBoundaryX - boundaryTouchThreshold;

    if (!isNoseLeftMost && !isNoseRightMost) {
      return false;
    }

    const closestMouthDistance = Math.min(...mouthXs.map((mouthX) => Math.abs(mouthX - nosePoint.x)));

    return closestMouthDistance < noseMouthKissThreshold;
  }

  #isCenteredFacePose(nosePoint, eyePoints) {
    if (!nosePoint || eyePoints.length < 2) {
      return false;
    }

    const [leftEyePoint, rightEyePoint] = [...eyePoints].sort((firstPoint, secondPoint) => firstPoint.x - secondPoint.x);
    const eyeMidpointX = (leftEyePoint.x + rightEyePoint.x) / 2;
    const isGloballyCentered = Math.abs(nosePoint.x - 0.5) <= centeredFaceThreshold;
    const isBetweenEyes = nosePoint.x >= leftEyePoint.x && nosePoint.x <= rightEyePoint.x;
    const isCenteredBetweenEyes = Math.abs(nosePoint.x - eyeMidpointX) <= centeredFaceThreshold;

    return isGloballyCentered && isBetweenEyes && isCenteredBetweenEyes;
  }
}
