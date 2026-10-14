const express = require('express');
const crypto = require('crypto');
const { db3 } = require('../database/database');
const { getGradeConversions, deriveRemarkAndStatusFromNumeric } = require('../../utils/gradeConversion');
const router = express.Router();
const prefix = '/mobile/enrollment';
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const positive = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const sendError = (res, e) => res.status(e.status || 500).json({ error: { code: e.code && e.status ? e.code : 'INTERNAL_ERROR', message: e.status ? e.message : 'Enrollment request could not be processed.' } });

router.use(prefix, async (req, res, next) => {
  try {
    if (req.user?.role !== 'student') throw fail(403, 'STUDENT_ONLY', 'Student access required.');
    if (req.user.session_complete !== true) throw fail(401, 'SESSION_INCOMPLETE', 'Log in again and complete authentication.');
    const [rows] = await db3.query(
      "SELECT u.id AS account_id,u.person_id,u.force_password_change,n.student_number FROM user_accounts u JOIN student_numbering_table n ON n.person_id=u.person_id WHERE u.person_id=? AND u.role='student' AND u.status=1",
      [req.user.person_id]);
    if (rows.length !== 1) throw fail(403, 'STUDENT_ACCOUNT_UNAVAILABLE', 'An active, unambiguous student account is required.');
    if (Number(rows[0].force_password_change) === 1) throw fail(403, 'PASSWORD_CHANGE_REQUIRED', 'Change your password first.');
    req.student = rows[0]; next();
  } catch (e) { sendError(res,e); }
});

