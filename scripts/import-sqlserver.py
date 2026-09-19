"""Read the supplied UTF-16 SQL Server export without executing it or changing it."""
import re,json,sys
from pathlib import Path
root=Path(__file__).resolve().parent.parent
src=Path(sys.argv[1]) if len(sys.argv)>1 else root/'database/original/data.sql'
s=src.read_text(encoding='utf-16')
def split(s):
 out=[];buf='';quote=False;depth=0;i=0
 while i<len(s):
  c=s[i]
  if c=="'":
   if quote and i+1<len(s) and s[i+1]=="'":buf+="''";i+=2;continue
   quote=not quote
  if not quote:
   if c=='(':depth+=1
   if c==')':depth-=1
   if c==',' and depth==0:out.append(buf.strip());buf='';i+=1;continue
  buf+=c;i+=1
 out.append(buf.strip());return out
def val(v):
 if v=='NULL':return None
 if v.startswith('CAST('):return val(re.split(r' AS ',v[5:-1],flags=re.I)[0])
 if v.startswith("N'"):v=v[1:]
 if v.startswith("'"):return re.sub(r'(T\d\d:\d\d:\d\d)\.0+$',r'\1',v[1:-1].replace("''","'"))
 return float(v) if '.' in v else int(v)
schema={};data={}
for m in re.finditer(r'CREATE TABLE \[dbo\]\.\[(\w+)\]\((.*?)CONSTRAINT',s,re.S):
 table,body=m.groups();cols=[]
 for l in body.splitlines():
  c=re.match(r'\s*\[(\w+)\] \[(\w+)\](.*?)\s+(NOT NULL|NULL),?$',l)
  if c:
   name,typ,ext,nullable=c.groups();cols.append(dict(name=name,type=typ,detail=ext.strip(),nullable=nullable=='NULL',primary='IDENTITY' in ext))
 schema[table]={'columns':cols,'foreign_keys':[],'indexes':[],'checks':[]};data[table]=[]
for m in re.finditer(r'INSERT \[dbo\]\.\[(\w+)\] \((.*?)\) VALUES \((.*)\)',s):
 table,cols,values=m.groups();data[table].append(dict(zip(re.findall(r'\[(\w+)\]',cols),map(val,split(values)))))
for m in re.finditer(r'ALTER TABLE \[dbo\]\.\[(\w+)\].*?ADD  CONSTRAINT \[(\w+)\] FOREIGN KEY\(\[(\w+)\]\)\s*REFERENCES \[dbo\]\.\[(\w+)\] \(\[(\w+)\]\)',s):
 t,n,c,rt,rc=m.groups();schema[t]['foreign_keys'].append(dict(name=n,column=c,table=rt,reference=rc))
for m in re.finditer(r'ALTER TABLE \[dbo\]\.\[(\w+)\] ADD  CONSTRAINT \[(\w+)\] UNIQUE NONCLUSTERED\s*\((.*?)\)WITH',s,re.S):
 t,n,c=m.groups();schema[t]['indexes'].append(dict(name=n,unique=True,columns=re.findall(r'\[(\w+)\]',c)))
for m in re.finditer(r'CREATE (UNIQUE )?NONCLUSTERED INDEX \[(\w+)\] ON \[dbo\]\.\[(\w+)\]\s*\((.*?)\)\s*(?:WHERE.*?\n)?WITH',s,re.S):
 u,n,t,c=m.groups();schema[t]['indexes'].append(dict(name=n,unique=bool(u),columns=re.findall(r'\[(\w+)\]',c)))
for m in re.finditer(r'ALTER TABLE \[dbo\]\.\[(\w+)\].*?ADD  CONSTRAINT \[(\w+)\] CHECK  \((.*?)\)\n',s):
 t,n,c=m.groups();schema[t]['checks'].append(dict(name=n,sql=c))
(root/'database/imported-data.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
(root/'database/schema-inventory.json').write_text(json.dumps(schema,ensure_ascii=False,indent=2))
lines=['// Generated from data.sql. Original identifiers and relationships are preserved.','import { sqliteTable, integer, text, numeric, index, uniqueIndex, foreignKey, check } from "drizzle-orm/sqlite-core";','import { sql } from "drizzle-orm";']
for t,model in schema.items():
 lines.append(f'export const {t}: any = sqliteTable("{t}", {{')
 for c in model['columns']:
  typ=c['type'];fn='integer' if typ in ('bigint','smallint','int','bit') else 'numeric' if typ=='decimal' else 'text'
  f=f'{fn}("{c["name"]}")'
  if c['primary']:f+='.primaryKey({autoIncrement:true})'
  elif not c['nullable']:f+='.notNull()'
  lines.append(f'  {c["name"]}: {f},')
 lines.append('}, (t) => [')
 for fk in model['foreign_keys']:lines.append(f'  foreignKey({{name:"{fk["name"]}",columns:[t.{fk["column"]}],foreignColumns:[{fk["table"]}.{fk["reference"]}]}}),')
 for ix in model['indexes']:
  cols=','.join('t.'+c for c in ix['columns']);lines.append(f'  {"uniqueIndex" if ix["unique"] else "index"}("{ix["name"]}").on({cols}),')
 for ch in model['checks']:
  expr=re.sub(r'\[(\w+)\]',lambda m:'${t.'+m.group(1)+'}',ch['sql']).replace('isjson','json_valid')
  expr=re.sub(r"(?<![A-Za-z])N'","'",expr)
  lines.append('  check("'+ch['name']+'",sql`'+expr+'`),')
 lines.append(']);')
lines+=['export const AUTH_SESSIONS = sqliteTable("AUTH_SESSIONS", { token_hash:text().primaryKey(), user_id:integer().notNull().references(()=>USERS.user_id), expires_at:integer().notNull(), created_at:text().notNull() });','export const AUTH_ATTEMPTS = sqliteTable("AUTH_ATTEMPTS", { attempt_id:integer().primaryKey({autoIncrement:true}), identifier:text().notNull(), attempted_at:integer().notNull() },t=>[index("IX_AUTH_ATTEMPTS_identifier_time").on(t.identifier,t.attempted_at)]);','export const APP_SETUP = sqliteTable("APP_SETUP", { setup_id:integer().primaryKey(), completed_at:text().notNull() });']
(root/'db/schema.ts').write_text('\n'.join(lines))
md=['# Kiểm kê database gốc','SQL Server 2019, compatibility level 150; 12 bảng; 2 view. Tệp gốc UTF-16 được giữ nguyên.','']
for t,m in schema.items():
 md+=['## '+t, f'{len(data[t])} bản ghi trong tệp gốc.', '| Cột | Kiểu SQL Server | Cho NULL | PK |','|---|---|---|---|']
 for c in m['columns']:md.append(f'| {c["name"]} | {c["type"]} {c["detail"]} | {c["nullable"]} | {c["primary"]} |')
 md+=['','Khóa ngoại: '+('; '.join(f'{f["column"]} → {f["table"]}.{f["reference"]}' for f in m['foreign_keys']) or 'Không có'),'', 'Index: '+('; '.join(f'{i["name"]} ({", ".join(i["columns"])})' for i in m['indexes']) or 'PK'), '']
(root/'docs/DATABASE.md').write_text('\n'.join(md))
print(json.dumps({t:{'columns':len(m['columns']),'rows':len(data[t]),'foreign_keys':len(m['foreign_keys']),'checks':len(m['checks'])} for t,m in schema.items()},indent=2))
