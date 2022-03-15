// CURRICULUM ICON ANIMATIONS
function curriculum_icon(a) {
  var element = document.getElementById("curriculum-item");
  if (a === "enter") {
    element.classList.add("fa-beat");
  } else {
    element.classList.remove("fa-beat");
  }
}

// PHOTO ICON ANIMATIONS
function photo_icon(a) {
  var element = document.getElementById("photo-item");
  if (a === "enter") {
    element.classList.add("fa-beat");
  } else {
    element.classList.remove("fa-beat");
  }
}

// TOOGLE THEME MAIN
function change_theme() {
  var btn_icon = document.getElementById("theme-item");
  var theme = document.querySelector("#theme-link");
  if (theme.getAttribute("href") === "./css/main/main-dark.css") {
    theme.href = "./css/main/main-light.css";
    btn_icon.classList.remove("fa-sun");
    btn_icon.classList.add("fa-moon");
  } else {
    theme.href = "./css/main/main-dark.css";
    btn_icon.classList.remove("fa-moon");
    btn_icon.classList.add("fa-sun");
  }
}

// CHANGE PAGE
function change_page(link) {
  document.location = link;
}

// CHANGE NAVBAR ACTIVE
function change_active() {
  const sections = document.querySelectorAll("section");
  const navBtn = document.querySelectorAll(
    ".main-container .navbar .left-nav a:not(:first-child)"
  );
  window.onscroll = () => {
    var current = "";
    sections.forEach((section) => {
      const sectionTop = section.offsetTop;
      if (scrollY >= sectionTop - 70) {
        current = section.getAttribute("id");
      }
    });

    navBtn.forEach((a) => {
      a.classList.remove("active");
      console.log(a.getAttribute("class"));
      if (a.classList.contains(current)) {
        a.classList.add("active");
      }
    });
  };
  console.log(sections);
  console.log(navBtn);
}

// TOOGLE THEME CV
function change_theme_cv() {
  var btn_icon = document.getElementById("theme-item");
  var theme = document.querySelector("#theme-link");
  console.log(theme.getAttribute("href"));
  if (theme.getAttribute("href") === "./css/cv/cv-dark.css") {
    theme.href = "./css/cv/cv-light.css";
    btn_icon.classList.remove("fa-sun");
    btn_icon.classList.add("fa-moon");
  } else {
    theme.href = "./css/cv/cv-dark.css";
    btn_icon.classList.remove("fa-moon");
    btn_icon.classList.add("fa-sun");
  }
}

// BURGUER FUNCTION
function burguer_click() {
  const left_av_class = document.querySelectorAll(".left-nav")[0];
  console.log(left_av_class.style.display);
  if (
    left_av_class.style.display === "" ||
    left_av_class.style.display === "none"
  ) {
    left_av_class.style.display = "flex";
  } else {
    left_av_class.style.display = "none";
  }
}

// THEME ICON ANIMATION
function theme_icon_animate(a) {
  var element = document.getElementById("theme-item");
  if (a === "enter") {
    element.classList.add("fa-spin");
  } else {
    element.classList.remove("fa-spin");
  }
}
