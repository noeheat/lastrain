// 홈 화면 레일·상단의 선 아이콘. 한 가지 선 굵기(1.75)로 직접 그린 SVG
type P = { className?: string };
const base = {
  width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
};

export const PencilIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M4 20h4L19 9a2.1 2.1 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>
);

// 환승 경로: 두 역을 잇는 꺾인 선
export const RouteIcon = ({ className }: P) => (
  <svg {...base} className={className}><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="6" r="2.2" /><path d="M8.2 18H12a2 2 0 0 0 2-2V8a2 2 0 0 1 2-2h-.2" /></svg>
);

export const PlusIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M12 5v14M5 12h14" /></svg>
);

export const ChevronDownIcon = ({ className }: P) => (
  <svg {...base} width={16} height={16} className={className}><path d="m6 9 6 6 6-6" /></svg>
);
