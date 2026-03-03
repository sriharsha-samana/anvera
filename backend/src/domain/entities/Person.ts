export class PersonEntity {
  constructor(
    public readonly id: string,
    public readonly familyId: string,
    public readonly name: string,
    public readonly gender: string,
    public readonly dateOfBirth: string | null,
    public readonly metadataJson: string,
  ) {}
}
