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
    let open = false;

    // 🔥 CHAT BUTTON
    const button = document.createElement("div");
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
      zIndex: "2147483647", // Max z-index
      boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      userSelect: "none"
    });

    document.body.appendChild(button);

    // 🔥 IFRAME
    const iframe = document.createElement("iframe");
    // Ensure this route renders the ChatWidget with isEmbed={true}
    iframe.src = `https://ai-chatbot-saas-five.vercel.app/chat/${botId}?embed=true`;

    function applyStyles() {
      isMobile = window.innerWidth < 768;

      Object.assign(iframe.style, {
        position: "fixed",
        bottom: isMobile ? "0" : "95px",
        right: isMobile ? "0" : "20px",
        width: isMobile ? "100%" : "380px",
        height: isMobile ? "100%" : "600px", // Increased height for better view
        maxHeight: isMobile ? "100%" : "calc(100vh - 120px)",
        border: "none",
        borderRadius: isMobile ? "0" : "16px",
        boxShadow: isMobile ? "none" : "0 12px 48px rgba(0,0,0,0.15)",
        zIndex: "2147483646", // Just below button
        display: "none",
        background: "#fff",
        transition: "transform 0.3s ease"
      });
    }

    applyStyles();
    window.addEventListener("resize", applyStyles);
    document.body.appendChild(iframe);

    // 🔥 TOGGLE FUNCTION
    function toggleChat() {
      open = !open;
      iframe.style.display = open ? "block" : "none";
      
      // Update Button Icon
      button.textContent = open ? "✕" : "💬";
      button.style.fontSize = open ? "28px" : "24px";
      
      // Prevent background scroll on mobile
      if (isMobile) {
        document.body.style.overflow = open ? "hidden" : "";
      }

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