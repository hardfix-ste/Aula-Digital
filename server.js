require('dotenv').config();
const express=require('express'),Database=require('better-sqlite3'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken');
const db=new Database(process.env.DB_PATH||'data.db'),SECRET=process.env.JWT_SECRET||'cambiar-esto';
db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,username TEXT UNIQUE,pass TEXT,name TEXT,role TEXT DEFAULT 'docente');
CREATE TABLE IF NOT EXISTS students(id INTEGER PRIMARY KEY,name TEXT,dni TEXT,course TEXT,allergies TEXT,adaptations TEXT,history TEXT);
CREATE TABLE IF NOT EXISTS attendance(student_id INT,date TEXT,status TEXT,note TEXT,PRIMARY KEY(student_id,date));
CREATE TABLE IF NOT EXISTS grades(id INTEGER PRIMARY KEY,student_id INT,subject TEXT,title TEXT,value TEXT,scale TEXT);
CREATE TABLE IF NOT EXISTS schedule(id INTEGER PRIMARY KEY,teacher_id INT,subject TEXT,course TEXT,day INT,slot INT);
CREATE TABLE IF NOT EXISTS materials(id INTEGER PRIMARY KEY,user_id INT,title TEXT,type TEXT,content TEXT,created TEXT DEFAULT CURRENT_TIMESTAMP);`);
if(!db.prepare('SELECT 1 FROM users').get())
  db.prepare('INSERT INTO users(username,pass,name,role) VALUES(?,?,?,?)').run(process.env.ADMIN_USER||'admin',bcrypt.hashSync(process.env.ADMIN_PASS||'cambiar123',10),'Administrador','admin');
if(process.env.ADMIN_RESET==='1')db.prepare('UPDATE users SET pass=? WHERE username=?').run(bcrypt.hashSync(process.env.ADMIN_PASS||'cambiar123',10),process.env.ADMIN_USER||'admin');
const app=express();app.use(express.json({limit:'5mb'}));app.use(express.static('public'));
const wrap=f=>(q,s)=>{try{f(q,s)}catch(e){s.status(400).json({error:e.message})}};
const auth=(q,s,n)=>{try{q.user=jwt.verify((q.headers.authorization||'').slice(7),SECRET);n()}catch{s.status(401).json({error:'Sesión inválida'})}};
const admin=(q,s,n)=>q.user.role==='admin'?n():s.status(403).json({error:'Solo administrador'});
const CON={MB:10,B:8,R:6,I:4},num=v=>isNaN(+v)?(CON[String(v).toUpperCase()]??null):+v;
const avg=a=>{const n=a.map(g=>num(g.value)).filter(x=>x!=null);return n.length?+(n.reduce((x,y)=>x+y,0)/n.length).toFixed(2):null};

app.post('/api/login',wrap((q,s)=>{const u=db.prepare('SELECT * FROM users WHERE username=?').get(q.body.username);
  if(!u||!bcrypt.compareSync(q.body.password||'',u.pass))return s.status(401).json({error:'Usuario o contraseña incorrectos'});
  const user={id:u.id,username:u.username,name:u.name,role:u.role};s.json({token:jwt.sign(user,SECRET,{expiresIn:'12h'}),user})}));
app.use('/api',auth);
app.get('/api/me',(q,s)=>s.json(q.user));

// Usuarios (admin)
app.get('/api/users',(q,s)=>s.json(db.prepare('SELECT id,username,name,role FROM users').all()));
app.post('/api/users',admin,wrap((q,s)=>{const b=q.body;db.prepare('INSERT INTO users(username,pass,name,role) VALUES(?,?,?,?)').run(b.username,bcrypt.hashSync(b.password,10),b.name,b.role||'docente');s.json({ok:1})}));
app.put('/api/users/:id/password',admin,wrap((q,s)=>{db.prepare('UPDATE users SET pass=? WHERE id=?').run(bcrypt.hashSync(q.body.password,10),q.params.id);s.json({ok:1})}));
app.delete('/api/users/:id',admin,wrap((q,s)=>{if(+q.params.id===q.user.id)throw new Error('No podés borrarte');db.prepare('DELETE FROM users WHERE id=?').run(q.params.id);s.json({ok:1})}));

// Alumnos
app.get('/api/students',(q,s)=>s.json(db.prepare('SELECT * FROM students ORDER BY course,name').all()));
app.post('/api/students',wrap((q,s)=>{const st=db.prepare('INSERT INTO students(name,dni,course,allergies,adaptations,history) VALUES(?,?,?,?,?,?)');
  const rows=[].concat(q.body);db.transaction(()=>rows.forEach(r=>{if(!r.name)return;st.run(r.name,r.dni||'',r.course||'',r.allergies||'',r.adaptations||'',r.history||'')}))();s.json({ok:rows.length})}));
app.put('/api/students/:id',wrap((q,s)=>{const b=q.body;db.prepare('UPDATE students SET name=?,dni=?,course=?,allergies=?,adaptations=?,history=? WHERE id=?').run(b.name,b.dni,b.course,b.allergies,b.adaptations,b.history,q.params.id);s.json({ok:1})}));
app.delete('/api/students/:id',wrap((q,s)=>{db.prepare('DELETE FROM students WHERE id=?').run(q.params.id);s.json({ok:1})}));

// Asistencia
app.get('/api/attendance',(q,s)=>s.json(db.prepare(`SELECT s.id,s.name,a.status,a.note FROM students s LEFT JOIN attendance a ON a.student_id=s.id AND a.date=? WHERE s.course=? ORDER BY s.name`).all(q.query.date,q.query.course)));
app.post('/api/attendance',wrap((q,s)=>{const st=db.prepare('INSERT OR REPLACE INTO attendance VALUES(?,?,?,?)');
  db.transaction(()=>q.body.records.forEach(r=>r.status&&st.run(r.id,q.body.date,r.status,r.note||'')))();s.json({ok:1})}));

// Calificaciones
app.get('/api/gradebook',(q,s)=>{const {course,subject}=q.query;
  s.json(db.prepare('SELECT id,name FROM students WHERE course=? ORDER BY name').all(course).map(st=>{
    const grades=db.prepare('SELECT id,title,value,scale FROM grades WHERE student_id=? AND subject=?').all(st.id,subject);return{...st,grades,avg:avg(grades)}}))});
app.post('/api/grades',wrap((q,s)=>{const st=db.prepare('INSERT INTO grades(student_id,subject,title,value,scale) VALUES(?,?,?,?,?)');
  db.transaction(()=>q.body.grades.forEach(g=>g.value!==''&&st.run(g.student_id,q.body.subject,q.body.title,g.value,q.body.scale)))();s.json({ok:1})}));
app.delete('/api/grades/:id',wrap((q,s)=>{db.prepare('DELETE FROM grades WHERE id=?').run(q.params.id);s.json({ok:1})}));

// Horarios (sin superposición)
app.get('/api/schedule',(q,s)=>s.json(db.prepare('SELECT h.*,u.name teacher FROM schedule h JOIN users u ON u.id=h.teacher_id').all()));
app.post('/api/schedule',admin,wrap((q,s)=>{const b=q.body;
  if(db.prepare('SELECT 1 FROM schedule WHERE day=? AND slot=? AND teacher_id=?').get(b.day,b.slot,b.teacher_id))throw new Error('Ese docente ya tiene clase en ese horario');
  if(db.prepare('SELECT 1 FROM schedule WHERE day=? AND slot=? AND course=?').get(b.day,b.slot,b.course))throw new Error('Ese curso ya tiene materia en ese horario');
  db.prepare('INSERT INTO schedule(teacher_id,subject,course,day,slot) VALUES(?,?,?,?,?)').run(b.teacher_id,b.subject,b.course,b.day,b.slot);s.json({ok:1})}));
app.delete('/api/schedule/:id',admin,wrap((q,s)=>{db.prepare('DELETE FROM schedule WHERE id=?').run(q.params.id);s.json({ok:1})}));

// Materiales
app.get('/api/materials',(q,s)=>s.json(db.prepare('SELECT * FROM materials WHERE user_id=? ORDER BY id DESC').all(q.user.id)));
app.post('/api/materials',wrap((q,s)=>{const b=q.body;db.prepare('INSERT INTO materials(user_id,title,type,content) VALUES(?,?,?,?)').run(q.user.id,b.title,b.type,b.content);s.json({ok:1})}));
app.delete('/api/materials/:id',wrap((q,s)=>{db.prepare('DELETE FROM materials WHERE id=? AND user_id=?').run(q.params.id,q.user.id);s.json({ok:1})}));

// IA (la clave queda solo en el servidor)
const P={
 planificacion:i=>`Sos asesor pedagógico. Armá una planificación de clases detallada (fundamentación, objetivos, contenidos, secuencia de clases con actividades, recursos, evaluación) en español rioplatense para:\n${i}`,
 flashcards:i=>`Creá 15 flashcards (Frente / Dorso) en español sobre:\n${i}`,
 evaluacion:i=>`A partir de este programa/contenido, generá una evaluación con: 5 de opción múltiple, 3 de verdadero/falso justificado, 2 preguntas a desarrollar, clave de respuestas y criterios de corrección:\n${i}`,
 adaptacion:i=>`Adaptá el siguiente texto según lo pedido, conservando las ideas centrales. Al final agregá un mini glosario.\n${i}`};
app.post('/api/ai/:tool',wrap(async(q,s)=>{if(!process.env.ANTHROPIC_API_KEY)throw new Error('Falta ANTHROPIC_API_KEY en el servidor');
  if(!P[q.params.tool])throw new Error('Herramienta desconocida');
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},
   body:JSON.stringify({model:process.env.AI_MODEL||'claude-sonnet-4-6',max_tokens:3000,messages:[{role:'user',content:P[q.params.tool](q.body.input)}]})});
  const d=await r.json();if(!r.ok)throw new Error(d.error?.message||'Error de IA');s.json({text:d.content.map(c=>c.text||'').join('')})}));

// Alertas tempranas (reglas sobre notas + asistencia)
app.get('/api/risk',(q,s)=>{const out=[];
  for(const st of db.prepare('SELECT * FROM students').all()){
    const at=db.prepare('SELECT status FROM attendance WHERE student_id=?').all(st.id);
    const absent=at.length?(at.filter(a=>a.status==='A').length+.5*at.filter(a=>a.status==='T').length)/at.length:0;
    const a=avg(db.prepare('SELECT value FROM grades WHERE student_id=?').all(st.id));
    const f=[];if(absent>.2)f.push(`Inasistencias ${Math.round(absent*100)}%`);if(a!=null&&a<6)f.push(`Promedio ${a}`);
    if(f.length)out.push({id:st.id,name:st.name,course:st.course,level:f.length>1?'Alto':'Medio',factors:f})}
  s.json(out)});

// Dashboard
app.get('/api/dashboard',(q,s)=>s.json({
  students:db.prepare('SELECT COUNT(*) n FROM students').get().n,
  attendance:db.prepare(`SELECT s.course label,ROUND(100.0*SUM(a.status='P')/COUNT(*),1) value FROM attendance a JOIN students s ON s.id=a.student_id GROUP BY s.course`).all(),
  grades:db.prepare('SELECT g.subject label,g.value,g.scale FROM grades g').all().reduce((m,g)=>{const n=num(g.value);if(n!=null){(m[g.subject]=m[g.subject]||[]).push(n)}return m},{})}));
app.listen(process.env.PORT||3000,()=>{console.log('Usuario admin:',process.env.ADMIN_USER||'admin');console.log('Aula Digital en http://localhost:'+(process.env.PORT||3000))});
