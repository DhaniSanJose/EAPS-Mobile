import React, { useState, useEffect, useContext } from "react";
import { SettingsContext } from "../App";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Snackbar,
  Alert,
  AlertTitle,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import axios from "axios";
import API_BASE_URL from "../apiConfig";
import EaristLogo from "../assets/EaristLogo.png";
import PersonIcon from "@mui/icons-material/Person";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import ClassIcon from "@mui/icons-material/Class";
import FilterNoneIcon from "@mui/icons-material/FilterNone";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

// ─── Remark Badge ─────────────────────────────────────────────────
const REMARK_MAP = {
  0: { label: "Ongoing", bg: "#E8F5E9", color: "#9e9c1e", border: "#807700" },
  1: { label: "Passed", bg: "#E8F5E9", color: "#2E7D32", border: "#A5D6A7" },
  2: { label: "Failed", bg: "#FFEBEE", color: "#C62828", border: "#EF9A9A" },
  3: { label: "Incomplete", bg: "#FFF8E1", color: "#E65100", border: "#FFE082" },
  4: { label: "Dropped", bg: "#F3F4F6", color: "#4B5563", border: "#D1D5DB" },
};

const RemarkBadge = ({ value }) => {
  const style = REMARK_MAP[value];
  if (!style) return <span style={{ color: "#9CA3AF", fontSize: 12 }}>—</span>;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        borderRadius: 6,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {style.label}
    </span>
  );
};

const getUnitDisplay = (row) => {
  const course = parseInt(row.course_unit) || 0;
  const lab = parseInt(row.lab_unit) || 0;
  if (course === 0 && lab === 0) return "—";
  if (course === 0) return lab;
  if (lab === 0) return course;
  return course + lab;
};

// ─── Term Sorting ─────────────────────────────────────────────────
const yearOrder = { "First Year": 1, "Second Year": 2, "Third Year": 3, "Fourth Year": 4, "Fifth Year": 5 };
const semesterOrder = { "First Semester": 1, "Second Semester": 2, "Summer": 3 };
const yearLabelMap = {
  "First Year": "1st Year", "Second Year": "2nd Year", "Third Year": "3rd Year",
  "Fourth Year": "4th Year", "Fifth Year": "5th Year",
};

const parseTerm = (term) => {
  const parts = String(term || "").split(" ");
  const yearLabel = parts.length >= 2 ? `${parts[0]} ${parts[1]}` : term;
  const semesterLabel = parts.slice(2).join(" ");
  return { yearLabel, semesterLabel };
};

const sortTerms = (terms) =>
  [...terms].sort((a, b) => {
    const tA = parseTerm(a); const tB = parseTerm(b);
    const yA = yearOrder[tA.yearLabel] || 0;
    const yB = yearOrder[tB.yearLabel] || 0;
    if (yA !== yB) return yB - yA;
    return (semesterOrder[tB.semesterLabel] || 0) - (semesterOrder[tA.semesterLabel] || 0);
  });

const formatYearLabel = (year) => yearLabelMap[year] || year;

const isMigratedGrade = (subject) => Number(subject?.is_migrated) === 1 || subject?.is_migrated === true;
const isEvaluatedGrade = (subject) => Number(subject?.fe_status) === 1;

const getAcademicTermKey = (subject) =>
  `${subject?.active_school_year_id || subject?.year_description || "N/A"}-${subject?.semester_id || subject?.semester_description || "N/A"}`;

const getTermSortValue = (subject) => {
  const schoolYear = Number(subject?.year_description) || 0;
  const semester = Number(subject?.semester_id) || semesterOrder[subject?.semester_description] || 0;
  const schoolYearId = Number(subject?.active_school_year_id) || 0;
  return (schoolYear * 10000) + (semester * 100) + schoolYearId;
};

const getLatestMigratedTermKey = (subjects) => {
  const latestMigratedSubject = subjects
    .filter(isMigratedGrade)
    .sort((a, b) => getTermSortValue(b) - getTermSortValue(a))[0];

  return latestMigratedSubject ? getAcademicTermKey(latestMigratedSubject) : null;
};

const canShowGrade = (subject, latestMigratedTermKey) => {
  if (isEvaluatedGrade(subject)) return true;
  if (!isMigratedGrade(subject)) return false;

  return getAcademicTermKey(subject) !== latestMigratedTermKey;
};

