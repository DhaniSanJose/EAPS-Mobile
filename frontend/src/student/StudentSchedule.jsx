import React, { useState, useEffect, useContext, useMemo } from "react";
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
} from "@mui/material";
import axios from "axios";
import API_BASE_URL from "../apiConfig";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_LABELS = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};

const TIME_SLOTS = [
  ["7:00 AM", "8:00 AM"],
  ["8:00 AM", "9:00 AM"],
  ["9:00 AM", "10:00 AM"],
  ["10:00 AM", "11:00 AM"],
  ["11:00 AM", "12:00 PM"],
  ["12:00 PM", "1:00 PM"],
  ["1:00 PM", "2:00 PM"],
  ["2:00 PM", "3:00 PM"],
  ["3:00 PM", "4:00 PM"],
  ["4:00 PM", "5:00 PM"],
  ["5:00 PM", "6:00 PM"],
  ["6:00 PM", "7:00 PM"],
  ["7:00 PM", "8:00 PM"],
  ["8:00 PM", "9:00 PM"],
];

const parseTime = (t) => new Date(`1970-01-01 ${t}`);

// Breakpoints: <768 = mobile (phones), 768-1099 = tablet, >=1100 = desktop
const getDeviceType = (width) => {
  if (width < 768) return "mobile";
  if (width < 1100) return "tablet";
  return "desktop";
};

