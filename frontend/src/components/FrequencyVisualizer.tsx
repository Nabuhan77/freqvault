import { useEffect, useRef, useState } from "react";
import { Play, Pause, AudioWaveform, Lock } from "lucide-react";
import { toast } from "sonner";

interface FrequencyVisualizerProps {
  audioBlob?: Blob;
  isEncrypted?: boolean;
  visualizationMode?: "waveform"; // Fixed to just waveform
  hopFrequencies?: number[]; // Add this prop to accept frequency hopping pattern
}

const FrequencyVisualizer = ({ 
  audioBlob, 
  isEncrypted = false,
  visualizationMode = "waveform",
  hopFrequencies = [] // Default to empty array
}: FrequencyVisualizerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeData, setTimeData] = useState<Uint8Array | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [animationId, setAnimationId] = useState<number | null>(null);
  const [freqHopEnabled, setFreqHopEnabled] = useState(isEncrypted);
  const [hopRate, setHopRate] = useState(500); // ms between hops
  const [lastHopTime, setLastHopTime] = useState(0);
  const [timeStamps, setTimeStamps] = useState<number[]>([]);
  const [localHopFrequencies, setLocalHopFrequencies] = useState<number[]>([]);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const freqCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioElementSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Constants for frequency hopping simulation
  const START_FREQ = 118; // 118 MHz (VHF aviation band start)
  const END_FREQ = 137;   // 137 MHz (VHF aviation band end)
  const NUM_HOPS = 20;    // Number of hops to display
  
  // Create demo audio URL if no audioBlob provided
  useEffect(() => {
    if (audioBlob) {
      setAudioUrl(URL.createObjectURL(audioBlob));
    } else {
      // Use a demo audio URL for aviation communications
      setAudioUrl("https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg");
    }
    
    return () => {
      if (audioUrl && audioUrl.startsWith("blob:")) URL.revokeObjectURL(audioUrl);
    };
  }, [audioBlob]);

  // Set frequency hopping when encryption state changes or hopFrequencies prop changes
  useEffect(() => {
    setFreqHopEnabled(isEncrypted);
    
    // If hopFrequencies is provided and not empty, use those frequencies
    if (hopFrequencies && hopFrequencies.length > 0) {
      // Scale to MHz for display
      const scaledFrequencies = hopFrequencies.map(freq => freq / 1e6);
      setLocalHopFrequencies(scaledFrequencies);
      
      // Generate time stamps (5 hops per second simulation)
      const times = hopFrequencies.map((_, i) => i / 5);
      setTimeStamps(times);
    } else if (isEncrypted) {
      // Otherwise generate a new pattern
      generateHoppingPattern();
    }
  }, [isEncrypted, hopFrequencies]);

  // Generate frequency hopping pattern based on time (simulating quantum key derivation)
  const generateHoppingPattern = () => {
    // Generate a seed from current time (simulating a crypto key seed)
    const now = new Date().getTime();
    const seed = Number(BigInt(now) & BigInt(0xFFFFFFFF));
    
    // Set a seeded random generator
    const seededRandom = (min: number, max: number) => {
      const x = Math.sin(seed + localHopFrequencies.length) * 10000;
      const result = min + (Math.abs(x) % 1) * (max - min);
      return result;
    };
    
    // Generate hop frequencies
    const frequencies: number[] = [];
    const times: number[] = [];
    
    for (let i = 0; i < NUM_HOPS; i++) {
      frequencies.push(seededRandom(START_FREQ, END_FREQ));
      times.push(i / 5); // 5 hops per second simulation
    }
    
    setLocalHopFrequencies(frequencies);
    setTimeStamps(times);
  };

  const setupAudioContext = async () => {
    if (!audioContext) {
      const newAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const newAnalyser = newAudioContext.createAnalyser();
      
      // Set FFT size for waveform visualization
      newAnalyser.fftSize = 256;
      analyserRef.current = newAnalyser;
      setAudioContext(newAudioContext);
      
      if (audioRef.current) {
        audioElementSourceRef.current = newAudioContext.createMediaElementSource(audioRef.current);
        audioElementSourceRef.current.connect(newAnalyser);
        newAnalyser.connect(newAudioContext.destination);
      }
    }
  };

  // Draw waveform visualization
  const drawWaveform = (ctx: CanvasRenderingContext2D, dataArray: Uint8Array, bufferLength: number) => {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    if (freqHopEnabled) {
      gradient.addColorStop(0, '#8B5CF6');
      gradient.addColorStop(1, '#0EA5E9');
    } else {
      gradient.addColorStop(0, '#0EA5E9');
      gradient.addColorStop(1, '#06B6D4');
    }
    
    ctx.lineWidth = 2;
    ctx.strokeStyle = gradient;
    ctx.beginPath();
    
    const sliceWidth = width / bufferLength;
    let x = 0;
    
    // Apply frequency hopping to waveform if enabled
    const processedData = freqHopEnabled ? applyWaveformHopping(dataArray) : dataArray;
    
    for (let i = 0; i < bufferLength; i++) {
      const v = processedData[i] / 128.0;
      const y = v * height / 2;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      
      x += sliceWidth;
    }
    
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    
    // Add glow effect
    ctx.shadowBlur = 10;
    ctx.shadowColor = freqHopEnabled ? "#8B5CF6" : "#0EA5E9";
    ctx.stroke();
    ctx.shadowBlur = 0;
  };
  
  // Draw frequency hopping pattern
  const drawFrequencyHops = () => {
    if (!freqCanvasRef.current || localHopFrequencies.length === 0) return;
    
    const canvas = freqCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Set background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
    ctx.lineWidth = 0.5;
    
    // Vertical grid lines (time)
    for (let i = 0; i <= 10; i++) {
      const x = (width / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    // Horizontal grid lines (frequency)
    for (let i = 0; i <= 8; i++) {
      const y = (height / 8) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Draw axes labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '10px Arial';
    
    // X-axis (time)
    for (let i = 0; i <= 10; i++) {
      const x = (width / 10) * i;
      const time = (i * 4 / 10).toFixed(1);
      ctx.fillText(`${time}s`, x - 10, height - 5);
    }
    
    // Y-axis (frequency)
    for (let i = 0; i <= 8; i++) {
      const y = height - (height / 8) * i;
      const freq = START_FREQ + (END_FREQ - START_FREQ) * (i / 8);
      ctx.fillText(`${freq.toFixed(0)}MHz`, 5, y - 5);
    }
    
    // Plot frequency hops
    if (localHopFrequencies.length > 0) {
      ctx.strokeStyle = '#8B5CF6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      // Scale values to canvas dimensions
      const scaleX = width / (timeStamps[timeStamps.length - 1] || 4);
      const scaleY = height / (END_FREQ - START_FREQ);
      
      // First point
      const x0 = 0;
      const y0 = height - (localHopFrequencies[0] - START_FREQ) * scaleY;
      ctx.moveTo(x0, y0);
      
      // Connect all points
      for (let i = 1; i < localHopFrequencies.length; i++) {
        const x = timeStamps[i] * scaleX;
        const y = height - (localHopFrequencies[i] - START_FREQ) * scaleY;
        ctx.lineTo(x, y);
      }
      
      ctx.stroke();
      
      // Draw points
      ctx.fillStyle = '#0EA5E9';
      for (let i = 0; i < localHopFrequencies.length; i++) {
        const x = timeStamps[i] * scaleX;
        const y = height - (localHopFrequencies[i] - START_FREQ) * scaleY;
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Add title
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 12px Arial';
      ctx.fillText('VHF Aviation Band Frequency Hopping Pattern', 10, 20);
      
      // Add small lock icon to represent encryption
      ctx.fillStyle = '#8B5CF6';
      ctx.fillRect(width - 25, 10, 15, 15);
      ctx.fillStyle = 'white';
      ctx.fillText('🔒', width - 24, 22);
    }
  };
  
  const startVisualization = () => {
    if (!analyserRef.current || !canvasRef.current) return;
    
    const bufferLength = analyserRef.current.frequencyBinCount;
    const timeArray = new Uint8Array(bufferLength);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    // Make sure canvas is sized correctly
    canvas.width = canvas.clientWidth * window.devicePixelRatio;
    canvas.height = canvas.clientHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    const updateVisualization = () => {
      if (!analyserRef.current || !ctx) return;
      
      // Get current audio data
      analyserRef.current.getByteTimeDomainData(timeArray);
      setTimeData(new Uint8Array(timeArray));
      
      // Draw waveform visualization
      drawWaveform(ctx, timeArray, bufferLength);
      
      // Check if it's time for a frequency hop
      if (freqHopEnabled) {
        const now = Date.now();
        if (now - lastHopTime > hopRate) {
          // Dynamically change hop rate for more realistic behavior
          setHopRate(300 + Math.random() * 700);
          setLastHopTime(now);
          
          // Update frequency hop visualization
          drawFrequencyHops();
        }
      }
      
      const id = requestAnimationFrame(updateVisualization);
      setAnimationId(id);
    };
    
    updateVisualization();
    
    // Initialize frequency hop visualization
    if (freqHopEnabled && freqCanvasRef.current) {
      const freqCanvas = freqCanvasRef.current;
      freqCanvas.width = freqCanvas.clientWidth * window.devicePixelRatio;
      freqCanvas.height = freqCanvas.clientHeight * window.devicePixelRatio;
      drawFrequencyHops();
    }
  };

  const stopVisualization = () => {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      setAnimationId(null);
    }
  };

  const handlePlayPause = async () => {
    if (!audioRef.current) return;
    
    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        stopVisualization();
      } else {
        await setupAudioContext();
        audioRef.current.play();
        setIsPlaying(true);
        startVisualization();
      }
    } catch (error) {
      console.error("Audio playback error:", error);
      toast.error("Failed to play audio");
    }
  };

  // Apply waveform hopping algorithm
  const applyWaveformHopping = (data: Uint8Array): Uint8Array => {
    const result = new Uint8Array(data.length);
    const now = Date.now();
    const seed = Math.floor(now / hopRate);
    
    for (let i = 0; i < data.length; i++) {
      // For waveform, we need to maintain the pattern around the center (128)
      // to avoid audio distortion visuals
      const centerValue = 128;
      const deviation = data[i] - centerValue;
      
      // Apply different transformations based on time and quantum distortions
      const hopPattern = (i + seed) % 4;
      
      switch (hopPattern) {
        case 0: // Quantum frequency shift
          const shiftIndex = (i + Math.floor(seed / 2)) % data.length;
          result[i] = data[shiftIndex];
          break;
        case 1: // Quantum amplitude modulation
          const amplitudeFactor = 0.7 + 0.5 * Math.sin(now / 2000);
          result[i] = Math.floor(centerValue + deviation * amplitudeFactor);
          break;
        case 2: // Quantum phase shift
          const phaseShift = 5 * Math.sin(now / 1500);
          const shiftedIndex = Math.max(0, Math.min(data.length - 1, Math.floor(i + phaseShift)));
          result[i] = data[shiftedIndex];
          break;
        case 3: // Quantum noise variation
        default:
          const jitter = Math.sin(now / 800 + i * 0.2) * 3;
          result[i] = Math.max(0, Math.min(255, Math.floor(data[i] + jitter)));
          break;
      }
    }
    
    return result;
  };

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      stopVisualization();
      if (audioContext) {
        audioContext.close();
      }
    };
  }, [audioContext]);

  // Initial rendering of frequency hopping chart if encrypted
  useEffect(() => {
    // Initial render of frequency hop chart if encrypted
    if (freqHopEnabled && freqCanvasRef.current) {
      const freqCanvas = freqCanvasRef.current;
      freqCanvas.width = freqCanvas.clientWidth * window.devicePixelRatio;
      freqCanvas.height = freqCanvas.clientHeight * window.devicePixelRatio;
      // Draw the frequency hops immediately
      drawFrequencyHops();
    }
  }, [freqHopEnabled, localHopFrequencies]);

  // Add silent canvas rendering for non-playing audio state to show visualization
  useEffect(() => {
    if (!isPlaying) {
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) return;
        
        // Make sure canvas is sized correctly
        canvas.width = canvas.clientWidth * window.devicePixelRatio;
        canvas.height = canvas.clientHeight * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        // Generate mock waveform data for visualization
        const waveData = new Uint8Array(64);
        for (let i = 0; i < waveData.length; i++) {
          // Create a more dynamic waveform when encrypted
          if (freqHopEnabled) {
            // Create a more complex waveform with multiple frequencies
            waveData[i] = 128 + 
              30 * Math.sin(i / 3 + Date.now() / 2000) + 
              20 * Math.sin(i / 7 + Date.now() / 1000) +
              10 * Math.sin(i / 2 + Date.now() / 3000);
          } else {
            // Simple sine wave
            waveData[i] = 128 + 40 * Math.sin(i / 5 + Date.now() / 3000);
          }
        }
        
        // Apply quantum hopping if enabled
        const processedData = freqHopEnabled ? applyWaveformHopping(waveData) : waveData;
        
        // Draw the waveform
        drawWaveform(ctx, processedData, processedData.length);
      }
      
      // Update frequency hopping visualization
      if (freqHopEnabled && freqCanvasRef.current) {
        const freqCanvas = freqCanvasRef.current;
        freqCanvas.width = freqCanvas.clientWidth * window.devicePixelRatio;
        freqCanvas.height = freqCanvas.clientHeight * window.devicePixelRatio;
        drawFrequencyHops();
      }
      
      // Request next frame for animation
      requestAnimationFrame(() => {
        if (!isPlaying) {
          // Only update if still not playing
          // This creates a subtle animation effect for the static waveform
          setTimeout(() => {
            if (!isPlaying) {
              // Force update to trigger the useEffect again
              setFreqHopEnabled(prev => prev);
            }
          }, 50);
        }
      });
    }
  }, [freqHopEnabled, isPlaying]);

  return (
    <div className="w-full">
      <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} className="hidden" />
      
      <div className="mb-4">
        <button
          onClick={handlePlayPause}
          className="freqvault-btn bg-gradient-to-r from-freqvault-teal to-freqvault-cyan hover:from-freqvault-teal/90 hover:to-freqvault-cyan/90"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          {isPlaying ? "Pause Audio" : "Play Audio"}
        </button>
      </div>
      
      <div className="w-full h-64 bg-black/60 rounded-lg border border-freqvault-teal/20 mb-6 p-2 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ 
            background: 'linear-gradient(to bottom, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.3) 100%)'
          }}
        />
      </div>
      
      {/* Frequency Hopping Visualization - always render but only show when encrypted */}
      <div className={`w-full h-64 bg-black/60 rounded-lg border border-freqvault-teal/20 mb-6 p-2 overflow-hidden ${freqHopEnabled ? 'block' : 'hidden'}`}>
        <canvas
          ref={freqCanvasRef}
          className="w-full h-full"
        />
      </div>
      
      <div className="text-sm text-gray-400 flex items-center">
        <AudioWaveform className="w-4 h-4 mr-2 text-freqvault-teal" />
        {isEncrypted ? (
          <p>Visualizing quantum encrypted waveform with frequency hopping mechanism</p>
        ) : (
          <p>
            Visualizing standard audio waveform in real-time
          </p>
        )}
      </div>
    </div>
  );
};

export default FrequencyVisualizer;
