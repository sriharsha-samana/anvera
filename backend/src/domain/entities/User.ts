import { UserRole } from '@prisma/client';

export class UserEntity {
  constructor(
    public readonly id: string,
    public readonly username: string,
    public readonly role: UserRole,
  ) {}

  public isOwner(): boolean {
    return this.role === UserRole.OWNER;
  }
}
