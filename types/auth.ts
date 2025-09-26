import { User } from "better-auth/types";

export interface UserWithRole extends User {
  role?: string;
  profileId?: string;
}

declare module "better-auth/types" {
  interface Session {
    user: User & {
      role?: string;
      profileId?: string;
    };
  }
}