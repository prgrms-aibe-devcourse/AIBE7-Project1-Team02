const assert = require('node:assert/strict');
const test = require('node:test');

const {
  processTourDestination,
  processTourDestinations,
} = require('../src/services/destination-processing');

test('해변 여행지는 감성·자연 키워드와 높은 F/N 성향을 생성한다', () => {
  const result = processTourDestination({
    contentid: '126508',
    contenttypeid: '12',
    title: '협재해수욕장',
    addr1: '제주특별자치도 제주시 한림읍',
    overview: '<p>푸른 바다와 일몰을 감상할 수 있는 해변입니다.</p>',
    mapx: '126.239',
    mapy: '33.394',
    firstimage: 'https://example.com/hyeopjae.jpg',
  });

  assert.equal(result.destination.tourContentId, '126508');
  assert.equal(result.destination.destinationName, '협재해수욕장');
  assert.ok(result.classification.keywords.includes('오션뷰'));
  assert.ok(result.classification.keywords.includes('인생샷'));
  assert.ok(
    result.classification.axisScores.F > result.classification.axisScores.T,
  );
  assert.ok(
    result.classification.axisScores.N > result.classification.axisScores.S,
  );
  assert.equal(result.classification.mbtiScores.length, 16);
});

test('레포츠 여행지는 E/S/P 축 점수를 높인다', () => {
  const result = processTourDestination({
    contentid: '200001',
    contenttypeid: '28',
    title: '한강 카약 체험장',
    addr1: '서울특별시 광진구',
    overview: '도심에서 카약과 수상 레포츠를 체험할 수 있습니다.',
  });

  const { axisScores, keywords } = result.classification;

  assert.ok(axisScores.E > axisScores.I);
  assert.ok(axisScores.S > axisScores.N);
  assert.ok(axisScores.P > axisScores.J);
  assert.ok(keywords.includes('레포츠'));
  assert.equal(result.classification.mbtiScores[0].mbtiType, 'ESTP');
});

test('필수 TourAPI 식별자가 없으면 가공을 중단한다', () => {
  assert.throws(
    () => processTourDestination({ title: '식별자 없는 여행지' }),
    /contentId와 여행지명은 필수/,
  );
});

test('여행지 목록을 같은 규칙으로 일괄 가공한다', () => {
  const result = processTourDestinations([
    {
      contentid: '1',
      contenttypeid: '14',
      title: '국립박물관',
    },
    {
      contentid: '2',
      contenttypeid: '39',
      title: '전통시장 맛집',
    },
  ]);

  assert.equal(result.length, 2);
  assert.ok(result[0].classification.keywords.includes('문화'));
  assert.ok(result[1].classification.keywords.includes('맛집'));
});
