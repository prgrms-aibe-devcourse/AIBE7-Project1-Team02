-- ============================================================
-- 여행 MBTI 성향 분석 결과 테이블
-- Supabase Dashboard > SQL Editor 에서 실행하세요.
-- ============================================================

-- 1. 테이블 생성
begin;

CREATE TABLE IF NOT EXISTS public.travel_mbti_results (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(user_id) ON DELETE CASCADE,
  mbti_type   varchar(4) NOT NULL
              CHECK (mbti_type ~ '^[EI][SN][TF][JP]$'),
  ei_score    smallint NOT NULL CHECK (ei_score BETWEEN 0 AND 100),
  sn_score    smallint NOT NULL CHECK (sn_score BETWEEN 0 AND 100),
  tf_score    smallint NOT NULL CHECK (tf_score BETWEEN 0 AND 100),
  jp_score    smallint NOT NULL CHECK (jp_score BETWEEN 0 AND 100),
  raw_answers jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. 인덱스: mbti_type 으로 유사 성향 유저 검색
CREATE INDEX IF NOT EXISTS idx_travel_mbti_type
  ON public.travel_mbti_results(mbti_type);

-- 3. updated_at 자동 갱신 트리거
DROP TRIGGER IF EXISTS trg_travel_mbti_updated_at
  ON public.travel_mbti_results;
CREATE TRIGGER trg_travel_mbti_updated_at
  BEFORE UPDATE ON public.travel_mbti_results
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 4. RLS (Row Level Security)
ALTER TABLE public.travel_mbti_results ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.travel_mbti_results TO authenticated;
GRANT ALL ON TABLE public.travel_mbti_results TO service_role;

DROP POLICY IF EXISTS "Users can read own mbti"
  ON public.travel_mbti_results;
CREATE POLICY "Users can read own mbti"
  ON public.travel_mbti_results FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own mbti"
  ON public.travel_mbti_results;
CREATE POLICY "Users can insert own mbti"
  ON public.travel_mbti_results FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own mbti"
  ON public.travel_mbti_results;
CREATE POLICY "Users can update own mbti"
  ON public.travel_mbti_results FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

commit;
