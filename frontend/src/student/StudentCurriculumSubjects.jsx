import React, { useEffect, useState, useContext } from "react";
import { SettingsContext } from "../App";
import axios from "axios";
import API_BASE_URL from "../apiConfig";

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
  useMediaQuery,
  useTheme,
} from "@mui/material";

import SchoolIcon from "@mui/icons-material/School";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import ScienceIcon from "@mui/icons-material/Science";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

// ─── Term Sorting ─────────────────────────────────────────────────
const sortTerms = (terms) =>
  [...terms].sort((a, b) => {
    const getYear = (term) => {
      if (term.includes("First Year")) return 1;
      if (term.includes("Second Year")) return 2;
      if (term.includes("Third Year")) return 3;
      if (term.includes("Fourth Year")) return 4;
      if (term.includes("Fifth Year")) return 5;
      return 0;
    };
    const getSem = (term) => {
      if (term.includes("First Semester")) return 1;
      if (term.includes("Second Semester")) return 2;
      if (term.includes("Summer")) return 3;
      return 0;
    };
    const yearA = getYear(a); const yearB = getYear(b);
    if (yearA !== yearB) return yearB - yearA;
    return getSem(b) - getSem(a);
  });

const yearLabelMap = {
  "First Year": "1st Year", "Second Year": "2nd Year", "Third Year": "3rd Year",
  "Fourth Year": "4th Year", "Fifth Year": "5th Year",
};
const formatYearLabel = (year) => yearLabelMap[year] || year;
const formatAcademicYear = (year) => {
  if (!year) return "";
  if (typeof year === "string" && year.includes("-")) return year;
  const startYear = Number(year);
  if (isNaN(startYear)) return "";
  return `${startYear}-${startYear + 1}`;
};
const formatUnit = (value) => {
  if (value === null || value === undefined) return "0";
  const num = Number(value);
  if (isNaN(num)) return "0";
  return num.toString();
};

// ─── Mobile / tablet subject card ──────────────────────────────────
const MobileSubjectCard = ({ row, index, borderColor, titleColor, subtitleColor }) => (
  <Box
    sx={{
      border: `1px solid ${borderColor}`,
      borderRadius: "8px",
      p: { xs: 1.5, sm: 2 },
      mb: 1.5,
      backgroundColor: index % 2 === 0 ? "#ffffff" : "lightgray",
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    }}
  >
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 0.5 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: { xs: 13, sm: 14 }, color: titleColor, mb: 0.2 }}>
          {row.course_code}
        </Typography>
        <Typography sx={{ fontSize: { xs: 11.5, sm: 13 }, color: subtitleColor, lineHeight: 1.3 }}>
          {row.course_description}
        </Typography>
      </Box>
      {/* Units badge */}
      <Box sx={{
        ml: 1, flexShrink: 0, px: 1, py: 0.3,
        borderRadius: "6px", backgroundColor: "#f0f4ff",
        border: `1px solid #c7d4f0`, textAlign: "center",
      }}>
        <Typography sx={{ fontSize: { xs: 10, sm: 11 }, color: "#444", fontWeight: 600, lineHeight: 1.2 }}>
          {formatUnit(row.course_unit)} unit{formatUnit(row.course_unit) !== "1" ? "s" : ""}
        </Typography>
      </Box>
    </Box>

    <Box sx={{ display: "flex", flexWrap: "wrap", gap: "5px 14px", mt: 0.8 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <MenuBookIcon sx={{ fontSize: { xs: 13, sm: 15 }, color: "#000" }} />
        <Typography sx={{ fontSize: { xs: 11, sm: 12.5 }, color: "#000" }}>
          Lec: {formatUnit(row.lec_unit)}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <ScienceIcon sx={{ fontSize: { xs: 13, sm: 15 }, color: "#000" }} />
        <Typography sx={{ fontSize: { xs: 11, sm: 12.5 }, color: "#000" }}>
          Lab: {formatUnit(row.lab_unit)}
        </Typography>
      </Box>
      {row.schedule && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <AccessTimeIcon sx={{ fontSize: { xs: 13, sm: 15 }, color: "#000" }} />
          <Typography sx={{ fontSize: { xs: 11, sm: 12.5 }, color: "#000", whiteSpace: "pre-line" }}>
            {row.schedule}
          </Typography>
        </Box>
      )}
    </Box>
  </Box>
);

