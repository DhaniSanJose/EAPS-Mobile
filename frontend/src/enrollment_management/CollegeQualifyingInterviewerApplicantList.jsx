import React, { useState, useEffect, useContext, useRef } from "react";
import { SettingsContext } from "../App";
import axios from "axios";
import {
  Box,
  TextField,
  Button,
  Typography,
  Table,
  Card,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  TableContainer,
} from "@mui/material";
import API_BASE_URL from "../apiConfig";
import { Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search } from "@mui/icons-material";
import { FcPrint } from "react-icons/fc";
import EaristLogo from "../assets/EaristLogo.png";
import SchoolIcon from '@mui/icons-material/School';
import AssignmentIcon from '@mui/icons-material/Assignment';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PeopleIcon from '@mui/icons-material/People';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";
import SearchIcon from "@mui/icons-material/Search";
import MenuBookIcon from '@mui/icons-material/MenuBook';
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import { Snackbar, Alert } from "@mui/material";
import {
  isRegistrarCurriculumMatch,
  restrictToRegistrarCurriculum,
} from "../utils/registrarCurriculumRestriction";
import useRegistrarScopeRevision from "../hooks/useRegistrarScopeRevision";


const InterviewerApplicantList = () => {
  const location = useLocation();


  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const scheduleId = params.get("schedule");
    const interviewerName = params.get("interviewer");

    if (scheduleId) {
      setSearchQuery(interviewerName || "");  // pre-fill search bar
      handleSearch(scheduleId); // immediately fetch applicants for this schedule
    }
  }, [location.search]);

  const settings = useContext(SettingsContext);
  const [fetchedLogo, setFetchedLogo] = useState(null);
  const [companyName, setCompanyName] = useState("");

  const [userID, setUserID] = useState("");
  const [user, setUser] = useState("");
  const [userRole, setUserRole] = useState("");
  const [hasAccess, setHasAccess] = useState(null);
  const [loading, setLoading] = useState(false);

  const pageId = 36;

  // ✅ Snackbar State
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    severity: "success",
    key: new Date().getTime(),
  });

  const handleCloseSnack = (event, reason) => {
    if (reason === "clickaway") return;

    setSnack((prev) => ({
      ...prev,
      open: false,
    }));
  };

  const handleOpenDeleteDialog = (applicant) => {
    setApplicantToDelete(applicant);
    setOpenDeleteDialog(true);
  };


  const [titleColor, setTitleColor] = useState("#000000");
  const [subtitleColor, setSubtitleColor] = useState("#555555");
  const [borderColor, setBorderColor] = useState("#000000");
  const [mainButtonColor, setMainButtonColor] = useState("#1976d2");
  const [subButtonColor, setSubButtonColor] = useState("#ffffff");   // ✅ NEW
  const [stepperColor, setStepperColor] = useState("#000000");       // ✅ NEW

  const [shortTerm, setShortTerm] = useState("");
  const [campusAddress, setCampusAddress] = useState("");
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    if (!settings) return;

    // 🎨 Colors
    if (settings.title_color) setTitleColor(settings.title_color);
    if (settings.subtitle_color) setSubtitleColor(settings.subtitle_color);
    if (settings.border_color) setBorderColor(settings.border_color);
    if (settings.main_button_color) setMainButtonColor(settings.main_button_color);
    if (settings.sub_button_color) setSubButtonColor(settings.sub_button_color);   // ✅ NEW
    if (settings.stepper_color) setStepperColor(settings.stepper_color);           // ✅ NEW

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

  const [employeeID, setEmployeeID] = useState("");

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
      const response = await axios.get(`${API_BASE_URL}/api/page_access/${employeeID}/${pageId}`);
      if (response.data && response.data.page_privilege === 1) {
        setHasAccess(true);
      } else {
        setHasAccess(false);
      }
    } catch (error) {
      console.error('Error checking access:', error);
      setHasAccess(false);
      if (error.response && error.response.data.message) {
        console.log(error.response.data.message);
      } else {
        console.log("An unexpected error occurred.");
      }
      setLoading(false);
    }
  };


  useEffect(() => {
    if (settings) {
      // ✅ load dynamic logo
      if (settings.logo_url) {
        setFetchedLogo(`${API_BASE_URL}${settings.logo_url}`);
      } else {
        setFetchedLogo(EaristLogo);
      }

      // ✅ load dynamic name + address
      if (settings.company_name) setCompanyName(settings.company_name);
      if (settings.campus_address) setCampusAddress(settings.campus_address);
    }
  }, [settings]);

  const words = companyName.trim().split(" ");
  const middle = Math.ceil(words.length / 2);
  const firstLine = words.slice(0, middle).join(" ");
  const secondLine = words.slice(middle).join(" ");


  // const tabs = [

  //   { label: "Qualifying / Interview Room Assignment", to: "/assign_qualifying_interview_exam", icon: <MeetingRoomIcon fontSize="large" /> },
  //   { label: "Qualifying / Interview Schedule Management", to: "/college_qualifying_interview_schedule_management", icon: <ScheduleIcon fontSize="large" /> },
  //   { label: "Qualifying / Interviewer Applicant's List", to: "/enrollment_schedule_room_list", icon: <PeopleIcon fontSize="large" /> },




  // ];



  const navigate = useNavigate();
  // const [activeStep, setActiveStep] = useState(2);
  // const [clickedSteps, setClickedSteps] = useState(Array(tabs.length).fill(false));
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [applicantToDelete, setApplicantToDelete] = useState(null);

  const handleStepClick = (index, to) => {
    setActiveStep(index);
    navigate(to); // this will actually change the page
  };



  const [searchQuery, setSearchQuery] = useState("");
  const [interviewerData, setInterviewerData] = useState(null);

  const [applicants, setApplicants] = useState([]);
  const [person, setPerson] = useState({
    campus: "",
    last_name: "",
    first_name: "",
    middle_name: "",
    program: "",
    extension: "",


  });

  const handleSearch = async (scheduleId = null, query = searchQuery) => {
    try {
      const params = new URLSearchParams(location.search);
      const selectedScheduleId = scheduleId || params.get("schedule");

      const { data } = await axios.get(`${API_BASE_URL}/api/interviewers`, {
        params: {
          query,
          schedule: selectedScheduleId, // keep the clicked schedule filter
        },
      });

      setInterviewerData(data[0]?.schedule || null);
      setApplicants((data[0]?.applicants || []).filter((applicant) =>
        isRegistrarCurriculumMatch(applicant.program)
      ));
    } catch (err) {
      console.error(err);
    }
  };



  const [curriculumOptions, setCurriculumOptions] = useState([]);

  const scopeRevision = useRegistrarScopeRevision();

  useEffect(() => {
    const fetchCurriculums = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/applied_program`);
        console.log("✅ curriculumOptions:", response.data); // <--- add this
        setCurriculumOptions(restrictToRegistrarCurriculum(response.data));
      } catch (error) {
        console.error("Error fetching curriculum options:", error);
      }
    };

    fetchCurriculums();
  }, [scopeRevision]);

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



  const [exportingList, setExportingList] = useState(false);

  const handleExportInterviewerApplicantListPdf = async () => {
    setExportingList(true);
    try {
      const resolvedAddress = campusAddress || settings?.address || "No address set in Settings";
      const logoSrc = fetchedLogo || EaristLogo;
      const name = companyName?.trim() || "";

      const words = name.split(" ");
      const middleIndex = Math.ceil(words.length / 2);
      const firstLine = words.slice(0, middleIndex).join(" ");
      const secondLine = words.slice(middleIndex).join(" ");

      const startTimeStr = interviewerData?.start_time
        ? new Date("1970-01-01T" + interviewerData.start_time).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
        : "";
      const endTimeStr = interviewerData?.end_time
        ? new Date("1970-01-01T" + interviewerData.end_time).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
        : "";

      const innerHtml = `
      <div class="print-header">
        <div class="header-content">
          <img src="${logoSrc}" alt="School Logo" />
          <div class="header-text">
            <div style="font-size: 12px; font-family: Arial">Republic of the Philippines</div>
            ${name
          ? `<b style="letter-spacing: 1px; font-size: 18px; font-family: Arial, sans-serif;">${firstLine}</b>
                 ${secondLine ? `<div style="letter-spacing: 1px; font-size: 18px; font-family: Arial, sans-serif;"><b>${secondLine}</b></div>` : ""}`
          : ""}
            <div style="font-size: 12px; font-family: Arial">${resolvedAddress}</div>
          </div>
        </div>

        <div style="margin-top: 20px; text-align: center;">
          <b style="font-size: 20px; letter-spacing: 1px;">INTERVIEWER / QUALIFYING APPLICANT LIST</b>
        </div>

        <div class="info-row">
          <div class="info-row-line">
            <span><b>Interviewer:</b> ${interviewerData?.interviewer || "N/A"}</span>
            <span><b>Building:</b> ${interviewerData?.building_description || "N/A"}</span>
          </div>
          <div class="info-row-line">
            <span><b>Room:</b> ${interviewerData?.room_description || "N/A"}</span>
            <span><b>Schedule:</b> ${interviewerData?.day_description || ""} | ${startTimeStr} - ${endTimeStr}</span>
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
              <th style="width:20%">Signature</th>
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
                    <td></td>
                  </tr>
                `;
          })
          .join("")}
          </tbody>
        </table>
      </div>
    `;

      const response = await axios.post(
        `${API_BASE_URL}/api/generate-schedule-applicant-list-pdf`,
        {
          html: innerHtml,
          title: "INTERVIEWER APPLICANT LIST",
          fileNamePrefix: "Interviewer_Applicant_List",
        },
        { responseType: "blob" },
      );

      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", `Interviewer_Applicant_List_${new Date().toISOString().slice(0, 10)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Failed to generate Interviewer Applicant List PDF:", err);
      setSnack({
        open: true,
        message: "Failed to generate Interviewer Applicant List PDF.",
        severity: "error",
        key: new Date().getTime(),
      });
    } finally {
      setExportingList(false);
    }
  };

  // 🔎 Auto-search whenever searchQuery changes (debounced)
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchQuery.trim() !== "") {
        handleSearch();
      } else {
        setApplicants([]); // clear results if empty search
        setInterviewerData(null);

      }
    }, 500); // 500ms debounce

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);


  // Put this at the very bottom before the return 
  if (loading || hasAccess === null) {
    return <LoadingOverlay open={loading} message="Loading..." />;
  }

  if (!hasAccess) {
    return (
      <Unauthorized />
    );
  }

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
      >
        <Typography variant="h4"
          sx={{
            fontWeight: 'bold',
            color: titleColor,
            fontSize: '36px',
          }}
        >
          INTERVIEWER / QUALIFYING APPLICANT LIST
        </Typography>


        <TextField
          variant="outlined"
          placeholder="Search Qualifying / Interviewer Name / Email"
          size="small"

          value={searchQuery}
          onChange={(e) => {
            const value = e.target.value;
            setSearchQuery(value);
            handleSearch(null, value);
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
      </Box>

      <hr style={{ border: "1px solid #ccc", width: "100%" }} />

      <br />
      <br />

      {/* <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "nowrap", // ❌ prevent wrapping
          width: "100%",

          gap: 2,
        }}
      >
        {tabs.map((tab, index) => (
          <Card
            key={index}
            onClick={() => handleStepClick(index, tab.to)}
            sx={{
              flex: `1 1 ${100 / tabs.length}%`, // evenly divide row
              height: 135,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              borderRadius: 2,
              border: `1px solid ${borderColor}`,
              backgroundColor:
                activeStep === index
                  ? settings?.header_color || "#1976d2"
                  : "#E8C999",
              color: activeStep === index ? "#fff" : "#000",
              boxShadow:
                activeStep === index
                  ? "0px 4px 10px rgba(0,0,0,0.3)"
                  : "0px 2px 6px rgba(0,0,0,0.15)",
              transition: "0.3s ease",
              "&:hover": {
                backgroundColor: activeStep === index ? "#000000" : "#f5d98f",
              },
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <Box sx={{ fontSize: 40, mb: 1 }}>{tab.icon}</Box>
              <Typography
                sx={{ fontSize: 14, fontWeight: "bold", textAlign: "center" }}
              >
                {tab.label}
              </Typography>
            </Box>
          </Card>
        ))}
      </Box> */}



      {interviewerData && (
        <Box
          sx={{
            display: "flex",
            gap: 4,
            flexWrap: "wrap",

            mb: 2,
            fontSize: "16px",
          }}
        >
          <span><b>Interviewer:</b> {interviewerData.interviewer || "N/A"}</span>
          <span><b>Building:</b> {interviewerData.building_description || "N/A"}</span>
          <span><b>Room:</b> {interviewerData.room_description || "N/A"}</span>
          <span>
            <b>Schedule:</b> {interviewerData.day_description || ""} |{" "}
            {interviewerData.start_time
              ? new Date(`1970-01-01T${interviewerData.start_time}`).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })
              : ""}{" "}
            -{" "}
            {interviewerData.end_time
              ? new Date(`1970-01-01T${interviewerData.end_time}`).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })
              : ""}
          </span>

        </Box>
      )}


      {applicants.length > 0 && (
        <Button
          onClick={handleExportInterviewerApplicantListPdf}
          variant="outlined"
          sx={{
            padding: "5px 20px",
            border: "2px solid black",
            backgroundColor: "#f0f0f0",
            color: "black",
            borderRadius: "5px",
            fontSize: "14px",
            fontWeight: "bold",
            height: "40px",
            display: "flex",
            alignItems: "center",
            gap: 1, // 8px gap between icon and text
            userSelect: "none",
            transition: "background-color 0.3s, transform 0.2s",
            "&:hover": {
              backgroundColor: "#d3d3d3",
            },
            "&:active": {
              transform: "scale(0.95)",
            },
          }}
          startIcon={<FcPrint size={20} />}
        >
          Download Applicant List
        </Button>

      )}
      <br />

      {/* TableContainer */}
      {applicants.length === 0 && (
        <Box
          sx={{
            border: `2px dashed ${borderColor}`,
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

      {applicants.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead sx={{ backgroundColor: settings?.header_color || "#1976d2" }}>
              <TableRow>
                <TableCell sx={{ color: "white", textAlign: "center", border: `2px solid ${borderColor}` }}>#</TableCell>
                <TableCell sx={{ color: "white", textAlign: "center", border: `2px solid ${borderColor}` }}>Applicant</TableCell>
                <TableCell sx={{ color: "white", textAlign: "center", border: `2px solid ${borderColor}` }}>Name</TableCell>
                <TableCell sx={{ color: "white", textAlign: "center", border: `2px solid ${borderColor}` }}>Program</TableCell>
                <TableCell sx={{ color: "white", textAlign: "center", border: `2px solid ${borderColor}` }}>Building</TableCell>
                <TableCell sx={{ color: "white", textAlign: "center", border: `2px solid ${borderColor}` }}>Room</TableCell>
                <TableCell sx={{ color: "white", textAlign: "center", border: `2px solid ${borderColor}` }}>
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
                  <TableCell align="center" sx={{ border: `2px solid ${borderColor}` }}>{idx + 1}</TableCell>
                  <TableCell align="left" sx={{ border: `2px solid ${borderColor}` }}>{a.applicant_number}</TableCell>
                  <TableCell align="left" sx={{ border: `2px solid ${borderColor}` }}>
                    {`${a.last_name}, ${a.first_name} ${a.middle_name || ""}`}
                  </TableCell>
                  <TableCell align="left" sx={{ border: `2px solid ${borderColor}` }}>
                    {(() => {
                      const programItem = curriculumOptions.find(
                        (item) => item.curriculum_id?.toString() === a.program?.toString()
                      );
                      return programItem
                        ? `(${programItem.program_code}) - ${programItem.program_description} ${programItem.major || ""}`
                        : "N/A";
                    })()}
                  </TableCell>

                  <TableCell align="left" sx={{ border: `2px solid ${borderColor}` }}>
                    {a.building_description || interviewerData?.building_description || "N/A"} {/* ✅ NEW */}
                  </TableCell>
                  <TableCell align="left" sx={{ border: `2px solid ${borderColor}` }}>
                    {a.room_description || interviewerData?.room_description || "N/A"} {/* ✅ NEW */}
                  </TableCell>
                  <TableCell align="center" sx={{ border: `2px solid ${borderColor}` }}>
                    <IconButton
                      color="error"
                      onClick={() => handleOpenDeleteDialog(a)}
                      sx={{
                        backgroundColor: "#ffebee",
                        border: "2px solid red",
                        "&:hover": {
                          backgroundColor: "#ffcdd2",
                        },
                        borderRadius: "8px",
                      }}
                    >
                      <CloseIcon />
                    </IconButton>
                  </TableCell>

                </TableRow>
              ))}
            </TableBody>

            {/* ✅ Snackbar */}
            <Snackbar
              key={snack.key}
              open={snack.open}
              autoHideDuration={4000}
              onClose={handleCloseSnack}
              anchorOrigin={{ vertical: "top", horizontal: "center" }}
            >
              <Alert
                onClose={handleCloseSnack}
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
                  from the interview schedule?
                </Typography>

                <Typography sx={{ color: "#d32f2f", fontSize: "0.95rem" }}>
                  Removing this applicant will unassign them from the current interview schedule.
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
                      await axios.put(`${API_BASE_URL}/api/interview/remove_applicant`, {
                        applicant_id: applicantToDelete.applicant_number,
                      });
                      setSnack({ open: true, message: "Applicant successfully removed.", severity: "success", key: new Date().getTime() });
                      handleSearch();
                    } catch (error) {
                      console.error("Error removing applicant:", error);
                      setSnack({ open: true, message: "Failed to remove applicant.", severity: "error", key: new Date().getTime() });
                    }
                    setOpenDeleteDialog(false);
                    setApplicantToDelete(null);
                  }}
                >
                  Yes, Remove
                </Button>
              </DialogActions>
            </Dialog>


          </Table>
        </TableContainer>

      )}
    </Box>
  );
};

export default InterviewerApplicantList;
