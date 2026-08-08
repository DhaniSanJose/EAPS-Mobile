import React, { useState, useEffect, useContext, useRef } from "react";
import { SettingsContext } from "../App";
import axios from "axios";
import {
  Box,
  TextField,
  Button,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  TableContainer,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Grid
} from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import { Search } from "@mui/icons-material";
import { FcPrint } from "react-icons/fc";
import EaristLogo from "../assets/EaristLogo.png";
import DashboardIcon from "@mui/icons-material/Dashboard";
import AssignmentIcon from "@mui/icons-material/Assignment";
import ScheduleIcon from "@mui/icons-material/Schedule";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";
import SearchIcon from "@mui/icons-material/Search";
import KeyIcon from "@mui/icons-material/Key";
import API_BASE_URL from "../apiConfig";
import { getAuditConfig, getFlatAuditHeaders } from "../utils/auditEvents";
import useAuditMac from "../utils/useAuditMac";
import { getLoginMacPayload } from "../utils/userMacAddress";
import AdmissionRoomAssignmentTabs from "../components/AdmissionRoomAssignmentTabs";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { Snackbar, Alert } from "@mui/material";

const ProctorApplicantList = () => {
  useAuditMac();
  const settings = useContext(SettingsContext);
  const [titleColor, setTitleColor] = useState("#000000");
  const [subtitleColor, setSubtitleColor] = useState("#555555");
  const [borderColor, setBorderColor] = useState("#000000");
  const [mainButtonColor, setMainButtonColor] = useState("#1976d2");
  const [subButtonColor, setSubButtonColor] = useState("#ffffff"); // ✅ NEW
  const [stepperColor, setStepperColor] = useState("#000000"); // ✅ NEW

  const [fetchedLogo, setFetchedLogo] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [shortTerm, setShortTerm] = useState("");
  const [campusAddress, setCampusAddress] = useState("");
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    if (!settings) return;

    // 🎨 Colors
    if (settings.title_color) setTitleColor(settings.title_color);
    if (settings.subtitle_color) setSubtitleColor(settings.subtitle_color);
    if (settings.border_color) setBorderColor(settings.border_color);
    if (settings.main_button_color)
      setMainButtonColor(settings.main_button_color);
    if (settings.sub_button_color) setSubButtonColor(settings.sub_button_color); // ✅ NEW
    if (settings.stepper_color) setStepperColor(settings.stepper_color); // ✅ NEW

    // 🏫 Logo
    if (settings.logo_url) {
      setFetchedLogo(`${API_BASE_URL}${settings.logo_url}`);
    } else {
      setFetchedLogo(EaristLogo);
    }

    // 🏷️ School Information
    if (settings.company_name) setCompanyName(settings.company_name);
    if (settings.short_term) setShortTerm(settings.short_term);
    if (settings.campus_address) setCampusAddress(settings.campus_address);
    if (settings?.branches) {
      try {
        const parsed =
          typeof settings.branches === "string"
            ? JSON.parse(settings.branches)
            : settings.branches;

        setBranches(Array.isArray(parsed) ? parsed : []);
      } catch (err) {
        console.error("Failed to parse branches:", err);
        setBranches([]);
      }
    } else {
      setBranches([]);
    }
  }, [settings]);

  const words = companyName.trim().split(" ");
  const middle = Math.ceil(words.length / 2);
  const firstLine = words.slice(0, middle).join(" ");
  const secondLine = words.slice(middle).join(" ");

  const [snack, setSnack] = useState({
    open: false,
    message: "",
    severity: "success",
    key: new Date().getTime(),
  });

  const handleClose = (event, reason) => {
    if (reason === "clickaway") return;

    setSnack((prev) => ({
      ...prev,
      open: false,
    }));
  };

  const location = useLocation();

  // Also put it at the very top
  const [userID, setUserID] = useState("");
  const [user, setUser] = useState("");
  const [userRole, setUserRole] = useState("");
  const [hasAccess, setHasAccess] = useState(null);
  const [loading, setLoading] = useState(false);

  const pageId = 33;

  const [employeeID, setEmployeeID] = useState("");

  const auditActor = () => ({
    audit_actor_id:
      employeeID ||
      localStorage.getItem("employee_id") ||
      localStorage.getItem("email") ||
      "unknown",
    audit_actor_role: userRole || localStorage.getItem("role") || "registrar",
    ...getLoginMacPayload(),
  });

  useEffect(() => {
    const storedUser = localStorage.getItem("email");
    const storedRole = localStorage.getItem("role");
    const storedID = localStorage.getItem("person_id");
    const storedEmployeeID = localStorage.getItem("employee_id");

    if (storedUser && storedRole && storedID) {
      setUser(storedUser);
      setUserRole(storedRole);
      setUserID(storedID);
      setEmployeeID(storedEmployeeID);

      if (storedRole === "registrar") {
        checkAccess(storedEmployeeID);
      } else {
        window.location.href = "/login";
      }
    } else {
      window.location.href = "/login";
    }
  }, []);

  const checkAccess = async (employeeID) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/page_access/${employeeID}/${pageId}`,
      );
      if (response.data && response.data.page_privilege === 1) {
        setHasAccess(true);
      } else {
        setHasAccess(false);
      }
    } catch (error) {
      console.error("Error checking access:", error);
      setHasAccess(false);
      if (error.response && error.response.data.message) {
        console.log(error.response.data.message);
      } else {
        console.log("An unexpected error occurred.");
      }
      setLoading(false);
    }
  };

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [applicantToDelete, setApplicantToDelete] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [proctor, setProctor] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [person, setPerson] = useState({
    campus: "",
    last_name: "",
    first_name: "",
    middle_name: "",
    program: "",
    extension: "",
  });

  const handleSearchByProctor = async (proctorName, scheduleID) => {
    try {
      const { data } = await axios.get(
        `${API_BASE_URL}/api/proctor-applicants`,
        {
          params: { query: proctorName, schedule_id: scheduleID },
        },
      );

      setProctor(data[0]?.schedule || null);
      setApplicants(data[0]?.applicants || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const proctorParam = params.get("proctor");
    const scheduleParam = params.get("schedule");

    if (proctorParam) {
      setSearchQuery(proctorParam);
      handleSearchByProctor(proctorParam, scheduleParam);
    }
  }, [location.search]);

  const [curriculumOptions, setCurriculumOptions] = useState([]);

  useEffect(() => {
    const fetchCurriculums = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/applied_program`);
        console.log("✅ curriculumOptions:", response.data); // <--- add this
        setCurriculumOptions(response.data);
      } catch (error) {
        console.error("Error fetching curriculum options:", error);
      }
    };

    fetchCurriculums();
  }, []);

  // ---------------- Applicant List / Attendance toggle ----------------
  const [viewMode, setViewMode] = useState("applicants"); // "applicants" | "attendance"
  const [attendanceRows, setAttendanceRows] = useState([]);

  const statusChip = (status) => {
    if (status === "present")
      return <Chip label="Present" color="success" size="small" />;
    if (status === "absent")
      return <Chip label="Absent" color="error" size="small" />;
    return <Chip label="Not Yet Arrived" size="small" />;
  };

  const fetchAttendance = async (scheduleId) => {
    if (!scheduleId) return;
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/exam-attendance/schedule/${scheduleId}`,
      );
      setAttendanceRows(res.data || []);
    } catch (err) {
      console.error("Error fetching attendance:", err);
    }
  };

  // Poll attendance every 10s while the Attendance tab is active
  useEffect(() => {
    if (viewMode !== "attendance" || !proctor?.schedule_id) return;
    fetchAttendance(proctor.schedule_id);
    const interval = setInterval(
      () => fetchAttendance(proctor.schedule_id),
      10000,
    );
    return () => clearInterval(interval);
  }, [viewMode, proctor?.schedule_id]);

  // Reset back to Applicant List whenever a new schedule/proctor loads
  useEffect(() => {
    setViewMode("applicants");
    setAttendanceRows([]);
  }, [proctor?.schedule_id]);

  const handleMarkAbsent = async () => {
    if (
      !proctor?.schedule_id ||
      !window.confirm("Mark everyone who hasn't scanned as ABSENT?")
    )
      return;
    try {
      await axios.put(
        `${API_BASE_URL}/api/exam-attendance/mark-absent/${proctor.schedule_id}`,
        auditActor(),
      );
      fetchAttendance(proctor.schedule_id);
    } catch (err) {
      console.error("Error marking absent:", err);
    }
  };

  const presentCount = attendanceRows.filter((r) => r.status === "present").length;
  const absentCount = attendanceRows.filter((r) => r.status === "absent").length;
  const notArrivedCount = attendanceRows.filter(
    (r) => r.status === "not_arrived",
  ).length;

  const handleExportProctorApplicantListPdf = async () => {
    const resolvedAddress = campusAddress || settings?.address || "No address set in Settings";

    const logoSrc = fetchedLogo || EaristLogo;
    const name = companyName?.trim() || "";

    const words = name.split(" ");
    const middleIndex = Math.ceil(words.length / 2);
    const firstLine = words.slice(0, middleIndex).join(" ");
    const secondLine = words.slice(middleIndex).join(" ");


    const startTimeStr = proctor?.start_time
      ? new Date("1970-01-01T" + proctor.start_time).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      : "";
    const endTimeStr = proctor?.end_time
      ? new Date("1970-01-01T" + proctor.end_time).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      : "";

    // Only the .print-container's INNER markup — no <html>/<head>/<body>,
    // no onload print script. The server wraps this with matching CSS.
    const innerHtml = `
    <div class="print-header">

   

      <div class="header-content">
        <img src="${logoSrc}" alt="School Logo" />

        <div class="header-text">
          <div style="font-size: 12px; font-family: Arial">Republic of the Philippines</div>

          ${name
        ? `
              <b style="letter-spacing: 1px; font-size: 18px; font-family: Arial, sans-serif;">
                ${firstLine}
              </b>
              ${secondLine
          ? `<div style="letter-spacing: 1px; font-size: 18px; font-family: Arial, sans-serif;">
                       <b>${secondLine}</b>
                     </div>`
          : ""
        }
            `
        : ""
      }

          <div style="font-size: 12px; font-family: Arial">${resolvedAddress}</div>
        </div>
      </div>

      <div style="margin-top: 20px; text-align: center;">
        <b style="font-size: 20px; letter-spacing: 1px;">PROCTOR APPLICANT LIST</b>
      </div>

      <div class="info-row">
        <div class="info-row-line">
          <span><b>Proctor:</b> ${proctor?.proctor || "N/A"}</span>
          <span><b>Building:</b> ${proctor?.building_description || "N/A"}</span>
        </div>
        <div class="info-row-line">
          <span><b>Room:</b> ${proctor?.room_description || "N/A"}</span>
          <span><b>Schedule:</b> ${formatDateLong(proctor?.day_description) || ""} | ${startTimeStr} - ${endTimeStr}</span>
        </div>
      </div>
    </div>

    <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th style="width:10%">Applicant ID</th>
          <th style="width:30%">Applicant Name</th>
          <th style="width:40%">Program</th>
         
        </tr>
      </thead>
      <tbody>
        ${applicants
        .map((a) => {
          const programItem = curriculumOptions.find(
            (item) => item.curriculum_id?.toString() === a.program?.toString(),
          );
          const program = programItem
            ? `(${programItem.program_code}) - ${programItem.program_description} ${programItem.major || ""}`
            : "N/A";
          return `
              <tr>
                <td>${a.applicant_number}</td>
                <td class="applicant-name">${a.last_name}, ${a.first_name} ${a.middle_name || ""}</td>
                <td>${program}</td>
              
              </tr>
            `;
        })
        .join("")}
      </tbody>
    </table>
    </div>
  `;

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/generate-schedule-applicant-list-pdf`,
        {
          html: innerHtml,
          title: "PROCTOR APPLICANT LIST",
          fileNamePrefix: "Proctor_Applicant_List",
        },
        {
          responseType: "blob",
          headers: getFlatAuditHeaders(auditActor()),
        },
      );

      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", `Proctor_Applicant_List_${new Date().toISOString().slice(0, 10)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Failed to generate Proctor Applicant List PDF:", err);
      setSnack({
        open: true,
        message: "Failed to generate Proctor Applicant List PDF.",
        severity: "error",
        key: Date.now(),
      });
    }
  };

  // 🔎 Auto-search whenever searchQuery changes (debounced)
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchQuery.trim() !== "") {
        handleSearch();
      } else {
        setApplicants([]); // clear results if empty search
        setProctor(null);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const formatDateLong = (dateString) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    if (isNaN(date)) return dateString; // fallback if invalid date

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const headerFieldSx = {
    border: `1px solid ${borderColor}`,
    "& .MuiOutlinedInput-root": {
      backgroundColor: settings?.header_color || "#1976d2",
      borderRadius: 0,
      "& fieldset": { border: "none" },
    },
    "& .MuiOutlinedInput-input": {
      color: "white",
      textAlign: "center",
      fontWeight: "bold",
    },
  };

  // Put this at the very bottom before the return
  if (loading || hasAccess === null) {
    return <LoadingOverlay open={loading} message="Loading..." />;
  }

  if (!hasAccess) {
    return <Unauthorized />;
  }

  // 🔒 Disable right-click
  // document.addEventListener("contextmenu", (e) => e.preventDefault());

  // // 🔒 Block DevTools shortcuts + Ctrl+P silently
  // document.addEventListener("keydown", (e) => {
  //   const isBlockedKey =
  //     e.key === "F12" ||
  //     e.key === "F11" ||
  //     (e.ctrlKey &&
  //       e.shiftKey &&
  //       (e.key.toLowerCase() === "i" || e.key.toLowerCase() === "j")) ||
  //     (e.ctrlKey && e.key.toLowerCase() === "u") ||
  //     (e.ctrlKey && e.key.toLowerCase() === "p");

  //   if (isBlockedKey) {
  //     e.preventDefault();
  //     e.stopPropagation();
  //   }
  // });

  return (
    <Box
      sx={{
        height: "calc(100vh - 150px)",
        overflowY: "auto",
        paddingRight: 1,
        backgroundColor: "transparent",
        mt: 1,
        padding: 2,
      }}
    >
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={2}
        gap={2}
        flexWrap="wrap"
      >
        {/* LEFT: TITLE */}
        <Typography
          variant="h4"
          sx={{
            fontWeight: "bold",
            color: titleColor,
            fontSize: "36px",
            whiteSpace: "nowrap",
          }}
        >
          PROCTOR APPLICANT LIST
        </Typography>

        {/* RIGHT: CONTROLS */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            ml: "auto",
            flexWrap: "wrap",
          }}
        >
          {/* VIEW TOGGLE */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            size="small"
            disabled={!proctor}
            onChange={(e, newMode) => {
              if (newMode) setViewMode(newMode);
            }}
            sx={{
              backgroundColor: "#f0f0f0",
              borderRadius: "20px",
              p: 0.5,
              flexShrink: 0,
              opacity: proctor ? 1 : 0.5,

              "& .MuiToggleButtonGroup-grouped": {
                border: "none",
                borderRadius: "20px !important",
              },

              "& .MuiToggleButton-root": {
                textTransform: "none",
                fontWeight: 600,
                fontSize: "13px",
                px: 2,
                py: 0.5,
                color: "#757575",

                "&.Mui-selected": {
                  backgroundColor: settings?.header_color || "#1976d2",
                  color: "#fff",
                },

                "&.Mui-selected:hover": {
                  backgroundColor: settings?.header_color || "#1976d2",
                },
              },
            }}
          >
            <ToggleButton value="applicants">
              Applicant List
            </ToggleButton>

            <ToggleButton value="attendance">
              Attendance
            </ToggleButton>
          </ToggleButtonGroup>

          {/* SEARCH */}
          <TextField
            variant="outlined"
            placeholder="Search Proctor Name / Email"
            size="small"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
              handleSearch();
            }}
               sx={{
              width: 450,
              backgroundColor: "#fff",
              borderRadius: 1,
              "& .MuiOutlinedInput-root": {
                borderRadius: "10px",
              },
            }}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: "gray" }} />,
            }}
          />

          {/* DOWNLOAD APPLICANT LIST */}
          {viewMode === "applicants" && applicants.length > 0 && (
            <Button
              onClick={handleExportProctorApplicantListPdf}
              startIcon={<FcPrint size={20} />}
              sx={{
                height: "40px",
                px: 2,
                border: "2px solid black",
                backgroundColor: "#f0f0f0",
                color: "black",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "bold",
                whiteSpace: "nowrap",
                textTransform: "none",

                "&:hover": {
                  backgroundColor: "#d3d3d3",
                },

                "&:active": {
                  transform: "scale(0.97)",
                },
              }}
            >
              Download Applicant List
            </Button>
          )}
        </Box>
      </Box>
      <hr style={{ border: "1px solid #ccc", width: "100%" }} />



      <br />
      <br />
      <TableContainer
        component={Paper}
        sx={{ width: "100%", border: `1px solid ${borderColor}` }}
      >
        <Table>
          <TableHead
            sx={{ backgroundColor: settings?.header_color || "#1976d2" }}
          >
            <TableRow>
              <TableCell sx={{ color: "white", textAlign: "Center" }}>
             Proctor Applicant List / Applicant Attendance Report
              </TableCell>
            </TableRow>
          </TableHead>
        </Table>
      </TableContainer>
      {proctor && (

        <Box
          sx={{
            display: "flex",
            width: "100%",
            mb: 2,
          }}
        >
          <Paper
            sx={{
              width: "100%",
              p: 3,
              border: `1px solid ${borderColor}`,
              bgcolor: "white",
              boxShadow: "0 3px 12px rgba(0,0,0,0.1)",
              mb: 2,
            }}
          >
            <Grid container spacing={2}>
              {/* Proctor */}
              <Grid item xs={12} md={2.4}>
                <Typography textAlign="left" color="maroon" sx={{ mb: 1, fontWeight: "bold" }}>
                  Proctor:
                </Typography>
                <TextField
                  fullWidth
                  value={proctor?.proctor || "N/A"}
                  InputProps={{ readOnly: true }}
                  variant="outlined"
                  sx={{
                    border: `1px solid ${borderColor}`,
                    borderRadius: 2,
                    "& .MuiOutlinedInput-notchedOutline": { border: "none" },
                    bgcolor: "#f9f9f9",
                  }}
                />
              </Grid>

              {/* Building */}
              <Grid item xs={12} md={2.4}>
                <Typography textAlign="left" color="maroon" sx={{ mb: 1, fontWeight: "bold" }}>
                  Building:
                </Typography>
                <TextField
                  fullWidth
                  value={proctor?.building_description || "N/A"}
                  InputProps={{ readOnly: true }}
                  variant="outlined"
                  sx={{
                    border: `1px solid ${borderColor}`,
                    borderRadius: 2,
                    "& .MuiOutlinedInput-notchedOutline": { border: "none" },
                    bgcolor: "#f9f9f9",
                  }}
                />
              </Grid>

              {/* Room */}
              <Grid item xs={12} md={2.4}>
                <Typography textAlign="left" color="maroon" sx={{ mb: 1, fontWeight: "bold" }}>
                  Room:
                </Typography>
                <TextField
                  fullWidth
                  value={proctor?.room_description || "N/A"}
                  InputProps={{ readOnly: true }}
                  variant="outlined"
                  sx={{
                    border: `1px solid ${borderColor}`,
                    borderRadius: 2,
                    "& .MuiOutlinedInput-notchedOutline": { border: "none" },
                    bgcolor: "#f9f9f9",
                  }}
                />
              </Grid>

              {/* Schedule */}
              <Grid item xs={12} md={2.4}>
                <Typography textAlign="left" color="maroon" sx={{ mb: 1, fontWeight: "bold" }}>
                  Schedule:
                </Typography>
                <TextField
                  fullWidth
                  value={formatDateLong(proctor?.day_description) || "N/A"}
                  InputProps={{ readOnly: true }}
                  variant="outlined"
                  sx={{
                    border: `1px solid ${borderColor}`,
                    borderRadius: 2,
                    "& .MuiOutlinedInput-notchedOutline": { border: "none" },
                    bgcolor: "#f9f9f9",
                  }}
                />
              </Grid>

              {/* Time */}
              <Grid item xs={12} md={2.4}>
                <Typography textAlign="left" color="maroon" sx={{ mb: 1, fontWeight: "bold" }}>
                  Time:
                </Typography>
                <TextField
                  fullWidth
                  value={
                    proctor?.start_time && proctor?.end_time
                      ? `${new Date(`1970-01-01T${proctor.start_time}`).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })} - ${new Date(`1970-01-01T${proctor.end_time}`).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })}`
                      : "N/A"
                  }
                  InputProps={{ readOnly: true }}
                  variant="outlined"
                  sx={{
                    border: `1px solid ${borderColor}`,
                    borderRadius: 2,
                    "& .MuiOutlinedInput-notchedOutline": { border: "none" },
                    bgcolor: "#f9f9f9",
                  }}
                />
              </Grid>
            </Grid>
          </Paper>
        </Box>
      )}

      {viewMode === "applicants" && (
        <>
          {applicants.length === 0 && (
            <Box
              sx={{
                border: `1px dashed ${borderColor}`,
                borderRadius: 2,
                p: 3,
                textAlign: "center",
                backgroundColor: "#fafafa",
              }}
            >
              <Typography sx={{ fontWeight: "bold" }}>
                There are no applicants for this schedule.
              </Typography>
            </Box>
          )}

          {/* TableContainer */}
          {applicants.length > 0 && (
            <TableContainer component={Paper}>
              <Table>
                <TableHead
                  sx={{ backgroundColor: settings?.header_color || "#1976d2" }}
                >
                  <TableRow>
                    <TableCell
                      sx={{
                        color: "white",
                        textAlign: "center",
                        border: `1px solid ${borderColor}`,
                      }}
                    >
                      #
                    </TableCell>
                    <TableCell
                      sx={{
                        color: "white",
                        textAlign: "center",
                        border: `1px solid ${borderColor}`,
                      }}
                    >
                      Applicant
                    </TableCell>
                    <TableCell
                      sx={{
                        color: "white",
                        textAlign: "center",
                        border: `1px solid ${borderColor}`,
                      }}
                    >
                      Name
                    </TableCell>
                    <TableCell
                      sx={{
                        color: "white",
                        textAlign: "center",
                        border: `1px solid ${borderColor}`,
                      }}
                    >
                      Program
                    </TableCell>
                    <TableCell
                      sx={{
                        color: "white",
                        textAlign: "center",
                        border: `1px solid ${borderColor}`,
                      }}
                    >
                      Building
                    </TableCell>
                    <TableCell
                      sx={{
                        color: "white",
                        textAlign: "center",
                        border: `1px solid ${borderColor}`,
                      }}
                    >
                      Room
                    </TableCell>
                    <TableCell
                      sx={{
                        color: "white",
                        textAlign: "center",
                        border: `1px solid ${borderColor}`,
                      }}
                    >
                      Action
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody
                  sx={{
                    border: `1px solid ${borderColor}`,
                    "& .MuiTableRow-root:nth-of-type(odd)": {
                      backgroundColor: "#ffffff",
                    },
                    "& .MuiTableRow-root:nth-of-type(even)": {
                      backgroundColor: "lightgray",
                    },
                  }}
                >
                  {applicants.map((a, idx) => (
                    <TableRow key={idx}>
                      <TableCell
                        align="center"
                        sx={{ border: `1px solid ${borderColor}` }}
                      >
                        {idx + 1}
                      </TableCell>
                      <TableCell
                        align="left"
                        sx={{ border: `1px solid ${borderColor}` }}
                      >
                        {a.applicant_number}
                      </TableCell>
                      <TableCell
                        align="left"
                        sx={{ border: `1px solid ${borderColor}` }}
                      >
                        {`${a.last_name}, ${a.first_name} ${a.middle_name || ""}`}
                      </TableCell>
                      <TableCell
                        align="left"
                        sx={{ border: `1px solid ${borderColor}` }}
                      >
                        {(() => {
                          const item = curriculumOptions.find(
                            (x) =>
                              x.curriculum_id?.toString() === a.program?.toString(),
                          );

                          return item
                            ? `(${item.program_code}) - ${item.program_description} ${item.major || ""}`
                            : "N/A";
                        })()}
                      </TableCell>

                      <TableCell
                        align="left"
                        sx={{ border: `1px solid ${borderColor}` }}
                      >
                        {a.building_description ||
                          proctor?.building_description ||
                          "N/A"}{" "}
                        {/* ✅ NEW */}
                      </TableCell>
                      <TableCell
                        align="left"
                        sx={{ border: `1px solid ${borderColor}` }}
                      >
                        {a.room_description || proctor?.room_description || "N/A"}{" "}
                        {/* ✅ NEW */}
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{ border: `1px solid ${borderColor}` }}
                      >
                        <IconButton
                          color="error"
                          onClick={() => {
                            setApplicantToDelete(a);
                            setOpenDeleteDialog(true);
                          }}
                          sx={{
                            backgroundColor: "#ffebee",
                            border: "2px solid red",
                            "&:hover": { backgroundColor: "#ffcdd2" },
                            borderRadius: "8px",
                          }}
                        >
                          <CloseIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {viewMode === "attendance" && proctor && (
        <>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 2,
              mb: 2,
            }}
          >
            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 2,
                  py: 0.75,
                  borderRadius: "20px",
                  backgroundColor: "#e8f5e9",
                  border: "1px solid #a5d6a7",
                }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#2e7d32" }} />
                <Typography sx={{ fontSize: "13px", fontWeight: 700, color: "#2e7d32" }}>
                  Present: {presentCount}
                </Typography>
              </Box>

              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 2,
                  py: 0.75,
                  borderRadius: "20px",
                  backgroundColor: "#ffebee",
                  border: "1px solid #ef9a9a",
                }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#c62828" }} />
                <Typography sx={{ fontSize: "13px", fontWeight: 700, color: "#c62828" }}>
                  Absent: {absentCount}
                </Typography>
              </Box>

              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 2,
                  py: 0.75,
                  borderRadius: "20px",
                  backgroundColor: "#f5f5f5",
                  border: "1px solid #e0e0e0",
                }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#757575" }} />
                <Typography sx={{ fontSize: "13px", fontWeight: 700, color: "#616161" }}>
                  Not Yet Arrived: {notArrivedCount}
                </Typography>
              </Box>
            </Box>

            <Button
              variant="contained"
              onClick={handleMarkAbsent}
              sx={{
                backgroundColor: "#d32f2f",
                textTransform: "none",
                fontWeight: 700,
                fontSize: "13px",
             
                px: 2.5,
                boxShadow: "none",
                "&:hover": { backgroundColor: "#b71c1c", boxShadow: "none" },
              }}
            >
              Mark Remaining as Absent
            </Button>
          </Box>

          <TableContainer
            component={Paper}
            sx={{ border: `1px solid ${borderColor}` }}
          >
            <Table>
              <TableHead sx={{ backgroundColor: settings?.header_color || "#1976d2" }}>
                <TableRow>
                  <TableCell
                    sx={{ color: "white", textAlign: "center", border: `1px solid ${borderColor}` }}
                  >
                    #
                  </TableCell>
                  <TableCell
                    sx={{ color: "white", textAlign: "center", border: `1px solid ${borderColor}` }}
                  >
                    Applicant ID
                  </TableCell>
                  <TableCell
                    sx={{ color: "white", textAlign: "center", border: `1px solid ${borderColor}` }}
                  >
                    Name
                  </TableCell>
                  <TableCell
                    sx={{ color: "white", textAlign: "center", border: `1px solid ${borderColor}` }}
                  >
                    Status
                  </TableCell>
                  <TableCell
                    sx={{ color: "white", textAlign: "center", border: `1px solid ${borderColor}` }}
                  >
                    Scanned At
                  </TableCell>
                  <TableCell
                    sx={{ color: "white", textAlign: "center", border: `1px solid ${borderColor}` }}
                  >
                    Scanned By
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody
                sx={{
                  border: `1px solid ${borderColor}`,
                  "& .MuiTableRow-root:nth-of-type(odd)": {
                    backgroundColor: "#ffffff",
                  },
                  "& .MuiTableRow-root:nth-of-type(even)": {
                    backgroundColor: "lightgray",
                  },
                }}
              >
                {attendanceRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      sx={{ textAlign: "center", p: 2, border: `1px solid ${borderColor}` }}
                    >
                      No applicants found for this schedule.
                    </TableCell>
                  </TableRow>
                ) : (
                  attendanceRows.map((r, i) => (
                    <TableRow key={r.applicant_id}>
                      <TableCell align="center" sx={{ border: `1px solid ${borderColor}` }}>
                        {i + 1}
                      </TableCell>
                      <TableCell align="left" sx={{ border: `1px solid ${borderColor}` }}>
                        {r.applicant_id}
                      </TableCell>
                      <TableCell align="left" sx={{ border: `1px solid ${borderColor}` }}>
                        {`${r.last_name}, ${r.first_name} ${r.middle_name || ""}`}
                      </TableCell>
                      <TableCell align="left" sx={{ border: `1px solid ${borderColor}` }}>
                        {statusChip(r.status)}
                      </TableCell>
                      <TableCell align="left" sx={{ border: `1px solid ${borderColor}` }}>
                        {r.scanned_at
                          ? new Date(r.scanned_at).toLocaleString("en-US", {
                            timeZone: "Asia/Manila",
                          })
                          : "—"}
                      </TableCell>
                      <TableCell align="left" sx={{ border: `1px solid ${borderColor}` }}>
                        {r.scanned_by || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* ✅ Snackbar */}
      <Snackbar
        key={snack.key}
        open={snack.open}
        autoHideDuration={4000}
        onClose={handleClose}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={handleClose}
          severity={snack.severity}
          sx={{ width: "100%" }}
        >
          {snack.message}
        </Alert>
      </Snackbar>

      <Dialog
        open={openDeleteDialog}
        onClose={() => { setOpenDeleteDialog(false); setApplicantToDelete(null); }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle
          sx={{
            background: settings?.header_color || "#9E0000",
            color: "#fff",
            fontWeight: 700,
            fontSize: "1.2rem",
            py: 2,
          }}
        >
          Remove Applicant
        </DialogTitle>

        <DialogContent sx={{ p: 3, mt: 2 }}>
          <Typography sx={{ mb: 2 }}>
            Are you sure you want to remove applicant{" "}
            <strong>{applicantToDelete?.last_name}, {applicantToDelete?.first_name}</strong>{" "}
            from the exam schedule?
          </Typography>

          <Typography sx={{ color: "#d32f2f", fontSize: "0.95rem" }}>
            Removing this applicant will unassign them from the current exam schedule.
            <br />
            They will need to be reassigned to another schedule if necessary.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            color="error"
            variant="outlined"
            onClick={() => { setOpenDeleteDialog(false); setApplicantToDelete(null); }}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={async () => {
              if (!applicantToDelete) return;
              try {
                await axios.put(`${API_BASE_URL}/api/exam/remove_applicant`, {
                  applicant_id: applicantToDelete.applicant_number,
                  ...auditActor(),
                });
                setApplicants((prev) => prev.filter((a) => a.applicant_number !== applicantToDelete.applicant_number));
                setSnack({ open: true, message: "Applicant successfully removed.", severity: "success", key: Date.now() });
              } catch (error) {
                setSnack({ open: true, message: "Failed to remove applicant.", severity: "error", key: Date.now() });
              }
              setOpenDeleteDialog(false);
              setApplicantToDelete(null);
            }}
          >
            Yes, Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProctorApplicantList;
