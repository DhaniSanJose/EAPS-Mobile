const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");

const attendanceQrDir = path.join(
  __dirname,
  "..",
  "uploads",
  "AttendanceQrCodes",
);
if (!fs.existsSync(attendanceQrDir))
  fs.mkdirSync(attendanceQrDir, { recursive: true });

async function ensureAttendanceQr(db, schedule_id, applicant_id) {
  const [[existing]] = await db.query(
    `SELECT qr_token FROM exam_attendance WHERE schedule_id = ? AND applicant_id = ? LIMIT 1`,
    [schedule_id, applicant_id],
  );

  let token = existing?.qr_token;
  if (!token) {
    token = crypto.randomBytes(20).toString("hex");
    await db.query(
      `INSERT INTO exam_attendance (schedule_id, applicant_id, qr_token, status)
       VALUES (?, ?, ?, 'not_arrived')
       ON DUPLICATE KEY UPDATE qr_token = qr_token`,
      [schedule_id, applicant_id, token],
    );
  }

  const qrFilename = `${applicant_id}_${schedule_id}_attendance.png`;
  const qrPath = path.join(attendanceQrDir, qrFilename);
  if (!fs.existsSync(qrPath)) {
    await QRCode.toFile(qrPath, token, { width: 300 });
  }

  return { token, qrPath, qrFilename };
}

module.exports = { ensureAttendanceQr };
