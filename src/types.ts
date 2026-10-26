export type Outcome = "playing" | "won" | "lost";
export interface GameView {
  day: number;
  title: string;
  text: string[];
  choices: { id: string; label: string }[];
  outcome: Outcome;
  people: string[];
  mood: string;
  progress: string;
}
