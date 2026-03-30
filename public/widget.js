(function () {
  const script = document.currentScript;
  
  // Grab the ID from the script tag
  const botId = script.getAttribute("data-bot-id");

  // If no ID is found, don't load anything to prevent defaulting to Admin ID
  if (!botId) {
    console.error("AI Chatbot Error: 'data-bot-id' is missing from the script tag.");
    return;
  }

  const domain = window.location.hostname;

  // Domain Verification
  fetch(`https://ai-chatbot-saas-five.vercel.app/api/verify-domain?botId=${botId}&domain=${domain}`)
    .then(res => {
      if (!res.ok) throw new Error("Verification API Error");
      return res.json();
    })
    .then(data => {
      if (!data.allowed) {
        console.warn("AI Chatbot: Domain not allowed for this bot ID.");
        return;
      }
      startWidget();
    })
    .catch(err => {
      console.error("AI Chatbot: Verification failed:", err);
    });

  function startWidget() {
    // --- CHAT BUTTON ---
    const button = document.createElement("div");
    button.innerHTML = "💬";
    button.style.position = "fixed";
    button.style.bottom = "20px";
    button.style.right = "20px";
    button.style.width = "60px";
    button.style.height = "60px";
    button.style.background = "#2563eb";
    button.style.borderRadius = "50%";
    button.style.display = "flex";
    button.style.alignItems = "center";
    button.style.justifyContent = "center";
    button.style.color = "#fff";
    button.style.fontSize = "24px";
    button.style.cursor = "pointer";
    button.style.zIndex = "999999";
    button.style.boxShadow = "0 8px 20px rgba(0,0,0,0.2)";
    document.body.appendChild(button);

    // --- CHAT IFRAME ---
    const iframe = document.createElement("iframe");

    // IMPORTANT: Ensure the URL matches your folder [chatbotId] exactly.
    // Since your folder is capital 'I', we use that here.
    iframe.src = `https://ai-chatbot-saas-five.vercel.app/chat/${botId}`;

    iframe.style.position = "fixed";
    iframe.style.bottom = "90px";
    iframe.style.right = "20px";
    iframe.style.width = "360px";
    iframe.style.height = "520px";
    iframe.style.border = "none";
    iframe.style.borderRadius = "12px";
    iframe.style.boxShadow = "0 10px 40px rgba(0,0,0,0.3)";
    iframe.style.zIndex = "999999";
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    let open = false;
    button.onclick = function () {
      open = !open;
      iframe.style.display = open ? "block" : "none";
    };
  }
})();