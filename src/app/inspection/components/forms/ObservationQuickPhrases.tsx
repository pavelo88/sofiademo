'use client';

const STATUS_PHRASES = [
  'EL GRUPO SE QUEDA OPERATIVO EN AUTOMATICO SIN ALARMAS PRESENTES.',
  'EL GRUPO SE QUEDA OPERATIVO.',
  'EL GRUPO SE QUEDA INOPERATIVO.',
];

export const appendObservationPhrase = (currentValue: string, phrase: string) => {
  const current = String(currentValue || '').trimEnd();
  return current ? `${current}\n${phrase}` : phrase;
};

interface ObservationQuickPhrasesProps {
  value: string;
  onChange: (value: string) => void;
}

export default function ObservationQuickPhrases({ value, onChange }: ObservationQuickPhrasesProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
      {STATUS_PHRASES.map((phrase) => (
        <button
          key={phrase}
          type="button"
          onClick={() => onChange(appendObservationPhrase(value, phrase))}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-[9px] font-black uppercase leading-tight text-slate-500 transition-all hover:border-primary hover:bg-white hover:text-primary active:scale-[0.98]"
        >
          {phrase}
        </button>
      ))}
    </div>
  );
}
