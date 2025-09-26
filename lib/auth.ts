import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db"; // your drizzle instance
import { account, session, user, verification } from "@/db/schema/auth";
import { profiles } from "@/db/schema/users";
import { eq } from "drizzle-orm";

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg", // or "mysql", "sqlite"
        schema: {
            user: user,
            account: account,
            session: session,
            verification: verification,
        }
    }),
    emailAndPassword: {
        enabled: true,
    },
    plugins: [
        {
            id: "role-based-access",
            hooks: {
                after: [
                    {
                        matcher: (context) => context.path === "/sign-in",
                        handler: async (inputContext: {
                          response?: any;
                          request?: Request;
                        }) => {
                            // Fetch user profile with role information
                            if (inputContext.response?.user?.id) {
                                const userProfile = await db.query.profiles.findFirst({
                                    where: eq(profiles.userId, inputContext.response.user.id),
                                });
                                
                                if (userProfile) {
                                    return {
                                        response: {
                                            ...inputContext.response,
                                            user: {
                                                ...inputContext.response.user,
                                                role: userProfile.role,
                                                profileId: userProfile.id,
                                            }
                                        }
                                    };
                                }
                            }
                            
                            return inputContext;
                        }
                    }
                ]
            }
        }
    ],
    callbacks: {
        // Add role information to session
        session: async (session: { user: any; expires: string }) => {
            const userProfile = await db.query.profiles.findFirst({
                where: eq(profiles.userId, session.user.id),
            });
            
            if (userProfile) {
                return {
                    ...session,
                    user: {
                        ...session.user,
                        role: userProfile.role,
                        profileId: userProfile.id,
                    }
                };
            }
            
            return session;
        }
    }
});