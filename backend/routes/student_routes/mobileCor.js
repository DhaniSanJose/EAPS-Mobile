const express=require('express');const {db3}=require('../database/database');
const {activePeriod,studentStatus}=require('./mobileEnrollmentRequests').services;
const {renderStudentCorPdf}=require('../system_routes/corExportingRoute');
const router=express.Router();
const fail=(status,code,message)=>Object.assign(new Error(message),{status,code});
const sendError=(res,e)=>res.status(e.status||500).json({error:{code:e.status?e.code:'COR_GENERATION_FAILED',message:e.status?e.message:'The standard COR could not be generated. Please contact enrollment staff.'}});
async function readiness(req){
 const period=await activePeriod(db3);
 if(Number(req.query.active_school_year_id)!==Number(period.id))throw fail(409,'PERIOD_CHANGED','Refresh the active enrollment period.');
 const status=await studentStatus(db3,req.student,period);
 let reason=null;
 const [requests]=await db3.query('SELECT status FROM enrollment_requests WHERE person_id=? AND student_number=? AND active_school_year_id=?',[req.student.person_id,req.student.student_number,period.id]);
 if(Number(status.enrolled_status)!==1)reason='Your enrollment has not been officially confirmed.';
 else if(requests.length && requests[0].status!=='APPROVED')reason='Your enrollment request still needs final officer processing.';
 const [[subjects]]=await db3.query('SELECT COUNT(*) AS count FROM enrolled_subject WHERE student_number=? AND active_school_year_id=?',[req.student.student_number,period.id]);
 if(!reason && !Number(subjects.count))reason='No official subjects are recorded for this period.';
 const [assessments]=await db3.query('SELECT id FROM unifast WHERE student_number=? AND active_school_year_id=? AND status=1 UNION ALL SELECT id FROM matriculation WHERE student_number=? AND active_school_year_id=? AND status=1',[req.student.student_number,period.id,req.student.student_number,period.id]);
 if(!reason && !assessments.length)reason='Your school must complete the existing assessment processing before your COR is available.';
 return {period,cor_available:!reason,reason,subject_count:Number(subjects.count),file_name:`${req.student.student_number}_Certificate_Of_Registration.pdf`};
}
// Mounted under the mobile student router after its complete-session and ownership guard.
router.get('/cor/status',async(req,res)=>{try{res.set('Cache-Control','no-store');res.json(await readiness(req));}catch(e){sendError(res,e)}});
router.get('/cor/pdf',async(req,res)=>{
 try{
  const ready=await readiness(req);if(!ready.cor_available)throw fail(409,'COR_NOT_READY',ready.reason);
  const backendOrigin=`http://127.0.0.1:${Number(process.env.PORT)||5000}`;
  const response=await fetch(backendOrigin+'/api/student-tagging',{method:'POST',headers:{Authorization:req.headers.authorization,'Content-Type':'application/json'},body:JSON.stringify({studentNumber:req.student.student_number,active_school_year_id:ready.period.id}),signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw fail(502,'COR_DATA_UNAVAILABLE','The web COR data could not be loaded.');const preload=await response.json();
  if(String(preload.student_number??preload.studentNumber)!==String(req.student.student_number)||Number(preload.active_school_year_id)!==Number(ready.period.id))throw fail(409,'COR_DATA_MISMATCH','The COR identity or enrollment period does not match.');
  const frontendOrigin=process.env.COR_FRONTEND_URL||process.env.FRONTEND_URL||'http://localhost:5173';
  const origin=new URL(frontendOrigin);if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password)throw fail(503,'COR_RENDERER_CONFIGURATION','The school COR rendering service is not configured.');
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  const pdf=await renderStudentCorPdf({origin:origin.origin,backendOrigin,token,student:{student_number:req.student.student_number,person_id:req.student.person_id,active_school_year_id:ready.period.id,preload},expectedSubjects:ready.subject_count});
  const after=await readiness(req);if(!after.cor_available||after.period.id!==ready.period.id)throw fail(409,'COR_CHANGED','Enrollment processing changed. Refresh and try again.');
  res.set({'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${pdf.name.replace(/["\r\n]/g,'_')}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.send(pdf.data);
 }catch(e){sendError(res,e)}
});
module.exports=router;router.readiness=readiness;
