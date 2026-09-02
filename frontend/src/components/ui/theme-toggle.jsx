import { useState } from 'react';
import { motion } from 'motion/react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getTheme, toggleTheme } from '@/lib/theme';

const spring = { type: 'spring', duration: 0.3, bounce: 0 };

/* Both icons stay in the DOM and cross-fade with scale + blur, so the swap
 * animates in both directions and stays interruptible. */
function IconSwap({ active, children }) {
  return (
    <motion.span
      className="absolute inset-0 grid place-items-center"
      initial={false}
      animate={{
        opacity: active ? 1 : 0,
        scale: active ? 1 : 0.25,
        filter: active ? 'blur(0px)' : 'blur(4px)',
      }}
      transition={spring}
    >
      {children}
    </motion.span>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState(getTheme);
  const dark = theme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(toggleTheme())}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      <span className="relative size-4">
        <IconSwap active={dark}>
          <Sun className="size-3.5" strokeWidth={2} />
        </IconSwap>
        <IconSwap active={!dark}>
          <Moon className="size-3.5" strokeWidth={2} />
        </IconSwap>
      </span>
    </Button>
  );
}

export { ThemeToggle };
