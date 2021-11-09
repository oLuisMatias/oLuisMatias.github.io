function burger() {
  const burgerButton = document.getElementById("burgerButton");
  const navClass = document.getElementById("nav").classList[0];

  if (navClass == "closed-nav") {
    nav.classList.remove("closed-nav");
    nav.classList.add("opened-nav");
  } else {
    nav.classList.add("closed-nav");
    nav.classList.remove("opened-nav");
  }
}

// burgerButton.addEventListener("click", () => {
//   nav.classList.remove("closed-nav");
//   nav.classList.add("opened-nav");
// });
//
//
//
//
//
// nav = document.querySelector("nav");
// mobileBtnExit = document.getElementById("mobile-exit");

// burgerButton.addEventListener("click", () => {
//   nav.classList.add("menu-btn");
// });

// mobileBtnExit.addEventListener("click", () => {
//   nav.classList.remove("menu-btn");
// });
