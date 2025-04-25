document.addEventListener("DOMContentLoaded", () => {
  const lanterneBtn = document.getElementById("theme-toggle");
  const lanterneIcon = document.getElementById("lanterne-icon");

  const savedTheme = localStorage.getItem("theme") || "dark";
  document.body.setAttribute("data-theme", savedTheme);
  updateLanterneIcon(savedTheme);

  lanterneBtn.addEventListener("click", () => {
    const currentTheme = document.body.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    document.body.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    updateLanterneIcon(newTheme);
  });

  function updateLanterneIcon(theme) {
    if (!lanterneIcon) return;
    lanterneIcon.src =
      theme === "light"
        ? "assets/img/lumiere.png"
        : "assets/img/sombre.png";
  }
});
