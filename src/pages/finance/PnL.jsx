import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function PnL() {
  const [loading] = useState(false);

  return (
    <>
<div className="page-header"><div><h1>P&amp;L</h1><div className="sub">Прибыли и убытки (в разработке)</div></div></div>
    </>
  );
}
