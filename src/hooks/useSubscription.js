import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useSubscription() {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isExpired, setIsExpired] = useState(false);
  const [daysLeft, setDaysLeft] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getSession();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      setSubscription(sub);

      if (sub) {
        const now = new Date();
        const trialEnd = new Date(sub.trial_ends_at);
        const diff = trialEnd - now;
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        setDaysLeft(Math.max(0, days));

        if (['trial', 'expired'].includes(sub.status) && trialEnd < now) {
          setIsExpired(true);
        }
      }

      setLoading(false);
    };

    fetch();
  }, []);

  return { subscription, loading, isExpired, daysLeft };
}
