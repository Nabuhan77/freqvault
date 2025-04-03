
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import NavBar from "@/components/NavBar";
import FrequencyVisualizer from "@/components/FrequencyVisualizer";
import { Lock, AudioWaveform } from "lucide-react";
import { toast } from "sonner";

const VisualizePage = () => {
  const navigate = useNavigate();
  const [audioBlob] = useState<Blob | undefined>(undefined);
  const [visualizationMode] = useState<"waveform">("waveform");

  return (
    <div className="min-h-screen bg-gradient-to-b from-freqvault-dark to-[#0c1322] w-full">
      <NavBar />
      <div className="pt-24 pb-12 px-4 sm:px-6 md:px-8 lg:px-12 max-w-[90rem] mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 bg-gradient-to-r from-freqvault-teal to-freqvault-accent bg-clip-text text-transparent">
            Frequency Visualization
          </h1>
          <p className="text-gray-300">Real-time frequency hopping visualization with quantum encryption</p>
        </div>
        
        <div className="freqvault-card bg-gradient-to-br from-freqvault-navy/95 to-freqvault-dark/95 backdrop-blur-md border-freqvault-teal/30">
          <div className="mb-6">
            <p className="text-sm text-gray-400">
              <AudioWaveform className="w-4 h-4 inline-block mr-1" />
              Real-time aviation frequency hopping visualization system
            </p>
          </div>
          
          <FrequencyVisualizer 
            audioBlob={audioBlob} 
            visualizationMode={visualizationMode}
          />
          
          <div className="mt-8 pt-6 border-t border-freqvault-teal/20">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-left">
                <h3 className="text-freqvault-teal font-medium mb-1">Quantum Encryption Ready</h3>
                <p className="text-gray-300 text-sm">
                  Frequency hopping encryption creates a secure communication channel for aviation transmissions
                </p>
              </div>
              {/* <button>
                onClick={() => navigate("/encrypt")} 
                className="freqvault-btn-accent bg-gradient-to-r from-freqvault-accent to-freqvault-accent/80 hover:from-freqvault-accent/90 hover:to-freqvault-accent/70 shadow-lg"
              >
                <Lock className="w-5 h-5" />
                Proceed to Encryption
              </button> */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisualizePage;
