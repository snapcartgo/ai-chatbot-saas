(function () {
  const script = document.currentScript;
  const botId = script.getAttribute("data-bot-id");

  if (!botId) {
    console.error("AI Chatbot Error: 'data-bot-id' is missing.");
    return;
  }

  const domain = window.location.hostname;

  fetch(`https://ai-chatbot-saas-five.vercel.app/api/verify-domain?botId=${botId}&domain=${domain}`)
    .then(res => {
      if (!res.ok) throw new Error("Verification API Error");
      return res.json();
    })
    .then(data => {
      if (!data.allowed) {
        console.warn("Domain not allowed.");
        return;
      }
      startWidget();
    })
    .catch(err => {
      console.error("Verification failed:", err);
    });

  function startWidget() {
    const isMobile = window.innerWidth < 768;

    // 🔥 BUTTON
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
    });
    document.body.appendChild(button);

    // 🔥 IFRAME
    const iframe = document.createElement("iframe");
    iframe.src = `https://ai-chatbot-saas-five.vercel.app/chat/${botId}`;

    Object.assign(iframe.style, {
      position: "fixed",
      bottom: isMobile ? "0" : "90px",
      right: isMobile ? "0" : "20px",
      width: isMobile ? "100%" : "360px",
      height: isMobile ? "100%" : "520px",
      border: "none",
      borderRadius: isMobile ? "0" : "12px",
      boxShadow: isMobile ? "none" : "0 10px 40px rgba(0,0,0,0.3)",
      zIndex: "999999",
      display: "none",
    });

    document.body.appendChild(iframe);

    let open = false;

    button.onclick = function () {
      open = !open;
      iframe.style.display = open ? "block" : "none";

      // 🔥 Disable background scroll on mobile
      if (isMobile) {
        document.body.style.overflow = open ? "hidden" : "auto";
      }
    };
  }
})();