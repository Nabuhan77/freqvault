
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import NavBar from "@/components/NavBar";
import AudioRecorder from "@/components/AudioRecorder";
import { Mic, Headphones, Shield, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const RecordPage = () => {
  const navigate = useNavigate();
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [securityStatus, setSecurityStatus] = useState<"idle" | "scanning" | "secure">("idle");

  const handleAudioCaptured = (blob: Blob) => {
    setAudioBlob(blob);
    simulateSecurityScan();
    console.log("Audio blob captured", blob);
  };

  const simulateSecurityScan = () => {
    setSecurityStatus("scanning");
    setTimeout(() => {
      setSecurityStatus("secure");
      toast.success("Audio security scan complete - Ready for encryption");
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-freqvault-dark">
      <NavBar />
      <div className="pt-24 pb-12 px-4 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Secure Audio Input</h1>
          <p className="text-gray-300">Record aviation communications for FreqVault encryption</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="col-span-2">
            <div className="freqvault-card h-full">
              <AudioRecorder onAudioCaptured={handleAudioCaptured} />
            </div>
          </div>
          
          <div className="col-span-1">
            <div className="freqvault-card h-full flex flex-col">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-freqvault-teal" />
                Security Status
              </h2>
              
              <div className="flex-1 flex flex-col justify-center items-center">
                {securityStatus === "idle" && (
                  <div className="text-center">
                    <div className="w-24 h-24 rounded-full border-2 border-gray-600 flex items-center justify-center mx-auto mb-4">
                      <Shield className="w-12 h-12 text-gray-500" />
                    </div>
                    <p className="text-gray-400">Awaiting audio input</p>
                  </div>
                )}
                
                {securityStatus === "scanning" && (
                  <div className="text-center">
                    <div className="w-24 h-24 rounded-full border-2 border-freqvault-yellow flex items-center justify-center mx-auto mb-4 animate-pulse">
                      <Shield className="w-12 h-12 text-freqvault-yellow animate-pulse" />
                    </div>
                    <p className="text-freqvault-yellow">Scanning audio integrity...</p>
                  </div>
                )}
                
                {securityStatus === "secure" && (
                  <div className="text-center">
                    <div className="w-24 h-24 rounded-full border-2 border-freqvault-green flex items-center justify-center mx-auto mb-4">
                      <Shield className="w-12 h-12 text-freqvault-green" />
                    </div>
                    <p className="text-freqvault-green">Audio secure and ready</p>
                    
                    <button 
                      onClick={() => navigate("/encrypt")}
                      className="freqvault-btn-accent mt-6"
                    >
                      <ArrowRight className="w-5 h-5" />
                      Proceed to Encryption
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {audioBlob && (
          <div className="freqvault-card bg-freqvault-navy/80 mb-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white mb-0 flex items-center gap-2">
                <Headphones className="w-5 h-5 text-freqvault-teal" />
                Audio Preview
              </h2>
              
              <span className="text-xs bg-freqvault-teal/20 text-freqvault-teal px-2 py-1 rounded-full">
                Secure Channel Initialized
              </span>
            </div>
            
            <div className="mt-4">
              <audio
                src={URL.createObjectURL(audioBlob)}
                controls
                className="w-full h-12 bg-freqvault-navy/50 rounded"
              />
            </div>
            
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="bg-freqvault-navy/50 p-3 rounded-md border border-freqvault-teal/20">
                <div className="text-xs text-gray-400 mb-1">Transmission Type</div>
                <div className="font-mono text-freqvault-teal">PILOT-TO-TOWER</div>
              </div>
              
              <div className="bg-freqvault-navy/50 p-3 rounded-md border border-freqvault-teal/20">
                <div className="text-xs text-gray-400 mb-1">Quantum Key Status</div>
                <div className="font-mono text-freqvault-teal">READY FOR GENERATION</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecordPage;
