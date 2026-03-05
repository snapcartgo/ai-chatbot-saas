(function () {
  const script = document.currentScript;
  const botId = script.getAttribute("data-bot-id");

  if (!botId) return;

  const button = document.createElement("button");
  button.innerText = "💬";
  button.style.position = "fixed";
  button.style.bottom = "20px";
  button.style.right = "20px";
  button.style.width = "60px";
  button.style.height = "60px";
  button.style.borderRadius = "50%";
  button.style.border = "none";
  button.style.background = "#2563eb";
  button.style.color = "#fff";
  button.style.fontSize = "24px";
  button.style.cursor = "pointer";
  button.style.zIndex = "9999";

  const iframe = document.createElement("iframe");
  iframe.src = `http://localhost:3000/widget?botId=${botId}`;
  iframe.style.position = "fixed";
  iframe.style.bottom = "20px";
  iframe.style.right = "20px";
  iframe.style.width = "350px";
  iframe.style.height = "500px";
  iframe.style.border = "none";
  iframe.style.borderRadius = "12px";
  iframe.style.display = "none";
  iframe.style.zIndex = "9999";

  button.onclick = () => {
    iframe.style.display =
      iframe.style.display === "none" ? "block" : "none";
  };

  document.body.appendChild(button);
  document.body.appendChild(iframe);
})();