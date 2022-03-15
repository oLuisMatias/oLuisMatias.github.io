function run_cv_json(lang) {
  if (lang === "en") {
    var i = 0;
  } else {
    var i = 1;
  }
  var navbar_home = document.getElementById("json-navbar-home");
  var navbar_about_me = document.getElementById("json-navbar-about_me");
  var navbar_work = document.getElementById("json-navbar-work");
  var navbar_studies = document.getElementById("json-navbar-studies");
  var navbar_skills = document.getElementById("json-navbar-skills");
  var navbar_experiences = document.getElementById("json-navbar-experiences");
  var navbar_publications = document.getElementById("json-navbar-publications");

  var about_me_degree = document.getElementById("about_me-degree");
  var about_me_title = document.getElementById("about_me-title");
  var about_me_txt = document.getElementById("about_me-txt");
  var about_me_interests_title = document.getElementById(
    "about_me-interests-title"
  );
  var about_me_interests1 = document.getElementById("about_me_interests1");
  var about_me_interests2 = document.getElementById("about_me_interests2");
  var about_me_interests3 = document.getElementById("about_me_interests3");
  var about_me_interests4 = document.getElementById("about_me_interests4");
  var about_me_interests5 = document.getElementById("about_me_interests5");
  var about_me_interests6 = document.getElementById("about_me_interests6");

  var work_title = document.getElementById("work-title");
  var work_date1_end = document.getElementById("work-date1_end");
  var work_date1_start = document.getElementById("work-date1_start");
  var work_position1 = document.getElementById("work-position1");
  var work_company1 = document.getElementById("work-company1");

  var studies_title = document.getElementById("studies-title");
  var studies_date1_end = document.getElementById("studies-date1_end");
  var studies_date1_start = document.getElementById("studies-date1_start");
  var studies_degree1 = document.getElementById("studies-degree1");
  var studies_university1 = document.getElementById("studies-university1");
  var studies_date2_end = document.getElementById("studies-date2_end");
  var studies_date2_start = document.getElementById("studies-date2_start");
  var studies_degree2 = document.getElementById("studies-degree2");
  var studies_university2 = document.getElementById("studies-university2");

  var skills_title = document.getElementById("skills-title");
  var skills_sw = document.getElementById("skills-sw");
  var skills_python = document.getElementById("skills-python");
  var skills_matlab = document.getElementById("skills-matlab");
  var skills_ansys = document.getElementById("skills-ansys");
  var skills_html = document.getElementById("skills-html");
  var skills_css = document.getElementById("skills-css");

  var exp_title = document.getElementById("exp-title");
  var exp_type1 = document.getElementById("exp-type1");
  var exp_date1 = document.getElementById("exp-date1");
  var exp_job1 = document.getElementById("exp-job1");
  var exp_company1 = document.getElementById("exp-company1");
  var exp_location1 = document.getElementById("exp-location1");
  var exp_type2 = document.getElementById("exp-type2");
  var exp_date2 = document.getElementById("exp-date2");
  var exp_job2 = document.getElementById("exp-job2");
  var exp_company2 = document.getElementById("exp-company2");
  var exp_location2 = document.getElementById("exp-location2");

  var pub_title = document.getElementById("pub-title");

  fetch("./json-txt/cv.json")
    .then(function (response) {
      return response.json();
    })
    .then(function (data) {
      navbar_home.innerHTML = data.navbar.home[i];
      navbar_about_me.innerHTML = data.navbar.about_me[i];
      navbar_work.innerHTML = data.navbar.work[i];
      navbar_studies.innerHTML = data.navbar.studies[i];
      navbar_skills.innerHTML = data.navbar.skills[i];
      navbar_experiences.innerHTML = data.navbar.experiences[i];
      navbar_publications.innerHTML = data.navbar.publications[i];

      about_me_degree.innerHTML = data.about_me.degree[i];
      about_me_title.innerHTML = data.about_me.title[i];
      about_me_txt.innerHTML = data.about_me.txt[i];
      about_me_interests_title.innerHTML = data.about_me.interests_title[i];
      about_me_interests1.innerHTML = data.about_me.interests_1[i];
      about_me_interests2.innerHTML = data.about_me.interests_2[i];
      about_me_interests3.innerHTML = data.about_me.interests_3[i];
      about_me_interests4.innerHTML = data.about_me.interests_4[i];
      about_me_interests5.innerHTML = data.about_me.interests_5[i];
      about_me_interests6.innerHTML = data.about_me.interests_6[i];

      work_title.innerHTML = data.work.title[i];
      work_date1_end.innerHTML = data.work.date1_end[i];
      work_date1_start.innerHTML = data.work.date1_start[i];
      work_position1.innerHTML = data.work.position1[i];
      work_company1.innerHTML = data.work.company1[i];

      studies_title.innerHTML = data.studies.title[i];
      studies_date1_end.innerHTML = data.studies.date1_start[i];
      studies_date1_start.innerHTML = data.studies.date1_end[i];
      studies_degree1.innerHTML = data.studies.degree1[i];
      studies_university1.innerHTML = data.studies.university1[i];
      studies_date2_end.innerHTML = data.studies.date2_start[i];
      studies_date2_start.innerHTML = data.studies.date2_end[i];
      studies_degree2.innerHTML = data.studies.degree2[i];
      studies_university2.innerHTML = data.studies.university2[i];

      skills_title.innerHTML = data.skills.title[i];
      skills_sw.innerHTML = data.skills.sw[i];
      skills_python.innerHTML = data.skills.python[i];
      skills_matlab.innerHTML = data.skills.matlab[i];
      skills_ansys.innerHTML = data.skills.ansys[i];
      skills_html.innerHTML = data.skills.html[i];
      skills_css.innerHTML = data.skills.css[i];

      exp_title.innerHTML = data.experiences.title[i];
      exp_type1.innerHTML = data.experiences.type1[i];
      exp_date1.innerHTML = data.experiences.date1[i];
      exp_job1.innerHTML = data.experiences.job1[i];
      exp_company1.innerHTML = data.experiences.company1[i];
      exp_location1.innerHTML = data.experiences.location1[i];
      exp_type2.innerHTML = data.experiences.type2[i];
      exp_date2.innerHTML = data.experiences.date2[i];
      exp_job2.innerHTML = data.experiences.job2[i];
      exp_company2.innerHTML = data.experiences.company2[i];
      exp_location2.innerHTML = data.experiences.location2[i];

      pub_title.innerHTML = data.publications.title[i];
    });
}

function change_cv_language() {
  var current_lang = document.getElementById("language-btn").innerHTML;
  console.log(current_lang);
  if (document.getElementById("language-btn").innerHTML === "PT") {
    run_cv_json("pt");
    current_lang = document.getElementById("language-btn").innerHTML = "EN";
  } else {
    run_cv_json("en");
    current_lang = document.getElementById("language-btn").innerHTML = "PT";
  }
}
