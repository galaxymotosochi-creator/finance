"""
Improved HTML-to-JSX converter.
Properly handles input tags, onclick→onClick, inline styles with rem values.
"""
import re, os

def css_to_js(style_str):
    if not style_str or not style_str.strip():
        return None
    props = []
    for rule in style_str.split(';'):
        rule = rule.strip()
        if not rule or ':' not in rule:
            continue
        key, val = rule.split(':', 1)
        key = key.strip()
        val = val.strip().rstrip('!important').strip()
        if not val:
            continue
        parts = key.split('-')
        camel = parts[0] + ''.join(p.capitalize() for p in parts[1:])
        props.append(f'{camel}:"{val}"')
    if not props:
        return None
    return '{' + ','.join(props) + '}'


with open('/root/.openclaw/workspace/bizaccount/index.html', 'r') as f:
    html = f.read()

# Remove style/script blocks
html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL)
html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
html = re.sub(r'<meta[^>]*>', '', html)
html = re.sub(r'<link[^>]*>', '', html)
html = re.sub(r'<!--.*?-->', '', html, flags=re.DOTALL)

# Find all page-sections
sections = re.findall(r'<div class="page-section"[^>]*>.*?</div>\s*(?=<div class="page-section"|<!--|$)', html, re.DOTALL)

page_map = {
    'dashboard': 'Dashboard',
    'pnl': 'PnL',
    'transactions': 'Transactions',
    'directory': 'Categories',
    'shifts': 'Shifts',
    'salary': 'Salary',
    'bills': 'Accounts',
    'products': 'Products',
    'turnover': 'Turnover',
    'stock': 'Stock',
    'supplies': 'Supplies',
    'inventory': 'Inventory',
    'writeoffs': 'Writeoffs',
    'suppliers': 'Suppliers',
    'clients': 'Clients',
    'loyalty': 'Loyalty',
    'promos': 'Promos',
    'employees': 'Employees',
    'positions': 'Positions',
    'settings-general': 'SettingsGeneral',
    'venues': 'Venues',
    'registers': 'CashRegisters',
    'categories': 'StockCategories',
    'services': 'Services',
    'warehouses': 'Warehouses',
    'trash': 'Trash',
}

out_dir = '/root/.openclaw/workspace/finance/src/pages/finance'
os.makedirs(out_dir, exist_ok=True)

generated = []

for section in sections:
    # Extract page ID
    id_match = re.search(r'id="page-([^"]+)"', section)
    if not id_match:
        continue
    page_id = id_match.group(1)
    if page_id not in page_map:
        continue
    comp_name = page_map[page_id]

    # Extract inner HTML (remove the page-section wrapper)
    inner = re.sub(r'^<div class="page-section"[^>]*>', '', section)
    inner = re.sub(r'</div>\s*$', '', inner)
    
    # Convert to JSX
    jsx = inner
    
    # class → className
    jsx = jsx.replace(' class="', ' className="')
    jsx = jsx.replace(" class='", " className='")
    
    # onclick → onClick
    jsx = re.sub(r' onclick="([^"]*)"', r' onClick={function(){\1}}', jsx)
    
    # oninput → onChange  
    jsx = re.sub(r' oninput="([^"]*)"', r' onChange={function(){\1}}', jsx)
    
    # Self-closing input tags: <input ...> → <input ... />
    jsx = re.sub(r'<input([^>]*[^/])>', r'<input\1 />', jsx)
    
    # Remove ids
    jsx = re.sub(r' id="[^"]*"', '', jsx)
    
    # Remove event.stopPropagation()
    jsx = jsx.replace('event.stopPropagation();', '')
    
    # Convert inline styles
    def convert_style(m):
        css = m.group(1)
        js = css_to_js(css)
        if js:
            return f' style={{{js}}}'
        return ''
    jsx = re.sub(r' style="([^"]*)"', convert_style, jsx)
    
    # Remove empty style
    jsx = jsx.replace(' style=""', '')
    jsx = jsx.replace(" style=''", '')
    
    # Clean up onClick: remove trailing ;
    jsx = re.sub(r'function\(\)\{([^}]*);\}', r'function(){\1}', jsx)
    
    # Write file
    comp = f"""export default function {comp_name}() {{
  return (
    <>
{jsx}
    </>
  );
}}
"""
    filepath = f'{out_dir}/{comp_name}.jsx'
    with open(filepath, 'w') as f:
        f.write(comp)
    generated.append((page_id, comp_name))
    print(f'  ✓ {comp_name}')

print(f'\nGenerated {len(generated)} components')
