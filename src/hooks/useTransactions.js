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
    const { error, queued } = await supabase.from('transactions').insert(tx);
    if (error) throw error;
    // Офлайн: запись ушла в очередь — показываем сразу с пометкой «ждёт синхронизации»
    if (queued) setTransactions(prev => [{ ...tx, id: Date.now(), pending: true }, ...(prev || [])]);
    else await fetch();
  };

  const remove = async (id) => {
    const { error, queued } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;
    if (queued) setTransactions(prev => (prev || []).filter(x => String(x.id) !== String(id)));
    else await fetch();
  };

  const update = async (id, tx) => {
    const { error, queued } = await supabase.from('transactions').update(tx).eq('id', id);
    if (error) throw error;
    if (queued) setTransactions(prev => (prev || []).map(x => String(x.id) === String(id) ? { ...x, ...tx, pending: true } : x));
    else await fetch();
  };

  // После синхронизации офлайн-очереди — перезагружаем список с сервера
  useEffect(() => {
    const onSync = () => fetch();
    window.addEventListener('atlaspos:synced', onSync);
    return () => window.removeEventListener('atlaspos:synced', onSync);
  }, []);

  return { transactions, loading, add, remove, update, refresh: fetch };
}

export function useAccounts() {
  const [accounts, setAccounts] = useState([]);
  const refresh = () => {
    return supabase.from('accounts').select('*').then(({ data }) => { setAccounts(data || []); return data || []; });
  };
  useEffect(() => { refresh(); }, []);
  return { accounts, refreshAccounts: refresh };
}

export function useCategories() {
  const [categories, setCategories] = useState([]);
  const refresh = () => {
    return supabase.from('categories').select('*').then(({ data }) => { setCategories(data || []); return data || []; });
  };
  useEffect(() => { refresh(); }, []);
  return { categories, refreshCategories: refresh };
}
