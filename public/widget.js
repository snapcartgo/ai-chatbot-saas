(function () {

  const script = document.currentScript;
  const botId = script.getAttribute("data-bot-id");

  const iframe = document.createElement("iframe");

  iframe.src = `https://ai-chatbot-saas-five.vercel.app/widget?botId=${botId}`;

  iframe.style.position = "fixed";
  iframe.style.bottom = "20px";
  iframe.style.right = "20px";
  iframe.style.width = "360px";
  iframe.style.height = "520px";
  iframe.style.border = "none";
  iframe.style.zIndex = "999999";
  iframe.style.borderRadius = "12px";
  iframe.style.boxShadow = "0 8px 30px rgba(0,0,0,0.2)";

  document.body.appendChild(iframe);

})();