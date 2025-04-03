
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Shield, Lock } from "lucide-react";
import IntroAnimation from "@/components/IntroAnimation";

const HomePage = () => {
  const [showIntro, setShowIntro] = useState(true);
  const navigate = useNavigate();

  const handleIntroComplete = () => {
    setShowIntro(false);
  };

  return (
    <>
      {showIntro && <IntroAnimation onComplete={handleIntroComplete} />}
      
      <div className="min-h-screen w-full pt-16 relative overflow-hidden">
        {/* Hacking-style animated background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-freqvault-dark via-[#0c1322] to-[#080d18] opacity-90"></div>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMxMjJBNjgiIGZpbGwtb3BhY2l0eT0iMC40Ij48cGF0aCBkPSJNMzYgMzBoLTZsLTQgNGgtNnY2aDRsLTQgNGg2bDQtNGg2di02aC00bDQtNHptLTYgNmwtNCA0di00aDR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30"></div>
          
          {/* Matrix-like falling code effect with grid lines */}
          <div className="absolute inset-0 grid grid-cols-12 gap-px opacity-20">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="border-r border-freqvault-teal/10 h-full"></div>
            ))}
          </div>
          <div className="absolute inset-0 grid grid-rows-12 gap-px opacity-20">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="border-b border-freqvault-teal/10 w-full"></div>
            ))}
          </div>
          
          {/* Animated glowing orbs */}
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-freqvault-teal/20 rounded-full filter blur-[100px] animate-pulse"></div>
          <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-freqvault-accent/20 rounded-full filter blur-[120px] animate-pulse" style={{ animationDelay: "1s" }}></div>
        </div>

        <div className="freqvault-container animate-fade-in max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex justify-center items-center mb-4">
              <Shield className="w-12 h-12 text-freqvault-teal" />
              <Lock className="w-6 h-6 text-freqvault-accent absolute" />
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold mb-4 bg-gradient-to-r from-freqvault-teal to-freqvault-accent bg-clip-text text-transparent drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)]">
              FreqVault
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Advanced aviation security mechanism designed to encrypt pilot-to-ground audio communication
            </p>
          </div>
          
          <div className="bg-freqvault-navy/50 backdrop-blur-sm p-8 rounded-xl border border-freqvault-teal/30 hover:border-freqvault-teal/50 transition-all duration-300 shadow-lg shadow-freqvault-teal/10">
            <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
              <Mic className="w-6 h-6 text-freqvault-teal" />
              Audio Input
            </h2>
            <p className="text-gray-300 mb-8 text-lg">
              Record live audio from your microphone or upload existing audio files for FreqVault encryption.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={() => navigate("/record")} 
                className="freqvault-btn-accent text-lg py-4 px-8 bg-gradient-to-r from-freqvault-accent to-freqvault-accent/80 hover:from-freqvault-accent/90 hover:to-freqvault-accent/70 shadow-xl relative overflow-hidden group"
              >
                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-freqvault-accent/0 via-white/20 to-freqvault-accent/0 transform -translate-x-full group-hover:translate-x-full transition-all duration-700"></span>
                <Mic className="w-6 h-6" />
                Start Recording
              </button>
            </div>
          </div>
          
          <div className="text-center text-gray-400 text-sm mt-12">
            <p>FreqVault - Advanced Aviation Security</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default HomePage;
