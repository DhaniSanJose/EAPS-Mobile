import React, { useState, useEffect, useContext, useRef } from "react";
import { SettingsContext } from "../App";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import ApplicantExamPermit from "../components/ApplicantExamPermit";
import EaristLogo from "../assets/EaristLogo.png";
import {
  TextField,
  Button,
  Box,
  Typography,
  Snackbar,
  Alert,
} from "@mui/material";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import QRScanner from "./QRScanner";
import API_BASE_URL from "../apiConfig";
import { FcPrint } from "react-icons/fc";

const ApplicantProfile = () => {
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
    if (settings.sub_button_color) setSubButtonColor(settings.sub_button_color);
    if (settings.stepper_color) setStepperColor(settings.stepper_color);

    // 🏫 Logo
    if (settings.logo_url) {
      setFetchedLogo(`${API_BASE_URL}${settings.logo_url}`);
    } else {
      setFetchedLogo(EaristLogo);
    }

    // 🏷️ School Info
    if (settings.company_name) setCompanyName(settings.company_name);
    if (settings.short_term) setShortTerm(settings.short_term);
    if (settings.campus_address) setCampusAddress(settings.campus_address);

    // ✅ Branches (JSON stored in DB)
    if (settings?.branches) {
      try {
        const parsed =
          typeof settings.branches === "string"
            ? JSON.parse(settings.branches)
            : settings.branches;

        setBranches(parsed);
      } catch (err) {
        console.error("Failed to parse branches:", err);
        setBranches([]);
      }
    }
  }, [settings]);

  const { applicantNumber } = useParams();
  const navigate = useNavigate();

  const [personId, setPersonId] = useState(null);
  const [searchQuery, setSearchQuery] = useState(applicantNumber || "");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    type: "info",
  });

  const showSnackbar = (message, type = "info") => {
    setSnackbar({ open: true, message, type });
  };

  const divToPrintRef = useRef();

  const printDiv = () => {
    const divToPrint = divToPrintRef.current;
    if (divToPrint) {
      const newWin = window.open("", "Print-Window");
      newWin.document.open();
      newWin.document.write(`
        <html>
          <head>
            <title>Print</title>
            <style>
                @page {
                size: A4;
                margin: 0;
              }
  
              html, body {
                margin: 0;
                padding: 0;
                width: 210mm;
                height: 297mm;
                font-family: Arial;
                overflow: hidden;
              }
  
              *, *::before, *::after {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
              }
  
              .print-container {
                width: 100%;
                height: auto;
                padding: 10px 20px;
  
                /* 🔹 Apply 10% zoom out */
                transform: scale(0.90);
            
              }
  
              .student-table {
                margin-top: -50px !important;
              }
  
              button {
                display: none;
              }
  
              .dataField {
                margin-top: 2px !important;
              }
  
              svg.MuiSvgIcon-root {
                margin-top: -53px;
                width: 70px !important;
                height: 70px !important;
              }
            </style>
          </head>
          <body onload="window.print(); setTimeout(() => window.close(), 100);">
            <div class="print-container">
              ${divToPrint.innerHTML}
            </div>
          </body>
        </html>
      `);
      newWin.document.close();
    } else {
      console.error("divToPrintRef is not set.");
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  // 🔁 Auto-load when URL has applicant number
  useEffect(() => {
    if (applicantNumber) {
      setHasSearched(true);
      setSearchQuery(applicantNumber);
      fetchApplicantData(applicantNumber);
    }
  }, [applicantNumber]);

  const [finalDocsCompleted, setFinalDocsCompleted] = useState(false);

  const fetchSubmittedDocuments = async (pid) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/applicant-documents/${pid}`);

      if (Array.isArray(res.data)) {
        const allSubmitted = res.data.every(
          doc => Number(doc.submitted_documents) === 1
        );

        setFinalDocsCompleted(allSubmitted);

        setSteps(prev => ({
          ...prev,
          step4: allSubmitted,
          step5: allSubmitted && prev.step3 // example logic
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };


  const [steps, setSteps] = useState({
    step1: false,
    step1Status: "",
    qualifyingDone: false,
    qualifyingStatus: "",
    interviewDone: false,
    interviewStatus: "",
    step3: false,
    step3Status: "",
    step4: false,
    step5: false,
  });

  const [hasStudentNumber, setHasStudentNumber] = useState(false);
  const [studentNumber, setStudentNumber] = useState(null);

  const normalizeExamStatus = (status) => {
    if (status === 0 || String(status).trim() === "0") return "PASSED";
    if (status === 1 || String(status).trim() === "1") return "FAILED";

    const normalized = String(status ?? "").trim().toUpperCase();
    if (["PASSED", "PASS"].includes(normalized)) return "PASSED";
    if (["FAILED", "FAIL"].includes(normalized)) return "FAILED";
    return "";
  };

  const normalizeResultStatus = (status) => {
    if (status === null || status === undefined || String(status).trim() === "") {
      return "";
    }

    if (status === 0 || String(status).trim() === "0") return "PASSED";
    if (status === 1 || String(status).trim() === "1") return "FAILED";

    const normalized = String(status).trim().toUpperCase();
    if (["PASSED", "PASS"].includes(normalized)) return "PASSED";
    if (["FAILED", "FAIL"].includes(normalized)) return "FAILED";
    return "";
  };

  const normalizeCollegeApprovalStatus = (status) => {
    if (status === null || status === undefined || String(status).trim() === "") {
      return "";
    }

    // if (status === 0 || String(status).trim() === "0") return "WAITING LIST";
    if (status === 1 || String(status).trim() === "1") return "ACCEPTED";
    if (status === 2 || String(status).trim() === "2") return "REJECTED";

    const normalized = String(status).trim().toUpperCase();
    if (normalized === "ACCEPTED") return "ACCEPTED";
    if (normalized === "REJECTED") return "REJECTED";
    // if (
    //   normalized === "WAITING LIST" ||
    //   normalized === "WAITING" ||
    //   normalized === "ON PROCESS"
    // ) {
    //   return "WAITING LIST";
    // }

    return "";
  };

  const fetchApplicantData = async (query) => {
    if (!query) return;

    try {
      // 1️⃣ Get person_id
      const res = await axios.get(
        `${API_BASE_URL}/api/person-by-applicant/${query}`
      );

      if (!res.data?.person_id) {
        showSnackbar("❌ Applicant not found.", "error");
        setPersonId(null);
        return;
      }

      const pid = res.data.person_id;

      // 2️⃣ Check document verification
      const verifiedRes = await axios.get(
        `${API_BASE_URL}/api/document_status/check/${query}`
      );

      if (!verifiedRes.data.verified) {
        showSnackbar(
          "❌ Documents not yet verified. Not qualified for exam.",
          "error"
        );
        setPersonId(null);
        return;
      }

      let entrance_exam_status = null;
      let qualifying_status = null;
      let interview_status = null;

      try {
        const scoreRes = await axios.get(
          `${API_BASE_URL}/api/applicant-scores/${query}`
        );

        entrance_exam_status = normalizeExamStatus(scoreRes.data?.entrance_exam_status);
        qualifying_status = normalizeResultStatus(scoreRes.data?.qualifying_status);
        interview_status = normalizeResultStatus(scoreRes.data?.interview_status);
      } catch (err) {
        console.error("Score API failed:", err);
      }

      // 4️⃣ Get college approval status (waiting list / accepted / rejected)
      let collegeApprovalStatus = "";

      try {
        const statusRes = await axios.get(
          `${API_BASE_URL}/api/interview_applicants/${query}`
        );

        collegeApprovalStatus = normalizeCollegeApprovalStatus(
          statusRes.data?.status
        );
      } catch (err) {
        if (err.response?.status !== 404) {
          console.error("College approval status API failed:", err);
        }
      }

      const isAccepted = collegeApprovalStatus === "ACCEPTED";

      // 5️⃣ Registrar (STEP 4)
      let isRegistrarApproved = false;

      try {
        const registrarRes = await axios.get(
          `${API_BASE_URL}/api/submitted-status/${pid}`
        );

        isRegistrarApproved =
          Number(registrarRes.data?.submitted_documents) === 1;
      } catch (err) {
        console.error("Registrar API failed:", err);
      }

      // 6️⃣ Student Number (STEP 5)
      let hasStudentNumberLocal = false;
      let student_number = null;

      try {
        const studentRes = await axios.get(
          `${API_BASE_URL}/api/student_status/${pid}`
        );

        hasStudentNumberLocal = studentRes.data?.hasStudentNumber;
        student_number = studentRes.data?.student_number;
      } catch (err) {
        console.error("Student API failed:", err);
      }

      // 🔥 FINAL STEP LOGIC
      const newSteps = {
        step1:
          entrance_exam_status === "PASSED" ||
          entrance_exam_status === "FAILED",
        step1Status: entrance_exam_status,

        // separate step 2 states
        qualifyingDone:
          qualifying_status === "PASSED" ||
          qualifying_status === "FAILED",
        qualifyingStatus: qualifying_status,
        interviewDone:
          interview_status === "PASSED" ||
          interview_status === "FAILED",
        interviewStatus: interview_status,

        step3: isAccepted,
        step3Status: collegeApprovalStatus,
        step4: isRegistrarApproved,
        step5: isRegistrarApproved && hasStudentNumberLocal,
      };

      setSteps(newSteps);

      // ✅ Student number state
      if (hasStudentNumberLocal) {
        setStudentNumber(student_number);
        setHasStudentNumber(true);
      } else {
        setHasStudentNumber(false);
      }

      // 🧠 Snackbar logic
      if (!entrance_exam_status) {
        showSnackbar(
          "📝 The applicant is qualified to take the Entrance Examination. Please proceed with the examination process.",
          "info"
        );

      } else if (
        entrance_exam_status === "PASSED" &&
        !newSteps.qualifyingDone &&
        !newSteps.interviewDone
      ) {
        showSnackbar(
          "✅ The applicant has completed the Entrance Examination successfully and is now waiting to be contacted for the Qualifying Examination or Interview schedule.",
          "success"
        );

      } else if (
        newSteps.qualifyingDone ||
        newSteps.interviewDone
      ) {
        showSnackbar(
          "🎤 The applicant has completed the Qualifying Examination and/or Interview process successfully.",
          "success"
        );
      }

      if (collegeApprovalStatus === "ACCEPTED") {
        showSnackbar(
          "🏥 The applicant may now proceed with the Medical Examination as part of the admission requirements.",
          "success"
        );
      } else if (collegeApprovalStatus === "REJECTED") {
        showSnackbar(
          "❌ The applicant has been rejected by the college.",
          "error"
        );
      }
      // } else if (collegeApprovalStatus === "WAITING LIST") {
      //   showSnackbar(
      //     "⏳ The applicant is on the waiting list for college approval.",
      //     "info"
      //   );
      // }

      if (isRegistrarApproved) {
        showSnackbar(
          "📄 The applicant has successfully submitted the original documents to the Registrar's Office and is now waiting for the student number to be generated.",
          "success"
        );
      }

      if (hasStudentNumberLocal) {
        showSnackbar(
          "🎓 The student number has been successfully generated. The student is now waiting for subject tagging and class schedule assignment.",
          "success"
        );
      }

      setPersonId(pid);
    } catch (err) {
      console.error("❌ MAIN ERROR:", err);
      showSnackbar("⚠️ Error fetching applicant data.", "error");
      setPersonId(null);
    }
  };


  const handleSearch = () => {
    if (!searchQuery.trim()) return;

    setHasSearched(true);

    // ✅ stays on VITE (5173)
    navigate(`/applicant_profile/${searchQuery.trim()}`);
    fetchApplicantData(searchQuery.trim());
  };

  return (
    <Box
      sx={{
        height: "calc(100vh - 150px)",
        overflowY: "auto",
        backgroundColor: "transparent",
        p: 2,

      }}
    >
      <Typography
        variant="h4"
        sx={{ fontWeight: "bold", color: titleColor, mb: 2 }}
      >
        APPLICANT PROFILE
      </Typography>
      <hr style={{ border: "1px solid #ccc", width: "100%" }} />
      <br />

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        {/* Left side: Search and Scan */}
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <TextField
            label="Enter Applicant Number"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
          />

          <Button variant="contained" sx={{ width: "175px" }} onClick={handleSearch}>
            Search
          </Button>

          <Button
            variant="contained"
            color="secondary"
            sx={{ width: "175px" }}
            startIcon={<CameraAltIcon />}
            onClick={() => setScannerOpen(true)}
          >
            Scan QR
          </Button>
        </Box>

        {/* Right side: Print Button */}
        <button
          onClick={printDiv}
          style={{
            padding: "10px 20px",
            border: "2px solid black",
            backgroundColor: "#f0f0f0",
            color: "black",
            borderRadius: "5px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "bold",
            transition: "background-color 0.3s, transform 0.2s",
          }}
          onMouseEnter={(e) => (e.target.style.backgroundColor = "#d3d3d3")}
          onMouseLeave={(e) => (e.target.style.backgroundColor = "#f0f0f0")}
          onMouseDown={(e) => (e.target.style.transform = "scale(0.95)")}
          onMouseUp={(e) => (e.target.style.transform = "scale(1)")}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FcPrint size={20} />
            Print Admission Form
          </span>
        </button>
      </Box>

      {/* QR Scanner */}
      <QRScanner
        open={scannerOpen}
        onScan={(text) => {
          let scanned = String(text || "").trim();
          if (scanned.includes("/")) scanned = scanned.split("/").pop();

          setScannerOpen(false);
          setSearchQuery(scanned);
          setHasSearched(true);
          navigate(`/applicant_profile/${scanned}`);
          fetchApplicantData(scanned);
        }}
        onClose={() => setScannerOpen(false)}
      />

      {/* RESULT */}
      {hasSearched && (
        <>
          {personId ? (
            <ApplicantExamPermit printRef={divToPrintRef} personId={personId} steps={steps} />
          ) : (
            <Typography color="error">
              Invalid Applicant Number
            </Typography>
          )}
        </>
      )}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity={snackbar.type} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ApplicantProfile;
