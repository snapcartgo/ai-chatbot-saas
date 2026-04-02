(function () {
  const script = document.currentScript;
  const botId = script.getAttribute("data-bot-id");

  if (!botId) {
    console.error("AI Chatbot Error: 'data-bot-id' is missing.");
    return;
  }

  const domain = window.location.hostname;

  // 🔐 VERIFY DOMAIN
  fetch(`https://ai-chatbot-saas-five.vercel.app/api/verify-domain?botId=${botId}&domain=${domain}`)
    .then(res => {
      if (!res.ok) throw new Error("Verification API Error");
      return res.json();
    })
    .then(data => {
      if (!data.allowed) {
        console.warn("AI Chatbot: Domain not allowed.");
        return;
      }
      startWidget();
    })
    .catch(err => {
      console.error("AI Chatbot: Verification failed:", err);
    });

   function startWidget() {
    let isMobile = window.innerWidth < 768;
    let initialWidth = window.innerWidth; // Store initial width
    let open = false;

    // 🔥 CHAT BUTTON
    const button = document.createElement("div");
    // Use textContent instead of innerHTML to satisfy security scans
    button.textContent = "💬";

    Object.assign(button.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      width: isMobile ? "55px" : "60px",
      height: isMobile ? "55px" : "60px",
      background: "#2563eb",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontSize: "24px",
      cursor: "pointer",
      zIndex: "2147483647", // Max possible z-index
      boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      userSelect: "none"
    });

    document.body.appendChild(button);

    // 🔥 IFRAME
    const iframe = document.createElement("iframe");
    
    // SECURE URL CONSTRUCTION (Prevents DOM text reinterpretation as HTML alerts)
    const baseUrl = "https://ai-chatbot-saas-five.vercel.app/chat/";
    try {
      const safeUrl = new URL(botId, baseUrl);
      safeUrl.searchParams.set("embed", "true");
      iframe.src = safeUrl.toString();
    } catch (e) {
      console.error("AI Chatbot: Invalid configuration.");
      return;
    }

    function applyStyles() {
      const currentWidth = window.innerWidth;
      isMobile = currentWidth < 768;

      // 🛑 KEYBOARD FIX: If the width hasn't changed, don't re-apply styles.
      // This stops the "jumping" when the mobile keyboard opens.
      if (open && isMobile && currentWidth === initialWidth) {
          return; 
      }
      initialWidth = currentWidth;

      Object.assign(iframe.style, {
        position: "fixed",
        bottom: isMobile ? "80px" : "95px", 
        right: isMobile ? "10px" : "20px",
        width: isMobile ? "calc(100% - 20px)" : "380px", 
        height: isMobile ? "65vh" : "600px", 
        maxHeight: isMobile ? "65vh" : "calc(100vh - 120px)",
        border: "none",
        borderRadius: "16px",
        boxShadow: "0 12px 48px rgba(0,0,0,0.15)",
        zIndex: "2147483646",
        display: open ? "block" : "none",
        // 🌈 EXTRA SPACE FIX: Make iframe background invisible
        background: "transparent", 
        colorScheme: "light",
        transition: "width 0.3s ease, bottom 0.3s ease" // Don't animate height to avoid lag
      });
    }

    applyStyles();
    window.addEventListener("resize", applyStyles);
    document.body.appendChild(iframe);

    // 🔥 TOGGLE FUNCTION
    function toggleChat() {
      open = !open;
      iframe.style.display = open ? "block" : "none";
      
      button.textContent = open ? "✕" : "💬";
      button.style.fontSize = open ? "28px" : "24px";
      
      // REMOVED: document.body.style.overflow = open ? "hidden" : ""; 
      // This allows the user to see/scroll the website while chatting
      
      button.style.transform = open ? "rotate(90deg) scale(0.9)" : "rotate(0deg) scale(1)";
    }

    button.onclick = toggleChat;

    // 🔥 ESC KEY CLOSE
    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && open) {
        toggleChat();
      }
    });
  }
})();