export const HOST_ACCOUNT = { username: 'host', password: 'dadarzz', role: 'host', name: 'Host' };

// Change these eight fixed credentials here before the event if you want different values.
export const PLAYER_ACCOUNTS = Array.from({ length: 7 }, (_, index) => ({
  username: `player${index + 1}`,
  password: `player${index + 1}`,
  role: 'player',
  playerId: `player-${index + 1}`,
  name: `Player ${index + 1}`,
}));

export const ALL_ACCOUNTS = [HOST_ACCOUNT, ...PLAYER_ACCOUNTS];
