let JOBS = [];
const MY_SKILLS = [
    "python",
    "sql",
    "machine learning",
    "deep learning",
    "tensorflow",
    "keras",
    "pandas",
    "numpy",
    "scikit-learn",
    "xgboost",
    "power bi",
    "tableau",
    "git",
    "github",
    "docker",
    "aws",
    "nlp",
    "computer vision",
    "genai",
    "llm"
];
function getMatchedSkills(job){

    const text = [
        job.title,
        job.company,
        job.location,
        job.description,
        job.skills,
        job.tags
    ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

    const matched = [];
    const missing = [];

    resumeSkills.forEach(skill => {

        if(text.includes(skill)){
            matched.push(skill);
        }else{
            missing.push(skill);
        }

    });

    return {
        matched,
        missing
    };

}
const JOBS_DATA_URL = "jobs.json";

async function loadJobsFromSource() {
  try {
    const resp = await fetch(JOBS_DATA_URL, { cache: "no-store" });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const data = await resp.json();
    JOBS = data.jobs || [];
    document.getElementById('lastUpdated').textContent =
      'Live data — refreshed: ' + new Date(data.lastUpdated).toLocaleString();
  } catch (e) {
    console.error("Failed to load live jobs.json:", e);
    document.getElementById('lastUpdated').textContent =
      '⚠ Could not load live data (' + e.message + '). Showing nothing — check JOBS_DATA_URL or your connection.';
    JOBS = [];
  }
}

const STORAGE_KEY_SEEN = 'job_radar_seen_ids';
const STORAGE_KEY_STREAK = 'job_radar_streak';
const STORAGE_KEY_APPLIED = 'job_radar_applied';
const STORAGE_KEY_TRACKED = 'job_radar_tracked';

let state = {
  seenIds: [],
  streak: { count: 0, lastVisit: null },
  applied: [],
  tracked: [],
  activeFilters: { companyType: 'All', location: 'All', source: 'All' }
};

async function loadState() {
  try {
    const seen = await window.storage.get(STORAGE_KEY_SEEN);
    state.seenIds = seen ? JSON.parse(seen.value) : [];
  } catch(e) { state.seenIds = []; }

  try {
    const streak = await window.storage.get(STORAGE_KEY_STREAK);
    state.streak = streak ? JSON.parse(streak.value) : { count: 0, lastVisit: null };
  } catch(e) { state.streak = { count: 0, lastVisit: null }; }

  try {
    const applied = await window.storage.get(STORAGE_KEY_APPLIED);
    state.applied = applied ? JSON.parse(applied.value) : [];
  } catch(e) { state.applied = []; }

  try {
    const tracked = await window.storage.get(STORAGE_KEY_TRACKED);
    state.tracked = tracked ? JSON.parse(tracked.value) : [];
  } catch(e) { state.tracked = []; }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

async function updateStreak() {
  const today = todayStr();
  const last = state.streak.lastVisit;
  let msg = '';

  if (!last) {
    state.streak.count = 1;
    msg = "First check-in logged. Come back tomorrow to start a streak.";
  } else if (last === today) {
    msg = "Already checked in today.";
  } else {
    const gap = daysBetween(last, today);
    if (gap === 1) {
      state.streak.count += 1;
      msg = `Streak extended to ${state.streak.count} day${state.streak.count > 1 ? 's' : ''}.`;
    } else {
      state.streak.count = 1;
      msg = "Streak reset — back at day 1. Daily check-ins compound your search.";
    }
  }
  state.streak.lastVisit = today;
  try { await window.storage.set(STORAGE_KEY_STREAK, JSON.stringify(state.streak)); } catch(e) {}
  document.getElementById('checkinMsg').textContent = msg;
}

async function computeNewSince() {
  const allIds = JOBS.map(j => j.id);
  const newIds = allIds.filter(id => !state.seenIds.includes(id));
  document.getElementById('newCount').textContent = state.seenIds.length === 0 ? allIds.length : newIds.length;
  // mark all as seen now
  state.seenIds = Array.from(new Set([...state.seenIds, ...allIds]));
  try { await window.storage.set(STORAGE_KEY_SEEN, JSON.stringify(state.seenIds)); } catch(e) {}
  return new Set(newIds);
}

function isHot(job) {

    const score = job.matchScore ?? 0;

    if (score < 40) return false;

    return true;

}

function isClosingSoon(job) {
  // Heuristic: postings older than 60 days are flagged as possibly closing/stale
  if (!job.posted || job.posted === 'Recent') return false;
  const d = daysBetween(job.posted, '2026-06-29');
  return d > 180;
}

function uniqueValues(key) {
  return Array.from(new Set(JOBS.map(j => j[key]))).sort();
}

function renderFilters() {
  const ctWrap = document.getElementById('companyTypeFilters');
  const locWrap = document.getElementById('locationFilters');
  const srcWrap = document.getElementById('sourceFilters');

  const companyTypes = ['All',...uniqueValues('companyType').filter(v => v && v !== "undefined")];
  const sources = ['All', ...uniqueValues('source')];
  const locBuckets = ['All', 'Bengaluru-only', 'Multi-city'];


  locWrap.innerHTML = locBuckets.map(l =>
    `<button class="pill-btn ${l==='All'?'active':''}" data-filter="location" data-value="${l}">${l}</button>`
  ).join('');

  srcWrap.innerHTML = sources.map(s =>
    `<button class="pill-btn ${s==='All'?'active':''}" data-filter="source" data-value="${s}">${s}</button>`
  ).join('');

  document.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.filter;
      document.querySelectorAll(`.pill-btn[data-filter="${group}"]`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeFilters[group] = btn.dataset.value;
      renderJobs();
    });
  });
}

