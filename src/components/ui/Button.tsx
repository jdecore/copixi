import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
};

export function Button({ variant = 'primary', style, ...props }: Props) {
  const base: React.CSSProperties = {
    padding: '10px 16px',
    borderRadius: '10px',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    border: '1px solid transparent',
  };
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--color-text)', color: 'white' },
    secondary: { background: 'white', borderColor: 'var(--color-border)', color: 'var(--color-text)' },
    ghost: { background: 'transparent', color: 'var(--color-text)' },
  };
  return <button {...props} style={{ ...base, ...variants[variant], ...style }} />;
}
