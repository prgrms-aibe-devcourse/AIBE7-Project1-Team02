function getTourItemValue(item, keys) {
  for (const key of keys) {
    const value = item?.[key];

    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }

  return null;
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function stripHtml(value) {
  if (!value) {
    return '';
  }

  return String(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTourDestination(item) {
  if (!item || typeof item !== 'object') {
    throw new TypeError('TourAPI 여행지 데이터는 객체여야 합니다.');
  }

  const contentId = getTourItemValue(item, ['contentid', 'contentId']);
  const destinationName = getTourItemValue(item, ['title', 'destinationName']);

  if (!contentId || !destinationName) {
    throw new Error('TourAPI contentId와 여행지명은 필수입니다.');
  }

  const address = stripHtml(
    [
      getTourItemValue(item, ['addr1', 'address']),
      getTourItemValue(item, ['addr2', 'addressDetail']),
    ]
      .filter(Boolean)
      .join(' '),
  );

  return {
    tourContentId: String(contentId),
    contentTypeId: toNullableNumber(
      getTourItemValue(item, ['contenttypeid', 'contentTypeId']),
    ),
    destinationName: stripHtml(destinationName),
    description: stripHtml(
      getTourItemValue(item, ['overview', 'description']),
    ),
    address,
    categoryCodes: {
      cat1: getTourItemValue(item, ['cat1']),
      cat2: getTourItemValue(item, ['cat2']),
      cat3: getTourItemValue(item, ['cat3']),
    },
    coordinates: {
      latitude: toNullableNumber(
        getTourItemValue(item, ['mapy', 'latitude']),
      ),
      longitude: toNullableNumber(
        getTourItemValue(item, ['mapx', 'longitude']),
      ),
    },
    imageUrl:
      getTourItemValue(item, ['firstimage', 'imageUrl']) ||
      getTourItemValue(item, ['firstimage2', 'thumbnailUrl']),
  };
}

module.exports = {
  normalizeTourDestination,
  stripHtml,
};
