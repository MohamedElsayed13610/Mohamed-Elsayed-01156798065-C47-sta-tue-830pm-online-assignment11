"use strict";

// Assignment 11 - Cosmos Space Dashboard
// APIs used:
// 1) NASA APOD: https://api.nasa.gov/
// 2) The Space Devs Launch Library 2: https://ll.thespacedevs.com/
// 3) Solar System OpenData: https://api.le-systeme-solaire.net/

const NASA_API_KEY = "DEMO_KEY"; // Replace with your own NASA key if you have one.
const APOD_API = "https://api.nasa.gov/planetary/apod";
const LAUNCHES_API = "https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=10";
const PLANETS_API = "https://api.le-systeme-solaire.net/rest/bodies/?filter[]=isPlanet,eq,true";

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const planetImages = {
  mercury: "./assets/images/mercury.png",
  venus: "./assets/images/venus.png",
  earth: "./assets/images/earth.png",
  mars: "./assets/images/mars.png",
  jupiter: "./assets/images/jupiter.png",
  saturn: "./assets/images/saturn.png",
  uranus: "./assets/images/uranus.png",
  neptune: "./assets/images/neptune.png",
};

const planetDescriptions = {
  mercury: "Mercury is the smallest planet in the Solar System and the closest planet to the Sun. It completes an orbit in only 88 Earth days.",
  venus: "Venus is the second planet from the Sun. Its thick carbon-dioxide atmosphere makes it the hottest planet in the Solar System.",
  earth: "Earth is the third planet from the Sun and the only known world with stable liquid surface water and life.",
  mars: "Mars is a cold desert world known as the Red Planet because iron minerals in its soil oxidize and give the surface its reddish color.",
  jupiter: "Jupiter is the largest planet in the Solar System. It is a gas giant famous for its Great Red Spot and extensive moon system.",
  saturn: "Saturn is a gas giant best known for its spectacular ring system, which is made mostly of ice particles, rock, and dust.",
  uranus: "Uranus is an ice giant that rotates on its side, probably because of a massive collision early in its history.",
  neptune: "Neptune is the farthest major planet from the Sun. It is an ice giant with extremely fast winds and a deep blue appearance.",
};

const planetFacts = {
  mercury: ["Closest planet to the Sun", "Smallest planet in the Solar System", "A year lasts about 88 Earth days"],
  venus: ["Hottest planet in the Solar System", "Rotates in the opposite direction to most planets", "Similar in size to Earth"],
  earth: ["Only known planet with life", "About 71% of the surface is covered by water", "Has one natural satellite: the Moon"],
  mars: ["Home to Olympus Mons", "Has two small moons", "A Martian day is close to 24.6 hours"],
  jupiter: ["Largest planet in the Solar System", "Has the Great Red Spot", "Has a powerful magnetic field"],
  saturn: ["Famous for its bright rings", "Second-largest planet", "Its average density is lower than water"],
  uranus: ["Rotates almost on its side", "Has a faint ring system", "Classified as an ice giant"],
  neptune: ["Farthest major planet from the Sun", "Has some of the fastest winds known", "Classified as an ice giant"],
};

const fallbackLaunches = [
  {
    name: "Upcoming Space Mission",
    net: new Date(Date.now() + 2 * 86400000).toISOString(),
    status: { name: "Go" },
    launch_service_provider: { name: "Launch Provider" },
    rocket: { configuration: { full_name: "Orbital Launch Vehicle" } },
    pad: { name: "Launch Complex", location: { name: "Earth" } },
    mission: { description: "Live launch data is temporarily unavailable. This fallback keeps the dashboard usable until the API responds." },
    image: null,
  },
];

let launchesCache = [];
let planetsCache = [];
let currentApodHdUrl = "";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(dateValue, options = {}) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "TBD";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  }).format(date);
}

function formatLongDate(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "TBD";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatTime(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "TBD";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date) + " UTC";
}

function formatNumber(value, maximumFractionDigits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "N/A";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(num);
}

function scientificValue(obj, key) {
  if (!obj || obj[`${key}Value`] == null || obj[`${key}Exponent`] == null) return null;
  return Number(obj[`${key}Value`]) * 10 ** Number(obj[`${key}Exponent`]);
}

