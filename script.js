
"use strict";

// FoodBridge AI | CodeNova
// Front-end prototype for the SIH food redistribution workflow.

const $ = (selector) => document.querySelector(selector);

const STORAGE_KEY = "foodbridge_codenova_v1";

const sampleDonations = [
  {
    id: 101,
    donor: "Green Leaf Cafe",
    type: "Cooked meals",
    quantity: 42,
    area: "Rajarampuri",
    deadline: new Date(Date.now() + 2 * 3600000).toISOString(),
    contact: "Cafe manager",
    status: "Available"
  },
  {
    id: 102,
    donor: "Sunrise Bakery",
    type: "Bakery",
    quantity: 30,
    area: "Shahupuri",
    deadline: new Date(Date.now() + 7 * 3600000).toISOString(),
    contact: "Bakery team",
    status: "Available"
  },
  {
    id: 103,
    donor: "Campus Canteen",
    type: "Cooked meals",
    quantity: 65,
    area: "Uchgaon Road",
    deadline: new Date(Date.now() + 3 * 3600000).toISOString(),
    contact: "Canteen supervisor",
    status: "Available"
  }
];

const ngos = [
  {
    name: "Annapurna Community Kitchen",
    area: "Rajarampuri",
    capacity: 80,
    types: ["Cooked meals", "Fruits & vegetables"],
    icon: "🍲"
  },
  {
    name: "Hope Shelter Network",
    area: "Shahupuri",
    capacity: 45,
    types: ["Cooked meals", "Bakery", "Packaged food"],
    icon: "🏠"
  },
  {
    name: "Seva Student Support Centre",
    area: "Uchgaon Road",
    capacity: 100,
    types: ["Cooked meals", "Bakery", "Dairy", "Packaged food"],
    icon: "🤝"
  },
  {
    name: "Community Care Collective",
    area: "Tarabai Park",
    capacity: 60,
    types: ["Fruits & vegetables", "Bakery", "Packaged food"],
    icon: "🌱"
  }
];

function loadDonations() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : sampleDonations;
  } catch (error) {
    return sampleDonations;
  }
}

let donations = loadDonations();
let matches = [];
let routePlan = [];

