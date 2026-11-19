import { supabase } from './supabase';

export interface BoardRow { user_id: string; handle: string; is_me: boolean; streak: number; last_workout: string | null; days_7: number; friendship_id: string | null }
export interface FriendRequest { id: string; handle: string; incoming: boolean; created_at: string }
export interface Challenge {
  id: string; i_am_creator: boolean; opponent_handle: string; exercise: string | null; days: number;
  status: 'pending' | 'active'; start_date: string | null; end_date: string | null;
  my_score: number; their_score: number; finished: boolean;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('서버가 설정되지 않았어요');
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export const social = {
  board: () => rpc<BoardRow[]>('friend_board'),
  requests: () => rpc<FriendRequest[]>('friend_requests'),
  challenges: async () =>
    (await rpc<Challenge[]>('my_challenges')).map((c) => ({ ...c, my_score: Number(c.my_score), their_score: Number(c.their_score) })),
  addFriend: (handle: string) => rpc<'pending' | 'accepted'>('send_friend_request', { target_handle: handle }),
  respondFriend: (id: string, accept: boolean) => rpc<void>('respond_friend_request', { request_id: id, accept }),
  removeFriend: async (friendshipId: string) => {
    const { error } = await supabase!.from('friendships').delete().eq('id', friendshipId);
    if (error) throw error;
  },
  createChallenge: (opponentId: string, exercise: string | null, days: number) =>
    rpc<string>('create_challenge', { opponent_id: opponentId, exercise_name: exercise ?? '', period_days: days }),
  respondChallenge: (id: string, accept: boolean) => rpc<void>('respond_challenge', { challenge_id: id, accept }),
  cancelChallenge: async (id: string) => {
    const { error } = await supabase!.from('challenges').delete().eq('id', id);
    if (error) throw error;
  },
};
