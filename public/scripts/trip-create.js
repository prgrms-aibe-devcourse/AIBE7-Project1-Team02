document.addEventListener("DOMContentLoaded", () => {
  const selectedDestination = document.getElementById("selected-destination");
  const emptyState = document.getElementById("trip-create-empty");
  const image = document.getElementById("selected-destination-image");
  const name = document.getElementById("selected-destination-name");
  const address = document.getElementById("selected-destination-address");
  const keywordList = document.getElementById(
    "selected-destination-keywords",
  );
  const destinationId = new URLSearchParams(window.location.search).get(
    "destinationId",
  );

  let destination = null;

  try {
    destination = JSON.parse(
      sessionStorage.getItem("selected_trip_destination") || "null",
    );
  } catch {
    destination = null;
  }

  if (
    !destinationId ||
    !destination ||
    String(destination.destinationId) !== destinationId
  ) {
    emptyState.hidden = false;
    return;
  }

  image.src = destination.imageUrl || "../images/summer_banner.png";
  image.alt = destination.destinationName;
  image.addEventListener("error", () => {
    image.src = "../images/summer_banner.png";
  });
  name.textContent = destination.destinationName;
  address.textContent = destination.address || "대한민국";

  (destination.keywords || []).slice(0, 5).forEach((keyword) => {
    const badge = document.createElement("span");
    badge.textContent = `#${keyword}`;
    keywordList.appendChild(badge);
  });

  selectedDestination.hidden = false;
});
