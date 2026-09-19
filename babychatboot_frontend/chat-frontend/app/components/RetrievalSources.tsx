import { readSources } from '../lib/retrieval-sources';

export default function RetrievalSources({ value }: { value?: string | null }) {
  const sources = readSources(value);
  if (!sources.length) return <p className="mt-3 text-xs text-gray-500">{value ? '이 답변에 전달한 등록 문서가 없습니다.' : '이전 답변에는 출처 기록이 없습니다.'}</p>;
  return <details className="mt-3 border-t pt-2 text-xs text-gray-600">
    <summary className="cursor-pointer">AI에 전달한 참고자료 {sources.length}개</summary>
    <ul className="mt-2 space-y-3">{sources.map((source, index) => <li key={index}>
      <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-medium text-sky-700 underline">{source.title}</a>
      <p>{source.publisher} · 개정일 {source.revisedOn || '미확인'}{source.page > 0 ? ` · PDF ${source.page}쪽` : ''}</p>
      <p className="mt-1 whitespace-pre-wrap rounded bg-gray-50 p-2">{source.excerpt}</p>
    </li>)}</ul>
  </details>;
}
