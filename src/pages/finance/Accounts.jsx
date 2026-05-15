import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function Accounts() {
  const [loading] = useState(false);

  return (
    <>
<div className="page-header"><div><h1>Счета</h1><div className="sub">Управление счетами (в разработке)</div></div></div>
    </>
  );
}
