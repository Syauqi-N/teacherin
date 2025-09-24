import { User } from "better-auth/types";

export interface UserWithRole extends User {
  role?: string;
  profileId?: string;
}