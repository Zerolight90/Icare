export interface DailyLog {
  id: number;
  recordTime: string;
  formulaAmount: number | null;
  breastfed: boolean | null;
  diaperType: string | null;
  memo: string | null;
  writerNickname: string;
  solidFoodName?: string | null;
  solidFoodAmount?: number | null;
  napEndTime?: string | null;
}

export type LogBody = Omit<DailyLog, 'id' | 'writerNickname'>;
export type Activity = 'feeding' | 'food' | 'nap' | 'diaper' | 'note';
export const activities: { id: Activity; label: string; icon: string }[] = [
  { id: 'feeding', label: '수유', icon: '🍼' },
  { id: 'food', label: '이유식', icon: '🥣' },
  { id: 'nap', label: '낮잠', icon: '💤' },
  { id: 'diaper', label: '기저귀', icon: '🧷' },
  { id: 'note', label: '메모', icon: '📝' },
];
export const diaperLabels: Record<string, string> = { NONE: '미기록', WET: '소변', DIRTY: '대변', BOTH: '소변·대변' };
export const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const napMinutes = (log: Pick<DailyLog, 'recordTime' | 'napEndTime'>) => log.napEndTime
  ? Math.round((new Date(log.napEndTime).getTime() - new Date(log.recordTime).getTime()) / 60000) : null;
export const durationLabel = (minutes: number) => minutes >= 60
  ? `${Math.floor(minutes / 60)}시간${minutes % 60 ? ` ${minutes % 60}분` : ''}` : `${minutes}분`;
export function validateLog(body: LogBody): string | null {
  const start = new Date(body.recordTime).getTime();
  if (!Number.isFinite(start)) return '날짜와 시간을 입력해 주세요.';
  if (body.napEndTime) {
    const duration = napMinutes(body);
    if (duration == null || !Number.isFinite(duration) || duration <= 0 || duration > 1440)
      return '낮잠 종료는 시작 이후 24시간 이내여야 합니다. 날짜도 확인해 주세요.';
  }
  if (body.formulaAmount != null && (!Number.isInteger(body.formulaAmount) || body.formulaAmount < 0 || body.formulaAmount > 2000)) return '분유량은 0~2000ml의 정수로 입력해 주세요.';
  if (body.solidFoodAmount != null && (!body.solidFoodName?.trim() || !Number.isInteger(body.solidFoodAmount) || body.solidFoodAmount < 1 || body.solidFoodAmount > 1000)) return '이유식 이름과 섭취량(1~1000g)을 확인해 주세요.';
  if ((body.solidFoodName?.length ?? 0) > 100 || (body.memo?.length ?? 0) > 500) return '이유식 이름은 100자, 메모는 500자 이내로 입력해 주세요.';
  if (body.formulaAmount == null && !body.breastfed && !body.solidFoodName?.trim() && !body.napEndTime && (!body.diaperType || body.diaperType === 'NONE') && !body.memo?.trim()) return '한 가지 이상의 일과나 메모를 입력해 주세요.';
  return null;
}
