// Player photo URL with jersey-as-fallback when FPL hasn't released a photo
// (e.g. recent transfers — the 250x250 PNG returns 403, and FPL's own p0.png
// fallback is also 403).

const PLAYER_PHOTO_BASE = 'https://resources.premierleague.com/premierleague/photos/players/250x250';
const SHIRT_BASE = 'https://fantasy.premierleague.com/dist/img/shirts/standard';

export const getPlayerImageUrl = (code) => `${PLAYER_PHOTO_BASE}/p${code}.png`;

export const getJerseyUrl = (teamCode, position) => {
  if (!teamCode) return null;
  const suffix = position === 'GKP' ? '_1' : '';
  return `${SHIRT_BASE}/shirt_${teamCode}${suffix}-220.webp`;
};

// Use as: onError={handlePlayerImageError(player)}
// `player` should expose team_code and position. The handler swaps in the
// team jersey on first error and short-circuits on the second to avoid loops.
export const handlePlayerImageError = (player) => (e) => {
  if (e.target.dataset.fb) return;
  e.target.dataset.fb = '1';
  const jersey = getJerseyUrl(player?.team_code, player?.position);
  if (jersey) {
    e.target.src = jersey;
    e.target.classList.add('player-img-jersey');
  }
};
