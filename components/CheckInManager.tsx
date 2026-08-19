import React, { useEffect, useState } from 'react';

export const CheckInManager: React.FC = () => {
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);

  useEffect(() => {
    const lastSeen = localStorage.getItem('lumina_last_seen');
    const now = Date.now();
    
    if (lastSeen) {
      const diffHours = (now - parseInt(lastSeen)) / (1000 * 60 * 60);
      
      if (diffHours > 48) {
        setWelcomeMessage("It's been a while... I've missed our talks. How have you been holding up?");
      } else if (diffHours > 12) {
        setWelcomeMessage("Welcome back. I was just thinking about you. Ready to talk?");
      } else {
        setWelcomeMessage("Hello again. I'm always here if you need to share anything else.");
      }
    } else {
      setWelcomeMessage("Hello. I'm Lumina. I'm so glad you're here. Would you like to talk?");
    }

    localStorage.setItem('lumina_last_seen', now.toString());

    // Auto-hide after 10 seconds
    const timer = setTimeout(() => setWelcomeMessage(null), 10000);
    return () => clearTimeout(timer);
  }, []);

  if (!welcomeMessage) return null;

  return (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md">
      <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl p-4 shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-top-10 duration-700">
        <div className="flex gap-4 items-start">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-orange-400 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-heart text-white text-sm"></i>
          </div>
          <div>
            <p className="text-xs font-medium text-white/90 leading-relaxed">
              {welcomeMessage}
            </p>
            <button 
              onClick={() => setWelcomeMessage(null)}
              className="mt-2 text-[10px] text-white/40 uppercase tracking-widest hover:text-white transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
