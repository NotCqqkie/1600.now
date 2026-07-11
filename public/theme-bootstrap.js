(() => {
  try {
    const savedTheme = localStorage.getItem("theme");
    document.documentElement.classList.toggle("dark", savedTheme === "dark");
  } catch {
    document.documentElement.classList.remove("dark");
  }
})();