function saveDonations() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(donations));
  } catch (error) {
    showToast("Could not save data in browser storage.");
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function hoursRemaining(donation) {
  return (
    new Date(donation.deadline).getTime() - Date.now()
  ) / 3600000;
}

function getPriority(donation) {
  const hours = hoursRemaining(donation);

  if (hours <= 3) return "Urgent";
  if (hours <= 8) return "Soon";

  return "Normal";
}

function formatDate(date) {
  return new Date(date).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function statusBadge(status) {
  return `<span class="badge ${status.toLowerCase()}">
    ${escapeHTML(status)}
  </span>`;
}

function priorityBadge(donation) {
  const priority = getPriority(donation);

  return `<span class="badge ${priority.toLowerCase()}">
    ${priority}
  </span>`;
}

// Approximate demonstration distances between sample areas.
// These are not road distances or live navigation data.
const areaCoordinates = {
  "Rajarampuri": [0, 0],
  "Shahupuri": [2, 1],
  "Uchgaon Road": [4, 2],
  "Tarabai Park": [1, 3],
  "Kolhapur": [2, 2]
};

function estimatedDistance(areaA, areaB) {
  const a = areaCoordinates[areaA] || [2, 2];
  const b = areaCoordinates[areaB] || [2, 2];

  const dx = a[0] - b[0];
  const dy = a[1] - b[1];

  return Math.max(0.8, Math.sqrt(dx * dx + dy * dy) * 1.7);
}

// Match only NGOs that accept the listed food type.
// The score is a transparent demo heuristic, not trained AI.
function rankNGOs(donation) {
  return ngos
    .filter(ngo => ngo.types.includes(donation.type))
    .map(ngo => {
      const distance = estimatedDistance(
        donation.area,
        ngo.area
      );

      const capacityScore = Math.round(
        25 * Math.min(1, ngo.capacity / donation.quantity)
      );

      const urgencyScore = Math.max(
        5,
        Math.min(25, Math.round(
          25 - Math.max(0, hoursRemaining(donation)) * 2
        ))
      );

      const distanceScore = Math.max(
        0,
        15 - distance * 2
      );

      const score = Math.min(
        99,
        Math.round(
          35 + capacityScore + urgencyScore + distanceScore
        )
      );

      return {
        donation,
        ngo,
        distance,
        score
      };
    })
    .sort((a, b) => b.score - a.score);
}

function calculateMatches(showMessage = true) {
  matches = [];

  donations
    .filter(donation => donation.status !== "Delivered")
    .forEach(donation => {
      const ranked = rankNGOs(donation);

      if (ranked.length > 0) {
        matches.push(ranked[0]);
      }
    });

  // Prioritize donations with the earliest deadlines.
  matches.sort(
    (a, b) =>
      hoursRemaining(a.donation) -
      hoursRemaining(b.donation)
  );

  donations.forEach(donation => {
    if (donation.status === "Delivered") return;

    donation.status = matches.some(
      match => match.donation.id === donation.id
    ) ? "Matched" : "Available";
  });

  saveDonations();
  renderAll();

  if (showMessage) {
    showToast(
      matches.length
        ? `${matches.length} compatible donation match(es) found.`
        : "No compatible NGO found for the current donations."
    );
  }
}

function donorCell(donation) {
  return `<span class="donor-cell">
    ${escapeHTML(donation.donor)}
    <br><small>${escapeHTML(donation.type)}</small>
  </span>`;
}

function deliveryButton(donation) {
  if (donation.status === "Delivered") {
    return `<span class="muted">Completed</span>`;
  }

  return `<button class="action-btn"
    data-deliver="${donation.id}">
    Confirm delivery
  </button>`;
}

function renderTables() {
  const sorted = [...donations].sort(
    (a, b) =>
      hoursRemaining(a) - hoursRemaining(b)
  );

  $("#recentRows").innerHTML = sorted
    .slice(0, 5)
    .map(donation => `
      <tr>
        <td>${donorCell(donation)}</td>
        <td>${donation.quantity}</td>
        <td>${escapeHTML(formatDate(donation.deadline))}</td>
        <td>${statusBadge(donation.status)}</td>
      </tr>
    `).join("");

  $("#donationRows").innerHTML = sorted.map(donation => `
    <tr>
      <td>${donorCell(donation)}</td>
      <td>${donation.quantity}</td>
      <td>${escapeHTML(donation.area)}</td>
      <td>${escapeHTML(formatDate(donation.deadline))}</td>
      <td>${priorityBadge(donation)}</td>
      <td>${statusBadge(donation.status)}</td>
      <td>${deliveryButton(donation)}</td>
    </tr>
  `).join("");

  $("#impactRows").innerHTML = donations.map(donation => `
    <tr>
      <td>${escapeHTML(donation.donor)}</td>
      <td>${escapeHTML(donation.type)}</td>
      <td>${donation.quantity}</td>
      <td>${escapeHTML(donation.area)}</td>
      <td>${statusBadge(donation.status)}</td>
      <td>${deliveryButton(donation)}</td>
    </tr>
  `).join("");

  $("#emptyRecent").hidden = donations.length > 0;
  $("#emptyAll").hidden = donations.length > 0;

  $("#recordCount").textContent =
    `${donations.length} record(s)`;
}

function renderMetrics() {
  const active = donations.filter(
    donation => donation.status !== "Delivered"
  );

  const totalPortions = donations.reduce(
    (sum, donation) => sum + Number(donation.quantity),
    0
  );

  const deliveredPortions = donations
    .filter(donation => donation.status === "Delivered")
    .reduce(
      (sum, donation) => sum + Number(donation.quantity),
      0
    );

  $("#activeCount").textContent = active.length;
  $("#portionCount").textContent = active.reduce(
    (sum, donation) => sum + Number(donation.quantity),
    0
  ).toLocaleString();

  $("#deliveredCount").textContent =
    deliveredPortions.toLocaleString();

  $("#listedTotal").textContent =
    totalPortions.toLocaleString();

  $("#deliveredTotal").textContent =
    deliveredPortions.toLocaleString();

  $("#completionRate").textContent =
    (totalPortions
      ? Math.round(deliveredPortions / totalPortions * 100)
      : 0) + "%";

  $("#activeTotal").textContent = active.length;
}

function matchItem(match) {
  return `<div class="match-item">
    <b>${match.ngo.icon} ${escapeHTML(match.ngo.name)}</b>
    <br>${escapeHTML(match.donation.donor)}
    → ${escapeHTML(match.ngo.area)}
    <br><span class="score">${match.score}% compatibility score</span>
  </div>`;
}

function renderMatches() {
  $("#overviewMatches").innerHTML = matches.length
    ? matches.slice(0, 3).map(matchItem).join("")
    : `<p class="empty">Run smart matching to see recommendations.</p>`;

  $("#matchCards").innerHTML = matches.length
    ? matches.map(match => `
      <article class="match-card">
        <h3>${match.ngo.icon} ${escapeHTML(match.ngo.name)}</h3>

        <p>
          <b>Donor:</b> ${escapeHTML(match.donation.donor)}<br>
          <b>Food:</b> ${escapeHTML(match.donation.type)}<br>
          <b>Portions:</b> ${match.donation.quantity}<br>
          <b>Pickup:</b> ${escapeHTML(match.donation.area)}<br>
          <b>NGO area:</b> ${escapeHTML(match.ngo.area)}<br>
          <b>NGO capacity:</b> ${match.ngo.capacity}<br>
          <b>Estimated distance:</b> ${match.distance.toFixed(1)} km
        </p>

        <div class="score-bar">
          <span style="width:${match.score}%"></span>
        </div>

        <p><b>Compatibility:</b>
          <span class="score">${match.score}%</span>
        </p>

        ${priorityBadge(match.donation)}

        <button class="btn outline full"
          data-plan="${match.donation.id}">
          Add to Route Plan →
        </button>
      </article>
    `).join("")
    : `<article class="panel">
        <p class="empty">
          No compatible matches. Add donations and try again.
        </p>
      </article>`;
}

function renderRoute() {
  if (!routePlan.length) {
    $("#routeHeading").textContent =
      "Your route will appear here";

    $("#stopCount").textContent = "—";
    $("#routeDistance").textContent = "—";

    $("#routeStops").innerHTML =
      "<li>Run smart matching, then optimize the route.</li>";

    return;
  }

  $("#routeHeading").textContent = "Suggested delivery sequence";
  $("#stopCount").textContent = routePlan.length * 2;

  const distance = routePlan.reduce(
    (sum, match, index) => {
      const nextLeg = index === 0
        ? 0
        : estimatedDistance(
            routePlan[index - 1].ngo.area,
            match.donation.area
          );

      return sum + match.distance + nextLeg;
    },
    0
  );

  $("#routeDistance").textContent =
    distance.toFixed(1) + " km*";

  $("#routeStops").innerHTML = routePlan.map(
    (match, index) => `
      <li>
        <b>${index + 1}. Pickup:</b>
        ${escapeHTML(match.donation.donor)}
        (${escapeHTML(match.donation.area)})
        <br>
        <b>Drop-off:</b>
        ${escapeHTML(match.ngo.name)}
        (${escapeHTML(match.ngo.area)})
      </li>
    `
  ).join("");
}

function renderAll() {
  renderTables();
  renderMetrics();
  renderMatches();
  renderRoute();
}

function showPage(pageName) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.toggle("active", page.id === pageName);
  });

  document.querySelectorAll("[data-page]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === pageName
    );
  });

  const titles = {
    overview: 'Surplus food, <span>smarter routes.</span>',
    donations: "Food Donations",
    matching: "Smart Matching Centre",
    routes: "Route Planner",
    impact: "Impact Report"
  };

  $("#pageTitle").innerHTML =
    titles[pageName] || titles.overview;

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openDonationForm() {
  const form = $("#donationForm");
  const deadline = new Date(Date.now() + 4 * 3600000);

  deadline.setMinutes(
    deadline.getMinutes() - deadline.getTimezoneOffset()
  );

  form.elements.deadline.value =
    deadline.toISOString().slice(0, 16);

  $("#donationDialog").showModal();
}

