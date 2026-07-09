import React, { useState, useEffect, useContext } from "react";
import { SettingsContext } from "../App";
import axios from "axios";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  MenuItem,
  FormControl,
  Select,
} from "@mui/material";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
} from "@mui/material";
import { Snackbar, Alert } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";
import API_BASE_URL from "../apiConfig";
import { useNavigate } from "react-router-dom";
import {
  People,
  School,
  SupervisorAccount,
  AdminPanelSettings,
} from "@mui/icons-material";

const SuperAdminFacultyResetPassword = () => {
  const settings = useContext(SettingsContext);

  const [titleColor, setTitleColor] = useState("#000000");
  const [subtitleColor, setSubtitleColor] = useState("#555555");
  const [borderColor, setBorderColor] = useState("#000000");
  const [mainButtonColor, setMainButtonColor] = useState("#1976d2");
  const [subButtonColor, setSubButtonColor] = useState("#ffffff");
  const [stepperColor, setStepperColor] = useState("#000000");

  useEffect(() => {
    if (!settings) return;
    if (settings.title_color) setTitleColor(settings.title_color);
    if (settings.subtitle_color) setSubtitleColor(settings.subtitle_color);
    if (settings.border_color) setBorderColor(settings.border_color);
    if (settings.main_button_color) setMainButtonColor(settings.main_button_color);
    if (settings.sub_button_color) setSubButtonColor(settings.sub_button_color);
    if (settings.stepper_color) setStepperColor(settings.stepper_color);
  }, [settings]);

  const [searchQuery, setSearchQuery] = useState("");
  const [faculty, setFaculty] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  // ✅ FIXED: access control was completely missing in the original
  const [hasAccess, setHasAccess] = useState(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [employeeID, setEmployeeID] = useState("");
  const pageId = 82;

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const auditFields = () => ({
    audit_actor_id:
      localStorage.getItem("employee_id") ||
      localStorage.getItem("email") ||
      "unknown",
    audit_actor_role: localStorage.getItem("role") || "registrar",
  });

  const tabs = [
    { label: "Applicant Reset Password", to: "/superadmin_applicant_reset_password", icon: <People fontSize="large" /> },
    { label: "Student Reset Password", to: "/superadmin_student_reset_password", icon: <School fontSize="large" /> },
    { label: "Faculty Reset Password", to: "/superadmin_faculty_reset_password", icon: <SupervisorAccount fontSize="large" /> },
    { label: "Registrar Reset Password", to: "/superadmin_registrar_reset_password", icon: <AdminPanelSettings fontSize="large" /> },
  ];

  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(2);

  const handleStepClick = (index, to) => {
    setActiveStep(index);
    navigate(to);
  };

  // ✅ FIXED: auth + access check added (was missing entirely)
  useEffect(() => {
    const storedRole = localStorage.getItem("role");
    const storedEmployeeID = localStorage.getItem("employee_id");

    if (!storedRole || storedRole !== "registrar") {
      window.location.href = "/login";
      return;
    }
    setEmployeeID(storedEmployeeID);
    checkAccess(storedEmployeeID);
  }, []);

  const checkAccess = async (empID) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/page_access/${empID}/${pageId}`,
      );
      setHasAccess(response.data?.page_privilege === 1);
    } catch {
      setHasAccess(false);
    } finally {
      setAccessLoading(false);
    }
  };

  const [searchLoading, setSearchLoading] = useState(false); // for search/reset


  // Fetch all faculty
  useEffect(() => {
    const fetchFaculty = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE_URL}/api/superadmin-get-all-faculty`);
        setFaculty(res.data);
      } catch (err) {
        console.error("Failed to fetch faculty list", err);
      } finally {
        setLoading(false);
      }
    };
    fetchFaculty();
  }, []);

  // Search faculty
  useEffect(() => {
    const fetchInfo = async () => {
      if (!searchQuery) {
        setUserInfo(null);
        setSearchError("");
        return;
      }
      try {
        const res = await axios.post(`${API_BASE_URL}/api/superadmin-get-faculty`, {
          search: searchQuery,
        });
        setUserInfo(res.data);
      } catch (err) {
        setUserInfo(null);
        setSearchError("Faculty not found");
      }
    };
    const delay = setTimeout(fetchInfo, 600);
    return () => clearTimeout(delay);
  }, [searchQuery]);

  const [statusLoading, setStatusLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleReset = async () => {
    if (!userInfo) return;
    try {
      const res = await axios.post(`${API_BASE_URL}/api/superadmin-reset-employee`, {
        email: userInfo.email,
        ...auditFields(),
      });

      setSnackbar({ open: true, message: res.data.message, severity: "success" });
    } catch (err) {
      setSnackbar({ open: true, message: "Reset failed", severity: "error" });
    }
  };

  const handleStatusChange = (e) => {
    const newStatus = parseInt(e.target.value, 10);

    setUserInfo((prev) => ({
      ...prev,
      status: newStatus,
    }));
  };

  const handleUpdateStatus = async () => {
    if (!userInfo) return;

    setStatusLoading(true);

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/superadmin-update-status-employee`,
        {
          email: userInfo.email,
          status: userInfo.status,
          ...auditFields(),
        }
      );

      setFaculty((prev) =>
        prev.map((f) =>
          f.email === userInfo.email
            ? { ...f, status: userInfo.status }
            : f
        )
      );

      setSnackbar({
        open: true,
        message:
          res.data.message || "Faculty status updated successfully",
        severity: "success",
      });
    } catch (err) {
      setSnackbar({
        open: true,
        message:
          err.response?.data?.message ||
          "Failed to update faculty status",
        severity: "error",
      });
    } finally {
      setStatusLoading(false);
    }
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;
  const totalPages = Math.ceil(faculty.length / rowsPerPage);
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = faculty.slice(indexOfFirstRow, indexOfLastRow);

  const handleNameClick = (f) => {
    setSearchQuery(f.email);
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  const formatDate = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const headerStyle = {
    textAlign: "center",
    fontSize: "12px",
    border: `1px solid ${borderColor}`,
  };

  const paginationSelectStyle = {
    fontSize: "12px",
    height: 36,
    color: "white",
    border: "2px solid white",
    backgroundColor: "transparent",
    ".MuiOutlinedInput-notchedOutline": { borderColor: "white" },
    "& svg": { color: "white" },
  };

  const paginationButtonStyle = {
    minWidth: 70,
    color: "white",
    borderColor: "white",
    backgroundColor: "transparent",
    "&:hover": { borderColor: "white", backgroundColor: "rgba(255,255,255,0.1)" },
    "&.Mui-disabled": { color: "white", borderColor: "white", backgroundColor: "transparent", opacity: 1 },
  };

  if (accessLoading) return <LoadingOverlay open message="Checking Access..." />;
  if (!hasAccess) return <Unauthorized />;

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

  const PaginationControls = () => (
    <Box display="flex" alignItems="center" gap={1}>
      <Button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} variant="outlined" size="small" sx={paginationButtonStyle}>First</Button>
      <Button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1} variant="outlined" size="small" sx={paginationButtonStyle}>Prev</Button>
      <FormControl size="small" sx={{ minWidth: 90 }}>
        <Select value={currentPage} onChange={(e) => setCurrentPage(Number(e.target.value))} sx={paginationSelectStyle} MenuProps={{ PaperProps: { sx: { maxHeight: 200 } } }}>
          {Array.from({ length: totalPages }, (_, i) => (
            <MenuItem key={i + 1} value={i + 1}>Page {i + 1}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <Typography fontSize="12px" color="white">of {totalPages} page{totalPages > 1 ? "s" : ""}</Typography>
      <Button onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} variant="outlined" size="small" sx={paginationButtonStyle}>Next</Button>
      <Button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} variant="outlined" size="small" sx={paginationButtonStyle}>Last</Button>
    </Box>
  );

  const PaginationBar = () => (
    <TableRow>
      <TableCell colSpan={6} sx={{ border: `1px solid ${borderColor}`, py: 0.5, backgroundColor: settings?.header_color || "#1976d2", color: "white" }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography fontSize="14px" fontWeight="bold" color="white">Total Faculty's Records: {faculty.length}</Typography>
          <PaginationControls />
        </Box>
      </TableCell>
    </TableRow>
  );

  return (
    <Box sx={{ height: "calc(100vh - 150px)", overflowY: "auto", paddingRight: 1, backgroundColor: "transparent", mt: 1, padding: 2 }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: "bold", color: titleColor, fontSize: "36px" }}>
          FACULTY RESET PASSWORD
        </Typography>
        <TextField
          size="small"
          placeholder="Search Employee ID / Name / Email"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ width: 450, backgroundColor: "#fff", borderRadius: 1, "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
          InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: "gray" }} /> }}
        />
      </Box>
      <hr style={{ border: "1px solid #ccc", width: "100%" }} />
      <br /><br />

      {/* Tab Cards */}
      <Box sx={{ display: "flex", justifyContent: "space-between", flexWrap: "nowrap", width: "100%", mt: 1, gap: 2 }}>
        {tabs.map((tab, index) => (
          <Card
            key={index}
            onClick={() => handleStepClick(index, tab.to)}
            sx={{
              flex: `1 1 ${100 / tabs.length}%`,
              height: 135,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              borderRadius: 2,
              border: `1px solid ${borderColor}`,
              backgroundColor: activeStep === index ? settings?.header_color || "#1976d2" : "#E8C999",
              color: activeStep === index ? "#fff" : "#000",
              boxShadow: activeStep === index ? "0px 4px 10px rgba(0,0,0,0.3)" : "0px 2px 6px rgba(0,0,0,0.15)",
              transition: "0.3s ease",
              "&:hover": { backgroundColor: activeStep === index ? "#000000" : "#f5d98f" },
            }}
          >
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <Box sx={{ fontSize: 40, mb: 1 }}>{tab.icon}</Box>
              <Typography sx={{ fontSize: 14, fontWeight: "bold", textAlign: "center" }}>{tab.label}</Typography>
            </Box>
          </Card>
        ))}
      </Box>
      <br /><br />

      {/* Section Label */}
      <TableContainer component={Paper} sx={{ width: "100%", border: `1px solid ${borderColor}` }}>
        <Table>
          <TableHead sx={{ backgroundColor: settings?.header_color || "#1976d2" }}>
            <TableRow>
              <TableCell sx={{ color: "white", textAlign: "center" }}>Faculty Information</TableCell>
            </TableRow>
          </TableHead>
        </Table>
      </TableContainer>

      {/* Info Panel */}
      <Paper sx={{ p: 3, border: `1px solid ${borderColor}` }}>
        <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
          <TextField label="Employee ID" value={userInfo?.employee_id || ""} InputProps={{ readOnly: true }} />
          <TextField label="Email" value={userInfo?.email || ""} InputProps={{ readOnly: true }} />
          <TextField label="Full Name" value={userInfo?.fullName || ""} InputProps={{ readOnly: true }} />
          <TextField select label="Status" value={userInfo?.status ?? ""} onChange={handleStatusChange}>
            <MenuItem value={1}>Active</MenuItem>
            <MenuItem value={0}>Inactive</MenuItem>
          </TextField>
        </Box>
        <Box mt={3} display="flex" gap={2}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleUpdateStatus}
            disabled={!userInfo || statusLoading}
          >
            {statusLoading ? "Updating..." : "Update Status"}
          </Button>

          <Button
            variant="contained"
            color="secondary"
            onClick={handleReset}
            disabled={!userInfo || searchLoading}
          >
            {searchLoading ? "Processing..." : "Reset Password"}
          </Button>
        </Box>
      </Paper>
      <br /><br />

      {/* Table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <PaginationBar />
            <TableRow>
              {["#", "Employee ID", "Full Name", "Email", "Status"].map((h) => (
                <TableCell key={h} sx={{ ...headerStyle, backgroundColor: "white", color: "black" }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {currentRows.map((f, index) => (
              <TableRow key={index} sx={{ backgroundColor: index % 2 === 0 ? "#ffffff" : "lightgray" }}>
                <TableCell align="center" sx={{ border: `1px solid ${borderColor}` }}>{indexOfFirstRow + index + 1}</TableCell>
                <TableCell sx={{ color: "blue", cursor: "pointer", border: `1px solid ${borderColor}` }} onClick={() => handleNameClick(f)}>{f.employee_id}</TableCell>
                <TableCell sx={{ color: "blue", cursor: "pointer", border: `1px solid ${borderColor}` }} onClick={() => handleNameClick(f)}>{f.fullName}</TableCell>
                <TableCell align="center" sx={{ border: `1px solid ${borderColor}` }}>{f.email}</TableCell>
                <TableCell align="center" sx={{ border: `1px solid ${borderColor}`, fontWeight: "bold", color: f.status === 1 ? "green" : "red" }}>
                  {f.status === 1 ? "Active" : "Inactive"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Bottom Pagination */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead><PaginationBar /></TableHead>
        </Table>
      </TableContainer>
      <br /><br />

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: "top", horizontal: "center" }}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default SuperAdminFacultyResetPassword;