// ─── Mobile / Tablet Grade Card ────────────────────────────────────
const MobileGradeCard = ({
  row,
  index,
  borderColor,
  subtitleColor,
  titleColor,
}) => (
  <Box
    sx={{
      border: `1px solid ${borderColor}`,
      borderRadius: "8px",
      p: { xs: 1.25, sm: 1.5 },
      mb: 1.5,
      backgroundColor: index % 2 === 0 ? "#ffffff" : "lightgray",
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    }}
  >
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 0.5, gap: 1 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: { xs: 12.5, sm: 13 }, color: titleColor, mb: 0.2 }}>
          {row.course_code}
        </Typography>
        <Typography sx={{ fontSize: { xs: 11, sm: 11.5 }, color: subtitleColor, lineHeight: 1.3 }}>
          {row.course_description}
        </Typography>
      </Box>
      <Box sx={{ ml: 1, flexShrink: 0 }}>
        {row.numeric_grade
          ? <Typography sx={{ fontWeight: 700, fontSize: { xs: 15, sm: 16 }, color: titleColor }}>{row.numeric_grade}</Typography>
          : <Typography sx={{ color: "#9CA3AF", fontSize: 14 }}>—</Typography>
        }
      </Box>
    </Box>

    <Box sx={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", mt: 0.8, alignItems: "center" }}>
      {/* Professor */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
        <PersonOutlineIcon sx={{ fontSize: 13, color: "#000", flexShrink: 0 }} />
        <Typography sx={{ fontSize: 11, color: "#000", wordBreak: "break-word" }}>
          {row.fname === "TBA" && row.lname === "TBA" ? "TBA" : `Prof. ${row.fname} ${row.lname}`}
        </Typography>
      </Box>

      {/* Section */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <ClassIcon sx={{ fontSize: 13, color: "#000", flexShrink: 0 }} />
        <Typography sx={{ fontSize: 11, color: "#000" }}>
          {row.program_code}-{row.section_description}
        </Typography>
      </Box>

      {/* Units */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <FilterNoneIcon sx={{ fontSize: 13, color: "#000", flexShrink: 0 }} />
        <Typography sx={{ fontSize: 11, color: "#000" }}>
          {getUnitDisplay(row)} unit{getUnitDisplay(row) !== 1 ? "s" : ""}
        </Typography>
      </Box>

      {/* Schedule */}
      {row.schedule && (
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.5, width: "100%" }}>
          <AccessTimeIcon sx={{ fontSize: 13, color: "#000", mt: "1px", flexShrink: 0 }} />
          <Typography sx={{ fontSize: 11, color: "#000", whiteSpace: "pre-line", lineHeight: 1.5, wordBreak: "break-word" }}>
            {row.schedule}
          </Typography>
        </Box>
      )}

      <RemarkBadge value={row.en_remarks} />
    </Box>
  </Box>
);

// ─── Main Component ───────────────────────────────────────────────
const StudentGradingPage = () => {
  const settings = useContext(SettingsContext);
  const theme = useTheme();

  // Breakpoints:
  // - card layout for phones AND small/portrait tablets (< 900px)
  // - scrollable table layout for larger tablets (landscape) and desktop (>= 900px)
  const isCardLayout = useMediaQuery(theme.breakpoints.down("md"));
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));

  const [titleColor, setTitleColor] = useState("#000000");
  const [subtitleColor, setSubtitleColor] = useState("#555555");
  const [borderColor, setBorderColor] = useState("#e0e0e0");
  const [mainButtonColor, setMainButtonColor] = useState("#1976d2");
  const [fetchedLogo, setFetchedLogo] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [shortTerm, setShortTerm] = useState("");
  const [campusAddress, setCampusAddress] = useState("");

  useEffect(() => {
    if (!settings) return;
    if (settings.title_color) setTitleColor(settings.title_color);
    if (settings.subtitle_color) setSubtitleColor(settings.subtitle_color);
    if (settings.border_color) setBorderColor(settings.border_color);
    if (settings.main_button_color) setMainButtonColor(settings.main_button_color);
    if (settings.logo_url) setFetchedLogo(`${API_BASE_URL}${settings.logo_url}`);
    else setFetchedLogo(EaristLogo);
    if (settings.company_name) setCompanyName(settings.company_name);
    if (settings.short_term) setShortTerm(settings.short_term);
    if (settings.campus_address) setCampusAddress(settings.campus_address);
  }, [settings]);

  const [userID, setUserID] = useState("");
  const [userRole, setUserRole] = useState("");
  const [studentGrade, setStudentGrade] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [gradingActive, setGradingActive] = useState(false);
  const [matriculationBalanceInfo, setMatriculationBalanceInfo] = useState({ hasBalance: false, balance: 0 });

  useEffect(() => {
    const storedUser = localStorage.getItem("email");
    const storedRole = localStorage.getItem("role");
    const storedID = localStorage.getItem("person_id");
    if (storedUser && storedRole && storedID) {
      setUserRole(storedRole);
      setUserID(storedID);
      if (storedRole !== "student") { window.location.href = "/faculty_dashboard"; }
      else { fetchStudentGrade(storedID); }
    } else { window.location.href = "/login"; }
  }, []);

  const fetchMatriculationBalance = async (studentNumber) => {
    if (!studentNumber) return { hasBalance: false, balance: 0 };
    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/check-student-balance`, { student_number: studentNumber });
      const balance = Number(data?.balance || 0);
      return { hasBalance: Boolean(data?.hasBalance) && balance > 0, balance: Number.isFinite(balance) ? balance : 0 };
    } catch {
      return { hasBalance: false, balance: 0 };
    }
  };

  const hideGradeFields = (subject) => ({
    ...subject, final_grade: null, numeric_grade: null,
    descriptive_grade: null, en_remarks: null, gwa: null,
  });

  const fetchStudentGrade = async (id) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/student_grade/${id}`);
      const data = res.data;
      const balanceInfo = await fetchMatriculationBalance(data[0]?.student_number);
      setMatriculationBalanceInfo(balanceInfo);

      if (balanceInfo.hasBalance) { setStudentGrade(data.map(hideGradeFields)); return; }

      const latestMigratedTermKey = getLatestMigratedTermKey(data);
      const groupedByTerm = {};
      data.forEach((subj) => {
        const termKey = getAcademicTermKey(subj);
        if (!groupedByTerm[termKey]) groupedByTerm[termKey] = [];
        groupedByTerm[termKey].push(subj);
      });

      const processedGrades = Object.values(groupedByTerm).flatMap((termSubjects) => {
        const allReleased = termSubjects.every((s) => canShowGrade(s, latestMigratedTermKey));
        if (!allReleased) {
          return termSubjects.map((s) => ({
            ...s,
            final_grade: canShowGrade(s, latestMigratedTermKey) ? s.final_grade : null,
            numeric_grade: canShowGrade(s, latestMigratedTermKey) ? s.numeric_grade : null,
            descriptive_grade: canShowGrade(s, latestMigratedTermKey) ? s.descriptive_grade : null,
            en_remarks: canShowGrade(s, latestMigratedTermKey) ? s.en_remarks : null,
            gwa: canShowGrade(s, latestMigratedTermKey) ? s.gwa : null,
          }));
        }
        return termSubjects;
      });

      setStudentGrade(processedGrades);
    } catch (error) {
      console.error(error);
      setStudentGrade([]);
      setMatriculationBalanceInfo({ hasBalance: false, balance: 0 });
    } finally {
      setLoading(false);
    }
  };

  const fetchGradingStatus = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/grading_status`);
      if (res.data.status === 1) { setGradingActive(true); setMessage(""); }
      else { setGradingActive(false); setMessage("Grades are not available yet."); }
    } catch { setMessage("Error fetching grading status."); }
  };

  useEffect(() => { fetchGradingStatus(); }, []);

  useEffect(() => {
    if (matriculationBalanceInfo.hasBalance) { setMessage(""); return; }
    if (!gradingActive || studentGrade.length === 0) return;
    const latestMigratedTermKey = getLatestMigratedTermKey(studentGrade);
    const pending = studentGrade.filter((s) => !canShowGrade(s, latestMigratedTermKey)).length;
    if (pending > 0) setMessage(`Grades are available. Please evaluate all your professors. Remaining: ${pending}`);
    else setMessage("");
  }, [gradingActive, matriculationBalanceInfo.hasBalance, studentGrade]);

  // 🔒 Disable right-click + block DevTools shortcuts (properly scoped with cleanup,
  // 🔒 Disable right-click
  document.addEventListener("contextmenu", (e) => e.preventDefault());

  // 🔒 Block DevTools shortcuts + Ctrl+P silently
  document.addEventListener("keydown", (e) => {
    const isBlockedKey =
      e.key === "F12" ||
      e.key === "F11" ||
      (e.ctrlKey &&
        e.shiftKey &&
        (e.key.toLowerCase() === "i" || e.key.toLowerCase() === "j")) ||
      (e.ctrlKey && e.key.toLowerCase() === "u") ||
      (e.ctrlKey && e.key.toLowerCase() === "p");

    if (isBlockedKey) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  const rawTerms = [...new Set(studentGrade.map((row) => `${row.year_level_description} ${row.semester_description}`))];
  const sortedTerms = sortTerms(rawTerms);
  const headerBg = settings?.header_color || "#1976d2";
  const programInfo = studentGrade[0] || null;
  const formattedMatriculationBalance = matriculationBalanceInfo.balance.toLocaleString(undefined, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

  const headCell = {
    backgroundColor: headerBg, color: "#fff", fontWeight: 600,
    fontSize: 12, letterSpacing: "0.05em", textTransform: "uppercase",
    padding: "10px 14px", borderBottom: "none", whiteSpace: "nowrap",
  };
  const bodyCell = {
    fontSize: 13, padding: "10px 14px", color: "#1a1a1a",
    borderBottom: `1px solid ${borderColor}`, verticalAlign: "middle",
  };

  return (
    <Box sx={{
      minHeight: "calc(100vh - 150px)",
      overflowY: "auto",
      backgroundColor: "transparent",
      mt: 1,
      p: { xs: 1, sm: 2 },
    }}>

      {/* ── Snackbar ── */}
      <Snackbar
        open={!!message}
        autoHideDuration={4000}
        onClose={() => setMessage("")}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        sx={{ maxWidth: { xs: "94vw", sm: 480 }, left: "50%", transform: "translateX(-50%)" }}
      >
        <Alert onClose={() => setMessage("")} severity="warning" sx={{ width: "100%" }}>
          {message}
        </Alert>
      </Snackbar>

      {/* ── Page Header ── */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2.5, flexWrap: "wrap", gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" sx={{ fontWeight: "bold", color: titleColor, fontSize: { xs: "20px", sm: "26px", md: "32px", lg: "36px" }, lineHeight: 1.2 }}>
            STUDENT GRADES
          </Typography>
          {programInfo && (
            <Typography variant="body2" sx={{ color: subtitleColor, mt: "6px", fontSize: { xs: 12.5, sm: 15, md: 17 } }}>
              {programInfo.program_description} ({programInfo.program_code})
            </Typography>
          )}
        </Box>

        {/* Grading Status Pill */}
        <Box sx={{
          display: "inline-flex", alignItems: "center", gap: "6px",
          px: { xs: "10px", sm: "14px" }, py: "6px", borderRadius: "20px",
          fontSize: { xs: 11, sm: 12 }, fontWeight: 600, letterSpacing: "0.03em",
          backgroundColor: gradingActive ? "#E8F5E9" : "#FFF3E0",
          color: gradingActive ? "#2E7D32" : "#E65100",
          border: `1px solid ${gradingActive ? "#A5D6A7" : "#FFCC80"}`,
          flexShrink: 0, alignSelf: "flex-start", whiteSpace: "nowrap",
        }}>
          <Box sx={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: gradingActive ? "#43A047" : "#FB8C00", flexShrink: 0 }} />
          {gradingActive ? "Grades Available" : "Not Yet Available"}
        </Box>
      </Box>

      {/* ── Divider ── */}
      <Box sx={{ height: "1px", backgroundColor: borderColor, mb: 3 }} />

      {/* ── Info Alert ── */}
      <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{
        borderRadius: "12px", mt: 2,
        justifyContent: "center", alignItems: "center", textAlign: "center",
        fontSize: { xs: 12.5, sm: 14 },
        "& .MuiAlert-message": { width: "100%", textAlign: "center" },
        "& .MuiAlert-icon": { alignItems: "center" },
      }}>
        <AlertTitle sx={{ fontWeight: 600, textAlign: "center", fontSize: { xs: 14, sm: 16 } }}>Attention to All Students</AlertTitle>
        Viewing grades online through the <b>Student Information System</b> is strictly for personal use only.
        Students who need an official copy must submit a request at the Registrar's Office.
        <br /><br />
        Grades from previous school years were migrated from the old enrollment system and are still subject
        to checking and validation by the Registrar.
      </Alert>

      <br />

      {/* ── Balance Warning ── */}
      {matriculationBalanceInfo.hasBalance && (
        <Alert severity="warning" sx={{ borderRadius: "12px", mb: 3, fontSize: { xs: 12.5, sm: 14 } }}>
          <AlertTitle sx={{ fontWeight: 700 }}>Grades Hidden Due to Matriculation Balance</AlertTitle>
          Your grades are hidden because you still have a remaining matriculation balance of{" "}
          <b>{formattedMatriculationBalance}</b>. Please settle your balance to view your grades.
        </Alert>
      )}

      {/* ── Loading / Empty / Grade Tables ── */}
      {loading ? (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <Typography sx={{ color: subtitleColor, fontSize: 14 }}>Loading grades...</Typography>
        </Box>
      ) : studentGrade.length > 0 ? (
        sortedTerms.map((term, idx) => {
          const termSubjects = studentGrade
            .filter((row) => `${row.year_level_description} ${row.semester_description}` === term)
            .sort((a, b) => (a.course_code || "").localeCompare(b.course_code || ""));

          const yearLevel = termSubjects[0]?.year_level_description;
          const semesterLabel = termSubjects[0]?.semester_description;
          const gwaValue = termSubjects[0]?.gwa;
          const sectionDescription = termSubjects[0]?.section_description;

          return (
            <Box key={idx} sx={{ mb: 5 }}>

              {/* ── Student Info Card ── */}
              <Box sx={{
                display: "flex", alignItems: "flex-start",
                mb: 2, p: { xs: 1.25, sm: 1.75, md: 2 },
                borderRadius: "10px", backgroundColor: "#fff",
                border: `1px solid ${borderColor}`, boxShadow: 2,
                gap: { xs: 1, sm: 1.5 },
              }}>
                {/* Person icon */}
                <Box sx={{
                  width: { xs: 34, sm: 40 }, height: { xs: 34, sm: 40 }, borderRadius: "50%", flexShrink: 0,
                  backgroundColor: headerBg, display: "flex",
                  alignItems: "center", justifyContent: "center", color: "#fff",
                }}>
                  <PersonIcon fontSize="small" />
                </Box>

                {/* Accent bar */}
                <Box sx={{ width: 4, borderRadius: 2, backgroundColor: headerBg, flexShrink: 0, alignSelf: "stretch" }} />

                {/* Info — stacks vertically on mobile/tablet, side-by-side on larger screens */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {programInfo && (
                    <Box sx={{
                      display: "flex",
                      flexDirection: { xs: "column", lg: "row" },
                      justifyContent: "space-between",
                      gap: { xs: 0.5, lg: 0 },
                    }}>
                      {/* LEFT */}
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: { xs: 11.5, sm: 13, md: 14 }, fontWeight: 700, color: titleColor, wordBreak: "break-word" }}>
                          STUDENT NUMBER:{" "}
                          <Box component="span" sx={{ fontWeight: "normal", ml: "8px" }}>
                            {programInfo.student_number}
                          </Box>
                        </Typography>
                        <Typography sx={{ fontSize: { xs: 11.5, sm: 13, md: 14 }, fontWeight: 700, color: titleColor, wordBreak: "break-word" }}>
                          NAME:{" "}
                          <Box component="span" sx={{ fontWeight: "normal", ml: "8px" }}>
                            {programInfo.last_name}, {programInfo.first_name} {programInfo.middle_name}
                          </Box>
                        </Typography>
                        {gwaValue && (
                          <Typography sx={{ fontSize: { xs: 11.5, sm: 13, md: 14 }, fontWeight: 700, color: titleColor }}>
                            Weighted GWA:{" "}
                            <Box component="span" sx={{ fontWeight: "normal", ml: "8px", color: headerBg }}>
                              {Number(gwaValue).toFixed(3)}
                            </Box>
                          </Typography>
                        )}
                      </Box>

                      {/* RIGHT */}
                      <Box sx={{ textAlign: { xs: "left", lg: "right" }, minWidth: 0 }}>
                        <Typography sx={{ fontSize: { xs: 11.5, sm: 13, md: 14 }, fontWeight: 700, color: titleColor, wordBreak: "break-word" }}>
                          PROGRAM:{" "}
                          <Box component="span" sx={{ fontWeight: "normal", ml: "8px" }}>
                            ({programInfo.program_code}) {programInfo.program_description} {programInfo.major}
                          </Box>
                        </Typography>
                        <Typography sx={{ fontSize: { xs: 11.5, sm: 13, md: 14 }, fontWeight: 700, color: titleColor }}>
                          YEAR / SEMESTER:{" "}
                          <Box component="span" sx={{ fontWeight: "normal", ml: "8px" }}>
                            {formatYearLabel(yearLevel)} - {semesterLabel}
                          </Box>
                        </Typography>
                        <Typography sx={{ fontSize: { xs: 11.5, sm: 13, md: 14 }, fontWeight: 700, color: titleColor }}>
                          SECTION:{" "}
                          <Box component="span" sx={{ fontWeight: "normal", ml: "8px" }}>
                            {sectionDescription || "—"}
                          </Box>
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>

              {/* ── Mobile & small tablet: cards | Larger tablet/Desktop: scrollable table ── */}
              {isCardLayout ? (
                <Box>
                  {termSubjects.map((row, i) => (
                    <MobileGradeCard
                      key={i} row={row} index={i}
                      borderColor={borderColor}
                      subtitleColor={subtitleColor}
                      titleColor={titleColor}
                    />
                  ))}
                </Box>
              ) : (
                <TableContainer component={Paper} elevation={0} sx={{
                  border: `1px solid ${borderColor}`,
                  overflowX: "auto",
                  WebkitOverflowScrolling: "touch",
                }}>
                  <Table size="small" sx={{ minWidth: 860, tableLayout: "fixed" }}>
                    <TableHead>
                      <TableRow>
                        {[
                          { label: "#", width: "48px", align: "center" },
                          { label: "Code", width: "110px" },
                          { label: "Subject", width: undefined },
                          { label: "Faculty", width: "170px" },
                          { label: "Schedule", width: "170px", align: "center" },
                          { label: "Units", width: "64px", align: "center" },
                          { label: "Section", width: "100px", align: "center" },
                          { label: "Final Grade", width: "100px", align: "center" },
                          { label: "Status", width: "110px", align: "center" },
                        ].map(({ label, width, align }) => (
                          <TableCell key={label} sx={{ ...headCell, width, textAlign: align || "left", border: `1px solid ${borderColor}` }}>
                            {label}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {termSubjects.map((row, i) => (
                        <TableRow
                          key={i}
                          sx={{
                            backgroundColor: i % 2 === 0 ? "#ffffff" : "lightgray",
                            "&:hover": {
                              backgroundColor: i % 2 === 0 ? "#f5f5f5" : "lightgray",
                            },
                            "&:last-child td": {
                              borderBottom: "none",
                            },
                          }}
                        >
                          <TableCell sx={{ ...bodyCell, border: `1px solid ${borderColor}`, textAlign: "center", color: subtitleColor, fontSize: 12 }}>
                            {i + 1}
                          </TableCell>
                          <TableCell sx={{ ...bodyCell, border: `1px solid ${borderColor}`, fontWeight: 600, fontSize: 12, color: subtitleColor }}>
                            {row.course_code}
                          </TableCell>
                          <TableCell sx={{ ...bodyCell, border: `1px solid ${borderColor}`, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {row.course_description}
                          </TableCell>
                          <TableCell sx={{ ...bodyCell, border: `1px solid ${borderColor}`, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {row.fname === "TBA" && row.lname === "TBA"
                              ? <span style={{ color: "#9CA3AF", fontStyle: "italic" }}>TBA</span>
                              : `Prof. ${row.fname} ${row.lname}`}
                          </TableCell>
                          <TableCell sx={{ ...bodyCell, border: `1px solid ${borderColor}`, textAlign: "center", whiteSpace: "pre-line", fontSize: 12 }}>
                            {row.schedule || "—"}
                          </TableCell>
                          <TableCell sx={{ ...bodyCell, border: `1px solid ${borderColor}`, textAlign: "center", fontWeight: 500 }}>
                            {getUnitDisplay(row)}
                          </TableCell>
                          <TableCell sx={{ ...bodyCell, border: `1px solid ${borderColor}`, textAlign: "center" }}>
                            {row.section_description}
                          </TableCell>
                          <TableCell sx={{ ...bodyCell, border: `1px solid ${borderColor}`, textAlign: "center" }}>
                            {row.numeric_grade
                              ? <span style={{ fontWeight: 700, fontSize: 14, color: titleColor }}>{row.numeric_grade}</span>
                              : <span style={{ color: "#9CA3AF" }}>—</span>}
                          </TableCell>
                          <TableCell sx={{ ...bodyCell, border: `1px solid ${borderColor}`, textAlign: "center" }}>
                            <RemarkBadge value={row.en_remarks} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          );
        })
      ) : (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <Typography sx={{ color: subtitleColor, fontSize: 14 }}>No grades available.</Typography>
        </Box>
      )}
    </Box>
  );
};

export default StudentGradingPage;