function buildRoute() {
  if (!matches.length) {
    calculateMatches(false);
  }

  routePlan = [...matches].sort(
    (a, b) =>
      hoursRemaining(a.donation) -
      hoursRemaining(b.donation)
  );

  renderRoute();

  if (routePlan.length) {
    showPage("routes");
    showToast(
      "Suggested route created. Distances are estimates, not live navigation."
    );
  } else {
    showToast("No matched donations available for routing.");
  }
}

function confirmDelivery(id) {
  const donation = donations.find(
    item => item.id === Number(id)
  );

  if (!donation || donation.status === "Delivered") return;

  const confirmed = window.confirm(
    `Confirm delivery of ${donation.quantity} portions from ${donation.donor}?`
  );

  if (!confirmed) return;

  donation.status = "Delivered";

  matches = matches.filter(
    match => match.donation.id !== donation.id
  );

  routePlan = routePlan.filter(
    match => match.donation.id !== donation.id
  );

  saveDonations();
  renderAll();

  showToast("Delivery confirmed. Impact report updated.");
}

function exportCSV() {
  const headers = [
    "Donor", "Food Type", "Portions", "Pickup Area",
    "Safe Until", "Status", "Contact"
  ];

  const rows = donations.map(donation => [
    donation.donor,
    donation.type,
    donation.quantity,
    donation.area,
    new Date(donation.deadline).toISOString(),
    donation.status,
    donation.contact
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(value =>
      `"${String(value).replace(/"/g, '""')}"`
    ).join(","))
    .join("\r\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "foodbridge-impact-report.csv";
  link.click();

  URL.revokeObjectURL(url);
}

// All dashboard and table actions.
document.addEventListener("click", event => {
  const pageButton = event.target.closest("[data-page]");

  if (pageButton) {
    showPage(pageButton.dataset.page);
  }

  if (event.target.closest("#addBtn") ||
      event.target.closest("#heroAdd") ||
      event.target.closest("#registerBtn")) {
    openDonationForm();
  }

  if (event.target.closest("#heroMatch") ||
      event.target.closest("#matchBtn")) {
    calculateMatches();
    showPage("matching");
  }

  if (event.target.closest("#routeBtn")) {
    buildRoute();
  }

  if (event.target.closest("#exportBtn")) {
    exportCSV();
  }

  const deliveryButton = event.target.closest("[data-deliver]");

  if (deliveryButton) {
    confirmDelivery(deliveryButton.dataset.deliver);
  }

  const planButton = event.target.closest("[data-plan]");

  if (planButton) {
    const match = matches.find(
      item => item.donation.id === Number(planButton.dataset.plan)
    );

    if (match && !routePlan.some(
      item => item.donation.id === match.donation.id
    )) {
      routePlan.push(match);
      renderRoute();
      showToast("Donation added to route plan.");
    }
  }
});

$("#closeBtn").addEventListener("click", () => {
  $("#donationDialog").close();
});

$("#cancelBtn").addEventListener("click", () => {
  $("#donationDialog").close();
});

$("#donationForm").addEventListener("submit", event => {
  event.preventDefault();

  const form = event.currentTarget;
  const data = new FormData(form);
  const deadline = new Date(data.get("deadline"));
  const quantity = Number(data.get("quantity"));

  if (Number.isNaN(deadline.getTime()) ||
      deadline <= new Date()) {
    showToast("Choose a future safe-until deadline.");
    return;
  }

  if (!Number.isInteger(quantity) ||
      quantity < 1 || quantity > 10000) {
    showToast("Enter a valid number of portions.");
    return;
  }

  const donation = {
    id: Date.now(),
    donor: String(data.get("donor")).trim(),
    type: data.get("type"),
    quantity,
    area: data.get("area"),
    deadline: deadline.toISOString(),
    contact: String(data.get("contact")).trim(),
    status: "Available"
  };

  if (!donation.donor || !donation.contact ||
      data.get("safety") !== "on") {
    showToast("Complete the fields and confirm the safety checkbox.");
    return;
  }

  donations.unshift(donation);
  matches = [];
  routePlan = [];

  saveDonations();
  renderAll();

  form.reset();
  $("#donationDialog").close();

  showPage("donations");
  showToast("Donation successfully registered.");
});

// Start application.
renderAll();
