import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { IconButton } from './ui/Button';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <IconButton label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggle}>
      {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </IconButton>
  );
}
