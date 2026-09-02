/**
 * Theme switching. The `dark` class lives on <html> and is bootstrapped from
 * localStorage in index.html before first paint. The swap flips every themed
 * property at once, so transitions are suppressed for one frame to make it
 * snap instead of smear.
 */
export function getTheme() {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function toggleTheme() {
  const root = document.documentElement;
  root.classList.add('theme-transitions-off');
  // Force a reflow so the suppression applies before the class flip.
  void root.offsetHeight;
  const dark = root.classList.toggle('dark');
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => root.classList.remove('theme-transitions-off'));
  });
  return dark ? 'dark' : 'light';
}
