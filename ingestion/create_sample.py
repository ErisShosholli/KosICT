"""Generate a fictional workbook for the live import demonstration."""
from pathlib import Path
import pandas as pd
path=Path(__file__).resolve().parents[1]/'examples'/'sample-inventory.xlsx'
pd.DataFrame([
 {'SKU':'NUKA-THROW-45','Product Name':'Linen Throw Pillow','Category':'Living Space','Fabric':'Linen','Dimensions':'45 × 45 cm','Stock':9,'Reorder':3},
 {'SKU':'NUKA-KITCHEN-SET','Product Name':'Kitchen Textile Set','Category':'Decor','Fabric':'Cotton','Dimensions':'4-piece set','Stock':14,'Reorder':5}
]).to_excel(path,index=False)
print('Created',path)
