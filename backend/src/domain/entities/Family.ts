export class FamilyEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly ownerId: string,
  ) {}

  public belongsToOwner(userId: string): boolean {
    return this.ownerId === userId;
  }
}
