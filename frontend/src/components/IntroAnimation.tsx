
import { useState, useEffect } from "react";
import { Shield, Lock } from "lucide-react";

interface IntroAnimationProps {
  onComplete: () => void;
}

const IntroAnimation = ({ onComplete }: IntroAnimationProps) => {
  const [animationState, setAnimationState] = useState<
    "initial" | "logo" | "text" | "complete"
  >("initial");

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setAnimationState("logo");
    }, 300);

    const timer2 = setTimeout(() => {
      setAnimationState("text");
    }, 1000);

    const timer3 = setTimeout(() => {
      setAnimationState("complete");
      onComplete();
    }, 2500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-freqvault-dark">
      <div className="flex flex-col items-center">
        <div
          className={`transform transition-all duration-1000 ease-out ${
            animationState === "initial"
              ? "opacity-0 scale-50"
              : "opacity-100 scale-100"
          }`}
        >
          <div className="relative">
            <Shield
              className="w-24 h-24 text-freqvault-teal"
              strokeWidth={1.5}
            />
            <Lock
              className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-12 text-freqvault-accent transition-opacity duration-700 ${
                animationState === "logo" ? "opacity-100" : "opacity-0"
              }`}
              strokeWidth={1.5}
            />
          </div>
        </div>
        <div
          className={`mt-4 text-2xl font-bold text-white transition-all duration-700 ${
            animationState === "text" || animationState === "complete"
              ? "opacity-100 transform translate-y-0"
              : "opacity-0 transform translate-y-4"
          }`}
        >
          <span className="text-freqvault-teal">Freq</span>
          <span className="text-freqvault-accent">Vault</span>
        </div>
      </div>
    </div>
  );
};

export default IntroAnimation;