async function activePeriod(connection, lock=false) {
  const [rows] = await connection.query('SELECT a.id,a.year_id,a.semester_id,y.year_description,s.semester_description FROM active_school_year_table a LEFT JOIN year_table y ON y.year_id=a.year_id LEFT JOIN semester_table s ON s.semester_id=a.semester_id WHERE a.astatus=1' + (lock ? ' LOCK IN SHARE MODE' : ''));
  if (rows.length !== 1) throw fail(409, 'ACTIVE_PERIOD_UNAVAILABLE', 'Exactly one active enrollment period must be configured.');
  return rows[0];
}
router.get(prefix+'/settings',async(req,res)=>{
  try{
    const [[row]]=await db3.query('SELECT totp_enabled FROM user_accounts WHERE id=?',[req.student.account_id]);
    res.json({authenticator_enabled:Number(row.totp_enabled)===1});
  }catch(e){sendError(res,e);}
});
router.patch(prefix+'/settings',async(req,res)=>{
  try{
    if(typeof req.body.authenticator_enabled!=='boolean')throw fail(422,'INVALID_SETTING','Authenticator setting must be true or false.');
    await db3.query('UPDATE user_accounts SET totp_enabled=? WHERE id=?',[req.body.authenticator_enabled?1:0,req.student.account_id]);
    res.json({authenticator_enabled:req.body.authenticator_enabled});
  }catch(e){sendError(res,e);}
});
async function studentStatus(connection, student, period, lock=false) {
  const [rows] = await connection.query('SELECT id,active_curriculum,year_level_id,enrolled_status FROM student_status_table WHERE student_number=? AND active_school_year_id=?' + (lock ? ' FOR UPDATE' : ''),[student.student_number,period.id]);
  if (rows.length !== 1 || !positive(rows[0].active_curriculum) || !positive(rows[0].year_level_id)) throw fail(409,'STUDENT_STATUS_UNAVAILABLE','Enrollment staff must resolve the student status for this period.');
  return rows[0];
}
async function requestDetail(connection, student, id) {
  const [rows] = await connection.query("SELECT id,active_school_year_id,curriculum_id,year_level_id,status,revision,DATE_FORMAT(submitted_at,'%Y-%m-%dT%H:%i:%sZ') AS submitted_at,decision_reason,DATE_FORMAT(decided_at,'%Y-%m-%dT%H:%i:%sZ') AS decided_at FROM enrollment_requests WHERE id=? AND person_id=? AND student_number=?",[id,student.person_id,student.student_number]);
  if (!rows.length) throw fail(404,'REQUEST_NOT_FOUND','Enrollment request not found.');
  const [items] = await connection.query('SELECT course_id,department_section_id,exception_requested,exception_reason,unmet_prerequisites_json,decision_status,officer_remark,added_by_officer FROM enrollment_request_items WHERE request_id=? ORDER BY course_id',[id]);
  for(const item of items){item.exception_requested=Number(item.exception_requested)===1;item.unmet_prerequisites=JSON.parse(item.unmet_prerequisites_json||'[]');delete item.unmet_prerequisites_json;}
  const [events] = await connection.query("SELECT revision,event_type,reason,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%sZ') AS created_at FROM enrollment_request_events WHERE request_id=? ORDER BY id",[id]);
  // COR integration is intentionally unavailable until owned, period-scoped rendering is implemented.
  return {...rows[0],items,events,cor_available:false};
}
async function passedCourses(connection, student) {
  const [grades]=await connection.query('SELECT course_id,final_grade,en_remarks FROM enrolled_subject WHERE student_number=?',[student.student_number]);
  const conversions=await getGradeConversions();
  return new Set(grades.filter(row=>{
    const grade=String(row.final_grade ?? '').trim();
    if(Number(row.en_remarks)===1) return true;
    if(!grade || !Number.isFinite(Number(grade))) return false;
    return deriveRemarkAndStatusFromNumeric(Number(grade),conversions).enRemark===1;
  }).map(row=>Number(row.course_id)));
}
async function prerequisiteChecker(connection, curriculumId, passed) {
  const [catalog]=await connection.query('SELECT DISTINCT c.course_id,c.course_code,c.prereq FROM course_table c JOIN program_tagging_table p ON p.course_id=c.course_id WHERE p.curriculum_id=?',[curriculumId]);
  const normalize=value=>String(value||'').trim().toUpperCase().replace(/\s+/g,' ');
  return course=>{
    const raw=String(course.prereq||'').trim();
    const codes=!raw || /^(NONE|N\/?A|NOT APPLICABLE|-|0)$/i.test(raw)?[]:raw.split(',').map(normalize).filter(Boolean);
    const unmet=codes.filter(code=>!catalog.some(c=>normalize(c.course_code)===code && passed.has(Number(c.course_id))));
    return {prerequisites:codes,unmet_prerequisites:unmet,prerequisites_met:unmet.length===0};
  };
}
router.get(prefix+'/context', async (req,res) => {
  try {
    const period=await activePeriod(db3); const status=await studentStatus(db3,req.student,period);
    const [profiles]=await db3.query('SELECT p.first_name,p.middle_name,p.last_name,p.extension,g.program_id,g.program_code,g.program_description FROM person_table p LEFT JOIN curriculum_table c ON c.curriculum_id=? LEFT JOIN program_table g ON g.program_id=c.program_id WHERE p.person_id=?',[status.active_curriculum,req.student.person_id]);
    if(profiles.length!==1) throw fail(409,'STUDENT_PROFILE_UNAVAILABLE','Enrollment staff must resolve the student profile.');
    const profile=profiles[0];
    const fullName=[profile.first_name,profile.middle_name,profile.last_name,profile.extension].map(value=>String(value||'').trim()).filter(Boolean).join(' ');
    const [requests]=await db3.query('SELECT id,status,revision,decision_reason FROM enrollment_requests WHERE student_number=? AND person_id=? AND active_school_year_id=?',[req.student.student_number,req.student.person_id,period.id]);
    res.json({student:{person_id:req.student.person_id,student_number:req.student.student_number,full_name:fullName,program_id:profile.program_id,program_code:profile.program_code,program_description:profile.program_description},period,curriculum_id:status.active_curriculum,year_level_id:status.year_level_id,officially_enrolled:Number(status.enrolled_status)===1,request:requests[0]||null});
  } catch(e){sendError(res,e);}
});
router.get(prefix+'/offerings', async(req,res)=>{
  try{
    const period=await activePeriod(db3);
    if (!positive(req.query.active_school_year_id) || Number(req.query.active_school_year_id)!==period.id) throw fail(409,'ACTIVE_PERIOD_CHANGED','Reload the active enrollment period.');
    const status=await studentStatus(db3,req.student,period);
    const passed=await passedCourses(db3,req.student);
    const checkPrerequisites=await prerequisiteChecker(db3,status.active_curriculum,passed);
    const [allCourses]=await db3.query('SELECT DISTINCT c.course_id,c.course_code,c.course_description,c.course_unit,c.lec_unit,c.lab_unit,c.prereq,c.corequisite,p.year_level_id,y.year_level_description,p.semester_id FROM program_tagging_table p JOIN course_table c ON c.course_id=p.course_id LEFT JOIN year_level_table y ON y.year_level_id=p.year_level_id WHERE p.curriculum_id=? AND p.semester_id=? ORDER BY p.year_level_id,c.course_code',[status.active_curriculum,period.semester_id]);
    const courses=allCourses.filter(course=>!passed.has(Number(course.course_id))).map(course=>({...course,...checkPrerequisites(course)}));
    const [meetings]=await db3.query('SELECT t.course_id,t.department_section_id,d.year_level_id,d.max_slots,s.description AS section_description,t.room_day,t.school_time_start,t.school_time_end,t.professor_id,t.department_room_id FROM time_table t JOIN dprtmnt_section_table d ON d.id=t.department_section_id JOIN section_table s ON s.id=d.section_id WHERE t.school_year_id=? ORDER BY t.course_id,t.department_section_id,t.id',[period.id]);
    const [counts]=await db3.query('SELECT course_id,department_section_id,COUNT(*) AS enrolled_count FROM enrolled_subject WHERE active_school_year_id=? GROUP BY course_id,department_section_id',[period.id]);
    const count=new Map(counts.map(r=>[r.course_id+':'+r.department_section_id,Number(r.enrolled_count)]));
    res.json({period,subjects:courses.map(c=>{const sections=new Map();for(const m of meetings.filter(m=>Number(m.course_id)===Number(c.course_id))){let section=sections.get(m.department_section_id);if(!section){const enrolled=count.get(c.course_id+':'+m.department_section_id)||0;section={department_section_id:m.department_section_id,description:m.section_description,max_slots:m.max_slots,enrolled_count:enrolled,available_slots:m.max_slots>0?Math.max(0,m.max_slots-enrolled):null,meetings:[]};sections.set(m.department_section_id,section);}section.meetings.push({day_id:m.room_day,start:m.school_time_start,end:m.school_time_end,professor_id:m.professor_id,department_room_id:m.department_room_id});}return {...c,eligibility:'OFFICER_REVIEW_REQUIRED',sections:[...sections.values()]};}),capacity_note:'Counts follow existing enrolled_subject rows; pending requests do not reserve slots. Academic eligibility is reviewed by the officer.'});
  }catch(e){sendError(res,e);}
});
router.get(prefix+'/requests/current',async(req,res)=>{
  try{
    if(!positive(req.query.active_school_year_id))throw fail(422,'INVALID_PERIOD','Academic period is required.');
    const [rows]=await db3.query('SELECT id FROM enrollment_requests WHERE person_id=? AND student_number=? AND active_school_year_id=?',[req.student.person_id,req.student.student_number,Number(req.query.active_school_year_id)]);
    res.json({request:rows.length?await requestDetail(db3,req.student,rows[0].id):null});
  }catch(e){sendError(res,e);}
});
router.get(prefix+'/requests/:id',async(req,res)=>{
  try{if(!positive(req.params.id))throw fail(404,'REQUEST_NOT_FOUND','Enrollment request not found.');res.json({request:await requestDetail(db3,req.student,Number(req.params.id))});}catch(e){sendError(res,e);}
});
router.post(prefix+'/requests',async(req,res)=>{
  let connection,locked=false,inTransaction=false;
  const periodId=Number(req.body.active_school_year_id);
  const key=String(req.headers['idempotency-key']||'').toLowerCase();
  const lockName='enroll-request:'+crypto.createHash('sha256').update(req.student.student_number+':'+periodId).digest('hex').slice(0,40);
  try{
    if(!positive(periodId)||!Number.isSafeInteger(req.body.expected_revision)||req.body.expected_revision<0||!Array.isArray(req.body.items)||!req.body.items.length||req.body.items.length>100)throw fail(422,'INVALID_REQUEST','Period, expected revision and 1–100 subject selections are required.');
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key))throw fail(422,'INVALID_IDEMPOTENCY_KEY','A UUID Idempotency-Key is required.');
    const items=req.body.items.map(i=>({course_id:Number(i?.course_id),department_section_id:Number(i?.department_section_id),exception_requested:i?.exception_requested===true,exception_reason:String(i?.exception_reason||'').trim()})).sort((a,b)=>a.course_id-b.course_id);
    if(items.some(i=>i.exception_reason.length>1000))throw fail(422,'INVALID_EXCEPTION_REASON','Exception reasons must be at most 1000 characters.');
    if(items.some(i=>!positive(i.course_id)||!positive(i.department_section_id))||new Set(items.map(i=>i.course_id)).size!==items.length)throw fail(422,'INVALID_SELECTION','Select each subject once with a valid section.');
    const hash=crypto.createHash('sha256').update(JSON.stringify({periodId,expected_revision:req.body.expected_revision,items})).digest('hex');
    connection=await db3.getConnection();
    await connection.query("SET time_zone = '+00:00'");
    const [[lock]]=await connection.query('SELECT GET_LOCK(?,5) AS acquired',[lockName]);
    if(Number(lock.acquired)!==1)throw fail(409,'REQUEST_BUSY','Retry this submission.');locked=true;
    await connection.beginTransaction();inTransaction=true;
    const [headers]=await connection.query('SELECT * FROM enrollment_requests WHERE student_number=? AND active_school_year_id=? FOR UPDATE',[req.student.student_number,periodId]);
    const header=headers[0];
    if(header && Number(header.person_id)!==Number(req.student.person_id))throw fail(409,'STUDENT_IDENTITY_CONFLICT','Enrollment staff must resolve this request identity.');
    if(header){const [events]=await connection.query('SELECT operation_hash,snapshot_json FROM enrollment_request_events WHERE request_id=? AND operation_key=?',[header.id,key]);if(events.length){if(events[0].operation_hash!==hash)throw fail(409,'IDEMPOTENCY_CONFLICT','This key was already used for another payload.');await connection.commit();inTransaction=false;return res.json(JSON.parse(events[0].snapshot_json).response);}}
    const period=await activePeriod(connection,true);
    if(period.id!==periodId)throw fail(409,'ACTIVE_PERIOD_CHANGED','Reload the active enrollment period.');
    const status=await studentStatus(connection,req.student,period,true);
    if(Number(status.enrolled_status)===1 && header?.status!=='RETURNED')throw fail(409,'ALREADY_ENROLLED','You are already enrolled for this period.');
    if(header && (header.status!=='RETURNED'||header.revision!==req.body.expected_revision))throw fail(409,'REQUEST_STATE_CONFLICT','This request cannot be edited or its revision has changed.');
    if(!header && req.body.expected_revision!==0)throw fail(409,'STALE_REVISION','Use revision zero for a new request.');
    const passed=await passedCourses(connection,req.student);
    const checkPrerequisites=await prerequisiteChecker(connection,status.active_curriculum,passed);
    for(const item of items){
      if(passed.has(item.course_id))throw fail(409,'SUBJECT_ALREADY_PASSED','A selected subject has already been passed. Refresh your subjects.');
      const [[course]]=await connection.query('SELECT course_id,prereq FROM course_table WHERE course_id=?',[item.course_id]);
      const eligibility=checkPrerequisites(course||{});
      if(!eligibility.prerequisites_met && (!item.exception_requested || !item.exception_reason))throw fail(422,'PREREQUISITE_EXCEPTION_REQUIRED','Request an exception and provide a reason for subjects with unmet prerequisites.');
      item.unmet_prerequisites=eligibility.unmet_prerequisites;
      const [valid]=await connection.query('SELECT DISTINCT p.course_id FROM program_tagging_table p JOIN time_table t ON t.course_id=p.course_id AND t.school_year_id=? JOIN dprtmnt_section_table d ON d.id=t.department_section_id JOIN section_table s ON s.id=d.section_id WHERE p.course_id=? AND p.curriculum_id=? AND p.semester_id=? AND d.id=?',[periodId,item.course_id,status.active_curriculum,period.semester_id,item.department_section_id]);
      if(!valid.length)throw fail(422,'INVALID_OFFERING','A selected subject/section has no scheduled offering in this curriculum and period.');
      const [existing]=await connection.query('SELECT id FROM enrolled_subject WHERE student_number=? AND active_school_year_id=? AND course_id=? LIMIT 1',[req.student.student_number,periodId,item.course_id]);
      if(existing.length)throw fail(409,'SUBJECT_ALREADY_ENROLLED','A selected subject is already in your official enrollment.');
    }
    const revision=header?header.revision+1:1;let id=header?.id;
    if(header){await connection.query("UPDATE enrollment_requests SET status='PENDING',revision=?,curriculum_id=?,year_level_id=?,submission_key=?,submission_hash=?,submitted_at=UTC_TIMESTAMP(),decided_by_account_id=NULL,decision_reason=NULL,decided_at=NULL WHERE id=?",[revision,status.active_curriculum,status.year_level_id,key,hash,id]);await connection.query("DELETE FROM enrollment_request_items WHERE request_id=? AND decision_status<>'APPROVED'",[id]);}
    else{const [result]=await connection.query('INSERT INTO enrollment_requests (person_id,student_number,active_school_year_id,curriculum_id,year_level_id,submission_key,submission_hash,submitted_at) VALUES (?,?,?,?,?,?,?,UTC_TIMESTAMP())',[req.student.person_id,req.student.student_number,periodId,status.active_curriculum,status.year_level_id,key,hash]);id=result.insertId;}
    for(const item of items)await connection.query('INSERT INTO enrollment_request_items (request_id,course_id,department_section_id,exception_requested,exception_reason,unmet_prerequisites_json) VALUES (?,?,?,?,?,?)',[id,item.course_id,item.department_section_id,item.exception_requested?1:0,item.exception_reason||null,JSON.stringify(item.unmet_prerequisites)]);
    const [[saved]]=await connection.query("SELECT DATE_FORMAT(submitted_at,'%Y-%m-%dT%H:%i:%sZ') AS submitted_at FROM enrollment_requests WHERE id=?",[id]);
    const response={request_id:id,revision,status:'PENDING',active_school_year_id:periodId,submitted_at:saved.submitted_at,items};
    await connection.query('INSERT INTO enrollment_request_events (request_id,revision,event_type,actor_account_id,actor_role,operation_key,operation_hash,snapshot_json) VALUES (?,?,?,?,?,?,?,?)',[id,revision,header?'RESUBMITTED':'SUBMITTED',req.student.account_id,'student',key,hash,JSON.stringify({response,curriculum_id:status.active_curriculum,year_level_id:status.year_level_id})]);
    await connection.commit();inTransaction=false;res.status(201).json(response);
  }catch(e){if(inTransaction)await connection.rollback().catch(()=>{});sendError(res,e);}
  finally{if(connection){if(locked)await connection.query('SELECT RELEASE_LOCK(?)',[lockName]).catch(()=>{});connection.release();}}
});
module.exports=router;
router.services={activePeriod,studentStatus,passedCourses,prerequisiteChecker,requestDetail};
