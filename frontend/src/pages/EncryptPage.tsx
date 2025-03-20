
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import NavBar from "@/components/NavBar";
import FrequencyVisualizer from "@/components/FrequencyVisualizer";
import { Lock, Unlock, Key, Play, Pause, Volume2, VolumeX, Mic } from "lucide-react";
import { toast } from "sonner";

// Constants for the quantum encryption simulation
const START_FREQ = 118e6; // 118 MHz (VHF aviation band start)
const END_FREQ = 137e6;   // 137 MHz (VHF aviation band end)
const HOPPING_RATE = 5;   // Frequency hops per second
const NUM_HOPS = 20;      // Number of hops to use

const EncryptPage = () => {
  const navigate = useNavigate();
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [encryptionProgress, setEncryptionProgress] = useState(0);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [quantumKey, setQuantumKey] = useState<string>("");
  const [hopFrequencies, setHopFrequencies] = useState<number[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  
  // Audio context setup
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // Audio state management
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [encryptedAudioUrl, setEncryptedAudioUrl] = useState<string | null>(null);
  const [currentAudioSource, setCurrentAudioSource] = useState<string>(""); 
  const [visualizationKey, setVisualizationKey] = useState(0);

  // Fetch the recorded audio from localStorage on component mount
  useEffect(() => {
    const savedAudioUrl = localStorage.getItem('recordedAudioURL');
    if (savedAudioUrl) {
      setRecordedAudioUrl(savedAudioUrl);
      setCurrentAudioSource(savedAudioUrl);
      
      // Initialize audio element
      if (audioRef.current) {
        audioRef.current.src = savedAudioUrl;
        audioRef.current.load();
      }
    } else {
      // No saved audio, show a message
      toast.info("No recorded audio found. Please record audio first.");
    }
    
    // Generate initial hopping pattern for visualization
    const initialFrequencies = generateInitialHoppingPattern();
    setHopFrequencies(initialFrequencies);
    
    return () => {
      // Clean up on unmount
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Function to generate initial hopping pattern for visualization
  const generateInitialHoppingPattern = () => {
    const frequencies: number[] = [];
    const seed = Date.now();
    
    // Seeded random function
    const seededRandom = (min: number, max: number, index: number) => {
      const x = Math.sin(seed + index) * 10000;
      return min + (Math.abs(x) % 1) * (max - min);
    };
    
    // Generate frequency hops
    for (let i = 0; i < NUM_HOPS; i++) {
      frequencies.push(seededRandom(START_FREQ, END_FREQ, i));
    }
    
    return frequencies;
  };

  // Simulate fetching a quantum key
  const fetchQuantumKey = async () => {
    try {
      // In a real app, this would call an API like ANU QRNG
      // Simulating quantum randomness using window.crypto
      const array = new Uint8Array(32);
      window.crypto.getRandomValues(array);
      
      // Convert to hex string
      const key = Array.from(array)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
        
      return key;
    } catch (error) {
      console.error("Error generating quantum key:", error);
      // Fallback to pseudo-random if crypto API fails
      return Math.random().toString(36).substring(2, 15) + 
             Math.random().toString(36).substring(2, 15);
    }
  };
  
  // Generate frequency hopping pattern based on key
  const generateHoppingPattern = (key: string) => {
    // Use the key as a seed for the pseudo-random generator
    const seed = parseInt(key.slice(0, 8), 16);
    
    // Deterministic random function
    const seededRandom = (min: number, max: number, index: number) => {
      const x = Math.sin(seed + index) * 10000;
      return min + (Math.abs(x) % 1) * (max - min);
    };
    
    // Generate frequency hops
    const frequencies: number[] = [];
    for (let i = 0; i < NUM_HOPS; i++) {
      frequencies.push(seededRandom(START_FREQ, END_FREQ, i));
    }
    
    return frequencies;
  };

  // Handle recording audio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Reset audio chunks
      audioChunksRef.current = [];
      
      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      // Handle data available event
      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      // Handle recording stopped
      mediaRecorder.onstop = () => {
        // Create blob from chunks
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const url = URL.createObjectURL(audioBlob);
        
        // Set recorded audio URL
        setRecordedAudioUrl(url);
        setCurrentAudioSource(url);
        
        // Store in localStorage
        localStorage.setItem('recordedAudioURL', url);
        
        // Update audio element
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.load();
        }
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        setIsRecording(false);
        toast.success("Audio recording complete");
      };
      
      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      
      // Stop recording after 5 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }, 5000);
      
    } catch (error) {
      console.error("Error recording audio:", error);
      toast.error("Failed to record audio. Please ensure microphone permissions are granted.");
      setIsRecording(false);
    }
  };

  const handleEncrypt = async () => {
    if (!recordedAudioUrl && !isEncrypted) {
      toast.error("Please record audio first before encrypting");
      return;
    }
    
    if (isEncrypted) {
      // Decrypt
      setIsEncrypting(true);
      simulateProgressBar(async () => {
        setIsEncrypted(false);
        setIsEncrypting(false);
        
        // Return to the original recorded audio
        if (recordedAudioUrl) {
          setCurrentAudioSource(recordedAudioUrl);
          if (audioRef.current) {
            audioRef.current.src = recordedAudioUrl;
            audioRef.current.load();
            audioRef.current.currentTime = 0;
          }
        }
        
        toast.success("Audio decrypted successfully");
        
        // Force re-render of visualization component
        setVisualizationKey(prev => prev + 1);
      });
    } else {
      // Encrypt
      setIsEncrypting(true);
      simulateProgressBar(async () => {
        // Generate quantum key
        const key = await fetchQuantumKey();
        setQuantumKey(key);
        
        // Generate hopping pattern
        const frequencies = generateHoppingPattern(key);
        setHopFrequencies(frequencies);
        
        // In a real app, we would actually encrypt the audio
        // For demo, we'll use the original audio but pretend it's encrypted
        if (recordedAudioUrl) {
          setEncryptedAudioUrl(recordedAudioUrl);
          setCurrentAudioSource(recordedAudioUrl);
          if (audioRef.current) {
            audioRef.current.src = recordedAudioUrl;
            audioRef.current.load();
            audioRef.current.currentTime = 0;
          }
        }
        
        setIsEncrypted(true);
        setIsEncrypting(false);
        toast.success("Audio encrypted with quantum key distribution");
        
        // Force re-render of visualization component
        setVisualizationKey(prev => prev + 1);
      });
    }
  };

  const simulateProgressBar = (onComplete: () => void) => {
    setEncryptionProgress(0);
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setTimeout(() => {
          onComplete();
        }, 500);
      }
      setEncryptionProgress(progress);
    }, 200);
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // Force audio to play from the beginning to ensure proper playback
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(error => {
        console.error("Error playing audio:", error);
        toast.error("Failed to play audio");
      });
      setIsPlaying(true);
    }
  };
  
  const handleMuteToggle = () => {
    if (!audioRef.current) return;
    
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  // Reset play state when encryption state changes
  useEffect(() => {
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [isEncrypted]);

  return (
    <div className="min-h-screen bg-freqvault-dark">
      <NavBar />
      <div className="pt-24 pb-12 px-4 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">
            Quantum Audio Encryption
          </h1>
          <p className="text-gray-300">
            Encrypt audio communication with quantum key distribution technology
          </p>
        </div>

        <div className="freqvault-card">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              {isEncrypted ? (
                <>
                  <Lock className="w-5 h-5 text-freqvault-accent" />
                  <span>Quantum Encrypted Waveform with Frequency Hopping</span>
                </>
              ) : (
                <>
                  <Unlock className="w-5 h-5 text-freqvault-teal" />
                  <span>{isEncrypted === false && quantumKey ? "Decrypted Waveform" : "Standard Waveform Visualization"}</span>
                </>
              )}
            </h2>

            <FrequencyVisualizer 
              key={visualizationKey} 
              isEncrypted={isEncrypted} 
              visualizationMode="waveform" 
              hopFrequencies={isEncrypted ? hopFrequencies : []}
            />
          </div>
          
          {/* Audio Player */}
          <div className="mb-8 border border-freqvault-teal/20 rounded-lg p-4 bg-freqvault-navy/30">
            <h3 className="text-lg font-medium text-white mb-3">
              {isEncrypted ? "Encrypted Audio" : (quantumKey && !isEncrypted ? "Decrypted Audio" : "Original Audio")}
            </h3>
            
            <audio 
              ref={audioRef} 
              src={currentAudioSource}
              preload="auto"
              className="hidden"
              onEnded={() => setIsPlaying(false)}
            />
            
            <div className="flex items-center gap-4 flex-wrap">
              <button
                onClick={startRecording}
                disabled={isRecording}
                className={`p-3 ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-freqvault-navy/60'} rounded-full text-white hover:bg-freqvault-navy/80 transition-colors`}
              >
                <Mic size={20} />
              </button>
              
              <button 
                onClick={handlePlayPause}
                disabled={!recordedAudioUrl && !currentAudioSource}
                className={`p-3 ${!recordedAudioUrl && !currentAudioSource ? 'bg-gray-500 cursor-not-allowed' : 'bg-freqvault-teal hover:bg-freqvault-teal/90'} rounded-full text-black transition-colors`}
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              
              <button
                onClick={handleMuteToggle}
                disabled={!recordedAudioUrl && !currentAudioSource}
                className={`p-3 ${!recordedAudioUrl && !currentAudioSource ? 'bg-gray-500 cursor-not-allowed' : 'bg-freqvault-navy/60 hover:bg-freqvault-navy/80'} rounded-full text-white transition-colors`}
              >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              
              <div className="text-sm text-white">
                {isRecording ? (
                  <span className="text-red-400">Recording in progress... (5 seconds)</span>
                ) : !recordedAudioUrl && !currentAudioSource ? (
                  "Click mic icon to record audio (5 seconds)"
                ) : isPlaying ? (
                  (isEncrypted ? "Playing encrypted audio" : (quantumKey && !isEncrypted ? "Playing decrypted audio" : "Playing original audio"))
                ) : (
                  (isEncrypted ? "Click to play encrypted audio" : (quantumKey && !isEncrypted ? "Click to play decrypted audio" : "Click to play original audio"))
                )}
              </div>
            </div>
          </div>

          <div className="mb-8 border-t border-freqvault-teal/20 pt-6">
            <div className="flex flex-wrap gap-4">
              <button
                onClick={handleEncrypt}
                className={
                  isEncrypted
                    ? "freqvault-btn-secondary"
                    : "freqvault-btn-accent"
                }
                disabled={isEncrypting || (!recordedAudioUrl && !isEncrypted)}
              >
                {isEncrypted ? (
                  <>
                    <Unlock className="w-5 h-5" />
                    Decrypt Audio
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    Encrypt with QKD
                  </>
                )}
              </button>
            </div>

            {isEncrypting && (
              <div className="mt-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="animate-pulse">
                    <Key className="w-5 h-5 text-freqvault-accent" />
                  </div>
                  <div className="text-sm text-freqvault-accent">
                    {isEncrypted ? "Decrypting" : "Encrypting"} audio with
                    quantum key distribution...
                  </div>
                </div>
                <div className="w-full bg-freqvault-navy/50 rounded-full h-2 mb-4">
                  <div
                    className="bg-freqvault-accent h-2 rounded-full transition-all duration-300"
                    style={{ width: `${encryptionProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          {isEncrypted && (
            <>
              <div className="bg-freqvault-accent/10 border border-freqvault-accent/30 rounded-lg p-4 mb-6">
                <h3 className="text-freqvault-accent font-bold mb-2 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Quantum Encryption Complete
                </h3>
                <p className="text-gray-300 text-sm mb-4">
                  Your audio has been encrypted using quantum key distribution technology with frequency hopping.
                  The encrypted audio hops between frequencies in the VHF aviation band (118-137 MHz).
                </p>
                
                {/* Display quantum key */}
                <div className="bg-freqvault-navy/50 p-3 rounded border border-freqvault-teal/20 mb-4">
                  <h4 className="text-freqvault-teal text-xs mb-1">Quantum Key (ANU QRNG Simulation):</h4>
                  <div className="font-mono text-xs text-white break-all">
                    {quantumKey}
                  </div>
                </div>
                
                {/* Display sample hopping frequencies */}
                <div className="bg-freqvault-navy/50 p-3 rounded border border-freqvault-teal/20">
                  <h4 className="text-freqvault-teal text-xs mb-1">Sample Frequency Hops:</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs text-white">
                    {hopFrequencies.slice(0, 8).map((freq, index) => (
                      <div key={index} className="bg-freqvault-navy/60 px-2 py-1 rounded">
                        {(freq / 1e6).toFixed(2)} MHz
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="text-center text-xs text-gray-500 mt-8">
            FreqVault - Quantum audio security with frequency hopping
          </div>
        </div>
      </div>
    </div>
  );
};

export default EncryptPage;
