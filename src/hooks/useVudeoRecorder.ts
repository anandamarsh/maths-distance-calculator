import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";
import { flushSync } from "react-dom";

export type RecordingPhase =
  | "idle"
  | "intro-prompt"
  | "intro"
  | "playing"
  | "outro"
  | "stopping";

interface Callbacks {
  onStartPlaying: () => void;
  prepareAudio: () => void;
  cleanup: () => void;
}

export function useVudeoRecorder(callbacksRef: RefObject<Callbacks>) {
  const [recordingPhase, setRecordingPhase] = useState<RecordingPhase>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const cleanupInProgressRef = useRef(false);

  const cleanup = useCallback(() => {
    if (cleanupInProgressRef.current) return;
    cleanupInProgressRef.current = true;

    const stream = streamRef.current;
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    callbacksRef.current?.cleanup();
    setRecordingPhase("idle");

    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    cleanupInProgressRef.current = false;
  }, [callbacksRef]);

  const startRecording = useCallback(async () => {
    if (recorderRef.current) return;

    flushSync(() => {
      setRecordingPhase("intro-prompt");
    });

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: true,
        // @ts-expect-error newer Chromium API
        preferCurrentTab: true,
      });

      streamRef.current = stream;
      chunksRef.current = [];
      cleanupInProgressRef.current = false;

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
          ? "video/webm;codecs=vp8,opus"
          : "video/webm";

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 5_000_000,
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        downloadBlob(blob);
        cleanup();
      };

      const [videoTrack] = stream.getVideoTracks();
      videoTrack?.addEventListener("ended", () => {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
          return;
        }
        cleanup();
      });

      recorderRef.current = recorder;

      await new Promise((resolve) => window.setTimeout(resolve, 280));
      callbacksRef.current?.prepareAudio();
      recorder.start(1000);
      setRecordingPhase("intro");
    } catch {
      cleanup();
    }
  }, [cleanup]);

  const onIntroComplete = useCallback(() => {
    setRecordingPhase("playing");
    callbacksRef.current?.onStartPlaying();
  }, [callbacksRef]);

  const showOutro = useCallback(() => {
    setRecordingPhase("outro");
  }, []);

  const onOutroComplete = useCallback(() => {
    setRecordingPhase("stopping");
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
      return;
    }
    cleanup();
  }, [cleanup]);

  return {
    recordingPhase,
    isRecording: recordingPhase !== "idle",
    startRecording,
    onIntroComplete,
    showOutro,
    onOutroComplete,
  };
}

function downloadBlob(blob: Blob) {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, "-");
  const fileName = `trail-distances-vudeo-${stamp}.webm`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
