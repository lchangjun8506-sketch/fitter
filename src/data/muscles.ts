/**
 * 종목 → 쓰는 근육(주동근·보조) + 자세 그림 + 자세 요령 한 줄
 * 근육 이름은 근육 그림(Anatomy)의 부위 키와 같다.
 */
import type { Routine } from '../lib/types';

export type Muscle =
  | 'chest' | 'delts' | 'traps' | 'lats' | 'lowerBack' | 'biceps' | 'triceps' | 'forearms'
  | 'abs' | 'obliques' | 'glutes' | 'quads' | 'adductors' | 'hamstrings' | 'calves';

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: '가슴', delts: '어깨', traps: '승모근', lats: '광배근', lowerBack: '허리', biceps: '이두', triceps: '삼두',
  forearms: '전완', abs: '복근', obliques: '옆구리', glutes: '둔근', quads: '대퇴사두', adductors: '내전근', hamstrings: '햄스트링', calves: '종아리',
};

export type PoseKey =
  | 'bench' | 'incline' | 'fly' | 'dip' | 'pushdown' | 'lyingext' | 'overheadext' | 'kickback' | 'machinepress'
  | 'hinge' | 'row' | 'seatedrow' | 'pulldown' | 'pullup' | 'straightpull' | 'curl'
  | 'ohp' | 'lateral' | 'frontraise' | 'reardelt' | 'facepull' | 'shrug'
  | 'squat' | 'legpress' | 'legext' | 'legcurl' | 'hipmachine' | 'hipthrust' | 'calf' | 'lunge';

export interface ExerciseInfo {
  primary: Muscle[];
  secondary: Muscle[];
  pose: PoseKey;
  /** 목록 태그 (예: 측면 어깨) */
  focus: string;
  cue: string;
}

const E = (primary: Muscle[], secondary: Muscle[], pose: PoseKey, focus: string, cue: string): ExerciseInfo => ({ primary, secondary, pose, focus, cue });

