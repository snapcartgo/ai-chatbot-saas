(function () {
  const script = document.currentScript;
  const botId = script.getAttribute("data-bot-id");

  if (!botId) {
    console.error("AI Chatbot Error: 'data-bot-id' is missing.");
    return;
  }

  const domain = window.location.hostname;

  fetch(`https://ai-chatbot-saas-five.vercel.app/api/verify-domain?botId=${botId}&domain=${domain}`)
    .then((res) => {
      if (!res.ok) throw new Error("Verification API Error");
      return res.json();
    })
    .then((data) => {
      if (!data.allowed) {
        console.warn("AI Chatbot: Domain not allowed.");
        return;
      }
      startWidget();
    })
    .catch((err) => {
      console.error("AI Chatbot: Verification failed:", err);
    });

  function startWidget() {
    let isMobile = window.innerWidth < 768;

    const button = document.createElement("div");
    button.innerHTML = "💬";

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
      fontSize: "22px",
      cursor: "pointer",
      zIndex: "999999",
      boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
      transition: "all 0.3s ease"
    });

    document.body.appendChild(button);

    const iframe = document.createElement("iframe");
    const widgetUrl = new URL("https://ai-chatbot-saas-five.vercel.app/widget");
      widgetUrl.searchParams.set("botId", botId);
      iframe.src = widgetUrl.toString();

    function applyStyles() {
      isMobile = window.innerWidth < 768;

      Object.assign(iframe.style, {
        position: "fixed",
        bottom: isMobile ? "0" : "90px",
        right: isMobile ? "0" : "20px",
        width: isMobile ? "100vw" : "360px",
        height: isMobile ? "100vh" : "520px",
        border: "none",
        borderRadius: isMobile ? "0" : "12px",
        boxShadow: isMobile ? "none" : "0 10px 40px rgba(0,0,0,0.3)",
        zIndex: "999999",
        display: "none",
        background: "#fff"
      });

      button.style.width = isMobile ? "55px" : "60px";
      button.style.height = isMobile ? "55px" : "60px";
    }

    applyStyles();
    window.addEventListener("resize", applyStyles);

    document.body.appendChild(iframe);

    let open = false;

    function toggleChat() {
      open = !open;
      iframe.style.display = open ? "block" : "none";

      if (isMobile) {
        document.body.style.overflow = open ? "hidden" : "";
      }

      button.style.transform = open ? "scale(0.9)" : "scale(1)";
    }

    button.onclick = toggleChat;

    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && open) {
        toggleChat();
      }
    });
  }
})();
