export default {
  async fetch(request, env, ctx) {
    // 1. Fetch the original page from your origin server (e.g., GitHub Pages)
    const response = await fetch(request);

    // 2. Only rewrite if the response is actually an HTML page
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      // Define your custom script tag
      const customScript = `<script type="module">
  const ownerRepo = "chuanqisun/code";

  document.addEventListener("keydown", (e) => {
    if (e.key !== "." || !(e.metaKey || e.ctrlKey)) return;
    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) return;

    const url = new URL(location.href);
    const lastSegment = url.pathname.split("/").pop();
    const path = lastSegment.includes(".")
      ? url.pathname
      : url.pathname.replace(/\\/$/, "");
    const githubUrl = path
      ? \`https://github.com/\${ownerRepo}/blob/master\${path}\`
      : \`https://github.com/\${ownerRepo}/\`;
    location.href = githubUrl;
  });
${"</script>"}`;

      return new HTMLRewriter()
        .on("head", {
          element(element) {
            element.append(customScript, { html: true });
          },
        })
        .transform(response);
    }

    return response;
  },
};