function matchesFilters(job) {
  const f = state.activeFilters;
  if (f.companyType !== 'All' && job.companyType !== f.companyType) return false;
  if (f.source !== 'All' && job.source !== f.source) return false;
  if (f.location === 'Bengaluru-only' && job.location.includes('/')) return false;
  if (f.location === 'Multi-city' && !job.location.includes('/')) return false;
  return true;
}

async function toggleApplied(jobId, btn) {
  const idx = state.applied.indexOf(jobId);
  if (idx === -1) {
    state.applied.push(jobId);
    btn.textContent = '✓ Applied';
    btn.classList.add('tracked');
  } else {
    state.applied.splice(idx, 1);
    btn.textContent = 'Mark applied';
    btn.classList.remove('tracked');
  }
  try { await window.storage.set(STORAGE_KEY_APPLIED, JSON.stringify(state.applied)); } catch(e) {}
  document.getElementById('appliedCount').textContent = state.applied.length;
}
/*
function jobCard(job, newIds) {
  const isNew = newIds.has(job.id);
  const hot = isHot(job);
  const closing = isClosingSoon(job);
  const applied = state.applied.includes(job.id);

  return `
    <div class="job-card" data-id="${job.id}">
      <div class="fit-score ${job.category}">
        ${job.matchScore ?? 0}<span class="of100">/100</span>
      </div>
      <div class="job-main">
        <h3>${job.title}</h3>
        <div class="job-meta">
          <span>🏢 ${job.company}</span>
          <span>📍 ${job.location}</span>
          <span>📅 ${job.experience}</span>
          <span>💰 ${job.salary}</span>
        </div>
        <div class="job-badges">
          ${isNew ? '<span class="badge new">New</span>' : ''}
          ${hot ? '<span class="badge hot">🔥 Hot match</span>' : ''}
          ${closing ? '<span class="badge closing">⏳ Verify still open</span>' : ''}
          <span class="badge source">${job.source}</span>
        </div>
        <p class="job-reasoning">${job.reasoning}</p>
        <div class="job-skills">${job.skills}</div>
        <div class="job-resume-tag">→ Use resume: ${job.bestResume}</div>
      </div>
      <div class="job-actions">
        <a class="apply-btn" href="${job.url}" target="_blank" rel="noopener">View &amp; Apply →</a>
        <button class="track-btn ${applied ? 'tracked' : ''}" onclick="toggleApplied(${job.id}, this)">
          ${applied ? '✓ Applied' : 'Mark applied'}
        </button>
      </div>
    </div>
  `;
}
*/
function renderJobs() {
    console.log("Total JOBS:", JOBS.length);
    console.log(JOBS);
    const savedOnly =
        document.getElementById("savedOnly").checked;
    
    const search =
        document.getElementById("searchBox").value.toLowerCase();

    console.log("Search:", search);

    const container =
        document.getElementById("jobList");

    const role =
        document.getElementById("roleFilter").value;

    const location =
        document.getElementById("locationFilter").value;

    let filtered = [];

try {

    filtered = JOBS.filter(job => {
        
    

    const title = (job.title || "").toLowerCase();
    const company = (job.company || "").toLowerCase();
    const loc = (job.location || "").toLowerCase();

    const searchMatch =
        title.includes(search) ||
        company.includes(search) ||
        loc.includes(search);

    const roleMatch =
        role === "All" ||
        title.includes(role.toLowerCase());

    const locationMatch =
        location === "All" ||
        loc.includes(location.toLowerCase());

    const savedMatch =
    !savedOnly || savedJobs.includes(job.url);

    return searchMatch &&
           roleMatch &&
           locationMatch &&
           savedMatch;
});
    
} catch (e) {

    console.error("Filter error:", e);

}

console.log("Filtered:", filtered.length);
const sortBy = document.getElementById("sortFilter").value;

if (sortBy === "match") {

    filtered.sort((a, b) =>
        (b.matchScore || 0) - (a.matchScore || 0)
    );

}
else if (sortBy === "title") {

    filtered.sort((a, b) =>
        (a.title || "").localeCompare(b.title || "")
    );

}
else if (sortBy === "company") {

    filtered.sort((a, b) =>
        (a.company || "").localeCompare(b.company || "")
    );

}

    document.getElementById("jobCount").innerHTML =
        `<b>${filtered.length}</b> Jobs Found`;

    container.innerHTML = "";
const highMatch =
    filtered.filter(j => j.matchScore >= 40).length;

const remoteJobs =
    filtered.filter(j =>
        (j.location || "").toLowerCase().includes("remote")
    ).length;

const indiaJobs =
    filtered.filter(j => {

        const loc = (j.location || "").toLowerCase();

        return loc.includes("india")
            || loc.includes("bengaluru")
            || loc.includes("bangalore")
            || loc.includes("hyderabad")
            || loc.includes("pune")
            || loc.includes("chennai");

    }).length;

document.getElementById("highMatchCount").textContent = highMatch;
document.getElementById("remoteCount").textContent = remoteJobs;
document.getElementById("indiaCount").textContent = indiaJobs;
document.getElementById("totalCount").textContent = filtered.length;
   container.innerHTML = "";

filtered.forEach(job => {

    const skills = getMatchedSkills(job);
    const isHot = (job.matchScore || 0) >= 40;
    const dynamicScore =
    resumeSkills.length
        ? calculateResumeScore(job)
        : (job.matchScore || 0);
const scoreClass =
    dynamicScore >= 40 ? "High" :
    dynamicScore >= 25 ? "Medium" :
    "Stretch";
    const isNew =
    Array.isArray(window.__newIds) &&
    window.__newIds.includes(job.url);

    const card = document.createElement("div");
    card.className = "job-card";

    card.innerHTML = `
        <div class="fit-score ${scoreClass}">
            ${dynamicScore}
        </div>

        <div class="job-main">

            <h3>${job.title}</h3>

            <div class="job-meta">
                <span>🏢 ${job.company}</span>
                <span>📍 ${job.location}</span>
                <span>🌐 ${job.source}</span>
            </div>
            <div class="job-badges">

    ${isNew ? `<span class="badge new">NEW</span>` : ""}

    ${isHot ? `<span class="badge hot">HOT MATCH</span>` : ""}

    <span class="badge source">${job.source}</span>

            </div>

            <div class="skills-box">
                <strong>Resume Match</strong><br>

                ${skills.matched.map(skill =>
                    `<span class="skill-ok">✓ ${skill}</span>`
                ).join("")}

                ${skills.missing.map(skill =>
                    `<span class="skill-miss">⚠ ${skill}</span>`
                ).join("")}

            </div>

        </div>

        <div class="job-actions">

    <a class="apply-btn"
       href="${job.url}"
       target="_blank">
       Apply
    </a>

    <button
        class="save-btn"
        onclick="toggleSave('${job.url}')">
        ${savedJobs.includes(job.url) ? "❤️" : "🤍"}
    </button>

    <button
        class="cover-btn"
        onclick="generateCoverLetter(${JSON.stringify(job).replace(/"/g,'&quot;')})">

        📄 Cover Letter

    </button>
    <button
    class="download-btn"
    onclick="downloadCoverLetter(${JSON.stringify(job).replace(/"/g,'&quot;')})">

    ⬇ Download PDF

</button>

</div>
    `;

    container.appendChild(card);

});
    renderCharts(filtered);
}

