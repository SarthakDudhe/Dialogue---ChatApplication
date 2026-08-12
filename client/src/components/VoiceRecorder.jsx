import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';

/**
 * VoiceRecorder Component
 * Captures audio via Web Audio API, animates frequency bars,
 * and passes base64 audio payload to ChatContainer for E2EE transmission.
 */
const VoiceRecorder = ({ onSendVoiceMemo, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    startRecording();
    return () => {
      stopRecordingCleanup();
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          onSendVoiceMemo({
            audioUrl: reader.result,
            duration: recordingTime,
            transcript: "[Encrypted Voice Note]"
          });
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      toast.error("Microphone access denied or unavailable.");
      onCancel();
    }
  };

  const stopRecordingCleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
  };

  const handleFinish = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      stopRecordingCleanup();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex items-center gap-3 bg-white border border-red-200 px-4 py-2.5 rounded-xl w-full shadow-sm animate-fade-in">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-red-500 animate-ping"></span>
        <span className="text-xs font-mono font-bold text-red-600">{formatTime(recordingTime)}</span>
      </div>

      {/* Dynamic Animated Waveform Visualization */}
      <div className="flex-1 flex items-center justify-center gap-1 h-6 px-2">
        {[40, 75, 30, 90, 50, 85, 45, 60, 95, 35, 70, 50, 80].map((height, i) => (
          <span
            key={i}
            className="w-1 bg-red-400 rounded-full animate-bounce"
            style={{
              height: `${height}%`,
              animationDelay: `${i * 80}ms`,
              animationDuration: '600ms'
            }}
          ></span>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            stopRecordingCleanup();
            onCancel();
          }}
          className="text-xs text-gray-500 hover:text-gray-800 font-semibold px-2.5 py-1 rounded-lg hover:bg-gray-100 transition-all cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={handleFinish}
          className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg shadow transition-all cursor-pointer flex items-center gap-1.5"
        >
          <span>Send Voice</span>
          <span>🎙️</span>
        </button>
      </div>
    </div>
  );
};

export default VoiceRecorder;