const StudentSchedule = () => {
  const settings = useContext(SettingsContext);

  const [titleColor, setTitleColor] = useState("#000000");
  const [borderColor, setBorderColor] = useState("#000000");
  const [mainButtonColor, setMainButtonColor] = useState("#1976d2");

  const [studentSchedule, setStudentSchedule] = useState([]);
  const [activeDay, setActiveDay] = useState("MON");
  const [deviceType, setDeviceType] = useState(() =>
    typeof window !== "undefined" ? getDeviceType(window.innerWidth) : "desktop"
  );

  const isMobile = deviceType === "mobile";
  const isTablet = deviceType === "tablet";
  const isCompact = isMobile || isTablet; // shared "small screen" behavior

  useEffect(() => {
    if (!settings) return;
    if (settings.title_color) setTitleColor(settings.title_color);
    if (settings.border_color) setBorderColor(settings.border_color);
    if (settings.main_button_color) setMainButtonColor(settings.main_button_color);
  }, [settings]);

  // Single resize listener drives device type (mobile / tablet / desktop)
  useEffect(() => {
    let frame;
    const handleResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setDeviceType(getDeviceType(window.innerWidth));
      });
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  useEffect(() => {
    const storedRole = localStorage.getItem("role");
    const storedID = localStorage.getItem("person_id");
    if (!storedID) { window.location.href = "/login"; return; }
    if (storedRole !== "student") { window.location.href = "/faculty_dashboard"; return; }
    fetchStudentSchedule(storedID);
  }, []);

  // 🔒 Disable right-click + block DevTools/print shortcuts.
  // Moved into a mount-only effect with proper cleanup so listeners
  // aren't re-attached on every render (previous version leaked one
  // pair of listeners per render, which also breaks on unmount).
  useEffect(() => {
    const blockContextMenu = (e) => e.preventDefault();
    const blockShortcuts = (e) => {
      const isBlockedKey =
        e.key === "F12" ||
        e.key === "F11" ||
        (e.ctrlKey && e.shiftKey && (e.key.toLowerCase() === "i" || e.key.toLowerCase() === "j")) ||
        (e.ctrlKey && e.key.toLowerCase() === "u") ||
        (e.ctrlKey && e.key.toLowerCase() === "p");
      if (isBlockedKey) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("keydown", blockShortcuts);
    return () => {
      document.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("keydown", blockShortcuts);
    };
  }, []);

  const fetchStudentSchedule = async (id) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/student_schedule/${id}`);
      setStudentSchedule(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const toWholeUnit = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? Math.round(num) : 0;
  };

  const sortedSchedule = useMemo(
    () =>
      [...studentSchedule].sort((a, b) =>
        (a.course_code || "").localeCompare(b.course_code || "")
      ),
    [studentSchedule]
  );

  const totalUnits = useMemo(
    () => sortedSchedule.reduce((total, row) => total + toWholeUnit(row.course_unit), 0),
    [sortedSchedule]
  );

  const isTimeInSchedule = (start, end, day) =>
    studentSchedule.some((entry) => {
      if (entry.day_description !== day) return false;
      const slotStart = parseTime(start);
      const slotEnd = parseTime(end);
      const schedStart = parseTime(entry.school_time_start);
      const schedEnd = parseTime(entry.school_time_end);
      return slotStart >= schedStart && slotEnd <= schedEnd;
    });

  const getEntryForSlot = (start, day) => {
    const slotStart = parseTime(start);
    return studentSchedule.find((entry) => {
      if (entry.day_description !== day) return false;
      const schedStart = parseTime(entry.school_time_start);
      const schedEnd = parseTime(entry.school_time_end);
      return slotStart >= schedStart && slotStart < schedEnd;
    });
  };

  const hasAdjacentSchedule = (start, end, day, direction = "top") => {
    const minutesOffset = direction === "top" ? -60 : 60;
    const newStart = new Date(parseTime(start).getTime() + minutesOffset * 60000);
    const newEnd = new Date(parseTime(end).getTime() + minutesOffset * 60000);
    const currentEntry = getEntryForSlot(start, day);
    const adjacentEntry = studentSchedule.find((entry) => {
      if (entry.day_description !== day) return false;
      const schedStart = parseTime(entry.school_time_start);
      const schedEnd = parseTime(entry.school_time_end);
      return newStart >= schedStart && newEnd <= schedEnd;
    });
    if (!adjacentEntry) return false;
    if (currentEntry && adjacentEntry.course_code === currentEntry.course_code) return "same";
    return "different";
  };

  const getCenterText = (start, day, cellHeightRem) => {
    const slotStart = parseTime(start);

    for (const entry of studentSchedule) {
      if (entry.day_description !== day) continue;
      const schedStart = parseTime(entry.school_time_start);
      const schedEnd = parseTime(entry.school_time_end);
      if (!(slotStart >= schedStart && slotStart < schedEnd)) continue;

      const totalHours = Math.round((schedEnd - schedStart) / (1000 * 60 * 60));
      const idxInBlock = Math.round((slotStart - schedStart) / (1000 * 60 * 60));
      const isOdd = totalHours % 2 === 1;
      const centerIndex = isOdd ? (totalHours - 1) / 2 : totalHours / 2;
      const isCenter = idxInBlock === centerIndex;
      if (!isCenter) return "";

      let marginTop = isOdd ? 0 : -(cellHeightRem / 2);
      if (!isOdd) marginTop = `calc(${marginTop}rem - 1rem)`;

      const fontSize = totalHours === 1 ? "9.5px" : isTablet ? "10px" : "11px";
      return (
        <span style={{ position: "relative", display: "inline-block", textAlign: "center", width: "100%", fontSize, marginTop }}>
          <div style={{ width: "100%", padding: "0 2px" }}>
            <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize }}>
              {entry.course_code}
            </span>
            <span style={{ display: "block", whiteSpace: "normal", wordBreak: "break-word", fontSize: "8px", lineHeight: 1.2 }}>
              {entry.room_description === "TBA" ? "TBA" : entry.room_description}
            </span>
            <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: totalHours === 1 ? "8px" : "9.5px" }}>
              {entry.prof_lastname === "TBA" ? "TBA" : `Prof. ${entry.prof_lastname}`}
            </span>
          </div>
        </span>
      );
    }
    return "";
  };

  // ── Shared course card (used for the summary list on phones,
  //    and the per-day list on phones/tablets) ──
  const CourseCard = ({ entry, showDay }) => (
    <Box
      sx={{
        background: "#fffde7",
        border: `1.5px solid ${borderColor}`,
        borderLeft: `5px solid ${mainButtonColor}`,
        borderRadius: "8px",
        p: 1.5,
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14, color: mainButtonColor }}>
          {entry.course_code}
        </Typography>
        {showDay && (
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#777", whiteSpace: "nowrap" }}>
            {entry.day_description}
          </Typography>
        )}
      </Box>
      <Typography sx={{ fontSize: 12, color: "#333", mt: 0.3 }}>
        {entry.course_description}
      </Typography>
      <Box sx={{ display: "flex", gap: 2, mt: 0.8, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: 11, color: "#555" }}>
          🕐 {entry.school_time_start} – {entry.school_time_end}
        </Typography>
        <Typography sx={{ fontSize: 11, color: "#555" }}>
          📍 {entry.room_description}
        </Typography>
        <Typography sx={{ fontSize: 11, color: "#555" }}>
          👤 {entry.prof_lastname === "TBA" ? "TBA" : `Prof. ${entry.prof_lastname}`}
        </Typography>
        <Typography sx={{ fontSize: 11, color: "#555" }}>
          📚 {entry.program_code} {entry.section_description}
        </Typography>
        <Typography sx={{ fontSize: 11, color: "#555" }}>
          ⓤ {toWholeUnit(entry.course_unit)} unit{toWholeUnit(entry.course_unit) === 1 ? "" : "s"}
        </Typography>
      </Box>
    </Box>
  );

  // ── Course summary: table on tablet/desktop, cards on phones ──
  const renderCourseSummary = () => {
    if (isMobile) {
      return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, px: { xs: 0.5, sm: 0 } }}>
          {sortedSchedule.map((row, i) => (
            <CourseCard key={i} entry={row} showDay />
          ))}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              border: `1.5px solid ${borderColor}`,
              borderRadius: "8px",
              p: 1.5,
              background: "#f5f5f5",
            }}
          >
            <Typography sx={{ fontWeight: 700, fontSize: 13 }}>Total Units</Typography>
            <Typography sx={{ fontWeight: 700, fontSize: 13, color: mainButtonColor }}>
              {totalUnits}
            </Typography>
          </Box>
        </Box>
      );
    }

    return (
      <TableContainer component={Paper} sx={{ mx: "auto", width: "100%", maxWidth: "1400px", overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: isTablet ? 640 : "auto" }}>
          <TableHead sx={{ backgroundColor: settings?.header_color || "#1976d2" }}>
            <TableRow>
              {["#", "Course Description", "Course Code", "Lec", "Lab", "Units", "Section", "Schedule"].map((h) => (
                <TableCell key={h} sx={{ color: "white", border: `1px solid ${borderColor}`, fontSize: { sm: "0.7rem", md: "0.75rem" }, whiteSpace: "nowrap" }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedSchedule.map((row, index) => (
              <TableRow key={index}>
                {[
                  index + 1,
                  row.course_description,
                  row.course_code,
                  1,
                  row.lab_unit == null ? "" : toWholeUnit(row.lab_unit),
                  row.course_unit == null ? "" : toWholeUnit(row.course_unit),
                  `${row.program_code} ${row.section_description}`,
                  `${row.day_description}, ${row.school_time_start} - ${row.school_time_end} ${row.room_description}`,
                ].map((cell, ci) => (
                  <TableCell key={ci} sx={{ fontSize: { sm: "0.7rem", md: "0.75rem" }, border: `1px solid ${borderColor}` }}>
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={3} style={{ border: `1px solid ${borderColor}` }} />
              <TableCell colSpan={2} style={{ fontWeight: "600", border: `1px solid ${borderColor}`, fontSize: "0.75rem" }}>Total Units</TableCell>
              <TableCell style={{ border: `1px solid ${borderColor}`, fontSize: "0.75rem" }}>
                {totalUnits}
              </TableCell>
              <TableCell colSpan={2} style={{ border: `1px solid ${borderColor}` }} />
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  // ── Weekly grid: card list (phones + tablets) vs full grid (desktop) ──
  const renderCompactDaySchedule = () => {
    const dayEntries = studentSchedule
      .filter((e) => e.day_description === activeDay)
      .sort((a, b) => parseTime(a.school_time_start) - parseTime(b.school_time_start));

    if (!dayEntries.length) {
      return (
        <Box sx={{ textAlign: "center", py: 6, color: "#888" }}>
          <Typography sx={{ fontSize: 14 }}>No classes on {DAY_LABELS[activeDay]}</Typography>
        </Box>
      );
    }

    return (
      <Box
        sx={{
          display: isTablet ? "grid" : "flex",
          gridTemplateColumns: isTablet ? "repeat(2, 1fr)" : undefined,
          flexDirection: isTablet ? undefined : "column",
          gap: 1.5,
          mt: 1,
        }}
      >
        {dayEntries.map((entry, i) => (
          <CourseCard key={i} entry={entry} />
        ))}
      </Box>
    );
  };

  const renderDayTabs = () => (
    <>
      <Box sx={{ display: "flex", gap: 0.75, overflowX: "auto", pb: 1, mb: 1, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
        {DAYS.map((day) => {
          const hasClass = studentSchedule.some((e) => e.day_description === day);
          const isActive = activeDay === day;
          return (
            <Box
              key={day}
              onClick={() => setActiveDay(day)}
              sx={{
                flexShrink: 0,
                px: 1.5,
                py: 0.75,
                borderRadius: "20px",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: isActive ? 700 : 400,
                border: `1.5px solid ${isActive ? mainButtonColor : borderColor}`,
                backgroundColor: isActive ? mainButtonColor : "transparent",
                color: isActive ? "#fff" : hasClass ? mainButtonColor : "#999",
                position: "relative",
                transition: "all 0.18s ease",
              }}
            >
              {day}
              {hasClass && !isActive && (
                <Box sx={{ position: "absolute", top: 2, right: 2, width: 5, height: 5, borderRadius: "50%", backgroundColor: mainButtonColor }} />
              )}
            </Box>
          );
        })}
      </Box>
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: mainButtonColor, mb: 1 }}>
        {DAY_LABELS[activeDay]}
      </Typography>
    </>
  );

  // ── Desktop: full weekly grid, sized with relative units so it also
  //    scales reasonably on large tablets in landscape ──
  const renderDesktopGrid = () => {
    const timeColWidth = "6.5rem";
    const dayColWidth = isTablet ? "7rem" : "8.5rem";
    const rowHeight = "2.5rem";

    return (
      <Box sx={{ overflowX: "auto", width: "100%" }}>
        <table style={{ borderCollapse: "collapse", tableLayout: "fixed" }}>
          <thead>
            <tr style={{ display: "flex", alignItems: "center" }}>
              <td style={{ minWidth: timeColWidth, minHeight: "2.2rem", display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${borderColor}`, fontSize: 14 }}>
                TIME
              </td>
              <td style={{ padding: 0, margin: 0 }}>
                <div style={{ minWidth: "6.6rem", textAlign: "center", border: `1px solid ${borderColor}`, borderLeft: 0, borderBottom: 0, fontSize: 14 }}>DAY</div>
                <p style={{ minWidth: "6.6rem", textAlign: "center", border: `1px solid ${borderColor}`, borderLeft: 0, fontSize: "11.5px", fontWeight: "bold", marginTop: "-3px" }}>Official Time</p>
              </td>
              {DAYS.map((day) => (
                <td key={day} style={{ padding: 0, margin: 0 }}>
                  <div style={{ minWidth: dayColWidth, textAlign: "center", border: `1px solid ${borderColor}`, borderLeft: 0, borderBottom: 0, fontSize: 14 }}>{DAY_LABELS[day].toUpperCase()}</div>
                  <p style={{ minWidth: dayColWidth, textAlign: "center", border: `1px solid ${borderColor}`, borderLeft: 0, fontSize: "11.5px", marginTop: "-3px" }}>7:00AM - 9:00PM</p>
                </td>
              ))}
            </tr>
          </thead>
          <tbody style={{ display: "flex", flexDirection: "column", marginTop: "-0.1px" }}>
            {TIME_SLOTS.map(([start, end]) => (
              <tr key={start} style={{ display: "flex", width: "100%" }}>
                <td style={{ margin: 0, padding: 0, minWidth: "13.1rem" }}>
                  <div style={{ height: rowHeight, border: `1px solid ${borderColor}`, borderTop: 0, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {start} - {end}
                  </div>
                </td>
                {DAYS.map((day) => {
                  const inSched = isTimeInSchedule(start, end, day);
                  const topAdj = hasAdjacentSchedule(start, end, day, "top");
                  const botAdj = hasAdjacentSchedule(start, end, day, "bottom");
                  return (
                    <td key={day} style={{ margin: 0, padding: 0, minWidth: dayColWidth }}>
                      <div style={{
                        height: rowHeight,
                        border: `1px solid ${borderColor}`,
                        borderTop: inSched && topAdj === "same" ? 0 : `1px solid ${borderColor}`,
                        borderBottom: inSched && botAdj === "same" ? 0 : `1px solid ${borderColor}`,
                        borderLeft: 0,
                        fontSize: 14,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: inSched ? "#fef08a" : "transparent",
                      }}>
                        {getCenterText(start, day, 2.5)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    );
  };

  return (
    <Box sx={{ minHeight: "calc(100vh - 150px)", overflowY: "auto", backgroundColor: "transparent", mt: 1, p: { xs: 1, sm: 2 } }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", mb: 2, px: { xs: 0, sm: 2 } }}>
        <Typography variant="h4" sx={{ fontWeight: "bold", color: titleColor, fontSize: { xs: "20px", sm: "26px", md: "32px", lg: "36px" } }}>
          CLASS SCHEDULE
        </Typography>
      </Box>
      <hr style={{ border: "1px solid #ccc", width: "100%" }} />
      <br />

      {/* Course summary (table on tablet/desktop, cards on phones) */}
      <Box sx={{ mb: 3 }}>{renderCourseSummary()}</Box>

      {/* Weekly Grid Section */}
      <Box sx={{ border: `1px solid ${borderColor}`, p: { xs: 1, sm: "1rem" }, overflowX: "auto" }}>
        {isCompact ? (
          <>
            {renderDayTabs()}
            {renderCompactDaySchedule()}
          </>
        ) : (
          renderDesktopGrid()
        )}
      </Box>
    </Box>
  );
};

export default StudentSchedule;
