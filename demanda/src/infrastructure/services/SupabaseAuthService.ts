import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthSession {
  access_token: string;
  user: {
    id: string;
    email: string;
  };
}

export class SupabaseAuthService {
  private readonly client: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.client = createClient(supabaseUrl, supabaseKey);
  }

  async signIn(credentials: AuthCredentials): Promise<AuthSession> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }

    if (!data.session) {
      throw new Error('No session returned');
    }

    return {
      access_token: data.session.access_token,
      user: {
        id: data.user.id,
        email: data.user.email!,
      },
    };
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) {
      throw new Error(`Sign out failed: ${error.message}`);
    }
  }

  async getSession(): Promise<AuthSession | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error) {
      throw new Error(`Get session failed: ${error.message}`);
    }

    if (!data.session) {
      return null;
    }

    return {
      access_token: data.session.access_token,
      user: {
        id: data.session.user.id,
        email: data.session.user.email!,
      },
    };
  }

  async getUser(): Promise<AuthSession['user'] | null> {
    const { data, error } = await this.client.auth.getUser();
    if (error) {
      throw new Error(`Get user failed: ${error.message}`);
    }

    if (!data.user) {
      return null;
    }

    return {
      id: data.user.id,
      email: data.user.email!,
    };
  }
}
