const {
  CONTENT_TYPE_RULES,
  MBTI_TYPES,
  TEXT_RULES,
} = require('./mbtiRules');

const OPPOSITE_AXIS = {
  E: 'I',
  I: 'E',
  S: 'N',
  N: 'S',
  T: 'F',
  F: 'T',
  J: 'P',
  P: 'J',
};

function clampScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function applyAxisWeights(axisScores, weights) {
  Object.entries(weights).forEach(([axis, weight]) => {
    const oppositeAxis = OPPOSITE_AXIS[axis];
    axisScores[axis] += weight;
    axisScores[oppositeAxis] -= weight;
  });
}

function createInitialAxisScores() {
  return {
    E: 50,
    I: 50,
    S: 50,
    N: 50,
    T: 50,
    F: 50,
    J: 50,
    P: 50,
  };
}

function calculateMbtiScores(axisScores) {
  return MBTI_TYPES.map((mbtiType) => {
    const selectedAxes = mbtiType.split('');
    const score =
      selectedAxes.reduce((total, axis) => total + axisScores[axis], 0) /
      selectedAxes.length;

    return {
      mbtiType,
      score: Number(score.toFixed(2)),
    };
  }).sort((first, second) => second.score - first.score);
}

function scoreDestinationMbti(destination) {
  const axisScores = createInitialAxisScores();
  const matchedKeywords = new Set();
  const matchedRules = [];
  const searchableText = [
    destination.destinationName,
    destination.description,
    destination.address,
    ...Object.values(destination.categoryCodes || {}),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const contentTypeRule = CONTENT_TYPE_RULES[destination.contentTypeId];

  if (contentTypeRule) {
    contentTypeRule.keywords.forEach((keyword) => matchedKeywords.add(keyword));
    applyAxisWeights(axisScores, contentTypeRule.axes);
    matchedRules.push(`contentType:${destination.contentTypeId}`);
  }

  TEXT_RULES.forEach((rule, ruleIndex) => {
    const isMatched = rule.terms.some((term) =>
      searchableText.includes(term.toLowerCase()),
    );

    if (!isMatched) {
      return;
    }

    rule.keywords.forEach((keyword) => matchedKeywords.add(keyword));
    applyAxisWeights(axisScores, rule.axes);
    matchedRules.push(`textRule:${ruleIndex + 1}`);
  });

  Object.keys(axisScores).forEach((axis) => {
    axisScores[axis] = clampScore(axisScores[axis]);
  });

  return {
    axisScores,
    keywords: Array.from(matchedKeywords),
    mbtiScores: calculateMbtiScores(axisScores),
    matchedRules,
    ruleVersion: 'mbti-rule-v1',
  };
}

module.exports = {
  calculateMbtiScores,
  scoreDestinationMbti,
};
