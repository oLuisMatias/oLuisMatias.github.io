function run_index_json(lang) {
  if (lang === "en") {
    var i = 0;
  } else {
    var i = 1;
  }
  var name = document.getElementById("json-name");
  var curriculum_title = document.getElementById("json-curriculum-title");
  var photo_title = document.getElementById("json-photo-title");
  fetch("./json-txt/index.json")
    .then(function (response) {
      return response.json();
    })
    .then(function (data) {
      name.innerHTML = data.name[i];
      curriculum_title.innerHTML = data.curriculum_block_title[i];
      photo_title.innerHTML = data.photo_block_title[i];
    });
}

function change_language() {
  var current_lang = document.getElementById("language-btn").innerHTML;
  console.log(current_lang);
  if (document.getElementById("language-btn").innerHTML === "PT") {
    run_index_json("pt");
    current_lang = document.getElementById("language-btn").innerHTML = "EN";
  } else {
    run_index_json("en");
    current_lang = document.getElementById("language-btn").innerHTML = "PT";
  }
}
