import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LoadingButton } from "@/components/ui/loading-button";
import { Shield, Lock, Mic, MicOff, Wand2, Clock } from "lucide-react";
import { toast } from "sonner";

const API_BASE_URL = 'http://localhost:5000/api';

interface AudioRecorderProps {
  onAudioCaptured: (blob: Blob) => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onAudioCaptured }) => {
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingTimer, setRecordingTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Processing states
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isVisualizing, setIsVisualizing] = useState(false);
  
  // Data states
  const [error, setError] = useState<string | null>(null);
  const [recordingComplete, setRecordingComplete] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [rawAudioData, setRawAudioData] = useState<string | null>(null);
  const [encryptedData, setEncryptedData] = useState<string | null>(null);
  const [aesKey, setAesKey] = useState<string | null>(null);
  const [hoppingPattern, setHoppingPattern] = useState<string | null>(null);
  const [audioMetadata, setAudioMetadata] = useState<any>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Start the recording duration timer
  useEffect(() => {
    if (isRecording) {
      const timer = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      setRecordingTimer(timer);
      return () => clearInterval(timer);
    } else if (recordingTimer) {
      clearInterval(recordingTimer);
      setRecordingTimer(null);
    }
  }, [isRecording]);

  // Format seconds to MM:SS display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start recording - sends request to begin recording
  const startRecording = async () => {
    try {
      // Reset previous states
      setError(null);
      setRecordingDuration(0);
      setRecordingComplete(false);
      setEncryptedData(null);
      setAesKey(null);
      setRecordedAudio(null);
      setRawAudioData(null);
      setHoppingPattern(null);

      console.log("Starting recording...");
      
      // Send request to start recording
      const response = await fetch(`${API_BASE_URL}/start-recording`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to start recording');
      }

      // Recording started successfully
      setIsRecording(true);
      toast.info("Recording started. Click 'Stop Recording' when you're done.");
      
    } catch (err) {
      console.error("Start recording error:", err);
      setError(err instanceof Error ? err.message : 'An error occurred starting the recording');
      toast.error("Failed to start recording. Please try again.");
    }
  };

  // Stop recording - ends the recording and retrieves the audio data
  const stopRecording = async () => {
    if (!isRecording) {
      toast.error("No active recording to stop.");
      return;
    }

    try {
      setIsRecording(false);
      
      toast.info("Stopping recording and processing audio...");
      console.log("Stopping recording and retrieving audio data...");
      
      // Send request to stop recording and get the audio data
      const response = await fetch(`${API_BASE_URL}/stop-recording`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to stop recording');
      }

      console.log("Recording stopped successfully. Received data:", {
        dataSize: data.raw_audio_data?.length,
        sampleRate: data.sample_rate,
        format: data.format,
        samples: data.samples,
        duration: data.duration
      });

      // Store the raw audio data for encryption later
      setRawAudioData(data.raw_audio_data);
      
      // Convert audio data to proper WAV format with header
      try {
        // First convert base64 to array buffer
        const audioBuffer = base64ToArrayBuffer(data.raw_audio_data);
        
        // If the data format is float64, we need to convert to PCM
        if (data.format === 'float64') {
          console.log("Converting float64 data to PCM for preview");
          
          // Create a float64 array from the buffer
          const floatArray = new Float64Array(audioBuffer);
          
          // Convert to int16
          const int16Array = new Int16Array(floatArray.length);
          for (let i = 0; i < floatArray.length; i++) {
            // Clip to [-1, 1] range and convert to int16
            const sample = Math.max(-1, Math.min(1, floatArray[i]));
            int16Array[i] = Math.round(sample * 32767);
          }
          
          // Create WAV file from the int16 data
          const tempBlob = createWavFile(int16Array.buffer, data.sample_rate);
          setRecordedAudio(tempBlob);
        } else {
          // For other formats, just use the raw data with a WAV header
          const tempBlob = createWavFile(audioBuffer, data.sample_rate);
          setRecordedAudio(tempBlob);
        }
      } catch (conversionError) {
        console.error("Error converting audio format:", conversionError);
        // Continue anyway since we don't need the blob for encryption
      }
      
      setRecordingComplete(true);
      
      // Use the duration from the server or fallback to our local timer
      const duration = data.duration || recordingDuration;
      setRecordingDuration(Math.floor(duration));
      
      toast.success(`Recording complete! Duration: ${formatTime(Math.floor(duration))}`);
      
    } catch (err) {
      console.error("Stop recording error:", err);
      setError(err instanceof Error ? err.message : 'An error occurred stopping the recording');
      toast.error("Failed to stop recording. Please try again.");
    }
  };

  // Encrypt the recorded audio
  const encryptAudio = async () => {
    if (!rawAudioData) {
      toast.error("No recorded audio found. Please record audio first.");
      return;
    }

    try {
      setIsEncrypting(true);
      setError(null);
      
      toast.info("Encrypting audio with quantum key...");
      console.log("Sending raw audio data for encryption...");
      
      // Call the encrypt endpoint with the raw audio data
      const response = await fetch(`${API_BASE_URL}/encrypt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw_audio_data: rawAudioData,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Encryption failed');
      }

      console.log("Encryption successful. Received encrypted data:", {
        encryptedDataLength: data.encrypted_data?.length,
        keyLength: data.aes_key?.length,
        metadata: data.metadata
      });

      // Save the encrypted data
      setEncryptedData(data.encrypted_data);
      setAesKey(data.aes_key);
      setAudioMetadata(data.metadata || {});
      
      // Create a blob from the encrypted data and pass it up
      const encryptionResult = {
        encryptedData: data.encrypted_data,
        aesKey: data.aes_key,
        metadata: data.metadata || {}
      };

      // We just need a "dummy" blob to signal that encryption is complete
      // We'll create proper playable WAV in the decryption step
      const jsonBlob = new Blob([JSON.stringify(encryptionResult)], { type: 'application/json' });
      onAudioCaptured(jsonBlob);
      
      toast.success("Audio encrypted successfully!");
      
    } catch (err) {
      console.error("Encryption error:", err);
      setError(err instanceof Error ? err.message : 'An error occurred during encryption');
      toast.error("Encryption failed. Please try again.");
    } finally {
      setIsEncrypting(false);
    }
  };

  const decryptAudio = async () => {
    if (!encryptedData || !aesKey) {
      toast.error("Missing encrypted data or encryption key.");
      return;
    }

    try {
      setIsDecrypting(true);
      setError(null);
      
      toast.info("Decrypting audio...");
      console.log("Sending data for decryption:", {
        encryptedDataLength: encryptedData.length,
        keyLength: aesKey.length
      });
      
      // Create a unique request ID to avoid caching issues
      const requestId = Math.random().toString(36).substring(2, 15);
      
      const response = await fetch(`${API_BASE_URL}/decrypt?nocache=${requestId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          encrypted_data: encryptedData,
          aes_key: aesKey,
          metadata: audioMetadata
        }),
      });

      if (!response.ok) {
        throw new Error(`Decryption failed with status: ${response.status}`);
      }

      // Check content type to ensure we're getting audio
      const contentType = response.headers.get('content-type');
      console.log("Decryption response content type:", contentType);
      
      if (!contentType || !contentType.includes('audio')) {
        console.error("Server returned non-audio content:", contentType);
        toast.error("Server returned invalid audio format");
        throw new Error("Invalid response format from server");
      }

      // Create a blob from the response 
      const blob = await response.blob();
      console.log("Audio blob size:", blob.size, "type:", blob.type);
      
      if (blob.size === 0) {
        toast.error("Received empty audio file");
        throw new Error("Empty audio file received");
      }
      
      // Create a URL for the blob
      const url = URL.createObjectURL(blob);
      console.log("Audio URL created:", url);
      
      // Play the audio using a dedicated function
      playAudio(url);
    } catch (err) {
      console.error("Decryption error:", err);
      setError(err instanceof Error ? err.message : 'Decryption failed');
      toast.error("Failed to decrypt audio. Please try again.");
    } finally {
      setIsDecrypting(false);
    }
  };

  // Separate function to handle audio playback
  const playAudio = (audioUrl: string) => {
    try {
      // Save the URL for download option
      setAudioUrl(audioUrl);
      
      // Create a container to show controls
      const audioContainer = document.createElement('div');
      audioContainer.style.padding = '10px';
      audioContainer.style.marginTop = '20px';
      
      // Create audio element with controls
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.style.width = '100%';
      
      // Set up event listeners
      audio.addEventListener('canplaythrough', () => {
        console.log("Audio loaded and ready to play");
        // Auto-play when ready
        audio.play()
          .then(() => console.log("Audio playback started"))
          .catch(e => {
            console.error("Audio play() failed:", e);
            toast.error(`Auto-play failed: ${e.message}. Try using the controls to play manually.`);
          });
      });
      
      audio.addEventListener('error', (e) => {
        console.error("Audio error event:", e);
        toast.error(`Error loading audio: ${audio.error?.message || 'Unknown error'}`);
      });
      
      audio.addEventListener('playing', () => {
        console.log("Audio is now playing");
        toast.success("Audio decrypted and playing!");
      });
      
      // Set the source last
      audio.src = audioUrl;
      
      // Append to container
      audioContainer.appendChild(audio);
      
      // Find a place to add it in the UI
      const existingAudio = document.querySelector("[data-decrypted-audio]");
      if (existingAudio) {
        // Replace if already exists
        existingAudio.replaceWith(audioContainer);
      } else {
        // Add after the encryption section
        const container = document.getElementById('decrypted-audio-container');
        if (container) {
          container.innerHTML = '';
          container.appendChild(audioContainer);
        } else {
          // Fallback - add at the end of our component
          const componentDiv = document.querySelector('.decrypted-audio-container');
          if (componentDiv) {
            componentDiv.appendChild(audioContainer);
          } else {
            console.error("Could not find container to add audio element");
          }
        }
      }
      
      console.log("Audio element added to DOM");
    } catch (error) {
      console.error("Error setting up audio playback:", error);
      toast.error("Failed to set up audio playback");
    }
  };

  const visualizeHopping = async () => {
    try {
      setIsVisualizing(true);
      setError(null);
      
      toast.info("Generating frequency hopping visualization...");
      console.log("Requesting frequency hopping visualization...");
      
      const response = await fetch(`${API_BASE_URL}/visualize`);
      
      if (!response.ok) {
        throw new Error(`Failed to generate visualization: ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setHoppingPattern(url);
      
      console.log("Visualization successful, image URL created.");
      toast.success("Visualization generated successfully!");
    } catch (err) {
      console.error("Visualization error:", err);
      setError(err instanceof Error ? err.message : 'Visualization failed');
      toast.error("Failed to generate visualization. Please try again.");
    } finally {
      setIsVisualizing(false);
    }
  };

  // Replace the base64ToArrayBuffer function with a more complete solution
  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    try {
      const binaryString = window.atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    } catch (error) {
      console.error("Error converting base64 to ArrayBuffer:", error);
      throw new Error("Failed to process audio data");
    }
  };

  // Add a function to create a WAV file from raw PCM data
  const createWavFile = (audioBuffer: ArrayBuffer, sampleRate = 44100): Blob => {
    // Create WAV header
    // Format details: http://soundfile.sapp.org/doc/WaveFormat/
    
    const numChannels = 1; // mono
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = audioBuffer.byteLength;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;
    
    // Create a buffer for the WAV header
    const wavHeader = new ArrayBuffer(headerSize);
    const view = new DataView(wavHeader);
    
    // "RIFF" chunk descriptor
    view.setUint8(0, 'R'.charCodeAt(0));
    view.setUint8(1, 'I'.charCodeAt(0));
    view.setUint8(2, 'F'.charCodeAt(0));
    view.setUint8(3, 'F'.charCodeAt(0));
    
    // Chunk size (file size - 8)
    view.setUint32(4, totalSize - 8, true);
    
    // "WAVE" format
    view.setUint8(8, 'W'.charCodeAt(0));
    view.setUint8(9, 'A'.charCodeAt(0));
    view.setUint8(10, 'V'.charCodeAt(0));
    view.setUint8(11, 'E'.charCodeAt(0));
    
    // "fmt " sub-chunk
    view.setUint8(12, 'f'.charCodeAt(0));
    view.setUint8(13, 'm'.charCodeAt(0));
    view.setUint8(14, 't'.charCodeAt(0));
    view.setUint8(15, ' '.charCodeAt(0));
    
    // Sub-chunk size (16 for PCM)
    view.setUint32(16, 16, true);
    
    // Audio format (1 for PCM)
    view.setUint16(20, 1, true);
    
    // Number of channels
    view.setUint16(22, numChannels, true);
    
    // Sample rate
    view.setUint32(24, sampleRate, true);
    
    // Byte rate
    view.setUint32(28, byteRate, true);
    
    // Block align
    view.setUint16(32, blockAlign, true);
    
    // Bits per sample
    view.setUint16(34, bitsPerSample, true);
    
    // "data" sub-chunk
    view.setUint8(36, 'd'.charCodeAt(0));
    view.setUint8(37, 'a'.charCodeAt(0));
    view.setUint8(38, 't'.charCodeAt(0));
    view.setUint8(39, 'a'.charCodeAt(0));
    
    // Data size
    view.setUint32(40, dataSize, true);
    
    // Combine header and audio data
    const wavFile = new Uint8Array(totalSize);
    wavFile.set(new Uint8Array(wavHeader), 0);
    wavFile.set(new Uint8Array(audioBuffer), headerSize);
    
    // Create a Blob with WAV format
    return new Blob([wavFile], { type: 'audio/wav' });
  };

  // Add a test audio playback function to test the browser's audio capabilities
  const playTestAudio = async () => {
    try {
      console.log("Playing test audio tone...");
      
      const response = await fetch(`${API_BASE_URL}/test-audio?nocache=${Date.now()}`);
      
      if (!response.ok) {
        toast.error("Failed to get test audio");
        return;
      }
      
      const blob = await response.blob();
      console.log("Test audio blob:", blob.size, "bytes,", blob.type);
      
      const url = URL.createObjectURL(blob);
      playAudio(url);
      
      toast.success("Test audio requested. Check if you can hear a tone.");
    } catch (err) {
      console.error("Test audio error:", err);
      toast.error("Failed to play test audio");
    }
  };

  // Add a function to play the raw audio for preview
  const playRawAudio = async () => {
    if (!rawAudioData || !recordedAudio) {
      toast.error("No recording available to play");
      return;
    }

    try {
      console.log("Playing original recording...");
      
      // Use the blob we already created during stop recording
      const url = URL.createObjectURL(recordedAudio);
      playAudio(url);
      
      toast.success("Playing original recording");
    } catch (err) {
      console.error("Error playing raw audio:", err);
      
      // Fallback to server conversion if local playback fails
      try {
        console.log("Local playback failed, trying server conversion...");
        
        const response = await fetch(`${API_BASE_URL}/convert-to-wav`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            raw_audio_data: rawAudioData,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to convert audio: ${response.status}`);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        playAudio(url);
        
        toast.success("Playing original recording (server converted)");
      } catch (serverErr) {
        console.error("Server conversion failed:", serverErr);
        toast.error("Could not play the original recording");
      }
    }
  };

  // Add back the hexStringToArrayBuffer function
  const hexStringToArrayBuffer = (hexString: string): ArrayBuffer => {
    try {
      // Make sure we have a valid hex string
      if (!hexString || !/^[0-9A-Fa-f]+$/.test(hexString)) {
        throw new Error("Invalid hex string format");
      }
      
      const bytes = new Uint8Array(
        hexString.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
      );
      return bytes.buffer;
    } catch (error) {
      console.error("Error converting hex string to ArrayBuffer:", error);
      throw new Error("Failed to process encrypted data");
    }
  };

  return (
    <Card className="p-6 max-w-2xl mx-auto">
      <div className="space-y-4">
        {/* Recording Section */}
        <div className="space-y-2">
          <div className="flex gap-2">
            {!isRecording ? (
              <LoadingButton
                onClick={startRecording}
                className="w-full bg-red-600 hover:bg-red-700"
                disabled={isRecording}
              >
                <Mic className="mr-2 h-4 w-4" />
                Start Recording
              </LoadingButton>
            ) : (
              <LoadingButton
                onClick={stopRecording}
                className="w-full bg-gray-600 hover:bg-gray-700"
                disabled={!isRecording}
              >
                <MicOff className="mr-2 h-4 w-4" />
                Stop Recording
              </LoadingButton>
            )}
          </div>
          
          {isRecording && (
            <div className="mt-2 flex items-center gap-2 animate-pulse">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="font-mono text-sm flex items-center gap-1">
                <Clock size={14} />
                {formatTime(recordingDuration)}
              </div>
            </div>
          )}
        </div>
        
        {error && (
          <div className="text-red-500 text-sm p-3 bg-red-50 rounded-md">
            {error}
          </div>
        )}
        
        {/* Test audio button */}
        <button 
          onClick={playTestAudio}
          className="text-xs text-gray-500 mt-1 hover:text-gray-700"
          type="button"
        >
          Test Audio System
        </button>
        
        {/* After Recording Section */}
        {recordingComplete && !encryptedData && (
          <div className="space-y-4">
            <div className="bg-green-50 p-3 rounded-md text-green-700 flex items-center">
              <Shield className="w-5 h-5 mr-2 text-green-500" />
              <div>
                <p className="font-medium">Recording complete!</p>
                <p className="text-sm">Duration: {formatTime(recordingDuration)}. Click below to apply quantum encryption.</p>
              </div>
            </div>
            
            <button
              onClick={playRawAudio} 
              className="w-full py-2 px-4 text-center bg-blue-500 text-white rounded hover:bg-blue-600 transition mb-2"
              type="button"
            >
              Play Original Recording
            </button>
            
            <LoadingButton
              onClick={encryptAudio}
              loading={isEncrypting}
              loadingText="Encrypting with quantum key..."
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              <Wand2 className="w-4 h-4 mr-2" />
              Encrypt Audio with Quantum Key
            </LoadingButton>
          </div>
        )}
        
        {/* After Encryption Section */}
        {encryptedData && (
          <div className="space-y-4">
            <div className="bg-indigo-50 p-3 rounded-md text-indigo-700 flex items-center">
              <Lock className="w-5 h-5 mr-2 text-indigo-500" />
              <div>
                <p className="font-medium">Audio encrypted successfully!</p>
                <p className="text-sm">Your audio is now protected with quantum encryption.</p>
              </div>
            </div>
            
            <LoadingButton
              onClick={decryptAudio}
              loading={isDecrypting}
              loadingText="Decrypting Audio..."
              className="w-full"
            >
              Play Decrypted Audio
            </LoadingButton>

            {/* Container for the decrypted audio */}
            <div id="decrypted-audio-container" className="mt-4 rounded-md overflow-hidden decrypted-audio-container">
              {/* Audio player will be inserted here */}
            </div>

            <LoadingButton
              onClick={visualizeHopping}
              loading={isVisualizing}
              loadingText="Generating Visualization..."
              className="w-full"
            >
              Show Frequency Hopping Pattern
            </LoadingButton>

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
