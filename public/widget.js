(function () {
    if (window.__kajabiChatbotLoaded) return;
    window.__kajabiChatbotLoaded = true;

    const iframe = document.createElement("iframe");

    iframe.src = "http://localhost:3001/embed";
    iframe.title = "Kajabi Chatbot";
    iframe.style.position = "fixed";
    iframe.style.right = "20px";
    iframe.style.bottom = "20px";
    iframe.style.width = "128px";
    iframe.style.height = "128px";
    iframe.style.border = "0";
    iframe.style.zIndex = "999999";
    iframe.style.background = "transparent";
    iframe.style.overflow = "hidden";

    iframe.setAttribute("allowtransparency", "true");
    iframe.setAttribute("allow", "clipboard-write");

    document.body.appendChild(iframe);

    window.addEventListener("message", function (event) {
        if (!event.data || event.data.type !== "KAJABI_CHATBOT_SIZE") return;

        iframe.style.width = event.data.width;
        iframe.style.height = event.data.height;
    });
})();