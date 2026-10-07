"""Excel upload service; forwards validated products to the Express API."""
import os
import json
import tempfile
import urllib.request
import urllib.error
from pathlib import Path
from fastapi import FastAPI, File, UploadFile, HTTPException
from import_excel import clean_inventory

app = FastAPI(title='E-Depo Excel Import', version='1.0.0')

@app.get('/health')
def health():
    return {'status': 'ok'}

@app.post('/import')
def import_sheet(file: UploadFile = File(...)):
    if not (file.filename or '').lower().endswith('.xlsx'):
        raise HTTPException(400, 'Upload an .xlsx workbook')
    content = file.file.read(5 * 1024 * 1024 + 1)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(413, 'Workbook must be under 5 MB')
    try:
        with tempfile.TemporaryDirectory(prefix='edepo-import-') as directory:
            path = Path(directory) / 'inventory.xlsx'
            path.write_bytes(content)
            payload = {'products': clean_inventory(path)}
        request = urllib.request.Request(os.environ.get('EDEPO_API_URL', 'http://127.0.0.1:3001').rstrip('/')+'/api/products/import', data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'}, method='POST')
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as error:
        body = json.loads(error.read())
        raise HTTPException(error.code, body.get('error', 'Import rejected')) from error
    except urllib.error.URLError as error:
        raise HTTPException(503, 'Inventory API is unavailable') from error
    except Exception as error:
        raise HTTPException(400, f'Workbook could not be imported: {error}') from error
