import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getUserByEmail, createUser, trackEvent } from './db';

declare module 'next-auth' {
  interface User {
    id: string;
    email: string;
  }
  interface Session {
    user: User & { id: string };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        action: { label: 'Action', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        if (credentials.action === 'register') {
          const existing = getUserByEmail(credentials.email);
          if (existing) throw new Error('Email already registered');
          const hash = await bcrypt.hash(credentials.password, 12);
          const user = createUser(credentials.email, hash);
          trackEvent(user.id, 'user.register', 'web');
          return { id: String(user.id), email: user.email };
        }

        const user = getUserByEmail(credentials.email);
        if (!user) throw new Error('Invalid credentials');
        const valid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!valid) throw new Error('Invalid credentials');
        trackEvent(user.id, 'user.login', 'web');
        return { id: String(user.id), email: user.email };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.userId as string;
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
};
