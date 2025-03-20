import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const API_BASE_URL = 'http://localhost:5000/api';

const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [encryptedData, setEncryptedData] = useState<string | null>(null);
  const [aesKey, setAesKey] = useState<string | null>(null);
  const [hoppingPattern, setHoppingPattern] = useState<string | null>(null);

  const startRecording = async () => {
    try {
      setIsRecording(true);
      setError(null);
      setProgress(0);

      // Start progress animation
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 1;
        });
      }, 100);

      // Call the recording endpoint
      const response = await fetch(`${API_BASE_URL}/record`, {
        method: 'POST',
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Recording failed');
      }

      setEncryptedData(data.encrypted_data);
      setAesKey(data.aes_key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsRecording(false);
      setProgress(0);
    }
  };

  const decryptAudio = async () => {
    if (!encryptedData || !aesKey) return;

    try {
      const response = await fetch(`${API_BASE_URL}/decrypt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          encrypted_data: encryptedData,
          aes_key: aesKey,
        }),
      });

      if (!response.ok) {
        throw new Error('Decryption failed');
      }

      // Create a blob from the response and play it
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decryption failed');
    }
  };

  const visualizeHopping = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/visualize`);
      
      if (!response.ok) {
        throw new Error('Failed to generate visualization');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setHoppingPattern(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Visualization failed');
    }
  };
  
  return (
    <Card className="p-6 max-w-2xl mx-auto">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Secure Audio Recording</h2>
        
        <div className="space-y-2">
          <Button
              onClick={startRecording} 
              disabled={isRecording}
            className="w-full"
          >
            {isRecording ? 'Recording...' : 'Start Recording'}
          </Button>
          
          {isRecording && (
            <Progress value={progress} className="w-full" />
          )}
        </div>
        
        {error && (
          <div className="text-red-500 text-sm">
            {error}
          </div>
        )}
        
        {encryptedData && (
          <div className="space-y-4">
            <Button
              onClick={decryptAudio}
              className="w-full"
            >
              Play Decrypted Audio
            </Button>

            <Button
              onClick={visualizeHopping}
              className="w-full"
            >
              Show Frequency Hopping Pattern
            </Button>

            {hoppingPattern && (
              <div className="mt-4">
                <img
                  src={hoppingPattern}
                  alt="Frequency Hopping Pattern"
                  className="w-full rounded-lg"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

export default AudioRecorder;
