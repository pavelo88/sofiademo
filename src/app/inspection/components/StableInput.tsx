'use client';

import { LucideIcon } from 'lucide-react';
import React from 'react';

interface StableInputProps {
  label: string;
  value: any;
  onChange: (value: any) => void;
  icon?: LucideIcon;
  type?: string;
  placeholder?: string;
  className?: string;
  min?: string | number;
  step?: string | number;
}

const StableInput = React.memo(({ 
  label, 
  value, 
  onChange, 
  icon: Icon, 
  type = "text", 
  placeholder = '',
  className = '',
  min,
  step
}: StableInputProps) => (
  <div className={`space-y-1 w-full text-left ${className}`}>
    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{label}</label>
    <div className="relative group">
      {Icon && <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={14}/>}
      <input 
        type={type}
        value={value || ''}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        step={step}
        className={`w-full bg-white border border-slate-200 rounded-xl p-2.5 ${Icon ? 'pl-10' : ''} outline-none focus:border-primary focus:bg-white transition-all font-bold !text-black shadow-sm text-xs`}
      />
    </div>
  </div>
));
StableInput.displayName = 'StableInput';

export default StableInput;
