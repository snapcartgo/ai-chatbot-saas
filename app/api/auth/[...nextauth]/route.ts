import NextAuth from "next-auth";
import FacebookProvider from "next-auth/providers/facebook";

const handler = NextAuth({
  providers: [
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    }),
  ],
});

export { handler as GET, handler as POST };