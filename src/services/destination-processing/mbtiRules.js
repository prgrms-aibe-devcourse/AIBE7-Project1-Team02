const MBTI_TYPES = [
  'ISTJ',
  'ISFJ',
  'INFJ',
  'INTJ',
  'ISTP',
  'ISFP',
  'INFP',
  'INTP',
  'ESTP',
  'ESFP',
  'ENFP',
  'ENTP',
  'ESTJ',
  'ESFJ',
  'ENFJ',
  'ENTJ',
];

const CONTENT_TYPE_RULES = {
  12: {
    keywords: ['자연', '명소'],
    axes: { I: 8, N: 5, F: 6, P: 3 },
  },
  14: {
    keywords: ['문화', '전시'],
    axes: { I: 5, N: 8, F: 4, J: 3 },
  },
  15: {
    keywords: ['축제', '활기'],
    axes: { E: 14, N: 5, F: 6, P: 5 },
  },
  25: {
    keywords: ['여행코스', '동선'],
    axes: { S: 5, T: 5, J: 12 },
  },
  28: {
    keywords: ['레포츠', '액티비티'],
    axes: { E: 12, S: 7, T: 4, P: 8 },
  },
  32: {
    keywords: ['숙박', '휴식'],
    axes: { I: 6, S: 4, F: 4, J: 3 },
  },
  38: {
    keywords: ['쇼핑', '도심'],
    axes: { E: 8, S: 7, T: 3, P: 3 },
  },
  39: {
    keywords: ['맛집', '로컬푸드'],
    axes: { E: 5, S: 8, F: 5, P: 3 },
  },
};

const TEXT_RULES = [
  {
    terms: ['해변', '바다', '해수욕장', '오션뷰'],
    keywords: ['오션뷰', '자연', '인생샷'],
    axes: { I: 5, N: 6, F: 10, P: 4 },
  },
  {
    terms: ['산', '숲', '수목원', '휴양림', '둘레길'],
    keywords: ['힐링', '자연', '산책'],
    axes: { I: 12, N: 5, F: 8, P: 3 },
  },
  {
    terms: ['박물관', '미술관', '전시', '문화재', '사찰', '궁'],
    keywords: ['전통문화', '전시', '역사'],
    axes: { I: 6, S: 5, N: 5, J: 7 },
  },
  {
    terms: ['축제', '공연', '콘서트', '페스티벌'],
    keywords: ['축제', '활기'],
    axes: { E: 15, N: 5, F: 5, P: 6 },
  },
  {
    terms: ['체험', '레포츠', '서핑', '카약', '짚라인', '클라이밍'],
    keywords: ['액티비티', '레포츠'],
    axes: { E: 12, S: 8, T: 4, P: 10 },
  },
  {
    terms: ['시장', '맛집', '음식', '카페', '식당'],
    keywords: ['맛집', '로컬푸드'],
    axes: { E: 5, S: 9, F: 5, P: 4 },
  },
  {
    terms: ['전망대', '야경', '일출', '일몰', '포토존'],
    keywords: ['인생샷', '야경명소'],
    axes: { N: 7, F: 10, P: 3 },
  },
  {
    terms: ['예약', '해설', '관람시간', '운영시간'],
    keywords: ['계획여행'],
    axes: { S: 5, T: 5, J: 10 },
  },
];

module.exports = {
  CONTENT_TYPE_RULES,
  MBTI_TYPES,
  TEXT_RULES,
};
