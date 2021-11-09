propertieName = [
  "--main",
  "--button",
  "--button-shadow",
  "--other-section",
  "--span1",
  "--icon",
  "--p-main",
];
lightTheme = [
  "#ecf0f3",
  "#ecf0f3",
  "rgba(48, 52, 58, 0.2)",
  "#dae0e4",
  "rgba(72, 100, 125, 1)",
  "rgba(72, 100, 125, 1)",
  "black",
];

darkTheme = [
  "#30343a",
  "#ecf0f3",
  "#474747",
  "#272b30",
  "#ecf0f3",
  "#30343a",
  "#ecf0f3",
];

function changeTheme() {
  var themeButton = document.getElementById("themeButton");
  var iconClass = themeButton.classList[1];

  if (iconClass == "fa-moon") {
    themeButton.classList.remove("fa-moon");
    themeButton.classList.add("fa-sun");
    for (let i = 0, len = propertieName.length; i < len; i++) {
      document.documentElement.style.setProperty(
        propertieName[i],
        darkTheme[i]
      );
    }
  } else {
    themeButton.classList.remove("fa-sun");
    themeButton.classList.add("fa-moon");
    for (let i = 0, len = propertieName.length; i < len; i++) {
      document.documentElement.style.setProperty(
        propertieName[i],
        lightTheme[i]
      );
    }
  }
}
