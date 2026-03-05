import { useState, useEffect } from 'react';

interface TimeInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function TimeInput({ value, onChange, placeholder, disabled, className = '' }: TimeInputProps) {
  const [localVal, setLocalVal] = useState(value || '');

  useEffect(() => {
    setLocalVal(value || '');
  }, [value]);

  const handleBlur = () => {
    if (!localVal) return;
    
    let clean = localVal.toLowerCase().replace(/\s+/g, '');
    let isPM = clean.includes('p');
    let isAM = clean.includes('a');
    
    clean = clean.replace(/[a-z]/g, ''); // remove am/pm chars
    clean = clean.replace('.', ':');
    
    if (!clean.includes(':')) {
       if (clean.length === 1 || clean.length === 2) {
         clean = `${clean}:00`;
       } else if (clean.length === 3) {
         clean = `0${clean[0]}:${clean.substring(1)}`;
       } else if (clean.length === 4) {
         clean = `${clean.substring(0,2)}:${clean.substring(2)}`;
       }
    }
    
    let [hStr, mStr] = clean.split(':');
    let h = parseInt(hStr, 10);
    let m = parseInt(mStr, 10) || 0;
    
    if (isNaN(h) || isNaN(m) || h > 23 || m > 59) return;

    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;

    let ampm = h >= 12 ? 'PM' : 'AM';
    let dispH = h % 12;
    if (dispH === 0) dispH = 12;

    const formatted = `${dispH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
    setLocalVal(formatted);
    onChange(formatted);
  };

  return (
     <input
       type="text"
       value={localVal}
       onChange={(e) => setLocalVal(e.target.value)}
       onBlur={handleBlur}
       placeholder={placeholder || "e.g. 7.10"}
       disabled={disabled}
       className={className}
     />
  );
}
