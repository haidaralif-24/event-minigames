export const HOST_ACCOUNT = { username: 'host', password: 'dadarzz', role: 'host', name: 'Host' };

// Change these six fixed credentials here before the event if you want different values.
// Avatar names double as the team names; each must match a file in /public/avatars.
const AVATAR_ORDER = ['Adiyat', 'Ghuraab', 'Hud-Hud', 'Nahl', 'Naml', 'Nun'];
export const PLAYER_ACCOUNTS = AVATAR_ORDER.map((name, index) => ({
  username: `player${index + 1}`,
  password: `player${index + 1}`,
  role: 'player',
  playerId: `player-${index + 1}`,
  name,
  avatar: `/avatars/${name}.png`,
}));

export const ALL_ACCOUNTS = [HOST_ACCOUNT, ...PLAYER_ACCOUNTS];
