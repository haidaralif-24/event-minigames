# Mini-Game Contract

Every mini-game MUST resolve to exactly:

```ts
type MiniGameResult = { teamId: string; score: number }[]
```

No extra fields. Board logic only reads `.teamId` and `.score`.
The internal mechanic (reaction, speed, quiz, etc.) is invisible to board logic.
