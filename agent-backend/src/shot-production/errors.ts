export class ShotProductionTaskError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShotProductionTaskError';
  }
}
