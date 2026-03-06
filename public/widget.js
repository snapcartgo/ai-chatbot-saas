(function () {

  const script = document.currentScript;
  const botId = script.getAttribute("data-bot-id");

  // CHAT BUTTON
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

  // CHAT WINDOW
  const iframe = document.createElement("iframe");

  iframe.src = `https://ai-chatbot-saas-five.vercel.app/widget?botId=${botId}`;

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

    if (open) {
      iframe.style.display = "block";
    } else {
      iframe.style.display = "none";
    }

  };

})();