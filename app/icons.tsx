/** Small stroke icons, drawn inline so nothing extra is downloaded. */
type P = { className?: string };
const base = (d: React.ReactNode, className = "h-5 w-5") => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>{d}</svg>
);

export const IconCheck = ({ className }: P) => base(<path d="M5 12.5l4.5 4.5L19 7.5" />, className);
export const IconX = ({ className }: P) => base(<path d="M6 6l12 12M18 6L6 18" />, className);
export const IconLock = ({ className }: P) => base(<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>, className);
export const IconShield = ({ className }: P) => base(<><path d="M12 3l7 3v5.5c0 4.2-2.9 7.8-7 9.5-4.1-1.7-7-5.3-7-9.5V6l7-3z" /><path d="M9 12l2.2 2.2L15.2 10" /></>, className);
export const IconArrow = ({ className }: P) => base(<path d="M5 12h14M13 6l6 6-6 6" />, className);
export const IconPen = ({ className }: P) => base(<><path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19l-4 1z" /><path d="M14.5 6.5l3 3" /></>, className);
export const IconMegaphone = ({ className }: P) => base(<><path d="M4 10v4a1 1 0 001 1h2l7 4V5L7 9H5a1 1 0 00-1 1z" /><path d="M18 9a4 4 0 010 6" /></>, className);
export const IconTable = ({ className }: P) => base(<><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M4 10h16M4 14.5h16M10 5v14" /></>, className);
export const IconCode = ({ className }: P) => base(<path d="M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5M13.5 5l-3 14" />, className);
export const IconGlobe = ({ className }: P) => base(<><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.6 2.4 3.9 5.2 3.9 8.500s-1.300 6.100-3.900 8.500c-2.600-2.400-3.900-5.200-3.900-8.500s1.300-6.100 3.900-8.500z" /></>, className);
export const IconImage = ({ className }: P) => base(<><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M5 17l4.500-4.500 3.500 3.500 2.500-2.500L20 17" /></>, className);
export const IconLanguages = ({ className }: P) => base(<><path d="M4 6h9M8.500 4v2M6 6c.400 3.200 2.300 5.600 5.500 7M11 6c-.500 3.600-2.800 6.300-6.500 7.500" /><path d="M13 20l3.500-8 3.500 8M14.300 17.200h4.400" /></>, className);
export const IconEye = ({ className }: P) => base(<><path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z" /><circle cx="12" cy="12" r="2.800" /></>, className);
export const IconBolt = ({ className }: P) => base(<path d="M13 3L5 13.500h6L10.500 21 19 10h-6L13 3z" />, className);
export const IconMail = ({ className }: P) => base(<><rect x="3.500" y="5.500" width="17" height="13" rx="2" /><path d="M4 7.500l8 6 8-6" /></>, className);
export const IconWallet = ({ className }: P) => base(<><path d="M4 7.500A2.500 2.500 0 016.500 5H18v3" /><rect x="4" y="8" width="16" height="11" rx="2" /><path d="M16 13.500h.5" /></>, className);
export const IconRuler = ({ className }: P) => base(<><rect x="3" y="8.500" width="18" height="7" rx="1.500" /><path d="M7 8.500v3M11 8.500v2M15 8.500v3M19 8.500v2" /></>, className);
export const IconBriefcase = ({ className }: P) => base(<><rect x="3.500" y="7.500" width="17" height="12" rx="2" /><path d="M9 7.500V6a1.500 1.500 0 011.500-1.500h3A1.500 1.500 0 0115 6v1.500M3.500 13h17" /></>, className);
export const IconClock = ({ className }: P) => base(<><circle cx="12" cy="12" r="8.500" /><path d="M12 7.500V12l3 2" /></>, className);
export const IconScale = ({ className }: P) => base(<><path d="M12 4v16M7 20h10M5 8h14" /><path d="M5 8l-2.500 6a2.800 2.800 0 005 0L5 8zM19 8l-2.500 6a2.800 2.800 0 005 0L19 8z" /></>, className);
export const IconChat = ({ className }: P) => base(<path d="M5 5.500h14a1.500 1.500 0 011.500 1.500v8a1.500 1.500 0 01-1.500 1.500h-7L8 20v-3.500H5A1.500 1.500 0 013.500 15V7A1.500 1.500 0 015 5.500z" />, className);

const BY_CATEGORY: Record<string, (p: P) => React.ReactNode> = {
  writing: IconPen, social: IconMegaphone, data: IconTable, code: IconCode,
  website: IconGlobe, design: IconImage, translation: IconLanguages,
};
export function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const I = BY_CATEGORY[category] ?? IconPen;
  return <>{I({ className })}</>;
}

export function Logo({ className = "h-8 w-8" }: P) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="9" fill="#0a1730" />
      <path d="M9 16.500l4.700 4.700L23 11.500" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
