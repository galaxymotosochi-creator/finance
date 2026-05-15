"""
Convert original bizaccount HTML to React components.
1. Removes all <style> and <script> tags
2. Converts each page-section to a separate JSX component
3. Converts class→className, onclick→onClick, style strings→JS objects
"""

import re
import os

def css_to_js(style_str):
    """Convert CSS style string to JS object notation"""
    if not style_str:
        return ''
    props = []
    for rule in style_str.split(';'):
        rule = rule.strip()
        if not rule or ':' not in rule:
            continue
        key, val = rule.split(':', 1)
        key = key.strip()
        val = val.strip().rstrip('!important').strip()
        # Convert kebab-case to camelCase
        parts = key.split('-')
        camel = parts[0] + ''.join(p.capitalize() for p in parts[1:])
        # Only include if val is simple (no functions)
        if '(' in val or '{' in val or '}' in val or val.startswith('var('):
            props.append(f'{camel}:"{val}"')
        else:
            props.append(f'{camel}:"{val}"')
    if not props:
        return ''
    return '{' + ','.join(props) + '}'


def convert_html_to_jsx(html, page_id):
    """Convert HTML block to JSX string"""
    # Remove surrounding page-section div
    html = re.sub(r'<div class="page-section"[^>]*>', '', html, 1)
    html = re.sub(r'</div>\s*$', '', html)
    
    # class → className
    html = html.replace(' class="', ' className="')
    html = html.replace(" class='", " className='")
    
    # onclick → onClick (remove string quotes)
    html = html.replace(' onclick="', ' onClick="')
    
    # Handle inline styles
    def style_replacer(m):
        old = m.group(0)
        css = m.group(1)
        js = css_to_js(css)
        if js:
            return f' style={{ {js} }}'
        return ''
    
    html = re.sub(r' style="([^"]*)"', style_replacer, html)
    
    # Remove ids
    html = re.sub(r' id="[^"]*"', '', html)
    
    # Remove event.stopPropagation()
    html = html.replace('event.stopPropagation();', '')
    
    # Clean empty style attributes
    html = html.replace(' style=""', '')
    html = html.replace(" style=''", '')
    
    return html.strip()


# Read original file
with open('/root/.openclaw/workspace/bizaccount/index.html', 'r') as f:
    content = f.read()

# Remove style blocks
content = re.sub(r'<style[^>]*>.*?</style>', '', content, flags=re.DOTALL)
# Remove script blocks  
content = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.DOTALL)
# Remove meta, links
content = re.sub(r'<meta[^>]*>', '', content)
content = re.sub(r'<link[^>]*>', '', content)

# Find all page-sections
sections = re.findall(r'<div class="page-section"[^>]*>.*?</div>\s*(?=<div class="page-section"|<!--|$)', content, re.DOTALL)

print(f"Found {len(sections)} page sections")

# Map page IDs to component names
page_map = {
    'dashboard': ('Dashboard', 'Панель управления'),
    'pnl': ('PnL', 'P&L'),
    'transactions': ('Transactions', 'Транзакции'),
    'directory': ('Categories', 'Справочник'),
    'shifts': ('Shifts', 'Смены'),
    'salary': ('Salary', 'Зарплата'),
    'bills': ('Accounts', 'Счета'),
    'products': ('Products', 'Товары и услуги'),
    'categories': ('StockCategories', 'Категории'),
    'turnover': ('Turnover', 'Здоровье товаров'),
    'stock': ('Stock', 'Остатки'),
    'supplies': ('Supplies', 'Поставки'),
    'inventory': ('Inventory', 'Инвентаризация'),
    'writeoffs': ('Writeoffs', 'Списания'),
    'suppliers': ('Suppliers', 'Поставщики'),
    'clients': ('Clients', 'База клиентов'),
    'loyalty': ('Loyalty', 'Лояльность'),
    'promos': ('Promos', 'Акции'),
    'employees': ('Employees', 'Сотрудники'),
    'positions': ('Positions', 'Должности'),
    'settings-general': ('SettingsGeneral', 'Общие'),
    'venues': ('Venues', 'Заведения'),
    'registers': ('CashRegisters', 'Касса'),
}

# Output directory
out_dir = '/root/.openclaw/workspace/finance/src/pages/finance'
os.makedirs(out_dir, exist_ok=True)

generated = []

for i, section in enumerate(sections):
    # Extract page ID
    id_match = re.search(r'id="page-([^"]+)"', section)
    if not id_match:
        continue
    page_id = id_match.group(1)
    
    if page_id not in page_map:
        print(f"  Skipping unknown page: {page_id}")
        continue
    
    comp_name, page_title = page_map[page_id]
    
    # Convert HTML
    jsx = convert_html_to_jsx(section, page_id)
    
    # Write component file
    component = f"""import {{ useState, useEffect }} from 'react';
import {{ supabase }} from '../../lib/supabase';

export default function {comp_name}() {{
  const [loading] = useState(false);

  return (
    <>
{jsx}
    </>
  );
}}
"""
    filepath = f'{out_dir}/{comp_name}.jsx'
    with open(filepath, 'w') as f:
        f.write(component)
    
    generated.append((page_id, comp_name, page_title))
    print(f"  ✓ {comp_name}.jsx ({page_title})")

print(f"\nGenerated {len(generated)} components")
