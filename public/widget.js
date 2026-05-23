(function () {
  const script = document.currentScript;
  const botId = script && script.getAttribute("data-bot-id");

  if (!botId) {
    console.error("AI Chatbot Error: 'data-bot-id' is missing.");
    return;
  }

  if (!script || !script.src) {
    console.error("AI Chatbot Error: script source not found.");
    return;
  }

  let appOrigin = "";
  try {
    appOrigin = new URL(script.src).origin;
  } catch (error) {
    console.error("AI Chatbot Error: invalid widget script URL.", error);
    return;
  }

  const domain = window.location.hostname;

  fetch(
    `${appOrigin}/api/verify-domain?botId=${encodeURIComponent(
      botId
    )}&domain=${encodeURIComponent(domain)}`
  )
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
    let initialWidth = window.innerWidth;
    let open = false;

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
      zIndex: "2147483647",
      boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      userSelect: "none",
    });

    document.body.appendChild(button);

    const iframe = document.createElement("iframe");

    try {
      const safeUrl = new URL(`/chat/${encodeURIComponent(botId)}`, appOrigin);
      safeUrl.searchParams.set("embed", "true");
      iframe.src = safeUrl.toString();
    } catch (error) {
      console.error("AI Chatbot: Invalid iframe URL.", error);
      return;
    }

    iframe.allow = "microphone; clipboard-read; clipboard-write";

    function applyStyles() {
      const currentWidth = window.innerWidth;
      isMobile = currentWidth < 768;

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
        background: "transparent",
        colorScheme: "light",
        transition: "width 0.3s ease, bottom 0.3s ease",
      });
    }

    applyStyles();
    window.addEventListener("resize", applyStyles);
    document.body.appendChild(iframe);

    function toggleChat() {
      open = !open;
      iframe.style.display = open ? "block" : "none";

      button.textContent = open ? "✕" : "💬";
      button.style.fontSize = open ? "28px" : "24px";
      button.style.transform = open
        ? "rotate(90deg) scale(0.9)"
        : "rotate(0deg) scale(1)";
    }

    button.onclick = toggleChat;

    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && open) {
        toggleChat();
      }
    });
  }
})();