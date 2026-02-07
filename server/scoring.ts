const PLACE_POINTS = [10, 7, 5];
const DEFAULT_POINTS = 3;
const ACTOR_BONUS = 5;

export function getGuesserPoints(place: number): number {
  if (place < 0 || place >= PLACE_POINTS.length) return DEFAULT_POINTS;
  return PLACE_POINTS[place];
}

export function getActorPoints(numCorrectGuessers: number): number {
  return numCorrectGuessers > 0 ? ACTOR_BONUS : 0;
}
