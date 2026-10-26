export type Outcome = "playing" | "won" | "lost";
export interface GameView {
  hours: number;
  fatigue: number;
  helper: boolean;
  disclosed: boolean;
  privacyManaged: boolean;
  paid: boolean;
  day: number;
  title: string;
  text: string[];
  choices: { id: string; label: string; cost?: string }[];
  outcome: Outcome;
  people: string[];
  mood: string;
  progress: string;
}
