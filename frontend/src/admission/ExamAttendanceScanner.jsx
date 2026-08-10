// src/admission/ExamAttendanceScanner.jsx
import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  useLayoutEffect,
} from "react";
import { SettingsContext } from "../App";
import axios from "axios";
import { QRCodeSVG } from "qrcode.react";
import {
  Box,
  TextField,
  Autocomplete,
  Alert,
  Button,
  Typography,
  Stack,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import EaristLogo from "../assets/EaristLogo.png";
import "../styles/Print.css";
import API_BASE_URL from "../apiConfig";
import QRScanner from "../components/QRScanner";
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";

const PAGE_ID = 171;

// Fixed print dimensions (8.5in @ 96dpi). Used to scale the permit down to
// fit small screens while keeping the print output exactly the same size.
const PERMIT_WIDTH_PX = 816; // 8.5in * 96dpi

const cleanSuggestionValue = (value) => {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return ["null", "undefined"].includes(text.toLowerCase()) ? "" : text;
};

const getApplicantSuggestionText = (applicant) =>
  [
    applicant?.applicant_number,
    applicant?.first_name,
    applicant?.middle_name,
    applicant?.last_name,
    applicant?.emailAddress,
    applicant?.email,
  ]
    .map(cleanSuggestionValue)
    .join(" ")
    .toLowerCase();

const getApplicantSuggestionName = (applicant) =>
  [
    applicant?.last_name,
    applicant?.first_name,
    applicant?.middle_name,
    applicant?.extension,
  ]
    .map(cleanSuggestionValue)
    .filter(Boolean)
    .join(", ");

const ExamAttendanceScanner = () => {
  const settings = useContext(SettingsContext);
  const theme = useTheme();

  // ---------------- Responsive breakpoints ----------------
  const isMobile = useMediaQuery(theme.breakpoints.down("sm")); // <600px (phones)
  const isTablet = useMediaQuery(theme.breakpoints.down("md")); // <900px (phones + small tablets)

  const colors = settings?.colors || {};
  const branding = settings?.branding || {};
  const assets = settings?.assets || {};
  const titleColor = colors.title || "#000000";
  const borderColor = colors.border || "#000000";
  const fetchedLogo = assets.logoUrl || EaristLogo;
  const companyName = branding.companyName || "";
  const campusAddressFallback = branding.campusAddress || "";
  const branches = settings?.branches || [];

  const words = companyName.trim().split(" ");
  const middle = Math.ceil(words.length / 2);
  const firstLine = words.slice(0, middle).join(" ");
  const secondLine = words.slice(middle).join(" ");

  const divToPrintRef = useRef(null);
  const [examSchedule, setExamSchedule] = useState(null);
  const [curriculumOptions, setCurriculumOptions] = useState([]);
  const [scheduledBy, setScheduledBy] = useState("");

  const [person, setPerson] = useState({
    campus: "",
    profile_img: "",
    last_name: "",
    first_name: "",
    middle_name: "",
    extension: "",
    applicant_number: "",
  });

  const [isVerified, setIsVerified] = useState(false);
  const [verifiedAt, setVerifiedAt] = useState(null);
  const [attendanceToken, setAttendanceToken] = useState(null);
  const [attendanceStatus, setAttendanceStatus] = useState(null);

  // ---------------- Access control ----------------
  const [hasAccess, setHasAccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [employeeID, setEmployeeID] = useState("");
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("email");
    const storedRole = localStorage.getItem("role");
    const storedID = localStorage.getItem("person_id");
    const storedEmployeeID = localStorage.getItem("employee_id");

    if (!storedUser || !storedRole || !storedID) {
      window.location.href = "/login";
      return;
    }

    setUserRole(storedRole);
    setEmployeeID(storedEmployeeID);

    const allowedRoles = ["registrar", "superadmin"];
    if (!allowedRoles.includes(storedRole)) {
      window.location.href = "/login";
      return;
    }

    checkAccess(storedEmployeeID);
  }, []);

  const checkAccess = async (empID) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/page_access/${empID}/${PAGE_ID}`,
      );
      setHasAccess(response.data?.page_privilege === 1);
    } catch (error) {
      console.error("Error checking access:", error);
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Manual search ----------------
  const [persons, setPersons] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  useEffect(() => {
    const fetchPersons = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/upload_documents`);
        setPersons(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Error fetching applicants for manual search:", err);
      }
    };
    fetchPersons();
  }, []);

  // ---------------- QR scanner ----------------
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const isSecureContext =
    typeof window !== "undefined" && window.isSecureContext;

  const handleOpenScanner = () => {
    setScanStatus(null);

    if (!isSecureContext) {
      setScanStatus({
        type: "error",
        message:
          "Camera access is blocked because this page isn't loaded over HTTPS (or localhost). " +
          "Open this app via https://, or via http://localhost on this device, to use the scanner.",
      });
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setScanStatus({
        type: "error",
        message: "This browser doesn't support camera access.",
      });
      return;
    }

    setScannerOpen(true);
  };

  const handleScan = async (decodedText) => {
    const token = String(decodedText || "").trim();
    if (!token) return;

    setBusy(true);
    setScanStatus(null);

    try {
      const res = await axios.post(`${API_BASE_URL}/api/exam-attendance/scan`, {
        token,
        scanned_by: employeeID,
        scanned_by_role: userRole,
      });
      setScanStatus({ type: "success", message: res.data.message });

      if (person?.applicant_number) {
        fetchAllForApplicant(person.applicant_number, person.person_id);
      }
    } catch (err) {
      setScanStatus({
        type: "error",
        message: err.response?.data?.message || "Failed to record attendance.",
      });
    } finally {
      setBusy(false);
    }
  };

  const fetchAllForApplicant = async (applicant_number, personIdFromSearch) => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/person/${personIdFromSearch}`,
      );
      let personData = res.data;
      personData.applicant_number = applicant_number;
      setPerson(personData);

      try {
        const verifyRes = await axios.get(
          `${API_BASE_URL}/api/document-verification/${applicant_number}`,
        );
        setIsVerified(Boolean(verifyRes.data?.verified));
        setVerifiedAt(
          verifyRes.data?.verified ? verifyRes.data.verified_at : null,
        );
      } catch (verErr) {
        console.error("Error fetching verification status:", verErr);
      }

      try {
        const schedRes = await axios.get(
          `${API_BASE_URL}/api/applicant-schedule/${applicant_number}`,
        );
        setExamSchedule(schedRes.data);
      } catch (schedErr) {
        console.error("Error fetching exam schedule:", schedErr);
        setExamSchedule(null);
      }

      try {
        const attRes = await axios.get(
          `${API_BASE_URL}/api/exam-attendance/token/${applicant_number}`,
        );
        setAttendanceToken(attRes.data?.qr_token || null);
        setAttendanceStatus(attRes.data?.status || null);
      } catch (attErr) {
        console.error("Error fetching attendance token:", attErr);
        setAttendanceToken(null);
        setAttendanceStatus(null);
      }

      try {
        const progRes = await axios.get(`${API_BASE_URL}/api/applied_program`);
        setCurriculumOptions(progRes.data);
      } catch (progErr) {
        console.error("Error fetching programs:", progErr);
      }

      try {
        const registrarRes = await axios.get(
          `${API_BASE_URL}/api/scheduled-by/registrar`,
        );
        if (registrarRes.data?.fullName)
          setScheduledBy(registrarRes.data.fullName);
      } catch (regErr) {
        console.error("Error fetching registrar name:", regErr);
      }
    } catch (err) {
      console.error("Error fetching exam permit data:", err);
    }
  };

  const handleSelectPerson = (newValue) => {
    setSelectedPerson(newValue);
    setSearchQuery(newValue?.applicant_number || "");
    setScanStatus(null);

    if (newValue?.applicant_number && newValue?.person_id) {
      fetchAllForApplicant(newValue.applicant_number, newValue.person_id);
    } else {
      setPerson({
        campus: "",
        profile_img: "",
        last_name: "",
        first_name: "",
        middle_name: "",
        extension: "",
        applicant_number: "",
      });
      setExamSchedule(null);
      setAttendanceToken(null);
      setAttendanceStatus(null);
      setIsVerified(false);
      setVerifiedAt(null);
    }
  };

  const matchedBranch = branches.find(
    (branch) => String(branch?.id) === String(person?.campus),
  );
  const campusAddress = matchedBranch?.address || campusAddressFallback;

  // ---------------- Attendance state (PRESENT / ABSENT / NOT YET ARRIVED) ----------------
  const getAttendanceState = () => {
    if (!person?.applicant_number) return null;

    const scanned =
      attendanceStatus === 1 ||
      attendanceStatus === "1" ||
      String(attendanceStatus || "").toLowerCase() === "present" ||
      String(attendanceStatus || "").toLowerCase() === "scanned";

    if (scanned) {
      return { label: "PRESENT", color: "#1b5e20" };
    }

    // NEW: applicant has no exam schedule generated yet
    if (!examSchedule) {
      return { label: "NO SCHEDULE YET", color: "#e65100" };
    }

    if (examSchedule?.end_time) {
      const today = new Date();
      const [h, m, s] = String(examSchedule.end_time).split(":").map(Number);
      const examEnd = new Date(today);
      examEnd.setHours(h || 0, m || 0, s || 0, 0);

      if (today > examEnd) {
        return { label: "ABSENT", color: "#b71c1c" };
      }
    }

    return { label: "NOT YET ARRIVED", color: "#616161" };
  };

  const attendanceState = getAttendanceState();

  // ---------------- Mobile scaling for the printable permit ----------------
  // The permit markup is built at a fixed 8.5in (816px) print width so that
  // printing/PDF output never changes. On phones/tablets we visually scale
  // that fixed-width block down to fit the viewport instead of rewriting the
  // whole table layout, and we compensate the wrapper's height so no blank
  // space is left below the shrunk content. On print, the scale is reset to
  // 1 via @media print so the physical output is unaffected.
  const scaleWrapperRef = useRef(null);
  const [permitScale, setPermitScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState(null);

  useLayoutEffect(() => {
    let rafId = null;

    const computeScale = () => {
      const wrapper = scaleWrapperRef.current;
      const content = divToPrintRef.current;
      if (!wrapper || !content) return;

      const available = wrapper.clientWidth;
      const rawScale =
        available > 0 && available < PERMIT_WIDTH_PX
          ? available / PERMIT_WIDTH_PX
          : 1;

      // Round to 2 decimal places so tiny sub-pixel differences don't
      // count as "changed" and re-trigger the observer forever.
      const nextScale = Math.round(rawScale * 100) / 100;
      const nextHeight = Math.round(content.scrollHeight * nextScale);

      setPermitScale((prev) => (prev === nextScale ? prev : nextScale));
      setScaledHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    };

    const scheduleCompute = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(computeScale);
    };

    computeScale();

    window.addEventListener("resize", scheduleCompute);
    window.addEventListener("orientationchange", scheduleCompute);

    const ro =
      typeof ResizeObserver !== "undefined" && divToPrintRef.current
        ? new ResizeObserver(scheduleCompute)
        : null;
    if (ro && divToPrintRef.current) ro.observe(divToPrintRef.current);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", scheduleCompute);
      window.removeEventListener("orientationchange", scheduleCompute);
      if (ro) ro.disconnect();
    };
  }, [
    person,
    examSchedule,
    attendanceToken,
    attendanceState,
    curriculumOptions,
  ]);

  if (loading || hasAccess === null) {
    return <LoadingOverlay open={loading} message="Loading..." />;
  }

  if (!hasAccess) {
    return <Unauthorized />;
  }

  return (
    <Box
      sx={{
        height: "calc(100vh - 150px)",
        overflowY: "scroll", // was "auto" — always show the scrollbar track
        overflowX: "hidden",
        scrollbarGutter: "stable", // reserves the gutter even if content doesn't overflow yet
        backgroundColor: "transparent",
        p: isMobile ? 1.5 : 2,
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: isMobile ? "flex-start" : "center",
          gap: isMobile ? 1.5 : 3,
          mb: 3,
          flexDirection: isTablet ? "column" : "row",
          flexWrap: "wrap",
        }}
      >
        {/* LEFT SIDE */}
        <Typography
          variant={isMobile ? "h6" : "h4"}
          sx={{
            fontWeight: "bold",
            color: titleColor,
            whiteSpace: isMobile ? "normal" : "nowrap",
            lineHeight: 1.2,
          }}
        >
          ENTRANCE EXAM QR CODE SCANNER
        </Typography>

        {/* RIGHT SIDE */}
        <Stack
          direction={isMobile ? "column" : "row"}
          spacing={1.5}
          sx={{
            width: isTablet ? "100%" : "auto",
            alignItems: isMobile ? "stretch" : "center",
            flexWrap: "wrap",
            marginLeft: isTablet ? 0 : "auto",
          }}
        >
          <Autocomplete
            options={persons}
            value={selectedPerson}
            inputValue={searchQuery}
            open={suggestionsOpen && searchQuery.trim().length >= 2}
            onOpen={() => setSuggestionsOpen(true)}
            onClose={() => setSuggestionsOpen(false)}
            isOptionEqualToValue={(option, value) =>
              option?.applicant_number === value?.applicant_number
            }
            getOptionLabel={(option) =>
              option
                ? `${option.applicant_number || ""} - ${option.last_name || ""}, ${option.first_name || ""} ${option.middle_name || ""}`
                : ""
            }
            onInputChange={(event, newInputValue, reason) => {
              if (reason !== "reset") {
                setSearchQuery(newInputValue);
                setSuggestionsOpen(true);
              }
            }}
            filterOptions={(options, state) => {
              const query = state.inputValue.trim().toLowerCase();
              if (query.length < 2) return [];

              return options
                .filter((applicant) =>
                  getApplicantSuggestionText(applicant).includes(query),
                )
                .slice(0, 8);
            }}
            onChange={(event, newValue) => {
              handleSelectPerson(newValue);
              setSuggestionsOpen(false);
            }}
            noOptionsText="No matching applicants"
            sx={{ width: isTablet ? "100%" : 420 }}
            renderOption={(props, option) => {
              const { key, ...optionProps } = props;
              const applicantNumber = cleanSuggestionValue(option?.applicant_number);
              const name = getApplicantSuggestionName(option);
              const email = cleanSuggestionValue(option?.emailAddress || option?.email);

              return (
                <Box
                  component="li"
                  key={key}
                  {...optionProps}
                  sx={{
                    px: 2,
                    py: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    fontSize: 14,
                    borderBottom: "1px solid #f0f0f0",
                    "&:hover": { backgroundColor: "#f5f7fb" },
                  }}
                >
                  <Typography component="span" sx={{ fontWeight: 700, minWidth: 120 }}>
                    {applicantNumber || "No applicant ID"}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{
                      color: "#444",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {[name, email].filter(Boolean).join(" - ")}
                  </Typography>
                </Box>
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                variant="outlined"
                placeholder="Search Applicant Name / Applicant ID"
                size="small"
                sx={{
                  width: 450,
                  backgroundColor: "#fff",
                  borderRadius: 1,
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "10px",
                  },
                }}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <SearchIcon sx={{ mr: 1, color: "gray" }} />
                      {params.InputProps.startAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        </Stack>

        <Button
          variant="contained"
          color="secondary"
          startIcon={<CameraAltIcon />}
          onClick={handleOpenScanner}
          disabled={busy}
          fullWidth={isTablet}
          sx={{
            minWidth: isTablet ? "auto" : "175px",
            height: "44px",
            marginLeft: "15px",
            fontWeight: "bold",
          }}
        >
          {busy ? "Processing..." : "Scan QR"}
        </Button>
      </Box>

      <hr style={{ border: "1px solid #ccc", width: "100%" }} />
      <br />
      <br />
      {!isSecureContext && (
        <Alert severity="warning" sx={{ mb: 2, fontSize: "14px" }}>
          You're viewing this page over an insecure connection (
          {window.location.origin}). Camera scanning will be blocked until this
          is served over HTTPS or accessed via <code>http://localhost</code>.
        </Alert>
      )}

      {scanStatus && (
        <Alert
          severity={scanStatus.type === "success" ? "success" : "error"}
          sx={{ mb: 2, fontSize: "15px" }}
        >
          {scanStatus.message}
        </Alert>
      )}

      {/* ---------------- FULL EXAM PERMIT TEMPLATE ---------------- */}
      {person?.applicant_number && (
        <Box
          ref={scaleWrapperRef}
          className="exam-permit-scale-wrapper"
          sx={{
            width: "100%",
            maxWidth: `${PERMIT_WIDTH_PX}px`,
            margin: "10px auto 0",
            overflow: "hidden",
            // Compensate the collapsed space left by the CSS transform scale
            height: scaledHeight ? `${scaledHeight}px` : "auto",
          }}
        >
          <div
            ref={divToPrintRef}
            className="exam-permit-container"
            style={{
              width: "8.5in",
              minHeight: "9in",
              backgroundColor: "white",
              padding: "20px",
              position: "relative",
              boxSizing: "border-box",
              transform: `scale(${permitScale})`,
              transformOrigin: "top left",
            }}
          >
            <style>{`
              @page {
                size: 8.5in 11in;
                margin: 0.25in 0.25in 0.25in 0.25in;
              }
              @media print {
                html, body {
                  width: 8.5in;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                .exam-permit-scale-wrapper {
                  height: auto !important;
                  max-width: none !important;
                  overflow: visible !important;
                }
                .exam-permit-container {
                  transform: none !important;
                }
                button { display: none; }
              }
            `}</style>

            {/* VERIFIED / NOT VERIFIED Watermark */}
            <div
              style={{
                position: "absolute",
                top: "26%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                fontSize: "120px",
                fontWeight: "900",
                color: isVerified
                  ? "rgba(0, 128, 0, 0.15)"
                  : "rgba(255, 0, 0, 0.15)",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                pointerEvents: "none",
                userSelect: "none",
                zIndex: 0,
                fontFamily: "Arial",
                letterSpacing: "0.3rem",
              }}
            >
              {isVerified ? "VERIFIED" : "NOT VERIFIED"}
            </div>

            <style>{`
              @media print {
                  div[style*="rotate(-30deg)"] {
                      color: ${isVerified ? "rgba(0, 128, 0, 0.25)" : "rgba(255, 0, 0, 0.25)"};
                  }
                  button { display: none; }
              }
            `}</style>

            {/* Header */}
            <table
              width="100%"
              style={{
                borderCollapse: "collapse",
                marginTop: "-40px",
                fontFamily: "Arial",
              }}
            >
              <tbody>
                <tr>
                  <td style={{ width: "20%", textAlign: "center" }}>
                    <img
                      src={fetchedLogo}
                      alt="School Logo"
                      style={{
                        marginLeft: "-10px",
                        width: "120px",
                        height: "120px",
                        marginTop: "10px",
                        borderRadius: "50%",
                        objectFit: "cover",
                      }}
                    />
                  </td>
                  <td
                    style={{
                      width: "60%",
                      textAlign: "center",
                      lineHeight: "1",
                    }}
                  >
                    <div style={{ fontFamily: "Arial", fontSize: "13px" }}>
                      Republic of the Philippines
                    </div>
                    <div
                      style={{
                        fontWeight: "bold",
                        fontFamily: "Arial",
                        fontSize: "20px",
                      }}
                    >
                      {firstLine}
                    </div>
                    {secondLine && (
                      <div
                        style={{
                          fontWeight: "bold",
                          fontFamily: "Arial",
                          fontSize: "20px",
                        }}
                      >
                        {secondLine}
                      </div>
                    )}
                    {campusAddress && (
                      <div style={{ fontFamily: "Arial", fontSize: "13px" }}>
                        {campusAddress}
                      </div>
                    )}
                    <div style={{ marginTop: "30px" }}>
                      <b
                        style={{
                          fontSize: "24px",
                          letterSpacing: "1px",
                          fontWeight: "bold",
                        }}
                      >
                        EXAMINATION PERMIT
                      </b>
                    </div>
                  </td>
                  <td
                    colSpan={4}
                    rowSpan={6}
                    style={{
                      textAlign: "center",
                      position: "relative",
                      width: "4.5cm",
                      height: "4.5cm",
                    }}
                  >
                    <div
                      style={{
                        width: "3.80cm",
                        height: "3.80cm",
                        marginRight: "10px",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        position: "relative",
                        border: `1px solid ${borderColor}`,
                        overflow: "hidden",
                        borderRadius: "4px",
                        marginTop: "10px",
                      }}
                    >
                      {person.profile_img ? (
                        <img
                          src={`${API_BASE_URL}/uploads/Applicant1by1/${person.profile_img}`}
                          alt="Profile"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: "12px", color: "#888" }}>
                          No Image
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ height: "20px" }} />

            {/* Applicant Details Table */}
            <table
              className="student-table"
              style={{
                borderCollapse: "collapse",
                fontFamily: "Arial",
                fontSize: "15px",
                width: "8in",
                margin: "0 auto",
                tableLayout: "fixed",
              }}
            >
              <tbody>
                {/* Applicant Number */}
                <tr style={{ fontFamily: "Arial", fontSize: "15px" }}>
                  <td colSpan={40}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        width: "100%",
                        gap: "10px",
                      }}
                    >
                      <label
                        style={{ fontWeight: "bold", whiteSpace: "nowrap" }}
                      >
                        Applicant No.:
                      </label>
                      <div
                        style={{
                          borderBottom: "1px solid black",
                          fontFamily: "Arial",
                          fontWeight: "normal",
                          fontSize: "15px",
                          minWidth: "278px",
                          height: "1.2em",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        {person?.applicant_number}
                      </div>
                    </div>
                  </td>
                </tr>

                {/* Name + Permit No. */}
                <tr>
                  <td colSpan={20}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                      }}
                    >
                      <label
                        style={{ fontWeight: "bold", marginRight: "10px" }}
                      >
                        Name:
                      </label>
                      <span
                        style={{
                          flexGrow: 1,
                          borderBottom: "1px solid black",
                          fontFamily: "Arial",
                          minWidth: "250px",
                        }}
                      >
                        {person?.last_name?.toUpperCase()},{" "}
                        {person?.first_name?.toUpperCase()}{" "}
                        {person?.middle_name?.toUpperCase() || ""}{" "}
                        {person?.extension?.toUpperCase() || ""}
                      </span>
                    </div>
                  </td>
                  <td colSpan={20}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                      }}
                    >
                      <label
                        style={{ fontWeight: "bold", marginRight: "10px" }}
                      >
                        Permit No.:
                      </label>
                      <span
                        style={{
                          flexGrow: 1,
                          borderBottom: "1px solid black",
                          minWidth: "200px",
                          fontFamily: "Arial",
                        }}
                      >
                        {person?.applicant_number}
                      </span>
                    </div>
                  </td>
                </tr>

                {/* Course + Major */}
                <tr>
                  <td colSpan={20}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                      }}
                    >
                      <label
                        style={{ fontWeight: "bold", marginRight: "10px" }}
                      >
                        Course Applied:
                      </label>
                      <span
                        style={{
                          flexGrow: 1,
                          borderBottom: "1px solid black",
                          minWidth: "220px",
                          fontFamily: "Arial",
                        }}
                      >
                        {curriculumOptions.find(
                          (c) =>
                            c.curriculum_id?.toString() ===
                            (person?.program ?? "").toString(),
                        )?.program_description || ""}
                      </span>
                    </div>
                  </td>
                  <td colSpan={20}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                      }}
                    >
                      <label
                        style={{ fontWeight: "bold", marginRight: "10px" }}
                      >
                        Major:
                      </label>
                      <span
                        style={{
                          flexGrow: 1,
                          borderBottom: "1px solid black",
                          minWidth: "200px",
                          fontFamily: "Arial",
                        }}
                      >
                        {curriculumOptions.find(
                          (c) =>
                            c.curriculum_id?.toString() ===
                            (person?.program ?? "").toString(),
                        )?.major || ""}
                      </span>
                    </div>
                  </td>
                </tr>

                {/* Date of Exam + Time */}
                <tr style={{ fontFamily: "Arial", fontSize: "15px" }}>
                  <td colSpan={20}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                      }}
                    >
                      <label
                        style={{
                          fontWeight: "bold",
                          whiteSpace: "nowrap",
                          marginRight: "10px",
                        }}
                      >
                        Date of Exam:
                      </label>
                      <span
                        style={{
                          flexGrow: 1,
                          borderBottom: "1px solid black",
                          height: "1.2em",
                          fontFamily: "Arial",
                          textAlign: "left",
                        }}
                      >
                        {examSchedule?.schedule_created_at
                          ? new Date(
                              examSchedule.schedule_created_at,
                            ).toLocaleDateString("en-US", {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            })
                          : ""}
                      </span>
                    </div>
                  </td>
                  <td colSpan={20}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                      }}
                    >
                      <label
                        style={{
                          fontWeight: "bold",
                          whiteSpace: "nowrap",
                          marginRight: "10px",
                        }}
                      >
                        Time:
                      </label>
                      <span
                        style={{
                          flexGrow: 1,
                          borderBottom: "1px solid black",
                          height: "1.2em",
                          fontFamily: "Arial",
                          textAlign: "left",
                        }}
                      >
                        {examSchedule
                          ? new Date(
                              `1970-01-01T${examSchedule.start_time}`,
                            ).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })
                          : ""}
                      </span>
                    </div>
                  </td>
                </tr>

                {/* Bldg. / Floor / Room No. — 3 even columns */}
                <tr style={{ fontFamily: "Arial", fontSize: "15px" }}>
                  <td colSpan={16}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <label
                        style={{ fontWeight: "bold", whiteSpace: "nowrap" }}
                      >
                        Building:
                      </label>
                      <span
                        style={{
                          flexGrow: 1,
                          borderBottom: "1px solid black",
                          height: "1.2em",
                          fontFamily: "Arial",
                          textAlign: "left",
                        }}
                      >
                        {examSchedule?.building_description || ""}
                      </span>
                    </div>
                  </td>
                  <td colSpan={8}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <label
                        style={{ fontWeight: "bold", whiteSpace: "nowrap" }}
                      >
                        Floor :
                      </label>
                      <span
                        style={{
                          flexGrow: 1,
                          borderBottom: "1px solid black",
                          height: "1.2em",
                          fontFamily: "Arial",
                          textAlign: "center",
                        }}
                      >
                        {examSchedule?.floor || ""}
                      </span>
                    </div>
                  </td>
                  <td colSpan={16}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <label
                        style={{ fontWeight: "bold", whiteSpace: "nowrap" }}
                      >
                        Room No.:
                      </label>
                      <span
                        style={{
                          flexGrow: 1,
                          borderBottom: "1px solid black",
                          height: "1.2em",
                          fontFamily: "Arial",
                          textAlign: "left",
                        }}
                      >
                        {examSchedule?.room_description || ""}
                      </span>
                    </div>
                  </td>
                </tr>

                {/* Date Verified / Scheduled by — 2 even columns */}
                <tr style={{ fontFamily: "Arial", fontSize: "15px" }}>
                  <td colSpan={20}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                      }}
                    >
                      <label
                        style={{
                          fontWeight: "bold",
                          whiteSpace: "nowrap",
                          marginRight: "10px",
                        }}
                      >
                        Date Verified:
                      </label>
                      <span
                        style={{
                          flexGrow: 1,
                          borderBottom: "1px solid black",
                          height: "1.2em",
                          fontFamily: "Arial",
                          textAlign: "left",
                        }}
                      >
                        {verifiedAt
                          ? new Date(verifiedAt).toLocaleDateString("en-US", {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            })
                          : ""}
                      </span>
                    </div>
                  </td>
                  <td colSpan={20}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                      }}
                    >
                      <label
                        style={{
                          fontWeight: "bold",
                          whiteSpace: "nowrap",
                          marginRight: "10px",
                        }}
                      >
                        Scheduled by:
                      </label>
                      <span
                        style={{
                          flexGrow: 1,
                          borderBottom: "1px solid black",
                          height: "1.2em",
                          fontFamily: "Arial",
                          textAlign: "left",
                        }}
                      >
                        {scheduledBy || "N/A"}
                      </span>
                    </div>
                  </td>
                </tr>

                {/* ✅ Attendance status (left) + QR code (right) — same row, two columns */}
                <tr>
                  <td
                    colSpan={20}
                    style={{
                      paddingTop: "18px",
                      paddingBottom: "10px",
                      verticalAlign: "middle",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        height: "200px",
                      }}
                    >
                      {attendanceState ? (
                        <span
                          style={{
                            fontSize:
                              attendanceState.label === "NOT YET ARRIVED" ||
                              attendanceState.label === "NO SCHEDULE YET"
                                ? "30px" // slightly smaller since this string is longer
                                : "48px",
                            fontWeight: 900,
                            color: attendanceState.color,
                            textTransform: "uppercase",
                            letterSpacing: "1px",
                            textAlign: "center",
                            lineHeight: 1.1,
                            fontFamily: "Arial",
                          }}
                        >
                          {attendanceState.label}
                        </span>
                      ) : (
                        <span style={{ fontSize: "14px", color: "#888" }}>
                          No attendance record
                        </span>
                      )}
                    </div>
                  </td>

                  <td
                    colSpan={20}
                    style={{ paddingTop: "18px", paddingBottom: "10px" }}
                  >
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <div
                        style={{
                          width: "200px",
                          height: "200px",
                          border: `2px solid ${attendanceState?.color || borderColor}`,
                          borderRadius: "6px",
                          background: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        {attendanceToken ? (
                          <QRCodeSVG
                            value={attendanceToken}
                            size={150}
                            level="H"
                          />
                        ) : (
                          <span
                            style={{
                              fontSize: "11px",
                              color: "#888",
                              textAlign: "center",
                              padding: "0 10px",
                            }}
                          >
                            No attendance QR yet
                          </span>
                        )}

                        {person?.applicant_number && (
                          <div
                            style={{
                              position: "absolute",
                              top: "50%",
                              left: "50%",
                              transform: "translate(-50%, -50%)",
                              fontSize: "12px",
                              fontWeight: "bold",
                              color: "maroon",
                              background: "white",
                              padding: "2px 6px",
                              borderRadius: "3px",
                              textAlign: "center",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {person.applicant_number}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            <table
              className="student-table"
              style={{
                borderCollapse: "collapse",
                fontFamily: "Arial",
                width: "8in",
                margin: "0 auto",
                textAlign: "center",
                tableLayout: "fixed",
                border: "1px solid black",
              }}
            >
              <tbody>
                <tr>
                  <td
                    colSpan={40}
                    style={{
                      color: "black",
                      padding: "12px",
                      lineHeight: "1.6",
                      textAlign: "left",
                      fontSize: "14px",
                      fontFamily: "Arial",
                    }}
                  >
                    <strong>IMPORTANT REMINDERS FOR APPLICANTS:</strong>
                    <ul style={{ marginTop: "8px" }}>
                      <strong>Step 1:</strong> Check your Examination Date,
                      Time, and Room Number indicated on your permit.
                      <br />
                      <strong>Step 2:</strong> Bring all required items on the
                      exam day:
                      <ul>
                        <li>
                          Official Examination Permit with VERIFIED watermark on
                          it
                        </li>
                        <li>No. 2 Pencil (any brand)</li>
                        <li>2 Short bond papers</li>
                      </ul>
                      <strong>Step 3:</strong> Wear the proper attire:
                      <ul>
                        <li>
                          Plain white T-shirt or plain white polo shirt{" "}
                          <strong>(no prints, no logos, no designs)</strong>
                        </li>
                        <li>Pants (Shorts and ripped jeans are not allowed)</li>
                        <li>Closed shoes (no crocs, sandals, slippers)</li>
                      </ul>
                      <strong>Step 4:</strong> Keep the two paper sheets
                      attached to your exam permit.
                      <br />
                      <strong>Step 5:</strong> Please Arrive at least 1 hour
                      before your examination time. Late applicants will NOT be
                      allowed to enter once the exam room door closes.
                      <br />
                      <br />
                      <div style={{ textAlign: "center", marginLeft: "-50px" }}>
                        <strong>GOOD LUCK TO ALL ASPIRING APPLICANTS!</strong>
                      </div>
                    </ul>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Box>
      )}

      <QRScanner
        open={scannerOpen}
        onScan={(text) => {
          setScannerOpen(false);
          handleScan(text);
        }}
        onClose={() => setScannerOpen(false)}
      />
    </Box>
  );
};

export default ExamAttendanceScanner;
