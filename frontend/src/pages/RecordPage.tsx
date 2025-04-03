import { useState } from "react";
import NavBar from "@/components/NavBar";
import AudioRecorder from "@/components/AudioRecorder";

const RecordPage = () => {
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const handleAudioCaptured = (blob: Blob) => {
    setAudioBlob(blob);
    console.log("Audio blob captured", blob);
  };

  return (
    <div className="min-h-screen bg-freqvault-dark">
      <NavBar />
      <div className="pt-24 pb-12 px-4 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Secure Audio Input</h1>
          <p className="text-gray-300">Record aviation communications for FreqVault encryption</p>
        </div>
        
        <div className="mb-8">
          <div className="freqvault-card">
            <AudioRecorder onAudioCaptured={handleAudioCaptured} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordPage;