export const EXERCISE_INFO: Record<string, ExerciseInfo> = {
  // 가슴·삼두
  '벤치 프레스': E(['chest'], ['delts', 'triceps'], 'bench', '가슴', '어깨뼈를 모으고 가슴 중앙으로 내려요'),
  '덤벨 벤치 프레스': E(['chest'], ['delts', 'triceps'], 'bench', '가슴', '덤벨이 가슴 옆까지 내려오게 깊게'),
  '인클라인 벤치 프레스': E(['chest'], ['delts', 'triceps'], 'incline', '윗가슴', '벤치 30~45도, 쇄골 아래로 내려요'),
  '인클라인 덤벨 프레스': E(['chest'], ['delts', 'triceps'], 'incline', '윗가슴', '벤치 30~45도, 팔꿈치는 45도로'),
  '디클라인 벤치 프레스': E(['chest'], ['triceps'], 'bench', '아랫가슴', '명치 쪽으로 내려요'),
  '체스트 프레스 머신': E(['chest'], ['delts', 'triceps'], 'machinepress', '가슴', '손잡이를 가슴 높이에 맞춰요'),
  '덤벨 플라이': E(['chest'], ['delts'], 'fly', '가슴', '팔꿈치를 살짝 굽힌 채 큰 원을 그려요'),
  '펙덱 플라이': E(['chest'], ['delts'], 'fly', '가슴 안쪽', '가슴을 펴고 손을 앞에서 모아요'),
  '케이블 크로스 오버': E(['chest'], ['delts'], 'fly', '가슴 안쪽', '몸을 살짝 숙이고 아래로 모아요'),
  '딥스': E(['chest', 'triceps'], ['delts'], 'dip', '아랫가슴·삼두', '상체를 숙이면 가슴, 세우면 삼두'),
  '삼두 케이블 푸쉬 다운': E(['triceps'], ['forearms'], 'pushdown', '삼두', '팔꿈치를 옆구리에 고정해요'),
  '라잉 트라이셉스 익스텐션': E(['triceps'], [], 'lyingext', '삼두', '팔꿈치는 고정, 이마 쪽으로 내려요'),
  '덤벨 오버헤드 트라이셉스 익스텐션': E(['triceps'], [], 'overheadext', '삼두 장두', '팔꿈치가 벌어지지 않게'),
  '덤벨 킥백': E(['triceps'], ['delts'], 'kickback', '삼두', '위팔을 몸통과 평행하게 고정해요'),
  // 등·이두
  '컨벤셔널 데드리프트': E(['hamstrings', 'glutes', 'lowerBack'], ['quads', 'traps', 'forearms'], 'hinge', '후면 사슬', '바를 정강이에 붙이고 등은 곧게'),
  '루마니안 데드리프트': E(['hamstrings', 'glutes'], ['lowerBack'], 'hinge', '햄스트링', '엉덩이를 뒤로 빼며 허벅지 뒤를 늘려요'),
  '바벨 로우': E(['lats'], ['traps', 'biceps', 'lowerBack'], 'row', '등', '상체 45도, 배꼽 쪽으로 당겨요'),
  '덤벨 로우': E(['lats'], ['traps', 'biceps'], 'row', '등', '팔꿈치를 엉덩이 쪽으로 당겨요'),
  '랫 풀 다운': E(['lats'], ['biceps', 'delts'], 'pulldown', '광배근', '가슴을 들고 쇄골 쪽으로 당겨요'),
  '맥그립 랫 풀 다운': E(['lats'], ['biceps'], 'pulldown', '광배근 아래쪽', '팔꿈치를 옆구리로 내려요'),
  '시티드 케이블 로우': E(['lats', 'traps'], ['biceps'], 'seatedrow', '등 가운데', '어깨뼈를 모으며 배 쪽으로 당겨요'),
  'T바 로우': E(['lats'], ['traps', 'biceps'], 'row', '등', '가슴을 패드에 대고 당겨요'),
  '암 풀 다운': E(['lats'], ['triceps'], 'straightpull', '광배근', '팔을 편 채 허벅지까지 내려요'),
  '풀업': E(['lats'], ['biceps', 'forearms'], 'pullup', '광배근', '가슴을 바 쪽으로 끌어올려요'),
  '바벨 컬': E(['biceps'], ['forearms'], 'curl', '이두', '팔꿈치를 고정하고 반동 없이'),
  '덤벨 컬': E(['biceps'], ['forearms'], 'curl', '이두', '올리면서 손바닥을 바깥으로 돌려요'),
  '해머 컬': E(['biceps', 'forearms'], [], 'curl', '이두·전완', '엄지가 위를 향하게 잡아요'),
  '인클라인 덤벨 컬': E(['biceps'], ['forearms'], 'curl', '이두 장두', '팔을 뒤로 늘어뜨린 채 시작해요'),
  '프리처 컬': E(['biceps'], ['forearms'], 'curl', '이두 단두', '패드에 팔을 붙이고 끝까지 펴요'),
  // 어깨
  '오버헤드 프레스': E(['delts'], ['triceps', 'traps'], 'ohp', '전면 어깨', '배에 힘을 주고 머리 위로 곧게'),
  '덤벨 숄더 프레스': E(['delts'], ['triceps', 'traps'], 'ohp', '전면 어깨', '귀 옆에서 시작해 머리 위로'),
  '스미스머신 숄더 프레스': E(['delts'], ['triceps'], 'ohp', '전면 어깨', '바가 턱 높이까지 오게'),
  '사이드 레터럴 레이즈': E(['delts'], ['traps'], 'lateral', '측면 어깨', '팔꿈치를 살짝 굽혀 어깨 높이까지'),
  '케이블 사이드 레터럴 레이즈': E(['delts'], ['traps'], 'lateral', '측면 어깨', '몸 앞을 지나 옆으로 들어 올려요'),
  '프론트 레이즈': E(['delts'], ['chest'], 'frontraise', '전면 어깨', '눈높이까지만 들어요'),
  '벤트오버 레터럴 레이즈': E(['delts'], ['traps'], 'reardelt', '후면 어깨', '상체를 숙이고 옆으로 벌려요'),
  '페이스 풀': E(['delts', 'traps'], [], 'facepull', '후면 어깨', '줄을 얼굴 쪽으로, 손을 귀 옆으로'),
  '슈러그': E(['traps'], ['forearms'], 'shrug', '승모근', '어깨를 귀 쪽으로 곧게 올려요'),
  // 하체
  '스쿼트': E(['quads', 'glutes'], ['adductors', 'hamstrings', 'lowerBack'], 'squat', '대퇴사두·둔근', '무릎은 발끝 방향, 허벅지 수평까지'),
  '스미스머신 스쿼트': E(['quads', 'glutes'], ['adductors', 'hamstrings'], 'squat', '대퇴사두', '발을 조금 앞에 두고 앉아요'),
  '프론트 스쿼트': E(['quads'], ['glutes', 'abs'], 'squat', '대퇴사두', '팔꿈치를 높이 들고 상체를 세워요'),
  '레그 프레스': E(['quads', 'glutes'], ['hamstrings'], 'legpress', '대퇴사두', '무릎을 끝까지 잠그지 않아요'),
  '파워 레그 프레스': E(['quads', 'glutes'], ['hamstrings'], 'legpress', '대퇴사두', '발판 가운데를 발 전체로 밀어요'),
  '레그 익스텐션': E(['quads'], [], 'legext', '대퇴사두', '위에서 1초 버텨요'),
  '레그 컬': E(['hamstrings'], ['calves'], 'legcurl', '햄스트링', '엉덩이가 들리지 않게'),
  '스티프 레그 데드리프트': E(['hamstrings'], ['glutes', 'lowerBack'], 'hinge', '햄스트링', '무릎을 거의 편 채 엉덩이를 뒤로'),
  '힙 어덕션': E(['adductors'], [], 'hipmachine', '내전근', '천천히 모으고 천천히 벌려요'),
  '힙 어브덕션': E(['glutes'], [], 'hipmachine', '중둔근', '상체를 살짝 숙이면 엉덩이에 더'),
  '힙 쓰러스터': E(['glutes'], ['hamstrings'], 'hipthrust', '둔근', '턱을 당기고 엉덩이를 끝까지 조여요'),
  '카프 레이즈': E(['calves'], [], 'calf', '종아리', '뒤꿈치를 끝까지 내렸다 올려요'),
  '런지': E(['quads', 'glutes'], ['hamstrings', 'adductors'], 'lunge', '대퇴사두·둔근', '앞 무릎이 발끝을 넘지 않게'),
};

