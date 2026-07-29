import React, { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import HistoryEduIcon from "@mui/icons-material/HistoryEdu";
import PersonIcon from "@mui/icons-material/Person";
import SchoolIcon from "@mui/icons-material/School";
import API_BASE_URL from "../apiConfig";
import { SettingsContext } from "../App";

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatName = (person = {}) =>
  [person.last_name, person.first_name, person.middle_name]
    .filter(Boolean)
    .join(", ") || "Student";

const getEmployeeName = (log = {}) =>
  [log.last_name, log.first_name, log.middle_name]
    .filter(Boolean)
    .join(", ") || log.employee_code || log.employee_id || "System";

const StudentHistory = () => {
  const settings = useContext(SettingsContext);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const titleColor = settings?.title_color || "#000000";
  const subtitleColor = settings?.subtitle_color || "#555555";
  const borderColor = settings?.border_color || "#d1d5db";
  const headerBg = settings?.header_color || "#800000";

  const [student, setStudent] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchHistory = async () => {
      const storedRole = localStorage.getItem("role");
      const storedID = localStorage.getItem("person_id");

      if (!storedID) {
        window.location.href = "/login";
        return;
      }

      if (storedRole !== "student") {
        window.location.href = "/login";
        return;
      }

      try {
        setLoading(true);
        setError("");

        const gradeRes = await axios.get(`${API_BASE_URL}/api/student_grade/${storedID}`);
        const gradeRows = Array.isArray(gradeRes.data) ? gradeRes.data : [];
        const studentNumber =
          gradeRows[0]?.student_number ||
          localStorage.getItem("student_number") ||
          localStorage.getItem("studentNumber");

        if (!studentNumber) {
          setError("Unable to find your student number.");
          return;
        }

        const historyRes = await axios.get(
          `${API_BASE_URL}/api/student-history-logs/${studentNumber}`,
        );

        setStudent(historyRes.data?.student || gradeRows[0] || { student_number: studentNumber });
        setLogs(Array.isArray(historyRes.data?.logs) ? historyRes.data.logs : []);
      } catch (err) {
        console.error("Error fetching student history:", err);
        setError(err.response?.data?.message || "Failed to fetch student history logs.");
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const sortedLogs = useMemo(
    () =>
      [...logs].sort((a, b) => {
        const dateA = new Date(a.created_at).getTime() || 0;
        const dateB = new Date(b.created_at).getTime() || 0;
        return dateB - dateA;
      }),
    [logs],
  );

  if (loading) {
    return (
      <Box sx={{ p: 3, display: "flex", alignItems: "center", gap: 1.5 }}>
        <CircularProgress size={24} />
        <Typography>Loading student history...</Typography>
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
        p: { xs: 1.5, sm: 2, md: 3 },
      }}
    >
      <Box sx={{ mb: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
          <HistoryEduIcon sx={{ color: headerBg, fontSize: { xs: 25, md: 30 } }} />
          <Typography
            variant="h4"
            sx={{
              color: titleColor,
              fontWeight: 700,
              fontSize: { xs: 24, sm: 28, md: 36 },
            }}
          >
            My History
          </Typography>
        </Box>
        <Typography sx={{ color: subtitleColor, fontSize: { xs: 13, sm: 14 } }}>
          Student history logs recorded for your account.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper
        elevation={0}
        sx={{
          border: `1px solid ${borderColor}`,
          borderRadius: "8px",
          mb: 2,
          p: { xs: 1.5, sm: 2 },
        }}
      >
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: { xs: "100%", sm: 240 } }}>
            <PersonIcon sx={{ color: headerBg }} />
            <Box>
              <Typography sx={{ color: subtitleColor, fontSize: 12, textTransform: "uppercase" }}>
                Student
              </Typography>
              <Typography sx={{ color: titleColor, fontWeight: 700, fontSize: { xs: 14, sm: 15 } }}>
                {formatName(student)}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: { xs: "100%", sm: 220 } }}>
            <SchoolIcon sx={{ color: headerBg }} />
            <Box>
              <Typography sx={{ color: subtitleColor, fontSize: 12, textTransform: "uppercase" }}>
                Student Number
              </Typography>
              <Typography sx={{ color: titleColor, fontWeight: 700, fontSize: { xs: 14, sm: 15 } }}>
                {student?.student_number || "N/A"}
              </Typography>
            </Box>
          </Box>

          {student?.current_curriculum && (
            <Box sx={{ minWidth: { xs: "100%", sm: 260 }, flex: 1 }}>
              <Typography sx={{ color: subtitleColor, fontSize: 12, textTransform: "uppercase" }}>
                Current Curriculum
              </Typography>
              <Typography sx={{ color: titleColor, fontWeight: 600, fontSize: { xs: 13, sm: 14 } }}>
                {student.current_curriculum}
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Typography sx={{ color: titleColor, fontWeight: 700, fontSize: { xs: 16, sm: 18 } }}>
          History Logs
        </Typography>
        <Chip
          label={`${sortedLogs.length} ${sortedLogs.length === 1 ? "record" : "records"}`}
          size="small"
          sx={{
            backgroundColor: "#f3f4f6",
            border: `1px solid ${borderColor}`,
            color: titleColor,
            fontWeight: 600,
          }}
        />
      </Box>

      {!sortedLogs.length ? (
        <Paper
          elevation={0}
          sx={{
            border: `1px solid ${borderColor}`,
            borderRadius: "8px",
            p: 3,
            textAlign: "center",
          }}
        >
          <Typography sx={{ color: subtitleColor }}>No history logs found.</Typography>
        </Paper>
      ) : isMobile ? (
        <Box>
          {sortedLogs.map((log) => (
            <Paper
              key={log.id}
              elevation={0}
              sx={{
                border: `1px solid ${borderColor}`,
                borderRadius: "8px",
                p: 1.5,
                mb: 1.25,
                backgroundColor: "#ffffff",
              }}
            >
              <Typography sx={{ color: titleColor, fontWeight: 700, fontSize: 13, mb: 0.75 }}>
                {formatDate(log.created_at)}
              </Typography>
              <Typography sx={{ color: "#111827", fontSize: 13, lineHeight: 1.5, mb: 1 }}>
                {log.message || "No message provided."}
              </Typography>
              <Typography sx={{ color: subtitleColor, fontSize: 12 }}>
                Recorded by: {getEmployeeName(log)}
              </Typography>
            </Paper>
          ))}
        </Box>
      ) : (
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{
            border: `1px solid ${borderColor}`,
            borderRadius: "8px",
            maxHeight: "calc(100vh - 360px)",
          }}
        >
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ backgroundColor: headerBg, color: "#fff", fontWeight: 700, width: 220 }}>
                  Date/Time
                </TableCell>
                <TableCell sx={{ backgroundColor: headerBg, color: "#fff", fontWeight: 700 }}>
                  Message
                </TableCell>
                <TableCell sx={{ backgroundColor: headerBg, color: "#fff", fontWeight: 700, width: 220 }}>
                  Recorded By
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedLogs.map((log, index) => (
                <TableRow key={log.id} sx={{ backgroundColor: index % 2 === 0 ? "#ffffff" : "#f9fafb" }}>
                  <TableCell sx={{ borderColor, fontSize: 13 }}>
                    {formatDate(log.created_at)}
                  </TableCell>
                  <TableCell sx={{ borderColor, fontSize: 13, whiteSpace: "pre-line" }}>
                    {log.message || "No message provided."}
                  </TableCell>
                  <TableCell sx={{ borderColor, fontSize: 13 }}>
                    {getEmployeeName(log)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default StudentHistory;
