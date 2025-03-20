
import { useLocation, Link } from "react-router-dom";
import { Shield, Mic, Play, Lock } from "lucide-react";

const NavBar = () => {
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };
  
  return (
    <nav className="fixed top-0 left-0 right-0 z-10 bg-freqvault-navy bg-opacity-80 backdrop-blur-md shadow-md py-4">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-freqvault-teal" />
            <span className="text-xl font-bold text-white">FreqVault</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-4">
            <Link 
              to="/" 
              className={`px-3 py-2 rounded-md flex items-center gap-2 transition-all duration-300 ${
                isActive('/') 
                  ? 'bg-freqvault-teal/20 text-freqvault-teal' 
                  : 'text-gray-300 hover:text-white hover:bg-freqvault-navy/50'
              }`}
            >
              <Shield size={18} />
              <span>Home</span>
            </Link>
            
            <Link 
              to="/record" 
              className={`px-3 py-2 rounded-md flex items-center gap-2 transition-all duration-300 ${
                isActive('/record') 
                  ? 'bg-freqvault-teal/20 text-freqvault-teal' 
                  : 'text-gray-300 hover:text-white hover:bg-freqvault-navy/50'
              }`}
            >
              <Mic size={18} />
              <span>Record</span>
            </Link>
            
            <Link 
              to="/visualize" 
              className={`px-3 py-2 rounded-md flex items-center gap-2 transition-all duration-300 ${
                isActive('/visualize') 
                  ? 'bg-freqvault-teal/20 text-freqvault-teal' 
                  : 'text-gray-300 hover:text-white hover:bg-freqvault-navy/50'
              }`}
            >
              <Play size={18} />
              <span>Visualize</span>
            </Link>
            
            <Link 
              to="/encrypt" 
              className={`px-3 py-2 rounded-md flex items-center gap-2 transition-all duration-300 ${
                isActive('/encrypt') 
                  ? 'bg-freqvault-teal/20 text-freqvault-teal' 
                  : 'text-gray-300 hover:text-white hover:bg-freqvault-navy/50'
              }`}
            >
              <Lock size={18} />
              <span>Encrypt</span>
            </Link>
          </div>
          
          <div className="md:hidden flex items-center">
            {/* Mobile menu button would go here */}
            <button className="text-gray-300 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
