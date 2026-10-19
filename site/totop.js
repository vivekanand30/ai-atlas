// Floating "back to top" button, shown after scrolling down a bit. Shared by every page.
(() => {
  const btn = document.createElement("button");
  btn.className = "to-top";
  btn.type = "button";
  btn.setAttribute("aria-label", "Back to top");
  btn.title = "Back to top";
  btn.textContent = "↑";
  btn.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));
  document.body.append(btn);
  const update = () => btn.classList.toggle("show", scrollY > 600);
  addEventListener("scroll", update, { passive: true });
  update();
})();