async function init() {
  await loadJobsFromSource();
  await loadState();
  await updateStreak();
  const status = document.getElementById("resumeStatus");

if (status && resumeSkills.length) {

    status.innerHTML = `
        ✅ Resume Loaded<br>
        <small>${resumeSkills.length} skills detected</small>
    `;
    const skillsBox = document.getElementById("resumeSkills");

if (skillsBox) {

    skillsBox.innerHTML = resumeSkills
        .map(skill => `<span class="resume-chip">${skill}</span>`)
        .join("");

}

}
  const newIds = await computeNewSince();
  window.__newIds = newIds;

  document.getElementById('streakCount').textContent = state.streak.count;
  document.getElementById('streakFlames').textContent = '🔥'.repeat(Math.min(state.streak.count, 7));
  document.getElementById('appliedCount').textContent = state.applied.length;
  document.getElementById("savedOnly").addEventListener("change", renderJobs);

  renderFilters();
  renderJobs();
}

let savedJobs =
    JSON.parse(localStorage.getItem("savedJobs") || "[]");

function toggleSave(url){

    if(savedJobs.includes(url)){

        savedJobs =
            savedJobs.filter(x => x !== url);

    }else{

        savedJobs.push(url);

    }

    localStorage.setItem(
        "savedJobs",
        JSON.stringify(savedJobs)
    );

    renderJobs();

}
init();

