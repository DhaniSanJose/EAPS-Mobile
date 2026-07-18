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
} from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import { FcPrint } from "react-icons/fc";
import EaristLogo from "../assets/EaristLogo.png";
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

const EvaluatorApplicantList = () => {
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
    }
  }, [settings]);

  const words = companyName.trim().split(" ");
  const middle = Math.ceil(words.length / 2);
  const firstLine = words.slice(0, middle).join(" ");
  const secondLine = words.slice(middle).join(" ");

  const location = useLocation();

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

  // Also put it at the very top
  const [userID, setUserID] = useState("");
  const [user, setUser] = useState("");
  const [userRole, setUserRole] = useState("");
  const [hasAccess, setHasAccess] = useState(null);
  const [loading, setLoading] = useState(false);

  const pageId = 120;

  const [employeeID, setEmployeeID] = useState("");

  const withAuditActor = (payload = {}) => ({
    ...payload,
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
  const [evaluator, setEvaluator] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [person, setPerson] = useState({
    campus: "",
    last_name: "",
    first_name: "",
    middle_name: "",
    program: "",
    extension: "",
  });

  const handleSearchByEvaluator = async (evaluatorName, scheduleID) => {
    const { data } = await axios.get(`${API_BASE_URL}/api/evaluator-applicants`, {
      params: { query: evaluatorName, schedule_id: scheduleID },
    });

    if (data.length === 0) {
      setEvaluator(null);
      setApplicants([]);
      return;
    }

    setEvaluator(data[0].schedule);

    const mergedApplicants = data.flatMap((d) => d.applicants);
    setApplicants(mergedApplicants);
  };

  const handleSearch = async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/evaluator-applicants`, {
        params: { query: searchQuery },
      });

      if (data.length === 0) {
        setEvaluator(null);
        setApplicants([]);
        return;
      }

      setEvaluator(data[0].schedule);

      const mergedApplicants = data.flatMap((d) => d.applicants);
      setApplicants(mergedApplicants);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const evaluatorParam = params.get("evaluator");
    const scheduleParam = params.get("schedule");

    if (evaluatorParam) {
      setSearchQuery(evaluatorParam);
      handleSearchByEvaluator(evaluatorParam, scheduleParam);
    }
  }, [location.search]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setApplicants([]);
      setEvaluator(null);
      return;
    }

    const delay = setTimeout(() => {
      handleSearch();
    }, 400);

    return () => clearTimeout(delay);
  }, [searchQuery]);

  const [curriculumOptions, setCurriculumOptions] = useState([]);

  useEffect(() => {
    const fetchCurriculums = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/applied_program`);
        setCurriculumOptions(response.data);
      } catch (error) {
        console.error("Error fetching curriculum options:", error);
      }
    };

    fetchCurriculums();
  }, []);

 

  const handleExportEvaluatorApplicantListPdf = async () => {
    const resolvedAddress = campusAddress || settings?.address || "No address set in Settings";

    const logoSrc = fetchedLogo || EaristLogo;
    const name = companyName?.trim() || "";

    const words = name.split(" ");
    const middleIndex = Math.ceil(words.length / 2);
    const firstLine = words.slice(0, middleIndex).join(" ");
    const secondLine = words.slice(middleIndex).join(" ");

  

    const startTimeStr = evaluator?.start_time
      ? new Date("1970-01-01T" + evaluator.start_time).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      : "";
    const endTimeStr = evaluator?.end_time
      ? new Date("1970-01-01T" + evaluator.end_time).toLocaleTimeString("en-US", {
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
        <b style="font-size: 20px; letter-spacing: 1px;">EVALUATOR APPLICANT LIST</b>
      </div>

      <div class="info-row">
        <div class="info-row-line">
          <span><b>Evaluator:</b> ${evaluator?.evaluator || "N/A"}</span>
          <span><b>Building:</b> ${evaluator?.building_description || "N/A"}</span>
        </div>
        <div class="info-row-line">
          <span><b>Room:</b> ${evaluator?.room_description || "N/A"}</span>
          <span><b>Schedule:</b> ${formatDateLong(evaluator?.schedule_date) || ""} | ${startTimeStr} - ${endTimeStr}</span>
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

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/generate-schedule-applicant-list-pdf`,
        {
          html: innerHtml,
          title: "EVALUATOR APPLICANT LIST",
          fileNamePrefix: "Evaluator_Applicant_List",
        },
        {
          responseType: "blob",
          headers: getFlatAuditHeaders(withAuditActor()),
        },
      );

      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", `Evaluator_Applicant_List_${new Date().toISOString().slice(0, 10)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Failed to generate Evaluator Applicant List PDF:", err);
      setSnack({
        open: true,
        message: "Failed to generate Evaluator Applicant List PDF.",
        severity: "error",
        key: new Date().getTime(),
      });
    }
  };


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

  // Put this at the very bottom before the return
  if (loading || hasAccess === null) {
    return <LoadingOverlay open={loading} message="Loading..." />;
  }

  if (!hasAccess) {
    return <Unauthorized />;
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
        <Typography
          variant="h4"
          sx={{
            fontWeight: "bold",
            color: titleColor,
            fontSize: "36px",
          }}
        >
          EVALUATOR APPLICANT LIST
        </Typography>

        <TextField
          variant="outlined"
          placeholder="Search Evaluator Name / Email"
          size="small"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
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

      <AdmissionRoomAssignmentTabs />

      <br />
      <br />

      {evaluator && (
        <Box
          sx={{
            display: "flex",
            gap: 4,
            flexWrap: "wrap",

            mb: 2,
            fontSize: "16px",
          }}
        >
          <span>
            <b>Evaluator:</b> {evaluator.evaluator || "N/A"} |{" "}
          </span>
          <span>
            <b>Building:</b> {evaluator.building_description || "N/A"} |{" "}
          </span>
          <span>
            <b>Room:</b> {evaluator.room_description || "N/A"} |{" "}
          </span>
          <span>
            <b>Schedule:</b> {formatDateLong(evaluator?.schedule_date)} |{" "}
          </span>

          <span>
            <b>Time: </b>
            {evaluator.start_time
              ? new Date(
                `1970-01-01T${evaluator.start_time}`,
              ).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })
              : ""}{" "}
            -{" "}
            {evaluator.end_time
              ? new Date(`1970-01-01T${evaluator.end_time}`).toLocaleTimeString(
                "en-US",
                {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                },
              )
              : ""}
          </span>
        </Box>
      )}

      {applicants.length > 0 && (
        <Button
          onClick={handleExportEvaluatorApplicantListPdf}
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
                      evaluator?.building_description ||
                      "N/A"}{" "}
                    {/* ✅ NEW */}
                  </TableCell>
                  <TableCell
                    align="left"
                    sx={{ border: `1px solid ${borderColor}` }}
                  >
                    {a.room_description || evaluator?.room_description || "N/A"}{" "}
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
                  from the exam schedule?
                </Typography>

                <Typography sx={{ color: "#d32f2f", fontSize: "0.95rem" }}>
                  Removing this applicant will unassign them from the current schedule.
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
                      await axios.post(
                        `${API_BASE_URL}/api/unassign_verify_evaluator_applicant_list`,
                        withAuditActor({ applicant_number: applicantToDelete.applicant_number }),
                      );
                      setSnack({ open: true, message: "Applicant successfully removed.", severity: "success", key: new Date().getTime() });
                      handleSearchByEvaluator(evaluator.evaluator, evaluator.schedule_id);
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

export default EvaluatorApplicantList;