function showToast(message, type = "info") {
  const old = $("#cosmos-toast");
  if (old) old.remove();

  const toast = document.createElement("div");
  toast.id = "cosmos-toast";
  const tone = type === "error" ? "border-red-500/50 text-red-200" : "border-blue-500/50 text-blue-100";
  toast.className = `fixed bottom-5 right-5 z-50 max-w-sm px-4 py-3 rounded-xl border bg-slate-900/95 shadow-2xl ${tone}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ---------------------------
// Navigation / dashboard UI
// ---------------------------
function setupNavigation() {
  const navLinks = $$(".nav-link");
  const sections = $$(".app-section");
  const sidebar = $("#sidebar");
  const sidebarToggle = $("#sidebar-toggle");

  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const target = link.dataset.section;

      sections.forEach((section) => section.classList.toggle("hidden", section.dataset.section !== target));
      navLinks.forEach((item) => {
        const isActive = item.dataset.section === target;
        item.classList.toggle("bg-blue-500/10", isActive);
        item.classList.toggle("text-blue-400", isActive);
        item.classList.toggle("text-slate-300", !isActive);
      });

      if (window.innerWidth < 1024) sidebar?.classList.remove("sidebar-open");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  sidebarToggle?.addEventListener("click", () => sidebar?.classList.toggle("sidebar-open"));
}

// ---------------------------
// NASA Astronomy Picture of the Day
// ---------------------------
function setApodLoading(isLoading) {
  const loader = $("#apod-loading");
  const image = $("#apod-image");
  if (loader) loader.classList.toggle("hidden", !isLoading);
  if (image) image.classList.toggle("hidden", isLoading);
}

async function loadApod(date = "") {
  setApodLoading(true);

  try {
    const params = new URLSearchParams({ api_key: NASA_API_KEY, thumbs: "true" });
    if (date) params.set("date", date);

    const response = await fetch(`${APOD_API}?${params}`);
    if (!response.ok) throw new Error(`NASA APOD request failed (${response.status})`);
    const data = await response.json();

    const imageUrl = data.media_type === "video" ? data.thumbnail_url : data.url;
    currentApodHdUrl = data.hdurl || imageUrl || data.url || "";

    const apodImage = $("#apod-image");
    if (apodImage) {
      apodImage.src = imageUrl || "./assets/images/placeholder.webp";
      apodImage.alt = data.title || "Astronomy Picture of the Day";
      apodImage.onerror = () => { apodImage.src = "./assets/images/placeholder.webp"; };
    }

    $("#apod-title").textContent = data.title || "Astronomy Picture of the Day";
    $("#apod-explanation").textContent = data.explanation || "No description available.";
    $("#apod-date-detail").innerHTML = `<i class="far fa-calendar mr-2"></i>${escapeHtml(data.date || "")}`;
    $("#apod-date-info").textContent = data.date || "N/A";
    $("#apod-media-type").textContent = data.media_type ? data.media_type[0].toUpperCase() + data.media_type.slice(1) : "N/A";
    $("#apod-copyright").textContent = data.copyright ? `© ${data.copyright}` : "Courtesy of NASA APOD";
    $("#apod-date").textContent = `Astronomy Picture of the Day - ${formatLongDate(data.date)}`;

    const input = $("#apod-date-input");
    if (input && data.date) input.value = data.date;
    const displayDate = $(".date-input-wrapper span");
    if (displayDate && data.date) displayDate.textContent = formatLongDate(data.date);
  } catch (error) {
    console.error(error);
    const apodImage = $("#apod-image");
    if (apodImage) apodImage.src = "./assets/images/placeholder.webp";
    $("#apod-title").textContent = "Space image unavailable";
    $("#apod-explanation").textContent = "NASA APOD could not be loaded right now. Try again later or replace DEMO_KEY with your personal NASA API key.";
    $("#apod-copyright").textContent = "NASA APOD";
    showToast("NASA APOD could not be loaded. The rest of the dashboard is still available.", "error");
  } finally {
    setApodLoading(false);
  }
}

function setupApodControls() {
  const input = $("#apod-date-input");
  if (input) {
    input.max = new Date().toISOString().slice(0, 10);
    input.addEventListener("change", () => {
      const displayDate = $(".date-input-wrapper span");
      if (displayDate && input.value) displayDate.textContent = formatLongDate(input.value);
    });
  }

  $("#load-date-btn")?.addEventListener("click", () => {
    const selectedDate = input?.value;
    if (!selectedDate) return showToast("Choose a date first.", "error");
    loadApod(selectedDate);
  });

  $("#today-apod-btn")?.addEventListener("click", () => loadApod());

  const fullResolutionButton = $("#apod-image-container button");
  fullResolutionButton?.addEventListener("click", () => {
    if (currentApodHdUrl) window.open(currentApodHdUrl, "_blank", "noopener,noreferrer");
  });
}

// ---------------------------
// The Space Devs - Launches
// ---------------------------
function getLaunchImage(launch) {
  if (typeof launch?.image === "string" && launch.image) return launch.image;
  if (launch?.image?.image_url) return launch.image.image_url;
  if (launch?.image?.thumbnail_url) return launch.image.thumbnail_url;
  return "./assets/images/launch-placeholder.jpg";
}

function daysUntil(dateValue) {
  const ms = new Date(dateValue).getTime() - Date.now();
  if (!Number.isFinite(ms)) return "?";
  if (ms <= 0) return "0";
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return String(days);
  const hours = Math.max(1, Math.floor(ms / 3600000));
  return `${hours}h`;
}

function statusClasses(status = "") {
  const normalized = status.toLowerCase();
  if (normalized.includes("go") || normalized.includes("success")) return "bg-green-500/20 text-green-400";
  if (normalized.includes("hold") || normalized.includes("tbd")) return "bg-yellow-500/20 text-yellow-300";
  return "bg-blue-500/20 text-blue-400";
}

function renderFeaturedLaunch(launch) {
  const holder = $("#featured-launch");
  if (!holder) return;

  const provider = launch?.launch_service_provider?.name || "Unknown provider";
  const rocket = launch?.rocket?.configuration?.full_name || launch?.rocket?.configuration?.name || "Launch vehicle TBD";
  const location = launch?.pad?.name || launch?.pad?.location?.name || "Location TBD";
  const country = launch?.pad?.country_code || launch?.pad?.location?.name || "TBD";
  const status = launch?.status?.name || "Scheduled";
  const mission = launch?.mission?.description || "Mission details will be announced by the launch provider.";
  const image = getLaunchImage(launch);

  holder.innerHTML = `
    <div class="relative bg-slate-800/30 border border-slate-700 rounded-3xl overflow-hidden group hover:border-blue-500/50 transition-all">
      <div class="absolute inset-0 bg-linear-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <div class="relative grid grid-cols-1 lg:grid-cols-2 gap-6 p-5 md:p-8">
        <div class="flex flex-col justify-between">
          <div>
            <div class="flex flex-wrap items-center gap-3 mb-4">
              <span class="px-4 py-1.5 bg-blue-500/20 text-blue-400 rounded-full text-sm font-semibold flex items-center gap-2"><i class="fas fa-star"></i> Featured Launch</span>
              <span class="px-4 py-1.5 ${statusClasses(status)} rounded-full text-sm font-semibold">${escapeHtml(status)}</span>
            </div>
            <h3 class="text-2xl md:text-3xl font-bold mb-3 leading-tight">${escapeHtml(launch?.name || "Upcoming Launch")}</h3>
            <div class="flex flex-col xl:flex-row xl:items-center gap-4 mb-6 text-slate-400">
              <div class="flex items-center gap-2"><i class="fas fa-building"></i><span>${escapeHtml(provider)}</span></div>
              <div class="flex items-center gap-2"><i class="fas fa-rocket"></i><span>${escapeHtml(rocket)}</span></div>
            </div>
            <div class="inline-flex items-center gap-3 px-6 py-3 bg-linear-to-r from-blue-500/20 to-purple-500/20 rounded-xl mb-6">
              <i class="fas fa-clock text-2xl text-blue-400"></i>
              <div><p class="text-2xl font-bold text-blue-400">${escapeHtml(daysUntil(launch?.net))}</p><p class="text-xs text-slate-400">Days / Hours Until Launch</p></div>
            </div>
            <div class="grid xl:grid-cols-2 gap-4 mb-6">
              <div class="bg-slate-900/50 rounded-xl p-4"><p class="text-xs text-slate-400 mb-1 flex items-center gap-2"><i class="fas fa-calendar"></i> Launch Date</p><p class="font-semibold">${escapeHtml(formatLongDate(launch?.net))}</p></div>
              <div class="bg-slate-900/50 rounded-xl p-4"><p class="text-xs text-slate-400 mb-1 flex items-center gap-2"><i class="fas fa-clock"></i> Launch Time</p><p class="font-semibold">${escapeHtml(formatTime(launch?.net))}</p></div>
              <div class="bg-slate-900/50 rounded-xl p-4"><p class="text-xs text-slate-400 mb-1 flex items-center gap-2"><i class="fas fa-map-marker-alt"></i> Location</p><p class="font-semibold text-sm">${escapeHtml(location)}</p></div>
              <div class="bg-slate-900/50 rounded-xl p-4"><p class="text-xs text-slate-400 mb-1 flex items-center gap-2"><i class="fas fa-globe"></i> Area</p><p class="font-semibold text-sm">${escapeHtml(country)}</p></div>
            </div>
            <p class="text-slate-300 leading-relaxed mb-6">${escapeHtml(mission)}</p>
          </div>
        </div>
        <div class="relative">
          <div class="relative h-full min-h-[320px] md:min-h-[400px] rounded-2xl overflow-hidden bg-slate-900/50">
            <img src="${escapeHtml(image)}" alt="${escapeHtml(launch?.name || "Upcoming launch")}" class="w-full h-full min-h-[320px] md:min-h-[400px] object-cover" onerror="this.src='./assets/images/launch-placeholder.jpg'" />
            <div class="absolute inset-0 bg-linear-to-t from-slate-900 via-transparent to-transparent"></div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderLaunchCards(launches) {
  const grid = $("#launches-grid");
  if (!grid) return;

  grid.innerHTML = launches.map((launch, index) => {
    const provider = launch?.launch_service_provider?.name || "Unknown provider";
    const rocket = launch?.rocket?.configuration?.full_name || launch?.rocket?.configuration?.name || "TBD";
    const location = launch?.pad?.name || launch?.pad?.location?.name || "TBD";
    const status = launch?.status?.name || "Scheduled";
    const image = getLaunchImage(launch);

    return `
      <article class="launch-card bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden hover:border-blue-500/30 transition-all group cursor-pointer" data-launch-index="${index}">
        <div class="relative h-48 bg-slate-900/50 overflow-hidden">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(launch?.name || "Launch")}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onerror="this.src='./assets/images/launch-placeholder.jpg'" />
          <div class="absolute inset-0 bg-linear-to-t from-slate-950/70 to-transparent"></div>
          <div class="absolute top-3 right-3"><span class="px-3 py-1 ${statusClasses(status)} backdrop-blur-sm rounded-full text-xs font-semibold">${escapeHtml(status)}</span></div>
        </div>
        <div class="p-5">
          <div class="mb-3">
            <h4 class="font-bold text-lg mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors">${escapeHtml(launch?.name || "Upcoming Launch")}</h4>
            <p class="text-sm text-slate-400 flex items-center gap-2"><i class="fas fa-building text-xs"></i>${escapeHtml(provider)}</p>
          </div>
          <div class="space-y-2 mb-4">
            <div class="flex items-center gap-2 text-sm"><i class="fas fa-calendar text-slate-500 w-4"></i><span class="text-slate-300">${escapeHtml(formatDate(launch?.net))}</span></div>
            <div class="flex items-center gap-2 text-sm"><i class="fas fa-clock text-slate-500 w-4"></i><span class="text-slate-300">${escapeHtml(formatTime(launch?.net))}</span></div>
            <div class="flex items-center gap-2 text-sm"><i class="fas fa-rocket text-slate-500 w-4"></i><span class="text-slate-300 line-clamp-1">${escapeHtml(rocket)}</span></div>
            <div class="flex items-center gap-2 text-sm"><i class="fas fa-map-marker-alt text-slate-500 w-4"></i><span class="text-slate-300 line-clamp-1">${escapeHtml(location)}</span></div>
          </div>
          <div class="pt-4 border-t border-slate-700"><button class="launch-details w-full px-4 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors text-sm font-semibold">Show as Featured</button></div>
        </div>
      </article>`;
  }).join("");

  $$(".launch-card", grid).forEach((card) => {
    card.addEventListener("click", () => {
      const launch = launchesCache[Number(card.dataset.launchIndex)];
      if (!launch) return;
      renderFeaturedLaunch(launch);
      $("#featured-launch")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

async function loadLaunches() {
  const grid = $("#launches-grid");
  if (grid) grid.innerHTML = `<div class="col-span-full py-14 text-center text-slate-400"><i class="fas fa-spinner fa-spin text-3xl text-blue-400 mb-3"></i><p>Loading upcoming launches...</p></div>`;

  try {
    const response = await fetch(LAUNCHES_API);
    if (!response.ok) throw new Error(`Launches request failed (${response.status})`);
    const data = await response.json();
    launchesCache = Array.isArray(data.results) && data.results.length ? data.results : fallbackLaunches;
  } catch (error) {
    console.error(error);
    launchesCache = fallbackLaunches;
    showToast("Live launch data is unavailable, so a fallback card is being shown.", "error");
  }

  $("#launches-count").textContent = `${launchesCache.length} Launches`;
  $("#launches-count-mobile").textContent = String(launchesCache.length);
  renderFeaturedLaunch(launchesCache[0]);
  renderLaunchCards(launchesCache);
}

// ---------------------------
// Solar System OpenData - Planets
// ---------------------------
function planetKey(planet) {
  return String(planet?.englishName || planet?.name || "").trim().toLowerCase();
}

function normalizePlanets(data) {
  const planets = (Array.isArray(data?.bodies) ? data.bodies : [])
    .filter((body) => body.isPlanet || ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"].includes(planetKey(body)));

  const order = ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"];
  return planets.sort((a, b) => order.indexOf(planetKey(a)) - order.indexOf(planetKey(b)));
}

function updatePlanetCards(planets) {
  planets.forEach((planet) => {
    const key = planetKey(planet);
    const card = $(`.planet-card[data-planet-id="${key}"]`);
    if (!card) return;

    const name = card.querySelector("h3, h4");
    if (name) name.textContent = planet.englishName || planet.name || key;

    const image = card.querySelector("img");
    if (image) image.src = planetImages[key] || image.src;

    card.onclick = () => renderPlanetDetails(planet);
  });
}

function renderPlanetDetails(planet) {
  const key = planetKey(planet);
  const mass = scientificValue(planet.mass, "mass");
  const volume = scientificValue(planet.vol, "vol");
  const moons = Array.isArray(planet.moons) ? planet.moons.length : 0;
  const tempC = Number.isFinite(Number(planet.avgTemp)) ? Number(planet.avgTemp) - 273.15 : null;

  $("#planet-detail-image").src = planetImages[key] || "./assets/images/earth.png";
  $("#planet-detail-image").alt = `${planet.englishName || planet.name || "Planet"} planet`;
  $("#planet-detail-name").textContent = planet.englishName || planet.name || "Planet";
  $("#planet-detail-description").textContent = planetDescriptions[key] || `Explore physical and orbital data for ${planet.englishName || planet.name || "this planet"}.`;

  $("#planet-distance").textContent = planet.semimajorAxis ? `${formatNumber(planet.semimajorAxis)} km` : "N/A";
  $("#planet-radius").textContent = planet.meanRadius ? `${formatNumber(planet.meanRadius)} km` : "N/A";
  $("#planet-mass").textContent = mass ? `${mass.toExponential(3)} kg` : "N/A";
  $("#planet-density").textContent = planet.density ? `${formatNumber(planet.density)} g/cm³` : "N/A";
  $("#planet-orbital-period").textContent = planet.sideralOrbit ? `${formatNumber(planet.sideralOrbit)} days` : "N/A";
  $("#planet-rotation").textContent = planet.sideralRotation ? `${formatNumber(Math.abs(planet.sideralRotation))} h` : "N/A";
  $("#planet-moons").textContent = String(moons);
  $("#planet-gravity").textContent = planet.gravity ? `${formatNumber(planet.gravity)} m/s²` : "N/A";

  $("#planet-discoverer").textContent = planet.discoveredBy || "Known since antiquity";
  $("#planet-discovery-date").textContent = planet.discoveryDate || "N/A";
  $("#planet-body-type").textContent = planet.bodyType || "Planet";
  $("#planet-volume").textContent = volume ? `${volume.toExponential(3)} km³` : "N/A";

  $("#planet-perihelion").textContent = planet.perihelion ? `${formatNumber(planet.perihelion)} km` : "N/A";
  $("#planet-aphelion").textContent = planet.aphelion ? `${formatNumber(planet.aphelion)} km` : "N/A";
  $("#planet-eccentricity").textContent = planet.eccentricity != null ? formatNumber(planet.eccentricity, 4) : "N/A";
  $("#planet-inclination").textContent = planet.inclination != null ? `${formatNumber(planet.inclination)}°` : "N/A";
  $("#planet-axial-tilt").textContent = planet.axialTilt != null ? `${formatNumber(planet.axialTilt)}°` : "N/A";
  $("#planet-temp").textContent = tempC != null ? `${formatNumber(tempC, 1)}°C` : "N/A";
  $("#planet-escape").textContent = planet.escape ? `${formatNumber(planet.escape)} m/s` : "N/A";

  const factsHolder = $("#planet-facts");
  if (factsHolder) {
    const facts = planetFacts[key] || ["Planet data loaded from Solar System OpenData"];
    factsHolder.innerHTML = facts.map((fact) => `<li class="flex items-start gap-3"><i class="fas fa-star text-yellow-400 mt-0.5"></i><span>${escapeHtml(fact)}</span></li>`).join("");
  }

  $$(".planet-card").forEach((card) => {
    const active = card.dataset.planetId === key;
    card.classList.toggle("border-blue-500", active);
    card.classList.toggle("bg-blue-500/10", active);
  });
}

function renderPlanetComparison(planets) {
  const tbody = $("#planet-comparison-tbody");
  if (!tbody) return;

  tbody.innerHTML = planets.map((planet) => {
    const key = planetKey(planet);
    const moons = Array.isArray(planet.moons) ? planet.moons.length : 0;
    const years = planet.sideralOrbit ? Number(planet.sideralOrbit) / 365.25 : null;
    const type = ["jupiter", "saturn"].includes(key) ? "Gas Giant" : ["uranus", "neptune"].includes(key) ? "Ice Giant" : "Terrestrial";

    const massKg = scientificValue(planet.mass, "mass");
    const earthMass = 5.9722e24;
    const massEarth = massKg ? massKg / earthMass : null;
    const distanceAu = planet.semimajorAxis ? Number(planet.semimajorAxis) / 149597870.7 : null;
    const diameter = planet.meanRadius ? Number(planet.meanRadius) * 2 : null;

    return `<tr class="border-b border-slate-700/70 hover:bg-slate-800/40 cursor-pointer" data-compare-planet="${key}">
      <td class="px-4 md:px-6 py-3 md:py-4 font-semibold whitespace-nowrap sticky left-0 bg-slate-900">${escapeHtml(planet.englishName || planet.name || key)}</td>
      <td class="px-4 md:px-6 py-3 md:py-4 text-slate-300 whitespace-nowrap">${distanceAu ? formatNumber(distanceAu, 3) : "N/A"}</td>
      <td class="px-4 md:px-6 py-3 md:py-4 text-slate-300 whitespace-nowrap">${diameter ? formatNumber(diameter) : "N/A"}</td>
      <td class="px-4 md:px-6 py-3 md:py-4 text-slate-300 whitespace-nowrap">${massEarth ? formatNumber(massEarth, 3) : "N/A"}</td>
      <td class="px-4 md:px-6 py-3 md:py-4 text-slate-300 whitespace-nowrap">${years ? `${formatNumber(years)} years` : "N/A"}</td>
      <td class="px-4 md:px-6 py-3 md:py-4 text-slate-300 whitespace-nowrap">${moons}</td>
      <td class="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap"><span class="px-2 py-1 rounded text-xs bg-blue-500/50 text-blue-200">${type}</span></td>
    </tr>`;
  }).join("");

  $$('[data-compare-planet]', tbody).forEach((row) => {
    row.addEventListener("click", () => {
      const planet = planetsCache.find((item) => planetKey(item) === row.dataset.comparePlanet);
      if (planet) renderPlanetDetails(planet);
    });
  });
}

async function loadPlanets() {
  try {
    const response = await fetch(PLANETS_API);
    if (!response.ok) throw new Error(`Planets request failed (${response.status})`);
    const data = await response.json();
    planetsCache = normalizePlanets(data);
    if (!planetsCache.length) throw new Error("No planets returned");

    updatePlanetCards(planetsCache);
    renderPlanetComparison(planetsCache);
    renderPlanetDetails(planetsCache.find((planet) => planetKey(planet) === "earth") || planetsCache[0]);
  } catch (error) {
    console.error(error);
    showToast("Planet API could not be loaded. The original planet cards remain visible.", "error");

    // Keep the original design interactive even if the API is offline.
    $$(".planet-card").forEach((card) => {
      card.addEventListener("click", () => {
        const key = card.dataset.planetId;
        $("#planet-detail-image").src = planetImages[key] || "./assets/images/earth.png";
        $("#planet-detail-name").textContent = key[0].toUpperCase() + key.slice(1);
        $("#planet-detail-description").textContent = planetDescriptions[key] || "Planet details are currently unavailable.";
      });
    });
  }
}

async function init() {
  setupNavigation();
  setupApodControls();

  // Load the three independent API sections in parallel.
  await Promise.allSettled([loadApod(), loadLaunches(), loadPlanets()]);
}

document.addEventListener("DOMContentLoaded", init);