function renderCharts(filtered) {

    // Jobs by Source
    const sourceCounts = {};

    filtered.forEach(job => {
        sourceCounts[job.source] =
            (sourceCounts[job.source] || 0) + 1;
    });

    const ctx1 = document
        .getElementById("sourceChart")
        .getContext("2d");

    if (window.sourceChart) {
        window.sourceChart.destroy();
    }

    window.sourceChart = new Chart(ctx1, {
        type: "bar",
        data: {
            labels: Object.keys(sourceCounts),
            datasets: [{
                label: "Jobs",
                data: Object.values(sourceCounts)
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            }
        }
    });

    // Match Score Distribution

    const high = filtered.filter(j =>
    (resumeSkills.length ? calculateResumeScore(j) : (j.matchScore || 0)) >= 40
        ).length;

    const medium = filtered.filter(j => {
    const score = resumeSkills.length
        ? calculateResumeScore(j)
        : (j.matchScore || 0);

    return score >= 25 && score < 40;
}).length;

    const stretch = filtered.filter(j => {
    const score = resumeSkills.length
        ? calculateResumeScore(j)
        : (j.matchScore || 0);

    return score < 25;
}).length;

    const ctx2 = document
        .getElementById("scoreChart")
        .getContext("2d");

    if (window.scoreChart) {
        window.scoreChart.destroy();
    }

    window.scoreChart = new Chart(ctx2, {
        type: "doughnut",
        data: {
            labels: ["High", "Medium", "Stretch"],
            datasets: [{
                data: [high, medium, stretch]
            }]
        },
        options: {
            responsive: true
        }
    });

}

document
    .getElementById("searchBox")
    .addEventListener("input", renderJobs);

document
    .getElementById("roleFilter")
    .addEventListener("change", renderJobs);

document
    .getElementById("locationFilter")
    .addEventListener("change", renderJobs);

document
    .getElementById("sortFilter")
    .addEventListener("change", renderJobs);

    let resumeSkills = JSON.parse(
    localStorage.getItem("resumeSkills") || "[]"
);

const SKILLS = [
    "python",
    "sql",
    "machine learning",
    "deep learning",
    "tensorflow",
    "keras",
    "pandas",
    "numpy",
    "scikit-learn",
    "power bi",
    "tableau",
    "excel",
    "genai",
    "nlp",
    "flask",
    "streamlit"
];
function calculateResumeScore(job){

    // Start with the existing match score
    let score = job.matchScore || 0;

    const text = [
        job.title,
        job.company,
        job.location
    ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

    resumeSkills.forEach(skill => {

        if(text.includes(skill)){

            score += 10;

        }

    });

    return Math.min(score,100);

}
document
.getElementById("resumeUpload")
.addEventListener("change", loadResume);

async function loadResume(event){

    const file = event.target.files[0];

    if(!file) return;

    const reader = new FileReader();

    reader.onload = async function(){

        const typedArray =
            new Uint8Array(reader.result);

        const pdf =
            await pdfjsLib
                .getDocument(typedArray)
                .promise;

        let text = "";

        for(let i=1;i<=pdf.numPages;i++){

            const page =
                await pdf.getPage(i);

            const content =
                await page.getTextContent();

            text += content.items
                .map(item=>item.str)
                .join(" ");

        }

        text = text.toLowerCase();

resumeSkills = SKILLS.filter(skill =>
    text.includes(skill)
);

localStorage.setItem(
    "resumeSkills",
    JSON.stringify(resumeSkills)
);

const status = document.getElementById("resumeStatus");

if (status) {

    status.innerHTML = `
        ✅ Resume Loaded<br>
        <small>${resumeSkills.length} skills detected</small>
    `;
    const skillsBox =
    document.getElementById("resumeSkills");

if(skillsBox){

    skillsBox.innerHTML =
        resumeSkills
        .map(skill =>
            `<span class="resume-chip">${skill}</span>`
        )
        .join("");

}

}

console.log("Resume Skills:", resumeSkills);

renderJobs();
    };

    reader.readAsArrayBuffer(file);

}

function renderCharts(filtered) {

    // ---------- Jobs by Source ----------
    const sourceCounts = {};

    filtered.forEach(job => {
        const source = job.source || "Unknown";
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    });

    const sourceCanvas = document.getElementById("sourceChart");

    if (!sourceCanvas) return;

    const ctx1 = sourceCanvas.getContext("2d");

    if (window.sourceChart instanceof Chart) {
    window.sourceChart.destroy();
}

    window.sourceChart = new Chart(ctx1, {
        type: "bar",
        data: {
            labels: Object.keys(sourceCounts),
            datasets: [{
                label: "Jobs",
                data: Object.values(sourceCounts),
                backgroundColor: [
                    "#5EEAD4",
                    "#60A5FA",
                    "#FBBF24",
                    "#F87171",
                    "#A78BFA"
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });

    // ---------- Match Score Distribution ----------

    const high = filtered.filter(j => (j.matchScore || 0) >= 40).length;

    const medium = filtered.filter(j =>
        (j.matchScore || 0) >= 25 &&
        (j.matchScore || 0) < 40
    ).length;

    const stretch = filtered.filter(j =>
        (j.matchScore || 0) < 25
    ).length;

    const scoreCanvas = document.getElementById("scoreChart");

    if (!scoreCanvas) return;

    const ctx2 = scoreCanvas.getContext("2d");

    if (window.scoreChart instanceof Chart) {
    window.scoreChart.destroy();
}

    window.scoreChart = new Chart(ctx2, {
        type: "doughnut",
        data: {
            labels: ["High", "Medium", "Stretch"],
            datasets: [{
                data: [high, medium, stretch],
                backgroundColor: [
                    "#4ADE80",
                    "#FBBF24",
                    "#F87171"
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        color: "#E8ECEE"
                    }
                }
            }
        }
    });

}
function generateCoverLetter(job){

    const letter = `

Dear Hiring Manager,

I am excited to apply for the ${job.title} position at ${job.company}.

My background includes Python, SQL, Machine Learning, Data Analysis and AI development. I enjoy building data-driven solutions and have completed projects involving deep learning, analytics dashboards and automation.

I believe my technical skills and enthusiasm make me a strong candidate for this opportunity.

Thank you for your time and consideration.

Sincerely,

Akilesh Madarimath

`;

    const win = window.open("", "_blank");

    win.document.write(`
        <pre style="
            font-family:Arial;
            white-space:pre-wrap;
            padding:30px;
            line-height:1.7;
        ">
${letter}
        </pre>
    `);

}

async function downloadCoverLetter(job){

    const { jsPDF } = window.jspdf;

    const doc = new jsPDF();

    const text = `

Dear Hiring Manager,

I am excited to apply for the ${job.title} position at ${job.company}.

My background includes Python, SQL, Machine Learning, AI, Data Analytics, TensorFlow, Streamlit and Power BI.

I have completed several hands-on projects in Data Science and AI and enjoy solving real-world problems using technology.

I believe my technical skills and enthusiasm make me a strong fit for this role.

Thank you for your time and consideration.

Sincerely,

Akilesh Madarimath

`;

    doc.text(text, 20, 20);

    doc.save("CoverLetter.pdf");

}