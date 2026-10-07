"""Validate an entire Excel sheet, then import it atomically through E-Depo's API."""
import argparse
import json
import math
import sys
import urllib.request
import urllib.error
from pathlib import Path
import pandas as pd

ALIASES = {'product_name': 'name', 'product': 'name', 'fabric': 'fabric_type', 'stock': 'current_stock', 'quantity': 'current_stock', 'reorder': 'reorder_level'}
CATEGORIES = {'bedding': 'bedding', 'bedding & comfort': 'bedding', 'living space': 'living-space', 'living-space': 'living-space', 'living space textiles': 'living-space', 'decor': 'decor', 'home decor & utilities': 'decor'}

def clean_inventory(path, sheet=0):
    df = pd.read_excel(path, sheet_name=sheet, dtype=object).dropna(how='all')
    df.columns = [ALIASES.get(str(c).strip().lower().replace(' ', '_'), str(c).strip().lower().replace(' ', '_')) for c in df.columns]
    if df.columns.duplicated().any():
        raise ValueError('Duplicate column names after normalization')
    required = {'sku', 'name', 'category', 'current_stock'}
    missing = required - set(df.columns)
    if missing: raise ValueError('Missing columns: ' + ', '.join(sorted(missing)))
    result, seen = [], set()
    for position, (_, row) in enumerate(df.iterrows(), start=2):
        def text(key, default=''):
            value = row.get(key, default)
            return default if pd.isna(value) else str(value).strip()
        def integer(key, default=None):
            value = row.get(key, default)
            if pd.isna(value): value = default
            try: number = float(value)
            except (ValueError, TypeError): raise ValueError(f'Excel row {position}: {key} must be a nonnegative integer')
            if not math.isfinite(number) or not number.is_integer() or not 0 <= number <= 1000000:
                raise ValueError(f'Excel row {position}: invalid {key}')
            return int(number)
        sku, name = text('sku'), text('name')
        category = CATEGORIES.get(text('category').lower())
        if not sku or len(sku)>100 or not name or len(name)>200 or not category:
            raise ValueError(f'Excel row {position}: invalid SKU, name or category')
        if sku in seen: raise ValueError(f'Excel row {position}: duplicate SKU {sku}')
        seen.add(sku)
        fabric, dimensions = text('fabric_type'), text('dimensions')
        if len(fabric)>200 or len(dimensions)>200: raise ValueError(f'Excel row {position}: attribute too long')
        result.append(dict(sku=sku, name=name, category=category, fabric_type=fabric, dimensions=dimensions, current_stock=integer('current_stock'), reorder_level=integer('reorder_level',5)))
    if not result or len(result)>5000: raise ValueError('Sheet must contain 1–5000 products')
    return result

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file', type=Path)
    parser.add_argument('--sheet', help='Sheet name; defaults to the first sheet')
    parser.add_argument('--api', default='http://127.0.0.1:3001')
    parser.add_argument('--dry-run', action='store_true', help='Print validated JSON without importing')
    args = parser.parse_args()
    try:
        payload = {'products': clean_inventory(args.file, args.sheet or 0)}
        if args.dry_run: print(json.dumps(payload, indent=2, ensure_ascii=False)); return
        request = urllib.request.Request(args.api.rstrip('/')+'/api/products/import', data=json.dumps(payload).encode(), headers={'Content-Type':'application/json'}, method='POST')
        with urllib.request.urlopen(request, timeout=15) as response: print(response.read().decode())
    except urllib.error.HTTPError as error:
        print(f'Import rejected ({error.code}): {error.read().decode()}', file=sys.stderr); sys.exit(1)
    except (ValueError, OSError, urllib.error.URLError) as error:
        print(f'Import failed: {error}', file=sys.stderr); sys.exit(1)
if __name__ == '__main__': main()
