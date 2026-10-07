import unittest
import tempfile
from pathlib import Path
import pandas as pd
from import_excel import clean_inventory

class ImportTests(unittest.TestCase):
    def clean(self, rows):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'test.xlsx'
            pd.DataFrame(rows).to_excel(path,index=False)
            return clean_inventory(path)
    def test_normalization(self):
        result=self.clean([{' SKU ':' DEMO-1 ','Product Name':' Cotton Sheet ','Category':'Bedding & Comfort','Stock':'7','Fabric':' Cotton ','Dimensions':'200 × 220 cm'}])
        self.assertEqual(result[0]['sku'],'DEMO-1')
        self.assertEqual(result[0]['current_stock'],7)
        self.assertEqual(result[0]['reorder_level'],5)
        self.assertEqual(result[0]['category'],'bedding')
    def test_invalid_stock(self):
        for quantity in [-1,2.5,'oops',None]:
            with self.subTest(quantity=quantity), self.assertRaises(ValueError):
                self.clean([{'sku':'A','name':'Sheet','category':'bedding','stock':quantity}])
    def test_duplicate_sku(self):
        row={'sku':'A','name':'Sheet','category':'bedding','stock':1}
        with self.assertRaises(ValueError): self.clean([row,row])
    def test_missing_columns(self):
        with self.assertRaises(ValueError): self.clean([{'sku':'A'}])
if __name__=='__main__': unittest.main()
