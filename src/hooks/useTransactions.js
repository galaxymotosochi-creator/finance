import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      .select('*, accounts(name), categories(name)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    if (!error) setTransactions(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const add = async (tx) => {
    const { error } = await supabase.from('transactions').insert(tx);
    if (error) throw error;
    await fetch();
  };

  const remove = async (id) => {
    await supabase.from('transactions').delete().eq('id', id);
    await fetch();
  };

  const update = async (id, tx) => {
    const { error } = await supabase.from('transactions').update(tx).eq('id', id);
    if (error) throw error;
    await fetch();
  };

  return { transactions, loading, add, remove, update, refresh: fetch };
}

export function useAccounts() {
  const [accounts, setAccounts] = useState([]);
  useEffect(() => {
    supabase.from('accounts').select('*').then(({ data }) => setAccounts(data || []));
  }, []);
  return accounts;
}

export function useCategories() {
  const [categories, setCategories] = useState([]);
  useEffect(() => {
    supabase.from('categories').select('*').then(({ data }) => setCategories(data || []));
  }, []);
  return categories;
}
