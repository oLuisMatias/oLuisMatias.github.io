const center_nav = document.getElementById("center-nav");

function burguer_click() {
  if (center_nav.style.display === "block") {
    center_nav.style.display = "none";
  } else {
    center_nav.style.display = "block";
  }
}

function hide_menu(e) {
  if (window.innerWidth < 992) {
    var class_name = e.target.parentNode.classList[0];
    if (
      class_name === "test" ||
      class_name === "nav-btn" ||
      class_name === "nav-li"
    ) {
    } else {
      center_nav.style.display = "none";
    }
  }
}
document.body.addEventListener("click", hide_menu);

function change_active() {
  const all_sections = Array.from(document.getElementsByTagName("section"));
  const sections = all_sections.slice(1, all_sections.length);
  const center_nav_btns = document.querySelectorAll(
    ".center-nav .nav-ul .nav-li a"
  );

  window.onscroll = () => {
    var current = "";
    sections.forEach((section) => {
      const sectionTop = section.offsetTop;
      if (scrollY >= sectionTop - 200) {
        current = section.getAttribute("id");
      }
    });

    center_nav_btns.forEach((a) => {
      a.classList.remove("active");
      if (a.classList.contains(current)) {
        a.classList.add("active");
      }
    });
  };
}
change_active();

// FUNCAO PARA MUDAR O TEMA ESTA DESATIVA

// function change_theme_icon() {
//   const theme_btn = document.getElementById("theme-btn");
//   if (theme_btn.classList.contains("fa-sun")) {
//     theme_btn.classList.remove("fa-sun");
//     theme_btn.classList.add("fa-moon");
//     change_theme_colors();
//   } else {
//     theme_btn.classList.remove("fa-moon");
//     theme_btn.classList.add("fa-sun");
//     change_theme_colors();
//   }
// }

// function change_theme_colors() {
//   const theme_btn = document.getElementById("theme-btn");
//   if (theme_btn.classList.contains("fa-sun")) {
//     document.documentElement.style.setProperty("--main-color", "#303841");
//     document.documentElement.style.setProperty("--text", "#eeeeee");
//     document.documentElement.style.setProperty("--second-color", "#3a4750");
//     document.documentElement.style.setProperty("--other", "#d65a31");
//     document.documentElement.style.setProperty("--darker", "#21262c");
//   } else {
//     document.documentElement.style.setProperty("--main-color", "#DBE2EF");
//     document.documentElement.style.setProperty("--text", "#112D4E");
//     document.documentElement.style.setProperty("--second-color", "#F9F7F7");
//     document.documentElement.style.setProperty("--other", "#112D4E");
//     document.documentElement.style.setProperty(
//       "--darker",
//       "hsl(212, 64%, 50%)"
//     );
//   }
// }
// change_theme_colors();