/** 직접 추가한 종목: 이름 단서 → 없으면 분할 부위 기준 */
const GUESS: [RegExp, ExerciseInfo][] = [
  [/컬|curl/i, E(['biceps'], ['forearms'], 'curl', '이두', '')],
  [/푸쉬\s*다운|푸시\s*다운|익스텐션.*(삼두|트라이)|트라이셉/i, E(['triceps'], [], 'pushdown', '삼두', '')],
  [/레그\s*익스텐션/i, E(['quads'], [], 'legext', '대퇴사두', '')],
  [/레그\s*컬/i, E(['hamstrings'], [], 'legcurl', '햄스트링', '')],
  [/플라이|크로스/i, E(['chest'], ['delts'], 'fly', '가슴', '')],
  [/레터럴|사레레/i, E(['delts'], ['traps'], 'lateral', '측면 어깨', '')],
  [/로우|row/i, E(['lats'], ['biceps', 'traps'], 'row', '등', '')],
  [/풀\s*다운|풀업|턱걸이/i, E(['lats'], ['biceps'], 'pulldown', '광배근', '')],
  [/데드/i, E(['hamstrings', 'glutes'], ['lowerBack'], 'hinge', '후면 사슬', '')],
  [/스쿼트|squat/i, E(['quads', 'glutes'], ['hamstrings'], 'squat', '하체', '')],
  [/런지/i, E(['quads', 'glutes'], [], 'lunge', '하체', '')],
  [/카프|종아리/i, E(['calves'], [], 'calf', '종아리', '')],
  [/복근|크런치|플랭크|레그\s*레이즈/i, E(['abs'], ['obliques'], 'bench', '복근', '')],
];
const BY_ROUTINE: Record<Routine, ExerciseInfo> = {
  '가슴·삼두': E(['chest'], ['triceps', 'delts'], 'bench', '가슴', ''),
  '등·이두': E(['lats'], ['biceps'], 'row', '등', ''),
  '어깨': E(['delts'], ['traps'], 'ohp', '어깨', ''),
  '하체': E(['quads', 'glutes'], ['hamstrings'], 'squat', '하체', ''),
};

export function exerciseInfo(name: string, routine?: Routine): ExerciseInfo {
  const known = EXERCISE_INFO[name];
  if (known) return known;
  const hit = GUESS.find(([re]) => re.test(name));
  if (hit) return hit[1];
  return BY_ROUTINE[routine ?? '가슴·삼두'];
}

/** 여러 종목의 근육을 합침 (주동근이 하나라도 있으면 주동근) */
export function mergeMuscles(list: ExerciseInfo[]) {
  const p = new Set<Muscle>(), s = new Set<Muscle>();
  list.forEach((i) => i.primary.forEach((m) => p.add(m)));
  list.forEach((i) => i.secondary.forEach((m) => !p.has(m) && s.add(m)));
  return { primary: [...p], secondary: [...s] };
}

/** 앞/뒤 중 어디에 보이는 근육인지 */
export const FRONT_MUSCLES: Muscle[] = ['chest', 'delts', 'biceps', 'forearms', 'abs', 'obliques', 'quads', 'adductors', 'traps', 'triceps', 'calves'];
export const BACK_MUSCLES: Muscle[] = ['traps', 'delts', 'lats', 'lowerBack', 'triceps', 'forearms', 'glutes', 'hamstrings', 'calves'];
