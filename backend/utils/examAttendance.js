const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");

const attendanceQrRoot = path.join(
  __dirname,
  "..",
  "uploads",
  "AttendanceQrCodes",
);
if (!fs.existsSync(attendanceQrRoot))
  fs.mkdirSync(attendanceQrRoot, { recursive: true });

// Looks up the branch's letter_code (e.g. "M" for Manila, "C" for Cavite)
// from company_settings.branches, so QR files/dirs stay distinguishable
// now that there's more than one campus.
async function getBranchLetterCode(db, campusId) {
  if (!campusId) return "X"; // fallback if no campus was passed in
  const [[row]] = await db.query(
    `SELECT branches FROM company_settings LIMIT 1`,
  );
  if (!row?.branches) return "X";

  let branches;
  try {
    branches =
      typeof row.branches === "string"
        ? JSON.parse(row.branches)
        : row.branches;
  } catch {
    return "X";
  }

  const match = (branches || []).find(
    (b) => String(b.id) === String(campusId) || b.branch === campusId,
  );
  return match?.letter_code || "X";
}

// campusId can be either the branch's numeric id or its name (e.g. "Manila") —
// whatever the caller already has on hand for the applicant.
async function ensureAttendanceQr(db, schedule_id, applicant_id, campusId) {
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

  const letterCode = await getBranchLetterCode(db, campusId);
  const campusDir = path.join(attendanceQrRoot, letterCode);
  if (!fs.existsSync(campusDir)) fs.mkdirSync(campusDir, { recursive: true });

  const qrFilename = `${letterCode}-${applicant_id}_${schedule_id}_attendance.png`;
  const qrPath = path.join(campusDir, qrFilename);
  if (!fs.existsSync(qrPath)) {
    await QRCode.toFile(qrPath, token, { width: 300 });
  }

  return { token, qrPath, qrFilename, campus: letterCode };
}

module.exports = { ensureAttendanceQr };