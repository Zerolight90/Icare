'use client';

import { useEffect, useRef, useState } from 'react';
import { activities, diaperLabels, localDate, napMinutes, durationLabel, validateLog, type Activity, type DailyLog, type LogBody } from '../lib/daily-log';

const input = 'mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus-visible:outline-2 focus-visible:outline-sky-700';
const label = 'block text-sm font-semibold text-slate-700';
const button = 'min-h-11 rounded-xl px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-50';

export default function LogEditor({ log, date, initialActivity, babyName, saving, error, onClose, onSave }: {
  log: DailyLog | null; date: string; initialActivity: Activity; babyName: string;
  saving: boolean; error: string; onClose: () => void; onSave: (body: LogBody) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<Activity[]>(() => log ? [
    ...(log.formulaAmount != null || log.breastfed ? ['feeding' as const] : []),
    ...(log.solidFoodName ? ['food' as const] : []), ...(log.napEndTime ? ['nap' as const] : []),
    ...(log.diaperType && log.diaperType !== 'NONE' ? ['diaper' as const] : []),
  ] : [initialActivity]);
  const [start, setStart] = useState(log?.recordTime.slice(0, 16) ?? `${date}T${new Date().toTimeString().slice(0, 5)}`);
  const [formula, setFormula] = useState(log?.formulaAmount?.toString() ?? '');
  const [breastfed, setBreastfed] = useState(log?.breastfed ?? false);
  const [food, setFood] = useState(log?.solidFoodName ?? '');
  const [amount, setAmount] = useState(log?.solidFoodAmount?.toString() ?? '');
  const [end, setEnd] = useState(log?.napEndTime?.slice(0, 16) ?? '');
  const [diaper, setDiaper] = useState(log?.diaperType ?? 'NONE');
  const [memo, setMemo] = useState(log?.memo ?? '');
  const [validation, setValidation] = useState('');
  const has = (activity: Activity) => selected.includes(activity);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element?.showModal();
    return () => { element?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  const minutes = end && start ? napMinutes({ recordTime: start, napEndTime: end }) : null;
  return <dialog ref={dialog} aria-labelledby="log-editor-title" aria-describedby="log-editor-help"
    onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
    className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50">
    <form onSubmit={event => {
      event.preventDefault();
      if (saving) return;
      const body: LogBody = { recordTime: `${start}:00`, formulaAmount: has('feeding') && formula !== '' ? Number(formula) : null,
        breastfed: has('feeding') ? breastfed : null, diaperType: has('diaper') ? diaper : 'NONE', memo: memo.trim() || null,
        solidFoodName: has('food') ? food.trim() : null, solidFoodAmount: has('food') && amount !== '' ? Number(amount) : null,
        napEndTime: has('nap') ? `${end}:00` : null };
      const message = validateLog(body);
      setValidation(message ?? '');
      if (!message) void onSave(body);
    }}>
      <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 id="log-editor-title" className="text-lg font-bold">{log ? '기록 수정' : '기록 추가'} · {babyName}</h2>
        <button type="button" onClick={onClose} disabled={saving} aria-label="기록 창 닫기" className={button}>✕</button>
      </header>
      <fieldset disabled={saving} className="space-y-5 p-5">
        <p id="log-editor-help" className="text-sm text-slate-600">기록할 항목을 선택하세요. 같은 시각의 일과는 여러 개 선택할 수 있어요.</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="기록 항목">
          {activities.map(activity => <button type="button" key={activity.id} aria-pressed={has(activity.id)}
            onClick={() => setSelected(previous => has(activity.id) ? previous.filter(value => value !== activity.id) : [...previous, activity.id])}
            className={`${button} border ${has(activity.id) ? 'border-sky-700 bg-sky-50 text-sky-900' : 'border-slate-300 text-slate-700'}`}>
            <span aria-hidden="true">{activity.icon} </span>{activity.label}
          </button>)}
        </div>
        <label className={label}>{has('nap') ? '기록 시각 / 낮잠 시작' : '기록 시각'}
          <input autoFocus type="datetime-local" required value={start} max={`${localDate()}T23:59`} onChange={event => setStart(event.target.value)} className={input} />
        </label>
        {has('feeding') && <fieldset className="space-y-3 rounded-xl bg-sky-50 p-4">
          <legend className="font-semibold">수유</legend>
          <label className={label}>분유량 (ml, 선택)<input type="number" inputMode="numeric" min="0" max="2000" step="1" value={formula} onChange={event => setFormula(event.target.value)} className={input} /></label>
          <label className="flex min-h-11 items-center gap-3 font-medium"><input type="checkbox" checked={breastfed} onChange={event => setBreastfed(event.target.checked)} className="h-5 w-5 accent-sky-700" />모유 수유함</label>
        </fieldset>}
        {has('food') && <fieldset className="space-y-3 rounded-xl bg-orange-50 p-4">
          <legend className="font-semibold">이유식</legend>
          <label className={label}>먹은 음식 (필수)<input required maxLength={100} value={food} onChange={event => setFood(event.target.value)} placeholder="예: 쌀미음, 소고기 채소죽" className={input} /></label>
          <label className={label}>섭취량 (g, 선택)<input type="number" inputMode="numeric" min="1" max="1000" step="1" value={amount} onChange={event => setAmount(event.target.value)} aria-describedby="food-amount-help" className={input} /></label>
          <p id="food-amount-help" className="text-sm text-slate-600">먹은 양을 모르면 비워 두세요. 재료나 반응은 메모에 남길 수 있어요.</p>
        </fieldset>}
        {has('nap') && <fieldset className="space-y-3 rounded-xl bg-violet-50 p-4">
          <legend className="font-semibold">낮잠</legend>
          <label className={label}>낮잠 종료 (필수)<input type="datetime-local" required value={end} onChange={event => setEnd(event.target.value)} className={input} aria-describedby="nap-help" /></label>
          <p id="nap-help" className="text-sm text-slate-600">잠에서 깬 뒤 기록해 주세요. 날짜가 바뀌었다면 종료 날짜도 바꿔 주세요. 시작한 날짜의 일과에 표시됩니다.</p>
          {minutes != null && minutes > 0 && minutes <= 1440 && <p role="status" className="font-semibold text-violet-900">낮잠 시간: {durationLabel(minutes)}</p>}
        </fieldset>}
        {has('diaper') && <label className={label}>기저귀 종류<select value={diaper} onChange={event => setDiaper(event.target.value)} className={input}>{Object.entries(diaperLabels).map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select></label>}
        <label className={label}>메모 (선택)<textarea rows={3} maxLength={500} value={memo} onChange={event => setMemo(event.target.value)} placeholder="관찰한 내용을 적어 주세요" className={input} /></label>
        {(validation || error) && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{validation || error}</p>}
      </fieldset>
      <footer className="sticky bottom-0 flex gap-3 border-t border-slate-200 bg-white p-4">
        <button type="button" onClick={onClose} disabled={saving} className={`${button} flex-1 border border-slate-300`}>취소</button>
        <button type="submit" disabled={saving} className={`${button} flex-1 bg-sky-700 text-white hover:bg-sky-800`}>{saving ? '저장 중…' : log ? '수정 완료' : '저장'}</button>
      </footer>
    </form>
  </dialog>;
}
