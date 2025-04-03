import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import RecordPage from "./pages/RecordPage";
import EncryptPage from "./pages/EncryptPage";
import NotFound from "./pages/NotFound";
import AudioRecorder from "@/components/AudioRecorder";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/record" element={<RecordPage />} />
            <Route path="/encrypt" element={<EncryptPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <AudioRecorder />
      </TooltipProvider>
      <Toaster />
      <Sonner />
    </QueryClientProvider>
  );
}

export default App;
