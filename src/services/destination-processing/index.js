const { scoreDestinationMbti } = require('./mbtiScorer');
const { normalizeTourDestination } = require('./tourDataNormalizer');

function processTourDestination(tourApiItem) {
  const destination = normalizeTourDestination(tourApiItem);
  const classification = scoreDestinationMbti(destination);

  return {
    destination,
    classification,
  };
}

function processTourDestinations(tourApiItems) {
  if (!Array.isArray(tourApiItems)) {
    throw new TypeError('TourAPI 여행지 목록은 배열이어야 합니다.');
  }

  return tourApiItems.map(processTourDestination);
}

module.exports = {
  processTourDestination,
  processTourDestinations,
};
