import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AuthSession } from '../types';

const SUPABASE_URL = "https://obawmpfnjiazyyugsrms.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iYXdtcGZuamlhenl5dWdzcm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0MzUxNDYsImV4cCI6MjEwNjAxMTE0Nn0.SKaQcQP7LKZzoswU5PnE-kcgLAfJxkrOz0udUxVnqRc";

export class SupabaseAuthService {
  private static client: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  static async signIn(email: string, password: string): Promise<AuthSession> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (!data.session) throw new Error('No session returned');

    return {
      access_token: data.session.access_token,
      user: {
        id: data.user.id,
        email: data.user.email!,
      },
    };
  }

  static async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw new Error(error.message);
  }

  static async getSession(): Promise<AuthSession | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw new Error(error.message);
    if (!data.session) return null;

    return {
      access_token: data.session.access_token,
      user: {
        id: data.session.user.id,
        email: data.session.user.email!,
      },
    };
  }

  static async getUser(): Promise<AuthSession['user'] | null> {
    const { data, error } = await this.client.auth.getUser();
    if (error) throw new Error(error.message);
    if (!data.user) return null;

    return {
      id: data.user.id,
      email: data.user.email!,
    };
  }
}