// ─── Main Component ───────────────────────────────────────────────
const StudentCurriculumSubjects = () => {
  const settings = useContext(SettingsContext);
  const theme = useTheme();
  // Card layout for phones + small/medium tablets, table layout from
  // tablet-landscape / small-laptop (md) up. Driven by MUI's breakpoint
  // system instead of a manual window.innerWidth resize listener, so it
  // stays in sync with every other responsive value on the page.
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [titleColor, setTitleColor] = useState("#000000");
  const [subtitleColor, setSubtitleColor] = useState("#555555");
  const [borderColor, setBorderColor] = useState("#000000");
  const [mainButtonColor, setMainButtonColor] = useState("#1976d2");

  useEffect(() => {
    if (!settings) return;
    if (settings.title_color) setTitleColor(settings.title_color);
    if (settings.subtitle_color) setSubtitleColor(settings.subtitle_color);
    if (settings.border_color) setBorderColor(settings.border_color);
    if (settings.main_button_color) setMainButtonColor(settings.main_button_color);
  }, [settings]);

  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const storedID = localStorage.getItem("person_id");
    if (!storedID) { window.location.href = "/login"; return; }
    fetchSubjects(storedID);
  }, []);

  const fetchSubjects = async (id) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/student/${id}/curriculum-subjects`);
      setSubjects(res.data);
    } catch (err) {
      console.error(err);
      setMessage("Failed to fetch curriculum subjects");
    } finally {
      setLoading(false);
    }
  };

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

  
  const rawTerms = [...new Set(subjects.map(
    (row) => `${row.year_level_description} ${row.semester_description}`
  ))];
  const sortedTerms = sortTerms(rawTerms);
  const headerBg = settings?.header_color || "#800000";
  const programInfo = subjects[0];

  const headCell = {
    backgroundColor: headerBg, color: "#fff", fontWeight: 600,
    fontSize: { md: 11, lg: 12 }, textTransform: "uppercase", border: `1px solid ${borderColor}`,
  };
  const colStyle = {
    border: `1px solid ${borderColor}`, fontSize: { md: 12, lg: 13 },
    wordWrap: "break-word", overflowWrap: "break-word", whiteSpace: "normal",
  };
  const bodyCell = { fontSize: { md: 12, lg: 13 }, border: `1px solid ${borderColor}` };

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography sx={{ fontSize: { xs: 14, sm: 16 } }}>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: { xs: "100vh", md: "calc(100vh - 150px)" },
        overflowY: { md: "auto" },
        backgroundColor: { xs: "#f5f5f5", md: "transparent" },
        mt: { md: 1 },
        p: { xs: 0, sm: 2 },
        pb: { xs: 6, sm: 2 },
      }}
    >
      {/* ── Page Header ── */}
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2, px: { xs: 1.5, sm: 0 }, pt: { xs: 2, sm: 0 } }}>
        {programInfo && (
          <Typography
            variant="h4"
            sx={{
              fontWeight: "bold", color: titleColor,
              fontSize: { xs: 15, sm: 20, md: 26, lg: 30 },
              lineHeight: 1.3,
            }}
          >
            CURRICULUM: ({programInfo.program_code}) — {programInfo.program_description}{" "}
            ({formatAcademicYear(programInfo.year_description)})
          </Typography>
        )}
      </Box>
      <Box sx={{ borderTop: "1px solid #ccc", width: "100%" }} />
      <Box sx={{ height: { xs: 16, sm: 20 } }} />

      {/* ── Term blocks ── */}
      <Box sx={{ px: { xs: 1.5, sm: 0 } }}>
        {sortedTerms.map((term, idx) => {
          const termSubjects = subjects
            .filter((row) => `${row.year_level_description} ${row.semester_description}` === term);
          const yearLevel = termSubjects[0]?.year_level_description;
          const semesterLabel = termSubjects[0]?.semester_description;
          const sectionDescription = termSubjects[0]?.section_description;

          const totalLec = termSubjects.reduce((sum, row) => sum + Number(row.lec_unit || 0), 0);
          const totalLab = termSubjects.reduce((sum, row) => sum + Number(row.lab_unit || 0), 0);
          const totalCourse = termSubjects.reduce((sum, row) => sum + Number(row.course_unit || 0), 0);

          return (
            <Box key={idx} sx={{ mb: 4 }}>

              {/* ── Student Info Card ── */}
              <Box sx={{
                display: "flex", alignItems: "flex-start",
                mb: 2, p: { xs: 1.5, sm: 2.5 },
                borderRadius: "10px", backgroundColor: "#fff",
                border: `1px solid ${borderColor}`, boxShadow: 2,
                gap: { xs: 1, sm: 3 },
              }}>
                {/* Icon */}
                <Box sx={{
                  width: { xs: 34, sm: 42, md: 48 }, height: { xs: 34, sm: 42, md: 48 },
                  borderRadius: "50%", backgroundColor: headerBg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", flexShrink: 0,
                }}>
                  <SchoolIcon sx={{ fontSize: { xs: 18, sm: 22, md: 24 } }} />
                </Box>

                {/* Accent bar */}
                <Box sx={{
                  width: 4, borderRadius: 2,
                  backgroundColor: headerBg, flexShrink: 0, alignSelf: "stretch",
                }} />

                {/* Info — stacks on mobile/tablet, side-by-side on desktop */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {programInfo && (
                    <Box sx={{
                      display: "flex",
                      flexDirection: { xs: "column", lg: "row" },
                      justifyContent: "space-between",
                      gap: { xs: 0.5, lg: 0 },
                    }}>
                      {/* LEFT */}
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                        <Typography sx={{ fontSize: { xs: 11.5, sm: 13, md: 14 }, fontWeight: 700, color: titleColor }}>
                          STUDENT NUMBER:{" "}
                          <Box component="span" sx={{ fontWeight: 400, ml: 1 }}>
                            {programInfo.student_number}
                          </Box>
                        </Typography>
                        <Typography sx={{ fontSize: { xs: 11.5, sm: 13, md: 14 }, fontWeight: 700, color: titleColor }}>
                          NAME:{" "}
                          <Box component="span" sx={{ fontWeight: 400, ml: 1 }}>
                            {programInfo.last_name}, {programInfo.first_name} {programInfo.middle_name}
                          </Box>
                        </Typography>
                      </Box>

                      {/* RIGHT */}
                      <Box sx={{
                        textAlign: { xs: "left", lg: "right" },
                        display: "flex", flexDirection: "column", gap: 0.5,
                      }}>
                        <Typography sx={{ fontSize: { xs: 11.5, sm: 13, md: 14 }, fontWeight: 700, color: titleColor }}>
                          PROGRAM:{" "}
                          <Box component="span" sx={{ fontWeight: 400, ml: 1 }}>
                            ({programInfo.program_code}) {programInfo.program_description} {programInfo.major}
                          </Box>
                        </Typography>
                        <Typography sx={{ fontSize: { xs: 11.5, sm: 13, md: 14 }, fontWeight: 700, color: titleColor }}>
                          YEAR / SEMESTER:{" "}
                          <Box component="span" sx={{ fontWeight: 400, ml: 1 }}>
                            {formatYearLabel(yearLevel)} — {semesterLabel}
                          </Box>
                        </Typography>
                        <Typography sx={{ fontSize: { xs: 11.5, sm: 13, md: 14 }, fontWeight: 700, color: titleColor }}>
                          SECTION:{" "}
                          <Box component="span" sx={{ fontWeight: 400, ml: 1 }}>
                            {sectionDescription || "—"}
                          </Box>
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>

              {/* ── Mobile & tablet: cards | Desktop (md+): table ── */}
              {isMobile ? (
                <Box>
                  {termSubjects.map((row, i) => (
                    <MobileSubjectCard
                      key={i} row={row} index={i}
                      borderColor={borderColor}
                      titleColor={titleColor}
                      subtitleColor={subtitleColor}
                    />
                  ))}

                  {/* Mobile totals strip */}
                  <Box sx={{
                    display: "flex", gap: 2, flexWrap: "wrap",
                    mt: 1, px: 1.5, py: 1,
                    borderRadius: "8px", backgroundColor: "#f5f5f5",
                    border: `1px solid ${borderColor}`,
                  }}>
                    <Typography sx={{ fontSize: { xs: 11.5, sm: 13 }, fontWeight: 700 }}>
                      TOTAL — Lec: {totalLec} | Lab: {totalLab} | Course: {totalCourse}
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
                  <Table size="small" sx={{ minWidth: 900 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ ...headCell, width: "40px" }}>#</TableCell>
                        <TableCell sx={{ ...headCell, width: "110px" }}>Subject Code</TableCell>
                        <TableCell sx={{ ...headCell, width: "320px" }}>Description</TableCell>
                        <TableCell sx={{ ...headCell, width: "90px" }}>Section</TableCell>
                        <TableCell sx={{ ...headCell, width: "90px" }}>Lec Units</TableCell>
                        <TableCell sx={{ ...headCell, width: "90px" }}>Lab Units</TableCell>
                        <TableCell sx={{ ...headCell, width: "110px" }}>Course Units</TableCell>
                        <TableCell sx={{ ...headCell, width: "220px" }}>Schedule</TableCell>
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
                          <TableCell sx={{ ...colStyle, width: "40px" }}>{i + 1}</TableCell>
                          <TableCell sx={{ ...colStyle, width: "110px" }}>{row.course_code}</TableCell>
                          <TableCell sx={{ ...colStyle, width: "320px" }}>{row.course_description}</TableCell>
                          <TableCell sx={{ ...colStyle, width: "90px", textAlign: "center" }}>
                            {row.section_description || "—"}
                          </TableCell>
                          <TableCell sx={{ ...colStyle, width: "90px", textAlign: "center" }}>{formatUnit(row.lec_unit)}</TableCell>
                          <TableCell sx={{ ...colStyle, width: "90px", textAlign: "center" }}>{formatUnit(row.lab_unit)}</TableCell>
                          <TableCell sx={{ ...colStyle, width: "110px", textAlign: "center" }}>{formatUnit(row.course_unit)}</TableCell>
                          <TableCell sx={{ ...colStyle, width: "220px", textAlign: "center", whiteSpace: "pre-line" }}>{row.schedule}</TableCell>
                        </TableRow>
                      ))}

                      {/* Total row */}
                      <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                        <TableCell sx={{ ...bodyCell, fontWeight: 700 }} colSpan={4}>TOTAL</TableCell>
                        <TableCell sx={{ ...bodyCell, fontWeight: 700, textAlign: "center" }}>{totalLec}</TableCell>
                        <TableCell sx={{ ...bodyCell, fontWeight: 700, textAlign: "center" }}>{totalLab}</TableCell>
                        <TableCell sx={{ ...bodyCell, fontWeight: 700, textAlign: "center" }}>{totalCourse}</TableCell>
                        <TableCell sx={bodyCell}></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          );
        })}
      </Box>

      <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage("")} anchorOrigin={{ vertical: "top", horizontal: "center" }}>
        <Alert severity="error">{message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default StudentCurriculumSubjects;
