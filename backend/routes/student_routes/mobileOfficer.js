const express=require('express');const crypto=require('crypto');const {db3}=require('../database/database');
const {activePeriod,studentStatus,passedCourses,prerequisiteChecker}=require('./mobileEnrollmentRequests').services;
const router=express.Router();const prefix='/mobile/officer';
const remarks=['Prerequisite not passed','Schedule conflict','Section is full','Subject not offered this semester','Subject already passed','Maximum units exceeded','Subject outside the student’s curriculum','Required documents incomplete'];
const fail=(status,code,message)=>Object.assign(new Error(message),{status,code});
const error=(res,e)=>res.status(e.status||500).json({error:{code:e.status?e.code:'INTERNAL_ERROR',message:e.status?e.message:'Officer operation could not be completed.'}});
async function officer(connection,user){
 if(!['administrator','registrar'].includes(user?.role)||user.session_complete!==true||!user.employee_id)throw fail(403,'OFFICER_ONLY','A completed enrolling officer login is required.');
 const [rows]=await connection.query('SELECT u.id,u.employee_id,u.force_password_change,p.can_create,p.can_edit FROM user_accounts u JOIN page_access p ON p.user_id=u.employee_id AND p.page_id=102 AND p.page_privilege=1 WHERE u.employee_id=? AND u.role=? AND u.status=1',[user.employee_id,user.role]);
 if(rows.length!==1)throw fail(403,'OFFICER_PERMISSION_REQUIRED','Enrollment Officer Dashboard access is required.');
 if(Number(rows[0].force_password_change)===1)throw fail(403,'PASSWORD_CHANGE_REQUIRED','Change your password in EAPS before using the officer dashboard.');
 return rows[0];
}
router.use(prefix,async(req,res,next)=>{try{req.officer=await officer(db3,req.user);next()}catch(e){error(res,e)}});
async function header(connection,id,actor,lock=false){
 const [rows]=await connection.query(`SELECT r.* FROM enrollment_requests r WHERE r.id=? AND EXISTS(SELECT 1 FROM curriculum_table c JOIN dprtmnt_curriculum_table dc ON dc.curriculum_id=c.curriculum_id JOIN registrar_scope_table scope ON scope.program_id=c.program_id AND scope.dprtmnt_id=dc.dprtmnt_id WHERE c.curriculum_id=r.curriculum_id AND scope.employee_id=?)${lock?' FOR UPDATE':''}`,[id,actor.employee_id]);
 if(rows.length!==1)throw fail(404,'REQUEST_NOT_FOUND','Request not found within your assigned scope.');return rows[0];
}
router.get(prefix+'/session',async(req,res)=>{try{res.json({can_approve:Number(req.officer.can_edit)===1,can_add:Number(req.officer.can_create)===1,period:await activePeriod(db3),remarks})}catch(e){error(res,e)}});
router.get(prefix+'/requests',async(req,res)=>{try{
 const period=await activePeriod(db3);const [requests]=await db3.query(`SELECT r.id,r.student_number,r.status,r.revision,r.submitted_at,CONCAT_WS(' ',p.first_name,NULLIF(p.middle_name,''),p.last_name,NULLIF(p.extension,'')) AS full_name,g.program_description FROM enrollment_requests r JOIN person_table p ON p.person_id=r.person_id JOIN curriculum_table c ON c.curriculum_id=r.curriculum_id JOIN program_table g ON g.program_id=c.program_id WHERE r.active_school_year_id=? AND EXISTS(SELECT 1 FROM dprtmnt_curriculum_table dc JOIN registrar_scope_table scope ON scope.dprtmnt_id=dc.dprtmnt_id AND scope.program_id=c.program_id WHERE dc.curriculum_id=c.curriculum_id AND scope.employee_id=?) ORDER BY FIELD(r.status,'PENDING','RETURNED','APPROVED','REJECTED'),r.submitted_at DESC LIMIT 200`,[period.id,req.officer.employee_id]);res.json({period,requests});
}catch(e){error(res,e)}});
router.get(prefix+'/requests/:id',async(req,res)=>{try{
 const request=await header(db3,req.params.id,req.officer);const period=await activePeriod(db3);
 const [items]=await db3.query('SELECT i.*,c.course_code,c.course_description,s.description AS section_description FROM enrollment_request_items i JOIN course_table c ON c.course_id=i.course_id LEFT JOIN dprtmnt_section_table d ON d.id=i.department_section_id LEFT JOIN section_table s ON s.id=d.section_id WHERE i.request_id=? ORDER BY i.id',[request.id]);
 const [profile]=await db3.query("SELECT CONCAT_WS(' ',first_name,NULLIF(middle_name,''),last_name,NULLIF(extension,'')) AS full_name FROM person_table WHERE person_id=?",[request.person_id]);
 const passed=await passedCourses(db3,request);const check=await prerequisiteChecker(db3,request.curriculum_id,passed);
 const [courses]=await db3.query('SELECT DISTINCT c.course_id,c.course_code,c.course_description,c.prereq,p.year_level_id FROM program_tagging_table p JOIN course_table c ON c.course_id=p.course_id WHERE p.curriculum_id=? AND p.semester_id=? ORDER BY p.year_level_id,c.course_code',[request.curriculum_id,period.semester_id]);
 const [meetings]=await db3.query('SELECT t.course_id,t.department_section_id,t.room_day AS day_id,t.school_time_start AS start,t.school_time_end AS end,d.max_slots,s.description FROM time_table t JOIN dprtmnt_section_table d ON d.id=t.department_section_id JOIN section_table s ON s.id=d.section_id WHERE t.school_year_id=?',[period.id]);
 const [enrolled]=await db3.query('SELECT course_id FROM enrolled_subject WHERE student_number=? AND active_school_year_id=?',[request.student_number,period.id]);const official=new Set(enrolled.map(r=>Number(r.course_id)));
 const offerings=courses.filter(c=>!passed.has(Number(c.course_id))&&!official.has(Number(c.course_id))).map(c=>{const sections=new Map();for(const m of meetings.filter(m=>Number(m.course_id)===Number(c.course_id))){if(!sections.has(m.department_section_id))sections.set(m.department_section_id,{department_section_id:m.department_section_id,description:m.description,meetings:[]});sections.get(m.department_section_id).meetings.push({day_id:m.day_id,start:m.start,end:m.end})}return {...c,...check(c),sections:[...sections.values()]}});
 for(const item of items){item.unmet_prerequisites=JSON.parse(item.unmet_prerequisites_json||'[]');item.meetings=meetings.filter(m=>Number(m.course_id)===Number(item.course_id)&&Number(m.department_section_id)===Number(item.department_section_id));}
 res.json({request:{...request,full_name:profile[0]?.full_name,items},period,offerings,can_approve:Number(req.officer.can_edit)===1,can_add:Number(req.officer.can_create)===1,remarks});
}catch(e){error(res,e)}});
router.post(prefix+'/requests/:id/decision',async(req,res)=>{
 let connection,locked=false,inTransaction=false,lockName;
 try{
  if(Number(req.officer.can_edit)!==1)throw fail(403,'EDIT_PERMISSION_REQUIRED','Edit permission on the Enrollment Officer Dashboard is required.');
  if(!Number.isInteger(req.body.revision)||!Array.isArray(req.body.approve)||req.body.approve.length>100)throw fail(422,'INVALID_DECISION','A request revision and up to 100 selected subjects are required.');
  const selected=req.body.approve.map(i=>({course_id:Number(i.course_id),department_section_id:Number(i.department_section_id)})).sort((a,b)=>a.course_id-b.course_id);
  if(selected.some(i=>!Number.isSafeInteger(i.course_id)||i.course_id<1||!Number.isSafeInteger(i.department_section_id)||i.department_section_id<1)||new Set(selected.map(i=>i.course_id)).size!==selected.length)throw fail(422,'INVALID_SELECTION','Select each subject once with a valid section.');
  const key=String(req.headers['idempotency-key']||'');if(!/^[0-9a-f-]{36}$/i.test(key))throw fail(422,'INVALID_KEY','A submission key is required.');
  const reason=req.body.return_reason==='Others'?String(req.body.other_reason||'').trim():req.body.return_reason;
  if(reason && (reason.length>1000 || (req.body.return_reason!=='Others'&&!remarks.includes(reason))))throw fail(422,'INVALID_REMARK','Choose a remark or enter up to 1000 characters for Others.');
  const hash=crypto.createHash('sha256').update(JSON.stringify({revision:req.body.revision,selected,reason,exceptions:req.body.approve_exceptions===true,actor:req.officer.id})).digest('hex');
  const initial=await header(db3,req.params.id,req.officer);connection=await db3.getConnection();await connection.query("SET time_zone='+00:00'");
  lockName='enroll-request:'+crypto.createHash('sha256').update(initial.student_number+':'+initial.active_school_year_id).digest('hex').slice(0,40);
  const [[lock]]=await connection.query('SELECT GET_LOCK(?,5) AS acquired',[lockName]);if(Number(lock.acquired)!==1)throw fail(409,'REQUEST_BUSY','Retry the decision.');locked=true;
  await connection.beginTransaction();inTransaction=true;const actor=await officer(connection,req.user);if(Number(actor.can_edit)!==1)throw fail(403,'EDIT_PERMISSION_REQUIRED','Edit permission is required.');
  const r=await header(connection,req.params.id,actor,true);
  const [replay]=await connection.query('SELECT operation_hash,snapshot_json FROM enrollment_request_events WHERE request_id=? AND operation_key=?',[r.id,key]);if(replay.length){if(replay[0].operation_hash!==hash)throw fail(409,'KEY_CONFLICT','This key belongs to another decision.');await connection.commit();inTransaction=false;return res.json(JSON.parse(replay[0].snapshot_json).response)}
  const period=await activePeriod(connection,true);if(Number(r.active_school_year_id)!==Number(period.id))throw fail(409,'PERIOD_CHANGED','This request is outside the active enrollment period.');
  if(r.status!=='PENDING'||r.revision!==req.body.revision)throw fail(409,'STALE_REQUEST','This request has changed or is no longer pending. Refresh it.');
  const status=await studentStatus(connection,r,period,true);if(Number(status.active_curriculum)!==Number(r.curriculum_id))throw fail(409,'CURRICULUM_CHANGED','The student curriculum has changed. Return or resolve the request first.');
  const [items]=await connection.query('SELECT * FROM enrollment_request_items WHERE request_id=? FOR UPDATE',[r.id]);const pending=items.filter(i=>i.decision_status!=='APPROVED');
  const chosen=new Set(selected.map(i=>i.course_id));const returned=pending.filter(i=>!chosen.has(Number(i.course_id)));if(returned.length&&!reason)throw fail(422,'RETURN_REMARK_REQUIRED','A remark is required for subjects that are not approved.');
  const passed=await passedCourses(connection,r);const check=await prerequisiteChecker(connection,r.curriculum_id,passed);
  for(const item of selected){
   const existing=items.find(i=>Number(i.course_id)===item.course_id);if(existing?.decision_status==='APPROVED')throw fail(409,'SUBJECT_APPROVED','A selected subject was already approved.');
   if(!existing&&Number(actor.can_create)!==1)throw fail(403,'CREATE_PERMISSION_REQUIRED','Create permission is required to add subjects.');
   if(passed.has(item.course_id))throw fail(422,'SUBJECT_PASSED','A selected subject has already been passed.');
   const [valid]=await connection.query('SELECT DISTINCT c.course_id,c.prereq,d.id,d.max_slots FROM program_tagging_table p JOIN course_table c ON c.course_id=p.course_id JOIN time_table t ON t.course_id=c.course_id AND t.school_year_id=? JOIN dprtmnt_section_table d ON d.id=t.department_section_id WHERE p.curriculum_id=? AND p.semester_id=? AND c.course_id=? AND d.id=? FOR UPDATE',[period.id,r.curriculum_id,period.semester_id,item.course_id,item.department_section_id]);
   if(!valid.length)throw fail(422,'INVALID_OFFERING','A selected subject or section has no schedule for this period.');const eligibility=check(valid[0]);
   if(!eligibility.prerequisites_met&&req.body.approve_exceptions!==true)throw fail(422,'EXCEPTION_REVIEW_REQUIRED','Explicitly approve the prerequisite exceptions before enrolling these subjects.');
   const [[duplicate]]=await connection.query('SELECT COUNT(*) AS count FROM enrolled_subject WHERE student_number=? AND active_school_year_id=? AND course_id=?',[r.student_number,period.id,item.course_id]);if(duplicate.count)throw fail(409,'SUBJECT_ENROLLED','A selected subject is already officially enrolled.');
   const [[occupancy]]=await connection.query('SELECT COUNT(*) AS count FROM enrolled_subject WHERE active_school_year_id=? AND course_id=? AND department_section_id=?',[period.id,item.course_id,item.department_section_id]);if(Number(valid[0].max_slots)>0&&Number(occupancy.count)>=Number(valid[0].max_slots))throw fail(409,'SECTION_FULL','A selected section is full.');
   await connection.query('INSERT INTO enrolled_subject (course_id,student_number,active_school_year_id,curriculum_id,department_section_id,status) VALUES (?,?,?,?,?,1)',[item.course_id,r.student_number,period.id,r.curriculum_id,item.department_section_id]);
   if(existing)await connection.query("UPDATE enrollment_request_items SET department_section_id=?,decision_status='APPROVED',officer_remark=?,decided_by_account_id=?,decided_at=UTC_TIMESTAMP() WHERE id=?",[item.department_section_id,eligibility.prerequisites_met?null:'Prerequisite exception approved by enrolling officer',actor.id,existing.id]);
   else await connection.query("INSERT INTO enrollment_request_items (request_id,course_id,department_section_id,exception_requested,unmet_prerequisites_json,decision_status,officer_remark,decided_by_account_id,decided_at,added_by_officer) VALUES (?,?,?,?,?,'APPROVED',?,?,UTC_TIMESTAMP(),1)",[r.id,item.course_id,item.department_section_id,eligibility.prerequisites_met?0:1,JSON.stringify(eligibility.unmet_prerequisites),eligibility.prerequisites_met?null:'Prerequisite exception approved by enrolling officer',actor.id]);
  }
  for(const item of returned)await connection.query("UPDATE enrollment_request_items SET decision_status='RETURNED',officer_remark=?,decided_by_account_id=?,decided_at=UTC_TIMESTAMP() WHERE id=?",[reason,actor.id,item.id]);
  if(selected.length){await connection.query('UPDATE student_status_table SET enrolled_status=1 WHERE student_number=? AND active_school_year_id=?',[r.student_number,period.id]);const [[number]]=await connection.query('SELECT id FROM student_numbering_table WHERE student_number=? AND person_id=?',[r.student_number,r.person_id]);if(!number)throw fail(409,'IDENTITY_CHANGED','Student identity needs review.');await connection.query('INSERT INTO student_curriculum_table (student_numbering_id,curriculum_id) SELECT ?,? WHERE NOT EXISTS(SELECT 1 FROM student_curriculum_table WHERE student_numbering_id=? AND curriculum_id=?)',[number.id,r.curriculum_id,number.id,r.curriculum_id]);}
  const outcome=returned.length?'RETURNED':'APPROVED';const response={request_id:r.id,status:outcome,approved_count:selected.length,returned_count:returned.length,revision:r.revision+1};
  await connection.query('UPDATE enrollment_requests SET status=?,revision=revision+1,decision_reason=?,decided_by_account_id=?,decided_at=UTC_TIMESTAMP() WHERE id=?',[outcome,returned.length?reason:null,actor.id,r.id]);
  const [snapshot]=await connection.query('SELECT * FROM enrollment_request_items WHERE request_id=? ORDER BY id',[r.id]);
  await connection.query('INSERT INTO enrollment_request_events (request_id,revision,event_type,actor_account_id,actor_role,operation_key,operation_hash,reason,snapshot_json) VALUES (?,?,?,?,?,?,?,?,?)',[r.id,response.revision,outcome,actor.id,req.user.role,key,hash,reason||null,JSON.stringify({response,items:snapshot})]);
  await connection.commit();inTransaction=false;res.json(response);
 }catch(e){if(inTransaction)await connection.rollback().catch(()=>{});error(res,e)}finally{if(connection){if(locked)await connection.query('SELECT RELEASE_LOCK(?)',[lockName]).catch(()=>{});connection.release()}}
});
module.exports=router;
